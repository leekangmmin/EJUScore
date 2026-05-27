// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useMemo } from 'react';
import {
  LayoutDashboard, BookOpen, Layers, Plus, Zap,
  Settings, Sun, Moon, GraduationCap, Sparkles, CalendarCheck,
  ChartLine, ClipboardList, BarChartBig,
} from 'lucide-react';
import { getExams, getSettings, normalizeJapaneseScore, normalizeCompScore } from '../utils/storage';
import { getDday } from '../utils/diagnosis';
import WindowsTitlebar from './WindowsTitlebar';

const NAV = [
  { id: 'dashboard',     Icon: LayoutDashboard, label: '대시보드' },
  { id: 'tasks',         Icon: CalendarCheck,   label: '오늘의 학습' },
  { id: 'japanese',      Icon: BookOpen,         label: '일본어 분석' },
  { id: 'comprehensive', Icon: Layers,           label: '종합과목 분석' },
  { id: 'ai',            Icon: Sparkles,         label: 'AI 코치' },
  { id: 'diagnosis',     Icon: ClipboardList,    label: '오답 진단' },
  { id: 'trend',         Icon: ChartLine,        label: '기출 트렌드' },
  { id: 'trend-insights', Icon: BarChartBig,      label: '출제 경향' },
];

function SidebarMiniStats() {
  const exams = useMemo(() => getExams(), []);
  const settings = useMemo(() => getSettings(), []);

  if (exams.length === 0) return null;

  const latest = exams[exams.length - 1];
  const japNorm   = latest?.japanese ? normalizeJapaneseScore(latest.japanese) : null;
  const latestJap = japNorm ? japNorm.reading + japNorm.listening : null;
  const latestComp = latest?.comprehensive ? normalizeCompScore(latest.comprehensive) : null;
  const dday = getDday(settings.nextExamDate);

  const tJap = settings.targetJapanese ?? 320;
  const tComp = settings.targetComprehensive ?? 170;
  const japPct  = latestJap  != null ? Math.min(100, Math.round((latestJap  / tJap)  * 100)) : null;
  const compPct = latestComp != null ? Math.min(100, Math.round((latestComp / tComp) * 100)) : null;

  return (
    <div style={{
      background: 'rgba(107,163,255,0.06)',
      border: '1px solid rgba(107,163,255,0.1)',
      borderRadius: 12,
      padding: '12px 13px',
      marginBottom: 10,
    }}>
      {dday !== null && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>다음 시험</span>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: dday <= 7 ? '#f07171' : dday <= 30 ? '#f5934e' : '#6ba3ff',
          }}>
            {dday > 0 ? `D-${dday}` : dday === 0 ? 'D-Day!' : `D+${Math.abs(dday)}`}
          </span>
        </div>
      )}
      {latestJap != null && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>일본어</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6ba3ff' }}>{latestJap}</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${japPct}%`, background: '#6ba3ff', borderRadius: 2, transition: 'width 0.5s' }} />
          </div>
        </div>
      )}
      {latestComp != null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>종합과목</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#34d98d' }}>{latestComp}</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${compPct}%`, background: '#34d98d', borderRadius: 2, transition: 'width 0.5s' }} />
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 8, textAlign: 'right' }}>
        {exams.length}회 기록
      </div>
    </div>
  );
}

export default function Layout({ currentPage, onNavigate, onAddNew, onOpenQuickInput, onOpenSettings, onToggleTheme, theme, children }) {
  const isWindows = typeof window !== 'undefined' && window.electronAPI?.platform === 'win32';

  return (
    <div className="app-shell" style={isWindows ? { paddingTop: 32 } : undefined}>
      <WindowsTitlebar />
      {/* ── Sidebar (desktop) ── */}
      <aside className="sidebar">
        {/* 로고 */}
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--grad-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 3px 12px rgba(107,163,255,0.28)',
            }}>
              <GraduationCap size={18} color="#fff" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                <span className="grad-text">EJU</span>
                <span style={{ color: 'rgba(255,255,255,0.88)' }}> 스코어</span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.04em', marginTop: 2 }}>留学試験 점수 트래커</div>
            </div>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="sidebar-nav">
          {NAV.map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`nav-btn${currentPage === id ? ' active' : ''}`}
            >
              <Icon size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* 미니 통계 */}
        <div style={{ padding: '10px 0 4px' }}>
          <SidebarMiniStats />
        </div>

        {/* 하단 컨트롤 */}
        <div className="sidebar-bottom">
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onOpenQuickInput} className="ctrl-btn" style={{ flex: 1 }}>
              <Zap size={13} strokeWidth={2.2} />
              빠른 입력
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onToggleTheme} className="ctrl-btn" style={{ flex: 1 }}>
              {theme === 'dark'
                ? <Sun size={13} strokeWidth={2} />
                : <Moon size={13} strokeWidth={2} />}
              {theme === 'dark' ? '라이트' : '다크'}
            </button>
            <button onClick={onOpenSettings} className="ctrl-btn" style={{ width: 38 }} title="설정">
              <Settings size={14} strokeWidth={1.8} />
            </button>
          </div>
          <button onClick={onAddNew} className="add-btn">
            <Plus size={16} strokeWidth={2.5} />
            점수 입력
          </button>
          <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.18)', paddingTop: 2 }}>
            © 2025 leekangmmin · MIT
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="main-content">
        {/* 모바일 상단 바 */}
        <header className="mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--grad-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GraduationCap size={14} color="#fff" strokeWidth={2.2} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>
              <span style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EJU</span>
              <span style={{ color: 'rgba(255,255,255,0.88)' }}> 스코어</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onOpenQuickInput} className="mobile-icon-btn"><Zap size={15} strokeWidth={2} /></button>
            <button onClick={onToggleTheme} className="mobile-icon-btn">
              {theme === 'dark' ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
            </button>
            <button onClick={onOpenSettings} className="mobile-icon-btn"><Settings size={15} strokeWidth={1.8} /></button>
            <button onClick={onAddNew} className="mobile-add-btn">+ 입력</button>
          </div>
        </header>

        <div className="page-body">
          {children}
        </div>
      </main>

      {/* ── 하단 탭 바 (모바일) ── */}
      <nav className="bottom-nav">
        {NAV.map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`bottom-tab${currentPage === id ? ' active' : ''}`}
          >
            <Icon size={20} strokeWidth={1.8} />
            <span style={{ fontSize: 10 }}>{label.replace(' 분석', '')}</span>
          </button>
        ))}
        <button onClick={onAddNew} className="bottom-tab bottom-tab-add">
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: 'var(--grad-primary)', boxShadow: '0 3px 10px rgba(107,163,255,0.28)', marginBottom: 2 }}>
            <Plus size={20} strokeWidth={2.5} color="#fff" />
          </span>
          <span style={{ fontSize: 10 }}>입력</span>
        </button>
      </nav>
    </div>
  );
}
