-- ═══════════════════════════════════════════════════════════════════
-- EJU Natural-Language Search — Postgres + pgvector (production target)
--
-- Implements the redesign from SEARCH_AUDIT.md. The local JS engine
-- (src/admin/lib/searchEngine.js) mirrors these semantics so the app
-- works today; flipping to this backend is a client swap, not a rewrite.
--
-- Embedding model: multilingual-e5-small (384-dim) — the SAME model the
-- optional in-app embedding mode uses, so query/passage vectors are
-- directly comparable. e5 requires "query:"/"passage:" prefixes.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists vector;
create extension if not exists pg_bigm;     -- CJK bigram FTS (Japanese)

-- ── core question table (search subset; full schema in ARCHITECTURE_V2) ──
create table if not exists questions (
  id            uuid primary key default gen_random_uuid(),
  subject       text not null,              -- 'comprehensive' | 'mathematics' | 'japanese'
  exam_year     int,
  exam_round    int,
  number        int,
  domain        text,
  topic         text,
  text          text not null,              -- cleaned/OCR text
  keywords      text[]  default '{}',
  difficulty    numeric(4,2),               -- 1–10 estimate (NOT 정답률)
  ocr_confidence numeric(5,4)
);

-- ── filter indexes (연도별/과목별/영역별) ───────────────────
create index if not exists idx_q_subject_year on questions (subject, exam_year, exam_round);
create index if not exists idx_q_domain       on questions (domain);
create index if not exists idx_q_topic        on questions (topic);

-- ── lexical search: tsvector (simple) + pg_bigm (CJK) ───────
alter table questions
  add column if not exists tsv tsvector
  generated always as (to_tsvector('simple', coalesce(text,'') || ' ' || coalesce(topic,''))) stored;
create index if not exists idx_q_tsv  on questions using gin (tsv);
create index if not exists idx_q_bigm on questions using gin (text gin_bigm_ops);

-- ── vector search: pgvector + HNSW ─────────────────────────
create table if not exists question_embeddings (
  question_id uuid primary key references questions(id) on delete cascade,
  model       text not null default 'multilingual-e5-small',
  embedding   vector(384) not null
);
create index if not exists idx_qemb_hnsw
  on question_embeddings using hnsw (embedding vector_cosine_ops);

-- ── 출제년도 집계 (topic → years) ──────────────────────────
create materialized view if not exists topic_years as
  select subject, topic,
         array_agg(distinct exam_year order by exam_year) as years,
         count(*) as appearances
  from questions where topic is not null and topic <> ''
  group by subject, topic;

-- ═══════════════════════════════════════════════════════════
-- Hybrid search RPC: filters → (vector ⊕ lexical) → enrich.
--   :q_text   raw query (for FTS/bigm)
--   :q_vec    e5 "query:"-prefixed embedding (384-d)
--   :subject  subject filter (null = all)
--   :y0,:y1   year range (null = all)
-- Returns related questions + 출제년도(topic) + difficulty + concepts.
-- 정답률(공식) 미존재 → 반환하지 않음. 내 정답률은 클라이언트에서 조인.
-- ═══════════════════════════════════════════════════════════
create or replace function search_questions(
  q_text  text,
  q_vec   vector(384) default null,
  subject_filter text default null,
  y0 int default null,
  y1 int default null,
  k  int default 15,
  vec_weight float default 0.45
) returns table (
  id uuid, subject text, exam_year int, exam_round int, number int,
  domain text, topic text, text text, difficulty numeric,
  topic_years int[], related_concepts text[], score float
) language sql stable as $$
  with filt as (
    select q.* from questions q
    where (subject_filter is null or q.subject = subject_filter)
      and (y0 is null or q.exam_year >= y0)
      and (y1 is null or q.exam_year <= y1)
  ),
  lex as (  -- lexical relevance (FTS + bigram fallback), 0..1
    select f.id,
      greatest(
        ts_rank(f.tsv, plainto_tsquery('simple', q_text)),
        case when q_text <> '' and f.text % q_text then 0.3 else 0 end
      ) as s
    from filt f
  ),
  vec as (  -- vector similarity, 0..1 (cosine → 1 - distance)
    select e.question_id as id, 1 - (e.embedding <=> q_vec) as s
    from question_embeddings e
    join filt f on f.id = e.question_id
    where q_vec is not null
  ),
  merged as (
    select f.id,
      (case when q_vec is null then 1 else (1 - vec_weight) end) * coalesce(l.s,0)
      + (case when q_vec is null then 0 else vec_weight end)      * coalesce(v.s,0) as score
    from filt f
    left join lex l on l.id = f.id
    left join vec v on v.id = f.id
  )
  select f.id, f.subject, f.exam_year, f.exam_round, f.number,
         f.domain, f.topic, left(f.text, 400) as text, f.difficulty,
         ty.years as topic_years,
         (coalesce(f.keywords,'{}') || coalesce(array[f.topic],'{}')) as related_concepts,
         m.score
  from merged m
  join filt f on f.id = m.id
  left join topic_years ty on ty.subject = f.subject and ty.topic = f.topic
  where m.score > 0
  order by m.score desc
  limit k;
$$;
