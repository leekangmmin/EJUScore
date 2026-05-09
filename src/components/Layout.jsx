// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
const NAV = [
  { id: 'dashboard',     icon: '📊', label: '대시보드' },
  { id: 'japanese',      icon: '🇯🇵', label: '일본어' },
  { id: 'comprehensive', icon: '📚', label: '종합과목' },
];

export default function Layout({ currentPage, onNavigate, onAddNew, onOpenQuickInput, onOpenSettings, onToggleTheme, theme, children }) {
  return (
    <div className="app-shell">
      {/* ── Sidebar (desktop) ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
            <span style={{ background: 'linear-gradient(135deg,var(--blue),var(--purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EJU</span>
            <span style={{ color: 'var(--t0)' }}> 스코어</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2, letterSpacing: '0.03em' }}>留学試験 점수 트래커</div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(item => (
            <button key={item.id} onClick={() => onNavigate(item.id)} className={`nav-btn${currentPage === item.id ? ' active' : ''}`}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button onClick={onOpenQuickInput} className="ctrl-btn" style={{ flex: 1 }}>
              빠른 입력
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onToggleTheme} className="ctrl-btn" style={{ flex: 1 }}>
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
              {theme === 'dark' ? '라이트' : '다크'}
            </button>
            <button onClick={onOpenSettings} className="ctrl-btn" style={{ width: 38 }} title="설정">⚙️</button>
          </div>
          <button onClick={onAddNew} className="add-btn">
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> 점수 입력
          </button>
          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--t3)', paddingTop: 2 }}>
            © 2025 이강민 · EJU 합격을 향해 💪
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="main-content">
        {/* Mobile top bar */}
        <header className="mobile-header">
          <div style={{ fontWeight: 800, fontSize: 17 }}>
            <span style={{ background: 'linear-gradient(135deg,var(--blue),var(--purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EJU</span>
            <span style={{ color: 'var(--t0)' }}> 스코어</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onOpenQuickInput} className="mobile-icon-btn">⚡</button>
            <button onClick={onToggleTheme} className="mobile-icon-btn">{theme === 'dark' ? '☀️' : '🌙'}</button>
            <button onClick={onOpenSettings} className="mobile-icon-btn">⚙️</button>
            <button onClick={onAddNew} className="mobile-add-btn">+ 입력</button>
          </div>
        </header>

        <div className="page-body">
          {children}
        </div>
      </main>

      {/* ── Bottom tab bar (mobile) ── */}
      <nav className="bottom-nav">
        {NAV.map(item => (
          <button key={item.id} onClick={() => onNavigate(item.id)} className={`bottom-tab${currentPage === item.id ? ' active' : ''}`}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 10 }}>{item.label}</span>
          </button>
        ))}
        <button onClick={onAddNew} className="bottom-tab bottom-tab-add">
          <span style={{ fontSize: 22, fontWeight: 700 }}>+</span>
          <span style={{ fontSize: 10 }}>입력</span>
        </button>
      </nav>
    </div>
  );
}
