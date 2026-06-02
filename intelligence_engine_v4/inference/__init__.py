"""
V4 Inference Pipeline
=====================
Integrates all V4 components into a unified prediction pipeline.
"""

import json
import math
import numpy as np
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from intelligence_engine_v4.config import (
    THRESHOLD_DEFAULT, GNN_ENSEMBLE_SEEDS,
    TEST_YEARS, TARGET_YEARS,
)
from intelligence_engine_v4.data import (
    TRAIN_TOPICS, TOPIC_TO_IDX, IDX_TO_TOPIC,
    TOPIC_TO_CLUSTER, CLUSTER_TO_TOPICS, TOPIC_CLUSTERS,
    DOMAIN_OF_TOPIC, DOMAINS, N_TOPICS, N_CLUSTERS,
    build_topic_year_matrix, build_topic_features,
    build_knowledge_graph_adjacency, build_labels,
    compute_ground_truth_count, load_gold_standard,
)
from intelligence_engine_v4.models.gnn_predictor import GraphEnhancedPredictor
from intelligence_engine_v4.models.dynamic_n import (
    predict_dynamic_n, compute_threshold_from_n,
)
from intelligence_engine_v4.inference.cluster_completion import (
    apply_cluster_completion, select_topics_by_threshold,
    apply_prerequisite_boost,
)

XGBOOST_AVAILABLE = False
try:
    from intelligence_engine_v4.models.xgboost_ensemble import (
        XGBoostMetaLearner, build_meta_features,
    )
    XGBOOST_AVAILABLE = True
except Exception:
    pass


class V4Predictor:
    """Complete V4 prediction pipeline."""

    def __init__(self, use_gnn=True, use_xgboost=False):
        self.use_gnn = use_gnn
        self.use_xgboost = use_xgboost and XGBOOST_AVAILABLE
        self.year_matrix = {}
        self.graph_predictor = None
        self.xgb_learner = None
        self.is_trained = False
        self.training_years = []

    def train(self, years=None, gold_standard_path=None, verbose=False):
        questions = load_gold_standard(gold_standard_path)
        self.year_matrix = build_topic_year_matrix(questions)
        if years is None:
            years = sorted(set(y for topic, yearly in self.year_matrix.items() for y in yearly))
        self.training_years = years
        if verbose:
            print(f"V4Predictor: {len(years)} years ({min(years)}-{max(years)}), {N_TOPICS} topics")

        if self.use_gnn:
            gep = GraphEnhancedPredictor()
            gep.load_data(self.year_matrix)
            self.graph_predictor = gep

        self.is_trained = True

    def predict(self, target_year=2026, strictness=0.5,
                use_cluster_completion=True, use_prerequisite_boost=True,
                graph_alpha=0.3, slack=2, verbose=False):
        if not self.year_matrix:
            raise RuntimeError("Predictor not trained.")

        # Step 1: Get base probabilities
        if self.graph_predictor is not None:
            gnn_out = self.graph_predictor.predict(target_year=target_year, alpha=graph_alpha)
            topic_probs = gnn_out['topic_probs'].copy()
            cluster_probs = gnn_out['cluster_probs'].copy()
        else:
            topic_probs = self._compute_fallback_probs(target_year)
            cluster_probs = self._compute_cluster_fallback(target_year)

        # Step 2: Dynamic N
        predicted_n = predict_dynamic_n(self.year_matrix, target_year, strictness)

        # Step 3: Cluster completion
        if use_cluster_completion:
            topic_probs = apply_cluster_completion(topic_probs, cluster_probs)

        # Step 4: Prerequisite boost
        if use_prerequisite_boost:
            topic_probs = apply_prerequisite_boost(topic_probs, self.year_matrix, target_year)

        # Step 5: Threshold (with slack for recall)
        threshold = compute_threshold_from_n(predicted_n, topic_probs, slack=slack)
        selected_mask = select_topics_by_threshold(topic_probs, threshold)

        # Build predictions
        predicted_topics = []
        for i in range(N_TOPICS):
            if selected_mask[i]:
                t = IDX_TO_TOPIC[i]
                predicted_topics.append({
                    'topic': t,
                    'domain': DOMAIN_OF_TOPIC.get(t, ''),
                    'probability': float(topic_probs[i]),
                    'cluster': TOPIC_TO_CLUSTER.get(t, ''),
                })
        predicted_topics.sort(key=lambda x: x['probability'], reverse=True)

        return {
            'target_year': target_year,
            'predicted_n': predicted_n,
            'threshold': float(threshold),
            'predictions': predicted_topics,
            'probabilities': topic_probs,
            'cluster_probs': cluster_probs,
            'gnn_available': self.use_gnn,
            'config': {'strictness': strictness, 'graph_alpha': graph_alpha, 'slack': slack},
        }

    def _compute_fallback_probs(self, target_year):
        probs = np.zeros(N_TOPICS, dtype=np.float32)
        decay = math.log(2) / 3.0
        yrs = list(range(2002, target_year))
        for i, topic in enumerate(TRAIN_TOPICS):
            yearly = self.year_matrix.get(topic, {})
            tw, ws = 0.0, 0.0
            for y in yrs:
                c = yearly.get(y, 0)
                w = math.exp(-decay * (target_year - y))
                tw += c * w
                ws += w
            probs[i] = min(1.0, (tw / max(1e-8, ws)) / 5.0) if ws > 0 else 0.05
        return probs

    def _compute_cluster_fallback(self, target_year):
        cn = list(TOPIC_CLUSTERS.keys())
        probs = np.zeros(len(cn), dtype=np.float32)
        decay = math.log(2) / 3.0
        yrs = list(range(2002, target_year))
        for ci, cname in enumerate(cn):
            topics = CLUSTER_TO_TOPICS.get(cname, [])
            tw, ws = 0.0, 0.0
            for y in yrs:
                for t in topics:
                    c = self.year_matrix.get(t, {}).get(y, 0)
                    w = math.exp(-decay * (target_year - y))
                    tw += c * w
                    ws += w
            probs[ci] = min(1.0, (tw / max(1e-8, ws)) / 15.0) if ws > 0 else 0.2
        return probs


class V4Backtester:
    """Backtest V4 predictor."""

    def __init__(self, use_gnn=True, use_xgboost=False):
        self.use_gnn = use_gnn
        self.use_xgboost = use_xgboost

    def run(self, test_years=None, strictness=0.5, graph_alpha=0.3, slack=2, verbose=False):
        if test_years is None:
            from intelligence_engine_v4.config import TEST_YEARS
            test_years = TEST_YEARS

        per_year = []
        for test_year in test_years:
            if verbose:
                print(f"\n  Backtesting: {test_year}")

            predictor = V4Predictor(use_gnn=self.use_gnn, use_xgboost=self.use_xgboost)
            try:
                predictor.train(years=list(range(2002, test_year)), verbose=verbose)
                result = predictor.predict(
                    target_year=test_year, strictness=strictness,
                    graph_alpha=graph_alpha, slack=slack, verbose=verbose,
                )

                actual_labels = build_labels(predictor.year_matrix, test_year)
                actual = set(IDX_TO_TOPIC[i] for i in range(N_TOPICS) if actual_labels[i] > 0)
                predicted = set(p['topic'] for p in result['predictions'])
                tp = len(predicted & actual)
                fp = len(predicted - actual)
                fn = len(actual - predicted)
                p_ = tp / max(1, tp + fp)
                r_ = tp / max(1, tp + fn)
                f1 = 2 * p_ * r_ / max(0.001, p_ + r_)

                per_year.append({
                    'test_year': test_year, 'total_actual': len(actual),
                    'total_predicted': len(predicted), 'true_positives': tp,
                    'false_positives': fp, 'false_negatives': fn,
                    'precision': round(p_, 4), 'recall': round(r_, 4),
                    'f1_score': round(f1, 4), 'predicted_n': result['predicted_n'],
                })

                if verbose:
                    print(f"    P={p_:.4f} R={r_:.4f} F1={f1:.4f} (N={result['predicted_n']}, "
                          f"actual={len(actual)}, TP={tp}, FN={fn})")

            except Exception as e:
                if verbose:
                    print(f"    Error: {e}")
                continue

        if not per_year:
            return {'error': 'No successful backtest years'}

        avg_p = float(np.mean([r['precision'] for r in per_year]))
        avg_r = float(np.mean([r['recall'] for r in per_year]))
        avg_f = float(np.mean([r['f1_score'] for r in per_year]))

        return {
            'methodology': 'V4: Graph Propagation + Dynamic N + Cluster Completion',
            'config': {'strictness': strictness, 'slack': slack},
            'aggregate_metrics': {
                'avg_precision': round(avg_p, 4), 'avg_recall': round(avg_r, 4),
                'avg_f1': round(avg_f, 4), 'total_test_years': len(per_year),
            },
            'per_year_metrics': per_year,
        }


def run_v4_evaluation(verbose=True):
    """Run complete V4 evaluation."""
    results = {}
    if verbose:
        print("\n" + "="*70)
        print("  V4 ARCHITECTURE FINAL EVALUATION")
        print("="*70)

    # V3 baseline
    if verbose:
        print("\n[V3] Baseline (fixed N=13)...")
    try:
        from intelligence_engine.evaluation import backtest_with_comprehensive_metrics
        v3 = backtest_with_comprehensive_metrics()
        results['v3_baseline'] = v3['aggregate_metrics']
        if verbose:
            m = v3['aggregate_metrics']
            print(f"  P={m['avg_precision']:.4f}  R={m['avg_recall']:.4f}  F1={m['avg_f1']:.4f}")
    except Exception as e:
        results['v3_baseline'] = {'error': str(e)}

    # V4 Conservative (high precision)
    if verbose:
        print("\n[V4-Conservative] Dynamic N + Cluster (strict=0.4)...")
    results['v4_conservative'] = V4Backtester(use_gnn=False).run(
        strictness=0.4, slack=0, verbose=verbose).get('aggregate_metrics', {})

    # V4 Balanced (target config)
    if verbose:
        print("\n[V4-Balanced] Dynamic N + Cluster (strict=0.65, slack=2)...")
    results['v4_balanced'] = V4Backtester(use_gnn=False).run(
        strictness=0.65, slack=2, verbose=verbose).get('aggregate_metrics', {})

    # V4 Aggressive (recall-maximizing)
    if verbose:
        print("\n[V4-Aggressive] Dynamic N + Cluster (strict=0.9, slack=4)...")
    results['v4_aggressive'] = V4Backtester(use_gnn=False).run(
        strictness=0.9, slack=4, verbose=verbose).get('aggregate_metrics', {})

    if verbose:
        print("\n" + "="*70)
        print("  FINAL RESULTS")
        print("="*70)
        for key, m in results.items():
            if isinstance(m, dict) and 'avg_precision' in m:
                meets_target = (
                    m['avg_precision'] >= 0.85 and
                    m['avg_recall'] >= 0.80 and
                    m['avg_f1'] >= 0.82
                )
                marker = "✅" if meets_target else " "
                print(f"  {marker} {key:20s}: P={m['avg_precision']:.4f}  "
                      f"R={m['avg_recall']:.4f}  F1={m['avg_f1']:.4f}")
            elif isinstance(m, dict) and 'error' in m:
                print(f"     {key:20s}: ERROR - {m['error']}")
        print()

    return results
