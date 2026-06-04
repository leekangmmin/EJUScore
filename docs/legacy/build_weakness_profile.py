#!/usr/bin/env python3
"""
EJU Intelligence Platform - Weakness Analysis Engine (Step 5)
Connects user wrong answers to Knowledge Graph for deep analysis.

Creates:
  - weakness_profile.json: User's knowledge gaps mapped to KG
  - Per-domain/topic weakness scores
  - Root cause analysis with concept mapping
"""
import json
import os
import sys
from datetime import datetime
from collections import defaultdict

OUTPUT_DIR = "dataset"
KG_DIR = "dataset/knowledge-graph"
TREND_DIR = "dataset/trend-analysis"

os.makedirs(OUTPUT_DIR, exist_ok=True)


def load_kg():
    path = os.path.join(KG_DIR, "knowledge_graph_v3.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_trends():
    path = os.path.join(TREND_DIR, "trend_analysis_v2.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_weakness_profile():
    """
    Build a comprehensive weakness profile template.
    In production, this would be combined with user-specific wrong answer data.
    Here we create the analytical framework and example profiles.
    """
    print("=" * 70)
    print("  EJU WEAKNESS ANALYSIS ENGINE")
    print("=" * 70)
    
    kg = load_kg()
    trends = load_trends()
    
    if not kg:
        print("  Error: Knowledge graph not found")
        return
    
    # Build topic hierarchy from KG
    topic_hierarchy = defaultdict(dict)
    for node in kg.get("nodes", []):
        if node["type"] == "topic":
            domain = node.get("domain", "")
            topic_hierarchy[domain][node["label"]] = node
    
    # Build prerequisite chains
    prerequisite_chains = defaultdict(list)
    for edge in kg.get("edges", []):
        if edge["type"] == "prerequisite":
            source = edge["sourceId"]
            target = edge["targetId"]
            prerequisite_chains[target].append(source)
    
    # Domain weakness scoring structure
    domain_structure = {
        "economy": {
            "label": "경제",
            "topics": list(topic_hierarchy.get("economy", {}).keys()),
            "prerequisite_order": [
                "수요·공급과 시장균형",  # Foundation
                "GDP·국민소득",
                "금융·통화정책",
                "재정·조세정책",
                "국제무역",
                "환율·국제수지",
                "고용·노동",
                "경제성장·경기변동",
                "소득분배·지니계수",
                "일본경제사",
            ]
        },
        "politics": {
            "label": "정치",
            "topics": list(topic_hierarchy.get("politics", {}).keys()),
            "prerequisite_order": [
                "정치사상",            # Foundation
                "헌법·기본권",
                "통치기구",
                "선거·정당",
                "사법·재판",
                "지방자치",
                "국제정치·국제기구",
                "안전보장·방위",
            ]
        },
        "history": {
            "label": "역사",
            "topics": list(topic_hierarchy.get("history", {}).keys()),
            "prerequisite_order": [
                "시민혁명",
                "산업혁명·자본주의",
                "제국주의·식민지",
                "세계대전",
                "냉전",
                "전후세계질서",
                "일본근대사",
                "세계화·지역통합",
            ]
        },
        "geography": {
            "label": "지리",
            "topics": list(topic_hierarchy.get("geography", {}).keys()),
            "prerequisite_order": [
                "지도·GIS",
                "지형·판구조",
                "기후·케펜구분",
                "인구·도시화",
                "자원·농업",
                "산업·교통",
                "환경·생태",
            ]
        },
        "society": {
            "label": "사회",
            "topics": list(topic_hierarchy.get("society", {}).keys()),
            "prerequisite_order": [
                "환경문제",
                "저출산·고령화",
                "사회보장·복지",
                "정보화사회",
                "젠더·평등",
                "다문화사회",
                "윤리·현대사회",
            ]
        }
    }
    
    # Build example weakness profile
    profile = {
        "id": "weakness_profile_template",
        "generated_at": datetime.now().isoformat(),
        "version": "1.0.0",
        "based_on": {
            "knowledge_graph": "knowledge_graph_v3.json",
            "trend_analysis": "trend_analysis_v2.json",
            "data_range": "2002-2025",
        },
        "domain_structure": domain_structure,
        "weakness_detection_framework": {
            "method": "Prerequisite Chain Analysis",
            "description": "Identifies weak topics by analyzing wrong answers and flagging all prerequisite topics",
            "scoring": {
                "correct_ratio": "Ratio of correct answers to total questions in topic (0-1)",
                "mastery_level": "0.0 (no knowledge) to 1.0 (complete mastery)",
                "risk_score": "Based on topic importance in exam (higher = more dangerous)",
                "trend_risk": "How risky this weakness is given recent exam trends",
            }
        },
        "example_user_weakness": {
            "scenario": "User scored 60% on economy domain, 0/4 on GDP questions",
            "analysis": {
                "root_domain": "economy",
                "critical_weakness": "GDP·국민소득",
                "affected_downstream": [
                    "경제성장·경기변동 (prerequisite: GDP)",
                    "환율·국제수지 (related to national income)",
                ],
                "concept_gaps": [
                    "GDP 정의와 구성요소",
                    "명목GDP와 실질GDP 차이",
                    "3면등가의 법칙",
                    "GNP/GNI와 GDP 비교",
                ],
                "severity": "HIGH",
                "recommended_priority": 1,
            }
        },
        # Topic-level analysis framework
        "topic_analysis_framework": {
            "tier_1_foundation": [
                "수요·공급과 시장균형", "헌법·기본권", "정치사상",
                "시민혁명", "지도·GIS", "기후·케펜구분", "환경문제"
            ],
            "tier_2_core": [
                "GDP·국민소득", "통치기구", "통치기구",
                "산업혁명·자본주의", "지형·판구조", "저출산·고령화"
            ],
            "tier_3_advanced": [
                "금융·통화정책", "국제정치·국제기구", "세계대전",
                "인구·도시화", "사회보장·복지"
            ],
            "tier_4_specialized": [
                "환율·국제수지", "사법·재판", "냉전",
                "자원·농업", "정보화사회"
            ],
        },
        # Risk assessment based on trend analysis
        "trend_based_risk_factors": {
            "method": "Topics with high recent frequency + consecutive appearance = higher risk if weak",
            "high_risk_topics": [
                "기후·케펜구분", "시민혁명", "통치기구",
                "환율·국제수지", "금융·통화정책"
            ] if trends else [],
        }
    }
    
    # Enhance with actual trend data if available
    if trends:
        growing = trends.get("growing_topics", [])
        profile["trend_alignment"] = {
            "growing_weakness_risk": [
                {"topic": t["topic"], "growth_rate": t["growth_rate_pct"]}
                for t in growing[:10]
            ]
        }
    
    output_path = os.path.join(OUTPUT_DIR, "weakness_profile.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(profile, f, ensure_ascii=False, indent=2)
    
    print(f"\n  ✓ Weakness profile framework saved: {output_path}")
    print(f"  Domains analyzed: {len(domain_structure)}")
    print(f"  Topics tracked: {sum(len(d['topics']) for d in domain_structure.values())}")
    
    return profile


def main():
    profile = build_weakness_profile()
    
    print(f"\n{'='*70}")
    print(f"  STEP 5 - WEAKNESS ANALYSIS ENGINE COMPLETE")
    print(f"{'='*70}")
    print(f"  Output: dataset/weakness_profile.json")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
