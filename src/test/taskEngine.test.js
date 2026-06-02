// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Task Engine Unit Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateDailyTasks,
  getTaskRecord,
  markTaskDone,
  unmarkTaskDone,
  getTodayKey,
  getCompletionStats,
  TASK_CATEGORY,
} from '../utils/taskEngine';

function makeExam(id, date, opts = {}) {
  return {
    id: `exam-${id}`,
    date,
    examName: `Exam ${date}`,
    japanese: opts.japanese ?? { reading: 150, listening: 140 },
    comprehensive: opts.comprehensive ?? { score: 160 },
  };
}

describe('taskEngine.js', () => {
  describe('TASK_CATEGORY', () => {
    it('defines all task categories', () => {
      expect(TASK_CATEGORY.READING).toBe('독해');
      expect(TASK_CATEGORY.LISTENING).toBe('청해');
      expect(TASK_CATEGORY.COMP).toBe('종합과목');
      expect(TASK_CATEGORY.STRATEGY).toBe('전략');
      expect(TASK_CATEGORY.MOCK).toBe('모의고사');
      expect(TASK_CATEGORY.REST).toBe('회복');
    });
  });

  describe('generateDailyTasks', () => {
    it('returns default tasks for empty exams', () => {
      const tasks = generateDailyTasks([]);
      expect(tasks).toHaveLength(3);
      expect(tasks[0].category).toBe(TASK_CATEGORY.READING);
      expect(tasks[1].category).toBe(TASK_CATEGORY.LISTENING);
      expect(tasks[2].category).toBe(TASK_CATEGORY.COMP);
    });

    it('returns default tasks for null exams', () => {
      const tasks = generateDailyTasks(null);
      expect(tasks).toHaveLength(3);
    });

    it('returns default tasks for undefined exams', () => {
      const tasks = generateDailyTasks(undefined);
      expect(tasks).toHaveLength(3);
    });

    it('generates reading weak task when wrong answers exist', () => {
      const exams = [{
        id: 'exam-1',
        date: '2025-06',
        examName: 'June',
        japanese: {
          reading: 150,
          listening: 140,
          wrongQuestions: { reading: [1, 1, 3, 5, 5, 5, 7, 7, 7], listening: [] },
        },
      }];
      const tasks = generateDailyTasks(exams);
      const readingTask = tasks.find(t => t.category === TASK_CATEGORY.READING);
      expect(readingTask).toBeDefined();
      expect(readingTask.priority).toBe('high'); // 3+ occurrences
    });

    it('generates listening weak task', () => {
      const exams = [{
        id: 'exam-1',
        date: '2025-06',
        examName: 'June',
        japanese: {
          reading: 150,
          listening: 140,
          wrongQuestions: { reading: [], listening: [5, 5, 10, 15] },
        },
      }];
      const tasks = generateDailyTasks(exams);
      const listeningTask = tasks.find(t => t.category === TASK_CATEGORY.LISTENING);
      expect(listeningTask).toBeDefined();
    });

    it('generates comp unit task for repeated mistakes', () => {
      const exams = [{
        id: 'exam-1',
        date: '2025-06',
        examName: 'June',
        japanese: { reading: 150, listening: 140 },
        comprehensive: {
          score: 160,
          mistakes: [
            { unit: '경제', errorType: '정보부족' },
            { unit: '경제', errorType: '정보부족' },
            { unit: '경제', errorType: '정보부족' },
            { unit: '역사', errorType: '착각' },
          ],
        },
      }];
      const tasks = generateDailyTasks(exams);
      const compTask = tasks.find(t => t.category === TASK_CATEGORY.COMP);
      expect(compTask).toBeDefined();
      expect(compTask.title).toContain('경제');
    });

    it('generates goal sprint when near target', () => {
      const exams = [makeExam('1', '2025-06', { japanese: { reading: 180, listening: 150 } })];
      const settings = { targetJapanese: 340 };
      const tasks = generateDailyTasks(exams, settings);
      // reading 180 + listening 150 = 330, target 340, gap = 10 ≤ 20
      const sprint = tasks.find(t => t.id === 'goal_sprint');
      expect(sprint).toBeDefined();
    });

    it('limits to max 5 tasks', () => {
      // Create enough data to trigger many tasks
      const wrongReading = Array(10).fill(0).map((_, i) => i + 1);
      const exams = [{
        id: 'exam-1',
        date: '2025-06',
        examName: 'June',
        japanese: {
          reading: 180,
          listening: 150,
          wrongQuestions: { reading: wrongReading, listening: [1, 2, 3, 4, 5] },
        },
        comprehensive: {
          score: 160,
          mistakes: [
            { unit: '경제', errorType: '정보부족' },
            { unit: '경제', errorType: '정보부족' },
            { unit: '경제', errorType: '정보부족' },
          ],
        },
      }];
      const settings = { targetJapanese: 370, nextExamDate: new Date(Date.now() + 7 * 86400000).toISOString() };
      const tasks = generateDailyTasks(exams, settings);
      expect(tasks.length).toBeLessThanOrEqual(5);
    });

    it('each task has required properties', () => {
      const exams = [makeExam('1', '2025-06')];
      const tasks = generateDailyTasks(exams);
      for (const task of tasks) {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('category');
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('description');
        expect(task).toHaveProperty('duration');
        expect(task).toHaveProperty('priority');
        expect(task).toHaveProperty('difficulty');
        expect(task).toHaveProperty('color');
      }
    });
  });

  describe('getTaskRecord', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('returns empty object when no tasks recorded', () => {
      expect(getTaskRecord()).toEqual({});
    });

    it('returns record with stored data', () => {
      localStorage.setItem('eju_daily_tasks', JSON.stringify({ '2025-06-01': ['reading_weak'] }));
      const record = getTaskRecord();
      expect(record['2025-06-01']).toEqual(['reading_weak']);
    });

    it('handles corrupt data gracefully', () => {
      localStorage.setItem('eju_daily_tasks', 'not-json');
      expect(getTaskRecord()).toEqual({});
    });
  });

  describe('markTaskDone / unmarkTaskDone', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('marks a task as done for a date', () => {
      markTaskDone('reading_weak', '2025-06-01');
      const record = getTaskRecord();
      expect(record['2025-06-01']).toContain('reading_weak');
    });

    it('does not duplicate task id', () => {
      markTaskDone('reading_weak', '2025-06-01');
      markTaskDone('reading_weak', '2025-06-01');
      const record = getTaskRecord();
      expect(record['2025-06-01']).toHaveLength(1);
    });

    it('unmarks a done task', () => {
      markTaskDone('reading_weak', '2025-06-01');
      markTaskDone('listening_weak', '2025-06-01');
      unmarkTaskDone('reading_weak', '2025-06-01');
      const record = getTaskRecord();
      expect(record['2025-06-01']).toEqual(['listening_weak']);
    });
  });

  describe('getTodayKey', () => {
    it('returns today date in YYYY-MM-DD format', () => {
      const key = getTodayKey();
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(key).toBe(expected);
    });
  });

  describe('getCompletionStats', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('returns array of days with zero counts', () => {
      const stats = getCompletionStats(3);
      expect(stats).toHaveLength(3);
      for (const s of stats) {
        expect(s).toHaveProperty('date');
        expect(s).toHaveProperty('count');
        expect(s.count).toBe(0);
      }
    });

    it('includes completed tasks in stats', () => {
      const today = getTodayKey();
      markTaskDone('reading_weak', today);
      const stats = getCompletionStats(3);
      const todayStat = stats.find(s => s.date === today);
      expect(todayStat.count).toBe(1);
    });
  });
});
