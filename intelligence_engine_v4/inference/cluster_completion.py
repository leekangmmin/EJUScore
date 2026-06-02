"""
Cluster Completion Algorithm
=============================
After topic-level prediction, applies cluster-level completion.

If a cluster has high activation probability:
  - Include ALL topics in that cluster at reduced probability.

V4 Architecture mandates:
  - Cluster completion boosts sparse topics within active clusters
  - These boosted topics should genuinely appear in the final selection
  - If a cluster probability >= 0.30, ALL topics in that cluster get
    a minimum probability floor = cluster_prob * multiplier

V4 Correction History:
  - Bug 4 (FP Flood): Multiplier=0.85 caused 30+ predictions/year.
    Fixed: multiplier→0.40, min_confidence→0.50, added history filter.
  - Bug 5 (Cross-propagation noise): Cross-cluster propagation amplified
    noise from similar clusters. Fixed: disabled by default.
"""

import numpy as np
from typing import Dict, List, Optional, Set, Tuple

from intelligence_engine_v4.config import (
    CLUSTER_PROB_MULTIPLIER, CLUSTER_MIN_CONFIDENCE,
    CLUSTER_MIN_HISTORY_COUNT,
)
from intelligence_engine_v4.data import (
    TRAIN_TOPICS, TOPIC_TO_IDX, IDX_TO_TOPIC,
    TOPIC_TO_CLUSTER, CLUSTER_TO_TOPICS, TOPIC_CLUSTERS,
    PREREQUISITE_MAP,
)


# Inter-cluster similarity matrix
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


def _build_topic_history_count(year_matrix: dict, target_year: int) -> Dict[str, int]:
    """
    Build a dict mapping topic -> number of years it appeared before target_year.
    """
    history = {}
    for topic in TRAIN_TOPICS:
        yearly = year_matrix.get(topic, {})
        count = sum(1 for y, c in yearly.items() if c > 0 and y < target_year)
        history[topic] = count
    return history


def apply_cluster_completion(
    topic_probs: np.ndarray,
    cluster_probs: np.ndarray,
    cluster_names: Optional[List[str]] = None,
    multiplier: float = CLUSTER_PROB_MULTIPLIER,
    min_confidence: float = CLUSTER_MIN_CONFIDENCE,
    enable_cross_propagation: bool = False,
    year_matrix: Optional[dict] = None,
    target_year: Optional[int] = None,
    min_history_count: int = CLUSTER_MIN_HISTORY_COUNT,
) -> np.ndarray:
    """
    Apply cluster-level completion to topic probabilities.

    For each cluster with probability >= min_confidence:
      - Topics in that cluster with >= min_history_count appearances
        get at least cluster_prob * multiplier probability boost.

    Args:
        topic_probs: (N_TOPICS,) topic probabilities
        cluster_probs: (N_CLUSTERS,) cluster probabilities
        cluster_names: list of cluster names matching cluster_probs order
        multiplier: reduced prob multiplier for non-primary topics
        min_confidence: minimum cluster prob to activate
        enable_cross_propagation: propagate between similar clusters (default: False)
        year_matrix: topic-year matrix for history filtering
        target_year: target year for history filtering
        min_history_count: minimum historical appearances to qualify for boost

    Returns:
        Updated topic probabilities (N_TOPICS,)
    """
    updated = topic_probs.copy()

    if cluster_names is None:
        cluster_names = list(TOPIC_CLUSTERS.keys())

    # Build history filter if year_matrix provided
    topic_history = None
    if year_matrix is not None and target_year is not None:
        topic_history = _build_topic_history_count(year_matrix, target_year)

    # Stage 1: Direct cluster completion (with history filter)
    for ci, cname in enumerate(cluster_names):
        if ci >= len(cluster_probs):
            continue
        cluster_prob = cluster_probs[ci]
        if cluster_prob < min_confidence:
            continue

        topics_in_cluster = CLUSTER_TO_TOPICS.get(cname, [])
        for t in topics_in_cluster:
            idx = TOPIC_TO_IDX.get(t)
            if idx is not None and idx < len(updated):
                # History filter: skip topics that never appeared historically
                if topic_history is not None and topic_history.get(t, 0) < min_history_count:
                    continue
                floor = cluster_prob * multiplier
                if updated[idx] < floor:
                    updated[idx] = float(floor)

    # Stage 2: Cross-cluster propagation (disabled by default due to noise)
    if enable_cross_propagation:
        for ci, cname in enumerate(cluster_names):
            if ci >= len(cluster_probs):
                continue
            if cluster_probs[ci] < min_confidence:
                continue

            for (c1, c2), sim in CLUSTER_SIMILARITY.items():
                target_cluster = None
                if c1 == cname:
                    target_cluster = c2
                elif c2 == cname:
                    target_cluster = c1

                if target_cluster is None:
                    continue

                try:
                    tj = cluster_names.index(target_cluster)
                except ValueError:
                    continue

                boost = sim * cluster_probs[ci] * multiplier * 0.5
                if boost > min_confidence * multiplier:
                    topics_in_target = CLUSTER_TO_TOPICS.get(target_cluster, [])
                    for t in topics_in_target:
                        idx = TOPIC_TO_IDX.get(t)
                        if idx is not None and idx < len(updated) and updated[idx] < boost:
                            # Apply history filter to cross-propagation too
                            if topic_history is not None and topic_history.get(t, 0) < min_history_count:
                                continue
                            updated[idx] = float(boost)

    # Stage 3: Clamp
    updated = np.clip(updated, 0.0, 1.0)

    return updated


def apply_prerequisite_boost(
    topic_probs: np.ndarray,
    year_matrix: dict,
    target_year: int,
    boost_factor: float = 0.15,
) -> np.ndarray:
    """
    If a topic is predicted to appear, boost its prerequisites.

    E.g., if 세계대전 is predicted, increase prob of 제국주의·식민지.

    NOTE: PREREQUISITE_MAP must reference only topics present in TRAIN_TOPICS.
    The data module now remaps non-standard references (e.g., '경제학 기초' ->
    '수요·공급과 시장균형') so that this function actually applies boosts.
    """
    updated = topic_probs.copy()

    # Identify high-confidence topics (prob >= 0.5)
    high_conf_topics = []
    for i, prob in enumerate(topic_probs):
        if prob >= 0.5 and i in IDX_TO_TOPIC:
            high_conf_topics.append((i, IDX_TO_TOPIC[i], prob))

    for topic_idx, topic_name, topic_prob in high_conf_topics:
        prereqs = PREREQUISITE_MAP.get(topic_name, [])
        for prereq in prereqs:
            prereq_idx = TOPIC_TO_IDX.get(prereq)
            if prereq_idx is not None and prereq_idx < len(updated):
                # Boost proportional to the high-confidence topic's probability
                boost = topic_prob * boost_factor
                if updated[prereq_idx] < boost:
                    updated[prereq_idx] = min(1.0, float(boost))

    return updated


def select_topics_by_threshold(
    topic_probs: np.ndarray,
    threshold: float = 0.35,
    max_topics: int = 30,
    force_include: Optional[Set[int]] = None,
) -> np.ndarray:
    """
    Select topics above probability threshold, with optional forced includes.

    Args:
        topic_probs: (N_TOPICS,)
        threshold: Minimum probability
        max_topics: Maximum number to select
        force_include: Set of indices to always include (e.g., cluster-completed topics)

    Returns:
        Boolean mask (N_TOPICS,)
    """
    mask = topic_probs >= threshold

    # Force-include specified indices
    if force_include:
        for idx in force_include:
            if idx < len(mask):
                mask[idx] = True

    if mask.sum() > max_topics:
        indices = np.argsort(topic_probs)[::-1]
        mask[:] = False
        if force_include:
            for idx in force_include:
                if idx < len(mask):
                    mask[idx] = True
            # Fill remaining slots with highest-probability non-forced topics
            remaining = max_topics - len(force_include)
            if remaining > 0:
                non_forced = [i for i in indices if i not in force_include]
                for i in non_forced[:remaining]:
                    mask[i] = True
        else:
            mask[indices[:max_topics]] = True

    return mask
