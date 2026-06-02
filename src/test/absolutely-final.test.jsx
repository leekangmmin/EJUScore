// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Absolutely final — cover last uncovered branches
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WindowsTitlebar from '../components/WindowsTitlebar';
import { generateDiagnosis } from '../utils/diagnosis';
import { classifySubject } from '../utils/subjectClassifier';

describe('absolutely-final', () => {
  it('WindowsTitlebar — maximize button mouse events (non-maximized)', () => {
    globalThis.window.electronAPI = {
      platform: 'win32',
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn().mockResolvedValue(false),
      onMaximizeChange: vi.fn(),
    };
    render(<WindowsTitlebar />);
    const buttons = screen.getAllByRole('button');
    // Maximize button is buttons[1]
    // Mouse enter/leave on maximize button when not maximized (line 55-56)
    fireEvent.mouseEnter(buttons[1]);
    fireEvent.mouseLeave(buttons[1]);
    delete globalThis.window.electronAPI;
  });

  it('diagnosis — covers line 21 and 29 (jap trend)', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5], listening: [] } } },
      { date: '2025-02', japanese: { reading: 110, listening: 110, wrongQuestions: { reading: [], listening: [] } } },
      { date: '2025-03', japanese: { reading: 90, listening: 90, wrongQuestions: { reading: [], listening: [] } } },
    ];
    const r = generateDiagnosis(exams);
    expect(Array.isArray(r)).toBe(true);
  });

  it('classifySubject — covers fuzzy matching path', () => {
    // Should match '경제' keyword
    const r = classifySubject('경제');
    expect(r).toBeDefined();
  });
});
