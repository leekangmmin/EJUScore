// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { COMP_MAX, COMP_QUESTIONS, normalizeCompScore } from '../utils/storage';
import { predictGoalDate } from '../utils/scorePrediction';
import { BarChart2, Plus, Calculator, GitBranch, TrendingDown, PieChart as PieIcon, BarChart3, Layers, Flag, Search, AlertTriangle } from 'lucide-react';

const CARD = { background: 'var(--card-bg)', border: '1px solid var(--bd0)', borderRadius: 18, padding: 24, boxShadow: 'var(--card-shadow)' };

const ERROR_COLORS = { '실수': 'var(--yellow)', '정보부족': 'var(--red)', '연계사고부족': 'var(--purple)' };
const ERROR_COLORS_HEX = { '실수': '#f59e0b', '정보부족': '#ef4444', '연계사고부족': '#a855f7' };
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
          { label: '정답률 목표', value: `${pct}%`, unit: '', color: 'var(--blue)', bg: 'rgba(79,142,247,0.08)' },
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

  const COLORS = ['#ef4444', '#f59e0b', '#a855f7', '#4f8ef7'];

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
          background: 'linear-gradient(135deg, rgba(52,217,141,0.1), rgba(107,163,255,0.1))',
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
    const withScores = filteredExams.map(e => normalizeCompScore(e.comprehensive)).filter(v => v != null);
    return withScores.length > 0 ? withScores.reduce((s, v) => s + v, 0) / withScores.length : 0;
  })();
  const avgCorrect = Math.round((avgScore / COMP_MAX) * COMP_QUESTIONS);

  const PRIORITY_LABELS = ['최우선', '우선', '보통', '낮음'];
  const getPriorityLabel = (i) => PRIORITY_LABELS[Math.min(i, PRIORITY_LABELS.length - 1)];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--t0)', letterSpacing: '-0.5px' }}>종합과목 분석</h1>
        <div style={{ color: 'var(--t2)', fontSize: 13, marginTop: 5 }}>
          총 {filteredExams.length}회 시험 · 누적 오답 {totalMistakes}건 · 목표 {tComp}/{COMP_MAX}
          {goalDate && !goalDate.alreadyAchieved && (
            <span style={{ marginLeft: 12, color: 'var(--green)', fontWeight: 600 }}>
              · 목표 달성 예상 {goalDate.date} (약 {goalDate.monthsAhead}개월)
            </span>
          )}
          {goalDate?.alreadyAchieved && (
            <span style={{ marginLeft: 12, color: 'var(--green)', fontWeight: 700 }}>· 목표 달성</span>
          )}
        </div>
      </div>

      {/* Record type filter */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[{ id: 'all', label: '전체' }, { id: 'exam', label: '모의고사' }, { id: 'workbook', label: '문제집' }].map(opt => {
          const active = filterRecordType === opt.id;
          return (
            <button key={opt.id} onClick={() => setFilterRecordType(opt.id)} style={{
              background: active ? 'rgba(79,142,247,0.15)' : 'var(--bg3)',
              color: active ? 'var(--blue)' : 'var(--t2)',
              border: active ? '1.5px solid rgba(79,142,247,0.5)' : '1.5px solid var(--bd1)',
              borderRadius: 10, padding: '7px 16px', fontSize: 12, fontWeight: active ? 700 : 500,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
            }}>{opt.label}</button>
          );
        })}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          {
            label: '평균 점수', color: 'var(--green)',
            value: Math.round(avgScore),
            suffix: `/${COMP_MAX} (약 ${avgCorrect}/${COMP_QUESTIONS}문제)`,
          },
          { label: '누적 오답', value: totalMistakes, suffix: '건', color: 'var(--red)' },
          { label: '가장 약한 단원', value: mostWeakUnit?.unit || '—', suffix: mostWeakUnit ? ` (${mostWeakUnit.count}회)` : '', color: 'var(--yellow)' },
          { label: '주요 오답 유형', value: mostCommonError?.name || '—', suffix: mostCommonError ? ` ${mostCommonError.value}건` : '', color: ERROR_COLORS[mostCommonError?.name] || 'var(--t1)' },
        ].map(s => (
          <div key={s.label} style={{ ...CARD }}>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{s.label}</div>
            <div style={{ fontSize: typeof s.value === 'number' && s.value > 99 ? 28 : 22, fontWeight: 800, color: s.color }}>
              {s.value}<span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 400 }}>{s.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 허용 오답 계산기 */}
      <AllowedWrongCalc currentScore={latestCompScore} />

      {/* Unit Priority Ranking */}
      {unitPriority.length > 0 && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Flag size={14} color="var(--t2)" strokeWidth={2} /> 단원별 집중도 우선순위
          </div>
          <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 18 }}>정보부족(×3) · 연계사고부족(×2) · 실수(×1) 가중치로 계산된 취약도 점수</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {unitPriority.map((u, i) => {
              const maxScore = unitPriority[0].score;
              const barPct = Math.round((u.score / maxScore) * 100);
              const barColor = i === 0 ? 'var(--red)' : i === 1 ? 'var(--orange)' : i === 2 ? 'var(--yellow)' : 'var(--green)';
              return (
                <div key={u.unit} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', background: 'var(--bg3)', borderRadius: 14,
                  border: i === 0 ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--bd0)',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, minWidth: 80, color: barColor }}>{getPriorityLabel(i)}</div>
                  <div style={{ flex: '0 0 80px', fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>{u.unit}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
                      {Object.entries(u.types).filter(([, c]) => c > 0).map(([t, c]) => (
                        <span key={t} style={{
                          fontSize: 11, padding: '2px 9px', borderRadius: 6, fontWeight: 700,
                          background: ERROR_COLORS_HEX[t] + '22', color: ERROR_COLORS_HEX[t],
                        }}>{t} {c}건</span>
                      ))}
                    </div>
                    <div style={{ height: 7, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, background: barColor, borderRadius: 4, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: barColor, minWidth: 36, textAlign: 'right' }}>
                    {u.score}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Radar + Pie */}
      <div style={{ display: 'grid', gridTemplateColumns: unitPriority.length >= 3 ? '1fr 1fr' : '1fr', gap: 14 }}>
        {unitPriority.length >= 3 && <UnitRadarChart unitPriority={unitPriority} />}
        {errorTypeCounts.length > 0 && (
          <div style={{ ...CARD }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
              <PieIcon size={14} color="var(--t2)" strokeWidth={2} /> 오답 유형 분포
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PieChart width={190} height={170}>
                <Pie data={errorTypeCounts} cx={95} cy={80} outerRadius={66} innerRadius={32} dataKey="value" paddingAngle={3}>
                  {errorTypeCounts.map(e => <Cell key={e.name} fill={ERROR_COLORS_HEX[e.name]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v}건`, n]} contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--bd1)', borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {errorTypeCounts.map(e => (
                <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: ERROR_COLORS_HEX[e.name], flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--t1)' }}>{e.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ERROR_COLORS_HEX[e.name] }}>{e.value}건</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Score trend */}
      {scoreChartData.length >= 2 && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
            점수 추이
            <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400, marginLeft: 4 }}>만점 {COMP_MAX}점 ({COMP_QUESTIONS}문항)</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={scoreChartData} margin={{ top: 5, right: 40, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} />
              <YAxis yAxisId="score" domain={[0, COMP_MAX]} tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} />
              <YAxis yAxisId="q" orientation="right" domain={[0, COMP_QUESTIONS]} tick={{ fill: 'var(--t3)', fontSize: 9, fontFamily: 'Pretendard, sans-serif' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--t1)' }} />
              <ReferenceLine yAxisId="score" y={tComp} stroke="var(--green)" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `목표 ${tComp}`, fill: 'var(--green)', fontSize: 10 }} />
              <Line yAxisId="score" type="monotone" dataKey="점수" stroke="var(--green)" strokeWidth={3} dot={{ fill: 'var(--green)', r: 4 }} activeDot={{ r: 6 }} />
              <Line yAxisId="q" type="monotone" dataKey="예상정답" stroke="var(--blue)" strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 3 }} activeDot={{ r: 5 }} name="예상정답수" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Unit trend */}
      <UnitTrendChart exams={filteredExams} topUnits={unitPriority} />

      {/* Error type cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {Object.entries(ERROR_COLORS_HEX).map(([type, hex]) => {
          const count = allMistakes.filter(m => m.errorType === type).length;
          const pct = totalMistakes > 0 ? Math.round(count / totalMistakes * 100) : 0;
          return (
            <div key={type} style={{ ...CARD, borderColor: hex + '44', background: hex + '0a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: hex }}>{type}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: hex }}>{count}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 12 }}>{ERROR_DESC[type]}</div>
              <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: hex, borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 5, fontWeight: 600 }}>{pct}%</div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      {unitErrorMap.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ ...CARD }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
            <BarChart3 size={14} color="var(--t2)" strokeWidth={2} /> 단원별 오답 횟수
          </div>
            <ResponsiveContainer width="100%" height={Math.max(200, unitCounts.length * 42)}>
              <BarChart data={unitCounts} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis type="number" tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} allowDecimals={false} />
                <YAxis type="category" dataKey="unit" tick={{ fill: 'var(--t0)', fontSize: 12, fontFamily: 'Pretendard, sans-serif' }} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[0, 7, 7, 0]}>
                  {unitCounts.map((_, i) => {
                    const cs = ['#ef4444','#f59e0b','#a855f7','#4f8ef7','#10b981','#ec4899'];
                    return <Cell key={i} fill={cs[i % cs.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...CARD }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Layers size={14} color="var(--t2)" strokeWidth={2} /> 단원 × 오답유형 (스택)
          </div>
            <ResponsiveContainer width="100%" height={Math.max(200, unitErrorMap.length * 42)}>
              <BarChart data={unitErrorMap} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis type="number" tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} allowDecimals={false} />
                <YAxis type="category" dataKey="unit" tick={{ fill: 'var(--t0)', fontSize: 12, fontFamily: 'Pretendard, sans-serif' }} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--t1)' }} />
                <Bar dataKey="실수" stackId="a" fill={ERROR_COLORS_HEX['실수']} />
                <Bar dataKey="정보부족" stackId="a" fill={ERROR_COLORS_HEX['정보부족']} />
                <Bar dataKey="연계사고부족" stackId="a" fill={ERROR_COLORS_HEX['연계사고부족']} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── 오답 상세 기록 ─────────────────────────────── */}
      {allMistakes.length > 0 && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Search size={14} color="var(--t2)" strokeWidth={2} /> 오답 상세 기록
          </div>

          <div style={{
            display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16,
            padding: '14px 16px', background: 'var(--bg3)', borderRadius: 14, border: '1px solid var(--bd0)',
          }}>
            <div style={{ flex: '1 1 180px', minWidth: 140 }}>
              <input
                type="text"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="번호, 단원, 메모 검색..."
                style={{
                  width: '100%', background: 'var(--bg2)', border: '1.5px solid var(--bd1)',
                  borderRadius: 10, padding: '9px 12px', color: 'var(--t0)', fontSize: 12,
                  fontFamily: 'inherit', outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                onBlur={e => e.target.style.borderColor = 'var(--bd1)'}
              />
            </div>
            <select
              value={filterUnit}
              onChange={e => setFilterUnit(e.target.value)}
              style={{
                background: 'var(--bg2)', border: '1.5px solid var(--bd1)', borderRadius: 10,
                padding: '9px 12px', color: filterUnit ? 'var(--t0)' : 'var(--t2)', fontSize: 12,
                fontFamily: 'inherit', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: 100,
              }}
            >
              <option value="">모든 단원</option>
              {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{
                background: 'var(--bg2)', border: '1.5px solid var(--bd1)', borderRadius: 10,
                padding: '9px 12px', color: filterType ? 'var(--t0)' : 'var(--t2)', fontSize: 12,
                fontFamily: 'inherit', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: 110,
              }}
            >
              <option value="">모든 유형</option>
              {['실수', '정보부족', '연계사고부족'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(filterUnit || filterType || filterSearch) && (
              <button
                onClick={() => { setFilterUnit(''); setFilterType(''); setFilterSearch(''); }}
                style={{
                  background: 'rgba(239,68,68,0.1)', color: 'var(--red)',
                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
                  padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >초기화</button>
            )}
            <div style={{ fontSize: 11, color: 'var(--t3)', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
              {filteredMistakes.length}건 표시
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {filteredMistakes.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', color: 'var(--t3)', fontSize: 13, gap: 8 }}>
                <Search size={28} strokeWidth={1.5} style={{ opacity: 0.35 }} />
                조건에 맞는 오답이 없습니다
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg3)' }}>
                    {[
                      { key: 'date', label: '연월' },
                      { key: null,   label: '시험명' },
                      { key: null,   label: '번호' },
                      { key: 'unit', label: '단원' },
                      { key: 'type', label: '오답 유형' },
                      { key: null,   label: '메모' },
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
                      <td style={{ padding: '11px 14px', color: 'var(--t2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.memo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
