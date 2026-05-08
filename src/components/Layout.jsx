// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
const NAV = [
  { id: 'dashboard', icon: '📊', label: '대시보드' },
  { id: 'japanese',  icon: '🇯🇵', label: '일본어 분석' },
  { id: 'comprehensive', icon: '📚', label: '종합과목 분석' },
];

export default function Layout({ currentPage, onNavigate, onAddNew, onOpenSettings, onToggleTheme, theme, children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, minHeight: '100vh',
        background: 'var(--sidebar)', borderRight: '1px solid var(--bd0)',
        display: 'flex', flexDirection: 'column', padding: '24px 12px',
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: '6px 12px 26px' }}>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.5px' }}>
            <span style={{ background: 'linear-gradient(135deg,var(--blue),var(--purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EJU</span>
            <span style={{ color: 'var(--t0)' }}> 스코어</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>留学試験 점수 트래커</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => onNavigate(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '10px 13px', borderRadius: 10, cursor: 'pointer', border: 'none',
              background: currentPage === item.id ? 'rgba(79,142,247,0.15)' : 'transparent',
              color: currentPage === item.id ? 'var(--blue)' : 'var(--t1)',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit', width: '100%', textAlign: 'left',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Theme toggle */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onToggleTheme} title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                background: 'transparent', color: 'var(--t2)', border: '1px solid var(--bd0)',
                fontSize: 12, transition: 'all 0.15s',
              }}>
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
              {theme === 'dark' ? '라이트' : '다크'}
            </button>
            <button onClick={onOpenSettings} title="목표 점수 설정"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                background: 'transparent', color: 'var(--t2)', border: '1px solid var(--bd0)',
                fontSize: 15, transition: 'all 0.15s',
              }}>⚙️</button>
          </div>

          {/* Add button */}
          <button onClick={onAddNew} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '12px', borderRadius: 12, cursor: 'pointer',
            background: 'linear-gradient(135deg,var(--blue),var(--purple))',
            color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
            boxShadow: '0 4px 18px rgba(79,142,247,0.35)',
            transition: 'all 0.2s',
          }}>
            <span style={{ fontSize: 17 }}>+</span> 점수 입력
          </button>

          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--t3)', paddingTop: 4 }}>
            EJU 합격을 향해 💪
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: '32px', minHeight: '100vh', background: 'var(--bg0)' }}>
        {children}
      </main>
    </div>
  );
}
