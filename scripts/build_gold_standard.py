#!/usr/bin/env python3
"""
EJU Intelligence Platform - Gold Standard Builder (Step 1)
Parses Vision JSON files (608 questions, 2016-2025) as Ground Truth,
creates gold_standard.json, and prepares training data for classifier retraining.

Schema unification:
  - Maps vision subjects to canonical domains
  - Adds topic/subtopic enrichment from vision annotations
  - Builds comprehensive metadata: year, round, question_number, domain, topic, subtopic, difficulty, keywords
"""
import json
import os
import sys
import glob
from datetime import datetime

VISION_DIR = "scripts/exam-bank-raw/vision"
GOLD_STANDARD_DIR = "dataset/gold_standard"
TRAINING_DIR = "dataset/training"
OCR_DIR = "dataset/comprehensive"

os.makedirs(GOLD_STANDARD_DIR, exist_ok=True)
os.makedirs(TRAINING_DIR, exist_ok=True)

# Domain mapping from vision subject labels
DOMAIN_MAP = {
    "economy": "economy",
    "politics": "politics", 
    "history": "history",
    "geography": "geography",
    "society": "society",
}

# Topic hierarchy for subtopic enrichment
TOPIC_HIERARCHY = {
    "economy": {
        "시장·가격": "수요·공급과 시장균형",
        "금융·통화": "금융·통화정책",
        "무역·국제수지": "환율·국제수지",
        "경기·성장": "경제성장·경기변동",
        "기업·노동": "고용·노동",
        "재정·조세": "재정·조세정책",
        "사회보장": "소득분배·지니계수",
    },
    "politics": {
        "통치기구": "통치기구",
        "선거·정당": "선거·정당",
        "헌법·인권": "헌법·기본권",
        "국제정치·기구": "국제정치·국제기구",
        "사법·재판": "사법·재판",
        "지방자치": "지방자치",
        "정치사상": "정치사상",
        "안전보장·방위": "안전보장·방위",
    },
    "history": {
        "시민혁명": "시민혁명",
        "산업혁명": "산업혁명·자본주의",
        "제국주의·식민지": "제국주의·식민지",
        "세계대전": "세계대전",
        "제1차세계대전": "세계대전",
        "제2차세계대전": "세계대전",
        "냉전": "냉전",
        "근대일본": "일본근대사",
        "전후세계질서": "전후세계질서",
        "세계화·지역통합": "세계화·지역통합",
        "탈냉전·현대": "전후세계질서",
        "러시아혁명·소련": "냉전",
        "근대중국": "일본근대사",
    },
    "geography": {
        "기후": "기후·케펜구분",
        "지형": "지형·판구조",
        "인구·도시화": "인구·도시화",
        "자원·농업": "자원·농업",
        "지도·GIS": "지도·GIS",
        "환경·생태": "환경·생태",
        "산업·교통": "산업·교통",
    },
    "society": {
        "환경문제": "환경문제",
        "사회보장·복지": "사회보장·복지",
        "저출산·고령화": "저출산·고령화",
        "정보화사회": "정보화사회",
        "젠더·평등": "젠더·평등",
        "다문화사회": "다문화사회",
        "윤리·현대사회": "윤리·현대사회",
    }
}

# Difficulty estimation based on vision data features
def estimate_difficulty(question: dict) -> int:
    """Estimate difficulty (1-5) based on vision metadata."""
    base = 3
    topic = question.get("topic", "")
    material = question.get("material", "")
    
    # Material complexity
    if material in ("graph", "table", "map", "timeline"):
        base += 1
    
    # Topic adjustment
    advanced_topics = ["환율", "금융", "통화정책", "탄력성", "GDP", "국민소득", "비교우위"]
    if any(t in topic for t in advanced_topics):
        base += 1
    
    # Region/country knowledge adds complexity
    if question.get("region"):
        base += 0.5
    
    # History timeline questions are harder
    if material == "timeline":
        base += 1
    
    return max(1, min(5, round(base)))


def extract_keywords_from_question(question: dict) -> list:
    """Extract keywords from vision question metadata."""
    keywords = []
    topic = question.get("topic", "")
    sub = question.get("sub", "")
    region = question.get("region", "")
    material = question.get("material", "")
    era = question.get("era", "")
    
    if topic:
        # Clean and split topic
        cleaned = topic.replace("(", " ").replace(")", " ").replace("·", " ")
        parts = [p.strip() for p in cleaned.split() if len(p.strip()) > 1]
        keywords.extend(parts[:5])
    
    if sub and sub not in keywords:
        keywords.append(sub)
    if region and region not in keywords:
        keywords.append(region)
    if era and era not in keywords:
        keywords.append(era)
    if material and material not in keywords:
        keywords.append(material)
    
    return keywords


def get_correct_answer_from_topic(question: dict) -> str:
    """Extract implied correct answer from vision data."""
    # Vision data doesn't contain explicit correct answers
    # But we can use topic + sub as answer context
    topic = question.get("topic", "")
    sub = question.get("sub", "")
    return sub or topic.split("(")[0].strip() if "(" in topic else topic[:30]


def process_vision_files():
    """Process all vision JSON files into unified gold standard."""
    all_questions = []
    all_subjects = {}
    per_domain = {}
    
    vision_files = sorted(glob.glob(f"{VISION_DIR}/*.json"))
    print(f"Found {len(vision_files)} vision JSON files")
    
    for fpath in vision_files:
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        year = data.get("year", 0)
        exam_round = data.get("round", 1) if data.get("round") is not None else 0
        name = data.get("name", "")
        total = data.get("total", 0)
        questions = data.get("questions", [])
        
        print(f"  Processing: {name} ({len(questions)} questions)")
        
        for i, q in enumerate(questions):
            vision_subject = q.get("subject", "unknown")
            domain = DOMAIN_MAP.get(vision_subject, "unknown")
            
            # Map topic to canonical topic
            topic_label = q.get("topic", "")
            sub_label = q.get("sub", "")
            
            # Determine canonical topic
            canonical_topic = ""
            canonical_subtopic = ""
            
            # Try sub field first (more specific)
            if sub_label:
                if domain in TOPIC_HIERARCHY:
                    canonical_topic = TOPIC_HIERARCHY[domain].get(sub_label, "")
                    if canonical_topic != sub_label:
                        canonical_subtopic = sub_label
                    else:
                        canonical_subtopic = ""
            
            # If no canonical topic from sub, try from topic
            if not canonical_topic and topic_label:
                if domain in TOPIC_HIERARCHY:
                    for keyword, mapped_topic in TOPIC_HIERARCHY[domain].items():
                        if keyword in topic_label:
                            canonical_topic = mapped_topic
                            break
            
            # If still no topic, use domain default
            if not canonical_topic and domain in TOPIC_HIERARCHY:
                first_topic = list(TOPIC_HIERARCHY[domain].values())[0]
                canonical_topic = first_topic
            
            difficulty = estimate_difficulty(q)
            keywords = extract_keywords_from_question(q)
            correct_answer = get_correct_answer_from_topic(q)
            
            gold_q = {
                "id": f"gold_{year}_{exam_round}_{i+1:02d}",
                "source": "vision",
                "source_file": os.path.basename(fpath),
                "year": year,
                "round": exam_round,
                "question_number": q.get("q", i+1),
                "daimon": q.get("daimon", 0),
                "domain": domain,
                "topic": canonical_topic,
                "subtopic": canonical_subtopic,
                "difficulty": difficulty,
                "difficulty_score": difficulty * 20,  # 1-5 → 20-100
                "keywords": keywords,
                "correct_answer": correct_answer,
                "material": q.get("material", ""),
                "region": q.get("region", ""),
                "era": q.get("era", ""),
                "question_text_hint": topic_label,
            }
            all_questions.append(gold_q)
            
            # Stats
            all_subjects[domain] = all_subjects.get(domain, 0) + 1
            per_domain.setdefault(domain, {})
            if canonical_topic:
                per_domain[domain][canonical_topic] = per_domain[domain].get(canonical_topic, 0) + 1
    
    # Build gold standard dataset
    gold_dataset = {
        "dataset_name": "EJU Gold Standard Dataset",
        "version": "1.0.0",
        "generated_at": datetime.now().isoformat(),
        "source": "Vision Annotation (608 questions, 2016-2025)",
        "total_questions": len(all_questions),
        "year_range": {
            "start": min(q["year"] for q in all_questions),
            "end": max(q["year"] for q in all_questions),
        },
        "domain_distribution": dict(sorted(all_subjects.items(), key=lambda x: -x[1])),
        "questions": all_questions,
    }
    
    # Save gold standard
    output_path = os.path.join(GOLD_STANDARD_DIR, "gold_standard.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(gold_dataset, f, ensure_ascii=False, indent=2)
    
    print(f"\n  ✓ Gold standard saved: {output_path}")
    print(f"  Total questions: {len(all_questions)}")
    print(f"  Domain distribution: {dict(sorted(all_subjects.items(), key=lambda x: -x[1]))}")
    
    return all_questions, all_subjects, per_domain


def prepare_training_data(ocr_questions, gold_questions):
    """Prepare classifier training data combining OCR and Vision data."""
    # Build training data from gold standard (positive examples)
    training_examples = []
    
    for q in gold_questions:
        training_examples.append({
            "domain": q["domain"],
            "topic": q["topic"],
            "subtopic": q["subtopic"],
            "keywords": q["keywords"],
            "difficulty": q["difficulty"],
            "year": q["year"],
            "material": q.get("material", ""),
            "region": q.get("region", ""),
            "source": "gold_standard",
        })
    
    # Also add high-confidence OCR questions
    high_conf_ocr = [
        q for q in ocr_questions
        if q.get("domain", "unknown") != "unknown"
        and q.get("ocr_confidence", 0) > 0.85
    ]
    
    for q in high_conf_ocr:
        training_examples.append({
            "domain": q["domain"],
            "topic": q.get("topic", ""),
            "subtopic": q.get("subtopic", ""),
            "keywords": q.get("keywords", []),
            "difficulty": q.get("difficulty", 3),
            "year": q.get("year", 0),
            "source": "ocr_high_confidence",
        })
    
    training_data = {
        "dataset_name": "EJU Classifier Training Data",
        "version": "1.0.0",
        "generated_at": datetime.now().isoformat(),
        "total_examples": len(training_examples),
        "gold_standard_count": len(gold_questions),
        "ocr_high_confidence_count": len(high_conf_ocr),
        "domain_distribution": {},
        "examples": training_examples,
    }
    
    # Domain distribution
    for ex in training_examples:
        d = ex["domain"]
        training_data["domain_distribution"][d] = training_data["domain_distribution"].get(d, 0) + 1
    
    output_path = os.path.join(TRAINING_DIR, "classifier_training_data.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(training_data, f, ensure_ascii=False, indent=2)
    
    print(f"  ✓ Training data saved: {output_path}")
    print(f"  Total training examples: {len(training_examples)}")
    print(f"  Gold standard: {len(gold_questions)}, OCR high-conf: {len(high_conf_ocr)}")
    
    return training_data


def reclassify_ocr_with_gold_standard():
    """Use gold standard classifier to reclassify old OCR data."""
    # Load all OCR exam files
    ocr_exams = []
    ocr_files = sorted(glob.glob(f"{OCR_DIR}/2*/exam_*.json"))
    
    for fpath in ocr_files:
        with open(fpath, "r", encoding="utf-8") as f:
            exam_data = json.load(f)
        ocr_exams.append(exam_data)
    
    print(f"\nLoaded {len(ocr_exams)} OCR exam files")
    
    # Build domain topic classifier from gold standard
    gold_classifier = {}
    for fpath in sorted(glob.glob(f"{VISION_DIR}/*.json")):
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        for q in data.get("questions", []):
            subj = q.get("subject", "unknown")
            if subj == "unknown":
                continue
            topic = q.get("topic", "")
            sub = q.get("sub", "")
            material = q.get("material", "")
            
            # Extract keywords from topic
            keywords = set()
            for word in topic.replace("(", " ").replace(")", " ").replace("·", " ").split():
                if len(word) > 1:
                    keywords.add(word.lower())
            if sub:
                keywords.add(sub.lower())
            if material:
                keywords.add(material.lower())
            
            if subj not in gold_classifier:
                gold_classifier[subj] = {"keywords": {}, "count": 0}
            
            for kw in keywords:
                gold_classifier[subj]["keywords"][kw] = gold_classifier[subj]["keywords"].get(kw, 0) + 1
            gold_classifier[subj]["count"] += 1
    
    # Print classifier stats
    print("\nGold Standard Classifier Keywords:")
    for domain, data in sorted(gold_classifier.items(), key=lambda x: -x[1]["count"]):
        top_kws = sorted(data["keywords"].items(), key=lambda x: -x[1])[:5]
        kw_str = ", ".join(f"{k}({v})" for k, v in top_kws)
        print(f"  {domain}: {data['count']} questions, top KWs: {kw_str}")
    
    # Reclassify OCR questions
    reclassified_count = 0
    for exam in ocr_exams:
        for q in exam.get("questions", []):
            old_domain = q.get("domain", "unknown")
            if old_domain != "unknown":
                continue  # Already classified
            
            # Try to classify using gold standard keywords
            text = (q.get("text", "") or q.get("cleaned_text", "") or "")
            if not text:
                continue
            
            text_lower = text.lower()
            scores = {}
            for domain, data in gold_classifier.items():
                score = 0
                for kw, freq in data["keywords"].items():
                    if kw in text_lower:
                        score += freq  # Weight by frequency in gold data
                if score > 0:
                    scores[domain] = score
            
            if scores:
                best_domain = max(scores, key=scores.get)
                best_score = scores[best_domain]
                second_score = sorted(scores.values(), reverse=True)[1] if len(scores) > 1 else 0
                
                # Only reclassify if confident enough
                if best_score > 2 and (best_score - second_score) > 0.5:
                    q["domain"] = best_domain
                    q["reclassified"] = True
                    q["classification_confidence"] = round(best_score / (best_score + second_score + 1), 3)
                    reclassified_count += 1
    
    print(f"\n  Reclassified {reclassified_count} previously 'unknown' questions")
    
    # Save reclassified dataset
    reclassified_output = []
    total_ocr_questions = 0
    new_unknown_count = 0
    domain_counts = {}
    
    for exam in ocr_exams:
        for q in exam.get("questions", []):
            total_ocr_questions += 1
            domain = q.get("domain", "unknown")
            domain_counts[domain] = domain_counts.get(domain, 0) + 1
            if domain == "unknown":
                new_unknown_count += 1
            reclassified_output.append(q)
    
    print(f"\n  OCR Domain distribution after reclassification:")
    for d, c in sorted(domain_counts.items(), key=lambda x: -x[1]):
        pct = c / total_ocr_questions * 100
        print(f"    {d}: {c} ({pct:.1f}%)")
    print(f"  Remaining unknown: {new_unknown_count} ({new_unknown_count/total_ocr_questions*100:.1f}%)")
    
    # Save reclassification report
    report = {
        "total_ocr_questions": total_ocr_questions,
        "reclassified": reclassified_count,
        "remaining_unknown": new_unknown_count,
        "domain_distribution_after": dict(sorted(domain_counts.items(), key=lambda x: -x[1])),
        "domain_distribution_before": {
            "unknown": 396, "geography": 73, "politics": 108,
            "economy": 159, "history": 72, "society": 32
        },
        "improvement": f"Unknown rate reduced from 47.1% to {new_unknown_count/total_ocr_questions*100:.1f}%",
    }
    
    report_path = os.path.join(TRAINING_DIR, "reclassification_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    return reclassified_count, new_unknown_count


def main():
    print("=" * 70)
    print("  EJU GOLD STANDARD & TRAINING DATA BUILDER")
    print("=" * 70)
    
    # Step 1: Process vision files into gold standard
    print("\n[1/3] Processing Vision JSON files as Ground Truth...")
    gold_questions, domain_dist, per_domain = process_vision_files()
    
    # Print per-domain topic distribution
    print("\n  Domain → Topic distribution:")
    for domain, topics in sorted(per_domain.items(), key=lambda x: -sum(x[1].values())):
        total = sum(topics.values())
        print(f"\n  [{domain}] ({total} questions):")
        for topic, count in sorted(topics.items(), key=lambda x: -x[1])[:10]:
            print(f"    - {topic}: {count}")
    
    # Step 2: Load existing OCR data for training
    print("\n[2/3] Loading OCR data for training dataset...")
    ocr_questions = []
    ocr_files = sorted(glob.glob(f"{OCR_DIR}/2*/exam_*.json"))
    for fpath in ocr_files:
        with open(fpath, "r", encoding="utf-8") as f:
            exam_data = json.load(f)
        ocr_questions.extend(exam_data.get("questions", []))
    print(f"  Loaded {len(ocr_questions)} OCR questions from {len(ocr_files)} files")
    
    # Step 3: Prepare training data
    print("\n[3/3] Preparing classifier training data...")
    training_data = prepare_training_data(ocr_questions, gold_questions)
    
    # Step 4: Reclassify OCR data
    print("\n[*] Reclassifying OCR questions using gold standard classifier...")
    reclassified, remaining_unknown = reclassify_ocr_with_gold_standard()
    
    # Summary
    print("\n" + "=" * 70)
    print("  STEP 1 SUMMARY")
    print("=" * 70)
    print(f"  Gold Standard:     {len(gold_questions)} questions (2016-2025)")
    print(f"  Training Data:    {training_data['total_examples']} examples")
    print(f"  OCR Reclassified: {reclassified} questions")
    print(f"  Remaining Unknown: {remaining_unknown}")
    print(f"\n  Output files:")
    print(f"    dataset/gold_standard/gold_standard.json")
    print(f"    dataset/training/classifier_training_data.json")
    print(f"    dataset/training/reclassification_report.json")
    print("=" * 70)


if __name__ == "__main__":
    main()
