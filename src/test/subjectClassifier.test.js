// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Subject Classifier Unit Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  scoreSubjects,
  classifySubject,
  getSubjectLabel,
  carryForwardSubjects,
  FUZZY_THRESHOLD,
  DAEMUN_RE,
} from '../utils/subjectClassifier';

describe('subjectClassifier.js', () => {
  describe('scoreSubjects', () => {
    it('returns zero scores for empty string', () => {
      const sc = scoreSubjects('');
      expect(sc.economy).toBe(0);
      expect(sc.politics).toBe(0);
      expect(sc.history).toBe(0);
      expect(sc.geography).toBe(0);
      expect(sc.society).toBe(0);
    });

    it('returns zero scores for null', () => {
      const sc = scoreSubjects(null);
      expect(sc.economy).toBe(0);
    });

    it('detects economy keywords', () => {
      const sc = scoreSubjects('GDP와 경제 성장에 관한 문제');
      expect(sc.economy).toBeGreaterThan(0);
      expect(sc.economy).toBeGreaterThan(sc.history);
    });

    it('detects history keywords with exact match (no spaces)', () => {
      const sc = scoreSubjects('시민혁명과프랑스혁명에관한설명');
      expect(sc.history).toBeGreaterThan(0);
      // '시민혁명' (critical, +5) and '프랑스혁명' (critical, +5)
      expect(sc.history).toBeGreaterThanOrEqual(10);
    });

    it('detects geography keywords', () => {
      const sc = scoreSubjects('지형도와 기후구에 관한 설명');
      expect(sc.geography).toBeGreaterThan(0);
    });

    it('detects politics keywords', () => {
      const sc = scoreSubjects('삼권분립과 일본 헌법 제9조');
      expect(sc.politics).toBeGreaterThan(0);
    });

    it('detects society keywords', () => {
      const sc = scoreSubjects('저출산고령화와 사회보장제도');
      expect(sc.society).toBeGreaterThan(0);
    });

    it('applies question number bonus', () => {
      const sc = scoreSubjects('경제 성장에 관한 문제', 30);
      expect(sc.economy).toBeGreaterThanOrEqual(2); // keyword + question hint bonus
    });

    it('scores economy higher for economic terms', () => {
      const sc = scoreSubjects('수요와 공급의 균형 시장 가격 결정');
      // With fuzzy matching, these are detected
      expect(sc.economy).toBeGreaterThan(sc.politics);
      expect(sc.economy).toBeGreaterThan(sc.history);
    });
  });

  describe('classifySubject', () => {
    it('returns unknown for very short text', () => {
      expect(classifySubject('ab')).toBe('unknown');
    });

    it('classifies economy text', () => {
      expect(classifySubject('GDP 및 국내총생산')).toBe('economy');
    });

    it('classifies history text (critical keywords, no spaces)', () => {
      expect(classifySubject('시민혁명과프랑스혁명')).toBe('history');
    });

    it('classifies geography text', () => {
      expect(classifySubject('지형도와 등고선 해석')).toBe('geography');
    });

    it('classifies politics text', () => {
      expect(classifySubject('삼권분립과 의원내각제')).toBe('politics');
    });
  });

  describe('getSubjectLabel', () => {
    it('returns Korean label for economy', () => {
      expect(getSubjectLabel('economy')).toBe('경제');
    });

    it('returns Korean label for history', () => {
      expect(getSubjectLabel('history')).toBe('역사');
    });

    it('returns Korean label for geography', () => {
      expect(getSubjectLabel('geography')).toBe('지리');
    });

    it('returns Korean label for politics', () => {
      expect(getSubjectLabel('politics')).toBe('정치');
    });

    it('returns Korean label for society', () => {
      expect(getSubjectLabel('society')).toBe('사회');
    });

    it('returns domain as-is for unknown', () => {
      expect(getSubjectLabel('unknown')).toBe('unknown');
    });
  });

  describe('carryForwardSubjects', () => {
    it('returns empty array for empty input', () => {
      expect(carryForwardSubjects([])).toEqual([]);
    });

    it('carries forward known subject to unknown items', () => {
      const items = [
        { subject: 'economy', newDaemun: false },
        { subject: 'unknown', newDaemun: false },
        { subject: 'unknown', newDaemun: false },
      ];
      const result = carryForwardSubjects(items);
      expect(result[1].subject).toBe('economy');
      expect(result[1].inherited).toBe(true);
      expect(result[2].subject).toBe('economy');
      expect(result[2].inherited).toBe(true);
    });

    it('resets carry on newDaemun', () => {
      const items = [
        { subject: 'economy', newDaemun: false },
        { subject: 'unknown', newDaemun: true },
        { subject: 'unknown', newDaemun: false },
      ];
      const result = carryForwardSubjects(items);
      expect(result[0].subject).toBe('economy');
      expect(result[1].subject).not.toBe('economy');
    });

    it('backward fills from later known subjects', () => {
      const items = [
        { subject: 'unknown', newDaemun: false },
        { subject: 'unknown', newDaemun: false },
        { subject: 'history', newDaemun: false },
      ];
      const result = carryForwardSubjects(items);
      expect(result[1].subject).toBe('history');
      expect(result[1].inherited).toBe(true);
      expect(result[0].subject).toBe('history');
    });
  });

  describe('DAEMUN_RE regex', () => {
    it('matches "問1" pattern', () => {
      expect(DAEMUN_RE.test('問1')).toBe(true);
    });

    it('matches "問 2" with space', () => {
      expect(DAEMUN_RE.test('問 2')).toBe(true);
    });

    it('matches "間3" pattern (alternate kanji)', () => {
      expect(DAEMUN_RE.test('間3')).toBe(true);
    });

    it('does not match plain text', () => {
      expect(DAEMUN_RE.test('일반 텍스트')).toBe(false);
    });
  });

  describe('FUZZY_THRESHOLD', () => {
    it('has reasonable default threshold', () => {
      expect(FUZZY_THRESHOLD).toBeGreaterThan(0.5);
      expect(FUZZY_THRESHOLD).toBeLessThan(1);
    });
  });
});
