"""
EJU Intelligence Platform - Knowledge Extraction Engine
Classification, topic extraction, difficulty estimation, and knowledge graph construction.

Uses the new 3-tier hybrid SemanticClassifier for domain classification,
replacing the original keyword-only approach.
"""
import re
import uuid
from typing import List, Dict, Optional, Tuple
from .pipeline_config import (
    COMPREHENSIVE_TAXONOMY, MATHEMATICS_TAXONOMY
)


class KnowledgeExtractor:
    """
    Extracts structured knowledge from OCR-processed exam content.
    Uses the new 3-tier hybrid classifier for domain detection.
    """

    def __init__(self):
        self.classification_stats = {
            'total_questions': 0, 'classified': 0, 'unknown': 0,
        }
        self.semantic_classifier = None
        self._classifier_initialized = False

    def initialize_semantic_classifier(self, high_confidence_questions: List[Dict] = None) -> bool:
        """Initialize the 3-tier hybrid semantic classifier."""
        try:
            from .semantic_classifier import SemanticClassifier
            self.semantic_classifier = SemanticClassifier()

            if high_confidence_questions and len(high_confidence_questions) > 50:
                success = self.semantic_classifier.initialize(high_confidence_questions)
                if success:
                    self._classifier_initialized = True
                    return True

            # Even without embedding store, Tier 1 (keyword) works
            self._classifier_initialized = True
            return True
        except ImportError:
            self._classifier_initialized = False
            return False

    def classify_domain(self, text: str, subject: str,
                         answer_choices: List[str] = None,
                         context_window: List[str] = None) -> Tuple[str, float, str]:
        """
        Classify domain using best available classifier.
        Returns (domain, confidence, tier_used).
        """
        if subject == 'comprehensive' and self._classifier_initialized and self.semantic_classifier:
            return self.semantic_classifier.classify(
                text, answer_choices, context_window
            )
        # Fallback to original classifier
        domain = self.classify_comprehensive_domain(text)
        return domain, 0.5, 'keyword'

    def extract_question_knowledge(self, question: Dict, subject: str,
                                    year: int, exam_round: int) -> Dict:
        self.classification_stats['total_questions'] += 1
        text = question.get('text', '') or question.get('cleaned_text', '') or ''
        q_number = question.get('number', 0)
        answer_choices = question.get('answer_choices', [])
        adjacent_texts = question.get('_context_window', None)

        # Use the new hybrid classifier if available
        if subject == 'comprehensive' and self._classifier_initialized and self.semantic_classifier:
            domain, confidence, tier = self.semantic_classifier.classify(
                question_text=text,
                answer_choices=answer_choices if answer_choices else None,
                context_window=adjacent_texts,
                exam_metadata={'year': year, 'round': exam_round},
            )
        elif subject == 'comprehensive':
            # Fallback to original keyword classifier
            domain = self.classify_comprehensive_domain(text)
            confidence = 0.5
            tier = 'keyword_fallback'
        elif subject == 'mathematics':
            domain = self.classify_mathematics_domain(text)
            confidence = 0.5
            tier = 'keyword'
        else:
            domain = 'unknown'
            confidence = 0.0
            tier = 'none'

        # Extract topic and subtopic
        if subject == 'comprehensive' and domain in COMPREHENSIVE_TAXONOMY:
            topic, subtopic = self.extract_comprehensive_topic(text, domain)
        elif subject == 'mathematics' and domain in MATHEMATICS_TAXONOMY:
            topic, subtopic = self.extract_mathematics_topic(text, domain)
        else:
            topic = ''
            subtopic = ''

        q_type = self.detect_question_type(text, subject, domain)
        keywords = self.extract_keywords(text, subject, domain)
        difficulty = self.estimate_difficulty(text, subject, domain, q_type)
        concepts = self.extract_concepts(text, domain)
        q_id = str(uuid.uuid4())

        if domain != 'unknown':
            self.classification_stats['classified'] += 1
        else:
            self.classification_stats['unknown'] += 1

        return {
            'id': q_id, 'number': q_number,
            'subject': subject, 'domain': domain,
            'domain_confidence': round(confidence, 4),
            'classifier_tier': tier,
            'topic': topic, 'subtopic': subtopic,
            'question_type': q_type, 'difficulty': difficulty,
            'keywords': keywords, 'concepts': concepts,
            'year': year, 'round': exam_round,
        }

    # ── Original methods kept for backward compatibility ──

    def classify_comprehensive_domain(self, text: str) -> str:
        """Original keyword-based classifier (fallback)."""
        if not text:
            return 'unknown'
        scores = {'economy': 0, 'politics': 0, 'history': 0, 'geography': 0, 'society': 0}

        economy_p = [r'需[給要]|供給|需要|市場|価格|均衡', r'GDP|GNP|国民所得|経済成長|景気',
                     r'為替|円[高安]|外貨|ドル|ユーロ|国際収支', r'財政|税[金制]|国債|予算',
                     r'金融|金利|日銀|物価|インフレ|デフレ', r'貿易|輸[出入]|関税|自由貿易|保護貿易',
                     r'雇用|失業|労働|賃金', r'所得|ジニ|格差|貧困']
        for p in economy_p:
            if re.search(p, text): scores['economy'] += 2

        politics_p = [r'憲法|基本的人権|[平国]民主権', r'議会|国会|内閣|首相|立法|行政',
                      r'選挙|政党|比例|小選挙', r'国連|安保理|国際[機法裁]|PKO',
                      r'地方自治|地方[分権]|住民', r'司法|裁判|[違合]憲審査',
                      r'三権|分立|権力|抑制', r'条約|批准|外交|同盟']
        for p in politics_p:
            if re.search(p, text): scores['politics'] += 2

        history_p = [r'革命|市民|名誉|フランス', r'産業革命|資本主義|社会主義',
                     r'帝国主義|植民地|独立', r'第一次|第二次|世界大戦',
                     r'冷戦|東西|NATO|デタント', r'明治|維新|近代化|開国']
        for p in history_p:
            if re.search(p, text): scores['history'] += 2

        geography_p = [r'気候|ケッペン|降水量|気温|降水', r'地形|プレート|山地|平原|川|海流',
                       r'人口|都市|過[疎密]|ピラミッド', r'資源|エネルギ[ー]|鉱産|農業',
                       r'地図|GIS|投影|緯度|経度']
        for p in geography_p:
            if re.search(p, text): scores['geography'] += 2

        society_p = [r'環境|温暖化|CO2|排出|リサイクル', r'福祉|年金|医療|介護|社会保障',
                     r'少子|高齢|人口減少|出生', r'情報化|IT|メディア|情報',
                     r'ジェンダ[ー]|男女|平等|差別', r'多文化|共生|移民|難民']
        for p in society_p:
            if re.search(p, text): scores['society'] += 2

        max_score = max(scores.values())
        return max(scores, key=scores.get) if max_score >= 2 else 'unknown'

    def classify_mathematics_domain(self, text: str) -> str:
        if not text:
            return 'unknown'
        scores = {'algebra': 0, 'calculus': 0, 'geometry': 0, 'probability': 0}
        if re.search(r'方程[式]|不等[式]|二次|関数|指数|対数|数列', text): scores['algebra'] += 2
        if re.search(r'[xXyY]\s*[=+\-\^]|\d+x|\d+y', text): scores['algebra'] += 1
        if re.search(r'微分|積分|極限|導関[数]|面積|体積|速度|加速度', text): scores['calculus'] += 2
        if re.search(r'lim|Δ|d/dx|∫', text): scores['calculus'] += 2
        if re.search(r'三角|角度|図形|座標|ベクト[ル]|円|球|三角形|平行', text): scores['geometry'] += 2
        if re.search(r'確率|統計|平均|分散|標準|偏差|組合[せ]|順列', text): scores['probability'] += 2
        if re.search(r'分布|期待|確率変数|正規|二項', text): scores['probability'] += 2
        max_score = max(scores.values())
        return max(scores, key=scores.get) if max_score >= 2 else 'unknown'

    def extract_comprehensive_topic(self, text: str, domain: str) -> Tuple[str, str]:
        if domain == 'unknown' or domain not in COMPREHENSIVE_TAXONOMY:
            return '', ''
        taxonomy = COMPREHENSIVE_TAXONOMY[domain]['topics']
        keyword_map = {
            'market_equilibrium': ['需要', '供給', '価格', '市場', '均衡'],
            'gdp_national_income': ['GDP', 'GNP', '国民所得', '経済成長'],
            'exchange_rate_balance': ['為替', '円高', '円安', '国際収支'],
            'fiscal_tax_policy': ['財政', '税金', '国債', '予算', '消費税'],
            'monetary_policy': ['金融', '金利', '日銀', '物価', 'インフレ'],
            'international_trade': ['貿易', '輸出', '輸入', '関税'],
            'employment_labor': ['雇用', '失業', '労働', '賃金'],
            'economic_growth': ['景気', '循環', '成長', '不況'],
            'income_distribution': ['所得', 'ジニ係数', '格差'],
            'japanese_economy': ['戦後', '高度成長', 'バブル', 'アベノミクス'],
            'constitution_basic_rights': ['憲法', '基本的人権', '国民主権'],
            'governing_institutions': ['国会', '内閣', '首相', '行政'],
            'elections_parties': ['選挙', '政党', '比例代表'],
            'international_politics': ['国連', '安全保障', '国際法'],
            'local_governance': ['地方自治', '地方分権'],
            'judiciary': ['司法', '裁判', '裁判所'],
            'political_thought': ['社会契約', '自然権', '民主主義'],
            'security_defense': ['防衛', '安保', '自衛隊'],
            'civic_revolutions': ['市民革命', '名誉革命', 'フランス革命'],
            'industrial_capitalism': ['産業革命', '資本主義'],
            'imperialism_colonialism': ['帝国主義', '植民地'],
            'world_wars': ['世界大戦', '第一次', '第二次'],
            'cold_war': ['冷戦', 'NATO', 'ワルシャワ'],
            'modern_japan': ['明治維新', '開国'],
            'postwar_world': ['戦後', '復興', '冷戦後'],
            'globalization': ['グローバル化', '地域統合'],
            'climate': ['気候', 'ケッペン', '気温', '降水量'],
            'topography_plates': ['地形', 'プレート', '山地'],
            'population_cities': ['人口', '都市'],
            'resources_agriculture': ['資源', '農業', '鉱産'],
            'maps_gis': ['地図', '投影', '経度'],
            'environment': ['環境', '自然', '生態'],
            'industry_transportation': ['工業', '交通'],
            'environment_issues': ['環境問題', '温暖化', '公害'],
            'social_security': ['社会保障', '年金', '医療'],
            'demographics': ['少子化', '高齢化'],
            'information_society': ['情報化', 'IT', 'メディア'],
            'gender_equality': ['ジェンダー', '男女平等'],
            'multiculturalism': ['多文化', '共生'],
            'ethics_modern_society': ['倫理', '生命'],
        }
        topic_scores = {}
        for topic_key, topic_label in taxonomy.items():
            score = 0
            keywords = keyword_map.get(topic_key, [])
            for kw in keywords:
                if kw in text:
                    score += 1
            if score > 0:
                topic_scores[topic_label] = score
        if not topic_scores:
            return '', ''
        sorted_topics = sorted(topic_scores.items(), key=lambda x: -x[1])
        return sorted_topics[0][0], sorted_topics[1][0] if len(sorted_topics) > 1 else ''

    def extract_mathematics_topic(self, text: str, domain: str) -> Tuple[str, str]:
        if domain == 'unknown' or domain not in MATHEMATICS_TAXONOMY:
            return '', ''
        taxonomy = MATHEMATICS_TAXONOMY[domain]['topics']
        keyword_map = {
            'equations_inequalities': ['方程式', '不等式', '一次', '二次方程式'],
            'quadratic_functions': ['二次関数', '放物線', '平方完成'],
            'exponential_logarithm': ['指数', '対数', '累乗'],
            'sequences': ['数列', '等差数列', '等比数列'],
            'differentiation': ['微分', '導関数', '接線'],
            'integration': ['積分', '不定積分', '定積分'],
            'limits': ['極限', '無限', '収束'],
            'optimization': ['最大', '最小', '最適'],
            'plane_geometry': ['図形', '三角形', '円'],
            'coordinate_geometry': ['座標', '直線'],
            'vectors': ['ベクトル', '内積'],
            'trigonometry': ['三角関数', 'sin', 'cos'],
            'probability': ['確率', '場合の数'],
            'statistics': ['統計', '平均', '分散', '標準偏差'],
            'combinatorics': ['順列', '組合せ'],
            'distributions': ['分布', '正規分布', '二項分布'],
        }
        topic_scores = {}
        for topic_key, topic_label in taxonomy.items():
            score = 0
            for kw in keyword_map.get(topic_key, []):
                if kw in text:
                    score += 1
            if score > 0:
                topic_scores[topic_label] = score
        if not topic_scores:
            return '', ''
        sorted_topics = sorted(topic_scores.items(), key=lambda x: -x[1])
        return sorted_topics[0][0], sorted_topics[1][0] if len(sorted_topics) > 1 else ''

    def detect_question_type(self, text: str, subject: str, domain: str) -> str:
        if not text:
            return 'multiple_choice'
        if re.search(r'グラフ|図[1-9]|表[1-9]', text): return 'graph_analysis'
        if re.search(r'計算|求めよ|値を|方程式', text):
            return 'mathematical_computation' if subject == 'mathematics' else 'data_interpretation'
        if re.search(r'歴史|年表|時代|紀元|世紀', text): return 'historical_analysis'
        if re.search(r'政治|選挙|議会|憲法|裁判', text): return 'political_analysis'
        if re.search(r'経済|市場|価格|GDP|貿易|為替', text): return 'economic_analysis'
        if re.search(r'地図|位置|気候|地形|地域', text): return 'geographical_analysis'
        if re.search(r'証明|証明せよ', text): return 'mathematical_proof'
        if re.search(r'確率|統計|平均|分布', text): return 'probability_statistics'
        if re.search(r'面積|体積|図形|角度|長さ', text): return 'geometry'
        if re.search(r'最大|最小|最適', text): return 'optimization'
        if re.search(r'環境|社会|福祉|人口|情報|文化', text): return 'social_analysis'
        if re.search(r'資料|データ|統計表|数値', text): return 'data_interpretation'
        return 'multiple_choice'

    def estimate_difficulty(self, text: str, subject: str, domain: str, q_type: str) -> int:
        difficulty = 3
        type_complexity = {
            'multiple_choice': -0.5, 'data_interpretation': 0, 'graph_analysis': 0.5,
            'historical_analysis': 0, 'political_analysis': 0, 'economic_analysis': 0.5,
            'geographical_analysis': 0, 'social_analysis': 0,
            'mathematical_computation': 0.5, 'mathematical_proof': 1.5,
            'optimization': 1.0, 'probability_statistics': 0.5, 'geometry': 0.5,
        }
        difficulty += type_complexity.get(q_type, 0)
        if re.search(r'\(1\)|\(2\)|\(3\)|①|②|③|\((ア|イ|ウ)\)', text):
            difficulty += 0.5
        tech_terms = 0
        for p in [r'弾力性|限界|微分|積分', r'主権|統治|立法|行政|司法',
                  r'地殻|マントル|プレート|褶曲|断層', r'貨幣|信用|デフレ|スタグフレーション']:
            if re.search(p, text): tech_terms += 1
        if tech_terms >= 3: difficulty += 0.5
        if tech_terms >= 5: difficulty += 1.0
        if re.search(r'\d+[\.\s]*[+\-×÷/]\s*\d+|\d+\.\d+', text) and subject == 'mathematics':
            difficulty += 0.5
        if len(text) > 200: difficulty += 0.5
        return max(1, min(5, round(difficulty)))

    def extract_keywords(self, text: str, subject: str, domain: str) -> List[str]:
        keywords = []
        domain_keywords = {
            'economy': ['需要', '供給', '価格', '市場', 'GDP', '国民所得', '為替', '金利',
                        '財政', '金融', '貿易', '雇用', '失業', 'インフレ', 'デフレ'],
            'politics': ['憲法', '国会', '内閣', '選挙', '政党', '国連', '裁判', '条約',
                         '地方自治', '基本的人権'],
            'history': ['革命', '産業革命', '世界大戦', '冷戦', '帝国主義', '独立',
                        '明治維新', '資本主義'],
            'geography': ['気候', '地形', '人口', '資源', '地図', '農業', '工業',
                          '環境', '都市'],
            'society': ['環境', '社会保障', '少子化', '情報化', 'ジェンダー', '多文化',
                        '福祉', '人口'],
        }
        for kw in domain_keywords.get(domain, []):
            if kw in text:
                keywords.append(kw)
        if not keywords:
            words = text.split()
            for w in words[:5]:
                if len(w) >= 2:
                    keywords.append(w)
        return keywords[:10]

    def extract_concepts(self, text: str, domain: str) -> List[str]:
        concepts = []
        concept_map = {
            'economy': ['market', 'supply_demand', 'gdp', 'fiscal_policy', 'monetary_policy',
                        'international_trade', 'exchange_rate'],
            'politics': ['constitution', 'separation_of_powers', 'election', 'international_law',
                        'local_governance', 'human_rights'],
            'history': ['revolution', 'industrialization', 'imperialism', 'cold_war',
                       'modernization', 'globalization'],
            'geography': ['climate', 'topography', 'population', 'resource', 'agriculture',
                         'urbanization', 'map'],
            'society': ['social_security', 'environment', 'demographics', 'information_society',
                       'gender_equality', 'multiculturalism'],
        }
        for concept in concept_map.get(domain, []):
            concepts.append(concept)
        return concepts[:8]

    def get_stats(self) -> Dict:
        return dict(self.classification_stats)
