// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ScoreForm from './components/ScoreForm';
import JapaneseAnalysis from './components/JapaneseAnalysis';
import ComprehensiveAnalysis from './components/ComprehensiveAnalysis';
import AICoach from './components/AICoach';
import DailyTasks from './components/DailyTasks';
import DiagnosticReport from './components/DiagnosticReport';
import TrendDashboard from './components/TrendDashboard';
import PhotoToQuestion from './components/PhotoToQuestion';
import SettingsPanel from './components/SettingsPanel';
import ErrorBoundary from './components/ErrorBoundary';
import InstallGuide from './components/InstallGuide';
import { getExams, deleteExam, loadSampleData, getSettings, saveSettings, saveExam, JAP_READ_MAX, JAP_LISTEN_MAX, COMP_MAX } from './utils/storage';
import { getDday } from './utils/diagnosis';

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
    cursor: 'pointer',
    fontFamily: 'inherit',
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

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [exams, setExams] = useState(() => getExams());
  const [editingExam, setEditingExam] = useState(null);
  const [showSamplePrompt, setShowSamplePrompt] = useState(() => getExams().length === 0);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [settings, setSettings] = useState(getSettings());
  const [showInstallGuide, setShowInstallGuide] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !localStorage.getItem('eju_pwa_guide_dismissed');
    } catch { return false; }
  });

  const refresh = () => setExams(getExams());
  const handleDelete = (id) => { deleteExam(id); setExams(prev => prev.filter(e => e.id !== id)); };
  const handleDeleteAll = () => { localStorage.removeItem('eju_exam_data'); setExams([]); };

  // D-day OS 알림
  useEffect(() => {
    if (!('Notification' in window)) return;
    const dday = getDday(settings.nextExamDate);
    if (dday === null || dday < 0 || dday > 30) return;

    const lastNotifKey = 'eju_last_notif_date';
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(lastNotifKey) === today) return;

    const notify = () => {
      const title = dday === 0 ? '📅 오늘이 EJU 시험일입니다!' : `🔔 EJU 시험 D-${dday}`;
      const body  = dday === 0
        ? '오늘 시험이에요. 화이팅! 💪'
        : `${settings.nextExamDate} 시험까지 ${dday}일 남았습니다!`;
      new Notification(title, { body, icon: '/icon-192.png', tag: 'eju-dday' });
      localStorage.setItem(lastNotifKey, today);
    };

    if (Notification.permission === 'granted') {
      notify();
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => { if (p === 'granted') notify(); });
    }
  }, [settings.nextExamDate]);

  // Apply theme to html element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
  }, [settings.theme]);

  const handleEdit = exam => { setEditingExam(exam); setPage('form'); };
  const handleAddNew = () => { setEditingExam(null); setPage('form'); };
  const handleSave = () => { refresh(); setPage('dashboard'); setEditingExam(null); };
  const handleCancel = () => { setPage('dashboard'); setEditingExam(null); };

  const handleExport = () => {
    const data = { exams: getExams(), settings: getSettings(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eju-score-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (data) => {
    if (data.exams) localStorage.setItem('eju_exam_data', JSON.stringify(data.exams));
    if (data.settings) {
      saveSettings(data.settings);
      setSettings(data.settings);
    }
    refresh();
  };
  const handleLoadSample = () => { loadSampleData(); refresh(); setShowSamplePrompt(false); };
  const toggleTheme = () => {
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = { ...settings, theme: next };
    setSettings(updated);
    // saveSettings is called by SettingsPanel; here we just apply instantly
    localStorage.setItem('eju_settings', JSON.stringify(updated));
    document.documentElement.setAttribute('data-theme', next);
  };

  const PAGE_VARIANTS = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: -6 },
  };
  const PAGE_TRANSITION = { duration: 0.15, ease: 'easeOut' };

  const renderPage = () => {
    switch (page) {
      case 'form':
        return (
          <ErrorBoundary fallbackMessage="점수 입력 화면을 불러오는 중 오류가 발생했어요.">
            <ScoreForm editingExam={editingExam} onSave={handleSave} onCancel={handleCancel} />
          </ErrorBoundary>
        );
      case 'tasks':
        return (
          <ErrorBoundary fallbackMessage="오늘의 학습 화면을 불러오는 중 오류가 발생했어요.">
            <DailyTasks exams={exams} settings={settings} />
          </ErrorBoundary>
        );
      case 'japanese':
        return (
          <ErrorBoundary fallbackMessage="일본어 분석 화면을 불러오는 중 오류가 발생했어요.">
            <JapaneseAnalysis exams={exams} onAddNew={handleAddNew} />
          </ErrorBoundary>
        );
      case 'comprehensive':
        return (
          <ErrorBoundary fallbackMessage="종합과목 분석 화면을 불러오는 중 오류가 발생했어요.">
            <ComprehensiveAnalysis exams={exams} settings={settings} onAddNew={handleAddNew} />
          </ErrorBoundary>
        );
      case 'ai':
        return (
          <ErrorBoundary fallbackMessage="AI 코치 화면을 불러오는 중 오류가 발생했어요.">
            <AICoach exams={exams} settings={settings} />
          </ErrorBoundary>
        );
      case 'diagnosis':
        return (
          <ErrorBoundary fallbackMessage="오답 진단 화면을 불러오는 중 오류가 발생했어요.">
            <DiagnosticReport exams={exams} />
          </ErrorBoundary>
        );
      case 'trend-insights':
        return (
          <ErrorBoundary fallbackMessage="출제 경향 화면을 불러오는 중 오류가 발생했어요.">
            <TrendDashboard />
          </ErrorBoundary>
        );
      case 'photo-question':
        return (
          <ErrorBoundary fallbackMessage="사진 변환 화면을 불러오는 중 오류가 발생했어요.">
            <PhotoToQuestion />
          </ErrorBoundary>
        );
      default:
        return (
          <>
            {showSamplePrompt && exams.length === 0 && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(79,142,247,0.08), rgba(168,85,247,0.08))',
                border: '1px solid rgba(79,142,247,0.25)', borderRadius: 16,
                padding: '18px 22px', marginBottom: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t0)' }}>샘플 데이터로 미리보기</div>
                  <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 3 }}>앱이 어떻게 작동하는지 확인해보세요</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleLoadSample} style={{
                    background: 'linear-gradient(135deg, var(--blue), var(--purple))',
                    color: '#fff', border: 'none', borderRadius: 9, padding: '8px 18px',
                    fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                  }}>샘플 불러오기</button>
                  <button onClick={() => setShowSamplePrompt(false)} style={{
                    background: 'transparent', color: 'var(--t2)', border: '1px solid var(--bd1)',
                    borderRadius: 9, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                  }}>닫기</button>
                </div>
              </div>
            )}
            <Dashboard exams={exams} onEdit={handleEdit} onDelete={handleDelete} onDeleteAll={handleDeleteAll} onAddNew={handleAddNew} settings={settings} />
          </>
        );
    }
  };

  const pageContent = renderPage();

  return (
    <>
      <Layout
        currentPage={page}
        onNavigate={setPage}
        onAddNew={handleAddNew}
        onOpenQuickInput={() => setShowQuickInput(true)}
        onOpenSettings={() => setShowSettings(true)}
        onToggleTheme={toggleTheme}
        theme={settings.theme}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            variants={PAGE_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={PAGE_TRANSITION}
          >
            {pageContent}
          </motion.div>
        </AnimatePresence>
      </Layout>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={s => setSettings(s)}
          onExport={handleExport}
          onImport={handleImport}
        />
      )}

      {showQuickInput && (
        <QuickInputModal
          onClose={() => setShowQuickInput(false)}
          onSaved={refresh}
        />
      )}

      {showInstallGuide && (
        <InstallGuide
          onClose={() => setShowInstallGuide(false)}
          onDontShowAgain={() => {
            localStorage.setItem('eju_pwa_guide_dismissed', '1');
            setShowInstallGuide(false);
          }}
        />
      )}
    </>
  );
}
