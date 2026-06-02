// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Task Engine — Extended Edge Cases
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  generateDailyTasks,
  getTaskRecord,
  markTaskDone,
  unmarkTaskDone,
  getCompletionStats,
  getTodayKey,
} from '../utils/taskEngine';

describe('taskEngine.js — edge cases', () => {
  describe('getTaskRecord', () => {
    it('handles non-object corrupt data', () => {
      localStorage.setItem('eju_task_record', 'not json');
      const record = getTaskRecord();
      expect(typeof record).toBe('object');
    });
  });

  describe('markTaskDone with corrupt data', () => {
    it('survives corrupt localStorage', () => {
      localStorage.setItem('eju_task_record', 'corrupt');
      expect(() => markTaskDone('test-id')).not.toThrow();
      // After marking, state may be fresh
      const record = getTaskRecord();
      expect(typeof record).toBe('object');
    });
  });

  describe('unmarkTaskDone', () => {
    it('handles missing date key gracefully', () => {
      expect(() => unmarkTaskDone('nonexistent')).not.toThrow();
    });
  });

  describe('generateDailyTasks', () => {
    it('handles exams with reading wrong questions in range 21-25', () => {
      const exams = [
        { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [25], listening: [35] } } },
      ];
      const tasks = generateDailyTasks(exams);
      expect(tasks.length).toBeGreaterThan(0);
    });

    it('generates stagnation task when stagnant', () => {
      const exams = [];
      for (let i = 0; i < 4; i++) {
        exams.push({
          date: `2025-0${i+1}`,
          japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [], listening: [] } },
          comprehensive: { score: 70, mistakes: [] },
        });
      }
      const tasks = generateDailyTasks(exams);
      expect(tasks.length).toBeGreaterThan(0);
    });
  });
});
