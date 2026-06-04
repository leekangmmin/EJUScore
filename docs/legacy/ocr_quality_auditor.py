#!/usr/bin/env python3
"""
EJU OCR 품질 감사 시스템 (OCR Quality Auditor)
================================================
296 PDFs → 3.42M chars OCR 결과의 6개 차원 심층 분석

기능:
1. OCR 신뢰도 분석 (confidence distribution)
2. 텍스트 품질 평가 (broken chars, normalization errors)
3. 일본어/영어/한국어 비율 분석
4. 문제 분리 정확도 평가 (per-exam, then averaged)
5. 표/그래프/수식 감지율
6. 데이터 구조 적합성 평가
7. 최종 성공률 예측

Usage:
    python3 ocr_quality_auditor.py --verbose
    python3 ocr_quality_auditor.py --json-only
"""
import argparse
import json
import os
import re
import sys
import math
from collections import defaultdict, Counter
from datetime import datetime
from typing import Dict, List, Optional, Tuple


DATASET_DIR = "dataset"
COMPREHENSIVE_DIR = os.path.join(DATASET_DIR, "comprehensive")
MATHEMATICS_DIR = os.path.join(DATASET_DIR, "mathematics")


# ──────────────────────────────────────────────────────────────────
# 1. OCR 신뢰도 분석 (OCR Confidence Analyzer)
# ──────────────────────────────────────────────────────────────────
class ConfidenceAnalyzer:
    """Analyzes OCR confidence scores across all exams."""

    def analyze(self, questions: List[Dict]) -> Dict:
        confidences = [q.get('ocr_confidence', 0.0) for q in questions if q.get('ocr_confidence') is not None]
        if not confidences:
            return {
                'count': 0,
                'mean': 0.0, 'median': 0.0, 'std': 0.0,
                'min': 0.0, 'max': 0.0,
                'distribution': {'high_0.9+': 0, 'good_0.8+': 0, 'fair_0.6+': 0, 'poor_0.4+': 0, 'bad_<0.4': 0},
                'risky_count': 0,
            }

        sorted_c = sorted(confidences)
        n = len(sorted_c)
        median = sorted_c[n // 2] if n % 2 else (sorted_c[n // 2 - 1] + sorted_c[n // 2]) / 2
        mean = sum(sorted_c) / n
        variance = sum((c - mean) ** 2 for c in sorted_c) / n

        buckets = {
            'high_0.9+': sum(1 for c in sorted_c if c >= 0.9),
            'good_0.8+': sum(1 for c in sorted_c if 0.8 <= c < 0.9),
            'fair_0.6+': sum(1 for c in sorted_c if 0.6 <= c < 0.8),
            'poor_0.4+': sum(1 for c in sorted_c if 0.4 <= c < 0.6),
            'bad_<0.4': sum(1 for c in sorted_c if c < 0.4),
        }

        risky_count = sum(1 for c in sorted_c if c < 0.6)

        return {
            'count': n,
            'mean': round(mean, 4),
            'median': round(median, 4),
            'std': round(math.sqrt(variance), 4),
            'min': round(sorted_c[0], 4),
            'max': round(sorted_c[-1], 4),
            'distribution': buckets,
            'risky_count': risky_count,
            'risky_ratio': round(risky_count / n, 4) if n else 0,
        }


# ──────────────────────────────────────────────────────────────────
# 2. 텍스트 품질 분석 (Text Quality Analyzer)
# ──────────────────────────────────────────────────────────────────
class TextQualityAnalyzer:
    """Analyzes raw OCR text for quality issues."""

    @staticmethod
    def count_broken_chars(text: str) -> int:
        return len(re.findall(r'[�□▯■★☆◆◇○●△▲▽▼]', text))

    @staticmethod
    def count_garbage_sequences(text: str) -> int:
        return len(re.findall(r'([\-＝=━─ー−_｜|/\\＼]){5,}', text))

    @staticmethod
    def count_normalization_errors(text: str) -> int:
        errors = 0
        errors += len(re.findall(
            r'([アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン]) '
            r'([アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン])', text))
        errors += len(re.findall(r'[0Oo]{2,}[l1I]{2,}', text))
        return errors

    @staticmethod
    def compute_meaningful_ratio(text: str) -> float:
        if not text:
            return 0.0
        meaningful = len(re.findall(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF10-\uFF19a-zA-Z0-9]', text))
        total = len(text)
        return meaningful / total if total else 0

    def analyze(self, texts: List[str]) -> Dict:
        if not texts:
            return {'count': 0, 'broken_chars_total': 0, 'garbage_seqs_total': 0}

        total_chars = sum(len(t) for t in texts)
        total_broken = sum(self.count_broken_chars(t) for t in texts)
        total_garbage_seqs = sum(self.count_garbage_sequences(t) for t in texts)
        total_normalization_errors = sum(self.count_normalization_errors(t) for t in texts)
        meaningful_ratios = [self.compute_meaningful_ratio(t) for t in texts if t]

        very_short = sum(1 for t in texts if 0 < len(t) < 20)
        empty = sum(1 for t in texts if not t.strip())

        return {
            'total_documents': len(texts),
            'total_chars': total_chars,
            'broken_chars': total_broken,
            'broken_ratio': round(total_broken / total_chars, 6) if total_chars else 0,
            'garbage_sequences': total_garbage_seqs,
            'normalization_errors': total_normalization_errors,
            'avg_meaningful_ratio': round(sum(meaningful_ratios) / len(meaningful_ratios), 4) if meaningful_ratios else 0,
            'very_short_docs': very_short,
            'empty_docs': empty,
            'quality_score': self._quality_grade(total_broken, total_garbage_seqs, meaningful_ratios, total_chars),
        }

    def _quality_grade(self, broken: int, garbage: int, ratios: List[float], total_chars: int) -> str:
        if total_chars == 0:
            return 'F'
        if broken / total_chars > 0.01:
            return 'C' if broken / total_chars < 0.05 else 'D'
        if garbage > 10:
            return 'C'
        if ratios and sum(ratios) / len(ratios) < 0.6:
            return 'C'
        return 'A'


# ──────────────────────────────────────────────────────────────────
# 3. 언어 분포 분석 (Language Distribution Analyzer)
# ──────────────────────────────────────────────────────────────────
class LanguageAnalyzer:
    """Analyzes Japanese/English/Korean ratio in OCR text."""

    UNICODE_RANGES = {
        'japanese_hiragana': (0x3040, 0x309F),
        'japanese_katakana': (0x30A0, 0x30FF),
        'kanji': (0x4E00, 0x9FFF),
        'japanese_punct': (0x3000, 0x303F),
        'fullwidth': (0xFF00, 0xFFEF),
        'english_upper': (0x41, 0x5A),
        'english_lower': (0x61, 0x7A),
        'digits': (0x30, 0x39),
        'korean': (0xAC00, 0xD7AF),
    }

    @staticmethod
    def char_type(char: str) -> str:
        cp = ord(char)
        for name, (lo, hi) in LanguageAnalyzer.UNICODE_RANGES.items():
            if lo <= cp <= hi:
                return name
        return 'other'

    def analyze(self, text: str) -> Dict:
        if not text:
            return {}

        char_counts = Counter(self.char_type(c) for c in text)
        total = len(text)

        jp_chars = sum(char_counts.get(t, 0) for t in
                       ['japanese_hiragana', 'japanese_katakana', 'kanji', 'japanese_punct', 'fullwidth'])
        en_chars = sum(char_counts.get(t, 0) for t in ['english_upper', 'english_lower'])
        digit_chars = char_counts.get('digits', 0)
        kr_chars = char_counts.get('korean', 0)

        return {
            'total_chars': total,
            'japanese_chars': jp_chars,
            'japanese_ratio': round(jp_chars / total, 4) if total else 0,
            'english_chars': en_chars,
            'english_ratio': round(en_chars / total, 4) if total else 0,
            'digit_chars': digit_chars,
            'digit_ratio': round(digit_chars / total, 4) if total else 0,
            'korean_chars': kr_chars,
            'korean_ratio': round(kr_chars / total, 4) if total else 0,
        }


# ──────────────────────────────────────────────────────────────────
# 4. 문제 분리 정확도 분석 (Question Separation Analyzer)
# ──────────────────────────────────────────────────────────────────
class QuestionSeparationAnalyzer:
    """
    Evaluates how well questions are separated from OCR text.
    KEY FIX: Per-exam analysis then weighted average across exams.
    This prevents aggregated multi-exam data from skewing the score.
    """

    EXPECTED_QUESTIONS = {
        'comprehensive': (35, 42),
        'mathematics_course1': (15, 22),
        'mathematics_course2': (15, 22),
    }

    @staticmethod
    def count_question_markers(text: str) -> int:
        markers = set()
        for m in re.finditer(r'問\s*(\d+)', text):
            markers.add(int(m.group(1)))
        for m in re.finditer(r'第\s*(\d+)\s*問', text):
            markers.add(int(m.group(1)))
        for m in re.finditer(r'(?:^|\s)([1-9]|[12][0-9]|3[0-9])\.\s', text):
            markers.add(int(m.group(1)))
        # Filter out unreasonably large numbers (OCR artifacts)
        valid = {m for m in markers if 1 <= m <= 50}
        return len(valid)

    @staticmethod
    def count_non_consecutive_numbers(questions: List[Dict]) -> int:
        # Filter valid EJU question numbers (1-50); OCR artifacts >50 must be excluded
        numbers = sorted(set(q.get('number', 0) for q in questions if q.get('number') and 1 <= q.get('number', 0) <= 50))
        if not numbers:
            return 0
        gaps = 0
        for i in range(len(numbers) - 1):
            if numbers[i + 1] - numbers[i] > 1:
                gaps += 1
        return gaps

    @staticmethod
    def count_duplicate_numbers(questions: List[Dict]) -> int:
        # Filter valid EJU question numbers (1-50)
        numbers = [q.get('number', 0) for q in questions if q.get('number') and 1 <= q.get('number', 0) <= 50]
        counter = Counter(numbers)
        return sum(c - 1 for c in counter.values() if c > 1)

    def analyze(self, questions: List[Dict], ocr_text: str, subject: str) -> Dict:
        """
        Per-exam analysis. If questions span multiple exams,
        analyze each exam separately and return weighted average.
        """
        exam_groups = defaultdict(list)
        for q in questions:
            key = (q.get('_source_file', ''), q.get('_year', 0), q.get('_round', 1))
            exam_groups[key].append(q)

        sub_q_all = self.count_sub_question_detection(ocr_text)

        if len(exam_groups) <= 1:
            return self._analyze_single(questions, ocr_text, subject, sub_q_all)
        else:
            return self._analyze_multi(exam_groups, sub_q_all, subject)

    def _analyze_single(self, questions: List[Dict], ocr_text: str,
                        subject: str, sub_q: Dict) -> Dict:
        extracted = self.count_extracted_questions(questions)
        markers_seen = self.count_question_markers(ocr_text)
        gaps = self.count_non_consecutive_numbers(questions)
        duplicates = self.count_duplicate_numbers(questions)

        expected_range = self.EXPECTED_QUESTIONS.get(subject, (30, 40))
        sep_score = self._compute_sep_score(extracted, expected_range, gaps, duplicates)

        return {
            'extracted_count': extracted,
            'markers_in_text': markers_seen,
            'expected_range': expected_range,
            'numbering_gaps': gaps,
            'duplicate_numbers': duplicates,
            'sub_question_markers': sub_q,
            'separation_quality_score': round(sep_score, 4),
            'grade': self._score_to_grade(sep_score),
            'exam_count': 1,
        }

    def _analyze_multi(self, exam_groups: Dict, sub_q: Dict, subject: str) -> Dict:
        """Weighted average across exams."""
        exam_scores = []
        total_weight = 0
        total_extracted = 0
        total_markers = 0
        total_gaps = 0
        total_dups = 0

        expected_range = self.EXPECTED_QUESTIONS.get(subject, (30, 40))

        for key, qs in exam_groups.items():
            extracted = self.count_extracted_questions(qs)
            gaps = self.count_non_consecutive_numbers(qs)
            duplicates = self.count_duplicate_numbers(qs)

            total_extracted += extracted
            total_gaps += gaps
            total_dups += duplicates

            sep_score = self._compute_sep_score(extracted, expected_range, gaps, duplicates)

            weight = len(qs)
            total_weight += weight
            exam_scores.append(sep_score * weight)

        weighted_score = sum(exam_scores) / max(total_weight, 1)

        return {
            'extracted_count': total_extracted,
            'expected_range': expected_range,
            'numbering_gaps': total_gaps,
            'duplicate_numbers': total_dups,
            'sub_question_markers': sub_q,
            'separation_quality_score': round(weighted_score, 4),
            'grade': self._score_to_grade(weighted_score),
            'exam_count': len(exam_groups),
        }

    def _compute_sep_score(self, extracted: int, expected_range: Tuple[int, int],
                           gaps: int, duplicates: int) -> float:
        lo, hi = expected_range
        if extracted == 0:
            sep_score = 0.0
        elif extracted < lo:
            sep_score = extracted / lo  # 0.0 ~ 1.0
        elif extracted <= hi + 10:
            sep_score = 1.0
        else:
            # Over-extraction penalty: e.g. 68 vs expected 42
            overshoot = extracted - hi
            sep_score = max(0.3, 1.0 - overshoot * 0.01)

        # Penalties proportional to extracted count
        eff = max(extracted, 1)
        # Gap penalty: each gap penalizes but capped at 50%
        gap_penalty = min(0.50, (gaps / eff) * 0.8)
        # Duplicate penalty: each dup penalizes but capped at 40%
        dup_penalty = min(0.40, (duplicates / eff) * 0.6)
        return max(0.0, min(1.0, sep_score - gap_penalty - dup_penalty))

    @staticmethod
    def _score_to_grade(score: float) -> str:
        if score >= 0.9:
            return 'A'
        elif score >= 0.7:
            return 'B'
        elif score >= 0.5:
            return 'C'
        return 'D'

    @staticmethod
    def count_extracted_questions(questions: List[Dict]) -> int:
        return len(questions)

    @staticmethod
    def count_sub_question_detection(text: str) -> Dict:
        return {
            'numeric_paren': len(re.findall(r'\(\s*[1-9]\s*\)', text)),
            'alpha_paren': len(re.findall(r'[（(]\s*[ア-オアイウエオa-eA-E]\s*[）)]', text)),
            'circle_markers': len(re.findall(r'[①②③④⑤⑥⑦⑧⑨⑩]', text)),
        }


# ──────────────────────────────────────────────────────────────────
# 5. 수식/표/그래프 감지 분석 (Formula & Table Analyzer)
# ──────────────────────────────────────────────────────────────────
class FormulaTableAnalyzer:
    """Analyzes detection of formulas, tables, and graphs."""

    @staticmethod
    def count_formula_patterns(text: str) -> Dict:
        return {
            'equations': len(re.findall(r'[=≠≒≡]', text)),
            'integrals': len(re.findall(r'[∫∮]', text)),
            'derivatives': len(re.findall(r"['′∂∇]", text)),
            'fractions': len(re.findall(r'[⁄∕／]', text)),
            'greek_letters': len(re.findall(r'[α-ωΑ-Ω]', text)),
            'math_symbols': len(re.findall(r'[±×÷∑∏√∞∠⊥△]', text)),
        }

    def analyze(self, questions: List[Dict], pages: List[Dict]) -> Dict:
        total_tables = sum(p.get('table_count', 0) for p in pages)
        total_graphs = sum(p.get('graph_count', 0) for p in pages)
        total_diagrams = sum(p.get('diagram_count', 0) for p in pages)

        formula_hits = Counter()
        for q in questions:
            text = q.get('text', '')
            for k, v in self.count_formula_patterns(text).items():
                formula_hits[k] += v

        return {
            'detected_tables': total_tables,
            'detected_graphs': total_graphs,
            'detected_diagrams': total_diagrams,
            'formula_hits': dict(formula_hits),
            'total_formula_markers': sum(formula_hits.values()),
        }


# ──────────────────────────────────────────────────────────────────
# 6. 데이터 구조 적합성 평가 (Schema Completeness Analyzer)
# ──────────────────────────────────────────────────────────────────
class SchemaCompletenessAnalyzer:
    """Evaluates how complete the structured data is."""

    REQUIRED_FIELDS = ['id', 'number', 'text', 'domain', 'topic',
                       'question_type', 'difficulty', 'ocr_confidence', 'year', 'round']

    OPTIONAL_FIELDS = ['subtopic', 'keywords', 'concepts', 'answer_choices',
                       'tables', 'graphs', 'diagrams']

    def analyze_question_schema(self, questions: List[Dict]) -> Dict:
        if not questions:
            return {'completeness_score': 0, 'field_stats': {}}

        field_stats = {}
        for field in self.REQUIRED_FIELDS:
            present = sum(1 for q in questions if field in q and q.get(field) is not None)
            field_stats[field] = {'present': present, 'ratio': round(present / len(questions), 4)}

        for field in self.OPTIONAL_FIELDS:
            present = sum(1 for q in questions if field in q)
            field_stats[field] = {'present': present, 'ratio': round(present / len(questions), 4)}

        required_ratio = sum(fs['ratio'] for f, fs in field_stats.items() if f in self.REQUIRED_FIELDS)
        optional_ratio = sum(fs['ratio'] for f, fs in field_stats.items() if f in self.OPTIONAL_FIELDS)
        completeness_score = (required_ratio / len(self.REQUIRED_FIELDS)) * 0.7 + \
                             (optional_ratio / len(self.OPTIONAL_FIELDS)) * 0.3

        return {
            'completeness_score': round(completeness_score, 4),
            'total_questions': len(questions),
            'field_stats': field_stats,
            'missing_required': [f for f in self.REQUIRED_FIELDS
                                 if field_stats.get(f, {}).get('ratio', 0) < 0.8],
        }

    def analyze_exam_schema(self, exam: Dict) -> Dict:
        required_exam_fields = ['id', 'source_file', 'subject', 'year', 'round',
                                'total_pages', 'total_questions', 'questions', 'pages', 'metadata']
        missing = [f for f in required_exam_fields if f not in exam]
        return {
            'valid': len(missing) == 0,
            'missing_fields': missing,
            'total_fields': len(required_exam_fields),
            'present_fields': len(required_exam_fields) - len(missing),
        }


# ──────────────────────────────────────────────────────────────────
# 종합 품질 감사기 (Master Quality Auditor)
# ──────────────────────────────────────────────────────────────────
class EJUMasterQualityAuditor:
    """Runs all audits across all subjects and produces a comprehensive report."""

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.conf_analyzer = ConfidenceAnalyzer()
        self.text_analyzer = TextQualityAnalyzer()
        self.lang_analyzer = LanguageAnalyzer()
        self.sep_analyzer = QuestionSeparationAnalyzer()
        self.formula_analyzer = FormulaTableAnalyzer()
        self.schema_analyzer = SchemaCompletenessAnalyzer()

    def load_subject_data(self, subject: str) -> Tuple[List[Dict], List[str]]:
        base_dir = COMPREHENSIVE_DIR if subject == 'comprehensive' else MATHEMATICS_DIR
        exams = []
        all_texts = []

        if not os.path.exists(base_dir):
            return exams, all_texts

        for year_dir in sorted(os.listdir(base_dir)):
            year_path = os.path.join(base_dir, year_dir)
            if not os.path.isdir(year_path):
                continue
            for fname in sorted(os.listdir(year_path)):
                if not fname.endswith('.json') or fname in ('dataset_consolidated.json', 'master_dataset.json'):
                    continue
                fpath = os.path.join(year_path, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        exam = json.load(f)
                    exams.append(exam)
                    for q in exam.get('questions', []):
                        if q.get('text'):
                            all_texts.append(q['text'])
                    for p in exam.get('pages', []):
                        if p.get('text'):
                            all_texts.append(p['text'])
                except Exception as e:
                    if self.verbose:
                        print(f"  [WARN] Failed to load {fpath}: {e}")

        return exams, all_texts

    def flatten_questions(self, exams: List[Dict]) -> List[Dict]:
        questions = []
        for exam in exams:
            for q in exam.get('questions', []):
                q['_source_file'] = exam.get('source_file', '')
                q['_subject'] = exam.get('subject', '')
                q['_year'] = exam.get('year', 0)
                q['_round'] = exam.get('round', 1)
                questions.append(q)
        return questions

    def audit_subject(self, subject: str) -> Dict:
        if self.verbose:
            print(f"\n{'='*70}")
            print(f"  Auditing: {subject.upper()}")
            print(f"{'='*70}")

        exams, all_texts = self.load_subject_data(subject)
        questions = self.flatten_questions(exams)

        if self.verbose:
            print(f"  Loaded {len(exams)} exams, {len(questions)} questions, {len(all_texts)} text samples")

        # 1: Confidence
        conf_result = self.conf_analyzer.analyze(questions)
        if self.verbose:
            print(f"\n  [1/6] OCR Confidence: mean={conf_result['mean']:.3f}, "
                  f"risky={conf_result['risky_count']} ({conf_result['risky_ratio']*100:.1f}%)")

        # 2: Text Quality
        text_result = self.text_analyzer.analyze(all_texts)
        if self.verbose:
            print(f"  [2/6] Text Quality: grade={text_result['quality_score']}, "
                  f"broken={text_result['broken_chars']}, meaningful={text_result['avg_meaningful_ratio']:.3f}")

        # 3: Language Distribution
        combined_text = ' '.join(all_texts)
        lang_result = self.lang_analyzer.analyze(combined_text)
        if self.verbose:
            print(f"  [3/6] Language: JP={lang_result.get('japanese_ratio', 0)*100:.1f}%, "
                  f"EN={lang_result.get('english_ratio', 0)*100:.1f}%")

        # 4: Question Separation (per-exam weighted)
        combined_ocr_text = ' '.join(p.get('text', '') for exam in exams for p in exam.get('pages', []))
        sep_result = self.sep_analyzer.analyze(questions, combined_ocr_text, subject)
        if self.verbose:
            print(f"  [4/6] Separation: extracted={sep_result['extracted_count']}, "
                  f"score={sep_result['separation_quality_score']:.3f} [{sep_result['grade']}], "
                  f"exams_analyzed={sep_result.get('exam_count', 'N/A')}")

        # 5: Formula/Table/Graph
        pages = [p for exam in exams for p in exam.get('pages', [])]
        formula_result = self.formula_analyzer.analyze(questions, pages)
        if self.verbose:
            print(f"  [5/6] Formula/Table: tables={formula_result['detected_tables']}, "
                  f"graphs={formula_result['detected_graphs']}, "
                  f"formula_markers={formula_result['total_formula_markers']}")

        # 6: Schema Completeness
        schema_result = self.schema_analyzer.analyze_question_schema(questions)
        if self.verbose:
            print(f"  [6/6] Schema: score={schema_result['completeness_score']:.3f}, "
                  f"missing_required={schema_result['missing_required']}")

        # ── Overall Quality Score ──
        scores = {
            'ocr_confidence': min(100, max(0, conf_result['mean'] * 100)),
            'text_quality': self._text_quality_score(text_result),
            'separation_quality': max(0, min(100, sep_result['separation_quality_score'] * 100)),
            'schema_completeness': max(0, min(100, schema_result['completeness_score'] * 100)),
        }

        formula_bonus = min(10, formula_result['total_formula_markers'] * 0.5)
        jp_ratio = lang_result.get('japanese_ratio', 0)
        lang_bonus = 5 if 0.25 <= jp_ratio <= 0.60 else 0

        weights = {'ocr_confidence': 0.35, 'text_quality': 0.25,
                   'separation_quality': 0.25, 'schema_completeness': 0.15}
        base_score = sum(scores[k] * weights[k] for k in weights)
        overall_score = min(100, base_score + formula_bonus + lang_bonus)

        if self.verbose:
            print(f"\n  ─── Dimension Scores ───")
            for dim, sc in scores.items():
                print(f"  {dim}: {sc:.1f}/100")
            print(f"  Formula bonus: +{formula_bonus:.1f}")
            print(f"  Language bonus: +{lang_bonus:.1f}")
            print(f"  ─────────────────────────")
            print(f"  ★ OVERALL QUALITY SCORE: {overall_score:.1f}/100")

        return {
            'subject': subject,
            'exams_count': len(exams),
            'questions_count': len(questions),
            'overall_score': round(overall_score, 2),
            'dimension_scores': scores,
            'bonuses': {'formula': round(formula_bonus, 2), 'language': lang_bonus},
            'confidence': conf_result,
            'text_quality': text_result,
            'language': lang_result,
            'separation': sep_result,
            'formula_tables': formula_result,
            'schema': schema_result,
        }

    def _text_quality_score(self, result: Dict) -> float:
        grade = result.get('quality_score', 'F')
        grade_map = {'A': 95, 'B': 80, 'C': 60, 'D': 40, 'F': 20}
        base = grade_map.get(grade, 50)
        meaningful = result.get('avg_meaningful_ratio', 0)
        meaningful_score = meaningful * 100
        broken_ratio = result.get('broken_ratio', 1)
        broken_penalty = min(30, broken_ratio * 1000)
        empty_penalty = min(20, result.get('empty_docs', 0) * 2)
        return max(0, min(100, (base * 0.4 + meaningful_score * 0.4) - broken_penalty - empty_penalty))

    def audit_all(self) -> Dict:
        if self.verbose:
            print("\n" + "█" * 70)
            print("  EJU OCR QUALITY AUDIT SYSTEM v2.0")
            print("  Comprehensive Quality Assessment")
            print("█" * 70)

        comprehensive = self.audit_subject('comprehensive')
        mathematics = self.audit_subject('mathematics')

        cross = self._cross_subject_analysis(comprehensive, mathematics)

        report = {
            'generated_at': datetime.now().isoformat(),
            'system_version': '2.0.0',
            'subjects': {
                'comprehensive': comprehensive,
                'mathematics': mathematics,
            },
            'cross_subject': cross,
            'summary': self._generate_summary(comprehensive, mathematics, cross),
        }
        return report

    def _cross_subject_analysis(self, comp: Dict, math: Dict) -> Dict:
        overall = (comp['overall_score'] + math['overall_score']) / 2
        return {
            'overall_system_score': round(overall, 2),
            'stronger_subject': 'comprehensive' if comp['overall_score'] >= math['overall_score'] else 'mathematics',
            'score_gap': round(abs(comp['overall_score'] - math['overall_score']), 2),
            'combined_questions': comp['questions_count'] + math['questions_count'],
            'combined_exams': comp['exams_count'] + math['exams_count'],
        }

    def _generate_summary(self, comp: Dict, math: Dict, cross: Dict) -> Dict:
        return {
            'verdict': self._verdict(cross['overall_system_score']),
            'overall_system_score': cross['overall_system_score'],
            'highlights': [
                f"종합과목: {comp['questions_count']}문항, {comp['overall_score']}점" if comp else "종합과목: 데이터 없음",
                f"수학: {math['questions_count']}문항, {math['overall_score']}점" if math else "수학: 데이터 없음",
                f"통합: {cross['combined_questions']}문항, {cross['combined_exams']}개 시험지 분석",
            ],
            'critical_issues': self._find_critical_issues(comp, math),
            'recommendations': self._recommendations(comp, math),
        }

    def _verdict(self, score: float) -> str:
        if score >= 85:
            return 'EXCELLENT - Production ready'
        elif score >= 70:
            return 'GOOD - Usable with minor corrections'
        elif score >= 55:
            return 'FAIR - Usable but needs significant corrections'
        elif score >= 40:
            return 'POOR - Requires re-OCR or major fixes'
        else:
            return 'FAIL - Not usable in current state'

    def _find_critical_issues(self, comp: Dict, math: Dict) -> List[str]:
        issues = []
        for name, data in [('종합과목', comp), ('수학', math)]:
            if data['separation']['grade'] in ('D',):
                issues.append(f"{name}: 문제 분리 정확도 낮음 (grade {data['separation']['grade']})")
            if data['text_quality']['quality_score'] in ('D', 'F'):
                issues.append(f"{name}: 텍스트 품질 낮음 (grade {data['text_quality']['quality_score']})")
            if data['confidence']['risky_ratio'] > 0.2:
                issues.append(f"{name}: OCR 신뢰도 낮은 문항 {data['confidence']['risky_ratio']*100:.0f}%")
            missing = data['schema']['missing_required']
            if missing:
                issues.append(f"{name}: 필수 필드 누락: {missing}")
        return issues

    def _recommendations(self, comp: Dict, math: Dict) -> List[str]:
        recs = []
        for name, data in [('종합과목', comp), ('수학', math)]:
            if data['confidence']['mean'] < 0.7:
                recs.append(f"{name}: OCR 파라미터 조정 필요 (현재 평균 {data['confidence']['mean']:.2f})")
            if data['separation'].get('separation_quality_score', 1) < 0.7:
                recs.append(f"{name}: 문제 분리 정규식 개선 필요 (점수 {data['separation']['separation_quality_score']:.2f})")
            if data['text_quality']['avg_meaningful_ratio'] < 0.5:
                recs.append(f"{name}: 텍스트 후처리 강화 필요 (유의미 비율 {data['text_quality']['avg_meaningful_ratio']:.2f})")
        if not recs:
            recs.append("모든 지표가 양호합니다. 추가 최적화는 선택 사항입니다.")
        return recs


# ──────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='EJU OCR Quality Auditor')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--json-only', action='store_true', help='Output JSON only')
    parser.add_argument('--output', '-o', type=str, default='ocr_quality_report.json',
                        help='Output JSON path')
    args = parser.parse_args()

    auditor = EJUMasterQualityAuditor(verbose=args.verbose)
    report = auditor.audit_all()

    output_path = args.output
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    if not args.json_only:
        print(f"\n{'='*70}")
        print(f"  AUDIT COMPLETE")
        print(f"{'='*70}")
        print(f"  Report saved to: {output_path}")
        s = report['summary']
        print(f"\n  ★ System Quality Score: {s['overall_system_score']:.1f}/100")
        print(f"  ★ Verdict: {s['verdict']}")

        if s['critical_issues']:
            print(f"\n  ⚠ Critical Issues:")
            for issue in s['critical_issues']:
                print(f"    • {issue}")

        print(f"\n  📋 Recommendations:")
        for rec in s['recommendations']:
            print(f"    • {rec}")

    return report


if __name__ == '__main__':
    main()
