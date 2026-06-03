# REVIEW_REQUIRED_ANALYSIS

- Generated: 2026-06-03T22:52:51.872Z
- review_required records analyzed: **386** (dataset/comprehensive/**)

## Cluster by failure cause

| cause | count | est. recoverability | est. recoverable |
|---|---|---|---|
| classifier_gap | 262 | 0.05 | ~13 |
| missing_segmentation | 68 | 0.85 | ~58 |
| ocr_garbage | 27 | 0.65 | ~18 |
| image_only_content | 24 | 0.4 | ~10 |
| table_chart_extraction_failure | 5 | 0.45 | ~2 |
| **TOTAL** | **386** | — | **~100** |

## Recoverability estimate (honest)

- Of 386 review_required, **~100 (26%)** could plausibly be recovered by higher-quality **re-OCR** (engine/segmentation), per the per-cause assumptions above — **an estimate, not a guarantee**.
- ⚠️ **Key finding:** **262** records (**68%**) are `classifier_gap` — *clean, substantive text* that the keyword classifier failed to label (e.g. 桑畑/標準時/島国 not in the lexicon). **These are NOT OCR failures; re-OCR will not help them.** The real fix is a better classifier (expanded lexicon or LLM classification). They are deliberately given low re-OCR priority.

## Cause definitions

- **ocr_garbage**: broken-char ratio > 0.30, meaningful ratio < 0.55, or repeated-noise runs (バーバー/ーーー)
- **missing_segmentation**: text < 30 chars — a header/instruction fragment, not a full question
- **image_only_content**: text < 8 chars but a table/diagram/graph/map is present (content is in the image)
- **table_chart_extraction_failure**: material present + references 表/グラフ/図 but short/unusable text
- **mathematical_formula_loss**: formula tokens present but garbled
- **classifier_gap**: clean substantive text the keyword classifier could not label — **not an OCR problem**

## Top 15 re-OCR candidates (see REOCR_PRIORITY_LIST.json for full ranked list)

| priority | cause | year/round | quality | text preview |
|---|---|---|---|---|
| 0.68 | missing_segmentation | 2002/1 | 0.82 | 1 つ選びなさい。 33) |
| 0.68 | missing_segmentation | 2002/1 | 1 | 平成 14 年度 |
| 0.68 | missing_segmentation | 2002/2 | 1 | 平成 14 年度 |
| 0.68 | missing_segmentation | 2002/2 | 0.89 | 4. BARRO Te  |
| 0.68 | missing_segmentation | 2002/2 | 1 | 平成 14 年度 |
| 0.68 | missing_segmentation | 2003/1 | 1 | 平成 15 年度 |
| 0.68 | missing_segmentation | 2003/1 | 1 | 平成 15 年度 |
| 0.68 | missing_segmentation | 2003/2 | 1 | 平成 15 年度 |
| 0.68 | missing_segmentation | 2003/2 | 1 | 平成 15 年度 |
| 0.68 | missing_segmentation | 2003/2 | 0.86 | 2. 話しことば  |
| 0.68 | missing_segmentation | 2003/2 | 0.83 | 3) Suge     |
| 0.68 | missing_segmentation | 2003/2 | 1 | 平成 15 年度 |
| 0.68 | missing_segmentation | 2004/1 | 1 | 平成 16 年度 |
| 0.68 | missing_segmentation | 2004/1 | 1 | 平成 16 年度 |
| 0.68 | missing_segmentation | 2004/1 | 1 | 平成 16 年度 |