# DEPRECATED — Comprehensive Dataset Directory

**Reason**: Superseded by `dataset/canonical/parsed_questions.json` (canonical corpus from eju-parser)  
**Date**: 2026-06-04  
**Migration**: All exam questions are now served from the single canonical corpus at `scripts/eju-parser/out/parsed_questions.json`.

## What's deprecated

| Path | Status |
|------|--------|
| `dataset/comprehensive/**/exam_*.json` | ❌ Do not use — per-exam OCR files |
| `dataset/comprehensive/dataset_consolidated.json` | ❌ Do not use — superseded by canonical corpus |
| `dataset/comprehensive/master_dataset.json` | ❌ Do not use — superseded by canonical corpus |
| `public/dataset/comprehensive/**/*` | ❌ Do not serve — kept for archive only |

## Canonical source

```
dataset/canonical/parsed_questions.json        ← Build/runtime source
scripts/eju-parser/out/parsed_questions.json   ← Generator output
```

**Do not import or fetch any file under `dataset/comprehensive/` at runtime.**
