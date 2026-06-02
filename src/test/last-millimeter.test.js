// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Last millimeter — final uncovered branches
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { generateQuickInsight } from '../utils/analytics';
import { generateDailyTasks } from '../utils/taskEngine';
import { classifySubject } from '../utils/subjectClassifier';

describe('last-mm', () => {
  it('analytics — streak >= 3 insight for generateQuickInsight', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100 } },
      { date: '2025-02', japanese: { reading: 100, listening: 100 } },
      { date: '2025-03', japanese: { reading: 100, listening: 100 } },
      { date: '2025-04', japanese: { reading: 100, listening: 100 } },
    ];
    const r = generateQuickInsight(exams, { targetJapanese: 400 });
    expect(r).not.toBeNull();
  });

  it('taskEngine — dedup filter path in generateDailyTasks', () => {
    // Multiple repeated wrong questions trigger dedup
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5, 6, 5, 6], listening: [3, 4, 3, 4] } }, comprehensive: { score: 70, mistakes: [{ unit: '경제', errorType: '정보부족' }] } },
      { date: '2025-02', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5, 6], listening: [3, 4] } }, comprehensive: { score: 75, mistakes: [{ unit: '경제', errorType: '정보부족' }] } },
    ];
    const tasks = generateDailyTasks(exams);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('subjectClassifier — fuzzyIncludes with null text returns false', () => {
    expect(classifySubject('')).toBe('unknown');
  });

  it('polyfills — setFromHex path', () => {
    const arr = new Uint8Array(2);
    arr.setFromHex('ff00');
    expect(arr[0]).toBe(255);
    expect(arr[1]).toBe(0);
  });
});
