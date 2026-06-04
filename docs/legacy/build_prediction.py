#!/usr/bin/env python3
"""
EJU Intelligence Platform - Future Prediction Engine (Step 5)
Predicts 2026 exam topics based on 2002-2025 trend analysis.

Methodology:
  1. Recent trend momentum (last 5 years)
  2. Consecutive appearance streaks  
  3. Cyclical patterns (topics that appear every N years)
  4. Emerging topic detection
  5. Domain balance (EJU maintains ~5 domain ratio)
"""
import json
import os
import sys
import glob
from datetime import datetime
from collections import defaultdict

OUTPUT_DIR = "dataset/prediction"
TREND_DIR = "dataset/trend-analysis"
KG_DIR = "dataset/knowledge-graph"

os.makedirs(OUTPUT_DIR, exist_ok=True)


def load_trend_data():
    """Load trend analysis from Step 3."""
    path = os.path.join(TREND_DIR, "trend_analysis_v2.json")
    if not os.path.exists(path):
        print(f"  Error: Trend data not found at {path}")
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_knowledge_graph():
    """Load knowledge graph for topic metadata."""
    path = os.path.join(KG_DIR, "knowledge_graph_v3.json")
    if not os.path.exists(path):
        print(f"  Warning: KG not found at {path}")
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def compute_prediction():
    """Compute 2026 exam predictions."""
    print("=" * 70)
    print("  EJU 2026 PREDICTION ENGINE")
    print("=" * 70)
    
    # Load data
    print("\n[1/5] Loading trend data and knowledge graph...")
    trend_data = load_trend_data()
    kg = load_knowledge_graph()
    
    if not trend_data:
        print("  Cannot proceed without trend data")
        return
    
    topic_freq = trend_data.get("topic_frequency", {})
    growing = trend_data.get("growing_topics", [])
    declining = trend_data.get("declining_topics", [])
    emerging = trend_data.get("emerging_topics", [])
    consecutive = trend_data.get("consecutive_topics", [])
    domain_trends = trend_data.get("domain_trends", {})
    
    print(f"  Loaded {len(topic_freq)} topics from trend analysis")
    
    # Domain ratio for 2026
    total_recent = sum(d.get("recent_5yr_total", 0) for d in domain_trends.values())
    domain_ratios = {}
    if total_recent > 0:
        for domain, data in domain_trends.items():
            domain_ratios[domain] = data.get("recent_5yr_total", 0) / total_recent
    
    print(f"\n[2/5] Computing topic prediction scores...")
    
    # Build prediction scores for each topic
    predictions = {}
    
    for topic, freq_data in topic_freq.items():
        if isinstance(freq_data, dict) and "total" in freq_data:
            total = freq_data["total"]
            yearly = freq_data.get("yearly", {})
        else:
            continue
        
        # Get recent counts
        recent_5yr = sum(int(yearly.get(str(y), 0)) for y in range(2021, 2026))
        recent_3yr = sum(int(yearly.get(str(y), 0)) for y in range(2023, 2026))
        last_year = int(yearly.get("2025", 0)) if "2025" in yearly else 0
        
        # Scores (all 0-100)
        
        # 1. Recent momentum (last 3 years vs last 5 years)
        momentum = 0
        if recent_5yr > 0:
            momentum = (recent_3yr / max(recent_5yr, 1)) * 100
        
        # 2. Recency (2025 appearance = high score)
        recency = min(100, last_year * 25)  # Each 2025 question = 25 points
        
        # 3. Consecutive streak
        streak_score = 0
        for c in consecutive:
            if c["topic"] == topic:
                streak_score = min(100, c["consecutive_appearances"] * 10)
                break
        
        # 4. Growth rate
        growth_score = 0
        for g in growing:
            if g["topic"] == topic:
                growth_score = min(100, max(0, g["growth_rate_pct"]))
                break
        
        # 5. Domain balance factor (domain should maintain ratio)
        # Find domain for this topic
        domain = ""
        for d_name, d_data in domain_trends.items():
            if topic in str(freq_data.get("yearly", {})):
                # Check if this topic appears in KG
                if kg:
                    for node in kg.get("nodes", []):
                        if node.get("type") == "topic" and node.get("label") == topic:
                            domain = node.get("domain", "")
                            break
                break
        
        domain_factor = domain_ratios.get(domain, 0.5) * 100 if domain else 50
        
        # Combined score
        weights = {
            "momentum": 0.30,
            "recency": 0.25,
            "streak": 0.15,
            "growth": 0.15,
            "domain_balance": 0.15,
        }
        
        combined = (
            momentum * weights["momentum"] +
            recency * weights["recency"] +
            streak_score * weights["streak"] +
            growth_score * weights["growth"] +
            domain_factor * weights["domain_balance"]
        )
        
        predictions[topic] = {
            "topic": topic,
            "domain": domain,
            "total_historical": total,
            "recent_5yr_count": recent_5yr,
            "recent_3yr_count": recent_3yr,
            "last_year_count": last_year,
            "momentum_score": round(momentum, 1),
            "recency_score": round(recency, 1),
            "streak_score": round(streak_score, 1),
            "growth_score": round(growth_score, 1),
            "domain_balance_score": round(domain_factor, 1),
            "combined_score": round(combined, 1),
            "prediction_probability_pct": round(combined, 1),
        }
    
    # Sort by prediction probability
    sorted_predictions = sorted(predictions.values(), key=lambda x: -x["combined_score"])
    
    print(f"\n[3/5] TOP 30 predicted topics for 2026:")
    print(f"  {'Rank':<5} {'Topic':<30} {'Prob%':<8} {'Recent':<8} {'Streak':<8} {'Momentum':<10}")
    print(f"  {'-'*70}")
    
    for i, p in enumerate(sorted_predictions[:30]):
        print(f"  {i+1:<5} {p['topic']:<30} {p['prediction_probability_pct']:<8.1f} {p['recent_3yr_count']:<8} {p['streak_score']:<8.1f} {p['momentum_score']:<10.1f}")
    
    # Domain-level prediction
    print(f"\n[4/5] Computing domain distribution for 2026...")
    
    domain_prediction = {}
    for p in sorted_predictions[:40]:
        d = p["domain"]
        if d:
            if d not in domain_prediction:
                domain_prediction[d] = {"expected_count": 0, "top_topics": []}
            domain_prediction[d]["expected_count"] += 1
            domain_prediction[d]["top_topics"].append(p["topic"])
    
    for d, data in sorted(domain_prediction.items(), key=lambda x: -x[1]["expected_count"]):
        print(f"    {d}: ~{data['expected_count']} topics expected")
    
    # Build final output
    print(f"\n[5/5] Building prediction report...")
    
    output = {
        "prediction_year": 2026,
        "generated_at": datetime.now().isoformat(),
        "methodology": {
            "factors": [
                "Recent momentum (last 3yr vs 5yr) - 30%",
                "Recency (2025 appearance count) - 25%",
                "Consecutive appearance streak - 15%",
                "Growth rate trend - 15%",
                "Domain balance ratio - 15%",
            ],
            "data_range": "2002-2025",
            "total_topics_analyzed": len(predictions),
        },
        "top_30_predictions": sorted_predictions[:30],
        "domain_2026_estimate": domain_prediction,
        "key_findings": {
            "high_probability": [p["topic"] for p in sorted_predictions[:10]],
            "medium_probability": [p["topic"] for p in sorted_predictions[10:20]],
            "emerging_concern": [p["topic"] for p in sorted_predictions[20:30]],
        },
        "disclaimer": "This prediction is based on historical frequency analysis and does not guarantee actual exam content.",
    }
    
    output_path = os.path.join(OUTPUT_DIR, "prediction_2026.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n  ✓ Prediction saved: {output_path}")
    print(f"  {len(sorted_predictions)} topics analyzed")
    print(f"  Top 30 predictions for 2026")
    
    return output


def main():
    prediction = compute_prediction()
    
    print(f"\n{'='*70}")
    print(f"  STEP 5 - PREDICTION ENGINE COMPLETE")
    print(f"{'='*70}")
    print(f"  Output: dataset/prediction/prediction_2026.json")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
