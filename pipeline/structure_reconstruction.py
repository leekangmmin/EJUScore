"""
EJU Intelligence Platform - Structure Reconstruction Engine
Reconstructs the original exam structure from OCR output.
Handles EJU-specific layout and question numbering patterns.
"""
import re
import uuid
from typing import List, Dict, Optional, Tuple


class StructureReconstructor:
    """
    Reconstructs structured questions from raw OCR output.
    Handles EJU-specific formatting including:
    - 問1, 問2, ... question numbering
    - Multiple choice (①, ②, ③, ④) patterns
    - EJU instruction text filtering
    """

    # EJU question patterns
    QUESTION_START = re.compile(r'^[問第]\s*(\d+)\s*[問題]?', re.MULTILINE)
    NUMERIC_QUESTION = re.compile(r'^(\d+)\s*[\.\s\)）]', re.MULTILINE)
    CIRCLE_CHOICE = re.compile(r'[①②③④⑤⑥⑦⑧]')

    def __init__(self):
        self.questions_reconstructed = 0

    def reconstruct(self, ocr_text, blocks, tables, diagrams, graphs, maps):
        # Get text lines from blocks
        lines = self._get_text_lines(ocr_text, blocks)

        # Filter out instruction/header lines
        content_lines = self._filter_instructions(lines)

        # Detect real question boundaries
        question_indices = self._find_question_starts(content_lines)

        # Group into questions
        question_groups = self._group_questions(content_lines, question_indices)

        # Build question objects
        questions = []
        for i, group in enumerate(question_groups):
            q = self._build_question(group, i + 1)
            if q:
                questions.append(q)

        # Merge adjacent questions that are actually fragments
        questions = self._merge_fragments(questions)

        questions = self._associate_elements(questions, tables, diagrams, graphs, maps)
        self.questions_reconstructed = len(questions)
        return questions

    def _get_text_lines(self, ocr_text, blocks):
        """Extract text lines from blocks or raw text."""
        lines = []
        if blocks:
            for block in blocks:
                text = block.get('text', '').strip()
                if text:
                    lines.append({
                        'text': text,
                        'bbox': block.get('bbox', {}),
                        'confidence': block.get('confidence', 0.5),
                    })
        else:
            for line in ocr_text.split('\n'):
                line = line.strip()
                if line:
                    lines.append({'text': line, 'bbox': {}, 'confidence': 0.5})
        return lines

    def _filter_instructions(self, lines):
        """Filter out instruction/header/footer lines that are not questions."""
        instruction_patterns = [
            r'注意\s*事項', r'試験\s*開始', r'問題\s*用\s*紙',
            r'受験\s*番号', r'名前', r'氏名',
            r'答案\s*用\s*紙', r'解答\s*用\s*紙',
            r'マーク\s*シート', r'記入',
            r'平成\d+年', r'令和\d+年',
            r'日本\s*留学\s*試験', r'EJU',
            r'この\s*問題\s*用\s*紙', r'ページ|Page',
            r'\d+\s*/\s*\d+', r'^\d+$',  # Page numbers
            r'注意', r'指示',
        ]

        filtered = []
        for line in lines:
            text = line['text'].strip()
            if not text:
                continue
            is_instruction = False
            for pattern in instruction_patterns:
                if re.search(pattern, text):
                    is_instruction = True
                    break
            # Skip very short lines that aren't question numbers
            if len(text) < 5 and not re.search(r'^[問第]+\d+', text):
                if not re.search(r'^\d+\s*[\.\s\)）]', text):
                    is_instruction = True
            if not is_instruction:
                filtered.append(line)

        return filtered

    def _find_question_starts(self, lines):
        """Find lines that start new questions."""
        indices = []
        seen_numbers = set()

        for i, line in enumerate(lines):
            text = line['text'].strip()

            # Match: 問1, 第1問
            m = self.QUESTION_START.match(text)
            if m:
                qnum = int(m.group(1))
                if qnum not in seen_numbers:
                    seen_numbers.add(qnum)
                    indices.append(i)
                    continue

            # Match: 1. 2. 3.  (EJU style numeric questions)
            m = self.NUMERIC_QUESTION.match(text)
            if m:
                qnum = int(m.group(1))
                if 1 <= qnum <= 50:  # EJU typically has 30-40 questions
                    if qnum not in seen_numbers:
                        seen_numbers.add(qnum)
                        indices.append(i)
                        continue

        # Ensure first line is included if no question markers found
        if not indices and lines:
            indices = [0]

        return indices

    def _group_questions(self, lines, indices):
        """Group lines into question blocks."""
        if not indices:
            return [{'lines': lines, 'text': ' '.join(l['text'] for l in lines)}]

        groups = []
        for j, start in enumerate(indices):
            end = indices[j + 1] if j + 1 < len(indices) else len(lines)
            group_lines = lines[start:end]
            group_text = ' '.join(l['text'] for l in group_lines if l['text'].strip())
            if group_text.strip():
                groups.append({
                    'lines': group_lines,
                    'text': group_text,
                })

        return groups

    def _merge_fragments(self, questions):
        """
        Merge adjacent questions that are actually fragments of the same question.
        EJU questions are often split across multiple OCR blocks.
        """
        if len(questions) <= 1:
            return questions

        merged = [questions[0]]

        for q in questions[1:]:
            prev = merged[-1]
            prev_text = prev.get('text', '')
            curr_text = q.get('text', '')

            # Check if current is a fragment (doesn't have a clear question start)
            prev_ends_mid = len(prev_text) < 50  # Very short question is likely a fragment
            curr_is_fragment = not re.search(r'^[問第]\d+|^\d+\s*[\.\s\)）]', curr_text.strip())

            if prev_ends_mid or curr_is_fragment:
                # Merge into previous question
                prev['text'] = prev_text + ' ' + curr_text
                prev['raw_text'] = prev.get('raw_text', '') + ' ' + q.get('raw_text', '')
                prev['word_count'] = len(prev['text'].split())
                prev['lines'] = prev.get('lines', 0) + q.get('lines', 0)
                # Keep the original question number
            else:
                merged.append(q)

        return merged

    def _build_question(self, group, default_number):
        """Build a question object from a group of lines."""
        text = group['text'].strip()
        if not text:
            return None

        # Extract question number
        qnum = self._extract_qnum(text, default_number)

        # Separate choices from question text
        qtext, choices = self._extract_choices(text)
        cleaned_text = re.sub(r'\s+', ' ', qtext).strip()

        # Compute confidence
        confs = [l.get('confidence', 0.5) for l in group['lines'] if l.get('confidence')]
        avg_conf = sum(confs) / len(confs) if confs else 0.5

        return {
            'id': str(uuid.uuid4()),
            'number': qnum,
            'raw_text': text,
            'text': cleaned_text,
            'answer_choices': choices,
            'ocr_confidence': round(avg_conf, 4),
            'word_count': len(text.split()),
            'lines': len(group['lines']),
            'tables': [],
            'diagrams': [],
            'graphs': [],
            'maps': [],
        }

    def _extract_qnum(self, text, default):
        """Extract question number from text."""
        m = re.search(r'[問第]\s*(\d+)', text)
        if m:
            return int(m.group(1))
        m = re.search(r'^(\d+)\s*[\.\s\)）]', text)
        if m:
            return int(m.group(1))
        return default

    def _extract_choices(self, text):
        """Extract answer choices from question text."""
        choices = []
        cleaned = text

        # Find choice markers: ① ② ③ ④ or 1. 2. 3. 4.
        m = re.search(r'[①②③④⑤⑥⑦⑧⑨⑩]', text)
        if m:
            pos = m.start()
            # Check if there are multiple choices
            all_circles = list(re.finditer(r'[①②③④⑤⑥⑦⑧⑨⑩]', text))
            if len(all_circles) >= 3:
                cleaned = text[:pos].strip()
                for j, cm in enumerate(all_circles):
                    s = cm.start()
                    e = all_circles[j+1].start() if j+1 < len(all_circles) else len(text)
                    choices.append(text[s:e].strip())

        # Try numeric choices if circle not found
        if not choices:
            m = re.search(r'(?:^|\s)(\d)\s*[\.\s\)）]', text)
            if m:
                pos = m.start()
                num_choices = list(re.finditer(r'\b([1-6])\s*[\.\s\)）]', text))
                if len(num_choices) >= 3:
                    cleaned = text[:pos].strip()
                    for j, cm in enumerate(num_choices):
                        s = cm.start()
                        e = num_choices[j+1].start() if j+1 < len(num_choices) else len(text)
                        choices.append(text[s:e].strip())

        return cleaned, choices

    def _associate_elements(self, questions, tables, diagrams, graphs, maps):
        """Associate detected elements with their nearest questions."""
        if not questions:
            return questions

        elements = []
        for t in tables:
            elements.append(dict(t, elem_type='tables'))
        for d in diagrams:
            elements.append(dict(d, elem_type='diagrams'))
        for g in graphs:
            elements.append(dict(g, elem_type='graphs'))
        for m in maps:
            elements.append(dict(m, elem_type='maps'))

        if not elements:
            return questions

        elements.sort(key=lambda e: e.get('bbox', {}).get('y0', 0))
        total_chars = sum(len(q.get('text', '')) for q in questions)
        char_pos = 0
        idx = 0

        for q in questions:
            qlen = len(q.get('text', ''))
            ratio = (char_pos + qlen) / max(total_chars, 1)
            while idx < len(elements) and idx / max(len(elements), 1) <= ratio:
                elem = elements[idx]
                q[elem['elem_type']].append(elem)
                idx += 1
            char_pos += qlen

        while idx < len(elements):
            elem = elements[idx]
            questions[-1][elem['elem_type']].append(elem)
            idx += 1

        return questions
