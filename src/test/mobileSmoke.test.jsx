// Mobile render smoke test — mounts every main user-facing screen in MOBILE
// mode (useIsMobile → true) with realistic data and asserts no render crash.
// Catches "white screen on phone" bugs the unit tests don't cover.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { lazy, Suspense } from 'react';

// ── mobile environment mocks ───────────────────────────────
beforeAll(() => {
  // useIsMobile() → matchMedia('(max-width: 768px)').matches === true
  Object.defineProperty(window, 'matchMedia', {
    writable: true, configurable: true,
    value: (q) => ({
      matches: /max-width:\s*768px/.test(q),
      media: q, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
  class RO { observe() {} unobserve() {} disconnect() {} }
  globalThis.ResizeObserver = RO;
  globalThis.IntersectionObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  // engineInitializer / dataAdapter fetch → fail fast so screens render their
  // empty/loading state (must not crash on missing data).
  globalThis.fetch = vi.fn(() => Promise.reject(new Error('no network in test')));
});
afterEach(() => cleanup());

// realistic exam data (japanese + comprehensive with mistakes)
const exams = [
  { id: 'e1', date: '2025-01-15', examName: '1월 모의', japanese: { reading: 150, listening: 160, wrongQuestions: { reading: [3, 7], listening: [12] } }, comprehensive: { score: 168, mistakes: [{ topic: '환율·국제수지', domain: 'economy' }, { topic: '국제연합', domain: 'politics' }] } },
  { id: 'e2', date: '2025-03-20', examName: '3월 모의', japanese: { reading: 162, listening: 158, wrongQuestions: { reading: [5], listening: [] } }, comprehensive: { score: 174, mistakes: [{ topic: '환율·국제수지', domain: 'economy' }] } },
];
const settings = { targetJapanese: 320, targetReading: 160, targetListening: 160, targetComprehensive: 170, theme: 'dark', nextExamDate: '2025-11-09' };

const screens = {
  Dashboard: (C) => <C exams={exams} settings={settings} onEdit={() => {}} onDelete={() => {}} onDeleteAll={() => {}} onExport={() => {}} onImport={() => {}} />,
  TrendDashboard: (C) => <C exams={exams} settings={settings} onSettingsOpen={() => {}} />,
  ExamIntelligenceCenter: (C) => <C />,
  ComprehensiveAnalysis: (C) => <C exams={exams} settings={settings} onEdit={() => {}} />,
  JapaneseAnalysis: (C) => <C exams={exams} settings={settings} onEdit={() => {}} />,
  DiagnosticReport: (C) => <C exams={exams} settings={settings} />,
  DailyTasks: (C) => <C exams={exams} settings={settings} />,
  AICoach: (C) => <C exams={exams} settings={settings} />,
};

const paths = {
  Dashboard: '../components/Dashboard.jsx',
  TrendDashboard: '../components/TrendDashboard.jsx',
  ExamIntelligenceCenter: '../components/ExamIntelligenceCenter.jsx',
  ComprehensiveAnalysis: '../components/ComprehensiveAnalysis.jsx',
  JapaneseAnalysis: '../components/JapaneseAnalysis.jsx',
  DiagnosticReport: '../components/DiagnosticReport.jsx',
  DailyTasks: '../components/DailyTasks.jsx',
  AICoach: '../components/AICoach.jsx',
};

describe('mobile render smoke (no white-screen crash)', () => {
  it('useIsMobile is active in this env', () => {
    expect(window.matchMedia('(max-width: 768px)').matches).toBe(true);
  });

  for (const [name, makeEl] of Object.entries(screens)) {
    it(`${name} renders in mobile mode without throwing`, async () => {
      const mod = await import(paths[name]);
      const C = mod.default;
      let err = null;
      try {
        render(<Suspense fallback={null}>{makeEl(C)}</Suspense>);
      } catch (e) { err = e; }
      expect(err, err && `${name} crashed: ${err.message}`).toBeNull();
    });
  }
});
