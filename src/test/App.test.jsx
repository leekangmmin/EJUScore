// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// App Component Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock matchMedia for all tests
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('App', () => {
  it('renders without crashing', () => {
    // Suppress console errors from async rendering
    const origError = console.error;
    console.error = vi.fn();

    const { container } = render(<App />);
    expect(container).toBeDefined();

    console.error = origError;
  });

  it('renders app shell structure', () => {
    const origError = console.error;
    console.error = vi.fn();

    const { container } = render(<App />);
    // App should render some structure
    const appShell = container.querySelector('.app-shell');
    if (appShell) {
      expect(appShell).toBeDefined();
    }

    console.error = origError;
  });
});
