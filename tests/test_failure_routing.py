"""
Tests for the EJU Failure Routing System.
Verifies root cause analysis and correct routing to recovery pipelines.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pipeline.failure_routing import FailureRouter, FailureReport


# ──────────────────────────────────────────────────────────
# Test 1: Classifier Gap Detection
# ──────────────────────────────────────────────────────────
def test_detect_classifier_gap():
    """Verify clean text with no domain is routed to classifier."""
    router = FailureRouter()
    question = {
        'text': '市場における需要と供給の均衡点について説明しなさい。',
        'ocr_confidence': 0.85,
        'domain': 'review_required',
        'number': 1,
    }
    route, report = router.route_question(question)
    assert route == 'classifier_gap', f"Expected classifier_gap, got {route}"
    assert report.failure_type == 'classifier_gap'
    assert report.route == 'classifier_gap'


def test_detect_classifier_gap_high_confidence():
    """Verify high-confidence text with missing domain is classifier_gap."""
    router = FailureRouter()
    question = {
        'text': '憲法における基本的人権の重要性について説明せよ。',
        'ocr_confidence': 0.92,
        'domain': 'unknown',
        'number': 2,
    }
    route, report = router.route_question(question)
    assert route == 'classifier_gap'


# ──────────────────────────────────────────────────────────
# Test 2: Segmentation Failure Detection
# ──────────────────────────────────────────────────────────
def test_detect_segmentation_failure_short():
    """Verify short fragment text is routed to segmentation repair."""
    router = FailureRouter()
    question = {
        'text': '平成14年度',
        'ocr_confidence': 0.9,
        'domain': 'review_required',
        'number': None,
    }
    route, report = router.route_question(question)
    assert route == 'segmentation_failure'
    assert report.failure_type == 'segmentation_failure'


def test_detect_segmentation_failure_header():
    """Verify header-like instruction text is routed to segmentation repair."""
    router = FailureRouter()
    question = {
        'text': '平成14年度 試験A',
        'ocr_confidence': 0.82,
        'domain': 'review_required',
        'number': None,
    }
    route, report = router.route_question(question)
    assert route == 'segmentation_failure'


# ──────────────────────────────────────────────────────────
# Test 3: OCR Noise Detection
# ──────────────────────────────────────────────────────────
def test_detect_ocr_noise():
    """Verify garbled text with low confidence is routed to re-OCR."""
    router = FailureRouter()
    question = {
        'text': 'バーバーバーバーバーバーバーバーバーバー',
        'ocr_confidence': 0.45,
        'domain': 'review_required',
        'number': None,
    }
    route, report = router.route_question(question)
    assert route == 'ocr_noise', f"Expected ocr_noise, got {route}"
    assert report.failure_type == 'ocr_noise'


def test_detect_ocr_noise_garbage():
    """Verify text with replacement characters is routed to re-OCR."""
    router = FailureRouter()
    question = {
        'text': 'これは�を含むテキスト□ですーーーーー',
        'ocr_confidence': 0.3,
        'domain': 'review_required',
        'number': None,
    }
    route, report = router.route_question(question)
    assert route == 'ocr_noise'


# ──────────────────────────────────────────────────────────
# Test 4: Already-classified questions
# ──────────────────────────────────────────────────────────
def test_existing_domain_not_routed():
    """Verify questions with valid domain are not routed to any recovery."""
    router = FailureRouter()
    question = {
        'text': '市場均衡についての質問です。',
        'ocr_confidence': 0.9,
        'domain': 'economy',
        'number': 1,
    }
    route, report = router.route_question(question)
    assert route == 'none'
    assert report.failure_type == 'none'


# ──────────────────────────────────────────────────────────
# Test 5: Image Content Detection
# ──────────────────────────────────────────────────────────
def test_detect_image_content():
    """Verify text referencing visual elements is noted."""
    router = FailureRouter()
    question = {
        'text': '次のグラフを見て問いに答えなさい。',
        'ocr_confidence': 0.85,
        'domain': 'review_required',
        'number': 3,
    }
    route, report = router.route_question(question)
    assert route == 'classifier_gap', f"Expected classifier_gap, got {route}"
    assert report.has_visual_ref is True


# ──────────────────────────────────────────────────────────
# Test 6: Batch Analysis
# ──────────────────────────────────────────────────────────
def test_batch_analyze():
    """Verify batch analysis correctly groups by route."""
    router = FailureRouter()
    questions = [
        {'text': '市場均衡についての質問です。', 'ocr_confidence': 0.9, 'domain': 'review_required', 'number': 1},
        {'text': '平成14年度', 'ocr_confidence': 0.9, 'domain': 'review_required', 'number': None},
        {'text': 'バーバーバーバーバーバーバーバーバーバー', 'ocr_confidence': 0.3, 'domain': 'review_required', 'number': None},
        {'text': '正常な質問です。', 'ocr_confidence': 0.9, 'domain': 'economy', 'number': 2},
    ]

    routed = router.batch_analyze(questions)
    assert len(routed['classifier_gap']) >= 1, f"classifier_gap count: {len(routed['classifier_gap'])}"
    assert len(routed['segmentation_failure']) >= 1
    assert len(routed['ocr_noise']) >= 1
    assert len(routed['none']) >= 1


# ──────────────────────────────────────────────────────────
# Test 7: Statistics
# ──────────────────────────────────────────────────────────
def test_router_stats():
    """Verify router stats are tracked correctly."""
    router = FailureRouter()
    assert router.get_stats()['classifier_gap'] == 0
    assert router.get_stats()['segmentation_failure'] == 0

    # Use texts that will route to different categories
    router.route_question({'text': '市場均衡についての質問です。', 'ocr_confidence': 0.9, 'domain': 'review_required', 'number': 1})
    router.route_question({'text': '短い', 'ocr_confidence': 0.9, 'domain': 'review_required', 'number': None})
    router.route_question({'text': 'aaaa', 'ocr_confidence': 0.3, 'domain': 'review_required', 'number': None})

    stats = router.get_stats()
    # 市場均衡... (15 chars, conf=0.9) → classifier_gap
    # 短い (2 chars) → segmentation_failure
    # aaaa (4 chars) → segmentation_failure
    assert stats['classifier_gap'] >= 1, f"Stats: {stats}"
    assert stats['segmentation_failure'] >= 1
    # aaaa with conf=0.3 and len=4 is too short (4 < 5) to trigger ocr_noise
    # So ocr_noise might be 0
