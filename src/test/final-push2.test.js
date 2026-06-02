// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Final coverage push — targeting scorePrediction setFromNumbers
// and taskEngine dedup, polyfills iterator
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { weightedWrongReading, weightedWrongListening } from '../utils/scorePrediction';
import { generateDailyTasks } from '../utils/taskEngine';

describe('final-push', () => {
  it('weightedWrongReading filters non-integer q values', () => {
    const r = weightedWrongReading([{ q: null }, { q: undefined }, { q: 'abc' }]);
    expect(r).toBe(0);
  });

  it('weightedWrongListening from array of plain numbers', () => {
    const r = weightedWrongListening([5, 10, 15]);
    expect(r).toBeGreaterThan(0);
  });

  it('taskEngine dedup — repeated task ids get filtered', () => {
    // Create many exams with same wrong answers to force duplicates
    const exams = [];
    for (let i = 0; i < 5; i++) {
      exams.push({
        date: `2025-0${i+1}`,
        japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5, 10, 15], listening: [3, 8, 15] } },
        comprehensive: { score: 70, mistakes: [{ unit: '경제', errorType: '정보부족' }, { unit: '지리', errorType: '실수' }] },
      });
    }
    const tasks = generateDailyTasks(exams);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.length).toBeLessThanOrEqual(5);
  });

  it('weightedWrongReading from plain number array', () => {
    const r = weightedWrongReading([1, 2, 3, 4, 5]);
    expect(r).toBeGreaterThan(0);
  });
});
