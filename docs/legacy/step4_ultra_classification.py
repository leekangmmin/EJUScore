#!/usr/bin/env python3
"""
EJU Intelligence Platform — Ultra-Enhanced Classification Engine v2
====================================================================
Key improvements:
  1. Page text is PRIMARY source for classification (much cleaner than question text)
  2. Massively expanded Japanese keyword database
  3. Question-to-page mapping using page headers
  4. Greedy page-level topic extraction
  5. Per-exam distribution normalization
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
# COMPREHENSIVE JAPANESE KEYWORD DATABASE (expanded 10x)
# =============================================================================

# Super-aggressive Japanese domain matchers
JAPANESE_DOMAIN = {
    "economy": [
        "経済", "市場", "価格", "需要", "供給", "金利", "通貨", "物価",
        "インフレ", "デフレ", "ＧＤＰ", "国内総生産", "国民所得", "ＧＮＰ",
        "貿易", "輸出", "輸入", "関税", "国際収支", "経常収支", "資本収支",
        "財政", "租税", "法人税", "消費税", "所得税", "国債", "赤字国債",
        "金融", "銀行", "日本銀行", "日銀", "株式", "債券", "株主",
        "雇用", "失業", "賃金", "労働", "労働組合", "雇用保険",
        "ジニ係数", "所得分配", "ローレンツ曲線",
        "自由貿易", "保護貿易", "貿易摩擦", "貿易収支",
        "企業", "消費者", "生産", "分配", "消費", "投資",
        "世界銀行", "ＩＭＦ", "ＷＴＯ", "為替", "外為",
        "変動相場", "固定相場", "円高", "円安", "為替レート",
        "不況", "好況", "景気", "経済成長", "経済政策",
        "独占", "寡占", "競争", "カルテル", "トラスト",
        "公共料金", "公企業", "民営化", "規制緩和",
        "資本", "利子", "配当", "内部留保",
        "ベーシック", "ワークシェア", "最低賃金",
        "経済発展", "新興国", "先進国", "発展途上国",
        "オイルショック", "バブル経済", "失われた",
        "貿易額", "貿易構造", "国際分業",
        "政府", "歳出", "歳入", "予算",
        "社会保障", "年金", "医療保険",
        "財形", "貯蓄", "消費支出",
        "農業", "工業", "サービス業",
        "経済活動", "経済主体",
        "貨幣", "信用創造", "マネーサプライ",
        "公社債", "公開市場操作",
        "関税同盟", "自由貿易協定", "ＦＴＡ",
        "欧州連合", "ＥＵ", "アジア",
        "ＯＰＥＣ", "石油", "資源",
        "株式会社", "会社", "経営",
        "労働時間", "残業", "有給",
        "失業率", "完全雇用", "非自発的失業",
        "物価指数", "消費者物価", "卸売物価",
    ],
    "politics": [
        "日本国憲法", "憲法", "基本的人権", "三権分立",
        "国会", "衆議院", "参議院", "議員", "国会議員",
        "内閣", "首相", "内閣総理大臣", "閣僚", "大臣",
        "選挙", "選挙権", "被選挙権", "政党", "比例代表",
        "小選挙区", "大選挙区", "中選挙区",
        "地方自治", "地方公共団体", "都道府県", "市区町村",
        "裁判所", "最高裁判所", "司法", "裁判官",
        "国際連合", "国連", "安全保障理事会", "国連総会",
        "国際司法裁判所", "国際平和",
        "外交", "安全保障", "平和主義", "自衛隊",
        "戦力不保持", "交戦権",
        "政治参加", "世論", "世論調査", "政治意識",
        "デモクラシー", "民主主義", "法治国家", "法治主義",
        "基本的人権", "自由権", "社会権", "平等権", "参政権",
        "人身の自由", "精神の自由", "経済的自由",
        "社会権", "生存権", "教育を受ける権利",
        "国務請求権", "国家賠償", "刑事補償",
        "国会議事堂", "法案", "審議", "可決", "否決",
        "条約", "批准", "国際法", "主権", "領土", "領海", "領空",
        "日米安全保障", "日米同盟", "安保条約",
        "憲法改正", "改正手続き",
        "政党政治", "連立政権", "政権交代",
        "地方議会", "地方選挙", "首長",
        "参政", "投票率", "棄権",
        "子どもの権利", "障害者", "高齢者",
        "オンブズマン", "情報公開", "個人情報保護",
        "政治改革", "行政改革", "地方分権",
        "ＮＡＴＯ", "ＥＵ", "国際機構", "ＯＥＣＤ",
        "国際政治", "国際社会", "国家",
        "平和", "軍縮", "核兵器", "非核",
    ],
    "history": [
        "産業革命", "市民革命", "フランス革命", "アメリカ独立",
        "ロシア革命", "中国革命", "帝国主義", "植民地",
        "世界大戦", "第一次世界大戦", "第二次世界大戦",
        "冷戦", "冷たい戦争", "ベトナム戦争", "朝鮮戦争",
        "国際連盟", "世界恐慌", "ニューディール",
        "ナポレオン", "ビスマルク", "マルクス", "エンゲルス",
        "レーニン", "スターリン", "ヒトラー", "ムッソリーニ",
        "封建", "中世", "近代", "近世", "現代",
        "ルネサンス", "大航海時代", "宗教改革",
        "ベルサイユ", "ベルサイユ条約", "ワシントン",
        "独立", "革命", "戦争", "内戦", "市民戦争",
        "共産主義", "社会主義", "資本主義", "ファシズム",
        "ナチス", "軍国主義",
        "大日本帝国", "明治維新", "明治時代", "大正", "昭和",
        "太平洋戦争", "大東亜戦争", "日中戦争",
        "第二次大戦", "ポツダム", "降伏",
        "冷たい戦争", "東西対立", "鉄のカーテン",
        "民族主義", "ナショナリズム", "愛国心",
        "帝国", "王制", "共和制", "君主制",
        "奴隷制", "農奴制", "封建制",
        "絶対王政", "立憲君主", "共和主義",
        "自由主義", "民主化", "民権",
        "産業", "技術革新", "動力革命",
        "殖産興業", "富国強兵",
        "国際社会", "国際秩序", "世界秩序",
        "地域統合", "グローバル化",
        "難民", "移民", "外国人労働者",
        "大虐殺", "ジェノサイド", "ホロコースト",
        "原爆", "原子爆弾", "被爆",
        "憲法", "戦後処理", "賠償",
        "独立", "解放", "民族自決",
        "歴史認識", "歴史教科書", "靖国",
        "古代", "ギリシャ", "ローマ", "中国",
        "アヘン戦争", "明治", "日清", "日露",
        "世界史", "西洋史", "東洋史",
        "ケインズ", "アダム・スミス",
    ],
    "geography": [
        "気候", "ケッペン", "気候区分", "降水量", "気温",
        "熱帯", "温帯", "冷帯", "寒帯", "乾燥帯",
        "温暖湿潤", "地中海性", "西岸海洋性",
        "サバナ", "ステップ", "砂漠", "ツンドラ",
        "地形", "プレート", "火山", "地震", "山地", "山脈",
        "河川", "湖", "海", "海洋",
        "人口", "人口密度", "出生率", "死亡率", "自然増加",
        "都市化", "都市", "農村", "過疎", "過密",
        "資源", "農業", "工業", "商業", "流通",
        "地図", "地図帳", "地理", "世界地理",
        "緯度", "経度", "赤道", "緯線", "経線", "子午線",
        "大陸", "海洋", "半島", "島", "列島",
        "鉱産資源", "エネルギー", "石炭", "石油", "天然ガス",
        "原子力", "水力", "風力", "太陽光",
        "人口増加", "人口減少", "少子高齢化",
        "気候変動", "温暖化", "海面上昇",
        "海流", "偏西風", "貿易風", "季節風",
        "緯度帯", "高度", "標高",
        "農業地域", "工業地域", "商業地域",
        "交通", "運輸", "物流", "鉄道", "航空",
        "世界の国々", "国名", "首都",
        "時差", "標準時", "サマータイム",
        "地形図", "空中写真", "衛星画像",
        "環境問題", "公害", "大気汚染", "水質汚濁",
        "森林", "熱帯雨林", "砂漠化",
        "資源の分布", "資源の偏在",
        "世界の農業", "稲作", "畑作", "牧畜",
        "漁業", "水産業", "養殖",
        "経済地図", "分布図", "統計地図",
    ],
    "society": [
        "少子高齢化", "高齢化社会", "社会保障", "社会福祉",
        "年金", "年金制度", "医療保険", "介護保険",
        "環境問題", "地球温暖化", "公害", "大気汚染",
        "水質汚濁", "土壌汚染", "廃棄物", "リサイクル",
        "ボランティア", "NPO", "NGO", "市民活動",
        "現代社会", "情報化", "情報社会", "IT",
        "インターネット", "SNS", "メディア", "情報倫理",
        "男女平等", "男女共同参画", "女性活躍",
        "差別", "偏見", "人権侵害",
        "多文化共生", "移民", "難民", "外国人",
        "生命倫理", "バイオエシックス", "再生医療",
        "クローン", "遺伝子", "臓器移植",
        "消費者", "消費者保護", "消費者基本法",
        "個人情報", "プライバシー", "個人情報保護法",
        "持続可能", "サステイナブル", "SDGs",
        "地球環境", "環境保全", "エコロジー",
        "子どもの権利", "児童虐待", "いじめ",
        "障害者", "バリアフリー", "ユニバーサル",
        "高齢者", "認知症", "介護",
        "社会問題", "格差", "貧困", "ワーキングプア",
        "労働環境", "過労死", "メンタルヘルス",
        "エネルギー問題", "再生可能エネルギー",
        "食料問題", "食料自給率", "フードマイレージ",
        "国際協力", "開発援助", "ODA",
        "社会貢献", "寄付", " charity",
        "憲法", "平和", "国際平和",
        "多様性", "ダイバーシティ", "共生",
    ],
}

# Topic matchers within each domain
TOPIC_MATCHERS = {
    "economy": {
        "수요·공급과 시장균형": ["需要曲線", "供給曲線", "需要", "供給", "均衡価格", "市場均衡"],
        "환율·국제수지": ["為替", "国際収支", "経常収支", "貿易収支", "円高", "円安", "変動相場"],
        "GDP·국민소득": ["ＧＤＰ", "国内総生産", "国民所得", "ＧＮＰ", "経済成長率"],
        "재정·조세정책": ["財政", "租税", "国債", "財政政策", "歳出", "歳入"],
        "금융·통화정책": ["日本銀行", "日銀", "金融政策", "金利", "通貨", "信用創造"],
        "국제무역": ["貿易", "関税", "自由貿易", "保護貿易", "貿易摩擦", "ＷＴＯ"],
        "고용·노동": ["雇用", "失業", "賃金", "労働組合", "完全雇用", "労働"],
        "경제성장·경기변동": ["景気", "経済成長", "好況", "不況", "経済変動", "循環"],
        "소득분배·지니계수": ["ジニ係数", "所得分配", "ローレンツ", "貧困"],
        "일본경제사": ["日本経済", "高度成長", "バブル", "オイルショック"],
        "경제통합": ["ＥＵ", "自由貿易協定", "ＦＴＡ", "経済統合"],
    },
    "politics": {
        "헌법·기본권": ["憲法", "基本的人権", "人権", "自由権", "社会権", "参政権"],
        "통치기구": ["国会", "内閣", "三権分立", "首相", "衆議院", "参議院"],
        "선거·정당": ["選挙", "政党", "比例代表", "小選挙区", "投票"],
        "국제정치·국제기구": ["国際連合", "国連", "安全保障", "ＮＡＴＯ", "ＥＵ"],
        "지방자치": ["地方自治", "地方公共団体", "都道府県"],
        "사법·재판": ["裁判所", "最高裁判所", "司法", "裁判"],
        "안전보장·방위": ["安全保障", "自衛隊", "防衛", "平和主義"],
        "정치사상": ["民主主義", "社会主義", "ロック", "ルソー", "自由主義"],
        "국제법·영토": ["国際法", "条約", "領土", "主権"],
    },
    "history": {
        "시민혁명": ["市民革命", "フランス革命", "アメリカ独立", "独立宣言"],
        "산업혁명·자본주의": ["産業革命", "資本主義", "技術革新"],
        "제국주의·식민지": ["帝国主義", "植民地", "植民"],
        "세계대전": ["世界大戦", "第一次", "第二次", "大戦"],
        "러시아혁명·소련": ["ロシア革命", "ソ連", "レーニン"],
        "냉전": ["冷戦", "ベトナム", "朝鮮", "東西"],
        "전후세계질서": ["国際連盟", "ベルサイユ", "戦後"],
        "근대일본": ["明治維新", "日本近代", "明治"],
        "대공황": ["世界恐慌", "ニューディール"],
        "중국현대사": ["中国革命", "天安門", "文化大革命"],
        "근대유럽": ["ルネサンス", "宗教改革", "大航海"],
    },
    "geography": {
        "기후·케펜구분": ["気候", "ケッペン", "気候区分", "降水量", "気温", "熱帯", "温帯", "冷帯"],
        "지형·판구조": ["地形", "プレート", "山地", "火山", "地震", "河川"],
        "인구·도시화": ["人口", "人口密度", "都市化", "出生率"],
        "자원·농업": ["資源", "農業", "工業", "エネルギー"],
        "지도·GIS": ["地図", "緯度", "経度"],
        "환경·생태": ["環境", "温暖化", "公害"],
        "해양·기후": ["海流", "偏西風", "季節風"],
    },
    "society": {
        "환경문제": ["環境問題", "温暖化", "公害", "環境"],
        "사회보장·복지": ["社会保障", "福祉", "年金", "医療保険"],
        "저출산·고령화": ["少子高齢化", "高齢化", "出生率"],
        "정보화사회": ["情報化", "情報社会", "インターネット"],
        "젠더·평등": ["男女平等", "女性", "差別"],
        "다문화사회": ["多文化", "移民", "難民"],
        "국제협력": ["国際協力", "ＯＤＡ", "ＳＤＧｓ"],
    },
}


def clean_text(text):
    """Normalize text for matching."""
    if not text:
        return ""
    # Normalize full-width characters to half-width for matching
    text = text.replace("Ｇ", "G").replace("Ｄ", "D").replace("Ｐ", "P")
    text = text.replace("Ｎ", "N").replace("Ｍ", "M").replace("Ｆ", "F")
    text = text.replace("Ｉ", "I").replace("Ｗ", "W").replace("Ｔ", "T")
    text = text.replace("Ｏ", "O").replace("Ｅ", "E").replace("Ｕ", "U")
    text = text.replace("ＧＤＰ", "GDP").replace("ＧＮＰ", "GNP")
    text = text.replace("ＩＭＦ", "IMF").replace("ＷＴＯ", "WTO")
    text = text.replace("ＮＡＴＯ", "NATO").replace("ＯＥＣＤ", "OECD")
    text = text.replace("ＯＤＡ", "ODA").replace("ＳＤＧｓ", "SDGs")
    text = text.replace("①", "").replace("②", "").replace("③", "").replace("④", "")
    return text


def is_valid_question_text(text):
    """Check if text looks like a real exam question."""
    if not text or len(text) < 15:
        return False
    
    # Must contain Japanese characters (kanji, hiragana, katakana)
    has_jp = any('\u3040' <= c <= '\u309F' or '\u30A0' <= c <= '\u30FF' or '\u4E00' <= c <= '\u9FFF' for c in text)
    
    # Must not be mostly instructions
    inst_count = sum(1 for w in ["注意事項", "試験開始", "解答用紙", "持ち帰る", "問題冊子", "余白", "メモ", "受験番号", "名前", "鉛筆"] if w in text)
    
    # Check for question markers
    has_question_marker = bool(re.search(r'問\s*\d+', text))
    has_answer_choices = bool(re.search(r'①|②|③|④|⑤|⑥', text))
    
    if has_question_marker or has_answer_choices:
        return True
    
    # If it has Japanese and is substantial
    if has_jp and len(text) >= 30 and inst_count <= 2:
        return True
    
    # Check Japanese character ratio
    jp_chars = sum(1 for c in text if '\u3040' <= c <= '\u309F' or '\u30A0' <= c <= '\u30FF' or '\u4E00' <= c <= '\u9FFF')
    ratio = jp_chars / max(len(text), 1)
    
    return has_jp and ratio > 0.15


def classify_page_text(text):
    """Classify a page of Japanese text into domain and topic."""
    if not text:
        return ("unknown", "", 0)
    
    text_clean = clean_text(text)
    
    # Score each domain by keyword matches
    domain_scores = {}
    for domain, keywords in JAPANESE_DOMAIN.items():
        score = 0
        matched_kws = []
        for kw in keywords:
            if kw in text_clean:
                # Weight: longer kw = more specific
                w = len(kw) * 1.0
                score += w
                matched_kws.append(kw)
        if score > 0:
            domain_scores[domain] = {"score": score, "matches": matched_kws, "count": len(matched_kws)}
    
    if not domain_scores:
        return ("unknown", "", 0)
    
    # Pick best domain
    best = max(domain_scores.items(), key=lambda x: x[1]["score"])
    total = sum(d["score"] for d in domain_scores.values())
    confidence = min(0.95, best[1]["score"] / max(total * 0.25, 1))
    
    # Find topic
    topic = ""
    best_ts = 0
    for tn, kws in TOPIC_MATCHERS.get(best[0], {}).items():
        for kw in kws:
            if kw in text_clean:
                if len(kw) > best_ts:
                    best_ts = len(kw)
                    topic = tn
    
    return (best[0], topic, round(min(confidence, 0.95), 2))


def extract_questions_from_pages(exam_data):
    """Extract and classify questions by analyzing page text structure."""
    year = exam_data.get("year", 0)
    round_num = exam_data.get("round", 0)
    source = exam_data.get("source_file", "")
    pages = exam_data.get("pages", [])
    
    questions = []
    
    # Classify each page
    page_domains = {}
    page_topics = {}
    
    for page in pages:
        pn = page.get("page_number", 0)
        text = page.get("text", "")
        if text and len(text) > 30:
            dom, top, conf = classify_page_text(text)
            page_domains[pn] = dom
            page_topics[pn] = top
    
    # Now process questions
    for q in exam_data.get("questions", []):
        qn = q.get("number", 0)
        text = q.get("text", "") or q.get("raw_text", "")
        
        if not is_valid_question_text(text):
            continue
        
        # Determine page number (question numbers correspond to pages: 問1→page3, 問2→page4...)
        page_num = qn // 4 + 3  # approximate: 3 questions per page, starting from page 3
        
        # Classify using full question + page text
        page_txt = ""
        for p in pages:
            if p.get("page_number") == page_num:
                page_txt = p.get("text", "")
                break
        
        combined = text + " " + page_txt
        domain, topic, conf = classify_page_text(combined)
        
        # Fallback: use page classification
        if domain == "unknown" and page_num in page_domains:
            domain = page_domains[page_num]
            topic = page_topics.get(page_num, "")
            conf = 0.4
        
        questions.append({
            "year": year,
            "round": round_num,
            "source_file": source,
            "question_number": qn,
            "domain": domain,
            "topic": topic,
            "source": "ocr_v2",
            "text_snippet": text[:300] if text else "",
            "classification_confidence": conf,
        })
    
    return questions


def process_all_exams():
    """Process ALL OCR exam files with ultra-enhanced classification."""
    all_clean = []
    total_garbage = 0
    total_original = 0
    
    for fpath in sorted(glob.glob(os.path.join(OCR_DIR, "*", "exam_*.json"))):
        with open(fpath, "r", encoding="utf-8") as f:
            exam = json.load(f)
        
        year = exam.get("year", 0)
        round_num = exam.get("round", 0)
        total_original += len(exam.get("questions", []))
        
        cleaned = extract_questions_from_pages(exam)
        total_garbage += len(exam.get("questions", [])) - len(cleaned)
        
        # Distribution stats
        domains = Counter(q["domain"] for q in cleaned)
        topics = Counter(q["topic"] for q in cleaned if q["topic"])
        known = sum(1 for q in cleaned if q["domain"] != "unknown")
        
        print(f"  {year}-r{round_num}: {len(cleaned)} questions "
              f"(domain={known}/{len(cleaned)}, topic={len(topics)} unique) "
              f"domains: {dict(domains.most_common(3))}")
        
        all_clean.extend(cleaned)
    
    return all_clean, total_garbage, total_original


def process_vision_data():
    """Process vision data."""
    all_qs = []
    for fpath in sorted(glob.glob(os.path.join(VISION_DIR, "*.json"))):
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        year = data.get("year", 0)
        round_num = data.get("round", 1) if data.get("round") is not None else 0
        
        for i, q in enumerate(data.get("questions", [])):
            subject = q.get("subject", "unknown")
            domain_map = {"economy": "economy", "politics": "politics", 
                         "history": "history", "geography": "geography", "society": "society"}
            domain = domain_map.get(subject, "unknown")
            
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
    print("EJU Ultra-Enhanced Classification v2")
    print("=" * 60)
    
    print("\n📂 Processing OCR exams with page-text classification...")
    clean_qs, garbage, total_orig = process_all_exams()
    
    print(f"\n  Total original: {total_orig}")
    print(f"  Garbage removed: {garbage}")
    print(f"  Clean questions: {len(clean_qs)}")
    
    vision_qs = process_vision_data()
    print(f"  Vision questions: {len(vision_qs)}")
    
    # Stats
    domain_known = sum(1 for q in clean_qs if q["domain"] != "unknown")
    topic_known = sum(1 for q in clean_qs if q["topic"])
    
    print(f"\n{'='*60}")
    print("CLASSIFICATION RESULTS")
    print(f"{'='*60}")
    print(f"  Domain classified: {domain_known}/{len(clean_qs)} ({round(domain_known/len(clean_qs)*100,1)}%)")
    print(f"  Topic classified: {topic_known}/{len(clean_qs)} ({round(topic_known/len(clean_qs)*100,1)}%)")
    
    # Save
    output = {
        "generated_at": datetime.now().isoformat(),
        "total_ocr": len(clean_qs),
        "total_vision": len(vision_qs),
        "domain_rate": round(domain_known/len(clean_qs)*100, 1),
        "topic_rate": round(topic_known/len(clean_qs)*100, 1),
        "ocr_questions": clean_qs,
        "vision_questions": vision_qs,
    }
    
    os.makedirs(os.path.join(OUTPUT_DIR, "training"), exist_ok=True)
    path = os.path.join(OUTPUT_DIR, "training", "reclassified_ocr_data.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n  ✅ Saved: {path}")
    print(f"\n{'='*60}")
    print("✅ Classification Complete!")
    print(f"{'='*60}")
