// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// AI Engine — Comprehensive Coverage (buildPrompt, edge cases)
// Tests the internal buildPrompt indirectly via generateFeedback
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerate = vi.fn().mockResolvedValue(undefined);
const mockCleanup = vi.fn();
const mockOnToken = vi.fn();
const mockOnProgress = vi.fn();
const mockLoad = vi.fn().mockResolvedValue(undefined);

function setMockAPI() {
  window.electronAPI = {
    ai: {
      load: mockLoad,
      generate: mockGenerate,
      cleanup: mockCleanup,
      onProgress: mockOnProgress,
      onToken: mockOnToken,
    },
  };
}

describe('aiEngine.js — comprehensive', () => {
  beforeEach(() => {
    vi.resetModules();
    delete window.electronAPI;
    vi.clearAllMocks();
  });

  describe('with mocked Electron AI API', () => {
    it('generateFeedback sends correct prompt with japanese and comp data', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      const exams = [
        { date: '2025-01-10', japanese: { reading: 120, listening: 100 }, comprehensive: { score: 75 } },
        { date: '2025-02-14', japanese: { reading: 130, listening: 110 }, comprehensive: { score: 82 } },
      ];
      const settings = { targetJapanese: 320, targetComprehensive: 170 };

      await generateFeedback(exams, settings, vi.fn());

      expect(mockCleanup).toHaveBeenCalled();
      expect(mockOnToken).toHaveBeenCalled();
      expect(mockGenerate).toHaveBeenCalled();

      const messages = mockGenerate.mock.calls[0][0];
      expect(messages).toHaveLength(2); // system + user
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');

      const userContent = messages[1].content;
      // Should contain both japanese and comprehensive data
      expect(userContent).toContain('일본어');
      expect(userContent).toContain('종합과목');
      expect(userContent).toContain('240'); // 130+110 = latest japanese
      expect(userContent).toContain('82'); // latest comp
    });

    it('generateFeedback handles only japanese data', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      const exams = [
        { date: '2025-01-10', japanese: { reading: 100, listening: 90 } },
      ];
      const settings = { targetJapanese: 300 };

      await generateFeedback(exams, settings, vi.fn());

      const messages = mockGenerate.mock.calls[0][0];
      const userContent = messages[1].content;
      expect(userContent).toContain('일본어');
      expect(userContent).not.toContain('종합과목');
      expect(userContent).toContain('190'); // 100+90
      expect(userContent).toContain('300'); // target
    });

    it('generateFeedback handles only comprehensive data', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      const exams = [
        { date: '2025-01-10', comprehensive: { score: 80 } },
      ];
      const settings = { targetComprehensive: 160 };

      await generateFeedback(exams, settings, vi.fn());

      const messages = mockGenerate.mock.calls[0][0];
      const userContent = messages[1].content;
      expect(userContent).not.toContain('일본어');
      expect(userContent).toContain('종합과목');
      expect(userContent).toContain('80');
    });

    it('generateFeedback handles no exam data', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      await generateFeedback([], {}, vi.fn());

      const messages = mockGenerate.mock.calls[0][0];
      const userContent = messages[1].content;
      expect(userContent).toContain('아직 입력된 시험 데이터가 없습니다');
    });

    it('generateFeedback shows improvement trends with multiple exams', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      const exams = [
        { date: '2025-01-10', japanese: { reading: 80, listening: 70 } },
        { date: '2025-02-14', japanese: { reading: 100, listening: 90 } },
        { date: '2025-03-20', japanese: { reading: 110, listening: 105 } },
      ];
      const settings = { targetJapanese: 320 };

      await generateFeedback(exams, settings, vi.fn());

      const messages = mockGenerate.mock.calls[0][0];
      const userContent = messages[1].content;
      // Should mention trend (latest - first = 215 - 150 = +65)
      expect(userContent).toContain('+65');
      expect(userContent).toContain('215'); // latest 110+105
    });

    it('generateFeedback handles negative trend', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      const exams = [
        { date: '2025-01-10', japanese: { reading: 140, listening: 130 } },
        { date: '2025-02-14', japanese: { reading: 100, listening: 90 } },
      ];
      const settings = { targetJapanese: 300 };

      await generateFeedback(exams, settings, vi.fn());

      const messages = mockGenerate.mock.calls[0][0];
      const userContent = messages[1].content;
      // Diff should be negative
      expect(userContent).toContain('-80'); // 190 - 270 = -80
    });

    it('generateFeedback uses default target values when not provided', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      const exams = [
        { date: '2025-01-10', japanese: { reading: 130, listening: 110 } },
      ];

      await generateFeedback(exams, {}, vi.fn());

      const messages = mockGenerate.mock.calls[0][0];
      const userContent = messages[1].content;
      // Default target is 320
      expect(userContent).toContain('320');
    });

    it('generateFeedback filters null japanese entries', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      const exams = [
        { date: '2025-01-10', japanese: null },
        { date: '2025-02-14', japanese: { reading: 130, listening: 110 } },
      ];
      const settings = { targetJapanese: 320 };

      await generateFeedback(exams, settings, vi.fn());

      const messages = mockGenerate.mock.calls[0][0];
      const userContent = messages[1].content;
      expect(userContent).toContain('240'); // 130+110
    });

    it('generateFeedback handles single exam correctly', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      const exams = [
        { date: '2025-03-01', japanese: { reading: 125, listening: 115 } },
      ];
      const settings = { targetJapanese: 320, targetComprehensive: 170 };

      await generateFeedback(exams, settings, vi.fn());

      const messages = mockGenerate.mock.calls[0][0];
      const userContent = messages[1].content;
      expect(userContent).toContain('240');
    });

    it('loadModel calls through with mocked API', async () => {
      setMockAPI();
      const { loadModel, isElectronAI } = await import('../utils/aiEngine');

      expect(isElectronAI()).toBe(true);
      const progressCb = vi.fn();
      await loadModel(progressCb);

      expect(mockCleanup).toHaveBeenCalled();
      expect(mockOnProgress).toHaveBeenCalledWith(progressCb);
      expect(mockLoad).toHaveBeenCalled();
    });

    it('onToken is optional for generateFeedback', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      await generateFeedback([{ date: '2025-01-01', japanese: { reading: 100, listening: 100 } }], {});

      expect(mockOnToken).toHaveBeenCalledWith(undefined);
      expect(mockGenerate).toHaveBeenCalled();
    });
  });

  describe('edge cases with normalizeJapaneseScore', () => {
    it('normalizes japanese score with reading/listening', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      const exams = [
        { date: '2025-01-10', japanese: { reading: 90, listening: 80 } },
      ];

      await generateFeedback(exams, {}, vi.fn());

      const messages = mockGenerate.mock.calls[0][0];
      const content = messages[1].content;
      expect(content).toContain('170');
    });
  });

  describe('with null/undefined edge cases', () => {
    it('generateFeedback handles settings being null', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      const exams = [
        { date: '2025-01-10', japanese: { reading: 100, listening: 100 } },
      ];

      await generateFeedback(exams, null, vi.fn());
      expect(mockGenerate).toHaveBeenCalled();
    });

    it('generateFeedback handles empty exams array', async () => {
      setMockAPI();
      const { generateFeedback } = await import('../utils/aiEngine');

      await generateFeedback([], {}, vi.fn());

      const messages = mockGenerate.mock.calls[0][0];
      expect(messages[1].content).toContain('아직 입력된 시험 데이터가 없습니다');
    });
  });
});
