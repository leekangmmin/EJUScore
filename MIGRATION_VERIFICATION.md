# MIGRATION_VERIFICATION

> Reports were **not** trusted. Every metric below was reproduced from data via
> `scripts/audit-postmigration/verify.mjs` (+ `scripts/audit-validation/reproduce.mjs`),
> diffing the pre-repair backup `dataset/_backup_repair_20260604_064459/` against current.

## Claims vs independently reproduced (current data)

| Claim | Reproduced | Verdict |
|---|---|---|
| artifacts (321980, 271929, …) removed | comprehensive `number>100` = **0**; gold_standard `max_qnum` = **38**; all-dataset `max_number` = **38** | ✅ CONFIRMED |
| `number==1` 264 → 28 | comprehensive `number==1` = **28** | ✅ CONFIRMED |
| math schemas unified | math `distinct_schemas` = **1**; records 646→646; `topic` preserved **646/646** | ✅ CONFIRMED |
| unknown → review_required | comprehensive `unknown` = **0**, `review_required` = **386** | ✅ CONFIRMED (but see flag #2) |
| 617/617 tests pass | independent `npx vitest run` → **61 files, 617 tests passed** | ✅ CONFIRMED |

## Accidental-corruption check (backup → current, field-by-field)

Matched comprehensive records by stable `id` (840 → 840, **no count change**):
- **modified keys:** `domain` ×396, `number` ×367 — **exactly the intended fields**.
- **added keys:** `flags`, `domain_confidence` — intended.
- **`unexpectedChanges: {}`** → **no other field altered, no record lost/added.** Clean.

gold_standard (1121 → 1121): only `question_number` modified, `unexpectedChanges: {}`. Clean.
math (646 → 646): record count preserved, `topic` values preserved 646/646. Clean.
public/root parity: gold_standard / comp / math mirrors **byte-identical** after repair. ✅

→ **No accidental corruption detected.**

## Discrepancies / flags (evidence-based)

1. **`trend_analysis_complete.json` was NOT modified** despite the context claiming it was. It contains
   no artifacts / unknown / review_required and is outside every repair script's scope. (See DATA_FLOW_AUDIT.)
2. **"unknown → review_required" is mostly relabeling, not recovery.** Of 396 unknown comprehensive
   records, only **10 truly recovered** to a real domain (confidence ≥ 0.8); **386 were relabeled**
   `review_required`. Effective domain coverage rose only **52.86% → 54.05% (+1.19pp)**.
   (Reproduced in `PHASE2_EFFECTIVENESS_REPORT.md`.)
3. **Phase 1 nulled 367 comprehensive numbers, not just the 26 artifacts.** Breakdown across all datasets:
   `duplicate_in_exam` 1210 · `four_plus_digits` 99 · `gt_100` 9 · `out_of_range` 22. The duplicates are
   legitimate fallback collisions; this is correct but larger than the headline "artifacts removed" implies.
4. **Two repaired datasets are dead** (`dataset_consolidated.json`, `reclassified_ocr_data.json`): modified
   but referenced by no `src` code → the repair effort there has zero runtime effect.
5. **Runtime blast radius is small:** only `gold_standard.json` (engine) and admin-only `comprehensive`/
   `mathematics` are both repaired-and-consumed; the main dashboards read untouched aggregate files.

## Conclusion

The repair did what it claimed for question-number integrity, math schema, and test status, **with no
data corruption**. Two caveats materially qualify the headline: the domain "fix" is 97.5% relabeling
(not classification), and the most-consumed analysis files were never affected (so user-visible analysis
is largely unchanged). One claim (trend_analysis_complete modified) is **false**.
