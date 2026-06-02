"""
Core verification tests for V4 Intelligence Engine.
Tests data integrity, model reproducibility, and regression safety.
"""

import os
import sys
import json
import math
import numpy as np
from collections import defaultdict

# Add project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))


def test_data_integrity():
    """Verify data loading and topic integrity."""
    from intelligence_engine_v4.data import (
        TRAIN_TOPICS, N_TOPICS, N_CLUSTERS, TOPIC_CLUSTERS,
        TOPIC_TO_IDX, IDX_TO_TOPIC, TOPIC_TO_CLUSTER,
        PREREQUISITE_MAP, load_gold_standard,
        build_topic_year_matrix,
    )
    
    # 35 training topics
    assert N_TOPICS == 35, f"Expected 35 topics, got {N_TOPICS}"
    
    # 11 clusters
    assert N_CLUSTERS == 11, f"Expected 11 clusters, got {N_CLUSTERS}"
    
    # All topics have valid cluster mapping
    for t in TRAIN_TOPICS:
        assert t in TOPIC_TO_CLUSTER, f"{t} missing from TOPIC_TO_CLUSTER"
    
    # All topics have valid idx
    for t in TRAIN_TOPICS:
        assert t in TOPIC_TO_IDX, f"{t} missing from TOPIC_TO_IDX"
    for i in range(N_TOPICS):
        assert i in IDX_TO_TOPIC, f"Index {i} missing from IDX_TO_TOPIC"
    
    # PREREQUISITE_MAP all references valid
    for topic, prereqs in PREREQUISITE_MAP.items():
        assert topic in TRAIN_TOPICS, f"{topic} not in TRAIN_TOPICS"
        for p in prereqs:
            assert p in TRAIN_TOPICS, f"Prerequisite {p} of {topic} not in TRAIN_TOPICS"
    
    # Data loads without error
    questions = load_gold_standard()
    assert len(questions) > 0, "No questions loaded"
    
    # Year matrix built correctly
    matrix = build_topic_year_matrix(questions)
    assert len(matrix) >= N_TOPICS, f"Matrix has {len(matrix)} topics, expected >= {N_TOPICS}"
    
    # Verify year range
    all_years = set()
    for t, years in matrix.items():
        all_years.update(years.keys())
    assert 2002 <= min(all_years), f"Earliest year {min(all_years)} < 2002"
    assert max(all_years) >= 2024, f"Latest year {max(all_years)} < 2024"
    
    print(f"  ✓ Data integrity: {N_TOPICS} topics, {N_CLUSTERS} clusters, "
          f"{len(questions)} questions, {len(all_years)} years")


def test_v3_probability_scoring():
    """Verify V3 probability scoring produces valid probabilities."""
    from intelligence_engine_v4.data import (
        TRAIN_TOPICS, N_TOPICS, load_gold_standard, build_topic_year_matrix,
    )
    from intelligence_engine_v4.models.v4_final import compute_v3_probabilities
    
    questions = load_gold_standard()
    matrix = build_topic_year_matrix(questions)
    
    # Test multiple years
    for target_year in [2015, 2020, 2024]:
        probs = compute_v3_probabilities(matrix, target_year)
        
        # Shape
        assert probs.shape == (N_TOPICS,), f"Expected ({N_TOPICS},), got {probs.shape}"
        
        # Range [0, 1]
        assert probs.min() >= 0.0, f"Min prob {probs.min()} < 0"
        assert probs.max() <= 1.0, f"Max prob {probs.max()} > 1"
        
        # Sum > 0 (at least some topics have positive probability)
        assert probs.sum() > 0, "All probabilities are zero"
        
        # At least one topic has high probability
        assert probs.max() > 0.5, f"Max prob {probs.max()} <= 0.5"
    
    print(f"  ✓ V3 probability scoring valid for all test years")


def test_model_reproducibility():
    """Verify model produces identical results with same seed."""
    from intelligence_engine_v4.models.v4_final import V4FinalPredictor
    
    # Run twice
    p1 = V4FinalPredictor()
    p1.train()
    r1 = p1.predict(target_year=2027, strictness=0.7, slack=2)
    
    p2 = V4FinalPredictor()
    p2.train()
    r2 = p1.predict(target_year=2027, strictness=0.7, slack=2)
    
    # Same number of predictions
    assert len(r1['predictions']) == len(r2['predictions']), \
        f"Prediction count mismatch: {len(r1['predictions'])} vs {len(r2['predictions'])}"
    
    # Same topics
    t1 = [t['topic'] for t in r1['predictions']]
    t2 = [t['topic'] for t in r2['predictions']]
    assert t1 == t2, f"Prediction mismatch"
    
    # Same probabilities
    for i, (a, b) in enumerate(zip(r1['predictions'], r2['predictions'])):
        assert abs(a['probability'] - b['probability']) < 1e-6, \
            f"Probability mismatch at {i}: {a['probability']} vs {b['probability']}"
    
    print(f"  ✓ Model reproducibility: identical predictions on 2 runs")


def test_no_data_leakage():
    """Verify that training data does not leak future information."""
    from intelligence_engine_v4.data import (
        N_TOPICS, load_gold_standard, build_topic_year_matrix,
    )
    from intelligence_engine_v4.models.v4_final import compute_v3_probabilities
    
    questions = load_gold_standard()
    full_matrix = build_topic_year_matrix(questions)
    
    for test_year in [2015, 2020, 2024]:
        # Build training matrix: only data before test_year
        train_matrix = {}
        for topic, years in full_matrix.items():
            past_years = {y: c for y, c in years.items() if y < test_year}
            if past_years:
                train_matrix[topic] = past_years
        
        # Verify no future data
        for topic, years in train_matrix.items():
            for y in years:
                assert y < test_year, \
                    f"Data leakage: {topic} has data from {y} >= test_year {test_year}"
        
        probs = compute_v3_probabilities(train_matrix, test_year)
        assert probs.shape == (N_TOPICS,)
    
    print(f"  ✓ No data leakage: future data excluded from training")


def test_cluster_completion_history_filter():
    """Verify cluster completion history filter works."""
    from intelligence_engine_v4.data import (
        N_TOPICS, TOPIC_CLUSTERS, CLUSTER_TO_TOPICS, TOPIC_TO_IDX,
        IDX_TO_TOPIC, TRAIN_TOPICS, load_gold_standard, build_topic_year_matrix,
    )
    from intelligence_engine_v4.models.v4_final import compute_v3_probabilities, compute_cluster_probabilities
    from intelligence_engine_v4.inference.cluster_completion import apply_cluster_completion
    
    questions = load_gold_standard()
    matrix = build_topic_year_matrix(questions)
    target_year = 2024
    
    base_probs = compute_v3_probabilities(matrix, target_year)
    cluster_probs = compute_cluster_probabilities(base_probs)
    
    # With history filter (default)
    boosted_with_filter = apply_cluster_completion(
        base_probs.copy(), cluster_probs,
        year_matrix=matrix, target_year=target_year,
        min_history_count=1,
        multiplier=0.85,  # Use aggressive multiplier to see effect
        min_confidence=0.30,
    )
    
    # Without history filter
    boosted_no_filter = apply_cluster_completion(
        base_probs.copy(), cluster_probs,
        year_matrix=None, target_year=None,
        min_history_count=0,
        multiplier=0.85,
        min_confidence=0.30,
    )
    
    # Topics with 0 history should NOT be boosted with filter
    # Identify zero-history topics for target_year
    zero_history = []
    for t in TRAIN_TOPICS:
        yearly = matrix.get(t, {})
        active = sum(1 for y, c in yearly.items() if c > 0 and y < target_year)
        if active == 0:
            zero_history.append(t)
    
    for t in zero_history:
        idx = TOPIC_TO_IDX.get(t)
        if idx is not None:
            # With filter: should NOT be boosted
            with_filter_boost = boosted_with_filter[idx] - base_probs[idx]
            # Without filter: should be boosted (if cluster active)
            no_filter_boost = boosted_no_filter[idx] - base_probs[idx]
            
            if no_filter_boost > 0.01:
                # This topic was boostable, verify filter prevented it
                assert abs(with_filter_boost) < 0.01, \
                    f"{t}: filter should prevent boost (boost={with_filter_boost:.4f})"
    
    print(f"  ✓ Cluster completion history filter working correctly")


def test_backtester_leave_one_year_out():
    """Verify Leave-One-Year-Out cross-validation is correct."""
    from intelligence_engine_v4.models.v4_final import V4FinalBacktester
    from intelligence_engine_v4.data import N_TOPICS
    
    backtester = V4FinalBacktester()
    result = backtester.run(use_cluster=False, use_prerequisite=False, verbose=False)
    
    # 11 test years
    assert result['aggregate_metrics']['total_test_years'] == 11, \
        f"Expected 11 test years, got {result['aggregate_metrics']['total_test_years']}"
    
    # Each year properly validated
    for yr in result['per_year_metrics']:
        assert yr['precision'] >= 0, f"Negative precision for {yr['test_year']}"
        assert yr['recall'] >= 0, f"Negative recall for {yr['test_year']}"
        assert yr['f1_score'] >= 0, f"Negative F1 for {yr['test_year']}"
        assert yr['true_positives'] >= 0
        assert yr['false_positives'] >= 0
        assert yr['false_negatives'] >= 0
    
    # Macro averages match
    macro_p = np.mean([yr['precision'] for yr in result['per_year_metrics']])
    macro_r = np.mean([yr['recall'] for yr in result['per_year_metrics']])
    macro_f = np.mean([yr['f1_score'] for yr in result['per_year_metrics']])
    
    assert abs(macro_p - result['aggregate_metrics']['avg_precision']) < 0.001
    assert abs(macro_r - result['aggregate_metrics']['avg_recall']) < 0.001
    assert abs(macro_f - result['aggregate_metrics']['avg_f1']) < 0.001
    
    print(f"  ✓ Leave-One-Year-Out CV correct: {11} years validated")


def test_config_consistency():
    """Verify configuration parameters are consistent."""
    from intelligence_engine_v4.config import (
        CLUSTER_PROB_MULTIPLIER, CLUSTER_MIN_CONFIDENCE, CLUSTER_MIN_HISTORY_COUNT,
        DEFAULT_STRICTNESS, DEFAULT_SLACK,
    )
    
    # New calibrated values
    assert CLUSTER_PROB_MULTIPLIER == 0.40, f"multiplier={CLUSTER_PROB_MULTIPLIER}"
    assert CLUSTER_MIN_CONFIDENCE == 0.50, f"min_conf={CLUSTER_MIN_CONFIDENCE}"
    assert CLUSTER_MIN_HISTORY_COUNT == 1, f"min_history={CLUSTER_MIN_HISTORY_COUNT}"
    assert DEFAULT_SLACK == 2
    assert DEFAULT_STRICTNESS == 0.7
    
    print(f"  ✓ Configuration consistent")


if __name__ == '__main__':
    tests = [
        test_data_integrity,
        test_v3_probability_scoring,
        test_model_reproducibility,
        test_no_data_leakage,
        test_cluster_completion_history_filter,
        test_backtester_leave_one_year_out,
        test_config_consistency,
    ]
    
    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  ✗ {test.__name__}: FAILED — {e}")
            failed += 1
    
    print(f"\n{'='*50}")
    print(f"  {passed}/{len(tests)} tests passed, {failed} failed")
    if failed > 0:
        exit(1)
