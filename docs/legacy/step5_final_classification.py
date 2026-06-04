#!/usr/bin/env python3
"""
EJU Intelligence Platform — Final Classification Fix v3
========================================================
Fully self-contained with domain overrides and improved topic matching.
Target: 99%+ domain, 95%+ topic classification for OCR data.
"""
import json
import os
import glob
import re
from collections import defaultdict, Counter
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) or "."
OUTPUT_DIR = os.path.join(BASE_DIR, "dataset")
OCR_DIR = os.path.join(OUTPUT_DIR, "comprehensive")
VISION_DIR = os.path.join(BASE_DIR, "scripts", "exam-bank-raw", "vision")

# =====================================================================
# Strong domain indicators — weighted by specificity
# =====================================================================

STRONG_DOMAIN_INDICATORS = {
    "history": {
        "words": [
            ("산업혁명", 5.0), ("産業革命", 5.0), ("시민혁명", 5.0), ("市民革命", 5.0),
            ("프랑스혁명", 5.0), ("フランス革命", 5.0), ("명예혁명", 5.0),
            ("미국독립", 4.5), ("アメリカ独立", 4.5),
            ("러시아혁명", 5.0), ("ロシア革命", 5.0),
            ("제국주의", 4.5), ("帝国主義", 4.5), ("식민지", 4.0), ("植民地", 4.0),
            ("세계대전", 5.0), ("世界大戦", 5.0), ("냉전", 4.5), ("冷戦", 4.5),
            ("제1차세계대전", 5.0), ("第一次世界大戦", 5.0),
            ("제2차세계대전", 5.0), ("第二次世界大戦", 5.0),
            ("대공황", 4.5), ("世界恐慌", 4.5), ("뉴딜", 4.0), ("ニューディール", 4.0),
            ("베르사유", 4.0), ("ベルサイユ", 4.0),
            ("국제연맹", 4.0), ("国際連盟", 4.0),
            ("나폴레옹", 4.5), ("ナポレオン", 4.5),
            ("비스마르크", 4.5), ("ビスマルク", 4.5),
            ("히틀러", 4.5), ("ヒトラー", 4.5), ("레닌", 4.5), ("レーニン", 4.5),
            ("메이지", 4.5), ("明治", 4.5), ("明治維新", 5.0),
            ("파시즘", 4.5), ("ファシズム", 4.5),
            ("민족주의", 3.5), ("ナショナリズム", 3.5),
            ("대항해시대", 4.0), ("大航海時代", 4.0),
            ("르네상스", 4.0), ("ルネサンス", 4.0),
            ("계몽주의", 4.0), ("啓蒙主義", 4.0),
            ("인권선언", 4.0), ("人権宣言", 4.0),
            ("중세", 3.5), ("中世", 3.5), ("봉건", 3.5), ("封建", 3.5),
            ("독일통일", 4.0), ("이탈리아통일", 4.0),
            ("중국혁명", 4.0), ("中国革命", 4.0),
            ("베트남전쟁", 4.5), ("ベトナム戦争", 4.5),
            ("한국전쟁", 4.5), ("朝鮮戦争", 4.5),
            ("제1차", 3.0), ("제2차", 3.0), ("1차대전", 4.0), ("2차대전", 4.0),
        ],
        "min_score": 3.0
    },
    "politics": {
        "words": [
            ("헌법", 4.0), ("憲法", 4.0), ("日本国憲法", 5.0),
            ("기본권", 4.0), ("基本的人権", 4.5), ("인권", 3.5),
            ("삼권분립", 5.0), ("三権分立", 5.0),
            ("국회", 4.5), ("国会", 4.5), ("의회", 4.0),
            ("내각", 4.5), ("内閣", 4.5), ("수상", 4.5), ("首相", 4.5),
            ("선거", 4.0), ("選挙", 4.0), ("정당", 4.0), ("政党", 4.0),
            ("비례대표", 4.5), ("比例代表", 4.5),
            ("투표", 3.5), ("投票", 3.5), ("참정권", 4.5), ("参政権", 4.5),
            ("지방자치", 4.5), ("地方自治", 4.5),
            ("법원", 4.0), ("裁判所", 4.0), ("재판", 3.5),
            ("국제연합", 4.5), ("国際連合", 4.5), ("国連", 4.0), ("un", 2.0),
            ("안전보장", 4.0), ("安全保障", 4.0),
            ("자위대", 4.5), ("自衛隊", 4.5), ("평화주의", 4.0), ("平和主義", 4.0),
            ("민주주의", 3.5), ("民主主義", 3.5),
            ("로크", 4.0), ("ロック", 4.0), ("루소", 4.0), ("ルソー", 4.0),
            ("몽테스키외", 4.5), ("モンテスキュー", 4.5),
            ("众议院", 3.0), ("衆議院", 4.0), ("参議院", 4.0),
            ("내각총리대신", 5.0), ("内閣総理大臣", 5.0),
        ],
        "min_score": 3.0
    },
    "geography": {
        "words": [
            ("기후", 3.5), ("気候", 3.5), ("케펜", 5.0), ("ケッペン", 5.0),
            ("강수량", 4.0), ("降水量", 4.0), ("기온", 3.5), ("気温", 3.5),
            ("온대", 4.0), ("温帯", 4.0), ("열대", 4.0), ("熱帯", 4.0),
            ("냉대", 4.0), ("冷帯", 4.0), ("한대", 4.0), ("寒帯", 4.0),
            ("건조", 3.5), ("乾燥", 3.5), ("사막", 3.5), ("砂漠", 3.5),
            ("지형", 3.5), ("地形", 3.5), ("판구조", 4.0), ("プレート", 4.0),
            ("산맥", 3.5), ("山脈", 3.5), ("하천", 3.5),
            ("인구", 3.0), ("人口", 3.0), ("인구밀도", 4.0), ("人口密度", 4.0),
            ("도시화", 4.0), ("都市化", 4.0), ("출생률", 3.5), ("出生率", 3.5),
            ("자원", 3.0), ("資源", 3.0), ("농업", 3.0), ("農業", 3.0),
            ("공업", 3.0), ("工業", 3.0), ("지도", 3.0), ("地図", 3.0),
            ("위도", 4.0), ("緯度", 4.0), ("경도", 4.0), ("経度", 4.0),
            ("적도", 4.0), ("赤道", 4.0), ("대륙", 3.5),
            ("해류", 3.5), ("海流", 3.5), ("편서풍", 4.0), ("偏西風", 4.0),
            ("지중해성", 4.5), ("地中海性", 4.5),
        ],
        "min_score": 3.0
    },
    "society": {
        "words": [
            ("환경문제", 4.0), ("環境問題", 4.0),
            ("지구온난화", 4.5), ("地球温暖化", 4.5),
            ("사회보장", 4.0), ("社会保障", 4.0),
            ("복지", 3.5), ("福祉", 3.5), ("연금", 3.5), ("年金", 3.5),
            ("저출산", 4.5), ("少子化", 4.5), ("고령화", 4.0), ("高齢化", 4.0),
            ("정보화", 3.5), ("情報化", 3.5),
            ("다문화", 4.0), ("多文化", 4.0), ("난민", 3.5), ("難民", 3.5),
            ("양성평등", 4.0), ("男女平等", 4.0),
            ("소비자보호", 3.5), ("消費者保護", 3.5),
            ("sdgs", 3.0), ("ＳＤＧｓ", 3.5),
            ("지속가능", 3.5), ("持続可能", 3.5),
        ],
        "min_score": 3.0
    },
    "economy": {
        "words": [
            ("경제", 2.5), ("経済", 2.5), ("시장", 2.5), ("市場", 2.5),
            ("가격", 2.5), ("価格", 2.5), ("수요", 3.0), ("需要", 3.0),
            ("공급", 3.0), ("供給", 3.0), ("환율", 4.0), ("為替", 4.0),
            ("금리", 4.0), ("金利", 4.0), ("통화", 3.5), ("通貨", 3.5),
            ("물가", 3.5), ("物価", 3.5), ("gdp", 3.5), ("ＧＤＰ", 4.0),
            ("국민소득", 4.0), ("国民所得", 4.0),
            ("무역", 3.5), ("貿易", 3.5), ("수출", 3.5), ("輸出", 3.5),
            ("수입", 3.5), ("輸入", 3.5), ("관세", 4.0), ("関税", 4.0),
            ("국제수지", 4.5), ("国際収支", 4.5), ("경상수지", 4.5), ("経常収支", 4.5),
            ("재정", 3.5), ("財政", 3.5), ("조세", 4.0), ("租税", 4.0),
            ("세금", 3.0), ("금융", 3.5), ("金融", 3.5),
            ("은행", 3.0), ("銀行", 3.0), ("중앙은행", 4.0),
            ("일본은행", 4.5), ("日本銀行", 4.5), ("日銀", 4.0),
            ("주식", 3.5), ("株式", 3.5), ("채권", 3.5), ("債券", 3.5),
            ("고용", 3.5), ("雇用", 3.5), ("실업", 4.0), ("失業", 4.0),
            ("임금", 3.5), ("賃金", 3.5), ("노동", 3.0), ("労働", 3.0),
            ("지니계수", 4.5), ("ジニ係数", 4.5),
            ("자유무역", 4.0), ("自由貿易", 4.0), ("보호무역", 4.0), ("保護貿易", 4.0),
            ("기업", 2.5), ("企業", 2.5), ("소비자", 3.0), ("消費者", 3.0),
            ("생산", 2.5), ("生産", 2.5), ("분배", 3.0), ("分配", 3.0),
            ("국채", 4.0), ("国債", 4.0), ("wto", 3.0), ("ＷＴＯ", 3.5),
            ("imf", 3.5), ("ＩＭＦ", 3.5),
            ("경제성장", 3.5), ("経済成長", 3.5), ("경기변동", 4.0),
            ("버블", 3.5), ("バブル", 3.5),
        ],
        "min_score": 3.0
    }
}

# Topic matchers
TOPIC_MATCHERS = {
    "economy": {
        "수요·공급과 시장균형": ["需要曲線", "供給曲線", "需要", "供給", "均衡価格", "市場均衡"],
        "환율·국제수지": ["為替", "国際収支", "経常収支", "貿易収支", "円高", "円安", "変動相場", "환율"],
        "GDP·국민소득": ["ＧＤＰ", "国内総生産", "国民所得", "ＧＮＰ", "gdp"],
        "재정·조세정책": ["財政", "租税", "国債", "歳出", "歳入", "재정"],
        "금융·통화정책": ["日本銀行", "日銀", "金融政策", "金利", "통화", "금융"],
        "국제무역": ["貿易", "関税", "自由貿易", "保護貿易", "ＷＴＯ", "무역"],
        "고용·노동": ["雇用", "失業", "賃金", "労働組合", "고용", "실업"],
        "경제성장·경기변동": ["景気", "経済成長", "好況", "不況", "경기", "경제성장"],
        "소득분배·지니계수": ["ジニ係数", "所得分配", "지니"],
        "일본경제사": ["バブル", "高度成長", "日本経済", "버블"],
    },
    "politics": {
        "헌법·기본권": ["憲法", "基本的人権", "人権", "헌법", "기본권"],
        "통치기구": ["国会", "内閣", "三権分立", "首相", "衆議院", "参議院", "국회", "내각"],
        "선거·정당": ["選挙", "政党", "比例代表", "小選挙区", "선거", "정당"],
        "국제정치·국제기구": ["国際連合", "国連", "安全保障理事会", "ＮＡＴＯ"],
        "지방자치": ["地方自治", "지방자치"],
        "사법·재판": ["裁判所", "最高裁判所", "법원"],
        "안전보장·방위": ["自衛隊", "防衛", "平和主義", "안보"],
        "정치사상": ["民主主義", "社会主義", "ロック", "ルソー"],
    },
    "history": {
        "시민혁명": ["市民革命", "フランス革命", "アメリカ独立", "프랑스혁명", "시민혁명"],
        "산업혁명·자본주의": ["産業革命", "資本主義", "산업혁명"],
        "제국주의·식민지": ["帝国主義", "植民地", "제국주의", "식민지"],
        "세계대전": ["世界大戦", "第一次世界大戦", "第二次世界大戦", "세계대전"],
        "러시아혁명·소련": ["ロシア革命", "ソ連", "레닌"],
        "냉전": ["冷戦", "ベトナム戦争", "朝鮮戦争", "냉전"],
        "전후세계질서": ["国際連盟", "ベルサイユ", "전후"],
        "근대일본": ["明治維新", "明治", "근대일본"],
        "대공황": ["世界恐慌", "ニューディール", "대공황"],
    },
    "geography": {
        "기후·케펜구분": ["気候", "ケッペン", "気候区分", "降水量", "기후", "케펜"],
        "지형·판구조": ["地形", "プレート", "山地", "지형"],
        "인구·도시화": ["人口", "人口密度", "都市化", "인구", "도시화"],
        "자원·농업": ["資源", "農業", "工業", "자원", "농업"],
        "지도·GIS": ["地図", "緯度", "経度", "지도"],
        "환경·생태": ["環境", "환경"],
    },
    "society": {
        "환경문제": ["環境問題", "地球温暖化", "환경문제"],
        "사회보장·복지": ["社会保障", "福祉", "年金", "사회보장", "복지"],
        "저출산·고령화": ["少子化", "高齢化", "저출산", "고령화"],
        "정보화사회": ["情報化", "정보화"],
        "젠더·평등": ["男女平等", "양성평등"],
        "다문화사회": ["多文化", "移民", "난민"],
    },
}


def classify_domain(text):
    """Classify domain using strong weighted indicators."""
    if not text:
        return ("unknown", 0)
    
    text_clean = text
    
    scores = {}
    for domain, config in STRONG_DOMAIN_INDICATORS.items():
        total = 0
        for word, weight in config["words"]:
            if word in text_clean:
                total += weight
        if total > 0:
            scores[domain] = {
                "score": total,
                "min_threshold": config["min_score"]
            }
    
    if not scores:
        return ("unknown", 0)
    
    # Pick best domain
    best = max(scores.items(), key=lambda x: x[1]["score"])
    
    if best[1]["score"] < best[1]["min_threshold"]:
        return ("unknown", 0)
    
    # Check if there's a clear winner vs other domains
    sorted_scores = sorted(scores.items(), key=lambda x: -x[1]["score"])
    if len(sorted_scores) >= 2:
        ratio = sorted_scores[0][1]["score"] / max(sorted_scores[1][1]["score"], 0.1)
        if ratio < 1.5:
            # Tie-breaker: use absolute highest score
            pass  # Still use the highest
    
    return (best[0], best[1]["score"])


def find_topic(domain, text):
    """Find topic within domain."""
    if not domain or not text or domain == "unknown":
        return ""
    
    matchers = TOPIC_MATCHERS.get(domain, {})
    best_topic = ""
    best_score = 0
    
    for topic_name, keywords in matchers.items():
        for kw in keywords:
            if kw in text:
                if len(kw) > best_score:
                    best_score = len(kw)
                    best_topic = topic_name
    
    return best_topic


def reclassify_all():
    """Reclassify all OCR questions."""
    all_qs = []
    stats = {"total": 0, "domain_known": 0, "topic_known": 0}
    
    for fpath in sorted(glob.glob(os.path.join(OCR_DIR, "*", "exam_*.json"))):
        with open(fpath, "r", encoding="utf-8") as f:
            exam = json.load(f)
        
        year = exam.get("year", 0)
        round_num = exam.get("round", 0)
        source = exam.get("source_file", os.path.basename(fpath))
        
        # Get all page text for broader context
        all_page_text = " ".join(p.get("text", "") for p in exam.get("pages", []))
        
        for q in exam.get("questions", []):
            qn = q.get("number", 0)
            text = q.get("text", "") or q.get("raw_text", "")
            
            if not text or len(text) < 10:
                continue
            
            # Filter: must have some JP/KR content
            has_content = any(
                '\u3040' <= c <= '\u309F' or  # hiragana
                '\u30A0' <= c <= '\u30FF' or  # katakana
                '\u4E00' <= c <= '\u9FFF' or  # kanji
                '\uAC00' <= c <= '\uD7AF'     # korean
                for c in text
            )
            if not has_content:
                continue
                
            stats["total"] += 1
            
            combined = text + " " + all_page_text
            
            # Classify
            domain, conf = classify_domain(combined)
            topic = find_topic(domain, combined) if domain != "unknown" else ""
            
            if domain != "unknown":
                stats["domain_known"] += 1
            if topic:
                stats["topic_known"] += 1
            
            all_qs.append({
                "year": year,
                "round": round_num,
                "source_file": source,
                "question_number": qn,
                "domain": domain,
                "topic": topic,
                "confidence": conf,
                "source": "ocr_final",
                "text_snippet": text[:300],
            })
    
    return all_qs, stats


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
    print("EJU Final Classification v3 — Domain Override Engine")
    print("=" * 60)
    
    print("\n📂 Reclassifying OCR data...")
    ocr_qs, stats = reclassify_all()
    vision_qs = process_vision()
    
    domain_rate = stats["domain_known"] / max(stats["total"], 1) * 100
    topic_rate = stats["topic_known"] / max(stats["total"], 1) * 100
    
    print(f"\n  Total OCR questions: {stats['total']}")
    print(f"  Domain classified: {stats['domain_known']} ({domain_rate:.1f}%)")
    print(f"  Topic classified: {stats['topic_known']} ({topic_rate:.1f}%)")
    
    # Domain distribution
    domain_dist = Counter(q["domain"] for q in ocr_qs if q["domain"] != "unknown")
    print(f"\n  Domain distribution: {dict(domain_dist.most_common())}")
    
    no_topic = [q for q in ocr_qs if q["domain"] != "unknown" and not q["topic"]]
    print(f"  With domain but no topic: {len(no_topic)}")
    
    # More granular check
    for d in ["economy", "politics", "history", "geography", "society"]:
        d_qs = [q for q in ocr_qs if q["domain"] == d]
        d_topic = [q for q in d_qs if q["topic"]]
        print(f"  {d}: {len(d_qs)} questions, {len(d_topic)} with topic ({len(d_topic)/max(len(d_qs),1)*100:.1f}%)")
    
    # Save
    all_data = ocr_qs + vision_qs
    
    # Also generate consolidated list for trend analysis
    consolidated = {
        "generated_at": datetime.now().isoformat(),
        "total_ocr": len(ocr_qs),
        "total_vision": len(vision_qs),
        "total_all": len(all_data),
        "domain_rate": round(domain_rate, 1),
        "topic_rate": round(topic_rate, 1),
        "ocr_questions": ocr_qs,
        "vision_questions": vision_qs,
    }
    
    os.makedirs(os.path.join(OUTPUT_DIR, "training"), exist_ok=True)
    path = os.path.join(OUTPUT_DIR, "training", "reclassified_ocr_data.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(consolidated, f, ensure_ascii=False, indent=2)
    print(f"\n  ✅ Saved: {path}")
    
    print(f"\n{'='*60}")
    print("✅ Complete!")
    print(f"{'='*60}")
