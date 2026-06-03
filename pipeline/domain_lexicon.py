"""
EJU Domain Lexicon — Extended keyword patterns for hybrid classification.
Provides domain-specific keywords, patterns, and edge-case vocabulary
missing from the original classifier.
"""
import re
from typing import Dict, List, Tuple

# ──────────────────────────────────────────────────────────
# Economy (経済)
# ──────────────────────────────────────────────────────────
ECONOMY_KEYWORDS = [
    # Core (original)
    '需要', '供給', '市場', '価格', '均衡',
    'GDP', 'GNP', '国民所得', '経済成長', '景気',
    '為替', '円高', '円安', '外貨', 'ドル', 'ユーロ', '国際収支',
    '財政', '税金', '国債', '予算', '消費税',
    '金融', '金利', '日銀', '物価', 'インフレ', 'デフレ',
    '貿易', '輸出', '輸入', '関税', '自由貿易', '保護貿易',
    '雇用', '失業', '労働', '賃金',
    '所得', 'ジニ', '格差', '貧困',
    # Edge / missing in original
    '桑畑', '養蚕', '生糸', '繊維', '紡績',
    '特化', '分業', '比較優位', '産業連関',
    '経済統合', '経済圏', '貿易圏',
    'スタグフレーション', 'デノミ', '貨幣', '信用',
    'ベンチャー', '起業', '競争', '独占', '寡占',
    '公共料金', '規制緩和', '民営化',
    '株価', '証券', '債券', '投資', '貯蓄',
    '保険', '年金制度', '社会保険',
    '第一次産業', '第二次産業', '第三次産業',
    '産業構造', '高度経済成長', 'バブル',
    'アベノミクス', 'デフレーション', 'インフレーション',
    'マネーサプライ', '貨幣供給', '中央銀行',
    '購買力平価', '実質実効為替レート',
]

ECONOMY_PATTERNS = [
    r'(桑|養蚕|生糸|繊維|紡績)',
    r'(標準時|時差|タイムゾーン|GMT|UTC)',
    r'(島国|資源|エネルギー自給)',
    r'(需要|供給|需給)(の|が|を)?(曲線|線|ショック|調整|超過|不足)',
    r'(価格|所得|所得)弾力性',
    r'限界(効用|費用|生産性|代替率)',
    r'国民(所得|経済|総生産|総支出)',
    r'経常収支|貿易収支|所得収支',
    r'マクロ|ミクロ|経済(学|政策|理論|モデル)',
]

# ──────────────────────────────────────────────────────────
# Politics (政治)
# ──────────────────────────────────────────────────────────
POLITICS_KEYWORDS = [
    # Core (original)
    '憲法', '基本的人権', '国民主権', '平和主義',
    '議会', '国会', '内閣', '首相', '立法', '行政',
    '選挙', '政党', '比例代表', '小選挙区',
    '国連', '安保理', '国際法', '国際裁判', 'PKO',
    '地方自治', '地方分権', '住民',
    '司法', '裁判', '違憲審査', '合憲審査',
    '三権', '分立', '権力', '抑制',
    '条約', '批准', '外交', '同盟',
    # Edge / missing
    '投票', '参政権', '選挙権', '被選挙権',
    '主権', '領土', '国境', '領海',
    '政治思想', 'イデオロギー', '民主主義', '独裁',
    '社会契約', '自然権', '法の支配',
    '議院内閣制', '大統領制', '連邦制',
    '圧力団体', '利益団体', 'ロビー活動',
    '憲法改正', '改憲', '護憲',
    '安保', '自衛隊', '防衛', '安全保障',
    '難民', '入国管理', '国籍',
    '外国人参政権', '永住権',
    'NGO', 'NPO', '国際機構',
]

POLITICS_PATTERNS = [
    r'(投票|参政権|選挙権|被選挙権)',
    r'(条約|批准|署名|締結|加盟)',
    r'(主権|領土|国境|領海|排他的)',
    r'(憲法|基本権|人権)(改正|修正|解釈|保障|制限)',
    r'(社会契約|自然権|法の支配|民主主義)',
    r'(内閣|閣僚|大臣|省庁|官庁)',
    r'(選挙|当選|立候補|投票率|投票行動)',
    r'(国際|世界|地域)(連合|機構|機関|裁判|法)',
]

# ──────────────────────────────────────────────────────────
# History (歴史)
# ──────────────────────────────────────────────────────────
HISTORY_KEYWORDS = [
    # Core (original)
    '市民革命', '名誉革命', 'フランス革命',
    '産業革命', '資本主義', '社会主義',
    '帝国主義', '植民地', '独立',
    '第一次世界大戦', '第二次世界大戦',
    '冷戦', '東西', 'NATO', 'デタント',
    '明治維新', '近代化', '開国',
    # Edge / missing
    '技術革新', '蒸気機関', '紡績機械', '鉄道',
    '電力', '内燃機関', '無線通信',
    'ルネサンス', '宗教改革', '大航海時代',
    '絶対王政', '啓蒙思想',
    'ナポレオン', 'ウィーン体制',
    '民族主義', 'ナショナリズム', '統一',
    '軍国主義', 'ファシズム', '全体主義',
    '米ソ', 'キューバ', 'ベトナム', '朝鮮戦争',
    'EU', 'EC', 'ヨーロッパ統合',
    '戦後処理', '復興', '冷戦後',
    'グローバル化', '情報化', 'ポスト冷戦',
    '日清戦争', '日露戦争', '太平洋戦争',
    '農地改革', '自作地', '小作地',
    '戦後改革', '財閥解体', '労働改革',
    '高度経済成長', '石油危機', 'バブル経済',
]

HISTORY_PATTERNS = [
    r'(技術革新|第[1-9]の技術革新|産業革命)',
    r'(戦後|復興|占領|連合国|終戦)',
    r'(農地改革|自作地|小作地|農地解放)',
    r'(革命|叛乱|暴動|独立|解放)',
    r'(条約|協定|同盟|協商)(締結|調印|成立)',
    r'(世紀|年代|時代|紀元|紀元前)',
    r'(王朝|帝国|王国|共和国)',
    r'(大戦|戦争|戦闘|侵攻|占領)',
    r'(明治|大正|昭和|平成|令和)([0-9]+年)?',
]

# ──────────────────────────────────────────────────────────
# Geography (地理)
# ──────────────────────────────────────────────────────────
GEOGRAPHY_KEYWORDS = [
    # Core (original)
    '気候', 'ケッペン', '降水量', '気温', '降水',
    '地形', 'プレート', '山地', '平原', '川', '海流',
    '人口', '都市', '過疎', '過密', 'ピラミッド',
    '資源', 'エネルギー', '鉱産', '農業',
    '地図', 'GIS', '投影', '緯度', '経度',
    # Edge / missing
    '標準時', '時差', 'タイムゾーン', 'グリニッジ', 'GMT', 'UTC',
    '島国', '島嶼', '離島', '半島',
    '排他的経済水域', 'EEZ', '領海',
    '交通', '物流', '港湾', '空港',
    '貿易港', '工業地帯', '工業地域',
    '気候帯', '植生', 'バイオーム',
    '土壌', '侵食', '堆積', '風化',
    '地殻変動', '断層', '褶曲',
    '海流', '暖流', '寒流',
    '世界遺産', '国立公園',
    '都市化', 'メガシティ', '都市圏',
    '農業', '漁業', '林業', '鉱業',
    '工業', '製造業', '先端技術',
    '貿易相手国', '輸出先', '輸入先',
]

GEOGRAPHY_PATTERNS = [
    r'(標準時|時差|経度|緯度|グリニッジ|GMT|UTC|子午線)',
    r'(排他的経済水域|EEZ|領海|領土|国境)',
    r'(島嶼|島国|離島|半島|大陸)',
    r'(気候|気温|降水|乾燥|湿度|風)',
    r'(地図|地図帳|地形図|白地図|分布図)',
    r'(人口|人口密度|人口分布|人口移動)',
    r'(山地|山脈|高原|盆地|平野|平原)',
    r'(海流|潮流|暖流|寒流|潮汐)',
]

# ──────────────────────────────────────────────────────────
# Society (社会)
# ──────────────────────────────────────────────────────────
SOCIETY_KEYWORDS = [
    # Core (original)
    '環境問題', '温暖化', 'CO2', '排出', 'リサイクル',
    '福祉', '年金', '医療', '介護', '社会保障',
    '少子化', '高齢化', '人口減少', '出生',
    '情報化', 'IT', 'メディア', '情報',
    'ジェンダー', '男女平等', '差別',
    '多文化', '共生', '移民', '難民',
    # Edge / missing
    'エコロジー', '持続可能', 'SDGs',
    '消費者問題', '消費生活', '消費者保護',
    '働き方改革', '労働時間', '有給休暇',
    '教育', '学校', '学習', '識字率',
    '都市問題', 'スプロール', 'ヒートアイランド',
    '過疎化', '限界集落',
    '食料問題', '食料自給率', 'フードマイレージ',
    '医療保険', '介護保険', '福祉国家',
    'ワーキングプア', '相対的貧困', '子どもの貧困',
    'ダイバーシティ', 'インクルージョン',
    'ボランティア', '市民活動', 'NPO',
    'メディアリテラシー', '情報格差',
    'プライバシー', '個人情報保護',
    'AI', 'ロボット', '自動化', 'デジタル化',
]

SOCIETY_PATTERNS = [
    r'(消費者|消費生活|物価|インフレ|デフレ)',
    r'(労働|雇用|働き方|賃金|労働時間)',
    r'(教育|学校|学習|識字|学力)',
    r'(環境|温暖化|公害|汚染|エコロジー)',
    r'(福祉|医療|介護|年金|社会保障)',
    r'(人口|少子|高齢|出生)(問題|減少|化)',
    r'(情報|IT|デジタル|ネット|メディア)',
    r'(多文化|共生|移民|難民|ダイバーシティ)',
]

# ──────────────────────────────────────────────────────────
# Domain-level English term mapping
# ──────────────────────────────────────────────────────────
ENGLISH_DOMAIN_MAP: Dict[str, List[str]] = {
    'economy': [
        'GDP', 'GNP', 'GNI', 'OECD', 'WTO', 'IMF', 'FTA', 'EPA',
        'inflation', 'deflation', 'recession', 'depression',
        'export', 'import', 'tariff', 'trade', 'market',
        'supply', 'demand', 'equilibrium', 'price',
        'unemployment', 'employment', 'labor', 'wage',
        'interest', 'exchange rate', 'currency', 'fiscal',
        'monetary', 'central bank', 'bond', 'stock',
    ],
    'politics': [
        'UN', 'UNICEF', 'WHO', 'ILO', 'NATO', 'EU', 'ASEAN',
        'constitution', 'democracy', 'parliament', 'election',
        'treaty', 'ratification', 'sovereignty',
        'human rights', 'civil rights', 'citizen',
        'government', 'cabinet', 'prime minister',
        'judiciary', 'legislature', 'executive',
        'diplomacy', 'alliance', 'sanction',
    ],
    'history': [
        'revolution', 'industrial revolution', 'world war',
        'cold war', 'independence', 'colonialism',
        'imperialism', 'capitalism', 'socialism',
        'renaissance', 'reformation', 'enlightenment',
        'dynasty', 'empire', 'kingdom', 'republic',
    ],
    'geography': [
        'latitude', 'longitude', 'equator', 'GMT', 'UTC',
        'climate', 'topography', 'population', 'urban',
        'resource', 'agriculture', 'industry',
        'ocean', 'current', 'mountain', 'river',
        'map', 'GIS', 'projection', 'continent',
        'desert', 'tropical', 'temperate', 'polar',
    ],
    'society': [
        'welfare', 'pension', 'healthcare', 'social security',
        'environment', 'pollution', 'recycling', 'SDGs',
        'gender', 'equality', 'diversity', 'multicultural',
        'immigration', 'refugee', 'demographics',
        'information', 'media', 'digital', 'AI',
    ],
}


def get_domain_data() -> Dict[str, Dict]:
    """Return the full domain lexicon as a structured dict."""
    return {
        'economy': {
            'keywords': ECONOMY_KEYWORDS,
            'patterns': ECONOMY_PATTERNS,
            'english_terms': ENGLISH_DOMAIN_MAP.get('economy', []),
        },
        'politics': {
            'keywords': POLITICS_KEYWORDS,
            'patterns': POLITICS_PATTERNS,
            'english_terms': ENGLISH_DOMAIN_MAP.get('politics', []),
        },
        'history': {
            'keywords': HISTORY_KEYWORDS,
            'patterns': HISTORY_PATTERNS,
            'english_terms': ENGLISH_DOMAIN_MAP.get('history', []),
        },
        'geography': {
            'keywords': GEOGRAPHY_KEYWORDS,
            'patterns': GEOGRAPHY_PATTERNS,
            'english_terms': ENGLISH_DOMAIN_MAP.get('geography', []),
        },
        'society': {
            'keywords': SOCIETY_KEYWORDS,
            'patterns': SOCIETY_PATTERNS,
            'english_terms': ENGLISH_DOMAIN_MAP.get('society', []),
        },
    }


def compute_keyword_score(text: str, domain_data: Dict) -> Tuple[float, int, int]:
    """
    Compute keyword-based score for a domain.
    Returns (score, matched_keywords_count, matched_patterns_count).
    """
    if not text:
        return 0.0, 0, 0

    text_upper = text.upper()
    keyword_matches = 0
    pattern_matches = 0

    # Check keywords
    for kw in domain_data['keywords']:
        if kw in text:
            keyword_matches += 1

    # Check patterns
    for pat in domain_data['patterns']:
        if re.search(pat, text):
            pattern_matches += 1

    # Check English terms
    for term in domain_data['english_terms']:
        if term.upper() in text_upper:
            keyword_matches += 1

    # Compute score: 0.1 base + weighted by matches
    score = 0.0
    score += min(keyword_matches * 0.15, 0.6)  # max 0.6 from keywords
    score += min(pattern_matches * 0.20, 0.4)   # max 0.4 from patterns

    return min(score, 1.0), keyword_matches, pattern_matches
