#!/usr/bin/env python3
"""
EJU Complete Analysis Engine — Steps 2→5 (v2 — Improved Classification)
========================================================================
Multi-strategy classification:
  1. Keyword matching on question text
  2. Keyword matching on page-level text (cleaner)
  3. Distribution-based fallback from known questions in same exam
  4. Domain ratio preservation from known exam data
"""
import json
import os
import glob
import re
import math
from datetime import datetime
from collections import defaultdict, Counter

OUTPUT_DIR = "dataset"
os.makedirs(f"{OUTPUT_DIR}/trend-analysis", exist_ok=True)
os.makedirs(f"{OUTPUT_DIR}/prediction", exist_ok=True)

# ═══════════════════════════════════════════════════════════════
# TAXONOMY: Comprehensive Subject
# ═══════════════════════════════════════════════════════════════

DOMAIN_KEYWORDS = {
    "economy": {
        "korean": [
            "경제", "시장", "가격", "수요", "공급", "균형", "환율", "금리",
            "통화", "물가", "인플레", "디플레", "gdp", "국민소득", "경기",
            "성장", "무역", "수출", "수입", "관세", "국제수지", "재정",
            "조세", "세금", "소득세", "법인세", "소비세", "금융", "은행",
            "중앙은행", "일본은행", "주식", "채권", "노동", "고용", "실업",
            "임금", "지니계수", "소득분배", "경제성장", "경기변동",
            "자유무역", "보호무역", "fta", "wto", "imf", "세계은행",
            "신자유주의", "케인스", "공기업", "민영화",
            "경제활동", "경제성장률", "경제통합", "경제단위",
            "기업", "소비자", "생산", "분배", "소비",
        ],
        "japanese": [
            "経済", "市場", "価格", "需要", "供給", "金利", "通貨",
            "物価", "インフレ", "デフレ", "gdp", "国民所得",
            "貿易", "輸出", "輸入", "関税", "国際収支", "財政",
            "租税", "法人税", "消費税", "金融", "銀行", "中央銀行",
            "日本銀行", "株式", "債券", "雇用", "失業", "賃金",
            "ジニ係数", "所得分配", "経済成長", "景気変動",
            "自由貿易", "保護貿易", "新自由主義",
            "企業", "消費者", "生産", "分配", "消費",
            "労働", "労働組合", "世界銀行",
        ],
    },
    "politics": {
        "korean": [
            "헌법", "기본권", "인권", "평등권", "자유권", "참정권", "사회권",
            "삼권분립", "입법", "행정", "사법", "의회", "국회", "내각",
            "수상", "대통령", "선거", "정당", "비례대표", "투표",
            "지방자치", "지방", "헌법재판", "법원", "재판",
            "국제연합", "un", "국제기구", "nato", "eu", "oecd",
            "안전보장", "방위", "자위대", "평화주의",
            "정치사상", "민주주의", "사회주의", "공산주의", "자유주의",
            "루소", "몽테스키외", "로크",
            "정치", "의원", "입법부", "행정부", "사법부",
            "외교", "외무", "국제평화", "안보",
        ],
        "japanese": [
            "日本国憲法", "憲法", "基本的人権", "三権分立",
            "国会", "内閣", "首相", "選挙", "政党", "比例代表",
            "地方自治", "裁判所", "国際連合", "国連",
            "政治", "議員", "立法", "行政", "司法",
            "外交", "安全保障", "平和主義",
            "参政権", "被選挙権",
        ],
    },
    "history": {
        "korean": [
            "혁명", "산업혁명", "시민혁명", "프랑스혁명", "영국혁명",
            "명예혁명", "미국독립", "러시아혁명", "중국혁명",
            "제국주의", "식민지", "세계대전", "제1차세계대전",
            "제2차세계대전", "냉전", "탈냉전",
            "베트남전쟁", "한국전쟁", "걸프전", "제국", "식민",
            "베르사유", "국제연맹",
            "자본주의", "사회주의", "공산주의", "파시즘",
            "대공황", "세계공황", "뉴딜",
            "독일", "프랑스", "영국", "미국", "러시아", "중국", "일본",
            "나폴레옹", "비스마르크", "레닌", "히틀러",
            "근대", "전후", "세계질서",
            "역사", "제1차", "제2차", "1차대전", "2차대전",
            "로마", "그리스", "중세", "봉건",
        ],
        "japanese": [
            "産業革命", "市民革命", "フランス革命", "アメリカ独立",
            "ロシア革命", "帝国主義", "植民地", "世界大戦",
            "第一次世界大戦", "第二次世界大戦", "冷戦",
            "国際連盟", "世界恐慌", "ニューディール",
            "歴史", "中世", "封建",
        ],
    },
    "geography": {
        "korean": [
            "기후", "케펜", "강수량", "기온", "온대", "열대", "냉대",
            "한대", "건조", "지중해", "사막", "정글",
            "지형", "판구조", "산맥", "하천", "호수", "해안",
            "인구", "도시화", "인구밀도", "출생률", "사망률",
            "자원", "농업", "공업", "서비스산업", "에너지",
            "지도", "gis", "위치", "국경",
            "환경", "생태", "기후변화", "지구온난화",
            "교통", "물류", "항만", "공항",
            "위도", "경도", "적도", "회귀선",
            "지리", "대륙", "해양", "반도",
        ],
        "japanese": [
            "気候", "ケッペン", "降水量", "地形", "プレート",
            "人口", "都市化", "人口密度", "出生率",
            "資源", "農業", "工業", "地図", "環境",
            "緯度", "経度", "赤道",
        ],
    },
    "society": {
        "korean": [
            "환경문제", "공해", "지구온난화", "이산화탄소", "탄소",
            "사회보장", "복지", "연금", "의료보험", "사회복지",
            "저출산", "고령화", "인구감소",
            "정보화", "인터넷", "sns", "디지털",
            "젠더", "평등", "양성", "여성", "차별",
            "다문화", "이민", "난민", "다문화사회",
            "사회", "시민", "자원봉사", "봉사", "자발",
            "노인", "장애인", "아동",
        ],
        "japanese": [
            "現代社会", "情報化", "少子高齢化", "社会保障",
            "福祉", "年金", "環境問題", "地球温暖化",
            "ボランティア", "社会",
        ],
    }
}

# Topic-level keywords within each domain
TOPIC_KEYWORDS = {
    "economy": {
        "수요·공급과 시장균형": ["수요", "공급", "시장균형", "균형가격", "수요곡선", "공급곡선", "需要", "供給"],
        "환율·국제수지": ["환율", "국제수지", "경상수지", "자본수지", "환율변동", "환율제도", "為替", "国際収支"],
        "GDP·국민소득": ["gdp", "국민소득", "gnp", "국내총생산", "国民所得"],
        "재정·조세정책": ["재정", "조세", "세금", "국채", "재정정책", "財政", "租税"],
        "금융·통화정책": ["금융", "통화", "금리", "중앙은행", "일본은행", "통화정책", "金融", "金利", "日本銀行"],
        "국제무역": ["무역", "관세", "수출", "수입", "자유무역", "보호무역", "貿易", "関税"],
        "고용·노동": ["고용", "실업", "노동", "임금", "실업률", "雇用", "失業", "賃金"],
        "경제성장·경기변동": ["경제성장", "경기변동", "경기", "성장률", "景気", "経済成長"],
        "소득분배·지니계수": ["지니계수", "소득분배", "로렌츠", "ジニ係数", "所得分配"],
        "일본경제사": ["일본경제", "전후일본", "고도성장", "버블"],
    },
    "politics": {
        "헌법·기본권": ["헌법", "기본권", "인권", "평등권", "자유권", "참정권", "사회권", "憲法", "基本的人権"],
        "통치기구": ["삼권분립", "입법", "행정", "사법", "의회", "국회", "내각", "수상", "三権分立", "国会", "内閣"],
        "선거·정당": ["선거", "정당", "비례대표", "투표", "선거구", "선거제도", "選挙", "政党", "比例代表"],
        "국제정치·국제기구": ["국제연합", "un", "nato", "eu", "oecd", "국제기구", "国際連合", "国連"],
        "지방자치": ["지방자치", "지방", "地方自治"],
        "사법·재판": ["법원", "재판", "헌법재판", "裁判所"],
        "안전보장·방위": ["안전보장", "방위", "자위대", "평화주의", "防衛", "安全保障"],
        "정치사상": ["정치사상", "민주주의", "사회주의", "로크", "루소", "몽테스키외"],
    },
    "history": {
        "시민혁명": ["시민혁명", "프랑스혁명", "영국혁명", "명예혁명", "미국독립", "市民革命", "フランス革命"],
        "산업혁명·자본주의": ["산업혁명", "자본주의", "産業革命"],
        "제국주의·식민지": ["제국주의", "식민지", "植民地", "帝国主義"],
        "세계대전": ["세계대전", "제1차", "제2차", "1차대전", "2차대전", "世界大戦"],
        "러시아혁명·소련": ["러시아혁명", "소련", "レーニン", "ロシア革命", "ソ連"],
        "냉전": ["냉전", "베트남전쟁", "한국전쟁", "탈냉전", "冷戦"],
        "전후세계질서": ["전후", "베르사유", "국제연맹", "国際連盟"],
        "근대일본": ["근대일본", "메이지", "明治", "近代日本"],
        "세계화·지역통합": ["세계화", "eu", "지역통합"],
        "대공황": ["대공황", "세계공황", "뉴딜", "世界恐慌", "ニューディール"],
    },
    "geography": {
        "기후·케펜구분": ["기후", "케펜", "강수량", "기온", "온대", "열대", "냉대", "한대", "気候", "ケッペン"],
        "지형·판구조": ["지형", "판구조", "산맥", "하천", "호수", "地形", "プレート"],
        "인구·도시화": ["인구", "도시화", "인구밀도", "출생률", "사망률", "人口", "都市化"],
        "자원·농업": ["자원", "농업", "공업", "에너지", "資源", "農業", "工業"],
        "지도·GIS": ["지도", "gis", "위치", "국경", "地図"],
        "환경·생태": ["환경", "생태", "기후변화", "지구온난화", "環境"],
        "산업·교통": ["교통", "물류", "항만", "공항", "서비스"],
    },
    "society": {
        "환경문제": ["환경문제", "공해", "지구온난화", "이산화탄소", "環境問題", "地球温暖化"],
        "사회보장·복지": ["사회보장", "복지", "연금", "의료보험", "사회복지", "社会保障", "福祉", "年金"],
        "저출산·고령화": ["저출산", "고령화", "인구감소", "少子高齢化"],
        "정보화사회": ["정보화", "인터넷", "sns", "디지털", "情報化"],
        "젠더·평등": ["젠더", "평등", "양성", "여성", "차별"],
        "다문화사회": ["다문화", "이민", "난민", "多文化"],
        "윤리·현대사회": ["윤리", "현대사회", "現代社会"],
    }
}


def classify_question(text, page_text=""):
    """
    Multi-strategy classification for comprehensive subject questions.
    Returns (domain, topic, confidence)
    """
    if not text and not page_text:
        return ("unknown", "", 0)
    
    combined = (text or "") + " " + (page_text or "")
    combined_lower = combined.lower()
    
    # Strategy 1: Score each domain by keyword matches
    domain_scores = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        score = 0
        for lang in ["korean", "japanese"]:
            for kw in keywords.get(lang, []):
                if kw.lower() in combined_lower:
                    # Weight by keyword length (longer = more specific)
                    score += len(kw) * 0.5
        if score > 0:
            domain_scores[domain] = score
    
    if not domain_scores:
        return ("unknown", "", 0)
    
    # Pick best domain
    best_domain = max(domain_scores, key=lambda d: domain_scores[d])
    total_score = sum(domain_scores.values())
    confidence = min(1.0, domain_scores[best_domain] / max(total_score * 0.3, 1))
    
    # Strategy 2: Find topic within best domain
    topic = ""
    topic_score = 0
    domain_topics = TOPIC_KEYWORDS.get(best_domain, {})
    for topic_name, topic_kws in domain_topics.items():
        for kw in topic_kws:
            if kw.lower() in combined_lower:
                if len(kw) > topic_score:
                    topic_score = len(kw)
                    topic = topic_name
    
    return (best_domain, topic, round(min(confidence, 0.95), 2))


def get_exam_distribution(exam_year, exam_round):
    """Get domain distribution for known questions in this exam."""
    dist = Counter()
    total = 0
    
    # Check vision JSON first (most reliable)
    vpath = f"scripts/exam-bank-raw/vision/{exam_year}-{exam_round}.json"
    if os.path.exists(vpath):
        with open(vpath) as f:
            exam = json.load(f)
        for q in exam.get("questions", []):
            domain = q.get("subject", "")
            if domain:
                dist[domain] += 1
                total += 1
    
    # Also check gold standard
    gspath = f"{OUTPUT_DIR}/gold_standard/gold_standard.json"
    if os.path.exists(gspath):
        with open(gspath) as f:
            gs = json.load(f)
        for q in gs.get("questions", []):
            if q.get("year") == exam_year and q.get("round") == exam_round:
                domain = q.get("domain", "")
                if domain:
                    dist[domain] += 1
                    total += 1
    
    return dist, total


def load_all_questions():
    """Load ALL questions from ALL sources with improved classification."""
    all_questions = []
    source_stats = defaultdict(int)
    
    # First pass: load OCR questions with page-level context
    ocr_with_pages = {}
    for fpath in sorted(glob.glob(f"{OUTPUT_DIR}/comprehensive/*/exam_*.json")):
        with open(fpath, "r", encoding="utf-8") as f:
            exam = json.load(f)
        year = exam.get("year", 0)
        round_num = exam.get("round", 0)
        
        # Build page text map
        page_texts = {}
        for page in exam.get("pages", []):
            pn = page.get("page_number", 0)
            pt = page.get("text", "")
            page_texts[pn] = pt
        
        for q in exam.get("questions", []):
            qn = q.get("number", 0)
            text = q.get("text", "") or q.get("raw_text", "")
            
            # Get page text for context
            page_txt = page_texts.get(qn // 10 + 1, "") if qn else ""
            
            # Classify
            domain = q.get("domain", "unknown")
            topic = q.get("topic", "")
            
            if domain == "unknown" or not domain:
                domain, topic, conf = classify_question(text, page_txt)
            
            all_questions.append({
                "year": year,
                "round": round_num,
                "source_file": exam.get("source_file", ""),
                "question_number": qn,
                "domain": domain,
                "topic": topic,
                "subtopic": "",
                "difficulty": q.get("difficulty", 3),
                "source": "ocr",
                "text_snippet": text[:100] if text else "",
            })
            source_stats["ocr"] += 1
    
    # Second pass: Vision JSONs (2016-2025)
    for fpath in sorted(glob.glob("scripts/exam-bank-raw/vision/*.json")):
        with open(fpath, "r", encoding="utf-8") as f:
            exam = json.load(f)
        
        domain_map = {
            "economy": "economy", "경제": "economy",
            "politics": "politics", "정치": "politics",
            "history": "history", "역사": "history",
            "geography": "geography", "지리": "geography",
            "society": "society", "사회": "society",
        }
        
        for q in exam.get("questions", []):
            domain = q.get("subject", "unknown")
            domain = domain_map.get(domain, "unknown")
            topic = q.get("topic", "") or q.get("sub", "")
            
            all_questions.append({
                "year": exam.get("year", 0),
                "round": exam.get("round", 0),
                "source_file": exam.get("name", ""),
                "question_number": q.get("q", 0) or q.get("daimon", 0),
                "domain": domain,
                "topic": topic,
                "subtopic": "",
                "difficulty": 3,
                "source": "vision",
                "text_snippet": "",
            })
            source_stats["vision"] += 1
    
    # Third pass: Gold Standard
    gspath = f"{OUTPUT_DIR}/gold_standard/gold_standard.json"
    if os.path.exists(gspath):
        with open(gspath, "r", encoding="utf-8") as f:
            gs = json.load(f)
        for q in gs.get("questions", []):
            all_questions.append({
                "year": q.get("year", 0),
                "round": q.get("round", 0),
                "source_file": q.get("source_file", ""),
                "question_number": q.get("question_number", 0),
                "domain": q.get("domain", "unknown"),
                "topic": q.get("topic", ""),
                "subtopic": q.get("subtopic", ""),
                "difficulty": q.get("difficulty", 3),
                "source": "gold",
                "text_snippet": q.get("question_text_hint", ""),
            })
            source_stats["gold"] += 1
    
    # Deduplicate (gold > vision > ocr)
    seen = set()
    deduped = []
    for q in sorted(all_questions, key=lambda x: {"gold": 0, "vision": 1, "ocr": 2}.get(x["source"], 3)):
        key = (q["year"], q["round"], q["question_number"], q["domain"])
        if key not in seen:
            seen.add(key)
            deduped.append(q)
        else:
            source_stats["deduped"] += 1
    
    # Final pass: fill remaining "unknown" using exam-level distribution
    unknown_count = sum(1 for q in deduped if q["domain"] == "unknown")
    if unknown_count > 0:
        # Group by year/round
        by_exam = defaultdict(list)
        for q in deduped:
            by_exam[(q["year"], q["round"])].append(q)
        
        for (year, round_num), questions in by_exam.items():
            known = [q for q in questions if q["domain"] != "unknown"]
            unknown = [q for q in questions if q["domain"] == "unknown"]
            if not unknown:
                continue
            
            # Get distribution from known questions
            dist = Counter(q["domain"] for q in known)
            total_known = sum(dist.values())
            
            if total_known > 0:
                # Assign each unknown the most common domain in that exam
                most_common = dist.most_common(1)[0][0]
                for q in unknown:
                    q["domain"] = most_common
    
    return deduped, dict(source_stats)


def analyze_trends(questions):
    """Comprehensive trend analysis."""
    print("=" * 70)
    print("  TREND ANALYSIS ENGINE — COMPLETE v2")
    print("=" * 70)
    
    print(f"\n[1/5] Analyzing {len(questions)} questions...")
    
    topic_year = defaultdict(lambda: defaultdict(int))
    domain_year = defaultdict(lambda: defaultdict(int))
    topic_domain = {}
    
    for q in questions:
        domain = q["domain"]
        topic = q["topic"]
        year = q["year"]
        domain_year[domain][year] += 1
        if topic:
            topic_year[topic][year] += 1
            if topic not in topic_domain:
                topic_domain[topic] = domain
    
    all_years = sorted(set(q["year"] for q in questions if q["year"] > 0))
    all_topics = sorted(topic_year.keys())
    
    print(f"  Years: {all_years[0]}-{all_years[-1]} ({len(all_years)} years)")
    print(f"  Topics tracked: {len(all_topics)}")
    print(f"  Unknown count: {sum(1 for q in questions if q['domain'] == 'unknown')}")
    
    print(f"\n[2/5] Topic frequency analysis...")
    topic_freq = {}
    for topic in all_topics:
        yearly = {str(y): topic_year[topic].get(y, 0) for y in all_years}
        total = sum(topic_year[topic].values())
        topic_freq[topic] = {"total": total, "yearly": yearly, "years_appeared": len([y for y in all_years if topic_year[topic].get(y, 0) > 0])}
    
    print(f"\n[3/5] Computing trends...")
    latest_year = all_years[-1]
    period_5yr = [y for y in range(latest_year - 4, latest_year + 1) if y in all_years]
    period_10yr = [y for y in range(latest_year - 9, latest_year + 1) if y in all_years]
    period_3yr = [y for y in range(latest_year - 2, latest_year + 1) if y in all_years]
    
    topic_trends = {}
    growing = []  # growth > 15
    declining = []  # growth < -15
    stable = []
    emerging = []  # absent in first half, present in recent 3yr
    disappearing = []  # present in early period, absent in recent 5yr
    high_consecutive = []  # consec >= 3
    gap_topics = []  # gap >= 2 years and total >= 3
    
    for topic in all_topics:
        yearly = topic_freq[topic]["yearly"]
        total = topic_freq[topic]["total"]
        domain = topic_domain.get(topic, "")
        
        recent_5yr = sum(int(yearly.get(str(y), 0)) for y in period_5yr)
        recent_10yr = sum(int(yearly.get(str(y), 0)) for y in period_10yr)
        recent_3yr = sum(int(yearly.get(str(y), 0)) for y in period_3yr)
        
        before_5yr_years = [y for y in all_years if y < min(period_5yr)]
        before_5yr = sum(int(yearly.get(str(y), 0)) for y in before_5yr_years)
        
        recent_5yr_active = len([y for y in period_5yr if int(yearly.get(str(y), 0)) > 0])
        before_5yr_active = len([y for y in before_5yr_years if int(yearly.get(str(y), 0)) > 0])
        
        recent_avg = recent_5yr / max(recent_5yr_active, 1)
        before_avg = before_5yr / max(before_5yr_active, 1)
        
        growth = round((recent_avg - before_avg) / max(before_avg, 0.01) * 100, 1) if before_avg > 0 else (100 if recent_avg > 0 else 0)
        
        consec = 0
        for y in reversed(all_years):
            if int(yearly.get(str(y), 0)) > 0:
                consec += 1
            else:
                break
        
        years_with_data = [y for y in all_years if int(yearly.get(str(y), 0)) > 0]
        first_yr = min(years_with_data) if years_with_data else None
        last_yr = max(years_with_data) if years_with_data else None
        gap_years = latest_year - last_yr if last_yr and last_yr < latest_year else 0
        
        early_years = all_years[:len(all_years)//2]
        early_absent = all(int(yearly.get(str(y), 0)) == 0 for y in early_years)
        recent_present = any(int(yearly.get(str(y), 0)) > 0 for y in period_3yr)
        early_present = any(int(yearly.get(str(y), 0)) > 0 for y in early_years)
        recent_absent = all(int(yearly.get(str(y), 0)) == 0 for y in period_5yr)
        
        entry = {
            "topic": topic, "domain": domain,
            "total_count": total, "years_appeared": len(years_with_data),
            "first_appeared_year": first_yr, "last_appeared_year": last_yr,
            "gap_years": gap_years,
            "period_3yr_count": recent_3yr, "period_5yr_count": recent_5yr,
            "period_10yr_count": recent_10yr, "before_5yr_count": before_5yr,
            "growth_rate_pct": growth,
            "recent_avg_per_year": round(recent_avg, 2),
            "before_avg_per_year": round(before_avg, 2),
            "consecutive_appearances": consec,
            "frequency_per_exam": round(total / max(len(all_years) * 2, 1), 2),
        }
        
        topic_trends[topic] = entry
        
        if early_absent and recent_present and recent_3yr > 0:
            emerging.append(entry)
        elif early_present and recent_absent and total >= 3:
            disappearing.append(entry)
        
        if growth > 15 and recent_5yr >= 2:
            growing.append(entry)
        elif growth < -15 and before_5yr >= 2:
            declining.append(entry)
        else:
            stable.append(entry)
        
        if consec >= 3 and total >= 3:
            high_consecutive.append(entry)
        if gap_years >= 2 and total >= 3:
            gap_topics.append(entry)
    
    growing.sort(key=lambda x: -x["growth_rate_pct"])
    declining.sort(key=lambda x: x["growth_rate_pct"])
    high_consecutive.sort(key=lambda x: -x["consecutive_appearances"])
    emerging.sort(key=lambda x: -x["period_5yr_count"])
    disappearing.sort(key=lambda x: -x["total_count"])
    gap_topics.sort(key=lambda x: -x["gap_years"])
    
    print(f"\n[4/5] Domain-level analysis...")
    domain_trends = {}
    for domain in sorted(domain_year.keys()):
        if domain == "unknown":
            continue
        yearly = {str(y): domain_year[domain].get(y, 0) for y in all_years}
        total = sum(domain_year[domain].values())
        recent_5yr = sum(domain_year[domain].get(y, 0) for y in period_5yr)
        before_5yr = sum(domain_year[domain].get(y, 0) for y in before_5yr_years)
        growth = round((recent_5yr - before_5yr) / max(before_5yr, 1) * 100, 1)
        domain_trends[domain] = {
            "total": total, "yearly": yearly,
            "recent_5yr_total": recent_5yr, "before_5yr_total": before_5yr,
            "growth_rate_pct": growth, "avg_per_year": round(total / max(len(all_years), 1), 1),
        }
    
    print(f"\n[5/5] Building final report...")
    top_100 = sorted(
        [{"topic": k, "domain": topic_domain.get(k, ""), **v} for k, v in topic_freq.items()],
        key=lambda x: x["total"], reverse=True
    )[:100]
    
    analysis = {
        "generated_at": datetime.now().isoformat(),
        "analysis_period": f"{all_years[0]}-{all_years[-1]}",
        "total_years": len(all_years),
        "total_questions_analyzed": len(questions),
        "total_topics_tracked": len(all_topics),
        "unknown_remaining": sum(1 for q in questions if q['domain'] == 'unknown'),
        "domain_trends": domain_trends,
        "topic_trends": topic_trends,
        "top_100_topics": top_100,
        "growing_topics": growing[:20],
        "declining_topics": declining[:20],
        "stable_topics": stable[:20],
        "emerging_topics": emerging[:15],
        "disappearing_topics": disappearing[:15],
        "high_consecutive_topics": high_consecutive[:20],
        "gap_topics": gap_topics[:20],
        "statistics": {
            "total_questions": len(questions),
            "growing_count": len(growing), "declining_count": len(declining),
            "stable_count": len(stable),
            "emerging_count": len(emerging), "disappearing_count": len(disappearing),
            "high_consecutive_count": len(high_consecutive), "gap_count": len(gap_topics),
            "unique_domains": len(domain_trends),
        },
        "year_range": [all_years[0], all_years[-1]],
    }
    
    path = f"{OUTPUT_DIR}/trend-analysis/trend_analysis_complete.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)
    print(f"\n  ✓ Saved: {path}")
    
    return analysis, topic_trends, all_years


def predict_future(topic_trends, all_years, analysis):
    """Predict 2026-2028 exam trends."""
    print("\n" + "=" * 70)
    print("  PREDICTION ENGINE — 2026~2028")
    print("=" * 70)
    
    latest_year = all_years[-1]
    prediction_years = [2026, 2027, 2028]
    all_predictions = {}
    
    for pred_year in prediction_years:
        print(f"\n  Predicting {pred_year}...")
        scored = []
        
        for topic, data in topic_trends.items():
            total = data["total_count"]
            recent_5yr = data["period_5yr_count"]
            recent_3yr = data["period_3yr_count"]
            consec = data["consecutive_appearances"]
            growth = data["growth_rate_pct"]
            gap = data["gap_years"]
            last_yr = data["last_appeared_year"] or 0
            
            # Skip topics with very low total (noise)
            if total < 3:
                continue
            
            years_since = pred_year - last_yr if last_yr else 10
            recency_score = max(0, 100 - years_since * 20)
            freq_score = min(100, recent_3yr * 20)
            momentum = max(-100, min(100, growth))
            momentum_score = (momentum + 100) * 0.5  # 0-100 scale
            streak_score = min(100, consec * 20)
            
            cycle_score = 0
            if 2 <= gap <= 4:
                cycle_score = 75
            elif gap >= 5 and total >= 5:
                cycle_score = 50
            
            domain = data.get("domain", "")
            domain_penalty = 0
            if domain and domain in analysis.get("domain_trends", {}):
                domain_total = analysis["domain_trends"][domain]["total"]
                domain_pct = domain_total / max(analysis.get("total_questions_analyzed", 1), 1)
                if domain_pct > 0.45:
                    domain_penalty = -10
                elif domain_pct < 0.05:
                    domain_penalty = 5
            
            combined = (recency_score * 0.25 + freq_score * 0.25 + momentum_score * 0.15 + streak_score * 0.10 + cycle_score * 0.15 + domain_penalty * 0.10)
            
            if pred_year == 2027:
                combined *= 0.92
            elif pred_year == 2028:
                combined *= 0.85
            
            conf = min(90, max(5, int(combined)))
            
            scored.append({
                "topic": topic, "domain": domain,
                "total_historical": total, "recent_5yr_count": recent_5yr,
                "recent_3yr_count": recent_3yr,
                "consecutive_streak": consec, "gap_years": gap,
                "growth_rate_pct": growth,
                "recency_score": round(recency_score, 1),
                "frequency_score": round(freq_score, 1),
                "momentum_score": round(momentum_score, 1),
                "streak_score": round(streak_score, 1),
                "cycle_score": round(cycle_score, 1),
                "domain_balance_score": round(domain_penalty * 10, 1),
                "combined_score": round(combined, 1),
                "prediction_probability_pct": conf,
            })
        
        scored.sort(key=lambda x: -x["combined_score"])
        all_predictions[str(pred_year)] = scored[:100]
    
    prediction = {
        "generated_at": datetime.now().isoformat(),
        "model_version": "v2.0-complete",
        "analysis_period": f"{all_years[0]}-{all_years[-1]}",
        "methodology": "Multi-factor: recency(25%) + frequency(25%) + momentum(15%) + streak(10%) + cycle(15%) + domain(10%)",
        "yearly": all_predictions,
        "top_30_predictions": all_predictions.get("2026", [])[:30],
        "key_findings": [
            f"Based on {analysis['total_questions_analyzed']} questions from {all_years[0]}-{all_years[-1]}",
            f"Topics tracked: {analysis['total_topics_tracked']}",
            f"Growing topics: {analysis['statistics']['growing_count']}",
            f"Declining topics: {analysis['statistics']['declining_count']}",
            f"Due for reappearance: {analysis['statistics']['gap_count']}",
        ],
        "disclaimer": "Probabilistic estimates based on historical patterns.",
    }
    
    path = f"{OUTPUT_DIR}/prediction/prediction_2026_2028.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(prediction, f, ensure_ascii=False, indent=2)
    print(f"\n  ✓ Saved: {path}")
    
    return prediction


def print_report(analysis, prediction):
    print("\n" + "=" * 70)
    print("  ANALYSIS COMPLETE — SUMMARY")
    print("=" * 70)
    
    a = analysis
    print(f"\n  📊 Questions: {a['total_questions_analyzed']}")
    print(f"  📅 Period: {a['analysis_period']} ({a['total_years']}y)")
    print(f"  🏷️  Topics: {a['total_topics_tracked']}")
    print(f"  ❓ Unknown: {a.get('unknown_remaining', '?')}")
    
    for domain, data in a['domain_trends'].items():
        print(f"  📂 {domain}: {data['total']} ({data['growth_rate_pct']:+.1f}%)")
    
    print(f"\n  📈 Growing (TOP 10):")
    for t in a['growing_topics'][:10]:
        print(f"    {t['topic']:<25s} +{t['growth_rate_pct']:+.1f}%  (5yr:{t['period_5yr_count']})")
    
    print(f"\n  📉 Declining (TOP 5):")
    for t in a['declining_topics'][:5]:
        print(f"    {t['topic']:<25s} {t['growth_rate_pct']:+.1f}%")
    
    print(f"\n  🔮 2026 TOP 10:")
    for t in prediction['yearly']['2026'][:10]:
        print(f"    {t['topic']:<25s} {t['prediction_probability_pct']:2d}%  (total:{t['total_historical']} 5yr:{t['recent_5yr_count']})")
    
    print(f"\n  🔮 2027 TOP 5:")
    for t in prediction['yearly']['2027'][:5]:
        print(f"    {t['topic']:<25s} {t['prediction_probability_pct']:2d}%")
    
    print(f"\n  🔮 2028 TOP 5:")
    for t in prediction['yearly']['2028'][:5]:
        print(f"    {t['topic']:<25s} {t['prediction_probability_pct']:2d}%")


if __name__ == "__main__":
    questions, source_stats = load_all_questions()
    print(f"\nLoaded {len(questions)} unique questions")
    print(f"Sources: {json.dumps(source_stats, indent=2)}")
    
    unknown_count = sum(1 for q in questions if q['domain'] == 'unknown')
    print(f"Unknown after classification: {unknown_count}")
    
    analysis, topic_trends, all_years = analyze_trends(questions)
    prediction = predict_future(topic_trends, all_years, analysis)
    print_report(analysis, prediction)
    
    print(f"\n{'='*70}")
    print(f"  FILES:")
    print(f"    dataset/trend-analysis/trend_analysis_complete.json")
    print(f"    dataset/prediction/prediction_2026_2028.json")
    print(f"{'='*70}")
