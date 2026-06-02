// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Layout Component Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Layout from '../components/Layout';

function makeElectronAPIMock(platform) {
  return {
    platform,
    isMaximized: vi.fn().mockResolvedValue(false),
    onMaximizeChange: vi.fn(),
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
  };
}

describe('Layout', () => {
  beforeEach(() => {
    delete globalThis.window.electronAPI;
  });

  it('renders without crashing', () => {
    const { container } = render(
      <Layout
        currentPage="dashboard"
        onNavigate={vi.fn()}
        onAddNew={vi.fn()}
        onOpenQuickInput={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleTheme={vi.fn()}
        theme="dark"
      >
        <div>Test Content</div>
      </Layout>
    );
    expect(container.querySelector('.app-shell')).toBeDefined();
  });

  it('renders children content', () => {
    const { getByText } = render(
      <Layout
        currentPage="dashboard"
        onNavigate={vi.fn()}
        onAddNew={vi.fn()}
        onOpenQuickInput={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleTheme={vi.fn()}
        theme="dark"
      >
        <div>Child Content</div>
      </Layout>
    );
    expect(getByText('Child Content')).toBeDefined();
  });

  it('renders navigation items', () => {
    const { getAllByText } = render(
      <Layout
        currentPage="dashboard"
        onNavigate={vi.fn()}
        onAddNew={vi.fn()}
        onOpenQuickInput={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleTheme={vi.fn()}
        theme="dark"
      >
        <div>Content</div>
      </Layout>
    );
    // Navigation items appear in both sidebar and bottom nav, use getAllByText
    expect(getAllByText('대시보드').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('AI 코치').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('사진 변환').length).toBeGreaterThanOrEqual(1);
  });

  it('applies paddingTop when electron platform is win32', () => {
    globalThis.window.electronAPI = makeElectronAPIMock('win32');
    const { container } = render(
      <Layout
        currentPage="dashboard"
        onNavigate={vi.fn()}
        onAddNew={vi.fn()}
        onOpenQuickInput={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleTheme={vi.fn()}
        theme="dark"
      >
        <div>Content</div>
      </Layout>
    );
    const shell = container.querySelector('.app-shell');
    expect(shell).toBeDefined();
    expect(shell.style.paddingTop).toBe('32px');
    delete globalThis.window.electronAPI;
  });

  it('does not apply paddingTop on non-electron', () => {
    const { container } = render(
      <Layout
        currentPage="dashboard"
        onNavigate={vi.fn()}
        onAddNew={vi.fn()}
        onOpenQuickInput={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleTheme={vi.fn()}
        theme="dark"
      >
        <div>Content</div>
      </Layout>
    );
    const shell = container.querySelector('.app-shell');
    expect(shell).toBeDefined();
    expect(shell.style.paddingTop).toBe('');
  });

  it('shows light theme button when theme is dark', () => {
    const { getByText } = render(
      <Layout
        currentPage="dashboard"
        onNavigate={vi.fn()}
        onAddNew={vi.fn()}
        onOpenQuickInput={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleTheme={vi.fn()}
        theme="dark"
      >
        <div>Content</div>
      </Layout>
    );
    expect(getByText('라이트')).toBeDefined();
  });

  it('shows dark theme button when theme is light', () => {
    const { getByText } = render(
      <Layout
        currentPage="dashboard"
        onNavigate={vi.fn()}
        onAddNew={vi.fn()}
        onOpenQuickInput={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleTheme={vi.fn()}
        theme="light"
      >
        <div>Content</div>
      </Layout>
    );
    expect(getByText('다크')).toBeDefined();
  });
});
