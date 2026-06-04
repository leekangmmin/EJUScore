// ═══════════════════════════════════════════════════════════════════
// Admin Data Adapter — CANONICAL corpus (parsed_questions.json)
//
// This is the single seam the whole admin talks to. It is now backed
// exclusively by the canonical corpus at:
//   scripts/eju-parser/out/parsed_questions.json
//   → served at public/dataset/canonical/parsed_questions.json
//
// NO fabricated data. Every field shown in the UI comes from the
// canonical corpus.
//
// ⚠ DEPRECATED sources (do NOT use):
//   - public/dataset/comprehensive/**/*.json (per-exam OCR files)
//   - public/dataset/gold_standard/gold_standard.json
//   - public/dataset/comprehensive/dataset_consolidated.json
//   - public/dataset/mathematics/dataset_consolidated.json
//
// To move to Supabase later (per ARCHITECTURE_V2.md), implement the
// same method signatures against `@supabase/supabase-js` and swap.
// ═══════════════════════════════════════════════════════════════════

const BASE = import.meta.env.BASE_URL || '/';
const CANONICAL_PATH = 'dataset/canonical/parsed_questions.json';

// ── Domain/Type labels (kept from original) ──────────────────────────
const DOMAIN_KO = {
  economy: '경제', politics: '정치', history: '역사',
  geography: '지리', society: '사회', unknown: '미분류',
};

const SUBJECT_KO = {
  comprehensive: '종합과목',
  mathematics: '수학',
  japanese: '일본어',
};

const QUESTION_TYPE_KO = {
  multiple_choice: '객관식', historical_analysis: '역사분석', graph_analysis: '자료해석',
  fill_blank: '빈칸', short_answer: '단답', essay: '서술', map_analysis: '지도분석',
  data_analysis: '자료분석', unknown: '미분류', '': '미분류',
};

// ── In-memory cache ──────────────────────────────────────────────────
let _canonicalData = null;
let _examCache = new Map();
let _allCache = null;

/**
 * Load the canonical corpus (cached).
 * @returns {Promise<{exams: Array, questions: Array}>}
 */
async function loadCanonical() {
  if (_canonicalData) return _canonicalData;

  const res = await fetch(`${BASE}${CANONICAL_PATH}`);
  if (!res.ok) throw new Error(`Failed to load canonical corpus (${res.status})`);
  const doc = await res.json();

  // Group questions by examId to reconstruct per-exam documents
  const examMap = new Map();
  for (const q of (doc.questions || [])) {
    const examId = q.examId || `unknown_${q.year}_r${q.round}`;
    if (!examMap.has(examId)) {
      examMap.set(examId, {
        examId,
        subject: q.subject || 'unknown',
        year: q.year,
        round: q.round,
        questions: [],
      });
    }
    examMap.get(examId).questions.push(q);
  }

  _canonicalData = {
    generatedAt: doc.generatedAt,
    totalQuestions: doc.totalQuestions || doc.questions?.length || 0,
    exams: [...examMap.values()],
    questions: doc.questions || [],
  };

  console.info(`[DataAdapter] Loaded canonical corpus: ${_canonicalData.exams.length} exams, ${_canonicalData.questions.length} questions`);
  return _canonicalData;
}

/** Normalized content key for duplicate detection. */
export function contentHash(text) {
  if (!text) return '';
  const norm = String(text)
    .replace(/[\s　,.，、。．・|｜()（）「」『』【】\[\]{}<>\-—–_=+*/\\:;!?！？"'`~@#$%^&]+/g, '')
    .toLowerCase();
  return norm.slice(0, 120);
}

/** Shannon-ish noise heuristic. */
export function textQuality(text) {
  if (!text) return 0;
  const s = String(text);
  const meaningful = (s.match(/[぀-ヿ一-龯가-힣a-zA-Z0-9]/g) || []).length;
  return s.length === 0 ? 0 : meaningful / s.length;
}

function normalizeQuestion(q, exam) {
  const rawText = q.body || q.text || q.raw_text || '';
  const cleaned = q.body || q.text || q.raw_text || '';
  return {
    id: q.id,
    examId: exam?.examId || q.examId,
    year: q.year || exam?.year,
    round: q.round || exam?.round,
    number: q.questionNumber ?? q.number ?? null,
    subject: q.subject || exam?.subject || 'comprehensive',
    domain: q.domain || 'unknown',
    domainKo: DOMAIN_KO[q.domain] || q.domain || '미분류',
    topic: q.topic || '',
    subtopic: q.subtopic || '',
    rawText,
    cleanedText: cleaned,
    options: Array.isArray(q.choices) ? q.choices : (Array.isArray(q.answer_choices) ? q.answer_choices : []),
    optionCount: Array.isArray(q.choices) ? q.choices.length : (Array.isArray(q.answer_choices) ? q.answer_choices.length : 0),
    ocrConfidence: typeof q.ocr_confidence === 'number' ? q.ocr_confidence : (typeof q.ocrConfidence === 'number' ? q.ocrConfidence : null),
    questionType: q.question_type || q.questionType || 'unknown',
    questionTypeKo: QUESTION_TYPE_KO[q.question_type || q.questionType] ?? '미분류',
    difficulty: q.difficulty ?? null,
    wordCount: q.word_count ?? q.wordCount ?? null,
    lines: q.lines ?? null,
    hasTable: (q.tables?.length || q.tableCount || 0) > 0,
    hasDiagram: (q.diagrams?.length || q.diagramCount || 0) > 0,
    hasGraph: (q.graphs?.length || q.graphCount || 0) > 0,
    hasMap: (q.maps?.length || q.mapCount || 0) > 0,
    keywords: q.keywords || [],
    concepts: q.concepts || [],
    contentHash: contentHash(rawText),
    quality: textQuality(rawText),
  };
}

// ── Public API (Promise-based, Supabase-swappable) ──────────────────

/** List all exam documents (derived from canonical corpus grouping). */
export async function listExams() {
  const data = await loadCanonical();
  return data.exams.map((e) => ({
    examId: e.examId,
    subject: e.subject,
    year: e.year,
    round: e.round,
    path: `dataset/canonical/parsed_questions.json`, // all data is in one canonical file
  }));
}

/** Load one exam document with normalized questions. */
export async function loadExam(examId) {
  if (_examCache.has(examId)) return _examCache.get(examId);

  const data = await loadCanonical();
  const examGroup = data.exams.find((e) => e.examId === examId);
  if (!examGroup) throw new Error(`Unknown examId: ${examId}`);

  const questions = examGroup.questions.map((q) => normalizeQuestion(q, examGroup));
  const out = {
    ...examGroup,
    totalPages: null,
    processedAt: data.generatedAt,
    confidenceAverage: questions.length
      ? questions.reduce((s, q) => s + (q.ocrConfidence || 0), 0) / questions.length
      : null,
    totalQuestions: questions.length,
    totalTables: null,
    totalDiagrams: null,
    questions,
  };

  _examCache.set(examId, out);
  return out;
}

/** Load every exam (cached). Returns { exams, questions }. */
export async function loadAll({ onProgress } = {}) {
  if (_allCache) return _allCache;

  const data = await loadCanonical();
  const exams = [];
  const questions = [];
  let done = 0;

  for (const examGroup of data.exams) {
    try {
      const exam = await loadExam(examGroup.examId);
      exams.push(exam);
      questions.push(...exam.questions);
    } catch (e) {
      exams.push({ ...examGroup, error: e.message, totalQuestions: 0, questions: [] });
    }
    done += 1;
    onProgress?.(done, data.exams.length);
  }

  _allCache = { exams, questions };
  return _allCache;
}

/** Aggregate corpus statistics. */
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

  const years = [...new Set(questions.map((q) => q.year).filter(Boolean))];

  return {
    totalExams: exams.filter((e) => !e.error).length,
    totalQuestions: questions.length,
    yearRange: { start: Math.min(...years), end: Math.max(...years) },
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

/** Group questions sharing a normalized content hash. */
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
  _canonicalData = null;
}

export const META = { DOMAIN_KO, QUESTION_TYPE_KO, source: 'canonical' };
