-- ═══════════════════════════════════════════════════════════════════
-- EJU AI Data Layer — Supabase Postgres schema (normalized)
--
-- Tables: ocr_sources, exams, questions, choices, tags, question_tags,
--         embeddings (pgvector).
-- Grounded in the REAL ocr_output.json shape:
--   exam:     { id, subject, year, round, total_pages, metadata{...}, questions[] }
--   question: { id, number, raw_text, text, answer_choices[], ocr_confidence,
--               word_count, lines, tables[], diagrams[], graphs[], maps[],
--               subject, domain, topic, subtopic, question_type, difficulty,
--               keywords[], concepts[] }
--
-- Embedding model target: bge-m3 / multilingual-e5-large → BOTH 1024-dim.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists vector;        -- pgvector
create extension if not exists pg_bigm;       -- CJK bigram full-text (Japanese)

-- ═══════════════════════════════════════════════════════════════════
-- 1. ocr_sources — one row per ingested source file (idempotent by sha256)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists ocr_sources (
  id              uuid primary key default gen_random_uuid(),
  filename        text not null,
  sha256          text unique,                -- idempotency: re-ingest = no-op
  subject         text not null,              -- comprehensive | mathematics | japanese
  exam_year       int,
  exam_round      int,
  page_count      int,
  question_count  int,
  avg_confidence  numeric(5,4),
  ocr_engine      text,
  ocr_version     text,
  raw_path        text,                       -- Storage path to the raw json/pdf
  processed_at    timestamptz,
  ingested_at     timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 2. exams — one row per (subject, year, round) exam instance
-- ═══════════════════════════════════════════════════════════════════
create table if not exists exams (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid references ocr_sources(id) on delete set null,
  subject         text not null,
  exam_year       int,
  exam_round      int,                        -- 1 | 2 (EJU runs twice a year)
  exam_name       text,
  total_questions int default 0,
  created_at      timestamptz not null default now(),
  unique (subject, exam_year, exam_round)
);

-- ═══════════════════════════════════════════════════════════════════
-- 3. questions — the central unit
-- ═══════════════════════════════════════════════════════════════════
create table if not exists questions (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid references exams(id) on delete cascade,
  source_id       uuid references ocr_sources(id) on delete set null,
  -- denormalized filter columns (kept on the row for fast WHERE without joins)
  subject         text not null,
  exam_year       int,
  exam_round      int,
  number          int,                        -- question number within the exam
  domain          text,                       -- economy|politics|history|geography|society|<math topics>
  topic           text,
  subtopic        text,
  question_type   text,
  difficulty      numeric(4,2),               -- 1–10 estimate (NOT 정답률)
  -- content
  raw_text        text,                       -- OCR raw
  text            text,                       -- cleaned text used for search/embeddings
  ocr_confidence  numeric(5,4),
  word_count      int,
  line_count      int,
  has_table       boolean default false,
  has_diagram     boolean default false,
  has_graph       boolean default false,
  has_map         boolean default false,
  content_hash    text,                       -- normalized-text hash for dedup
  review_status   text default 'auto',        -- auto | verified | rejected
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (exam_id, number, content_hash)      -- guards duplicate ingest
);

-- generated tsvector + indexes for keyword search (Japanese-aware via pg_bigm)
alter table questions
  add column if not exists tsv tsvector
  generated always as (to_tsvector('simple', coalesce(text,'') || ' ' || coalesce(topic,''))) stored;

create index if not exists idx_q_tsv          on questions using gin (tsv);
create index if not exists idx_q_text_bigm    on questions using gin (text gin_bigm_ops);
create index if not exists idx_q_subj_year     on questions (subject, exam_year, exam_round);
create index if not exists idx_q_domain        on questions (domain);
create index if not exists idx_q_topic         on questions (topic);
create index if not exists idx_q_difficulty    on questions (difficulty);
create index if not exists idx_q_content_hash  on questions (content_hash);

-- ═══════════════════════════════════════════════════════════════════
-- 4. choices — answer_choices[] exploded into rows
-- ═══════════════════════════════════════════════════════════════════
create table if not exists choices (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references questions(id) on delete cascade,
  ordinal         int not null,               -- 0-based position in answer_choices[]
  label           text,                       -- '1'..'4' / 'ア'..'エ' (if parseable)
  text            text,
  is_correct      boolean,                    -- NULL when answer key unknown (honest)
  unique (question_id, ordinal)
);
create index if not exists idx_choices_qid on choices (question_id);

-- ═══════════════════════════════════════════════════════════════════
-- 5. tags — deduplicated tag vocabulary (keywords/concepts/material/etc.)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists tags (
  id              bigint generated always as identity primary key,
  name            text not null,
  kind            text not null default 'keyword', -- keyword|concept|material|type|domain|topic
  unique (name, kind)
);

-- ═══════════════════════════════════════════════════════════════════
-- 6. question_tags — M:N questions ↔ tags
-- ═══════════════════════════════════════════════════════════════════
create table if not exists question_tags (
  question_id     uuid not null references questions(id) on delete cascade,
  tag_id          bigint not null references tags(id) on delete cascade,
  weight          numeric(4,3) default 1.0,
  source          text default 'ocr',          -- ocr | classifier | manual
  primary key (question_id, tag_id)
);
create index if not exists idx_qtags_tag on question_tags (tag_id);

-- ═══════════════════════════════════════════════════════════════════
-- 7. embeddings — pgvector; composite PK allows model coexistence/migration
--    bge-m3 and multilingual-e5-large are BOTH 1024-dim → vector(1024).
-- ═══════════════════════════════════════════════════════════════════
create table if not exists embeddings (
  question_id      uuid not null references questions(id) on delete cascade,
  model            text not null default 'bge-m3',   -- or 'multilingual-e5-large'
  dim              int  not null default 1024,
  question_embedding vector(1024) not null,
  created_at       timestamptz not null default now(),
  primary key (question_id, model)
);

-- HNSW (cosine) — approximate NN, scales to ≥10^6 rows.
-- Build AFTER bulk load for speed (see migration plan).
create index if not exists idx_emb_hnsw
  on embeddings using hnsw (question_embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ═══════════════════════════════════════════════════════════════════
-- Aggregate: topic frequency by year (refresh after ingest) — used by
-- weakness analysis for honest, data-derived "출제 빈도" signals.
-- ═══════════════════════════════════════════════════════════════════
create materialized view if not exists topic_frequency as
  select subject, domain, topic,
         count(*)                         as total,
         array_agg(distinct exam_year order by exam_year) as years,
         max(exam_year)                   as last_year,
         avg(difficulty)                  as avg_difficulty
  from questions
  where topic is not null and topic <> ''
  group by subject, domain, topic;
create index if not exists idx_topicfreq on topic_frequency (subject, topic);

-- ═══════════════════════════════════════════════════════════════════
-- updated_at trigger
-- ═══════════════════════════════════════════════════════════════════
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_q_updated on questions;
create trigger trg_q_updated before update on questions
  for each row execute function set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- Row-Level Security (mobile clients use the anon/auth key directly).
--   • public read of question content (adjust to your copyright policy)
--   • writes only via service-role (ingest) — never from clients
-- ═══════════════════════════════════════════════════════════════════
alter table exams         enable row level security;
alter table questions     enable row level security;
alter table choices       enable row level security;
alter table tags          enable row level security;
alter table question_tags enable row level security;
alter table embeddings    enable row level security;
alter table ocr_sources   enable row level security;

-- read-only policies for anon/authenticated (content tables) — idempotent
do $$
declare t text;
begin
  foreach t in array array['exams','questions','choices','tags','question_tags'] loop
    execute format('drop policy if exists %I_read on %I;', t, t);
    execute format(
      'create policy %I_read on %I for select to anon, authenticated using (true);',
      t, t);
  end loop;
end $$;
-- ocr_sources & embeddings: no client read by default (service-role only).
-- (writes everywhere default-deny under RLS unless a service-role bypass is used)
