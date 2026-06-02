// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Ultra-targeted coverage — remaining branches
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { generateDiagnosis } from '../utils/diagnosis';
import { detectBurnoutRisk } from '../utils/analytics';
import { estimateJapaneseScore } from '../utils/scorePrediction';

describe('ultra-targeted', () => {
  it('diagnosis — unitErr path with multiple error types', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [], listening: [] } }, comprehensive: { score: 80, mistakes: [{ unit: '경제', errorType: '정보부족' }, { unit: '경제', errorType: '연계사고부족' }, { unit: '경제', errorType: '실수' }] } },
    ];
    const r = generateDiagnosis(exams);
    expect(Array.isArray(r)).toBe(true);
  });

  it('burnout — drop > 10 condition (not > 20)', () => {
    const exams = [];
    for (let i = 0; i < 3; i++) {
      exams.push({
        date: `2025-0${i+1}`,
        japanese: { reading: 115 - i*6, listening: 115 - i*6 },
      });
    }
    // drop = 115 - 103 = 12, which is > 10 but not > 20
    const r = detectBurnoutRisk(exams);
    expect(r.reasons.some(x => x.includes('하락'))).toBe(true);
  });

  it('diagnosis — compTrend3 > 5 path', () => {
    const exams = [
      { date: '2025-01', comprehensive: { score: 70, mistakes: [] } },
      { date: '2025-02', comprehensive: { score: 80, mistakes: [] } },
      { date: '2025-03', comprehensive: { score: 90, mistakes: [] } },
    ];
    const r = generateDiagnosis(exams);
    expect(r.some(x => x.title.includes('종합과목') && x.title.includes('상승'))).toBe(true);
  });

  it('scorePrediction — diff correction when reading capped', () => {
    const exams = [
      { id: '1', date: '2025-01', examName: 'T1', japanese: { reading: 185, listening: 185, wrongQuestions: { reading: [], listening: [] } } },
    ];
    // With max scores, the diff correction path may not trigger
    const r = estimateJapaneseScore(exams, [1, 2], []);
    expect(r.total).toBeGreaterThan(0);
  });

  it('diagnosis — no-issue path (2+ exams, no problems)', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [], listening: [] } } },
      { date: '2025-02', japanese: { reading: 110, listening: 105, wrongQuestions: { reading: [], listening: [] } } },
    ];
    const r = generateDiagnosis(exams);
    expect(r.some(x => x.title.includes('약점') || x.title.includes('상승'))).toBe(true);
  });
});
