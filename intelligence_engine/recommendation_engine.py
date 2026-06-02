"""
EJU Intelligence Engine v3 — Recommendation Engine
===================================================
Multi-factor recommendation ranking.

Ranking formula:
  40% — Expected Score Gain (if mastered)
  20% — Future Exam Probability (predicted likelihood of appearing)
  15% — Weakness Severity (current mastery deficit)
  10% — Difficulty Gap (difference from student's optimal difficulty)
  10% — Graph Centrality (topic importance in knowledge graph)
   5%  — Time Efficiency (learning rate × time until exam)

Output:
  - Ranked list of topics to study
  - Expected score increase if mastered
  - Explainable breakdown of why each topic is recommended
"""

import json
import math
from collections import defaultdict
from typing import Dict, List, Optional, Tuple
from datetime import datetime

from .predictor import get_all_topics, DOMAIN_TOPICS
from .weakness_engine import find_prerequisites, PREREQUISITE_MAP, estimate_mastery


# ═══════════════════════════════════════════════════════════════════════
# RECOMMENDATION FACTORS
# ═══════════════════════════════════════════════════════════════════════

# Weight for each factor in the final score
FACTOR_WEIGHTS = {
    'expected_score_gain': 0.40,
    'future_exam_probability': 0.20,
    'weakness_severity': 0.15,
    'difficulty_gap': 0.10,
    'graph_centrality': 0.10,
    'time_efficiency': 0.05,
}

# Difficulty adjustment: how many exams typically include each topic
# Used to estimate expected score impact
TOPIC_EXAM_FREQUENCY = {
    '기후·케펜구분': 0.85, '시민혁명': 0.75, '환율·국제수지': 0.65,
    '통치기구': 0.60, '국제정치·국제기구': 0.55, '경제성장·경기변동': 0.50,
    '금융·통화정책': 0.45, '수요·공급과 시장균형': 0.40, '헌법·기본권': 0.40,
    '재정·조세정책': 0.35, '정치사상': 0.30, '냉전': 0.30,
    '고용·노동': 0.30, '사법·재판': 0.25, '환경문제': 0.25,
    '지형·판구조': 0.25, '지방자치': 0.20, '소득분배·지니계수': 0.20,
    '산업혁명·자본주의': 0.20, '일본근대사': 0.15, '세계대전': 0.25,
    '산업·교통': 0.20, '인구·도시화': 0.25, '사회보장·복지': 0.20,
    '저출산·고령화': 0.20, '국제무역': 0.25, '안전보장·방위': 0.20,
    '전후세계질서': 0.15, '세계화·지역통합': 0.15, '일본경제사': 0.20,
    '선거·정당': 0.25, '자원·농업': 0.20, '지도·GIS': 0.10,
    '환경·생태': 0.20, '정보화사회': 0.15, '젠더·평등': 0.15,
    '다문화사회': 0.15, '러시아혁명·소련': 0.10, '대공황': 0.10,
}


def compute_expected_score_gain(
    topic: str,
    current_mastery: float,
    max_score: float = 190.0,
    base_score: float = 100.0,
    topic_weight: float = None,
) -> float:
    """
    Compute expected score gain if topic is mastered.

    Higher gain = more points available from this topic.
    Topics that are both high-frequency and low-mastery give the most gain.

    Args:
        topic: Topic name
        current_mastery: Current mastery level (0-1)
        max_score: Maximum possible score
        base_score: Baseline score with no topic knowledge
        topic_weight: How much this topic contributes to total score

    Returns:
        Expected score gain (0 to max_score - base_score)
    """
    if topic_weight is None:
        topic_weight = TOPIC_EXAM_FREQUENCY.get(topic, 0.3)

    # Mastery deficit (how much room for improvement)
    mastery_deficit = 1.0 - current_mastery

    # Score range available from exam content
    score_range = max_score - base_score  # ~90 points

    # Each topic contributes to score proportional to its exam frequency
    # and the number of questions per exam
    points_per_topic = score_range * topic_weight * 0.08  # ~8% contribution per topic mastered

    # Expected gain = points available × mastery deficit
    expected_gain = points_per_topic * mastery_deficit

    return max(0.0, expected_gain)


def compute_future_exam_probability(
    topic: str,
    topic_scores: Dict[str, float] = None,
) -> float:
    """
    Compute how likely this topic is to appear in future exams.

    Uses the ensemble predictor's probability score.

    Args:
        topic: Topic name
        topic_scores: Dict mapping topic -> probability (0-100)

    Returns:
        Normalized probability (0-1)
    """
    if topic_scores and topic in topic_scores:
        return min(1.0, topic_scores[topic] / 100.0)

    # Fallback: use historical frequency
    return TOPIC_EXAM_FREQUENCY.get(topic, 0.3)


def compute_weakness_severity(current_mastery: float) -> float:
    """
    Compute weakness severity as a factor of how much mastery is lacking.

    Severity is non-linear: going from 0.2 to 0.5 is more critical than
    going from 0.7 to 1.0.

    Args:
        current_mastery: Current mastery level (0-1)

    Returns:
        Severity score (0-1)
    """
    if current_mastery >= 0.8:
        return 0.1  # Low severity — already strong
    elif current_mastery >= 0.6:
        return 0.3  # Moderate
    elif current_mastery >= 0.4:
        return 0.6  # High
    elif current_mastery >= 0.2:
        return 0.8  # Very high
    else:
        return 1.0  # Critical


def compute_difficulty_gap(
    topic: str,
    student_ability: float = 0.5,
    topic_difficulties: Dict[str, float] = None,
) -> float:
    """
    Compute the gap between student ability and topic difficulty.

    Topics slightly above student ability are optimal for learning.
    Topics far above are frustrating; far below are boring.

    Args:
        topic: Topic name
        student_ability: Student's overall ability level (0-1)
        topic_difficulties: Dict mapping topic -> difficulty (0-1)

    Returns:
        Difficulty gap score (0-1, higher = better match)
    """
    if topic_difficulties and topic in topic_difficulties:
        difficulty = topic_difficulties[topic]
    else:
        # Default difficulties based on exam frequency and domain
        difficulty = 1.0 - TOPIC_EXAM_FREQUENCY.get(topic, 0.3)

    # Optimal gap: topic difficulty is slightly above student ability
    optimal_gap = 0.15  # 15% above student ability
    actual_gap = difficulty - student_ability

    # Score is highest when gap is near optimal
    gap_distance = abs(actual_gap - optimal_gap)
    score = max(0.0, 1.0 - gap_distance * 2.0)

    return score


def compute_graph_centrality(
    topic: str,
    centrality_scores: Dict[str, float] = None,
) -> float:
    """
    Compute how central this topic is in the knowledge graph.

    Central topics are important because they connect to many others.

    Args:
        topic: Topic name
        centrality_scores: Dict mapping topic node_id -> score

    Returns:
        Centrality score (0-1)
    """
    if centrality_scores:
        # Try different key formats
        for key in [topic, f"topic_{topic}", f"topic:{topic}"]:
            if key in centrality_scores:
                return centrality_scores[key]

    # Fallback: use number of prerequisite relationships
    num_prereqs = len(PREREQUISITE_MAP.get(topic, []))
    num_as_prereq = sum(1 for t, prereqs in PREREQUISITE_MAP.items() if topic in prereqs)

    # Normalize: max prereqs is ~6, max as_prereq is ~10
    score = 0.3 * min(1.0, num_prereqs / 4.0) + 0.7 * min(1.0, num_as_prereq / 6.0)
    return min(1.0, score)


def compute_time_efficiency(
    topic: str,
    current_mastery: float,
    days_until_exam: int = 180,
    study_hours_per_week: float = 10.0,
    topic_difficulties: Dict[str, float] = None,
) -> float:
    """
    Compute time efficiency: how much score gain per study hour.

    Args:
        topic: Topic name
        current_mastery: Current mastery (0-1)
        days_until_exam: Days until the exam
        study_hours_per_week: Hours available per week
        topic_difficulties: Dict mapping topic -> difficulty

    Returns:
        Efficiency score (0-1, higher = more efficient)
    """
    if topic_difficulties:
        difficulty = topic_difficulties.get(topic, 0.5)
    else:
        difficulty = 1.0 - TOPIC_EXAM_FREQUENCY.get(topic, 0.3)

    # Mastery deficit
    deficit = 1.0 - current_mastery

    # Time needed to master (hours), harder topics take longer
    hours_to_master = 2.0 + difficulty * 6.0

    # Available study hours before exam
    available_hours = (days_until_exam / 7.0) * study_hours_per_week

    # Can we master it in time?
    if hours_to_master > available_hours * 0.5:
        feasibility = max(0.1, available_hours * 0.5 / hours_to_master)
    else:
        feasibility = 1.0

    # Score gain per hour
    gain_per_hour = deficit / max(1.0, hours_to_master)

    # Normalize
    return min(1.0, gain_per_hour * 5.0 * feasibility)


# ═══════════════════════════════════════════════════════════════════════
# RECOMMENDATION ENGINE
# ═══════════════════════════════════════════════════════════════════════

class RecommendationEngine:
    """
    Multi-factor recommendation engine for EJU study planning.

    Combines 6 factors to produce ranked study recommendations:
      - Expected Score Gain (40%)
      - Future Exam Probability (20%)
      - Weakness Severity (15%)
      - Difficulty Gap (10%)
      - Graph Centrality (10%)
      - Time Efficiency (5%)
    """

    def __init__(self):
        self.all_topics = [t for t, _ in get_all_topics()]
        self.topic_domain = {t: d for t, d in get_all_topics()}
        self.topic_scores: Dict[str, float] = {}  # prediction probabilities
        self.centrality_scores: Dict[str, float] = {}  # graph centrality
        self.topic_difficulties: Dict[str, float] = {}  # topic difficulty levels
        self.mastery_estimates: Dict[str, float] = {}  # current mastery (0-1)

    def set_prediction_scores(self, scores: Dict[str, float]):
        """Set topic prediction probabilities."""
        self.topic_scores = scores

    def set_centrality_scores(self, scores: Dict[str, float]):
        """Set graph centrality scores."""
        self.centrality_scores = scores

    def set_mastery_estimates(self, mastery: Dict[str, float]):
        """Set current mastery estimates for each topic."""
        self.mastery_estimates = mastery

    def set_topic_difficulties(self, difficulties: Dict[str, float]):
        """Set topic difficulty levels."""
        self.topic_difficulties = difficulties

    def compute_topic_score(
        self,
        topic: str,
        student_ability: float = 0.5,
        days_until_exam: int = 180,
        study_hours_per_week: float = 10.0,
    ) -> Dict:
        """
        Compute the full recommendation score for a single topic.

        Args:
            topic: Topic to evaluate
            student_ability: Student's overall ability (0-1)
            days_until_exam: Days remaining until exam
            study_hours_per_week: Hours student can study per week

        Returns:
            Dict with factor breakdown and final score
        """
        mastery = self.mastery_estimates.get(topic, 0.5)

        # Compute each factor
        expected_gain = compute_expected_score_gain(topic, mastery)
        exam_prob = compute_future_exam_probability(topic, self.topic_scores)
        weakness = compute_weakness_severity(mastery)
        diff_gap = compute_difficulty_gap(topic, student_ability, self.topic_difficulties)
        centrality = compute_graph_centrality(topic, self.centrality_scores)
        time_eff = compute_time_efficiency(
            topic, mastery, days_until_exam, study_hours_per_week, self.topic_difficulties
        )

        # Normalize expected gain to 0-1 for scoring
        gain_norm = min(1.0, expected_gain / 15.0)

        # Combine with weights
        final_score = (
            FACTOR_WEIGHTS['expected_score_gain'] * gain_norm +
            FACTOR_WEIGHTS['future_exam_probability'] * exam_prob +
            FACTOR_WEIGHTS['weakness_severity'] * weakness +
            FACTOR_WEIGHTS['difficulty_gap'] * diff_gap +
            FACTOR_WEIGHTS['graph_centrality'] * centrality +
            FACTOR_WEIGHTS['time_efficiency'] * time_eff
        )

        # Compute expected score increase if mastered
        expected_increase = compute_expected_score_gain(topic, mastery)

        return {
            'topic': topic,
            'domain': self.topic_domain.get(topic, ''),
            'final_score': round(final_score * 100, 2),
            'expected_score_increase': round(expected_increase, 2),
            'factors': {
                'expected_score_gain': {
                    'value': round(gain_norm, 4),
                    'weight': FACTOR_WEIGHTS['expected_score_gain'],
                    'contribution': round(gain_norm * FACTOR_WEIGHTS['expected_score_gain'], 4),
                    'raw_expected_gain': round(expected_gain, 2),
                },
                'future_exam_probability': {
                    'value': round(exam_prob, 4),
                    'weight': FACTOR_WEIGHTS['future_exam_probability'],
                    'contribution': round(exam_prob * FACTOR_WEIGHTS['future_exam_probability'], 4),
                },
                'weakness_severity': {
                    'value': round(weakness, 4),
                    'weight': FACTOR_WEIGHTS['weakness_severity'],
                    'contribution': round(weakness * FACTOR_WEIGHTS['weakness_severity'], 4),
                    'current_mastery': round(mastery, 4),
                },
                'difficulty_gap': {
                    'value': round(diff_gap, 4),
                    'weight': FACTOR_WEIGHTS['difficulty_gap'],
                    'contribution': round(diff_gap * FACTOR_WEIGHTS['difficulty_gap'], 4),
                },
                'graph_centrality': {
                    'value': round(centrality, 4),
                    'weight': FACTOR_WEIGHTS['graph_centrality'],
                    'contribution': round(centrality * FACTOR_WEIGHTS['graph_centrality'], 4),
                },
                'time_efficiency': {
                    'value': round(time_eff, 4),
                    'weight': FACTOR_WEIGHTS['time_efficiency'],
                    'contribution': round(time_eff * FACTOR_WEIGHTS['time_efficiency'], 4),
                },
            },
        }

    def recommend(
        self,
        student_ability: float = 0.5,
        days_until_exam: int = 180,
        study_hours_per_week: float = 10.0,
        num_recommendations: int = 20,
        max_per_domain: int = 6,
    ) -> Dict:
        """
        Generate ranked study recommendations.

        Args:
            student_ability: Student's overall ability (0-1)
            days_until_exam: Days until the exam
            study_hours_per_week: Study hours available per week
            num_recommendations: Max number of recommendations
            max_per_domain: Max topics from any single domain

        Returns:
            Dict with recommendations and analysis
        """
        # Score all topics
        scored = []
        for topic in self.all_topics:
            result = self.compute_topic_score(
                topic, student_ability, days_until_exam, study_hours_per_week
            )
            scored.append(result)

        # Sort by final score
        scored.sort(key=lambda x: x['final_score'], reverse=True)

        # Apply domain diversity filter
        domain_counts = defaultdict(int)
        filtered = []
        for r in scored:
            domain = r['domain']
            if domain_counts[domain] < max_per_domain:
                filtered.append(r)
                domain_counts[domain] += 1
            if len(filtered) >= num_recommendations:
                break

        # Add rank
        for i, r in enumerate(filtered):
            r['rank'] = i + 1

        # Compute aggregate stats
        avg_score = sum(r['final_score'] for r in filtered) / max(1, len(filtered))
        domains_covered = len(set(r['domain'] for r in filtered))
        total_expected_gain = sum(r['expected_score_increase'] for r in filtered)

        return {
            'recommendations': filtered,
            'metadata': {
                'student_ability': student_ability,
                'days_until_exam': days_until_exam,
                'study_hours_per_week': study_hours_per_week,
                'total_recommendations': len(filtered),
                'domains_covered': domains_covered,
                'average_recommendation_score': round(avg_score, 2),
                'total_expected_score_increase': round(total_expected_gain, 2),
                'factor_weights': FACTOR_WEIGHTS,
            },
        }

    def explain_recommendation(self, topic: str, **kwargs) -> Dict:
        """Get a detailed explanation for a single recommendation."""
        return self.compute_topic_score(topic, **kwargs)


# ═══════════════════════════════════════════════════════════════════════
# RECOMMENDATION EVALUATION
# ═══════════════════════════════════════════════════════════════════════

def evaluate_recommendation_quality(
    recommendations: List[Dict],
    exam_frequency: Dict[str, int] = None,
    all_topics: List[str] = None,
) -> Dict:
    """
    Evaluate recommendation quality.

    Metrics:
      - Hit Rate: fraction of recommendations that appear in exam frequency top-N
      - Coverage: fraction of all topics covered
      - Diversity: distribution across domains
      - Average score

    Args:
        recommendations: List of recommendation dicts
        exam_frequency: Dict mapping topic -> count
        all_topics: Full list of topics

    Returns:
        Dict with evaluation metrics
    """
    if all_topics is None:
        all_topics = [t for t, _ in get_all_topics()]

    recommended_topics = set(r['topic'] for r in recommendations)

    # Coverage
    coverage = len(recommended_topics) / max(1, len(all_topics))

    # Domain diversity
    domain_counts = defaultdict(int)
    for r in recommendations:
        domain_counts[r.get('domain', 'unknown')] += 1
    n_domains = len(domain_counts)
    domain_entropy = 0.0
    total = sum(domain_counts.values())
    if total > 0:
        for count in domain_counts.values():
            p = count / total
            domain_entropy -= p * math.log(p) if p > 0 else 0
    max_entropy = math.log(max(1, n_domains))
    diversity = domain_entropy / max_entropy if max_entropy > 0 else 0

    # Hit rate (if exam frequency provided)
    hit_rate = 0.0
    if exam_frequency:
        top_10_freq = set(sorted(exam_frequency.keys(), key=lambda k: exam_frequency[k], reverse=True)[:10])
        if recommended_topics:
            hit_rate = len(recommended_topics & top_10_freq) / max(1, len(recommended_topics))

    # Average score
    avg_score = sum(r.get('final_score', 0) for r in recommendations) / max(1, len(recommendations))

    return {
        'hit_rate': round(hit_rate, 4),
        'coverage': round(coverage, 4),
        'diversity': round(diversity, 4),
        'avg_score': round(avg_score, 2),
        'domains_covered': n_domains,
        'num_recommendations': len(recommendations),
        'total_expected_gain': round(sum(r.get('expected_score_increase', 0) for r in recommendations), 2),
    }
