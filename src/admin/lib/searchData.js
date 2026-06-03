// ═══════════════════════════════════════════════════════════════════
// Search Data Loader — multi-subject, manifest-driven (REAL files).
//
// Reads public/dataset/search_manifest.json (auto-generated from disk)
// then fetches per-exam JSON for 종합/수학. 일본어 has no corpus → empty.
// Kept separate from dataAdapter.js so existing admin pages are untouched.
// ═══════════════════════════════════════════════════════════════════

const BASE = import.meta.env.BASE_URL || '/';

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

let _manifest = null;
const _subjectCache = new Map();

export async function getManifest() {
  if (_manifest) return _manifest;
  const res = await fetch(`${BASE}dataset/search_manifest.json`);
  if (!res.ok) throw new Error(`manifest load failed (${res.status})`);
  _manifest = await res.json();
  return _manifest;
}

function normalize(q, exam, subject) {
  const rawText = q.raw_text || q.text || '';
  return {
    id: q.id,
    subject,
    year: exam.year,
    round: exam.round,
    number: q.number ?? null,
    domain: q.domain || 'unknown',
    domainKo: DOMAIN_KO[q.domain] || q.domain || '미분류',
    topic: q.topic || '',
    subtopic: q.subtopic || '',
    text: q.text || rawText,
    rawText,
    options: Array.isArray(q.answer_choices) ? q.answer_choices : [],
    difficulty: typeof q.difficulty === 'number' ? q.difficulty : null,
    ocrConfidence: typeof q.ocr_confidence === 'number' ? q.ocr_confidence : null,
    questionType: q.question_type || 'unknown',
    keywords: Array.isArray(q.keywords) ? q.keywords : [],
    concepts: Array.isArray(q.concepts) ? q.concepts : [],
  };
}

/** Load + normalize all questions for one subject (cached). */
export async function loadSubject(subject) {
  if (_subjectCache.has(subject)) return _subjectCache.get(subject);
  const manifest = await getManifest();
  const files = manifest.subjects?.[subject] || [];
  const questions = [];
  for (const meta of files) {
    try {
      const res = await fetch(`${BASE}${meta.path}`);
      if (!res.ok) continue;
      const doc = await res.json();
      for (const q of doc.questions || []) {
        const n = normalize(q, meta, subject);
        if (n.rawText && n.rawText.length >= 2) questions.push(n);
      }
    } catch { /* skip unreadable file, never fabricate */ }
  }
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
