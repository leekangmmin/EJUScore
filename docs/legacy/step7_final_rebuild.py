#!/usr/bin/env python3
"""
EJU Intelligence Platform — FINAL COMPREHENSIVE REBUILD
=========================================================
Uses high-quality classified data (99.7% domain, 96.7% topic) to rebuild:
  - Trend Analysis
  - Gold Standard
  - Predictions (2026-2030)
  - Knowledge Graph
  - Weakness Analysis
  - Difficulty DB
  - Study Plan
  - Math Analysis
  - Final Audit
"""
import json
import os
import glob
import sys
from datetime import datetime
from collections import defaultdict, Counter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) or "."
OUTPUT_DIR = os.path.join(BASE_DIR, "dataset")
OCR_DIR = os.path.join(OUTPUT_DIR, "comprehensive")
MATH_DIR = os.path.join(OUTPUT_DIR, "mathematics")
TREND_DIR = os.path.join(OUTPUT_DIR, "trend-analysis")
PRED_DIR = os.path.join(OUTPUT_DIR, "prediction")
GOLD_DIR = os.path.join(OUTPUT_DIR, "gold_standard")
DIFF_DIR = os.path.join(OUTPUT_DIR, "difficulty")
KG_DIR = os.path.join(OUTPUT_DIR, "knowledge-graph")
TOPIC_DIR = os.path.join(OUTPUT_DIR, "topic-frequency")

for d in [TREND_DIR, PRED_DIR, GOLD_DIR, DIFF_DIR, KG_DIR, TOPIC_DIR]:
    os.makedirs(d, exist_ok=True)


def load_questions():
    """Load reclassified data + vision data."""
    # Load reclassified OCR data
    with open(os.path.join(OUTPUT_DIR, "training", "reclassified_ocr_data.json"), "r", encoding="utf-8") as f:
        data = json.load(f)
    
    ocr_qs = data["ocr_questions"]
    vision_qs = data["vision_questions"]
    
    # Standardize format
    all_qs = []
    for q in ocr_qs:
        all_qs.append({
            "year": q["year"],
            "round": q["round"],
            "question_number": q["question_number"],
            "domain": q["domain"] if q["domain"] != "unknown" else "unclassified",
            "topic": q["topic"] if q["topic"] else "untopicized",
            "source": "ocr",
        })
    
    for q in vision_qs:
        all_qs.append({
            "year": q["year"],
            "round": q["round"],
            "question_number": q["question_number"],
            "domain": q["domain"] if q["domain"] != "unknown" else "unclassified",
            "topic": q["topic"] if q["topic"] else "untopicized",
            "source": "vision",
        })
    
    return all_qs


def load_math_questions():
    """Load math questions."""
    all_qs = []
    for fpath in sorted(glob.glob(os.path.join(MATH_DIR, "*", "exam_*.json"))):
        with open(fpath, "r", encoding="utf-8") as f:
            exam = json.load(f)
        year = exam.get("year", 0)
        round_num = exam.get("round", 0)
        
        for q in exam.get("questions", []):
            all_qs.append({
                "year": year,
                "round": round_num,
                "question_number": q.get("number", 0),
                "section": q.get("section", 0),
                "topic": q.get("topic", "uncategorized"),
                "text": q.get("text_snippet", ""),
                "source": "math",
            })
    
    return all_qs


def compute_trends(all_qs):
    """Compute comprehensive trend analysis."""
    # Yearly domain counts
    domain_year = defaultdict(lambda: defaultdict(int))
    topic_year = defaultdict(lambda: defaultdict(int))
    all_years = set()
    untopicized = 0
    
    for q in all_qs:
        y = q["year"]
        d = q["domain"]
        t = q["topic"]
        all_years.add(y)
        domain_year[d][y] += 1
        topic_year[t][y] += 1
        if t == "untopicized":
            untopicized += 1
    
    years_sorted = sorted(all_years)
    current_year = max(years_sorted) if years_sorted else 2025
    
    # Domain trends
    domain_trends = {}
    for domain in sorted(domain_year.keys()):
        yearly = dict(domain_year[domain])
        total = sum(yearly.values())
        recent_5 = sum(yearly.get(y, 0) for y in range(current_year-4, current_year+1))
        before_5 = sum(yearly.get(y, 0) for y in years_sorted if y < current_year-4)
        
        domain_trends[domain] = {
            "total": total,
            "yearly": yearly,
            "recent_5yr_total": recent_5,
            "before_5yr_total": before_5,
            "growth_rate_pct": round(((recent_5 - before_5) / max(before_5, 1)) * 100, 1),
            "avg_per_year": round(total / max(len(years_sorted), 1), 1),
        }
    
    # Topic trends
    topic_trends = {}
    for topic in sorted(topic_year.keys()):
        if topic == "untopicized":
            continue
        yearly = dict(topic_year[topic])
        total = sum(yearly.values())
        years_appeared = sorted([y for y, c in yearly.items() if c > 0])
        
        if not years_appeared:
            continue
        
        first_year = years_appeared[0]
        last_year = years_appeared[-1]
        
        # Determine domain
        topic_domain = "unknown"
        for q in all_qs:
            if q["topic"] == topic:
                topic_domain = q["domain"]
                break
        
        recent_5 = sum(yearly.get(y, 0) for y in range(current_year-4, current_year+1))
        before_5 = sum(yearly.get(y, 0) for y in years_sorted if y < current_year-4)
        gap = current_year - last_year
        
        # Consecutive count (going backwards)
        consecutive = 0
        for y in range(last_year, first_year - 1, -1):
            if yearly.get(y, 0) > 0:
                consecutive += 1
            else:
                break
        
        period_3yr = sum(yearly.get(y, 0) for y in range(current_year-2, current_year+1))
        period_5yr = recent_5
        period_10yr = sum(yearly.get(y, 0) for y in range(current_year-9, current_year+1))
        
        topic_trends[topic] = {
            "topic": topic,
            "domain": topic_domain,
            "total_count": total,
            "years_appeared": len(years_appeared),
            "first_appeared_year": first_year,
            "last_appeared_year": last_year,
            "gap_years": gap,
            "period_3yr_count": period_3yr,
            "period_5yr_count": period_5yr,
            "period_10yr_count": period_10yr,
            "before_5yr_count": before_5,
            "growth_rate_pct": round(((recent_5 - before_5) / max(before_5, 1)) * 100, 1),
            "recent_avg_per_year": round(recent_5 / 5, 2),
            "before_avg_per_year": round(before_5 / max(len([y for y in years_sorted if y < current_year-4]), 1), 2),
            "consecutive_appearances": consecutive,
            "frequency_per_exam": round(total / max(len(years_sorted), 1), 2),
        }
    
    # Derived lists
    all_topics = sorted(topic_trends.items(), key=lambda x: -x[1]["total_count"])
    
    top_100 = [{"topic": t, **v} for t, v in all_topics[:100]]
    growing = [{"topic": t, **v} for t, v in all_topics if v["growth_rate_pct"] > 20 and v["total_count"] >= 3]
    declining = [{"topic": t, **v} for t, v in all_topics if v["growth_rate_pct"] < -20 and v["total_count"] >= 3]
    stable = [{"topic": t, **v} for t, v in all_topics if -20 <= v["growth_rate_pct"] <= 20 and v["total_count"] >= 3]
    emerging = [{"topic": t, **v} for t, v in all_topics if v["first_appeared_year"] >= current_year - 3]
    disappearing = [{"topic": t, **v} for t, v in all_topics if v["gap_years"] >= 5 and v["total_count"] >= 2]
    high_consecutive = [{"topic": t, **v} for t, v in all_topics if v["consecutive_appearances"] >= 3]
    gap = [{"topic": t, **v} for t, v in all_topics if v["gap_years"] >= 3 and v["total_count"] >= 2]
    
    return {
        "generated_at": datetime.now().isoformat(),
        "subject": "comprehensive",
        "analysis_period": f"{min(years_sorted)}-{max(years_sorted)}",
        "total_years": len(years_sorted),
        "total_questions_analyzed": len(all_qs),
        "total_topics_tracked": len([t for t in topic_trends]),
        "untopicized_count": untopicized,
        "domain_trends": domain_trends,
        "topic_trends": topic_trends,
        "top_100_topics": top_100,
        "growing_topics": growing,
        "declining_topics": declining,
        "stable_topics": stable,
        "emerging_topics": emerging,
        "disappearing_topics": disappearing,
        "high_consecutive_topics": high_consecutive,
        "gap_topics": gap,
        "statistics": {
            "total_domains": len(domain_trends),
            "total_topics": len(topic_trends),
            "untopicized_count": untopicized,
        },
        "year_range": [min(years_sorted), max(years_sorted)],
    }


def compute_predictions(topic_trends, years_sorted, current_year=2025):
    """Compute predictions for 2026-2030."""
    predictions = {}
    
    for target_year in [2026, 2027, 2028, 2029, 2030]:
        preds = []
        
        for topic_name, td in topic_trends.items():
            total = td["total_count"]
            last_year = td["last_appeared_year"]
            gap = td["gap_years"]
            recent_5 = td["period_5yr_count"]
            consecutive = td["consecutive_appearances"]
            growth = td["growth_rate_pct"]
            recent_avg = td["recent_avg_per_year"]
            before_avg = td["before_avg_per_year"]
            domain = td["domain"]
            
            years_since_last = target_year - last_year
            
            # Multi-factor scoring
            recency = max(0, 1.0 - (years_since_last / 8))
            frequency = min(1.0, total / max(len(years_sorted) * 0.3, 1))
            
            if before_avg > 0:
                momentum = min(1.0, max(-0.5, (recent_avg - before_avg) / max(before_avg, 0.1)))
            else:
                momentum = min(0.3, recent_avg * 0.3)
            
            # Cycle: topics reappear after 2-6 year gaps
            cycle = 0
            if 2 <= gap <= 6:
                cycle = min(0.8, (gap - 1) * 0.15)
            elif gap > 6:
                cycle = max(0, 0.8 - (gap - 6) * 0.05)
            elif gap == 0 and consecutive > 0:
                cycle = min(0.5, consecutive * 0.1)
            
            consecutive_score = min(0.5, consecutive * 0.1)
            
            weights = {"recency": 0.25, "frequency": 0.25, "momentum": 0.15, "cycle": 0.20, "consecutive": 0.15}
            combined = (
                weights["recency"] * recency +
                weights["frequency"] * frequency +
                weights["momentum"] * max(0, momentum) +
                weights["cycle"] * cycle +
                weights["consecutive"] * consecutive_score
            )
            
            # Boost recent topics
            if years_since_last <= 2 and total >= 3:
                combined *= 1.1
            if years_since_last <= 1 and total >= 2:
                combined = min(combined * 1.2, 0.95)
            
            confidence = min(0.95, combined * 0.8 + 0.1)
            
            preds.append({
                "topic": topic_name,
                "domain": domain,
                "prediction_score": round(min(combined, 0.95), 3),
                "probability_pct": round(min(combined * 100, 95), 1),
                "recency_score": round(recency, 3),
                "frequency_score": round(frequency, 3),
                "momentum_score": round(momentum, 3),
                "cycle_score": round(cycle, 3),
                "confidence": round(confidence, 3),
                "total_24yr_count": total,
                "recent_5yr_count": recent_5,
                "last_appeared": last_year,
                "gap_years": gap,
                "consecutive": consecutive,
                "basis": f"Last {last_year}, total {total}x, {recent_5} in 5yr, gap {gap}yr",
            })
        
        preds.sort(key=lambda x: -x["prediction_score"])
        
        predictions[target_year] = {
            "year": target_year,
            "total_predictions": len(preds),
            "top_predictions": preds[:40],
        }
    
    return predictions


def build_weakness_analysis(topic_trends, predictions):
    """Build weakness/error analysis."""
    concept_links = {
        "시민혁명": ["계몽사상", "인권선언", "권리장전"],
        "프랑스혁명": ["계몽사상", "인권선언", "루소", "몽테스키외"],
        "산업혁명·자본주의": ["증기기관", "면방직", "자본주의"],
        "금융·통화정책": ["중앙은행", "금리", "통화량"],
        "환율·국제수지": ["변동환율", "고정환율", "경상수지"],
        "GDP·국민소득": ["국내총생산", "1인당소득"],
        "기후·케펜구분": ["케펜기후구분", "온대", "열대", "건조"],
        "헌법·기본권": ["기본권", "삼권분립"],
        "통치기구": ["삼권분립", "의원내각제"],
        "세계대전": ["제국주의", "민족주의", "베르사유조약"],
        "냉전": ["마셜플랜", "NATO", "바르샤바조약"],
    }
    
    topics = []
    for topic_name, td in sorted(topic_trends.items(), key=lambda x: -x[1]["total_count"]):
        total = td["total_count"]
        recent_5 = td["period_5yr_count"]
        last_year = td["last_appeared_year"]
        gap = td["gap_years"]
        domain = td["domain"]
        
        # Find prediction
        pred_prob = 0
        for year_data in predictions.values():
            for p in year_data.get("top_predictions", []):
                if p["topic"] == topic_name:
                    pred_prob = p["probability_pct"]
                    break
        
        # Priority
        if total >= 15 and recent_5 >= 5 and gap <= 2:
            priority, impact = "A+", 4.3
        elif total >= 10 and recent_5 >= 3 and gap <= 3:
            priority, impact = "A", 3.5
        elif total >= 5 and gap <= 4:
            priority, impact = "B+", 2.5
        elif total >= 3:
            priority, impact = "B", 1.8
        else:
            priority, impact = "C", 1.0
        
        related = [
            t for t, d in topic_trends.items()
            if d["domain"] == domain and t != topic_name
        ][:5]
        
        prereqs = concept_links.get(topic_name, [])
        
        topics.append({
            "topic": topic_name,
            "domain": domain,
            "total_count": total,
            "recent_5yr": recent_5,
            "last_appeared": last_year,
            "gap_years": gap,
            "prediction_probability": pred_prob,
            "priority": priority,
            "estimated_score_impact": impact,
            "related_topics": related,
            "prerequisite_concepts": prereqs,
        })
    
    return {
        "generated_at": datetime.now().isoformat(),
        "total_topics_analyzed": len(topics),
        "topics": topics,
        "priority_distribution": dict(Counter(t["priority"] for t in topics)),
    }


def build_knowledge_graph(all_qs, math_qs=None):
    """Build knowledge graph."""
    nodes, edges = [], []
    seen = set()
    
    def add_node(nid, ntype, label, domain="", size=10):
        if nid not in seen:
            nodes.append({"id": nid, "type": ntype, "label": label, "domain": domain, "size": size})
            seen.add(nid)
    
    # Domain nodes
    domains = set()
    for q in all_qs:
        if q["domain"] != "unclassified":
            domains.add(q["domain"])
    
    for d in sorted(domains):
        count = sum(1 for q in all_qs if q["domain"] == d)
        add_node(f"domain_{d}", "domain", d, "", min(count, 50))
    
    # Topic nodes
    topics = set()
    for q in all_qs:
        if q["topic"] and q["topic"] != "untopicized":
            topics.add(q["topic"])
    
    for t in sorted(topics):
        domain = ""
        for q in all_qs:
            if q["topic"] == t:
                domain = q["domain"]
                break
        count = sum(1 for q in all_qs if q["topic"] == t)
        add_node(f"topic_{t}", "topic", t, domain, min(count * 2, 30))
    
    # Edges: domain → topic
    for t in topics:
        domain = ""
        for q in all_qs:
            if q["topic"] == t:
                domain = q["domain"]
                break
        if domain and f"domain_{domain}" in seen:
            weight = sum(1 for q in all_qs if q["topic"] == t and q["domain"] == domain)
            edges.append({"source": f"domain_{domain}", "target": f"topic_{t}", "type": "contains", "weight": weight})
    
    # Concept links
    concept_links = {
        "시민혁명": ["계몽사상", "인권선언", "권리장전"],
        "프랑스혁명": ["계몽사상", "인권선언", "루소", "몽테스키외"],
        "산업혁명·자본주의": ["증기기관", "면방직", "자본주의"],
        "금융·통화정책": ["중앙은행", "금리", "통화량"],
        "환율·국제수지": ["변동환율", "고정환율", "경상수지"],
        "GDP·국민소득": ["국내총생산", "1인당소득"],
        "기후·케펜구분": ["케펜기후구분", "온대", "열대", "건조"],
        "헌법·기본권": ["기본권", "삼권분립"],
        "통치기구": ["삼권분립", "의원내각제"],
        "세계대전": ["제국주의", "민족주의", "베르사유조약"],
        "냉전": ["마셜플랜", "NATO", "바르샤바조약"],
        "수요·공급과 시장균형": ["수요법칙", "공급법칙", "탄력성"],
    }
    
    for topic, concepts in concept_links.items():
        if f"topic_{topic}" in seen:
            for concept in concepts:
                add_node(f"concept_{concept}", "concept", concept)
                edges.append({"source": f"topic_{topic}", "target": f"concept_{concept}", "type": "requires", "weight": 1})
    
    # Math nodes
    if math_qs:
        math_topics = set()
        for q in math_qs:
            if q.get("topic"):
                math_topics.add(q["topic"])
        
        add_node("domain_mathematics", "domain", "mathematics")
        
        for mt in sorted(math_topics):
            count = sum(1 for q in math_qs if q.get("topic") == mt)
            add_node(f"math_topic_{mt}", "math_topic", mt, "mathematics", min(count, 20))
            edges.append({"source": "domain_mathematics", "target": f"math_topic_{mt}", "type": "contains", "weight": count})
    
    return {
        "generated_at": datetime.now().isoformat(),
        "total_nodes": len(nodes),
        "total_edges": len(edges),
        "nodes": nodes,
        "edges": edges,
    }


def compute_math_analysis(math_qs):
    """Compute math-specific analysis."""
    topic_counts = defaultdict(lambda: {"count": 0, "years": set(), "yearly": defaultdict(int)})
    
    for q in math_qs:
        t = q.get("topic", "uncategorized")
        y = q["year"]
        topic_counts[t]["count"] += 1
        topic_counts[t]["years"].add(y)
        topic_counts[t]["yearly"][y] += 1
    
    current_year = max(q["year"] for q in math_qs) if math_qs else 2025
    topics = []
    
    for topic, data in sorted(topic_counts.items(), key=lambda x: -x[1]["count"]):
        recent_5 = sum(data["yearly"].get(y, 0) for y in range(current_year-4, current_year+1))
        before_5 = data["count"] - recent_5
        
        topics.append({
            "topic": topic,
            "total_count": data["count"],
            "years_count": len(data["years"]),
            "recent_5yr": recent_5,
            "before_5yr": before_5,
            "growth_rate": round(((recent_5 - before_5) / max(before_5, 1)) * 100, 1),
        })
    
    return {
        "generated_at": datetime.now().isoformat(),
        "total_questions": len(math_qs),
        "total_topics": len(topics),
        "topics": topics,
    }


def final_audit(all_qs, math_qs, trends, predictions, kg, math_analysis):
    """Generate final audit."""
    total = len(all_qs)
    total_math = len(math_qs)
    
    domain_known = sum(1 for q in all_qs if q["domain"] != "unclassified")
    topic_known = sum(1 for q in all_qs if q["topic"] != "untopicized")
    
    audit = {
        "generated_at": datetime.now().isoformat(),
        "total_questions": total,
        "total_math_questions": total_math,
        "domain_classification_rate": round(domain_known / total * 100, 1),
        "topic_classification_rate": round(topic_known / total * 100, 1),
        "total_topics_tracked": trends["total_topics_tracked"],
        "untopicized_count": trends["untopicized_count"],
        "trend_years": trends["total_years"],
        "trend_questions": trends["total_questions_analyzed"],
        "prediction_count": sum(len(v["top_predictions"]) for v in predictions.values()),
        "kg_nodes": kg["total_nodes"],
        "kg_edges": kg["total_edges"],
        "math_topics": len(math_analysis.get("topics", [])),
    }
    
    return audit


def main():
    print("=" * 70)
    print("EJU FINAL COMPREHENSIVE REBUILD")
    print("=" * 70)
    
    # Load data
    print("\n📂 Loading classified data...")
    all_qs = load_questions()
    math_qs = load_math_questions()
    
    print(f"  Comprehensive: {len(all_qs)} questions")
    print(f"  Mathematics: {len(math_qs)} questions")
    
    domain_rate = sum(1 for q in all_qs if q["domain"] != "unclassified") / len(all_qs) * 100
    topic_rate = sum(1 for q in all_qs if q["topic"] != "untopicized") / len(all_qs) * 100
    print(f"  Domain rate: {domain_rate:.1f}%")
    print(f"  Topic rate: {topic_rate:.1f}%")
    
    # 1. Trend Analysis
    print("\n📈 Building Trend Analysis...")
    trends = compute_trends(all_qs)
    
    ta_path = os.path.join(TREND_DIR, "trend_analysis_complete.json")
    with open(ta_path, "w", encoding="utf-8") as f:
        json.dump(trends, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {ta_path}")
    print(f"     Topics: {trends['total_topics_tracked']}, Questions: {trends['total_questions_analyzed']}")
    
    # 2. Predictions
    print("\n🔮 Building Predictions (2026-2030)...")
    years = list(range(trends["year_range"][0], trends["year_range"][1] + 1))
    predictions = compute_predictions(trends["topic_trends"], years, 2025)
    
    pred_path = os.path.join(PRED_DIR, "prediction_2026_2028.json")
    with open(pred_path, "w", encoding="utf-8") as f:
        json.dump(predictions, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {pred_path}")
    for y, d in sorted(predictions.items()):
        top3 = [p["topic"] for p in d["top_predictions"][:3]]
        print(f"     {y}: {len(d['top_predictions'])} predictions, Top: {', '.join(top3)}")
    
    # 3. Weakness Analysis
    print("\n🎯 Building Weakness Analysis...")
    weakness = build_weakness_analysis(trends["topic_trends"], predictions)
    
    weak_path = os.path.join(PRED_DIR, "weakness_connector.json")
    with open(weak_path, "w", encoding="utf-8") as f:
        json.dump(weakness, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {weak_path}")
    
    weak_profile_path = os.path.join(OUTPUT_DIR, "weakness_profile.json")
    with open(weak_profile_path, "w", encoding="utf-8") as f:
        json.dump(weakness, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {weak_profile_path}")
    
    # 4. Knowledge Graph
    print("\n🕸️ Building Knowledge Graph...")
    kg = build_knowledge_graph(all_qs, math_qs)
    
    kg_path = os.path.join(KG_DIR, "knowledge_graph_v3.json")
    with open(kg_path, "w", encoding="utf-8") as f:
        json.dump(kg, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {kg_path} ({kg['total_nodes']} nodes, {kg['total_edges']} edges)")
    
    kg_v2_path = os.path.join(KG_DIR, "knowledge_graph.json")
    with open(kg_v2_path, "w", encoding="utf-8") as f:
        json.dump(kg, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {kg_v2_path} (v2 compat)")
    
    # 5. Math Analysis
    print("\n🔢 Building Math Analysis...")
    math_analysis = compute_math_analysis(math_qs)
    
    math_ta_path = os.path.join(TREND_DIR, "math_trend_analysis.json")
    with open(math_ta_path, "w", encoding="utf-8") as f:
        json.dump(math_analysis, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {math_ta_path}")
    
    # 6. Difficulty DB
    print("\n📊 Building Difficulty & Study Plan...")
    
    diff_counter = Counter()
    for q in all_qs:
        diff_counter[q["domain"]] += 1
    
    diff_db = {
        "generated_at": datetime.now().isoformat(),
        "total_questions": len(all_qs),
        "domain_distribution": dict(diff_counter.most_common()),
    }
    
    diff_path = os.path.join(DIFF_DIR, "difficulty_database.json")
    with open(diff_path, "w", encoding="utf-8") as f:
        json.dump(diff_db, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {diff_path}")
    
    # Math difficulty
    math_diff_db = {
        "generated_at": datetime.now().isoformat(),
        "total_questions": len(math_qs),
        "topics": dict(Counter(q.get("topic", "unknown") for q in math_qs).most_common()),
    }
    math_diff_path = os.path.join(DIFF_DIR, "math_difficulty_database.json")
    with open(math_diff_path, "w", encoding="utf-8") as f:
        json.dump(math_diff_db, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {math_diff_path}")
    
    # 7. Topic frequency files
    domain_freq = Counter(q["domain"] for q in all_qs if q["domain"] != "unclassified")
    topic_freq = Counter(q["topic"] for q in all_qs if q["topic"] != "untopicized")
    
    df_path = os.path.join(TOPIC_DIR, "domain_frequency.json")
    with open(df_path, "w", encoding="utf-8") as f:
        json.dump(dict(domain_freq.most_common()), f, ensure_ascii=False, indent=2)
    
    tf_path = os.path.join(TOPIC_DIR, "topic_frequency.json")
    with open(tf_path, "w", encoding="utf-8") as f:
        json.dump(dict(topic_freq.most_common()), f, ensure_ascii=False, indent=2)
    print(f"  ✅ Topic frequency files saved")
    
    # 8. Study Plan
    study_plan = {
        "generated_at": datetime.now().isoformat(),
        "total_topics": trends["total_topics_tracked"],
        "priority_distribution": weakness.get("priority_distribution", {}),
        "top_recommendations": [t["topic"] for t in trends.get("top_100_topics", [])[:30]],
    }
    sp_path = os.path.join(OUTPUT_DIR, "study_plan.json")
    with open(sp_path, "w", encoding="utf-8") as f:
        json.dump(study_plan, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {sp_path}")
    
    # 9. Gold Standard
    print("\n🥇 Building Gold Standard...")
    gold_qs = []
    for q in all_qs:
        gold_qs.append({
            "year": q["year"],
            "round": q["round"],
            "question_number": q["question_number"],
            "domain": q["domain"],
            "topic": q["topic"] if q["topic"] != "untopicized" else "",
            "source": q["source"],
        })
    
    gold = {
        "dataset_name": "EJU Gold Standard Dataset",
        "version": "2.0.0",
        "generated_at": datetime.now().isoformat(),
        "source": f"Enhanced classification ({len(gold_qs)} questions)",
        "total_questions": len(gold_qs),
        "year_range": {
            "start": trends["year_range"][0],
            "end": trends["year_range"][1],
        },
        "domain_distribution": dict(domain_freq.most_common()),
        "questions": gold_qs,
    }
    gs_path = os.path.join(GOLD_DIR, "gold_standard.json")
    with open(gs_path, "w", encoding="utf-8") as f:
        json.dump(gold, f, ensure_ascii=False, indent=2)
    print(f"  ✅ {gs_path}")
    
    # 10. Final Audit
    print("\n✅ Generating Final Audit...")
    audit = final_audit(all_qs, math_qs, trends, predictions, kg, math_analysis)
    
    print("\n" + "=" * 50)
    print("FINAL AUDIT RESULTS")
    print("=" * 50)
    print(f"  총 문항 수:       {audit['total_questions']}")
    print(f"  수학 문항 수:     {audit['total_math_questions']}")
    print(f"  도메인 분류율:    {audit['domain_classification_rate']}%")
    print(f"  토픽 분류율:      {audit['topic_classification_rate']}%")
    print(f"  추적 토픽:        {audit['total_topics_tracked']}")
    print(f"  미분류(untopic):  {audit['untopicized_count']}")
    print(f"  트렌드 반영 연도: {audit['trend_years']}년")
    print(f"  트렌드 반영 문항: {audit['trend_questions']}문항")
    print(f"  예측 데이터:      {audit['prediction_count']}개")
    print(f"  그래프 노드:      {audit['kg_nodes']}")
    print(f"  그래프 엣지:      {audit['kg_edges']}")
    print(f"  수학 토픽:        {audit['math_topics']}")
    
    verdict = "PASS" if (
        audit['domain_classification_rate'] >= 99 and
        audit['topic_classification_rate'] >= 95 and
        audit['total_topics_tracked'] >= 30
    ) else "FAIL"
    
    print(f"\n  {'='*30}")
    print(f"  FINAL VERDICT: {verdict}")
    print(f"  {'='*30}")
    
    # Save audit
    audit_path = os.path.join(OUTPUT_DIR, "reports", "final_completion_audit.json")
    os.makedirs(os.path.dirname(audit_path), exist_ok=True)
    with open(audit_path, "w", encoding="utf-8") as f:
        json.dump(audit, f, ensure_ascii=False, indent=2)
    print(f"\n  ✅ Audit saved: {audit_path}")
    
    return audit


if __name__ == "__main__":
    audit = main()
