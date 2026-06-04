#!/usr/bin/env python3
"""
Step 1: Rebuild dataset_consolidated.json and master_dataset.json
with ALL 28 OCR exam files (2002-2015) + Vision data (2016-2025)
"""
import json
import os
import glob
from datetime import datetime
from collections import defaultdict

OUTPUT_DIR = "dataset"
OCR_DIR = f"{OUTPUT_DIR}/comprehensive"
VISION_DIR = "scripts/exam-bank-raw/vision"
GOLD_DIR = f"{OUTPUT_DIR}/gold_standard"

def load_exam_file(fpath):
    """Load a single exam JSON file and return structured data."""
    with open(fpath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    year = data.get("year", 0)
    round_num = data.get("round", 0)
    questions = data.get("questions", [])
    
    structured_qs = []
    for q in questions:
        structured_qs.append({
            "id": q.get("id", ""),
            "number": q.get("number", 0),
            "text": q.get("text", "") or q.get("raw_text", ""),
            "answer_choices": q.get("answer_choices", []),
            "ocr_confidence": q.get("ocr_confidence", 0),
            "domain": q.get("domain", "unknown"),
            "topic": q.get("topic", ""),
            "subtopic": q.get("subtopic", ""),
            "difficulty": q.get("difficulty", 3),
            "keywords": q.get("keywords", []),
            "concepts": q.get("concepts", []),
        })
    
    return {
        "year": year,
        "round": round_num,
        "source_file": os.path.basename(fpath),
        "source_path": fpath,
        "total_questions": len(structured_qs),
        "questions": structured_qs,
    }

def load_vision_data():
    """Load vision JSON files and return structured data."""
    vision_exams = []
    for fpath in sorted(glob.glob(f"{VISION_DIR}/*.json")):
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        year = data.get("year", 0)
        round_num = data.get("round", 1) if data.get("round") is not None else 0
        name = data.get("name", "")
        questions = data.get("questions", [])
        
        structured_qs = []
        for i, q in enumerate(questions):
            structured_qs.append({
                "number": q.get("q", i+1),
                "daimon": q.get("daimon", 0),
                "domain": q.get("subject", "unknown"),
                "topic": q.get("topic", ""),
                "subtopic": q.get("sub", ""),
                "material": q.get("material", ""),
                "region": q.get("region", ""),
                "era": q.get("era", ""),
                "text": q.get("topic", ""),
            })
        
        vision_exams.append({
            "year": year,
            "round": round_num,
            "source_file": os.path.basename(fpath),
            "name": name,
            "total_questions": len(structured_qs),
            "questions": structured_qs,
        })
    
    return vision_exams

def load_gold_standard():
    """Load gold standard dataset."""
    gs_path = f"{GOLD_DIR}/gold_standard.json"
    if os.path.exists(gs_path):
        with open(gs_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"questions": []}

def rebuild_consolidated_dataset():
    """Rebuild dataset_consolidated.json with ALL exam data."""
    all_exams = []
    total_questions = 0
    year_set = set()
    
    # Load all OCR exam files
    print("Loading OCR exam files...")
    for fpath in sorted(glob.glob(f"{OCR_DIR}/*/exam_*.json")):
        exam_data = load_exam_file(fpath)
        all_exams.append(exam_data)
        total_questions += exam_data["total_questions"]
        year_set.add(exam_data["year"])
    
    # Also load vision data
    print("Loading Vision exam files...")
    vision_exams = load_vision_data()
    for v in vision_exams:
        all_exams.append({
            "year": v["year"],
            "round": v["round"],
            "source_file": v["source_file"],
            "source_path": f"scripts/exam-bank-raw/vision/{v['source_file']}",
            "total_questions": v["total_questions"],
            "type": "vision",
            "questions": v["questions"],
        })
        total_questions += v["total_questions"]
        year_set.add(v["year"])
    
    consolidated = {
        "dataset_name": "EJU Comprehensive Exam Dataset",
        "subject": "comprehensive",
        "version": "2.0.0",
        "generated_at": datetime.now().isoformat(),
        "total_exams": len(all_exams),
        "total_questions": total_questions,
        "year_range": {
            "start": min(year_set),
            "end": max(year_set),
        },
        "exams": all_exams,
    }
    
    output_path = f"{OCR_DIR}/dataset_consolidated.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(consolidated, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Rebuilt dataset_consolidated.json")
    print(f"   Total exams: {len(all_exams)}")
    print(f"   Total questions: {total_questions}")
    print(f"   Year range: {min(year_set)}-{max(year_set)}")
    
    return all_exams, total_questions

def rebuild_master_dataset(all_exams, total_questions):
    """Rebuild master_dataset.json with all exam references."""
    year_set = set()
    exam_files = []
    
    for exam in all_exams:
        year_set.add(exam["year"])
        exam_files.append({
            "file": exam.get("source_file", ""),
            "year": exam["year"],
            "round": exam.get("round", 0),
            "questions": exam["total_questions"],
            "type": exam.get("type", "ocr"),
        })
    
    master = {
        "dataset_name": "EJU Master Exam Dataset",
        "subject": "comprehensive",
        "version": "2.0.0",
        "generated_at": datetime.now().isoformat(),
        "total_exams": len(all_exams),
        "total_questions": total_questions,
        "year_range": {
            "start": min(year_set),
            "end": max(year_set),
        },
        "exam_count": len(exam_files),
        "exam_files": exam_files,
    }
    
    output_path = f"{OCR_DIR}/master_dataset.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(master, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Rebuilt master_dataset.json")
    print(f"   Total exams: {len(all_exams)}")
    
    return master

if __name__ == "__main__":
    print("=" * 60)
    print("STEP 1: Rebuild Dataset Files")
    print("=" * 60)
    
    all_exams, total_qs = rebuild_consolidated_dataset()
    rebuild_master_dataset(all_exams, total_qs)
    
    print("\n✅ Step 1 Complete!")
