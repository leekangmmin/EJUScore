// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// ErrorBoundary — Extended Coverage
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

// Component that throws
function Bomb({ shouldThrow }) {
  if (shouldThrow) throw new Error('💥 Test error');
  return <div>안전함</div>;
}

describe('ErrorBoundary — extended', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>정상 컨텐츠</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('정상 컨텐츠')).toBeDefined();
  });

  it('renders error state on child error', () => {
    const origError = console.error;
    console.error = vi.fn();

    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/오류가 발생했습니다/i)).toBeDefined();
    console.error = origError;
  });

  it('renders fallback message on crash', () => {
    const origError = console.error;
    console.error = vi.fn();

    render(
      <ErrorBoundary fallbackMessage="커스텀 폴백 메시지입니다.">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('커스텀 폴백 메시지입니다.')).toBeDefined();
    console.error = origError;
  });
});
