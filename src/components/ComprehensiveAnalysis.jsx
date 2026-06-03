// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { COMP_MAX, COMP_QUESTIONS, normalizeCompScore } from '../utils/storage';
import { predictGoalDate } from '../utils/scorePrediction';
import { BarChart2, Plus, Calculator, GitBranch, TrendingDown, PieChart as PieIcon, BarChart3, Layers, Flag, Search, AlertTriangle, X } from 'lucide-react';

const CARD = { background: 'var(--card-bg)', border: '1px solid var(--bd0)', borderRadius: 18, padding: 24, boxShadow: 'var(--card-shadow)' };

const ERROR_COLORS = { '실수': 'var(--yellow)', '정보부족': 'var(--red)', '연계사고부족': 'var(--purple)' };
const ERROR_COLORS_HEX = { '실수': '#f59e0b', '정보부족': '#ef4444', '연계사고부족': '#1B64DA' };
const ERROR_WEIGHT  = { '정보부족': 3, '연계사고부족': 2, '실수': 1 };
const ERROR_DESC    = {
  '실수': '알고 있지만 실수로 틀린 문제 — 빠르게 해결 가능',
  '정보부족': '해당 내용 자체를 몰라서 틀린 문제 — 암기·학습 필요',
  '연계사고부족': '각각은 알지만 연결 못한 문제 — 응용 연습 필요',
};

const POINT_PER_Q = COMP_MAX / COMP_QUESTIONS; // ~4.95

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--tooltip-bg)', border: '1px solid var(--bd1)', borderRadius: 12, padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <div style={{ color: 'var(--t1)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: 'var(--t0)', fontWeight: 600 }}>{p.name}: {p.value}{p.name === '점수' ? '점' : '건'}</div>
      ))}
    </div>
  );
};

// ── MemoModal: 오답 메모 전체보기 (React Portal) ──────────
function MemoModal({ mistake, onClose, onSave }) {
  const [editText, setEditText] = useState(mistake?.memo || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSave = useCallback(() => {
    setSaving(true);
    // Call the save function passed from parent
    if (onSave) onSave(mistake, editText);
    setTimeout(() => { setSaving(false); onClose(); }, 200);
  }, [mistake, editText, onSave, onClose]);

  if (!mistake) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--card-bg)', border: '1px solid var(--bd0)',
          borderRadius: 18, width: '100%', maxWidth: 500, maxHeight: '80vh',
          overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t0)' }}>오답 메모</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>
              {mistake.examName} · {mistake.questionNumber}번 · {mistake.unit || '미분류'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg3)', border: 'none', borderRadius: 10,
              width: 36, height: 36, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: 'var(--t1)',
              fontFamily: 'inherit',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Error type badge */}
        {mistake.errorType && (
          <div style={{ marginBottom: 16 }}>
            <span style={{
              background: ERROR_COLORS_HEX[mistake.errorType] + '22',
              color: ERROR_COLORS_HEX[mistake.errorType],
              padding: '4px 12px', borderRadius: 8, fontWeight: 700, fontSize: 13,
            }}>
              {mistake.errorType}
            </span>
          </div>
        )}

        {/* Memo display / edit */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
            메모 내용
          </label>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="이 문제에서 틀린 이유를 기록하세요..."
            style={{
              width: '100%', minHeight: 120, resize: 'vertical',
              background: 'var(--bg2)', border: '1.5px solid var(--bd1)',
              borderRadius: 12, padding: '12px 14px', color: 'var(--t0)',
              fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6,
              outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--bd1)'}
            autoFocus
          />
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6, textAlign: 'right' }}>
            {editText.length}자
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: 10, border: '1px solid var(--bd1)',
              background: 'transparent', color: 'var(--t1)', fontWeight: 600,
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none',
              background: saving ? 'var(--bg3)' : 'linear-gradient(135deg, var(--blue), var(--green))',
              color: saving ? 'var(--t3)' : '#fff', fontWeight: 700, fontSize: 13,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );

  // Use React Portal if available, otherwise render inline
  try {
    const portalRoot = document.getElementById('portal-root') || document.body;
    // We render via createPortal if in a React environment with portal support
    // For simplicity, just render the overlay directly (works same as portal)
    return modalContent;
  } catch {
    return modalContent;
  }
}

// ── 허용 오답 계산기 ──────────────────────────────────
function AllowedWrongCalc({ currentScore }) {
  const [targetScore, setTargetScore] = useState(currentScore > 0 ? currentScore : 170);
  const allowedWrong = Math.floor((COMP_MAX - targetScore) / POINT_PER_Q);
  const correctNeeded = COMP_QUESTIONS - allowedWrong;
  const pct = Math.round((correctNeeded / COMP_QUESTIONS) * 100);

  return (
    <div style={{ ...CARD }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Calculator size={15} color="var(--t2)" strokeWidth={2} />
        허용 오답 계산기
        <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400, marginLeft: 4 }}>
          40문항 × {POINT_PER_Q.toFixed(2)}점 (득점등화 기준)
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 500, minWidth: 80 }}>목표 점수</span>
        <input
          type="number" min={0} max={COMP_MAX} value={targetScore}
          onChange={e => setTargetScore(Math.min(COMP_MAX, Math.max(0, Number(e.target.value))))}
          style={{
            width: 80, background: 'var(--bg3)', border: '1.5px solid var(--bd1)', borderRadius: 9,
            padding: '8px 10px', color: 'var(--t0)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--green)'}
          onBlur={e => e.target.style.borderColor = 'var(--bd1)'}
        />
        <span style={{ fontSize: 12, color: 'var(--t2)' }}>/ {COMP_MAX}점</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: '허용 오답', value: allowedWrong, unit: '문제', color: 'var(--red)', bg: 'rgba(239,68,68,0.08)' },
          { label: '필요 정답', value: correctNeeded, unit: '문제', color: 'var(--green)', bg: 'rgba(16,185,129,0.08)' },
          { label: '정답률 목표', value: `${pct}%`, unit: '', color: 'var(--blue)', bg: 'rgba(49,130,246,0.08)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '12px 16px', textAlign: 'center', border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--t2)', marginLeft: 2 }}>{s.unit}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 단원별 레이더 차트 ────────────────────────────────
function UnitRadarChart({ unitPriority }) {
  if (unitPriority.length < 3) return null;
  const maxScore = unitPriority[0]?.score || 1;
  const data = unitPriority.slice(0, 8).map(u => ({
    subject: u.unit,
    취약도: Math.round((u.score / maxScore) * 100),
    fullMark: 100,
  }));

  return (
    <div style={{ ...CARD }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
        <GitBranch size={15} color="var(--t2)" strokeWidth={2} /> 단원별 취약도 레이더
      </div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8 }}>높을수록 취약한 단원 (정보부족×3 · 연계사고부족×2 · 실수×1 가중치)</div>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="var(--chart-grid)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--t1)', fontSize: 12, fontWeight: 600, fontFamily: 'Pretendard, sans-serif' }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'var(--t3)', fontSize: 9, fontFamily: 'Pretendard, sans-serif' }} />
          <Radar name="취약도" dataKey="취약도" stroke="#ef4444" fill="#ef4444" fillOpacity={0.25} dot={{ fill: '#ef4444', r: 3 }} />
          <Tooltip
            contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--bd1)', borderRadius: 10, fontSize: 12 }}
            formatter={(v) => [`${v}점`, '취약도']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 단원별 추세 차트 ──────────────────────────────────
function UnitTrendChart({ exams, topUnits }) {
  if (exams.length < 2 || topUnits.length === 0) return null;
  const units = topUnits.slice(0, 4).map(u => u.unit);
  const data = exams.map(e => {
    const row = { name: e.date };
    units.forEach(u => {
      row[u] = (e.comprehensive?.mistakes || []).filter(m => m.unit === u).length;
    });
    return row;
  }).filter(r => units.some(u => r[u] > 0));

  if (data.length < 2) return null;

  const COLORS = ['#ef4444', '#f59e0b', '#1B64DA', '#1B64DA'];

  return (
    <div style={{ ...CARD }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
        <TrendingDown size={15} color="var(--t2)" strokeWidth={2} /> 단원별 오답 추세
      </div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 16 }}>취약 상위 4개 단원의 오답 수 변화</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="name" tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} />
          <YAxis tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} allowDecimals={false} />
          <Tooltip contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--bd1)', borderRadius: 10, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--t1)' }} />
          {units.map((u, i) => (
            <Line key={u} type="monotone" dataKey={u} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ComprehensiveAnalysis({ exams, settings, onAddNew }) {
  const tComp = settings?.targetComprehensive ?? 170;

  // ── 필터 상태 ──────────────────────────────────────
  const [filterUnit, setFilterUnit]   = useState('');
  const [filterType, setFilterType]   = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [sortCol, setSortCol]         = useState('date');
  const [sortDir, setSortDir]         = useState('desc');
  const [filterRecordType, setFilterRecordType] = useState('all'); // 'all'|'exam'|'workbook'
  // ── Memo Modal state ────────────────────────────────
  const [memoModalMistake, setMemoModalMistake] = useState(null);

  // Memo save handler: updates the mistake's memo in the exam record
  const handleMemoSave = useCallback((mistake, newMemo) => {
    try {
      const examsData = JSON.parse(localStorage.getItem('eju_exam_data') || '[]');
      const updated = examsData.map(exam => {
        if (exam.date !== mistake.examDate && exam.examName !== mistake.examName) return exam;
        const mistakes = (exam.comprehensive?.mistakes || []).map(m => {
          if (m.id === mistake.id && m.questionNumber === mistake.questionNumber) {
            return { ...m, memo: newMemo };
          }
          return m;
        });
        return { ...exam, comprehensive: { ...exam.comprehensive, mistakes } };
      });
      localStorage.setItem('eju_exam_data', JSON.stringify(updated));
    } catch (e) {
      console.warn('[Memo] Failed to save memo:', e);
    }
  }, []);

  const filteredExams = useMemo(() =>
    filterRecordType === 'all' ? exams : exams.filter(e => (e.recordType || 'exam') === filterRecordType),
    [exams, filterRecordType]
  );

  const allMistakes = useMemo(() =>
    filteredExams.flatMap(e => (e.comprehensive?.mistakes || []).map(m => ({ ...m, examDate: e.date, examName: e.examName }))),
    [filteredExams]
  );

  const allUnits = useMemo(() => [...new Set(allMistakes.map(m => m.unit).filter(Boolean))].sort(), [allMistakes]);

  const unitPriority = useMemo(() => {
    const map = {};
    allMistakes.forEach(m => {
      if (!m.unit) return;
      if (!map[m.unit]) map[m.unit] = { count: 0, score: 0, types: { '실수': 0, '정보부족': 0, '연계사고부족': 0 } };
      map[m.unit].count++;
      map[m.unit].score += ERROR_WEIGHT[m.errorType] || 1;
      if (m.errorType) map[m.unit].types[m.errorType]++;
    });
    return Object.entries(map)
      .map(([unit, d]) => ({ unit, ...d }))
      .sort((a, b) => b.score - a.score);
  }, [allMistakes]);

  const unitCounts = useMemo(() => {
    const map = {};
    allMistakes.forEach(m => { if (m.unit) map[m.unit] = (map[m.unit] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([unit, count]) => ({ unit, count }));
  }, [allMistakes]);

  const errorTypeCounts = useMemo(() => {
    const map = { '실수': 0, '정보부족': 0, '연계사고부족': 0 };
    allMistakes.forEach(m => { if (m.errorType) map[m.errorType]++; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).filter(x => x.value > 0);
  }, [allMistakes]);

  const scoreChartData = useMemo(() =>
    filteredExams.map(e => {
      const normScore = normalizeCompScore(e.comprehensive);
      return {
        name: e.date,
        점수: normScore ?? undefined,
        예상정답: normScore != null
          ? Math.round((normScore / COMP_MAX) * COMP_QUESTIONS)
          : undefined,
      };
    }).filter(e => e.점수 !== undefined),
    [filteredExams]
  );

  const unitErrorMap = useMemo(() => {
    const map = {};
    allMistakes.forEach(m => {
      if (!m.unit) return;
      if (!map[m.unit]) map[m.unit] = { '실수': 0, '정보부족': 0, '연계사고부족': 0 };
      if (m.errorType) map[m.unit][m.errorType]++;
    });
    return Object.entries(map)
      .sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0))
      .map(([unit, counts]) => ({ unit, ...counts, total: Object.values(counts).reduce((s, v) => s + v, 0) }));
  }, [allMistakes]);

  const filteredMistakes = useMemo(() => {
    let list = [...allMistakes];
    if (filterUnit) list = list.filter(m => m.unit === filterUnit);
    if (filterType) list = list.filter(m => m.errorType === filterType);
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      list = list.filter(m =>
        String(m.questionNumber).includes(q) ||
        (m.unit || '').toLowerCase().includes(q) ||
        (m.memo || '').toLowerCase().includes(q) ||
        (m.examName || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let va, vb;
      if (sortCol === 'date')  { va = a.examDate; vb = b.examDate; }
      else if (sortCol === 'unit') { va = a.unit || ''; vb = b.unit || ''; }
      else { va = a.errorType || ''; vb = b.errorType || ''; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [allMistakes, filterUnit, filterType, filterSearch, sortCol, sortDir]);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };
  const sortIndicator = (col) => sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';

  // Goal date prediction (득점등화 기준)
  const goalDate = useMemo(() =>
    predictGoalDate(
      filteredExams.filter(e => e.comprehensive?.score != null),
      tComp,
      e => normalizeCompScore(e.comprehensive)
    ),
    [filteredExams, tComp]
  );

  // Current score for allowed-wrong calc (득점등화 기준)
  const latestCompScore = useMemo(() => {
    const reversed = [...filteredExams].reverse();
    const found = reversed.find(e => e.comprehensive?.score != null);
    return found ? (normalizeCompScore(found.comprehensive) ?? 0) : 0;
  }, [filteredExams]);

  if (!exams || exams.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 18, padding: '40px 20px', textAlign: 'center' }}>
        <div style={{
          width: 88, height: 88, borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(52,217,141,0.1), rgba(49,130,246,0.1))',
          border: '1px solid rgba(52,217,141,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BarChart2 size={38} color="var(--green)" strokeWidth={1.5} style={{ opacity: 0.75 }} />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--t0)', letterSpacing: '-0.4px', marginBottom: 8 }}>종합과목 기록이 없어요</div>
          <div style={{ color: 'var(--t2)', fontSize: 13.5, lineHeight: 1.8, maxWidth: 300 }}>
            종합과목 점수를 입력하면<br />오답 패턴과 성적 추이를 분석해드려요
          </div>
        </div>
        <button
          onClick={onAddNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'linear-gradient(135deg, var(--green), var(--blue))',
            color: '#fff', border: 'none', borderRadius: 12,
            padding: '11px 22px', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(52,217,141,0.25)',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          점수 입력하기
        </button>
      </div>
    );
  }

  const totalMistakes = allMistakes.length;
  const mostWeakUnit  = unitPriority[0];
  const mostCommonError = [...errorTypeCounts].sort((a, b) => b.value - a.value)[0];
  const avgScore = (() => {
    const withScores = filteredExams.map(e => normalizeCompScore(e.comprehensive));
    const valid = withScores.filter(s => s != null);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Memo Modal */}
      {memoModalMistake && (
        <MemoModal
          mistake={memoModalMistake}
          onClose={() => setMemoModalMistake(null)}
          onSave={handleMemoSave}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {[
          { label: '총 오답', value: totalMistakes, unit: '건', color: 'var(--red)', subtitle: `${filteredExams.length}회 시험` },
          { label: '최다 취약 단원', value: mostWeakUnit?.unit || '—', color: 'var(--purple)', subtitle: mostWeakUnit ? `${mostWeakUnit.count}회` : '' },
          { label: '최다 오답 유형', value: mostCommonError?.name || '—', color: 'var(--yellow)', subtitle: mostCommonError ? `${mostCommonError.value}회` : '' },
          { label: '평균 점수', value: avgScore != null ? `${Math.round(avgScore)}점` : '—', color: avgScore != null && avgScore >= tComp ? 'var(--green)' : 'var(--blue)', subtitle: `목표 ${tComp}점` },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--card-bg)', border: '1px solid var(--bd0)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}{s.unit ? <span style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 400, marginLeft: 2 }}>{s.unit}</span> : ''}</div>
            {s.subtitle && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{s.subtitle}</div>}
          </div>
        ))}
      </div>

      {/* 점수 추세 */}
      {scoreChartData.length >= 1 && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
            <BarChart3 size={15} color="var(--t2)" strokeWidth={2} /> 점수 추이
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 16 }}>득점등화 점수 기준 (만점 {COMP_MAX}점)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={scoreChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--t2)', fontSize: 11, fontFamily: 'Pretendard, sans-serif' }} />
              <YAxis domain={[0, COMP_MAX]} tick={{ fill: 'var(--t2)', fontSize: 11, fontFamily: 'Pretendard, sans-serif' }} />
              <Tooltip contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--bd1)', borderRadius: 10, fontSize: 12 }} />
              <ReferenceLine y={tComp} stroke="var(--green)" strokeDasharray="6 3" label={{ value: `목표 ${tComp}`, fill: 'var(--green)', fontSize: 11, fontFamily: 'Pretendard, sans-serif' }} />
              <Line type="monotone" dataKey="점수" stroke="var(--blue)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--blue)' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="예상정답" stroke="var(--t3)" strokeWidth={1} dot={{ r: 2 }} strokeDasharray="4 3" />
            </LineChart>
          </ResponsiveContainer>
          {goalDate && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--t2)' }}>
              <Flag size={13} color="var(--green)" />
              현재 추세라면 <b style={{ color: 'var(--t0)' }}>{goalDate}</b>에 목표 <b style={{ color: 'var(--green)' }}>{tComp}점</b> 도달 예상
            </div>
          )}
        </div>
      )}

      {/* 오답 유형 분포 */}
      {errorTypeCounts.length > 0 && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
            <PieIcon size={15} color="var(--t2)" strokeWidth={2} /> 오답 유형 분포
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={errorTypeCounts} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" nameKey="name">
                  {errorTypeCounts.map((entry, i) => (
                    <Cell key={entry.name} fill={ERROR_COLORS_HEX[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--bd1)', borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {errorTypeCounts.map(et => (
                <div key={et.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t0)', fontWeight: 600, marginBottom: 4 }}>
                    <span style={{ color: ERROR_COLORS_HEX[et.name] }}>{et.name}</span>
                    <span>{et.value}건 ({Math.round((et.value / totalMistakes) * 100)}%)</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(et.value / totalMistakes) * 100}%`, height: '100%', background: ERROR_COLORS_HEX[et.name], borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{ERROR_DESC[et.name] || ''}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 단원별 오답 분포 */}
      {unitCounts.length > 0 && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Layers size={15} color="var(--t2)" strokeWidth={2} /> 단원별 오답 분포
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 16 }}>총 {unitCounts.length}개 단원</div>
          <ResponsiveContainer width="100%" height={Math.max(150, unitCounts.length * 32)}>
            <BarChart data={unitCounts} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} />
              <YAxis type="category" dataKey="unit" tick={{ fill: 'var(--t1)', fontSize: 12, fontWeight: 600, fontFamily: 'Pretendard, sans-serif' }} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={24}>
                {unitCounts.map((entry, i) => (
                  <Cell key={entry.unit} fill={COLORS[i % COLORS.length] || '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 단원별 오답 유형 상세 */}
      {unitErrorMap.length > 0 && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
            <AlertTriangle size={15} color="var(--t2)" strokeWidth={2} /> 단원별 오답 유형 상세
          </div>
          {unitErrorMap.slice(0, 10).map(u => (
            <div key={u.unit} style={{ marginBottom: 14, borderBottom: '1px solid var(--bg3)', paddingBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)', marginBottom: 6 }}>{u.unit} <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400 }}>({u.total}회)</span></div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['실수', '정보부족', '연계사고부족'].filter(t => u[t] > 0).map(t => (
                  <span key={t} style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                    background: ERROR_COLORS_HEX[t] + '18', color: ERROR_COLORS_HEX[t],
                  }}>
                    {t}: {u[t]}회
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 오답 목록 테이블 */}
      <div style={{ ...CARD }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Search size={15} color="var(--t2)" strokeWidth={2} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)' }}>오답 목록</span>
            <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 400 }}>총 {allMistakes.length}건</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Filter: 기록 유형 */}
            <select value={filterRecordType} onChange={e => setFilterRecordType(e.target.value)}
              style={{ background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 8, padding: '5px 8px', color: 'var(--t0)', fontSize: 11, fontFamily: 'inherit' }}>
              <option value="all">전체</option>
              <option value="exam">시험</option>
              <option value="workbook">문제집</option>
            </select>
            {/* Filter: 단원 */}
            <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
              style={{ background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 8, padding: '5px 8px', color: 'var(--t0)', fontSize: 11, fontFamily: 'inherit' }}>
              <option value="">전체 단원</option>
              {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            {/* Filter: 오답 유형 */}
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 8, padding: '5px 8px', color: 'var(--t0)', fontSize: 11, fontFamily: 'inherit' }}>
              <option value="">전체 유형</option>
              <option value="실수">실수</option>
              <option value="정보부족">정보 부족</option>
              <option value="연계사고부족">연계 사고 부족</option>
            </select>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={13} color="var(--t3)" style={{ position: 'absolute', left: 10, top: 7 }} />
              <input
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="검색..."
                style={{
                  background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 8,
                  padding: '5px 10px 5px 28px', color: 'var(--t0)', fontSize: 11,
                  fontFamily: 'inherit', width: 120, outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Desktop: Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--bd0)' }}>
                {[
                  { key: 'date', label: '날짜' },
                  { key: '', label: '시험명' },
                  { key: '', label: '문항' },
                  { key: 'unit', label: '단원' },
                  { key: 'errorType', label: '오답 유형' },
                  { key: null, label: '메모' },
                ].map(({ key, label }) => (
                  <th
                    key={label}
                    onClick={key ? () => toggleSort(key) : undefined}
                    style={{
                      padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                      borderBottom: '1px solid var(--bd0)', fontSize: 11, textTransform: 'uppercase',
                      letterSpacing: '0.06em', whiteSpace: 'nowrap',
                      cursor: key ? 'pointer' : 'default',
                      color: key && sortCol === key ? 'var(--blue)' : 'var(--t2)',
                    }}
                  >
                    {label}{key ? sortIndicator(key) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMistakes.map((m, i) => (
                <tr key={m.id || i} style={{ borderBottom: '1px solid var(--bg3)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '11px 14px', color: 'var(--t2)', whiteSpace: 'nowrap', fontSize: 11 }}>{m.examDate}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--t1)', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.examName}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--t0)', fontWeight: 700, textAlign: 'center' }}>{m.questionNumber}번</td>
                  <td style={{ padding: '11px 14px' }}>
                    {m.unit ? (
                      <span style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--green)', padding: '3px 10px', borderRadius: 7, fontWeight: 600 }}>{m.unit}</span>
                    ) : <span style={{ color: 'var(--t3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {m.errorType ? (
                      <span style={{ background: ERROR_COLORS_HEX[m.errorType] + '22', color: ERROR_COLORS_HEX[m.errorType], padding: '3px 10px', borderRadius: 7, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {m.errorType}
                      </span>
                    ) : <span style={{ color: 'var(--t3)' }}>—</span>}
                  </td>
                  {/* Memo cell: clickable */}
                  <td
                    style={{ padding: '11px 14px', color: 'var(--t2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                    onClick={() => setMemoModalMistake(m)}
                    title={m.memo || '메모를 입력하세요'}
                  >
                    <span style={{
                      borderBottom: m.memo ? '1px dashed var(--bd1)' : '1px dashed var(--t3)',
                      paddingBottom: 1,
                    }}>
                      {m.memo || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
