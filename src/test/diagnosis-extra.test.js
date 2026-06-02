// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Diagnosis — Extended Coverage
// Targets: edge cases in generateDiagnosis, getDday
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { generateDiagnosis, getDday } from '../utils/diagnosis';

function makeExam(date, japReading, japListening, wrongReading = [], wrongListening = [], compScore, mistakes = []) {
  return {
    id: `e-${date}`,
    date,
    examName: `Exam ${date}`,
    ...(japReading != null ? {
      japanese: {
        reading: japReading,
        listening: japListening,
        wrongQuestions: { reading: wrongReading, listening: wrongListening },
        wrongMemos: {},
      }
    } : {}),
    ...(compScore != null ? {
      comprehensive: { score: compScore, mistakes }
    } : {}),
  };
}

describe('diagnosis.js — extended', () => {
  describe('generateDiagnosis', () => {
    it('returns empty array for no exams', () => {
      expect(generateDiagnosis([])).toEqual([]);
    });

    it('returns good diagnosis when no issues found', () => {
      const exams = [
        makeExam('2025-01', 100, 100, [], []),
        makeExam('2025-02', 110, 105, [], []),
      ];
      const d = generateDiagnosis(exams);
      expect(d.length).toBeGreaterThanOrEqual(1);
      expect(d[0].level).toBe('good');
    });

    it('detects repeated wrong questions in reading', () => {
      const exams = [
        makeExam('2025-01', 100, 100, [3, 7], []),
        makeExam('2025-02', 100, 100, [3, 7], []),
        makeExam('2025-03', 100, 100, [3], []),
      ];
      const d = generateDiagnosis(exams);
      const readingWarnings = d.filter(item => item.title.includes('독해') && item.title.includes('반복'));
      expect(readingWarnings.length).toBeGreaterThan(0);
    });

    it('detects repeated wrong questions in listening', () => {
      const exams = [
        makeExam('2025-01', 100, 100, [], [2, 8]),
        makeExam('2025-02', 100, 100, [], [2, 8]),
      ];
      const d = generateDiagnosis(exams);
      const listeningWarnings = d.filter(item => item.title.includes('청해') && item.title.includes('반복'));
      expect(listeningWarnings.length).toBeGreaterThan(0);
    });

    it('detects comprehensive unit weaknesses', () => {
      const exams = [
        makeExam('2025-01', 100, 100, [], [], 100, [
          { id: 'm1', questionNumber: 1, unit: '경제', errorType: '정보부족', memo: '' },
          { id: 'm2', questionNumber: 2, unit: '경제', errorType: '정보부족', memo: '' },
          { id: 'm3', questionNumber: 3, unit: '경제', errorType: '연계사고부족', memo: '' },
        ]),
      ];
      const d = generateDiagnosis(exams);
      const compWarnings = d.filter(item => item.title.includes('종합과목'));
      expect(compWarnings.length).toBeGreaterThan(0);
    });

    it('detects score decline trend', () => {
      const exams = [
        makeExam('2025-01', 160, 140),
        makeExam('2025-02', 130, 120),
        makeExam('2025-03', 110, 100),
      ];
      const d = generateDiagnosis(exams);
      const critical = d.filter(item => item.level === 'critical' && item.title.includes('하락'));
      expect(critical.length).toBeGreaterThan(0);
    });

    it('detects uptrend', () => {
      const exams = [
        makeExam('2025-01', 100, 100),
        makeExam('2025-02', 120, 110),
        makeExam('2025-03', 140, 120),
      ];
      const d = generateDiagnosis(exams);
      const good = d.filter(item => item.level === 'good' && item.title.includes('상승'));
      expect(good.length).toBeGreaterThan(0);
    });

    it('handles comprehensive-only data', () => {
      const exams = [
        makeExam('2025-01', null, null, [], [], 150),
        makeExam('2025-02', null, null, [], [], 160),
      ];
      const d = generateDiagnosis(exams);
      expect(Array.isArray(d)).toBe(true);
    });

    it('detects stagnant scores', () => {
      const exams = [
        makeExam('2025-01', 150, 130),
        makeExam('2025-02', 151, 132),
        makeExam('2025-03', 152, 131),
      ];
      const d = generateDiagnosis(exams);
      const stagnant = d.filter(item => item.title.includes('정체'));
      expect(stagnant.length).toBeGreaterThan(0);
    });
  });

  describe('getDday', () => {
    it('returns null for no date', () => {
      expect(getDday(null)).toBeNull();
      expect(getDday('')).toBeNull();
    });

    it('returns positive number for future date', () => {
      const future = new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10);
      const dday = getDday(future);
      expect(dday).toBe(10);
    });

    it('returns negative for past date', () => {
      const past = new Date(Date.now() - 86400000 * 5).toISOString().slice(0, 10);
      const dday = getDday(past);
      expect(dday).toBeLessThan(0);
    });

    it('returns 0 for today', () => {
      const today = new Date().toISOString().slice(0, 10);
      const dday = getDday(today);
      expect(dday).toBe(0);
    });
  });
});
