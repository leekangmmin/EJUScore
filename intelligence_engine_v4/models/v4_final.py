"""
V4 Final Architecture — Integrated V3+V4 topic predictor.

Architecture:
  1. Probability Scoring: V3's 6-factor ensemble (recency, frequency, cycle, 
     Markov, Bayesian, hidden trend) — well-calibrated probabilities
  2. Dynamic N: V4's historical analysis + trend-aware N prediction
  3. Cluster Completion: V4's graph-based cluster-level completion
  4. Adaptive Threshold: V4's dynamic threshold selection

V4 Correction History:
  - Bug 1 (PREREQUISITE_MAP): Non-existent prerequisite topic references 
    ('경제학 기초', '삼권분립', etc.) prevented apply_prerequisite_boost()
    from ever activating. Fixed by remapping to nearest TRAIN_TOPICS.
  - Bug 2 (V4FinalBacktester): Did not pass use_cluster/use_prerequisite
    to predict(). Fixed by adding parameters to run().
  - Bug 3 (Cluster Completion): The adaptive threshold re-computation after
    probability boosting counteracted any gains. Fixed by using top-N ranking
    with forced inclusion of cluster-completed topics.
  - Bug 4 (FP Flood): Cluster prob multiplier=0.85 caused 30+ predictions/year.
    Fixed: multiplier→0.40, min_confidence→0.50, added history filter.
  - Bug 5 (Markov Factor): markov_score calculation divided by self, producing
    near-constant 0.3 or 1.0. Fixed: use actual co-occurrence probability.
  - Bug 6 (Bayesian Prior): Beta(2,10) prior was too conservative, crushing
    sparse topic probabilities below 0.1. Fixed: Beta(3,3) neutral prior.
"""

import json
import math
import numpy as np
from collections import defaultdict
from typing import Dict, List, Optional, Tuple, Set

from intelligence_engine_v4.config import (
    THRESHOLD_DEFAULT, TEST_YEARS, TARGET_YEARS,
    CLUSTER_PROB_MULTIPLIER, CLUSTER_MIN_CONFIDENCE,
)
from intelligence_engine_v4.data import (
    TRAIN_TOPICS, TOPIC_TO_IDX, IDX_TO_TOPIC,
    TOPIC_TO_CLUSTER, CLUSTER_TO_TOPICS, TOPIC_CLUSTERS,
    DOMAIN_OF_TOPIC, DOMAINS, N_TOPICS, N_CLUSTERS,
    build_topic_year_matrix, build_labels,
    load_gold_standard,
)
from intelligence_engine_v4.models.dynamic_n import (
    predict_dynamic_n, compute_threshold_from_n,
)
from intelligence_engine_v4.inference.cluster_completion import (
    apply_cluster_completion, select_topics_by_threshold,
    apply_prerequisite_boost,
)


# ── V3 6-Factor Ensemble Probability Scoring (Improved) ────────────

# Structural break year: 2016 (exam format changed, topic count 2.3x)
STRUCTURAL_BREAK_YEAR = 2016
# Weight for pre-break data (lower = focus on recent patterns)
PRE_BREAK_WEIGHT = 0.5
# Weight for post-break data (higher = more influence)
POST_BREAK_WEIGHT = 2.0


def compute_v3_probabilities(
    year_matrix: Dict[str, Dict[int, int]],
    target_year: int,
) -> np.ndarray:
    """
    Compute well-calibrated topic probabilities using an improved 6-factor ensemble.

    Improvements over original V3:
    1. Structural break weighting: 2016+ data weighted 4x more than pre-2016
    2. Bayesian prior: Beta(3,3) instead of Beta(2,10) for neutral prior
    3. Markov factor: Fixed co-occurrence probability (was dividing by self)
    4. Recency decay: Still active but weighted by structural break
    
    Returns:
        Probabilities array (N_TOPICS,) normalized to [0, 1]
    """
    decay_constant = math.log(2) / 3.0
    years_range = list(range(2002, target_year))
    n_years = len(years_range)
    
    # Precompute for Markov
    topic_years = {}
    for topic in TRAIN_TOPICS:
        yearly = year_matrix.get(topic, {})
        active_years = {y for y, c in yearly.items() if c > 0 and y < target_year}
        topic_years[topic] = active_years
    
    # Markov transition: topics that co-occur frequently
    co_occurrence = defaultdict(lambda: defaultdict(int))
    for i, t_i in enumerate(TRAIN_TOPICS):
        for j, t_j in enumerate(TRAIN_TOPICS):
            if i >= j:
                continue
            common = topic_years.get(t_i, set()) & topic_years.get(t_j, set())
            if common:
                co_occurrence[t_i][t_j] = len(common)
                co_occurrence[t_j][t_i] = len(common)
    
    # Recent topics (last 2 years)
    recent_topics = [
        t for t in TRAIN_TOPICS
        if any(y >= target_year - 2 for y in topic_years.get(t, set()))
    ]
    
    # Compute scores for each topic
    scores = np.zeros(N_TOPICS, dtype=np.float64)
    
    for i, topic in enumerate(TRAIN_TOPICS):
        yearly = year_matrix.get(topic, {})
        
        # Factor 1: Recency-weighted frequency (with structural break weighting)
        recency_weighted = 0.0
        total_weight = 0.0
        for year in years_range:
            cnt = yearly.get(year, 0)
            years_ago = target_year - year
            base_weight = math.exp(-decay_constant * years_ago)
            # Structural break weight: post-2016 data weighted higher
            if year >= STRUCTURAL_BREAK_YEAR:
                base_weight *= POST_BREAK_WEIGHT
            else:
                base_weight *= PRE_BREAK_WEIGHT
            recency_weighted += cnt * base_weight
            total_weight += base_weight
        
        # Normalize: typical max ~5 questions per year
        recency_score = recency_weighted / max(1e-8, total_weight) / 5.0
        recency_score = min(1.0, recency_score)
        
        # Factor 2: Historical baseline (with structural break weighting)
        pre_2016_active = sum(1 for y, c in yearly.items() if c > 0 and y < STRUCTURAL_BREAK_YEAR)
        post_2015_active = sum(1 for y, c in yearly.items() if c > 0 and y >= STRUCTURAL_BREAK_YEAR and y < target_year)
        # Weighted active years
        weighted_active = PRE_BREAK_WEIGHT * pre_2016_active + POST_BREAK_WEIGHT * post_2015_active
        weighted_total = PRE_BREAK_WEIGHT * max(1, STRUCTURAL_BREAK_YEAR - 2002) + POST_BREAK_WEIGHT * max(1, target_year - STRUCTURAL_BREAK_YEAR)
        freq_density = weighted_active / max(1, weighted_total)
        
        total_questions = sum(c for y, c in yearly.items() if y < target_year)
        avg_intensity = total_questions / max(1, pre_2016_active + post_2015_active)
        intensity_norm = min(1.0, avg_intensity / 15.0)
        baseline_score = 0.4 * freq_density + 0.6 * intensity_norm
        
        # Factor 3: Topic rotation cycle (FIXED: guard on appearance_years, not active_years_total)
        cycle_score = 0.3
        active_years_total = pre_2016_active + post_2015_active
        appearance_years = sorted([y for y, c in yearly.items() if c > 0 and y < target_year])
        if len(appearance_years) >= 2:
            intervals = [appearance_years[k] - appearance_years[k-1] for k in range(1, len(appearance_years))]
            avg_interval = sum(intervals) / len(intervals)
            years_since = target_year - 1 - appearance_years[-1]
            
            if avg_interval <= 1.5:
                cycle_score = 0.8
            elif years_since >= avg_interval - 1:
                cycle_score = 0.8
            elif years_since >= avg_interval * 0.7:
                cycle_score = 0.6
            elif years_since <= 1:
                cycle_score = 0.5 if avg_interval > 2 else 0.7
            else:
                cycle_score = 0.3
        
        # Factor 4: Markov transition (FIXED — was dividing by self)
        markov_score = 0.3
        if recent_topics:
            transition_scores = []
            for rt in recent_topics:
                if rt != topic:
                    # Actual co-occurrence probability
                    co_count = co_occurrence.get(rt, {}).get(topic, 0)
                    if co_count > 0:
                        transition_scores.append(co_count)
            if transition_scores:
                # Use max co-occurrence, normalized by max possible (n_years)
                max_co = max(transition_scores)
                markov_score = min(0.9, max_co / max(1, n_years) * 4.0)
        
        # Factor 5: Bayesian posterior (IMPROVED — Beta(3,3) neutral prior)
        n_success = active_years_total
        n_failure = n_years - active_years_total
        # Beta(3,3) prior: mode=0.5, moderate variance
        # Allows sparse topics to have meaningful probabilities (0.13 for 1/24)
        alpha_post = 3.0 + n_success
        beta_post = 3.0 + n_failure
        bayes_score = alpha_post / (alpha_post + beta_post)
        
        # Factor 6: Hidden trend (CUSUM-like)
        recent_3 = sum(yearly.get(y, 0) for y in range(max(target_year - 3, STRUCTURAL_BREAK_YEAR), target_year))
        prev_3 = sum(yearly.get(y, 0) for y in range(max(target_year - 6, STRUCTURAL_BREAK_YEAR - 3), target_year - 3))
        recent_3_weighted = recent_3 * POST_BREAK_WEIGHT
        prev_3_weighted = prev_3 * PRE_BREAK_WEIGHT
        trend_score = 0.5 + 0.3 * (1.0 if recent_3_weighted > prev_3_weighted else -1.0 if recent_3_weighted < prev_3_weighted else 0.0)
        trend_score = max(0.1, min(0.9, trend_score))
        
        # Ensemble: weighted combination (V3 weights, adjusted)
        final_score = (
            0.15 * recency_score +
            0.20 * baseline_score +
            0.15 * cycle_score +
            0.15 * markov_score +
            0.20 * bayes_score +
            0.15 * trend_score
        )
        
        scores[i] = min(1.0, max(0.01, final_score))
    
    return scores.astype(np.float32)


def compute_cluster_probabilities(topic_probs: np.ndarray) -> np.ndarray:
    """Compute cluster-level probabilities from topic probabilities."""
    cluster_probs = np.zeros(N_CLUSTERS, dtype=np.float32)
    for ci, cname in enumerate(TOPIC_CLUSTERS):
        indices = [TOPIC_TO_IDX[t] for t in TOPIC_CLUSTERS[cname]['topics'] if t in TOPIC_TO_IDX]
        if indices:
            cluster_probs[ci] = float(np.mean(topic_probs[indices]))
        else:
            cluster_probs[ci] = 0.2
    return cluster_probs


# ── V4 Predictor (Final Integrated Version) ────────────────────────

class V4FinalPredictor:
    """
    Final V4 predictor integrating V3's 6-factor probability scoring
    with V4's Dynamic N + Cluster Completion + Adaptive Threshold.

    Selection logic (corrected for V4 architecture):
      1. Compute base probabilities (V3 6-factor ensemble, improved)
      2. Compute Dynamic N (from historical patterns)
      3. Compute cluster probabilities from base probs
      4. Apply Cluster Completion (with history filter + calibrated multiplier)
      5. Apply Prerequisite Boost (boosts prerequisites of high-conf topics)
      6. Hybrid selection:
         - Base top-N by base probability
         - Force-include any cluster-completed topic that passed history filter
         - Limit total to N + cluster_extra
      7. Sort final selection by boosted probability
    """

    def __init__(self):
        self.year_matrix = {}
        self.is_trained = False
        self.training_years = []

    def train(self, years=None, gold_standard_path=None, verbose=False):
        questions = load_gold_standard(gold_standard_path)
        self.year_matrix = build_topic_year_matrix(questions)
        if years is None:
            years = sorted(set(
                y for topic, yearly in self.year_matrix.items()
                for y in yearly
            ))
        self.training_years = years
        if verbose:
            print(f"V4Final: {len(years)} years ({min(years)}-{max(years)}), {N_TOPICS} topics")
        self.is_trained = True

    def predict(self, target_year=2026, strictness=0.6, slack=1,
                use_cluster=True, use_prerequisite=True, verbose=False):
        """
        Predict topics for target_year.

        Args:
            target_year: Year to predict
            strictness: 0-1 (higher = more recall-focused)
            slack: Extra topics to include beyond predicted N
            use_cluster: Apply cluster completion
            use_prerequisite: Apply prerequisite boosting

        Returns:
            Dict with predictions and metadata
        """
        if not self.is_trained:
            raise RuntimeError("Train first!")

        # Step 1: Improved V3 6-factor ensemble probability scoring
        base_probs = compute_v3_probabilities(self.year_matrix, target_year)
        topic_probs = base_probs.copy()

        # Step 2: Compute cluster probabilities from base probs
        cluster_probs = compute_cluster_probabilities(base_probs)

        # Step 3: Dynamic N prediction
        predicted_n = predict_dynamic_n(self.year_matrix, target_year, strictness)
        base_n = min(N_TOPICS, max(1, predicted_n + slack))

        # Step 4: Apply cluster completion (boosts sparse topics in active clusters)
        # Now with history filter: topics with 0 historical appearances are NOT boosted
        if use_cluster:
            topic_probs = apply_cluster_completion(
                topic_probs, cluster_probs,
                year_matrix=self.year_matrix,
                target_year=target_year,
            )

        # Step 5: Apply prerequisite boost
        if use_prerequisite:
            topic_probs = apply_prerequisite_boost(topic_probs, self.year_matrix, target_year)

        # Step 6: Hybrid selection
        #   - Base selection: top base_n by base probability
        #   - Cluster selection: topics from active clusters that passed history filter
        #   - Union: base selected + cluster selected
        #   - Trim: if total > max_topics, keep highest boosted probs

        # Base selection
        base_sorted = np.argsort(base_probs)[::-1]
        base_selected_indices = set(base_sorted[:base_n])

        # Cluster forced-inclusion (with calibrated multiplier)
        cluster_included_indices: Set[int] = set()
        if use_cluster:
            for ci, cname in enumerate(TOPIC_CLUSTERS):
                if ci >= len(cluster_probs):
                    continue
                if cluster_probs[ci] < CLUSTER_MIN_CONFIDENCE:
                    continue
                topics_in_cluster = CLUSTER_TO_TOPICS.get(cname, [])
                for t in topics_in_cluster:
                    idx = TOPIC_TO_IDX.get(t)
                    if idx is not None:
                        # Include if boosted above minimum floor
                        min_floor = cluster_probs[ci] * CLUSTER_PROB_MULTIPLIER
                        if topic_probs[idx] >= min_floor:
                            cluster_included_indices.add(idx)

        # Union: combine base + cluster included
        final_indices = set(base_selected_indices) | cluster_included_indices

        # Max topics allowed
        max_topics = base_n + len(cluster_included_indices)
        max_topics = min(N_TOPICS, max_topics)

        if len(final_indices) > max_topics:
            # Keep top max_topics by boosted probability
            sorted_by_boosted = sorted(final_indices, key=lambda i: -topic_probs[i])
            final_indices = set(sorted_by_boosted[:max_topics])

        # Create mask
        mask = np.zeros(N_TOPICS, dtype=bool)
        for i in final_indices:
            mask[i] = True

        # Determine rescued topics (included only because of boosting)
        rescued = set()
        for i in final_indices:
            if i not in base_selected_indices and i in cluster_included_indices:
                rescued.add(IDX_TO_TOPIC[i])

        # Build predictions sorted by boosted probability
        predicted_topics = []
        for i in range(N_TOPICS):
            if mask[i]:
                t = IDX_TO_TOPIC[i]
                predicted_topics.append({
                    'topic': t,
                    'domain': DOMAIN_OF_TOPIC.get(t, ''),
                    'probability': float(topic_probs[i]),
                    'base_probability': float(base_probs[i]),
                    'cluster': TOPIC_TO_CLUSTER.get(t, ''),
                    'is_rescued': t in rescued,
                })
        predicted_topics.sort(key=lambda x: x['probability'], reverse=True)

        # Compute threshold for reference
        all_selected_probs = [topic_probs[i] for i in final_indices]
        actual_threshold = min(all_selected_probs) if all_selected_probs else 0.0

        return {
            'target_year': target_year,
            'predicted_n': predicted_n,
            'base_n': base_n,
            'actual_threshold': float(actual_threshold),
            'predictions': predicted_topics,
            'probabilities': topic_probs,
            'base_probabilities': base_probs,
            'cluster_probs': cluster_probs,
            'rescued_topics': sorted(list(rescued)),
            'n_base': len(base_selected_indices),
            'n_rescued': len(rescued),
            'config': {
                'strictness': strictness,
                'slack': slack,
                'use_cluster': use_cluster,
                'use_prerequisite': use_prerequisite,
            },
        }


class V4FinalBacktester:
    """Backtest the final V4 integrated predictor."""

    def run(self, test_years=None, strictness=0.6, slack=1,
            use_cluster=True, use_prerequisite=True, verbose=False):
        if test_years is None:
            test_years = TEST_YEARS

        per_year = []
        for test_year in test_years:
            predictor = V4FinalPredictor()
            predictor.train(years=list(range(2002, test_year)), verbose=verbose)

            result = predictor.predict(
                target_year=test_year, strictness=strictness, slack=slack,
                use_cluster=use_cluster, use_prerequisite=use_prerequisite,
                verbose=verbose,
            )

            actual_labels = build_labels(predictor.year_matrix, test_year)
            actual = set(IDX_TO_TOPIC[i] for i in range(N_TOPICS) if actual_labels[i] > 0)
            predicted = set(p['topic'] for p in result['predictions'])

            tp = len(predicted & actual)
            fp = len(predicted - actual)
            fn = len(actual - predicted)
            p = tp / max(1, tp + fp)
            r = tp / max(1, tp + fn)
            f1 = 2 * p * r / max(0.001, p + r)

            yr = {
                'test_year': test_year, 'total_actual': len(actual),
                'total_predicted': len(predicted), 'true_positives': tp,
                'false_positives': fp, 'false_negatives': fn,
                'precision': round(p, 4), 'recall': round(r, 4),
                'f1_score': round(f1, 4), 'predicted_n': result['predicted_n'],
                'n_base': result['n_base'],
                'n_rescued': result['n_rescued'],
            }
            per_year.append(yr)

            if verbose:
                print(f"  {test_year}: P={p:.4f} R={r:.4f} F1={f1:.4f} "
                      f"(N={result['predicted_n']}, base={result['n_base']}, "
                      f"rescued={result['n_rescued']}, "
                      f"TP={tp}, FN={fn})")

        if not per_year:
            return {'error': 'No successful tests'}

        avg_p = float(np.mean([r['precision'] for r in per_year]))
        avg_r = float(np.mean([r['recall'] for r in per_year]))
        avg_f = float(np.mean([r['f1_score'] for r in per_year]))

        return {
            'methodology': 'V4 Final: Improved V3 6-factor + Structural Break Weight + '
                           'Calibrated Cluster Completion + History Filter',
            'config': {'strictness': strictness, 'slack': slack},
            'aggregate_metrics': {
                'avg_precision': round(avg_p, 4),
                'avg_recall': round(avg_r, 4),
                'avg_f1': round(avg_f, 4),
                'total_test_years': len(per_year),
            },
            'per_year_metrics': per_year,
        }


def plot_annual_results(results):
    """Visualize year-over-year precision/recall/f1."""
    try:
        import matplotlib.pyplot as plt
        years = [r['test_year'] for r in results['per_year_metrics']]
        precisions = [r['precision'] for r in results['per_year_metrics']]
        recalls = [r['recall'] for r in results['per_year_metrics']]
        f1s = [r['f1_score'] for r in results['per_year_metrics']]

        plt.figure(figsize=(12, 6))
        plt.plot(years, precisions, 'o-', label='Precision', color='#2196F3')
        plt.plot(years, recalls, 's-', label='Recall', color='#FF5722')
        plt.plot(years, f1s, '^-', label='F1 Score', color='#4CAF50')
        plt.xlabel('Test Year')
        plt.ylabel('Score')
        plt.title('V4 Final Predictor — Year-over-Year Performance')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        return plt
    except ImportError:
        print("matplotlib not available")
        return None
