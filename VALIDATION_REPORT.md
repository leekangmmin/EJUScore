# VALIDATION_REPORT — DeepSeek OCR Audit, Independent Verification

> **Stance:** the audit report was **not** trusted. Every claim was reproduced against
> the real data. Source of truth: `~/Desktop/eju-test/ocr_output.json` (296 PDFs) and the
> generated pipeline outputs under `dataset/**`.
> **Reproduction script:** [`scripts/audit-validation/reproduce.mjs`](scripts/audit-validation/reproduce.mjs)
> → `node scripts/audit-validation/reproduce.mjs` (JSON output, deterministic).
> **No fixes were implemented.** Validation only.

## 0. Which dataset does each claim refer to? (critical)

The audit's fields (`question_number`, artifacts `321980`) do **not** exist in the flat
`ocr_output.json` (`[{file,text}]` only). They live in the **structured per-exam dataset**
`dataset/comprehensive/**` (field `number`, n=**840**) and its downstream products
(`consolidated` 1448, `gold_standard` 1121, `reclassified` 702). Claims were therefore
verified against each, and the matching source is named per finding.

| layer | n | number==1 | domain unknown | max number |
|---|---|---|---|---|
| `dataset/comprehensive/**` (raw per-exam) | 840 | **264 (31.4%)** | **47.1%** | 321980 |
| `gold_standard.json` (app-loaded) | 1121 | 58 (5.2%) | 0.0% | 321980 |
| `reclassified ocr_questions` | 702 | 179 (25.5%) | 0.3% | 321980 |

The app (`src/intelligence/engineInitializer.js`) loads **`gold_standard.json`** — verified to
**still contain** `321980`/`271929`, while `trend_analysis_complete.json` does not.

---

## 1. ✅ Confirmed findings

### F1 — Total PDFs = 296 — **CONFIRMED**
`ocr_output.json` has exactly **296** entries (`[{file,text}]`). *Caveat:* this is a **separate,
newer OCR corpus**; the audit's question-level findings are on the **older** 840-question
`dataset/comprehensive/**`, not on these 296 PDFs.

### F3 — "264 questions fall back to question_number=1" — **CONFIRMED (exact)**
`dataset/comprehensive/**`: **264 / 840 = 31.4%** have `number === 1`.
~28 are legitimate (28 exams × real 問1); the remaining **~236 are spurious fallbacks**.
*Scope:* exact on the raw per-exam set; **does NOT hold** on the app-loaded `gold_standard`
(58) — that layer was partially cleaned.

### F4 — "47.1% have domain=unknown" — **CONFIRMED (exact)**
`dataset/comprehensive/**`: **396 / 840 = 47.1%** have `domain==="unknown"` (no empty/absent).
*Scope:* exact on the raw set; **mitigated downstream** — `gold_standard` (app-loaded) = **0%**
unknown. So the 47.1% is a **raw-data** defect, not what the app currently consumes.

### F6 — "OCR artifacts (321980, 271929, …) stored in question_number" — **CONFIRMED**
**26 distinct** out-of-range values are stored **as the literal `number` field value**
(not just inside text): `321980, 321970, 271992, 271929, 261814, 251889, 241993, 231960,
221950, 202002, …`. These **propagate into `gold_standard.json` (app-loaded)**, `consolidated`,
and `reclassified` (all `max_num = 321980`). This is the most far-reaching defect.

---

## 2. ⚠️ Partially confirmed findings

### F2 — "Total extracted questions" — **PARTIALLY CONFIRMED (source-dependent)**
There is no single number — it depends on which generated output:
- `dataset/comprehensive/**` (audited): **840**
- comprehensive consolidated: **1448**
- `gold_standard.json`: **1121**
- `scripts/eju-parser/out/parsed_questions.json` (新 問N pipeline): **1588**

The audit's question-level percentages match the **840** layer; quoting a single "total" without
naming the layer is imprecise.

### F5 — "math JSON truly lacks the claimed fields" — **PARTIALLY CONFIRMED**
`dataset/mathematics/**` has **two schemas**:
- **13 / 38 files** — reduced: `[confidence, number, section, source, text_snippet, topic]`
  → **lack** `raw_text/text`, `answer_choices`, `domain`, `difficulty`, `id`, `year/round`,
  `keywords/concepts` (use `section`/`text_snippet` instead).
- **25 / 38 files** — full schema (all rich fields present).
Overall fill across 646 math questions: `domain` **50** (7.7%), `answer_choices` **173** (26.8%),
`topic` **274** (42.4%). So the claim is **true for ~1/3 of math files**, false for the rest.

---

## 3. ❌ Rejected / not reproduced (as a global claim)

No finding was fabricated, but two are **rejected if asserted about the pipeline output the app
consumes**:
- **F3/F4 on `gold_standard.json`** (app-loaded): number==1 is **58, not 264**; domain unknown is
  **0%, not 47.1%**. If the audit implied the live app sees 47.1% unknown / 264 fallbacks, that is
  **not reproduced** — those defects live in the **raw** layer and were partly remediated before
  `gold_standard`. (The artifact numbers, F6, **were not** remediated and do reach the app.)

---

## 4. Exact reproduction (evidence)

Canonical: `node scripts/audit-validation/reproduce.mjs`. Key inline reproductions:

```js
// F3 + F4 — raw per-exam comprehensive (n=840)
const fs=require('fs');
const flat=d=>{const o=[];for(const y of fs.readdirSync(d).filter(x=>/^20/.test(x)))
  for(const f of fs.readdirSync(d+'/'+y)) if(f.endsWith('.json'))
    for(const q of JSON.parse(fs.readFileSync(d+'/'+y+'/'+f)).questions||[]) o.push(q); return o;};
const c=flat('dataset/comprehensive');
c.filter(q=>q.number===1).length;                  // → 264   (31.4%)
c.filter(q=>q.domain==='unknown').length;          // → 396   (47.1%)

// F6 — artifacts are NUMBER VALUES, not text
c.filter(q=>typeof q.number==='number'&&q.number>100).map(q=>q.number);
// → [321980,321970,271992,271929,...] (26 distinct)
JSON.parse(fs.readFileSync('public/dataset/gold_standard/gold_standard.json'))
  .questions.some(q=>q.question_number===321980);  // → true (reaches app)
```
```bash
# F5 — math schema split
node -e "const fs=require('fs');const s={};for(const y of fs.readdirSync('dataset/mathematics').filter(d=>/^20/.test(d)))for(const f of fs.readdirSync('dataset/mathematics/'+y)){if(!f.endsWith('.json'))continue;const q=(JSON.parse(fs.readFileSync('dataset/mathematics/'+y+'/'+f)).questions||[])[0]||{};const k=Object.keys(q).includes('raw_text')?'full':'reduced';s[k]=(s[k]||0)+1;}console.log(s)"
# → { reduced: 13, full: 25 }
```

---

## 5. Impact ranking (on the platform's analysis accuracy)

> "EJU accuracy" here = fidelity of the platform's classification / frequency / trend / answer
> features, **not** a student's exam score (which this data cannot measure — see §6).

| # | Issue | Reaches app? | Impact | Why |
|---|-------|-------------|--------|-----|
| 1 | **F6 artifact `number` values** | **Yes** (`gold_standard`) | **HIGH** | Any logic keyed on question number (dedup, answer linking, per-number aggregation, "38문항 기준", ordering) is corrupted; 26 rows carry impossible ids and inflate `max`. |
| 2 | **F4 domain=unknown (raw 47.1%)** | Indirect | **MEDIUM-HIGH** | App's `gold_standard` is clean (0%), but trend/frequency artifacts are *built* from comprehensive data; if a builder used the raw/consolidated layer (27–47% unknown), domain frequencies are skewed. **Provenance must be confirmed.** |
| 3 | **F3 number==1 fallback (264)** | Indirect | **MEDIUM** | Corrupts per-question identity & `(year,number)` dedup at the raw layer; reduced to 58 in `gold_standard`. Low effect on topic-frequency (keyed on topic, not number). |
| 4 | **F5 math reduced schema (13/38)** | Math features | **MEDIUM** | 34% of math files lack `domain/answer_choices/text` → math intelligence/frequency runs on partial data; `domain` only 7.7% filled. |

---

## 6. Expected improvement — **estimate, explicitly bounded**

A true **EJU score** delta is **not derivable** from this dataset — it would require a labeled
ground-truth benchmark we do not have. Quoting a student-score number would be fabrication.
What *can* be estimated is **data-quality / analysis-coverage** improvement (assumptions stated):

- **Fix F6 (artifacts):** removes/repairs **26/840 (3.1%)** corrupt comprehensive rows and the
  same rows that propagated into `gold_standard` → restores integrity of all question-number-keyed
  features. *Estimated:* eliminates a known class of join/dedup errors (qualitative, high-value;
  not a % score).
- **Fix F4 (domain) at the build layer:** if reclassification labels the 396 unknown with the
  existing classifier at its current accuracy, comprehensive **domain coverage 52.9% → ~90–95%**
  *(estimate, assumes classifier ≈ its measured accuracy on the labeled 52.9%)* → proportionally
  fairer domain-frequency/trend weights. **Not** a guaranteed analysis-accuracy number.
- **Fix F3 (number==1):** restores correct identity for **~236** questions → more reliable dedup
  and answer linking; magnitude of downstream gain depends on which features key on `number`.
- **Fix F5 (math schema):** unifying the 13 reduced files would raise math `domain` fill from
  **7.7%** and `answer_choices` from **26.8%** toward the full-schema files' levels.

All figures above are **estimates with stated assumptions, not measured benchmarks.**

---

## 7. Step-by-step remediation plan (NOT implemented)

> Order = impact-first. Each step ends with a re-run of `reproduce.mjs` as the gate.

1. **Root-cause F6 (question-number extraction).** Find the parser/regex that wrote multi-digit
   OCR noise into `number` (values like 321980 look like concatenated row/year fragments).
   Bound the extractor to plausible ranges + sequential validation. *Gate:* `max number ≤ ~60`,
   0 values >100 across comprehensive/gold_standard/consolidated/reclassified.
2. **F3 — eliminate `number=1` fallback.** Replace the silent default-to-1 with `null` + a
   `numberConfidence`/`needs_review` flag; re-derive from 問N where recoverable. *Gate:* legit
   `number==1` ≈ exam count (~28), not 264.
3. **F4 — domain reclassification provenance.** (a) Confirm which layer each app feature consumes;
   (b) reclassify the 396 unknown using the existing classifier; (c) rebuild trend/frequency from
   the cleaned layer. *Gate:* comprehensive unknown ≤ ~10%; trend build reads cleaned source.
4. **F5 — unify math schema.** Re-process the 13 reduced-schema files to the full schema
   (re-OCR or re-run the rich extractor). *Gate:* single schema across 38 files; `domain` fill ≫ 7.7%.
5. **Add a CI data-quality gate** (extend `scripts/audit/` auditor) asserting: no `number>60`,
   `number==1` ≈ exam count, domain-unknown ≤ threshold, math single-schema — so regressions fail fast.

> Validation-first complete. Awaiting go-ahead before any code change.
