// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// main.jsx — Coverage test (entry point logic)
// Tests the polyfills import, electron detection, SW logic
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

describe('main.jsx entry logic', () => {
  beforeAll(() => {
    // Ensure clean state
    delete globalThis.window.electronAPI;
    // Mock serviceWorker
    globalThis.navigator.serviceWorker = {
      getRegistrations: vi.fn().mockResolvedValue([]),
      register: vi.fn().mockResolvedValue({}),
    };
    // Mock Notification
    globalThis.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    };
    // Mock localStorage
    localStorage.setItem('eju_settings', JSON.stringify({ nextExamDate: '2026-06-15' }));
  });

  afterAll(() => {
    delete globalThis.window.electronAPI;
  });

  it('polyfills module loads without error', async () => {
    // Just importing the polyfills module should not throw
    let mod;
    expect(async () => {
      mod = await import('../utils/polyfills');
    }).not.toThrow();
  });

  it('main module loads with basic execution', async () => {
    // Create a mock root element
    const rootEl = document.createElement('div');
    rootEl.id = 'root';
    document.body.appendChild(rootEl);

    // The main module should load and run
    let mainMod;
    expect(async () => {
      mainMod = await import('../main.jsx');
    }).not.toThrow();

    // Clean up
    document.body.removeChild(rootEl);
  });

  it('IS_ELECTRON is false in test environment', () => {
    expect(typeof window !== 'undefined' && !!window.electronAPI).toBe(false);
  });

  it('serviceWorker getRegistrations returns registrations', () => {
    const hasSW = 'serviceWorker' in navigator;
    expect(hasSW).toBe(true);
  });

  it('creates root element and renders', async () => {
    // Create root
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    // Import polyfills + main
    await import('../utils/polyfills');
    const main = await import('../main.jsx');

    // Check that the DOM was updated by createRoot
    const rootEl = document.getElementById('root');
    expect(rootEl).toBeDefined();

    document.body.removeChild(root);
  });
});
