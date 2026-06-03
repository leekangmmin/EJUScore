# Throughput · Risk · Test Plan — EJU AI Data Layer

> **Honesty:** measured facts are labelled **[measured]**; everything network- or
> model-dependent is **[estimate]** with stated assumptions — **not** a benchmark.

## 5. 예상 처리량 (Throughput)

### Measured (local, real data)
- **[measured]** Transform is pure-JS and not the bottleneck: a 32-question exam
  transforms in ~32 ms inside the test runner; the full real corpus
  (66 files → 1,240 ingestable questions, 4,375 choices, 4,937 question_tags,
  ~830 unique tags) transforms in well under a second per dry-run.
- **[measured]** Real ingestable volume from current corpus:
  comprehensive 840 q / 2,995 choices / 687 tags; mathematics 400 q
  (246 empty-text rows correctly skipped, never fabricated).

### Estimated for a 10,000-question load **[estimate]**
Assumptions: PostgREST batch size 500, ~3–4 choices & ~4 tags per question,
single region, ~100–250 ms per insert round trip.

| Step | Rows (≈) | Requests (≈) | Time **[estimate]** |
|------|----------|--------------|---------------------|
| tags upsert | ~3–6k unique | ~10 | a few seconds |
| questions | 10,000 | 20 | ~3–6 s |
| choices | ~35,000 | ~70 | ~10–20 s |
| question_tags | ~40,000 | ~80 | ~12–24 s |
| **content total** | ~85k | ~180 | **~30–60 s** |

- **Embedding backfill [estimate]** is the real cost, model+hardware bound:
  bge-m3 / e5-large on CPU ≈ tens–hundreds of ms per passage → 10k ≈ **8–50 min**;
  on GPU/batched ≈ minutes. Resumable by `question_id`.
- **HNSW build [estimate]**: 10k×1024 ≈ seconds–low minutes; 1M ≈ tens of minutes
  (build after load; tune `m`, `ef_construction`).
- **Query latency [estimate]**: filtered `search_questions` on btree/GIN ≈ low ms at
  10k–100k rows; `similar_questions` via HNSW ≈ single-digit ms at `ef_search≈100`.

Scaling headroom: schema + HNSW are designed for **10^5–10^6** questions; the 10k
target is comfortably within range.

## 6. 리스크 분석 (Risk)

1. **`pg_bigm` availability** — may be absent on some Supabase plans. *Mitigation:*
   fall back to `pg_trgm` (`gin_trgm_ops`, same `%` operator); slightly lower CJK recall.
2. **Embedding dim/model mismatch** — `vector(1024)` fits bge-m3 & e5-large only.
   e5-**small** (384) would fail to insert. *Mitigation:* `model`+`dim` columns +
   composite PK; enforce dim in the embed job.
3. **No official answer key / 정답률** — `choices.is_correct` is NULL by design;
   weakness API exposes a frequency *signal*, not a probability. *Mitigation:* documented
   in API spec; verified-answer backfill path via `review_status='verified'`.
4. **Large single JSON (수백 MB)** — current ingester `JSON.parse`s a whole file.
   *Mitigation:* split per-exam files (the real corpus already is), or add a streaming
   JSON parser for monolithic inputs (noted as a known limitation).
5. **Idempotency / partial failure** — no cross-batch transaction. *Mitigation:* all
   inserts are upserts on natural keys (`sha256`, `exam(subject,year,round)`,
   `question(exam_id,number,content_hash)`, `choice(question_id,ordinal)`,
   `question_tag PK`) → re-run is safe and converges.
6. **Copyright / RLS exposure** — public read of question text may exceed licensing.
   *Mitigation:* RLS policies are explicit and easily tightened to authenticated-only
   or row-filtered; `ocr_sources`/`embeddings` are already service-role only.
7. **Matview staleness** — `topic_frequency` must be refreshed after ingest/reclassify,
   or weakness signals drift. *Mitigation:* refresh step in migration Phase 4 / cron.
8. **Tag explosion** — free-form keywords can bloat `tags`. *Mitigation:* `(name,kind)`
   uniqueness + optional curation; `question_tags.weight` lets search down-rank noise.
9. **HNSW recall vs latency** — low `ef_search` can miss neighbors. *Mitigation:* tune
   `ef_search` (40–200) per latency budget; document default 100.
10. **Service-key handling** — ingest needs the service-role key. *Mitigation:* run
    server-side/CI only, never ship to clients; clients use anon/user JWT + RLS.

## 7. 테스트 계획 (Test Plan)

### Implemented now (CI, offline)
- **[done]** `src/test/ingestTransform.test.js` (6 cases) — transform on **real** OCR:
  normalized rows, choice explosion (is_correct NULL), typed+deduped tags,
  deterministic `content_hash`, NFKC normalize, malformed-doc rejection, tag vocab.
- **[done]** `ingest.mjs --dry-run` over the real corpus — validates parse + counts
  with zero writes.

### Executed on a real Postgres (local, this session)
- **[executed]** `db/schema.sql` DDL applied cleanly to a live PostgreSQL 16
  (with `pg_trgm` substituted for `pg_bigm`; pgvector parts skipped — not installed
  locally). All 7 tables, indexes, matview, trigger, RLS policies created.
- **[executed]** `search_questions` — keyword **`国際連合`** returns the right row;
  `domain=economy, year=2013` filter returns the correct count.
- **[executed]** `analyze_weakness` — correct `weak_domains` / `priority_topics`
  with the honest frequency signal + note.
- **[finding→fixed]** CJK keyword search initially returned **0 rows**: `to_tsvector('simple')`
  makes space-less Japanese one token, and `pg_trgm %` similarity is below threshold for a
  short query inside a long passage. **Fix:** primary CJK path is now
  `text ILIKE '%kw%'` (accelerated by the bigram/trigram GIN index), tsvector kept for rank.
  > **Short-keyword nuance:** `gin_bigm_ops` accelerates `LIKE` for 2-char CJK queries;
  > `gin_trgm_ops` only accelerates ≥3-char patterns (1–2 char → seq scan). Prefer pg_bigm
  > where available for short Japanese keywords.

### To run against a Supabase instance (staging)
1. **Schema apply** — `psql -f db/schema.sql` on a fresh DB; assert all 7 tables +
   indexes + matview exist (`\d+`), extensions present (or trgm fallback).
2. **Ingest idempotency** — run `ingest.mjs` twice on the same input; row counts
   identical after run 2 (upserts converge).
3. **Search RPC** — seed corpus; assert `search_questions`:
   - keyword-only returns ranked rows; year+subject+domain+difficulty+tags compose (AND);
   - `total_count` matches an independent `count(*)`; page size capped at 100.
4. **Similar RPC** — seed ≥2 embeddings; assert `similar_questions` excludes self,
   returns ≤20 ordered by similarity desc; empty when no embedding.
5. **Weakness RPC** — feed known wrong ids; assert weak_domains aggregation, priority
   ordering = `0.6·weakness + 0.4·freq`, and `frequency_signal` matches `topic_frequency`.
6. **RLS** — anon SELECT on `questions` works; anon INSERT/UPDATE denied;
   `ocr_sources`/`embeddings` not readable by anon.
7. **Performance [estimate→measure]** — load 10k synthetic questions; record actual
   ingest time, search p95, similar p95, HNSW build time → replace the [estimate]s above
   with [measured] numbers.
8. **Data quality** — empty-text rows skipped; duplicate ingest deduped by
   `content_hash`; choice ordinals contiguous.
