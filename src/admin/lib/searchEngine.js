// ═══════════════════════════════════════════════════════════════════
// Search Engine — BM25 (CJK n-gram + IDF) + KO↔JA concept bridge.
//
// Fixes the audited flaws of the old search:
//   • old embeddingStore used a 162-word KOREAN lexicon on a JAPANESE
//     corpus → near-zero vectors. Here we tokenize the actual JA text
//     (char bigrams/trigrams) and weight by IDF (BM25), so Japanese
//     queries match. Korean/EN queries are bridged to JA surface forms.
//   • old similaritySearch was TF-only (no IDF) and unindexed. Here we
//     precompute an inverted-ish index (df + avgdl) once per subject.
//
// An optional external vector scorer (real multilingual embeddings) can
// be blended in via search(..., { vectorScores }).
// ═══════════════════════════════════════════════════════════════════
import { bridgeExpand } from './conceptBridge';

const K1 = 1.4;
const B = 0.75;

const RE_CJK = /[぀-ヿ㐀-䶿一-鿿가-힣]/;
const RE_KANA_RUN = /[ぁ-んァ-ヿ一-鿿]{2,}/g;
const RE_ALNUM = /[a-zA-Z0-9][a-zA-Z0-9_+\-=]*/g;

/** Tokenize JA/KO/EN text into BM25 terms (char n-grams for CJK). */
export function tokenize(text) {
  if (!text) return [];
  const s = String(text);
  const tokens = [];

  // CJK char bigrams + trigrams (robust to OCR spacing noise)
  const cjk = (s.match(/[぀-ヿ㐀-䶿一-鿿가-힣]/g) || []);
  for (let i = 0; i < cjk.length - 1; i++) tokens.push('b:' + cjk[i] + cjk[i + 1]);
  for (let i = 0; i < cjk.length - 2; i++) tokens.push('t:' + cjk[i] + cjk[i + 1] + cjk[i + 2]);

  // whole kana/kanji runs as strong tokens
  const runs = s.match(RE_KANA_RUN) || [];
  for (const r of runs) if (r.length >= 2 && r.length <= 12) tokens.push('w:' + r);

  // latin/number tokens
  const al = s.toLowerCase().match(RE_ALNUM) || [];
  for (const a of al) if (a.length >= 2) tokens.push('a:' + a);

  return tokens;
}

/** Build a BM25 index over a subject's questions. */
export function buildIndex(questions) {
  const docs = questions.map((q) => {
    const text = [q.text, q.topic, (q.keywords || []).join(' ')].filter(Boolean).join(' ');
    const toks = tokenize(text);
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    return { q, tf, len: toks.length || 1 };
  });

  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);

  const N = docs.length || 1;
  const avgdl = docs.reduce((s, d) => s + d.len, 0) / N;
  const idf = new Map();
  for (const [t, f] of df) idf.set(t, Math.log(1 + (N - f + 0.5) / (f + 0.5)));

  return { docs, idf, avgdl, N };
}

/**
 * Search the index with a natural-language query.
 * @returns { results, concepts, bridgedTokens } — results carry bm25/score.
 */
export function search(index, query, options = {}) {
  const { topK = 12, vectorScores = null, vectorWeight = 0.45 } = options;
  if (!index || !query || !query.trim()) return { results: [], concepts: [], bridgedTokens: [] };

  const bridge = bridgeExpand(query);
  // query terms = tokenized(query) + tokenized(each JA bridge form)
  const qText = [query, ...bridge.jaTokens].join(' ');
  const qTokens = [...new Set(tokenize(qText))];

  const bridgeDomains = new Set(bridge.domains);
  const conceptLabels = bridge.concepts.map((c) => c.label);

  let maxBm = 0;
  const scoredLex = index.docs.map((d, i) => {
    let bm = 0;
    const matched = [];
    for (const t of qTokens) {
      const f = d.tf.get(t);
      if (!f) continue;
      const idf = index.idf.get(t) || 0;
      const denom = f + K1 * (1 - B + (B * d.len) / index.avgdl);
      bm += idf * ((f * (K1 + 1)) / denom);
      if (t.startsWith('w:')) matched.push(t.slice(2));
    }
    // concept/domain boost (transparent, small)
    if (d.q.topic && conceptLabels.some((l) => l && (d.q.topic.includes(l) || l.includes(d.q.topic)))) bm *= 1.5;
    if (bridgeDomains.size && bridgeDomains.has(d.q.domain)) bm *= 1.12;
    if (bm > maxBm) maxBm = bm;
    return { i, q: d.q, bm, matched: [...new Set(matched)] };
  });

  // normalize + optional vector blend
  const results = scoredLex
    .map((r) => {
      const lex = maxBm > 0 ? r.bm / maxBm : 0;
      const vec = vectorScores ? (vectorScores[r.i] || 0) : 0;
      const score = vectorScores ? (1 - vectorWeight) * lex + vectorWeight * vec : lex;
      return { ...r, lex, vec, score };
    })
    .filter((r) => r.score > 0.001)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return { results, concepts: bridge.concepts, bridgedTokens: bridge.jaTokens };
}

/** Build "관련 개념" for a result: keywords + topic + bridge labels + co-topics. */
export function relatedConcepts(q, bridgeConcepts, coTopicMap) {
  const out = new Set();
  if (q.topic) out.add(q.topic);
  for (const k of (q.keywords || []).slice(0, 6)) out.add(k);
  for (const c of bridgeConcepts) out.add(c.label);
  // co-occurring topics in same domain (data-derived)
  if (coTopicMap && q.domain) {
    for (const t of (coTopicMap.get(q.domain) || []).slice(0, 3)) if (t !== q.topic) out.add(t);
  }
  return [...out].filter(Boolean).slice(0, 8);
}

/** Domain → frequent topics (for related-concept expansion). */
export function buildCoTopicMap(questions) {
  const byDomain = new Map();
  for (const q of questions) {
    if (!q.topic) continue;
    const m = byDomain.get(q.domain) || new Map();
    m.set(q.topic, (m.get(q.topic) || 0) + 1);
    byDomain.set(q.domain, m);
  }
  const out = new Map();
  for (const [dom, m] of byDomain) {
    out.set(dom, [...m.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t));
  }
  return out;
}

/** 추정 난이도 label (NOT 정답률 — official accuracy does not exist). */
export function difficultyLabel(difficulty) {
  if (difficulty == null) return null;
  const lvl = difficulty <= 3 ? '쉬움' : difficulty <= 6 ? '보통' : '어려움';
  return { value: difficulty, max: 10, label: lvl };
}
