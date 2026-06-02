"""
Advanced Ensemble Topic Predictor
==================================
Replaces simple frequency analysis with a multi-factor ensemble:

1. Recency weighting — exponential decay weighting of recent appearances
2. Frequency weighting — long-term historical frequency baseline
3. Topic rotation cycles — cyclical pattern detection (periodogram-like)
4. Markov topic transitions — P(topic_i → topic_j) transition matrices
5. Bayesian probability updates — conjugate prior (Beta-Binomial) updating
6. Hidden trend detection — regime-shift detection via CUSUM

Outputs:
  - Probability score (0-100) for every topic
  - Confidence interval (90% Bayesian credible interval)
  - Reasoning factors with contribution breakdown
"""

import json
import math
import os
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Optional


# ═══════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════

DOMAINS = ['economy', 'politics', 'history', 'geography', 'society']
DOMAIN_TOPICS = {
    'economy': [
        '수요·공급과 시장균형', 'GDP·국민소득', '환율·국제수지',
        '금융·통화정책', '재정·조세정책', '국제무역', '고용·노동',
        '경제성장·경기변동', '소득분배·지니계수', '일본경제사',
    ],
    'politics': [
        '헌법·기본권', '통치기구', '선거·정당', '국제정치·국제기구',
        '지방자치', '사법·재판', '정치사상', '안전보장·방위',
    ],
    'history': [
        '시민혁명', '산업혁명·자본주의', '제국주의·식민지', '세계대전',
        '냉전', '일본근대사', '전후세계질서', '세계화·지역통합',
        '러시아혁명·소련', '대공황',
    ],
    'geography': [
        '기후·케펜구분', '지형·판구조', '인구·도시화', '자원·농업',
        '지도·GIS', '환경·생태', '산업·교통',
    ],
    'society': [
        '환경문제', '사회보장·복지', '저출산·고령화', '정보화사회',
        '젠더·평등', '다문화사회',
    ],
}


def load_gold_standard(path='dataset/gold_standard/gold_standard.json'):
    """Load the gold standard dataset."""
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('questions', [])


def load_trend_analysis(path='dataset/trend-analysis/trend_analysis_v2.json'):
    """Load the trend analysis data."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_knowledge_graph(path='dataset/knowledge-graph/knowledge_graph_v3.json'):
    """Load the knowledge graph."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_difficulty_db(path='dataset/difficulty/difficulty_database.json'):
    """Load the difficulty database."""
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data


def load_prediction_2026(path='dataset/prediction/prediction_2026.json'):
    """Load the 2026 prediction for comparison."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_consolidated(path='dataset/comprehensive/dataset_consolidated.json'):
    """Load the consolidated dataset."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


# ═══════════════════════════════════════════════════════════════════════
# DATA PREPARATION
# ═══════════════════════════════════════════════════════════════════════

def build_topic_year_matrix(questions: List[dict]) -> Dict[str, Dict[int, int]]:
    """
    Build a matrix of topic -> year -> count.

    From gold_standard.json questions with {year, domain, topic, round}.
    """
    matrix = defaultdict(lambda: defaultdict(int))
    for q in questions:
        year = q.get('year')
        topic = q.get('topic', '').strip()
        if not topic or not year:
            continue
        matrix[topic][int(year)] += 1
    return {k: dict(v) for k, v in matrix.items()}


def get_all_topics():
    """Return all known topics from the domain map."""
    topics = []
    for domain, tlist in DOMAIN_TOPICS.items():
        for t in tlist:
            topics.append((t, domain))
    return topics


# ═══════════════════════════════════════════════════════════════════════
# FACTOR 1: RECENCY-WEIGHTED FREQUENCY (Exponential Decay)
# ═══════════════════════════════════════════════════════════════════════

def compute_recency_weighted_frequency(
    topic: str,
    year_matrix: Dict[str, Dict[int, int]],
    target_year: int = 2026,
    decay_half_life: float = 3.0,
) -> Tuple[float, float]:
    """
    Compute recency-weighted frequency with exponential decay.

    Args:
        topic: Topic name
        year_matrix: Topic -> Year -> Count
        target_year: Year to predict for
        decay_half_life: How quickly older observations decay (in years)

    Returns:
        (weighted_frequency_normalized, max_possible_normalized)
    """
    yearly = year_matrix.get(topic, {})
    if not yearly:
        return 0.0, 0.0

    decay_constant = math.log(2) / decay_half_life
    total_weighted = 0.0
    total_weight = 0.0
    max_possible = 0.0

    years_range = range(2002, target_year)
    for year in years_range:
        count = yearly.get(year, 0)
        years_ago = target_year - year
        weight = math.exp(-decay_constant * years_ago)
        total_weighted += count * weight
        total_weight += weight
        # Max possible: assume 5 questions per year (typical max per topic)
        max_possible += 5 * weight

    if total_weight == 0 or max_possible == 0:
        return 0.0, 0.0

    normalized = min(1.0, total_weighted / max_possible)
    return normalized, total_weighted / total_weight if total_weight > 0 else 0.0


# ═══════════════════════════════════════════════════════════════════════
# FACTOR 2: HISTORICAL FREQUENCY BASELINE
# ═══════════════════════════════════════════════════════════════════════

def compute_frequency_baseline(
    topic: str,
    year_matrix: Dict[str, Dict[int, int]],
) -> Tuple[float, int, int]:
    """
    Compute long-term historical frequency baseline.

    Returns:
        (baseline_score_0_1, total_appearances, years_active)
    """
    yearly = year_matrix.get(topic, {})
    if not yearly:
        return 0.0, 0, 0

    total = sum(yearly.values())
    years_active = len([y for y, c in yearly.items() if c > 0])
    total_years = 24  # 2002-2025

    # Baseline: fraction of years active * average intensity
    frequency_density = years_active / max(1, total_years)
    avg_intensity = total / max(1, years_active)

    # Normalize: typical max per year is ~20, max years is 24
    intensity_norm = min(1.0, avg_intensity / 15.0)
    baseline = 0.4 * frequency_density + 0.6 * intensity_norm

    return min(1.0, baseline), total, years_active


# ═══════════════════════════════════════════════════════════════════════
# FACTOR 3: TOPIC ROTATION CYCLES (Periodicity Detection)
# ═══════════════════════════════════════════════════════════════════════

def detect_topic_cycle(
    topic: str,
    year_matrix: Dict[str, Dict[int, int]],
    target_year: int = 2026,
) -> Tuple[float, Optional[float], Optional[int]]:
    """
    Detect cyclical patterns in topic appearance.

    Uses interval analysis: computes average gap between appearances
    and predicts next expected appearance.

    Returns:
        (cycle_score_0_1, estimated_period_years, gap_since_last)
    """
    yearly = year_matrix.get(topic, {})
    if not yearly:
        return 0.3, None, None

    appearance_years = sorted([y for y, c in yearly.items() if c > 0])
    if len(appearance_years) < 2:
        return 0.3, None, None

    # Calculate intervals between consecutive appearances
    intervals = []
    for i in range(1, len(appearance_years)):
        intervals.append(appearance_years[i] - appearance_years[i - 1])

    avg_interval = sum(intervals) / len(intervals)
    std_interval = (sum((i - avg_interval) ** 2 for i in intervals) / len(intervals)) ** 0.5
    last_year = appearance_years[-1]
    years_since = target_year - 1 - last_year

    # Coefficient of variation → confidence in the cycle
    cv = std_interval / max(1.0, avg_interval)
    cycle_confidence = max(0.1, 1.0 - cv)

    # When are we in the cycle?
    if avg_interval <= 1.0:
        # Appears every year
        cycle_score = 0.8
    elif years_since >= avg_interval - 1:
        # Due for reappearance
        cycle_score = min(0.95, 0.5 + 0.4 * cycle_confidence)
    elif years_since >= avg_interval * 0.7:
        # Approaching expected appearance
        cycle_score = 0.6
    elif years_since <= 1:
        # Just appeared
        cycle_score = 0.4 if avg_interval > 2 else 0.7
    else:
        cycle_score = 0.3

    return min(1.0, cycle_score), avg_interval, years_since


# ═══════════════════════════════════════════════════════════════════════
# FACTOR 4: MARKOV TOPIC TRANSITIONS
# ═══════════════════════════════════════════════════════════════════════

def build_markov_transition_matrix(
    year_matrix: Dict[str, Dict[int, int]],
    all_topics: List[str],
) -> Dict[str, Dict[str, float]]:
    """
    Build a first-order Markov transition matrix between topics.

    P(topic_j | topic_i) = count(topic_i → topic_j) / count(topic_i)

    A "transition" is defined as both topics appearing in the same year.
    """
    # Count co-occurrences in same year
    topic_years = defaultdict(set)
    for topic, years in year_matrix.items():
        for year, count in years.items():
            if count > 0:
                topic_years[topic].add(year)

    co_occurrence = defaultdict(lambda: defaultdict(int))
    for topic_i in all_topics:
        years_i = topic_years.get(topic_i, set())
        for topic_j in all_topics:
            if topic_i == topic_j:
                continue
            years_j = topic_years.get(topic_j, set())
            common = years_i & years_j
            if common:
                co_occurrence[topic_i][topic_j] = len(common)

    # Convert to transition probabilities
    transition_matrix = {}
    for topic_i in all_topics:
        total = sum(co_occurrence[topic_i].values())
        if total > 0:
            probs = {}
            for topic_j, count in co_occurrence[topic_i].items():
                probs[topic_j] = count / total
            transition_matrix[topic_i] = probs
        else:
            transition_matrix[topic_i] = {}

    return transition_matrix


def compute_markov_score(
    topic: str,
    transition_matrix: Dict[str, Dict[str, float]],
    recent_topics: List[str],
) -> float:
    """
    Compute Markov transition score.

    Given the set of topics that appeared recently (last 1-2 years),
    what is the probability of this topic appearing next?
    """
    if not recent_topics or not transition_matrix:
        return 0.5

    # Average transition probability from all recent topics to this topic
    scores = []
    for rt in recent_topics:
        probs = transition_matrix.get(rt, {})
        if topic in probs:
            scores.append(probs[topic])

    if not scores:
        return 0.3

    return min(1.0, sum(scores) / len(scores) * 3.0)  # Scale up since probs are small


# ═══════════════════════════════════════════════════════════════════════
# FACTOR 5: BAYESIAN PROBABILITY UPDATE (Beta-Binomial)
# ═══════════════════════════════════════════════════════════════════════

def compute_bayesian_probability(
    topic: str,
    year_matrix: Dict[str, Dict[int, int]],
    target_year: int = 2026,
    alpha_prior: float = 2.0,
    beta_prior: float = 10.0,
) -> Tuple[float, float, float]:
    """
    Compute Bayesian posterior probability using Beta-Binomial conjugate.

    Prior: Beta(alpha_prior, beta_prior) — weakly informative
    Likelihood: Binomial(n_trials, p) where n_trials = years observed
    Posterior: Beta(alpha_prior + successes, beta_prior + failures)

    "Success" = topic appeared in a given year (at least once)

    Returns:
        (posterior_mean, lower_90_ci, upper_90_ci)
    """
    yearly = year_matrix.get(topic, {})
    years_range = range(2002, target_year)
    n_years = len(years_range)

    successes = sum(1 for y in years_range if yearly.get(y, 0) > 0)
    failures = n_years - successes

    alpha_post = alpha_prior + successes
    beta_post = beta_prior + failures

    posterior_mean = alpha_post / (alpha_post + beta_post)

    # Approximate 90% credible interval using normal approximation for Beta distribution
    total = alpha_post + beta_post
    if total > 0:
        mean = alpha_post / total
        var = (alpha_post * beta_post) / (total ** 2 * (total + 1))
        std = var ** 0.5
        lower_90 = max(0.0, mean - 1.645 * std)
        upper_90 = min(1.0, mean + 1.645 * std)
    else:
        lower_90 = 0.0
        upper_90 = 1.0

    return posterior_mean, lower_90, upper_90


# ═══════════════════════════════════════════════════════════════════════
# FACTOR 6: HIDDEN TREND DETECTION (CUSUM / Regime Shift)
# ═══════════════════════════════════════════════════════════════════════

def detect_hidden_trend(
    topic: str,
    year_matrix: Dict[str, Dict[int, int]],
    target_year: int = 2026,
    threshold: float = 1.5,
) -> Tuple[float, str, float]:
    """
    Detect hidden trends using a simplified CUSUM approach.

    Detects regime shifts: is this topic increasing, decreasing, or stable?

    Returns:
        (trend_score_0_1, direction: 'growing'|'declining'|'stable', magnitude)
    """
    yearly = year_matrix.get(topic, {})
    if not yearly:
        return 0.0, 'stable', 0.0

    years = sorted(yearly.keys())
    recent_years = [y for y in years if y >= target_year - 6]
    older_years = [y for y in years if y < target_year - 6]

    recent_total = sum(yearly.get(y, 0) for y in recent_years)
    older_total = sum(yearly.get(y, 0) for y in older_years)

    recent_n = max(1, len(recent_years))
    older_n = max(1, len(older_years))

    recent_avg = recent_total / recent_n
    older_avg = older_total / older_n

    # CUSUM-like drift detection
    drift = recent_avg - older_avg

    if drift > threshold:
        magnitude = min(1.0, drift / (threshold * 3))
        return magnitude, 'growing', drift
    elif drift < -threshold:
        magnitude = min(1.0, abs(drift) / (threshold * 3))
        return magnitude, 'declining', drift
    else:
        return 0.3, 'stable', drift


# ═══════════════════════════════════════════════════════════════════════
# ENSEMBLE PREDICTOR
# ═══════════════════════════════════════════════════════════════════════

class EnsemblePredictor:
    """
    Ensemble predictor combining all six factors with dynamic weighting.

    Weights are adjusted based on data quality and factor confidence.
    """

    def __init__(self, target_year: int = 2026):
        self.target_year = target_year
        self.year_matrix: Dict[str, Dict[int, int]] = {}
        self.transition_matrix: Dict[str, Dict[str, float]] = {}
        self.all_topics: List[str] = []
        self.topic_domain: Dict[str, str] = {}
        self.recent_topics: List[str] = []
        self.base_weights = {
            'recency': 0.20,
            'frequency': 0.15,
            'rotation': 0.15,
            'markov': 0.15,
            'bayesian': 0.20,
            'hidden_trend': 0.15,
        }

    def load_data(self, gold_standard_path: str = 'dataset/gold_standard/gold_standard.json'):
        """Load and prepare all data. Clears previous state to prevent duplicates."""
        questions = load_gold_standard(gold_standard_path)
        self.year_matrix = build_topic_year_matrix(questions)

        # Reset topic lists to prevent duplicates on multi-year calls
        self.all_topics = []
        self.topic_domain = {}

        # Build topic list
        for t, d in get_all_topics():
            self.all_topics.append(t)
            self.topic_domain[t] = d

        # Build transition matrix
        self.transition_matrix = build_markov_transition_matrix(
            self.year_matrix, self.all_topics
        )

        # Find recently appearing topics (last 2 years)
        self.recent_topics = [
            t for t in self.all_topics
            if any(y >= self.target_year - 2 and c > 0
                   for y, c in self.year_matrix.get(t, {}).items())
        ]

    def predict(self, topic: str) -> dict:
        """
        Generate a full ensemble prediction for a single topic.

        Returns:
            dict with probability, confidence interval, and all factor scores
        """
        if not self.year_matrix:
            self.load_data()

        # Factor 1: Recency-weighted frequency
        recency_score, _ = compute_recency_weighted_frequency(
            topic, self.year_matrix, self.target_year
        )

        # Factor 2: Historical frequency baseline
        freq_score, total_appearances, years_active = compute_frequency_baseline(
            topic, self.year_matrix
        )

        # Factor 3: Topic rotation cycle
        cycle_score, estimated_period, years_since = detect_topic_cycle(
            topic, self.year_matrix, self.target_year
        )

        # Factor 4: Markov transition probability
        markov_score = compute_markov_score(
            topic, self.transition_matrix, self.recent_topics
        )

        # Factor 5: Bayesian probability
        bayes_mean, bayes_lower, bayes_upper = compute_bayesian_probability(
            topic, self.year_matrix, self.target_year
        )

        # Factor 6: Hidden trend detection
        trend_score, trend_direction, trend_magnitude = detect_hidden_trend(
            topic, self.year_matrix, self.target_year
        )

        # Adjust weights dynamically based on data quality
        weights = dict(self.base_weights)
        data_quality = min(1.0, years_active / 10.0)

        # If we have good data, increase Bayesian and trend weights
        if data_quality > 0.5:
            weights['bayesian'] = 0.25
            weights['recency'] = 0.15
            weights['markov'] = 0.15
            weights['hidden_trend'] = 0.20

        # If topic has strong cyclical pattern, increase rotation weight
        if estimated_period and estimated_period >= 2:
            weights['rotation'] = 0.20
            weights['frequency'] = 0.10

        # Normalize weights
        total_w = sum(weights.values())
        weights = {k: v / total_w for k, v in weights.items()}

        # Compute ensemble score
        factors = {
            'recency_weighted_frequency': {
                'score': round(recency_score * 100, 2),
                'weight': weights['recency'],
                'description': 'Exponential decay weighted frequency (half-life=3yr)',
            },
            'historical_frequency_baseline': {
                'score': round(freq_score * 100, 2),
                'weight': weights['frequency'],
                'description': f'Long-term baseline ({total_appearances} total, {years_active}yr active)',
            },
            'topic_rotation_cycle': {
                'score': round(cycle_score * 100, 2),
                'weight': weights['rotation'],
                'description': f'Cyclical pattern (period={estimated_period}, gap={years_since}yr)',
            },
            'markov_transition': {
                'score': round(markov_score * 100, 2),
                'weight': weights['markov'],
                'description': f'Markov chain transition from {len(self.recent_topics)} recent topics',
            },
            'bayesian_posterior': {
                'score': round(bayes_mean * 100, 2),
                'weight': weights['bayesian'],
                'description': f'Beta-Binomial posterior [90% CI: {bayes_lower*100:.1f}%-{bayes_upper*100:.1f}%]',
            },
            'hidden_trend': {
                'score': round(trend_score * 100, 2),
                'weight': weights['hidden_trend'],
                'description': f'Regime shift detection: {trend_direction} (magnitude={trend_magnitude:.2f})',
            },
        }

        ensemble_score = sum(
            f['score'] * f['weight'] for f in factors.values()
        )

        # Compute confidence interval from Bayesian CI and ensemble variance
        ensemble_variance = sum(
            (f['score'] - ensemble_score) ** 2 * f['weight']
            for f in factors.values()
        )
        ensemble_std = ensemble_variance ** 0.5
        ci_lower = max(0, ensemble_score - 1.645 * ensemble_std)
        ci_upper = min(100, ensemble_score + 1.645 * ensemble_std)

        # Overall confidence in prediction
        # Higher when factors agree and data quality is good
        factor_agreement = 1.0 - (ensemble_std / max(1, ensemble_score))
        overall_confidence = min(0.95, 0.3 + 0.4 * data_quality + 0.3 * factor_agreement)

        return {
            'topic': topic,
            'domain': self.topic_domain.get(topic, ''),
            'target_year': self.target_year,
            'ensemble_probability': round(ensemble_score, 2),
            'confidence_interval_90pct': {
                'lower': round(ci_lower, 2),
                'upper': round(ci_upper, 2),
            },
            'overall_confidence': round(overall_confidence, 3),
            'data_quality_score': round(data_quality, 3),
            'factor_agreement': round(factor_agreement, 3),
            'factors': factors,
            'total_historical_appearances': total_appearances,
            'years_active': years_active,
            'years_since_last_appearance': years_since,
            'trend_direction': trend_direction,
        }

    def predict_all_topics(self) -> List[dict]:
        """Generate predictions for all topics, deduplicated."""
        # Use dict keyed by topic name to deduplicate
        seen = {}
        for topic in self.all_topics:
            if topic not in seen:
                seen[topic] = self.predict(topic)

        results = list(seen.values())

        # Sort by ensemble probability descending
        results.sort(key=lambda x: x['ensemble_probability'], reverse=True)

        # Add ranks
        for i, r in enumerate(results):
            r['rank'] = i + 1

        return results

    def predict_multiyear(self, years: List[int] = None) -> Dict[int, List[dict]]:
        """Generate predictions for multiple years."""
        if years is None:
            years = [2026, 2027, 2028]

        results = {}
        original_target = self.target_year

        for year in years:
            self.target_year = year
            self.load_data()  # Refresh with new target year (now properly resets)
            results[year] = self.predict_all_topics()

        self.target_year = original_target
        return results


# ═══════════════════════════════════════════════════════════════════════
# BACKTESTING: Evaluate Prediction Accuracy on Historical Data
# ═══════════════════════════════════════════════════════════════════════

def backtest_predictions(
    gold_standard_path: str = 'dataset/gold_standard/gold_standard.json',
    test_years: List[int] = None,
) -> dict:
    """
    Backtest the predictor on historical data.

    For each test year, train on data up to test_year-1 and predict test_year.
    Compare predictions against actual appearances.

    Returns:
        dict with precision, recall, F1, and per-year breakdown
    """
    if test_years is None:
        test_years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]

    questions = load_gold_standard(gold_standard_path)
    full_matrix = build_topic_year_matrix(questions)

    all_metrics = []
    all_predictions = []
    all_actuals = []

    for test_year in test_years:
        # Build training matrix (up to test_year - 1)
        train_matrix = {}
        for topic, years in full_matrix.items():
            train_years = {y: c for y, c in years.items() if y < test_year}
            if train_years:
                train_matrix[topic] = train_years

        # Build predictor with training data
        predictor = EnsemblePredictor(target_year=test_year)
        predictor.year_matrix = train_matrix

        # Build topic list
        predictor.all_topics = []
        predictor.topic_domain = {}
        for t, d in get_all_topics():
            predictor.all_topics.append(t)
            predictor.topic_domain[t] = d

        # Build transition matrix from training data
        predictor.transition_matrix = build_markov_transition_matrix(
            train_matrix, predictor.all_topics
        )

        predictor.recent_topics = [
            t for t in predictor.all_topics
            if any(y >= test_year - 2 and c > 0
                   for y, c in train_matrix.get(t, {}).items())
        ]

        # Actual appearances in test year
        actual_appearances = set()
        for topic, years in full_matrix.items():
            if years.get(test_year, 0) > 0:
                actual_appearances.add(topic)

        # Predictions
        predictions = predictor.predict_all_topics()

        # The top N topics as "predicted to appear"
        # Estimate N from historical average topics per exam
        avg_topics_per_exam = 0
        for year in range(2002, test_year):
            count = sum(1 for t, y in full_matrix.items() if y.get(year, 0) > 0)
            avg_topics_per_exam += count
        avg_topics_per_exam /= max(1, test_year - 2002)
        n_pred = max(10, min(25, int(avg_topics_per_exam)))

        predicted_set = set(p['topic'] for p in predictions[:n_pred])

        # Calculate metrics
        true_positives = len(predicted_set & actual_appearances)
        false_positives = len(predicted_set - actual_appearances)
        false_negatives = len(actual_appearances - predicted_set)

        precision = true_positives / max(1, true_positives + false_positives)
        recall = true_positives / max(1, true_positives + false_negatives)
        f1 = 2 * precision * recall / max(0.001, precision + recall)

        # Average probability of actual appearing topics
        actual_probs = [p['ensemble_probability'] for p in predictions
                        if p['topic'] in actual_appearances]
        avg_prob_actual = sum(actual_probs) / max(1, len(actual_probs)) if actual_probs else 0

        # Average probability of non-appearing topics
        nonactual_probs = [p['ensemble_probability'] for p in predictions
                           if p['topic'] not in actual_appearances]
        avg_prob_nonactual = sum(nonactual_probs) / max(1, len(nonactual_probs)) if nonactual_probs else 0

        metric = {
            'test_year': test_year,
            'n_predicted': n_pred,
            'n_actual': len(actual_appearances),
            'true_positives': true_positives,
            'false_positives': false_positives,
            'false_negatives': false_negatives,
            'precision': round(precision, 4),
            'recall': round(recall, 4),
            'f1_score': round(f1, 4),
            'avg_prob_actual': round(avg_prob_actual, 2),
            'avg_prob_nonactual': round(avg_prob_nonactual, 2),
        }

        all_metrics.append(metric)
        all_predictions.append({
            'year': test_year,
            'predictions': [{'topic': p['topic'], 'prob': p['ensemble_probability']}
                           for p in predictions[:n_pred]],
        })
        all_actuals.append({
            'year': test_year,
            'actual_topics': list(actual_appearances),
        })

    # Aggregate metrics
    avg_precision = sum(m['precision'] for m in all_metrics) / len(all_metrics)
    avg_recall = sum(m['recall'] for m in all_metrics) / len(all_metrics)
    avg_f1 = sum(m['f1_score'] for m in all_metrics) / len(all_metrics)

    return {
        'methodology': 'Ensemble predictor backtested on historical data (2015-2025)',
        'aggregate_metrics': {
            'avg_precision': round(avg_precision, 4),
            'avg_recall': round(avg_recall, 4),
            'avg_f1': round(avg_f1, 4),
            'total_test_years': len(test_years),
        },
        'per_year_metrics': all_metrics,
        'predictions': all_predictions,
        'actuals': all_actuals,
    }
