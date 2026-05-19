// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';

const api = window.electronAPI;

export default function WindowsTitlebar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!api) return;
    api.isMaximized().then(setMaximized);
    api.onMaximizeChange(setMaximized);
  }, []);

  if (!api || api.platform !== 'win32') return null;

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 46, height: 32, border: 'none', background: 'transparent',
    cursor: 'pointer', color: 'rgba(255,255,255,0.65)', transition: 'background 0.15s',
    flexShrink: 0,
    WebkitAppRegion: 'no-drag',
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 32, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--sidebar)',
      WebkitAppRegion: 'drag',
      userSelect: 'none',
    }}>
      {/* 앱 이름 */}
      <div style={{ paddingLeft: 14, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.03em' }}>
        EJU Score Tracker
      </div>

      {/* 창 조작 버튼 */}
      <div style={{ display: 'flex' }}>
        <button
          onClick={api.minimize}
          style={btnBase}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Minus size={12} strokeWidth={2} />
        </button>
        <button
          onClick={api.maximize}
          style={btnBase}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {maximized
            ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="2" y="0" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/><rect x="0" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" style={{ fill: 'var(--sidebar)' }}/></svg>
            : <Square size={10} strokeWidth={1.5} />
          }
        </button>
        <button
          onClick={api.close}
          style={btnBase}
          onMouseEnter={e => { e.currentTarget.style.background = '#c42b1c'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
