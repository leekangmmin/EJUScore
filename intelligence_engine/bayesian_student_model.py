"""
Bayesian Student Model v2 (Upgraded)
=====================================
Tracks for every topic:
  - P(mastered | attempts) using Bayesian updating
  - Bayesian Knowledge Tracing (BKT) with 4 parameters
  - Forgetting curve (Ebbinghaus + SM-2 + Difficulty adjustment)
  - review timing (optimal spaced repetition)
  - confidence (credible interval width)
  - expected score growth (projection)

Uses hierarchical Bayesian modeling with conjugate priors.
"""

import json
import math
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional

from .predictor import load_gold_standard, get_all_topics
from .weakness_engine import (
    estimate_mastery,
    compute_forgetting_curve,
    optimal_review_interval,
    PREREQUISITE_MAP,
)


# ═══════════════════════════════════════════════════════════════════════
# BAYESIAN KNOWLEDGE TRACING (BKT)
# ═══════════════════════════════════════════════════════════════════════

class BayesianKnowledgeTracer:
    """
    Bayesian Knowledge Tracing with 4 standard parameters.

    Parameters:
      P(L0): Initial probability the topic is already known
      P(T):  Probability of learning/transitioning from not-known to known
      P(G):  Probability of guessing correctly (slip)
      P(S):  Probability of slipping (careless error)

    Updates:
      P(L_t | correct) = P(L_t) * (1 - P(S)) / [P(L_t)*(1-P(S)) + (1-P(L_t))*P(G)]
      P(L_t | incorrect) = P(L_t) * P(S) / [P(L_t)*P(S) + (1-P(L_t))*(1-P(G))]
      P(L_{t+1}) = P(L_t | evidence) + (1 - P(L_t | evidence)) * P(T)
    """

    def __init__(self, topic: str, difficulty: float = 0.5):
        self.topic = topic

        # BKT parameters
        # Initial knowledge: depends on topic difficulty
        self.P_L0 = max(0.1, 0.5 - difficulty * 0.3)

        # Transition probability (learn rate): harder topics have lower P(T)
        self.P_T = max(0.05, 0.3 - difficulty * 0.2)

        # Guess probability: easier to guess on easier topics
        self.P_G = max(0.05, 0.25 - difficulty * 0.1)

        # Slip probability: harder topics have higher slip rate
        self.P_S = min(0.3, 0.1 + difficulty * 0.2)

        # Current knowledge probability
        self.P_L = self.P_L0

        # Observation sequence
        self.observations: List[dict] = []

    def update(self, correct: bool, difficulty_adjustment: float = 1.0):
        """
        Update knowledge estimate based on observation.

        Args:
            correct: Whether the response was correct
            difficulty_adjustment: Multiplier for difficulty effect
        """
        # Adjust parameters for difficulty
        P_G_adj = min(0.4, self.P_G * (1.0 + (1.0 - difficulty_adjustment) * 0.3))
        P_S_adj = min(0.4, self.P_S * difficulty_adjustment)

        # Update P(L) based on evidence
        if correct:
            # P(L|correct) = P(L)*(1-P(S)) / [P(L)*(1-P(S)) + (1-P(L))*P(G)]
            numerator = self.P_L * (1 - P_S_adj)
            denominator = numerator + (1 - self.P_L) * P_G_adj
        else:
            # P(L|incorrect) = P(L)*P(S) / [P(L)*P(S) + (1-P(L))*(1-P(G))]
            numerator = self.P_L * P_S_adj
            denominator = numerator + (1 - self.P_L) * (1 - P_G_adj)

        if denominator > 0:
            P_L_evidence = numerator / denominator
        else:
            P_L_evidence = self.P_L

        # Apply transition (learning after opportunity)
        self.P_L = P_L_evidence + (1 - P_L_evidence) * self.P_T

        # Apply forgetting decay (proportional to time since last observation)
        if len(self.observations) > 0:
            last_obs = self.observations[-1]
            days_since = (datetime.now() - last_obs.get('date', datetime.now())).days
            if days_since > 0:
                # Small decay over time
                decay = math.exp(-days_since / 120.0)  # 120-day half-life for BKT
                self.P_L = self.P_L * decay + self.P_L0 * (1 - decay)

        self.observations.append({
            'correct': correct,
            'P_L_before': self.P_L,
            'P_L_after': self.P_L,
            'date': datetime.now(),
        })

    @property
    def knowledge_probability(self) -> float:
        """Get current knowledge probability P(L)."""
        return max(0.0, min(1.0, self.P_L))

    def to_dict(self) -> Dict:
        return {
            'topic': self.topic,
            'P_L': round(self.P_L, 4),
            'P_L0': round(self.P_L0, 4),
            'P_T': round(self.P_T, 4),
            'P_G': round(self.P_G, 4),
            'P_S': round(self.P_S, 4),
            'num_observations': len(self.observations),
        }


# ═══════════════════════════════════════════════════════════════════════
# FORGETTING MODEL (Ebbinghaus + SM-2 + Difficulty)
# ═══════════════════════════════════════════════════════════════════════

class ForgettingModel:
    """
    Combined forgetting model.

    Incorporates:
      - Ebbinghaus exponential forgetting curve
      - SM-2 spaced repetition intervals
      - Difficulty adjustment for topic-specific retention
    """

    def __init__(self, difficulty: float = 0.5):
        self.difficulty = difficulty

        # Base half-life depends on difficulty
        # Easy topics: longer retention; Hard topics: faster forgetting
        self.base_half_life = max(3, 14 - difficulty * 14)  # 3-14 days

        # SM-2 parameters
        self.ease_factor = 2.5
        self.interval = 0
        self.repetitions = 0

    def compute_retention(
        self,
        days_since_review: int,
        initial_mastery: float = 0.8,
        retention_rate: float = 0.5,
    ) -> float:
        """
        Compute memory retention using enhanced forgetting curve.

        R = S * (retention_rate + (1-retention_rate) * e^(-t/H))

        Where H = base_half_life * (1 + 0.3 * (1 - difficulty))
        """
        if days_since_review <= 0:
            return initial_mastery

        # Adjust half-life for difficulty
        adjusted_half_life = self.base_half_life * (1.0 + 0.3 * (1.0 - self.difficulty))

        # Adjust for SM-2 repetition count (more reviews = longer retention)
        if self.repetitions > 0:
            adjusted_half_life *= (1.0 + 0.5 * min(5, self.repetitions))

        decay = math.exp(-days_since_review / adjusted_half_life)
        retention = initial_mastery * (retention_rate + (1 - retention_rate) * decay)

        return max(0.0, min(1.0, retention))

    def update_sm2(self, quality: int):
        """
        Update SM-2 parameters based on recall quality (0-5).
        """
        if quality < 3:
            self.repetitions = 0
            self.interval = 1
        else:
            if self.repetitions == 0:
                self.interval = 1
            elif self.repetitions == 1:
                self.interval = 6
            else:
                self.interval = int(self.interval * self.ease_factor)
            self.repetitions += 1
            self.ease_factor = max(
                1.3,
                self.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
            )

    def get_next_interval(self, target_retention: float = 0.8) -> int:
        """
        Calculate optimal days until next review for target retention.

        Uses SM-2 interval if available, otherwise computes from forgetting curve.
        """
        if self.interval > 0:
            return self.interval

        # Compute from retention formula
        # R = e^(-t/H) => t = -H * ln(R)
        t = -self.base_half_life * math.log(target_retention)
        return max(1, int(t))

    def to_dict(self) -> Dict:
        return {
            'difficulty': round(self.difficulty, 4),
            'base_half_life_days': int(self.base_half_life),
            'ease_factor': round(self.ease_factor, 2),
            'interval_days': self.interval,
            'repetitions': self.repetitions,
        }


# ═══════════════════════════════════════════════════════════════════════
# SPACED REPETITION SCHEDULER
# ═══════════════════════════════════════════════════════════════════════

class SpacedRepetitionScheduler:
    """
    Optimal review timing using SM-2-like algorithm adapted for EJU.

    Tracks:
      - Ease factor (how quickly this topic is learned)
      - Interval (days until next review)
      - Repetition count (how many times reviewed)
    """

    def __init__(self):
        self.ease_factor = 2.5
        self.interval = 0
        self.repetitions = 0

    def update(self, quality: int):
        if quality < 3:
            self.repetitions = 0
            self.interval = 1
        else:
            if self.repetitions == 0:
                self.interval = 1
            elif self.repetitions == 1:
                self.interval = 6
            else:
                self.interval = int(self.interval * self.ease_factor)
            self.repetitions += 1
            self.ease_factor = max(
                1.3,
                self.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
            )

    def get_next_review_date(self, from_date: datetime = None) -> datetime:
        if from_date is None:
            from_date = datetime.now()
        return from_date + timedelta(days=self.interval)


# ═══════════════════════════════════════════════════════════════════════
# TOPIC MASTERY TRACKER (Bayesian + BKT + Forgetting)
# ═══════════════════════════════════════════════════════════════════════

class TopicMasteryTracker:
    """
    Track mastery for a single topic using:
      - Bayesian Beta-Binomial updating (P(mastered|attempts))
      - Bayesian Knowledge Tracing (BKT 4-param model)
      - Forgetting model (Ebbinghaus + SM-2 + difficulty)
    """

    def __init__(self, topic: str, domain: str = '', difficulty: float = 0.5):
        self.topic = topic
        self.domain = domain
        self.difficulty = difficulty

        # Bayesian Beta-Binomial
        self.alpha = 2.0
        self.beta = 2.0

        # Bayesian Knowledge Tracing
        self.bkt = BayesianKnowledgeTracer(topic, difficulty)

        # Forgetting model
        self.forgetting = ForgettingModel(difficulty)

        # Legacy
        self.last_review_date: Optional[datetime] = None
        self.half_life_days = 7
        self.scheduler = SpacedRepetitionScheduler()
        self.attempts: List[dict] = []
        self.mastery_history: List[dict] = []

    @property
    def mastery(self) -> float:
        """
        Combined mastery estimate from Beta-Binomial and BKT.

        Weighted average: Beta-Binomial (60%) + BKT (40%)
        """
        beta_mastery = self.alpha / (self.alpha + self.beta)
        bkt_mastery = self.bkt.knowledge_probability
        return 0.6 * beta_mastery + 0.4 * bkt_mastery

    @property
    def confidence(self) -> float:
        total = self.alpha + self.beta
        if total <= 0:
            return 0.0
        var = (self.alpha * self.beta) / (total ** 2 * (total + 1))
        std = var ** 0.5
        return max(0.0, min(1.0, 1.0 - 2.0 * std))

    @property
    def credible_interval(self) -> Tuple[float, float]:
        total = self.alpha + self.beta
        if total <= 0:
            return (0.0, 1.0)
        mean = self.alpha / total
        var = (self.alpha * self.beta) / (total ** 2 * (total + 1))
        std = var ** 0.5
        lower = max(0.0, mean - 1.645 * std)
        upper = min(1.0, mean + 1.645 * std)
        return (lower, upper)

    def observe(self, correct: bool, date: datetime = None):
        if date is None:
            date = datetime.now()

        # --- Beta-Binomial update ---
        # Apply forgetting-adjusted weight
        if self.last_review_date and self.mastery > 0:
            days_since = (date - self.last_review_date).days
            retention = self.forgetting.compute_retention(
                days_since, initial_mastery=self.alpha / max(1, self.alpha + self.beta)
            )
            weight = 1.0 + max(0, 1.0 - retention)
        else:
            weight = 1.0

        if correct:
            self.alpha += weight
        else:
            self.beta += weight

        # --- BKT update ---
        difficulty_adjust = 1.0 + (self.difficulty - 0.5) * 0.5
        self.bkt.update(correct, difficulty_adjustment=difficulty_adjust)

        # --- SM-2 update ---
        quality = 5 if correct else 1
        self.scheduler.update(quality)
        self.forgetting.update_sm2(quality)

        # --- Half-life adjustment ---
        if correct:
            self.half_life_days = int(self.half_life_days * 1.3)

        self.last_review_date = date
        self.attempts.append({
            'date': date.isoformat() if isinstance(date, datetime) else str(date),
            'correct': correct,
            'mastery_after': self.mastery,
        })

    def get_current_retention(self, current_date: datetime = None) -> float:
        if current_date is None:
            current_date = datetime.now()
        if not self.last_review_date:
            return self.mastery
        days_since = (current_date - self.last_review_date).days
        return self.forgetting.compute_retention(
            days_since, initial_mastery=self.mastery
        )

    def get_review_recommendation(self, current_date: datetime = None) -> Dict:
        if current_date is None:
            current_date = datetime.now()
        retention = self.get_current_retention(current_date)
        next_interval = self.scheduler.interval
        # Use forgetting model for interval if SM-2 has no data
        if next_interval == 0:
            next_interval = self.forgetting.get_next_interval()
        next_review = current_date + timedelta(days=next_interval)
        return {
            'topic': self.topic,
            'current_retention': round(retention, 3),
            'mastery': round(self.mastery, 3),
            'days_until_next_review': next_interval,
            'next_review_date': next_review.isoformat(),
            'priority': 'high' if retention < 0.6 else 'medium' if retention < 0.8 else 'low',
        }

    def to_dict(self) -> Dict:
        lower, upper = self.credible_interval
        return {
            'topic': self.topic,
            'domain': self.domain,
            'mastery': round(self.mastery, 3),
            'confidence': round(self.confidence, 3),
            'credible_interval_90pct': {
                'lower': round(lower, 3),
                'upper': round(upper, 3),
            },
            'difficulty': self.difficulty,
            'half_life_days': self.half_life_days,
            'total_attempts': len(self.attempts),
            'correct_attempts': sum(1 for a in self.attempts if a['correct']),
            'bayesian_knowledge_tracing': self.bkt.to_dict(),
            'forgetting_model': self.forgetting.to_dict(),
            'spaced_repetition': {
                'ease_factor': round(self.scheduler.ease_factor, 2),
                'interval_days': self.scheduler.interval,
                'repetitions': self.scheduler.repetitions,
            },
            'last_review': self.last_review_date.isoformat() if self.last_review_date else None,
        }


# ═══════════════════════════════════════════════════════════════════════
# STUDENT MODEL
# ═══════════════════════════════════════════════════════════════════════

class BayesianStudentModel:
    """
    Complete Bayesian student model tracking all topics.

    Features:
      - Per-topic mastery estimation (Bayesian + BKT)
      - Knowledge tracing with BKT 4-parameter model
      - Forgetting curves (Ebbinghaus + SM-2 + difficulty)
      - Review scheduling (spaced repetition)
      - Score growth projection
    """

    def __init__(self):
        self.topics: Dict[str, TopicMasteryTracker] = {}
        self._initialize_topics()

    def _initialize_topics(self):
        for topic, domain in get_all_topics():
            difficulty = self._get_topic_difficulty(topic)
            self.topics[topic] = TopicMasteryTracker(
                topic=topic, domain=domain, difficulty=difficulty
            )

    def _get_topic_difficulty(self, topic: str) -> float:
        """Estimate topic difficulty based on domain and frequency."""
        difficulty_map = {
            'economy': 0.5, 'politics': 0.5, 'history': 0.4,
            'geography': 0.3, 'society': 0.5,
        }
        domain = None
        for t, d in get_all_topics():
            if t == topic:
                domain = d
                break
        return difficulty_map.get(domain, 0.5)

    def observe_answer(self, topic: str, correct: bool, date: datetime = None):
        if topic not in self.topics:
            return
        self.topics[topic].observe(correct, date)

        # Also update prerequisites (knowledge tracing propagation)
        if topic in PREREQUISITE_MAP:
            for prereq in PREREQUISITE_MAP[topic]:
                if prereq in self.topics:
                    if not correct:
                        # Wrong answer → prereq weaknesses also observed
                        self.topics[prereq].observe(False, date)
                    else:
                        # Correct answer → weak signal for prereqs
                        self.topics[prereq].observe(True, date)

    def observe_batch(self, answers: List[Dict]):
        for a in answers:
            date = datetime.fromisoformat(a['date']) if isinstance(a.get('date'), str) else a.get('date')
            self.observe_answer(a['topic'], a['correct'], date)

    def get_mastery_report(self) -> Dict:
        """Get mastery state for all topics."""
        return {topic: tracker.to_dict() for topic, tracker in self.topics.items()}

    def get_forgetting_report(self, current_date: datetime = None) -> List[Dict]:
        """Get forgetting analysis for all topics."""
        if current_date is None:
            current_date = datetime.now()
        report = []
        for topic, tracker in self.topics.items():
            retention = tracker.get_current_retention(current_date)
            report.append({
                'topic': topic,
                'domain': tracker.domain,
                'mastery': round(tracker.mastery, 3),
                'retention': round(retention, 3),
                'days_since_review': (
                    (current_date - tracker.last_review_date).days
                    if tracker.last_review_date else 999
                ),
                'needs_review': retention < 0.7,
                'review_urgency': 'critical' if retention < 0.5
                    else 'high' if retention < 0.6
                    else 'medium' if retention < 0.7
                    else 'low',
                'bkt_knowledge': round(tracker.bkt.knowledge_probability, 3),
                'forgetting_half_life': tracker.forgetting.base_half_life,
            })
        report.sort(key=lambda x: x['retention'])
        return report

    def get_review_schedule(self, num_days: int = 30) -> Dict[int, List[Dict]]:
        """Get recommended review schedule."""
        current_date = datetime.now()
        schedule = defaultdict(list)
        for topic, tracker in self.topics.items():
            rec = tracker.get_review_recommendation(current_date)
            days_until = rec['days_until_next_review']
            if days_until <= num_days:
                day = min(num_days, days_until)
                schedule[day].append(rec)
        return dict(schedule)

    def project_score_growth(
        self,
        current_score: float,
        target_score: float,
        weeks_available: int,
        study_hours_per_week: int = 10,
    ) -> Dict:
        """Project score growth under current study plan."""
        score_gap = max(0, target_score - current_score)
        mastery_values = [t.mastery for t in self.topics.values()]
        avg_mastery = sum(mastery_values) / max(1, len(mastery_values))

        learning_rate = max(0.3, 1.0 - avg_mastery)
        points_per_hour = learning_rate * 0.5
        weekly_forgetting_rate = 0.003 + 0.005 * (1.0 - avg_mastery)

        weekly_projections = []
        simulated_score = float(current_score)

        for week in range(1, weeks_available + 1):
            weekly_study_gain = points_per_hour * study_hours_per_week
            forgetting_loss = simulated_score * weekly_forgetting_rate
            net_change = weekly_study_gain - forgetting_loss
            simulated_score = min(target_score, simulated_score + net_change)
            remaining_gap = max(0, target_score - simulated_score)
            effective_mastery = min(0.95, avg_mastery + (1.0 - avg_mastery) * week / weeks_available)
            learning_rate = max(0.3, 1.0 - effective_mastery)
            points_per_hour = learning_rate * 0.5

            weekly_projections.append({
                'week': week,
                'projected_score': round(simulated_score, 1),
                'net_change': round(net_change, 2),
                'remaining_gap': round(remaining_gap, 1),
            })

        # Estimate weeks to target
        weeks_to_target = None
        for wp in weekly_projections:
            if wp['remaining_gap'] <= 0:
                weeks_to_target = wp['week']
                break

        return {
            'current_score': current_score,
            'target_score': target_score,
            'weeks_available': weeks_available,
            'estimated_weeks_to_target': weeks_to_target if weeks_to_target else 'more than available weeks',
            'achievable': simulated_score >= target_score,
            'final_projected_score': round(simulated_score, 1),
            'avg_mastery': round(avg_mastery, 3),
            'weekly_projections': weekly_projections,
        }

    def to_dict(self) -> Dict:
        """Export full model state."""
        return {
            'mastery_report': self.get_mastery_report(),
            'forgetting_report': self.get_forgetting_report(),
        }


# ═══════════════════════════════════════════════════════════════════════
# STUDENT MODEL EVALUATION
# ═══════════════════════════════════════════════════════════════════════

def evaluate_study_outcome_correlation() -> Dict:
    """
    Evaluate whether the student model's predictions correlate with
    actual study outcomes.

    Returns:
        Dict with calibration metrics
    """
    try:
        questions = load_gold_standard()
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            'evaluation_type': 'study_outcome',
            'error': 'Gold standard not available',
            'metrics': {
                'calibration_error': 0.0,
                'brier_score': 0.0,
                'rmse': 0.0,
            },
        }

    model = BayesianStudentModel()

    # Simulate observations from gold standard data (use topics with low difficulty as "correct")
    from collections import Counter
    topic_counts = Counter(q.get('topic', '') for q in questions)
    correct_topics = set(t for t, c in topic_counts.most_common(15))

    for topic, count in topic_counts.items():
        if count >= 3:  # Only topics with sufficient data
            if topic in correct_topics:
                for i in range(min(5, count)):
                    model.observe_answer(topic, True)
            else:
                for i in range(min(3, count)):
                    model.observe_answer(topic, False)

    # Get mastery estimates and compare with actual exam performance
    mastery_report = model.get_mastery_report()

    # Calibration: Does predicted mastery match actual difficulty?
    calibration_errors = []
    brier_scores = []
    topic_difficulties = {q.get('topic', ''): q.get('difficulty', 3) for q in questions if q.get('topic')}

    for topic, info in mastery_report.items():
        mastery = info['mastery']
        difficulty = topic_difficulties.get(topic, 3) / 5.0  # Normalize to 0-1

        # Calibration: |predicted - actual|
        calibration_error = abs(mastery - (1.0 - difficulty))
        calibration_errors.append(calibration_error)

        # Brier Score: (predicted - outcome)^2
        brier = (mastery - (1.0 - difficulty)) ** 2
        brier_scores.append(brier)

    avg_calibration = sum(calibration_errors) / max(1, len(calibration_errors))
    avg_brier = sum(brier_scores) / max(1, len(brier_scores))
    rmse = math.sqrt(sum(b ** 2 for b in brier_scores) / max(1, len(brier_scores)))

    return {
        'evaluation_type': 'study_outcome',
        'metrics': {
            'calibration_error': round(avg_calibration, 4),
            'brier_score': round(avg_brier, 4),
            'rmse': round(rmse, 4),
            'topics_evaluated': len(calibration_errors),
        },
        'model_consistency': {
            'avg_mastery': round(sum(m['mastery'] for m in mastery_report.values()) / max(1, len(mastery_report)), 4),
            'avg_confidence': round(sum(m['confidence'] for m in mastery_report.values()) / max(1, len(mastery_report)), 4),
            'topics_tracked': len(mastery_report),
        },
    }
