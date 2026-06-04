#!/usr/bin/env python3
"""
EJU Domain Classifier v1.2 — Embedding-based centroid classifier.

Replaces the keyword-only fallback with a multilingual-e5-small embedding
classifier.  Builds per-domain centroids from the existing dataset
(excluding review_required), classifies via cosine similarity, and enforces
a hard confidence floor so that low-confidence predictions are routed to
review_required.

Usage:
    # Quick classification
    python classifier_v1_2.py --text "日本の標準時は東経135度..."

    # Full evaluation on the dataset
    python classifier_v1_2.py --evaluate

    # Interactive single-classify
    python classifier_v1_2.py --interactive

Requirements:
    pip install transformers torch numpy scikit-learn
"""

import argparse
import json
import os
import sys
import time
from collections import Counter, defaultdict
from typing import Dict, List, Optional, Tuple

import numpy as np
from numpy import ndarray

# ---------------------------------------------------------------------------
# Optional dependency handling
# ---------------------------------------------------------------------------
try:
    from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

try:
    import torch
    from transformers import AutoModel, AutoTokenizer
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DOMAINS = ['economy', 'politics', 'history', 'geography', 'society']
E5_MODEL_NAME = 'intfloat/multilingual-e5-small'
CONFIDENCE_THRESHOLD = 0.60       # hard floor — below this → review_required
MARGIN_PENALTY_THRESHOLD = 0.05   # if top-2 cosine gap < this, penalise
MARGIN_PENALTY_FACTOR = 0.70      # multiply confidence by this when margin is thin

DATASET_PATH = 'dataset/comprehensive/dataset_consolidated.json'
MASTER_DATASET_PATH = 'dataset/comprehensive/master_dataset.json'


# ===================================================================
# Embedding utilities
# ===================================================================

def _mean_pooling(token_embeddings: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    """Mean-pool token embeddings weighted by attention mask."""
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    return (token_embeddings * input_mask_expanded).sum(1) / input_mask_expanded.sum(1).clamp(min=1e-9)


class E5Embedder:
    """Wrapper around multilingual-e5-small for generating text embeddings."""

    def __init__(self, device: Optional[str] = None):
        if not HAS_TRANSFORMERS:
            raise ImportError(
                "transformers + torch are required.  Install with:\n"
                "  pip install transformers torch"
            )
        if device is None:
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.device = device
        print(f"[E5Embedder] Loading {E5_MODEL_NAME} on {device} ...", file=sys.stderr)
        t0 = time.time()
        self.tokenizer = AutoTokenizer.from_pretrained(E5_MODEL_NAME)
        self.model = AutoModel.from_pretrained(E5_MODEL_NAME).to(device).eval()
        print(f"[E5Embedder] Loaded in {time.time() - t0:.1f}s", file=sys.stderr)

    def _encode(self, texts: List[str], prefix: str = 'query') -> ndarray:
        """
        Encode a list of texts with the E5 prefix convention.

        Prefix should be 'query' for queries, 'passage' for documents.
        """
        prefixed = [f'{prefix}: {t}' for t in texts]
        encoded = self.tokenizer(
            prefixed, padding=True, truncation=True, max_length=512, return_tensors='pt'
        )
        encoded = {k: v.to(self.device) for k, v in encoded.items()}
        with torch.no_grad():
            outputs = self.model(**encoded)
        embeddings = _mean_pooling(outputs.last_hidden_state, encoded['attention_mask'])
        # L2 normalise
        embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
        return embeddings.cpu().numpy()

    def embed_queries(self, texts: List[str]) -> ndarray:
        """Embed query texts (questions to classify)."""
        return self._encode(texts, prefix='query')

    def embed_passages(self, texts: List[str]) -> ndarray:
        """Embed passage texts (training exemplars)."""
        return self._encode(texts, prefix='passage')


# ===================================================================
# Data loading
# ===================================================================

def load_dataset() -> List[Dict]:
    """
    Load all comprehensive exam questions from the consolidated dataset.
    Returns a flat list of question dicts with at minimum:
        text, answer_choices, domain, domain_confidence, year, round, number
    """
    with open(DATASET_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    questions = []
    for exam in data.get('exams', []):
        for q in exam.get('questions', []):
            text = (q.get('text') or '').strip()
            # Skip empty / garbage texts
            if len(text) < 10:
                continue
            questions.append({
                'text': text,
                'answer_choices': q.get('answer_choices', []),
                'domain': q.get('domain', 'unknown'),
                'domain_confidence': q.get('domain_confidence', 0.0),
                'year': q.get('year', exam.get('year', 0)),
                'round': q.get('round', exam.get('round', 1)),
                'number': q.get('number', 0),
            })
    return questions


def load_master_dataset() -> Tuple[List[Dict], List[Dict]]:
    """
    Load from master_dataset.json structure (exam_files referencing individual files).
    Returns (all_questions, training_questions) where training_questions excludes
    review_required.
    """
    with open(MASTER_DATASET_PATH, 'r', encoding='utf-8') as f:
        master = json.load(f)

    all_qs = []
    train_qs = []

    for exam_info in master.get('exam_files', []):
        year = exam_info['year']
        rnd = exam_info['round']
        fname = exam_info['file']
        path = os.path.join('dataset', 'comprehensive', str(year), fname)
        if not os.path.exists(path):
            continue
        with open(path, 'r', encoding='utf-8') as f:
            exam_data = json.load(f)
        for q in exam_data.get('questions', []):
            text = (q.get('text') or q.get('raw_text') or '').strip()
            if len(text) < 10:
                continue
            entry = {
                'text': text,
                'answer_choices': q.get('answer_choices', []),
                'domain': q.get('domain', 'unknown'),
                'domain_confidence': q.get('domain_confidence', 0.0),
                'year': year,
                'round': rnd,
                'number': q.get('number', 0),
            }
            all_qs.append(entry)
            if entry['domain'] not in ('review_required', 'unknown'):
                train_qs.append(entry)

    return all_qs, train_qs


# ===================================================================
# Centroid classifier
# ===================================================================

class CentroidClassifier:
    """
    Embedding centroid classifier using multilingual-e5-small.

    1. Build per-domain centroids from training data (non-review_required).
    2. Classify via cosine similarity to centroids.
    3. Enforce confidence threshold → review_required if below 0.60.
    4. Margin penalty for ambiguous top-2.
    """

    def __init__(self, embedder: E5Embedder):
        self.embedder = embedder
        self.centroids: Dict[str, ndarray] = {}   # domain → 384-dim vector
        self.training_counts: Dict[str, int] = {}  # domain → number of training examples
        self.is_fitted = False

    def build_from_questions(self, questions: List[Dict]) -> bool:
        """
        Build per-domain centroids from labelled questions.
        Returns True if successful.
        """
        texts_by_domain: Dict[str, List[str]] = {d: [] for d in DOMAINS}

        for q in questions:
            domain = q.get('domain', '')
            if domain not in texts_by_domain:
                continue
            text = q.get('text', '').strip()
            choices = q.get('answer_choices', [])
            if not text:
                continue
            composite = text
            if choices:
                composite += ' ' + ' '.join(choices)
            texts_by_domain[domain].append(composite)

        # Verify coverage
        for d in DOMAINS:
            if not texts_by_domain[d]:
                print(f"[WARN] Domain '{d}' has zero training examples!", file=sys.stderr)
                return False

        counts = {d: len(texts_by_domain[d]) for d in DOMAINS}
        print(f"[CentroidClassifier] Training on {sum(counts.values())} questions:", file=sys.stderr)
        for d in DOMAINS:
            print(f"  {d}: {counts[d]}", file=sys.stderr)

        # Generate embeddings for all training texts
        all_texts = []
        for d in DOMAINS:
            all_texts.extend(texts_by_domain[d])

        print(f"[CentroidClassifier] Generating embeddings for {len(all_texts)} passages ...", file=sys.stderr)
        t0 = time.time()
        all_embeddings = self.embedder.embed_passages(all_texts)
        print(f"[CentroidClassifier] Embedded in {time.time() - t0:.1f}s", file=sys.stderr)

        # Build centroids
        idx = 0
        for d in DOMAINS:
            count = counts[d]
            domain_embs = all_embeddings[idx:idx + count]
            self.centroids[d] = domain_embs.mean(axis=0)
            self.training_counts[d] = count
            idx += count

        # L2-normalise centroids (they should already be from normalised embeddings)
        for d in DOMAINS:
            norm = np.linalg.norm(self.centroids[d])
            if norm > 0:
                self.centroids[d] = self.centroids[d] / norm

        self.is_fitted = True
        print(f"[CentroidClassifier] Built centroids for {len(self.centroids)} domains", file=sys.stderr)
        return True

    def classify(self, text: str, answer_choices: Optional[List[str]] = None) -> Tuple[str, float]:
        """
        Classify a single question.

        Returns:
            (domain, confidence)
            domain: one of the 5 domains, or 'review_required'
            confidence: 0.0–1.0
        """
        if not self.is_fitted:
            return 'review_required', 0.0

        # Build composite text
        composite = text.strip()
        if answer_choices:
            composite += ' ' + ' '.join(answer_choices)

        if not composite or len(composite) < 5:
            return 'review_required', 0.0

        # Embed
        query_vec = self.embedder.embed_queries([composite])[0]  # (384,)

        # Cosine similarities to centroids (vectors already L2-normalised)
        sims = {}
        for d in DOMAINS:
            centroid = self.centroids[d]
            sim = float(np.dot(query_vec, centroid))  # cosine = dot product when both normalised
            sims[d] = sim

        # Sort by similarity
        sorted_domains = sorted(sims.items(), key=lambda x: -x[1])
        best_domain = sorted_domains[0][0]
        best_sim = sorted_domains[0][1]

        # Softmax confidence
        scores = np.array(list(sims.values()))
        exp_scores = np.exp(scores - np.max(scores))  # numerical stability
        softmax_probs = exp_scores / exp_scores.sum()
        domain_list = list(sims.keys())
        best_idx = domain_list.index(best_domain)
        confidence = float(softmax_probs[best_idx])

        # --- Margin logic ---
        if len(sorted_domains) >= 2:
            margin = sorted_domains[0][1] - sorted_domains[1][1]
            if margin < MARGIN_PENALTY_THRESHOLD:
                confidence *= MARGIN_PENALTY_FACTOR

        # --- Hard confidence floor ---
        if confidence < CONFIDENCE_THRESHOLD:
            return 'review_required', round(confidence, 4)

        return best_domain, round(confidence, 4)

    def classify_batch(self, questions: List[Dict]) -> List[Tuple[str, float]]:
        """
        Classify a batch of questions.  More efficient by batching embeddings.
        """
        if not self.is_fitted:
            return [('review_required', 0.0) for _ in questions]

        results = []
        # Build composite texts
        composites = []
        for q in questions:
            text = (q.get('text') or '').strip()
            choices = q.get('answer_choices', [])
            composite = text
            if choices:
                composite += ' ' + ' '.join(choices)
            composites.append(composite)

        # Batch embed
        query_vecs = self.embedder.embed_queries(composites)  # (N, 384)

        # Build centroid matrix (5, 384)
        centroid_list = np.array([self.centroids[d] for d in DOMAINS])  # (5, 384)

        # Cosine similarity: (N, 384) @ (384, 5) → (N, 5)
        sim_matrix = query_vecs @ centroid_list.T  # (N, 5)

        for i in range(len(questions)):
            sims_vec = sim_matrix[i]
            scores = sims_vec
            exp_scores = np.exp(scores - np.max(scores))
            softmax_probs = exp_scores / exp_scores.sum()

            best_idx = int(np.argmax(scores))
            best_domain = DOMAINS[best_idx]
            confidence = float(softmax_probs[best_idx])

            # Margin logic
            sorted_idx = np.argsort(-scores)
            if len(sorted_idx) >= 2:
                margin = scores[sorted_idx[0]] - scores[sorted_idx[1]]
                if margin < MARGIN_PENALTY_THRESHOLD:
                    confidence *= MARGIN_PENALTY_FACTOR

            # Hard floor
            if confidence < CONFIDENCE_THRESHOLD:
                results.append(('review_required', round(confidence, 4)))
            else:
                results.append((best_domain, round(confidence, 4)))

        return results


# ===================================================================
# Evaluation
# ===================================================================

def evaluate(classifier: CentroidClassifier, all_questions: List[Dict],
             train_questions: List[Dict]) -> Dict:
    """
    Evaluate classifier on the full dataset and produce metrics.

    Returns a dict with:
        before_counts: domain distribution from original labels
        after_counts: domain distribution from new classifier
        misclassifications: list of samples where non-review domains changed
        review_required_recovered: count of review_required now classified
        new_review_required: count of previously classified now review_required
        by_domain: per-domain misclassification stats
    """
    print("\n" + "=" * 70, file=sys.stderr)
    print("EVALUATION: Before vs After", file=sys.stderr)
    print("=" * 70, file=sys.stderr)

    # --- Before: original labels ---
    before_counter = Counter()
    for q in all_questions:
        before_counter[q['domain']] += 1

    # --- After: new classifier ---
    results = classifier.classify_batch(all_questions)

    after_counter = Counter()
    for (domain, conf) in results:
        after_counter[domain] += 1

    # --- Comparison ---
    # Track which review_required got recovered
    recovered = 0
    newly_flagged = 0
    misclassifications = []  # samples where domain changed (non-review → different domain)
    per_domain_correct = defaultdict(int)
    per_domain_total = defaultdict(int)

    for q, (new_domain, new_conf) in zip(all_questions, results):
        orig_domain = q['domain']

        if orig_domain == 'review_required' and new_domain != 'review_required':
            recovered += 1
        elif orig_domain != 'review_required' and new_domain == 'review_required':
            newly_flagged += 1

        # For non-review_required originals, check if domain changed
        if orig_domain not in ('review_required', 'unknown') and new_domain != 'review_required':
            per_domain_total[orig_domain] += 1
            if new_domain == orig_domain:
                per_domain_correct[orig_domain] += 1
            else:
                misclassifications.append({
                    'orig_domain': orig_domain,
                    'new_domain': new_domain,
                    'confidence': new_conf,
                    'text_preview': q['text'][:120],
                    'year': q['year'],
                    'round': q['round'],
                    'number': q['number'],
                })

    # --- Aggregate ---
    total_original = sum(before_counter.values())
    total_new = sum(after_counter.values())

    report = {
        'total_questions': total_original,
        'before': dict(before_counter),
        'after': dict(after_counter),
        'review_required_before': before_counter.get('review_required', 0),
        'review_required_after': after_counter.get('review_required', 0),
        'review_required_recovered': recovered,
        'newly_flagged_review_required': newly_flagged,
        'misclassification_count': len(misclassifications),
        'misclassifications': misclassifications[:100],  # cap at 100 samples
        'per_domain_accuracy': {
            d: {
                'correct': per_domain_correct.get(d, 0),
                'total': per_domain_total.get(d, 0),
                'accuracy': round(per_domain_correct.get(d, 0) / max(per_domain_total.get(d, 0), 1), 4),
            }
            for d in DOMAINS
        },
    }

    return report


def print_evaluation_report(report: Dict):
    """Pretty-print the evaluation report."""
    print("\n" + "=" * 70)
    print("  CLASSIFIER v1.2 — EVALUATION REPORT")
    print("=" * 70)

    print(f"\n  Total questions evaluated:  {report['total_questions']}")
    print(f"\n  ┌─ Review Required ──────────────────────────────┐")
    print(f"  │  Before (keyword + tier-2):  {report['review_required_before']:>4}                  │")
    print(f"  │  After  (E5 centroid):       {report['review_required_after']:>4}                  │")
    print(f"  │  Recovered from RR:           {report['review_required_recovered']:>4}                  │")
    print(f"  │  Newly flagged as RR:         {report['newly_flagged_review_required']:>4}                  │")
    print(f"  └──────────────────────────────────────────────────┘")

    print(f"\n  ┌─ Domain Distribution ──────────────────────────┐")
    print(f"  │  {'Domain':<15} {'Before':>8} {'After':>8} {'Chg':>6} │")
    print(f"  ├──────────────────────────────────────────────────┤")
    for d in DOMAINS:
        before = report['before'].get(d, 0)
        after = report['after'].get(d, 0)
        chg = after - before
        chg_str = f"+{chg}" if chg > 0 else str(chg)
        print(f"  │  {d:<15} {before:>8} {after:>8} {chg_str:>6} │")
    before_rr = report['before'].get('review_required', 0)
    after_rr = report['after'].get('review_required', 0)
    chg_rr = after_rr - before_rr
    chg_rr_str = f"+{chg_rr}" if chg_rr > 0 else str(chg_rr)
    print(f"  │  {'review_required':<15} {before_rr:>8} {after_rr:>8} {chg_rr_str:>6} │")
    print(f"  └──────────────────────────────────────────────────┘")

    print(f"\n  ┌─ Per-Domain Accuracy (non-RR, non-unknown) ───┐")
    print(f"  │  {'Domain':<15} {'Correct':>8} {'Total':>8} {'Acc':>8} │")
    print(f"  ├──────────────────────────────────────────────────┤")
    for d in DOMAINS:
        ad = report['per_domain_accuracy'][d]
        acc_str = f"{ad['accuracy']*100:.1f}%"
        print(f"  │  {d:<15} {ad['correct']:>8} {ad['total']:>8} {acc_str:>8} │")
    print(f"  └──────────────────────────────────────────────────┘")

    if report['misclassification_count'] > 0:
        print(f"\n  ┌─ Misclassification Samples (first 20) ────────┐")
        for i, m in enumerate(report['misclassifications'][:20]):
            print(f"  │  [{i+1:>2}] {m['orig_domain']:<12} → {m['new_domain']:<12} "
                  f"(conf={m['confidence']:.3f}) │")
            print(f"  │      \"{m['text_preview'][:70]}...\" │")
        if report['misclassification_count'] > 20:
            print(f"  │  ... and {report['misclassification_count'] - 20} more │")
        print(f"  └──────────────────────────────────────────────────┘")

    # Summary
    print(f"\n  ┌─ TARGET vs RESULT ─────────────────────────────┐")
    print(f"  │  Target:  review_required 386 → <100             │")
    print(f"  │  Result:  review_required {report['review_required_before']} → {report['review_required_after']}            │")
    target_met = report['review_required_after'] < 100
    print(f"  │  Target {'MET ✓' if target_met else 'NOT MET ✗':<55}  │")
    print(f"  └──────────────────────────────────────────────────┘")
    print()


# ===================================================================
# CLI
# ===================================================================

def main():
    parser = argparse.ArgumentParser(description='EJU Domain Classifier v1.2')
    parser.add_argument('--text', type=str, help='Classify a single text')
    parser.add_argument('--choices', type=str, nargs='*', default=[], help='Answer choices')
    parser.add_argument('--evaluate', action='store_true', help='Run full evaluation on dataset')
    parser.add_argument('--interactive', action='store_true', help='Interactive classification')
    args = parser.parse_args()

    # Load embedder (this caches the model)
    try:
        embedder = E5Embedder()
    except ImportError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    # Load data
    print("Loading dataset...", file=sys.stderr)
    all_qs, train_qs = load_master_dataset()
    print(f"  Total questions: {len(all_qs)}", file=sys.stderr)
    print(f"  Training questions (non-RR): {len(train_qs)}", file=sys.stderr)

    # Build classifier
    classifier = CentroidClassifier(embedder)
    if not classifier.build_from_questions(train_qs):
        print("ERROR: Failed to build classifier!", file=sys.stderr)
        sys.exit(1)

    # --- Single text classification ---
    if args.text:
        domain, conf = classifier.classify(args.text, args.choices)
        print(f"\nText: {args.text}")
        if args.choices:
            print(f"Choices: {' | '.join(args.choices)}")
        print(f"Domain: {domain}")
        print(f"Confidence: {conf:.4f}")
        return

    # --- Interactive ---
    if args.interactive:
        print("\nInteractive mode. Type a question or 'quit' to exit.\n")
        while True:
            text = input("Question text: ").strip()
            if text.lower() in ('quit', 'exit', 'q'):
                break
            if not text:
                continue
            choices_str = input("Answer choices (comma-sep, or skip): ").strip()
            choices = [c.strip() for c in choices_str.split(',')] if choices_str else []
            domain, conf = classifier.classify(text, choices)
            print(f"  → {domain}  (conf={conf:.4f})\n")
        return

    # --- Evaluation ---
    if args.evaluate:
        print("\nRunning full evaluation...", file=sys.stderr)
        report = evaluate(classifier, all_qs, train_qs)
        print_evaluation_report(report)

        # Save report to JSON for later analysis
        output_path = 'evaluation_report_v1_2.json'
        # Only save serializable data
        serializable_report = {
            'total_questions': report['total_questions'],
            'review_required_before': report['review_required_before'],
            'review_required_after': report['review_required_after'],
            'review_required_recovered': report['review_required_recovered'],
            'newly_flagged_review_required': report['newly_flagged_review_required'],
            'misclassification_count': report['misclassification_count'],
            'before': report['before'],
            'after': report['after'],
            'per_domain_accuracy': report['per_domain_accuracy'],
            'misclassifications': report['misclassifications'],
        }
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(serializable_report, f, ensure_ascii=False, indent=2)
        print(f"Report saved to {output_path}", file=sys.stderr)
        return

    # Default: show help
    parser.print_help()


if __name__ == '__main__':
    main()
