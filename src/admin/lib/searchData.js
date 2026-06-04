// ═══════════════════════════════════════════════════════════════════
// Search Data Loader — CANONICAL corpus (parsed_questions.json)
//
// Reads the single canonical corpus from
//   public/dataset/canonical/parsed_questions.json
// and provides per-subject question arrays for the search engine.
//
// ⚠ OLD sources (DEPRECATED):
//   - public/dataset/search_manifest.json (per-exam manifest)
//   - public/dataset/comprehensive/**/*.json (per-exam OCR files)
//   - public/dataset/mathematics/**/*.json (per-exam math files)
// ═══════════════════════════════════════════════════════════════════

const BASE = import.meta.env.BASE_URL || '/';
const CANONICAL_PATH = 'dataset/canonical/parsed_questions.json';

export const SUBJECTS = [
  { id: 'comprehensive', label: '종합과목', short: '종합' },
  { id: 'mathematics', label: '수학', short: '수학' },
  { id: 'japanese', label: '일본어', short: '일본어' },
];

const DOMAIN_KO = {
  economy: '경제', politics: '정치', history: '역사', geography: '지리', society: '사회',
  algebra: '대수', calculus: '미적분', vector: '벡터', geometry: '기하',
  probability: '확률', sequence: '수열', function: '함수', trig: '삼각함수',
  unknown: '미분류', '': '미분류',
};

let _canonicalData = null;
const _subjectCache = new Map();

async function loadCanonical() {
  if (_canonicalData) return _canonicalData;
  const res = await fetch(`${BASE}${CANONICAL_PATH}`);
  if (!res.ok) throw new Error(`canonical corpus load failed (${res.status})`);
  _canonicalData = await res.json();
  console.info(`[SearchData] Loaded canonical corpus: ${_canonicalData.questions?.length || 0} questions`);
  return _canonicalData;
}

function normalize(q, subject) {
  const rawText = q.body || q.text || q.raw_text || '';
  return {
    id: q.id,
    subject,
    year: q.year,
    round: q.round,
    number: q.questionNumber ?? q.number ?? null,
    domain: q.domain || 'unknown',
    domainKo: DOMAIN_KO[q.domain] || q.domain || '미분류',
    topic: q.topic || '',
    subtopic: q.subtopic || '',
    text: q.body || q.text || rawText,
    rawText,
    options: Array.isArray(q.choices) ? q.choices : (Array.isArray(q.answer_choices) ? q.answer_choices : []),
    difficulty: typeof q.difficulty === 'number' ? q.difficulty : null,
    ocrConfidence: typeof q.ocr_confidence === 'number' ? q.ocr_confidence : null,
    questionType: q.question_type || q.questionType || 'unknown',
    keywords: Array.isArray(q.keywords) ? q.keywords : [],
    concepts: Array.isArray(q.concepts) ? q.concepts : [],
  };
}

/** Load + normalize all questions for one subject (cached). */
export async function loadSubject(subject) {
  if (_subjectCache.has(subject)) return _subjectCache.get(subject);

  const data = await loadCanonical();
  const questions = (data.questions || [])
    .filter((q) => q.subject === subject)
    .map((q) => normalize(q, subject))
    .filter((n) => n.text && n.text.length >= 2);

  _subjectCache.set(subject, questions);
  return questions;
}

/** Topic → list of {year, round} it appears in (real 출제년도). */
export function topicYearIndex(questions) {
  const idx = new Map();
  for (const q of questions) {
    if (!q.topic) continue;
    const arr = idx.get(q.topic) || [];
    arr.push({ year: q.year, round: q.round });
    idx.set(q.topic, arr);
  }
  return idx;
}

export { DOMAIN_KO };
