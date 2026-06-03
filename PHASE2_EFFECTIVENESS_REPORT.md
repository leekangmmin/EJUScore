# PHASE2_EFFECTIVENESS_REPORT

- Generated: 2026-06-03T22:00:21.500Z
- Backup (before): `dataset/_backup_repair_20260604_064459`
- valid_domain_records = economy + politics + history + geography + society
- effective_coverage = valid_domain_records / total_records (review_required NOT counted)

## dataset/comprehensive (per-exam)  (n=840)

### 1. Domains BEFORE

| domain | count |
|---|---|
| economy | 159 |
| politics | 108 |
| history | 72 |
| geography | 73 |
| society | 32 |
| unknown | 396 |

### 2. Domains AFTER

| domain | count |
|---|---|
| economy | 161 |
| politics | 112 |
| history | 72 |
| geography | 76 |
| society | 33 |
| review_required | 386 |
| unknown | 0 |

### 3. Recovered vs relabeled

- unknown records processed: **396**
- truly recovered (→ valid domain): **10** {"politics":4,"economy":2,"society":1,"geography":3}
- relabeled-only (→ review_required): **386**

Confidence distribution (processed records):

| bucket | count |
|---|---|
| 0.0-0.2 | 337 |
| 0.2-0.4 | 22 |
| 0.4-0.6 | 2 |
| 0.6-0.8 | 25 |
| 0.8-1.0 | 10 |

### 4. Effective domain coverage

- BEFORE: 444/840 = **52.86%**
- AFTER:  454/840 = **54.05%**
- Δ = **+1.19 pp** (= recovered 10 / 840)

## comprehensive consolidated  (n=1448)

### 1. Domains BEFORE

| domain | count |
|---|---|
| economy | 345 |
| politics | 257 |
| history | 197 |
| geography | 208 |
| society | 45 |
| unknown | 396 |

### 2. Domains AFTER

| domain | count |
|---|---|
| economy | 347 |
| politics | 261 |
| history | 197 |
| geography | 211 |
| society | 46 |
| review_required | 386 |
| unknown | 0 |

### 3. Recovered vs relabeled

- unknown records processed: **396**
- truly recovered (→ valid domain): **10** {"politics":4,"economy":2,"society":1,"geography":3}
- relabeled-only (→ review_required): **386**

Confidence distribution (processed records):

| bucket | count |
|---|---|
| 0.0-0.2 | 337 |
| 0.2-0.4 | 22 |
| 0.4-0.6 | 2 |
| 0.6-0.8 | 25 |
| 0.8-1.0 | 10 |

### 4. Effective domain coverage

- BEFORE: 1052/1448 = **72.65%**
- AFTER:  1062/1448 = **73.34%**
- Δ = **+0.69 pp** (= recovered 10 / 1448)

## Verdict — did coverage improve, or did unknown just become review_required?

- Across audited datasets: **20** truly recovered vs **772** relabeled-only (of 792 processed).
- Only **2.5%** of unknowns were genuinely classified; the rest (**97.5%**) were relabeled `review_required`.

**Answer:** Domain coverage improved **only marginally** (by exactly the recovered count). The
dominant effect was **relabeling `unknown` → `review_required`**, which is an honest triage state,
not new classification. Effective coverage (valid-5 / total) rose by the small Δ above, **not** by the
full unknown reduction. Real coverage gains require **re-OCR** of the garbled questions, then re-running Phase 2.