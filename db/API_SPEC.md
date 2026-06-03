# API Spec — EJU AI Data Layer

Transport: **Supabase PostgREST** over HTTPS. Every endpoint is a stateless JSON
RPC, callable identically from **iPhone / iPad / Android / Desktop** (any HTTP
client). Auth via `apikey` + `Authorization: Bearer <anon|user jwt>`.

Base: `POST {SUPABASE_URL}/rest/v1/rpc/<fn>`
Headers: `apikey: <anon>`, `Authorization: Bearer <jwt>`, `Content-Type: application/json`

## Mobile-first design rules
- **Pagination everywhere** (`p_limit` capped server-side: search ≤100, similar ≤50).
- **Compact payloads**: text fields truncated (`left(text,600/400)`); request only what a list needs.
- **Stateless / cache-friendly**: pure functions; safe to cache by argument hash on-device.
- **One round trip** per screen: search returns `choices` inline + `total_count` for pager.
- **Transport compression**: PostgREST gzip; vectors never leave the server.
- **Offline tolerance**: responses are plain JSON → trivially cacheable in SQLite/IndexedDB.

---

## 1. `search_questions` — composite filter search
`POST /rpc/search_questions`
```jsonc
{
  "p_keyword": "国際連合",        // optional; FTS + CJK bigram fallback
  "p_subject": "comprehensive",   // optional
  "p_year_from": 2010,             // optional
  "p_year_to": 2015,               // optional
  "p_domain": "politics",          // optional (분야)
  "p_difficulty_min": 4,           // optional
  "p_difficulty_max": 8,           // optional
  "p_tags": ["国際連合", "헌법"],  // optional; matches ANY
  "p_limit": 20,
  "p_offset": 0
}
```
**200** → array of:
```jsonc
{
  "id": "uuid", "subject": "comprehensive", "exam_year": 2013, "exam_round": 1,
  "number": 17, "domain": "politics", "topic": "국제연합", "difficulty": 6,
  "text": "…", "choices": [{ "ordinal":0,"label":"1","text":"…","is_correct":null }],
  "rank": 0.41, "total_count": 137        // total across the filter (for paging)
}
```
All filters are AND-combined; `p_tags` is OR within the tag list.

## 2. `similar_questions` — top-N similar (pgvector)
`POST /rpc/similar_questions`
```jsonc
{ "p_question_id": "uuid", "p_limit": 20, "p_model": "bge-m3" }
```
**200** → up to 20 rows ordered by cosine similarity (self excluded):
```jsonc
{ "id":"uuid","subject":"comprehensive","exam_year":2011,"exam_round":2,
  "number":19,"domain":"politics","topic":"안전보장이사회","difficulty":7,
  "text":"…","similarity":0.83 }
```
Requires an `embeddings` row for `p_question_id` under `p_model`; otherwise returns `[]`.

## 3. `analyze_weakness` — weakness + priority + exam-frequency signal
`POST /rpc/analyze_weakness`
```jsonc
{ "p_wrong_ids": ["uuid", "uuid", "..."], "p_subject": "comprehensive" }
```
**200** → single object:
```jsonc
{
  "weak_domains": [ { "domain":"economy", "wrong_count":7 }, … ],
  "priority_topics": [
    { "topic":"환율·국제수지", "domain":"economy", "wrong_count":3,
      "exam_total":102, "last_year":2015, "priority":0.78,
      "frequency_signal":0.91, "recency":0.86 }, …
  ],
  "note": "출제 빈도/최근성은 과거 데이터 기반 참고 지표이며 절대 확률이 아님. priority = 0.6·개인약점 + 0.4·출제비중."
}
```
**Honesty:** there is **no official per-question 정답률** in the data, so this API
returns a transparent, data-derived **frequency/recency reference signal** and a blended
`priority` — never a fabricated absolute "출제 확률".

---

## Direct table reads (PostgREST auto-REST, read-only via RLS)
For simple lookups clients may also use the generated REST API, e.g.:
```
GET /rest/v1/questions?id=eq.<uuid>&select=*,choices(*),question_tags(weight,tags(name,kind))
GET /rest/v1/exams?subject=eq.comprehensive&order=exam_year.desc
```
Writes are denied to anon/auth by RLS (ingest uses the service-role key only).

## Error model
PostgREST standard: `4xx` with `{ "code","message","details","hint" }`.
Empty result sets return `200 []` (not an error).
