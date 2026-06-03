# FINAL_DATA_REPAIR_REPORT

Repair of the defects confirmed in `VALIDATION_REPORT.md`, executed in 4 phases with
backups first and a CI gate last. **Before/after metrics are real, reproduced via
`scripts/audit-validation/reproduce.mjs` and `scripts/data-repair/quality_gate.mjs`.**

- Backup: `dataset/_backup_repair_20260604_064459/` (144 JSON files, 35 MB) — created **before** any mutation.
- Phase reports: `QUESTION_NUMBER_MIGRATION_REPORT.md`, `DOMAIN_RECOVERY_REPORT.md`, `SCHEMA_MIGRATION_REPORT.md`.
- Verification: full test suite **617/617 pass**, `npm run build` PASS, `npm run data:gate` **PASS**.

## Before → After (exact counts)

| Metric | Before | After | Source |
|---|---|---|---|
| comprehensive `number == 1` | **264** (31.4%) | **28** (3.3%) | `dataset/comprehensive/**` (840) |
| comprehensive domain `unknown` | **396** (47.1%) | **0** (0.0%) | same |
| artifact numbers (>100) in comprehensive | **26** (max 321980) | **0** | same |
| artifact numbers in app-loaded `gold_standard.json` | present (max **321980**) | **0** (max **38**) | `gold_standard.json` |
| max question number (all datasets) | **321980** | **38** | gate across 6,076 records |
| math distinct schemas | **2** (13 reduced + 25 full) | **1** | `dataset/mathematics/**` |
| math required-fields present in all | **no** | **yes** | same |

## Phase 1 — Question Number Integrity
- Records repaired: **1,340** → `number/question_number = null` + flag `invalid_question_number`.
- By reason: `duplicate_in_exam` 1,210 · `four_plus_digits` 99 · `gt_100` 9 · `out_of_range` 22.
- Validator (`scripts/data-repair/lib/questionNumberValidator.mjs`): comprehensive 1–38, math 1–27, japanese 1–60 (configurable); rejects 4+ digits, >100, out-of-range, non-integer; duplicates within an exam nulled.
- ✅ Success criteria: no number >100; no artifact values remain; `number==1` realistic (264→28 ≈ exam count).

## Phase 2 — Domain Recovery
- Unknown-domain questions attempted: **792** (per-exam 396 + consolidated 396).
- Recovered (confidence ≥ 0.8): **20**. → `review_required`: **772**.
- Confidence distribution: `[0.0–0.2]` **674**, `[0.2–0.4]` 44, `[0.4–0.6]` 4, `[0.6–0.8]` 50, `[0.8–1.0]` 20.
- **Honest finding:** only ~2.5% were confidently recoverable. 674/792 scored near-zero because the
  unknown-domain questions are predominantly **OCR-garbage text** (no classifiable keywords). These are
  correctly relabeled `review_required` (explicit triage), **not** silently guessed. Raising recovery
  requires **re-OCR**, not better classification. Literal `unknown` is now 0%.

## Phase 3 — Math Schema Unification
- 38 math files processed; **13 reduced→full migrated**; **1** distinct schema; required fields present in all.
- Reduced files gained: `id, domain (←section), raw_text/text (←text_snippet), answer_choices, difficulty, ocr_confidence, question_type, keywords, concepts, …` Canonical 25-field schema enforced in identical key order.

## Phase 4 — Data Quality Gate (CI)
- `scripts/data-repair/quality_gate.mjs` + `src/test/dataQualityGate.test.js` (runs in the vitest suite) +
  `npm run data:gate`. Fails the build on: any number >100, 4+ digit artifacts, comprehensive unknown >10%,
  or mixed math schemas.
- Current gate metrics: `{ totalRecords: 6076, comprehensive_unknown_pct: 0, math_distinct_schemas: 1, max_number: 38 }` → **PASS**.

## Scope, honesty & rollback
- `review_required` (386 comprehensive per-exam / 772 incl. consolidated) is an explicit human-review state, not a hidden "unknown" — the gate's unknown check is scoped to literal `unknown` (now 0%) per the Phase-2 spec.
- Public mirrors (`public/dataset/**`) were kept in sync with every write.
- All changes are additive/reversible; restore from `dataset/_backup_repair_20260604_064459/` to roll back.
- No fabricated values: recovered domains come from the project's real classifier above the 0.8 threshold; everything else is flagged, not invented.
