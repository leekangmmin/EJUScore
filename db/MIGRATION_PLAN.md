# Migration Plan — EJU AI Data Layer (Supabase)

Apply order is **extensions → schema → ingest → embeddings → vector index → functions → RLS**.
Heavy indexes (HNSW) are built *after* bulk load for speed.

## Phase 0 — Extensions
```sql
create extension if not exists pgcrypto;
create extension if not exists vector;     -- pgvector (available on Supabase)
create extension if not exists pg_bigm;    -- CJK bigram FTS
```
> **Compatibility note (honest):** `pgvector` and `pgcrypto` are standard on Supabase.
> `pg_bigm` may not be enabled on every Supabase plan. **Fallback:** use `pg_trgm`
> (always available) — swap `gin_bigm_ops` → `gin_trgm_ops`; the `%` similarity
> operator used in `search_questions` works for both. Trigram CJK recall is slightly
> lower than bigram but acceptable.

## Phase 1 — Schema
```bash
psql "$DATABASE_URL" -f db/schema.sql
```
Creates `ocr_sources, exams, questions, choices, tags, question_tags, embeddings`,
the `topic_frequency` matview, tsvector/bigm/btree indexes, the `updated_at` trigger,
and RLS policies. The HNSW index is declared here but for a **cold/large load** comment
it out and build in Phase 4.

## Phase 2 — Bulk ingest (content only)
```bash
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
node scripts/ingest/ingest.mjs <ocr_output dir-or-file> --batch=500
```
Idempotent: `ocr_sources.sha256`, `exams(subject,year,round)`, and
`questions(exam_id,number,content_hash)` upserts make re-runs no-ops.
Validate first with `--dry-run`.

## Phase 3 — Embedding backfill (separate job)
Embeddings are **not** in the OCR JSON; generate them after content load.
Model: `bge-m3` or `multilingual-e5-large` (both 1024-dim → fits `vector(1024)`).
Batch pattern (pseudo, runs server-side or in a worker):
```
for each question without an embeddings row (model = $MODEL):
    vec = embed( "passage: " || text )      # e5 prefix; bge-m3 no prefix
    upsert embeddings(question_id, model, dim=1024, question_embedding=vec)
```
Run in chunks; checkpoint by `question_id` so it is resumable.

## Phase 4 — Vector index + aggregates
```sql
create index idx_emb_hnsw on embeddings
  using hnsw (question_embedding vector_cosine_ops) with (m=16, ef_construction=64);
refresh materialized view topic_frequency;
```
Set query-time recall with `set hnsw.ef_search = 100;` (tune 40–200).

## Phase 5 — API functions + RLS
```bash
psql "$DATABASE_URL" -f db/functions.sql
```
Exposes `search_questions`, `similar_questions`, `analyze_weakness` as RPC.
RLS (from schema.sql): anon/auth get **read** on content tables; **writes** only via
service-role (ingest). `ocr_sources`/`embeddings` are service-role only.

## Re-ingest / Reprocess
- New OCR version → re-run ingest; unchanged rows are skipped by hash.
- Topic re-classification → update `questions.topic`; then `refresh materialized view topic_frequency`.
- Model swap → ingest a second `embeddings` row per question with the new `model`
  (composite PK allows coexistence), repoint `similar_questions(p_model=...)`, drop old rows.

## Rollback
Each phase is independent. To roll back content: `truncate question_tags, choices,
embeddings, questions, exams, ocr_sources restart identity cascade;` (tags vocabulary
can be kept). Schema/functions are idempotent (`create ... if not exists` / `create or replace`).
