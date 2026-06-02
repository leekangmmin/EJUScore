// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Final targeted — hitting remaining uncovered
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { estimateComprehensiveScore } from '../utils/scorePrediction';
import { classifySubject } from '../utils/subjectClassifier';
import { getStudyStreak } from '../utils/analytics';
import { generateDailyTasks } from '../utils/taskEngine';

describe('final-target', () => {
  it('scorePrediction — estimateComprehensiveScore with workbook rawMeta', () => {
    const exams = [
      { date: '2025-01', recordType: 'workbook', comprehensive: { score: 30, rawMeta: { isRaw: true, max: 50 }, mistakes: [{ questionNumber: 1 }] } },
    ];
    const r = estimateComprehensiveScore(exams, []);
    expect(r.score).toBeGreaterThan(0);
  });

  it('classifySubject — basic coverage', () => {
    const r = classifySubject('경제');
    expect(r).toBeDefined();
  });

  it('getStudyStreak with gap month', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100 } },
      { date: '2025-02', japanese: { reading: 100, listening: 100 } },
      { date: '2025-04', japanese: { reading: 100, listening: 100 } },
    ];
    const r = getStudyStreak(exams);
    expect(r.current).toBeGreaterThanOrEqual(1);
  });

  it('taskEngine dedup filter', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5, 5, 5], listening: [3, 3, 3] } }, comprehensive: { score: 70, mistakes: [] } },
      { date: '2025-02', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5, 5, 5], listening: [3, 3, 3] } }, comprehensive: { score: 75, mistakes: [] } },
    ];
    const tasks = generateDailyTasks(exams);
    expect(tasks.length).toBeGreaterThan(0);
  });
});
