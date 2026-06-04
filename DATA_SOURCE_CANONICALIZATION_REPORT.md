# Data Source Canonicalization Report

**Date:** 2026-06-04  
**Author:** Automated canonicalization  
**Status:** ✅ Complete

---

## 1. Canonical Corpus Selection

| Attribute | Value |
|-----------|-------|
| **Canonical source** | `scripts/eju-parser/out/parsed_questions.json` |
| **Runtime path** | `public/dataset/canonical/parsed_questions.json` |
| **Build path** | `dataset/canonical/parsed_questions.json` |
| **Generator** | eju-parser (TypeScript) |
| **Schema** | `scripts/eju-parser/out/schema/parsed_question.schema.json` |
| **Total questions** | 1,588 (382 japanese + 1,043 comprehensive + 163 mathematics) |
| **Generated at** | 2026-06-03T21:28:56.135Z |

### Schema

```typescript
{
  generatedAt: string;          // ISO timestamp
  totalQuestions: number;       // Count of all questions
  questions: Array<{
    id: string;                 // Unique identifier (e.g. "comprehensive_2006_r1#問2@0")
    examId: string;             // e.g. "comprehensive_2006_r1"
    subject: string;            // "japanese" | "comprehensive" | "mathematics"
    year: number;
    round: number;
    questionNumber: number;
    body: string;               // Question text (OCR-extracted)
    subQuestions: Array<any>;   // Sub-questions (if any)
    choices: Array<string>;     // Answer choices
    answer: string;             // Correct answer (1-indexed)
    answerStatus: string;       // "linked" | "unlinked"
    sourceFile: string;         // Original PDF path
    ocrSuspect: boolean;        // OCR quality flag
    ocrSuspectReasons: Array<string>;
  }>;
}
```

---

## 2. Deprecated Sources

### ❌ `dataset/comprehensive/` (all per-exam OCR files)

| Path | Replacement |
|------|-------------|
| `dataset/comprehensive/**/exam_*.json` | `dataset/canonical/parsed_questions.json` |
| `dataset/comprehensive/dataset_consolidated.json` | `dataset/canonical/parsed_questions.json` |
| `dataset/comprehensive/master_dataset.json` | `dataset/canonical/parsed_questions.json` |

### ❌ `dataset/mathematics/` (all per-exam math files)

| Path | Replacement |
|------|-------------|
| `dataset/mathematics/**/exam_*.json` | `dataset/canonical/parsed_questions.json` |
| `dataset/mathematics/dataset_consolidated.json` | `dataset/canonical/parsed_questions.json` |

### ❌ `dataset/gold_standard/`

| Path | Replacement |
|------|-------------|
| `dataset/gold_standard/gold_standard.json` | `dataset/canonical/parsed_questions.json` |
| `dataset/gold_standard/math_gold_standard.json` | `dataset/canonical/parsed_questions.json` |

### ❌ `public/dataset/search_manifest.json`

| Path | Replacement |
|------|-------------|
| `public/dataset/search_manifest.json` | Inline subject filtering of canonical corpus |

### ✅ Allowed (analysis outputs — not primary question corpus)

| Path | Purpose |
|------|---------|
| `dataset/canonical/parsed_questions.json` | ⬅ **CANONICAL — single source of truth** |
| `dataset/trend-analysis/**` | Trend analysis computed from canonical corpus |
| `dataset/prediction/**` | Prediction models derived from canonical corpus |
| `dataset/difficulty/**` | Difficulty metrics computed from canonical corpus |
| `dataset/knowledge-graph/**` | Knowledge graph built from canonical corpus |
| `dataset/insights/**` | Insights derived from canonical corpus |
| `dataset/topic-frequency/**` | Topic frequency analysis |
| `dataset/training/**` | Training data for classifier (deprecated but not blocked) |
| `dataset/reports/**` | Validation reports |
| `study_plan.json` | Study plan |
| `weakness_profile.json` | Weakness profile |

---

## 3. Files Modified

| File | Change |
|------|--------|
| `src/intelligence/engineInitializer.js` | 🔄 Rewritten: single canonical source, removed all 10 legacy dataset paths, removed localStorage fallback, added `getParsedQuestions()` accessor |
| `src/admin/lib/dataAdapter.js` | 🔄 Rewritten: loads from canonical corpus instead of per-exam files; normalizes parsed_questions schema to match existing adapter API |
| `src/admin/lib/searchData.js` | 🔄 Rewritten: loads from canonical corpus instead of search_manifest.json; filters by subject inline |
| `vite.config.js` | 🔄 Added `canonicalSourcePlugin()` — build-time enforcer that blocks imports from deprecated dataset paths |
| `dataset/comprehensive/_DEPRECATED_README.md` | 🆕 Deprecation notice for comprehensive legacy files |
| `dataset/mathematics/_DEPRECATED_README.md` | 🆕 Deprecation notice for mathematics legacy files |
| `dataset/gold_standard/_DEPRECATED_README.md` | 📝 Updated to point to canonical corpus |
| `dataset/canonical/parsed_questions.json` | 🆕 Symlink to canonical corpus |

## 4. Files NOT Modified (Preserved)

| File | Reason |
|------|--------|
| `src/intelligence/examIntelligenceEngineV2.js` | Intelligence engine — keeps `loadDatasets()` with deprecation warning; not a "runtime source" loader |
| `src/components/TrendDashboardData.js` | Statically imports secondary analysis datasets (trend-analysis, prediction) — these are analysis outputs, not primary question sources |
| `src/components/TrendDashboard.jsx` | Uses `PAST_EXAM_BANK` for UI display — changing would change UI (prohibited) |
| `src/components/ExamIntelligenceCenter.jsx` | Uses `getDatasetCache()` — works with canonical cache |
| `src/components/AICoach.jsx` | Uses `getDatasetCache()` — works with canonical cache |
| `src/admin/lib/personalAccuracy.js` | Uses `getDatasetCache()` — works with canonical cache |
| `src/data/ejuPastExamBank.js` | Hardcoded analysis data — not a fallback loader; changing would change UI |
| `pipeline/` | Pipeline scripts — out of scope (per "DO NOT change pipeline") |
| `scripts/` | Build/generation scripts — out of scope |

---

## 5. Dependency Graph of Dataset Consumers

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CANONICAL CORPUS                           │
│           dataset/canonical/parsed_questions.json                   │
│           (1,588 questions / 3 subjects)                            │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ fetch() at runtime
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    engineInitializer.js                             │
│  - initializeEngine() fetches canonical corpus                     │
│  - getDatasetCache() → { parsedQuestions, ... }                    │
│  - getParsedQuestions() → questions[]                              │
└────┬──────────────────────┬──────────────────┬──────────────────────┘
     │                      │                  │
     ▼                      ▼                  ▼
┌──────────┐    ┌──────────────────┐   ┌─────────────────────┐
│ main.jsx │    │ dataAdapter.js   │   │ searchData.js       │
│ (app     │    │ (admin corpus    │   │ (admin search)      │
│  boot)   │    │  stats, loading) │   │  → loadSubject()    │
└──────────┘    └──────────────────┘   └─────────────────────┘
                                                      
     ▼                      ▼                  ▼
┌──────────────────┐  ┌──────────────┐   ┌──────────────┐
│ ExamIntelligence │  │ AICoach.jsx  │   │ TrendDashboard│
│ Center.jsx       │  │ (uses       │   │ .jsx          │
│ (uses            │  │  getDataset │   │ (uses PAST_EX │
│  getDatasetCache)│  │  Cache())   │   │ AM_BANK +     │
└──────────────────┘  └──────────────┘   │ getDataset    │
                                         │ Cache())      │
     ▼                      ▼            └──────────────┘
┌──────────────────┐                      
│ personalAccuracy │  ┌──────────────────┐
│ .js (admin)      │  │ admin pages:     │
│ (uses            │  │ Dashboard,       │
│  getDatasetCache)│  │ Datasets,        │
└──────────────────┘  │ OcrReview,       │
                      │ QuestionReview,  │
                      │ Search, Vector,  │
                      │ Uploads          │
                      └──────────────────┘

─── Secondary analysis datasets (NOT blocked, NOT canonical) ───

dataset/trend-analysis/trend_analysis_complete.json
dataset/prediction/prediction_2026_2028.json
dataset/prediction/weakness_connector.json
dataset/insights/insights_v2.json
    │
    ▼
TrendDashboardData.js → TrendDashboard.jsx, ExamIntelligenceCenter.jsx
```

---

## 6. Build-Time Enforcement

A Vite plugin (`canonicalSourcePlugin`) is registered in `vite.config.js`. It intercepts all module resolution and throws a build error for any import matching these patterns:

| Pattern | Blocked Examples |
|---------|------------------|
| `dataset/comprehensive/` (canonical excluded) | `comprehensive/2002/exam_*.json` |
| `dataset/mathematics/` | `mathematics/2005/exam_*.json` |
| `dataset/gold_standard/` | `gold_standard/gold_standard.json` |
| `dataset_consolidated.json` | Any `dataset_consolidated.json` |
| `master_dataset.json` | Any `master_dataset.json` |

**Error message format:**
```
[CANONICAL-SOURCE-ENFORCER] BLOCKED: "dataset/comprehensive/..." (imported by ...)
  ────────────────────────────────────────────
  🚫 DEPRECATED SOURCE: dataset/comprehensive/...
  ────────────────────────────────────────────
  Canonical source: ./dataset/canonical/parsed_questions.json
  Use fetch('dataset/canonical/parsed_questions.json') instead.
```

---

## 7. Verification

### Source coverage

```
scripts/eju-parser/out/parsed_questions.json  →  1,588 questions  ✅
├── japanese:       382 questions  (24.1%)
├── comprehensive:  1,043 questions  (65.7%)
└── mathematics:    163 questions  (10.3%)
```

### Runtime loading

```javascript
// ✅ Correct way to load dataset at runtime:
import { initializeEngine, getParsedQuestions } from './intelligence/engineInitializer';
await initializeEngine();
const questions = getParsedQuestions(); // Array of 1,588 questions

// ✅ Correct way for admin pages:
import { loadAll, loadExam } from '../lib/dataAdapter';
const { exams, questions } = await loadAll();

// ❌ DO NOT use:
// fetch('dataset/comprehensive/...')
// fetch('dataset/gold_standard/gold_standard.json')
// import data from '../../dataset/comprehensive/dataset_consolidated.json'
```

---

## 8. Broken Imports Fixed

| Import (old) | File | Resolution |
|--------------|------|------------|
| `fetch('dataset/comprehensive/...')` | `admin/lib/dataAdapter.js` | 🔄 Rewrote to load from `dataset/canonical/parsed_questions.json` |
| `fetch('dataset/search_manifest.json')` | `admin/lib/searchData.js` | 🔄 Rewrote to load from `dataset/canonical/parsed_questions.json` |
| Static import of `dataset/comprehensive/**/*.json` | — | 🛑 Blocked by Vite plugin at build time |
| Static import of `dataset/gold_standard/**` | — | 🛑 Blocked by Vite plugin at build time |
| Static import of `dataset_consolidated.json` | — | 🛑 Blocked by Vite plugin at build time |

**No broken imports found in runtime code.** All existing static dataset imports are for secondary analysis data (trend-analysis, prediction) which are allowed.

---

## 9. Risks & Follow-Up

| Risk | Mitigation | Status |
|------|------------|--------|
| Components using `getDataset('goldStandard')` get `null` | Intelligence engine handles null gracefully | ✅ Acceptable |
| Old test files mock old dataset paths | Tests use `setDatasets()` mock — not affected | ✅ |
| `examIntelligenceEngineV2.loadDatasets()` returns empty | Deprecated — will be removed in next major | ⚠️ Documented |
| `data/ejuPastExamBank.js` still has hardcoded data | Only used by TrendDashboard UI — changing = UI change | ⚠️ Out of scope |

### Recommended next steps

1. Remove `public/dataset/comprehensive/`, `public/dataset/mathematics/`, `public/dataset/gold_standard/` from deployment after verifying canonical corpus covers all use cases
2. Remove `examIntelligenceEngineV2.loadDatasets()` and `persistDatasets()` in next major release
3. Consider replacing `data/ejuPastExamBank.js` with a dynamic loader from canonical corpus (when UI is ready for refactor)
4. Remove backup directories (`dataset/_backup_*`) after verifying no rollback needed
