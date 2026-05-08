// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ScoreForm from './components/ScoreForm';
import JapaneseAnalysis from './components/JapaneseAnalysis';
import ComprehensiveAnalysis from './components/ComprehensiveAnalysis';
import SettingsPanel from './components/SettingsPanel';
import { getExams, deleteExam, loadSampleData, getSettings } from './utils/storage';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [exams, setExams] = useState([]);
  const [editingExam, setEditingExam] = useState(null);
  const [showSamplePrompt, setShowSamplePrompt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
    </>
  );
}
