// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Syllabus Matcher Unit Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  cosineSimilarity,
  textToVector,
  matchQuestionToSyllabus,
  getSyllabusItem,
  detectComprehensiveSubject,
} from '../utils/syllabusMatcher';

describe('syllabusMatcher.js', () => {
  describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('returns length for completely different strings', () => {
      expect(levenshteinDistance('abc', 'xyz')).toBe(3);
    });

    it('handles empty strings', () => {
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('abc', '')).toBe(3);
    });

    it('handles single character edits', () => {
      expect(levenshteinDistance('cat', 'car')).toBe(1);
    });
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
    });

    it('returns 0 for orthogonal vectors', () => {
      expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
    });

    it('returns 0 for empty vectors', () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it('returns value between 0 and 1 for partial match', () => {
      const sim = cosineSimilarity([1, 1, 0], [1, 0, 1]);
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1);
    });
  });

  describe('textToVector', () => {
    it('returns empty array for empty text', () => {
      const vec = textToVector('', ['test']);
      expect(vec).toEqual([]);  // returns [] because !text is truthy
    });

    it('returns empty array for undefined keywordDict', () => {
      const vec = textToVector('some text');
      expect(vec).toEqual([]);
    });

    it('finds matching keywords', () => {
      const vec = textToVector('환율과 경제 성장', ['경제', '정치', '사회']);
      expect(vec[0]).toBeGreaterThan(0); // 경제 found
    });
  });

  describe('matchQuestionToSyllabus', () => {
    it('returns unknown for very short text', () => {
      const r = matchQuestionToSyllabus('ab');
      expect(r.domain).toBe('unknown');
    });

    it('matches economy keywords', () => {
      const r = matchQuestionToSyllabus('수요와 공급의 균형에 대해 설명하시오. 시장 가격은 수요와 공급에 의해 결정된다.');
      expect(r.domain).toBe('economy');
      expect(r.number).toBeGreaterThanOrEqual(25);
      expect(r.number).toBeLessThanOrEqual(32);
    });

    it('matches history keywords', () => {
      const r = matchQuestionToSyllabus('프랑스 혁명의 원인과 결과에 대해 서술하시오. 시민 혁명이 일어났다.');
      expect(r.domain).toBe('history');
    });
  });

  describe('getSyllabusItem', () => {
    it('returns item for valid number', () => {
      const item = getSyllabusItem(1);
      expect(item).not.toBeNull();
      expect(item.domain).toBe('geography');
    });

    it('returns null for invalid number', () => {
      expect(getSyllabusItem(99)).toBeNull();
    });
  });

  describe('detectComprehensiveSubject', () => {
    it('returns true for comp keywords', () => {
      expect(detectComprehensiveSubject('경제 성장과 정치 체계')).toBe(true);
    });

    it('returns false for math keywords', () => {
      const result = detectComprehensiveSubject('미분 방정식과 삼각함수 그래프');
      expect(result).toBe(false);
    });
  });
});
