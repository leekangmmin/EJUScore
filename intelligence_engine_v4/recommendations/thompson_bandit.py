"""
Thompson Sampling for Study Recommendations
============================================
Replaces heuristic multi-factor recommendation with
a principled exploration-exploitation approach.

For each topic t:
  θ_t ~ Beta(α_t + correct_t, β_t + incorrect_t)
  
  Select topics with highest:
    score_t = θ_t × exam_probability(t) × urgency(t)

This is a Contextual Multi-Armed Bandit where:
- Arms = 35 topics
- Reward = correct answer on next attempt
- Context = student history + exam proximity
"""

import math
import numpy as np
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from intelligence_engine_v4.config import (
    BANDIT_ALPHA_PRIOR, BANDIT_BETA_PRIOR,
)
from intelligence_engine_v4.data import (
    ALL_TOPICS, TOPIC_TO_IDX, IDX_TO_TOPIC,
    DOMAIN_OF_TOPIC, TOPIC_TO_CLUSTER, CLUSTER_TO_TOPICS,
    PREREQUISITE_MAP,
)


class ThompsonBanditRecommender:
    """
    Thompson Sampling bandit for topic selection.

    Tracks Beta posterior for each topic's mastery,
    then recommends topics balancing:
      - Low mastery (high learning potential)
      - High exam probability (immediate utility)
      - Prerequisite status (foundational topics first)
    """

    def __init__(
        self,
        alpha_prior: float = BANDIT_ALPHA_PRIOR,
        beta_prior: float = BANDIT_BETA_PRIOR,
    ):
        self.alpha_prior = alpha_prior
        self.beta_prior = beta_prior

        # Topic-level Beta posteriors
        self.alphas = {t: alpha_prior for t in ALL_TOPICS}
        self.betas = {t: beta_prior for t in ALL_TOPICS}

        # Exam probabilities (from predictor)
        self.exam_probs = {t: 0.3 for t in ALL_TOPICS}

        # History
        self.recommendations: List[dict] = []
        self.feedback: List[dict] = []

    def set_exam_probabilities(self, exam_probs: Dict[str, float]):
        """Update exam appearance probabilities from predictor."""
        self.exam_probs.update(exam_probs)

    def update_from_attempt(self, topic: str, correct: bool):
        """
        Update Beta posterior after a student attempt.

        Args:
            topic: Topic attempted
            correct: Whether the answer was correct
        """
        if topic not in self.alphas:
            return

        if correct:
            self.alphas[topic] += 1.0
        else:
            self.betas[topic] += 1.0

        self.feedback.append({
            'topic': topic,
            'correct': correct,
            'timestamp': __import__('time').time(),
        })

    def get_mastery(self, topic: str) -> float:
        """Get expected mastery (posterior mean) for a topic."""
        a = self.alphas.get(topic, self.alpha_prior)
        b = self.betas.get(topic, self.beta_prior)
        return a / (a + b)

    def get_uncertainty(self, topic: str) -> float:
        """Get uncertainty (posterior std) for a topic."""
        a = self.alphas.get(topic, self.alpha_prior)
        b = self.betas.get(topic, self.beta_prior)
        total = a + b
        if total <= 0:
            return 1.0
        var = (a * b) / (total ** 2 * (total + 1))
        return math.sqrt(var) if var > 0 else 1.0

    def sample_mastery(self, topic: str, n_samples: int = 1) -> np.ndarray:
        """Sample from posterior mastery distribution (Thompson sampling)."""
        a = self.alphas.get(topic, self.alpha_prior)
        b = self.betas.get(topic, self.beta_prior)
        return np.random.beta(a, b, size=n_samples)

    def recommend(
        self,
        n_topics: int = 5,
        exam_days_remaining: int = 180,
        include_exploration: bool = True,
        prioritize_prerequisites: bool = True,
        context: Dict = None,
    ) -> List[Dict]:
        """
        Recommend topics using Thompson sampling.

        Args:
            n_topics: Number of topics to recommend
            exam_days_remaining: Days until exam
            include_exploration: Whether to sample (True) or use mean (False)
            prioritize_prerequisites: Boost foundational topics
            context: Additional context dict (student_ability, etc.)

        Returns:
            List of recommended topics with scores
        """
        scores = []

        for topic in ALL_TOPICS:
            # Thompson sample: draw from posterior
            if include_exploration:
                sampled_mastery = self.sample_mastery(topic)[0]
            else:
                sampled_mastery = self.get_mastery(topic)

            # Urgency: topics with low mastery have high learning potential
            learning_potential = 1.0 - sampled_mastery

            # Exam probability (how likely to appear on exam)
            exam_prob = self.exam_probs.get(topic, 0.3)

            # Prerequisite boost: foundational topics get bonus
            prereq_bonus = 0.0
            if prioritize_prerequisites:
                # Count how many other topics depend on this one
                as_prereq_count = sum(
                    1 for t, prereqs in PREREQUISITE_MAP.items()
                    if topic in prereqs
                )
                prereq_bonus = min(0.3, as_prereq_count * 0.05)

            # Urgency based on exam proximity
            time_urgency = max(0.2, min(1.0, 1.0 - exam_days_remaining / 365.0))

            # Uncertainty bonus (exploration)
            uncertainty_bonus = 0.0
            if include_exploration:
                total_attempts = self.alphas.get(topic, 0) + self.betas.get(topic, 0) - self.alpha_prior - self.beta_prior + 2
                if total_attempts < 5:
                    uncertainty_bonus = 0.2 * (1.0 - total_attempts / 5.0)

            # Final score
            score = (
                learning_potential * 0.35 +
                exam_prob * 0.30 +
                prereq_bonus * 0.15 +
                time_urgency * 0.10 +
                uncertainty_bonus * 0.10
            )

            scores.append({
                'topic': topic,
                'domain': DOMAIN_OF_TOPIC.get(topic, ''),
                'cluster': TOPIC_TO_CLUSTER.get(topic, ''),
                'score': score,
                'current_mastery': float(sampled_mastery),
                'exam_probability': exam_prob,
                'learning_potential': learning_potential,
                'uncertainty': self.get_uncertainty(topic),
                'prerequisite_value': prereq_bonus,
            })

        # Sort by score descending
        scores.sort(key=lambda x: x['score'], reverse=True)

        # Deduplicate by cluster (don't recommend too many from same cluster)
        recommended = []
        cluster_counts = defaultdict(int)
        max_per_cluster = max(1, n_topics // 3)

        for s in scores:
            cluster = s['cluster']
            if cluster_counts[cluster] >= max_per_cluster and len(recommended) < n_topics:
                # Still add if we need more topics
                pass
            recommended.append(s)
            cluster_counts[cluster] += 1

            if len(recommended) >= n_topics:
                break

        self.recommendations = recommended
        return recommended

    def recommend_prerequisite_chain(self, weak_topic: str, n_topics: int = 3) -> List[Dict]:
        """
        If a student is weak on a topic, recommend its prerequisites first.

        Args:
            weak_topic: Topic the student struggles with
            n_topics: Number of prerequisite topics to recommend

        Returns:
            List of prerequisite topic recommendations
        """
        prereqs = PREREQUISITE_MAP.get(weak_topic, [])
        if not prereqs:
            return self.recommend(n_topics=n_topics)

        prereq_scores = []
        for prereq in prereqs:
            if prereq not in ALL_TOPICS:
                continue
            mastery = self.get_mastery(prereq)
            prereq_scores.append({
                'topic': prereq,
                'domain': DOMAIN_OF_TOPIC.get(prereq, ''),
                'score': 1.0 - mastery,  # lower mastery = higher priority
                'current_mastery': mastery,
                'relation': f"prerequisite_of_{weak_topic}",
            })

        prereq_scores.sort(key=lambda x: x['score'], reverse=True)

        # Fill remaining slots with general recommendations
        if len(prereq_scores) < n_topics:
            remaining = self.recommend(n_topics=n_topics - len(prereq_scores))
            prereq_scores.extend(remaining)

        return prereq_scores[:n_topics]

    def get_explanation(self, topic: str) -> Dict:
        """
        Generate explainable recommendation factors for a topic.

        Returns dict with factor contributions.
        """
        mastery = self.get_mastery(topic)
        uncertainty = self.get_uncertainty(topic)
        exam_prob = self.exam_probs.get(topic, 0.3)

        as_prereq_count = sum(
            1 for t, prereqs in PREREQUISITE_MAP.items()
            if topic in prereqs
        )

        return {
            'topic': topic,
            'current_mastery': round(mastery, 3),
            'mastery_assessment': (
                'strong' if mastery > 0.7
                else 'moderate' if mastery > 0.4
                else 'weak'
            ),
            'uncertainty': round(uncertainty, 3),
            'exam_probability': round(exam_prob, 3),
            'prerequisite_count': as_prereq_count,
            'recommendation_reason': (
                f"{'기초 개념' if as_prereq_count > 2 else '학습 필요' if mastery < 0.4 else '심화'}"
            ),
            'factors': {
                'learning_potential': round(1.0 - mastery, 3),
                'exam_relevance': round(exam_prob, 3),
                'foundational_importance': round(min(1.0, as_prereq_count / 10.0), 3),
            },
        }
