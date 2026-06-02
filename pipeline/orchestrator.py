"""
EJU Intelligence Platform - Main Pipeline Orchestrator
Coordinates the entire dataset construction workflow.
"""
import os
import json
import time
import concurrent.futures
from typing import List, Dict, Optional
from datetime import datetime
from PIL import Image
import io
import traceback

from .pipeline_config import (
    COMPREHENSIVE_OUTPUT, MATHEMATICS_OUTPUT, REPORTS_DIR,
    OCR_CONFIDENCE_THRESHOLD, KNOWLEDGE_GRAPH_DIR, OCR_DPI
)
from .pdf_loader import discover_pdfs, load_pdf, render_page, extract_page_metadata
from .ocr_engine import OCREngine
from .layout_detection import LayoutDetector
from .structure_reconstruction import StructureReconstructor
from .knowledge_extraction import KnowledgeExtractor
from .validator import Validator
from .trend_analysis import TrendAnalyzer


class EJUPipeline:
    """Main orchestrator for the EJU dataset construction pipeline."""

    def __init__(self):
        self.ocr_engine = OCREngine()
        self.layout_detector = LayoutDetector()
        self.reconstructor = StructureReconstructor()
        self.knowledge_extractor = KnowledgeExtractor()
        self.validator = Validator()
        self.trend_analyzer = TrendAnalyzer()
        self.all_exams = []
        self.processing_stats = {
            'total_exams': 0, 'total_pages': 0, 'total_questions': 0,
            'successful': 0, 'failed': 0,
            'start_time': None, 'end_time': None, 'processing_time': 0,
        }

    def process_all(self, subject_type: str, max_workers: int = 2):
        print(f"\n{'='*70}")
        print(f"  EJU Dataset Construction Pipeline")
        print(f"  Subject: {subject_type.upper()}")
        print(f"{'='*70}")
        self.processing_stats['start_time'] = time.time()

        print(f"\n[1/8] Discovering PDFs...")
        pdfs = discover_pdfs(subject_type)
        print(f"  Found {len(pdfs)} exam PDFs")
        if not pdfs:
            print(f"  No PDFs found for {subject_type}")
            return []

        print(f"\n[2/8] Processing exams (max {max_workers} parallel workers)...")
        exam_results = []

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_pdf = {executor.submit(self.process_single_exam, pdf_info): pdf_info for pdf_info in pdfs}
            for i, future in enumerate(concurrent.futures.as_completed(future_to_pdf)):
                pdf_info = future_to_pdf[future]
                try:
                    result = future.result()
                    if result:
                        exam_results.append(result)
                        self.processing_stats['successful'] += 1
                        print(f"  ✓ [{i+1}/{len(pdfs)}] {pdf_info['filename']} - {result.get('total_questions', 0)} questions (conf: {result.get('metadata',{}).get('confidence_average',0):.2f})")
                    else:
                        self.processing_stats['failed'] += 1
                        print(f"  ✗ [{i+1}/{len(pdfs)}] {pdf_info['filename']} - FAILED")
                except Exception as e:
                    self.processing_stats['failed'] += 1
                    print(f"  ✗ [{i+1}/{len(pdfs)}] {pdf_info['filename']} - ERROR: {e}")

        exam_results.sort(key=lambda x: (x.get('year', 0), x.get('round', 1)))

        print(f"\n[3/8] Building dataset structure...")
        dataset = self.build_dataset(exam_results, subject_type)

        print(f"\n[4/8] Performing trend analysis...")
        for exam in exam_results:
            self.trend_analyzer.process_exam(exam.get('questions', []), exam.get('year', 0))

        print(f"\n[5/8] Saving JSON dataset...")
        self.save_dataset(dataset, subject_type)

        print(f"\n[6/8] Saving trend analysis...")
        trend_paths = self.trend_analyzer.save_all()

        print(f"\n[7/8] Generating validation reports...")
        self.save_validation_reports(exam_results)

        print(f"\n[8/8] Generating processing statistics...")
        stats = self.generate_statistics(exam_results)
        self.save_statistics(stats, subject_type)

        self.processing_stats['end_time'] = time.time()
        self.processing_stats['processing_time'] = round(
            self.processing_stats['end_time'] - self.processing_stats['start_time'], 2
        )
        self.all_exams.extend(exam_results)
        self.print_summary(subject_type)
        return dataset

    def process_single_exam(self, pdf_info: Dict) -> Optional[Dict]:
        """Process a single exam PDF through the complete pipeline."""
        try:
            filepath = pdf_info['path']
            filename = pdf_info['filename']
            year = pdf_info['year']
            exam_round = pdf_info.get('round', 1)
            subject = pdf_info['subject']

            doc = load_pdf(pdf_info)
            if doc is None:
                return None

            metadata = extract_page_metadata(doc)
            total_pages = metadata['total_pages']

            print(f"    Processing {filename} ({total_pages} pages)...")

            exam_result = {
                'id': f"{subject}_{year}_{exam_round}",
                'source_file': filename,
                'source_path': filepath,
                'subject': subject, 'year': year, 'round': exam_round,
                'total_pages': total_pages, 'pages': [], 'questions': [],
                'metadata': {
                    'doc_metadata': metadata,
                    'processed_at': datetime.now().isoformat(),
                    'confidence_average': 0.0,
                }
            }

            all_questions = []
            all_tables = []
            all_diagrams = []
            all_graphs = []
            all_maps = []

            page_start = time.time()
            for page_num in range(total_pages):
                page_data = render_page(doc, page_num, dpi=200)  # Use 200 DPI for speed
                if page_data is None:
                    continue

                img_bytes = page_data['image_bytes']
                pil_image = Image.open(io.BytesIO(img_bytes))

                # Layout detection (fast)
                layout = self.layout_detector.detect_all(pil_image)

                # OCR extraction (slowest part)
                ocr_result = self.ocr_engine.extract_with_layout(pil_image)
                tables = self.ocr_engine.extract_tables(pil_image)
                vertical_text = self.ocr_engine.detect_vertical_japanese(pil_image)

                # Reconstruct page structure
                page_questions = self.reconstructor.reconstruct(
                    ocr_result['text'],
                    ocr_result.get('blocks', []),
                    layout.get('tables', []) + tables,
                    layout.get('diagrams', []),
                    layout.get('graphs', []),
                    layout.get('maps', [])
                )

                # Extract knowledge for each question
                for q in page_questions:
                    knowledge = self.knowledge_extractor.extract_question_knowledge(
                        q, subject, year, exam_round
                    )
                    q.update(knowledge)

                all_questions.extend(page_questions)
                all_tables.extend(layout.get('tables', []))
                all_diagrams.extend(layout.get('diagrams', []))
                all_graphs.extend(layout.get('graphs', []))
                all_maps.extend(layout.get('maps', []))

                page_result = {
                    'page_number': page_num + 1,
                    'width': page_data['width'], 'height': page_data['height'],
                    'text': ocr_result['text'],
                    'ocr_confidence': ocr_result['confidence'],
                    'layout': {
                        'tables': layout.get('tables', []),
                        'diagrams': layout.get('diagrams', []),
                        'graphs': layout.get('graphs', []),
                        'maps': layout.get('maps', []),
                        'timelines': layout.get('timelines', []),
                        'question_regions': layout.get('question_regions', []),
                        'answer_choices': layout.get('answer_choice_regions', []),
                    },
                    'table_count': len(layout.get('tables', [])) + len(tables),
                    'diagram_count': len(layout.get('diagrams', [])),
                    'graph_count': len(layout.get('graphs', [])),
                    'map_count': len(layout.get('maps', [])),
                    'timeline_count': len(layout.get('timelines', [])),
                    'vertical_text': vertical_text,
                    'processing_time_ms': 0,
                }
                exam_result['pages'].append(page_result)

                if (page_num + 1) % 5 == 0:
                    elapsed = time.time() - page_start
                    print(f"      Page {page_num+1}/{total_pages} done ({elapsed:.1f}s)")

            elapsed = time.time() - page_start
            print(f"      All {total_pages} pages done ({elapsed:.1f}s total)")

            # Compute overall confidence
            confidences = [q.get('ocr_confidence', 0) for q in all_questions if q.get('ocr_confidence')]
            exam_result['metadata']['confidence_average'] = round(
                sum(confidences) / len(confidences), 4
            ) if confidences else 0.0

            exam_result['questions'] = all_questions
            exam_result['total_questions'] = len(all_questions)
            exam_result['total_tables'] = len(all_tables)
            exam_result['total_diagrams'] = len(all_diagrams)
            exam_result['total_graphs'] = len(all_graphs)
            exam_result['total_maps'] = len(all_maps)

            doc.close()
            return exam_result

        except Exception as e:
            print(f"  [ERROR] Processing {pdf_info.get('filename', 'unknown')}: {e}")
            traceback.print_exc()
            return None

    def build_dataset(self, exam_results, subject_type):
        dataset = {
            'dataset_name': f'EJU {subject_type.title()} Exam Dataset',
            'subject': subject_type, 'version': '1.0.0',
            'generated_at': datetime.now().isoformat(),
            'total_exams': len(exam_results),
            'total_questions': sum(e.get('total_questions', 0) for e in exam_results),
            'year_range': {}, 'exams': exam_results,
        }
        if exam_results:
            years = [e.get('year', 0) for e in exam_results if e.get('year')]
            if years:
                dataset['year_range'] = {'start': min(years), 'end': max(years)}
        return dataset

    def save_dataset(self, dataset, subject_type):
        output_dir = COMPREHENSIVE_OUTPUT if subject_type == 'comprehensive' else MATHEMATICS_OUTPUT

        exams_by_year = {}
        for exam in dataset.get('exams', []):
            year = exam.get('year', 'unknown')
            if year not in exams_by_year:
                exams_by_year[year] = []
            exams_by_year[year].append(exam)

        for year, year_exams in exams_by_year.items():
            year_dir = os.path.join(output_dir, str(year))
            os.makedirs(year_dir, exist_ok=True)
            for exam in year_exams:
                exam_round = exam.get('round', 1)
                filename = f"exam_{year}_r{exam_round}.json"
                filepath = os.path.join(year_dir, filename)
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(exam, f, ensure_ascii=False, indent=2)
                print(f"    Saved: {filepath}")

        master_path = os.path.join(output_dir, 'master_dataset.json')
        master = {k: v for k, v in dataset.items() if k != 'exams'}
        master['exam_count'] = len(dataset.get('exams', []))
        master['total_questions'] = dataset.get('total_questions', 0)
        master['exam_files'] = []
        for year, year_exams in exams_by_year.items():
            for exam in year_exams:
                master['exam_files'].append({
                    'year': year, 'round': exam.get('round', 1),
                    'file': f"{year}/exam_{year}_r{exam.get('round', 1)}.json",
                    'questions': exam.get('total_questions', 0),
                })
        with open(master_path, 'w', encoding='utf-8') as f:
            json.dump(master, f, ensure_ascii=False, indent=2)

        # Save consolidated dataset (lighter version)
        consolidated_path = os.path.join(output_dir, 'dataset_consolidated.json')
        consolidated = {
            'dataset_name': dataset['dataset_name'],
            'subject': dataset['subject'], 'version': dataset['version'],
            'generated_at': dataset['generated_at'],
            'total_exams': dataset['total_exams'],
            'total_questions': dataset['total_questions'],
            'year_range': dataset.get('year_range', {}),
            'exams': []
        }
        for exam in dataset.get('exams', []):
            consolidated['exams'].append({
                'id': exam.get('id'), 'source_file': exam.get('source_file'),
                'year': exam.get('year'), 'round': exam.get('round'),
                'subject': exam.get('subject'),
                'total_questions': exam.get('total_questions'),
                'total_pages': exam.get('total_pages'),
                'total_tables': exam.get('total_tables', 0),
                'total_diagrams': exam.get('total_diagrams', 0),
                'total_graphs': exam.get('total_graphs', 0),
                'total_maps': exam.get('total_maps', 0),
                'confidence_average': exam.get('metadata', {}).get('confidence_average', 0),
                'questions': [{
                    'id': q.get('id'), 'number': q.get('number'),
                    'text': q.get('text', '')[:500],
                    'subject': q.get('subject'), 'domain': q.get('domain'),
                    'topic': q.get('topic'), 'subtopic': q.get('subtopic'),
                    'difficulty': q.get('difficulty'),
                    'question_type': q.get('question_type'),
                    'keywords': q.get('keywords', []),
                    'concepts': q.get('concepts', []),
                    'ocr_confidence': q.get('ocr_confidence'),
                    'answer_choices': q.get('answer_choices', []),
                    'word_count': q.get('word_count', 0),
                } for q in exam.get('questions', [])]
            })
        with open(consolidated_path, 'w', encoding='utf-8') as f:
            json.dump(consolidated, f, ensure_ascii=False, indent=2)
        print(f"  Consolidated dataset saved to: {consolidated_path}")

    def save_validation_reports(self, exam_results):
        os.makedirs(REPORTS_DIR, exist_ok=True)
        for exam in exam_results:
            self.validator.generate_report(exam, REPORTS_DIR)
        self.validator.generate_low_confidence_report(REPORTS_DIR)

        dataset = {'exams': exam_results}
        dataset_report = self.validator.validate_dataset(dataset)
        report_path = os.path.join(REPORTS_DIR, 'dataset_validation.json')
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(dataset_report, f, ensure_ascii=False, indent=2)
        print(f"  Dataset validation: {report_path}")

    def generate_statistics(self, exam_results):
        stats = {
            'total_exams': len(exam_results),
            'total_pages': sum(e.get('total_pages', 0) for e in exam_results),
            'total_questions': sum(e.get('total_questions', 0) for e in exam_results),
            'total_tables': sum(e.get('total_tables', 0) for e in exam_results),
            'total_diagrams': sum(e.get('total_diagrams', 0) for e in exam_results),
            'total_graphs': sum(e.get('total_graphs', 0) for e in exam_results),
            'total_maps': sum(e.get('total_maps', 0) for e in exam_results),
            'average_questions_per_exam': 0,
            'average_confidence': 0.0,
            'year_coverage': [],
            'domain_distribution': {},
            'difficulty_distribution': {},
            'question_type_distribution': {},
        }
        if exam_results:
            all_questions = [q for e in exam_results for q in e.get('questions', [])]
            stats['average_questions_per_exam'] = round(stats['total_questions'] / len(exam_results), 1)
            confidences = [q.get('ocr_confidence', 0) for q in all_questions if q.get('ocr_confidence')]
            stats['average_confidence'] = round(sum(confidences) / len(confidences), 4) if confidences else 0.0
            stats['year_coverage'] = sorted(set(e.get('year', 0) for e in exam_results if e.get('year')))
            for q in all_questions:
                d = q.get('domain', 'unknown')
                stats['domain_distribution'][d] = stats['domain_distribution'].get(d, 0) + 1
                di = q.get('difficulty', 0)
                stats['difficulty_distribution'][str(di)] = stats['difficulty_distribution'].get(str(di), 0) + 1
                qt = q.get('question_type', 'unknown')
                stats['question_type_distribution'][qt] = stats['question_type_distribution'].get(qt, 0) + 1
        return stats

    def save_statistics(self, stats, subject_type):
        os.makedirs(REPORTS_DIR, exist_ok=True)
        path = os.path.join(REPORTS_DIR, f'processing_statistics_{subject_type}.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)

        error_report_path = os.path.join(REPORTS_DIR, 'error_report.json')
        with open(error_report_path, 'w', encoding='utf-8') as f:
            json.dump({
                'generated_at': datetime.now().isoformat(),
                'total_errors': self.validator.get_summary().get('errors', []),
                'low_confidence_count': len(self.validator.low_confidence_items),
                'failed_exams': self.processing_stats['failed'],
                'processing_time_seconds': self.processing_stats['processing_time'],
            }, f, ensure_ascii=False, indent=2)

    def print_summary(self, subject_type):
        stats = self.processing_stats
        vs = self.validator.get_summary()
        print(f"\n{'='*70}")
        print(f"  PROCESSING SUMMARY - {subject_type.upper()}")
        print(f"{'='*70}")
        print(f"  Total exams:     {stats['total_exams']}")
        print(f"  Successful:      {stats['successful']}")
        print(f"  Failed:          {stats['failed']}")
        print(f"  Total questions: {sum(e.get('total_questions', 0) for e in self.all_exams)}")
        print(f"  Processing time: {stats['processing_time']}s")
        print(f"\n  Validation:")
        print(f"    Passed:  {vs.get('passed', 0)}")
        print(f"    Warned:  {vs.get('warned', 0)}")
        print(f"    Failed:  {vs.get('failed', 0)}")
        print(f"    Low confidence items: {vs.get('low_confidence_items', 0)}")
        print(f"{'='*70}\n")

    def process_comprehensive(self, max_workers=2):
        return self.process_all('comprehensive', max_workers)

    def process_mathematics(self, max_workers=2):
        return self.process_all('mathematics', max_workers)

    def process_all_subjects(self, max_workers=2):
        comprehensive = self.process_comprehensive(max_workers)
        mathematics = self.process_mathematics(max_workers)
        self.build_knowledge_graph_seed()
        return {'comprehensive': comprehensive, 'mathematics': mathematics}

    def build_knowledge_graph_seed(self):
        from .knowledge_graph_builder import KnowledgeGraphBuilder
        os.makedirs(KNOWLEDGE_GRAPH_DIR, exist_ok=True)
        builder = KnowledgeGraphBuilder()
        for exam in self.all_exams:
            builder.add_exam_data(
                exam.get('questions', []),
                exam.get('year', 0),
                exam.get('id', '')
            )
        builder.save()
