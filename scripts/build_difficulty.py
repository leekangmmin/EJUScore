#!/usr/bin/env python3
"""
EJU Intelligence Platform - Difficulty Engine (Step 4)
Predicts difficulty score (1-100) for each question using multiple factors:
  - Topic frequency rarity (rare topics are harder)
  - Question text length
  - Concept density
  - Answer choice complexity
  - Historical accuracy rate (if available)
"""
import json
import os
import glob
from datetime import datetime
from collections import defaultdict

OUTPUT_DIR = "dataset/difficulty"
GOLD_DIR = "dataset/gold_standard"
OCR_DIR = "dataset/comprehensive"

os.makedirs(OUTPUT_DIR, exist_ok=True)


def compute_difficulty_scores():
    """Compute difficulty scores (1-100) for all questions."""
    print("=" * 70)
    print("  EJU DIFFICULTY ENGINE")
    print("=" * 70)
    
    # Load all data
    all_questions = []
    
    # Gold standard
    path = os.path.join(GOLD_DIR, "gold_standard.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for q in data.get("questions", []):
            all_questions.append({
                "id": q.get("id", ""),
                "year": q.get("year", 0),
                "domain": q.get("domain", "unknown"),
                "topic": q.get("topic", ""),
                "difficulty_base": q.get("difficulty", 3),
                "source": "gold",
                "keywords": q.get("keywords", []),
                "material": q.get("material", ""),
            })
    
    # OCR data
    for fpath in sorted(glob.glob(f"{OCR_DIR}/2*/exam_*.json")):
        with open(fpath, "r", encoding="utf-8") as f:
            exam = json.load(f)
        for q in exam.get("questions", []):
            domain = q.get("domain", "unknown")
            if domain == "unknown":
                continue
            all_questions.append({
                "id": q.get("id", ""),
                "year": q.get("year", 0),
                "domain": q.get("domain", "unknown"),
                "topic": q.get("topic", ""),
                "difficulty_base": q.get("difficulty", 3),
                "source": "ocr",
                "keywords": q.get("keywords", []),
                "text_length": len(q.get("text", "") or ""),
                "answer_choices_count": len(q.get("answer_choices", [])),
            })
    
    print(f"\n[1/4] Loaded {len(all_questions)} questions")
    
    # Calculate topic frequency rarity
    print(f"\n[2/4] Computing topic rarity scores...")
    topic_freq = defaultdict(int)
    for q in all_questions:
        topic = q.get("topic", "")
        if topic:
            topic_freq[topic] += 1
    
    total_questions = len(all_questions)
    topic_rarity = {}
    for topic, freq in topic_freq.items():
        # Rarer topics get higher difficulty
        rarity_score = 1.0 - (freq / max(total_questions / 20, 1))  # Normalize
        topic_rarity[topic] = max(0, min(1, rarity_score))
    
    # Compute difficulty score for each question
    print(f"\n[3/4] Computing per-question difficulty scores...")
    
    difficulty_db = []
    score_distribution = defaultdict(int)
    
    for q in all_questions:
        # Factors (all normalized 0-1, then combined)
        
        # 1. Base difficulty (1-5 → 0-1)
        base = (q.get("difficulty_base", 3) - 1) / 4.0
        
        # 2. Topic rarity
        topic = q.get("topic", "")
        rarity = topic_rarity.get(topic, 0.5)
        
        # 3. Material complexity
        material = q.get("material", "")
        material_complexity = 0.0
        if material == "graph":
            material_complexity = 0.3
        elif material == "table":
            material_complexity = 0.2
        elif material == "map":
            material_complexity = 0.3
        elif material == "timeline":
            material_complexity = 0.4
        
        # 4. Answer choices complexity (more choices = harder)
        choices_count = q.get("answer_choices_count", 4)
        choices_complexity = min(1.0, (choices_count - 2) / 6.0)  # 2-8 choices
        
        # 5. Text length factor (longer = more complex)
        text_len = q.get("text_length", 100)
        length_complexity = min(1.0, text_len / 500.0)
        
        # 6. Year factor (recent questions may be harder)
        year = q.get("year", 2010)
        year_factor = (year - 2002) / 23.0  # 2002-2025
        
        # Combined score (weighted)
        weights = {
            "base_difficulty": 0.30,
            "topic_rarity": 0.20,
            "material_complexity": 0.15,
            "choices_complexity": 0.10,
            "length_complexity": 0.10,
            "year_factor": 0.15,
        }
        
        raw_score = (
            base * weights["base_difficulty"] +
            rarity * weights["topic_rarity"] +
            material_complexity * weights["material_complexity"] +
            choices_complexity * weights["choices_complexity"] +
            length_complexity * weights["length_complexity"] +
            year_factor * weights["year_factor"]
        )
        
        # Convert to 1-100 scale
        difficulty_score = max(1, min(100, round(raw_score * 100)))
        
        # Categorize
        if difficulty_score <= 30:
            category = "easy"
        elif difficulty_score <= 60:
            category = "medium"
        elif difficulty_score <= 80:
            category = "hard"
        else:
            category = "expert"
        
        score_distribution[category] += 1
        
        difficulty_db.append({
            "id": q.get("id", f"{q['source']}_{q['year']}_{len(difficulty_db)}"),
            "year": q["year"],
            "domain": q["domain"],
            "topic": q["topic"],
            "difficulty_score": difficulty_score,
            "difficulty_category": category,
            "factors": {
                "base_difficulty": round(base, 3),
                "topic_rarity": round(rarity, 3),
                "material_complexity": round(material_complexity, 3),
                "choices_complexity": round(choices_complexity, 3),
                "length_complexity": round(length_complexity, 3),
                "year_factor": round(year_factor, 3),
            },
            "source": q["source"],
        })
    
    # Build output
    print(f"\n[4/4] Saving difficulty database...")
    
    database = {
        "name": "EJU Difficulty Database",
        "version": "1.0.0",
        "generated_at": datetime.now().isoformat(),
        "total_questions": len(difficulty_db),
        "score_distribution": dict(sorted(score_distribution.items(), key=lambda x: -x[1])),
        "average_score": round(sum(d["difficulty_score"] for d in difficulty_db) / len(difficulty_db), 1),
        "questions": difficulty_db,
    }
    
    output_path = os.path.join(OUTPUT_DIR, "difficulty_database.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(database, f, ensure_ascii=False, indent=2)
    
    print(f"\n  ✓ Difficulty database saved: {output_path}")
    print(f"  Average score: {database['average_score']}")
    print(f"  Distribution: {database['score_distribution']}")
    
    # Per-domain average difficulty
    domain_avg = defaultdict(list)
    for d in difficulty_db:
        domain_avg[d["domain"]].append(d["difficulty_score"])
    
    print(f"\n  Per-domain difficulty:")
    for domain, scores in sorted(domain_avg.items(), key=lambda x: -sum(x[1])/len(x[1])):
        avg = sum(scores) / len(scores)
        print(f"    {domain}: {avg:.1f} avg ({len(scores)} questions)")
    
    return database


def main():
    db = compute_difficulty_scores()
    
    print(f"\n{'='*70}")
    print(f"  STEP 4 - DIFFICULTY ENGINE COMPLETE")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
