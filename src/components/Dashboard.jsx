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
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  BookOpen, Plus, AlertTriangle, Trophy,
  CalendarDays, ArrowLeftRight, Target, CheckCircle2,
  AlertCircle, Info, ClipboardList, FileText,
  Search, Globe, Layers, GraduationCap,
} from 'lucide-react';
import useIsMobile from '../hooks/useIsMobile';

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

// ── Compact D-day ──────────────────────────────────
function DdayBanner({ dday, nextDate }) {
  if (dday === null) return null;
  const color = dday <= 7 ? 'var(--red)' : dday <= 30 ? 'var(--yellow)' : 'var(--accent)';
  const label = dday > 0 ? `D-${dday}` : dday === 0 ? 'D-Day' : `D+${Math.abs(dday)}`;

  return (
    <div className="card" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      padding: '14px 18px', borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CalendarDays size={18} color={color} strokeWidth={1.6} />
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
            다음 시험
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>
            {nextDate ? new Date(nextDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '—'}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: '-1px' }}>
        {label}
      </div>
    </div>
  );
}

// ── Stat Row ───────────────────────────────────────
function StatRow({ label, value, max, prevValue }) {
  const pct = value != null && max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const diff = prevValue != null && value != null ? value - prevValue : null;
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          {value ?? '—'}
        </span>
        {max && (
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>/ {max}</span>
        )}
        {diff !== null && (
          <span style={{
            fontSize: 12, fontWeight: 600, marginLeft: 'auto',
            color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-tertiary)',
          }}>
            {diff > 0 ? '▲' : diff < 0 ? '▼' : '─'} {Math.abs(diff)}
          </span>
        )}
      </div>
      {value != null && max && (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`, borderRadius: 3,
              background: 'var(--accent)', transition: 'width 0.6s',
            }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, textAlign: 'right' }}>
            {pct}%
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI Insight Card ────────────────────────────────
function InsightCard({ insight, diagnosis, streak, consistency, burnout, achProb }) {
  if (!insight && diagnosis.length === 0) return null;

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <GraduationCap size={14} color="var(--accent)" strokeWidth={1.6} />
        오늘의 인사이트
      </div>

      {/* Quick stats row */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
        {streak && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>연속 학습</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {streak.current}개월
            </div>
          </div>
        )}
        {consistency != null && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>일관성</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {consistency}%
            </div>
          </div>
        )}
        {burnout && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>번아웃</div>
            <div style={{
              fontSize: 16, fontWeight: 700,
              color: burnout.risk === 'high' ? 'var(--red)' : burnout.risk === 'medium' ? 'var(--yellow)' : 'var(--green)',
            }}>
              {burnout.risk === 'high' ? '주의' : burnout.risk === 'medium' ? '보통' : '안정'}
            </div>
          </div>
        )}
        {achProb?.japanese != null && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>목표 확률</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
              일어 {achProb.japanese}%
            </div>
          </div>
        )}
      </div>

      {/* Diagnosis items — max 2 */}
      {diagnosis.slice(0, 2).map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', marginBottom: 6,
          borderRadius: 'var(--radius-sm)',
          background: item.level === 'critical' ? 'rgba(239,68,68,0.06)'
                    : item.level === 'warning' ? 'rgba(245,158,11,0.06)'
                    : 'rgba(49,130,246,0.06)',
          border: `1px solid ${
            item.level === 'critical' ? 'rgba(239,68,68,0.15)'
            : item.level === 'warning' ? 'rgba(245,158,11,0.15)'
            : 'rgba(49,130,246,0.15)'
          }`,
        }}>
          {item.level === 'critical' ? <AlertCircle size={14} color="var(--red)" strokeWidth={1.6} />
            : item.level === 'warning' ? <AlertTriangle size={14} color="var(--yellow)" strokeWidth={1.6} />
            : <Info size={14} color="var(--accent)" strokeWidth={1.6} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{item.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── OCR Analysis summary (compact) ─────────────────
function OcrSummary({ data, onDismiss }) {
  if (!data) return null;
  const files = data.files || [];
  const sm = data.summary || {};
  const avgConf = sm.avgConfidence || 0;
  const hasComp = files.some(f => f.subjectType === 'comprehensive' && f.comprehensiveScan);
  const compFile = files.find(f => f.comprehensiveScan);

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={14} color="var(--accent)" strokeWidth={1.6} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              AI OCR 분석 리포트
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
              {files.length}개 파일 · 평균 신뢰도 {avgConf}%
            </div>
          </div>
        </div>
        <button onClick={onDismiss} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--text-tertiary)' }}>
          제거
        </button>
      </div>

      {/* Gauge */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
          <span>평균 신뢰도</span>
          <span style={{ fontWeight: 600, color: avgConf >= 80 ? 'var(--green)' : avgConf >= 60 ? 'var(--yellow)' : 'var(--red)' }}>{avgConf}%</span>
        </div>
        <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${avgConf}%`, borderRadius: 3,
            background: avgConf >= 80 ? 'var(--green)' : avgConf >= 60 ? 'var(--yellow)' : 'var(--red)',
            transition: 'width 0.6s',
          }} />
        </div>
      </div>

      {/* File list — max 3 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {files.slice(0, 3).map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-hover)',
          }}>
            <FileText size={12} color="var(--text-tertiary)" strokeWidth={1.6} />
            <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.fileName}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
              color: f.phase4?.passed ? 'var(--green)' : 'var(--yellow)',
              background: f.phase4?.passed ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
            }}>
              {f.phase4?.overallConfidence}%
            </span>
            {f.subjectType === 'comprehensive' && <Globe size={10} color="var(--accent)" strokeWidth={1.6} />}
            {f.subjectType === 'math' && <Layers size={10} color="var(--accent)" strokeWidth={1.6} />}
          </div>
        ))}
      </div>

      {/* Domain coverage — compact */}
      {hasComp && compFile?.comprehensiveScan?.domainStats && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {['geography','history','politics','economy','society'].map(dk => {
            const d = compFile.comprehensiveScan.domainStats[dk];
            if (!d) return null;
            const labels = { geography:'지리', history:'역사', politics:'정치', economy:'경제', society:'사회' };
            const cov = d.weightCoverage ?? d.coveragePct ?? 0;
            return (
              <div key={dk} style={{
                padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-hover)', fontSize: 11,
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>{labels[dk]}: </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cov}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Exam record list item ──────────────────────────
function ExamListItem({ exam, onEdit, onDelete, isPendingDelete, onConfirmStart, onConfirmCancel }) {
  const japNorm = exam.japanese ? normalizeJapaneseScore(exam.japanese) : null;
  const jap = japNorm ? japNorm.reading + japNorm.listening : null;
  const comp = exam.comprehensive ? normalizeCompScore(exam.comprehensive) : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--bg-hover)',
      border: `1px solid ${isPendingDelete ? 'rgba(239,68,68,0.25)' : 'transparent'}`,
      transition: 'border-color 0.15s',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, flexShrink: 0 }}>
        {exam.date}
      </div>
      <div style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
        {exam.examName}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {jap != null && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '2px 8px', borderRadius: 5 }}>
            일어 {jap}
          </span>
        )}
        {comp != null && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 5 }}>
            종합 {comp}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {isPendingDelete ? (
          <>
            <button onClick={onConfirmCancel} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>취소</button>
            <button onClick={onConfirmStart} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--red)' }}>삭제</button>
          </>
        ) : (
          <>
            <button onClick={onEdit} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>수정</button>
            <button onClick={onConfirmStart} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--red)' }}>삭제</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────
export default function Dashboard({ exams, onEdit, onDelete, onDeleteAll, onAddNew, settings }) {
  const isMobile = useIsMobile();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [ocrAnalysis, setOcrAnalysis] = useState(() => {
    try { const d = localStorage.getItem('eju_ocr_analysis'); return d ? JSON.parse(d) : null; }
    catch { return null; }
  });

  const tJap = settings.targetJapanese ?? 320;
  const tComp = settings.targetComprehensive ?? 170;
  const dday = getDday(settings.nextExamDate);
  const diagnosis = useMemo(() => generateDiagnosis(exams), [exams]);

  const latest = exams[exams.length - 1];
  const prev   = exams.length >= 2 ? exams[exams.length - 2] : null;

  const latestJapNorm = latest?.japanese ? normalizeJapaneseScore(latest.japanese) : null;
  const prevJapNorm   = prev?.japanese   ? normalizeJapaneseScore(prev.japanese)   : null;
  const latestJap  = latestJapNorm ? latestJapNorm.reading + latestJapNorm.listening : undefined;
  const prevJap    = prevJapNorm   ? prevJapNorm.reading   + prevJapNorm.listening   : null;
  const latestComp = latest?.comprehensive ? normalizeCompScore(latest.comprehensive) : undefined;
  const prevComp   = prev?.comprehensive   ? normalizeCompScore(prev.comprehensive)   : null;

  const streak      = useMemo(() => getStudyStreak(exams),         [exams]);
  const consistency = useMemo(() => getStudyConsistency(exams, 3), [exams]);
  const burnout     = useMemo(() => detectBurnoutRisk(exams),       [exams]);
  const achProb     = useMemo(() => getAchievementProbability(exams, tJap, tComp), [exams, tJap, tComp]);
  const insight     = useMemo(() => generateQuickInsight(exams, settings), [exams, settings]);

  const chartData = useMemo(() => {
    const data = exams.map(e => {
      const japNorm = e.japanese ? normalizeJapaneseScore(e.japanese) : null;
      const compNorm = normalizeCompScore(e.comprehensive);
      return {
        name: e.date,
        일본어: japNorm ? japNorm.reading + japNorm.listening : undefined,
        종합과목: compNorm ?? undefined,
      };
    });
    if (exams.length >= 2) {
      const japVals  = data.map(d => d.일본어).filter(v => v != null);
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

  const bestJap  = exams.length > 0 ? Math.max(...exams.map(e => {
    if (!e.japanese) return 0;
    const n = normalizeJapaneseScore(e.japanese);
    return n ? n.reading + n.listening : 0;
  })) : 0;

  // ── Empty state ──
  if (!exams || exams.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', gap: 16, textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BookOpen size={28} color="var(--text-tertiary)" strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            아직 시험 기록이 없어요
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 280 }}>
            모의고사 점수를 입력하면<br />성적 추이와 AI 분석을 확인할 수 있어요
          </div>
        </div>
        <button onClick={onAddNew} className="btn btn-primary" style={{ padding: '10px 20px', fontSize: 14 }}>
          <Plus size={15} strokeWidth={2.5} />
          첫 점수 입력하기
        </button>
      </div>
    );
  }

  if (isMobile) {
    return (
      <MobileDashboard
        exams={exams}
        onEdit={onEdit}
        onDelete={onDelete}
        onDeleteAll={onDeleteAll}
        onAddNew={onAddNew}
        settings={settings}
        ocrAnalysis={ocrAnalysis}
        setOcrAnalysis={setOcrAnalysis}
        confirmDelete={confirmDelete}
        setConfirmDelete={setConfirmDelete}
        data={{
          tJap, tComp, dday, diagnosis,
          latestJap, prevJap, latestComp, prevComp,
          streak, consistency, burnout, achProb, insight, chartData,
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 780 }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
          대시보드
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          총 {exams.length}회 기록 · 목표 일어 {tJap}/370 · 종합 {tComp}/{COMP_MAX}
        </p>
      </div>

      {/* ── OCR Analysis ── */}
      <OcrSummary
        data={ocrAnalysis}
        onDismiss={() => { setOcrAnalysis(null); try { localStorage.removeItem('eju_ocr_analysis'); } catch {} }}
      />

      {/* ── D-day ── */}
      <DdayBanner dday={dday} nextDate={settings.nextExamDate} />

      {/* ── Core Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatRow label="일본어 합계" value={latestJap} max={370} prevValue={prevJap} />
        <StatRow label="종합과목" value={latestComp} max={COMP_MAX} prevValue={prevComp} />
      </div>

      {/* ── Insight + Diagnosis ── */}
      <InsightCard
        insight={insight} diagnosis={diagnosis}
        streak={streak} consistency={consistency}
        burnout={burnout} achProb={achProb}
      />

      {/* ── Chart (single combined) ── */}
      {exams.length >= 2 && (
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              점수 추이
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-tertiary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 2, background: 'var(--accent)', display: 'inline-block', borderRadius: 1 }} /> 일본어
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 2, background: 'var(--green)', display: 'inline-block', borderRadius: 1 }} /> 종합과목
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 0, display: 'inline-block', borderTop: '1px dashed var(--text-tertiary)' }} /> 예측
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 12, boxShadow: 'var(--shadow-elevated)',
                }}
                labelStyle={{ color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}
              />
              <ReferenceLine y={tJap} stroke="var(--accent)" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: `목표 ${tJap}`, fill: 'var(--accent)', fontSize: 9 }} />
              <ReferenceLine y={tComp} stroke="var(--green)" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: `목표 ${tComp}`, fill: 'var(--green)', fontSize: 9 }} />
              <Line type="monotone" dataKey="일본어" stroke="var(--accent)" strokeWidth={2}
                dot={{ r: 2.5, fill: 'var(--accent)' }} activeDot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="종합과목" stroke="var(--green)" strokeWidth={2}
                dot={{ r: 2.5, fill: 'var(--green)' }} activeDot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="pred_jap" stroke="var(--accent)" strokeWidth={1.5}
                strokeDasharray="5 3" dot={false} connectNulls />
              <Line type="monotone" dataKey="pred_comp" stroke="var(--green)" strokeWidth={1.5}
                strokeDasharray="5 3" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Recent exam list ── */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClipboardList size={14} color="var(--text-secondary)" strokeWidth={1.6} />
            시험 기록
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onAddNew} className="btn btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }}>
              <Plus size={11} strokeWidth={2.5} /> 추가
            </button>
            {exams.length > 0 && (
              <button onClick={onDeleteAll} className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px', color: 'var(--red)' }}>
                전체 삭제
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[...exams].reverse().map(exam => (
            <ExamListItem
              key={exam.id}
              exam={exam}
              onEdit={() => onEdit(exam)}
              onDelete={() => { onDelete(exam.id); setConfirmDelete(null); }}
              isPendingDelete={confirmDelete === exam.id}
              onConfirmStart={() => setConfirmDelete(exam.id)}
              onConfirmCancel={() => setConfirmDelete(null)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MOBILE (≤768px) — dedicated component. Desktop JSX is untouched.
// Stat grid → single column · exam rows → cards · touch targets ≥44px
// ═══════════════════════════════════════════════════════════════════
const mdashStyles = `
.mdash { display: flex; flex-direction: column; gap: 14px; padding: 0 2px 28px; }
.mdash-h1 { font-size: 22px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.3px; }
.mdash-sub { font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.5; }
.mdash-stats { display: flex; flex-direction: column; gap: 12px; }
.mdash-examitem { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--bg-hover); }
.mdash-btn { min-height: 44px; flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 13px; font-weight: 600; border-radius: var(--radius-sm); }
.mdash-addbtn { min-height: 44px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 14px; }
`;

function MExamItem({ exam, onEdit, isPendingDelete, onConfirmStart, onConfirmCancel }) {
  const japNorm = exam.japanese ? normalizeJapaneseScore(exam.japanese) : null;
  const jap = japNorm ? japNorm.reading + japNorm.listening : null;
  const comp = exam.comprehensive ? normalizeCompScore(exam.comprehensive) : null;

  return (
    <div className="mdash-examitem" style={{ border: `1px solid ${isPendingDelete ? 'rgba(239,68,68,0.25)' : 'transparent'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {exam.examName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, marginTop: 2 }}>{exam.date}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {jap != null && (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '3px 9px', borderRadius: 5 }}>일어 {jap}</span>
          )}
          {comp != null && (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', background: 'rgba(34,197,94,0.1)', padding: '3px 9px', borderRadius: 5 }}>종합 {comp}</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {isPendingDelete ? (
          <>
            <button onClick={onConfirmCancel} className="btn btn-ghost mdash-btn">취소</button>
            <button onClick={onConfirmStart} className="btn btn-ghost mdash-btn" style={{ color: 'var(--red)' }}>삭제 확인</button>
          </>
        ) : (
          <>
            <button onClick={onEdit} className="btn btn-secondary mdash-btn">수정</button>
            <button onClick={onConfirmStart} className="btn btn-ghost mdash-btn" style={{ color: 'var(--red)' }}>삭제</button>
          </>
        )}
      </div>
    </div>
  );
}

function MobileDashboard({ exams, onEdit, onDelete, onDeleteAll, onAddNew, settings, ocrAnalysis, setOcrAnalysis, confirmDelete, setConfirmDelete, data }) {
  const {
    tJap, tComp, dday, diagnosis,
    latestJap, prevJap, latestComp, prevComp,
    streak, consistency, burnout, achProb, insight, chartData,
  } = data;

  return (
    <div className="mdash">
      <style>{mdashStyles}</style>

      {/* Header */}
      <div>
        <h1 className="mdash-h1">대시보드</h1>
        <p className="mdash-sub">총 {exams.length}회 기록 · 목표 일어 {tJap}/370 · 종합 {tComp}/{COMP_MAX}</p>
      </div>

      {/* OCR Analysis */}
      <OcrSummary
        data={ocrAnalysis}
        onDismiss={() => { setOcrAnalysis(null); try { localStorage.removeItem('eju_ocr_analysis'); } catch {} }}
      />

      {/* D-day */}
      <DdayBanner dday={dday} nextDate={settings.nextExamDate} />

      {/* Core Stats — single column */}
      <div className="mdash-stats">
        <StatRow label="일본어 합계" value={latestJap} max={370} prevValue={prevJap} />
        <StatRow label="종합과목" value={latestComp} max={COMP_MAX} prevValue={prevComp} />
      </div>

      {/* Insight + Diagnosis */}
      <InsightCard
        insight={insight} diagnosis={diagnosis}
        streak={streak} consistency={consistency}
        burnout={burnout} achProb={achProb}
      />

      {/* Chart */}
      {exams.length >= 2 && (
        <div className="card" style={{ padding: '14px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>점수 추이</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-tertiary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 2, background: 'var(--accent)', display: 'inline-block', borderRadius: 1 }} /> 일본어
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 2, background: 'var(--green)', display: 'inline-block', borderRadius: 1 }} /> 종합
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 0, display: 'inline-block', borderTop: '1px dashed var(--text-tertiary)' }} /> 예측
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, boxShadow: 'var(--shadow-elevated)' }}
                labelStyle={{ color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}
              />
              <ReferenceLine y={tJap} stroke="var(--accent)" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: `목표 ${tJap}`, fill: 'var(--accent)', fontSize: 9 }} />
              <ReferenceLine y={tComp} stroke="var(--green)" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: `목표 ${tComp}`, fill: 'var(--green)', fontSize: 9 }} />
              <Line type="monotone" dataKey="일본어" stroke="var(--accent)" strokeWidth={2}
                dot={{ r: 2.5, fill: 'var(--accent)' }} activeDot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="종합과목" stroke="var(--green)" strokeWidth={2}
                dot={{ r: 2.5, fill: 'var(--green)' }} activeDot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="pred_jap" stroke="var(--accent)" strokeWidth={1.5}
                strokeDasharray="5 3" dot={false} connectNulls />
              <Line type="monotone" dataKey="pred_comp" stroke="var(--green)" strokeWidth={1.5}
                strokeDasharray="5 3" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent exam list */}
      <div className="card" style={{ padding: '14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClipboardList size={14} color="var(--text-secondary)" strokeWidth={1.6} /> 시험 기록
          </div>
          {exams.length > 0 && (
            <button onClick={onDeleteAll} className="btn btn-ghost" style={{ fontSize: 11, padding: '6px 10px', minHeight: 36, color: 'var(--red)' }}>
              전체 삭제
            </button>
          )}
        </div>
        <button onClick={onAddNew} className="btn btn-primary mdash-addbtn" style={{ width: '100%', marginBottom: 12 }}>
          <Plus size={15} strokeWidth={2.5} /> 점수 추가
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...exams].reverse().map(exam => (
            <MExamItem
              key={exam.id}
              exam={exam}
              onEdit={() => onEdit(exam)}
              isPendingDelete={confirmDelete === exam.id}
              onConfirmStart={() => {
                if (confirmDelete === exam.id) { onDelete(exam.id); setConfirmDelete(null); }
                else setConfirmDelete(exam.id);
              }}
              onConfirmCancel={() => setConfirmDelete(null)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
