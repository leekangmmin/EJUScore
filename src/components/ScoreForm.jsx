// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useState, useEffect, useMemo, useCallback } from 'react';
import { saveExam, getExams, JAP_MAX, JAP_READ_MAX, JAP_LISTEN_MAX } from '../utils/storage';
import { confidenceLabel, estimateComprehensiveScore, estimateJapaneseScore } from '../utils/scorePrediction';

const ERROR_TYPES  = ['실수', '정보부족', '연계사고부족'];
const COMMON_UNITS = ['정치', '경제', '사회', '지리', '역사', '현대사', '국제관계', '기타'];

const LABEL = {
  fontSize: 11, color: 'var(--t2)', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 7,
};
const INPUT = {
  background: 'var(--input-bg)', border: '1.5px solid var(--bd1)', borderRadius: 10,
  padding: '10px 14px', color: 'var(--t0)', fontSize: 13, fontFamily: 'inherit',
  width: '100%', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s',
};
const SECTION = {
  background: 'var(--card-bg)', border: '1px solid var(--bd0)',
  borderRadius: 18, padding: 24, marginBottom: 18,
  boxShadow: 'var(--card-shadow)',
};

// ── Toast ─────────────────────────────────────────────
function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  const colors = {
    info:    { bg: 'rgba(79,142,247,0.15)',  border: 'rgba(79,142,247,0.4)',  color: '#4f8ef7' },
    success: { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)',  color: '#10b981' },
    error:   { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   color: '#ef4444' },
    warning: { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)',  color: '#f59e0b' },
  };
  const c = colors[type];
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 14, padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      backdropFilter: 'blur(12px)',
      animation: 'slideInRight 0.3s ease',
      maxWidth: 340,
    }}>
      <span style={{ fontSize: 18 }}>
        {type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
      </span>
      <span style={{ fontSize: 13, color: c.color, fontWeight: 600, flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: c.color, cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
    </div>
  );
}

// ── ScoreInput ────────────────────────────────────────
function ScoreInput({ label, value, onChange, max, accent, disabled = false, onToast }) {
  const pct = max ? Math.round((Number(value) / max) * 100) : 0;
  const color = pct >= 80 ? 'var(--green)' : pct >= 60 ? accent : pct >= 40 ? 'var(--yellow)' : 'var(--red)';
  const handleChange = (e) => {
    const raw = Number(e.target.value);
    if (raw > max) {
      onToast?.(`${label}은 최대 ${max}점까지 입력할 수 있어요.`, 'warning');
    }
    onChange(Math.min(max, Math.max(0, raw)));
  };
  return (
    <div>
      <label style={LABEL}>{label} <span style={{ color: 'var(--t3)', fontWeight: 400, textTransform: 'none', fontSize: 12 }}>/ {max}점</span></label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input type="number" min={0} max={max} value={value}
          onChange={handleChange}
          style={{ ...INPUT, width: 96, opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'text' }}
          disabled={disabled}
          onFocus={e => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}22`; }}
          onBlur={e => { e.target.style.borderColor = 'var(--bd1)'; e.target.style.boxShadow = 'none'; }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s cubic-bezier(.4,0,.2,1)' }} />
          </div>
          <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 600 }}>{pct}%</div>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────
export default function ScoreForm({ editingExam, onSave, onCancel }) {
  const [entryMode, setEntryMode] = useState('both');
  const [recordType, setRecordType] = useState('exam'); // 'exam' | 'workbook'
  const [date, setDate] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [examName, setExamName]         = useState('');
  const [reading, setReading]           = useState(0);
  const [listening, setListening]       = useState(0);
  const [wrongReading, setWrongReading] = useState('');
  const [wrongListening, setWrongListening] = useState('');
  // 일본어 번호별 메모
  const [japMemos, setJapMemos]         = useState({}); // { "독해-3": "메모내용", ... }
  const [showJapMemoPanel, setShowJapMemoPanel] = useState(false);

  const [compScore, setCompScore]       = useState(0);
  const [mistakes, setMistakes]         = useState([]);
  const [latestExam, setLatestExam]     = useState(null);
  const [useEstimatedJapanese, setUseEstimatedJapanese] = useState(false);
  const [useEstimatedComprehensive, setUseEstimatedComprehensive] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  useEffect(() => {
    const exams = getExams();
    setLatestExam(exams[exams.length - 1] || null);
    if (!editingExam) return;
    setDate(editingExam.date);
    setExamName(editingExam.examName);
    setReading(editingExam.japanese?.reading || 0);
    setListening(editingExam.japanese?.listening || 0);
    setWrongReading((editingExam.japanese?.wrongQuestions?.reading || []).join(', '));
    setWrongListening((editingExam.japanese?.wrongQuestions?.listening || []).join(', '));
    setJapMemos(editingExam.japanese?.wrongMemos || {});
    setCompScore(editingExam.comprehensive?.score || 0);
    setMistakes(editingExam.comprehensive?.mistakes || []);
    setUseEstimatedJapanese(Boolean(editingExam.japanese?.estimateMeta?.isEstimated));
    setUseEstimatedComprehensive(Boolean(editingExam.comprehensive?.estimateMeta?.isEstimated));
    setRecordType(editingExam.recordType || 'exam');
  }, [editingExam]);

  const parseNums = str => str.split(/[\s,]+/).map(Number).filter(n => Number.isInteger(n) && n > 0);
  const parsedWrongReading = useMemo(() => parseNums(wrongReading), [wrongReading]);
  const parsedWrongListening = useMemo(() => parseNums(wrongListening), [wrongListening]);

  const japaneseEstimate = useMemo(
    () => estimateJapaneseScore(getExams().filter(e => e.id !== editingExam?.id), parsedWrongReading, parsedWrongListening),
    [parsedWrongReading, parsedWrongListening, editingExam?.id]
  );
  const compEstimate = useMemo(
    () => estimateComprehensiveScore(getExams().filter(e => e.id !== editingExam?.id), mistakes),
    [mistakes, editingExam?.id]
  );

  const copyLatest = () => {
    if (!latestExam) return;
    setExamName(`${latestExam.examName || '이전 시험'} 복사`);
    setReading(latestExam.japanese?.reading || 0);
    setListening(latestExam.japanese?.listening || 0);
    setWrongReading((latestExam.japanese?.wrongQuestions?.reading || []).join(', '));
    setWrongListening((latestExam.japanese?.wrongQuestions?.listening || []).join(', '));
    setJapMemos(latestExam.japanese?.wrongMemos || {});
    setCompScore(latestExam.comprehensive?.score || 0);
    setMistakes((latestExam.comprehensive?.mistakes || []).map(m => ({ ...m, id: crypto.randomUUID() })));
    showToast('이전 입력값을 복사했어요!', 'success');
  };

  const addMistake = () => setMistakes(m => [...m, { id: crypto.randomUUID(), questionNumber: '', unit: '', errorType: '정보부족', memo: '' }]);
  const updateMistake = (id, field, val) => setMistakes(m => m.map(x => x.id === id ? { ...x, [field]: val } : x));
  const removeMistake = id => setMistakes(m => m.filter(x => x.id !== id));

  const handleSubmit = e => {
    e.preventDefault();
    if (!date) { showToast('시험 연월을 선택해주세요.', 'error'); return; }
    const base = editingExam || {};
    const modeLabel = entryMode === 'japanese' ? '일본어' : entryMode === 'comprehensive' ? '종합과목' : '전체';
    const autoName = `${date} ${modeLabel} 입력`;

    saveExam({
      id: editingExam?.id || crypto.randomUUID(),
      date,
      recordType,
      examName: examName.trim() || autoName,
      japanese: entryMode === 'comprehensive'
        ? (base.japanese || editingExam?.japanese)
        : {
            reading: useEstimatedJapanese ? japaneseEstimate.reading : reading,
            listening: useEstimatedJapanese ? japaneseEstimate.listening : listening,
            wrongQuestions: { reading: parsedWrongReading, listening: parsedWrongListening },
            wrongMemos: japMemos,
            estimateMeta: useEstimatedJapanese ? {
              isEstimated: true,
              confidence: japaneseEstimate.confidence,
              confidenceLabel: confidenceLabel(japaneseEstimate.confidence),
              basedOnSamples: japaneseEstimate.sampleSize,
            } : undefined,
          },
      comprehensive: entryMode === 'japanese'
        ? (base.comprehensive || editingExam?.comprehensive)
        : {
            score: useEstimatedComprehensive ? compEstimate.score : compScore,
            mistakes: mistakes.filter(m => m.unit || m.questionNumber),
            estimateMeta: useEstimatedComprehensive ? {
              isEstimated: true,
              confidence: compEstimate.confidence,
              confidenceLabel: confidenceLabel(compEstimate.confidence),
              basedOnSamples: compEstimate.sampleSize,
            } : undefined,
          },
    });
    showToast('저장되었습니다! 🎉', 'success');
    setTimeout(onSave, 600);
  };

  const effectiveReading = useEstimatedJapanese ? japaneseEstimate.reading : reading;
  const effectiveListening = useEstimatedJapanese ? japaneseEstimate.listening : listening;
  const effectiveCompScore = useEstimatedComprehensive ? compEstimate.score : compScore;
  const japTotal = effectiveReading + effectiveListening;

  // 일본어 메모 패널에서 표시할 번호 목록
  const memoNumbers = [
    ...parsedWrongReading.map(q => ({ key: `독해-${q}`, label: `독해 ${q}번` })),
    ...parsedWrongListening.map(q => ({ key: `청해-${q}`, label: `청해 ${q}번` })),
  ];

  const modeButtons = [
    { id: 'both', label: '📝 전체 입력', desc: '일본어 + 종합과목' },
    { id: 'japanese', label: '🇯🇵 일본어만', desc: '일본어만 입력' },
    { id: 'comprehensive', label: '📚 종합과목만', desc: '종합과목만 입력' },
  ];

  return (
    <>
      <form onSubmit={handleSubmit} style={{ maxWidth: 740 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--t0)', letterSpacing: '-0.5px' }}>
            {editingExam ? '✏️ 점수 수정' : '📊 점수 입력'}
          </h1>
          <div style={{ color: 'var(--t2)', fontSize: 13, marginTop: 5 }}>모의고사 결과를 기록하고 성장을 추적해보세요</div>
        </div>

        {/* Mode selector */}
        <div style={{ ...SECTION, padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {modeButtons.map(opt => {
            const active = entryMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setEntryMode(opt.id)}
                style={{
                  background: active ? 'linear-gradient(135deg, rgba(79,142,247,0.2), rgba(168,85,247,0.2))' : 'var(--bg3)',
                  color: active ? 'var(--blue)' : 'var(--t1)',
                  border: active ? '1.5px solid rgba(79,142,247,0.6)' : '1.5px solid var(--bd1)',
                  borderRadius: 12,
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  boxShadow: active ? '0 2px 12px rgba(79,142,247,0.2)' : 'none',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Basic info */}
        <div style={SECTION}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>📋</span> 기본 정보
          </div>
          {/* 기록 유형 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[{ id: 'exam', label: '📝 모의고사' }, { id: 'workbook', label: '📖 문제집' }].map(opt => {
              const active = recordType === opt.id;
              return (
                <button key={opt.id} type="button" onClick={() => setRecordType(opt.id)} style={{
                  background: active ? 'rgba(79,142,247,0.15)' : 'var(--bg3)',
                  color: active ? 'var(--blue)' : 'var(--t2)',
                  border: active ? '1.5px solid rgba(79,142,247,0.5)' : '1.5px solid var(--bd1)',
                  borderRadius: 10, padding: '7px 16px', fontSize: 12, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                }}>{opt.label}</button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
            <div>
              <label style={LABEL}>시험 연월</label>
              <input type="month" value={date} onChange={e => setDate(e.target.value)} style={INPUT}
                onFocus={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(79,142,247,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--bd1)'; e.target.style.boxShadow = 'none'; }} />
            </div>
            <div>
              <label style={LABEL}>시험 이름</label>
              <input type="text" value={examName} onChange={e => setExamName(e.target.value)}
                placeholder="예: 1월 EJU 모의고사 1회" style={INPUT}
                onFocus={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.boxShadow = '0 0 0 3px rgba(79,142,247,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--bd1)'; e.target.style.boxShadow = 'none'; }} />
            </div>
          </div>
          {!editingExam && latestExam && (
            <div style={{ marginTop: 14 }}>
              <button type="button" onClick={copyLatest} style={{
                background: 'rgba(79,142,247,0.1)', color: 'var(--blue)',
                border: '1px solid rgba(79,142,247,0.3)', borderRadius: 10,
                padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}>
                📋 최근 입력값 복사
              </button>
            </div>
          )}
        </div>

        {/* Japanese section */}
        {entryMode !== 'comprehensive' && (
          <div style={SECTION}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🇯🇵</span> 일본어
              </div>
              <div style={{
                fontSize: 22, fontWeight: 800, color: 'var(--blue)',
                background: 'rgba(79,142,247,0.1)', padding: '6px 16px', borderRadius: 12,
                border: '1px solid rgba(79,142,247,0.25)',
              }}>
                {japTotal} <span style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 400 }}>/ 370점</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
              <ScoreInput label="독해 (読解)" value={effectiveReading} onChange={setReading} max={JAP_READ_MAX} accent="var(--purple)" disabled={useEstimatedJapanese} onToast={showToast} />
              <ScoreInput label="청해 (聴解)" value={effectiveListening} onChange={setListening} max={JAP_LISTEN_MAX} accent="var(--pink)" disabled={useEstimatedJapanese} onToast={showToast} />
            </div>

            {/* 예측 체크박스 */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
              fontSize: 13, color: 'var(--t1)', cursor: 'pointer',
              padding: '10px 14px', borderRadius: 10, background: 'var(--bg3)',
              border: '1px solid var(--bd0)',
            }}>
              <input type="checkbox" checked={useEstimatedJapanese} onChange={e => setUseEstimatedJapanese(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--blue)' }} />
              <span>📊 점수 모름 — 틀린 번호로 자동 예측</span>
            </label>
            {useEstimatedJapanese && (
              <div style={{ background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 700 }}>
                  예측 점수: 독해 {japaneseEstimate.reading} / 청해 {japaneseEstimate.listening} (합계 {japaneseEstimate.total})
                </div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4 }}>
                  신뢰도 {confidenceLabel(japaneseEstimate.confidence)} ({Math.round(japaneseEstimate.confidence * 100)}%) · 학습데이터 {japaneseEstimate.sampleSize}회
                </div>
              </div>
            )}

            {/* 틀린 번호 입력 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={LABEL}>독해 틀린 번호</label>
                <input type="text" value={wrongReading} onChange={e => setWrongReading(e.target.value)}
                  placeholder="예: 3, 7, 12, 18, 25" style={INPUT}
                  onFocus={e => { e.target.style.borderColor = 'var(--purple)'; e.target.style.boxShadow = '0 0 0 3px rgba(168,85,247,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--bd1)'; e.target.style.boxShadow = 'none'; }} />
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 5 }}>쉼표 또는 공백으로 구분</div>
              </div>
              <div>
                <label style={LABEL}>청해 틀린 번호</label>
                <input type="text" value={wrongListening} onChange={e => setWrongListening(e.target.value)}
                  placeholder="예: 2, 8, 15, 22" style={INPUT}
                  onFocus={e => { e.target.style.borderColor = 'var(--pink)'; e.target.style.boxShadow = '0 0 0 3px rgba(236,72,153,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--bd1)'; e.target.style.boxShadow = 'none'; }} />
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 5 }}>쉼표 또는 공백으로 구분</div>
              </div>
            </div>

            {/* 일본어 번호별 메모 패널 */}
            {memoNumbers.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <button type="button" onClick={() => setShowJapMemoPanel(p => !p)} style={{
                  background: 'transparent', color: 'var(--t2)', border: '1px dashed var(--bd1)',
                  borderRadius: 10, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  📝 틀린 문제 메모 {showJapMemoPanel ? '▲ 닫기' : '▼ 열기'}
                  <span style={{ fontSize: 10, color: 'var(--t3)' }}>({memoNumbers.length}문제)</span>
                </button>
                {showJapMemoPanel && (
                  <div style={{
                    marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8,
                    padding: 14, background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--bd0)',
                  }}>
                    {memoNumbers.map(({ key, label }) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, minWidth: 64,
                          color: key.startsWith('독해') ? 'var(--purple)' : 'var(--pink)',
                          background: key.startsWith('독해') ? 'rgba(168,85,247,0.1)' : 'rgba(236,72,153,0.1)',
                          padding: '3px 8px', borderRadius: 6,
                        }}>{label}</span>
                        <input
                          type="text"
                          value={japMemos[key] || ''}
                          onChange={e => setJapMemos(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder="왜 틀렸는지 메모..."
                          style={{ ...INPUT, fontSize: 12 }}
                          onFocus={e => { e.target.style.borderColor = 'var(--blue)'; }}
                          onBlur={e => { e.target.style.borderColor = 'var(--bd1)'; }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Comprehensive section */}
        {entryMode !== 'japanese' && (
          <div style={SECTION}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>📚</span> 종합과목
            </div>
            <ScoreInput label="점수" value={effectiveCompScore} onChange={setCompScore} max={200} accent="var(--green)" disabled={useEstimatedComprehensive} onToast={showToast} />

            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, marginTop: 14,
              fontSize: 13, color: 'var(--t1)', cursor: 'pointer',
              padding: '10px 14px', borderRadius: 10, background: 'var(--bg3)',
              border: '1px solid var(--bd0)',
            }}>
              <input type="checkbox" checked={useEstimatedComprehensive} onChange={e => setUseEstimatedComprehensive(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--green)' }} />
              <span>📊 점수 모름 — 오답분석으로 자동 예측</span>
            </label>

            {useEstimatedComprehensive && (
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.28)', borderRadius: 12, padding: '12px 16px', marginTop: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>예측 점수: {compEstimate.score} / 200</div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4 }}>
                  신뢰도 {confidenceLabel(compEstimate.confidence)} ({Math.round(compEstimate.confidence * 100)}%) · 학습데이터 {compEstimate.sampleSize}회
                </div>
              </div>
            )}

            {/* 오답 분석 */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <label style={{ ...LABEL, marginBottom: 0 }}>오답 분석</label>
                <button type="button" onClick={addMistake} style={{
                  background: 'rgba(79,142,247,0.1)', color: 'var(--blue)',
                  border: '1px solid rgba(79,142,247,0.3)', borderRadius: 10,
                  padding: '7px 15px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}>+ 오답 추가</button>
              </div>

              {mistakes.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '24px', color: 'var(--t3)', fontSize: 13,
                  border: '1.5px dashed var(--bd1)', borderRadius: 12,
                  background: 'var(--bg3)',
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📝</div>
                  <div>오답 추가 버튼으로 틀린 문제를 기록하세요</div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mistakes.map(m => (
                  <div key={m.id} style={{
                    display: 'grid', gridTemplateColumns: '72px 1fr 1fr 1fr auto',
                    gap: 10, alignItems: 'start',
                    background: 'var(--bg3)', borderRadius: 14, padding: '14px',
                    border: '1px solid var(--bd0)',
                    transition: 'border-color 0.2s',
                  }}>
                    <div>
                      <div style={{ ...LABEL, fontSize: 10 }}>번호</div>
                      <input type="number" min={1} value={m.questionNumber}
                        onChange={e => updateMistake(m.id, 'questionNumber', e.target.value)}
                        style={{ ...INPUT, textAlign: 'center' }} placeholder="#"
                        onFocus={e => { e.target.style.borderColor = 'var(--blue)'; }}
                        onBlur={e => { e.target.style.borderColor = 'var(--bd1)'; }} />
                    </div>
                    <div>
                      <div style={{ ...LABEL, fontSize: 10 }}>단원</div>
                      <input type="text" value={m.unit} list="units-list"
                        onChange={e => updateMistake(m.id, 'unit', e.target.value)}
                        style={{ ...INPUT }} placeholder="단원명"
                        onFocus={e => { e.target.style.borderColor = 'var(--green)'; }}
                        onBlur={e => { e.target.style.borderColor = 'var(--bd1)'; }} />
                      <datalist id="units-list">{COMMON_UNITS.map(u => <option key={u} value={u} />)}</datalist>
                    </div>
                    <div>
                      <div style={{ ...LABEL, fontSize: 10 }}>오답 유형</div>
                      <select value={m.errorType} onChange={e => updateMistake(m.id, 'errorType', e.target.value)}
                        style={{ ...INPUT, cursor: 'pointer', appearance: 'none' }}
                        onFocus={e => { e.target.style.borderColor = 'var(--yellow)'; }}
                        onBlur={e => { e.target.style.borderColor = 'var(--bd1)'; }}>
                        {ERROR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ ...LABEL, fontSize: 10 }}>메모</div>
                      <input type="text" value={m.memo}
                        onChange={e => updateMistake(m.id, 'memo', e.target.value)}
                        style={{ ...INPUT }} placeholder="간단 메모"
                        onFocus={e => { e.target.style.borderColor = 'var(--blue)'; }}
                        onBlur={e => { e.target.style.borderColor = 'var(--bd1)'; }} />
                    </div>
                    <div style={{ paddingTop: 20 }}>
                      <button type="button" onClick={() => removeMistake(m.id)} style={{
                        background: 'rgba(239,68,68,0.1)', color: 'var(--red)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 8, padding: '9px 11px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                        transition: 'all 0.2s',
                      }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button type="submit" style={{
            background: 'linear-gradient(135deg, var(--blue), var(--purple))', color: '#fff',
            border: 'none', borderRadius: 14, padding: '14px 36px',
            fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            boxShadow: '0 6px 24px rgba(79,142,247,0.35)',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 10px 32px rgba(79,142,247,0.45)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 6px 24px rgba(79,142,247,0.35)'; }}
          >
            {editingExam ? '✅ 수정 완료' : '💾 저장하기'}
          </button>
          <button type="button" onClick={onCancel} style={{
            background: 'transparent', color: 'var(--t1)', border: '1.5px solid var(--bd1)',
            borderRadius: 14, padding: '14px 24px', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--t2)'; e.target.style.color = 'var(--t0)'; }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--bd1)'; e.target.style.color = 'var(--t1)'; }}
          >취소</button>
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
