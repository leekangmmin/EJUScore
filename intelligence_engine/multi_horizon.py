"""
Multi-Horizon Forecasting
==========================
Generates short-term, medium-term, and long-term predictions and ensembles them.

Horizons:
  - Short-term (1 year ahead): aggressive recency weighting, favors recent trends
  - Medium-term (2-3 years ahead): balanced recency + historical baseline
  - Long-term (4-5 years ahead): conservative, favors stable long-term patterns

Ensemble combines all three horizons with weighted averaging.
"""

import json
import math
from collections import defaultdict
from typing import Dict, List, Tuple, Optional

from .predictor import (
    get_all_topics, build_topic_year_matrix, load_gold_standard,
    compute_recency_weighted_frequency, compute_frequency_baseline,
    detect_topic_cycle, build_markov_transition_matrix, compute_markov_score,
    compute_bayesian_probability, detect_hidden_trend,
    DOMAIN_TOPICS,
)


# ═══════════════════════════════════════════════════════════════════════
# HORIZON-SPECIFIC PREDICTORS
# ═══════════════════════════════════════════════════════════════════════

def short_term_predictor(
    topic: str,
    year_matrix: Dict[str, Dict[int, int]],
    all_topics: List[str],
    transition_matrix: Dict[str, Dict[str, float]],
    recent_topics: List[str],
    target_year: int = 2026,
) -> float:
    """
    Short-term prediction (1 year ahead).

    Favors:
      - Recency weighting with short half-life (2 years)
      - Markov transitions from last year's topics
      - CUSUM regime shift (recent emergence)
      - Bayesian probability (aggressive prior)

    Returns:
        Probability score 0-100
    """
    # Factor 1: Recency-weighted with short half-life
    recency, _ = compute_recency_weighted_frequency(
        topic, year_matrix, target_year, decay_half_life=2.0
    )

    # Factor 2: Markov transition score
    markov = compute_markov_score(topic, transition_matrix, recent_topics)

    # Factor 3: Regime shift detection
    cusum, trend_dir, trend_mag = detect_hidden_trend(topic, year_matrix, target_year)
    if cusum is None:
        cusum = 0.0

    # Factor 4: Bayesian with aggressive prior (expects new appearances)
    bayes, _, _ = compute_bayesian_probability(
        topic, year_matrix, target_year, alpha_prior=3.0, beta_prior=5.0
    )

    # Combine: favor recent patterns heavily
    score = 0.35 * recency + 0.25 * markov + 0.20 * min(1.0, cusum + 0.3) + 0.20 * bayes
    return score * 100.0


def medium_term_predictor(
    topic: str,
    year_matrix: Dict[str, Dict[int, int]],
    all_topics: List[str],
    transition_matrix: Dict[str, Dict[str, float]],
    recent_topics: List[str],
    target_year: int = 2026,
) -> float:
    """
    Medium-term prediction (2-3 years ahead).

    Balanced approach:
      - Recency weighting with moderate half-life (4 years)
      - Historical frequency baseline
      - Topic rotation cycles
      - Bayesian probability (neutral prior)

    Returns:
        Probability score 0-100
    """
    # Factor 1: Recency-weighted with moderate half-life
    recency, _ = compute_recency_weighted_frequency(
        topic, year_matrix, target_year, decay_half_life=4.0
    )

    # Factor 2: Historical frequency baseline
    baseline, _, _ = compute_frequency_baseline(topic, year_matrix)

    # Factor 3: Topic rotation cycle
    cycle_score, _, _ = detect_topic_cycle(topic, year_matrix, target_year)

    # Factor 4: Bayesian with neutral prior
    bayes, _, _ = compute_bayesian_probability(
        topic, year_matrix, target_year, alpha_prior=2.0, beta_prior=8.0
    )

    # Factor 5: Markov (less weight than short-term)
    markov = compute_markov_score(topic, transition_matrix, recent_topics)

    # Combine: balanced
    score = 0.20 * recency + 0.25 * baseline + 0.20 * cycle_score + 0.20 * bayes + 0.15 * markov
    return score * 100.0


def long_term_predictor(
    topic: str,
    year_matrix: Dict[str, Dict[int, int]],
    all_topics: List[str],
    target_year: int = 2026,
) -> float:
    """
    Long-term prediction (4-5 years ahead).

    Conservative approach:
      - Long historical baseline (high half-life)
      - Frequency density (proportion of years appeared)
      - Bayesian with strong prior (conservative)

    Returns:
        Probability score 0-100
    """
    # Factor 1: Recency with long half-life (stable patterns)
    recency, _ = compute_recency_weighted_frequency(
        topic, year_matrix, target_year, decay_half_life=8.0
    )

    # Factor 2: Historical baseline
    baseline, total, years_active = compute_frequency_baseline(topic, year_matrix)

    # Factor 3: Conservative Bayesian (strong prior toward non-appearance)
    bayes, _, _ = compute_bayesian_probability(
        topic, year_matrix, target_year, alpha_prior=1.5, beta_prior=12.0
    )

    # Factor 4: Long-term trend (simple linear trend over 5-year window)
    yearly = year_matrix.get(topic, {})
    trend = 0.0
    if yearly and len(yearly) >= 3:
        recent_5 = [y for y in sorted(yearly.keys()) if y >= target_year - 6]
        if len(recent_5) >= 3:
            counts = [yearly.get(y, 0) for y in recent_5[-5:]]
            if len(counts) >= 2:
                mid = len(counts) // 2
                first_half = sum(counts[:mid]) / max(1, mid)
                second_half = sum(counts[mid:]) / max(1, len(counts) - mid)
                trend = max(0.0, min(1.0, (second_half - first_half) / 5.0))

    # Combine: conservative
    score = 0.30 * recency + 0.35 * baseline + 0.25 * bayes + 0.10 * trend
    return score * 100.0


# ═══════════════════════════════════════════════════════════════════════
# MULTI-HORIZON ENSEMBLE
# ═══════════════════════════════════════════════════════════════════════

def ensemble_horizons(
    short_score: float,
    medium_score: float,
    long_score: float,
    horizon: str = 'mixed',
    recency_bias: float = 0.0,
) -> float:
    """
    Ensemble short, medium, and long-term predictions.

    Args:
        short_score: Short-term probability (0-100)
        medium_score: Medium-term probability (0-100)
        long_score: Long-term probability (0-100)
        horizon: Which horizon to favor ('short', 'medium', 'long', 'mixed')
        recency_bias: Additional bias toward recent patterns (0-1)

    Returns:
        Ensemble probability (0-100)
    """
    weights = {
        'short': (0.60, 0.25, 0.15),
        'medium': (0.20, 0.60, 0.20),
        'long': (0.10, 0.30, 0.60),
        'mixed': (0.35, 0.40, 0.25),
        'balanced': (0.33, 0.34, 0.33),
    }

    w_s, w_m, w_l = weights.get(horizon, weights['mixed'])

    # Apply recency bias adjustment
    if recency_bias > 0:
        w_s += recency_bias * 0.2
        w_m -= recency_bias * 0.1
        w_l -= recency_bias * 0.1
        # Re-normalize
        total = w_s + w_m + w_l
        w_s /= total
        w_m /= total
        w_l /= total

    return w_s * short_score + w_m * medium_score + w_l * long_score


# ═══════════════════════════════════════════════════════════════════════
# MULTI-HORIZON PREDICTOR
# ═══════════════════════════════════════════════════════════════════════

class MultiHorizonPredictor:
    """
    Predicts topic appearances across multiple time horizons.
    """

    def __init__(self, target_year: int = 2026):
        self.target_year = target_year
        self.all_topics = [t for t, _ in get_all_topics()]
        self.topic_domain = {t: d for t, d in get_all_topics()}
        self.year_matrix = {}
        self.transition_matrix = {}
        self.recent_topics = []

    def load_data(self, gold_standard_path: str = 'dataset/gold_standard/gold_standard.json'):
        """Load and prepare data."""
        questions = load_gold_standard(gold_standard_path)
        self.year_matrix = build_topic_year_matrix(questions)
        self.transition_matrix = build_markov_transition_matrix(
            self.year_matrix, self.all_topics
        )
        self.recent_topics = [
            t for t in self.all_topics
            if any(y >= self.target_year - 2 and c > 0
                   for y, c in self.year_matrix.get(t, {}).items())
        ]

    def predict_single_topic(self, topic: str) -> Dict:
        """
        Generate short, medium, and long-term predictions for a single topic.

        Returns:
            Dict with all three horizon scores and ensemble
        """
        short = short_term_predictor(
            topic, self.year_matrix, self.all_topics,
            self.transition_matrix, self.recent_topics, self.target_year
        )
        medium = medium_term_predictor(
            topic, self.year_matrix, self.all_topics,
            self.transition_matrix, self.recent_topics, self.target_year
        )
        long_ = long_term_predictor(
            topic, self.year_matrix, self.all_topics, self.target_year
        )

        # Determine if this topic is "emerging" (recently increasing)
        yearly = self.year_matrix.get(topic, {})
        if yearly:
            recent_3 = sum(yearly.get(y, 0) for y in range(self.target_year - 3, self.target_year))
            prev_3 = sum(yearly.get(y, 0) for y in range(self.target_year - 6, self.target_year - 3))
            is_emerging = recent_3 > prev_3 * 1.3 and recent_3 >= 2
        else:
            is_emerging = False

        # Use recency bias for emerging topics
        recency_bias = 0.5 if is_emerging else 0.0

        # Mixed ensemble (balanced across horizons)
        mixed_ensemble = ensemble_horizons(short, medium, long_, 'mixed', recency_bias)
        # Short-term ensemble (for immediate exam prep)
        short_ensemble = ensemble_horizons(short, medium, long_, 'short', recency_bias)
        # Long-term ensemble (for strategic planning)
        long_ensemble = ensemble_horizons(short, medium, long_, 'long')

        return {
            'topic': topic,
            'domain': self.topic_domain.get(topic, ''),
            'short_term': round(short, 2),
            'medium_term': round(medium, 2),
            'long_term': round(long_, 2),
            'ensemble_mixed': round(mixed_ensemble, 2),
            'ensemble_short_focused': round(short_ensemble, 2),
            'ensemble_long_focused': round(long_ensemble, 2),
            'is_emerging': is_emerging,
        }

    def predict_all_topics(self, horizon: str = 'mixed') -> List[Dict]:
        """
        Predict all topics sorted by the chosen horizon's ensemble score.

        Args:
            horizon: 'mixed', 'short', 'medium', 'long', 'balanced'

        Returns:
            Sorted list of topic predictions
        """
        results = []
        for topic in self.all_topics:
            pred = self.predict_single_topic(topic)

            # Select the appropriate ensemble score for ranking
            ensemble_key = f'ensemble_{horizon}_focused' if horizon in ('short', 'long') else f'ensemble_{horizon}'
            if ensemble_key not in pred:
                ensemble_key = 'ensemble_mixed'

            pred['ensemble_probability'] = pred[ensemble_key]
            results.append(pred)

        results.sort(key=lambda x: x['ensemble_probability'], reverse=True)

        # Add rank
        for i, r in enumerate(results):
            r['rank'] = i + 1

        return results

    def predict_multiyear(
        self, years: List[int] = None
    ) -> Dict[int, List[Dict]]:
        """Predict for multiple years with the specified horizon blend."""
        if years is None:
            years = [2026, 2027, 2028]

        results = {}
        for year in years:
            predictor = MultiHorizonPredictor(target_year=year)
            predictor.load_data()
            predictions = predictor.predict_all_topics()
            results[year] = predictions

        return results

    def get_horizon_recommendation(self) -> Dict:
        """
        Get horizon-specific study recommendations.

        Short-term: Topics likely in next exam (high short-term probability)
        Medium-term: Topics to build over the next 2-3 exams
        Long-term: Foundational topics for sustained preparation
        """
        all_predictions = self.predict_all_topics()

        short_term_recs = sorted(
            all_predictions, key=lambda x: x['short_term'], reverse=True
        )[:10]

        medium_term_recs = sorted(
            all_predictions, key=lambda x: x['medium_term'], reverse=True
        )[:10]

        long_term_recs = sorted(
            all_predictions, key=lambda x: x['long_term'], reverse=True
        )[:10]

        # Emerging topics (gaining momentum)
        emerging = [p for p in all_predictions if p['is_emerging']]

        return {
            'short_term_focus': [
                {'topic': p['topic'], 'domain': p['domain'], 'probability': p['short_term']}
                for p in short_term_recs
            ],
            'medium_term_focus': [
                {'topic': p['topic'], 'domain': p['domain'], 'probability': p['medium_term']}
                for p in medium_term_recs
            ],
            'long_term_focus': [
                {'topic': p['topic'], 'domain': p['domain'], 'probability': p['long_term']}
                for p in long_term_recs
            ],
            'emerging_topics': [
                {'topic': p['topic'], 'domain': p['domain'],
                 'ensemble': p['ensemble_mixed']}
                for p in emerging
            ],
        }
