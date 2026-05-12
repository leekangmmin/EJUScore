// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useMemo, useState } from 'react';
import { generateDiagnosis, getDday } from '../utils/diagnosis';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Utilities ────────────────────────────────────────
function linearPredict(values, ahead = 3) {
  const n = values.length;
  if (n < 2) return [];
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((s, v, i) => s + i * v, 0);
  const sumX2 = values.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (!denom) return [];
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return Array.from({ length: ahead }, (_, i) =>
    Math.round(Math.max(0, slope * (n + i) + intercept))
  );
}

function addMonths(dateStr, n) {
  const [y, m] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1 + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const CARD = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: 18, padding: 22,
  boxShadow: 'var(--card-shadow)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
};

// ── Sub-components ───────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--tooltip-bg)', border: '1px solid var(--bd1)',
      borderRadius: 14, padding: '12px 16px', fontSize: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    }}>
      <div style={{ color: 'var(--t2)', marginBottom: 8, fontWeight: 700 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--t1)' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: 'var(--t0)' }}>{p.value}점</span>
        </div>
      ))}
    </div>
  );
}

function GrowthBadge({ diff, unit = '점' }) {
  if (diff === null || diff === undefined) return null;
  const up = diff >= 0;
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, marginLeft: 6,
      color: up ? 'var(--green)' : 'var(--red)',
      background: up ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      padding: '2px 8px', borderRadius: 7,
    }}>
      {up ? '▲' : '▼'} {Math.abs(diff)}{unit}
    </span>
  );
}

function StatCard({ label, value, max, color, diff, diffUnit = '점', pct }) {
  const p = pct ?? (max ? Math.round((value / max) * 100) : null);
  return (
    <div style={{
      ...CARD, display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'transform 0.22s cubic-bezier(.4,0,.2,1), box-shadow 0.22s, border-color 0.22s',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)';
        e.currentTarget.style.borderColor = 'rgba(91,158,255,0.22)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'var(--card-shadow)';
        e.currentTarget.style.borderColor = 'var(--card-border)';
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 2 }}>
        <span style={{
          fontSize: 38, fontWeight: 800, letterSpacing: '-1.5px',
          background: `linear-gradient(135deg, ${color}, ${color}cc)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>{value ?? '—'}</span>
        {max && <span style={{ fontSize: 13, color: 'var(--t2)', marginLeft: 3 }}>/ {max}</span>}
        {diff !== undefined && <GrowthBadge diff={diff} unit={diffUnit} />}
      </div>
      {p !== null && (
        <div>
          <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              height: '100%', width: `${p}%`, borderRadius: 4,
              background: `linear-gradient(90deg, ${color}bb, ${color}, ${color}dd)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 2.6s infinite linear',
              transition: 'width 0.7s cubic-bezier(.4,0,.2,1)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600 }}>{p}% 달성</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertBanner({ reading, listening, threshold }) {
  if (!reading.length && !listening.length) return null;
  return (
    <div style={{
      ...CARD, borderColor: 'rgba(239,68,68,0.4)',
      background: 'rgba(239,68,68,0.06)', marginBottom: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>
          오답 누적 경고 — {threshold}회 이상 틀린 문제
        </span>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {reading.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 700, marginBottom: 8 }}>📖 독해</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {reading.map(([q, c]) => (
                <span key={q} style={{
                  background: 'rgba(239,68,68,0.15)', color: 'var(--red)',
                  padding: '3px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                }}>{q}번 <span style={{ opacity: 0.7, fontWeight: 400 }}>×{c}</span></span>
              ))}
            </div>
          </div>
        )}
        {listening.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 700, marginBottom: 8 }}>🎧 청해</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {listening.map(([q, c]) => (
                <span key={q} style={{
                  background: 'rgba(236,72,153,0.15)', color: 'var(--pink)',
                  padding: '3px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                }}>{q}번 <span style={{ opacity: 0.7, fontWeight: 400 }}>×{c}</span></span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 회차 비교 컴포넌트 ────────────────────────────────
function CompareView({ exams }) {
  const [idxA, setIdxA] = useState(exams.length >= 2 ? exams.length - 2 : 0);
  const [idxB, setIdxB] = useState(exams.length - 1);
  const a = exams[idxA];
  const b = exams[idxB];

  const japA = a?.japanese ? a.japanese.reading + a.japanese.listening : null;
  const japB = b?.japanese ? b.japanese.reading + b.japanese.listening : null;
  const compA = a?.comprehensive?.score ?? null;
  const compB = b?.comprehensive?.score ?? null;

  const rows = [
    { label: '일본어 합계', vA: japA, vB: japB, max: 370, color: 'var(--blue)' },
    { label: '독해', vA: a?.japanese?.reading, vB: b?.japanese?.reading, max: 185, color: 'var(--purple)' },
    { label: '청해', vA: a?.japanese?.listening, vB: b?.japanese?.listening, max: 185, color: 'var(--pink)' },
    { label: '종합과목', vA: compA, vB: compB, max: 200, color: 'var(--green)' },
  ];

  const selStyle = {
    background: 'var(--bg3)', border: '1.5px solid var(--bd1)', borderRadius: 10,
    padding: '8px 12px', color: 'var(--t0)', fontSize: 12, fontFamily: 'inherit',
    outline: 'none', cursor: 'pointer', appearance: 'none', flex: 1,
  };

  return (
    <div style={{ ...CARD }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>⚖️</span> 회차별 점수 비교
      </div>
      {/* 선택 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <select value={idxA} onChange={e => setIdxA(Number(e.target.value))} style={selStyle}>
          {exams.map((e, i) => <option key={i} value={i}>{e.date} {e.examName}</option>)}
        </select>
        <span style={{ color: 'var(--t2)', fontSize: 18, fontWeight: 700 }}>vs</span>
        <select value={idxB} onChange={e => setIdxB(Number(e.target.value))} style={selStyle}>
          {exams.map((e, i) => <option key={i} value={i}>{e.date} {e.examName}</option>)}
        </select>
      </div>
      {/* 비교 행 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(({ label, vA, vB, max, color }) => {
          const diff = vA != null && vB != null ? vB - vA : null;
          const pA = vA != null ? Math.round((vA / max) * 100) : 0;
          const pB = vB != null ? Math.round((vB / max) * 100) : 0;
          return (
            <div key={label} style={{ background: 'var(--bg3)', borderRadius: 12, padding: '12px 16px', border: '1px solid var(--bd0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                {diff !== null && (
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--t2)',
                    background: diff > 0 ? 'rgba(16,185,129,0.12)' : diff < 0 ? 'rgba(239,68,68,0.12)' : 'var(--bg3)',
                    padding: '2px 10px', borderRadius: 8,
                  }}>
                    {diff > 0 ? '▲' : diff < 0 ? '▼' : '─'} {Math.abs(diff)}점
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {/* A */}
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t0)' }}>{vA ?? '—'}</div>
                  <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${pA}%`, background: color, borderRadius: 3, opacity: 0.6 }} />
                  </div>
                </div>
                <div style={{ width: 2, height: 40, background: 'var(--bd0)' }} />
                {/* B */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color }}>
                    {vB ?? '—'}
                  </div>
                  <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${pB}%`, background: color, borderRadius: 3 }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 11, color: 'var(--t3)' }}>
        <span>← {a?.examName || '—'}</span>
        <span>{b?.examName || '—'} →</span>
      </div>
    </div>
  );
}

// ── 목표 달성 타임라인 ────────────────────────────────
function GoalTimeline({ exams, tJap, tComp }) {
  const events = useMemo(() => {
    const list = [];
    let japReached = false, compReached = false;
    for (const e of exams) {
      const jap = e.japanese ? e.japanese.reading + e.japanese.listening : null;
      const comp = e.comprehensive?.score ?? null;
      if (!japReached && jap != null && jap >= tJap) {
        list.push({ date: e.date, name: e.examName, type: 'jap', score: jap, target: tJap });
        japReached = true;
      }
      if (!compReached && comp != null && comp >= tComp) {
        list.push({ date: e.date, name: e.examName, type: 'comp', score: comp, target: tComp });
        compReached = true;
      }
    }
    return list;
  }, [exams, tJap, tComp]);

  if (events.length === 0) return null;

  return (
    <div style={{ ...CARD }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>🏆</span> 목표 달성 타임라인
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {events.map((ev, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {/* 타임라인 선 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: ev.type === 'jap' ? 'linear-gradient(135deg, var(--blue), var(--purple))' : 'linear-gradient(135deg, var(--green), #06b6d4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0, boxShadow: `0 4px 12px ${ev.type === 'jap' ? 'rgba(79,142,247,0.4)' : 'rgba(16,185,129,0.4)'}`,
              }}>
                {ev.type === 'jap' ? '🎌' : '📚'}
              </div>
              {i < events.length - 1 && (
                <div style={{ width: 2, flex: 1, background: 'var(--bd0)', minHeight: 24, margin: '4px 0' }} />
              )}
            </div>
            {/* 내용 */}
            <div style={{ flex: 1, paddingBottom: i < events.length - 1 ? 20 : 0 }}>
              <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, marginBottom: 3 }}>{ev.date}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>
                {ev.type === 'jap' ? '🎯 일본어 목표 달성!' : '🎯 종합과목 목표 달성!'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>
                {ev.name} · {ev.score}점 (목표 {ev.target}점 초과)
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────
export default function Dashboard({ exams, onEdit, onDelete, onDeleteAll, settings }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showCompare, setShowCompare]     = useState(false);
  const tJap = settings.targetJapanese ?? 320;
  const tComp = settings.targetComprehensive ?? 170;
  const threshold = settings.alertThreshold ?? 3;
  const dday = getDday(settings.nextExamDate);
  const diagnosis = useMemo(() => generateDiagnosis(exams), [exams]);

  const latest = exams[exams.length - 1];
  const prev   = exams.length >= 2 ? exams[exams.length - 2] : null;
  const latestJap  = latest?.japanese ? latest.japanese.reading + latest.japanese.listening : undefined;
  const prevJap    = prev?.japanese ? prev.japanese.reading + prev.japanese.listening : null;
  const latestComp = latest?.comprehensive?.score;
  const prevComp   = prev?.comprehensive?.score ?? null;

  const diffJap  = prevJap   != null && latestJap  != null ? latestJap  - prevJap   : undefined;
  const diffComp = prevComp  != null && latestComp != null ? latestComp - prevComp  : undefined;
  const diffRead = prev?.japanese && latest?.japanese ? latest.japanese.reading   - prev.japanese.reading   : undefined;
  const diffList = prev?.japanese && latest?.japanese ? latest.japanese.listening - prev.japanese.listening : undefined;

  const growthJap  = prevJap   ? ((latestJap  - prevJap)  / prevJap  * 100).toFixed(1) : null;
  const growthComp = prevComp  ? ((latestComp - prevComp) / prevComp * 100).toFixed(1) : null;

  const alerts = useMemo(() => {
    const rc = {}, lc = {};
    exams.forEach(e => {
      (e.japanese?.wrongQuestions?.reading   || []).forEach(q => { rc[q] = (rc[q] || 0) + 1; });
      (e.japanese?.wrongQuestions?.listening || []).forEach(q => { lc[q] = (lc[q] || 0) + 1; });
    });
    return {
      reading:   Object.entries(rc).filter(([, c]) => c >= threshold).sort((a, b) => b[1] - a[1]),
      listening: Object.entries(lc).filter(([, c]) => c >= threshold).sort((a, b) => b[1] - a[1]),
    };
  }, [exams, threshold]);

  const chartData = useMemo(() => {
    const data = exams.map(e => ({
      name: e.date,
      독해: e.japanese?.reading,
      청해: e.japanese?.listening,
      일본어합계: e.japanese ? e.japanese.reading + e.japanese.listening : undefined,
      종합과목: e.comprehensive?.score,
    }));

    if (exams.length >= 2) {
      const japVals  = exams.map(e => e.japanese ? e.japanese.reading + e.japanese.listening : null).filter(Boolean);
      const compVals = exams.map(e => e.comprehensive?.score ?? null).filter(Boolean);
      const japPred  = linearPredict(japVals, 3);
      const compPred = linearPredict(compVals, 3);

      const last = data[data.length - 1];
      last.pred_jap  = japVals[japVals.length - 1];
      last.pred_comp = compVals[compVals.length - 1];

      for (let i = 0; i < 3; i++) {
        data.push({
          name: addMonths(exams[exams.length - 1].date, i + 1),
          pred_jap:  Math.min(370, Math.max(0, japPred[i]  ?? 0)),
          pred_comp: Math.min(200, Math.max(0, compPred[i] ?? 0)),
        });
      }
    }
    return data;
  }, [exams]);

  // bestJap / bestComp — 빈 배열 안전 처리
  const bestJap  = exams.length > 0 ? Math.max(...exams.map(e => e.japanese ? e.japanese.reading + e.japanese.listening : 0)) : 0;
  const bestComp = exams.length > 0 ? Math.max(...exams.map(e => e.comprehensive?.score ?? 0)) : 0;

  // Empty state
  if (!exams || exams.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 20 }}>
        <div style={{ fontSize: 72, filter: 'drop-shadow(0 4px 24px rgba(79,142,247,0.35))' }}>📝</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--t0)', letterSpacing: '-0.5px' }}>아직 데이터가 없어요</div>
        <div style={{ color: 'var(--t2)', fontSize: 14, textAlign: 'center', lineHeight: 1.8 }}>
          왼쪽의 <strong style={{ color: 'var(--blue)' }}>점수 입력</strong> 버튼으로 첫 모의고사를 기록해보세요
        </div>
      </div>
    );
  }

  const ddayColor = dday === null ? null : dday <= 0 ? 'var(--green)' : dday <= 7 ? 'var(--red)' : dday <= 30 ? 'var(--orange)' : 'var(--blue)';
  const ddayLabel = dday === null ? null : dday > 0 ? `D-${dday}` : dday === 0 ? 'D-Day!' : `D+${Math.abs(dday)}`;
  const ddayEmoji = dday === null ? null : dday <= 0 ? '🎌' : dday <= 7 ? '🔥' : dday <= 30 ? '⚡' : '📅';

  const LEVEL_STYLE = {
    critical: { bg:'rgba(239,68,68,0.08)',  border:'rgba(239,68,68,0.3)',  color:'var(--red)',    badge:'#ef4444' },
    warning:  { bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.3)', color:'var(--yellow)', badge:'#f59e0b' },
    info:     { bg:'rgba(79,142,247,0.08)', border:'rgba(79,142,247,0.3)', color:'var(--blue)',   badge:'#4f8ef7' },
    good:     { bg:'rgba(16,185,129,0.08)', border:'rgba(16,185,129,0.3)', color:'var(--green)',  badge:'#10b981' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* D-day 배너 */}
      {dday !== null && (
        <div style={{
          borderRadius: 22, padding: '22px 28px',
          background: `linear-gradient(135deg, ${ddayColor}1a, ${ddayColor}07)`,
          border: `1px solid ${ddayColor}4a`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          boxShadow: `0 6px 32px ${ddayColor}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* 배경 글로우 */}
          <div style={{
            position: 'absolute', right: -30, top: '50%', transform: 'translateY(-50%)',
            width: 160, height: 160, borderRadius: '50%',
            background: `radial-gradient(circle, ${ddayColor}20 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, zIndex: 1 }}>
            <div style={{
              fontSize: 36, width: 56, height: 56, borderRadius: 16,
              background: `${ddayColor}22`, border: `1px solid ${ddayColor}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              animation: dday <= 7 ? 'pulse-glow 2s infinite' : 'none',
            }}>{ddayEmoji}</div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>다음 EJU 시험</div>
              <div style={{ fontSize: 15, color: 'var(--t0)', fontWeight: 600 }}>
                {new Date(settings.nextExamDate).toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' })}
              </div>
              {dday > 0 && (
                <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4, fontWeight: 500 }}>
                  {Math.floor(dday/7) > 0 ? `${Math.floor(dday/7)}주 ` : ''}{dday%7}일 남음
                </div>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', zIndex: 1 }}>
            <div style={{
              fontSize: 50, fontWeight: 900, letterSpacing: '-3px', lineHeight: 1,
              background: `linear-gradient(135deg, ${ddayColor}, ${ddayColor}cc)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>{ddayLabel}</div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--t0)', letterSpacing: '-0.5px' }}>대시보드</h1>
          <div style={{ color: 'var(--t2)', fontSize: 13, marginTop: 4 }}>총 {exams.length}회 기록 · 목표 일어 {tJap}/370 · 종합 {tComp}/200</div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {growthJap !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600 }}>일어 성장률</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: Number(growthJap) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {Number(growthJap) >= 0 ? '+' : ''}{growthJap}%
              </div>
            </div>
          )}
          {growthComp !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600 }}>종합 성장률</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: Number(growthComp) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {Number(growthComp) >= 0 ? '+' : ''}{growthComp}%
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 오답 누적 경고 */}
      <AlertBanner reading={alerts.reading} listening={alerts.listening} threshold={threshold} />

      {/* 약점 자동 진단 */}
      {diagnosis.length > 0 && (
        <div style={{ ...CARD, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🩺</span> 약점 자동 진단
            <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400, marginLeft: 4 }}>— 오답 패턴을 분석했어요</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {diagnosis.map((item, i) => {
              const s = LEVEL_STYLE[item.level];
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                  borderRadius: 14, background: s.bg, border: `1px solid ${s.border}`,
                  transition: 'transform 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{item.desc}</div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.badge, flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 스탯 카드 4개 */}
      <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard label="일본어 합계" value={latestJap} max={370} color="var(--blue)" diff={diffJap} />
        <StatCard label="독해" value={latest?.japanese?.reading} max={185} color="var(--purple)" diff={diffRead} />
        <StatCard label="청해" value={latest?.japanese?.listening} max={185} color="var(--pink)" diff={diffList} />
        <StatCard label="종합과목" value={latestComp} max={200} color="var(--green)" diff={diffComp} />
      </div>

      {/* 목표 진행 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          { label: '일본어 목표까지', cur: latestJap, target: tJap, color: 'var(--blue)', hexColor: '#5b9eff', max: 370 },
          { label: '종합과목 목표까지', cur: latestComp, target: tComp, color: 'var(--green)', hexColor: '#10d98c', max: 200 },
        ].map(g => {
          const remain = g.cur != null ? Math.max(0, g.target - g.cur) : null;
          const achieved = g.cur != null && g.cur >= g.target;
          const pct = g.cur != null ? Math.min(100, (g.cur / g.target) * 100) : 0;
          return (
            <div key={g.label} style={{
              ...CARD, display: 'flex', alignItems: 'center', gap: 16,
              transition: 'transform 0.22s cubic-bezier(.4,0,.2,1), box-shadow 0.22s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: achieved ? 'linear-gradient(135deg, rgba(16,217,140,0.2), rgba(34,211,238,0.15))' : `${g.hexColor}18`,
                border: `1px solid ${g.hexColor}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>{achieved ? '🎉' : '🎯'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{g.label}</div>
                {achieved
                  ? <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)' }}>목표 달성! 🎊</div>
                  : remain !== null
                    ? <div style={{ fontSize: 22, fontWeight: 800, color: g.color, letterSpacing: '-0.5px' }}>
                        +{remain}<span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 400, marginLeft: 4 }}>점 남음</span>
                        <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 500, marginTop: 1 }}>{g.cur}/{g.target}</div>
                      </div>
                    : <div style={{ color: 'var(--t2)', fontSize: 13 }}>데이터 없음</div>
                }
                {g.cur != null && (
                  <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, borderRadius: 3,
                      background: `linear-gradient(90deg, ${g.hexColor}99, ${g.hexColor})`,
                      transition: 'width 0.7s cubic-bezier(.4,0,.2,1)',
                    }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 차트 */}
      {exams.length >= 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* 일본어 차트 */}
          <div style={{ ...CARD }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>🇯🇵 일본어 점수 추이</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--t2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ borderTop: '2px dashed var(--blue)', width: 14, display: 'inline-block' }} /> 예측
                </span>
                <span>목표 {tJap}점</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <YAxis domain={[0, 370]} tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--t1)' }} />
                <ReferenceLine y={tJap} stroke="var(--blue)" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `목표 ${tJap}`, fill: 'var(--blue)', fontSize: 10 }} />
                <ReferenceLine y={bestJap} stroke="var(--yellow)" strokeDasharray="3 3" strokeWidth={1} />
                <Line type="monotone" dataKey="독해" stroke="var(--purple)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                <Line type="monotone" dataKey="청해" stroke="var(--pink)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                <Line type="monotone" dataKey="일본어합계" stroke="var(--blue)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                <Line type="monotone" dataKey="pred_jap" stroke="var(--blue)" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls name="예측(일어)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 종합과목 차트 */}
          <div style={{ ...CARD }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>📚 종합과목 점수 추이</div>
              <div style={{ fontSize: 10, color: 'var(--t2)' }}>목표 {tComp}점</div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <YAxis domain={[0, 200]} tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--t1)' }} />
                <ReferenceLine y={tComp} stroke="var(--green)" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `목표 ${tComp}`, fill: 'var(--green)', fontSize: 10 }} />
                <ReferenceLine y={bestComp} stroke="var(--yellow)" strokeDasharray="3 3" strokeWidth={1} />
                <Line type="monotone" dataKey="종합과목" stroke="var(--green)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                <Line type="monotone" dataKey="pred_comp" stroke="var(--green)" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls name="예측(종합)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 회차 비교 토글 */}
      {exams.length >= 2 && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={() => setShowCompare(p => !p)}
              style={{
                background: showCompare ? 'rgba(79,142,247,0.15)' : 'transparent',
                color: showCompare ? 'var(--blue)' : 'var(--t2)',
                border: `1.5px solid ${showCompare ? 'rgba(79,142,247,0.5)' : 'var(--bd1)'}`,
                borderRadius: 12, padding: '9px 18px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              ⚖️ 회차 비교 {showCompare ? '▲ 닫기' : '▼ 열기'}
            </button>
          </div>
          {showCompare && <CompareView exams={exams} />}
        </>
      )}

      {/* 목표 달성 타임라인 */}
      <GoalTimeline exams={exams} tJap={tJap} tComp={tComp} />

      {/* 최고 기록 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          { icon: '🏆', label: '일본어 최고 기록', value: bestJap, max: 370, color: 'var(--blue)', hex: '#5b9eff' },
          { icon: '🏆', label: '종합과목 최고 기록', value: bestComp, max: 200, color: 'var(--green)', hex: '#10d98c' },
        ].map(r => (
          <div key={r.label} style={{
            ...CARD, display: 'flex', alignItems: 'center', gap: 16,
            transition: 'transform 0.22s cubic-bezier(.4,0,.2,1), box-shadow 0.22s', cursor: 'default',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 15, flexShrink: 0,
              background: `linear-gradient(135deg, ${r.hex}25, ${r.hex}12)`,
              border: `1px solid ${r.hex}3a`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            }}>{r.icon}</div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{r.label}</div>
              <div style={{
                fontSize: 28, fontWeight: 800, letterSpacing: '-1px',
                background: `linear-gradient(135deg, ${r.color}, ${r.hex}bb)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                {r.value} <span style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 400, WebkitTextFillColor: 'var(--t2)' }}>/ {r.max}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 시험 기록 목록 */}
      <div style={{ ...CARD }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)' }}>📋 시험 기록 목록</div>
          <button onClick={onDeleteAll} style={{
            background: 'rgba(239,68,68,0.1)', color: 'var(--red)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 9,
            padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
          }}>전체 삭제</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...exams].reverse().map(exam => {
            const jap  = exam.japanese ? exam.japanese.reading + exam.japanese.listening : null;
            const comp = exam.comprehensive?.score;
            const japEstimated = Boolean(exam.japanese?.estimateMeta?.isEstimated);
            const compEstimated = Boolean(exam.comprehensive?.estimateMeta?.isEstimated);
            const isPendingDelete = confirmDelete === exam.id;
            return (
              <div key={exam.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 16px', background: 'var(--bg3)',
                borderRadius: 13, border: `1px solid ${isPendingDelete ? 'rgba(239,68,68,0.45)' : 'var(--bd0)'}`,
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { if (!isPendingDelete) e.currentTarget.style.borderColor = 'var(--bd1)'; }}
                onMouseLeave={e => { if (!isPendingDelete) e.currentTarget.style.borderColor = 'var(--bd0)'; }}
              >
                <div style={{ flex: '0 0 72px', fontSize: 11, color: 'var(--t3)', fontWeight: 700 }}>{exam.date}</div>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--t0)', fontWeight: 600 }}>{exam.examName}</div>
                <div style={{ display: 'flex', gap: 7 }}>
                  {jap != null && (
                    <span style={{ fontSize: 12, background: 'rgba(79,142,247,0.1)', color: 'var(--blue)', padding: '3px 10px', borderRadius: 8, fontWeight: 600 }}>
                      일어 {jap}/370{japEstimated ? ' (예측)' : ''}
                    </span>
                  )}
                  {comp != null && (
                    <span style={{ fontSize: 12, background: 'rgba(16,185,129,0.1)', color: 'var(--green)', padding: '3px 10px', borderRadius: 8, fontWeight: 600 }}>
                      종합 {comp}/200{compEstimated ? ' (예측)' : ''}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {isPendingDelete ? (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>삭제할까요?</span>
                      <button onClick={() => { onDelete(exam.id); setConfirmDelete(null); }} style={{
                        background: 'var(--red)', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                      }}>예</button>
                      <button onClick={() => setConfirmDelete(null)} style={{
                        background: 'transparent', color: 'var(--t1)', border: '1px solid var(--bd1)',
                        borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      }}>아니오</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => onEdit(exam)} style={{
                        background: 'transparent', color: 'var(--t1)', border: '1px solid var(--bd1)',
                        borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.15s',
                      }}
                        onMouseEnter={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.color = 'var(--blue)'; }}
                        onMouseLeave={e => { e.target.style.borderColor = 'var(--bd1)'; e.target.style.color = 'var(--t1)'; }}
                      >수정</button>
                      <button onClick={() => setConfirmDelete(exam.id)} style={{
                        background: 'transparent', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.15s',
                      }}
                        onMouseEnter={e => e.target.style.background = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={e => e.target.style.background = 'transparent'}
                      >삭제</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
