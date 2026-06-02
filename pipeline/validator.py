"""
EJU Intelligence Platform - Validation Engine
Validates all extracted data for quality, completeness, and correctness.
"""
import json
import os
from typing import List, Dict, Optional
from datetime import datetime
from .pipeline_config import OCR_CONFIDENCE_THRESHOLD, REPORTS_DIR


class Validator:
    """Validates the entire dataset construction pipeline output."""

    def __init__(self):
        self.validation_results = []
        self.low_confidence_items = []
        self.errors = []

    def validate_exam(self, exam_result: Dict) -> Dict:
        """Validate a complete exam processing result."""
        report = {
            'pdf': exam_result.get('source_file', ''),
            'pages': len(exam_result.get('pages', [])),
            'questions': len(exam_result.get('questions', [])),
            'tables': sum(p.get('table_count', 0) for p in exam_result.get('pages', [])),
            'graphs': sum(p.get('graph_count', 0) for p in exam_result.get('pages', [])),
            'maps': sum(p.get('map_count', 0) for p in exam_result.get('pages', [])),
            'diagrams': sum(p.get('diagram_count', 0) for p in exam_result.get('pages', [])),
            'timelines': sum(p.get('timeline_count', 0) for p in exam_result.get('pages', [])),
            'confidence_average': 0.0,
            'confidence_min': 1.0,
            'confidence_max': 0.0,
            'low_confidence_count': 0,
            'validation': 'PASS',
            'warnings': [],
            'errors': [],
            'timestamp': datetime.now().isoformat(),
        }

        questions = exam_result.get('questions', [])
        if not questions:
            report['validation'] = 'WARN'
            report['warnings'].append('No questions extracted')
            self.validation_results.append(report)
            return report

        confidences = [q.get('ocr_confidence', 0) for q in questions if q.get('ocr_confidence') is not None]
        if confidences:
            report['confidence_average'] = round(sum(confidences) / len(confidences), 4)
            report['confidence_min'] = min(confidences)
            report['confidence_max'] = max(confidences)

            low_conf = [c for c in confidences if c < OCR_CONFIDENCE_THRESHOLD]
            report['low_confidence_count'] = len(low_conf)

            for q in questions:
                if q.get('ocr_confidence', 1.0) < OCR_CONFIDENCE_THRESHOLD:
                    self.low_confidence_items.append({
                        'exam': exam_result.get('source_file', ''),
                        'question_number': q.get('number', '?'),
                        'confidence': q.get('ocr_confidence', 0),
                        'text_preview': q.get('text', '')[:100],
                    })

        required_fields = ['id', 'number', 'text', 'domain', 'topic',
                          'difficulty', 'question_type', 'ocr_confidence']
        for q in questions:
            missing = [f for f in required_fields if f not in q or q.get(f) is None]
            if missing:
                report['warnings'].append(f"Q{q.get('number', '?')}: missing fields: {missing}")

        if len(questions) < 10:
            report['warnings'].append(f"Low question count: {len(questions)} (expected 30-40+)")

        if report['low_confidence_count'] > len(questions) * 0.3:
            report['validation'] = 'FAIL'
            report['errors'].append("Over 30% of questions have low confidence")
        elif report['low_confidence_count'] > len(questions) * 0.1:
            report['validation'] = 'WARN'
            report['warnings'].append(f"{report['low_confidence_count']} questions have low confidence")

        if not report['errors']:
            report['validation'] = 'PASS'

        self.validation_results.append(report)
        return report

    def validate_dataset(self, dataset: Dict) -> Dict:
        """Validate the entire dataset."""
        report = {
            'total_exams': 0, 'total_questions': 0, 'total_pages': 0,
            'exams_pass': 0, 'exams_warn': 0, 'exams_fail': 0,
            'average_confidence': 0.0, 'total_low_confidence': 0,
            'domain_distribution': {}, 'year_distribution': {},
            'difficulty_distribution': {}, 'validation': 'PASS',
            'timestamp': datetime.now().isoformat(),
        }

        exams = dataset.get('exams', [])
        if not exams:
            report['validation'] = 'WARN'
            return report

        report['total_exams'] = len(exams)
        all_questions = []
        for exam in exams:
            all_questions.extend(exam.get('questions', []))

        report['total_questions'] = len(all_questions)
        all_confidences = []

        for q in all_questions:
            conf = q.get('ocr_confidence', 0)
            if conf:
                all_confidences.append(conf)
            domain = q.get('domain', 'unknown')
            report['domain_distribution'][domain] = report['domain_distribution'].get(domain, 0) + 1
            year = q.get('year', 0)
            report['year_distribution'][str(year)] = report['year_distribution'].get(str(year), 0) + 1
            diff = q.get('difficulty', 0)
            report['difficulty_distribution'][str(diff)] = report['difficulty_distribution'].get(str(diff), 0) + 1

        if all_confidences:
            report['average_confidence'] = round(sum(all_confidences) / len(all_confidences), 4)

        for vr in self.validation_results:
            if vr['validation'] == 'PASS': report['exams_pass'] += 1
            elif vr['validation'] == 'WARN': report['exams_warn'] += 1
            else: report['exams_fail'] += 1

        report['total_low_confidence'] = len(self.low_confidence_items)
        report['low_confidence_items'] = self.low_confidence_items[:20]

        return report

    def generate_report(self, exam_result: Dict, output_path: str = None):
        """Generate and save validation report."""
        if output_path is None:
            output_path = REPORTS_DIR
        report = self.validate_exam(exam_result)
        report_path = os.path.join(output_path, f"validation_{exam_result.get('year', 'unknown')}.json")
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        return report

    def generate_low_confidence_report(self, output_path: str = None):
        """Generate low confidence review list."""
        if output_path is None:
            output_path = REPORTS_DIR
        report_path = os.path.join(output_path, 'low_confidence_review.json')
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump({
                'total_items': len(self.low_confidence_items),
                'items': self.low_confidence_items,
                'threshold': OCR_CONFIDENCE_THRESHOLD,
            }, f, ensure_ascii=False, indent=2)
        return report_path

    def get_summary(self) -> Dict:
        return {
            'total_validated': len(self.validation_results),
            'passed': sum(1 for r in self.validation_results if r['validation'] == 'PASS'),
            'warned': sum(1 for r in self.validation_results if r['validation'] == 'WARN'),
            'failed': sum(1 for r in self.validation_results if r['validation'] == 'FAIL'),
            'low_confidence_items': len(self.low_confidence_items),
            'errors': self.errors,
        }
