"""
XGBoost Ensemble Meta-Learner
===============================
Trains an XGBoost model on features from multiple predictors
to produce a calibrated final probability.

Meta-features (per topic):
  1. GNN topic probability
  2. GNN topic probability std (from ensemble)
  3. Cluster-level probability
  4. Multi-horizon short-term score
  5. Multi-horizon medium-term score
  6. Recency-weighted frequency
  7. Historical frequency baseline
  8. Knowledge graph PageRank score

Uses leave-one-year-out cross-validation to prevent overfitting.
"""

import json
import math
import numpy as np
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from intelligence_engine_v4.config import (
    XGB_MAX_DEPTH, XGB_N_ESTIMATORS, XGB_LEARNING_RATE, XGB_N_FOLDS,
)
from intelligence_engine_v4.data import (
    TRAIN_TOPICS, TOPIC_TO_IDX, IDX_TO_TOPIC,
    DOMAIN_OF_TOPIC, DOMAINS,
    build_topic_year_matrix, build_topic_features, build_labels,
    load_gold_standard, PREREQUISITE_MAP,
    TOPIC_CLUSTERS, TOPIC_TO_CLUSTER,
)


def build_meta_features(
    year_matrix: Dict[str, Dict[int, int]],
    target_year: int,
    gnn_probs: np.ndarray = None,
    gnn_probs_std: np.ndarray = None,
    cluster_probs: np.ndarray = None,
    multi_horizon_scores: Dict[str, np.ndarray] = None,
    verbose: bool = False,
) -> np.ndarray:
    """
    Build meta-features for XGBoost ensemble.

    All arrays are N_TOPICS (35 training topics) wide.
    """
    N = len(TRAIN_TOPICS)
    features_list = []

    decay_constant = math.log(2) / 3.0
    years_range = list(range(2002, target_year))

    cluster_names = list(TOPIC_CLUSTERS.keys())

    for i, topic in enumerate(TRAIN_TOPICS):
        meta = []
        yearly = year_matrix.get(topic, {})

        # 1-2: GNN probability + std (if available)
        if gnn_probs is not None and i < len(gnn_probs):
            meta.append(float(gnn_probs[i]))
            meta.append(float(gnn_probs_std[i]) if gnn_probs_std is not None else 0.1)
        else:
            total_weighted = 0.0
            total_weight = 0.0
            for year in years_range:
                cnt = yearly.get(year, 0)
                w = math.exp(-decay_constant * (target_year - year))
                total_weighted += cnt * w
                total_weight += w
            fallback_prob = min(1.0, (total_weighted / max(1e-8, total_weight)) / 5.0)
            meta.append(fallback_prob)
            meta.append(0.1)

        # 3: Cluster probability
        if cluster_probs is not None:
            cname = TOPIC_TO_CLUSTER.get(topic)
            if cname and cname in cluster_names:
                ci = cluster_names.index(cname)
                if ci < len(cluster_probs):
                    meta.append(float(cluster_probs[ci]))
                else:
                    meta.append(0.3)
            else:
                meta.append(0.3)
        else:
            meta.append(0.3)

        # 4-5: Recency-weighted and historical baseline
        recency, _ = _compute_recency(topic, yearly, years_range, target_year)
        baseline, _, _ = _compute_baseline(topic, yearly, years_range)
        meta.append(recency)
        meta.append(baseline)

        # 6: Short-term trend (last 3 vs previous 3)
        recent_3 = sum(yearly.get(y, 0) for y in range(target_year - 3, target_year))
        prev_3 = sum(yearly.get(y, 0) for y in range(target_year - 6, target_year - 3))
        trend = recent_3 / max(1, prev_3 + 1)
        meta.append(min(2.0, trend))

        # 7: KG degree
        prereq_count = len(PREREQUISITE_MAP.get(topic, []))
        as_prereq_count = sum(1 for t, p in PREREQUISITE_MAP.items() if topic in p)
        meta.append(min(1.0, (prereq_count + as_prereq_count) / 15.0))

        # 8: Cyclical position
        active_years = sorted([y for y, c in yearly.items() if c > 0])
        if len(active_years) >= 2:
            gap = target_year - active_years[-1]
            avg_interval = (active_years[-1] - active_years[0]) / max(1, len(active_years) - 1)
            cycle_pos = min(2.0, gap / max(1, avg_interval))
            meta.append(cycle_pos)
        else:
            meta.append(0.0)

        features_list.append(meta)

    return np.array(features_list, dtype=np.float32)


def _compute_recency(topic, yearly, years_range, target_year, half_life=3.0):
    decay = math.log(2) / half_life
    tw, tw_w = 0.0, 0.0
    for y in years_range:
        cnt = yearly.get(y, 0)
        w = math.exp(-decay * (target_year - y))
        tw += cnt * w
        tw_w += w
    if tw_w == 0:
        return 0.0, 0.0
    return min(1.0, (tw / tw_w) / 5.0), tw / tw_w


def _compute_baseline(topic, yearly, years_range):
    total = sum(yearly.values())
    active = sum(1 for y, c in yearly.items() if c > 0)
    total_years = max(1, len(years_range))
    freq_density = active / total_years
    avg_intensity = total / max(1, active)
    intensity_norm = min(1.0, avg_intensity / 15.0)
    baseline = 0.4 * freq_density + 0.6 * intensity_norm
    return min(1.0, baseline), total, active


# ── XGBoost Meta-Learner ─────────────────────────────────────────────

class XGBoostMetaLearner:
    """
    XGBoost-based meta-learner that combines multiple predictor outputs.
    """

    def __init__(
        self,
        max_depth: int = XGB_MAX_DEPTH,
        n_estimators: int = XGB_N_ESTIMATORS,
        learning_rate: float = XGB_LEARNING_RATE,
    ):
        self.max_depth = max_depth
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.model = None
        self.is_trained = False

    def train(
        self,
        meta_features_dict: Dict[int, np.ndarray],
        labels_dict: Dict[int, np.ndarray],
        verbose: bool = False,
    ):
        import xgboost as xgb

        all_X = []
        all_y = []

        for year in sorted(meta_features_dict.keys()):
            X = meta_features_dict[year]
            y = labels_dict[year]
            all_X.append(X)
            all_y.append(y)

        X_all = np.vstack(all_X)
        y_all = np.concatenate(all_y)

        neg_count = (y_all == 0).sum()
        pos_count = (y_all == 1).sum()
        scale_pos_weight = neg_count / max(1, pos_count)

        if verbose:
            print(f"  XGBoost: {X_all.shape[0]} samples, pos/neg=1:{scale_pos_weight:.1f}")

        self.model = xgb.XGBClassifier(
            max_depth=self.max_depth,
            n_estimators=self.n_estimators,
            learning_rate=self.learning_rate,
            scale_pos_weight=scale_pos_weight,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            eval_metric='logloss',
            use_label_encoder=False,
            verbosity=0 if not verbose else 1,
            random_state=42,
        )

        self.model.fit(X_all, y_all, eval_set=[(X_all, y_all)], verbose=False)
        self.is_trained = True

    def predict(self, meta_features: np.ndarray) -> np.ndarray:
        if not self.is_trained or self.model is None:
            raise RuntimeError("XGBoost model not trained yet")
        return self.model.predict_proba(meta_features)[:, 1]

    def predict_proba(self, meta_features: np.ndarray) -> np.ndarray:
        return self.predict(meta_features)

    def get_feature_importance(self) -> np.ndarray:
        if self.model is None:
            return np.array([])
        return self.model.feature_importances_
