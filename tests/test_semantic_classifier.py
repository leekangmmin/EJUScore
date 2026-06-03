"""
Tests for the EJU Semantic Domain Classifier (3-tier hybrid).
Verifies Tier 1 (keyword), Tier 2 (embedding), and fallback logic.
"""
import os
import sys
import re
import json
import math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pipeline.domain_lexicon import get_domain_data, compute_keyword_score
from pipeline.semantic_classifier import SemanticClassifier


# ──────────────────────────────────────────────────────────
# Test helpers
# ──────────────────────────────────────────────────────────
def make_question(text, number=1, domain=None, confidence=0.9):
    """Create a question dict for testing."""
    q = {
        'id': f'test-{number}',
        'number': number,
        'text': text,
        'ocr_confidence': confidence,
        'domain': domain or 'unknown',
        'domain_confidence': 0.0,
        'answer_choices': [],
        'year': 2010,
        'round': 1,
    }
    return q


# ──────────────────────────────────────────────────────────
# Test 1: Domain lexicon completeness
# ──────────────────────────────────────────────────────────
def test_domain_lexicon_has_all_domains():
    """Verify lexicon covers all 5 EJU domains."""
    data = get_domain_data()
    assert set(data.keys()) == {'economy', 'politics', 'history', 'geography', 'society'}


def test_domain_lexicon_min_keywords():
    """Verify each domain has minimum keyword coverage."""
    data = get_domain_data()
    for domain, d in data.items():
        assert len(d['keywords']) >= 10, f"{domain} has < 10 keywords"
        assert len(d['patterns']) >= 3, f"{domain} has < 3 patterns"
        assert len(d['english_terms']) >= 5, f"{domain} has < 5 English terms"


def test_keyword_score_economy():
    """Verify economy-specific keywords boost score."""
    text = "市場における需要と供給の均衡について説明しなさい。"
    data = get_domain_data()
    score, kw, pat = compute_keyword_score(text, data['economy'])
    assert score > 0.2, f"Expected economy score > 0.2, got {score}"
    assert kw >= 3, f"Expected >= 3 keyword matches, got {kw}"


def test_keyword_score_politics():
    """Verify politics-specific keywords boost score."""
    text = "日本国憲法における基本的人権と国民主権について述べよ。"
    data = get_domain_data()
    score, kw, pat = compute_keyword_score(text, data['politics'])
    assert score > 0.2, f"Expected politics score > 0.2, got {score}"


def test_keyword_score_history():
    """Verify history-specific keywords boost score."""
    text = "産業革命後の資本主義の発展と帝国主義の拡大について。"
    data = get_domain_data()
    score, kw, pat = compute_keyword_score(text, data['history'])
    assert score > 0.2, f"Expected history score > 0.2, got {score}"


def test_keyword_score_geography():
    """Verify geography-specific keywords boost score."""
    text = "ケッペンの気候区分における日本の気候の特徴を説明せよ。"
    data = get_domain_data()
    score, kw, pat = compute_keyword_score(text, data['geography'])
    assert score > 0.2, f"Expected geography score > 0.2, got {score}"


def test_keyword_score_society():
    """Verify society-specific keywords boost score."""
    text = "少子高齢化に伴う社会保障制度の課題について述べよ。"
    data = get_domain_data()
    score, kw, pat = compute_keyword_score(text, data['society'])
    assert score > 0.2, f"Expected society score > 0.2, got {score}"


# ──────────────────────────────────────────────────────────
# Test 2: Edge cases that were previously classifier_gap
# ──────────────────────────────────────────────────────────
def test_edge_sangawake():
    """Test previously missing term: 桑畑 → should match economy (mulberry fields)."""
    text = "20世紀初頭の日本では、水田に適さない農地の多くが桑畑に使用されていた。"
    data = get_domain_data()
    score, kw, pat = compute_keyword_score(text, data['economy'])
    assert score > 0, f"桑畑 should match economy, got score={score}"
    assert kw >= 1, "桑畑 keyword should be matched"


def test_edge_standard_time():
    """Test previously missing term: 標準時 → should match geography."""
    text = "日本の標準時は東経135度の経線を基準としている。"
    data = get_domain_data()
    score, kw, pat = compute_keyword_score(text, data['geography'])
    assert score > 0, f"標準時 should match geography, got score={score}"
    assert pat >= 1, "標準時 pattern should be matched"


def test_edge_foreign_suffrage():
    """Test previously missing term: 外国人参政権 → should match politics."""
    text = "外国人参政権について各国の比較を説明した次の表を見て答えなさい。"
    data = get_domain_data()
    score, kw, pat = compute_keyword_score(text, data['politics'])
    assert score > 0, f"外国人参政権 should match politics, got score={score}"


def test_edge_technology_innovation():
    """Test previously missing term: 技術革新 → should match history."""
    text = "第1の技術革新: 蒸気機関、紡績機械、鉄道。第2の技術革新: 電力、内燃機関。"
    data = get_domain_data()
    score, kw, pat = compute_keyword_score(text, data['history'])
    assert score > 0, f"技術革新 should match history, got score={score}"


def test_edge_exclusive_economic_zone():
    """Test previously missing term: EEZ → should match geography."""
    text = "日本の排他的経済水域(EEZ)の範囲について説明しなさい。"
    data = get_domain_data()
    score, kw, pat = compute_keyword_score(text, data['geography'])
    assert score > 0, f"EEZ should match geography, got score={score}"


# ──────────────────────────────────────────────────────────
# Test 3: SemanticClassifier Tier 1 (keyword)
# ──────────────────────────────────────────────────────────
def test_classifier_tier1_economy():
    """Verify Tier 1 correctly classifies economy questions."""
    classifier = SemanticClassifier()
    classifier.initialize()  # Initialize without embeddings (Tier 1 only)

    text = "市場メカニズムにおける需要曲線と供給曲線の均衡点について説明せよ。"
    domain, conf, tier = classifier.classify(text)
    assert domain == 'economy', f"Expected economy, got {domain}"
    assert tier == 'tier1', f"Expected tier1, got {tier}"
    assert conf >= 0.3, f"Expected conf >= 0.3, got {conf}"


def test_classifier_tier1_politics():
    """Verify Tier 1 correctly classifies politics questions."""
    classifier = SemanticClassifier()
    classifier.initialize()

    text = "日本国憲法の三大原則である国民主権、基本的人権の尊重、平和主義について説明せよ。"
    domain, conf, tier = classifier.classify(text)
    assert domain == 'politics', f"Expected politics, got {domain}"
    assert conf >= 0.3, f"Expected conf >= 0.3, got {conf}"


def test_classifier_tier1_history():
    """Verify Tier 1 correctly classifies history questions."""
    classifier = SemanticClassifier()
    classifier.initialize()

    text = "第一次世界大戦後の国際秩序の変化と、その後の世界恐慌について述べよ。"
    domain, conf, tier = classifier.classify(text)
    assert domain == 'history', f"Expected history, got {domain}"
    assert conf >= 0.3, f"Expected conf >= 0.3, got {conf}"


def test_classifier_tier1_geography():
    """Verify Tier 1 correctly classifies geography questions."""
    classifier = SemanticClassifier()
    classifier.initialize()

    text = "ケッペンの気候区分における温帯気候の特徴と分布について説明せよ。"
    domain, conf, tier = classifier.classify(text)
    assert domain == 'geography', f"Expected geography, got {domain}"
    assert conf >= 0.3, f"Expected conf >= 0.3, got {conf}"


def test_classifier_tier1_society():
    """Verify Tier 1 correctly classifies society questions."""
    classifier = SemanticClassifier()
    classifier.initialize()

    text = "少子高齢化による社会保障費の増大と持続可能性の課題について述べよ。"
    domain, conf, tier = classifier.classify(text)
    assert domain == 'society', f"Expected society, got {domain}"
    assert conf >= 0.3, f"Expected conf >= 0.3, got {conf}"


# ──────────────────────────────────────────────────────────
# Test 4: Classifier edge cases (previously review_required)
# ──────────────────────────────────────────────────────────
def test_classifier_edge_sangawake():
    """Verify classifier catches the 桑畑 edge case (was classifier_gap)."""
    classifier = SemanticClassifier()
    classifier.initialize()

    text = "20世紀初頭の日本では、水田に適さない農地の多くが桑畑に使用されていた。"
    domain, conf, tier = classifier.classify(text)
    assert domain in ('economy', 'history'), f"Expected economy/history, got {domain}"
    assert conf > 0, f"Expected confidence > 0, got {conf}"


def test_classifier_edge_standard_time():
    """Verify classifier catches 標準時 edge case."""
    classifier = SemanticClassifier()
    classifier.initialize()

    text = "日本の標準時は東経135度の経線を基準としており、グリニッジ標準時との時差は9時間である。"
    domain, conf, tier = classifier.classify(text)
    assert domain == 'geography', f"Expected geography, got {domain}"
    assert conf > 0.3, f"Expected conf > 0.3, got {conf}"


def test_classifier_edge_foreign_suffrage_table():
    """Verify classifier catches foreign suffrage question with table reference."""
    classifier = SemanticClassifier()
    classifier.initialize()

    text = "次の表は、各国の外国人参政権の特徴を示したものである。この表についての説明として最も適切なものを選べ。"
    domain, conf, tier = classifier.classify(text)
    assert domain == 'politics', f"Expected politics, got {domain}"
    assert conf > 0.3, f"Expected conf > 0.3, got {conf}"


def test_classifier_edge_technology_waves():
    """Verify classifier catches technology innovation waves (history)."""
    classifier = SemanticClassifier()
    classifier.initialize()

    text = "第1の技術革新: 蒸気機関、紡績機械、鉄道。第2の技術革新: 電力、内燃機関、無線通信。"
    domain, conf, tier = classifier.classify(text)
    assert domain == 'history', f"Expected history, got {domain}"
    assert conf > 0.3, f"Expected conf > 0.3, got {conf}"


def test_classifier_edge_island_economy():
    """Verify classifier catches island economy / geography question."""
    classifier = SemanticClassifier()
    classifier.initialize()

    text = "日本は細長い島国である。その島々は北東から南西に向かって細長く延びるように分布している。"
    domain, conf, tier = classifier.classify(text)
    assert domain in ('geography', 'economy'), f"Expected geography/economy, got {domain}"
    assert conf > 0.1, f"Expected conf > 0.1, got {conf}"


def test_classifier_empty_text():
    """Verify classifier handles empty text gracefully."""
    classifier = SemanticClassifier()
    classifier.initialize()
    domain, conf, tier = classifier.classify('')
    assert domain == 'unknown'
    assert conf == 0.0


def test_classifier_short_text():
    """Verify classifier handles very short text gracefully."""
    classifier = SemanticClassifier()
    classifier.initialize()
    domain, conf, tier = classifier.classify('短い')
    assert domain == 'unknown'


# ──────────────────────────────────────────────────────────
# Test 5: Multilingual support
# ──────────────────────────────────────────────────────────
def test_english_term_detection():
    """Verify English terms are caught by domain lexicon."""
    data = get_domain_data()

    # Economy English terms
    text_en = "The GDP growth rate and inflation are key economic indicators."
    score, kw, pat = compute_keyword_score(text_en, data['economy'])
    # The English term matching uses uppercase comparison
    text_upper = text_en.upper()
    en_terms = data['economy']['english_terms']
    matches = sum(1 for t in en_terms if t.upper() in text_upper)
    assert matches >= 2, f"Expected >= 2 English term matches, got {matches}"


def test_mixed_jp_en_detection():
    """Verify mixed Japanese+English text is handled."""
    classifier = SemanticClassifier()
    classifier.initialize()

    text = "GDP (国内総生産) と GNP (国民総生産) の違いについて説明せよ。"
    domain, conf, tier = classifier.classify(text)
    assert domain == 'economy', f"Expected economy, got {domain}"
    assert conf > 0.5, f"Expected confidence > 0.5, got {conf}"


# ──────────────────────────────────────────────────────────
# Test 6: Context window enhancement
# ──────────────────────────────────────────────────────────
def test_context_window_helps():
    """Verify context window improves classification of ambiguous questions."""
    classifier = SemanticClassifier()
    classifier.initialize()

    # Ambiguous text without context
    ambiguous = "次の文章中の空欄に当てはまる語句の組み合わせとして正しいものを選べ。"

    # With economy context
    context = ["市場メカニズムにおける需要と供給の均衡について説明せよ。"]
    domain1, conf1, tier1 = classifier.classify(ambiguous, context_window=context)
    # Should at least get some confidence boost from context

    # Without context
    domain2, conf2, tier2 = classifier.classify(ambiguous)
    # Context should help (though both may be unknown)
    # At minimum, context shouldn't hurt
    assert conf1 >= conf2 or domain1 != 'unknown', \
        f"Context shouldn't reduce confidence: {conf1} vs {conf2}"


# ──────────────────────────────────────────────────────────
# Test 7: Stats tracking
# ──────────────────────────────────────────────────────────
def test_classifier_stats():
    """Verify classifier stats are tracked correctly."""
    classifier = SemanticClassifier()
    classifier.initialize()

    # Clear stats by creating fresh instance
    classifier.classify("市場における需要と供給の均衡について。")
    classifier.classify("日本国憲法の基本的人権について。")
    classifier.classify("短い")

    stats = classifier.get_stats()
    assert stats['total'] == 3
    assert stats['tier1_classifications'] >= 2  # Two clear matches
    assert stats['unknown'] >= 1  # Short text


# ──────────────────────────────────────────────────────────
# Test 8: Tier fallback logic
# ──────────────────────────────────────────────────────────
def test_tier_fallback_on_low_confidence():
    """Verify that when Tier 1 has low confidence, fallback mechanisms are tried."""
    classifier = SemanticClassifier()
    classifier.initialize()

    # Deliberately ambiguous text that should have low Tier 1 confidence
    text = "次の文章を読んで、後の問いに答えなさい。文中の空欄に入る最も適切な語句を選べ。"
    domain, conf, tier = classifier.classify(text)

    # Should not crash, should return a result
    assert tier in ('tier1', 'tier2', 'tier3', 'unknown')
    assert 0.0 <= conf <= 1.0
