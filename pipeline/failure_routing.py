"""
EJU Failure Routing System — Detects and routes failures to appropriate recovery
pipelines based on root cause analysis.

Routes:
  classifier_gap       → Semantic Classifier (Tier 1/2/3)
  segmentation_failure → Structure Repair (Segmentation Engine)
  ocr_noise            → Minimal Re-OCR
  image_content        → Structure Repair (preserve visual elements)
"""
import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class FailureReport:
    """Report of failure analysis for a single question."""
    question_number: Optional[int]
    text: str
    ocr_confidence: float
    text_length: int
    word_count: int
    failure_type: str
    failure_confidence: float
    has_visual_ref: bool
    has_answer_choices: bool
    route: str


class FailureRouter:
    """
    Routes failures to appropriate recovery pipelines.
    """

    MIN_TEXT_LEN_FOR_CLASSIFIER = 15
    MIN_CONF_FOR_CLASSIFIER = 0.6
    SEG_HEADER_MAX_LEN = 12

    FRAGMENT_PATTERNS = [
        re.compile(r'^平成\d+年|^令和\d+年'),
        re.compile(r'^[総綜]合科目'),
        re.compile(r'^日本留学試験|^EJU'),
        re.compile(r'注意|試験開始|問題用紙|答案用紙'),
        re.compile(r'マークシート|記入|解答'),
        re.compile(r'Page|ページ|\d+\s*/\s*\d+'),
        re.compile(r'この問題用紙|印刷|枚の'),
        re.compile(r'^\s*$'),
    ]

    def __init__(self):
        self.routes = {
            'classifier_gap': 0, 'segmentation_failure': 0,
            'ocr_noise': 0, 'image_content': 0, 'none': 0,
        }

    def _score_garbage(self, text: str) -> float:
        """Score how garbled text is (0.0 = clean, 1.0 = garbage)."""
        if not text:
            return 1.0
        if len(text) < 3:
            return 0.0

        score = 0.0

        # 1. Replacement / unprintable characters
        bad_chars = len(re.findall(r'[�□▯]', text))
        if bad_chars > 0:
            score += min(bad_chars * 0.3, 0.6)

        # 2. Repeated dash/line characters (5+)
        dash_runs = len(re.findall(r'([\-＝=━─ー−_｜|/\\＼]){5,}', text))
        if dash_runs > 0:
            score += min(dash_runs * 0.3, 0.5)

        # 3. Character diversity
        unique = len(set(text))
        diversity_ratio = unique / max(len(text), 1)
        if diversity_ratio < 0.25 and len(text) >= 8:
            score += 0.5
        elif diversity_ratio < 0.40 and len(text) >= 10:
            score += 0.3

        # 4. Long ASCII runs (OCR hallucination)
        long_ascii = len(re.findall(r'[A-Za-z]{10,}', text))
        if long_ascii > 0:
            score += min(long_ascii * 0.3, 0.5)

        # 5. Meaningful character ratio
        meaningful = len(re.findall(
            r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF10-\uFF19a-zA-Z0-9]', text
        ))
        total = len(text)
        if total > 0:
            m_ratio = meaningful / total
            if m_ratio < 0.4:
                score += 0.5
            elif m_ratio < 0.6:
                score += 0.3
            elif m_ratio > 0.85 and diversity_ratio > 0.4:
                # Deduct only for diverse clean text, not noise repetition
                score = max(0.0, score - 0.2)

        # 6. Repeated two-character patterns (e.g., バーバーバー)
        if len(text) >= 6:
            two_char_loops = 0
            for i in range(0, len(text) - 3, 2):
                if i + 3 < len(text) and text[i:i+2] == text[i+2:i+4]:
                    two_char_loops += 1
            if two_char_loops >= 3:
                score += 0.3

        # 7. Bigram diversity (low diversity of char pairs = noise)
        if len(text) >= 8:
            bigrams = set()
            for i in range(len(text) - 1):
                bigrams.add(text[i:i+2])
            bigram_div = len(bigrams) / max(len(text) - 1, 1)
            if bigram_div < 0.20:
                score += 0.3

        # 8. Repeated single kana (ナナナナ, アアアア)
        repeated_kana = len(re.findall(
            r'([\u3040-\u309F\u30A0-\u30FF])\1{3,}', text
        ))
        if repeated_kana > 0:
            score += min(repeated_kana * 0.2, 0.4)

        return min(max(score, 0.0), 1.0)

    def _is_fragment(self, text: str) -> bool:
        for pattern in self.FRAGMENT_PATTERNS:
            if pattern.search(text.strip()):
                return True
        return False

    def analyze(self, question: Dict) -> FailureReport:
        text = question.get('text', '') or question.get('cleaned_text', '') or ''
        conf = question.get('ocr_confidence', 0) or 0
        domain = question.get('domain', '')
        text_len = len(text)

        has_visual_ref = bool(re.search(r'図|表|グラフ|写真|地図|略図|統計', text))
        has_choices = bool(re.search(r'[①②③④⑤⑥]', text)) or \
                      bool(re.search(r'\b[1-6]\s*[\.\s）]', text))

        failure_type = 'none'
        failure_confidence = 0.0
        route = 'none'

        # Already classified
        if domain not in ('unknown', 'review_required', ''):
            self.routes['none'] += 1
            return FailureReport(
                question_number=question.get('number'),
                text=text[:100], ocr_confidence=conf,
                text_length=text_len, word_count=len(text.split()),
                failure_type='none', failure_confidence=1.0,
                has_visual_ref=has_visual_ref, has_answer_choices=has_choices,
                route='none',
            )

        garbage_score = self._score_garbage(text) if text else 1.0

        # OCR noise: high garbage score
        if garbage_score >= 0.5 and text_len >= 5:
            failure_type = 'ocr_noise'
            failure_confidence = min(garbage_score, 1.0)
            route = 'ocr_noise'

        # Segmentation failure
        if failure_type == 'none':
            is_fragment = self._is_fragment(text)
            has_marker = bool(re.search(r'[問第]\s*\d+', text))
            if is_fragment or (text_len < self.SEG_HEADER_MAX_LEN and text_len > 0 and not has_marker):
                failure_type = 'segmentation_failure'
                failure_confidence = 0.8 if text_len < 10 else 0.6
                route = 'segmentation_failure'

        # Classifier gap
        if failure_type == 'none' and text_len >= self.MIN_TEXT_LEN_FOR_CLASSIFIER:
            failure_type = 'classifier_gap'
            failure_confidence = min(conf * 1.1, 1.0) if conf >= 0.6 else max(0.3, conf)
            route = 'classifier_gap'

        # Fallback
        if failure_type == 'none':
            if text_len >= 10:
                failure_type = 'classifier_gap'
                failure_confidence = 0.3
                route = 'classifier_gap'
            else:
                failure_type = 'unknown'
                failure_confidence = 0.0
                route = 'segmentation_failure'

        self.routes[failure_type] = self.routes.get(failure_type, 0) + 1

        return FailureReport(
            question_number=question.get('number'),
            text=text[:100], ocr_confidence=conf,
            text_length=text_len, word_count=len(text.split()),
            failure_type=failure_type, failure_confidence=round(failure_confidence, 4),
            has_visual_ref=has_visual_ref, has_answer_choices=has_choices,
            route=route,
        )

    def route_question(self, question: Dict) -> Tuple[str, FailureReport]:
        report = self.analyze(question)
        return report.route, report

    def get_stats(self) -> Dict:
        return dict(self.routes)

    def batch_analyze(self, questions: List[Dict]) -> Dict[str, List[FailureReport]]:
        routed = {
            'classifier_gap': [], 'segmentation_failure': [],
            'ocr_noise': [], 'image_content': [], 'none': [],
        }
        for q in questions:
            route, report = self.route_question(q)
            target = route if route in routed else 'segmentation_failure'
            routed[target].append(report)
        return routed
