#!/usr/bin/env python3
"""
EJU Intelligence Platform - Knowledge Graph Builder v3 (Step 2)
Integrates Gold Standard (vision), Reclassified OCR, and PAST_EXAM_BANK data
into a comprehensive knowledge graph with full metadata.

Structure:
  year
  round  
  question_number
  domain
  topic
  subtopic
  difficulty
  keywords
  correct_answer
  source_pdf

Hierarchical:
  economy ─┬─ 환율·국제수지 ─┬─ 환율변동
           │                 ├─ 국제수지
           │                 └─ 구매력평가
           ├─ 금융·통화정책
           └─ ...
"""
import json
import os
import sys
import glob
from datetime import datetime
from collections import defaultdict

OUTPUT_DIR = "dataset/knowledge-graph"
GOLD_DIR = "dataset/gold_standard"
OCR_DIR = "dataset/comprehensive"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Complete EJU Taxonomy ──
DOMAIN_TAXONOMY = {
    "economy": {
        "label": "경제",
        "topics": {
            "수요·공급과 시장균형": ["시장균형", "가격탄력성", "소비자잉여", "생산자잉여", "수요곡선", "공급곡선"],
            "GDP·국민소득": ["국내총생산", "국민총소득", "3면등가", "경제성장률"],
            "환율·국제수지": ["환율변동", "국제수지", "경상수지", "자본수지", "구매력평가"],
            "금융·통화정책": ["통화정책", "금리", "중앙은행", "양적완화", "인플레이션", "디플레이션"],
            "재정·조세정책": ["재정정책", "조세", "국채", "재정적자", "소비세"],
            "국제무역": ["비교우위", "자유무역", "보호무역", "관세", "FTA", "WTO"],
            "고용·노동": ["고용", "실업", "임금", "노동시장", "최저임금"],
            "경제성장·경기변동": ["경기순환", "경제성장", "불황", "호황", "스태그플레이션"],
            "소득분배·지니계수": ["소득분배", "지니계수", "소득격차", "로렌츠곡선"],
            "일본경제사": ["고도경제성장", "버블경제", "잃어버린10년", "아베노믹스"],
        }
    },
    "politics": {
        "label": "정치",
        "topics": {
            "헌법·기본권": ["기본권", "자유권", "사회권", "참정권", "평화주의"],
            "통치기구": ["의원내각제", "대통령제", "삼권분립", "의회", "내각", "행정"],
            "선거·정당": ["선거제도", "정당", "비례대표", "소선거구"],
            "국제정치·국제기구": ["UN", "국제연합", "안전보장이사회", "국제법", "NATO", "PKO"],
            "지방자치": ["지방분권", "지방의회", "지방행정"],
            "사법·재판": ["사법부", "위헌심사", "재판소", "재판제도"],
            "정치사상": ["자연법", "사회계약", "민주주의", "자유주의"],
            "안전보장·방위": ["국방", "자위대", "안전보장", "동맹"],
        }
    },
    "history": {
        "label": "역사",
        "topics": {
            "시민혁명": ["시민혁명", "프랑스혁명", "미국독립", "명예혁명", "인권선언"],
            "산업혁명·자본주의": ["산업혁명", "자본주의", "사회주의", "공업화"],
            "제국주의·식민지": ["제국주의", "식민지배", "독립운동"],
            "세계대전": ["제1차세계대전", "제2차세계대전", "전간기"],
            "냉전": ["냉전", "미소대립", "데탕트", "핵무기"],
            "일본근대사": ["메이지유신", "일본근대화", "천황제"],
            "전후세계질서": ["전후처리", "국제연합", "탈식민지화"],
            "세계화·지역통합": ["EU", "유럽통합", "글로벌화", "지역통합"],
        }
    },
    "geography": {
        "label": "지리",
        "topics": {
            "기후·케펜구분": ["기후대", "강수량", "기온", "식생", "토양"],
            "지형·판구조": ["판구조론", "산맥", "평야", "하천", "해안지형"],
            "인구·도시화": ["인구분포", "도시화", "인구이동", "인구피라미드"],
            "자원·농업": ["자원분포", "농업유형", "에너지", "광물"],
            "지도·GIS": ["지도투영", "축척", "위성정보", "공간정보"],
            "환경·생태": ["자연환경", "생태계", "환경보전"],
            "산업·교통": ["공업입지", "교통망", "물류", "서비스경제"],
        }
    },
    "society": {
        "label": "사회",
        "topics": {
            "환경문제": ["지구온난화", "공해", "자원고갈", "CO2배출"],
            "사회보장·복지": ["연금", "의료보험", "개호보험", "사회복지"],
            "저출산·고령화": ["인구감소", "고령사회", "출산율"],
            "정보화사회": ["정보격차", "디지털화", "미디어", "IT"],
            "젠더·평등": ["성평등", "여성참여", "양성평등"],
            "다문화사회": ["이민", "난민", "문화다양성", "국제이주"],
            "윤리·현대사회": ["생명윤리", "정보윤리", "과학기술"],
        }
    }
}


def load_gold_standard():
    """Load gold standard from Step 1."""
    path = os.path.join(GOLD_DIR, "gold_standard.json")
    if not os.path.exists(path):
        print(f"  Warning: {path} not found, loading vision files directly")
        return load_vision_directly()
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("questions", [])


def load_vision_directly():
    """Fallback: load vision files directly."""
    questions = []
    for fpath in sorted(glob.glob("scripts/exam-bank-raw/vision/*.json")):
        with open(fpath, "r", encoding="utf-8") as f:
            exam = json.load(f)
        for i, q in enumerate(exam.get("questions", [])):
            questions.append({
                "domain": q.get("subject", "unknown"),
                "topic": q.get("sub", "") or q.get("topic", ""),
                "subtopic": "",
                "year": exam.get("year", 0),
                "round": exam.get("round", 1) if exam.get("round") else 0,
                "question_number": q.get("q", i+1),
                "source": "vision",
            })
    return questions


def load_ocr_data():
    """Load OCR exam data from dataset."""
    questions = []
    for fpath in sorted(glob.glob(f"{OCR_DIR}/2*/exam_*.json")):
        with open(fpath, "r", encoding="utf-8") as f:
            exam = json.load(f)
        for q in exam.get("questions", []):
            questions.append({
                "domain": q.get("domain", "unknown"),
                "topic": q.get("topic", ""),
                "subtopic": q.get("subtopic", ""),
                "year": q.get("year", 0),
                "round": q.get("round", 1),
                "question_number": q.get("number", 0),
                "difficulty": q.get("difficulty", 3),
                "keywords": q.get("keywords", []),
                "reclassified": q.get("reclassified", False),
                "source": "ocr",
            })
    return questions


def load_past_exam_bank():
    """Load topic distribution from PAST_EXAM_BANK (ejuPastExamBank.js data)."""
    # We'll use the comprehensive topic data from the frontend
    # This gives us 2005-2025 coverage with 1444 canonical questions
    return None  # Will be handled separately


def normalize_topic(domain, topic_str):
    """Normalize a topic string to canonical taxonomy."""
    if not topic_str:
        return "", ""
    
    if domain not in DOMAIN_TAXONOMY:
        return "", ""
    
    taxonomy = DOMAIN_TAXONOMY[domain]["topics"]
    
    # Direct match
    if topic_str in taxonomy:
        return topic_str, ""
    
    # Check sub-topic match
    for canonical_topic, subtopics in taxonomy.items():
        for st in subtopics:
            if st in topic_str or topic_str in st:
                return canonical_topic, topic_str
        # Partial name match
        if len(topic_str) >= 2 and (canonical_topic[:2] in topic_str or topic_str[:2] in canonical_topic):
            return canonical_topic, topic_str
    
    return topic_str, ""


def build_knowledge_graph():
    """Build comprehensive knowledge graph from all data sources."""
    print("=" * 70)
    print("  EJU KNOWLEDGE GRAPH v3 CONSTRUCTION")
    print("=" * 70)
    
    # Load gold standard (vision, 2016-2025)
    print("\n[1/4] Loading Gold Standard data...")
    gold_questions = load_gold_standard()
    print(f"  Loaded {len(gold_questions)} gold standard questions")
    
    # Load OCR data (2002-2015)
    print("\n[2/4] Loading OCR data...")
    ocr_questions = load_ocr_data()
    print(f"  Loaded {len(ocr_questions)} OCR questions")
    
    # Merge all questions
    all_questions = []
    
    # Add gold standard questions
    for q in gold_questions:
        domain = q.get("domain", "unknown")
        topic_label = q.get("topic", "")
        canonical_topic, subtopic = normalize_topic(domain, topic_label)
        
        all_questions.append({
            "year": q.get("year", 0),
            "round": q.get("round", 1),
            "question_number": q.get("question_number", 0),
            "domain": domain,
            "topic": canonical_topic or topic_label,
            "subtopic": subtopic or q.get("subtopic", ""),
            "difficulty": q.get("difficulty", 3),
            "difficulty_score": q.get("difficulty_score", 60),
            "keywords": q.get("keywords", []),
            "correct_answer": q.get("correct_answer", ""),
            "source_pdf": q.get("source_file", ""),
            "source": "gold_standard",
        })
    
    # Add OCR data (skip unknown domain)
    ocr_added = 0
    for q in ocr_questions:
        domain = q.get("domain", "unknown")
        if domain == "unknown":
            continue
        
        topic_label = q.get("topic", "")
        canonical_topic, subtopic = normalize_topic(domain, topic_label)
        
        all_questions.append({
            "year": q.get("year", 0),
            "round": q.get("round", 1),
            "question_number": q.get("question_number", 0),
            "domain": domain,
            "topic": canonical_topic or topic_label,
            "subtopic": subtopic or q.get("subtopic", ""),
            "difficulty": q.get("difficulty", 3),
            "difficulty_score": q.get("difficulty", 3) * 20,
            "keywords": q.get("keywords", []),
            "correct_answer": "",
            "source_pdf": "",
            "source": q.get("source", "ocr"),
            "reclassified": q.get("reclassified", False),
        })
        ocr_added += 1
    
    print(f"  Added {ocr_added} OCR questions (skipped unknown)")
    print(f"  Total questions in KG: {len(all_questions)}")
    
    # Build knowledge graph structure
    print("\n[3/4] Building graph structure...")
    
    nodes = []
    edges = []
    
    # Domain nodes
    domain_stats = {}
    for domain_key, domain_info in DOMAIN_TAXONOMY.items():
        domain_questions = [q for q in all_questions if q["domain"] == domain_key]
        if not domain_questions:
            continue
        
        years = sorted(set(q["year"] for q in domain_questions))
        difficulties = [q["difficulty"] for q in domain_questions]
        avg_diff = round(sum(difficulties) / len(difficulties), 2) if difficulties else 3
        
        domain_node = {
            "id": f"domain:{domain_key}",
            "type": "domain",
            "label": domain_info["label"],
            "name_en": domain_key,
            "description": f"EJU {domain_info['label']} 영역",
            "total_questions": len(domain_questions),
            "years": years,
            "year_range": f"{min(years)}-{max(years)}" if years else "",
            "avg_difficulty": avg_diff,
            "topics_count": len(domain_info["topics"]),
        }
        nodes.append(domain_node)
        domain_stats[domain_key] = domain_node
    
    # Topic nodes
    topic_stats = {}
    for domain_key, domain_info in DOMAIN_TAXONOMY.items():
        for topic_key, subtopics in domain_info["topics"].items():
            # Find questions with this topic
            topic_questions = [
                q for q in all_questions
                if q["domain"] == domain_key and q["topic"] == topic_key
            ]
            
            # Also check partial matches
            if not topic_questions:
                topic_questions = [
                    q for q in all_questions
                    if q["domain"] == domain_key and topic_key in q.get("topic", "")
                ]
            
            if not topic_questions:
                # Still create the node with 0 questions (structural)
                years = []
                avg_diff = 3
                question_count = 0
            else:
                years = sorted(set(q["year"] for q in topic_questions))
                difficulties = [q["difficulty"] for q in topic_questions]
                avg_diff = round(sum(difficulties) / len(difficulties), 2) if difficulties else 3
                question_count = len(topic_questions)
            
            topic_node = {
                "id": f"topic:{domain_key}:{topic_key}",
                "type": "topic",
                "label": topic_key,
                "domain": domain_key,
                "domain_label": domain_info["label"],
                "description": f"EJU {domain_info['label']}: {topic_key}",
                "subtopics": subtopics,
                "total_questions": question_count,
                "years": years,
                "year_range": f"{min(years)}-{max(years)}" if years else "",
                "avg_difficulty": avg_diff if question_count > 0 else 3,
            }
            nodes.append(topic_node)
            topic_stats[f"{domain_key}:{topic_key}"] = topic_node
            
            # Edge: topic → domain
            edges.append({
                "id": f"edge_belongs_{topic_key}_{domain_key}",
                "sourceId": f"topic:{domain_key}:{topic_key}",
                "targetId": f"domain:{domain_key}",
                "type": "belongs_to",
                "weight": 1.0,
                "label": f"{topic_key} → {domain_info['label']}",
            })
    
    # Subtopic nodes (from gold standard)
    for q in all_questions:
        if q["subtopic"] and q["domain"] != "unknown" and q.get("topic"):
            subtopic_id = f"subtopic:{q['subtopic']}"
            subtopic_exists = any(n["id"] == subtopic_id for n in nodes)
            if not subtopic_exists:
                subtopic_node = {
                    "id": subtopic_id,
                    "type": "subtopic",
                    "label": q["subtopic"],
                    "domain": q["domain"],
                    "total_questions": 1,
                    "years": [q["year"]],
                }
                nodes.append(subtopic_node)
                
                # Edge: subtopic → topic
                edges.append({
                    "id": f"edge_partof_{q['subtopic']}_{q['topic']}",
                    "sourceId": subtopic_id,
                    "targetId": f"topic:{q['domain']}:{q['topic']}",
                    "type": "part_of",
                    "weight": 0.8,
                })
    
    # Prerequisite edges
    prerequisites = [
        ("economy:수요·공급과 시장균형", "economy:GDP·국민소득", 0.7, "GDP 개념 이해에 시장균형 지식 필요"),
        ("economy:GDP·국민소득", "economy:경제성장·경기변동", 0.8, "경제성장 이해에 GDP 개념 필수"),
        ("economy:GDP·국민소득", "economy:환율·국제수지", 0.6, "국제수지 이해에 국민소득 개념 필요"),
        ("economy:수요·공급과 시장균형", "economy:재정·조세정책", 0.5, "재정정책 이해에 시장 원리 필요"),
        ("economy:수요·공급과 시장균형", "economy:금융·통화정책", 0.6, "통화정책 이해에 시장 원리 필요"),
        ("economy:금융·통화정책", "economy:일본경제사", 0.5, "일본경제 이해에 통화정책 지식 필요"),
        ("economy:국제무역", "economy:환율·국제수지", 0.7, "환율이 무역에 미치는 영향"),
        ("politics:헌법·기본권", "politics:통치기구", 0.8, "헌법이 통치구조를 규정"),
        ("politics:헌법·기본권", "politics:사법·재판", 0.7, "헌법이 사법체계 규정"),
        ("politics:통치기구", "politics:선거·정당", 0.7, "통치구조 속 선거제도"),
        ("politics:통치기구", "politics:지방자치", 0.6, "중앙과 지방의 관계"),
        ("politics:국제정치·국제기구", "politics:안전보장·방위", 0.7, "국제관계와 안보"),
        ("politics:정치사상", "politics:헌법·기본권", 0.6, "정치사상이 헌법에 영향"),
        ("history:시민혁명", "history:산업혁명·자본주의", 0.8, "시민혁명이 산업혁명 기반"),
        ("history:산업혁명·자본주의", "history:제국주의·식민지", 0.7, "산업혁명이 제국주의 촉발"),
        ("history:제국주의·식민지", "history:세계대전", 0.8, "제국주의 경쟁이 세계대전 원인"),
        ("history:세계대전", "history:냉전", 0.9, "세계대전 이후 냉전 체제"),
        ("history:냉전", "history:전후세계질서", 0.8, "냉전 종결 후 새로운 질서"),
        ("history:냉전", "history:세계화·지역통합", 0.6, "냉전 종식이 세계화 촉진"),
        ("geography:기후·케펜구분", "geography:자원·농업", 0.6, "기후가 농업과 자원에 영향"),
        ("geography:기후·케펜구분", "geography:인구·도시화", 0.5, "기후가 인구분포에 영향"),
        ("geography:인구·도시화", "geography:산업·교통", 0.6, "도시화와 산업입지"),
        ("geography:지형·판구조", "geography:기후·케펜구분", 0.5, "지형이 기후에 영향"),
        ("geography:지도·GIS", "geography:지형·판구조", 0.4, "지도로 지형 이해"),
    ]
    
    for source, target, weight, desc in prerequisites:
        # Convert to node IDs
        source_parts = source.split(":")
        target_parts = target.split(":")
        source_id = f"topic:{source_parts[0]}:{source_parts[1]}"
        target_id = f"topic:{target_parts[0]}:{target_parts[1]}"
        
        # Check both nodes exist
        source_exists = any(n["id"] == source_id for n in nodes)
        target_exists = any(n["id"] == target_id for n in nodes)
        
        if source_exists and target_exists:
            edges.append({
                "id": f"edge_prereq_{source_parts[1]}_{target_parts[1]}",
                "sourceId": source_id,
                "targetId": target_id,
                "type": "prerequisite",
                "weight": weight,
                "label": desc,
            })
    
    # Cross-domain connections
    cross_domain = [
        ("history:세계대전", "economy:경제성장·경기변동", 0.6),
        ("history:냉전", "politics:국제정치·국제기구", 0.8),
        ("history:세계대전", "politics:국제정치·국제기구", 0.7),
        ("history:전후세계질서", "politics:안전보장·방위", 0.7),
        ("history:산업혁명·자본주의", "economy:경제성장·경기변동", 0.7),
        ("history:일본근대사", "economy:일본경제사", 0.8),
        ("geography:자원·농업", "economy:국제무역", 0.6),
        ("geography:환경·생태", "society:환경문제", 0.7),
        ("geography:인구·도시화", "society:저출산·고령화", 0.8),
        ("economy:국제무역", "politics:국제정치·국제기구", 0.6),
        ("society:환경문제", "geography:기후·케펜구분", 0.5),
    ]
    
    for source, target, weight in cross_domain:
        source_id = f"topic:{source.split(':')[0]}:{source.split(':')[1]}"
        target_id = f"topic:{target.split(':')[0]}:{target.split(':')[1]}"
        
        source_exists = any(n["id"] == source_id for n in nodes)
        target_exists = any(n["id"] == target_id for n in nodes)
        
        if source_exists and target_exists:
            edges.append({
                "id": f"edge_cross_{source.split(':')[1]}_{target.split(':')[1]}",
                "sourceId": source_id,
                "targetId": target_id,
                "type": "cross_domain",
                "weight": weight,
                "label": f"{source.split(':')[1]} ↔ {target.split(':')[1]}",
            })
    
    # Build final graph
    print(f"\n[4/4] Finalizing knowledge graph...")
    
    # Update topic-level statistics with cross-data counts
    for node in nodes:
        if node["type"] == "topic":
            topic_key = node["label"]
            domain_key = node["domain"]
            
            # Count by year for this topic
            topic_qs = [
                q for q in all_questions
                if q["domain"] == domain_key and (q["topic"] == topic_key or topic_key in q.get("topic", ""))
            ]
            
            if topic_qs:
                node["total_questions"] = len(topic_qs)
                node["avg_difficulty"] = round(sum(q["difficulty"] for q in topic_qs) / len(topic_qs), 2)
                
                # Year-by-year breakdown
                yearly = defaultdict(int)
                for q in topic_qs:
                    yearly[q["year"]] += 1
                node["yearly_counts"] = dict(sorted(yearly.items()))
                
                # Recent trend (last 5 years)
                all_years = sorted(yearly.keys())
                recent_years = [y for y in all_years if y >= 2020]
                node["recent_5yr_count"] = sum(yearly.get(y, 0) for y in range(2021, 2026))
                node["recent_3yr_count"] = sum(yearly.get(y, 0) for y in range(2023, 2026))
                
                # Difficulty distribution
                diff_dist = defaultdict(int)
                for q in topic_qs:
                    diff_dist[q["difficulty"]] += 1
                node["difficulty_distribution"] = dict(sorted(diff_dist.items()))
    
    graph = {
        "name": "EJU Comprehensive Knowledge Graph v3",
        "version": "3.0.0",
        "generated_at": datetime.now().isoformat(),
        "source_data": {
            "gold_standard": f"{len(gold_questions)} questions (2016-2025, vision)",
            "ocr": f"{ocr_added} questions (2002-2015, OCR)",
            "total": len(all_questions),
            "year_range": f"{min(q['year'] for q in all_questions)}-{max(q['year'] for q in all_questions)}",
        },
        "statistics": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "domains": len([n for n in nodes if n["type"] == "domain"]),
            "topics": len([n for n in nodes if n["type"] == "topic"]),
            "subtopics": len([n for n in nodes if n["type"] == "subtopic"]),
            "edge_types": {
                "belongs_to": sum(1 for e in edges if e["type"] == "belongs_to"),
                "prerequisite": sum(1 for e in edges if e["type"] == "prerequisite"),
                "cross_domain": sum(1 for e in edges if e["type"] == "cross_domain"),
                "part_of": sum(1 for e in edges if e["type"] == "part_of"),
            },
        },
        "taxonomy": DOMAIN_TAXONOMY,
        "nodes": nodes,
        "edges": edges,
    }
    
    # Save
    output_path = os.path.join(OUTPUT_DIR, "knowledge_graph_v3.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(graph, f, ensure_ascii=False, indent=2)
    
    print(f"\n  ✓ Knowledge Graph saved: {output_path}")
    print(f"  Nodes: {graph['statistics']['total_nodes']} ({graph['statistics']['domains']} domains, {graph['statistics']['topics']} topics, {graph['statistics']['subtopics']} subtopics)")
    print(f"  Edges: {graph['statistics']['total_edges']}")
    print(f"  Coverage: {len(all_questions)} questions from {graph['source_data']['year_range']}")
    
    # Domain breakdown
    print(f"\n  Domain coverage:")
    domain_counts = defaultdict(int)
    for q in all_questions:
        domain_counts[q["domain"]] += 1
    for d, c in sorted(domain_counts.items(), key=lambda x: -x[1]):
        print(f"    {d}: {c} questions")
    
    # Topic coverage
    print(f"\n  Top topics by question count:")
    topic_nodes = [n for n in nodes if n["type"] == "topic"]
    for n in sorted(topic_nodes, key=lambda x: -x["total_questions"])[:15]:
        print(f"    {n['domain_label']:>8s} → {n['label']:<25s}: {n['total_questions']}q (diff: {n['avg_difficulty']:.1f})")
    
    return graph, all_questions


def main():
    graph, questions = build_knowledge_graph()
    
    print(f"\n{'='*70}")
    print(f"  STEP 2 - KNOWLEDGE GRAPH COMPLETE")
    print(f"{'='*70}")
    print(f"  Output: dataset/knowledge-graph/knowledge_graph_v3.json")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
