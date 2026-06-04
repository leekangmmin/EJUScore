# Legacy Artifacts — v1.1.0 Migration

These files are retained for historical reference but are NOT part of the build pipeline.

## Python scripts (moved from project root)

- `classifier_v1_2.py` — Python domain classifier (replaced by JS bake-domains.mjs)
- `audit_system.py` — System audit utility
- `integrity_check.py` — Data integrity checker
- `ocr_quality_auditor.py` — OCR quality auditor
- `run_batch.py` / `run_pipeline.py` — Pipeline runners
- `utils_consolidate.py` — Data consolidation utility

## Python scripts (moved from scripts/)

- `reclassify_comprehensive.py`, `build_*.py`, `step*_*.py`, `trend_analysis_v2.py`
- `generate_screenshots.py`

## Classification outputs

- `evaluation_report_v1_2.json` — Classifier v1.2 evaluation report
- `checkpoint.json` — Pipeline checkpoint
- `ocr_quality_report.json` — OCR quality report
- `REOCR_PRIORITY_LIST.json` — Re-OCR priority list
