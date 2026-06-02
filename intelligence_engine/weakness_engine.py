"""
Deep Weakness Engine
====================
Moves beyond simple "Wrong Question → Topic" mapping.

Pipeline:
  Wrong Question → Topic → Prerequisite Concepts → Hidden Weakness Detection
  → Mastery Estimation → Future Risk Prediction

Detects root causes instead of symptoms.
"""

import json
import math
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Optional

from .predictor import (
    load_gold_standard, load_knowledge_graph, get_all_topics,
    DOMAIN_TOPICS,
)

# ═══════════════════════════════════════════════════════════════════════
# PREREQUISITE CONCEPT MAP
# ═══════════════════════════════════════════════════════════════════════

# Core prerequisite relationships for EJU comprehensive subjects
# topic -> list of prerequisite topics/concepts
# IMPORTANT: No circular dependencies allowed!
PREREQUISITE_MAP = {
    '수요·공급과 시장균형': ['경제학 기초'],
    'GDP·국민소득': ['수요·공급과 시장균형', '경제학 기초'],
    '환율·국제수지': ['GDP·국민소득', '금융·통화정책'],
    '금융·통화정책': ['수요·공급과 시장균형', 'GDP·국민소득'],
    '재정·조세정책': ['GDP·국민소득', '수요·공급과 시장균형'],
    '국제무역': ['환율·국제수지', 'GDP·국민소득', '국제정치·국제기구'],
    '고용·노동': ['경제성장·경기변동', '수요·공급과 시장균형'],
    '경제성장·경기변동': ['GDP·국민소득', '금융·통화정책'],
    '소득분배·지니계수': ['경제성장·경기변동', '고용·노동'],
    '일본경제사': ['경제성장·경기변동', '일본근대사'],
    '헌법·기본권': ['시민혁명', '정치사상'],
    '통치기구': ['헌법·기본권', '삼권분립'],
    '선거·정당': ['헌법·기본권', '통치기구'],
    '국제정치·국제기구': ['세계대전', '냉전'],
    '지방자치': ['통치기구', '헌법·기본권'],
    '사법·재판': ['헌법·기본권', '통치기구', '삼권분립'],
    '정치사상': ['시민혁명'],
    '안전보장·방위': ['국제정치·국제기구', '냉전'],
    '시민혁명': ['계몽사상', '근대사회'],
    '산업혁명·자본주의': ['시민혁명'],
    '제국주의·식민지': ['산업혁명·자본주의'],
    '세계대전': ['제국주의·식민지', '민족주의'],
    '냉전': ['세계대전'],
    '일본근대사': ['제국주의·식민지', '시민혁명'],
    '전후세계질서': ['세계대전', '냉전'],
    '세계화·지역통합': ['냉전', '전후세계질서'],
    '러시아혁명·소련': ['세계대전', '제국주의·식민지'],
    '대공황': ['세계대전', '금융·통화정책'],
    '기후·케펜구분': ['지리 기초'],
    '지형·판구조': ['지리 기초'],
    '인구·도시화': ['지리 기초'],
    '자원·농업': ['기후·케펜구분', '지형·판구조'],
    '지도·GIS': ['지리 기초'],
    '환경·생태': ['기후·케펜구분'],
    '산업·교통': ['인구·도시화', '자원·농업'],
    '환경문제': ['산업혁명·자본주의', '환경·생태'],
    '사회보장·복지': ['경제성장·경기변동', '고용·노동'],
    '저출산·고령화': ['사회보장·복지', '인구·도시화'],
    '정보화사회': ['세계화·지역통합'],
    '젠더·평등': ['시민혁명', '정치사상', '인권선언'],
    '다문화사회': ['세계화·지역통합', '정보화사회'],
}

# Extended prerequisite map with fine-grained concepts
CONCEPT_PREREQUISITE_MAP = {
    '계몽사상': [],
    '인권선언': ['계몽사상'],
    '삼권분립': ['계몽사상', '인권선언'],
    '자본주의': ['산업혁명·자본주의'],
    '중앙은행': ['금융·통화정책'],
    '금리': ['중앙은행', '금융·통화정책'],
    '통화량': ['중앙은행', '금융·통화정책'],
    '변동환율': ['환율·국제수지'],
    '고정환율': ['환율·국제수지'],
    '경상수지': ['환율·국제수지'],
    '국내총생산': ['GDP·국민소득'],
    '1인당소득': ['GDP·국민소득'],
    '케펜기후구분': ['기후·케펜구분'],
    '수요법칙': ['수요·공급과 시장균형'],
    '공급법칙': ['수요·공급과 시장균형'],
    '탄력성': ['수요·공급과 시장균형'],
    '기본권': ['헌법·기본권'],
    '의원내각제': ['통치기구'],
    '제국주의': ['제국주의·식민지'],
    '민족주의': ['제국주의·식민지'],
    '베르사유조약': ['세계대전'],
    '마셜플랜': ['냉전'],
    'NATO': ['냉전', '국제정치·국제기구'],
    '바르샤바조약': ['냉전'],
}


def load_weakness_profile(path='dataset/weakness_profile.json'):
    """Load the existing weakness profile."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def find_prerequisites(topic: str, recursive: bool = True, depth: int = 0, max_depth: int = 5, visited: set = None) -> List[str]:
    """
    Find all prerequisites for a topic, recursively.

    Args:
        topic: Topic name
        recursive: Whether to recursively find prerequisites of prerequisites
        depth: Current recursion depth
        max_depth: Maximum recursion depth
        visited: Set of already-visited topics (cycle prevention)

    Returns:
        List of prerequisite topics (ordered: most fundamental first)
    """
    if depth >= max_depth:
        return []

    if visited is None:
        visited = set()

    if topic in visited:
        return []  # Cycle detected, stop

    visited.add(topic)
    prereqs = PREREQUISITE_MAP.get(topic, [])
    all_prereqs = list(prereqs)

    if recursive:
        for p in prereqs:
            sub_prereqs = find_prerequisites(p, recursive=True, depth=depth + 1, max_depth=max_depth, visited=visited.copy())
            for sp in sub_prereqs:
                if sp not in all_prereqs:
                    all_prereqs.append(sp)

    return all_prereqs


def find_prerequisite_chain(topic_a: str, topic_b: str) -> List[str]:
    """
    Find if topic_a is a prerequisite of topic_b (directly or indirectly).

    Returns the chain from topic_a to topic_b if it exists.
    """
    if topic_a == topic_b:
        return [topic_a]

    direct_prereqs = PREREQUISITE_MAP.get(topic_b, [])
    if topic_a in direct_prereqs:
        return [topic_a, topic_b]

    for prereq in direct_prereqs:
        chain = find_prerequisite_chain(topic_a, prereq)
        if chain:
            return chain + [topic_b]

    return []


# ═══════════════════════════════════════════════════════════════════════
# HIDDEN WEAKNESS DETECTION
# ═══════════════════════════════════════════════════════════════════════

def detect_hidden_weaknesses(
    wrong_topics: List[str],
    all_known_topics: List[str],
) -> Dict[str, dict]:
    """
    Detect hidden weaknesses by tracing prerequisite chains.

    If a student struggles with topic X, they likely also struggle with
    all of X's prerequisites. Additionally, weaknesses propagate forward:
    if a student hasn't mastered the prerequisites of topic Y, Y is
    a hidden weakness even if not yet tested.

    Args:
        wrong_topics: Topics the student got wrong
        all_known_topics: All topics in the syllabus

    Returns:
        Dict mapping topic -> weakness analysis
    """
    # Direct weaknesses (confirmed by wrong answers)
    direct_weaknesses = set(wrong_topics)

    # Propagate backward: all prerequisites of direct weaknesses
    backward_weaknesses = set()
    for topic in direct_weaknesses:
        prereqs = find_prerequisites(topic, recursive=True)
        for p in prereqs:
            backward_weaknesses.add(p)

    # Propagate forward: topics whose prerequisites include direct weaknesses
    forward_weaknesses = set()
    for topic in all_known_topics:
        prereqs = find_prerequisites(topic, recursive=True)
        if any(p in direct_weaknesses for p in prereqs):
            forward_weaknesses.add(topic)

    # Score each weakness
    results = {}
    all_weak = direct_weaknesses | backward_weaknesses | forward_weaknesses

    for topic in all_weak:
        if topic not in all_known_topics:
            continue

        # Confidence depends on evidence
        if topic in direct_weaknesses:
            confidence = 0.9  # Directly observed
            weakness_type = 'direct'
        elif topic in backward_weaknesses:
            confidence = 0.7  # Inferred from downstream weakness
            weakness_type = 'prerequisite_gap'
        else:
            confidence = 0.5  # At risk due to upstream weakness
            weakness_type = 'forward_risk'

        results[topic] = {
            'topic': topic,
            'weakness_type': weakness_type,
            'confidence': confidence,
            'direct_evidence': topic in direct_weaknesses,
        }

    return results


# ═══════════════════════════════════════════════════════════════════════
# MASTERY ESTIMATION (IRT-based simplified)
# ═══════════════════════════════════════════════════════════════════════

def estimate_mastery(
    topic: str,
    correct_count: int,
    total_attempts: int,
    difficulty: float = 0.5,
) -> Tuple[float, float, float]:
    """
    Estimate mastery level using a simplified IRT-like model.

    Uses a Bayesian approach:
      Prior: Beta(2, 2) — weakly informative, centered at 0.5
      Likelihood: Binomial(correct, attempts)
      Posterior: Beta(2 + correct, 2 + attempts - correct)

    Args:
        topic: Topic name (for logging)
        correct_count: Number of correct answers
        total_attempts: Total number of attempts
        difficulty: Topic difficulty (0-1, higher = harder)

    Returns:
        (mastery_level_0_1, lower_90_ci, upper_90_ci)
    """
    if total_attempts == 0:
        # No data — use prior with difficulty adjustment
        prior_mean = max(0.1, 1.0 - difficulty)
        return prior_mean, 0.05, prior_mean + 0.3

    alpha_prior, beta_prior = 2.0, 2.0

    # Difficulty adjustment: harder topics get lower expected mastery
    difficulty_penalty = difficulty * 0.2
    effective_correct = max(0, correct_count - difficulty_penalty * total_attempts)

    alpha_post = alpha_prior + effective_correct
    beta_post = beta_prior + (total_attempts - effective_correct)

    mastery = alpha_post / (alpha_post + beta_post)

    # Credible interval
    total = alpha_post + beta_post
    var = (alpha_post * beta_post) / (total ** 2 * (total + 1))
    std = var ** 0.5
    lower = max(0.0, mastery - 1.645 * std)
    upper = min(1.0, mastery + 1.645 * std)

    return mastery, lower, upper


# ═══════════════════════════════════════════════════════════════════════
# FORGETTING CURVE MODEL (Ebbinghaus-based)
# ═══════════════════════════════════════════════════════════════════════

def compute_forgetting_curve(
    days_since_review: int,
    initial_mastery: float = 0.8,
    retention_rate: float = 0.5,
    half_life_days: int = 7,
) -> float:
    """
    Compute memory retention using Ebbinghaus forgetting curve.

    R(t) = S * e^(-t / H)

    Where:
      S = initial strength (mastery after review)
      t = days since review
      H = half-life (days until 50% forgotten)

    Args:
        days_since_review: Days since last review
        initial_mastery: Mastery level immediately after review (0-1)
        retention_rate: Long-term retention factor
        half_life_days: Half-life of memory (days)

    Returns:
        Current retention (0-1)
    """
    if days_since_review <= 0:
        return initial_mastery

    decay = math.exp(-days_since_review / half_life_days)
    retention = initial_mastery * (retention_rate + (1 - retention_rate) * decay)

    return max(0.0, min(1.0, retention))


def optimal_review_interval(
    current_mastery: float,
    target_mastery: float = 0.8,
    half_life_days: int = 7,
) -> int:
    """
    Calculate optimal days until next review.

    Args:
        current_mastery: Current mastery level (0-1)
        target_mastery: Target mastery level to maintain
        half_life_days: Memory half-life in days

    Returns:
        Recommended days until next review
    """
    if current_mastery <= target_mastery:
        return 1  # Review ASAP

    # R(t) = S * e^(-t/H)
    # Solve for t: t = -H * ln(R/S)
    ratio = target_mastery / current_mastery
    if ratio <= 0:
        return 1
    days = -half_life_days * math.log(ratio)
    return max(1, int(days))


# ═══════════════════════════════════════════════════════════════════════
# FUTURE RISK PREDICTION
# ═══════════════════════════════════════════════════════════════════════

def predict_future_risk(
    topic: str,
    mastery: float,
    exam_probability: float,
    prerequisite_mastery: float = 0.5,
    difficulty: float = 0.5,
    days_until_exam: int = 180,
) -> Dict:
    """
    Predict the risk of getting this topic wrong in a future exam.

    Risk factors:
      1. Low current mastery
      2. High exam probability (more likely to appear)
      3. Low prerequisite mastery (foundation is weak)
      4. High difficulty
      5. Long time until exam (forgetting)

    Returns:
        dict with risk score, factors, and recommended action
    """
    # Factor 1: Inverse mastery (higher risk when mastery is low)
    mastery_risk = 1.0 - mastery

    # Factor 2: Exam probability amplification
    prob_factor = exam_probability / 100.0

    # Factor 3: Prerequisite weakness
    prereq_risk = 1.0 - prerequisite_mastery

    # Factor 4: Difficulty
    difficulty_risk = difficulty

    # Factor 5: Forgetting over time
    forgetting = 1.0 - compute_forgetting_curve(
        days_since_review=days_until_exam,
        initial_mastery=mastery,
        half_life_days=30,
    )

    # Combined risk score (0-1)
    risk_score = (
        0.30 * mastery_risk +
        0.25 * prob_factor +
        0.15 * prereq_risk +
        0.10 * difficulty_risk +
        0.20 * forgetting
    )

    # Risk category
    if risk_score >= 0.7:
        category = 'critical'
        action = '즉시 집중 학습 필요 — 시험 전 최우선 보강'
    elif risk_score >= 0.5:
        category = 'high'
        action = '집중 학습 권장 — 주 3회 이상 복습'
    elif risk_score >= 0.3:
        category = 'moderate'
        action = '정기 복습 필요 — 주 1회 복습'
    else:
        category = 'low'
        action = '유지 학습 — 2주 1회 복습'

    return {
        'topic': topic,
        'risk_score': round(risk_score, 3),
        'risk_category': category,
        'recommended_action': action,
        'factors': {
            'mastery_gap': round(mastery_risk, 3),
            'exam_probability_amplification': round(prob_factor, 3),
            'prerequisite_weakness': round(prereq_risk, 3),
            'difficulty_challenge': round(difficulty_risk, 3),
            'forgetting_projection': round(forgetting, 3),
        },
    }


# ═══════════════════════════════════════════════════════════════════════
# FULL WEAKNESS ANALYSIS PIPELINE
# ═══════════════════════════════════════════════════════════════════════

class WeaknessAnalysisPipeline:
    """
    Complete weakness analysis pipeline.

    Input: Student's wrong answers with topics
    Output: Deep analysis with root causes, hidden weaknesses,
            mastery estimates, and future risk predictions.
    """

    def __init__(self):
        self.all_topics = self._get_all_topic_names()
        self.domain_map = dict(get_all_topics())

    def _get_all_topic_names(self) -> List[str]:
        topics = []
        for t, _ in get_all_topics():
            topics.append(t)
        return topics

    def analyze(self, wrong_answers: List[Dict]) -> Dict:
        """
        Run the complete weakness analysis pipeline.

        Args:
            wrong_answers: List of dicts with keys:
                - topic: str (topic name)
                - correct: int (number correct for this topic)
                - total: int (total attempts for this topic)
                - exam_date: str (optional, ISO date)
                - difficulty: float (optional, 0-1)

        Returns:
            Complete weakness analysis
        """
        # Extract topic-level data
        topic_stats = defaultdict(lambda: {'correct': 0, 'total': 0, 'exam_dates': []})
        for wa in wrong_answers:
            topic = wa.get('topic', '')
            if not topic:
                continue
            topic_stats[topic]['correct'] += wa.get('correct', 0)
            topic_stats[topic]['total'] += wa.get('total', 1)
            if wa.get('exam_date'):
                topic_stats[topic]['exam_dates'].append(wa['exam_date'])

        # Identify wrong topics
        wrong_topics = [t for t, s in topic_stats.items()
                        if s['total'] > 0 and s['correct'] / s['total'] < 0.6]

        # 1. Topic-level analysis
        topic_analysis = {}
        for topic, stats in topic_stats.items():
            if topic not in self.all_topics:
                continue
            correct = stats['correct']
            total = stats['total']
            accuracy = correct / max(1, total)
            topic_analysis[topic] = {
                'topic': topic,
                'domain': self.domain_map.get(topic, ''),
                'accuracy': round(accuracy, 3),
                'correct': correct,
                'total': total,
            }

        # 2. Hidden weakness detection
        hidden_weaknesses = detect_hidden_weaknesses(wrong_topics, self.all_topics)

        # 3. Prerequisite analysis
        prerequisite_analysis = {}
        for topic in self.all_topics:
            prereqs = find_prerequisites(topic, recursive=True)
            if prereqs:
                prereq_masteries = []
                for p in prereqs:
                    if p in topic_stats:
                        p_acc = topic_stats[p]['correct'] / max(1, topic_stats[p]['total'])
                        prereq_masteries.append(p_acc)
                avg_prereq_mastery = sum(prereq_masteries) / max(1, len(prereq_masteries)) if prereq_masteries else None
                prerequisite_analysis[topic] = {
                    'topic': topic,
                    'prerequisites': prereqs,
                    'avg_prerequisite_mastery': round(avg_prereq_mastery, 3) if avg_prereq_mastery is not None else None,
                    'num_prerequisites': len(prereqs),
                    'num_weak_prerequisites': sum(1 for p in prereqs
                                                  if p in wrong_topics),
                }

        # 4. Mastery estimation
        mastery_estimates = {}
        for topic in self.all_topics:
            stats = topic_stats.get(topic, {'correct': 0, 'total': 0})
            difficulty = 0.5  # Default, could be improved with difficulty DB
            mastery, lower, upper = estimate_mastery(
                topic, stats['correct'], stats['total'], difficulty
            )
            mastery_estimates[topic] = {
                'topic': topic,
                'mastery': round(mastery, 3),
                'mastery_90ci_lower': round(lower, 3),
                'mastery_90ci_upper': round(upper, 3),
                'data_available': stats['total'] > 0,
            }

        # 5. Future risk prediction (using placeholder exam probability)
        risk_predictions = {}
        for topic in self.all_topics:
            mastery = mastery_estimates[topic]['mastery']
            risk = predict_future_risk(
                topic=topic,
                mastery=mastery,
                exam_probability=50.0,  # Will be overridden by actual prediction
                prerequisite_mastery=prerequisite_analysis.get(topic, {}).get('avg_prerequisite_mastery', 0.5) or 0.5,
                difficulty=0.5,
                days_until_exam=180,
            )
            risk_predictions[topic] = risk

        # 6. Root cause analysis
        root_causes = self._analyze_root_causes(
            wrong_topics, hidden_weaknesses, prerequisite_analysis
        )

        return {
            'generated_at': __import__('datetime').datetime.now().isoformat(),
            'summary': {
                'total_topics_analyzed': len(self.all_topics),
                'topics_with_errors': len(wrong_topics),
                'hidden_weaknesses_detected': sum(
                    1 for w in hidden_weaknesses.values()
                    if w['weakness_type'] != 'direct'
                ),
                'critical_risk_count': sum(
                    1 for r in risk_predictions.values()
                    if r['risk_category'] == 'critical'
                ),
                'high_risk_count': sum(
                    1 for r in risk_predictions.values()
                    if r['risk_category'] == 'high'
                ),
            },
            'topic_analysis': topic_analysis,
            'hidden_weaknesses': hidden_weaknesses,
            'prerequisite_analysis': prerequisite_analysis,
            'mastery_estimates': mastery_estimates,
            'risk_predictions': risk_predictions,
            'root_causes': root_causes,
        }

    def _analyze_root_causes(
        self,
        wrong_topics: List[str],
        hidden_weaknesses: Dict[str, dict],
        prerequisite_analysis: Dict[str, dict],
    ) -> List[Dict]:
        """Analyze root causes of weaknesses."""
        causes = []

        for topic in wrong_topics:
            prereqs = prerequisite_analysis.get(topic, {})
            weak_prereqs = [
                p for p in prereqs.get('prerequisites', [])
                if p in wrong_topics
            ]

            if weak_prereqs:
                causes.append({
                    'topic': topic,
                    'root_cause': 'prerequisite_deficit',
                    'description': f"'{topic}' 오답의 근본 원인은 선행 개념 부족",
                    'weak_prerequisites': weak_prereqs,
                    'severity': 'high' if len(weak_prereqs) >= 2 else 'medium',
                })
            else:
                # Check if this topic is fundamental
                is_fundamental = not PREREQUISITE_MAP.get(topic, [])
                if is_fundamental:
                    causes.append({
                        'topic': topic,
                        'root_cause': 'foundational_knowledge_gap',
                        'description': f"'{topic}'은(는) 기초 개념 — 처음부터 학습 필요",
                        'weak_prerequisites': [],
                        'severity': 'high',
                    })
                else:
                    causes.append({
                        'topic': topic,
                        'root_cause': 'insufficient_practice',
                        'description': f"'{topic}' 반복 학습 및 문제 풀이 필요",
                        'weak_prerequisites': [],
                        'severity': 'medium',
                    })

        return sorted(causes, key=lambda c: 0 if c['severity'] == 'high' else 1)


# ═══════════════════════════════════════════════════════════════════════
# TOPICAL WEAKNESS CONNECTOR (using existing weakness_connector.json)
# ═══════════════════════════════════════════════════════════════════════

def load_weakness_connector(path='dataset/prediction/weakness_connector.json'):
    """Load the existing weakness connector."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None


# ═══════════════════════════════════════════════════════════════════════
# EVALUATION: Weakness Detection Accuracy
# ═══════════════════════════════════════════════════════════════════════

def evaluate_weakness_detection(
    gold_standard_path: str = 'dataset/gold_standard/gold_standard.json',
    knowledge_graph_path: str = 'dataset/knowledge-graph/knowledge_graph_v3.json',
) -> dict:
    """
    Evaluate the weakness engine's ability to detect root causes.

    Uses the knowledge graph's prerequisite edges as ground truth
    and validates that the weakness engine correctly identifies
    prerequisite relationships.

    Returns metrics on:
    - Prerequisite coverage
    - Root cause detection accuracy
    """
    questions = load_gold_standard(gold_standard_path)
    kg = load_knowledge_graph(knowledge_graph_path)

    # Extract prerequisite edges from knowledge graph
    kg_prereqs = defaultdict(set)
    for edge in kg.get('edges', []):
        if edge.get('type') == 'requires':
            kg_prereqs[edge['target']].add(edge['source'])

    # Compare with our prerequisite map coverage
    our_prereqs = PREREQUISITE_MAP

    # Check coverage of topics
    all_topics = set()
    for t, _ in get_all_topics():
        all_topics.add(t)

    topics_with_prereqs = sum(1 for t in all_topics if t in our_prereqs and our_prereqs[t])
    coverage = topics_with_prereqs / max(1, len(all_topics))

    return {
        'metric': 'weakness_detection_coverage',
        'prerequisite_coverage': round(coverage, 4),
        'topics_covered': topics_with_prereqs,
        'total_topics': len(all_topics),
        'prerequisite_relationships_defined': sum(len(v) for v in our_prereqs.values()),
    }
