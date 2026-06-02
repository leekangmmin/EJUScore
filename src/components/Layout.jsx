// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useMemo, useState } from 'react';
import {
  LayoutDashboard, BookOpen, Layers, Plus, Zap,
  Settings, Sun, Moon, GraduationCap, Sparkles, CalendarCheck,
  ClipboardList, BarChartBig, Camera, BrainCircuit, MoreHorizontal, X,
} from 'lucide-react';
import { getExams, getSettings, normalizeJapaneseScore, normalizeCompScore } from '../utils/storage';
import { getDday } from '../utils/diagnosis';
import WindowsTitlebar from './WindowsTitlebar';

const ACCENT = '#3182F6';
const GOLD_GRADIENT = 'linear-gradient(135deg, #3182F6, #1B64DA)';

const NAV = [
  { id: 'dashboard',      Icon: LayoutDashboard, label: '대시보드' },
  { id: 'tasks',          Icon: CalendarCheck,   label: '오늘의 학습' },
  { id: 'japanese',       Icon: BookOpen,         label: '일본어 분석' },
  { id: 'comprehensive',  Icon: Layers,           label: '종합과목 분석' },
  { id: 'ai',             Icon: Sparkles,         label: 'AI 코치' },
  { id: 'diagnosis',      Icon: ClipboardList,    label: '오답 진단' },
  { id: 'exam-intelligence', Icon: BrainCircuit,  label: 'Exam Intelligence' },
  { id: 'trend-insights', Icon: BarChartBig,      label: '출제 경향' },
  { id: 'photo-question', Icon: Camera,           label: '사진 변환' },
];

// Mobile bottom nav: 4 primary tabs + a "더보기" sheet for the rest (Toss/Linear pattern).
const NAV_BY_ID = Object.fromEntries(NAV.map((n) => [n.id, n]));
const BOTTOM_PRIMARY = ['dashboard', 'comprehensive', 'trend-insights', 'ai'].map((id) => NAV_BY_ID[id]);
const MORE_IDS = ['tasks', 'japanese', 'diagnosis', 'exam-intelligence', 'photo-question'];
const MORE_ITEMS = MORE_IDS.map((id) => NAV_BY_ID[id]);
// Shorter labels for the cramped bottom bar.
const SHORT_LABEL = {
  dashboard: '대시보드', comprehensive: '종합과목', 'trend-insights': '출제경향', ai: 'AI 코치',
};

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
    <div className="sidebar-stats">
      {dday !== null && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>다음 시험</span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: dday <= 7 ? 'var(--red)' : dday <= 30 ? 'var(--yellow)' : 'var(--text-primary)',
          }}>
            {dday > 0 ? `D-${dday}` : dday === 0 ? 'D-Day!' : `D+${Math.abs(dday)}`}
          </span>
        </div>
      )}
      {latestJap != null && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>일본어</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{latestJap}</span>
          </div>
          <div style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${japPct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.5s' }} />
          </div>
        </div>
      )}
      {latestComp != null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>종합과목</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{latestComp}</span>
          </div>
          <div style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${compPct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.5s' }} />
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8, textAlign: 'right' }}>
        {exams.length}회 기록
      </div>
    </div>
  );
}

export default function Layout({ currentPage, onNavigate, onAddNew, onOpenQuickInput, onOpenSettings, onToggleTheme, theme, children }) {
  const isWindows = typeof window !== 'undefined' && window.electronAPI?.platform === 'win32';
  const [moreOpen, setMoreOpen] = useState(false);
  const go = (id) => { onNavigate(id); setMoreOpen(false); };

  return (
    <div className="app-shell" style={isWindows ? { paddingTop: 32 } : undefined}>
      <WindowsTitlebar />

      {/* ── Sidebar (desktop) ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: GOLD_GRADIENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 20px rgba(49,130,246,0.2)',
            }}>
              <GraduationCap size={16} color="#07070e" strokeWidth={2.2} />
            </div>
            <div>
              <div className="logo-text" style={{ fontSize: 15, lineHeight: 1.2, color: 'var(--text-primary)' }}>
                EJU 스코어
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginTop: 2, fontFamily: "'DM Mono', monospace" }}>SCORE TRACKER</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {NAV.map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`nav-btn${currentPage === id ? ' active' : ''}`}
            >
              <Icon size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Mini Stats */}
        <SidebarMiniStats />

        {/* Bottom controls */}
        <div className="sidebar-bottom">
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onOpenQuickInput} className="btn btn-secondary" style={{ flex: 1, fontSize: 12, padding: '8px 12px' }}>
              <Zap size={13} strokeWidth={2} />
              빠른 입력
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onToggleTheme} className="btn btn-ghost" style={{ flex: 1, fontSize: 12, padding: '8px 12px' }}>
              {theme === 'dark'
                ? <Sun size={13} strokeWidth={1.8} />
                : <Moon size={13} strokeWidth={1.8} />}
              {theme === 'dark' ? '라이트' : '다크'}
            </button>
            <button onClick={onOpenSettings} className="btn-icon" title="설정">
              <Settings size={14} strokeWidth={1.8} />
            </button>
          </div>
          <button onClick={onAddNew} className="btn btn-primary" style={{ width: '100%', padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} strokeWidth={2.5} />
            점수 입력
          </button>
          <div style={{ textAlign: 'center', fontSize: 9, color: 'var(--text-tertiary)', paddingTop: 4 }}>
            © 2025 leekangmmin
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="main-content">
        {/* Mobile header */}
        <header className="mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: GOLD_GRADIENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px rgba(49,130,246,0.2)',
            }}>
              <GraduationCap size={14} color="#07070e" strokeWidth={2.2} />
            </div>
            <div className="logo-text" style={{ fontSize: 14, color: 'var(--text-primary)' }}>
              EJU 스코어
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onOpenQuickInput} className="btn-icon"><Zap size={15} strokeWidth={1.8} /></button>
            <button onClick={onToggleTheme} className="btn-icon">
              {theme === 'dark' ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
            </button>
            <button onClick={onOpenSettings} className="btn-icon"><Settings size={15} strokeWidth={1.8} /></button>
            <button onClick={onAddNew} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 12 }}>+ 입력</button>
          </div>
        </header>

        <div className="page-body">
          {children}
        </div>
      </main>

      {/* ── "더보기" sheet (mobile) ── */}
      {moreOpen && (
        <>
          <div className="more-sheet-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="more-sheet" role="dialog" aria-label="더보기 메뉴">
            <div className="more-sheet-handle" />
            <div className="more-sheet-head">
              <span>전체 메뉴</span>
              <button className="btn-icon" onClick={() => setMoreOpen(false)} aria-label="닫기"><X size={16} /></button>
            </div>
            <div className="more-sheet-grid">
              {MORE_ITEMS.map(({ id, Icon, label }) => (
                <button
                  key={id}
                  onClick={() => go(id)}
                  className={`more-sheet-item${currentPage === id ? ' active' : ''}`}
                >
                  <Icon size={22} strokeWidth={1.7} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Bottom nav (mobile) ── */}
      <nav className="bottom-nav">
        {BOTTOM_PRIMARY.map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => go(id)}
            className={`bottom-tab${currentPage === id ? ' active' : ''}`}
          >
            <Icon size={20} strokeWidth={1.6} />
            <span>{SHORT_LABEL[id] || label}</span>
          </button>
        ))}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={`bottom-tab${moreOpen || MORE_IDS.includes(currentPage) ? ' active' : ''}`}
          aria-label="더보기"
        >
          <MoreHorizontal size={20} strokeWidth={1.6} />
          <span>더보기</span>
        </button>
      </nav>
    </div>
  );
}
