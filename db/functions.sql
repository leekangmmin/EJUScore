-- ═══════════════════════════════════════════════════════════════════
-- EJU AI Data Layer — API functions (Supabase RPC / PostgREST)
-- Every function is callable from any client (iOS/iPadOS/Android/Desktop)
-- as POST /rest/v1/rpc/<name>. JSON in / JSON out, stateless, paginated.
-- ═══════════════════════════════════════════════════════════════════

-- ── helper: compact choices as json for a question ──────────────────
create or replace function question_choices_json(q uuid)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(
           jsonb_build_object('ordinal', ordinal, 'label', label,
                              'text', text, 'is_correct', is_correct)
           order by ordinal), '[]'::jsonb)
  from choices where question_id = q;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. SEARCH API — composite filter (keyword/year/subject/domain/difficulty/tag)
--    Mobile-first: limit/offset pagination, compact rows, optional total.
-- ═══════════════════════════════════════════════════════════════════
create or replace function search_questions(
  p_keyword       text   default null,
  p_subject       text   default null,
  p_year_from     int    default null,
  p_year_to       int    default null,
  p_domain        text   default null,
  p_difficulty_min numeric default null,
  p_difficulty_max numeric default null,
  p_tags          text[] default null,        -- match ANY of these tag names
  p_limit         int    default 20,
  p_offset        int    default 0
) returns table (
  id uuid, subject text, exam_year int, exam_round int, number int,
  domain text, topic text, difficulty numeric, text text,
  choices jsonb, rank real, total_count bigint
) language sql stable as $$
  with base as (
    select q.*,
      -- rank: tsvector rank + a boost when the CJK substring matches.
      -- (Japanese has no spaces → to_tsvector('simple') makes one token, so
      --  substring ILIKE — accelerated by the bigram/trigram GIN index — is
      --  the reliable CJK keyword path. Verified empirically.)
      case when p_keyword is null or p_keyword = '' then 0
           else ts_rank(q.tsv, plainto_tsquery('simple', p_keyword))
                + case when q.text ilike '%' || p_keyword || '%' then 0.5 else 0 end
      end as rk
    from questions q
    where (p_subject is null or q.subject = p_subject)
      and (p_year_from is null or q.exam_year >= p_year_from)
      and (p_year_to   is null or q.exam_year <= p_year_to)
      and (p_domain is null or q.domain = p_domain)
      and (p_difficulty_min is null or q.difficulty >= p_difficulty_min)
      and (p_difficulty_max is null or q.difficulty <= p_difficulty_max)
      and (p_keyword is null or p_keyword = ''
           or q.text ilike '%' || p_keyword || '%'   -- CJK substring (bigm/trgm index)
           or q.tsv @@ plainto_tsquery('simple', p_keyword))
      and (p_tags is null or exists (
            select 1 from question_tags qt join tags t on t.id = qt.tag_id
            where qt.question_id = q.id and t.name = any(p_tags)))
  ),
  counted as (select count(*) as n from base)
  select b.id, b.subject, b.exam_year, b.exam_round, b.number,
         b.domain, b.topic, b.difficulty, left(b.text, 600) as text,
         question_choices_json(b.id) as choices,
         b.rk as rank, c.n as total_count
  from base b cross join counted c
  order by b.rk desc, b.exam_year desc nulls last, b.number
  limit greatest(1, least(p_limit, 100))       -- cap page size for mobile
  offset greatest(0, p_offset);
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. SIMILAR-QUESTIONS API — top-20 by vector cosine (pgvector HNSW)
-- ═══════════════════════════════════════════════════════════════════
create or replace function similar_questions(
  p_question_id uuid,
  p_limit       int  default 20,
  p_model       text default 'bge-m3'
) returns table (
  id uuid, subject text, exam_year int, exam_round int, number int,
  domain text, topic text, difficulty numeric, text text, similarity real
) language sql stable as $$
  with q as (
    select question_embedding as v from embeddings
    where question_id = p_question_id and model = p_model
  )
  select t.id, t.subject, t.exam_year, t.exam_round, t.number,
         t.domain, t.topic, t.difficulty, left(t.text, 400) as text,
         (1 - (e.question_embedding <=> (select v from q)))::real as similarity
  from embeddings e
  join questions t on t.id = e.question_id
  where e.model = p_model
    and e.question_id <> p_question_id
    and exists (select 1 from q)
  order by e.question_embedding <=> (select v from q)   -- HNSW cosine
  limit greatest(1, least(p_limit, 50));
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 6. WEAKNESS-ANALYSIS API
--    input : array of wrong question ids
--    output: weak domains, priority topics, and a DATA-DERIVED exam-frequency
--            signal (참고 지표). We do NOT invent an absolute "출제 확률" —
--            the field is the topic's historical share + recency, normalized,
--            and is labelled as a reference signal with uncertainty.
-- ═══════════════════════════════════════════════════════════════════
create or replace function analyze_weakness(
  p_wrong_ids uuid[],
  p_subject   text default null
) returns jsonb language sql stable as $$
  with wrong as (
    select q.domain, q.topic, q.subject
    from questions q
    where q.id = any(p_wrong_ids)
      and (p_subject is null or q.subject = p_subject)
      and q.topic is not null and q.topic <> ''
  ),
  by_topic as (
    select w.subject, w.domain, w.topic, count(*) as wrong_count
    from wrong w group by w.subject, w.domain, w.topic
  ),
  joined as (
    select bt.*, tf.total, tf.last_year, tf.years, tf.avg_difficulty,
      -- frequency signal 0..1 (share of corpus for this topic), reference only
      (tf.total::numeric / nullif((select max(total) from topic_frequency
                                   where subject = bt.subject),0)) as freq_norm,
      -- recency 0..1
      case when tf.last_year is null then 0
           else greatest(0, 1 - (extract(year from now()) - tf.last_year)/15.0) end as recency
    from by_topic bt
    left join topic_frequency tf
      on tf.subject = bt.subject and tf.topic = bt.topic
  ),
  scored as (
    select *,
      -- priority = personal weakness × exam importance (transparent blend)
      round((0.6*least(wrong_count,5)/5.0 + 0.4*coalesce(freq_norm,0))::numeric, 3) as priority
    from joined
  )
  select jsonb_build_object(
    'weak_domains', (
      select coalesce(jsonb_agg(
               jsonb_build_object('domain', domain, 'wrong_count', wc) order by wc desc
             ), '[]'::jsonb)
      from (select domain, sum(wrong_count) as wc from scored group by domain) z),
    'priority_topics', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'topic', topic, 'domain', domain, 'wrong_count', wrong_count,
        'exam_total', total, 'last_year', last_year,
        'priority', priority,
        'frequency_signal', round(coalesce(freq_norm,0),3),
        'recency', round(recency,3)
      ) order by priority desc), '[]'::jsonb) from scored),
    'note', '출제 빈도/최근성은 과거 데이터 기반 참고 지표이며 절대 확률이 아님. priority = 0.6·개인약점 + 0.4·출제비중.'
  );
$$;
