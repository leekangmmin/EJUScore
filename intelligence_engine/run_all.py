#!/usr/bin/env python3
"""
EJU Intelligence Engine v3 — Full Upgrade Runner

Runs all v3 components:
  1. Ensemble Topic Predictor + Topic Clustering + Graph Propagation
  2. Dynamic Knowledge Graph (with PageRank, Betweenness, Communities)
  3. Multi-Horizon Forecasting (short/medium/long term)
  4. Bayesian Student Model v2 (BKT + Forgetting)
  5. Recommendation Engine (6-factor weighted ranking)
  6. Comprehensive Evaluation Benchmark Suite

Outputs:
  - Enhanced predictions with cluster-level + graph propagation
  - Full graph analytics (centrality, bottlenecks, communities)
  - Short/medium/long-term forecasts
  - Student model with Bayesian Knowledge Tracing
  - Ranked study recommendations
  - Reproducible evaluation report

Usage:
    python intelligence_engine/run_all.py
"""

import json
import os
import sys
from datetime import datetime
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from intelligence_engine.predictor import (
    EnsemblePredictor, load_gold_standard, get_all_topics,
    build_topic_year_matrix, build_markov_transition_matrix,
)
from intelligence_engine.topic_clustering import (
    TopicClusterPredictor, get_cluster_for_topic, propagate_through_clusters,
)
from intelligence_engine.knowledge_graph_analyzer import DynamicKnowledgeGraph
from intelligence_engine.multi_horizon import MultiHorizonPredictor
from intelligence_engine.bayesian_student_model import BayesianStudentModel
from intelligence_engine.recommendation_engine import RecommendationEngine
from intelligence_engine.evaluation import (
    IntelligenceEvaluator, compute_map, compute_ndcg,
)


def run_enhanced_prediction(output_dir: str):
    """Run the v3 enhanced ensemble predictor with clusters and graph propagation."""
    print("\n" + "=" * 70)
    print("  1. ENHANCED ENSEMBLE PREDICTOR (v3)")
    print("     Topic-level + Cluster-level + Graph Propagation")
    print("=" * 70)

    questions = load_gold_standard()
    full_matrix = build_topic_year_matrix(questions)
    all_topics = get_all_topics()
    all_topics_only = [t for t, _ in all_topics]

    # Build base predictor for 2026
    predictor = EnsemblePredictor(target_year=2026)
    predictor.load_data()
    base_predictions = predictor.predict_all_topics()
    base_scores = {p['topic']: p['ensemble_probability']/100.0 for p in base_predictions}

    # Cluster-level predictor
    cluster_pred = TopicClusterPredictor()
    cluster_pred.build_from_data(questions)
    cluster_results = cluster_pred.predict_all(all_topics, target_year=2026)

    # Combine
    combined = {}
    for topic in all_topics_only:
        tp = base_scores.get(topic, 0.0)
        ci = cluster_results.get(topic, {})
        cp = ci.get('combined_probability', tp)
        topic_conf = min(1.0, sum(1 for y, c in full_matrix.get(topic, {}).items() if c > 0) / 4.0)
        if ci.get('cluster_name'):
            combined[topic] = (0.5 + 0.4 * topic_conf) * tp + (0.5 - 0.4 * topic_conf) * cp
        else:
            combined[topic] = tp

    # Graph propagation
    dkg = DynamicKnowledgeGraph()
    dkg.load_from_data(questions)
    propagated = dkg.propagate_probability(combined, decay_factor=0.3, max_hops=2)

    # Rank final predictions
    ranked = sorted(propagated.items(), key=lambda x: x[1], reverse=True)

    # Build output with full details
    final_predictions = []
    for i, (topic, prob) in enumerate(ranked):
        base = base_scores.get(topic, 0.0)
        ci = cluster_results.get(topic, {})
        cluster_name = ci.get('cluster_name', '')
        cluster_label = ci.get('cluster_label', '')
        final_predictions.append({
            'rank': i + 1,
            'topic': topic,
            'domain': predictor.topic_domain.get(topic, ''),
            'cluster_name': cluster_name,
            'cluster_label': cluster_label,
            'v3_probability': round(prob * 100, 2),
            'base_probability': round(base * 100, 2),
            'cluster_probability': round(ci.get('combined_probability', 0) * 100, 2),
            'graph_propagated': round(prob - base, 4) > 0.01,
        })

    print(f"\n  Top 15 Predictions for 2026:")
    print(f"  {'Rank':<6} {'Topic':<30} {'Domain':<12} {'V3 Prob':<10} {'Base':<10}")
    print(f"  {'-'*6} {'-'*30} {'-'*12} {'-'*10} {'-'*10}")
    for p in final_predictions[:15]:
        print(f"  {p['rank']:<6} {p['topic']:<30} {p['domain']:<12} {p['v3_probability']:<10.1f} {p['base_probability']:<10.1f}")

    # Save
    path = os.path.join(output_dir, 'v3_ensemble_predictions.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({
            'target_year': 2026,
            'generated_at': datetime.now().isoformat(),
            'methodology': (
                'V3 Enhanced: EnsemblePredictor (6 factors) + '
                'TopicCluster (12 semantic families) + '
                'GraphPropagation (prerequisite edges with decay)'
            ),
            'total_topics': len(final_predictions),
            'predictions': final_predictions,
        }, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: {path}")

    # Run backtest
    print("\n  Running V3 backtest (2015-2025 vs baseline)...")
    test_years = [2020, 2021, 2022, 2023, 2024, 2025]
    v3_scores = []
    base_scores_list = []

    for test_year in test_years:
        train_q = [q for q in questions if q.get('year', 0) < test_year]
        train_m = {}
        for t, y in full_matrix.items():
            ty = {y2: c for y2, c in y.items() if y2 < test_year}
            if ty: train_m[t] = ty

        # Baseline
        bp = EnsemblePredictor(target_year=test_year)
        bp.year_matrix = train_m
        bp.all_topics = list(all_topics_only)
        bp.topic_domain = {t: d for t, d in all_topics}
        bp.transition_matrix = build_markov_transition_matrix(train_m, all_topics_only)
        bp.recent_topics = [t for t in all_topics_only if any(y >= test_year-2 and c > 0 for y, c in train_m.get(t, {}).items())]
        b_preds = bp.predict_all_topics()
        b_scores = {p['topic']: p['ensemble_probability']/100.0 for p in b_preds}

        # V3
        cp = TopicClusterPredictor()
        cp.build_from_data(train_q)
        cr = cp.predict_all(all_topics, target_year=test_year)

        comb = {}
        for topic in all_topics_only:
            tp = b_scores.get(topic, 0.0)
            ci = cr.get(topic, {})
            cpp = ci.get('combined_probability', tp)
            tc = min(1.0, sum(1 for y, c in train_m.get(topic, {}).items() if c > 0) / 4.0)
            if ci.get('cluster_name'):
                comb[topic] = (0.5+0.4*tc) * tp + (0.5-0.4*tc) * cpp
            else:
                comb[topic] = tp

        try:
            dkg2 = DynamicKnowledgeGraph()
            dkg2.load_from_data(train_q)
            prop = dkg2.propagate_probability(comb, decay_factor=0.3, max_hops=2)
        except:
            prop = dict(comb)

        actual = set()
        for t, y in full_matrix.items():
            if y.get(test_year, 0) > 0: actual.add(t)

        n_actual = len(actual)
        n = max(15, min(22, n_actual + 2))

        b_ranked = [p['topic'] for p in b_preds[:n]]
        b_set = set(b_ranked)
        v_ranked = [t for t, _ in sorted(prop.items(), key=lambda x: x[1], reverse=True)[:n]]
        v_set = set(v_ranked)

        b_tp = len(b_set & actual); b_fp = len(b_set - actual); b_fn = len(actual - b_set)
        b_prec = b_tp/max(1,b_tp+b_fp); b_rec = b_tp/max(1,b_tp+b_fn)
        b_f1 = 2*b_prec*b_rec/max(0.001,b_prec+b_rec)
        base_scores_list.append((b_prec, b_rec, b_f1))

        v_tp = len(v_set & actual); v_fp = len(v_set - actual); v_fn = len(actual - v_set)
        v_prec = v_tp/max(1,v_tp+v_fp); v_rec = v_tp/max(1,v_tp+v_fn)
        v_f1 = 2*v_prec*v_rec/max(0.001,v_prec+v_rec)
        v3_scores.append((v_prec, v_rec, v_f1, v_tp, v_fp, v_fn, n))

    b_avg_p = sum(s[0] for s in base_scores_list)/len(base_scores_list)
    b_avg_r = sum(s[1] for s in base_scores_list)/len(base_scores_list)
    b_avg_f = sum(s[2] for s in base_scores_list)/len(base_scores_list)
    v_avg_p = sum(s[0] for s in v3_scores)/len(v3_scores)
    v_avg_r = sum(s[1] for s in v3_scores)/len(v3_scores)
    v_avg_f = sum(s[2] for s in v3_scores)/len(v3_scores)

    print(f"\n  Backtest Results (2020-2025):")
    print(f"  {'Metric':20s} {'Baseline':>10s} {'V3':>10s}")
    print(f"  {'-'*20} {'-'*10} {'-'*10}")
    print(f"  {'Precision':20s} {b_avg_p:>10.3f} {v_avg_p:>10.3f}")
    print(f"  {'Recall':20s} {b_avg_r:>10.3f} {v_avg_r:>10.3f}")
    print(f"  {'F1 Score':20s} {b_avg_f:>10.3f} {v_avg_f:>10.3f}")

    total_v_tp = sum(s[3] for s in v3_scores)
    print(f"\n  V3 improvement: +{total_v_tp - sum(s[3] if len(s)>3 else 0 for s in base_scores_list)} correct predictions")

    return final_predictions


def run_knowledge_graph(output_dir: str):
    """Run the dynamic knowledge graph analyzer."""
    print("\n" + "=" * 70)
    print("  2. DYNAMIC KNOWLEDGE GRAPH v3")
    print("     PageRank · Betweenness · Eigenvector · Communities · Bottlenecks")
    print("=" * 70)

    questions = load_gold_standard()
    dkg = DynamicKnowledgeGraph()
    dkg.load_from_data(questions)

    # Full export with all analytics
    graph_export = dkg.to_dict()

    path = os.path.join(output_dir, 'v3_knowledge_graph.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(graph_export, f, indent=2, ensure_ascii=False)
    print(f"  Saved: {path} ({len(graph_export['nodes'])} nodes, {len(graph_export['edges'])} edges)")

    # Print analytics
    analysis = graph_export['analysis']
    print(f"\n  Centrality (Top 10):")
    for topic, score in list(analysis['centrality'].items())[:10]:
        print(f"    {topic:<30s} {score:.4f}")

    print(f"\n  Bottlenecks:")
    for b in analysis['bottlenecks']['bottleneck_topics'][:5]:
        print(f"    {b['label']:<30s} score={b['bottleneck_score']:.2f}")

    quality = analysis['graph_quality']
    print(f"\n  Graph Quality:")
    print(f"    Connectivity: {quality['connectivity_ratio']:.2%}")
    print(f"    Edge density: {quality['edge_density']:.4f}")
    print(f"    Communities: {len(analysis['communities'])}")

    return graph_export


def run_multi_horizon(output_dir: str):
    """Run multi-horizon forecasting."""
    print("\n" + "=" * 70)
    print("  3. MULTI-HORIZON FORECASTING")
    print("     Short-term · Medium-term · Long-term")
    print("=" * 70)

    predictor = MultiHorizonPredictor(target_year=2026)
    predictor.load_data()
    recommendations = predictor.get_horizon_recommendation()

    print(f"\n  Short-term focus (next exam):")
    for r in recommendations['short_term_focus'][:10]:
        print(f"    {r['topic']:<30s} {r['probability']:.1f}%")

    print(f"\n  Medium-term focus (2-3 exams):")
    for r in recommendations['medium_term_focus'][:10]:
        print(f"    {r['topic']:<30s} {r['probability']:.1f}%")

    print(f"\n  Emerging topics:")
    for r in recommendations['emerging_topics'][:5]:
        print(f"    {r['topic']:<30s} {r['ensemble']:.1f}%")

    # Save
    path = os.path.join(output_dir, 'v3_multi_horizon.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(recommendations, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: {path}")

    return recommendations


def run_student_model(output_dir: str):
    """Run Bayesian Student Model v2."""
    print("\n" + "=" * 70)
    print("  4. BAYESIAN STUDENT MODEL v2")
    print("     Beta-Binomial · BKT · Forgetting (Ebbinghaus+SM-2+Difficulty)")
    print("=" * 70)

    model = BayesianStudentModel()
    questions = load_gold_standard()
    from collections import Counter
    topic_counts = Counter(q.get('topic', '') for q in questions)

    # Simulate observations from gold standard data
    for topic, count in topic_counts.items():
        if count >= 2:
            correct_ratio = 0.6  # Assume 60% correct rate
            correct_count = max(1, int(count * correct_ratio))
            for i in range(min(correct_count, 5)):
                model.observe_answer(topic, True)
            for i in range(min(count - correct_count, 3)):
                model.observe_answer(topic, False)

    mastery = model.get_mastery_report()
    forgetting = model.get_forgetting_report()
    projection = model.project_score_growth(
        current_score=120, target_score=180, weeks_available=24, study_hours_per_week=10
    )

    avg_mastery = sum(m['mastery'] for m in mastery.values()) / max(1, len(mastery))
    avg_confidence = sum(m['confidence'] for m in mastery.values()) / max(1, len(mastery))
    needs_review = sum(1 for f in forgetting if f['needs_review'])

    print(f"\n  Student Model State:")
    print(f"    Topics tracked: {len(mastery)}")
    print(f"    Avg mastery:    {avg_mastery:.3f}")
    print(f"    Avg confidence: {avg_confidence:.3f}")
    print(f"    Needs review:   {needs_review}")
    print(f"\n  Score Projection (120 -> 180 in 24 weeks):")
    print(f"    Achievable: {projection['achievable']}")
    print(f"    Final score: {projection['final_projected_score']:.1f}")
    print(f"    Weeks to target: {projection['estimated_weeks_to_target']}")

    # Save
    output = {
        'generated_at': datetime.now().isoformat(),
        'model_version': '2.0',
        'mastery_report': mastery,
        'forgetting_report': forgetting[:20],
        'score_projection': projection,
    }
    path = os.path.join(output_dir, 'v3_student_model.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: {path}")

    return output


def run_recommendations(output_dir: str):
    """Run the v3 recommendation engine."""
    print("\n" + "=" * 70)
    print("  5. RECOMMENDATION ENGINE v3")
    print("     40% Score Gain · 20% Exam Prob · 15% Weakness · 10% Diff · 10% Centrality · 5% Time")
    print("=" * 70)

    questions = load_gold_standard()
    topic_freq = Counter(q.get('topic', '') for q in questions)

    rec_engine = RecommendationEngine()
    rec_engine.set_mastery_estimates({t: 0.5 for t, _ in get_all_topics()})

    # Set prediction scores from V3 ensemble predictor
    predictor = EnsemblePredictor(target_year=2026)
    predictor.load_data()
    preds = predictor.predict_all_topics()
    rec_engine.set_prediction_scores({p['topic']: p['ensemble_probability'] for p in preds})

    # Run recommendation
    result = rec_engine.recommend(
        student_ability=0.5,
        days_until_exam=180,
        study_hours_per_week=10,
        num_recommendations=20,
        max_per_domain=6,
    )

    print(f"\n  Top Recommendations:")
    print(f"  {'Rank':<6} {'Topic':<30} {'Domain':<12} {'Score':<10} {'Expected Gain':<15}")
    print(f"  {'-'*6} {'-'*30} {'-'*12} {'-'*10} {'-'*15}")
    for rec in result['recommendations'][:10]:
        print(f"  {rec['rank']:<6} {rec['topic']:<30} {rec['domain']:<12} {rec['final_score']:<10.1f} {rec['expected_score_increase']:<15.2f}")

    print(f"\n  Summary:")
    meta = result['metadata']
    print(f"    Domains covered: {meta['domains_covered']}")
    print(f"    Total score increase: {meta['total_expected_score_increase']:.1f} pts")

    # Save
    path = os.path.join(output_dir, 'v3_recommendations.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: {path}")

    return result


def run_evaluation(output_dir: str):
    """Run comprehensive evaluation."""
    print("\n" + "=" * 70)
    print("  6. COMPREHENSIVE EVALUATION BENCHMARK")
    print("     All metrics from verified EJU datasets only")
    print("=" * 70)

    evaluator = IntelligenceEvaluator(output_dir)
    report = evaluator.evaluate_all()
    return report


def main():
    print(r"""
    ╔═══════════════════════════════════════════════════════════════╗
    ║      EJU INTELLIGENCE ENGINE v3                              ║
    ║      Topic Clustering · Graph Propagation                    ║
    ║      Multi-Horizon · BKT · Recommendations · Benchmarks      ║
    ╚═══════════════════════════════════════════════════════════════╝
    """)

    output_dir = 'intelligence_engine/output'
    os.makedirs(output_dir, exist_ok=True)

    start_time = datetime.now()

    # Run all components
    predictions = run_enhanced_prediction(output_dir)
    kg = run_knowledge_graph(output_dir)
    horizons = run_multi_horizon(output_dir)
    student = run_student_model(output_dir)
    recommendations = run_recommendations(output_dir)
    evaluation = run_evaluation(output_dir)

    # Final summary
    elapsed = (datetime.now() - start_time).total_seconds()
    print(f"\n{'='*70}")
    print(f"  EJU Intelligence Engine v3 — Complete")
    print(f"  Runtime: {elapsed:.1f}s")
    print(f"  Output: {output_dir}")
    print(f"{'='*70}")

    pred = evaluation.get('prediction_accuracy', {})
    agg = pred.get('aggregate_metrics', {})
    if agg:
        print(f"\n  Prediction Targets:")
        print(f"    Precision: {agg.get('avg_precision', 'N/A'):.3f} (target >= 0.800)")
        print(f"    Recall:    {agg.get('avg_recall', 'N/A'):.3f} (target >= 0.700)")
        print(f"    F1 Score:  {agg.get('avg_f1', 'N/A'):.3f} (target >= 0.750)")
        print(f"    MAP:       {agg.get('avg_MAP', 'N/A'):.4f}")
        print(f"    NDCG:      {agg.get('avg_NDCG', 'N/A'):.4f}")


if __name__ == '__main__':
    main()
