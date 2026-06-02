#!/usr/bin/env python3
"""
EJU Batch Processing Script
Processes all exams sequentially with checkpointing.
Saves results after each exam to avoid data loss.
"""
import sys, os, time, json, traceback
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipeline.orchestrator import EJUPipeline
from pipeline.pdf_loader import discover_pdfs
from pipeline.pipeline_config import (
    COMPREHENSIVE_OUTPUT, MATHEMATICS_OUTPUT, REPORTS_DIR,
    TREND_ANALYSIS_DIR, TOPIC_FREQUENCY_DIR, KNOWLEDGE_GRAPH_DIR
)
from pipeline.knowledge_graph_builder import KnowledgeGraphBuilder

CHECKPOINT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'checkpoint.json')


def load_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, 'r') as f:
            return json.load(f)
    return {'completed_files': []}


def save_checkpoint(completed_files):
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump({'completed_files': completed_files}, f)


def process_subject(subject_type, max_workers=1):
    """Process all exams for a subject with checkpointing."""
    print(f"\n{'='*60}")
    print(f"  Processing {subject_type.upper()} exams")
    print(f"{'='*60}")

    pipeline = EJUPipeline()
    checkpoint = load_checkpoint()
    completed = set(checkpoint.get('completed_files', []))

    pdfs = discover_pdfs(subject_type)
    print(f"  Total PDFs: {len(pdfs)}")
    print(f"  Already completed: {len(completed)}")

    # Filter out already completed PDFs
    to_process = [p for p in pdfs if p['path'] not in completed]
    print(f"  Remaining: {len(to_process)}")

    if not to_process:
        print("  All exams already processed!")
        return

    all_results = []
    start_time = time.time()

    for i, pdf_info in enumerate(to_process):
        exam_start = time.time()
        print(f"\n  [{i+1}/{len(to_process)}] {pdf_info['filename']}")

        try:
            result = pipeline.process_single_exam(pdf_info)

            if result and result.get('total_questions', 0) > 0:
                all_results.append(result)
                completed.add(pdf_info['path'])
                save_checkpoint(list(completed))

                elapsed = time.time() - exam_start
                print(f"    ✓ {result['total_questions']} questions ({elapsed:.0f}s)")

                # Save individual exam result
                output_dir = COMPREHENSIVE_OUTPUT if subject_type == 'comprehensive' else MATHEMATICS_OUTPUT
                year = result.get('year', 'unknown')
                year_dir = os.path.join(output_dir, str(year))
                os.makedirs(year_dir, exist_ok=True)
                fname = f"exam_{year}_r{result.get('round', 1)}.json"
                with open(os.path.join(year_dir, fname), 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False, indent=2)
                print(f"    Saved: {year}/{fname}")
            else:
                print(f"    ✗ No questions extracted (exam may be corrupted or non-standard)")

        except Exception as e:
            print(f"    ✗ Error: {e}")
            traceback.print_exc()

        # Add to pipeline's all_exams for trend analysis
        for r in all_results:
            if r not in pipeline.all_exams:
                pipeline.all_exams.append(r)

    # After all exams done, run post-processing
    if all_results:
        print(f"\n{'='*60}")
        print(f"  Post-processing {subject_type} dataset")
        print(f"{'='*60}")

        # Build dataset
        dataset = pipeline.build_dataset(all_results, subject_type)

        # Trend analysis
        print("\n  Running trend analysis...")
        for exam in all_results:
            pipeline.trend_analyzer.process_exam(
                exam.get('questions', []), exam.get('year', 0)
            )
        pipeline.trend_analyzer.save_all()
        print("  Trend analysis saved.")

        # Validation reports
        print("\n  Generating validation reports...")
        pipeline.save_validation_reports(all_results)
        print("  Validation reports saved.")

        # Statistics
        print("\n  Generating statistics...")
        stats = pipeline.generate_statistics(all_results)
        pipeline.save_statistics(stats, subject_type)
        print("  Statistics saved.")

        # Consolidated dataset
        consolidated_path = os.path.join(
            COMPREHENSIVE_OUTPUT if subject_type == 'comprehensive' else MATHEMATICS_OUTPUT,
            'dataset_consolidated.json'
        )
        consolidated = {
            'dataset_name': f'EJU {subject_type.title()} Exam Dataset',
            'subject': subject_type, 'version': '1.0.0',
            'generated_at': datetime.now().isoformat(),
            'total_exams': len(all_results),
            'total_questions': stats['total_questions'],
            'year_range': {
                'start': stats['year_coverage'][0] if stats['year_coverage'] else 0,
                'end': stats['year_coverage'][-1] if stats['year_coverage'] else 0,
            },
            'statistics': stats,
            'exams': []
        }
        for exam in all_results:
            consolidated['exams'].append({
                'id': exam.get('id'), 'source_file': exam.get('source_file'),
                'year': exam.get('year'), 'round': exam.get('round'),
                'total_questions': exam.get('total_questions'),
                'total_pages': exam.get('total_pages'),
                'confidence_average': exam.get('metadata', {}).get('confidence_average', 0),
                'domain_distribution': {},
            })
        with open(consolidated_path, 'w', encoding='utf-8') as f:
            json.dump(consolidated, f, ensure_ascii=False, indent=2)
        print(f"  Consolidated dataset saved.")

        elapsed = time.time() - start_time
        print(f"\n  Total time: {elapsed:.0f}s ({elapsed/60:.1f}m)")
        print(f"  Exams: {len(all_results)}")
        print(f"  Questions: {stats['total_questions']}")

    return all_results


def main():
    import argparse
    parser = argparse.ArgumentParser(description='EJU Batch Processing')
    parser.add_argument('--subject', choices=['comprehensive', 'mathematics', 'all'], default='all')
    parser.add_argument('--force-restart', action='store_true', help='Ignore checkpoint and restart')
    args = parser.parse_args()

    if args.force_restart and os.path.exists(CHECKPOINT_FILE):
        os.remove(CHECKPOINT_FILE)
        print("Checkpoint cleared. Starting fresh.")

    all_results = {}

    if args.subject in ('all', 'comprehensive'):
        all_results['comprehensive'] = process_subject('comprehensive')

    if args.subject in ('all', 'mathematics'):
        all_results['mathematics'] = process_subject('mathematics')

    # Build knowledge graph from all results
    print(f"\n{'='*60}")
    print("  Building Knowledge Graph")
    print(f"{'='*60}")

    builder = KnowledgeGraphBuilder()
    total_q = 0
    for subject, results in all_results.items():
        for exam in (results or []):
            builder.add_exam_data(exam.get('questions', []), exam.get('year', 0), exam.get('id', ''))
            total_q += len(exam.get('questions', []))
    builder.save()
    print(f"  Knowledge graph built from {total_q} questions")

    print(f"\n{'='*60}")
    print("  ALL DONE!")
    print(f"{'='*60}")
    print(f"  Results saved to: dataset/")
    print(f"  - Comprehensive:    dataset/comprehensive/")
    print(f"  - Mathematics:      dataset/mathematics/")
    print(f"  - Trend analysis:   dataset/trend-analysis/")
    print(f"  - Topic frequency:  dataset/topic-frequency/")
    print(f"  - Knowledge graph:  dataset/knowledge-graph/")
    print(f"  - Reports:          dataset/reports/")


if __name__ == '__main__':
    main()
