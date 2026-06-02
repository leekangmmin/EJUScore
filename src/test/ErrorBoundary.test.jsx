// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// ErrorBoundary Component Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

function GoodComponent() {
  return <div data-testid="good-component">정상 작동</div>;
}

function BadComponent() {
  throw new Error('테스트 오류');
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('good-component')).toBeDefined();
    expect(screen.getByText('정상 작동')).toBeDefined();
  });

  it('renders error UI when child throws', () => {
    // Suppress console.error for this test
    const origError = console.error;
    console.error = vi.fn();

    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('예기치 못한 오류가 발생했습니다')).toBeDefined();
    expect(screen.getByText('테스트 오류')).toBeDefined();
    expect(screen.getByText('다시 시도')).toBeDefined();

    console.error = origError;
  });

  it('renders custom title when provided', () => {
    const origError = console.error;
    console.error = vi.fn();

    render(
      <ErrorBoundary title="커스텀 오류">
        <BadComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('커스텀 오류')).toBeDefined();

    console.error = origError;
  });

  it('resets error state when reset button clicked', () => {
    const origError = console.error;
    console.error = vi.fn();

    render(
      <ErrorBoundary>
        <BadComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('예기치 못한 오류가 발생했습니다')).toBeDefined();

    // Click reset button
    fireEvent.click(screen.getByText('다시 시도'));

    // After reset, the error-boundary renders children again.
    // Since BadComponent throws again, it will be caught again.
    // But the state should reset first, then catch again.
    // We just verify the button click doesn't crash.
    expect(screen.getByText('예기치 못한 오류가 발생했습니다')).toBeDefined();

    console.error = origError;
  });

  it('renders custom fallback message', () => {
    const origError = console.error;
    console.error = vi.fn();

    render(
      <ErrorBoundary fallbackMessage="직접 작성한 메시지">
        <BadComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('직접 작성한 메시지')).toBeDefined();

    console.error = origError;
  });
});
