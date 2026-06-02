// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Storage Utils — Application-level Data Access Layer
// Now backed by the generic storage provider (src/interfaces/storage.js)
// Swapable: localStorage ↔ IndexedDB ↔ Cloud Sync
// ═══════════════════════════════════════════════════════════════════
import { setJSON, getJSON, localStorageAdapter } from '../interfaces/storage';

// For backward compatibility, we keep the same synchronous API but
// wrap the async provider. The migration to full async can happen incrementally.
// Uses localStorageAdapter directly for sync compatibility.

const KEY = 'eju_exam_data';
const SETTINGS_KEY = 'eju_settings';

export const DEFAULT_SETTINGS = {
  targetJapanese: 320,
  targetReading: 160,
  targetListening: 160,
  targetComprehensive: 170,
  theme: 'dark',
  alertThreshold: 3,
  nextExamDate: '',
};

// EJU 만점 상수 (득점등화 기준)
export const JAP_MAX = 370;
export const JAP_READ_MAX = 185;
export const JAP_LISTEN_MAX = 185;
export const COMP_MAX = 198;          // 종합과목 만점 (득점등화 후 198점)
export const COMP_QUESTIONS = 40;     // 종합과목 문항 수
export const JAP_READ_QUESTIONS = 25; // 독해 문항 수 (문제집 원점수용)
export const JAP_LISTEN_QUESTIONS = 40; // 청해 문항 수 (문제집 원점수용)
export const COMP_RAW_MAX = 200;      // 종합과목 원점수 만점 (문제집용)

// 문제집(원점수) → 득점등화점수 변환
export function normalizeJapaneseScore(jap) {
  if (!jap) return null;
  if (jap.rawMeta?.isRaw) {
    return {
      reading:   Math.round(jap.reading   * JAP_READ_MAX   / (jap.rawMeta.readingMax   || JAP_READ_QUESTIONS)),
      listening: Math.round(jap.listening * JAP_LISTEN_MAX / (jap.rawMeta.listeningMax || JAP_LISTEN_QUESTIONS)),
    };
  }
  return { reading: jap.reading, listening: jap.listening };
}

export function normalizeCompScore(comp) {
  if (!comp || comp.score == null) return null;
  if (comp.rawMeta?.isRaw) {
    return Math.round(comp.score * COMP_MAX / (comp.rawMeta.max || COMP_RAW_MAX));
  }
  return comp.score;
}

// ── Uses Adapter ───────────────────────────────────────
// These remain synchronous for backward compatibility
// but internally use the adapter pattern

export function getSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  notifyNative();
}

export function getExams() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch { return []; }
}

export function saveExam(exam) {
  const exams = getExams();
  const i = exams.findIndex(e => e.id === exam.id);
  if (i >= 0) exams[i] = exam; else exams.push(exam);
  exams.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(KEY, JSON.stringify(exams));
  notifyNative();
}

export function deleteExam(id) {
  const exams = getExams().filter(e => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(exams));
  notifyNative();
}

function notifyNative() {
  try {
    const exams = getExams();
    const s = getSettings();
    const latest = exams[exams.length - 1];
    const reversed = [...exams].reverse();

    const latestJapExam = reversed.find(e =>
      e?.japanese &&
      typeof e.japanese.reading === 'number' &&
      typeof e.japanese.listening === 'number'
    );

    const latestCompExam = reversed.find(e => {
      const c = e?.comprehensive;
      if (!c || typeof c.score !== 'number') return false;
      return c.score > 0 || (c.mistakes?.length || 0) > 0 || Boolean(c.estimateMeta?.isEstimated);
    });

    const latestJap = latestJapExam?.japanese
      ? (() => { const n = normalizeJapaneseScore(latestJapExam.japanese); return n ? n.reading + n.listening : null; })()
      : null;

    const latestComp = latestCompExam?.comprehensive
      ? normalizeCompScore(latestCompExam.comprehensive)
      : null;

    const payload = {
      examCount: exams.length,
      latestJap,
      latestComp,
      latestExamName: latest?.examName ?? null,
      targetJap: s.targetJapanese,
      targetComp: s.targetComprehensive,
    };
    window.webkit?.messageHandlers?.scoreData?.postMessage(JSON.stringify(payload));
  } catch (_) {}
}

export function loadSampleData() {
  const samples = [
    {
      id: 'sample-1', date: '2025-11', examName: '11월 EJU 모의고사 1회',
      japanese: { reading: 148, listening: 130, wrongQuestions: { reading: [3, 7, 12, 18, 25, 30, 33], listening: [2, 8, 15, 22, 35] }, wrongMemos: {} },
      comprehensive: { score: 152, mistakes: [
        { id: 's1a', questionNumber: 5, unit: '현대사', errorType: '정보부족', memo: '' },
        { id: 's1b', questionNumber: 12, unit: '경제', errorType: '연계사고부족', memo: '수요공급 그래프' },
        { id: 's1c', questionNumber: 18, unit: '지리', errorType: '실수', memo: '' },
        { id: 's1d', questionNumber: 27, unit: '정치', errorType: '정보부족', memo: '국제기구 관련' },
      ] }
    },
    {
      id: 'sample-2', date: '2025-12', examName: '12월 EJU 모의고사 2회',
      japanese: { reading: 164, listening: 138, wrongQuestions: { reading: [7, 12, 20, 28], listening: [5, 15, 22, 30, 38] }, wrongMemos: {} },
      comprehensive: { score: 168, mistakes: [
        { id: 's2a', questionNumber: 8, unit: '역사', errorType: '정보부족', memo: '메이지 유신' },
        { id: 's2b', questionNumber: 15, unit: '경제', errorType: '연계사고부족', memo: '' },
        { id: 's2c', questionNumber: 23, unit: '사회', errorType: '실수', memo: '' },
      ] }
    },
    {
      id: 'sample-3', date: '2026-01', examName: '1월 EJU 모의고사 3회',
      japanese: { reading: 172, listening: 150, wrongQuestions: { reading: [7, 18, 25], listening: [15, 22, 30] }, wrongMemos: {} },
      comprehensive: { score: 175, mistakes: [
        { id: 's3a', questionNumber: 7, unit: '경제', errorType: '연계사고부족', memo: 'GDP 계산' },
        { id: 's3b', questionNumber: 19, unit: '지리', errorType: '정보부족', memo: '' },
        { id: 's3c', questionNumber: 31, unit: '현대사', errorType: '실수', memo: '' },
      ] }
    },
    {
      id: 'sample-4', date: '2026-02', examName: '2월 EJU 모의고사 4회',
      japanese: { reading: 180, listening: 158, wrongQuestions: { reading: [18, 25], listening: [22, 30] }, wrongMemos: {} },
      comprehensive: { score: 183, mistakes: [
        { id: 's4a', questionNumber: 11, unit: '경제', errorType: '연계사고부족', memo: '' },
        { id: 's4b', questionNumber: 24, unit: '현대사', errorType: '정보부족', memo: '' },
      ] }
    },
  ];
  localStorage.setItem(KEY, JSON.stringify(samples));
  notifyNative();
}
