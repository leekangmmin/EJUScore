"""
EJU Intelligence Engine v3 — Topic Clustering Module
=====================================================
Groups semantically similar topics into families for cluster-level prediction.

Clusters:
  Revolution_Cluster: 시민혁명, 산업혁명·자본주의, 제국주의·식민지
  Macroeconomics_Cluster: GDP·국민소득, 경제성장·경기변동, 고용·노동, 소득분배·지니계수
  Market_Cluster: 수요·공급과 시장균형, 금융·통화정책, 재정·조세정책
  International_Cluster: 국제무역, 환율·국제수지, 국제정치·국제기구, 안전보장·방위
  War_Peace_Cluster: 세계대전, 냉전, 전후세계질서, 세계화·지역통합
  Governance_Cluster: 헌법·기본권, 통치기구, 선거·정당, 지방자치, 사법·재판
  Political_Ideology_Cluster: 정치사상, 시민혁명, 민족주의
  Physical_Geo_Cluster: 기후·케펜구분, 지형·판구조, 환경·생태
  Human_Geo_Cluster: 인구·도시화, 자원·농업, 산업·교통
  Social_Issues_Cluster: 환경문제, 사회보장·복지, 저출산·고령화, 정보화사회, 젠더·평등, 다문화사회
  Japanese_Cluster: 일본경제사, 일본근대사
  Economic_History_Cluster: 대공황, 러시아혁명·소련
"""

import json
from collections import defaultdict
from typing import Dict, List, Tuple, Optional
import math

# ═══════════════════════════════════════════════════════════════════════
# TOPIC CLUSTER DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════

TOPIC_CLUSTERS = {
    "Revolution_Cluster": {
        "label": "혁명·변혁",
        "topics": ["시민혁명", "산업혁명·자본주의", "제국주의·식민지"],
        "domain": "history",
        "semantic_family": "transformational_change",
    },
    "Macroeconomics_Cluster": {
        "label": "거시경제",
        "topics": ["GDP·국민소득", "경제성장·경기변동", "고용·노동", "소득분배·지니계수", "일본경제사"],
        "domain": "economy",
        "semantic_family": "macro_economics",
    },
    "Market_Cluster": {
        "label": "시장·정책",
        "topics": ["수요·공급과 시장균형", "금융·통화정책", "재정·조세정책"],
        "domain": "economy",
        "semantic_family": "market_policy",
    },
    "International_Cluster": {
        "label": "국제·교류",
        "topics": ["국제무역", "환율·국제수지", "국제정치·국제기구", "안전보장·방위"],
        "domain": "economy",
        "semantic_family": "international_relations",
    },
    "War_Peace_Cluster": {
        "label": "전쟁·평화",
        "topics": ["세계대전", "냉전", "전후세계질서", "세계화·지역통합"],
        "domain": "history",
        "semantic_family": "conflict_cooperation",
    },
    "Governance_Cluster": {
        "label": "통치·제도",
        "topics": ["헌법·기본권", "통치기구", "선거·정당", "지방자치", "사법·재판"],
        "domain": "politics",
        "semantic_family": "governance_institutions",
    },
    "Political_Ideology_Cluster": {
        "label": "정치사상",
        "topics": ["정치사상"],
        "domain": "politics",
        "semantic_family": "political_thought",
    },
    "Physical_Geo_Cluster": {
        "label": "자연지리",
        "topics": ["기후·케펜구분", "지형·판구조", "환경·생태"],
        "domain": "geography",
        "semantic_family": "physical_geography",
    },
    "Human_Geo_Cluster": {
        "label": "인문지리",
        "topics": ["인구·도시화", "자원·농업", "산업·교통", "지도·GIS"],
        "domain": "geography",
        "semantic_family": "human_geography",
    },
    "Social_Issues_Cluster": {
        "label": "사회이슈",
        "topics": ["환경문제", "사회보장·복지", "저출산·고령화", "정보화사회", "젠더·평등", "다문화사회"],
        "domain": "society",
        "semantic_family": "social_issues",
    },
    "Japanese_Cluster": {
        "label": "일본사·경제",
        "topics": ["일본경제사", "일본근대사"],
        "domain": "history",
        "semantic_family": "japanese_affairs",
    },
    "Economic_History_Cluster": {
        "label": "경제사",
        "topics": ["대공황", "러시아혁명·소련"],
        "domain": "history",
        "semantic_family": "economic_history",
    },
}

# Build reverse mapping: topic -> cluster_name
TOPIC_TO_CLUSTER = {}
for cluster_name, cluster_info in TOPIC_CLUSTERS.items():
    for topic in cluster_info["topics"]:
        TOPIC_TO_CLUSTER[topic] = cluster_name

# Inter-cluster similarity (how related clusters are to each other)
# Used for cluster-level propagation
CLUSTER_SIMILARITY = {
    ("Revolution_Cluster", "War_Peace_Cluster"): 0.8,
    ("Revolution_Cluster", "Political_Ideology_Cluster"): 0.6,
    ("Revolution_Cluster", "Japanese_Cluster"): 0.5,
    ("Macroeconomics_Cluster", "Market_Cluster"): 0.9,
    ("Macroeconomics_Cluster", "International_Cluster"): 0.7,
    ("Macroeconomics_Cluster", "Economic_History_Cluster"): 0.6,
    ("Market_Cluster", "International_Cluster"): 0.7,
    ("War_Peace_Cluster", "International_Cluster"): 0.7,
    ("War_Peace_Cluster", "Japanese_Cluster"): 0.5,
    ("Governance_Cluster", "Political_Ideology_Cluster"): 0.8,
    ("Governance_Cluster", "Revolution_Cluster"): 0.5,
    ("Physical_Geo_Cluster", "Human_Geo_Cluster"): 0.8,
    ("Physical_Geo_Cluster", "Social_Issues_Cluster"): 0.5,
    ("Human_Geo_Cluster", "Social_Issues_Cluster"): 0.6,
    ("Social_Issues_Cluster", "Macroeconomics_Cluster"): 0.4,
    ("Japanese_Cluster", "Macroeconomics_Cluster"): 0.6,
    ("Economic_History_Cluster", "Macroeconomics_Cluster"): 0.7,
}


def get_cluster_for_topic(topic: str) -> Optional[str]:
    """Get the cluster name for a specific topic."""
    return TOPIC_TO_CLUSTER.get(topic)


def get_cluster_topics(cluster_name: str) -> List[str]:
    """Get all topics in a cluster."""
    info = TOPIC_CLUSTERS.get(cluster_name)
    if info:
        return info["topics"]
    return []


def get_cluster_label(cluster_name: str) -> str:
    """Get the human-readable label for a cluster."""
    info = TOPIC_CLUSTERS.get(cluster_name)
    if info:
        return info["label"]
    return cluster_name


# ═══════════════════════════════════════════════════════════════════════
# CLUSTER PREDICTION
# ═══════════════════════════════════════════════════════════════════════

class TopicClusterPredictor:
    """
    Makes predictions at both topic and cluster levels,
    then combines them for the final prediction.
    """

    def __init__(self):
        self.topic_year_matrix = {}  # topic -> year -> count
        self.cluster_year_matrix = {}  # cluster -> year -> count
        self.cluster_frequencies = defaultdict(lambda: defaultdict(int))
        self.topic_frequencies = defaultdict(lambda: defaultdict(int))

    def build_from_data(self, questions: List[dict]):
        """Build topic and cluster frequency matrices from gold standard questions."""
        for q in questions:
            topic = q.get("topic", "").strip()
            year = q.get("year")
            if not topic or not year:
                continue
            year = int(year)
            self.topic_frequencies[topic][year] += 1

        # Build cluster frequencies
        self.cluster_frequencies = defaultdict(lambda: defaultdict(int))
        for topic, yearly in self.topic_frequencies.items():
            cluster = get_cluster_for_topic(topic)
            if cluster:
                for year, count in yearly.items():
                    self.cluster_frequencies[cluster][year] += count

        self.topic_year_matrix = {k: dict(v) for k, v in self.topic_frequencies.items()}
        self.cluster_year_matrix = {k: dict(v) for k, v in self.cluster_frequencies.items()}

    def predict_cluster_probability(
        self, cluster_name: str, target_year: int = 2026
    ) -> float:
        """
        Predict the probability of a cluster appearing in the target year.
        Uses recency-weighted frequency at the cluster level.
        """
        yearly = self.cluster_year_matrix.get(cluster_name, {})
        if not yearly:
            return 0.3  # Low default for unknown clusters

        decay_constant = math.log(2) / 3.0  # half-life = 3 years
        total_weighted = 0.0
        total_weight = 0.0

        years_range = range(2002, target_year)
        for year in years_range:
            count = yearly.get(year, 0)
            years_ago = target_year - year
            weight = math.exp(-decay_constant * years_ago)
            total_weighted += count * weight
            total_weight += weight

        if total_weight == 0:
            return 0.3

        # Normalize: clusters typically have 5-20 questions per year
        max_expected = 15.0
        normalized = min(1.0, (total_weighted / total_weight) / max_expected)
        return max(0.05, normalized)

    def compute_cluster_confidence(self, cluster_name: str) -> float:
        """Compute confidence in cluster prediction based on data density."""
        yearly = self.cluster_year_matrix.get(cluster_name, {})
        active_years = sum(1 for y, c in yearly.items() if c > 0)
        total_years = 24
        density = active_years / max(1, total_years)
        return min(1.0, 0.3 + 0.7 * density)

    def combine_topic_cluster_scores(
        self,
        topic_score: float,
        cluster_score: float,
        topic_confidence: float,
        cluster_confidence: float,
        alpha: float = 0.3,  # weight for cluster-level signal
    ) -> float:
        """
        Combine topic-level and cluster-level predictions.

        When topic confidence is low (sparse data), rely more on cluster.
        When topic confidence is high (dense data), rely more on topic.
        """
        # Adaptive weighting based on relative confidence
        total_conf = topic_confidence + cluster_confidence
        if total_conf == 0:
            return (topic_score + cluster_score) / 2.0

        topic_weight = topic_confidence / total_conf
        cluster_weight = cluster_confidence / total_conf

        # Minimum cluster influence
        cluster_weight = max(cluster_weight, alpha * 0.5)
        topic_weight = 1.0 - cluster_weight

        combined = topic_weight * topic_score + cluster_weight * cluster_score
        return min(1.0, max(0.0, combined))

    def predict_all(
        self, all_topics: List[Tuple[str, str]], target_year: int = 2026
    ) -> Dict[str, dict]:
        """
        Predict all topics with cluster enhancement.

        Args:
            all_topics: List of (topic_name, domain) tuples
            target_year: Year to predict for

        Returns:
            Dict mapping topic_name -> {
                'topic_probability': float,
                'cluster_probability': float,
                'combined_probability': float,
                'cluster_name': str,
                'cluster_label': str,
            }
        """
        results = {}

        # Pre-compute cluster probabilities
        cluster_probs = {}
        cluster_confs = {}
        for cluster_name in TOPIC_CLUSTERS:
            cluster_probs[cluster_name] = self.predict_cluster_probability(
                cluster_name, target_year
            )
            cluster_confs[cluster_name] = self.compute_cluster_confidence(cluster_name)

        for topic, domain in all_topics:
            cluster_name = get_cluster_for_topic(topic)

            # Topic-level probability (from recency-weighted frequency)
            yearly = self.topic_year_matrix.get(topic, {})
            if yearly:
                decay_constant = math.log(2) / 3.0
                total_weighted = 0.0
                total_weight = 0.0
                for year in range(2002, target_year):
                    count = yearly.get(year, 0)
                    weight = math.exp(-decay_constant * (target_year - year))
                    total_weighted += count * weight
                    total_weight += weight
                topic_prob = (
                    min(1.0, (total_weighted / total_weight) / 5.0)
                    if total_weight > 0
                    else 0.1
                )
                topic_conf = min(1.0, sum(1 for y, c in yearly.items() if c > 0) / 10.0)
            else:
                topic_prob = 0.1
                topic_conf = 0.1

            cluster_prob = cluster_probs.get(cluster_name, 0.3) if cluster_name else 0.0
            cluster_conf = cluster_confs.get(cluster_name, 0.3) if cluster_name else 0.0

            if cluster_name:
                combined = self.combine_topic_cluster_scores(
                    topic_prob, cluster_prob, topic_conf, cluster_conf
                )
            else:
                combined = topic_prob

            results[topic] = {
                "topic_probability": round(topic_prob, 4),
                "cluster_probability": round(cluster_prob, 4),
                "combined_probability": round(combined, 4),
                "cluster_name": cluster_name if cluster_name else "",
                "cluster_label": get_cluster_label(cluster_name) if cluster_name else "",
            }

        return results

    def get_cluster_recommendations(self, target_year: int = 2026) -> List[Dict]:
        """
        Get cluster-level recommendations (which clusters to focus on).
        """
        clusters = []
        for cluster_name, info in TOPIC_CLUSTERS.items():
            prob = self.predict_cluster_probability(cluster_name, target_year)
            conf = self.compute_cluster_confidence(cluster_name)
            clusters.append({
                "cluster_name": cluster_name,
                "label": info["label"],
                "domain": info["domain"],
                "probability": round(prob, 4),
                "confidence": round(conf, 4),
                "num_topics": len(info["topics"]),
                "topics": info["topics"],
            })

        clusters.sort(key=lambda x: x["probability"], reverse=True)
        return clusters


# ═══════════════════════════════════════════════════════════════════════
# SIMILARITY-BASED PROPAGATION
# ═══════════════════════════════════════════════════════════════════════

def propagate_through_clusters(
    topic_scores: Dict[str, float],
    decay_factor: float = 0.5,
    max_hops: int = 2,
) -> Dict[str, float]:
    """
    Propagate probability scores through cluster similarity.

    When a topic has high probability, boost similar topics in the same
    or related clusters.

    Args:
        topic_scores: Dict mapping topic -> probability score (0-1)
        decay_factor: How much probability decays per hop
        max_hops: Maximum propagation distance

    Returns:
        Updated topic scores after propagation
    """
    result = dict(topic_scores)

    for topic, score in topic_scores.items():
        if score < 0.3:
            continue  # Only propagate strong signals

        cluster = get_cluster_for_topic(topic)
        if not cluster:
            continue

        # Hop 1: Same cluster topics
        same_cluster_topics = get_cluster_topics(cluster)
        for other in same_cluster_topics:
            if other != topic and other in result:
                boost = score * 0.3 * decay_factor
                result[other] = min(1.0, result[other] + boost)

        if max_hops < 2:
            continue

        # Hop 2: Similar clusters
        for (c1, c2), similarity in CLUSTER_SIMILARITY.items():
            other_cluster = None
            if c1 == cluster:
                other_cluster = c2
            elif c2 == cluster:
                other_cluster = c1
            else:
                continue

            if other_cluster:
                for other_topic in get_cluster_topics(other_cluster):
                    if other_topic in result:
                        boost = score * 0.2 * similarity * decay_factor
                        result[other_topic] = min(1.0, result[other_topic] + boost)

    return result
