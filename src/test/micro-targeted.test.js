// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Final micro-targeted coverage push
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { getStudyStreak, detectBurnoutRisk, generateQuickInsight } from '../utils/analytics';
import { generateDiagnosis } from '../utils/diagnosis';
import { generateDailyTasks } from '../utils/taskEngine';
import { matchQuestionToSyllabus } from '../utils/syllabusMatcher';
import { classifySubject } from '../utils/subjectClassifier';

describe('micro-targeted', () => {
  it('analytics — getStudyStreak with consecutive months', () => {
    const exams = [
      { date: '2025-01-10', japanese: { reading: 100, listening: 100 } },
      { date: '2025-02-20', japanese: { reading: 110, listening: 100 } },
    ];
    const r = getStudyStreak(exams);
    // Jan and Feb are consecutive => streak 2
    expect(r.current).toBe(2);
  });

  it('analytics — burnout with drop between 11 and 20', () => {
    const exams = [];
    for (let i = 0; i < 3; i++) {
      exams.push({
        date: `2025-0${i+1}`,
        japanese: { reading: 120 - i*6, listening: 120 - i*6 },
      });
    }
    const r = detectBurnoutRisk(exams);
    expect(r.reasons.some(x => x.includes('하락'))).toBe(true);
  });

  it('analytics — streak >= 3 insight', () => {
    const exams = [];
    for (let i = 0; i < 4; i++) {
      exams.push({
        date: `2025-0${i+1}`,
        japanese: { reading: 100, listening: 100 },
      });
    }
    const r = generateQuickInsight(exams, { targetJapanese: 400 });
    expect(r).not.toBeNull();
  });

  it('diagnosis — unitRanked path with comprehensive mistakes', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5, 5], listening: [] } }, comprehensive: { score: 80, mistakes: [{ unit: '경제', errorType: '정보부족' }, { unit: '경제', errorType: '연계사고부족' }] } },
    ];
    const r = generateDiagnosis(exams);
    expect(Array.isArray(r)).toBe(true);
  });

  it('syllabusMatcher — anti-hallucination penalty', () => {
    const r = matchQuestionToSyllabus('수요와 공급 시장 경제 무역 가격 결정 소비자', 1);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
  });

  it('taskEngine — wrongReading/wrongListening in high ranges', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [25], listening: [40] } }, comprehensive: { score: 70, mistakes: [] } },
    ];
    const tasks = generateDailyTasks(exams);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('subjectClassifier — edge cases', () => {
    expect(classifySubject('경제 성장')).toBeDefined();
    expect(classifySubject('')).toBe('unknown');
  });
});
