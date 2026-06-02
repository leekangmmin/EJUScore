// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Final targeted coverage 
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { detectBurnoutRisk, generateQuickInsight } from '../utils/analytics';
import { generateDiagnosis } from '../utils/diagnosis';
import { generateDailyTasks } from '../utils/taskEngine';
import { getSyllabusItem } from '../utils/syllabusMatcher';

describe('final-targeted', () => {
  it('analytics — burnout drop=12 (between 11 and 20)', () => {
    // Scores: 118, 112, 106 → drop = 12 from first to last
    // But actually: recent[0] - recent[2] = 118 - 106 = 12
    const exams = [
      { date: '2025-01', japanese: { reading: 118, listening: 118 } },
      { date: '2025-02', japanese: { reading: 112, listening: 112 } },
      { date: '2025-03', japanese: { reading: 106, listening: 106 } },
    ];
    const r = detectBurnoutRisk(exams);
    expect(r.reasons.some(x => x.includes('하락'))).toBe(true);
  });

  it('analytics — streak >= 3 quick insight', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100 } },
      { date: '2025-02', japanese: { reading: 100, listening: 100 } },
      { date: '2025-03', japanese: { reading: 100, listening: 100 } },
      { date: '2025-04', japanese: { reading: 100, listening: 100 } },
    ];
    const r = generateQuickInsight(exams, {});
    expect(r).not.toBeNull();
  });

  it('diagnosis — unit ranking with multiple error types', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [], listening: [] } }, comprehensive: { score: 80, mistakes: [{ unit: '경제', errorType: '정보부족' }, { unit: '경제', errorType: '연계사고부족' }, { unit: '역사', errorType: '정보부족' }] } },
    ];
    const r = generateDiagnosis(exams);
    expect(Array.isArray(r)).toBe(true);
  });

  it('taskEngine — with wrong questions covering all bucket ranges', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [25, 15, 5], listening: [35, 25, 5] } }, comprehensive: { score: 70, mistakes: [{ unit: '경제', errorType: '정보부족' }] } },
      { date: '2025-02', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [25, 15], listening: [35, 25] } }, comprehensive: { score: 75, mistakes: [{ unit: '경제', errorType: '정보부족' }] } },
    ];
    const tasks = generateDailyTasks(exams);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('syllabusMatcher — getSyllabusItem basic', () => {
    expect(getSyllabusItem(1).number).toBe(1);
  });
});
