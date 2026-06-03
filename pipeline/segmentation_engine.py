"""
EJU Question Segmentation Engine — Hierarchical boundary detection
and layout-aware reconstruction of exam questions.

Handles:
- Multi-column PDFs
- Broken OCR lines  
- Merged questions
- Header/footer fragments
- Cross-page question continuation
"""
import re
import uuid
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field
from collections import defaultdict


# ──────────────────────────────────────────────────────────
# Data structures
# ──────────────────────────────────────────────────────────
@dataclass
class Boundary:
    """A detected question boundary."""
    line_index: int
    type: str  # 'primary', 'secondary', 'tertiary'
    confidence: float
    question_number: Optional[int] = None
    text: str = ''


@dataclass
class QuestionSegment:
    """A reconstructed question segment."""
    number: int
    text: str
    answer_choices: List[str] = field(default_factory=list)
    lines: List[Dict] = field(default_factory=list)
    confidence: float = 0.5
    has_visual_element: bool = False
    is_fragment: bool = False
    sub_questions: List[str] = field(default_factory=list)
    source_pages: List[int] = field(default_factory=list)


# ──────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────
QUESTION_START_PATTERNS = [
    (re.compile(r'^[問第]\s*(\d+)\s*[問題]?'), 1.0, 'primary'),
    (re.compile(r'^(\d{1,2})\s*[\.\s\)）]'), 0.8, 'secondary'),
    (re.compile(r'^[\(（](\d{1,2})[\)）]'), 0.6, 'secondary'),
]

HEADER_PATTERNS = [
    re.compile(r'平成\d+年|令和\d+年|平成\s*\d+\s*年度|令和\s*\d+\s*年度'),
    re.compile(r'^-?\s*\d+\s*-?$'),  # page numbers
    re.compile(r'総合科目[一二三四五六七八九十\d]*'),
    re.compile(r'日本留学試験|EJU'),
    re.compile(r'注意|指示|試験開始|問題用紙|答案用紙'),
    re.compile(r'マークシート|記入|解答|解答用紙'),
    re.compile(r'Page|ページ|\d+\s*/\s*\d+'),
    re.compile(r'この問題用紙|印刷'),
]

CHOICE_MARKERS = re.compile(r'[①②③④⑤⑥⑦⑧⑨⑩]')
NUMERIC_CHOICE = re.compile(r'\b([1-6])\s*[\.\s\)）]')
SUB_QUESTION = re.compile(r'[\(（](\d+|ア|イ|ウ|エ|オ|a|b|c|d)[\)）]')
CONTINUATION_PARTICLES = re.compile(r'(は|が|を|に|の|へ|で|と|から|より|そして|しかし|また)$')

# Fragment: text matches header content OR is extremely short (< 8 chars) without question marker
FRAGMENT_MIN_LENGTH = 8


class SegmentationEngine:
    """
    Hierarchical question segmentation and reconstruction engine.
    """

    def __init__(self):
        self.boundaries_found = 0
        self.fragments_repaired = 0
        self.questions_reconstructed = 0

    def segment_page(
        self,
        ocr_text: str,
        blocks: List[Dict] = None,
        layout_info: Dict = None,
        page_number: int = 1,
    ) -> List[QuestionSegment]:
        """
        Segment a single page into questions.
        
        Args:
            ocr_text: Raw OCR text for the page
            blocks: List of text blocks with bbox metadata
            layout_info: Dict with layout detection results
            page_number: Page number for tracking
            
        Returns:
            List of QuestionSegment objects
        """
        # Extract lines from blocks or raw text
        lines = self._extract_lines(ocr_text, blocks)

        # Detect columns if layout info is available
        columns = self._detect_columns(blocks, layout_info)

        # Get reading order
        reading_order = self._resolve_reading_order(columns, lines)

        # Reorder lines by reading order
        ordered_lines = self._apply_reading_order(lines, reading_order)

        # Filter out headers/footers
        content_lines = self._filter_headers(ordered_lines)

        # Detect question boundaries
        boundaries = self._detect_boundaries(content_lines)

        # Group lines into questions
        question_groups = self._group_into_questions(content_lines, boundaries)

        # Build question objects
        questions = []
        for i, group in enumerate(question_groups):
            q = self._build_question(group, i + 1, page_number)
            if q:
                questions.append(q)

        # Repair fragmented questions (only merge true fragments, not short-but-valid questions)
        questions = self._repair_fragments(questions)

        return questions

    def _extract_lines(self, ocr_text: str, blocks: List[Dict]) -> List[Dict]:
        """Extract structured lines from OCR output."""
        lines = []

        if blocks and len(blocks) > 0:
            for block in blocks:
                text = block.get('text', '').strip()
                if text:
                    bbox = block.get('bbox', {})
                    # Normalize Japanese spacing
                    text = self._normalize_jp_spacing(text)
                    lines.append({
                        'text': text,
                        'bbox': bbox,
                        'confidence': block.get('confidence', 0.5),
                        'x': bbox.get('x', bbox.get('x0', 0)),
                        'y': bbox.get('y', bbox.get('y0', 0)),
                        'w': bbox.get('w', 0),
                        'h': bbox.get('h', 0),
                    })
        else:
            for line in ocr_text.split('\n'):
                line = line.strip()
                if line:
                    normalized = self._normalize_jp_spacing(line)
                    lines.append({
                        'text': normalized,
                        'bbox': {},
                        'confidence': 0.5,
                        'x': 0, 'y': 0, 'w': 0, 'h': 0,
                    })

        return lines

    def _normalize_jp_spacing(self, text: str) -> str:
        """Normalize Japanese OCR spacing artifacts."""
        # Remove spaces between Japanese characters
        text = re.sub(
            r'([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]) '
            r'(?=[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF])',
            r'\1', text
        )
        # Remove spaces before Japanese punctuation
        text = re.sub(r' ([、。．・])', r'\1', text)
        # Remove spaces between digits
        text = re.sub(r'(\d) (\d)', r'\1\2', text)
        # Collapse multiple spaces
        text = re.sub(r'  +', ' ', text)
        return text.strip()

    def _detect_columns(self, blocks: List[Dict], layout_info: Dict) -> List[Dict]:
        """Detect text columns from block positions."""
        if not blocks:
            return []

        # Collect x-positions from blocks with bbox data
        x_positions = []
        for b in blocks:
            bbox = b.get('bbox', {})
            x = bbox.get('x', bbox.get('x0', 0))
            if x > 0:
                x_positions.append(x)

        if len(x_positions) < 5:
            return [{'id': 0, 'x_center': 0, 'order': 0}]

        # Simple clustering by x-position
        x_positions.sort()
        clusters = []
        current_cluster = [x_positions[0]]

        for pos in x_positions[1:]:
            if pos - current_cluster[-1] <= 50:
                current_cluster.append(pos)
            else:
                clusters.append(current_cluster)
                current_cluster = [pos]

        if current_cluster:
            clusters.append(current_cluster)

        columns = []
        for i, cluster in enumerate(clusters):
            x_center = sum(cluster) / len(cluster)
            columns.append({
                'id': i,
                'x_center': x_center,
                'count': len(cluster),
                'order': i,
            })

        return columns

    def _resolve_reading_order(self, columns: List[Dict], lines: List[Dict] = None) -> List[int]:
        """Resolve reading order for columns (default left-to-right)."""
        if not columns:
            return [0]
        sorted_cols = sorted(columns, key=lambda c: c['x_center'])
        return [c['id'] for c in sorted_cols]

    def _apply_reading_order(self, lines: List[Dict], reading_order: List[int]) -> List[Dict]:
        """Reorder lines based on column reading order."""
        if len(reading_order) <= 1:
            return lines
        # For now, maintain original order
        return lines

    def _filter_headers(self, lines: List[Dict]) -> List[Dict]:
        """Filter out header, footer, and instruction lines."""
        filtered = []

        for i, line in enumerate(lines):
            text = line['text'].strip()

            if not text:
                continue

            # Check against header patterns
            is_header = False
            for pattern in HEADER_PATTERNS:
                if pattern.search(text):
                    is_header = True
                    break

            if not is_header:
                filtered.append(line)

        return filtered

    def _detect_boundaries(self, lines: List[Dict]) -> List[Boundary]:
        """
        Detect question boundaries using hierarchical approach.
        
        Primary: 問N / 第N問
        Secondary: N. / N) numeric
        Tertiary: layout/whitespace based
        """
        boundaries = []
        seen_numbers = set()

        for i, line in enumerate(lines):
            text = line['text'].strip()
            best_boundary = None

            # Try each pattern type
            for pattern, confidence, btype in QUESTION_START_PATTERNS:
                m = pattern.match(text)
                if m:
                    qnum = int(m.group(1))
                    if 1 <= qnum <= 50 and qnum not in seen_numbers:
                        seen_numbers.add(qnum)
                        best_boundary = Boundary(
                            line_index=i,
                            type=btype,
                            confidence=confidence,
                            question_number=qnum,
                            text=text[:50],
                        )
                        break

            if best_boundary:
                boundaries.append(best_boundary)

        # Ensure first boundary exists
        if not boundaries and lines:
            boundaries.append(Boundary(
                line_index=0,
                type='tertiary',
                confidence=0.5,
                question_number=None,
                text=lines[0]['text'][:50],
            ))

        self.boundaries_found = len(boundaries)
        return boundaries

    def _group_into_questions(self, lines: List[Dict], boundaries: List[Boundary]) -> List[Dict]:
        """Group lines into question groups based on boundaries."""
        if not boundaries:
            return [{'lines': lines, 'text': ' '.join(l['text'] for l in lines)}]

        groups = []
        for j, boundary in enumerate(boundaries):
            start = boundary.line_index
            end = boundaries[j + 1].line_index if j + 1 < len(boundaries) else len(lines)
            group_lines = lines[start:end]

            if group_lines:
                group_text = ' '.join(l['text'] for l in group_lines)
                groups.append({
                    'lines': group_lines,
                    'text': group_text,
                    'number': boundary.question_number,
                    'boundary_type': boundary.type,
                    'boundary_confidence': boundary.confidence,
                })

        return groups

    def _build_question(
        self, group: Dict, default_number: int, page_number: int
    ) -> Optional[QuestionSegment]:
        """Build a QuestionSegment from a group of lines."""
        text = group['text'].strip()
        if not text:
            return None

        qnum = group.get('number', default_number)
        if qnum is None:
            qnum = default_number

        # Extract answer choices
        cleaned_text, choices = self._extract_choices(text)

        # Detect sub-questions (1), (2), (3) patterns
        sub_questions = self._detect_sub_questions(cleaned_text)

        # Compute average confidence
        confs = [l.get('confidence', 0.5) for l in group['lines'] if l.get('confidence')]
        avg_conf = sum(confs) / len(confs) if confs else 0.5

        # Detect visual element references
        has_visual = bool(re.search(r'図|表|グラフ|写真|地図|略図', text))

        # A question is a true fragment only if:
        # 1. It has NO question number AND is very short (< FRAGMENT_MIN_LENGTH chars)
        # 2. OR it matches header content patterns
        # Short questions with 問N are NOT fragments
        has_question_marker = bool(re.search(r'^[問第]\s*\d+', text.strip()))
        is_true_fragment = (not has_question_marker and len(text) < FRAGMENT_MIN_LENGTH)

        return QuestionSegment(
            number=qnum,
            text=cleaned_text,
            answer_choices=choices,
            lines=group['lines'],
            confidence=round(avg_conf, 4),
            has_visual_element=has_visual,
            is_fragment=is_true_fragment,
            sub_questions=sub_questions,
            source_pages=[page_number],
        )

    def _extract_choices(self, text: str) -> Tuple[str, List[str]]:
        """Extract answer choices from question text."""
        choices = []
        cleaned = text

        # Try circle markers first
        circle_matches = list(re.finditer(r'[①②③④⑤⑥⑦⑧⑨⑩]', text))
        if len(circle_matches) >= 3:
            pos = circle_matches[0].start()
            cleaned = text[:pos].strip()
            for j, cm in enumerate(circle_matches):
                s = cm.start()
                e = circle_matches[j + 1].start() if j + 1 < len(circle_matches) else len(text)
                choices.append(text[s:e].strip())
            return cleaned, choices

        # Try numeric choices
        num_matches = list(re.finditer(r'\b([1-6])\s*[\.\s\)）]', text))
        if len(num_matches) >= 3:
            nums = [int(m.group(1)) for m in num_matches]
            if nums == list(range(nums[0], nums[0] + len(nums))):
                pos = num_matches[0].start()
                cleaned = text[:pos].strip()
                for j, nm in enumerate(num_matches):
                    s = nm.start()
                    e = num_matches[j + 1].start() if j + 1 < len(num_matches) else len(text)
                    choices.append(text[s:e].strip())
                return cleaned, choices

        return cleaned, choices

    def _detect_sub_questions(self, text: str) -> List[str]:
        """Detect sub-question markers like (1), (2) or (ア), (イ)."""
        matches = SUB_QUESTION.findall(text)
        return [m for m in matches if m]

    def _repair_fragments(self, questions: List[QuestionSegment]) -> List[QuestionSegment]:
        """
        Repair fragmented questions by merging adjacent fragments.
        
        Only merges if:
        1. Current question has no question marker AND is a true fragment
        2. Previous question doesn't end properly (ends with continuation particle)
        
        Does NOT merge if the current question starts with 問N (valid question start).
        """
        if len(questions) <= 1:
            return questions

        repaired = [questions[0]]

        for q in questions[1:]:
            prev = repaired[-1]
            should_merge = False

            # Check if current is a true fragment (no question marker + very short)
            has_own_marker = bool(re.search(r'^[問第]\s*\d+|^\d{1,2}\s*[\.\s\)）]', q.text.strip()))
            is_very_short = len(q.text) < FRAGMENT_MIN_LENGTH

            if is_very_short and not has_own_marker:
                # True fragment: no question number and very short
                should_merge = True
            elif not has_own_marker and prev.text:
                # No question marker: check if it's a continuation
                prev_ends_with_particle = bool(CONTINUATION_PARTICLES.search(prev.text))
                if prev_ends_with_particle or len(q.text) < 50:
                    should_merge = True

            if should_merge:
                # Merge into previous question
                prev.text = prev.text + ' ' + q.text
                prev.lines.extend(q.lines)
                prev.confidence = (prev.confidence + q.confidence) / 2
                prev.is_fragment = False  # No longer a fragment after merge
                prev.source_pages.extend(q.source_pages)
                if q.answer_choices and not prev.answer_choices:
                    prev.answer_choices = q.answer_choices
                self.fragments_repaired += 1
            else:
                repaired.append(q)

        self.questions_reconstructed = len(repaired)
        return repaired

    def reconstruct_from_ocr(
        self,
        ocr_text: str,
        blocks: List[Dict],
        layout: Dict,
        page_number: int = 1,
    ) -> Tuple[List[QuestionSegment], float]:
        """
        Full pipeline: segment a page and return questions with segmentation confidence.
        
        Returns:
            (questions, segmentation_confidence)
        """
        questions = self.segment_page(ocr_text, blocks, layout, page_number)

        # Compute segmentation confidence
        if not questions:
            return [], 0.0

        # Average of per-question boundary detection confidence
        confs = [q.confidence for q in questions if q.confidence > 0]
        avg_conf = sum(confs) / len(confs) if confs else 0.0

        # Penalize if too many fragments
        fragment_ratio = sum(1 for q in questions if q.is_fragment) / len(questions)
        if fragment_ratio > 0.3:
            avg_conf *= (1 - fragment_ratio)

        return questions, round(avg_conf, 4)

    def get_stats(self) -> Dict:
        """Return processing statistics."""
        return {
            'boundaries_found': self.boundaries_found,
            'fragments_repaired': self.fragments_repaired,
            'questions_reconstructed': self.questions_reconstructed,
        }
