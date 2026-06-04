#!/usr/bin/env python3
"""
Step 6: Wrong-Answer Connection System (오답 연결 시스템)
=========================================================
Connects user mistakes to trend analysis for personalized feedback.
"""
import json
import os
from datetime import datetime

OUTPUT_DIR = "dataset"
PREDICTION_PATH = f"{OUTPUT_DIR}/prediction/prediction_2026_2028.json"
TREND_PATH = f"{OUTPUT_DIR}/trend-analysis/trend_analysis_complete.json"
GS_PATH = f"{OUTPUT_DIR}/gold_standard/gold_standard.json"


# Domain knowledge hierarchy
DOMAIN_HIERARCHY = {
    "economy": {
        "name": "경제",
        "sub_topics": [
            "수요·공급과 시장균형", "GDP·국민소득", "환율·국제수지",
            "재정·조세정책", "금융·통화정책", "국제무역",
            "고용·노동", "경제성장·경기변동", "소득분배·지니계수", "일본경제사",
        ]
    },
    "politics": {
        "name": "정치",
        "sub_topics": [
            "헌법·기본권", "통치기구", "선거·정당", "국제정치·국제기구",
            "지방자치", "사법·재판", "안전보장·방위", "정치사상",
        ]
    },
    "history": {
        "name": "역사",
        "sub_topics": [
            "시민혁명", "산업혁명·자본주의", "제국주의·식민지",
            "세계대전", "러시아혁명·소련", "냉전",
            "전후세계질서", "근대일본", "세계화·지역통합", "대공황",
        ]
    },
    "geography": {
        "name": "지리",
        "sub_topics": [
            "기후·케펜구분", "지형·판구조", "인구·도시화",
            "자원·농업", "지도·GIS", "환경·생태", "산업·교통",
        ]
    },
    "society": {
        "name": "사회",
        "sub_topics": [
            "환경문제", "사회보장·복지", "저출산·고령화",
            "정보화사회", "젠더·평등", "다문화사회", "윤리·현대사회",
        ]
    }
}


def load_data():
    """Load all required datasets."""
    with open(TREND_PATH, "r", encoding="utf-8") as f:
        trend = json.load(f)
    with open(PREDICTION_PATH, "r", encoding="utf-8") as f:
        prediction = json.load(f)
    
    gs_questions = []
    if os.path.exists(GS_PATH):
        with open(GS_PATH, "r", encoding="utf-8") as f:
            gs = json.load(f)
        gs_questions = gs.get("questions", [])
    
    return trend, prediction, gs_questions


def analyze_wrong_answer(question_text, domain_hint="", topic_hint=""):
    """
    Given a wrong answer, analyze the knowledge path.
    Returns full analysis with trend context.
    """
    trend, prediction, gs_questions = load_data()
    
    # Determine domain
    domain = domain_hint
    if not domain:
        # Try keyword matching
        from build_complete_analysis import classify_question
        domain, topic, _ = classify_question(question_text)
    else:
        topic = topic_hint
    
    # Get trend data
    topic_trends = trend.get("topic_trends", {})
    topic_data = topic_trends.get(topic, {})
    
    # Get prediction data
    pred_2026 = {p["topic"]: p for p in prediction.get("yearly", {}).get("2026", [])}
    pred_2027 = {p["topic"]: p for p in prediction.get("yearly", {}).get("2027", [])}
    pred_2028 = {p["topic"]: p for p in prediction.get("yearly", {}).get("2028", [])}
    
    pred_2026_topic = pred_2026.get(topic, {})
    pred_2027_topic = pred_2027.get(topic, {})
    pred_2028_topic = pred_2028.get(topic, {})
    
    # Find related past questions
    related = []
    for q in gs_questions:
        if q.get("topic") == topic or q.get("domain") == domain:
            related.append({
                "year": q.get("year"),
                "round": q.get("round"),
                "question_number": q.get("question_number"),
                "domain": q.get("domain"),
                "topic": q.get("topic"),
                "subtopic": q.get("subtopic"),
            })
    
    # Sort by most recent
    related.sort(key=lambda x: (x.get("year", 0), x.get("round", 0)), reverse=True)
    
    # Priority scoring
    total_years = topic_data.get("total_count", 0)
    freq_5yr = topic_data.get("period_5yr_count", 0)
    pred_pct = pred_2026_topic.get("prediction_probability_pct", 0)
    
    if total_years >= 15:
        priority = "A+"
    elif total_years >= 10:
        priority = "A"
    elif total_years >= 6:
        priority = "B+"
    elif total_years >= 3:
        priority = "B"
    else:
        priority = "C"
    
    # Build hierarchy path
    domain_info = DOMAIN_HIERARCHY.get(domain, {})
    
    analysis = {
        "question_text": question_text[:200],
        "domain": domain,
        "domain_name": domain_info.get("name", domain),
        "topic": topic,
        "subtopic": topic_data.get("subtopic", ""),
        
        "trend": {
            "total_appearances_24yr": total_years,
            "frequency_5yr": freq_5yr,
            "frequency_10yr": topic_data.get("period_10yr_count", 0),
            "growth_rate_pct": topic_data.get("growth_rate_pct", 0),
            "consecutive": topic_data.get("consecutive_appearances", 0),
            "last_year": topic_data.get("last_appeared_year"),
            "gap_years": topic_data.get("gap_years", 0),
        },
        
        "prediction": {
            "2026": {"probability": pred_2026_topic.get("prediction_probability_pct", 0), "rank": 0},
            "2027": {"probability": pred_2027_topic.get("prediction_probability_pct", 0), "rank": 0},
            "2028": {"probability": pred_2028_topic.get("prediction_probability_pct", 0), "rank": 0},
        },
        
        "priority": priority,
        "recommended": priority in ["A+", "A"],
        
        "related_questions": related[:10],
        
        "hierarchy_path": " → ".join(filter(None, [
            domain_info.get("name"),
            topic,
        ])),
    }
    
    return analysis


def get_all_topics_analysis():
    """Generate full analysis for ALL topics (for frontend consumption)."""
    trend, prediction, gs_questions = load_data()
    
    # Build topic mastery map
    topics_by_domain = {}
    for domain, info in DOMAIN_HIERARCHY.items():
        topics = []
        for topic_name in info["sub_topics"]:
            tdata = trend.get("topic_trends", {}).get(topic_name, {})
            pred_2026_data = {p["topic"]: p for p in prediction.get("yearly", {}).get("2026", [])}.get(topic_name, {})
            
            total = tdata.get("total_count", 0)
            freq_5yr = tdata.get("period_5yr_count", 0)
            pred_pct = pred_2026_data.get("prediction_probability_pct", 0)
            
            if total >= 15:
                priority = "A+"
            elif total >= 10:
                priority = "A"
            elif total >= 6:
                priority = "B+"
            elif total >= 3:
                priority = "B"
            else:
                priority = "C"
            
            topics.append({
                "topic": topic_name,
                "total": total,
                "recent_5yr": freq_5yr,
                "prediction_2026_pct": pred_pct,
                "priority": priority,
                "growth": tdata.get("growth_rate_pct", 0),
                "gap_years": tdata.get("gap_years", 0),
            })
        
        topics_by_domain[domain] = {
            "name": info["name"],
            "topics": sorted(topics, key=lambda x: -x["total"]),
        }
    
    return topics_by_domain


if __name__ == "__main__":
    # Test with sample questions
    test_cases = [
        ("프랑스혁명과 인권선언에 관한 문제", "history", "시민혁명"),
        ("환율 변동이 경제에 미치는 영향", "economy", "환율·국제수지"),
        ("일본 헌법 제9조와 평화주의", "politics", "헌법·기본권"),
        ("기후변화와 케펜 기후구분", "geography", "기후·케펜구분"),
    ]
    
    for text, domain, topic in test_cases:
        print(f"\n{'='*70}")
        print(f"  질문: {text}")
        result = analyze_wrong_answer(text, domain, topic)
        print(f"  경로: {result['hierarchy_path']}")
        print(f"  우선순위: {result['priority']}")
        print(f"  24년 출제: {result['trend']['total_appearances_24yr']}회")
        print(f"  최근 5년: {result['trend']['frequency_5yr']}회")
        print(f"  2026 예측: {result['prediction']['2026']['probability']}%")
        print(f"  관련 기출: {len(result['related_questions'])}개")
        for rq in result['related_questions'][:5]:
            print(f"    {rq['year']}-{rq['round']} Q{rq['question_number']} ({rq['domain']})")
    
    # Save full topic analysis for dashboard
    topics_data = get_all_topics_analysis()
    output_path = f"{OUTPUT_DIR}/prediction/weakness_connector.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": datetime.now().isoformat(),
            "domains": topics_data,
            "priority_order": ["A+", "A", "B+", "B", "C"],
        }, f, ensure_ascii=False, indent=2)
    print(f"\n  ✓ Saved: {output_path}")
