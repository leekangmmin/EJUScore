// ═══════════════════════════════════════════════════════════════════
// Admin Data Adapter — reads REAL local OCR datasets from public/dataset.
//
// This is the single seam the whole admin talks to. Today it is backed by
// the project's real per-exam OCR JSON (public/dataset/comprehensive/**).
// To move to Supabase later (per ARCHITECTURE_V2.md), implement the same
// method signatures against `@supabase/supabase-js` and swap `activeSource`.
//
// NO fabricated data. Every field shown in the UI comes from a real file.
// ═══════════════════════════════════════════════════════════════════

const BASE = import.meta.env.BASE_URL || '/';

// Real files present in public/dataset/comprehensive (verified on disk):
// years 2002–2015, rounds 1 & 2  → 28 exam documents.
const YEARS = Array.from({ length: 2015 - 2002 + 1 }, (_, i) => 2002 + i);
const ROUNDS = [1, 2];

export const EXAM_MANIFEST = YEARS.flatMap((year) =>
  ROUNDS.map((round) => ({
    examId: `comprehensive_${year}_r${round}`,
    subject: 'comprehensive',
    year,
    round,
    path: `dataset/comprehensive/${year}/exam_${year}_r${round}.json`,
  }))
);

const DOMAIN_KO = {
  economy: '경제', politics: '정치', history: '역사',
  geography: '지리', society: '사회', unknown: '미분류',
};

const QUESTION_TYPE_KO = {
  multiple_choice: '객관식', historical_analysis: '역사분석', graph_analysis: '자료해석',
  fill_blank: '빈칸', short_answer: '단답', essay: '서술', map_analysis: '지도분석',
  data_analysis: '자료분석', unknown: '미분류', '': '미분류',
};

// ── simple in-memory cache (per session) ───────────────────
const _examCache = new Map();
let _allCache = null;

/** Normalized content key for duplicate detection (real text, deterministic). */
export function contentHash(text) {
  if (!text) return '';
  const norm = String(text)
    .replace(/[\s　,.，、。．・|｜()（）「」『』【】\[\]{}<>\-—–_=+*/\\:;!?！？"'`~@#$%^&]+/g, '')
    .toLowerCase();
  return norm.slice(0, 120);
}

/** Shannon-ish noise heuristic: ratio of CJK/alnum vs junk. Real OCR garbage scores low. */
export function textQuality(text) {
  if (!text) return 0;
  const s = String(text);
  const meaningful = (s.match(/[぀-ヿ一-龯가-힣a-zA-Z0-9]/g) || []).length;
  return s.length === 0 ? 0 : meaningful / s.length;
}

function normalizeQuestion(q, exam) {
  const rawText = q.raw_text || q.text || '';
  const cleaned = q.text || q.raw_text || '';
  return {
    id: q.id,
    examId: exam.examId,
    year: exam.year,
    round: exam.round,
    number: q.number ?? null,
    subject: q.subject || exam.subject || 'comprehensive',
    domain: q.domain || 'unknown',
    domainKo: DOMAIN_KO[q.domain] || q.domain || '미분류',
    topic: q.topic || '',
    subtopic: q.subtopic || '',
    rawText,
    cleanedText: cleaned,
    options: Array.isArray(q.answer_choices) ? q.answer_choices : [],
    optionCount: Array.isArray(q.answer_choices) ? q.answer_choices.length : 0,
    ocrConfidence: typeof q.ocr_confidence === 'number' ? q.ocr_confidence : null,
    questionType: q.question_type || 'unknown',
    questionTypeKo: QUESTION_TYPE_KO[q.question_type] ?? (q.question_type || '미분류'),
    difficulty: q.difficulty ?? null,
    wordCount: q.word_count ?? null,
    lines: q.lines ?? null,
    hasTable: (q.tables?.length || 0) > 0,
    hasDiagram: (q.diagrams?.length || 0) > 0,
    hasGraph: (q.graphs?.length || 0) > 0,
    hasMap: (q.maps?.length || 0) > 0,
    keywords: q.keywords || [],
    concepts: q.concepts || [],
    contentHash: contentHash(rawText),
    quality: textQuality(rawText),
  };
}

// ── public API (Promise-based, Supabase-swappable) ─────────

/** List all exam documents (manifest only — no fetch). */
export async function listExams() {
  return EXAM_MANIFEST.map((m) => ({ ...m }));
}

/** Load one exam document with normalized questions. */
export async function loadExam(examId) {
  if (_examCache.has(examId)) return _examCache.get(examId);
  const meta = EXAM_MANIFEST.find((m) => m.examId === examId);
  if (!meta) throw new Error(`Unknown examId: ${examId}`);
  const res = await fetch(`${BASE}${meta.path}`);
  if (!res.ok) throw new Error(`Failed to load ${meta.path} (${res.status})`);
  const doc = await res.json();
  const questions = (doc.questions || []).map((q) => normalizeQuestion(q, meta));
  const out = {
    ...meta,
    totalPages: doc.total_pages ?? doc.metadata?.doc_metadata?.total_pages ?? null,
    processedAt: doc.metadata?.processed_at || doc.processed_at || null,
    confidenceAverage:
      doc.metadata?.confidence_average ??
      (questions.length
        ? questions.reduce((s, q) => s + (q.ocrConfidence || 0), 0) / questions.length
        : null),
    totalQuestions: questions.length,
    totalTables: doc.total_tables ?? null,
    totalDiagrams: doc.total_diagrams ?? null,
    questions,
  };
  _examCache.set(examId, out);
  return out;
}

/** Load every exam (cached). Returns { exams, questions }. */
export async function loadAll({ onProgress } = {}) {
  if (_allCache) return _allCache;
  const exams = [];
  const questions = [];
  let done = 0;
  for (const meta of EXAM_MANIFEST) {
    try {
      const exam = await loadExam(meta.examId);
      exams.push(exam);
      questions.push(...exam.questions);
    } catch (e) {
      // A missing/corrupt file is skipped but recorded — never fabricated.
      exams.push({ ...meta, error: e.message, totalQuestions: 0, questions: [] });
    }
    done += 1;
    onProgress?.(done, EXAM_MANIFEST.length);
  }
  _allCache = { exams, questions };
  return _allCache;
}

/** Aggregate corpus statistics for the dashboard (all real). */
export async function getCorpusStats() {
  const { exams, questions } = await loadAll();
  const byDomain = {};
  const byType = {};
  const byYear = {};
  let lowConf = 0;
  let noisy = 0;
  let missingDomain = 0;
  let withDiagram = 0;

  const hashGroups = new Map();
  for (const q of questions) {
    byDomain[q.domainKo] = (byDomain[q.domainKo] || 0) + 1;
    byType[q.questionTypeKo] = (byType[q.questionTypeKo] || 0) + 1;
    byYear[q.year] = (byYear[q.year] || 0) + 1;
    if (q.ocrConfidence != null && q.ocrConfidence < 0.6) lowConf += 1;
    if (q.quality < 0.55) noisy += 1;
    if (q.domain === 'unknown') missingDomain += 1;
    if (q.hasDiagram || q.hasTable || q.hasGraph || q.hasMap) withDiagram += 1;
    if (q.contentHash) {
      const g = hashGroups.get(q.contentHash) || [];
      g.push(q.id);
      hashGroups.set(q.contentHash, g);
    }
  }
  const duplicateGroups = [...hashGroups.values()].filter((g) => g.length > 1);
  const duplicateCount = duplicateGroups.reduce((s, g) => s + g.length, 0);

  return {
    totalExams: exams.filter((e) => !e.error).length,
    totalQuestions: questions.length,
    yearRange: { start: Math.min(...YEARS), end: Math.max(...YEARS) },
    avgConfidence: questions.length
      ? questions.reduce((s, q) => s + (q.ocrConfidence || 0), 0) / questions.length
      : 0,
    lowConf,
    noisy,
    missingDomain,
    withDiagram,
    duplicateGroups: duplicateGroups.length,
    duplicateCount,
    byDomain,
    byType,
    byYear,
  };
}

/** Group questions that share a normalized content hash (duplicate review). */
export async function getDuplicateGroups() {
  const { questions } = await loadAll();
  const groups = new Map();
  for (const q of questions) {
    if (!q.contentHash || q.contentHash.length < 8) continue;
    const g = groups.get(q.contentHash) || [];
    g.push(q);
    groups.set(q.contentHash, g);
  }
  return [...groups.entries()]
    .filter(([, g]) => g.length > 1)
    .map(([hash, items]) => ({ hash, items }))
    .sort((a, b) => b.items.length - a.items.length);
}

export function clearCache() {
  _examCache.clear();
  _allCache = null;
}

export const META = { DOMAIN_KO, QUESTION_TYPE_KO, source: 'local' };
