// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Last attempt — cover remaining uncovered branches
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { detectBurnoutRisk, generateQuickInsight, getStudyStreak } from '../utils/analytics';
import { generateDiagnosis } from '../utils/diagnosis';
import { generateDailyTasks } from '../utils/taskEngine';

describe('last-attempt', () => {
  it('analytics — burnout drop between 11-20', () => {
    const exams2 = [];
    for (let i = 0; i < 3; i++) {
      exams2.push({
        date: `2025-0${i+1}`,
        japanese: { reading: 121 - i*6, listening: 121 - i*6 },
      });
    }
    const r = detectBurnoutRisk(exams2);
    expect(r.reasons.some(x => x.includes('하락'))).toBe(true);
  });

  it('diagnosis — covers reading bucket 21-35 and listening bucket 31-40', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [25, 25], listening: [35, 35] } } },
    ];
    const r = generateDiagnosis(exams);
    expect(Array.isArray(r)).toBe(true);
  });

  it('taskEngine — unitErr collection from comprehensive mistakes', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5], listening: [3] } }, comprehensive: { score: 70, mistakes: [{ unit: '경제', errorType: '정보부족' }] } },
      { date: '2025-02', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5], listening: [3] } }, comprehensive: { score: 75, mistakes: [{ unit: '경제', errorType: '정보부족' }] } },
    ];
    const tasks = generateDailyTasks(exams);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('diagnosis — covers reading bucket 11-20', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [15, 15], listening: [25, 25] } } },
    ];
    const r = generateDiagnosis(exams);
    expect(Array.isArray(r)).toBe(true);
  });
});
