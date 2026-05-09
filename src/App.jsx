// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ScoreForm from './components/ScoreForm';
import JapaneseAnalysis from './components/JapaneseAnalysis';
import ComprehensiveAnalysis from './components/ComprehensiveAnalysis';
import SettingsPanel from './components/SettingsPanel';
import { getExams, deleteExam, loadSampleData, getSettings, saveExam } from './utils/storage';

function QuickInputModal({ onClose, onSaved }) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [mode, setMode] = useState('japanese');
  const [date, setDate] = useState(currentMonth);
  const [reading, setReading] = useState(0);
  const [listening, setListening] = useState(0);
  const [compScore, setCompScore] = useState(0);

  const saveQuick = () => {
    const exams = getExams();
    const existing = exams.find(e => e.date === date);
    const name = existing?.examName || `${date} 모의고사`;
    saveExam({
      id: existing?.id || crypto.randomUUID(),
      date,
      examName: name,
      japanese: mode === 'japanese'
        ? { reading, listening, wrongQuestions: existing?.japanese?.wrongQuestions || { reading: [], listening: [] } }
        : existing?.japanese,
      comprehensive: mode === 'comprehensive'
        ? { score: compScore, mistakes: existing?.comprehensive?.mistakes || [] }
        : existing?.comprehensive,
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
          <input type="month" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>
        {mode === 'japanese' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 5 }}>독해 /200</div>
              <input type="number" min={0} max={200} value={reading} onChange={e => setReading(Math.max(0, Math.min(200, Number(e.target.value))))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 5 }}>청해 /200</div>
              <input type="number" min={0} max={200} value={listening} onChange={e => setListening(Math.max(0, Math.min(200, Number(e.target.value))))} style={inputStyle} />
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 5 }}>종합과목 /200</div>
            <input type="number" min={0} max={200} value={compScore} onChange={e => setCompScore(Math.max(0, Math.min(200, Number(e.target.value))))} style={inputStyle} />
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
  const [exams, setExams] = useState([]);
  const [editingExam, setEditingExam] = useState(null);
  const [showSamplePrompt, setShowSamplePrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [settings, setSettings] = useState(getSettings());

  const refresh = () => setExams(getExams());
  const handleDelete = (id) => { deleteExam(id); setExams(prev => prev.filter(e => e.id !== id)); };
  const handleDeleteAll = () => { localStorage.removeItem('eju_exam_data'); setExams([]); };

  useEffect(() => {
    const stored = getExams();
    setExams(stored);
    if (stored.length === 0) setShowSamplePrompt(true);
  }, []);

  // Apply theme to html element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
  }, [settings.theme]);

  const handleEdit = exam => { setEditingExam(exam); setPage('form'); };
  const handleAddNew = () => { setEditingExam(null); setPage('form'); };
  const handleSave = () => { refresh(); setPage('dashboard'); setEditingExam(null); };
  const handleCancel = () => { setPage('dashboard'); setEditingExam(null); };
  const handleLoadSample = () => { loadSampleData(); refresh(); setShowSamplePrompt(false); };
  const toggleTheme = () => {
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = { ...settings, theme: next };
    setSettings(updated);
    // saveSettings is called by SettingsPanel; here we just apply instantly
    localStorage.setItem('eju_settings', JSON.stringify(updated));
    document.documentElement.setAttribute('data-theme', next);
  };

  const renderPage = () => {
    switch (page) {
      case 'form':
        return <ScoreForm editingExam={editingExam} onSave={handleSave} onCancel={handleCancel} />;
      case 'japanese':
        return <JapaneseAnalysis exams={exams} />;
      case 'comprehensive':
        return <ComprehensiveAnalysis exams={exams} settings={settings} />;
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
            <Dashboard exams={exams} onEdit={handleEdit} onDelete={handleDelete} onDeleteAll={handleDeleteAll} settings={settings} />
          </>
        );
    }
  };

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
        {renderPage()}
      </Layout>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={s => setSettings(s)}
        />
      )}

      {showQuickInput && (
        <QuickInputModal
          onClose={() => setShowQuickInput(false)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
