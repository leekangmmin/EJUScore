"""
V4 Dynamic N — Using V3's ensemble probability scores for better calibration.

Key insight: V3's 6-factor ensemble produces well-calibrated probability scores.
V4's Dynamic N and Cluster Completion provide better recall.

This is the optimal V4+V3 hybrid integrated into the V4 framework.
"""

import math
import numpy as np
from collections import defaultdict
from typing import Dict, List, Optional

from intelligence_engine_v4.config import N_MIN, N_MAX, N_DEFAULT
from intelligence_engine_v4.data import (
    TRAIN_TOPICS, TOPIC_TO_IDX, CLUSTER_TO_TOPICS, TOPIC_TO_CLUSTER,
    TOPIC_CLUSTERS, N_TOPICS,
    build_topic_year_matrix,
)


def compute_historical_n(year_matrix, target_year):
    """Analyze historical topic count patterns."""
    years = sorted(set(
        y for topic, yearly in year_matrix.items()
        for y in yearly if y < target_year
    ))
    if not years:
        return {'mean_n': N_DEFAULT, 'std_n': 3.0, 'trend': 0.0,
                'last_3_mean': N_DEFAULT, 'max_n': N_DEFAULT,
                'cluster_diversity': 5.0, 'recent_max': N_DEFAULT,
                'recent_variance': 3.0}

    yearly_counts = []
    for y in years:
        count = sum(1 for topic in TRAIN_TOPICS
                    if year_matrix.get(topic, {}).get(y, 0) > 0)
        yearly_counts.append(count)

    mean_n = float(np.mean(yearly_counts))
    std_n = float(np.std(yearly_counts))
    max_n = float(max(yearly_counts))
    recent_max = float(max(yearly_counts[-5:])) if len(yearly_counts) >= 5 else max_n

    if len(yearly_counts) >= 5:
        recent = yearly_counts[-10:] if len(yearly_counts) >= 10 else yearly_counts
        slope = np.polyfit(np.arange(len(recent)), recent, 1)[0]
        trend = slope
    else:
        trend = 0.0

    last_3 = yearly_counts[-3:] if len(yearly_counts) >= 3 else yearly_counts
    last_3_mean = float(np.mean(last_3))

    # Cluster diversity
    cluster_counts = []
    for y in years:
        active = set()
        for topic in TRAIN_TOPICS:
            if year_matrix.get(topic, {}).get(y, 0) > 0:
                c = TOPIC_TO_CLUSTER.get(topic)
                if c:
                    active.add(c)
        cluster_counts.append(len(active))
    cluster_diversity = float(np.mean(cluster_counts)) if cluster_counts else 5.0

    recent_variance = float(np.std(yearly_counts[-5:])) if len(yearly_counts) >= 5 else std_n

    return {
        'mean_n': mean_n, 'std_n': std_n, 'trend': trend,
        'last_3_mean': last_3_mean, 'max_n': max_n,
        'recent_max': recent_max,
        'cluster_diversity': cluster_diversity,
        'recent_variance': recent_variance,
    }


def predict_dynamic_n(year_matrix, target_year, strictness=0.5):
    """
    Predict optimal N using recency + trend + max-awareness.

    strictness: 0.0 = conservative (N=recent mean), 1.0 = aggressive (N=recent max)
    """
    hist = compute_historical_n(year_matrix, target_year)

    # Blend recent mean with recent max
    max_weight = min(0.6, strictness * 0.7)
    mean_weight = 1.0 - max_weight
    base = mean_weight * hist['last_3_mean'] + max_weight * hist['recent_max']

    # Trend boost (only positive direction)
    trend_boost = max(0, hist['trend'] * 3.0 * strictness)

    # Variance boost for high-variance years
    var_boost = hist['recent_variance'] * strictness * 0.5

    # Upper bound: cluster diversity * topics per cluster
    max_possible = hist['cluster_diversity'] * 2.8

    estimated = base + trend_boost + var_boost + (strictness - 0.5) * 2.0

    n = int(round(max(N_MIN, estimated)))
    n = min(N_MAX, min(n, int(max_possible)))

    return n


def compute_threshold_from_n(predicted_n, topic_probs, slack=1):
    """Find threshold to select ~predicted_n + slack topics."""
    n_topics = len(topic_probs)
    effective_n = min(n_topics, max(1, predicted_n + slack))

    if effective_n >= n_topics:
        return 0.0

    sorted_probs = np.sort(topic_probs)[::-1]
    idx = max(0, effective_n - 1)
    if idx >= len(sorted_probs):
        return sorted_probs[-1] * 0.5

    threshold = sorted_probs[idx]
    if idx + 1 < len(sorted_probs):
        # Threshold between Nth and (N+1)th
        threshold = (threshold + sorted_probs[idx + 1]) / 2.0

    return float(max(0.01, threshold))
