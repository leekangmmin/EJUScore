#!/usr/bin/env python3
"""
EJU Intelligence Platform - Dataset Consolidation
Combines all processed JSON files and generates trend analysis & knowledge graph.
"""
import sys, os, json, time
from datetime import datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Suppress numpy warnings
import warnings
warnings.filterwarnings('ignore')

from pipeline.pipeline_config import (
    COMPREHENSIVE_OUTPUT, MATHEMATICS_OUTPUT, REPORTS_DIR,
    TREND_ANALYSIS_DIR, TOPIC_FREQUENCY_DIR, KNOWLEDGE_GRAPH_DIR
)
from pipeline.trend_analysis import TrendAnalyzer
from pipeline.knowledge_graph_builder import KnowledgeGraphBuilder
from pipeline.validator import Validator


def load_all_exams(subject_type):
    """Load all processed exam JSON files."""
    output_dir = COMPREHENSIVE_OUTPUT if subject_type == 'comprehensive' else MATHEMATICS_OUTPUT
    exams = []

    if not os.path.exists(output_dir):
        return exams

    for root, dirs, files in os.walk(output_dir):
        for f in files:
            if f.endswith('.json') and f not in ('master_dataset.json', 'dataset_consolidated.json'):
                filepath = os.path.join(root, f)
                try:
                    with open(filepath, 'r', encoding='utf-8') as fh:
                        exam = json.load(fh)
                    if exam.get('questions'):
                        exams.append(exam)
                except Exception as e:
                    print(f"  Error loading {filepath}: {e}")

    # Sort by year
    exams.sort(key=lambda x: (x.get('year', 0), x.get('round', 1)))
    return exams


def consolidate():
    """Consolidate all exam data and generate outputs."""
    print("=" * 70)
    print("  EJU DATASET CONSOLIDATION & ANALYSIS")
    print("=" * 70)

    # Load all comprehensive exams
    comp_exams = load_all_exams('comprehensive')
    math_exams = load_all_exams('mathematics')

    print(f"\n  Comprehensive exams: {len(comp_exams)}")
    print(f"  Mathematics exams:   {len(math_exams)}")

    all_exams = comp_exams + math_exams

    if not all_exams:
        print("  No exams found!")
        return

    total_questions = sum(e.get('total_questions', 0) or len(e.get('questions', [])) for e in all_exams)
    print(f"  Total questions:     {total_questions}")

    # Build trend analysis
    print("\n[1/3] Building trend analysis...")
    analyzer = TrendAnalyzer()
    for exam in all_exams:
        analyzer.process_exam(exam.get('questions', []), exam.get('year', 0))
    trend_paths = analyzer.save_all()
    print(f"  Topic frequency:     {trend_paths.get('topic_frequency')}")
    print(f"  Domain frequency:    {trend_paths.get('domain_frequency')}")
    print(f"  Trend analysis:      {trend_paths.get('trend_analysis')}")

    # Build knowledge graph
    print("\n[2/3] Building knowledge graph...")
    builder = KnowledgeGraphBuilder()
    for exam in all_exams:
        builder.add_exam_data(exam.get('questions', []), exam.get('year', 0), exam.get('id', ''))
    builder.save()

    # Validation
    print("\n[3/3] Generating validation reports...")
    validator = Validator()
    for exam in all_exams:
        validator.validate_exam(exam)
    validator.generate_low_confidence_report(REPORTS_DIR)

    # Dataset validation
    dataset_report = validator.validate_dataset({'exams': all_exams})
    report_path = os.path.join(REPORTS_DIR, 'dataset_validation.json')
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(dataset_report, f, ensure_ascii=False, indent=2)

    # Statistics
    total_confidences = []
    domain_dist = {}
    year_dist = {}
    diff_dist = {}
    type_dist = {}

    for exam in all_exams:
        for q in exam.get('questions', []):
            conf = q.get('ocr_confidence', 0)
            if conf: total_confidences.append(conf)
            d = q.get('domain', 'unknown')
            domain_dist[d] = domain_dist.get(d, 0) + 1
            y = str(q.get('year', 0))
            year_dist[y] = year_dist.get(y, 0) + 1
            di = str(q.get('difficulty', 0))
            diff_dist[di] = diff_dist.get(di, 0) + 1
            qt = q.get('question_type', 'unknown')
            type_dist[qt] = type_dist.get(qt, 0) + 1

    avg_conf = round(sum(total_confidences) / len(total_confidences), 4) if total_confidences else 0

    stats = {
        'total_exams': len(all_exams),
        'total_questions': total_questions,
        'average_confidence': avg_conf,
        'domain_distribution': domain_dist,
        'year_distribution': year_dist,
        'difficulty_distribution': diff_dist,
        'question_type_distribution': type_dist,
        'validation': {
            'passed': sum(1 for r in validator.validation_results if r['validation'] == 'PASS'),
            'warned': sum(1 for r in validator.validation_results if r['validation'] == 'WARN'),
            'failed': sum(1 for r in validator.validation_results if r['validation'] == 'FAIL'),
            'low_confidence_items': validator.get_summary().get('low_confidence_items', 0),
        }
    }

    stats_path = os.path.join(REPORTS_DIR, 'dataset_statistics.json')
    with open(stats_path, 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print(f"\n  Dataset statistics: {stats_path}")

    # Summary
    print(f"\n{'=' * 70}")
    print(f"  FINAL DATASET SUMMARY")
    print(f"{'=' * 70}")
    print(f"  Total exams:             {stats['total_exams']}")
    print(f"  Total questions:         {stats['total_questions']}")
    print(f"  Average confidence:      {stats['average_confidence']}")
    print(f"\n  Domain distribution:")
    for domain, count in sorted(domain_dist.items(), key=lambda x: -x[1]):
        print(f"    {domain:20s}: {count}")
    print(f"\n  Validation:")
    print(f"    Passed:  {stats['validation']['passed']}")
    print(f"    Warned:  {stats['validation']['warned']}")
    print(f"    Failed:  {stats['validation']['failed']}")
    print(f"    Low confidence: {stats['validation']['low_confidence_items']}")
    print(f"{'=' * 70}\n")


if __name__ == '__main__':
    consolidate()
