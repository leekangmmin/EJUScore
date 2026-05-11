// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, ReferenceLine,
} from 'recharts';

const CARD = { background: 'var(--card-bg)', border: '1px solid var(--bd0)', borderRadius: 18, padding: 24, boxShadow: 'var(--card-shadow)' };

const ERROR_COLORS = { '실수': 'var(--yellow)', '정보부족': 'var(--red)', '연계사고부족': 'var(--purple)' };
const ERROR_COLORS_HEX = { '실수': '#f59e0b', '정보부족': '#ef4444', '연계사고부족': '#a855f7' };
const ERROR_WEIGHT  = { '정보부족': 3, '연계사고부족': 2, '실수': 1 };
const ERROR_DESC    = {
  '실수': '알고 있지만 실수로 틀린 문제 — 빠르게 해결 가능',
  '정보부족': '해당 내용 자체를 몰라서 틀린 문제 — 암기·학습 필요',
  '연계사고부족': '각각은 알지만 연결 못한 문제 — 응용 연습 필요',
};

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

export default function ComprehensiveAnalysis({ exams, settings }) {
  const tComp = settings?.targetComprehensive ?? 170;

  // ── 필터 상태 ──────────────────────────────────────
  const [filterUnit, setFilterUnit]   = useState('');
  const [filterType, setFilterType]   = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [sortCol, setSortCol]         = useState('date');   // 'date' | 'unit' | 'type'
  const [sortDir, setSortDir]         = useState('desc');    // 'asc' | 'desc'

  const allMistakes = useMemo(() =>
    exams.flatMap(e => (e.comprehensive?.mistakes || []).map(m => ({ ...m, examDate: e.date, examName: e.examName }))),
    [exams]
  );

  const allUnits = useMemo(() => [...new Set(allMistakes.map(m => m.unit).filter(Boolean))].sort(), [allMistakes]);

  // Unit priority score
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
    exams.map(e => ({ name: e.date, 점수: e.comprehensive?.score })).filter(e => e.점수 !== undefined),
    [exams]
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

  // ── 필터링된 오답 목록 ────────────────────────────
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
    // 정렬
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

  if (!exams || exams.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 20 }}>
        <div style={{ fontSize: 72, filter: 'drop-shadow(0 4px 16px rgba(79,142,247,0.3))' }}>📚</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--t0)', letterSpacing: '-0.5px' }}>데이터가 없어요</div>
        <div style={{ color: 'var(--t2)', fontSize: 14, textAlign: 'center', lineHeight: 1.7 }}>
          점수를 입력하면 종합과목 분석이 표시됩니다
        </div>
      </div>
    );
  }

  const totalMistakes = allMistakes.length;
  const mostWeakUnit  = unitPriority[0];
  const mostCommonError = [...errorTypeCounts].sort((a, b) => b.value - a.value)[0];
  const avgScore = exams.filter(e => e.comprehensive?.score != null).reduce((s, e, _, a) => s + e.comprehensive.score / a.length, 0);

  const PRIORITY_LABELS = ['🔴 최우선', '🟠 우선', '🟡 보통', '🟢 낮음'];
  const getPriorityLabel = (i) => PRIORITY_LABELS[Math.min(i, PRIORITY_LABELS.length - 1)];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--t0)', letterSpacing: '-0.5px' }}>📚 종합과목 분석</h1>
        <div style={{ color: 'var(--t2)', fontSize: 13, marginTop: 5 }}>총 {exams.length}회 시험 · 누적 오답 {totalMistakes}건 · 목표 {tComp}/200</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: '평균 점수', value: Math.round(avgScore), suffix: '/200', color: 'var(--green)' },
          { label: '누적 오답', value: totalMistakes, suffix: '건', color: 'var(--red)' },
          { label: '가장 약한 단원', value: mostWeakUnit?.unit || '—', suffix: mostWeakUnit ? ` (${mostWeakUnit.count}회)` : '', color: 'var(--yellow)' },
          { label: '주요 오답 유형', value: mostCommonError?.name || '—', suffix: mostCommonError ? ` ${mostCommonError.value}건` : '', color: ERROR_COLORS[mostCommonError?.name] || 'var(--t1)' },
        ].map(s => (
          <div key={s.label} style={{ ...CARD }}>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{s.label}</div>
            <div style={{ fontSize: typeof s.value === 'number' && s.value > 99 ? 28 : 22, fontWeight: 800, color: s.color }}>
              {s.value}<span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 400 }}>{s.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Unit Priority Ranking */}
      {unitPriority.length > 0 && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 6 }}>📌 단원별 집중도 우선순위</div>
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

      {/* Score trend + pie */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        {scoreChartData.length >= 2 && (
          <div style={{ ...CARD }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 16 }}>📈 점수 추이</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={scoreChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <YAxis domain={[0, 200]} tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={tComp} stroke="var(--green)" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `목표 ${tComp}`, fill: 'var(--green)', fontSize: 10 }} />
                <Line type="monotone" dataKey="점수" stroke="var(--green)" strokeWidth={3} dot={{ fill: 'var(--green)', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {errorTypeCounts.length > 0 && (
          <div style={{ ...CARD }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 12 }}>🥧 오답 유형 분포</div>
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
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 16 }}>📊 단원별 오답 횟수</div>
            <ResponsiveContainer width="100%" height={Math.max(200, unitCounts.length * 42)}>
              <BarChart data={unitCounts} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis type="number" tick={{ fill: 'var(--t2)', fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="unit" tick={{ fill: 'var(--t0)', fontSize: 12 }} width={70} />
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
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 16 }}>🗂 단원 × 오답유형 (스택)</div>
            <ResponsiveContainer width="100%" height={Math.max(200, unitErrorMap.length * 42)}>
              <BarChart data={unitErrorMap} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis type="number" tick={{ fill: 'var(--t2)', fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="unit" tick={{ fill: 'var(--t0)', fontSize: 12 }} width={70} />
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

      {/* ── 오답 상세 기록 (필터/검색) ─────────────── */}
      {allMistakes.length > 0 && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 16 }}>🔍 오답 상세 기록</div>

          {/* 필터 컨트롤 */}
          <div style={{
            display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16,
            padding: '14px 16px', background: 'var(--bg3)', borderRadius: 14, border: '1px solid var(--bd0)',
          }}>
            {/* 검색 */}
            <div style={{ flex: '1 1 180px', minWidth: 140 }}>
              <input
                type="text"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="🔎 번호, 단원, 메모 검색..."
                style={{
                  width: '100%', background: 'var(--bg2)', border: '1.5px solid var(--bd1)',
                  borderRadius: 10, padding: '9px 12px', color: 'var(--t0)', fontSize: 12,
                  fontFamily: 'inherit', outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                onBlur={e => e.target.style.borderColor = 'var(--bd1)'}
              />
            </div>
            {/* 단원 필터 */}
            <select
              value={filterUnit}
              onChange={e => setFilterUnit(e.target.value)}
              style={{
                background: 'var(--bg2)', border: '1.5px solid var(--bd1)', borderRadius: 10,
                padding: '9px 12px', color: filterUnit ? 'var(--t0)' : 'var(--t2)', fontSize: 12,
                fontFamily: 'inherit', outline: 'none', cursor: 'pointer', appearance: 'none',
                minWidth: 100,
              }}
            >
              <option value="">📚 모든 단원</option>
              {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            {/* 유형 필터 */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{
                background: 'var(--bg2)', border: '1.5px solid var(--bd1)', borderRadius: 10,
                padding: '9px 12px', color: filterType ? 'var(--t0)' : 'var(--t2)', fontSize: 12,
                fontFamily: 'inherit', outline: 'none', cursor: 'pointer', appearance: 'none',
                minWidth: 110,
              }}
            >
              <option value="">🏷 모든 유형</option>
              {['실수', '정보부족', '연계사고부족'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {/* 리셋 */}
            {(filterUnit || filterType || filterSearch) && (
              <button
                onClick={() => { setFilterUnit(''); setFilterType(''); setFilterSearch(''); }}
                style={{
                  background: 'rgba(239,68,68,0.1)', color: 'var(--red)',
                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
                  padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >✕ 초기화</button>
            )}
            <div style={{ fontSize: 11, color: 'var(--t3)', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
              {filteredMistakes.length}건 표시
            </div>
          </div>

          {/* 테이블 */}
          <div style={{ overflowX: 'auto' }}>
            {filteredMistakes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--t3)', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🕵️</div>
                조건에 맞는 오답이 없어요
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
                          padding: '10px 14px', textAlign: 'left', color: 'var(--t2)', fontWeight: 700,
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
