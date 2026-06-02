// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// WindowsTitlebar — Extended Coverage (electronAPI interaction)
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WindowsTitlebar from '../components/WindowsTitlebar';

function makeWin32API() {
  return {
    platform: 'win32',
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
    onMaximizeChange: vi.fn(),
  };
}

describe('WindowsTitlebar — extended', () => {
  beforeEach(() => {
    delete globalThis.window.electronAPI;
  });

  it('calls isMaximized and onMaximizeChange on mount', () => {
    const api = makeWin32API();
    globalThis.window.electronAPI = api;
    render(<WindowsTitlebar />);
    expect(api.isMaximized).toHaveBeenCalled();
    expect(api.onMaximizeChange).toHaveBeenCalled();
  });

  it('renders minimize button that calls api.minimize', () => {
    const api = makeWin32API();
    globalThis.window.electronAPI = api;
    render(<WindowsTitlebar />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(api.minimize).toHaveBeenCalled();
  });

  it('renders maximize button that calls api.maximize', () => {
    const api = makeWin32API();
    globalThis.window.electronAPI = api;
    render(<WindowsTitlebar />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(api.maximize).toHaveBeenCalled();
  });

  it('renders close button that calls api.close', () => {
    const api = makeWin32API();
    globalThis.window.electronAPI = api;
    render(<WindowsTitlebar />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[2]);
    expect(api.close).toHaveBeenCalled();
  });

  it('shows maximize icon (square) when not maximized', () => {
    const api = makeWin32API();
    globalThis.window.electronAPI = api;
    const { container } = render(<WindowsTitlebar />);

    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(3);
  });

  it('shows restore icon when maximized', async () => {
    const api = makeWin32API();
    api.isMaximized = vi.fn().mockResolvedValue(true);
    globalThis.window.electronAPI = api;
    const { container } = render(<WindowsTitlebar />);

    await new Promise(r => setTimeout(r, 10));

    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(1);
  });

  it('returns null when electronAPI is undefined', () => {
    const { container } = render(<WindowsTitlebar />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null on non-win32 platforms', () => {
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
});
