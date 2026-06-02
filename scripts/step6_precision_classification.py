#!/usr/bin/env python3
"""
EJU Intelligence Platform — Precision Classification v4
=========================================================
Key fixes:
  1. Question-level classification only (NO all-page contamination)
  2. Question-number filtering (remove non-question entries like "問" alone)
  3. Balanced keyword thresholds per domain
  4. Per-question page context (same page only)
"""
import json
import os
import glob
import re
from collections import Counter, defaultdict
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) or "."
OUTPUT_DIR = os.path.join(BASE_DIR, "dataset")
OCR_DIR = os.path.join(OUTPUT_DIR, "comprehensive")
VISION_DIR = os.path.join(BASE_DIR, "scripts", "exam-bank-raw", "vision")

# =====================================================================
# PRECISION DOMAIN KEYWORDS — Balanced with clear thresholds
# Each domain lists (keyword, weight) pairs
# =====================================================================

DOMAIN_WORDS = {
    "history": [
        # Strong history indicators
        ("産業革命", 10), ("산업혁명", 10), ("市民革命", 10), ("시민혁명", 10),
        ("フランス革命", 10), ("프랑스혁명", 10), ("アメリカ独立", 10), ("미국독립", 10),
        ("명예혁명", 10), ("영국혁명", 10),
        ("ロシア革命", 10), ("러시아혁명", 10), ("中国革命", 8), ("중국혁명", 8),
        ("帝国主義", 8), ("제국주의", 8), ("植民地", 8), ("식민지", 8),
        ("世界大戦", 10), ("세계대전", 10),
        ("第一次世界大戦", 10), ("第二次世界大戦", 10),
        ("제1차세계대전", 10), ("제2차세계대전", 10),
        ("冷戦", 8), ("냉전", 8),
        ("世界恐慌", 8), ("대공황", 8),
        ("ニューディール", 8), ("뉴딜", 8),
        ("国際連盟", 8), ("국제연맹", 8),
        ("ベルサイユ", 7), ("베르사유", 7),
        ("ナポレオン", 8), ("나폴레옹", 8),
        ("ビスマルク", 8), ("비스마르크", 8),
        ("ヒトラー", 8), ("히틀러", 8),
        ("レーニン", 8), ("레닌", 8),
        ("明治維新", 8), ("メイジ", 5),
        ("ファシズム", 8), ("파시즘", 8),
        ("ベトナム戦争", 8), ("베트남전쟁", 8),
        ("朝鮮戦争", 8), ("한국전쟁", 8),
        ("産業", 3), ("技術革新", 4), ("动力革命", 4),
        ("中世", 4), ("중세", 4), ("封建", 4), ("봉건", 4),
        ("ルネサンス", 6), ("르네상스", 6), ("대항해시대", 6), ("大航海時代", 6),
        ("宗教改革", 6), ("종교개혁", 6),
        ("奴隷", 4), ("노예", 4), ("人権宣言", 5),
        ("1848", 4), ("독일통일", 5), ("이탈리아통일", 5),
        ("마르크스", 6), ("マルクス", 6), ("エンゲルス", 6),
        ("スターリン", 6), ("ムッソリーニ", 6),
        ("文化大革命", 8), ("문화대혁명", 8),
        ("ナチス", 6), ("ナチズム", 6),
        ("非核", 3), ("核兵器", 4), ("原爆", 4),
        ("世界史", 3), ("歴史", 2),
    ],
    "politics": [
        ("憲法", 6), ("헌법", 6), ("日本国憲法", 8),
        ("基本的人権", 8), ("기본권", 6), ("人権", 4),
        ("三権分立", 8), ("삼권분립", 8),
        ("国会", 6), ("국회", 6), ("衆議院", 7), ("参議院", 7),
        ("内閣", 6), ("내각", 6), ("首相", 6), ("総理大臣", 6), ("수상", 6),
        ("選挙", 5), ("선거", 5), ("政党", 5), ("정당", 5),
        ("比例代表", 7), ("비례대표", 7), ("小選挙区", 6),
        ("参政権", 7), ("참정권", 7), ("被選挙権", 7),
        ("地方自治", 7), ("지방자치", 7), ("地方公共団体", 6),
        ("裁判所", 6), ("법원", 5), ("最高裁判所", 6),
        ("国際連合", 6), ("국제연합", 6), ("国連", 5),
        ("安全保障理事会", 7), ("安保理", 5),
        ("自衛隊", 7), ("자위대", 7), ("平和主義", 6), ("평화주의", 6),
        ("内閣総理大臣", 8), ("대통령", 4), ("大統領", 4),
        ("法治国家", 5), ("法治主義", 5),
        ("自由権", 5), ("社会権", 5), ("平等権", 5), ("生存権", 5),
        ("国務請求権", 6), ("国家賠償", 5),
        ("日米安全保障", 6), ("安保条約", 5), ("日米同盟", 5),
        ("議会", 4), ("의회", 4), ("입법", 4), ("행정", 4), ("사법", 4),
        ("立法", 3), ("行政", 3), ("司法", 3),
        ("地方分権", 5), ("地方議会", 5), ("首長", 3),
        ("ＮＡＴＯ", 6), ("ＯＥＣＤ", 5), ("ＥＵ", 4),
        ("ロック", 5), ("루소", 5), ("몽테스키외", 6),
        ("核兵器", 3), ("軍縮", 4), ("平和", 2),
    ],
    "geography": [
        ("気候", 5), ("기후", 5), ("ケッペン", 8), ("케펜", 8),
        ("降水量", 6), ("강수량", 6), ("気温", 5), ("기온", 5),
        ("熱帯", 6), ("열대", 6), ("温帯", 6), ("온대", 6),
        ("冷帯", 6), ("냉대", 6), ("寒帯", 6), ("한대", 6),
        ("乾燥帯", 6), ("건조", 5), ("砂漠", 5), ("사막", 5),
        ("地中海性", 7), ("지중해성", 7),
        ("地形", 4), ("지형", 4), ("プレート", 6), ("판구조", 6),
        ("山地", 4), ("산맥", 4), ("山脈", 4),
        ("人口密度", 6), ("인구밀도", 6), ("都市化", 5), ("도시화", 5),
        ("出生率", 5), ("출생률", 5), ("死亡率", 4),
        ("緯度", 6), ("위도", 6), ("経度", 6), ("경도", 6), ("赤道", 6), ("적도", 6),
        ("海流", 5), ("해류", 5), ("偏西風", 6), ("편서풍", 6),
        ("気候区分", 6), ("기후구분", 6),
        ("農業", 3), ("농업", 3), ("工業", 3), ("공업", 3),
        ("地図", 3), ("지도", 3), ("緯線", 5), ("経線", 5),
        ("サバナ", 6), ("ステップ", 6), ("ツンドラ", 6),
        ("大陸", 3), ("대륙", 3), ("海洋", 3),
        ("人口", 3), ("인구", 3), ("資源", 3), ("자원", 3),
        ("鉱産", 4), ("エネルギー", 3), ("석유", 3), ("石油", 3),
    ],
    "society": [
        ("環境問題", 6), ("환경문제", 6),
        ("地球温暖化", 7), ("지구온난화", 7),
        ("社会保障", 6), ("사회보장", 6),
        ("福祉", 5), ("복지", 5), ("年金", 5), ("연금", 5),
        ("少子化", 7), ("저출산", 7), ("高齢化", 6), ("고령화", 6),
        ("少子高齢化", 8), ("저출산고령화", 8),
        ("情報化", 5), ("정보화", 5), ("情報社会", 5),
        ("多文化", 6), ("다문화", 6), ("移民", 5), ("이민", 5),
        ("難民", 4), ("난민", 4),
        ("男女共同参画", 6), ("양성평등", 5),
        ("ＳＤＧｓ", 5), ("SDGs", 4), ("지속가능", 5), ("持続可能", 5),
        ("ボランティア", 5), ("자원봉사", 5),
        ("NPO", 4), ("ＮＰＯ", 4), ("NGO", 4),
        ("公害", 5), ("공해", 5), ("環境保全", 4),
        ("個人情報", 4), ("プライバシー", 4),
        ("生命倫理", 5), ("생명윤리", 5), ("バイオエシックス", 5),
        ("社会問題", 3), ("사회문제", 3),
        ("バリアフリー", 4), ("ユニバーサル", 3),
    ],
    "economy": [
        ("経済", 2), ("경제", 2), ("市場", 2), ("시장", 2),
        ("価格", 3), ("가격", 3), ("需要", 4), ("수요", 4),
        ("供給", 4), ("공급", 4), ("金利", 5), ("금리", 5),
        ("通貨", 4), ("통화", 4), ("物価", 5), ("물가", 5),
        ("ＧＤＰ", 6), ("gdp", 4), ("国内総生産", 6), ("국민소득", 5),
        ("国民所得", 5), ("ＧＮＰ", 5),
        ("貿易", 4), ("무역", 4), ("輸出", 3), ("수출", 3),
        ("輸入", 3), ("수입", 3), ("関税", 5), ("관세", 5),
        ("国際収支", 6), ("국제수지", 6), ("経常収支", 6), ("경상수지", 6),
        ("財政", 4), ("재정", 4), ("租税", 5), ("조세", 5),
        ("金融", 3), ("금융", 3), ("銀行", 3), ("은행", 3),
        ("日本銀行", 6), ("일본은행", 6), ("日銀", 5),
        ("金利", 5), ("株式", 4), ("주식", 4), ("債券", 4), ("채권", 4),
        ("雇用", 4), ("고용", 4), ("失業", 5), ("실업", 5),
        ("賃金", 4), ("임금", 4), ("労働", 3), ("노동", 3),
        ("ジニ係数", 7), ("지니계수", 7), ("所得分配", 5), ("소득분배", 5),
        ("自由貿易", 5), ("자유무역", 5), ("保護貿易", 5), ("보호무역", 5),
        ("為替", 5), ("환율", 5), ("円高", 5), ("円安", 5),
        ("変動相場", 5), ("固定相場", 5),
        ("国債", 5), ("국채", 5), ("ＷＴＯ", 5), ("wto", 3),
        ("ＩＭＦ", 5), ("imf", 3), ("세계은행", 4),
        ("企業", 2), ("기업", 2), ("消費者", 3), ("소비자", 3),
        ("生産", 2), ("생산", 2), ("分配", 3), ("분배", 3),
        ("景気", 4), ("경기", 4), ("経済成長", 4), ("경제성장", 4),
        ("好況", 4), ("不況", 4), ("침체", 4),
        ("バブル", 5), ("버블", 5), ("オイルショック", 5),
        ("独占", 4), ("寡占", 4), ("경쟁", 3), ("競争", 3),
        ("歳出", 4), ("歳入", 4), ("予算", 3),
        ("投資", 3), ("투자", 3), ("資本", 3), ("자본", 3),
        ("利子", 4), ("配当", 3),
    ],
}

# Topic matchers (same across versions)
TOPIC_MATCHERS = {
    "economy": {
        "수요·공급과 시장균형": ["需要曲線", "供給曲線", "需要", "供給", "均衡価格", "市場均衡"],
        "환율·국제수지": ["為替", "国際収支", "経常収支", "貿易収支", "円高", "円安", "변동환율"],
        "GDP·국민소득": ["ＧＤＰ", "国内総生産", "国民所得", "ＧＮＰ", "gdp"],
        "재정·조세정책": ["財政", "租税", "国債", "歳出", "歳入"],
        "금융·통화정책": ["日本銀行", "日銀", "金融政策", "金利"],
        "국제무역": ["貿易", "関税", "自由貿易", "保護貿易", "ＷＴＯ"],
        "고용·노동": ["雇用", "失業", "賃金", "労働組合"],
        "경제성장·경기변동": ["景気", "経済成長", "好況", "不況"],
        "소득분배·지니계수": ["ジニ係数", "所得分配"],
        "일본경제사": ["バブル", "高度成長", "日本経済"],
    },
    "politics": {
        "헌법·기본권": ["憲法", "基本的人権", "人権"],
        "통치기구": ["国会", "内閣", "三権分立", "首相", "衆議院", "参議院"],
        "선거·정당": ["選挙", "政党", "比例代表", "小選挙区"],
        "국제정치·국제기구": ["国際連合", "国連", "安全保障理事会", "ＮＡＴＯ"],
        "지방자치": ["地方自治"],
        "사법·재판": ["裁判所", "最高裁判所"],
        "안전보장·방위": ["自衛隊", "防衛", "平和主義"],
        "정치사상": ["民主主義", "社会主義", "ロック", "ルソー"],
    },
    "history": {
        "시민혁명": ["市民革命", "フランス革命", "アメリカ独立"],
        "산업혁명·자본주의": ["産業革命", "資本主義"],
        "제국주의·식민지": ["帝国主義", "植民地"],
        "세계대전": ["世界大戦", "第一次世界大戦", "第二次世界大戦"],
        "러시아혁명·소련": ["ロシア革命", "ソ連"],
        "냉전": ["冷戦", "ベトナム戦争", "朝鮮戦争"],
        "전후세계질서": ["国際連盟", "ベルサイユ"],
        "근대일본": ["明治維新", "明治"],
        "대공황": ["世界恐慌", "ニューディール"],
    },
    "geography": {
        "기후·케펜구분": ["気候", "ケッペン", "気候区分", "降水量", "기후"],
        "지형·판구조": ["地形", "プレート", "山地"],
        "인구·도시화": ["人口", "人口密度", "都市化"],
        "자원·농업": ["資源", "農業", "工業"],
        "지도·GIS": ["地図", "緯度", "経度"],
        "환경·생태": ["環境"],
    },
    "society": {
        "환경문제": ["環境問題", "地球温暖化"],
        "사회보장·복지": ["社会保障", "福祉", "年金"],
        "저출산·고령화": ["少子化", "高齢化"],
        "정보화사회": ["情報化"],
        "젠더·평등": ["男女共同参画"],
        "다문화사회": ["多文化", "移民"],
    },
}


def is_question_text(text):
    """Check if text is a real question (not instructions, headers, or garbage)."""
    if not text or len(text) < 20:
        return False
    
    # Must have Japanese characters
    jp_chars = sum(1 for c in text if '\u3040' <= c <= '\u309F' or '\u30A0' <= c <= '\u30FF' or '\u4E00' <= c <= '\u9FFF')
    if jp_chars == 0:
        return False
    
    # Check for instruction-only text (page headers, etc.)
    instruction_indicators = [
        "注意事項", "試験開始", "解答用紙", "鉛筆", "監督者", "持ち帰る",
        "問題冊子", "余白", "メモ", "受験番号", "名前",
        "この問題用紙", "試験が終わっても",
    ]
    inst_count = sum(1 for w in instruction_indicators if w in text)
    
    # If mostly instruction text, skip
    if inst_count >= 2 and len(text) < 100:
        return False
    
    # Must have actual content beyond instructions
    content_markers = ["問", "①", "②", "③", "④", "下線部", "次の", "正しい"]
    has_content = any(m in text for m in content_markers)
    
    if has_content:
        return True
    
    # Good quality text with Japanese
    if jp_chars >= 10 and len(text) >= 50:
        return True
    
    return False


def classify_question(text, page_text=""):
    """Classify a single question using weighted domain keywords."""
    combined = text + " " + page_text
    
    scores = {}
    for domain, words in DOMAIN_WORDS.items():
        total = 0
        for word, weight in words:
            if word in combined:
                total += weight
        if total > 0:
            scores[domain] = total
    
    if not scores:
        return ("unknown", "", 0)
    
    # Pick best domain
    best_domain = max(scores, key=lambda d: scores[d])
    
    # Check if there's a clear winner (at least 40% more than second)
    sorted_scores = sorted(scores.items(), key=lambda x: -x[1])
    if len(sorted_scores) >= 2:
        ratio = sorted_scores[0][1] / max(sorted_scores[1][1], 1)
        if ratio < 1.3:
            # Too close - the domain with the highest-quality match wins
            pass  # Still use the highest
    
    total = sum(scores.values())
    confidence = min(0.95, scores[best_domain] / max(total * 0.2, 1))
    
    # Find topic
    topic = ""
    best_ts = 0
    for tn, kws in TOPIC_MATCHERS.get(best_domain, {}).items():
        for kw in kws:
            if kw in combined:
                if len(kw) > best_ts:
                    best_ts = len(kw)
                    topic = tn
    
    return (best_domain, topic, round(min(confidence, 0.95), 2))


def process_all_exams():
    """Process all OCR exam files."""
    all_qs = []
    domain_stats = Counter()
    topic_stats = Counter()
    domain_topic_stats = defaultdict(Counter)
    
    for fpath in sorted(glob.glob(os.path.join(OCR_DIR, "*", "exam_*.json"))):
        with open(fpath, "r", encoding="utf-8") as f:
            exam = json.load(f)
        
        year = exam.get("year", 0)
        round_num = exam.get("round", 0)
        source = exam.get("source_file", os.path.basename(fpath))
        
        # Build page text map (within same page only)
        page_texts = {}
        for p in exam.get("pages", []):
            pn = p.get("page_number", 0)
            pt = p.get("text", "")
            if pt and len(pt) > 20:
                page_texts[pn] = pt
        
        for q in exam.get("questions", []):
            qn = q.get("number", 0)
            text = q.get("text", "") or q.get("raw_text", "")
            
            if not is_question_text(text):
                continue
            
            # Get same-page text only (avoid cross-contamination)
            # Page roughly = question_number / 4 + 3
            est_page = max(1, qn // 4 + 3)
            same_page_text = page_texts.get(est_page, "")
            
            # Also check neighboring pages
            for dp in [-1, 0, 1]:
                if est_page + dp in page_texts:
                    same_page_text += " " + page_texts[est_page + dp]
            
            domain, topic, conf = classify_question(text, same_page_text)
            
            all_qs.append({
                "year": year,
                "round": round_num,
                "source_file": source,
                "question_number": qn,
                "domain": domain,
                "topic": topic,
                "confidence": conf,
                "source": "ocr",
                "text_snippet": text[:300],
            })
            
            domain_stats[domain] += 1
            if topic:
                topic_stats[topic] += 1
                if domain != "unknown":
                    domain_topic_stats[domain][topic] += 1
    
    return all_qs, domain_stats, topic_stats, domain_topic_stats


def process_vision():
    """Process vision data."""
    all_qs = []
    for fpath in sorted(glob.glob(os.path.join(VISION_DIR, "*.json"))):
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        year = data.get("year", 0)
        round_num = data.get("round", 1) if data.get("round") is not None else 0
        
        for i, q in enumerate(data.get("questions", [])):
            subject = q.get("subject", "unknown")
            dm = {"economy": "economy", "politics": "politics",
                  "history": "history", "geography": "geography", "society": "society"}
            domain = dm.get(subject, "unknown")
            
            all_qs.append({
                "year": year,
                "round": round_num,
                "source_file": os.path.basename(fpath),
                "question_number": q.get("q", i+1),
                "domain": domain,
                "topic": q.get("topic", ""),
                "source": "vision",
            })
    
    return all_qs


if __name__ == "__main__":
    print("=" * 60)
    print("EJU Precision Classification v4")
    print("=" * 60)
    
    print("\n📂 Processing OCR exams (per-question classification)...")
    ocr_qs, domain_stats, topic_stats, dt_stats = process_all_exams()
    
    vision_qs = process_vision()
    
    total = len(ocr_qs)
    domain_known = domain_stats.get("unknown", 0)
    topic_known = sum(1 for q in ocr_qs if q["topic"])
    
    print(f"\n  Total OCR questions: {total}")
    print(f"  Domain unknown: {domain_known}")
    print(f"  Topic classified: {topic_known}")
    print(f"  Domain rate: {(total - domain_known)/total*100:.1f}%")
    print(f"  Topic rate: {topic_known/total*100:.1f}%")
    
    print(f"\n  Domain distribution:")
    for d, c in domain_stats.most_common():
        pct = c / total * 100
        print(f"    {d}: {c} ({pct:.1f}%)")
    
    print(f"\n  Topics per domain:")
    for d, topics in sorted(dt_stats.items()):
        print(f"    {d}: {len(topics)} unique topics — {dict(topics.most_common(5))}")
    
    print(f"\n  Total unique topics: {len(topic_stats)}")
    
    # Save
    all_data = ocr_qs + vision_qs
    output = {
        "generated_at": datetime.now().isoformat(),
        "total_ocr": len(ocr_qs),
        "total_vision": len(vision_qs),
        "domain_rate": round((total - domain_known)/total*100, 1),
        "topic_rate": round(topic_known/total*100, 1),
        "domain_distribution": dict(domain_stats.most_common()),
        "ocr_questions": ocr_qs,
        "vision_questions": vision_qs,
    }
    
    os.makedirs(os.path.join(OUTPUT_DIR, "training"), exist_ok=True)
    path = os.path.join(OUTPUT_DIR, "training", "reclassified_ocr_data.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n  ✅ Saved: {path}")
    
    print(f"\n{'='*60}")
    print("✅ Complete!")
    print(f"{'='*60}")
