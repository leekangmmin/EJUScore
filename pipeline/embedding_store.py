"""
EJU Embedding Store — TF-IDF vectorization and domain exemplar management.
Provides Tier 2 embedding-based classification.
"""
import re
import json
import os
import math
from typing import Dict, List, Optional, Tuple
from collections import Counter, defaultdict

# Try to import sklearn; if not available, use a simple fallback
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


# Japanese stop words for TF-IDF
JAPANESE_STOP_WORDS = {
    'は', 'が', 'を', 'に', 'の', 'へ', 'で', 'と', 'から', 'より',
    'も', 'か', 'や', 'な', 'で', 'ある', 'いる', 'する', 'なる',
    'この', 'その', 'あの', 'どの', 'ここ', 'そこ', 'あそこ',
    'それ', 'これ', 'あれ', 'これら', 'それら', '彼', '彼女',
    '私', 'あなた', 'たち', '方', 'の', 'こと', 'もの', 'ため',
    'です', 'ます', 'た', 'だ', 'ない', 'れる', 'られる',
    'せる', 'させる', 'よう', 'そう', 'みたい', 'らしい',
    '一', '二', '三', '四', '五', '十', '百', '千', '万',
    '円', '年', '月', '日', '時', '分', '秒',
    '第', '問', '間', '番', 'つ', '個', '人',
}


class EmbeddingStore:
    """
    Manages TF-IDF vectorization and domain exemplar centroids.
    Provides cosine-similarity based domain classification.
    """

    def __init__(self, data_dir: str = None):
        self.vectorizer = None
        self.domain_centroids: Dict[str, 'np.ndarray'] = {}
        self.exemplar_questions: Dict[str, List[str]] = {
            'economy': [], 'politics': [],
            'history': [], 'geography': [], 'society': [],
        }
        self.is_fitted = False
        self.data_dir = data_dir

    def build_from_dataset(self, questions: List[Dict]) -> bool:
        """
        Build exemplar database from high-confidence existing classifications.
        Returns True if successful.
        """
        if not HAS_SKLEARN:
            return False

        # Collect high-confidence exemplars
        domain_texts: Dict[str, List[str]] = {
            'economy': [], 'politics': [],
            'history': [], 'geography': [], 'society': [],
        }

        for q in questions:
            domain = q.get('domain', '')
            text = q.get('text', '') or q.get('cleaned_text', '') or ''
            confidence = q.get('domain_confidence', q.get('ocr_confidence', 0))

            if domain in domain_texts and confidence >= 0.7 and len(text) >= 20:
                # Also include answer choices if available
                choices = q.get('answer_choices', [])
                context = text
                if choices:
                    context += ' ' + ' '.join(choices)
                domain_texts[domain].append(context)

        # Check that we have enough exemplars
        total = sum(len(v) for v in domain_texts.values())
        if total < 50:
            return False

        # Build TF-IDF vectorizer
        all_texts = []
        for domain, texts in domain_texts.items():
            self.exemplar_questions[domain] = texts
            all_texts.extend(texts)

        self.vectorizer = TfidfVectorizer(
            max_features=10000,
            ngram_range=(1, 3),  # unigrams + bigrams + trigrams for Japanese
            stop_words=list(JAPANESE_STOP_WORDS),
            analyzer='char_wb',  # character-level for Japanese
            sublinear_tf=True,
            max_df=0.85,
            min_df=2,
        )

        # Fit vectorizer on all texts
        self.vectorizer.fit(all_texts)

        # Compute centroids per domain
        for domain, texts in domain_texts.items():
            if not texts:
                continue
            vectors = self.vectorizer.transform(texts)
            self.domain_centroids[domain] = np.mean(vectors.toarray(), axis=0)

        self.is_fitted = True
        return True

    def classify(self, text: str, context: str = '', window_texts: List[str] = None) -> Tuple[str, float]:
        """
        Classify a question using embedding similarity.
        
        Args:
            text: Question text
            context: Additional context (answer choices, etc.)
            window_texts: Surrounding question texts for context window
            
        Returns:
            (domain, confidence) where confidence is 0.0-1.0
        """
        if not self.is_fitted or not text:
            return 'unknown', 0.0

        import numpy as np

        # Build composite text with context
        composite = text
        if context:
            composite += ' ' + context
        if window_texts:
            # Add context window with lower weight
            for i, wt in enumerate(window_texts):
                if wt:
                    composite += ' ' + wt

        # Vectorize
        vec = self.vectorizer.transform([composite])
        vec_dense = vec.toarray()[0]

        # Compute cosine similarity to each domain centroid
        similarities = {}
        for domain, centroid in self.domain_centroids.items():
            # Cosine similarity
            dot = np.dot(vec_dense, centroid)
            norm_v = np.linalg.norm(vec_dense)
            norm_c = np.linalg.norm(centroid)
            if norm_v > 0 and norm_c > 0:
                sim = dot / (norm_v * norm_c)
            else:
                sim = 0.0
            similarities[domain] = float(sim)

        if not similarities:
            return 'unknown', 0.0

        # Find best domain
        best_domain = max(similarities, key=similarities.get)
        best_score = similarities[best_domain]

        # Softmax normalization for confidence
        scores = np.array(list(similarities.values()))
        exp_scores = np.exp(scores - np.max(scores))  # numerical stability
        softmax_scores = exp_scores / exp_scores.sum()
        domain_list = list(similarities.keys())
        best_idx = domain_list.index(best_domain)
        confidence = float(softmax_scores[best_idx])

        # Confidence adjustment: check if multi-domain ambiguity
        sorted_scores = sorted(similarities.values(), reverse=True)
        if len(sorted_scores) >= 2:
            margin = sorted_scores[0] - sorted_scores[1]
            if margin < 0.05:
                # Too close, reduce confidence
                confidence *= 0.7

        return best_domain, round(min(confidence, 1.0), 4)

    def save(self, path: str) -> bool:
        """Save the embedding store state."""
        if not self.is_fitted:
            return False

        try:
            state = {
                'is_fitted': True,
                'domain_centroids': {
                    k: v.tolist() if hasattr(v, 'tolist') else v
                    for k, v in self.domain_centroids.items()
                },
                'exemplar_counts': {
                    k: len(v) for k, v in self.exemplar_questions.items()
                },
            }
            # Save vectorizer vocabulary
            if self.vectorizer:
                state['vocabulary'] = self.vectorizer.vocabulary_
                state['idf'] = self.vectorizer.idf_.tolist() if hasattr(self.vectorizer, 'idf_') else []

            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
            return True
        except Exception:
            return False

    def load(self, path: str) -> bool:
        """Load the embedding store state."""
        if not HAS_SKLEARN:
            return False

        try:
            with open(path, 'r') as f:
                state = json.load(f)

            import numpy as np
            self.domain_centroids = {
                k: np.array(v) for k, v in state.get('domain_centroids', {}).items()
            }
            self.is_fitted = state.get('is_fitted', False)

            if state.get('vocabulary'):
                self.vectorizer = TfidfVectorizer(
                    max_features=10000,
                    ngram_range=(1, 3),
                    analyzer='char_wb',
                )
                self.vectorizer.vocabulary_ = state['vocabulary']
                if state.get('idf'):
                    self.vectorizer.idf_ = np.array(state['idf'])

            return self.is_fitted
        except Exception:
            return False
