# DEPRECATED — Mathematics Dataset Directory

**Reason**: Superseded by `dataset/canonical/parsed_questions.json` (canonical corpus from eju-parser)  
**Date**: 2026-06-04  
**Migration**: All exam questions are now served from the single canonical corpus.

## What's deprecated

| Path | Status |
|------|--------|
| `dataset/mathematics/**/exam_*.json` | ❌ Do not use — per-exam OCR files |
| `dataset/mathematics/dataset_consolidated.json` | ❌ Do not use — superseded by canonical corpus |
| `public/dataset/mathematics/**/*` | ❌ Do not serve — kept for archive only |

## Canonical source

```
dataset/canonical/parsed_questions.json
```

**Do not import or fetch any file under `dataset/mathematics/` at runtime.**
