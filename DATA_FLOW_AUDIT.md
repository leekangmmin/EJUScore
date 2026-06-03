# DATA_FLOW_AUDIT

> Trust code + data only. Every claim below is grepped from `src/**` and verified against files on disk.
> Reproduce: `grep -rn "dataset/" src` · `scripts/audit-postmigration/verify.mjs`.

## Two distinct load mechanisms (evidence)

1. **Runtime `fetch`** — `src/intelligence/engineInitializer.js` `DATASET_PATHS` fetch `./dataset/...`,
   which at run time resolves to **`public/dataset/**`** (Vite serves `public/` at web root).
2. **Build-time static `import`** — `src/components/TrendDashboardData.js` does
   `import … from '../../dataset/…json'`, bundling **root `dataset/**`** into the JS at build time.

So the app reads from **both** `public/dataset/**` (fetched) and root `dataset/**` (bundled). Public/root
parity was verified equal for the repaired files (`verify.mjs → public_root_parity: all true`).

## Datasets actually consumed by the production app

| dataset file | consumed by | mechanism | repaired? | had the defects? |
|---|---|---|---|---|
| `gold_standard/gold_standard.json` | engineInitializer + tagExtractor, similaritySearch, ejuProblemAnalyzer, learningPrioritizer, examIntelligenceEngineV2, explainableAI, questionRecommender | fetch | **YES** (artifacts nulled) | **YES** (had 321980 etc. → now max 38) |
| `trend-analysis/trend_analysis_complete.json` | engineInitializer + `TrendDashboardData.js` | fetch + import | **NO** | **NO** (verified: 0 `321980`, 0 `unknown`, 0 `review_required`) |
| `trend-analysis/trend_analysis_v2.json` | engineInitializer | fetch | NO | NO |
| `insights/insights_v2.json` | engineInitializer + `TrendDashboardData.js` | fetch + import | NO | NO |
| `prediction/prediction_2026.json`, `prediction_2026_2028.json` | engineInitializer (+ import) | fetch + import | NO | NO |
| `prediction/weakness_connector.json` | `TrendDashboardData.js`, `topicExpansionEngine.js`, `TrendDashboard.jsx` | import | NO | NO |
| `knowledge-graph/knowledge_graph_v3.json` | engineInitializer | fetch | NO | NO |
| `difficulty/difficulty_database.json`, `weakness_profile.json`, `study_plan.json` | engineInitializer | fetch | NO | NO |
| `comprehensive/**` (per-exam) | **admin only**: `dataAdapter.js`, `searchData.js` | fetch (public) | **YES** (367 numbers nulled, 396 domains) | **YES** (264 num==1, 47.1% unknown) |
| `mathematics/**` | **admin only**: `searchData.js` (via `search_manifest.json`) | fetch (public) | **YES** (schema unified) | partial (13 reduced files) |

## Repaired files that are truly used vs not

- **Repaired AND consumed at runtime:** `gold_standard.json` (engine + 7 analysis modules). ✅ real impact.
- **Repaired AND consumed by admin only:** `comprehensive/**`, `mathematics/**` (search/review screens). ✅ impact limited to admin features.
- **Repaired but DEAD (no `src` consumer):**
  - `comprehensive/dataset_consolidated.json` — `grep -rln consolidated src` → **none**.
  - `training/reclassified_ocr_data.json` — `grep -rln reclassified src` → **none**.
  These were modified by Phase 1/2 with **zero runtime/build effect** (harmless but wasted work).

## Dead datasets (on disk, not referenced by app code)

`dataset_consolidated.json`, `reclassified_ocr_data.json` (+ their public mirrors), and the various
`dataset/reports/*`, `dataset/_backup_*` are not imported/fetched by `src/**`.

## ⚠️ Discrepancy flagged

The migration context claimed it modified **`trend_analysis_complete.json`**. **Code+data say otherwise:**
that file is **not** in any repair script's target set and contains **no** artifacts / `unknown` /
`review_required` strings (verified). It was **never modified** — and never needed to be.

## Bottom-line impact of the repair on the user-facing app

The main analysis surfaces (TrendDashboard, predictions, insights, weakness) read **pre-aggregated**
`trend_analysis_*` / `insights_v2` / `prediction_*` / `weakness_connector` files that **never contained
the raw defects** and were **not touched**. Therefore the repair has **~no effect on the main analysis
dashboards**. Its real runtime effect is confined to: (a) `gold_standard.json` (the engine's
gold-standard lookups used by similarity/recommender/tag modules), and (b) the **admin** search/review
screens that read `comprehensive/**` + `mathematics/**`.
