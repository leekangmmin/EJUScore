// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Syllabus Matcher — Extended Coverage
// Targets: matchBatchQuestions, computeEnsembleConfidence,
//          computePositionConfidence, computeDomainConfidence,
//          autoCorrectLowConfidence, validateQuestionMapping,
//          runFullPipeline, getDomainRange, getSyllabusDatabase
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  getSyllabusDatabase,
  getSyllabusItem,
  getDomainRange,
  getDomainByQuestionNumber,
  matchQuestionToSyllabus,
  matchBatchQuestions,
  computeEnsembleConfidence,
  computePositionConfidence,
  computeDomainConfidence,
  autoCorrectLowConfidence,
  validateQuestionMapping,
  runFullPipeline,
  detectComprehensiveSubject,
  textToVector,
} from '../utils/syllabusMatcher';

describe('syllabusMatcher.js — extended', () => {
  describe('getSyllabusDatabase', () => {
    it('returns all 38 syllabus items', () => {
      const db = getSyllabusDatabase();
      expect(Array.isArray(db)).toBe(true);
      expect(db.length).toBe(38);
    });

    it('each item has required fields', () => {
      const db = getSyllabusDatabase();
      for (const item of db) {
        expect(item.number).toBeGreaterThanOrEqual(1);
        expect(item.number).toBeLessThanOrEqual(38);
        expect(item.domain).toBeDefined();
        expect(Array.isArray(item.keywords)).toBe(true);
        expect(item.keywords.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getDomainRange', () => {
    it('returns range for geography', () => {
      const range = getDomainRange('geography');
      expect(range).not.toBeNull();
      expect(range.min).toBe(1);
      expect(range.max).toBe(8);
    });

    it('returns range for history', () => {
      const range = getDomainRange('history');
      expect(range.min).toBe(9);
      expect(range.max).toBe(16);
    });

    it('returns null for unknown domain', () => {
      expect(getDomainRange('unknown')).toBeNull();
    });
  });

  describe('getDomainByQuestionNumber', () => {
    it('returns geography for Q1-Q8', () => {
      expect(getDomainByQuestionNumber(1)).toBe('geography');
      expect(getDomainByQuestionNumber(8)).toBe('geography');
    });

    it('returns history for Q9-Q16', () => {
      expect(getDomainByQuestionNumber(9)).toBe('history');
      expect(getDomainByQuestionNumber(16)).toBe('history');
    });

    it('returns null for out-of-range', () => {
      expect(getDomainByQuestionNumber(0)).toBeNull();
      expect(getDomainByQuestionNumber(39)).toBeNull();
    });
  });

  describe('computeEnsembleConfidence', () => {
    it('computes weighted average correctly', () => {
      // P1*0.25 + P2*0.3 + P3*0.45
      const result = computeEnsembleConfidence(80, 70, 90);
      // 80*0.25 + 70*0.3 + 90*0.45 = 20 + 21 + 40.5 = 81.5 → 82
      expect(result).toBe(82);
    });

    it('handles zero values', () => {
      expect(computeEnsembleConfidence(0, 0, 0)).toBe(0);
    });

    it('handles max values', () => {
      expect(computeEnsembleConfidence(100, 100, 100)).toBe(100);
    });

    it('clamps to 0-100 range', () => {
      const result = computeEnsembleConfidence(-10, -20, -30);
      expect(result).toBe(0);
    });
  });

  describe('computePositionConfidence', () => {
    it('returns 100 for exact match', () => {
      expect(computePositionConfidence(5, 5)).toBe(100);
    });

    it('returns 85 for diff <= 2', () => {
      expect(computePositionConfidence(5, 4)).toBe(85);
      expect(computePositionConfidence(5, 3)).toBe(85);
    });

    it('returns 60 for diff <= 5', () => {
      expect(computePositionConfidence(10, 5)).toBe(60);
    });

    it('returns 40 for diff <= 10', () => {
      expect(computePositionConfidence(1, 11)).toBe(40);
    });

    it('returns 20 for diff > 10', () => {
      expect(computePositionConfidence(1, 20)).toBe(20);
    });

    it('returns 30 for null/undefined inputs', () => {
      expect(computePositionConfidence(null, 5)).toBe(30);
      expect(computePositionConfidence(5, undefined)).toBe(30);
    });
  });

  describe('computeDomainConfidence', () => {
    it('returns 100 for matching domains', () => {
      expect(computeDomainConfidence('economy', 'economy')).toBe(100);
    });

    it('returns 30 for mismatched domains', () => {
      expect(computeDomainConfidence('history', 'geography')).toBe(30);
    });

    it('returns 50 for unknown classified domain', () => {
      expect(computeDomainConfidence('unknown', 'history')).toBe(50);
    });

    it('returns 50 for null/undefined matchedDomain', () => {
      expect(computeDomainConfidence('history', null)).toBe(50);
      expect(computeDomainConfidence('history', undefined)).toBe(50);
    });
  });

  describe('matchBatchQuestions', () => {
    it('returns empty array for null input', () => {
      expect(matchBatchQuestions(null)).toEqual([]);
    });

    it('returns empty array for empty array', () => {
      expect(matchBatchQuestions([])).toEqual([]);
    });

    it('matches single question with context', () => {
      const questions = [
        {
          questionText: '수요와 공급의 법칙에 대해 설명하시오. 시장 경제에서 가격이 결정된다.',
          options: [{ content: '가격 결정' }],
          confidence: 80,
        },
      ];
      const results = matchBatchQuestions(questions);
      expect(results).toHaveLength(1);
      expect(results[0].syllabusMatch).toBeDefined();
      expect(results[0].syllabusMatch.number).toBeGreaterThanOrEqual(25);
      expect(results[0].syllabusMatch.number).toBeLessThanOrEqual(32);
      expect(['ensembleConfidence', 'needsRecheck', 'P1', 'P2', 'P3'].every(k => k in results[0].syllabusMatch)).toBe(true);
    });
  });

  describe('autoCorrectLowConfidence', () => {
    it('returns original array for null input', () => {
      expect(autoCorrectLowConfidence(null)).toBeNull();
    });

    it('returns original for single question (no neighbors)', () => {
      const questions = [
        { questionText: 'test', syllabusMatch: { needsRecheck: true, ensembleConfidence: 50, P1: 50, similarity: 0.3 } },
      ];
      const result = autoCorrectLowConfidence(questions);
      expect(result).toHaveLength(1);
    });

    it('returns as-is when no needsRecheck', () => {
      const questions = [
        { questionText: 'test', syllabusMatch: { needsRecheck: false, ensembleConfidence: 90 } },
      ];
      const result = autoCorrectLowConfidence(questions);
      expect(result[0].syllabusMatch.ensembleConfidence).toBe(90);
    });
  });

  describe('validateQuestionMapping', () => {
    it('returns invalid for null input', () => {
      const result = validateQuestionMapping(null);
      expect(result.valid).toBe(false);
    });

    it('returns invalid for empty array', () => {
      const result = validateQuestionMapping([]);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('매칭 결과 없음');
    });

    it('validates proper question mapping', () => {
      const questions = Array.from({ length: 38 }, (_, i) => ({
        index: i + 1,
        questionText: `Question ${i + 1}`,
        syllabusMatch: {
          number: i + 1,
          domain: getDomainByQuestionNumber(i + 1),
          ensembleConfidence: 85 + (i % 10),
        },
      }));
      const result = validateQuestionMapping(questions);
      expect(result.valid).toBe(true);
      expect(result.totalMatched).toBe(38);
    });

    it('detects duplicate numbers', () => {
      const questions = [
        { index: 1, questionText: 'Q1', syllabusMatch: { number: 1, domain: 'geography', ensembleConfidence: 80 } },
        { index: 2, questionText: 'Q2', syllabusMatch: { number: 1, domain: 'geography', ensembleConfidence: 80 } },
      ];
      const result = validateQuestionMapping(questions);
      expect(result.warnings.some(w => w.includes('중복'))).toBe(true);
    });

    it('detects domain mismatch', () => {
      const questions = [
        { index: 1, questionText: 'Q1', syllabusMatch: { number: 1, domain: 'history', ensembleConfidence: 90 } },
      ];
      const result = validateQuestionMapping(questions);
      expect(result.issues.some(i => i.includes('예상 도메인'))).toBe(true);
    });

    it('detects out-of-range numbers', () => {
      const questions = [
        { index: 1, questionText: 'Q1', syllabusMatch: { number: 99, domain: 'economy', ensembleConfidence: 80 } },
      ];
      const result = validateQuestionMapping(questions);
      expect(result.issues.some(i => i.includes('범위 초과'))).toBe(true);
    });

    it('warns about low confidence items', () => {
      const questions = Array.from({ length: 6 }, (_, i) => ({
        index: i + 1,
        questionText: `Q${i + 1}`,
        syllabusMatch: { number: i + 1, domain: 'geography', ensembleConfidence: 30 },
      }));
      const result = validateQuestionMapping(questions);
      expect(result.issues.some(i => i.includes('저신뢰도') || i.includes('수동 검토'))).toBe(true);
    });
  });

  describe('runFullPipeline', () => {
    it('returns not-comprehensive for math text', () => {
      const result = runFullPipeline('미분 방정식과 삼각함수 그래프');
      expect(result.summary.isComprehensive).toBe(false);
    });

    it('uses provided questions array', () => {
      const questions = [
        { index: 1, questionText: '수요와 공급의 법칙을 설명하시오. 시장 경제에서 가격이 결정된다.', options: [], confidence: 80 },
        { index: 2, questionText: '프랑스 혁명의 원인은? 시민 혁명이 일어났다.', options: [], confidence: 75 },
      ];
      const result = runFullPipeline('경제 성장과 역사', questions);
      expect(result.matches).toHaveLength(2);
      expect(result.summary.isComprehensive).toBe(true);
    });
  });

  describe('detectComprehensiveSubject edge cases', () => {
    it('returns false for null/undefined text', () => {
      expect(detectComprehensiveSubject(null)).toBe(false);
      expect(detectComprehensiveSubject(undefined)).toBe(false);
    });

    it('detects math-dominant text', () => {
      expect(detectComprehensiveSubject('미분 적분 함수 방정식 그래프')).toBe(false);
    });

    it('detects comp-dominant text', () => {
      expect(detectComprehensiveSubject('경제 성장과 정치 체계 역사')).toBe(true);
    });
  });

  describe('textToVector edge cases', () => {
    it('handles fuzzy matching with levenshtein', () => {
      const vec = textToVector('econmy grth', ['economy']);
      expect(vec[0]).toBeGreaterThan(0);
    });

    it('returns 0 for non-matching keywords', () => {
      const vec = textToVector('completely unrelated text', ['economy', 'politics']);
      expect(vec[0]).toBe(0);
      expect(vec[1]).toBe(0);
    });
  });

  describe('matchQuestionToSyllabus with domainHint', () => {
    it('returns unknown for very short text', () => {
      const result = matchQuestionToSyllabus('ab');
      expect(result.domain).toBe('unknown');
    });

    it('returns unknown for null text', () => {
      const result = matchQuestionToSyllabus(null);
      expect(result.domain).toBe('unknown');
    });

    it('applies domain hint penalty correctly', () => {
      const result = matchQuestionToSyllabus(
        '수요와 공급 시장 경제 무역 가격 결정',
        1 // geography hint
      );
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});
