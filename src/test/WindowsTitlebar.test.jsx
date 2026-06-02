// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// WindowsTitlebar Component Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import WindowsTitlebar from '../components/WindowsTitlebar';

describe('WindowsTitlebar', () => {
  beforeEach(() => {
    // Ensure clean state
    delete globalThis.window.electronAPI;
  });

  it('returns null when no electronAPI available', () => {
    const { container } = render(<WindowsTitlebar />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when platform is not win32', () => {
    globalThis.window.electronAPI = {
      platform: 'darwin',
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn().mockResolvedValue(false),
      onMaximizeChange: vi.fn(),
    };
    const { container } = render(<WindowsTitlebar />);
    expect(container.innerHTML).toBe('');
  });

  it('renders window controls when platform is win32', async () => {
    globalThis.window.electronAPI = {
      platform: 'win32',
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn().mockResolvedValue(false),
      onMaximizeChange: vi.fn(),
    };
    render(<WindowsTitlebar />);
    expect(screen.getByText('EJU Score Tracker')).toBeDefined();
  });
});
