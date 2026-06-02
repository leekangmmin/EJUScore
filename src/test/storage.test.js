// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Storage Unit Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getExams, saveExam, deleteExam, getSettings, saveSettings,
  DEFAULT_SETTINGS, normalizeJapaneseScore, normalizeCompScore,
  loadSampleData,
} from '../utils/storage';

describe('storage.js', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getSettings / saveSettings', () => {
    it('returns default settings when nothing is stored', () => {
      const settings = getSettings();
      expect(settings).toMatchObject(DEFAULT_SETTINGS);
    });

    it('saves and retrieves custom settings', () => {
      const custom = { ...DEFAULT_SETTINGS, targetJapanese: 340, theme: 'light' };
      saveSettings(custom);
      const retrieved = getSettings();
      expect(retrieved.targetJapanese).toBe(340);
      expect(retrieved.theme).toBe('light');
    });

    it('preserves defaults for missing keys', () => {
      saveSettings({ targetJapanese: 350 });
      const retrieved = getSettings();
      expect(retrieved.targetJapanese).toBe(350);
      expect(retrieved.theme).toBe('dark'); // default
    });
  });

  describe('getExams / saveExam / deleteExam', () => {
    it('returns empty array initially', () => {
      expect(getExams()).toEqual([]);
    });

    it('saves a new exam', () => {
      const exam = {
        id: 'test-1',
        date: '2025-06',
        examName: '6월 모의고사',
        japanese: { reading: 150, listening: 140 },
      };
      saveExam(exam);
      const exams = getExams();
      expect(exams).toHaveLength(1);
      expect(exams[0].examName).toBe('6월 모의고사');
    });

    it('updates an existing exam by id', () => {
      const exam = { id: 'test-1', date: '2025-06', examName: '6월 모의고사' };
      saveExam(exam);
      const updated = { id: 'test-1', date: '2025-06', examName: '6월 모의고사(수정)' };
      saveExam(updated);
      const exams = getExams();
      expect(exams).toHaveLength(1);
      expect(exams[0].examName).toBe('6월 모의고사(수정)');
    });

    it('deletes an exam by id', () => {
      saveExam({ id: 'test-1', date: '2025-06', examName: 'Exam 1' });
      saveExam({ id: 'test-2', date: '2025-07', examName: 'Exam 2' });
      deleteExam('test-1');
      const exams = getExams();
      expect(exams).toHaveLength(1);
      expect(exams[0].id).toBe('test-2');
    });

    it('sorts exams by date', () => {
      saveExam({ id: '3', date: '2025-08', examName: 'Aug' });
      saveExam({ id: '1', date: '2025-06', examName: 'Jun' });
      saveExam({ id: '2', date: '2025-07', examName: 'Jul' });
      const exams = getExams();
      expect(exams.map(e => e.examName)).toEqual(['Jun', 'Jul', 'Aug']);
    });

    it('handles corrupt localStorage gracefully', () => {
      localStorage.setItem('eju_exam_data', 'not-json');
      expect(getExams()).toEqual([]);
    });
  });

  describe('loadSampleData', () => {
    it('loads 4 sample exams', () => {
      loadSampleData();
      const exams = getExams();
      expect(exams).toHaveLength(4);
      expect(exams[0].japanese.reading).toBe(148);
    });
  });

  describe('normalizeJapaneseScore', () => {
    it('returns null for null input', () => {
      expect(normalizeJapaneseScore(null)).toBeNull();
    });

    it('passes through equated scores', () => {
      const jap = { reading: 150, listening: 140 };
      const n = normalizeJapaneseScore(jap);
      expect(n.reading).toBe(150);
      expect(n.listening).toBe(140);
    });

    it('converts raw scores using rawMeta', () => {
      const jap = {
        reading: 20,
        listening: 30,
        rawMeta: { isRaw: true, readingMax: 25, listeningMax: 40 },
      };
      const n = normalizeJapaneseScore(jap);
      expect(n.reading).toBeGreaterThan(0);
      expect(n.listening).toBeGreaterThan(0);
    });
  });

  describe('normalizeCompScore', () => {
    it('returns null for null/undefined', () => {
      expect(normalizeCompScore(null)).toBeNull();
      expect(normalizeCompScore({})).toBeNull();
    });

    it('passes through equated score', () => {
      expect(normalizeCompScore({ score: 150 })).toBe(150);
    });

    it('converts raw scores', () => {
      const comp = { score: 30, rawMeta: { isRaw: true, max: 40 } };
      const n = normalizeCompScore(comp);
      expect(n).toBe(149); // 30 * 198 / 40 ≈ 149
    });
  });
});
