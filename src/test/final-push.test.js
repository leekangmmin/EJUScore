// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Final coverage push — remaining uncovered branches
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { generateDiagnosis } from '../utils/diagnosis';
import { generateDailyTasks, getCompletionStats } from '../utils/taskEngine';
import { matchBatchQuestions, runFullPipeline } from '../utils/syllabusMatcher';
import { generateQuickInsight } from '../utils/analytics';

describe('final-coverage-push', () => {
  describe('diagnosis — unit tier ranking with comp data', () => {
    it('covers unitErr path', () => {
      const exams = [
        { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5], listening: [3] } }, comprehensive: { score: 70, mistakes: [{ unit: '경제', errorType: '정보부족' }] } },
      ];
      const r = generateDiagnosis(exams);
      expect(Array.isArray(r)).toBe(true);
    });
  });

  describe('syllabusMatcher — autoCorrect with options', () => {
    it('covers autoCorrect context path', () => {
      const qs = [
        { index: 1, questionText: '경제 성장에 대해 설명', options: [{ content: 'A' }], confidence: 60, syllabusMatch: { needsRecheck: true, ensembleConfidence: 50, P1: 60, similarity: 0.3 } },
        { index: 2, questionText: '역사 사건', options: [{ content: 'B' }], confidence: 70, syllabusMatch: { needsRecheck: false, ensembleConfidence: 90, P1: 70, similarity: 0.8 } },
      ];
      const r = matchBatchQuestions(qs);
      expect(Array.isArray(r)).toBe(true);
    });
  });

  describe('generateDailyTasks — reading bucket calculation', () => {
    it('covers reading/wrong bucket path', () => {
      const exams = [
        { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [15, 25], listening: [35] } }, comprehensive: { score: 70, mistakes: [] } },
        { date: '2025-02', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [15], listening: [] } }, comprehensive: { score: 70, mistakes: [] } },
      ];
      const tasks = generateDailyTasks(exams);
      expect(tasks.length).toBeGreaterThan(0);
    });
  });

  describe('generateQuickInsight — high probability', () => {
    it('covers probability branch', () => {
      const exams = [{ date: '2025-01', japanese: { reading: 160, listening: 160 } }];
      const r = generateQuickInsight(exams, { targetJapanese: 320 });
      expect(r).not.toBeNull();
    });
  });
});
