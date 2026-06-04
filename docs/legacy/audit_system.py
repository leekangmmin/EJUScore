#!/usr/bin/env python3
"""
EJU Intelligence Platform - Comprehensive Quality Audit
Audits all 5 major subsystems and produces a SYSTEM_SCORE.
"""
import json
import os
import sys
import random
import math
from datetime import datetime
from collections import defaultdict, Counter

DATASET_DIR = "dataset"
OUTPUT_DIR = "dataset"

random.seed(42)  # reproducible sampling


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ================================================================
# AUDIT 1: KNOWLEDGE GRAPH
# ================================================================
def audit_knowledge_graph():
    print("\n" + "=" * 70)
    print("  AUDIT 1: KNOWLEDGE GRAPH QUALITY")
    print("=" * 70)

    kg_path = os.path.join(DATASET_DIR, "knowledge-graph", "knowledge_graph_v3.json")
    if not os.path.exists(kg_path):
        kg_path = os.path.join(DATASET_DIR, "knowledge-graph", "knowledge_graph.json")
    kg = load_json(kg_path)

    nodes = kg.get("nodes", [])
    edges = kg.get("edges", [])
    statistics = kg.get("statistics", {})
    taxonomy = kg.get("taxonomy", {})

    node_ids = {n["id"] for n in nodes}
    node_types = defaultdict(list)
    for n in nodes:
        node_types[n["type"]].append(n["id"])

    issues = []
    total_checks = 0

    # Helper: get edge source/target (handles both v2 and v3 formats)
    def edge_source(e):
        return e.get("sourceId") or e.get("source") or ""

    def edge_target(e):
        return e.get("targetId") or e.get("target") or ""

    def edge_rel(e):
        return e.get("relation") or e.get("type") or ""

    # 1. Orphan nodes
    total_checks += 1
    connected_ids = set()
    for e in (edges or []):
        connected_ids.add(edge_source(e))
        connected_ids.add(edge_target(e))

    # Domain nodes are roots; they don't need incoming edges to not be orphans
    # Only check non-domain nodes
    non_domain_node_ids = {n["id"] for n in nodes if n["type"] != "domain"}
    connected_non_domain = connected_ids & non_domain_node_ids
    orphan_ids = non_domain_node_ids - connected_non_domain
    orphan_nodes = [n for n in nodes if n["id"] in orphan_ids]

    if orphan_nodes:
        issues.append({
            "check": "orphan_nodes",
            "severity": "HIGH" if len(orphan_nodes) > 3 else "MEDIUM",
            "count": len(orphan_nodes),
            "details": [{"id": n["id"], "label": n.get("label", ""), "type": n["type"]} for n in orphan_nodes]
        })

    # 2. Wrong edges: domain mismatch
    total_checks += 1
    wrong_edges = []
    domain_nodes = {n["id"]: n for n in nodes if n["type"] == "domain"}
    topic_nodes = {}
    for n in nodes:
        if n["type"] == "topic":
            topic_nodes[n["id"]] = n

    for e in (edges or []):
        src = edge_source(e)
        tgt = edge_target(e)
        rel = edge_rel(e)

        src_info = topic_nodes.get(src) or domain_nodes.get(src)
        tgt_info = topic_nodes.get(tgt) or domain_nodes.get(tgt)
        if src_info and tgt_info:
            src_domain = src_info.get("domain", "")
            tgt_domain = tgt_info.get("domain", "")
            if src_domain and tgt_domain and src_domain != tgt_domain and rel not in ("cross_domain", "related_to"):
                wrong_edges.append({
                    "source": src,
                    "source_domain": src_domain,
                    "target": tgt,
                    "target_domain": tgt_domain,
                    "relation": rel
                })

    if wrong_edges:
        issues.append({
            "check": "domain_mismatch_edges",
            "severity": "MEDIUM",
            "count": len(wrong_edges),
            "details": wrong_edges
        })

    # 3. Circular dependencies in prerequisite chain
    total_checks += 1
    prereq_edges = [e for e in (edges or []) if edge_rel(e) == "prerequisite"]

    prereq_graph = defaultdict(list)
    for e in prereq_edges:
        src = edge_source(e)
        tgt = edge_target(e)
        prereq_graph[src].append(tgt)

    cycles = []
    visited = set()
    path_stack = []

    def dfs(node):
        if node in path_stack:
            cycle_start = path_stack.index(node)
            cycle = path_stack[cycle_start:] + [node]
            # Normalize to avoid duplicate cycles
            cycle_key = tuple(sorted(set(cycle)))
            for c in cycles:
                if tuple(sorted(set(c))) == cycle_key:
                    return
            cycles.append(cycle)
            return
        if node in visited:
            return
        if node not in prereq_graph:
            return
        visited.add(node)
        path_stack.append(node)
        for neighbor in prereq_graph.get(node, []):
            dfs(neighbor)
        path_stack.pop()

    for n in list(prereq_graph.keys()):
        dfs(n)

    if cycles:
        issues.append({
            "check": "circular_dependencies",
            "severity": "HIGH",
            "count": len(cycles),
            "details": [{"cycle": c} for c in cycles[:10]]
        })

    # 4. Topic duplicates across domains
    total_checks += 1
    topic_labels = defaultdict(list)
    for n in nodes:
        if n["type"] == "topic":
            label = n.get("label", "")
            domain = n.get("domain", "") or n.get("name_en", "")
            topic_labels[label].append(domain)

    duplicate_topics = {k: v for k, v in topic_labels.items() if len(set(v)) > 1}
    if duplicate_topics:
        issues.append({
            "check": "duplicate_topics_across_domains",
            "severity": "MEDIUM",
            "count": len(duplicate_topics),
            "details": [{"topic": k, "domains": list(set(v))} for k, v in duplicate_topics.items()]
        })

    # 5. Topic domain inconsistency
    total_checks += 1
    topic_domain_issues = []
    for n in nodes:
        if n["type"] == "topic":
            nid = n.get("id", "")
            domain = n.get("domain", "")
            if domain:
                expected_prefix = f"topic:{domain}:"
                if not nid.startswith(expected_prefix):
                    topic_domain_issues.append({
                        "node_id": nid,
                        "label": n.get("label", ""),
                        "declared_domain": domain,
                        "expected_prefix": expected_prefix
                    })
    if topic_domain_issues:
        issues.append({
            "check": "topic_domain_inconsistency",
            "severity": "LOW",
            "count": len(topic_domain_issues),
            "details": topic_domain_issues
        })

    # 6. Missing nodes from taxonomy
    total_checks += 1
    if taxonomy:
        missing_from_taxonomy = []
        for domain_key, domain_info in taxonomy.items():
            for topic_key in domain_info.get("topics", {}):
                expected_id = f"topic:{domain_key}:{topic_key}"
                if expected_id not in node_ids:
                    missing_from_taxonomy.append({
                        "expected_id": expected_id,
                        "domain": domain_key,
                        "topic": topic_key
                    })
        if missing_from_taxonomy:
            issues.append({
                "check": "taxonomy_node_missing",
                "severity": "MEDIUM",
                "count": len(missing_from_taxonomy),
                "details": missing_from_taxonomy
            })

    # Score calculation
    score = 100
    deductions = []
    for iss in issues:
        severity = iss["severity"]
        count = iss["count"]
        if severity == "HIGH":
            deduction = min(count * 8, 40)
        elif severity == "MEDIUM":
            deduction = min(count * 4, 20)
        else:
            deduction = min(count * 2, 10)
        score -= deduction
        deductions.append({"issue": iss["check"], "deduction": deduction})

    score = int(max(0, score))

    actual_domains = len([n for n in nodes if n["type"] == "domain"])

    result = {
        "audit": "Knowledge Graph",
        "version": kg.get("version", "unknown"),
        "generated_at": kg.get("generated_at", ""),
        "statistics": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "domain_count": actual_domains,
            "topic_count": len([n for n in nodes if n["type"] == "topic"]),
            "subtopic_count": len([n for n in nodes if n["type"] == "subtopic"]),
        },
        "checks_performed": total_checks,
        "issues_found": len(issues),
        "issues": issues,
        "score": score,
        "deductions": deductions,
    }

    print(f"\n  Issues found: {len(issues)}")
    for iss in issues:
        print(f"    [{iss['severity']:^6}] {iss['check']}: {iss['count']}")
    print(f"  Score: {score}/100")

    return result, score


# ================================================================
# AUDIT 2: TREND ANALYSIS
# ================================================================
def audit_trend_analysis():
    print("\n" + "=" * 70)
    print("  AUDIT 2: TREND ANALYSIS VALIDATION")
    print("=" * 70)

    ta_path = os.path.join(DATASET_DIR, "trend-analysis", "trend_analysis_v2.json")
    if not os.path.exists(ta_path):
        ta_path = os.path.join(DATASET_DIR, "trend-analysis", "trend_analysis.json")
    ta = load_json(ta_path)

    gold_path = os.path.join(DATASET_DIR, "gold_standard", "gold_standard.json")
    gs = load_json(gold_path)

    issues = []
    total_checks = 0

    gs_questions = gs.get("questions", [])

    # 1. Total count consistency
    total_checks += 1
    top_topics = ta.get("top_30_topics", [])
    frequency_errors = []

    for tt in top_topics:
        topic = tt.get("topic", "")
        yearlies = tt.get("yearly", {})
        total = tt.get("total", 0)

        calc_total = sum(int(v) for v in yearlies.values())
        if calc_total != total:
            frequency_errors.append({
                "topic": topic,
                "declared_total": total,
                "calculated_total": calc_total,
                "difference": calc_total - total
            })

    if frequency_errors:
        issues.append({
            "check": "total_count_inconsistency",
            "severity": "HIGH",
            "count": len(frequency_errors),
            "details": frequency_errors[:20]
        })

    # 2. Domain total consistency
    total_checks += 1
    domain_trends = ta.get("domain_trends", {})
    for domain, ddata in domain_trends.items():
        yearly = ddata.get("yearly", {})
        declared_total = ddata.get("total", 0)
        calc_total = sum(int(v) for v in yearly.values())
        if calc_total != declared_total:
            issues.append({
                "check": "domain_total_mismatch",
                "severity": "HIGH",
                "count": 1,
                "details": [{
                    "domain": domain,
                    "declared_total": declared_total,
                    "calculated_total": calc_total,
                    "diff": calc_total - declared_total
                }]
            })

    # 3. Years appeared consistency
    total_checks += 1
    for tt in top_topics:
        topic = tt.get("topic", "")
        yearly = tt.get("yearly", {})
        years_appeared = tt.get("years_appeared", 0)
        nonzero_years = sum(1 for y, v in yearly.items() if int(v) > 0)
        if years_appeared != nonzero_years and years_appeared != 0:
            issues.append({
                "check": "years_appeared_mismatch",
                "severity": "LOW",
                "count": 1,
                "details": [{
                    "topic": topic,
                    "declared_years_appeared": years_appeared,
                    "actual_nonzero_years": nonzero_years
                }]
            })

    # 4. Random sampling: verify gold standard questions appear in trend
    total_checks += 1
    gs_qs_with_topic = [q for q in gs_questions if q.get("topic", "")]
    if len(gs_qs_with_topic) >= 100:
        sample = random.sample(gs_qs_with_topic, 100)
    else:
        sample = gs_qs_with_topic

    sampling_errors = []
    for q in sample:
        year = q.get("year", 0)
        topic = q.get("topic", "")
        if not topic:
            continue

        found = False
        for tt in top_topics:
            if tt.get("topic") == topic:
                yearly = tt.get("yearly", {})
                if str(year) in yearly:
                    found = True
                    break
        if not found:
            sampling_errors.append({
                "question_id": q.get("id", ""),
                "year": year,
                "topic": topic,
                "domain": q.get("domain", "unknown"),
                "issue": "topic-year not found in trend analysis"
            })

    if sampling_errors:
        issues.append({
            "check": "sampling_topic_not_found",
            "severity": "MEDIUM",
            "count": len(sampling_errors),
            "details": sampling_errors[:20]
        })

    # 5. Check gold data (2016+) is reflected in trend
    total_checks += 1
    gold_missing = []
    for q in gs_qs_with_topic:
        year = q.get("year", 0)
        topic = q.get("topic", "")
        if not topic or year < 2016:
            continue

        tref = None
        for tt in top_topics:
            if tt.get("topic") == topic:
                tref = tt
                break

        if tref:
            yearly = tref.get("yearly", {})
            trend_count = int(yearly.get(str(year), 0))
            if trend_count == 0:
                gold_missing.append({
                    "topic": topic,
                    "year": year,
                    "question_id": q.get("id", ""),
                    "domain": q.get("domain", "unknown")
                })
                if len(gold_missing) >= 20:
                    break

    if gold_missing:
        issues.append({
            "check": "gold_data_missing_in_trend",
            "severity": "HIGH",
            "count": len(gold_missing),
            "details": gold_missing
        })

    # Score
    score = 100
    deductions = []
    for iss in issues:
        severity = iss["severity"]
        count = iss["count"]
        if severity == "HIGH":
            deduction = min(count * 5, 40)
        elif severity == "MEDIUM":
            deduction = min(count * 3, 20)
        else:
            deduction = min(count * 1, 10)
        score -= deduction
        deductions.append({"issue": iss["check"], "deduction": deduction})
    score = int(max(0, score))

    result = {
        "audit": "Trend Analysis",
        "version": "v2",
        "generated_at": ta.get("generated_at", ""),
        "gold_standard_questions_used": len(gs_questions),
        "sample_size_verified": len(sample),
        "checks_performed": total_checks,
        "issues_found": len(issues),
        "issues": issues,
        "score": score,
        "deductions": deductions,
    }

    print(f"\n  Issues found: {len(issues)}")
    for iss in issues:
        print(f"    [{iss['severity']:^6}] {iss['check']}: {iss['count']}")
    print(f"  Score: {score}/100")

    return result, score


# ================================================================
# AUDIT 3: DIFFICULTY ENGINE
# ================================================================
def audit_difficulty_engine():
    print("\n" + "=" * 70)
    print("  AUDIT 3: DIFFICULTY ENGINE VALIDATION")
    print("=" * 70)

    diff_path = os.path.join(DATASET_DIR, "difficulty", "difficulty_database.json")
    gold_path = os.path.join(DATASET_DIR, "gold_standard", "gold_standard.json")
    kg_path = os.path.join(DATASET_DIR, "knowledge-graph", "knowledge_graph_v3.json")

    if not os.path.exists(kg_path):
        kg_path = os.path.join(DATASET_DIR, "knowledge-graph", "knowledge_graph.json")

    diff_db = load_json(diff_path)
    gs = load_json(gold_path)
    kg = load_json(kg_path)

    questions = diff_db.get("questions", [])
    gs_qs = gs.get("questions", [])

    issues = []
    total_checks = 0

    # Build topic frequency map from KG
    topic_freq = {}
    for n in kg.get("nodes", []):
        if n["type"] == "topic":
            topic_freq[n.get("label", "")] = n.get("total_questions", 0)

    # Build gold standard difficulty map
    gs_diff_map = {}
    for q in gs_qs:
        gs_diff_map[q.get("id", "")] = q.get("difficulty", 3)

    # 1. Topic rarity correlation
    total_checks += 1
    correlation_data = []
    for q in questions:
        qid = q.get("id", "")
        topic = q.get("topic", "")
        score = q.get("difficulty_score", 40)
        freq = topic_freq.get(topic, 50)
        correlation_data.append({
            "id": qid,
            "topic": topic,
            "difficulty_score": score,
            "topic_frequency": freq
        })

    rare_topics = [d for d in correlation_data if d["topic_frequency"] < 10 and d["topic_frequency"] > 0]
    common_topics = [d for d in correlation_data if d["topic_frequency"] >= 30]

    rare_avg = sum(d["difficulty_score"] for d in rare_topics) / len(rare_topics) if rare_topics else 0
    common_avg = sum(d["difficulty_score"] for d in common_topics) / len(common_topics) if common_topics else 0

    issues.append({
        "check": "topic_rarity_correlation",
        "severity": "INFO",
        "count": 0,
        "details": [{
            "rare_topics_avg_difficulty": round(rare_avg, 2),
            "common_topics_avg_difficulty": round(common_avg, 2),
            "rare_topic_count": len(rare_topics),
            "common_topic_count": len(common_topics),
            "expected": "Rare topics should have higher difficulty (higher score = harder)",
            "observed": "Correlation holds" if rare_avg > common_avg else "No clear correlation or inverted"
        }]
    })

    # 2. Factor score consistency
    total_checks += 1
    factor_inconsistencies = []
    for q in questions:
        score = q.get("difficulty_score", 40)
        factors = q.get("factors", {})
        base = factors.get("base_difficulty", 0)
        topic_rarity = factors.get("topic_rarity", 0)
        material_comp = factors.get("material_complexity", 0)
        choices_comp = factors.get("choices_complexity", 0)
        length_comp = factors.get("length_complexity", 0)
        year_factor = factors.get("year_factor", 0)

        factor_sum = base + topic_rarity + material_comp + choices_comp + length_comp + year_factor
        approx = factor_sum * 100 / 6
        diff_abs = abs(approx - score)
        if diff_abs > 25 and score > 10:
            factor_inconsistencies.append({
                "id": q.get("id", ""),
                "difficulty_score": score,
                "calculated_approx": round(approx, 1),
                "difference": round(diff_abs, 1),
                "factors": factors
            })

    if factor_inconsistencies:
        issues.append({
            "check": "factor_score_inconsistency",
            "severity": "MEDIUM",
            "count": len(factor_inconsistencies),
            "details": factor_inconsistencies[:10]
        })

    # 3. Distribution check
    total_checks += 1
    distribution = diff_db.get("score_distribution", {})
    easy = distribution.get("easy", 0)
    medium = distribution.get("medium", 0)
    hard = distribution.get("hard", 0)
    total_d = easy + medium + hard

    if total_d > 0:
        easy_pct = easy / total_d * 100
        medium_pct = medium / total_d * 100
        hard_pct = hard / total_d * 100
    else:
        easy_pct = medium_pct = hard_pct = 0

    if medium_pct < 40 or medium_pct > 90:
        issues.append({
            "check": "unusual_distribution",
            "severity": "MEDIUM",
            "count": 1,
            "details": [{
                "easy_pct": round(easy_pct, 1),
                "medium_pct": round(medium_pct, 1),
                "hard_pct": round(hard_pct, 1),
                "note": "Medium should typically be 50-80% of questions"
            }]
        })

    # 4. Gold standard correlation
    total_checks += 1
    gs_to_diff_score = []
    for q in questions:
        qid = q.get("id", "")
        if qid in gs_diff_map:
            gs_diff = gs_diff_map[qid]
            diff_score = q.get("difficulty_score", 40)
            gs_to_diff_score.append({
                "id": qid,
                "gold_difficulty_1to5": gs_diff,
                "predicted_difficulty_0to100": diff_score,
            })

    if gs_to_diff_score:
        avg_pred_by_gold = defaultdict(list)
        for d in gs_to_diff_score:
            avg_pred_by_gold[d["gold_difficulty_1to5"]].append(d["predicted_difficulty_0to100"])

        correlation_summary = {}
        for gs_level in sorted(avg_pred_by_gold.keys()):
            vals = avg_pred_by_gold[gs_level]
            correlation_summary[f"gold_diff_{gs_level}"] = {
                "count": len(vals),
                "avg_predicted": round(sum(vals) / len(vals), 1),
                "min_predicted": min(vals),
                "max_predicted": max(vals)
            }

        issues.append({
            "check": "gold_standard_correlation",
            "severity": "INFO",
            "count": 0,
            "details": [{
                "correlation_summary": correlation_summary,
                "note": "Predicted scores should increase with gold difficulty level"
            }]
        })

    # Score
    score = 100
    deductions = []
    for iss in issues:
        if iss["severity"] == "INFO":
            continue
        severity = iss["severity"]
        count = iss["count"]
        if severity == "HIGH":
            deduction = min(count * 10, 40)
        elif severity == "MEDIUM":
            deduction = min(count * 5, 25)
        else:
            deduction = min(count * 2, 10)
        score -= deduction
        deductions.append({"issue": iss["check"], "deduction": deduction})
    score = int(max(0, score))

    result = {
        "audit": "Difficulty Engine",
        "version": diff_db.get("version", "unknown"),
        "generated_at": diff_db.get("generated_at", ""),
        "total_questions_analyzed": len(questions),
        "distribution": {
            "easy": easy,
            "medium": medium,
            "hard": hard,
            "avg_score": diff_db.get("average_score", 0)
        },
        "checks_performed": total_checks,
        "issues_found": len(issues),
        "issues": issues,
        "score": score,
        "deductions": deductions,
    }

    print(f"\n  Issues found: {len(issues)}")
    for iss in issues:
        if iss["severity"] != "INFO":
            print(f"    [{iss['severity']:^6}] {iss['check']}: {iss['count']}")
    print(f"  Score: {score}/100")

    return result, score


# ================================================================
# AUDIT 4: PREDICTION ENGINE BACKTESTING
# ================================================================
def audit_prediction_engine():
    print("\n" + "=" * 70)
    print("  AUDIT 4: PREDICTION ENGINE BACKTESTING")
    print("=" * 70)

    ta_path = os.path.join(DATASET_DIR, "trend-analysis", "trend_analysis_v2.json")
    if not os.path.exists(ta_path):
        ta_path = os.path.join(DATASET_DIR, "trend-analysis", "trend_analysis.json")
    ta = load_json(ta_path)

    top_topics = ta.get("top_30_topics", [])
    all_topic_names = [t.get("topic", "") for t in top_topics]

    # Build per-year ground truth
    topic_yearly_data = {}
    for tt in top_topics:
        topic = tt.get("topic", "")
        yearly = tt.get("yearly", {})
        topic_yearly_data[topic] = {int(k): int(v) for k, v in yearly.items() if int(v) > 0}

    all_years = sorted(set(
        y for t in topic_yearly_data.values() for y in t.keys()
    ))

    backtest_years = [y for y in [2025, 2024, 2023, 2022] if y in all_years]

    backtest_results = []

    for test_year in backtest_years:
        available_years = [y for y in all_years if y < test_year]
        if not available_years:
            continue

        ground_truth = set()
        for topic, ydata in topic_yearly_data.items():
            if test_year in ydata and ydata[test_year] > 0:
                ground_truth.add(topic)

        if not ground_truth:
            print(f"  Skipping {test_year}: no ground truth data available")
            continue

        period_5yr = list(range(test_year - 5, test_year))
        period_3yr = list(range(test_year - 3, test_year))

        topic_scores = {}
        for topic in all_topic_names:
            ydata = topic_yearly_data.get(topic, {})

            recent_3yr = sum(ydata.get(y, 0) for y in period_3yr if y in available_years)
            recent_5yr = sum(ydata.get(y, 0) for y in period_5yr if y in available_years)
            recent_3yr_avg = recent_3yr / max(len([y for y in period_3yr if y in available_years]), 1)
            recent_5yr_avg = recent_5yr / max(len([y for y in period_5yr if y in available_years]), 1)

            momentum = (recent_3yr_avg / max(recent_5yr_avg, 0.01)) * 100 if recent_5yr_avg > 0 else 0

            last_year_count = ydata.get(test_year - 1, 0)
            recency = min(last_year_count * 25, 100)

            streak = 0
            for y in reversed(available_years):
                if y in ydata and ydata[y] > 0:
                    streak += 1
                else:
                    break
            streak_score = min(streak * 10, 100)

            combined = momentum * 0.30 + recency * 0.25 + streak_score * 0.15
            topic_scores[topic] = combined

        sorted_topics = sorted(topic_scores.items(), key=lambda x: -x[1])
        n_predict = max(len(ground_truth), 10)
        predictions = set(t[0] for t in sorted_topics[:n_predict])

        true_positives = len(predictions & ground_truth)
        false_positives = len(predictions - ground_truth)
        false_negatives = len(ground_truth - predictions)

        precision = true_positives / max(true_positives + false_positives, 1)
        recall = true_positives / max(true_positives + false_negatives, 1)
        f1 = 2 * precision * recall / max(precision + recall, 0.001)

        backtest_results.append({
            "test_year": test_year,
            "ground_truth_topics": len(ground_truth),
            "predicted_topics": n_predict,
            "true_positives": true_positives,
            "false_positives": false_positives,
            "false_negatives": false_negatives,
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "f1_score": round(f1, 3),
            "top_ground_truth": sorted(list(ground_truth)),
            "top_predictions": [t[0] for t in sorted_topics[:n_predict]],
            "missed_topics": sorted(list(ground_truth - predictions)),
        })

    if backtest_results:
        avg_precision = sum(r["precision"] for r in backtest_results) / len(backtest_results)
        avg_recall = sum(r["recall"] for r in backtest_results) / len(backtest_results)
        avg_f1 = sum(r["f1_score"] for r in backtest_results) / len(backtest_results)
    else:
        avg_precision = avg_recall = avg_f1 = 0

    prediction_file = os.path.join(DATASET_DIR, "prediction", "prediction_2026.json")
    pred = load_json(prediction_file) if os.path.exists(prediction_file) else {}

    issues = []
    if avg_f1 < 0.3:
        issues.append({
            "check": "low_prediction_accuracy",
            "severity": "HIGH",
            "count": 1,
            "details": [{
                "avg_f1": round(avg_f1, 3),
                "note": "F1 < 0.3 indicates poor predictive power"
            }]
        })
    elif avg_f1 < 0.5:
        issues.append({
            "check": "moderate_prediction_accuracy",
            "severity": "MEDIUM",
            "count": 1,
            "details": [{
                "avg_f1": round(avg_f1, 3),
                "note": "F1 between 0.3-0.5 indicates moderate predictive power"
            }]
        })

    score = int(round(avg_f1 * 100, 0))

    result = {
        "audit": "Prediction Engine",
        "prediction_file": "prediction_2026.json",
        "prediction_year": pred.get("prediction_year", 2026),
        "backtesting_summary": {
            "average_precision": round(avg_precision, 3),
            "average_recall": round(avg_recall, 3),
            "average_f1": round(avg_f1, 3),
            "years_tested": [r["test_year"] for r in backtest_results]
        },
        "backtesting_details": backtest_results,
        "issues": issues,
        "score": score,
        "deductions": [{"issue": "baseline_f1_score", "deduction": int(round(100 - score, 0))}],
    }

    print(f"\n  Backtest results:")
    for r in backtest_results:
        print(f"    {r['test_year']}: P={r['precision']:.3f} R={r['recall']:.3f} F1={r['f1_score']:.3f} "
              f"(TP={r['true_positives']}, FP={r['false_positives']}, FN={r['false_negatives']})")
    print(f"  Average: Precision={avg_precision:.3f} Recall={avg_recall:.3f} F1={avg_f1:.3f}")
    print(f"  Score: {score}/100")

    return result, score


# ================================================================
# AUDIT 5: STUDY COACH
# ================================================================
def audit_study_coach():
    print("\n" + "=" * 70)
    print("  AUDIT 5: STUDY COACH VALIDATION")
    print("=" * 70)

    sp_path = os.path.join(DATASET_DIR, "study_plan.json")
    wp_path = os.path.join(DATASET_DIR, "weakness_profile.json")

    sp = load_json(sp_path)
    wp = load_json(wp_path)

    issues = []
    total_checks = 0

    # Synthetic students
    students = {
        "Student_A": {
            "name": "Kim Minho",
            "strengths": ["economy", "politics"],
            "weaknesses": ["history", "geography"],
            "weak_topics": ["세계대전", "기후·케펜구분", "지도·GIS"],
            "error_pattern": ["날짜/연대 혼동", "지도 위치 파악 실패", "그래프 해석 오류"],
            "scores": {"economy": 85, "politics": 80, "history": 40, "geography": 35, "society": 65}
        },
        "Student_B": {
            "name": "Tanaka Yuki",
            "strengths": ["history", "geography"],
            "weaknesses": ["economy", "society"],
            "weak_topics": ["환율·국제수지", "금융·통화정책", "사회보장·복지"],
            "error_pattern": ["경제 용어 이해 부족", "수치 계산 실수", "개념 혼동"],
            "scores": {"economy": 30, "politics": 55, "history": 90, "geography": 85, "society": 25}
        },
        "Student_C": {
            "name": "Lee Jisoo",
            "strengths": [],
            "weaknesses": ["economy", "politics", "history", "geography", "society"],
            "weak_topics": ["전체 기초 부족"],
            "error_pattern": ["모든 유형에서 낮은 정답률", "기초 개념 부족"],
            "scores": {"economy": 15, "politics": 20, "history": 10, "geography": 25, "society": 30}
        }
    }

    # 1. Validate study plan structure
    total_checks += 1
    structure_issues = []

    required_keys = ["today_study", "this_week_plan", "critical_weaknesses",
                     "pass_probability", "score_improvement_path", "study_efficiency_tips"]
    for key in required_keys:
        if key not in sp:
            structure_issues.append({"missing_key": key})

    schedule = sp.get("this_week_plan", {}).get("schedule", [])
    if len(schedule) != 7:
        structure_issues.append({"expected_days": 7, "actual_days": len(schedule)})

    day_fields = ["day", "focus", "topics", "estimated_minutes", "tasks"]
    for day in schedule:
        for field in day_fields:
            if field not in day:
                structure_issues.append({"day": day.get("day", "unknown"), "missing_field": field})

    if structure_issues:
        issues.append({
            "check": "study_plan_structure",
            "severity": "HIGH" if len(structure_issues) > 3 else "MEDIUM",
            "count": len(structure_issues),
            "details": structure_issues
        })

    # 2. Validate weakness profile
    total_checks += 1
    wp_issues = []
    required_wp_keys = ["domain_structure", "weakness_detection_framework",
                        "topic_analysis_framework", "trend_based_risk_factors"]
    for key in required_wp_keys:
        if key not in wp:
            wp_issues.append({"missing_key": key})

    tiers = wp.get("topic_analysis_framework", {})
    for tier_name, tier_topics in tiers.items():
        if isinstance(tier_topics, list):
            dupes = [item for item, count in Counter(tier_topics).items() if count > 1]
            if dupes:
                wp_issues.append({
                    "tier": tier_name,
                    "duplicates": dupes
                })

    if wp_issues:
        issues.append({
            "check": "weakness_profile_issues",
            "severity": "MEDIUM",
            "count": len(wp_issues),
            "details": wp_issues
        })

    # 3. Validate student simulations
    total_checks += 1
    simulation_results = {}

    for sname, sdata in students.items():
        sim = {"student": sdata["name"], "analysis": {}}

        critical = sp.get("critical_weaknesses", {}).get("most_dangerous_topics", [])

        week_topics = set()
        for day in schedule:
            for t in day.get("topics", []):
                week_topics.add(t)

        prereq_gaps = sp.get("critical_weaknesses", {}).get("prerequisite_gaps", {})
        prereq_aware = len(prereq_gaps) > 0

        sim["analysis"] = {
            "weak_domains": sdata["weaknesses"],
            "strong_domains": sdata["strengths"],
            "week_topics_cover_high_frequency": len(week_topics & set(
                t["topic"] for t in critical
            )),
            "prerequisite_chains_present": prereq_aware,
            "has_score_improvement_path": "score_improvement_path" in sp,
            "has_pass_probability": "pass_probability" in sp,
            "total_week_topics": len(week_topics),
        }

        reasonableness = 0
        if sim["analysis"]["prerequisite_chains_present"]:
            reasonableness += 25
        if sim["analysis"]["has_score_improvement_path"]:
            reasonableness += 20
        if sim["analysis"]["has_pass_probability"]:
            reasonableness += 20
        if sim["analysis"]["week_topics_cover_high_frequency"] >= 2:
            reasonableness += 20
        if len(sdata["weaknesses"]) > 0:
            reasonableness += 15

        sim["reasonableness_score"] = min(reasonableness, 100)

        recommendations = []
        if sname == "Student_A":
            if "기후·케펜구분" in week_topics:
                recommendations.append("기후·케펜구분 coverage: GOOD")
            else:
                recommendations.append("기후·케펜구분 (weakness) not in weekly plan: MISSING")
            if "세계대전" in week_topics:
                recommendations.append("세계대전 coverage: GOOD")
            else:
                recommendations.append("세계대전 (weakness) not in weekly plan: MISSING")
        elif sname == "Student_B":
            if "환율·국제수지" in week_topics:
                recommendations.append("환율·국제수지 coverage: GOOD")
            else:
                recommendations.append("환율·국제수지 (weakness) not in weekly plan: MISSING")
            if "금융·통화정책" in week_topics:
                recommendations.append("금융·통화정책 coverage: GOOD")
            else:
                recommendations.append("금융·통화정책 (weakness) not in weekly plan: MISSING")
        elif sname == "Student_C":
            if len(week_topics) >= 5:
                recommendations.append("Broad topic coverage suitable for all-level weakness: GOOD")

        sim["recommendations"] = recommendations
        simulation_results[sname] = sim

    # Score
    score = 100
    deductions = []
    for iss in issues:
        severity = iss["severity"]
        count = iss["count"]
        if severity == "HIGH":
            deduction = min(count * 10, 40)
        elif severity == "MEDIUM":
            deduction = min(count * 5, 20)
        else:
            deduction = min(count * 2, 10)
        score -= deduction
        deductions.append({"issue": iss["check"], "deduction": deduction})
    score = int(max(0, score))

    result = {
        "audit": "Study Coach",
        "study_plan_version": sp.get("version", "unknown"),
        "weakness_profile_version": wp.get("version", "unknown"),
        "generated_at": sp.get("generated_at", ""),
        "synthetic_students": simulation_results,
        "checks_performed": total_checks,
        "issues_found": len(issues),
        "issues": issues,
        "score": score,
        "deductions": deductions,
    }

    print(f"\n  Student simulations:")
    for sname, sim in simulation_results.items():
        print(f"    {sname} ({sim['student']}): {sim['reasonableness_score']}/100")
        for rec in sim["recommendations"]:
            print(f"      -> {rec}")
    print(f"\n  Issues found: {len(issues)}")
    for iss in issues:
        print(f"    [{iss['severity']:^6}] {iss['check']}: {iss['count']}")
    print(f"  Score: {score}/100")

    return result, score


# ================================================================
# FINAL SYSTEM SCORE
# ================================================================
def compute_system_score(all_scores):
    scores_map = {}
    for name, score in all_scores:
        scores_map[name] = score

    weights = {
        "Knowledge Graph": 0.20,
        "Trend Analysis": 0.20,
        "Difficulty Engine": 0.20,
        "Prediction Engine": 0.20,
        "Study Coach": 0.20,
    }

    weighted_sum = 0
    total_weight = 0
    for name, weight in weights.items():
        if name in scores_map:
            weighted_sum += scores_map[name] * weight
            total_weight += weight

    if total_weight > 0:
        system_score = round(weighted_sum / total_weight, 1)
    else:
        system_score = 0

    if system_score >= 80:
        recommendation = "RECOMMENDED"
        confidence = "HIGH"
        detail = "System quality sufficient for real EJU examinee recommendations"
    elif system_score >= 60:
        recommendation = "CONDITIONALLY RECOMMENDED"
        confidence = "MODERATE"
        detail = "System usable with caveats; improvements needed in lower-scoring components"
    elif system_score >= 40:
        recommendation = "NOT RECOMMENDED FOR PRODUCTION"
        confidence = "LOW"
        detail = "Significant quality issues; not suitable for real examinee recommendations"
    else:
        recommendation = "REJECTED"
        confidence = "VERY LOW"
        detail = "Critical quality failures; system requires fundamental rebuild"

    return {
        "system_score": system_score,
        "component_scores": scores_map,
        "weights": weights,
        "weighted_calculation": {
            name: f"{scores_map.get(name, 0)} * {weights.get(name, 0)} = {scores_map.get(name, 0) * weights.get(name, 0):.1f}"
            for name in weights
        },
        "recommendation": recommendation,
        "confidence": confidence,
        "detail": detail,
    }


def main():
    print(r"""
    ====================================================================
       EJU INTELLIGENCE SYSTEM - COMPREHENSIVE QUALITY AUDIT
           Quality Verification of All Subsystems
    ====================================================================
    """)

    all_scores = []

    kg_result, kg_score = audit_knowledge_graph()
    all_scores.append(("Knowledge Graph", kg_score))

    ta_result, ta_score = audit_trend_analysis()
    all_scores.append(("Trend Analysis", ta_score))

    de_result, de_score = audit_difficulty_engine()
    all_scores.append(("Difficulty Engine", de_score))

    pe_result, pe_score = audit_prediction_engine()
    all_scores.append(("Prediction Engine", pe_score))

    sc_result, sc_score = audit_study_coach()
    all_scores.append(("Study Coach", sc_score))

    system = compute_system_score(all_scores)

    print("\n" + "=" * 70)
    print("  FINAL SYSTEM SCORE")
    print("=" * 70)
    print(f"\n  Overall System Score: {system['system_score']}/100")
    print(f"  Recommendation:      {system['recommendation']}")
    print(f"  Confidence:          {system['confidence']}")
    print(f"  Detail:              {system['detail']}")
    print()
    print(f"  Component Scores:")
    for name, score in system["component_scores"].items():
        bar_count = int(score // 5)
        bar = chr(9608) * bar_count + chr(9617) * (20 - bar_count)
        print(f"    {name:<20s} {score:5.1f}/100  {bar}")
    print()

    outputs = {
        "knowledge_graph_audit.json": kg_result,
        "trend_validation.json": ta_result,
        "difficulty_validation.json": de_result,
        "prediction_accuracy.json": pe_result,
        "study_plan_validation.json": sc_result,
        "system_score.json": system,
    }

    for fname, data in outputs.items():
        fpath = os.path.join(OUTPUT_DIR, fname)
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  Saved: {fpath}")

    print(f"\n  All audit results saved to dataset/")

    return system


if __name__ == "__main__":
    result = main()
