// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// ErrorBoundary — Mouse Event Coverage
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

function Thrower() {
  throw new Error('💥');
}

describe('ErrorBoundary — mouse events', () => {
  it('handles mouseEnter/mouseLeave on reset button', () => {
    const origError = console.error;
    console.error = vi.fn();

    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>
    );

    const btn = screen.getByText('다시 시도');
    expect(btn).toBeDefined();

    // Trigger mouseEnter
    fireEvent.mouseEnter(btn);
    // Trigger mouseLeave
    fireEvent.mouseLeave(btn);

    console.error = origError;
  });
});
