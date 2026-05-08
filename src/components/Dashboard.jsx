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
  background: 'var(--bg2)', border: '1px solid var(--bd0)',
  borderRadius: 16, padding: 22,
};

// ── Sub-components ───────────────────────────────────
function Tooltip_({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--tooltip-bg)', border: '1px solid var(--bd1)',
      borderRadius: 12, padding: '12px 16px', fontSize: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    }}>
      <div style={{ color: 'var(--t2)', marginBottom: 8, fontWeight: 600 }}>{label}</div>
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
      padding: '2px 7px', borderRadius: 6,
    }}>
      {up ? '▲' : '▼'} {Math.abs(diff)}{unit}
    </span>
  );
}

function StatCard({ label, value, max, color, diff, diffUnit = '점', pct }) {
  const p = pct ?? (max ? Math.round((value / max) * 100) : null);
  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 2 }}>
        <span style={{ fontSize: 34, fontWeight: 700, color }}>{value ?? '—'}</span>
        {max && <span style={{ fontSize: 13, color: 'var(--t2)', marginLeft: 2 }}>/ {max}</span>}
        {diff !== undefined && <GrowthBadge diff={diff} unit={diffUnit} />}
      </div>
      {p !== null && (
        <div>
          <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${p}%`, background: color, borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--t2)' }}>{p}% 달성</span>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>
          오답 누적 경고 — {threshold}회 이상 틀린 문제
        </span>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {reading.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 6 }}>📖 독해</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {reading.map(([q, c]) => (
                <span key={q} style={{
                  background: 'rgba(239,68,68,0.15)', color: 'var(--red)',
                  padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                }}>{q}번 <span style={{ opacity: 0.7, fontWeight: 400 }}>×{c}</span></span>
              ))}
            </div>
          </div>
        )}
        {listening.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 6 }}>🎧 청해</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {listening.map(([q, c]) => (
                <span key={q} style={{
                  background: 'rgba(236,72,153,0.15)', color: 'var(--pink)',
                  padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                }}>{q}번 <span style={{ opacity: 0.7, fontWeight: 400 }}>×{c}</span></span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────
export default function Dashboard({ exams, onEdit, onDelete, onDeleteAll, settings }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const tJap = settings.targetJapanese ?? 320;
  const tComp = settings.targetComprehensive ?? 170;
  const threshold = settings.alertThreshold ?? 3;
  const dday = getDday(settings.nextExamDate);
  const diagnosis = useMemo(() => generateDiagnosis(exams), [exams]);

  // Latest / prev scores
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

  // Growth rate (%)
  const growthJap  = prevJap   ? ((latestJap  - prevJap)  / prevJap  * 100).toFixed(1) : null;
  const growthComp = prevComp  ? ((latestComp - prevComp) / prevComp * 100).toFixed(1) : null;

  // Alerts
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

  // Chart data + prediction
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
      const japPred  = linearPredict(japVals,  3);
      const compPred = linearPredict(compVals, 3);

      // Anchor prediction at last real point
      const last = data[data.length - 1];
      last.pred_jap  = japVals[japVals.length - 1];
      last.pred_comp = compVals[compVals.length - 1];

      for (let i = 0; i < 3; i++) {
        data.push({
          name: addMonths(exams[exams.length - 1].date, i + 1),
          pred_jap:  Math.min(400, Math.max(0, japPred[i]  ?? 0)),
          pred_comp: Math.min(200, Math.max(0, compPred[i] ?? 0)),
        });
      }
    }
    return data;
  }, [exams]);

  const bestJap  = Math.max(...exams.map(e => e.japanese ? e.japanese.reading + e.japanese.listening : 0));
  const bestComp = Math.max(...exams.map(e => e.comprehensive?.score ?? 0));

  // Empty state
  if (!exams || exams.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
        <div style={{ fontSize: 56 }}>📝</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--t0)' }}>아직 데이터가 없어요</div>
        <div style={{ color: 'var(--t2)', fontSize: 14 }}>왼쪽의 "점수 입력" 버튼으로 첫 모의고사를 기록해보세요</div>
      </div>
    );
  }

  // D-day color + label
  const ddayColor  = dday === null ? null : dday <= 0 ? 'var(--green)' : dday <= 7 ? 'var(--red)' : dday <= 30 ? 'var(--orange)' : 'var(--blue)';
  const ddayLabel  = dday === null ? null : dday > 0 ? `D-${dday}` : dday === 0 ? 'D-Day!' : `D+${Math.abs(dday)}`;
  const ddayEmoji  = dday === null ? null : dday <= 0 ? '🎌' : dday <= 7 ? '🔥' : dday <= 30 ? '⚡' : '📅';

  const LEVEL_STYLE = {
    critical: { bg:'rgba(239,68,68,0.08)',  border:'rgba(239,68,68,0.3)',  color:'var(--red)',    badge:'#ef4444' },
    warning:  { bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.3)', color:'var(--yellow)', badge:'#f59e0b' },
    info:     { bg:'rgba(79,142,247,0.08)', border:'rgba(79,142,247,0.3)', color:'var(--blue)',   badge:'#4f8ef7' },
    good:     { bg:'rgba(16,185,129,0.08)', border:'rgba(16,185,129,0.3)', color:'var(--green)',  badge:'#10b981' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* D-day banner */}
      {dday !== null && (
        <div style={{
          borderRadius: 18, padding: '20px 24px',
          background: `linear-gradient(135deg, ${ddayColor}18, ${ddayColor}08)`,
          border: `1px solid ${ddayColor}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 36 }}>{ddayEmoji}</div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>다음 EJU 시험</div>
              <div style={{ fontSize: 14, color: 'var(--t1)', marginTop: 2 }}>
                {new Date(settings.nextExamDate).toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' })}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 42, fontWeight: 800, color: ddayColor, letterSpacing: '-2px', lineHeight: 1 }}>{ddayLabel}</div>
            {dday > 0 && <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4 }}>남은 기간 {Math.floor(dday/7)}주 {dday%7}일</div>}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--t0)' }}>대시보드</h1>
          <div style={{ color: 'var(--t2)', fontSize: 13, marginTop: 3 }}>총 {exams.length}회 기록 · 목표 일어 {tJap}/400 · 종합 {tComp}/200</div>
        </div>
        {growthJap !== null && (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--t2)' }}>이번 달 일어 성장률</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: Number(growthJap) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {Number(growthJap) >= 0 ? '+' : ''}{growthJap}%
              </div>
            </div>
            {growthComp !== null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--t2)' }}>이번 달 종합 성장률</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: Number(growthComp) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {Number(growthComp) >= 0 ? '+' : ''}{growthComp}%
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alerts */}
      <AlertBanner reading={alerts.reading} listening={alerts.listening} threshold={threshold} />

      {/* Diagnosis cards */}
      {diagnosis.length > 0 && (
        <div style={{ ...CARD, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🩺</span> 약점 자동 진단
            <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400, marginLeft: 4 }}>— AI가 오답 패턴을 분석했어요</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {diagnosis.map((item, i) => {
              const s = LEVEL_STYLE[item.level];
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                  borderRadius: 12, background: s.bg, border: `1px solid ${s.border}`,
                }}>
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

      {/* Stat cards */}
      <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard label="일본어 합계" value={latestJap} max={400} color="var(--blue)" diff={diffJap} />
        <StatCard label="독해" value={latest?.japanese?.reading} max={200} color="var(--purple)" diff={diffRead} />
        <StatCard label="청해" value={latest?.japanese?.listening} max={200} color="var(--pink)" diff={diffList} />
        <StatCard label="종합과목" value={latestComp} max={200} color="var(--green)" diff={diffComp} />
      </div>

      {/* Goal progress */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          { label: '일본어 목표까지', cur: latestJap, target: tJap, color: 'var(--blue)', max: 400 },
          { label: '종합과목 목표까지', cur: latestComp, target: tComp, color: 'var(--green)', max: 200 },
        ].map(g => {
          const remain = g.cur != null ? Math.max(0, g.target - g.cur) : null;
          const achieved = g.cur != null && g.cur >= g.target;
          return (
            <div key={g.label} style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 26 }}>{achieved ? '🎉' : '🎯'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{g.label}</div>
                {achieved
                  ? <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)' }}>목표 달성! 🎊</div>
                  : remain !== null
                    ? <div style={{ fontSize: 22, fontWeight: 700, color: g.color }}>
                        +{remain}점 <span style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 400 }}>남음 ({g.cur}/{g.target})</span>
                      </div>
                    : <div style={{ color: 'var(--t2)', fontSize: 13 }}>데이터 없음</div>
                }
                {g.cur != null && (
                  <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (g.cur / g.target) * 100)}%`, background: g.color, borderRadius: 3, transition: 'width 0.5s' }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      {exams.length >= 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Japanese chart */}
          <div style={{ ...CARD }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t0)' }}>일본어 점수 추이</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--t2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ borderTop: '2px dashed var(--blue)', width: 16, display: 'inline-block' }} /> 예측
                </span>
                <span>목표선 {tJap}점</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <YAxis domain={[0, 400]} tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <Tooltip content={<Tooltip_ />} />
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

          {/* Comprehensive chart */}
          <div style={{ ...CARD }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t0)' }}>종합과목 점수 추이</div>
              <div style={{ fontSize: 11, color: 'var(--t2)' }}>목표선 {tComp}점</div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <YAxis domain={[0, 200]} tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <Tooltip content={<Tooltip_ />} />
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

      {/* Best records */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          { icon: '🏆', label: '일본어 최고 기록', value: bestJap, max: 400, color: 'var(--blue)' },
          { icon: '🏆', label: '종합과목 최고 기록', value: bestComp, max: 200, color: 'var(--green)' },
        ].map(r => (
          <div key={r.label} style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 28 }}>{r.icon}</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: r.color, marginTop: 2 }}>
                {r.value} <span style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 400 }}>/ {r.max}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Exam list */}
      <div style={{ ...CARD }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t0)' }}>시험 기록 목록</div>
          <button onClick={onDeleteAll} style={{
            background: 'rgba(239,68,68,0.1)', color: 'var(--red)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
            padding: '5px 13px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          }}>전체 삭제</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...exams].reverse().map(exam => {
            const jap  = exam.japanese ? exam.japanese.reading + exam.japanese.listening : null;
            const comp = exam.comprehensive?.score;
            const isPendingDelete = confirmDelete === exam.id;
            return (
              <div key={exam.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 14px', background: 'var(--bg3)',
                borderRadius: 11, border: `1px solid ${isPendingDelete ? 'rgba(239,68,68,0.45)' : 'var(--bd0)'}`,
                transition: 'border-color 0.15s',
              }}>
                <div style={{ flex: '0 0 72px', fontSize: 11, color: 'var(--t2)', fontWeight: 600 }}>{exam.date}</div>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--t0)', fontWeight: 500 }}>{exam.examName}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {jap != null && (
                    <span style={{ fontSize: 12, background: 'rgba(79,142,247,0.1)', color: 'var(--blue)', padding: '3px 9px', borderRadius: 7 }}>
                      일어 {jap}/400
                    </span>
                  )}
                  {comp != null && (
                    <span style={{ fontSize: 12, background: 'rgba(16,185,129,0.1)', color: 'var(--green)', padding: '3px 9px', borderRadius: 7 }}>
                      종합 {comp}/200
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {isPendingDelete ? (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--red)' }}>삭제할까요?</span>
                      <button onClick={() => { onDelete(exam.id); setConfirmDelete(null); }} style={{
                        background: 'var(--red)', color: '#fff', border: 'none',
                        borderRadius: 7, padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      }}>예</button>
                      <button onClick={() => setConfirmDelete(null)} style={{
                        background: 'transparent', color: 'var(--t1)', border: '1px solid var(--bd1)',
                        borderRadius: 7, padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      }}>아니오</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => onEdit(exam)} style={{
                        background: 'transparent', color: 'var(--t1)', border: '1px solid var(--bd1)',
                        borderRadius: 7, padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      }}>수정</button>
                      <button onClick={() => setConfirmDelete(exam.id)} style={{
                        background: 'transparent', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 7, padding: '5px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      }}>삭제</button>
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
