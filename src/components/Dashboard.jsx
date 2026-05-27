// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useMemo, useState } from 'react';
import { generateDiagnosis, getDday } from '../utils/diagnosis';
import { COMP_MAX, normalizeJapaneseScore, normalizeCompScore } from '../utils/storage';
import { predictGoalDate } from '../utils/scorePrediction';
import {
  getStudyStreak, getStudyConsistency, detectBurnoutRisk,
  getAchievementProbability, generateQuickInsight,
} from '../utils/analytics';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  BookOpen, Plus, AlertTriangle, Headphones, Trophy,
  CalendarDays, ArrowLeftRight, Target, CheckCircle2,
  AlertCircle, Info, ClipboardList, Flame, Activity, Sparkles,
} from 'lucide-react';

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
      ...CARD, borderColor: 'rgba(239,68,68,0.35)',
      background: 'rgba(239,68,68,0.05)', marginBottom: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <AlertTriangle size={16} color="var(--red)" strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>
          오답 누적 경고 — {threshold}회 이상 틀린 문제
        </span>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {reading.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--t2)', fontWeight: 700, marginBottom: 8 }}>
              <BookOpen size={12} strokeWidth={2} /> 독해
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {reading.map(([q, c]) => (
                <span key={q} style={{
                  background: 'rgba(239,68,68,0.12)', color: 'var(--red)',
                  padding: '3px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                }}>{q}번 <span style={{ opacity: 0.65, fontWeight: 400 }}>×{c}</span></span>
              ))}
            </div>
          </div>
        )}
        {listening.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--t2)', fontWeight: 700, marginBottom: 8 }}>
              <Headphones size={12} strokeWidth={2} /> 청해
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {listening.map(([q, c]) => (
                <span key={q} style={{
                  background: 'rgba(236,72,153,0.12)', color: 'var(--pink)',
                  padding: '3px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                }}>{q}번 <span style={{ opacity: 0.65, fontWeight: 400 }}>×{c}</span></span>
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
    { label: '종합과목', vA: compA, vB: compB, max: COMP_MAX, color: 'var(--green)' },
  ];

  const selStyle = {
    background: 'var(--bg3)', border: '1.5px solid var(--bd1)', borderRadius: 10,
    padding: '8px 12px', color: 'var(--t0)', fontSize: 12, fontFamily: 'inherit',
    outline: 'none', cursor: 'pointer', appearance: 'none', flex: 1,
  };

  return (
    <div style={{ ...CARD }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ArrowLeftRight size={16} color="var(--blue)" strokeWidth={2} /> 회차별 점수 비교
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
      const japNorm = e.japanese ? normalizeJapaneseScore(e.japanese) : null;
      const jap = japNorm ? japNorm.reading + japNorm.listening : null;
      const comp = normalizeCompScore(e.comprehensive);
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
        <Trophy size={16} color="var(--yellow)" strokeWidth={2} /> 목표 달성 타임라인
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {events.map((ev, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: ev.type === 'jap' ? 'linear-gradient(135deg, var(--blue), var(--purple))' : 'linear-gradient(135deg, var(--green), #06b6d4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, boxShadow: `0 4px 12px ${ev.type === 'jap' ? 'rgba(79,142,247,0.4)' : 'rgba(16,185,129,0.4)'}`,
              }}>
                <Trophy size={14} color="#fff" strokeWidth={2} />
              </div>
              {i < events.length - 1 && (
                <div style={{ width: 2, flex: 1, background: 'var(--bd0)', minHeight: 24, margin: '4px 0' }} />
              )}
            </div>
            <div style={{ flex: 1, paddingBottom: i < events.length - 1 ? 20 : 0 }}>
              <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, marginBottom: 3 }}>{ev.date}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>
                {ev.type === 'jap' ? '일본어 목표 달성' : '종합과목 목표 달성'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>
                {ev.name} · {ev.score}점 (목표 {ev.target}점 달성)
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────
export default function Dashboard({ exams, onEdit, onDelete, onDeleteAll, onAddNew, settings }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showCompare, setShowCompare]     = useState(false);
  const [recordFilter, setRecordFilter]   = useState('all'); // 'all'|'exam'|'workbook'
  const tJap = settings.targetJapanese ?? 320;
  const tComp = settings.targetComprehensive ?? 170;
  const threshold = settings.alertThreshold ?? 3;
  const dday = getDday(settings.nextExamDate);
  const diagnosis = useMemo(() => generateDiagnosis(exams), [exams]);

  const latest = exams[exams.length - 1];
  const prev   = exams.length >= 2 ? exams[exams.length - 2] : null;

  const latestJapNorm  = latest?.japanese ? normalizeJapaneseScore(latest.japanese) : null;
  const prevJapNorm    = prev?.japanese   ? normalizeJapaneseScore(prev.japanese)   : null;
  const latestJap  = latestJapNorm ? latestJapNorm.reading + latestJapNorm.listening : undefined;
  const prevJap    = prevJapNorm   ? prevJapNorm.reading   + prevJapNorm.listening   : null;
  const latestComp = latest?.comprehensive ? normalizeCompScore(latest.comprehensive) : undefined;
  const prevComp   = prev?.comprehensive   ? normalizeCompScore(prev.comprehensive)   : null;

  const diffJap  = prevJap   != null && latestJap  != null ? latestJap  - prevJap   : undefined;
  const diffComp = prevComp  != null && latestComp != null ? latestComp - prevComp  : undefined;
  const diffRead = prevJapNorm && latestJapNorm ? latestJapNorm.reading   - prevJapNorm.reading   : undefined;
  const diffList = prevJapNorm && latestJapNorm ? latestJapNorm.listening - prevJapNorm.listening : undefined;

  const growthJap  = prevJap   ? ((latestJap  - prevJap)  / prevJap  * 100).toFixed(1) : null;
  const growthComp = prevComp  ? ((latestComp - prevComp) / prevComp * 100).toFixed(1) : null;

  const goalDateJap = useMemo(() =>
    predictGoalDate(exams, tJap, e => {
      if (!e.japanese) return null;
      const n = normalizeJapaneseScore(e.japanese);
      return n ? n.reading + n.listening : null;
    }),
    [exams, tJap]
  );
  const goalDateComp = useMemo(() =>
    predictGoalDate(exams, tComp, e => normalizeCompScore(e.comprehensive)),
    [exams, tComp]
  );

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

  const streak      = useMemo(() => getStudyStreak(exams),          [exams]);
  const consistency = useMemo(() => getStudyConsistency(exams, 3),  [exams]);
  const burnout     = useMemo(() => detectBurnoutRisk(exams),        [exams]);
  const achProb     = useMemo(() => getAchievementProbability(exams, tJap, tComp), [exams, tJap, tComp]);
  const insight     = useMemo(() => generateQuickInsight(exams, settings), [exams, settings]);

  const chartData = useMemo(() => {
    const data = exams.map(e => {
      const japNorm = e.japanese ? normalizeJapaneseScore(e.japanese) : null;
      const compNorm = normalizeCompScore(e.comprehensive);
      return {
        name: e.date,
        독해: japNorm?.reading,
        청해: japNorm?.listening,
        일본어합계: japNorm ? japNorm.reading + japNorm.listening : undefined,
        종합과목: compNorm ?? undefined,
      };
    });

    if (exams.length >= 2) {
      const japVals  = data.map(d => d.일본어합계).filter(v => v != null);
      const compVals = data.map(d => d.종합과목).filter(v => v != null);
      const japPred  = linearPredict(japVals, 3);
      const compPred = linearPredict(compVals, 3);

      const last = data[data.length - 1];
      last.pred_jap  = japVals[japVals.length - 1];
      last.pred_comp = compVals[compVals.length - 1];

      for (let i = 0; i < 3; i++) {
        data.push({
          name: addMonths(exams[exams.length - 1].date, i + 1),
          pred_jap:  Math.min(370, Math.max(0, japPred[i]  ?? 0)),
          pred_comp: Math.min(COMP_MAX, Math.max(0, compPred[i] ?? 0)),
        });
      }
    }
    return data;
  }, [exams]);

  // bestJap / bestComp — 득점등화 환산 기준
  const bestJap  = exams.length > 0 ? Math.max(...exams.map(e => {
    if (!e.japanese) return 0;
    const n = normalizeJapaneseScore(e.japanese);
    return n ? n.reading + n.listening : 0;
  })) : 0;
  const bestComp = exams.length > 0 ? Math.max(...exams.map(e => normalizeCompScore(e.comprehensive) ?? 0)) : 0;

  // Empty state
  if (!exams || exams.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 18, padding: '40px 20px', textAlign: 'center' }}>
        <div style={{
          width: 88, height: 88, borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(107,163,255,0.12), rgba(164,110,245,0.12))',
          border: '1px solid rgba(107,163,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BookOpen size={38} color="var(--blue)" strokeWidth={1.5} style={{ opacity: 0.75 }} />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--t0)', letterSpacing: '-0.4px', marginBottom: 8 }}>아직 기록된 시험이 없어요</div>
          <div style={{ color: 'var(--t2)', fontSize: 13.5, lineHeight: 1.8, maxWidth: 300 }}>
            모의고사나 문제집 점수를 입력하면<br />성적 추이와 분석이 여기에 표시됩니다
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
          첫 점수 입력하기
        </button>
      </div>
    );
  }

  const ddayColor = dday === null ? null : dday <= 0 ? 'var(--green)' : dday <= 7 ? 'var(--red)' : dday <= 30 ? 'var(--orange)' : 'var(--blue)';
  const ddayLabel = dday === null ? null : dday > 0 ? `D-${dday}` : dday === 0 ? 'D-Day' : `D+${Math.abs(dday)}`;

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
              width: 52, height: 52, borderRadius: 16,
              background: `${ddayColor}22`, border: `1px solid ${ddayColor}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              animation: dday <= 7 ? 'pulse-glow 2s infinite' : 'none',
            }}>
              <CalendarDays size={24} color={ddayColor} strokeWidth={1.8} />
            </div>
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
          <div style={{ color: 'var(--t2)', fontSize: 13, marginTop: 4 }}>총 {exams.length}회 기록 · 목표 일어 {tJap}/370 · 종합 {tComp}/{COMP_MAX}</div>
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

      {/* ── 학습 상태 위젯 행 ── */}
      <div className="grid-wrap-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {/* 스트릭 */}
        <div style={{
          ...CARD, display: 'flex', alignItems: 'center', gap: 12,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'rgba(245,147,78,0.12)', border: '1px solid rgba(245,147,78,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Flame size={18} color="var(--orange)" strokeWidth={1.8} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>연속 학습</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--orange)', letterSpacing: '-0.5px' }}>
              {streak.current}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--t2)', marginLeft: 3 }}>개월</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>최고 {streak.best}개월</div>
          </div>
        </div>

        {/* 일관성 */}
        <div style={{
          ...CARD, display: 'flex', alignItems: 'center', gap: 12,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'rgba(107,163,255,0.12)', border: '1px solid rgba(107,163,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={18} color="var(--blue)" strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>학습 일관성</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)', letterSpacing: '-0.5px' }}>
              {consistency}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--t2)', marginLeft: 1 }}>%</span>
            </div>
            <div style={{ height: 3, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
              <div style={{ height: '100%', width: `${consistency}%`, background: 'var(--blue)', borderRadius: 2, transition: 'width 0.5s' }} />
            </div>
          </div>
        </div>

        {/* 번아웃 리스크 */}
        <div style={{
          ...CARD, display: 'flex', alignItems: 'center', gap: 12,
          borderColor: burnout.risk === 'high' ? 'rgba(239,68,68,0.35)' : 'var(--card-border)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: burnout.risk === 'high' ? 'rgba(239,68,68,0.12)' : burnout.risk === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${burnout.risk === 'high' ? 'rgba(239,68,68,0.3)' : burnout.risk === 'medium' ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={18}
              color={burnout.risk === 'high' ? 'var(--red)' : burnout.risk === 'medium' ? 'var(--yellow)' : 'var(--green)'}
              strokeWidth={1.8}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>번아웃 리스크</div>
            <div style={{
              fontSize: 16, fontWeight: 800,
              color: burnout.risk === 'high' ? 'var(--red)' : burnout.risk === 'medium' ? 'var(--yellow)' : 'var(--green)',
            }}>
              {burnout.risk === 'high' ? '주의 필요' : burnout.risk === 'medium' ? '보통' : '안정'}
            </div>
            {burnout.reasons[0] && (
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>
                {burnout.reasons[0]}
              </div>
            )}
          </div>
        </div>

        {/* 목표 달성 확률 */}
        <div style={{
          ...CARD, display: 'flex', alignItems: 'center', gap: 12,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--card-shadow)'; }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'rgba(164,110,245,0.12)', border: '1px solid rgba(164,110,245,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Target size={18} color="var(--purple)" strokeWidth={1.8} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>목표 달성 확률</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)', lineHeight: 1.4 }}>
              {achProb.japanese != null
                ? <span>일어 <span style={{ color: 'var(--blue)' }}>{achProb.japanese}%</span></span>
                : <span style={{ color: 'var(--t3)' }}>—</span>
              }
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 1 }}>
              {achProb.comprehensive != null
                ? <span>종합 <span style={{ color: 'var(--green)' }}>{achProb.comprehensive}%</span></span>
                : null
              }
            </div>
          </div>
        </div>
      </div>

      {/* AI 인사이트 배너 */}
      {insight && (
        <div style={{
          ...CARD,
          padding: '16px 20px',
          background: insight.type === 'success' ? 'rgba(16,185,129,0.06)'
                    : insight.type === 'warning' ? 'rgba(239,68,68,0.06)'
                    : 'rgba(107,163,255,0.06)',
          borderColor: insight.type === 'success' ? 'rgba(16,185,129,0.25)'
                     : insight.type === 'warning' ? 'rgba(239,68,68,0.25)'
                     : 'rgba(107,163,255,0.2)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: insight.type === 'success' ? 'rgba(16,185,129,0.15)'
                      : insight.type === 'warning' ? 'rgba(239,68,68,0.12)'
                      : 'rgba(107,163,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={17}
              color={insight.type === 'success' ? 'var(--green)' : insight.type === 'warning' ? 'var(--red)' : 'var(--blue)'}
              strokeWidth={1.8}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, marginBottom: 3,
              color: insight.type === 'success' ? 'var(--green)' : insight.type === 'warning' ? 'var(--red)' : 'var(--blue)',
            }}>{insight.title}</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>{insight.body}</div>
          </div>
        </div>
      )}

      {/* 약점 자동 진단 */}
      {diagnosis.length > 0 && (
        <div style={{ ...CARD, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            약점 자동 진단
            <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400, marginLeft: 4 }}>— 오답 패턴 기반</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {diagnosis.map((item, i) => {
              const s = LEVEL_STYLE[item.level];
              const LevelIcon = item.level === 'critical' ? AlertCircle
                : item.level === 'warning'  ? AlertTriangle
                : item.level === 'good'     ? CheckCircle2
                : Info;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                  borderRadius: 14, background: s.bg, border: `1px solid ${s.border}`,
                  transition: 'transform 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                >
                  <LevelIcon size={16} color={s.color} strokeWidth={2} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{item.desc}</div>
                  </div>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.badge, flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 스탯 카드 4개 */}
      <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard label="일본어 합계" value={latestJap} max={370} color="var(--blue)" diff={diffJap} />
        <StatCard label="독해" value={latestJapNorm?.reading} max={185} color="var(--purple)" diff={diffRead} />
        <StatCard label="청해" value={latestJapNorm?.listening} max={185} color="var(--pink)" diff={diffList} />
        <StatCard label="종합과목" value={latestComp} max={COMP_MAX} color="var(--green)" diff={diffComp} />
      </div>

      {/* 목표 진행 */}
      <div className="grid-2-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          { label: '일본어 목표까지', cur: latestJap, target: tJap, color: 'var(--blue)', hexColor: '#5b9eff', max: 370, goalDate: goalDateJap },
          { label: '종합과목 목표까지', cur: latestComp, target: tComp, color: 'var(--green)', hexColor: '#10d98c', max: COMP_MAX, goalDate: goalDateComp },
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
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {achieved
                  ? <CheckCircle2 size={22} color="var(--green)" strokeWidth={1.8} />
                  : <Target size={22} color={g.color} strokeWidth={1.8} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>{g.label}</div>
                {achieved
                  ? <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)' }}>목표 달성</div>
                  : remain !== null
                    ? <div style={{ fontSize: 22, fontWeight: 800, color: g.color, letterSpacing: '-0.5px' }}>
                        +{remain}<span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 400, marginLeft: 4 }}>점 남음</span>
                        <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 500, marginTop: 1 }}>{g.cur}/{g.target}</div>
                        {g.goalDate && !g.goalDate.alreadyAchieved && (
                          <div style={{ fontSize: 11, color: g.color, fontWeight: 600, marginTop: 3 }}>
                            예상 달성: {g.goalDate.date} (약 {g.goalDate.monthsAhead}개월)
                          </div>
                        )}
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
        <div className="grid-2-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* 일본어 차트 */}
          <div style={{ ...CARD }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>일본어 점수 추이</div>
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
                <XAxis dataKey="name" tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} />
                <YAxis domain={[0, 370]} tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} />
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
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>종합과목 점수 추이</div>
              <div style={{ fontSize: 10, color: 'var(--t2)' }}>목표 {tComp}점</div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} />
                <YAxis domain={[0, COMP_MAX]} tick={{ fill: 'var(--t2)', fontSize: 10, fontFamily: 'Pretendard, sans-serif' }} />
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
              <ArrowLeftRight size={14} strokeWidth={2} />
              회차 비교 {showCompare ? '닫기' : '열기'}
            </button>
          </div>
          {showCompare && <CompareView exams={exams} />}
        </>
      )}

      {/* 목표 달성 타임라인 */}
      <GoalTimeline exams={exams} tJap={tJap} tComp={tComp} />

      {/* 최고 기록 */}
      <div className="grid-2-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          { label: '일본어 최고 기록', value: bestJap, max: 370, color: 'var(--blue)', hex: '#5b9eff' },
          { label: '종합과목 최고 기록', value: bestComp, max: COMP_MAX, color: 'var(--green)', hex: '#10d98c' },
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
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Trophy size={22} color={r.color} strokeWidth={1.8} />
            </div>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <ClipboardList size={16} color="var(--t2)" strokeWidth={2} /> 시험 기록 목록
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {[{ id: 'all', label: '전체' }, { id: 'exam', label: '모의고사' }, { id: 'workbook', label: '문제집' }].map(opt => {
              const active = recordFilter === opt.id;
              return (
                <button key={opt.id} onClick={() => setRecordFilter(opt.id)} style={{
                  background: active ? 'rgba(79,142,247,0.12)' : 'transparent',
                  color: active ? 'var(--blue)' : 'var(--t2)',
                  border: active ? '1px solid rgba(79,142,247,0.4)' : '1px solid var(--bd1)',
                  borderRadius: 8, padding: '5px 12px', fontSize: 11, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>{opt.label}</button>
              );
            })}
            <button onClick={onDeleteAll} style={{
              background: 'rgba(239,68,68,0.1)', color: 'var(--red)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
              padding: '5px 14px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
            }}>전체 삭제</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...exams].reverse().filter(exam => recordFilter === 'all' || (exam.recordType || 'exam') === recordFilter).map(exam => {
            const isRawJap  = Boolean(exam.japanese?.rawMeta?.isRaw);
            const isRawComp = Boolean(exam.comprehensive?.rawMeta?.isRaw);
            const japNorm   = exam.japanese ? normalizeJapaneseScore(exam.japanese) : null;
            const jap       = japNorm ? japNorm.reading + japNorm.listening : null;
            const comp      = exam.comprehensive ? normalizeCompScore(exam.comprehensive) : null;
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
                <div style={{ flex: 1, fontSize: 13, color: 'var(--t0)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {exam.examName}
                  {exam.recordType === 'workbook' && (
                    <span style={{ fontSize: 10, background: 'rgba(168,85,247,0.12)', color: 'var(--purple)', padding: '2px 7px', borderRadius: 5, fontWeight: 700 }}>문제집</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {exam.japanese && (
                    <span style={{ fontSize: 12, background: 'rgba(79,142,247,0.1)', color: 'var(--blue)', padding: '3px 10px', borderRadius: 8, fontWeight: 600 }}>
                      {isRawJap
                        ? `독해 ${exam.japanese.reading}/${exam.japanese.rawMeta?.readingMax||25} 청해 ${exam.japanese.listening}/${exam.japanese.rawMeta?.listeningMax||40}`
                        : `일어 ${jap}/370`
                      }{japEstimated ? ' (예측)' : ''}
                    </span>
                  )}
                  {exam.comprehensive?.score != null && (
                    <span style={{ fontSize: 12, background: 'rgba(16,185,129,0.1)', color: 'var(--green)', padding: '3px 10px', borderRadius: 8, fontWeight: 600 }}>
                      {isRawComp
                        ? `종합 ${exam.comprehensive.score}/${exam.comprehensive.rawMeta?.max||200} 원점수`
                        : `종합 ${comp}/${COMP_MAX}`
                      }{compEstimated ? ' (예측)' : ''}
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
