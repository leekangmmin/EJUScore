// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Target, Plus, AlertTriangle } from 'lucide-react';

const CARD = { background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 16, padding: 24 };

function Heatmap({ title, color, questions, maxQ }) {
  const counts = useMemo(() => {
    const m = {};
    questions.forEach(q => { m[q] = (m[q] || 0) + 1; });
    return m;
  }, [questions]);

  const maxCount = Math.max(...Object.values(counts), 1);
  const cells = Array.from({ length: maxQ }, (_, i) => i + 1);

  const cellBg = (count) => {
    if (!count) return 'var(--bg3)';
    const t = count / maxCount;
    return t < 0.4 ? color + '55' : t < 0.7 ? color + '99' : color;
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t0)', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {cells.map(n => {
          const c = counts[n] || 0;
          return (
            <div key={n} title={`${n}번: ${c}회 오답`} style={{
              width: 33, height: 33, borderRadius: 6,
              background: cellBg(c),
              border: `1px solid ${c ? color + '44' : 'var(--bd0)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: c ? '#fff' : 'var(--t3)', fontWeight: c ? 700 : 400,
              cursor: 'default', transition: 'transform 0.15s', position: 'relative',
            }}
              onMouseEnter={e => { if (c) e.currentTarget.style.transform = 'scale(1.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
              {n}
              {c > 1 && (
                <div style={{
                  position: 'absolute', top: -5, right: -5,
                  background: 'var(--red)', color: '#fff',
                  fontSize: 8, fontWeight: 700, width: 13, height: 13,
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{c}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 10, color: 'var(--t2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 11, height: 11, background: 'var(--bg3)', border: '1px solid var(--bd0)', borderRadius: 3 }} /> 정답
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 11, height: 11, background: color + '55', borderRadius: 3 }} /> 1회
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 11, height: 11, background: color + '99', borderRadius: 3 }} /> 2회
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 11, height: 11, background: color, borderRadius: 3 }} /> 3회+
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--tooltip-bg)', border: '1px solid var(--bd1)', borderRadius: 9, padding: '9px 13px', fontSize: 12 }}>
      <div style={{ color: 'var(--t1)' }}>{payload[0].payload.name}</div>
      <div style={{ color: 'var(--t0)', fontWeight: 700 }}>{payload[0].value}회 오답</div>
    </div>
  );
};

export default function JapaneseAnalysis({ exams, onAddNew }) {
  const allR = useMemo(() => exams.flatMap(e => e.japanese?.wrongQuestions?.reading   || []), [exams]);
  const allL = useMemo(() => exams.flatMap(e => e.japanese?.wrongQuestions?.listening || []), [exams]);

  const rCounts = useMemo(() => { const m = {}; allR.forEach(q => { m[q] = (m[q] || 0) + 1; }); return m; }, [allR]);
  const lCounts = useMemo(() => { const m = {}; allL.forEach(q => { m[q] = (m[q] || 0) + 1; }); return m; }, [allL]);

  const topR = Object.entries(rCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([q, c]) => ({ name: `${q}번`, count: c }));
  const topL = Object.entries(lCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([q, c]) => ({ name: `${q}번`, count: c }));

  const maxRQ = Math.max(...allR, 35);
  const maxLQ = Math.max(...allL, 40);

  if (!exams || exams.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 18, padding: '40px 20px', textAlign: 'center' }}>
        <div style={{
          width: 88, height: 88, borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(107,163,255,0.12), rgba(164,110,245,0.12))',
          border: '1px solid rgba(107,163,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Target size={38} color="var(--blue)" strokeWidth={1.5} style={{ opacity: 0.75 }} />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--t0)', letterSpacing: '-0.4px', marginBottom: 8 }}>일본어 오답 기록이 없어요</div>
          <div style={{ color: 'var(--t2)', fontSize: 13.5, lineHeight: 1.8, maxWidth: 300 }}>
            오답 문제 번호를 포함해 점수를 입력하면<br />어떤 문제를 자주 틀리는지 분석해드려요
          </div>
        </div>
        <button
          onClick={onAddNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'linear-gradient(135deg, var(--blue), var(--purple))',
            color: '#fff', border: 'none', borderRadius: 12,
            padding: '11px 22px', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(107,163,255,0.3)',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          점수 입력하기
        </button>
      </div>
    );
  }

  const worstR = topR[0];
  const worstL = topL[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--t0)' }}>일본어 오답 분석</h1>
        <div style={{ color: 'var(--t2)', fontSize: 13, marginTop: 4 }}>
          총 {exams.length}회 기준 · 독해 누적 오답 {allR.length}개 · 청해 {allL.length}개
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-wrap-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: '독해 누적 오답', value: allR.length, color: 'var(--purple)', unit: '개' },
          { label: '독해 오답 문제 수', value: Object.keys(rCounts).length, color: 'var(--purple)', unit: '문제' },
          { label: '청해 누적 오답', value: allL.length, color: 'var(--pink)', unit: '개' },
          { label: '청해 오답 문제 수', value: Object.keys(lCounts).length, color: 'var(--pink)', unit: '문제' },
        ].map(s => (
          <div key={s.label} style={{ ...CARD }}>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: s.color }}>
              {s.value}<span style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 400 }}> {s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Worst question alerts */}
      {(worstR || worstL) && (
        <div className="grid-2-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {worstR && (
            <div style={{ ...CARD, display: 'flex', gap: 14, alignItems: 'center', borderColor: 'rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.05)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(168,85,247,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={18} color="var(--purple)" strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--t2)' }}>독해 최다 오답</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--purple)' }}>{worstR.name}</div>
                <div style={{ fontSize: 12, color: 'var(--t2)' }}>{worstR.count}회 틀림</div>
              </div>
            </div>
          )}
          {worstL && (
            <div style={{ ...CARD, display: 'flex', gap: 14, alignItems: 'center', borderColor: 'rgba(236,72,153,0.3)', background: 'rgba(236,72,153,0.05)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(236,72,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={18} color="var(--pink)" strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--t2)' }}>청해 최다 오답</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--pink)' }}>{worstL.name}</div>
                <div style={{ fontSize: 12, color: 'var(--t2)' }}>{worstL.count}회 틀림</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Heatmaps */}
      <div className="grid-2-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t0)', marginBottom: 18 }}>독해 오답 히트맵</div>
          <Heatmap title="문제별 오답 횟수 (독해)" color="#a855f7" questions={allR} maxQ={maxRQ} />
        </div>
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t0)', marginBottom: 18 }}>청해 오답 히트맵</div>
          <Heatmap title="문제별 오답 횟수 (청해)" color="#ec4899" questions={allL} maxQ={maxLQ} />
        </div>
      </div>

      {/* Bar charts */}
      {(topR.length > 0 || topL.length > 0) && (
        <div className="grid-2-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {topR.length > 0 && (
            <div style={{ ...CARD }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t0)', marginBottom: 16 }}>독해 Top {topR.length}</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topR} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} />
                  <YAxis tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                    {topR.map((_, i) => <Cell key={i} fill={i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#a855f7'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {topL.length > 0 && (
            <div style={{ ...CARD }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t0)', marginBottom: 16 }}>청해 Top {topL.length}</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topL} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} />
                  <YAxis tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                    {topL.map((_, i) => <Cell key={i} fill={i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#ec4899'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ ...CARD }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t0)', marginBottom: 16 }}>회차별 오답 기록</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>{['연월', '시험명', '독해 오답', '청해 오답'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: 'var(--t2)', fontWeight: 600, borderBottom: '1px solid var(--bd0)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {[...exams].reverse().map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--bg3)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--t2)' }}>{e.date}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--t0)' }}>{e.examName}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(e.japanese?.wrongQuestions?.reading || []).map(q => (
                        <span key={q} style={{ background: 'rgba(168,85,247,0.12)', color: 'var(--purple)', padding: '2px 7px', borderRadius: 5, fontSize: 11 }}>{q}번</span>
                      ))}
                      {!(e.japanese?.wrongQuestions?.reading?.length) && <span style={{ color: 'var(--t3)' }}>없음</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(e.japanese?.wrongQuestions?.listening || []).map(q => (
                        <span key={q} style={{ background: 'rgba(236,72,153,0.12)', color: 'var(--pink)', padding: '2px 7px', borderRadius: 5, fontSize: 11 }}>{q}번</span>
                      ))}
                      {!(e.japanese?.wrongQuestions?.listening?.length) && <span style={{ color: 'var(--t3)' }}>없음</span>}
                    </div>
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
