"""
Tests for the EJU Question Segmentation Engine.
Verifies boundary detection, fragment repair, and layout-aware reconstruction.
"""
import os
import sys
import re

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pipeline.segmentation_engine import (
    SegmentationEngine, Boundary, QuestionSegment
)


# ──────────────────────────────────────────────────────────
# Test 1: Boundary Detection
# ──────────────────────────────────────────────────────────
def test_detect_primary_boundary():
    """Verify primary boundary detection for 問N patterns."""
    engine = SegmentationEngine()
    lines = [
        {'text': '問1 次の文章を読んで答えなさい。', 'bbox': {}, 'confidence': 0.9,
         'x': 0, 'y': 0, 'w': 100, 'h': 20},
        {'text': '問2 次のグラフを見て問いに答えよ。', 'bbox': {}, 'confidence': 0.85,
         'x': 0, 'y': 30, 'w': 100, 'h': 20},
        {'text': '問3 最後の質問です。', 'bbox': {}, 'confidence': 0.8,
         'x': 0, 'y': 60, 'w': 100, 'h': 20},
    ]
    boundaries = engine._detect_boundaries(lines)
    assert len(boundaries) == 3
    assert all(b.type == 'primary' for b in boundaries)
    assert [b.question_number for b in boundaries] == [1, 2, 3]


def test_detect_secondary_boundary():
    """Verify secondary boundary detection for N. patterns."""
    engine = SegmentationEngine()
    lines = [
        {'text': '1. 最初の質問', 'bbox': {}, 'confidence': 0.9,
         'x': 0, 'y': 0, 'w': 100, 'h': 20},
        {'text': '2. 次の質問', 'bbox': {}, 'confidence': 0.85,
         'x': 0, 'y': 30, 'w': 100, 'h': 20},
        {'text': '3. 最後の質問', 'bbox': {}, 'confidence': 0.8,
         'x': 0, 'y': 60, 'w': 100, 'h': 20},
    ]
    boundaries = engine._detect_boundaries(lines)
    assert len(boundaries) == 3
    assert all(b.type == 'secondary' for b in boundaries)
    assert [b.question_number for b in boundaries] == [1, 2, 3]


def test_detect_mixed_boundaries():
    """Verify mixed 問N and N. patterns are both detected."""
    engine = SegmentationEngine()
    lines = [
        {'text': '問1 最初の質問', 'bbox': {}, 'confidence': 0.9,
         'x': 0, 'y': 0, 'w': 100, 'h': 20},
        {'text': '2. 次の質問（数字のみ）', 'bbox': {}, 'confidence': 0.85,
         'x': 0, 'y': 30, 'w': 100, 'h': 20},
        {'text': '問3 三番目の質問', 'bbox': {}, 'confidence': 0.8,
         'x': 0, 'y': 60, 'w': 100, 'h': 20},
    ]
    boundaries = engine._detect_boundaries(lines)
    assert len(boundaries) == 3
    # Types should be mixed: primary, secondary, primary
    assert boundaries[0].type == 'primary'
    assert boundaries[1].type == 'secondary'
    assert boundaries[2].type == 'primary'


def test_filter_artifact_numbers():
    """Verify numbers > 50 are filtered out."""
    engine = SegmentationEngine()
    lines = [
        {'text': '問1 正しい質問', 'bbox': {}, 'confidence': 0.9,
         'x': 0, 'y': 0, 'w': 100, 'h': 20},
        {'text': '問321980 明らかなOCRアーチファクト', 'bbox': {}, 'confidence': 0.5,
         'x': 0, 'y': 30, 'w': 100, 'h': 20},
    ]
    boundaries = engine._detect_boundaries(lines)
    assert len(boundaries) == 1
    assert boundaries[0].question_number == 1


# ──────────────────────────────────────────────────────────
# Test 2: Header/Footer Filtering
# ──────────────────────────────────────────────────────────
def test_filter_headers_removes_headers():
    """Verify header lines are filtered out."""
    engine = SegmentationEngine()
    lines = [
        {'text': '平成14年度', 'bbox': {}, 'confidence': 0.9,
         'x': 0, 'y': 0, 'w': 100, 'h': 20},
        {'text': '問1 最初の質問', 'bbox': {}, 'confidence': 0.85,
         'x': 0, 'y': 30, 'w': 100, 'h': 20},
        {'text': '日本留学試験', 'bbox': {}, 'confidence': 0.8,
         'x': 0, 'y': 60, 'w': 100, 'h': 20},
    ]
    filtered = engine._filter_headers(lines)
    assert len(filtered) == 1
    assert '問1' in filtered[0]['text']


def test_filter_page_numbers():
    """Verify page number lines are removed."""
    engine = SegmentationEngine()
    lines = [
        {'text': '- 1 -', 'bbox': {}, 'confidence': 0.9,
         'x': 0, 'y': 0, 'w': 100, 'h': 20},
        {'text': '問1 質問内容', 'bbox': {}, 'confidence': 0.85,
         'x': 0, 'y': 30, 'w': 100, 'h': 20},
        {'text': '- 2 -', 'bbox': {}, 'confidence': 0.8,
         'x': 0, 'y': 60, 'w': 100, 'h': 20},
    ]
    filtered = engine._filter_headers(lines)
    assert len(filtered) == 1
    assert '問1' in filtered[0]['text']


# ──────────────────────────────────────────────────────────
# Test 3: Fragment Repair
# ──────────────────────────────────────────────────────────
def test_merge_short_fragments():
    """Verify short fragments are merged into adjacent questions."""
    engine = SegmentationEngine()

    q1 = QuestionSegment(number=1, text='問1 これは完全な質問文です。',
                          confidence=0.9, is_fragment=False)
    q2 = QuestionSegment(number=2, text='短い断片',  # Fragment (short)
                          confidence=0.8, is_fragment=True)
    q3 = QuestionSegment(number=3, text='問3 別の完全な質問。',
                          confidence=0.85, is_fragment=False)

    repaired = engine._repair_fragments([q1, q2, q3])
    assert len(repaired) == 2  # q2 merged into q1
    assert repaired[0].number == 1
    assert '短い断片' in repaired[0].text
    assert engine.fragments_repaired >= 1


def test_no_false_merge_of_valid_questions():
    """Verify valid questions are not incorrectly merged."""
    engine = SegmentationEngine()

    q1 = QuestionSegment(number=1, text='問1 最初の完全な質問です。',
                          confidence=0.9, is_fragment=False)
    q2 = QuestionSegment(number=2, text='問2 二番目の完全な質問です。',
                          confidence=0.85, is_fragment=False)

    repaired = engine._repair_fragments([q1, q2])
    assert len(repaired) == 2
    assert engine.fragments_repaired == 0


# ──────────────────────────────────────────────────────────
# Test 4: Choice Extraction
# ──────────────────────────────────────────────────────────
def test_extract_circle_choices():
    """Verify answer choices in circle markers are extracted."""
    engine = SegmentationEngine()
    text = "次の選択肢から正しいものを選べ。① 選択肢A ② 選択肢B ③ 選択肢C ④ 選択肢D"
    cleaned, choices = engine._extract_choices(text)
    assert len(choices) == 4
    assert '①' in choices[0]
    assert '④' in choices[3]


def test_extract_numeric_choices():
    """Verify numeric answer choices are extracted."""
    engine = SegmentationEngine()
    text = "正しいものを次の番号から選べ。1. 選択肢A 2. 選択肢B 3. 選択肢C 4. 選択肢D"
    cleaned, choices = engine._extract_choices(text)
    assert len(choices) == 4
    assert '1.' in choices[0]
    assert '4.' in choices[3]


# ──────────────────────────────────────────────────────────
# Test 5: Full Page Segmentation
# ──────────────────────────────────────────────────────────
def test_segment_page_normal():
    """Verify full page segmentation produces correct question count."""
    engine = SegmentationEngine()
    ocr_text = """
    問1 最初の質問です。次の文章を読んで答えなさい。
    問2 次のグラフを見て問いに答えよ。
    問3 最後の問題です。正しいものを選べ。
    """
    blocks = [
        {'text': '問1 最初の質問です。次の文章を読んで答えなさい。',
         'bbox': {'x': 0, 'y': 0, 'w': 500, 'h': 30}, 'confidence': 0.9},
        {'text': '問2 次のグラフを見て問いに答えよ。',
         'bbox': {'x': 0, 'y': 50, 'w': 500, 'h': 30}, 'confidence': 0.85},
        {'text': '問3 最後の問題です。正しいものを選べ。',
         'bbox': {'x': 0, 'y': 100, 'w': 500, 'h': 30}, 'confidence': 0.8},
    ]

    questions = engine.segment_page(ocr_text, blocks, {}, page_number=1)
    assert len(questions) == 3
    assert questions[0].number == 1
    assert questions[1].number == 2
    assert questions[2].number == 3


def test_segment_page_with_headers():
    """Verify page headers are removed during segmentation."""
    engine = SegmentationEngine()
    blocks = [
        {'text': '平成14年度', 'bbox': {'x': 0, 'y': 0, 'w': 200, 'h': 20},
         'confidence': 0.9},
        {'text': '問1 最初の質問です。', 'bbox': {'x': 0, 'y': 50, 'w': 500, 'h': 30},
         'confidence': 0.85},
        {'text': '問2 次の質問です。', 'bbox': {'x': 0, 'y': 100, 'w': 500, 'h': 30},
         'confidence': 0.8},
    ]

    questions = engine.segment_page('', blocks, {}, page_number=1)
    assert len(questions) == 2  # Header removed
    assert questions[0].number == 1


# ──────────────────────────────────────────────────────────
# Test 6: Edge Cases
# ──────────────────────────────────────────────────────────
def test_empty_input():
    """Verify empty input is handled gracefully."""
    engine = SegmentationEngine()
    questions = engine.segment_page('', [], {}, page_number=1)
    assert len(questions) == 0


def test_single_question():
    """Verify single question is handled correctly."""
    engine = SegmentationEngine()
    blocks = [
        {'text': '問1 唯一の質問です。この質問に対する答えを選べ。',
         'bbox': {'x': 0, 'y': 0, 'w': 500, 'h': 30}, 'confidence': 0.9},
    ]
    questions = engine.segment_page('', blocks, {}, page_number=1)
    assert len(questions) == 1
    assert questions[0].number == 1


def test_sub_question_detection():
    """Verify sub-question markers (1), (2), (3) are detected."""
    engine = SegmentationEngine()
    text = "次の各問いに答えよ。(1) 最初の小問 (2) 次の小問"
    subs = engine._detect_sub_questions(text)
    assert len(subs) == 2
    assert '1' in subs
    assert '2' in subs


def test_visual_element_detection():
    """Verify visual element references are detected."""
    engine = SegmentationEngine()
    blocks = [
        {'text': '問1 次のグラフを見て問いに答えよ。', 'bbox': {},
         'confidence': 0.9},
    ]
    questions = engine.segment_page('', blocks, {}, page_number=1)
    assert len(questions) == 1
    assert questions[0].has_visual_element is True


def test_reconstruct_from_ocr_confidence():
    """Verify reconstruct_from_ocr returns questions with confidence."""
    engine = SegmentationEngine()
    blocks = [
        {'text': '問1 いい質問です。', 'bbox': {}, 'confidence': 0.9},
        {'text': '問2 これもいい質問。', 'bbox': {}, 'confidence': 0.85},
    ]
    questions, seg_conf = engine.reconstruct_from_ocr('', blocks, {})
    assert len(questions) == 2
    assert seg_conf > 0.0


# ──────────────────────────────────────────────────────────
# Test 7: Stats
# ──────────────────────────────────────────────────────────
def test_engine_stats():
    """Verify processing stats are tracked."""
    engine = SegmentationEngine()
    assert engine.get_stats() == {
        'boundaries_found': 0,
        'fragments_repaired': 0,
        'questions_reconstructed': 0,
    }

    # Process something to update stats
    blocks = [
        {'text': '問1 質問A', 'bbox': {}, 'confidence': 0.9},
        {'text': '問2 質問B', 'bbox': {}, 'confidence': 0.85},
    ]
    engine.segment_page('', blocks, {})
    stats = engine.get_stats()
    assert stats['boundaries_found'] >= 2
    assert stats['questions_reconstructed'] >= 2
