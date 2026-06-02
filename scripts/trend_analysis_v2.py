#!/usr/bin/env python3
"""
EJU Intelligence Platform - Trend Analysis Engine v2 (Step 3)
Comprehensive analysis of 2002-2025 data.

Outputs:
  - Topic frequency (total, per year)
  - 5-year trend (increase/decrease)
  - 10-year trend
  - Consecutive appearance tracking
  - Disappearing topics
  - Emerging topics
"""
import json
import os
import glob
from datetime import datetime
from collections import defaultdict

OUTPUT_DIR = "dataset/trend-analysis"
GOLD_DIR = "dataset/gold_standard"
OCR_DIR = "dataset/comprehensive"

os.makedirs(OUTPUT_DIR, exist_ok=True)


def load_all_questions():
    """Load all questions from gold standard and OCR."""
    questions = []
    
    # Gold standard (vision, 2016-2025)
    path = os.path.join(GOLD_DIR, "gold_standard.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for q in data.get("questions", []):
            d = q.get("domain", "unknown")
            questions.append({
                "year": q.get("year", 0),
                "domain": d,
                "topic": q.get("topic", ""),
                "subtopic": q.get("subtopic", ""),
                "difficulty": q.get("difficulty", 3),
                "source": "gold",
            })
    else:
        for fpath in sorted(glob.glob("scripts/exam-bank-raw/vision/*.json")):
            with open(fpath, "r", encoding="utf-8") as f:
                exam = json.load(f)
            for q in exam.get("questions", []):
                questions.append({
                    "year": exam.get("year", 0),
                    "domain": q.get("subject", "unknown"),
                    "topic": q.get("sub", "") or q.get("topic", ""),
                    "subtopic": "",
                    "difficulty": 3,
                    "source": "vision",
                })
    
    # OCR (2002-2015)
    for fpath in sorted(glob.glob(f"{OCR_DIR}/2*/exam_*.json")):
        with open(fpath, "r", encoding="utf-8") as f:
            exam = json.load(f)
        for q in exam.get("questions", []):
            domain = q.get("domain", "unknown")
            if domain == "unknown":
                continue
            questions.append({
                "year": q.get("year", 0),
                "domain": domain,
                "topic": q.get("topic", ""),
                "subtopic": q.get("subtopic", ""),
                "difficulty": q.get("difficulty", 3),
                "source": "ocr",
            })
    
    return questions


def analyze_trends(questions):
    """Comprehensive trend analysis."""
    print("=" * 70)
    print("  EJU TREND ANALYSIS ENGINE v2")
    print("=" * 70)
    
    print(f"\n[1/5] Loading {len(questions)} questions...")
    
    # Build per-topic-per-year frequency
    topic_year = defaultdict(lambda: defaultdict(int))
    domain_year = defaultdict(lambda: defaultdict(int))
    
    for q in questions:
        domain = q["domain"]
        topic = q["topic"]
        year = q["year"]
        
        domain_year[domain][year] += 1
        if topic:
            topic_year[topic][year] += 1
    
    all_years = sorted(set(q["year"] for q in questions))
    all_topics = sorted(topic_year.keys())
    
    print(f"  Years: {all_years[0]}-{all_years[-1]} ({len(all_years)} years)")
    print(f"  Topics tracked: {len(all_topics)}")
    
    # [2/5] Topic frequency analysis
    print(f"\n[2/5] Topic frequency analysis...")
    
    topic_freq = {}
    for topic in all_topics:
        yearly = {str(y): topic_year[topic].get(y, 0) for y in all_years}
        total = sum(topic_year[topic].values())
        topic_freq[topic] = {
            "total": total,
            "yearly": yearly,
            "years_appeared": len([y for y in all_years if topic_year[topic].get(y, 0) > 0]),
        }
    
    # [3/5] Trend calculation
    print(f"\n[3/5] Computing trends (5yr, 10yr, consecutive)...")
    
    all_years_sorted = sorted(all_years)
    latest_year = all_years_sorted[-1]
    
    # Periods
    period_5yr = list(range(latest_year - 4, latest_year + 1))  # Last 5 years (2021-2025)
    period_10yr = list(range(latest_year - 9, latest_year + 1))  # Last 10 years (2016-2025)
    period_all = all_years_sorted
    
    growing_topics = []
    declining_topics = []
    stable_topics = []
    consecutive_topics = []
    disappearing_topics = []
    emerging_topics = []
    
    for topic in all_topics:
        yearly = topic_freq[topic]["yearly"]
        total = topic_freq[topic]["total"]
        
        # Count by period
        recent_5yr_count = sum(int(yearly.get(str(y), 0)) for y in period_5yr if y in all_years)
        recent_10yr_count = sum(int(yearly.get(str(y), 0)) for y in period_10yr if y in all_years)
        
        # Before periods (exclusive)
        before_5yr_years = [y for y in all_years if y < period_5yr[0]]
        before_5yr_count = sum(int(yearly.get(str(y), 0)) for y in before_5yr_years)
        
        before_10yr_years = [y for y in all_years if y < period_10yr[0]]
        before_10yr_count = sum(int(yearly.get(str(y), 0)) for y in before_10yr_years)
        
        # Years with data in each period
        recent_5yr_years_with_data = [y for y in period_5yr if y in all_years and int(yearly.get(str(y), 0)) > 0]
        before_5yr_years_with_data = [y for y in before_5yr_years if int(yearly.get(str(y), 0)) > 0]
        
        recent_5yr_active_years = len(recent_5yr_years_with_data)
        before_5yr_active_years = len(before_5yr_years_with_data)
        
        # Average per active year
        recent_avg = recent_5yr_count / max(recent_5yr_active_years, 1)
        before_avg = before_5yr_count / max(before_5yr_active_years, 1)
        
        # Growth rate
        if before_avg > 0:
            growth_rate = round((recent_avg - before_avg) / before_avg * 100, 1)
        else:
            growth_rate = 100 if recent_avg > 0 else 0
        
        # Consecutive appearance
        consecutive_years = 0
        max_consecutive = 0
        for y in reversed(all_years_sorted):
            if int(yearly.get(str(y), 0)) > 0:
                consecutive_years += 1
                max_consecutive = max(max_consecutive, consecutive_years)
            else:
                consecutive_years = 0
        
        # First and last appearance
        years_with_data = [y for y in all_years if int(yearly.get(str(y), 0)) > 0]
        first_year = min(years_with_data) if years_with_data else None
        last_year = max(years_with_data) if years_with_data else None
        
        # Check disappearing: had data in early period (first half), none in recent 5 years
        early_years = all_years_sorted[:len(all_years_sorted)//2]
        early_present = any(int(yearly.get(str(y), 0)) > 0 for y in early_years)
        recent_absent = all(int(yearly.get(str(y), 0)) == 0 for y in period_5yr if y in all_years)
        
        # Check emerging: no data in early period, present in recent 5 years
        early_absent = all(int(yearly.get(str(y), 0)) == 0 for y in early_years)
        recent_present = any(int(yearly.get(str(y), 0)) > 0 for y in period_5yr if y in all_years)
        
        entry = {
            "topic": topic,
            "total_count": total,
            "years_appeared": len(years_with_data),
            "period_5yr_count": recent_5yr_count,
            "period_10yr_count": recent_10yr_count,
            "before_5yr_count": before_5yr_count,
            "growth_rate_pct": growth_rate,
            "recent_avg_per_year": round(recent_avg, 2),
            "before_avg_per_year": round(before_avg, 2),
            "consecutive_appearances": max_consecutive,
            "last_appeared_year": last_year,
            "first_appeared_year": first_year,
            "frequency_per_exam": round(total / max(len(all_years) * 2, 1), 2),
        }
        
        # Categorize
        if early_absent and recent_present:
            emerging_topics.append(entry)
        elif early_present and recent_absent:
            disappearing_topics.append(entry)
        elif growth_rate > 15:
            growing_topics.append(entry)
        elif growth_rate < -15:
            declining_topics.append(entry)
        else:
            stable_topics.append(entry)
        
        if max_consecutive >= 4:
            consecutive_topics.append(entry)
    
    # Sort
    growing_topics.sort(key=lambda x: -x["growth_rate_pct"])
    declining_topics.sort(key=lambda x: x["growth_rate_pct"])
    consecutive_topics.sort(key=lambda x: -x["consecutive_appearances"])
    emerging_topics.sort(key=lambda x: -x["period_5yr_count"])
    disappearing_topics.sort(key=lambda x: -x["total_count"])
    
    # [4/5] Domain-level trends
    print(f"\n[4/5] Domain-level analysis...")
    
    domain_trends = {}
    for domain in sorted(domain_year.keys()):
        yearly = {str(y): domain_year[domain].get(y, 0) for y in all_years}
        total = sum(domain_year[domain].values())
        
        recent_5yr = sum(domain_year[domain].get(y, 0) for y in period_5yr if y in all_years)
        before_5yr = sum(domain_year[domain].get(y, 0) for y in before_5yr_years)
        
        growth = round((recent_5yr - before_5yr) / max(before_5yr, 1) * 100, 1)
        
        domain_trends[domain] = {
            "total": total,
            "yearly": yearly,
            "recent_5yr_total": recent_5yr,
            "before_5yr_total": before_5yr,
            "growth_rate_pct": growth,
            "avg_per_year": round(total / len(all_years), 1),
        }
    
    # [5/5] Build final output
    print(f"\n[5/5] Building final trend report...")
    
    # Top 30 topics by total count
    top_30 = sorted(
        [{"topic": k, **v} for k, v in topic_freq.items()],
        key=lambda x: x["total"],
        reverse=True
    )[:30]
    
    analysis = {
        "generated_at": datetime.now().isoformat(),
        "analysis_period": f"{all_years_sorted[0]}-{all_years_sorted[-1]}",
        "total_years": len(all_years),
        "total_questions_analyzed": len(questions),
        "total_topics_tracked": len(all_topics),
        
        "domain_trends": domain_trends,
        
        "top_30_topics": top_30,
        
        "growing_topics": growing_topics[:20],
        "declining_topics": declining_topics[:20],
        "stable_topics": stable_topics[:20],
        "consecutive_topics": consecutive_topics[:20],
        "emerging_topics": emerging_topics[:15],
        "disappearing_topics": disappearing_topics[:15],
        
        "statistics": {
            "growing_count": len(growing_topics),
            "declining_count": len(declining_topics),
            "stable_count": len(stable_topics),
            "emerging_count": len(emerging_topics),
            "disappearing_count": len(disappearing_topics),
            "high_consecutive_count": len(consecutive_topics),
        },
        
        "topic_frequency": topic_freq,
    }
    
    # Save
    output_path = os.path.join(OUTPUT_DIR, "trend_analysis_v2.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)
    
    print(f"\n  ✓ Trend analysis saved: {output_path}")
    
    # Print summary
    print(f"\n  {'='*60}")
    print(f"  TREND SUMMARY")
    print(f"  {'='*60}")
    
    print(f"\n  📈 Growing Topics:")
    for t in growing_topics[:10]:
        print(f"    {t['topic']:<30s} total:{t['total_count']:3d} 5yr:{t['period_5yr_count']:2d} growth:{t['growth_rate_pct']:+.1f}% consec:{t['consecutive_appearances']}")
    
    print(f"\n  📉 Declining Topics:")
    for t in declining_topics[:5]:
        print(f"    {t['topic']:<30s} total:{t['total_count']:3d} growth:{t['growth_rate_pct']:+.1f}%")
    
    print(f"\n  🆕 Emerging Topics:")
    for t in emerging_topics[:10]:
        print(f"    {t['topic']:<30s} recent:{t['period_5yr_count']:2d} (first:{t['first_appeared_year']})")
    
    print(f"\n  ❌ Disappearing Topics:")
    for t in disappearing_topics[:10]:
        print(f"    {t['topic']:<30s} last:{t['last_appeared_year']} total:{t['total_count']:3d}")
    
    print(f"\n  🔗 High Consecutive (top 10):")
    for t in consecutive_topics[:10]:
        print(f"    {t['topic']:<30s} consec:{t['consecutive_appearances']:2d} total:{t['total_count']:3d} 5yr:{t['period_5yr_count']:2d}")
    
    return analysis


def main():
    questions = load_all_questions()
    analysis = analyze_trends(questions)
    
    print(f"\n{'='*70}")
    print(f"  STEP 3 - TREND ANALYSIS v2 COMPLETE")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
