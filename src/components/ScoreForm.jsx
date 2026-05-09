// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useState, useEffect } from 'react';
import { saveExam, getExams } from '../utils/storage';

const ERROR_TYPES  = ['실수', '정보부족', '연계사고부족'];
const COMMON_UNITS = ['정치', '경제', '사회', '지리', '역사', '현대사', '국제관계', '기타'];

const LABEL = {
  fontSize: 11, color: 'var(--t2)', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6,
};
const INPUT = {
  background: 'var(--bg3)', border: '1px solid var(--bd1)', borderRadius: 9,
  padding: '9px 13px', color: 'var(--t0)', fontSize: 13, fontFamily: 'inherit',
  width: '100%', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
};
const SECTION = {
  background: 'var(--bg2)', border: '1px solid var(--bd0)',
  borderRadius: 16, padding: 22, marginBottom: 18,
};

function ScoreInput({ label, value, onChange, max, accent }) {
  const pct = max ? Math.round((Number(value) / max) * 100) : 0;
  const color = pct >= 80 ? 'var(--green)' : pct >= 60 ? accent : pct >= 40 ? 'var(--yellow)' : 'var(--red)';
  return (
    <div>
      <label style={LABEL}>{label} <span style={{ color: 'var(--t3)', fontWeight: 400 }}>/ {max}점</span></label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="number" min={0} max={max} value={value}
          onChange={e => onChange(Math.min(max, Math.max(0, Number(e.target.value))))}
          style={{ ...INPUT, width: 90 }}
          onFocus={e => e.target.style.borderColor = accent}
          onBlur={e => e.target.style.borderColor = 'var(--bd1)'}
        />
        <div style={{ flex: 1 }}>
          <div style={{ height: 7, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 11, color, marginTop: 3 }}>{pct}%</div>
        </div>
      </div>
    </div>
  );
}

export default function ScoreForm({ editingExam, onSave, onCancel }) {
  const [entryMode, setEntryMode] = useState('both');
  const [date, setDate] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [examName, setExamName]         = useState('');
  const [reading, setReading]           = useState(0);
  const [listening, setListening]       = useState(0);
  const [wrongReading, setWrongReading] = useState('');
  const [wrongListening, setWrongListening] = useState('');
  const [compScore, setCompScore]       = useState(0);
  const [mistakes, setMistakes]         = useState([]);
  const [latestExam, setLatestExam]     = useState(null);

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
    setCompScore(editingExam.comprehensive?.score || 0);
    setMistakes(editingExam.comprehensive?.mistakes || []);
  }, [editingExam]);

  const parseNums = str => str.split(/[\s,]+/).map(Number).filter(n => Number.isInteger(n) && n > 0);
  const copyLatest = () => {
    if (!latestExam) return;
    setExamName(`${latestExam.examName || '이전 시험'} 복사`);
    setReading(latestExam.japanese?.reading || 0);
    setListening(latestExam.japanese?.listening || 0);
    setWrongReading((latestExam.japanese?.wrongQuestions?.reading || []).join(', '));
    setWrongListening((latestExam.japanese?.wrongQuestions?.listening || []).join(', '));
    setCompScore(latestExam.comprehensive?.score || 0);
    setMistakes((latestExam.comprehensive?.mistakes || []).map(m => ({ ...m, id: crypto.randomUUID() })));
  };
  const addMistake = () => setMistakes(m => [...m, { id: crypto.randomUUID(), questionNumber: '', unit: '', errorType: '정보부족', memo: '' }]);
  const updateMistake = (id, field, val) => setMistakes(m => m.map(x => x.id === id ? { ...x, [field]: val } : x));
  const removeMistake = id => setMistakes(m => m.filter(x => x.id !== id));

  const handleSubmit = e => {
    e.preventDefault();
    const existingSameMonth = !editingExam
      ? getExams().find(ex => ex.date === date)
      : null;
    const base = existingSameMonth || {};

    saveExam({
      id: editingExam?.id || existingSameMonth?.id || crypto.randomUUID(),
      date,
      examName: examName.trim() || `${date} 모의고사`,
      japanese: entryMode === 'comprehensive'
        ? (base.japanese || editingExam?.japanese)
        : {
            reading, listening,
            wrongQuestions: { reading: parseNums(wrongReading), listening: parseNums(wrongListening) },
          },
      comprehensive: entryMode === 'japanese'
        ? (base.comprehensive || editingExam?.comprehensive)
        : {
            score: compScore,
            mistakes: mistakes.filter(m => m.unit || m.questionNumber),
          },
    });
    onSave();
  };

  const japTotal = reading + listening;

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--t0)' }}>{editingExam ? '점수 수정' : '점수 입력'}</h1>
        <div style={{ color: 'var(--t2)', fontSize: 13, marginTop: 3 }}>모의고사 결과를 기록해보세요</div>
      </div>

      <div style={{ ...SECTION, padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { id: 'both', label: '일본어 + 종합과목' },
          { id: 'japanese', label: '일본어만 입력' },
          { id: 'comprehensive', label: '종합과목만 입력' },
        ].map(opt => {
          const active = entryMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setEntryMode(opt.id)}
              style={{
                background: active ? 'rgba(79,142,247,0.16)' : 'var(--bg3)',
                color: active ? 'var(--blue)' : 'var(--t1)',
                border: active ? '1px solid rgba(79,142,247,0.55)' : '1px solid var(--bd1)',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Basic */}
      <div style={SECTION}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t0)', marginBottom: 16 }}>📋 기본 정보</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
          <div>
            <label style={LABEL}>시험 연월</label>
            <input type="month" value={date} onChange={e => setDate(e.target.value)} style={INPUT}
              onFocus={e => e.target.style.borderColor = 'var(--blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--bd1)'} />
          </div>
          <div>
            <label style={LABEL}>시험 이름</label>
            <input type="text" value={examName} onChange={e => setExamName(e.target.value)}
              placeholder="예: 1월 EJU 모의고사 1회" style={INPUT}
              onFocus={e => e.target.style.borderColor = 'var(--blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--bd1)'} />
          </div>
        </div>
        {!editingExam && latestExam && (
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={copyLatest}
              style={{
                background: 'rgba(79,142,247,0.1)',
                color: 'var(--blue)',
                border: '1px solid rgba(79,142,247,0.3)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              최근 입력값 복사
            </button>
          </div>
        )}
      </div>

      {/* Japanese */}
      {entryMode !== 'comprehensive' && (
      <div style={SECTION}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t0)' }}>🇯🇵 일본어</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--blue)' }}>
            {japTotal} <span style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 400 }}>/ 400점</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
          <ScoreInput label="독해 (読解)" value={reading} onChange={setReading} max={200} accent="var(--purple)" />
          <ScoreInput label="청해 (聴解)" value={listening} onChange={setListening} max={200} accent="var(--pink)" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={LABEL}>독해 틀린 번호</label>
            <input type="text" value={wrongReading} onChange={e => setWrongReading(e.target.value)}
              placeholder="예: 3, 7, 12, 18, 25" style={INPUT}
              onFocus={e => e.target.style.borderColor = 'var(--purple)'}
              onBlur={e => e.target.style.borderColor = 'var(--bd1)'} />
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>쉼표 또는 공백으로 구분</div>
          </div>
          <div>
            <label style={LABEL}>청해 틀린 번호</label>
            <input type="text" value={wrongListening} onChange={e => setWrongListening(e.target.value)}
              placeholder="예: 2, 8, 15, 22" style={INPUT}
              onFocus={e => e.target.style.borderColor = 'var(--pink)'}
              onBlur={e => e.target.style.borderColor = 'var(--bd1)'} />
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>쉼표 또는 공백으로 구분</div>
          </div>
        </div>
      </div>
      )}

      {/* Comprehensive */}
      {entryMode !== 'japanese' && (
      <div style={SECTION}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t0)', marginBottom: 16 }}>📚 종합과목</div>
        <ScoreInput label="점수" value={compScore} onChange={setCompScore} max={200} accent="var(--green)" />

        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={{ ...LABEL, marginBottom: 0 }}>오답 분석</label>
            <button type="button" onClick={addMistake} style={{
              background: 'rgba(79,142,247,0.1)', color: 'var(--blue)',
              border: '1px solid rgba(79,142,247,0.3)', borderRadius: 8,
              padding: '5px 13px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}>+ 오답 추가</button>
          </div>

          {mistakes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '18px', color: 'var(--t3)', fontSize: 12, border: '1px dashed var(--bd1)', borderRadius: 10 }}>
              오답 추가 버튼으로 틀린 문제를 기록하세요
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mistakes.map(m => (
              <div key={m.id} style={{
                display: 'grid', gridTemplateColumns: '72px 1fr 1fr 1fr auto',
                gap: 8, alignItems: 'start',
                background: 'var(--bg3)', borderRadius: 11, padding: '12px',
                border: '1px solid var(--bd0)',
              }}>
                <div>
                  <div style={{ ...LABEL, fontSize: 10 }}>번호</div>
                  <input type="number" min={1} value={m.questionNumber}
                    onChange={e => updateMistake(m.id, 'questionNumber', e.target.value)}
                    style={{ ...INPUT, textAlign: 'center' }} placeholder="#"
                    onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                    onBlur={e => e.target.style.borderColor = 'var(--bd1)'} />
                </div>
                <div>
                  <div style={{ ...LABEL, fontSize: 10 }}>단원</div>
                  <input type="text" value={m.unit} list="units-list"
                    onChange={e => updateMistake(m.id, 'unit', e.target.value)}
                    style={{ ...INPUT }} placeholder="단원명"
                    onFocus={e => e.target.style.borderColor = 'var(--green)'}
                    onBlur={e => e.target.style.borderColor = 'var(--bd1)'} />
                  <datalist id="units-list">{COMMON_UNITS.map(u => <option key={u} value={u} />)}</datalist>
                </div>
                <div>
                  <div style={{ ...LABEL, fontSize: 10 }}>오답 유형</div>
                  <select value={m.errorType} onChange={e => updateMistake(m.id, 'errorType', e.target.value)}
                    style={{ ...INPUT, cursor: 'pointer', appearance: 'none' }}
                    onFocus={e => e.target.style.borderColor = 'var(--yellow)'}
                    onBlur={e => e.target.style.borderColor = 'var(--bd1)'}>
                    {ERROR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ ...LABEL, fontSize: 10 }}>메모</div>
                  <input type="text" value={m.memo}
                    onChange={e => updateMistake(m.id, 'memo', e.target.value)}
                    style={{ ...INPUT }} placeholder="간단 메모"
                    onFocus={e => e.target.style.borderColor = 'var(--bd1)'}
                    onBlur={e => e.target.style.borderColor = 'var(--bd1)'} />
                </div>
                <div style={{ paddingTop: 20 }}>
                  <button type="button" onClick={() => removeMistake(m.id)} style={{
                    background: 'transparent', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 7, padding: '8px 10px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
                  }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" style={{
          background: 'linear-gradient(135deg, var(--blue), var(--purple))', color: '#fff',
          border: 'none', borderRadius: 11, padding: '13px 30px',
          fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          boxShadow: '0 4px 18px rgba(79,142,247,0.3)',
        }}>
          {editingExam ? '수정 완료' : '저장하기'}
        </button>
        <button type="button" onClick={onCancel} style={{
          background: 'transparent', color: 'var(--t1)', border: '1px solid var(--bd1)',
          borderRadius: 11, padding: '13px 22px', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
        }}>취소</button>
      </div>
    </form>
  );
}
