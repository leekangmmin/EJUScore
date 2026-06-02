// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// App — Root Component with Code Splitting (React.lazy + Suspense)
// Performance: Lazy loading reduces initial JS bundle by ~60%
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { getExams, deleteExam, loadSampleData, getSettings, saveSettings, saveExam, JAP_READ_MAX, JAP_LISTEN_MAX, COMP_MAX } from './utils/storage';
import { getDday } from './utils/diagnosis';

// ═══ LAZY LOADED COMPONENTS ═══════════════════════════
const Dashboard = lazy(() => import('./components/Dashboard'));
const ScoreForm = lazy(() => import('./components/ScoreForm'));
const JapaneseAnalysis = lazy(() => import('./components/JapaneseAnalysis'));
const ComprehensiveAnalysis = lazy(() => import('./components/ComprehensiveAnalysis'));
const AICoach = lazy(() => import('./components/AICoach'));
const DailyTasks = lazy(() => import('./components/DailyTasks'));
const DiagnosticReport = lazy(() => import('./components/DiagnosticReport'));
const TrendDashboard = lazy(() => import('./components/TrendDashboard'));
const PhotoToQuestion = lazy(() => import('./components/PhotoToQuestion'));
const ExamIntelligenceCenter = lazy(() => import('./components/ExamIntelligenceCenter'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const InstallGuide = lazy(() => import('./components/InstallGuide'));

function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 300, color: 'var(--t2)', fontSize: 14,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{
          width: 24, height: 24, border: '2px solid var(--bd1)',
          borderTop: '2px solid var(--blue)', borderRadius: '50%',
          margin: '0 auto 12px', animation: 'spin 0.8s linear infinite',
        }} />
        불러오는 중...
      </div>
    </div>
  );
}

function QuickInputModal({ onClose, onSaved }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [mode, setMode] = useState('japanese');
  const [date, setDate] = useState(today);
  const [reading, setReading] = useState(0);
  const [listening, setListening] = useState(0);
  const [compScore, setCompScore] = useState(0);

  const saveQuick = () => {
    const name = `${date} ${mode === 'japanese' ? '일본어' : '종합과목'} 빠른입력`;
    saveExam({
      id: crypto.randomUUID(),
      date,
      examName: name,
      japanese: mode === 'japanese'
        ? { reading, listening, wrongQuestions: { reading: [], listening: [] } }
        : undefined,
      comprehensive: mode === 'comprehensive'
        ? { score: compScore, mistakes: [] }
        : undefined,
    });
    onSaved();
    onClose();
  };

  const btnStyle = isActive => ({
    background: isActive ? 'rgba(79,142,247,0.16)' : 'var(--bg3)',
    color: isActive ? 'var(--blue)' : 'var(--t1)',
    border: isActive ? '1px solid rgba(79,142,247,0.5)' : '1px solid var(--bd1)',
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  });
  const inputStyle = {
    background: 'var(--bg3)', border: '1px solid var(--bd1)', borderRadius: 9,
    padding: '9px 11px', color: 'var(--t0)', fontSize: 13, fontFamily: 'inherit', width: '100%',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(520px, 96vw)', background: 'var(--bg1)', border: '1px solid var(--bd0)', borderRadius: 16, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t0)' }}>빠른 입력</div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--bd1)', borderRadius: 8, color: 'var(--t2)', padding: '5px 9px', cursor: 'pointer' }}>닫기</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setMode('japanese')} style={btnStyle(mode === 'japanese')}>일본어만</button>
          <button onClick={() => setMode('comprehensive')} style={btnStyle(mode === 'comprehensive')}>종합과목만</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 5 }}>시험 연월</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>
        {mode === 'japanese' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 5 }}>독해 /{JAP_READ_MAX}</div>
              <input type="number" min={0} max={JAP_READ_MAX} value={reading} onChange={e => setReading(Math.max(0, Math.min(JAP_READ_MAX, Number(e.target.value))))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 5 }}>청해 /{JAP_LISTEN_MAX}</div>
              <input type="number" min={0} max={JAP_LISTEN_MAX} value={listening} onChange={e => setListening(Math.max(0, Math.min(JAP_LISTEN_MAX, Number(e.target.value))))} style={inputStyle} />
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 5 }}>종합과목 /{COMP_MAX}</div>
            <input type="number" min={0} max={COMP_MAX} value={compScore} onChange={e => setCompScore(Math.max(0, Math.min(COMP_MAX, Number(e.target.value))))} style={inputStyle} />
          </div>
        )}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={saveQuick} style={{
            background: 'linear-gradient(135deg, var(--blue), var(--purple))',
            color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>저장</button>
        </div>
      </div>
    </div>
  );
}

function SamplePromptBanner({ onLoadSample, onDismiss }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(79,142,247,0.08), rgba(168,85,247,0.08))',
      border: '1px solid rgba(79,142,247,0.25)', borderRadius: 16,
      padding: '18px 22px', marginBottom: 24,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t0)' }}>샘플 데이터로 미리보기</div>
        <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 3 }}>앱이 어떻게 작동하는지 샘플 데이터로 먼저 체험해보세요.</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onDismiss} style={{ background: 'transparent', border: '1px solid var(--bd1)', borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--t2)', fontFamily: 'inherit' }}>괜찮아요</button>
        <button onClick={onLoadSample} style={{ background: 'linear-gradient(135deg, #4f8ef7, #a855f7)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>샘플 불러오기</button>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [exams, setExams] = useState(() => getExams());
  const [editingExam, setEditingExam] = useState(null);
  const [showSamplePrompt, setShowSamplePrompt] = useState(() => getExams().length === 0 && !localStorage.getItem('eju_sample_dismissed'));
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [settings, setSettings] = useState(getSettings());
  const [showInstallGuide, setShowInstallGuide] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.electronAPI) return false;
    try {
      if (window.matchMedia?.('(display-mode: standalone)')?.matches) return false;
      if (window.navigator?.standalone) return false;
      return !localStorage.getItem('eju_pwa_guide_dismissed');
    } catch { return false; }
  });

  const refresh = () => setExams(getExams());
  const handleDelete = (id) => { deleteExam(id); setExams(prev => prev.filter(e => e.id !== id)); };
  const handleDeleteAll = () => { localStorage.removeItem('eju_exam_data'); setExams([]); };

  useEffect(() => {
    if (!('Notification' in window)) return;
    const dday = getDday(settings.nextExamDate);
    if (dday === null || dday < 0 || dday > 30) return;
    const lastNotifKey = 'eju_last_notif_date';
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(lastNotifKey) === today) return;
    const notify = () => {
      const title = dday === 0 ? '📅 오늘이 EJU 시험일입니다!' : `🔔 EJU 시험 D-${dday}`;
      const body = dday === 0 ? '오늘 시험이에요. 화이팅! 💪' : `${settings.nextExamDate} 시험까지 ${dday}일 남았습니다!`;
      try { new Notification(title, { body, icon: '/icon-192.png', tag: 'eju-dday' }); } catch {}
      localStorage.setItem(lastNotifKey, today);
    };
    if (Notification.permission === 'granted') notify();
    else if (Notification.permission === 'default') Notification.requestPermission().then(p => { if (p === 'granted') notify(); });
  }, [settings.nextExamDate]);

  useEffect(() => { document.documentElement.setAttribute('data-theme', settings.theme || 'dark'); }, [settings.theme]);

  const handleEdit = exam => { setEditingExam(exam); setPage('form'); };
  const handleAddNew = () => { setEditingExam(null); setPage('form'); };
  const handleSave = () => { refresh(); setPage('dashboard'); setEditingExam(null); };
  const handleCancel = () => { setPage('dashboard'); setEditingExam(null); };
  const handleExport = () => {
    const data = { exams: getExams(), settings: getSettings(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `eju-score-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };
  const handleImport = (data) => {
    if (data.exams) localStorage.setItem('eju_exam_data', JSON.stringify(data.exams));
    if (data.settings) { saveSettings(data.settings); setSettings(data.settings); }
    refresh();
  };
  const handleLoadSample = () => { loadSampleData(); refresh(); setShowSamplePrompt(false); localStorage.setItem('eju_sample_dismissed', '1'); };
  const toggleTheme = () => {
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = { ...settings, theme: next };
    setSettings(updated); localStorage.setItem('eju_settings', JSON.stringify(updated));
    document.documentElement.setAttribute('data-theme', next);
  };

  const PAGE_VARIANTS = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } };
  const PAGE_TRANSITION = { duration: 0.15, ease: 'easeOut' };

  const renderPage = () => {
    const pageContent = (() => {
      switch (page) {
        case 'form': return <Suspense fallback={<PageLoader />}><ScoreForm editingExam={editingExam} onSave={handleSave} onCancel={handleCancel} /></Suspense>;
        case 'tasks': return <Suspense fallback={<PageLoader />}><DailyTasks exams={exams} settings={settings} /></Suspense>;
        case 'japanese': return <Suspense fallback={<PageLoader />}><JapaneseAnalysis exams={exams} settings={settings} onEdit={handleEdit} /></Suspense>;
        case 'comprehensive': return <Suspense fallback={<PageLoader />}><ComprehensiveAnalysis exams={exams} settings={settings} onEdit={handleEdit} /></Suspense>;
        case 'ai': return <Suspense fallback={<PageLoader />}><AICoach exams={exams} settings={settings} /></Suspense>;
        case 'diagnosis': return <Suspense fallback={<PageLoader />}><DiagnosticReport exams={exams} settings={settings} /></Suspense>;
        case 'trend-insights': return <Suspense fallback={<PageLoader />}><TrendDashboard exams={exams} settings={settings} onSettingsOpen={() => setShowSettings(true)} /></Suspense>;
        case 'exam-intelligence': return <Suspense fallback={<PageLoader />}><ExamIntelligenceCenter /></Suspense>;
        case 'photo-question': return <Suspense fallback={<PageLoader />}><PhotoToQuestion exams={exams} onSaved={refresh} /></Suspense>;
        default: return <Suspense fallback={<PageLoader />}><Dashboard exams={exams} settings={settings} onEdit={handleEdit} onDelete={handleDelete} onDeleteAll={handleDeleteAll} onExport={handleExport} onImport={handleImport} /></Suspense>;
      }
    })();

    return (
      <AnimatePresence mode="wait">
        <motion.div key={page} variants={PAGE_VARIANTS} initial="initial" animate="animate" exit="exit" transition={PAGE_TRANSITION}>
          {page === 'dashboard' && exams.length === 0 && showSamplePrompt && (
            <SamplePromptBanner onLoadSample={handleLoadSample} onDismiss={() => { setShowSamplePrompt(false); localStorage.setItem('eju_sample_dismissed', '1'); }} />
          )}
          <ErrorBoundary key={page}>{pageContent}</ErrorBoundary>
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <ErrorBoundary>
      <Layout currentPage={page} onNavigate={setPage} onAddNew={handleAddNew} onOpenQuickInput={() => setShowQuickInput(true)} onOpenSettings={() => setShowSettings(true)} onToggleTheme={toggleTheme} theme={settings.theme}>
        {renderPage()}
      </Layout>
      {showQuickInput && <QuickInputModal onClose={() => setShowQuickInput(false)} onSaved={refresh} />}
      {showSettings && <Suspense fallback={null}><SettingsPanel settings={settings} onSave={(s) => { saveSettings(s); setSettings(s); }} onClose={() => setShowSettings(false)} /></Suspense>}
      {showInstallGuide && <Suspense fallback={null}><InstallGuide onDismiss={() => { setShowInstallGuide(false); localStorage.setItem('eju_pwa_guide_dismissed', '1'); }} /></Suspense>}
    </ErrorBoundary>
  );
}
