#!/usr/bin/env python3
"""
EJU Intelligence Platform - Dataset Construction Pipeline
Main entry point for processing all EJU exam PDFs.

Usage:
    python run_pipeline.py                      # Process all subjects
    python run_pipeline.py --subject comprehensive  # Only comprehensive
    python run_pipeline.py --subject mathematics    # Only mathematics
    python run_pipeline.py --workers 4              # Use 4 parallel workers
"""
import os
import sys
import argparse
import time

# Ensure pipeline package is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipeline.orchestrator import EJUPipeline
from pipeline.knowledge_graph_builder import KnowledgeGraphBuilder


def main():
    parser = argparse.ArgumentParser(
        description='EJU Intelligence Platform - Dataset Construction Pipeline'
    )
    parser.add_argument(
        '--subject', type=str, choices=['comprehensive', 'mathematics', 'all'],
        default='all',
        help='Subject to process (default: all)'
    )
    parser.add_argument(
        '--workers', type=int, default=2,
        help='Number of parallel workers (default: 2)'
    )
    parser.add_argument(
        '--single', type=str, default=None,
        help='Process a single PDF file path (for testing)'
    )

    args = parser.parse_args()

    print(r"""
    ╔═══════════════════════════════════════════════════════════════╗
    ║          EJU INTELLIGENCE PLATFORM                           ║
    ║          Dataset Construction Pipeline v1.0                   ║
    ╚═══════════════════════════════════════════════════════════════╝
    """)

    pipeline = EJUPipeline()
    start_time = time.time()

    if args.single:
        # Process a single PDF file
        print(f"\nProcessing single PDF: {args.single}")
        from pipeline.pdf_loader import get_year_from_filename

        subject = 'comprehensive' if '종합' in args.single or '文综' in args.single else 'mathematics'
        year = get_year_from_filename(args.single)

        pdf_info = {
            'filename': os.path.basename(args.single),
            'path': args.single,
            'subject': subject,
            'year': year or 2024,
            'round': 1,
        }

        result = pipeline.process_single_exam(pdf_info)
        if result:
            print(f"\n  ✓ Successfully processed: {result.get('total_questions', 0)} questions")
            dataset = pipeline.build_dataset([result], subject)
            pipeline.save_dataset(dataset, subject)
            pipeline.save_validation_reports([result])
            
            # Build mini knowledge graph
            builder = KnowledgeGraphBuilder()
            builder.add_exam_data(result.get('questions', []), result.get('year', 0), result.get('id', ''))
            builder.save()

    else:
        # Process all exams
        if args.subject == 'all':
            results = pipeline.process_all_subjects(max_workers=args.workers)
        else:
            pipeline.process_all(args.subject, max_workers=args.workers)

        # Build comprehensive knowledge graph
        print("\nBuilding comprehensive knowledge graph...")
        builder = KnowledgeGraphBuilder()
        for exam in pipeline.all_exams:
            builder.add_exam_data(
                exam.get('questions', []),
                exam.get('year', 0),
                exam.get('id', '')
            )
        builder.save()

        # Save final summary
        print("\n" + "="*70)
        print("  FINAL SUMMARY")
        print("="*70)
        total_questions = sum(e.get('total_questions', 0) for e in pipeline.all_exams)
        total_exams = len(pipeline.all_exams)
        elapsed = time.time() - start_time

        print(f"  Total exams processed:     {total_exams}")
        print(f"  Total questions extracted: {total_questions}")
        print(f"  Total time:                {elapsed:.1f}s")
        print(f"  Average per exam:          {elapsed/max(total_exams,1):.1f}s")
        print(f"\n  Dataset output:            dataset/")
        print(f"  - Comprehensive:           dataset/comprehensive/")
        print(f"  - Mathematics:             dataset/mathematics/")
        print(f"  - Topic frequencies:       dataset/topic-frequency/")
        print(f"  - Trend analysis:          dataset/trend-analysis/")
        print(f"  - Knowledge graph:         dataset/knowledge-graph/")
        print(f"  - Validation reports:      dataset/reports/")
        print(f"\n  Low confidence items:      {pipeline.validator.get_summary().get('low_confidence_items', 0)}")
        print("="*70 + "\n")


if __name__ == '__main__':
    main()
