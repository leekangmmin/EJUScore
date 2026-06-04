#!/usr/bin/env python3
"""
EJU Intelligence Platform — Enhanced Classification & Data Recovery Engine
=========================================================================
Addresses:
  1. Garbage question filtering (remove non-question entries)
  2. Japanese keyword matching (OCR text is in Japanese)
  3. Page-level context recovery for better classification
  4. Distribution-based fallback using known nearby questions
"""
import json
import os
import glob
import re
from datetime import datetime
from collections import defaultdict, Counter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) or "."
OUTPUT_DIR = os.path.join(BASE_DIR, "dataset")
OCR_DIR = os.path.join(OUTPUT_DIR, "comprehensive")
MATH_DIR = os.path.join(OUTPUT_DIR, "mathematics")
VISION_DIR = os.path.join(BASE_DIR, "scripts", "exam-bank-raw", "vision")

# =============================================================================
# ENHANCED JAPANESE + KOREAN KEYWORD CLASSIFICATION
# =============================================================================

# Strong Japanese domain classifiers
JAPANESE_DOMAIN_KEYWORDS = {
    "economy": [
        # Japanese economy terms
        "経済", "市場", "価格", "需要", "供給", "金利", "通貨", "物価",
        "インフレ", "デフレ", "ＧＤＰ", "国内総生産", "国民所得",
        "貿易", "輸出", "輸入", "関税", "国際収支", "経常収支",
        "財政", "租税", "法人税", "消費税", "金融", "銀行",
        "日本銀行", "日銀", "株式", "債券", "雇用", "失業", "賃金",
        "ジニ係数", "所得分配", "自由貿易", "保護貿易",
        "企業", "消費者", "生産", "分配", "消費", "労働組合",
        "世界銀行", "為替", "外為", "変動相場",
        "不況", "好況", "景気", "経済成長", "ＧＮＰ",
        "投資", "資本", "利子", "配当", "公共事業",
        "独占", "寡占", "競争", "カルテル",
        "労働力", "完全雇用", "ベーシック",
    ],
    "politics": [
        # Japanese politics terms  
        "日本国憲法", "憲法", "基本的人権", "三権分立",
        "国会", "衆議院", "参議院", "内閣", "首相",
        "選挙", "政党", "比例代表", "小選挙区",
        "地方自治", "地方公共団体", "裁判所", "最高裁判所",
        "国際連合", "国連", "安全保障理事会",
        "外交", "安全保障", "平和主義", "自衛隊",
        "参政権", "被選挙権", "選挙権",
        "政治参加", "世論", "デモクラシー",
        "法治国家", "司法", "立法", "行政",
        "条約", "国際法", "主権", "領土",
        "内閣総理大臣", "大統領",
        "基本的人権", "自由権", "社会権", "平等権",
    ],
    "history": [
        # Japanese history terms
        "産業革命", "市民革命", "フランス革命", "アメリカ独立",
        "ロシア革命", "帝国主義", "植民地", "世界大戦",
        "第一次世界大戦", "第二次世界大戦", "冷戦",
        "国際連盟", "世界恐慌", "ニューディール",
        "ナポレオン", "ビスマルク", "レーニン", "ヒトラー",
        "封建", "中世", "近代", "現代",
        "ルネサンス", "大航海時代",
        "ベルサイユ", "ベルサイユ条約",
        "独立", "革命", "戦争", "内戦",
        "共産主義", "社会主義", "資本主義", "ファシズム",
        "大日本帝国", "明治維新", "明治時代",
        "太平洋戦争", "第二次大戦",
        "冷たい戦争", "ベトナム戦争", "朝鮮戦争",
        "民族主義", "ナショナリズム",
    ],
    "geography": [
        # Japanese geography terms
        "気候", "ケッペン", "降水量", "気温", "地形",
        "プレート", "火山", "地震", "山地", "河川",
        "人口", "都市化", "人口密度", "出生率", "死亡率",
        "資源", "農業", "工業", "地図", "環境",
        "緯度", "経度", "赤道", "緯線", "経線",
        "大陸", "海洋", "半島", "島",
        "熱帯", "温帯", "冷帯", "寒帯", "乾燥帯",
        "地中海性気候", "温暖湿潤気候",
        "サバナ気候", "ステップ気候",
        "鉱産資源", "エネルギー", "石油",
        "人口増加", "人口減少", "都市",
        "気候区分", "海流", "偏西風",
    ],
    "society": [
        # Japanese society terms
        "少子高齢化", "社会保障", "福祉", "年金",
        "環境問題", "地球温暖化", "公害",
        "ボランティア", "現代社会",
        "情報化", "情報社会", "インターネット",
        "男女平等", "女性", "差別",
        "多文化", "移民", "難民",
        "生命倫理", "消費者", "プライバシー",
        "持続可能", "地球環境",
        "人権", "子どもの権利",
    ],
}

# Korean keyword classifiers (existing)
KOREAN_DOMAIN_KEYWORDS = {
    "economy": [
        "경제", "시장", "가격", "수요", "공급", "균형", "환율", "금리",
        "통화", "물가", "인플레", "디플레", "gdp", "국민소득", "경기",
        "성장", "무역", "수출", "수입", "관세", "국제수지", "재정",
        "조세", "세금", "금융", "은행", "중앙은행", "일본은행",
        "주식", "채권", "노동", "고용", "실업", "임금", "지니계수",
        "자유무역", "보호무역", "기업", "소비자", "생산", "분배", "소비",
    ],
    "politics": [
        "헌법", "기본권", "인권", "삼권분립", "입법", "행정", "사법",
        "의회", "국회", "내각", "수상", "대통령", "선거", "정당",
        "비례대표", "투표", "지방자치", "헌법재판", "법원", "재판",
        "국제연합", "un", "국제기구", "nato", "eu", "정치",
        "민주주의", "사회주의", "자유주의",
    ],
    "history": [
        "혁명", "산업혁명", "시민혁명", "프랑스혁명", "영국혁명",
        "명예혁명", "미국독립", "러시아혁명", "중국혁명",
        "제국주의", "식민지", "세계대전", "제1차", "제2차",
        "냉전", "대공황", "뉴딜", "근대", "전후", "중세",
        "독일", "프랑스", "영국", "미국", "러시아", "중국", "일본",
    ],
    "geography": [
        "기후", "케펜", "강수량", "기온", "온대", "열대", "냉대",
        "한대", "건조", "지중해", "사막", "지형", "판구조", "산맥",
        "인구", "도시화", "인구밀도", "자원", "농업", "공업",
        "지도", "환경", "위도", "경도", "적도",
    ],
    "society": [
        "환경문제", "공해", "지구온난화", "복지", "연금",
        "저출산", "고령화", "정보화", "인터넷", "다문화",
        "난민", "양성평등", "여성", "차별",
    ],
}

TOPIC_KEYWORDS = {
    "economy": {
        "수요·공급과 시장균형": ["需要", "供給", "市場均衡", "需要曲線", "供給曲線", "均衡価格", "수요", "공급", "시장균형"],
        "환율·국제수지": ["為替", "国際収支", "経常収支", "貿易収支", "환율", "국제수지", "변동환율", "고정환율"],
        "GDP·국민소득": ["ＧＤＰ", "国内総生産", "国民所得", "ＧＮＰ", "gdp", "국민소득", "경제성장률"],
        "재정·조세정책": ["財政", "租税", "国債", "財政政策", "재정", "조세", "세금", "국채"],
        "금융·통화정책": ["金融政策", "日本銀行", "日銀", "金利", "通貨", "통화", "금융", "중앙은행"],
        "국제무역": ["貿易", "関税", "自由貿易", "保護貿易", "무역", "관세", "수출", "수입"],
        "고용·노동": ["雇用", "失業", "賃金", "労働", "고용", "실업", "노동", "임금"],
        "경제성장·경기변동": ["景気", "経済成長", "好況", "不況", "경기", "성장", "경제성장"],
        "소득분배·지니계수": ["ジニ係数", "所得分配", "로렌츠", "지니계수"],
        "일본경제사": ["日本経済", "高度成長", "バブル", "일본경제", "버블"],
    },
    "politics": {
        "헌법·기본권": ["憲法", "基本的人権", "人権", "헌법", "기본권", "인권"],
        "통치기구": ["国会", "内閣", "三権分立", "首相", "국회", "내각", "수상", "입법", "행정", "사법"],
        "선거·정당": ["選挙", "政党", "比例代表", "선거", "정당", "비례대표", "투표"],
        "국제정치·국제기구": ["国際連合", "国連", "ＮＡＴＯ", "ＥＵ", "국제연합", "un", "nato"],
        "지방자치": ["地方自治", "지방자치"],
        "사법·재판": ["裁判所", "司法", "법원", "재판"],
        "안전보장·방위": ["安全保障", "自衛隊", "방위", "안보"],
        "정치사상": ["民主主義", "社会主義", "ロック", "ルソー", "민주주의"],
    },
    "history": {
        "시민혁명": ["市民革命", "フランス革命", "アメリカ独立", "시민혁명", "프랑스혁명"],
        "산업혁명·자본주의": ["産業革命", "資本主義", "산업혁명"],
        "제국주의·식민지": ["帝国主義", "植民地", "제국주의", "식민지"],
        "세계대전": ["世界大戦", "第一次", "第二次", "세계대전", "세계 대전"],
        "러시아혁명·소련": ["ロシア革命", "ソ連", "러시아혁명"],
        "냉전": ["冷戦", "베트남전쟁", "한국전쟁", "냉전"],
        "전후세계질서": ["国際連盟", "ベルサイユ", "전후"],
        "근대일본": ["明治維新", "近代日本", "메이지"],
        "대공황": ["世界恐慌", "ニューディール", "대공황", "뉴딜"],
    },
    "geography": {
        "기후·케펜구분": ["気候", "ケッペン", "降水量", "気温", "기후", "케펜", "강수량"],
        "지형·판구조": ["地形", "プレート", "山地", "지형", "판구조"],
        "인구·도시화": ["人口", "都市化", "人口密度", "인구", "도시화"],
        "자원·농업": ["資源", "農業", "工業", "자원", "농업", "공업"],
        "지도·GIS": ["地図", "지도"],
        "환경·생태": ["環境", "환경"],
    },
    "society": {
        "환경문제": ["環境問題", "地球温暖化", "환경문제"],
        "사회보장·복지": ["社会保障", "福祉", "年金", "사회보장", "복지"],
        "저출산·고령화": ["少子高齢化", "저출산", "고령화"],
        "정보화사회": ["情報化", "情報社会", "정보화"],
        "젠더·평등": ["男女平等", "여성", "차별"],
        "다문화사회": ["多文化", "移民", "난민"],
    },
}


def is_garbage_text(text):
    """Check if text is mostly garbage (OCR artifacts, instructions, headers)."""
    if not text or len(text) < 10:
        return True
    
    # Check for instruction-only text
    instruction_patterns = [
        r'注意事項', r'試験開始', r'解答用紙', r'鉛筆', r'監督者',
        r'持ち帰る', r'問題冊子', r'余白', r'メモ',
        r'平成\d+年度', r'The Examination',
        r'受験番号', r'名前', r'マーク',
    ]
    
    # If the text is primarily instruction words, it's garbage
    instruction_count = sum(1 for p in instruction_patterns if re.search(p, text))
    if instruction_count >= 3 and len(text) < 100:
        return True
    
    # Check for garbled text (high ratio of non-Japanese/Korean chars)
    # Japanese chars are in Unicode ranges: \u3040-\u309F (hiragana), \u30A0-\u30FF (katakana)
    # \u4E00-\u9FFF (kanji), \uAC00-\uD7AF (korean)
    jp_kr_chars = sum(1 for c in text if (
        '\u3040' <= c <= '\u309F' or  # hiragana
        '\u30A0' <= c <= '\u30FF' or  # katakana
        '\u4E00' <= c <= '\u9FFF' or  # kanji
        '\uAC00' <= c <= '\uD7AF'     # korean
    ))
    
    total_chars = len(text.replace(' ', '').replace('\n', ''))
    if total_chars == 0:
        return True
    
    ratio = jp_kr_chars / total_chars
    
    # Garbled text has very low Japanese/Korean character ratio
    if ratio < 0.05 and total_chars > 20:
        return True
    
    # Check if it starts with a real question marker
    if re.search(r'問\s*\d+', text):
        return False  # Real question
    
    # Very short text with no real content
    if ratio < 0.2 and total_chars < 50:
        return True
    
    return False


def classify_japanese_text(text):
    """Classify Japanese text using Japanese keywords."""
    if not text:
        return ("unknown", "", 0)
    
    domain_scores = {}
    for domain, keywords in JAPANESE_DOMAIN_KEYWORDS.items():
        score = 0
        matches = []
        for kw in keywords:
            if kw in text:
                # Weight: longer keywords are more specific
                w = len(kw) * 0.8
                score += w
                matches.append(kw)
        if matches:
            domain_scores[domain] = {"score": score, "matches": matches}
    
    if not domain_scores:
        return ("unknown", "", 0)
    
    best_domain = max(domain_scores.items(), key=lambda x: x[1]["score"])
    total_score = sum(d["score"] for d in domain_scores.values())
    confidence = min(0.95, best_domain[1]["score"] / max(total_score * 0.2, 1))
    
    # Find topic
    topic = ""
    best_topic_score = 0
    for topic_name, topic_kws in TOPIC_KEYWORDS.get(best_domain[0], {}).items():
        for kw in topic_kws:
            if kw in text:
                if len(kw) > best_topic_score:
                    best_topic_score = len(kw)
                    topic = topic_name
    
    return (best_domain[0], topic, round(min(confidence, 0.95), 2))


def classify_with_all_strategies(text, page_text=""):
    """Classify using Japanese + Korean keywords and page context."""
    combined = text + " " + page_text
    
    # Try Japanese classification first (most relevant for EJU)
    jap_domain, jap_topic, jap_conf = classify_japanese_text(combined)
    
    # If Japanese classification worked, use it
    if jap_domain != "unknown" and jap_conf >= 0.3:
        return (jap_domain, jap_topic, jap_conf)
    
    # Fallback: try Korean keywords
    combined_lower = combined.lower()
    domain_scores = {}
    for domain, keywords in KOREAN_DOMAIN_KEYWORDS.items():
        score = 0
        for kw in keywords:
            if kw.lower() in combined_lower:
                score += len(kw) * 0.5
        if score > 0:
            domain_scores[domain] = score
    
    if domain_scores:
        best_domain = max(domain_scores, key=lambda d: domain_scores[d])
        total_score = sum(domain_scores.values())
        conf = min(0.9, domain_scores[best_domain] / max(total_score * 0.3, 1))
        
        # Find topic
        topic = ""
        best_ts = 0
        for tn, tks in TOPIC_KEYWORDS.get(best_domain, {}).items():
            for kw in tks:
                if kw.lower() in combined_lower:
                    if len(kw) > best_ts:
                        best_ts = len(kw)
                        topic = tn
        
        return (best_domain, topic, round(min(conf, 0.9), 2))
    
    return ("unknown", "", 0)


def get_page_text_map(exam_data):
    """Build a map of page_number -> page_text for an exam."""
    page_texts = {}
    for page in exam_data.get("pages", []):
        pn = page.get("page_number", 0)
        pt = page.get("text", "")
        page_texts[pn] = pt
    return page_texts


def get_exam_distribution(exam_data):
    """Get domain distribution from existing classifications in an exam."""
    dist = Counter()
    for q in exam_data.get("questions", []):
        d = q.get("domain", "unknown")
        if d != "unknown":
            dist[d] += 1
    return dist


def process_all_exams():
    """Process ALL OCR exam files with enhanced classification."""
    all_clean_questions = []
    total_original = 0
    total_removed = 0
    total_classified = 0
    
    for fpath in sorted(glob.glob(os.path.join(OCR_DIR, "*", "exam_*.json"))):
        with open(fpath, "r", encoding="utf-8") as f:
            exam = json.load(f)
        
        year = exam.get("year", 0)
        round_num = exam.get("round", 0)
        source = exam.get("source_file", os.path.basename(fpath))
        page_texts = get_page_text_map(exam)
        
        # Get exam-level domain distribution for fallback
        domain_dist = get_exam_distribution(exam)
        total_known = sum(domain_dist.values())
        
        cleaned_questions = []
        for q in exam.get("questions", []):
            total_original += 1
            qn = q.get("number", 0)
            text = q.get("text", "") or q.get("raw_text", "")
            
            # Filter garbage
            if is_garbage_text(text):
                total_removed += 1
                continue
            
            # Get page text for context (question number / 10 approximates page)
            page_txt = page_texts.get(max(1, qn // 10 + 1), "")
            
            domain = q.get("domain", "unknown")
            topic = q.get("topic", "")
            
            # Reclassify if unknown or no topic
            if domain == "unknown" or not domain or not topic:
                new_domain, new_topic, conf = classify_with_all_strategies(text, page_txt)
                if domain == "unknown" or not domain:
                    domain = new_domain
                if not topic:
                    topic = new_topic
            
            # Fallback: if still unknown, use exam distribution
            if domain == "unknown" and total_known > 0:
                most_common = domain_dist.most_common(1)
                if most_common:
                    domain = most_common[0][0]
                    conf = 0.3
            
            total_classified += 1 if domain != "unknown" else 0
            
            cleaned_questions.append({
                "year": year,
                "round": round_num,
                "source_file": source,
                "question_number": qn,
                "domain": domain,
                "topic": topic,
                "source": "ocr_enhanced",
                "text_snippet": text[:300] if text else "",
            })
        
        all_clean_questions.extend(cleaned_questions)
        
        print(f"  {year}-r{round_num}: {len(cleaned_questions)} clean questions "
              f"(removed {len(exam.get('questions',[])) - len(cleaned_questions)} garbage)")
    
    return all_clean_questions


def process_vision_questions():
    """Load and standardize vision questions."""
    all_qs = []
    for fpath in sorted(glob.glob(os.path.join(VISION_DIR, "*.json"))):
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        year = data.get("year", 0)
        round_num = data.get("round", 1) if data.get("round") is not None else 0
        
        for i, q in enumerate(data.get("questions", [])):
            vision_subject = q.get("subject", "unknown")
            domain_map = {
                "economy": "economy", "politics": "politics",
                "history": "history", "geography": "geography", "society": "society"
            }
            domain = domain_map.get(vision_subject, "unknown")
            
            all_qs.append({
                "year": year,
                "round": round_num,
                "source_file": os.path.basename(fpath),
                "question_number": q.get("q", i+1),
                "domain": domain,
                "topic": q.get("topic", ""),
                "subtopic": q.get("sub", ""),
                "source": "vision",
                "text_snippet": q.get("topic", ""),
            })
    
    return all_qs


def save_results(clean_qs, vision_qs):
    """Save all results."""
    import json
    
    all_comprehensive = clean_qs + vision_qs
    
    # Count stats
    domain_known = sum(1 for q in clean_qs if q["domain"] != "unknown")
    topic_known = sum(1 for q in clean_qs if q["topic"])
    
    print(f"\n{'='*60}")
    print("CLASSIFICATION RESULTS")
    print(f"{'='*60}")
    print(f"  OCR questions (after filtering): {len(clean_qs)}")
    print(f"  Vision questions: {len(vision_qs)}")
    print(f"  Total comprehensive: {len(all_comprehensive)}")
    print(f"  Domain classified: {domain_known}/{len(clean_qs)} ({round(domain_known/len(clean_qs)*100,1)}%)")
    print(f"  Topic classified: {topic_known}/{len(clean_qs)} ({round(topic_known/len(clean_qs)*100,1)}%)")
    
    # Save reclassified data
    output = {
        "generated_at": datetime.now().isoformat(),
        "total_ocr_clean": len(clean_qs),
        "total_vision": len(vision_qs),
        "domain_rate": round(domain_known/len(clean_qs)*100, 1) if clean_qs else 0,
        "topic_rate": round(topic_known/len(clean_qs)*100, 1) if clean_qs else 0,
        "ocr_questions": clean_qs,
        "vision_questions": vision_qs,
    }
    
    os.makedirs(os.path.join(OUTPUT_DIR, "training"), exist_ok=True)
    path = os.path.join(OUTPUT_DIR, "training", "reclassified_ocr_data.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n  ✅ Saved: {path}")
    
    return all_comprehensive


if __name__ == "__main__":
    print("=" * 60)
    print("EJU Enhanced Classification Engine")
    print("=" * 60)
    print("\n📂 Processing OCR exams (2002-2015)...")
    clean_questions = process_all_exams()
    
    print("\n📂 Processing Vision questions (2016-2025)...")
    vision_questions = process_vision_questions()
    
    print("\n💾 Saving results...")
    all_data = save_results(clean_questions, vision_questions)
    
    print(f"\n{'='*60}")
    print("✅ Classification Engine Complete!")
    print(f"{'='*60}")
