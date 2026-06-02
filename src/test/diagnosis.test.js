// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Diagnosis Unit Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { generateDiagnosis, getDday } from '../utils/diagnosis';

describe('diagnosis.js', () => {
  describe('generateDiagnosis', () => {
    it('returns empty array for empty exams', () => {
      expect(generateDiagnosis([])).toEqual([]);
    });

    it('generates diagnosis items for exam data', () => {
      const exams = [
        {
          id: '1',
          date: '2025-06',
          examName: 'Exam 1',
          japanese: {
            reading: 150,
            listening: 140,
            wrongQuestions: { reading: [3, 7, 7], listening: [5, 15] },
          },
          comprehensive: {
            score: 160,
            mistakes: [
              { unit: '경제', errorType: '정보부족' },
              { unit: '경제', errorType: '정보부족' },
            ],
          },
        },
        {
          id: '2',
          date: '2025-07',
          examName: 'Exam 2',
          japanese: {
            reading: 165,
            listening: 145,
            wrongQuestions: { reading: [7, 18], listening: [15] },
          },
          comprehensive: { score: 170, mistakes: [] },
        },
        {
          id: '3',
          date: '2025-08',
          examName: 'Exam 3',
          japanese: {
            reading: 180,
            listening: 155,
            wrongQuestions: { reading: [7], listening: [15] },
          },
          comprehensive: { score: 165, mistakes: [] },
        },
      ];
      const diag = generateDiagnosis(exams);
      expect(diag.length).toBeGreaterThan(0);
      // Should detect repeated wrong questions
      const hasReadingWarning = diag.some(d => d.title.includes('독해'));
      expect(hasReadingWarning).toBe(true);
    });
  });

  describe('getDday', () => {
    it('returns null for empty date', () => {
      expect(getDday('')).toBeNull();
    });

    it('returns positive days for future dates', () => {
      const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const dday = getDday(future);
      expect(dday).toBeGreaterThan(0);
      expect(dday).toBeLessThanOrEqual(7);
    });

    it('returns negative days for past dates', () => {
      const past = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const dday = getDday(past);
      expect(dday).toBeLessThan(0);
    });
  });
});
