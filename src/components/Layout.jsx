// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useMemo } from 'react';
import { getExams, getSettings } from '../utils/storage';
import { getDday } from '../utils/diagnosis';

const NAV = [
  { id: 'dashboard',     icon: '📊', label: '대시보드' },
  { id: 'japanese',      icon: '🇯🇵', label: '일본어 분석' },
  { id: 'comprehensive', icon: '📚', label: '종합과목 분석' },
];

function SidebarMiniStats() {
  const exams = useMemo(() => getExams(), []);
  const settings = useMemo(() => getSettings(), []);

  if (exams.length === 0) return null;

  const latest = exams[exams.length - 1];
  const latestJap = latest?.japanese
    ? latest.japanese.reading + latest.japanese.listening
    : null;
  const latestComp = latest?.comprehensive?.score ?? null;
  const dday = getDday(settings.nextExamDate);

  const tJap = settings.targetJapanese ?? 320;
  const tComp = settings.targetComprehensive ?? 170;
  const japPct = latestJap != null ? Math.min(100, Math.round((latestJap / tJap) * 100)) : null;
  const compPct = latestComp != null ? Math.min(100, Math.round((latestComp / tComp) * 100)) : null;

  return (
    <div style={{
      background: 'rgba(91,158,255,0.05)',
      border: '1px solid rgba(91,158,255,0.12)',
      borderRadius: 13,
      padding: '12px 14px',
      marginBottom: 12,
    }}>
      {/* D-day */}
      {dday !== null && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(91,158,255,0.1)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600 }}>다음 시험</span>
          <span style={{
            fontSize: 13, fontWeight: 800,
            color: dday <= 7 ? 'var(--red)' : dday <= 30 ? 'var(--orange)' : 'var(--blue)',
          }}>
            {dday > 0 ? `D-${dday}` : dday === 0 ? 'D-Day!' : `D+${Math.abs(dday)}`}
          </span>
        </div>
      )}
      {/* 일본어 */}
      {latestJap != null && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 600 }}>일본어</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)' }}>{latestJap}</span>
          </div>
          <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${japPct}%`, background: 'var(--blue)', borderRadius: 2, transition: 'width 0.5s' }} />
          </div>
        </div>
      )}
      {/* 종합 */}
      {latestComp != null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 600 }}>종합과목</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>{latestComp}</span>
          </div>
          <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${compPct}%`, background: 'var(--green)', borderRadius: 2, transition: 'width 0.5s' }} />
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 8, textAlign: 'right' }}>
        총 {exams.length}회 기록
      </div>
    </div>
  );
}

export default function Layout({ currentPage, onNavigate, onAddNew, onOpenQuickInput, onOpenSettings, onToggleTheme, theme, children }) {
  return (
    <div className="app-shell">
      {/* ── Sidebar (desktop) ── */}
      <aside className="sidebar">
        {/* 로고 */}
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: 'var(--grad-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
              boxShadow: '0 4px 16px var(--glow-blue), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}>🎌</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                <span className="grad-text">EJU</span>
                <span style={{ color: 'var(--t0)' }}>스코어</span>
              </div>
              <div style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: '0.06em', marginTop: 2 }}>留学試験 점수 트래커</div>
            </div>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="sidebar-nav">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-btn${currentPage === item.id ? ' active' : ''}`}
            >
              <span style={{ fontSize: 17 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* 미니 통계 */}
        <div style={{ padding: '12px 0 4px' }}>
          <SidebarMiniStats />
        </div>

        {/* 하단 컨트롤 */}
        <div className="sidebar-bottom">
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onOpenQuickInput} className="ctrl-btn" style={{ flex: 1, gap: 5 }}>
              <span style={{ fontSize: 14 }}>⚡</span> 빠른 입력
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onToggleTheme} className="ctrl-btn" style={{ flex: 1 }}>
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
              {theme === 'dark' ? '라이트' : '다크'}
            </button>
            <button onClick={onOpenSettings} className="ctrl-btn" style={{ width: 40 }} title="설정">
              ⚙️
            </button>
          </div>
          <button onClick={onAddNew} className="add-btn">
            <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span> 점수 입력
          </button>
          <div style={{ textAlign: 'center', fontSize: 9, color: 'var(--t3)', paddingTop: 2, lineHeight: 1.5 }}>
            © 2025 이강민 · EJU 합격을 향해 💪
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="main-content">
        {/* 모바일 상단 바 */}
        <header className="mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--blue), var(--purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>🎌</div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              <span style={{ background: 'linear-gradient(135deg, var(--blue), var(--purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EJU</span>
              <span style={{ color: 'var(--t0)' }}> 스코어</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button onClick={onOpenQuickInput} className="mobile-icon-btn">⚡</button>
            <button onClick={onToggleTheme} className="mobile-icon-btn">{theme === 'dark' ? '☀️' : '🌙'}</button>
            <button onClick={onOpenSettings} className="mobile-icon-btn">⚙️</button>
            <button onClick={onAddNew} className="mobile-add-btn">＋ 입력</button>
          </div>
        </header>

        <div className="page-body">
          {children}
        </div>
      </main>

      {/* ── 하단 탭 바 (모바일) ── */}
      <nav className="bottom-nav">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`bottom-tab${currentPage === item.id ? ' active' : ''}`}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 10 }}>{item.label.replace(' 분석', '')}</span>
          </button>
        ))}
        <button onClick={onAddNew} className="bottom-tab bottom-tab-add">
          <span style={{ fontSize: 20, fontWeight: 700 }}>＋</span>
          <span style={{ fontSize: 10 }}>입력</span>
        </button>
      </nav>
    </div>
  );
}
