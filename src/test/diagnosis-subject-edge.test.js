// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Subject Classifier & Diagnosis — Edge Cases
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { classifySubject } from '../utils/subjectClassifier';
import { generateDiagnosis, getDday } from '../utils/diagnosis';

describe('subjectClassifier — edge cases', () => {
  it('classifies unknown text as unknown', () => {
    const result = classifySubject('completely random text xyz123');
    expect(result).toBe('unknown');
  });

  it('classifies text with single matching keyword', () => {
    const result = classifySubject('경제 성장');
    expect(result).toBeDefined();
  });
});

describe('diagnosis — edge cases', () => {
  it('handles exams with no wrong questions', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [], listening: [] } } },
    ];
    const result = generateDiagnosis(exams);
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles exams with comp data and wrong questions', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5, 5, 10, 10], listening: [3, 3] } }, comprehensive: { score: 80, mistakes: [{ unit: 'economy', errorType: 'concept' }] } },
      { date: '2025-02', japanese: { reading: 105, listening: 105, wrongQuestions: { reading: [], listening: [] } }, comprehensive: { score: 85, mistakes: [] } },
    ];
    const result = generateDiagnosis(exams);
    expect(result.length).toBeGreaterThan(0);
  });

  it('getDday returns null for empty date', () => {
    expect(getDday('')).toBeNull();
  });

  it('getDday returns number for valid date', () => {
    const result = getDday('2026-06-15');
    expect(typeof result).toBe('number');
  });
});
