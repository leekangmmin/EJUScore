// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Final coverage push — cover the last uncovered lines
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { detectBurnoutRisk } from '../utils/analytics';
import { generateDailyTasks } from '../utils/taskEngine';
import { classifySubject } from '../utils/subjectClassifier';
import { getSyllabusDatabase } from '../utils/syllabusMatcher';
import { setStorageProvider, localStorageAdapter } from '../interfaces/storage';

describe('final-direct-push', () => {
  it('burnout — covers else-if drop > 10 path (drop=11)', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 120, listening: 120 } },
      { date: '2025-02', japanese: { reading: 115, listening: 115 } },
      { date: '2025-03', japanese: { reading: 109, listening: 109 } },
    ];
    const r = detectBurnoutRisk(exams);
    expect(r.reasons.some(x => x.includes('하락'))).toBe(true);
  });

  it('taskEngine — covers unitErr line 59', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5, 6], listening: [3, 4] } }, comprehensive: { score: 70, mistakes: [] } },
      { date: '2025-02', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5, 6], listening: [3, 4] } }, comprehensive: { score: 75, mistakes: [] } },
    ];
    const tasks = generateDailyTasks(exams);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('subjectClassifier — handles empty string', () => {
    expect(classifySubject('')).toBe('unknown');
  });

  it('syllabusMatcher — getSyllabusDatabase returns 38 items', () => {
    expect(getSyllabusDatabase().length).toBe(38);
  });
});
