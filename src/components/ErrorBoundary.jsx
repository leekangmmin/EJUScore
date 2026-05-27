// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: 20,
        padding: 40, textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AlertTriangle size={34} color="var(--red)" strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t0)', marginBottom: 8 }}>
            {this.props.title || '예기치 못한 오류가 발생했습니다'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7, maxWidth: 320 }}>
            {this.props.fallbackMessage || '화면을 불러오는 중 문제가 생겼어요. 다시 시도해 보세요.'}
          </div>
          {this.state.error && (
            <div style={{
              marginTop: 12, fontSize: 11, color: 'var(--t3)',
              fontFamily: 'monospace', maxWidth: 400, margin: '12px auto 0',
              background: 'var(--bg3)', padding: '10px 14px',
              borderRadius: 8, textAlign: 'left', wordBreak: 'break-all',
              border: '1px solid var(--bd0)',
            }}>
              {this.state.error.message}
            </div>
          )}
        </div>
        <button
          onClick={() => this.reset()}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--bg3)', color: 'var(--t1)',
            border: '1px solid var(--bd1)', borderRadius: 12,
            padding: '11px 22px', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bd1)'; e.currentTarget.style.color = 'var(--t1)'; }}
        >
          <RefreshCw size={15} strokeWidth={2} />
          다시 시도
        </button>
      </div>
    );
  }
}
