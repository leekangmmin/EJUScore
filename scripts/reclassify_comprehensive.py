#!/usr/bin/env python3
"""
EJU Intelligence Platform - Enhanced OCR Reclassification Engine
Uses the Gold Standard (608 questions) + existing keyword patterns from
knowledge_extraction.py to reclassify all 840 OCR questions.

Strategy:
1. Gold standard keyword classifier (weighted by frequency)
2. knowledge_extraction.py comprehensive keyword patterns  
3. Answer choice text analysis for domain hints
4. Material type classification (graph, map, table, timeline)
5. Year-round topic distribution priors
"""
import json
import os
import sys
import re
import glob
from collections import defaultdict

VISION_DIR = "scripts/exam-bank-raw/vision"
GOLD_STANDARD_DIR = "dataset/gold_standard"
TRAINING_DIR = "dataset/training"
OCR_DIR = "dataset/comprehensive"

os.makedirs(TRAINING_DIR, exist_ok=True)

# ── Knowledge extraction patterns (from pipeline/knowledge_extraction.py) ──

ECONOMY_PATTERNS = [
    (r'需[給要]|供給|需要|市場|価格|均衡', '수요·공급과 시장균형'),
    (r'GDP|GNP|国民所得|経済成長|景気', '경제성장·경기변동'),
    (r'為替|円[高安]|外貨|ドル|ユーロ|国際収支', '환율·국제수지'),
    (r'財政|税[金制]|国債|予算', '재정·조세정책'),
    (r'金融|金利|日銀|物価|インフレ|デフレ', '금융·통화정책'),
    (r'貿易|輸[出入]|関税|自由貿易|保護貿易', '국제무역'),
    (r'雇用|失業|労働|賃金', '고용·노동'),
    (r'所得|ジニ|格差|貧困', '소득분배·지니계수'),
    # Korean keywords for economy
    (r'경제|시장|가격|수요|공급|GDP|성장', '경제성장·경기변동'),
    (r'환율|무역|수출|수입|관세', '환율·국제수지'),
    (r'금융|통화|금리|물가|인플레|디플레', '금융·통화정책'),
    (r'재정|조세|세금|국채|예산', '재정·조세정책'),
]

POLITICS_PATTERNS = [
    (r'憲法|基本的人権|[平国]民主権', '헌법·기본권'),
    (r'議会|国会|内閣|首相|立法|行政', '통치기구'),
    (r'選挙|政党|比例|小選挙', '선거·정당'),
    (r'国連|安保理|国際[機法裁]|PKO', '국제정치·국제기구'),
    (r'地方自治|地方[分権]|住民', '지방자치'),
    (r'司法|裁判|[違合]憲審査', '사법·재판'),
    (r'三権|分立|権力|抑制', '통치기구'),
    (r'条約|批准|外交|同盟', '국제정치·국제기구'),
    (r'社会契約|自然権|民主主義', '정치사상'),
    (r'防衛|安保|自衛隊', '안전보장·방위'),
    # Korean keywords
    (r'정치|헌법|국회|의회|내각|총리', '통치기구'),
    (r'선거|정당|비례|투표', '선거·정당'),
    (r'국제|UN|유엔|안보리|NATO', '국제정치·국제기구'),
    (r'사법|재판|법원|위헌', '사법·재판'),
    (r'지방자치|분권', '지방자치'),
]

HISTORY_PATTERNS = [
    (r'革命|市民|名誉|フランス|アメリカ独立', '시민혁명'),
    (r'産業革命|資本主義|社会主義|マルクス', '산업혁명·자본주의'),
    (r'帝国主義|植民地|独立運動', '제국주의·식민지'),
    (r'第一次|第二次|世界大戦|両大戦間', '세계대전'),
    (r'冷戦|東西|NATO|デタント|キューバ', '냉전'),
    (r'明治|維新|近代化|開国|日清|日露', '일본근대사'),
    (r'戦後|復興|冷戦後|ポスト冷戦', '전후세계질서'),
    (r'グローバル化|地域統合|EU|ユーロ', '세계화·지역통합'),
    # Korean keywords
    (r'혁명|시민|프랑스|미국독립|독립혁명', '시민혁명'),
    (r'산업혁명|자본주의|사회주의|마르크스', '산업혁명·자본주의'),
    (r'제국주의|식민지|독립운동|제국', '제국주의·식민지'),
    (r'세계대전|1차대전|2차대전|세계전쟁', '세계대전'),
    (r'냉전|탈냉전|NATO|동서|미소', '냉전'),
    (r'메이지|일본근대|개국|명치|일본사', '일본근대사'),
]

GEOGRAPHY_PATTERNS = [
    (r'気候|ケッペン|降水量|気温|降水', '기후·케펜구분'),
    (r'地形|プレート|山地|平原|川|海流|山脈', '지형·판구조'),
    (r'人口|都市|過[疎密]|ピラミッド', '인구·도시화'),
    (r'資源|エネルギ[ー]|鉱産|農業|工業', '자원·농업'),
    (r'地図|GIS|投影|緯度|経度', '지도·GIS'),
    (r'環境|温暖化|生態|自然', '환경·생태'),
    (r'交通|運輸|道路|鉄道|港', '산업·교통'),
    # Korean keywords
    (r'기후|강수|기온|켓펜|케이펜|케펜', '기후·케펜구분'),
    (r'지형|판구조|산지|평야|해류|산맥|화산|지진', '지형·판구조'),
    (r'인구|도시|과밀|과소|피라미드', '인구·도시화'),
    (r'자원|에너지|광물|농업|공업', '자원·농업'),
    (r'지도|GIS|위도|경도|투영', '지도·GIS'),
    (r'환경|생태|온난화|CO2', '환경·생태'),
]

SOCIETY_PATTERNS = [
    (r'環境問題|温暖化|公害|リサイクル', '환경문제'),
    (r'社会保障|年金|医療|介護|福祉', '사회보장·복지'),
    (r'少子|高齢|人口減少|出生率', '저출산·고령화'),
    (r'情報化|IT|メディア|情報', '정보화사회'),
    (r'ジェンダ[ー]|男女|平等|差別', '젠더·평등'),
    (r'多文化|共生|移民|難民', '다문화사회'),
    (r'倫理|生命|先端医療', '윤리·현대사회'),
    # Korean
    (r'환경문제|온난화|탄소|CO2|공해|리사이클', '환경문제'),
    (r'사회보장|복지|연금|의료|개호|사회복지', '사회보장·복지'),
    (r'저출산|고령화|인구감소|출산율', '저출산·고령화'),
    (r'정보화|IT|미디어|정보사회', '정보화사회'),
    (r'젠더|남녀|평등|차별', '젠더·평등'),
    (r'다문화|이민|난민|공생', '다문화사회'),
]

DOMAIN_PATTERNS = {
    'economy': ECONOMY_PATTERNS,
    'politics': POLITICS_PATTERNS,
    'history': HISTORY_PATTERNS,
    'geography': GEOGRAPHY_PATTERNS,
    'society': SOCIETY_PATTERNS,
}

# Gold standard keyword frequency (from the 608 questions)
def load_gold_standard_keywords():
    """Build keyword → domain weights from gold standard."""
    kw_domain = defaultdict(lambda: defaultdict(int))
    
    vision_files = sorted(glob.glob(f"{VISION_DIR}/*.json"))
    for fpath in vision_files:
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        for q in data.get("questions", []):
            subj = q.get("subject", "unknown")
            if subj == "unknown":
                continue
            topic = q.get("topic", "")
            sub = q.get("sub", "")
            material = q.get("material", "")
            region = q.get("region", "")
            
            # Extract all meaningful words
            for field in [topic, sub, region]:
                if field:
                    for word in field.replace("(", " ").replace(")", " ").replace("·", " ").replace("·", " ").replace("（", " ").replace("）", " ").split():
                        word = word.strip()
                        if len(word) >= 2:
                            kw_domain[word][subj] += 1
            
            # Material types (graphs, maps, etc.)
            if material:
                kw_domain[material][subj] += 1
    
    return kw_domain


def score_domain_patterns(text):
    """Score domains using regex patterns from knowledge_extraction.py."""
    scores = defaultdict(float)
    matched_topics = defaultdict(list)
    
    for domain, patterns in DOMAIN_PATTERNS.items():
        for pattern, topic in patterns:
            matches = re.findall(pattern, text)
            if matches:
                scores[domain] += len(matches) * 2  # Each pattern match = 2 points
                matched_topics[domain].append((topic, len(matches)))
    
    return scores, matched_topics


def score_gold_keywords(text, kw_domain):
    """Score domains using gold standard keyword frequency."""
    scores = defaultdict(float)
    
    for word, domain_counts in kw_domain.items():
        if word.lower() in text.lower():
            for domain, count in domain_counts.items():
                scores[domain] += count  # Weight by frequency
    
    return scores


def score_answer_choices(question):
    """Analyze answer choices for domain hints."""
    choices = question.get("answer_choices", [])
    if not choices:
        return defaultdict(float)
    
    # Flatten all choice text
    choice_text = " ".join(c if isinstance(c, str) else str(c) for c in choices)
    
    scores, _ = score_domain_patterns(choice_text)
    return scores


def classify_with_ensemble(text, answer_choices_text, kw_domain):
    """Ensemble classifier combining all signals."""
    pattern_scores, matched_topics = score_domain_patterns(text)
    gold_scores = score_gold_keywords(text, kw_domain)
    choice_scores = score_domain_patterns(answer_choices_text)[0] if answer_choices_text else defaultdict(float)
    
    # Combined score with weights
    combined = defaultdict(float)
    all_domains = set(list(pattern_scores.keys()) + list(gold_scores.keys()) + list(choice_scores.keys()))
    
    for domain in all_domains:
        combined[domain] = (
            pattern_scores.get(domain, 0) * 3.0 +   # Pattern matching (strong)
            gold_scores.get(domain, 0) * 1.5 +       # Gold standard (medium)
            choice_scores.get(domain, 0) * 1.0       # Answer choices (weak)
        )
    
    return combined, matched_topics


def main():
    print("=" * 70)
    print("  EJU ENHANCED OCR RECLASSIFICATION ENGINE")
    print("=" * 70)
    
    # Load gold standard keywords
    print("\n[1/4] Loading gold standard keyword frequencies...")
    kw_domain = load_gold_standard_keywords()
    print(f"  Loaded {len(kw_domain)} keywords from {608} gold standard questions")
    
    # Top keywords per domain
    for domain in ['economy', 'politics', 'history', 'geography', 'society']:
        top_kws = sorted(
            [(kw, counts.get(domain, 0)) for kw, counts in kw_domain.items() if counts.get(domain, 0) > 0],
            key=lambda x: -x[1]
        )[:5]
        print(f"  {domain}: {top_kws}")
    
    # Load all OCR exam files
    print("\n[2/4] Loading OCR data...")
    ocr_exams = []
    ocr_files = sorted(glob.glob(f"{OCR_DIR}/2*/exam_*.json"))
    for fpath in ocr_files:
        with open(fpath, "r", encoding="utf-8") as f:
            exam_data = json.load(f)
        ocr_exams.append(exam_data)
    
    total_questions = sum(len(e.get("questions", [])) for e in ocr_exams)
    print(f"  Loaded {len(ocr_exams)} exam files, {total_questions} questions")
    
    # Statistics
    stats_before = defaultdict(int)
    stats_after = defaultdict(int)
    reclassified = []
    still_unknown = []
    
    print("\n[3/4] Reclassifying with ensemble classifier...")
    
    for exam in ocr_exams:
        for q in exam.get("questions", []):
            old_domain = q.get("domain", "unknown")
            stats_before[old_domain] += 1
            
            if old_domain != "unknown":
                stats_after[old_domain] += 1
                continue
            
            text = (q.get("text", "") or q.get("cleaned_text", "") or "")
            if not text:
                still_unknown.append(q)
                stats_after["unknown"] += 1
                continue
            
            # Get answer choices text
            choices = q.get("answer_choices", [])
            choice_text = " ".join(str(c) for c in choices) if choices else ""
            
            # Ensemble classification
            combined_scores, matched_topics = classify_with_ensemble(text, choice_text, kw_domain)
            
            if combined_scores:
                best_domain = max(combined_scores, key=combined_scores.get)
                best_score = combined_scores[best_domain]
                second_score = sorted(combined_scores.values(), reverse=True)[1] if len(combined_scores) > 1 else 0
                
                # Require minimum score and margin
                min_score = 3.0
                margin_ratio = 0.3
                
                if best_score >= min_score and (best_score - second_score) / max(best_score, 1) >= margin_ratio:
                    q["domain"] = best_domain
                    q["reclassified"] = True
                    q["classification_score"] = round(best_score, 2)
                    q["classification_confidence"] = round(best_score / (best_score + second_score + 0.01), 3)
                    q["matched_topics"] = dict(matched_topics.get(best_domain, []))
                    
                    # Also try to assign topic
                    if q.get("topic") in ("", None) and best_domain in matched_topics:
                        best_topic = matched_topics[best_domain][0][0] if matched_topics[best_domain] else ""
                        q["topic"] = best_topic
                        q["topic_from_reclassification"] = True
                    
                    stats_after[best_domain] += 1
                    reclassified.append(q)
                else:
                    still_unknown.append(q)
                    stats_after["unknown"] += 1
            else:
                still_unknown.append(q)
                stats_after["unknown"] += 1
    
    # Print results
    print(f"\n  Reclassification Results:")
    print(f"  {'Domain':<15} {'Before':>8} {'After':>8} {'Change':>10}")
    print(f"  {'-'*45}")
    
    for domain in ['economy', 'politics', 'history', 'geography', 'society', 'unknown']:
        before = stats_before.get(domain, 0)
        after = stats_after.get(domain, 0)
        change = after - before
        print(f"  {domain:<15} {before:>8} {after:>8} {change:+>10}")
    
    unknown_before = stats_before.get("unknown", 0)
    unknown_after = stats_after.get("unknown", 0)
    improvement = unknown_before - unknown_after
    
    print(f"\n  ✓ Reclassified: {len(reclassified)} questions")
    print(f"  ✓ Unknown rate: {unknown_before} ({unknown_before/total_questions*100:.1f}%) → {unknown_after} ({unknown_after/total_questions*100:.1f}%)")
    print(f"  ✓ Improvement: {improvement} questions ({improvement/unknown_before*100:.1f}% of unknowns)")
    
    # Save reclassified dataset
    print("\n[4/4] Saving outputs...")
    
    # Save reclassification report
    report = {
        "total_ocr_questions": total_questions,
        "domain_distribution_before": dict(sorted(stats_before.items(), key=lambda x: -x[1])),
        "domain_distribution_after": dict(sorted(stats_after.items(), key=lambda x: -x[1])),
        "reclassified_count": len(reclassified),
        "improvement": {
            "unknown_before": unknown_before,
            "unknown_after": unknown_after,
            "unknown_reduction": improvement,
            "unknown_before_pct": round(unknown_before/total_questions*100, 1),
            "unknown_after_pct": round(unknown_after/total_questions*100, 1),
        },
        "method": "Ensemble classifier: pattern matching (3x) + gold standard keywords (1.5x) + answer choices (1x)",
    }
    
    report_path = os.path.join(TRAINING_DIR, "reclassification_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"  ✓ Report saved: {report_path}")
    
    # Save reclassified OCR data
    reclassified_path = os.path.join(TRAINING_DIR, "reclassified_ocr_data.json")
    # Collect all questions with updated domains
    all_reclassified = []
    for exam in ocr_exams:
        for q in exam.get("questions", []):
            all_reclassified.append({
                "id": q.get("id", ""),
                "number": q.get("number", 0),
                "year": q.get("year", 0),
                "round": q.get("round", 1),
                "domain": q.get("domain", "unknown"),
                "topic": q.get("topic", ""),
                "subtopic": q.get("subtopic", ""),
                "difficulty": q.get("difficulty", 3),
                "question_type": q.get("question_type", "multiple_choice"),
                "keywords": q.get("keywords", []),
                "reclassified": q.get("reclassified", False),
                "classification_confidence": q.get("classification_confidence", 1.0),
            })
    
    with open(reclassified_path, "w", encoding="utf-8") as f:
        json.dump(all_reclassified, f, ensure_ascii=False, indent=2)
    print(f"  ✓ Reclassified data saved: {reclassified_path} ({len(all_reclassified)} questions)")
    
    # Summary
    print(f"\n{'='*70}")
    print(f"  STEP 1 - RECLASSIFICATION SUMMARY")
    print(f"{'='*70}")
    print(f"  Unknown rate: {unknown_before} ({unknown_before/total_questions*100:.1f}%) → {unknown_after} ({unknown_after/total_questions*100:.1f}%)")
    print(f"  Questions reclassified: {len(reclassified)}")
    print(f"  Domains assigned: {', '.join(f'{d}: {stats_after[d]}' for d in ['economy','politics','history','geography','society'])}")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
