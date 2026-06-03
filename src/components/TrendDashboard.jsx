// ═══════════════════════════════════════════════════════════════════
// TrendDashboard v3 — EJU Complete Intelligence Center
//
// Integrates:
//   - PAST_EXAM_BANK (hardcoded fallback)
//   - trend_analysis_complete.json (2,002-2,025 comprehensive analysis)
//   - prediction_2026_2028.json (3-year prediction)
//   - weakness_connector.json (personalized wrong-answer analysis)
//
// 14 Required Sections:
//   1. TOP100 출제토픽
//   2. 최근 상승 토픽
//   3. 최근 하락 토픽
//   4. 장기 미출제 토픽
//   5. 연도별 출제 변화
//   6. 영역별 비중
//   7. 난이도 변화
//   8. 2026~2028 예측
//   9. 수학 전용 분석
//   10. 종합과목 전용 분석
//   11. 출제경향 × 내 약점 (priorityScore)
//   12. 오답노트 확장 추천 (3단계)
//   13. 예측 신뢰도 설명
//   14. 동시출제 학습 추천
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, FileText, Inbox,
  CalendarDays, Layers, Target, Gauge, Sparkles, Calculator, BookOpen,
  Image, Clock, Globe2, Coins, Landmark, Search, AlertTriangle,
  ArrowUp, ArrowDown, ChevronRight, Brain, Network, Lightbulb,
  ListChecks, GitBranch, Zap, Eye,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend, LabelList, CartesianGrid, LineChart, Line,
  AreaChart, Area, Sankey,
} from 'recharts';
import { PAST_EXAM_BANK } from '../data/ejuPastExamBank';
import {
  getDatasetCache, isEngineInitialized, initializeEngine,
} from '../intelligence/engineInitializer';
import useIsMobile from '../hooks/useIsMobile';
import MobileTrendDashboard from './MobileTrendDashboard';
import {
  computePersonalAccuracy, computePriorityTopics,
  analyzeErrorTypes,
} from './trendPersonalInsights';
import { expandTopic, findCooccurrenceTopics, getPrerequisiteConcepts } from './topicExpansionEngine';

// ── Subject Metadata ──
const SUBJECT_MAP = {
  economy:   { name: '경제',   color: '#10b981', icon: '💰' },
  politics:  { name: '정치',   color: '#ef4444', icon: '🏛️' },
  geography: { name: '지리',   color: '#0ea5e9', icon: '🌍' },
  history:   { name: '역사',   color: '#8b5cf6', icon: '📖' },
  society:   { name: '사회',   color: '#f59e0b', icon: '👥' },
  unknown:   { name: '미분류', color: '#94a3b8', icon: '❓' },
};
const COMP_KEYS = ['economy', 'politics', 'geography', 'history', 'society'];

const DOMAIN_COLORS = {
  economy: '#10b981',
  politics: '#ef4444',
  history: '#8b5cf6',
  geography: '#0ea5e9',
  society: '#f59e0b',
};

const COLORS = ['#10b981', '#ef4444', '#8b5cf6', '#0ea5e9', '#f59e0b', '#ec4899', '#06b6d4'];

const CARD = { background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 18, padding: 24, marginBottom: 20 };
const CARD_SM = { background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 14, padding: 16, marginBottom: 14 };

const TOOLTIP_STYLE = { background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 10, fontSize: 12, color: 'var(--t0)', boxShadow: '0 8px 24px rgba(0,27,55,0.12)' };

// ── Helpers ──
function safe(arr) { return Array.isArray(arr) ? arr : []; }

function StatTile({ label, value, color, subtitle }) {
  return (
    <div style={{ background: 'var(--bg1)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--bd0)' }}>
      <div style={{ fontSize: 11.5, color: 'var(--t2)', fontWeight: 600, marginBottom: subtitle ? 2 : 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || 'var(--t0)' }}>{value}</div>
      {subtitle && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

function TrendArrow({ dir }) {
  if (dir === 'up') return <TrendingUp size={13} color="#ef4444" />;
  if (dir === 'down') return <TrendingDown size={13} color="#0ea5e9" />;
  return <Minus size={13} color="var(--t3)" />;
}

function InsufficientData() {
  return (
    <div style={{ ...CARD, textAlign: 'center', padding: '48px 28px' }}>
      <div style={{ width: 72, height: 72, borderRadius: 22, margin: '0 auto 18px', background: 'rgba(49,130,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Inbox size={34} color="var(--blue)" />
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--t0)', marginBottom: 8 }}>분석할 기출 데이터가 부족합니다</div>
    </div>
  );
}

// ── Explainable Analysis report (auto-generated under each chart) ──
// Every sentence uses numbers computed from gold-standard data — no hand-written text.
function AnalysisReport({ sections }) {
  const rows = [
    { label: '주요 수치', icon: '🔑', text: sections.key },
    { label: '장기 추세', icon: '📈', text: sections.longterm },
    { label: '최근 5년 변화', icon: '🕔', text: sections.recent5 },
    { label: '데이터 요약', icon: '🎯', text: sections.implication },
  ].filter(r => r.text);
  if (!rows.length) return null;
  return (
    <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg1)', borderRadius: 10, border: '1px dashed var(--bd1)' }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--blue)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5, letterSpacing: 0.2 }}>
        <Brain size={13} /> 설명 가능한 분석 (Explainable Analysis)
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 7, marginBottom: i < rows.length - 1 ? 6 : 0, fontSize: 12.5, lineHeight: 1.55 }}>
          <span style={{ flexShrink: 0 }}>{r.icon}</span>
          <span><b style={{ color: 'var(--t1)' }}>{r.label}</b> <span style={{ color: 'var(--t2)' }} dangerouslySetInnerHTML={{ __html: r.text }} /></span>
        </div>
      ))}
    </div>
  );
}

// ── Prediction evidence table: per-topic Bayesian / Markov / Trend / final ──
function ScoreBar({ value, color }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 64 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--bg1)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 10.5, color: 'var(--t2)', minWidth: 26, textAlign: 'right' }}>{(value ?? 0).toFixed(2)}</span>
    </div>
  );
}

function PredictionEvidenceTable({ rows }) {
  if (!rows.length) return null;
  return (
    <div style={{ marginTop: 14, overflowX: 'auto' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Brain size={14} color="#a855f7" /> 2026 예측 근거 상세 — 토픽별 점수 분해
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 560 }}>
        <thead>
          <tr style={{ color: 'var(--t3)', fontSize: 11, textAlign: 'left' }}>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>#</th>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>토픽</th>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Bayesian</th>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Markov</th>
            <th style={{ padding: '6px 8px', fontWeight: 600 }}>Trend</th>
            <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>최근/총</th>
            <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>예측 점수</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const prob = Math.round(p.probability_pct ?? 0);
            const dc = DOMAIN_COLORS[p.domain] || 'var(--t3)';
            return (
              <tr key={i} style={{ borderTop: '1px solid var(--bd0)' }}>
                <td style={{ padding: '7px 8px', color: 'var(--t3)' }}>{i + 1}</td>
                <td style={{ padding: '7px 8px' }}>
                  <span style={{ display: 'inline-block', width: 4, height: 12, borderRadius: 2, background: dc, marginRight: 6, verticalAlign: 'middle' }} />
                  <b style={{ color: 'var(--t0)' }}>{p.topic}</b>
                </td>
                <td style={{ padding: '7px 8px' }}><ScoreBar value={p.bayes_score} color="#10b981" /></td>
                <td style={{ padding: '7px 8px' }}><ScoreBar value={p.markov_score} color="#0ea5e9" /></td>
                <td style={{ padding: '7px 8px' }}><ScoreBar value={p.trend_score} color="#f59e0b" /></td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--t2)' }}>{p.recent_5yr_count ?? 0}/{p.total_24yr_count ?? 0}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 800, color: prob > 60 ? '#10b981' : prob > 40 ? '#f59e0b' : '#94a3b8' }}>{prob}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8, lineHeight: 1.5 }}>
        예측 점수 = Bayesian 30% + Markov 20% + Trend 20% + Momentum 15% + Recency 15%.
        Bayesian = 최신성 가중 Beta-Binomial 사후확률 · Markov = 2상태 전이확률(다년은 k-step) · Trend = 연도별 출제수 회귀 기울기.
      </div>
    </div>
  );
}

// ── [6] Chart Narrative — "수치가 의미하는 것" + "데이터 기반 포인트"
// Under every chart. Uses actual numbers, not speculation.
function ChartNarrative({ meaning, action }) {
  if (!meaning && !action) return null;
  return (
    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} className="cn-grid">
      {meaning && (
        <div style={{ padding: '11px 13px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#6366f1', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Eye size={13} /> 수치가 의미하는 것
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: meaning }} />
        </div>
      )}
      {action && (
        <div style={{ padding: '11px 13px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#10b981', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Zap size={13} /> 데이터 기반 포인트
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: action }} />
        </div>
      )}
    </div>
  );
}

// ── Data-classification badge (REAL / DERIVED / PREDICTED / UNKNOWN) ──
const BADGE_META = {
  REAL:      { c: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'REAL',      tip: '원본 데이터 직접 측정 (gold_standard 1,121문항 / prediction 모델 성분)' },
  DERIVED:   { c: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', label: 'DERIVED',   tip: '실측 데이터로 계산 (공식 표기)' },
  PREDICTED: { c: '#a855f7', bg: 'rgba(168,85,247,0.12)', label: 'PREDICTED', tip: '예측 모델 결과 (확률·청사진)' },
  UNKNOWN:   { c: '#94a3b8', bg: 'rgba(148,163,184,0.14)', label: 'UNKNOWN',  tip: '데이터 없음 — 생성하지 않음' },
};
function Badge({ kind, size = 9.5 }) {
  const m = BADGE_META[kind] || BADGE_META.UNKNOWN;
  return (
    <span title={m.tip} style={{ fontSize: size, fontWeight: 800, color: m.c, background: m.bg, border: `1px solid ${m.c}55`, padding: '1px 6px', borderRadius: 5, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

// ── [TASK C] ConfidenceBadge — evidence-based confidence with full data disclosure
function ConfidenceBadge({ confidence, totalCount, yearCount, dataYears, recent5, coverage }) {
  if (confidence == null && totalCount == null) return null;
  const evidencePct = coverage ?? (totalCount != null && yearCount != null ? Math.min(100, Math.round((yearCount / 24) * 100)) : null);
  const level = evidencePct != null && evidencePct >= 70 ? '높음' : evidencePct != null && evidencePct >= 40 ? '보통' : '낮음';
  const color = level === '높음' ? '#10b981' : level === '보통' ? '#f59e0b' : '#94a3b8';
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: `${color}12`, border: `1px solid ${color}33`, fontSize: 11, fontWeight: 700, color }}>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>데이터근거</span>
      <span style={{ fontSize: 13 }}>{level}</span>
      {totalCount != null && <span style={{ fontSize: 9.5, color: 'var(--t3)', fontWeight: 400, borderLeft: '1px solid var(--bd0)', paddingLeft: 6 }}>총 {totalCount}회</span>}
      {recent5 != null && <span style={{ fontSize: 9.5, color: 'var(--t3)', fontWeight: 400 }}>최근5년 {recent5}회</span>}
      {yearCount != null && <span style={{ fontSize: 9.5, color: 'var(--t3)', fontWeight: 400 }}>출제 {yearCount}개년</span>}
      {evidencePct != null && <span style={{ fontSize: 9.5, color: 'var(--t3)', fontWeight: 400 }}>커버리지 {evidencePct}%</span>}
      {dataYears != null && <span style={{ fontSize: 9.5, color: 'var(--t3)', fontWeight: 400 }}>데이터 {dataYears}년</span>}
    </div>
  );
}

// ── RISK narrative from REAL numbers only (no fabrication) ──
function riskNarrative(t) {
  const parts = [];
  if (t.risk_grade) parts.push(`Risk ${t.risk_score}(${t.risk_grade}등급)`);
  if (t.cycle_status) parts.push(`주기상태 ${t.cycle_status}`);
  if (t.gap_now > 0) parts.push(`현재공백 ${t.gap_now}년`);
  if (t.return_possible) parts.push('과거 장기공백 후 재출제 이력 있음');
  return parts.length ? parts.join(' · ') : '데이터 없음';
}

// ── [2] Topic network graph — dependency-free SVG circular layout ──
function TopicNetworkGraph({ nodes, edges }) {
  if (!nodes?.length) return null;
  const N = nodes.length, cx = 190, cy = 185, R = 135;
  const pos = {};
  nodes.forEach((n, i) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    pos[n.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const maxTotal = Math.max(...nodes.map(n => n.total || 1));
  return (
    <svg viewBox="0 0 380 370" style={{ width: '100%', maxWidth: 380, height: 370 }}>
      {edges.map((e, i) => {
        const s = pos[e.source], t = pos[e.target];
        if (!s || !t) return null;
        const v = Math.min(0.06, Math.max(0.008, (e.value || 1) / 100));
        return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="var(--bd1)" strokeWidth={v * 30} opacity={0.45} />;
      })}
      {nodes.map((n, i) => {
        const p = pos[n.id];
        if (!p) return null;
        const dc = DOMAIN_COLORS[n.domain] || 'var(--t3)';
        const r = 3 + 12 * (n.total / maxTotal);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={r} fill={dc} opacity={0.75} stroke="var(--bg2)" strokeWidth={1.5} />
            <text x={p.x} y={p.y + 2} textAnchor="middle" fill="var(--bg2)" fontSize={n.total > 15 ? 7 : 0} fontWeight={800}>{n.id.slice(0, 3)}</text>
            <text x={p.x} y={p.y + r + 10} textAnchor="middle" fill="var(--t2)" fontSize={6.5}>{n.id.length > 10 ? n.id.slice(0, 10) + '…' : n.id}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── [TASK F] Explainable AI Evidence Panel — shows real data on click ──
function ExplainableAIPanel({ topic, predDetail, confidence }) {
  const [open, setOpen] = useState(false);
  if (!topic && !predDetail) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 6, padding: '4px 10px', fontSize: 10.5, fontWeight: 700,
        color: '#6366f1', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4
      }}>
        <Brain size={11} /> {open ? '분석 근거 닫기' : '분석 근거 보기'}
      </button>
      {open && (
        <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--bg1)', borderRadius: 8, border: '1px dashed var(--bd1)', fontSize: 11, lineHeight: 1.6, color: 'var(--t2)' }}>
          {topic && <div><b>토픽:</b> {topic}</div>}
          {predDetail?.total_24yr_count != null && <div><b>총 출제 횟수:</b> {predDetail.total_24yr_count}회 (24년)</div>}
          {predDetail?.recent_5yr_count != null && <div><b>최근 5년 빈도:</b> {predDetail.recent_5yr_count}회</div>}
          {predDetail?.probability_pct != null && <div><b>예측 점수:</b> {Math.round(predDetail.probability_pct)}% (모델 점수, 실제 확률 아님)</div>}
          {predDetail?.confidence != null && <div><b>신뢰도:</b> {Math.round(predDetail.confidence * 100)}%</div>}
          {predDetail?.bayes_score != null && <div><b>Bayesian:</b> {predDetail.bayes_score.toFixed(2)} — 최신성 가중 출제 빈도</div>}
          {predDetail?.markov_score != null && <div><b>Markov:</b> {predDetail.markov_score.toFixed(2)} — 직전 출제→다음 전이확률</div>}
          {predDetail?.trend_score != null && <div><b>Trend:</b> {predDetail.trend_score.toFixed(2)} — 연도별 출제수 기울기 (로지스틱)</div>}
          {predDetail?.trend_slope != null && <div><b>기울기:</b> {predDetail.trend_slope.toFixed(3)}</div>}
          {predDetail?.last_appeared != null && <div><b>최종 출제:</b> {predDetail.last_appeared}년</div>}
          {predDetail?.gap_years != null && <div><b>출제 공백:</b> {predDetail.gap_years}년</div>}
          {predDetail?.basis && <div><b>basis:</b> {predDetail.basis}</div>}
          {confidence && <div><b>데이터 근거:</b> {confidence}</div>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function TrendDashboard({ exams = [] }) {
  const isMobile = useIsMobile();
  const datasets = useMemo(() => {
    const cache = getDatasetCache();
    return {
      trendComplete: cache?.trendComplete || null,
      prediction2026_2028: cache?.prediction2026_2028 || null,
      weakness: cache?.weakness || null,
      insights: cache?.insights || null,
      trendAnalysis: cache?.trendAnalysis || null,
      knowledgeGraph: cache?.knowledgeGraph || null,
      weakProfile: cache?.weakProfile || null,
    };
  }, []);

  // ── Stats from trend analysis ──
  const trend = datasets?.trendComplete;
  const pred = datasets?.prediction2026_2028;
  const ins = datasets?.insights;
  const math = PAST_EXAM_BANK?.math;

  const stats = {
    totalQuestions: trend?.total_questions_analyzed || 0,
    totalYears: trend?.total_years || 0,
    topicsTracked: trend?.total_topics_tracked || 0,
    growingCount: trend?.statistics?.growing_count || 0,
    decliningCount: trend?.statistics?.declining_count || 0,
    gapCount: trend?.statistics?.gap_count || 0,
    period: trend?.analysis_period || '',
  };

  // ── Domain-level processing ──
  const subjectList = useMemo(() => {
    const domainStats = {};
    let totalQ = 0;
    COMP_KEYS.forEach(key => {
      const d = trend?.domain_trends?.[key];
      const count = d?.total || 0;
      domainStats[key] = count;
      totalQ += count;
    });
    return COMP_KEYS
      .map(k => ({
        id: k, ...SUBJECT_MAP[k], count: domainStats[k] || 0,
        pct: totalQ ? Math.round(((domainStats[k] || 0) / totalQ) * 100) : 0
      }))
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [trend]);

  const econ = subjectList.find(s => s.id === 'economy');
  const pePct = (() => {
    const e = subjectList.find(s => s.id === 'economy')?.pct || 0;
    const p = subjectList.find(s => s.id === 'politics')?.pct || 0;
    return e + p;
  })();
  const econTrend = trend?.domain_trends?.economy || null;

  // ── Yearly data ──
  const byYearData = useMemo(() => {
    if (!trend?.domain_trends) return [];
    const allYears = new Set();
    COMP_KEYS.forEach(key => {
      const d = trend.domain_trends[key];
      if (d?.yearly) Object.keys(d.yearly).forEach(y => allYears.add(parseInt(y)));
    });
    return Array.from(allYears).sort().map(year => {
      const entry = { year: String(year), exams: 2, numQ: 0 };
      let total = 0;
      COMP_KEYS.forEach(key => {
        const count = trend.domain_trends?.[key]?.yearly?.[String(year)] || 0;
        entry[SUBJECT_MAP[key].name] = count;
        total += count;
      });
      entry.total = total;
      entry.numQ = total;
      return entry;
    });
  }, [trend]);

  // ── TOP100 topics ──
  const top100 = useMemo(() => {
    const trendTopics = (trend?.top_100_topics || []).map((t, i) => ({
      rank: i + 1, topic: t.topic, domain: t.domain || '',
      total: t.total || 0, years: t.years_appeared || 0,
    }));
    // Fallback: from insights_v2 topic_explain
    if (!trendTopics.length && ins?.topic_explain) {
      return ins.topic_explain.map((t, i) => ({
        rank: i + 1, topic: t.topic, domain: t.domain || '',
        total: t.total || 0, years: t.appearances || 0,
      }));
    }
    return trendTopics;
  }, [trend, ins]);

  const totalQ = stats.totalQuestions || top100.reduce((a, t) => a + (t.total || 0), 0);

  // ── Rising / Falling / Gap topics ──
  const rising = (trend?.growing_topics || []).slice(0, 20).map(t => ({
    topic: t.topic, domain: t.domain || '',
    growth: t.growth_rate_pct || 0, recent5: t.period_5yr_count || 0, total: t.total_count || 0,
  }));
  const falling = (trend?.declining_topics || []).slice(0, 20).map(t => ({
    topic: t.topic, domain: t.domain || '',
    growth: t.growth_rate_pct || 0, recent5: t.period_5yr_count || 0, total: t.total_count || 0,
  }));
  const gapTopics = (trend?.gap_topics || []).slice(0, 20).map(t => ({
    topic: t.topic, domain: t.domain || '',
    gapYears: t.gap_years || 0, lastYear: t.last_appeared_year, total: t.total_count || 0,
    priority: t.total_count >= 10 ? 'A' : t.total_count >= 5 ? 'B' : 'C',
  }));

  // ── Predictions ──
  const pred2026 = useMemo(() => {
    const source = pred?.yearly?.['2026'] || pred?.['2026']?.top_predictions || [];
    return source.slice(0, 30);
  }, [pred]);
  const pred2027 = useMemo(() => {
    const source = pred?.yearly?.['2027'] || pred?.['2027']?.top_predictions || [];
    return source.slice(0, 20);
  }, [pred]);
  const pred2028 = useMemo(() => {
    const source = pred?.yearly?.['2028'] || pred?.['2028']?.top_predictions || [];
    return source.slice(0, 20);
  }, [pred]);

  // ── Insights layer ──
  const topicExplain = safe(ins?.topic_explain);
  const cooc = ins?.cooccurrence || null;
  const coocPairs = safe(cooc?.top_pairs);
  const fmtTrend = ins?.format_trend || null;
  const fmtByYear = safe(fmtTrend?.by_year);
  const fmtSummary = fmtTrend?.summary || null;
  const predAddons = safe(ins?.predictive_addons);
  const actionPlan = safe(ins?.action_plan);
  const sTier = actionPlan.filter(a => a.tier === 'S');
  const aTier = actionPlan.filter(a => a.tier === 'A');
  const topicIntel = safe(ins?.topic_intelligence);
  const examSim = ins?.exam_simulation || null;
  const disc = ins?.disclosure || null;
  const cycleIntel = safe(ins?.cycle_intelligence);
  const explainPred = safe(ins?.explainable_prediction);
  const domainIntel = safe(ins?.domain_intelligence);
  const execSummary = ins?.executive_summary || null;
  const studyPlanner = ins?.study_planner || null;
  const fieldClasses = ins?.field_classes || null;
  const weaknessAnalysis = ins?.weakness_analysis || null;

  // ── SECTION 11: 출제경향 × 내 약점 (priorityScore) ──
  const allTopicNames = [...new Set([
    ...safe(top100).map(t => t.topic),
    ...safe(pred2026).map(p => p.topic),
  ])];
  const personalAccuracy = computePersonalAccuracy(exams, allTopicNames);
  const priorityTopics = computePriorityTopics(pred2026, personalAccuracy);
  const errorTypes = analyzeErrorTypes(exams);
  const weakConnectorTopics = datasets?.weakProfile?.topics || [];
  const knowledgeGraphData = datasets?.knowledgeGraph || null;
  const coocEdges = cooc?.edges || [];

  // ── Expand first priority topic for knowledge graph expansion ──
  const expandedTopics = priorityTopics[0]
    ? expandTopic(priorityTopics[0].topic, knowledgeGraphData, weakConnectorTopics, coocEdges, 6)
    : [];

  // ── Cooccurrence for first priority topic ──
  const coocForTopTopic = priorityTopics[0]
    ? findCooccurrenceTopics(priorityTopics[0].topic, coocEdges, 5)
    : [];

  // ── Get explainable prediction for first priority topic ──
  const explainForTopTopic = priorityTopics[0]
    ? explainPred.find(e => e.topic === priorityTopics[0].topic) || null
    : null;

  // ══════════════════════════════════════════════════════════════
  // Analysis Reports (data-only narratives, no speculation)
  // ══════════════════════════════════════════════════════════════

  const insights = [];
  if (top100[0]) insights.push({ icon: '📊', text: `최다 출제: <b>${top100[0].topic}</b> ${top100[0].total}회`, color: '#6366f1' });
  if (rising[0]) insights.push({ icon: '📈', text: `최근 상승: <b>${rising[0].topic}</b> +${rising[0].growth}%`, color: '#ef4444' });
  if (falling[0]) insights.push({ icon: '📉', text: `최근 하락: <b>${falling[0].topic}</b> ${falling[0].growth}%`, color: '#0ea5e9' });
  if (gapTopics[0]) insights.push({ icon: '⏰', text: `미출제: <b>${gapTopics[0].topic}</b> ${gapTopics[0].gapYears}년`, color: '#f59e0b' });
  if (pred2026[0]) insights.push({ icon: '🔮', text: `2026 예측: <b>${pred2026[0].topic}</b> (${Math.round(pred2026[0].probability_pct ?? 0)}%)`, color: '#a855f7' });

  const yrTotals = byYearData.map(d => d.total);
  const avgPerYear = yrTotals.length ? Math.round(yrTotals.reduce((a, b) => a + b, 0) / yrTotals.length) : 0;
  const first5avg = yrTotals.length >= 5 ? Math.round(yrTotals.slice(0, 5).reduce((a, b) => a + b, 0) / 5) : 0;
  const last5avg = yrTotals.length >= 5 ? Math.round(yrTotals.slice(-5).reduce((a, b) => a + b, 0) / 5) : 0;

  const top10share = top100.length
    ? Math.round((top100.slice(0, 10).reduce((a, t) => a + (t.total || 0), 0) / (totalQ || 1)) * 100)
    : 0;

  const domainReport = {
    key: econ
      ? `<b>${econ.name}</b> ${econ.count.toLocaleString()}문항(${econ.pct}%) · 정치·경제 합 ${pePct}% (${subjectList.slice(0, 2).reduce((s, a) => s + (a.count || 0), 0).toLocaleString()}문항).`
      : '',
    longterm: subjectList.length
      ? `${stats.period} 출제 비중 순위: ${subjectList.slice(0, 3).map(s => `${s.name}(${s.pct}%)`).join(' › ')}.`
      : '',
    recent5: econTrend
      ? `경제 영역 최근5년 ${econTrend.recent_5yr_total}문항 (이전 19년 대비 ${econTrend.growth_rate_pct}%).`
      : '',
    implication: econ
      ? `경제+정치: ${pePct}% · 경제 ${econ?.pct ?? 0}% · 정치 ${subjectList.find(s => s.id === 'politics')?.pct ?? 0}% · 지리 ${subjectList.find(s => s.id === 'geography')?.pct ?? 0}% · 역사 ${subjectList.find(s => s.id === 'history')?.pct ?? 0}% · 사회 ${subjectList.find(s => s.id === 'society')?.pct ?? 0}% (총 ${stats.totalQuestions?.toLocaleString() || 0}문항).`
      : '',
  };

  const yearReport = {
    key: byYearData.length
      ? `분석 ${byYearData.length}개년 · 연평균 <b>${avgPerYear}문항</b> (${stats.totalQuestions?.toLocaleString() || 0}문항 / ${stats.totalYears || byYearData.length}년).`
      : '',
    longterm: (first5avg && last5avg)
      ? `초기 5년(${byYearData[0]?.year}~) 평균 ${first5avg}문항 · 최근 5년(${byYearData[byYearData.length-5]?.year}~) 평균 ${last5avg}문항 (차이: ${last5avg - first5avg}문항).`
      : '',
    recent5: subjectList.length >= 2 && econTrend
      ? `경제: ${econ?.pct ?? 0}%(${econ?.count?.toLocaleString() || 0}문항) · 정치: ${subjectList[1]?.pct ?? 0}%(${subjectList[1]?.count?.toLocaleString() || 0}문항).`
      : '',
    implication: `분석 ${byYearData.length}개년 · 연평균 ${avgPerYear}문항 (${stats.totalQuestions?.toLocaleString() || 0}문항/${stats.totalYears || byYearData.length}년).`,
  };

  const topicReport = {
    key: top100[0]
      ? `최다 출제 토픽: <b>${top100[0].topic}</b> (${top100[0]?.total?.toLocaleString() || 0}회 · 24년). 추적 토픽: <b>${stats.topicsTracked}개</b>.`
      : '',
    longterm: top100.length
      ? `상위 10개 = 전체 출제 ${top10share}%(${top100.slice(0, 10).reduce((a, t) => a + (t.total || 0), 0).toLocaleString()}문항 / ${totalQ?.toLocaleString() || 0}문항).`
      : '',
    recent5: rising[0]
      ? `최근5년 증가율 최상위: <b>${rising[0].topic}</b>(+${rising[0].growth}%)${gapTopics[0] ? ` · <b>${gapTopics[0].topic}</b> ${gapTopics[0].gapYears}년째 미출제` : ''}.`
      : '',
    implication: `상위 10개 = ${top10share}%(${top100.slice(0, 10).reduce((a, t) => a + (t.total || 0), 0).toLocaleString()}문항 / ${totalQ?.toLocaleString() || 0}문항).`,
  };

  const top2026 = pred2026[0];
  const predReport = {
    key: top2026
      ? `2026 최고 예측 점수: <b>${top2026.topic}</b>(${Math.round(top2026.probability_pct ?? 0)}%) · 점수 = Bayesian(${top2026.bayes_score})·Markov(${top2026.markov_score})·Trend(${top2026.trend_score}) 가중합.`
      : '',
    longterm: top2026
      ? `<b>Bayesian</b>(${top2026.bayes_score}) = 최신성 가중 출제 빈도, <b>Markov</b>(${top2026.markov_score}) = 직전 출제 기반 전이확률, <b>Trend</b>(${top2026.trend_score}) = 연도별 출제수 증감 기울기.`
      : '',
    recent5: top2026
      ? `2027·2028 = 마르코프 <b>k-step 전이</b>(2025년 상태에서 k년 후 전이확률). 연간 예측 점수는 독립 산출.`
      : '',
    implication: `예측 점수: 60↑ ${pred2026.filter(p => (p.probability_pct ?? 0) >= 60).length}개 · 40~60 ${pred2026.filter(p => (p.probability_pct ?? 0) >= 40 && (p.probability_pct ?? 0) < 60).length}개 · 40↓ ${pred2026.filter(p => (p.probability_pct ?? 0) < 40).length}개. ⚠️ 예측은 과거 빈도 분석이며 실제 출제를 보장하지 않습니다.`,
  };

  // ══════════════════════════════════════════════════════════════
  // MOBILE RENDER
  // ══════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <MobileTrendDashboard
        data={{
          compStats: stats, execSummary, pePct,
          pred2026, pred2027, pred2028,
          top100, rising, falling, gapTopics,
          subjectList, topicIntel,
          studyPlanner, actionPlan, sTier, aTier,
          examSim, coocPairs, sankey: cooc?.sankey || null,
          priorityTopics, errorTypes, expandedTopics,
          coocForTopTopic, explainForTopTopic,
          explainPred, cycleIntel, coocEdges, weakConnectorTopics, knowledgeGraphData, personalAccuracy,
        }}
      />
    );
  }

  // ══════════════════════════════════════════════════════════════
  // DESKTOP RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 4px' }}>
      <style>{`
        .td-card { background: var(--bg2); border: 1px solid var(--bd0); border-radius: 14px; padding: 16px; margin-bottom: 14px; }
        .td-card-title { font-size: 15px; font-weight: 800; color: var(--t0); margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
        .td-topic-row { display: flex; align-items: center; gap: 10px; padding: 6px 10px; background: var(--bg3); border-radius: 8px; margin-bottom: 4px; font-size: 13px; }
        .td-rank { width: 24px; color: var(--t3); font-weight: 700; text-align: center; }
        .td-domain-dot { width: 4px; height: 24px; border-radius: 2px; flex-shrink: 0; }
        .td-topic-name { flex: 1; font-weight: 600; color: var(--t0); }
        .td-topic-stat { font-size: 11; color: var(--t2); min-width: 40px; text-align: right; }
        .td-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .td-insight-chip { padding: 10px 14px; border-radius: 10px; background: var(--bg2); border: 1px solid var(--bd0); font-size: 13px; line-height: 1.5; flex: 1 1 200px; min-width: 160px; }
        @media (max-width: 700px) { .td-grid-2 { grid-template-columns: 1fr; } .cn-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div style={{ ...CARD, padding: 22, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--t0)', display: 'flex', alignItems: 'center', gap: 9 }}>
              <BarChart3 size={22} /> EJU 출제경향 인텔리전스
            </div>
            <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 4 }}>
              {stats.period} · {stats.totalQuestions.toLocaleString()}문항 분석 · {stats.topicsTracked}개 토픽
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <StatTile label="표준 토픽" value={top100.length} color="#a855f7" subtitle="추적 토픽" />
            <StatTile label="2026 예측" value={pred2026.length} color="#10b981" subtitle="토픽" />
            <StatTile label="미출제" value={gapTopics.length} color="#ef4444" subtitle="복귀 예상" />
          </div>
        </div>
      </div>

      {/* ═══ EXECUTIVE SUMMARY ═══ */}
      {execSummary?.lines?.length > 0 && (
        <div style={{ ...CARD, padding: 16, marginBottom: 16, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={15} /> 수치 요약 (Executive Summary) <Badge kind="DERIVED" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {execSummary.lines.map((ln, i) => {
              const colors = ['#10b981', '#f59e0b', '#0ea5e9'];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: 'var(--t0)', fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: colors[i] || '#94a3b8', flexShrink: 0 }} />
                  {ln}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 8 }}>근거: {execSummary.basis}</div>
        </div>
      )}

      {/* ═══ CONFIDENCE DISCLOSURE ═══ */}
      {disc && (
        <div style={{ ...CARD, padding: 16, marginBottom: 16, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.25)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#6366f1', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Gauge size={15} /> 분석 신뢰도 고지 (Confidence Disclosure)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['데이터 범위', disc.data_range, '#10b981'],
              ['분석 회차', `${disc.sessions}회 · ${disc.gold_questions?.toLocaleString()}문항`, '#10b981'],
              ['예측 정확도 (백테스트 F1)', (disc.backtest_f1_pct ?? null) != null ? `F1 ${disc.backtest?.f1} (${disc.backtest_f1_pct}%)` : '데이터 없음', '#a855f7'],
              ['검증 방식', disc.backtest?.test_years ? `LFO ${disc.backtest.test_years} · ${disc.backtest.folds}-fold` : '데이터 없음', '#a855f7'],
              ['OCR 원문 보유', disc.ocr_text_range, '#f59e0b'],
              ['2016~2025 원문', '없음 (토픽 라벨만)', '#ef4444'],
            ].map(([k, v, c], i) => (
              <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 9, padding: '8px 12px', minWidth: 120 }}>
                <div style={{ fontSize: 10.5, color: 'var(--t3)', fontWeight: 600, marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: c }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 9, lineHeight: 1.5 }}>
            {disc.backtest?.precision != null && <>정밀도 {disc.backtest.precision} · 재현율 {disc.backtest.recall} · <b style={{ color: '#a855f7' }}>F1 {disc.backtest.f1}</b> (leave-future-out, 데이터 누수 없음). </>}
            {disc.metric_note || 'F1은 "정확도" 지표이며 "신뢰도"·"확률"과 구분합니다.'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6, lineHeight: 1.5 }}>{disc.no_fabrication_policy}</div>
          {fieldClasses && (
            <div style={{ marginTop: 12, paddingTop: 11, borderTop: '1px solid var(--bd0)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--t1)', marginBottom: 7 }}>데이터 분류 (Data Coverage)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['REAL', 'DERIVED', 'PREDICTED', 'UNKNOWN'].map(k => (
                  <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, color: 'var(--t2)', lineHeight: 1.5 }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}><Badge kind={k} /></span>
                    <span>{(fieldClasses[k] || []).join(' · ') || '데이터 없음'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ INSIGHTS CHIPS ═══ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {insights.map((ins, i) => (
          <div key={i} className="td-insight-chip">
            <span>{ins.icon} </span>
            <span dangerouslySetInnerHTML={{ __html: ins.text }} style={{ color: 'var(--t1)' }} />
          </div>
        ))}
      </div>

      {/* ═══ SECTION 6: DOMAIN PROPORTION + SECTION 5: YEAR-BY-YEAR ═══ */}
      <div className="td-grid-2">
        {/* 6. 영역별 비중 */}
        <div className="td-card">
          <div className="td-card-title"><Target size={16} /> 영역별 비중 (24년 누적)</div>
          {subjectList.length > 0 && (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={subjectList} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40}>
                  {subjectList.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <ChartNarrative
            meaning={`영역별 비중: ${subjectList.map(s => `${s.name} ${s.pct}%`).join(' · ')}. 경제·정치 합산 ${pePct}%.`}
            action={`${subjectList[0]?.name || '경제'}·정치 합산 ${pePct}% · 사회 ${subjectList.find(s => s.id === 'society')?.pct ?? 0}%.`}
          />
        </div>

        {/* Domain detail */}
        <div className="td-card">
          <div className="td-card-title"><Target size={16} /> 과목별 상세</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subjectList.map(s => (
              <div key={s.id} className="td-topic-row">
                <div style={{ width: 6, height: 28, borderRadius: 3, background: s.color }} />
                <div className="td-topic-name">{s.name}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: s.color, minWidth: 50, textAlign: 'right' }}>{s.count.toLocaleString()}문항</div>
                <div style={{ width: 50, textAlign: 'right', fontSize: 11, color: 'var(--t2)' }}>{s.pct}%</div>
                <TrendArrow dir={s.growth > 10 ? 'up' : s.growth < -10 ? 'down' : 'flat'} />
              </div>
            ))}
          </div>
          <AnalysisReport sections={domainReport} />
        </div>

        {/* 5. 연도별 출제 변화 */}
        <div className="td-card" style={{ gridColumn: '1 / -1' }}>
          <div className="td-card-title"><CalendarDays size={16} /> 연도별 영역별 출제 추이 ({stats.period})</div>
          {byYearData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byYearData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd1)" />
                <XAxis dataKey="year" tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {COMP_KEYS.map(key => (
                  <Bar key={key} dataKey={SUBJECT_MAP[key].name} stackId="a" fill={DOMAIN_COLORS[key]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
          <ChartNarrative
            meaning={`연간 출제량 평균 ${avgPerYear}문항 · 초기 5년 평균 ${first5avg}문항 → 최근 5년 평균 ${last5avg}문항(${last5avg - first5avg >= 0 ? '+' : ''}${last5avg - first5avg}문항).`}
            action={`경제 ${econ?.pct ?? 0}% · 정치 ${subjectList.find(s => s.id === 'politics')?.pct ?? 0}% · 지리 ${subjectList.find(s => s.id === 'geography')?.pct ?? 0}% · 역사 ${subjectList.find(s => s.id === 'history')?.pct ?? 0}% · 사회 ${subjectList.find(s => s.id === 'society')?.pct ?? 0}%.`}
          />
          <AnalysisReport sections={yearReport} />
        </div>
      </div>

      {/* ═══ SECTION 1: TOP 100 + SECTION 2,3: RISING/FALLING ═══ */}
      <div className="td-grid-2">
        {/* 1. 전체 출제 토픽 (빈도순) */}
        <div className="td-card">
          <div className="td-card-title"><FileText size={16} /> 전체 {top100.length}개 출제 토픽 (빈도순)</div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {top100.slice(0, 50).map((t, i) => {
              const domain = t.domain || '';
              const color = DOMAIN_COLORS[domain] || 'var(--t3)';
              return (
                <div key={i} className="td-topic-row">
                  <div className="td-rank">{i + 1}</div>
                  <div className="td-domain-dot" style={{ background: color }} />
                  <div className="td-topic-name">{t.topic}</div>
                  <div className="td-topic-stat">{t.total?.toLocaleString() || 0}회</div>
                </div>
              );
            })}
          </div>
          <ChartNarrative
            meaning={`상위 10개 = 전체 출제 ${top10share}%(${top100.slice(0, 10).reduce((a, t) => a + (t.total || 0), 0).toLocaleString()}문항 / ${totalQ?.toLocaleString() || 0}문항).`}
            action={`상위 10개: ${top100.slice(0, 10).reduce((a, t) => a + (t.total || 0), 0).toLocaleString()}회/${totalQ?.toLocaleString() || 0}회(${top10share}%).`}
          />
          <AnalysisReport sections={topicReport} />
        </div>

        {/* 2+3+4: RISING / FALLING / GAP */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rising.length > 0 && (
            <div className="td-card">
              <div className="td-card-title"><TrendingUp size={16} color="#ef4444" /> 최근 상승 토픽 <Badge kind="DERIVED" size={8.5} /></div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {rising.slice(0, 10).map((t, i) => (
                  <div key={i} className="td-topic-row">
                    <div className="td-rank">{i + 1}</div>
                    <div className="td-domain-dot" style={{ background: DOMAIN_COLORS[t.domain] || '#94a3b8' }} />
                    <div className="td-topic-name">{t.topic}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', minWidth: 48, textAlign: 'right' }}>+{t.growth}%</div>
                    <div className="td-topic-stat">{t.recent5}회</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {falling.length > 0 && (
            <div className="td-card">
              <div className="td-card-title"><TrendingDown size={16} color="#0ea5e9" /> 최근 하락 토픽 <Badge kind="DERIVED" size={8.5} /></div>
              <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                {falling.slice(0, 8).map((t, i) => (
                  <div key={i} className="td-topic-row">
                    <div className="td-rank">{i + 1}</div>
                    <div className="td-domain-dot" style={{ background: DOMAIN_COLORS[t.domain] || '#94a3b8' }} />
                    <div className="td-topic-name">{t.topic}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0ea5e9', minWidth: 48, textAlign: 'right' }}>{t.growth}%</div>
                    <div className="td-topic-stat">{t.recent5}회</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {gapTopics.length > 0 && (
            <div className="td-card">
              <div className="td-card-title"><AlertTriangle size={16} color="#f59e0b" /> 장기 미출제 토픽 <Badge kind="REAL" size={8.5} /></div>
              <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                {gapTopics.slice(0, 8).map((t, i) => (
                  <div key={i} className="td-topic-row">
                    <div className="td-rank">{i + 1}</div>
                    <div className="td-domain-dot" style={{ background: DOMAIN_COLORS[t.domain] || '#94a3b8' }} />
                    <div className="td-topic-name">{t.topic}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', minWidth: 60, textAlign: 'right' }}>{t.gapYears}년</div>
                    <div className="td-topic-stat">{t.lastYear}</div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: 'var(--bg2)', color: t.priority === 'A' ? '#ef4444' : t.priority === 'B' ? '#f59e0b' : '#94a3b8' }}>{t.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ SECTION 8: PREDICTION ═══ */}
      <div className="td-card">
        <div className="td-card-title"><Sparkles size={16} color="#a855f7" /> 2026~2028 예측 (Prediction) <Badge kind="PREDICTED" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[['2026', pred2026], ['2027', pred2027], ['2028', pred2028]].map(([year, list]) => (
            <div key={year}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#a855f7', marginBottom: 8 }}>{year} TOP 10</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {list.slice(0, 10).map((p, i) => {
                  const prob = Math.round(p.probability_pct ?? p.prediction_probability_pct ?? p.combined_score ?? 0);
                  const c = DOMAIN_COLORS[p.domain] || '#94a3b8';
                  const pc = prob > 60 ? '#10b981' : prob > 40 ? '#f59e0b' : '#94a3b8';
                  return (
                    <div key={i} className="td-topic-row" style={{ padding: '5px 8px' }}>
                      <span className="td-rank" style={{ width: 18, fontSize: 10 }}>{i + 1}</span>
                      <span className="td-domain-dot" style={{ background: c }} />
                      <span className="td-topic-name" style={{ fontSize: 12 }}>{p.topic}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: pc, minWidth: 36, textAlign: 'right' }}>{prob}%</span>
                      <span style={{ fontSize: 10, color: 'var(--t2)', minWidth: 30, textAlign: 'right' }}>{p.total_24yr_count || p.total_historical || p.total_count || 0}회</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Prediction evidence table */}
        <PredictionEvidenceTable rows={pred2026.slice(0, 15)} />

        <ChartNarrative
          meaning={`예측 점수 = 4개 독립 신호(베이지안 빈도·마르코프 전이·추세 기울기·최신성)의 합의값. ⚠️ 이 값은 모델 점수이며 실제 확률이 아닙니다.`}
          action={`예측 점수 60↑ ${pred2026.filter(p => (p.probability_pct ?? 0) >= 60).length}개 · 40~60 ${pred2026.filter(p => (p.probability_pct ?? 0) >= 40 && (p.probability_pct ?? 0) < 60).length}개. ⚠️ 예측은 보장이 아닙니다.`}
        />
        <AnalysisReport sections={predReport} />
      </div>

      {/* ═══ SECTION 1: TOPIC INTELLIGENCE ═══ */}
      {topicIntel.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Brain size={16} color="#6366f1" /> 토픽 인텔리전스 (Topic Intelligence)</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
            35개 표준 토픽별 페이지. 지표·예측점수(probability_pct)·데이터근거(confidence) + 출제근거/형태/학습 자동 생성. 모든 수치는 gold_standard(1,121문항)·OCR(2002-2015)에서 산출.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 620, overflowY: 'auto' }}>
            {topicIntel.map((t, i) => {
              const c = DOMAIN_COLORS[t.domain] || 'var(--t3)';
              const tc2 = t.tier === 'S' ? '#ef4444' : t.tier === 'A' ? '#f59e0b' : t.tier === 'B' ? '#0ea5e9' : '#94a3b8';
              const confColor = t.confidence?.tier === '높음' ? '#10b981' : t.confidence?.tier === '보통' ? '#f59e0b' : '#94a3b8';
              return (
                <div key={i} style={{ padding: '12px 14px', background: 'var(--bg1)', borderRadius: 10, border: '1px solid var(--bd0)', borderLeft: `3px solid ${c}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 700 }}>#{t.rank}</span>
                    <b style={{ fontSize: 14, color: 'var(--t0)' }}>{t.topic}</b>
                    <span style={{ fontSize: 10.5, color: c, fontWeight: 700, background: 'var(--bg2)', padding: '1px 7px', borderRadius: 6 }}>{t.domain_ko}</span>
                    {t.tier && <span style={{ fontSize: 10.5, fontWeight: 800, color: tc2, background: 'var(--bg2)', padding: '1px 7px', borderRadius: 6 }}>학습 {t.tier}등급</span>}
                    {t.risk_grade && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 7px', borderRadius: 6 }}>Risk {t.risk_grade} ({t.risk_score})</span>}
                    {t.probability_pct != null && <span style={{ fontSize: 11, fontWeight: 800, color: '#a855f7' }}>2026 {t.probability_pct}% <Badge kind="PREDICTED" size={8.5} /></span>}
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: confColor }} title={`근거 ${t.confidence?.evidence_count}회 / ${t.confidence?.years_appeared}개 연도`}>
                      데이터근거 {t.confidence?.tier} ({t.confidence?.evidence_pct}%)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 9 }}>
                    {[
                      ['총 출제', `${t.total}회`, 'REAL'],
                      ['최근5년', `${t.recent5}회`, 'REAL'],
                      ['최근10년', `${t.recent10}회`, 'REAL'],
                      ['최초', `${t.first_year}`, 'REAL'],
                      ['최근', `${t.last_year}`, 'REAL'],
                      ['평균 간격', t.avg_period != null ? `${t.avg_period}년` : '데이터 없음', 'DERIVED'],
                      ['출제 공백', t.gap_now > 0 ? `${t.gap_now}년` : '없음(연속)', 'REAL'],
                      ['예측점수', t.probability_pct != null ? `${t.probability_pct}%` : '데이터 없음', 'PREDICTED'],
                      ['Risk', t.risk_score != null ? `${t.risk_score} (${t.risk_grade})` : '데이터 없음', 'DERIVED'],
                      ['시간당 기대효과', t.expected_value != null ? `${t.expected_value}` : '데이터 없음', 'DERIVED'],
                    ].map(([k, v, kind], j) => (
                      <span key={j} title={BADGE_META[kind]?.tip} style={{ fontSize: 11, color: 'var(--t2)', background: 'var(--bg2)', padding: '3px 8px', borderRadius: 6, borderLeft: `2px solid ${BADGE_META[kind]?.c}` }}>
                        <span style={{ color: 'var(--t3)' }}>{k}</span> <b style={{ color: 'var(--t1)' }}>{v}</b>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.55 }}><b style={{ color: '#6366f1' }}>WHAT</b> {t.story}</div>
                    <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.55 }}><b style={{ color: '#ef4444' }}>WHY 출제 근거</b> {t.why_important} <Badge kind="DERIVED" size={8.5} /></div>
                    <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.55 }}><b style={{ color: '#0ea5e9' }}>TREND 최근 변화</b> {t.recent_change || '데이터 없음'} <Badge kind="REAL" size={8.5} /></div>
                    <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.55 }}><b style={{ color: '#f59e0b' }}>RISK 놓치면</b> {riskNarrative(t)}</div>
                    <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.55 }}><b style={{ color: '#10b981' }}>ACTION 무엇을 공부</b> {t.what_to_study} <span style={{ color: 'var(--t3)' }}>· 형태: {t.how_asked}</span></div>
                  </div>
                  {/* [Task F] Explainable AI evidence panel for each topic */}
                  <ExplainableAIPanel
                    topic={t.topic}
                    predDetail={pred2026.find(p => p.topic === t.topic) || null}
                    confidence={t.confidence ? `${t.confidence.tier} (evidence ${t.confidence.evidence_pct}%)` : null}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ SECTION 5: DOMAIN INTELLIGENCE ═══ */}
      {domainIntel.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Layers size={16} color="#0ea5e9" /> 영역 인텔리전스 (Domain Intelligence)</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
            영역별 비중·추세 = 24년 실측(trend_analysis), 예상 비중 = 예측 청사진(Exam Blueprint), 난이도·배분시간 = 파생값.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 560 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr 1fr 1fr 1fr', gap: 6, fontSize: 10.5, color: 'var(--t3)', fontWeight: 700, padding: '4px 8px' }}>
                <span>영역</span>
                <span>비중 <Badge kind="REAL" size={8} /></span>
                <span>최근추세 <Badge kind="DERIVED" size={8} /></span>
                <span>예상비중 <Badge kind="PREDICTED" size={8} /></span>
                <span>평균난이도 <Badge kind="DERIVED" size={8} /></span>
                <span>배분시간 <Badge kind="DERIVED" size={8} /></span>
              </div>
              {domainIntel.map((d, i) => {
                const dc = DOMAIN_COLORS[d.domain] || 'var(--t3)';
                const gUp = (d.growth5_pct ?? 0) > 0;
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr 1fr 1fr 1fr', gap: 6, fontSize: 12, alignItems: 'center', padding: '7px 8px', background: 'var(--bg1)', borderRadius: 8, marginBottom: 4, borderLeft: `3px solid ${dc}` }}>
                    <span style={{ fontWeight: 700, color: 'var(--t0)' }}>{d.domain_ko} <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>{d.total}문항</span></span>
                    <b style={{ color: dc }}>{d.share_pct != null ? `${d.share_pct}%` : '–'}</b>
                    <span style={{ color: d.trend === '상승' ? '#10b981' : d.trend === '하락' ? '#ef4444' : 'var(--t2)', fontWeight: 600 }}>
                      {d.trend}{d.growth5_pct != null ? ` (${gUp ? '+' : ''}${d.growth5_pct}%)` : ''}
                    </span>
                    <span style={{ color: '#a855f7', fontWeight: 700 }}>{d.expected_share_pct != null ? `${d.expected_share_pct}%` : '–'}</span>
                    <span style={{ color: 'var(--t1)' }} title={d.difficulty_basis}>{d.avg_difficulty != null ? `${d.avg_difficulty}/4` : '데이터 없음'}</span>
                    <span style={{ color: 'var(--t1)' }}>{d.recommend_hours != null ? `${d.recommend_hours}h` : '–'}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <ChartNarrative
            meaning={`출제 비중: ${domainIntel.map(d => `${d.domain_ko} ${d.share_pct}%`).join(' · ')}. '최근추세' = 직전5년 대비 최근5년 동일 구간 비교(파생). '예상비중' = 2026 청사진 기준 예측값.`}
            action={`배분시간 = 예상 비중 비례 100시간 배분(DERIVED).`}
          />
        </div>
      )}

      {/* ═══ SECTION 8: EXPLAINABLE PREDICTION ═══ */}
      {explainPred.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Brain size={16} color="#a855f7" /> 예측 분해 (Explainable Prediction)</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
            각 토픽 최종 예측 점수를 구성한 5개 독립 신호 점수. 전부 <b>prediction 모델 실측 출력</b>(0~100). 여러 신호가 동시에 높을수록 합의가 강합니다. <Badge kind="REAL" size={8.5} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
            {explainPred.slice(0, 15).map((p, i) => {
              const sigs = [
                ['베이지안', p.bayesian, '#6366f1'],
                ['마르코프', p.markov, '#0ea5e9'],
                ['추세', p.trend, '#10b981'],
                ['모멘텀', p.momentum, '#f59e0b'],
                ['최신성', p.recency, '#ef4444'],
              ];
              return (
                <div key={i} style={{ padding: '9px 12px', background: 'var(--bg1)', borderRadius: 9, border: '1px solid var(--bd0)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 700 }}>#{i + 1}</span>
                    <b style={{ fontSize: 13, color: 'var(--t0)', flex: 1 }}>{p.topic}</b>
                    <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>최종</span>
                    <b style={{ fontSize: 14, color: '#a855f7' }}>{p.final_pct}%</b>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {sigs.map(([nm, val, col], j) => (
                      <div key={j} style={{ flex: '1 1 90px', minWidth: 84 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)', marginBottom: 2 }}>
                          <span>{nm}</span><b style={{ color: col }}>{val != null ? val : '–'}</b>
                        </div>
                        <div style={{ height: 5, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${val ?? 0}%`, height: '100%', background: col, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* [Task F] Explainable AI evidence for each prediction */}
                  {(() => {
                    const pd = pred2026.find(x => x.topic === p.topic);
                    if (!pd) return null;
                    return <ExplainableAIPanel topic={pd.topic} predDetail={pd} />;
                  })()}
                </div>
              );
            })}
          </div>
          <ChartNarrative
            meaning={`최종 예측 점수 = 5개 신호 합성. <b>${explainPred[0]?.topic}</b>: 베이지안 ${explainPred[0]?.bayesian}·마르코프 ${explainPred[0]?.markov}·최신성 ${explainPred[0]?.recency} → 최종 ${explainPred[0]?.final_pct}%. 5개 신호 모두 공개: 각 신호가 최종 점수에 기여한 정도를 직접 비교하세요.`}
            action={`각 토픽의 5개 신호 점수 분포를 확인하세요. 다수 신호가 동시에 높을수록 합의가 강합니다.`}
          />
        </div>
      )}

      {/* ═══ SECTION 9: STUDY PLANNER ═══ */}
      {studyPlanner && (
        <div className="td-card">
          <div className="td-card-title"><ListChecks size={16} color="#10b981" /> 학습 플래너 (Study Planner) <Badge kind="DERIVED" /></div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>{studyPlanner.basis}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            {[['오늘', studyPlanner.today, '#ef4444'], ['이번주', studyPlanner.week, '#f59e0b'], ['이번달', studyPlanner.month, '#10b981']].map(([title, list, col], i) => (
              <div key={i} style={{ background: 'var(--bg1)', borderRadius: 9, border: '1px solid var(--bd0)', padding: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: col, marginBottom: 7 }}>{title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(list || []).map((a, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: col, background: 'var(--bg2)', padding: '1px 5px', borderRadius: 4 }}>{a.tier}</span>
                      <span style={{ flex: 1, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.topic}</span>
                      <b style={{ color: 'var(--t2)' }}>{a.hours}h</b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SECTION 10: ACTION PLAN ═══ */}
      {actionPlan.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><ListChecks size={16} color="#f59e0b" /> 액션 플랜 (Action Plan) <Badge kind="DERIVED" /></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ color: 'var(--t3)', fontSize: 10.5, textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>#</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>등급</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>토픽</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>영역</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>출제</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>예측</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>기여도</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>학습시간</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>조언</th>
                </tr>
              </thead>
              <tbody>
                {actionPlan.slice(0, 20).map((a, i) => {
                  const tc = a.tier === 'S' ? '#ef4444' : a.tier === 'A' ? '#f59e0b' : a.tier === 'B' ? '#0ea5e9' : '#94a3b8';
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--bd0)' }}>
                      <td style={{ padding: '6px 8px', color: 'var(--t3)' }}>{a.priority}</td>
                      <td style={{ padding: '6px 8px' }}><span style={{ fontWeight: 800, color: tc, background: 'var(--bg2)', padding: '1px 6px', borderRadius: 4 }}>{a.tier}</span></td>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--t0)' }}>{a.topic}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--t2)' }}>{a.domain_ko || '–'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--t2)' }}>{a.total || 0}회</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: (a.prediction_pct || 0) > 60 ? '#10b981' : 'var(--t2)' }}>{a.prediction_pct != null ? `${a.prediction_pct}%` : '–'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--t2)' }}>{a.score_contribution_pct != null ? `${a.score_contribution_pct}%` : '–'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--t2)' }}>{a.study_hours != null ? `${a.study_hours}h` : '–'}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--t3)', fontSize: 10.5 }}>{a.advice || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ CO-OCCURRENCE NETWORK ═══ */}
      {coocPairs.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Network size={16} color="#6366f1" /> 토픽 동시 출제 네트워크 (Topic Relationship Graph)</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
            같은 회차 시험에 함께 등장한 비율(Jaccard)로 토픽 간 연관도 계산.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Graph */}
            <TopicNetworkGraph
              nodes={cooc?.graph_nodes || []}
              edges={cooc?.graph_edges || []}
            />
            {/* Top pairs list */}
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>상위 동시 출제율 TOP 30</div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {coocPairs.map((p, i) => (
                  <div key={i} className="td-topic-row" style={{ padding: '4px 8px' }}>
                    <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, width: 22 }}>{i + 1}</span>
                    <span className="td-topic-name" style={{ fontSize: 11 }}>{p.a}</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>↔</span>
                    <span className="td-topic-name" style={{ fontSize: 11 }}>{p.b}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: p.rate_pct > 50 ? '#ef4444' : p.rate_pct > 30 ? '#f59e0b' : '#0ea5e9', minWidth: 36, textAlign: 'right' }}>{p.rate_pct}%</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)', minWidth: 24, textAlign: 'right' }}>{p.co}회</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ChartNarrative
            meaning={`동시출제율 ${coocPairs[0]?.rate_pct}%: <b>${coocPairs[0]?.a} ↔ ${coocPairs[0]?.b}</b> (${coocPairs[0]?.co}회 동시출제 / ${coocPairs[0]?.a_sessions}+${coocPairs[0]?.b_sessions}회 출제).`}
            action={`연결선 굵기 = 동시출제 빈도(Jaccard 계수).`}
          />
        </div>
      )}

      {/* ═══ FORMAT TREND ═══ */}
      {fmtByYear?.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Image size={16} color="#06b6d4" /> 문항 형식 변화 추이 ({fmtSummary?.coverage || '2002-2015'})</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>{fmtSummary?.method}</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={fmtByYear}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bd1)" />
              <XAxis dataKey="year" tick={{ fill: 'var(--t2)', fontSize: 9 }} />
              <YAxis tick={{ fill: 'var(--t2)', fontSize: 9 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="visual_pct" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} name="시각형(%)" />
              <Area type="monotone" dataKey="memory_pct" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} name="암기형(%)" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
            초기(2002-05) 시각형 평균 {fmtSummary?.early_visual_pct}% → 후기(2011-15) {fmtSummary?.late_visual_pct}%.
            {fmtSummary?.caveat && <> ⚠️ {fmtSummary.caveat}</>}
          </div>
        </div>
      )}

      {/* ═══ SECTION 11: PRIORITY TOPICS (출제경향 × 내 약점) ═══ */}
      {priorityTopics.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Target size={16} color="#ef4444" /> SECTION 11: 출제경향 × 내 약점 (Priority Score)</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10, lineHeight: 1.5 }}>
            priorityScore = predictionProbability × (1 - personalAccuracy). 예측 점수가 높은데 내 정답률이 낮은 토픽을 우선순위화. 오답 데이터 <b>{errorTypes.total}건</b> 기반 <Badge kind="DERIVED" size={8} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {priorityTopics.slice(0, 10).map((p, i) => {
              const pc = p.priorityScore >= 60 ? '#ef4444' : p.priorityScore >= 40 ? '#f59e0b' : '#0ea5e9';
              return (
                <div key={i} className="td-topic-row">
                  <span className="td-rank">{i + 1}</span>
                  <span className="td-domain-dot" style={{ background: DOMAIN_COLORS[p.domain] || '#94a3b8' }} />
                  <span className="td-topic-name">{p.topic}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: pc, minWidth: 56, textAlign: 'right' }}>
                    우선도 {p.priorityScore}%
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--t2)', minWidth: 44, textAlign: 'right' }}>
                    예측 {Math.round(p.predictionProbability)}%
                  </span>
                  <span style={{ fontSize: 10.5, color: p.hasAccuracy && p.personalAccuracy < 40 ? '#ef4444' : 'var(--t2)', minWidth: 44, textAlign: 'right' }}>
                    {p.hasAccuracy ? `${p.personalAccuracy}%` : '—'}
                  </span>
                  {/* [Task F] Explainable AI panel for priority topics */}
                  <ExplainableAIPanel
                    topic={p.topic}
                    predDetail={pred2026.find(x => x.topic === p.topic) || null}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--t3)', lineHeight: 1.5 }}>
            * 내 정답률 = 사용자 오답 데이터({errorTypes.total}건) 기반 추정치. 데이터가 없는 토픽은 예측 점수 기준 정렬.
          </div>
        </div>
      )}

      {/* ═══ SECTION 12: 오답노트 확장 추천 (3단계 구조) ═══ */}
      {priorityTopics[0] && (() => {
        const mainTopic = priorityTopics[0].topic;
        const kgTopics = expandedTopics.filter(r => r.sources?.includes('knowledgeGraph'));
        const coocTopics = expandedTopics.filter(r => r.sources?.includes('cooccurrence'));
        const wcTopics = expandedTopics.filter(r => r.sources?.includes('weaknessConnector'));
        const preReqs = getPrerequisiteConcepts(mainTopic, weakConnectorTopics);
        const hasAny = preReqs.length > 0 || wcTopics.length > 0 || kgTopics.length > 0 || coocTopics.length > 0;
        if (!hasAny && expandedTopics.length === 0) return null;
        const typeStyle = (label, color) => ({
          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800,
          color, background: `${color}15`, border: `1px solid ${color}30`, display: 'inline-flex', alignItems: 'center', gap: 3
        });
        return (
          <div className="td-card">
            <div className="td-card-title"><GitBranch size={16} color="#0ea5e9" /> 오답노트 확장 추천 — {mainTopic}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* LEVEL 1: 선수 개념 */}
              {(preReqs.length > 0 || wcTopics.length > 0) && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ ...typeStyle('Lv.1', '#8b5cf6') }}>Lv.1</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)' }}>선수 개념 (Prerequisite)</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>weakness connector</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {preReqs.map((concept, i) => (
                      <div key={i} className="td-topic-row" style={{ padding: '5px 10px' }}>
                        <span className="td-topic-name" style={{ fontSize: 12 }}>{concept}</span>
                        <span style={{ fontSize: 10, color: '#8b5cf6' }}>선수지식</span>
                      </div>
                    ))}
                    {wcTopics.map((r, i) => (
                      <div key={`wc-${i}`} className="td-topic-row" style={{ padding: '5px 10px' }}>
                        <span className="td-topic-name" style={{ fontSize: 12 }}>{r.topic}</span>
                        <span style={{ fontSize: 10, color: '#8b5cf6' }}>연관 개념</span>
                        <span style={{ fontSize: 10, color: 'var(--t3)' }}>관련도 {r.weight}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* LEVEL 2: 직접 연관 (Knowledge Graph) */}
              {kgTopics.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ ...typeStyle('Lv.2', '#6366f1') }}>Lv.2</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)' }}>직접 연관 (Direct Relation)</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>knowledge graph</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {kgTopics.map((r, i) => {
                      const dc = DOMAIN_COLORS[r.domain] || '#94a3b8';
                      const wc2 = r.weight >= 70 ? '#ef4444' : r.weight >= 50 ? '#f59e0b' : '#0ea5e9';
                      return (
                        <div key={i} className="td-topic-row" style={{ padding: '5px 10px' }}>
                          <span className="td-domain-dot" style={{ background: dc }} />
                          <span className="td-topic-name" style={{ fontSize: 12 }}>{r.topic}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: wc2 }}>연결강도 {r.weight}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* LEVEL 3: 동시 출제 (Co-occurrence) */}
              {coocTopics.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ ...typeStyle('Lv.3', '#0ea5e9') }}>Lv.3</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)' }}>동시 출제 (Co-occurrence)</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>cooccurrence</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {coocTopics.map((r, i) => {
                      const dc = DOMAIN_COLORS[r.domain] || '#94a3b8';
                      return (
                        <div key={i} className="td-topic-row" style={{ padding: '5px 10px' }}>
                          <span className="td-domain-dot" style={{ background: dc }} />
                          <span className="td-topic-name" style={{ fontSize: 12 }}>{r.topic}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: r.weight >= 70 ? '#ef4444' : r.weight >= 50 ? '#f59e0b' : '#0ea5e9' }}>
                            Jaccard {r.weight}%
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--t3)' }}>{r.co || 0}회 동시출제</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Fallback flat list */}
              {!kgTopics.length && !coocTopics.length && wcTopics.length === 0 && preReqs.length === 0 && expandedTopics.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {expandedTopics.map((r, i) => {
                    const dc = DOMAIN_COLORS[r.domain] || '#94a3b8';
                    return (
                      <div key={i} className="td-topic-row">
                        <span className="td-rank">{i + 1}</span>
                        <span className="td-domain-dot" style={{ background: dc }} />
                        <span className="td-topic-name">{r.topic}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: r.weight >= 70 ? '#ef4444' : r.weight >= 50 ? '#f59e0b' : '#0ea5e9', minWidth: 50, textAlign: 'right' }}>{r.weight}%</span>
                        <span style={{ fontSize: 10, color: 'var(--t3)', minWidth: 60, textAlign: 'right' }}>{r.sources?.join(', ') || '데이터'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--t3)', lineHeight: 1.5 }}>
              * knowledge graph({knowledgeGraphData?.total_edges || 0}edges) · weakness connector({weakConnectorTopics.length}토픽) · cooccurrence({coocEdges.length}pairs).
            </div>
          </div>
        );
      })()}

      {/* ═══ SECTION 13: 예측 점수 설명 (향상된 basis 기반) ═══ */}
      {explainForTopTopic && (() => {
        const topicName = priorityTopics[0]?.topic || '';
        const predDetail = pred2026.find(p => p.topic === topicName);
        const exp = explainForTopTopic;
        const sigs = [
          { label: 'Bayesian (30%)', value: exp.bayesian, color: '#10b981',
            calc: predDetail ? `24년 중 ${predDetail.total_24yr_count ?? 0}회 출제, 최근 5년 ${predDetail.recent_5yr_count ?? 0}회. Recency-weighted Beta-Binomial 사후확률.` : '계산 데이터 없음' },
          { label: 'Markov (20%)', value: exp.markov, color: '#0ea5e9',
            calc: predDetail ? `직전 출제 ${predDetail.last_appeared ?? '?'}년 · 연속 ${predDetail.consecutive ?? 0}년. 2-상태 전이확률.` : '계산 데이터 없음' },
          { label: 'Trend (20%)', value: exp.trend, color: '#f59e0b',
            calc: predDetail ? `OLS 기울기 ${predDetail.trend_slope ?? 'N/A'} (로지스틱 스쿼시). 최근 5년 ${predDetail.recent_5yr_count ?? 0}회.` : '계산 데이터 없음' },
          { label: 'Momentum (15%)', value: exp.momentum, color: '#ec4899',
            calc: predDetail ? `frequency ${predDetail.frequency_score ?? 'N/A'} · momentum ${predDetail.momentum_score ?? 'N/A'}.` : '계산 데이터 없음' },
          { label: 'Recency (15%)', value: exp.recency, color: '#06b6d4',
            calc: predDetail ? `마지막 출제 ${predDetail.last_appeared ?? '?'}년 · gap ${predDetail.gap_years ?? 0}년.` : '계산 데이터 없음' },
          { label: 'Cycle', value: exp.cycle, color: '#8b5cf6',
            calc: predDetail ? `cycle_score ${predDetail.cycle_score ?? 'N/A'} · 공백 ${predDetail.gap_years ?? 0}년.` : '계산 데이터 없음' },
        ];
        return (
          <div className="td-card">
            <div className="td-card-title"><Brain size={16} color="#a855f7" /> 예측 점수 설명 — {topicName}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10, lineHeight: 1.5 }}>
              <b style={{ color: '#a855f7' }}>{exp.final_pct ?? priorityTopics[0]?.predictionProbability ?? 0}%</b> = 5개 신호 가중 합(Bayesian 30% + Markov 20% + Trend 20% + Momentum 15% + Recency 15%). ⚠️ 이 값은 모델 예측 점수이며 실제 확률이 아닙니다.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {sigs.map((item, i) => (
                <div key={i} style={{ background: 'var(--bg1)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--bd0)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5 }}>
                    <span style={{ color: item.color, fontWeight: 700 }}>{item.label}</span>
                    <span style={{ fontWeight: 800, color: 'var(--t0)' }}>{item.value ?? 'N/A'}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
                    <div style={{ width: `${Math.min(100, (item.value ?? 0))}%`, height: '100%', background: item.color, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--t3)', lineHeight: 1.45 }}>{item.calc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--t3)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--bg1)', borderRadius: 8, border: '1px dashed var(--bd1)' }}>
              <b>basis:</b> {exp.basis || predDetail?.basis || '데이터 없음'}
              {exp.model_confidence != null && <span> · <b>모델 신뢰도:</b> {Math.round(exp.model_confidence * 100)}%</span>}
              {predDetail?.total_24yr_count != null && <span> · <b>총 출제:</b> {predDetail.total_24yr_count}회/24년</span>}
              {predDetail?.recent_5yr_count != null && <span> · <b>최근5년:</b> {predDetail.recent_5yr_count}회</span>}
              {predDetail?.confidence != null && <span> · <b>confidence:</b> {predDetail.confidence > 0.7 ? '높음' : predDetail.confidence > 0.4 ? '보통' : '낮음'} ({Math.round(predDetail.confidence * 100)}%)</span>}
            </div>
          </div>
        );
      })()}

      {/* ═══ SECTION 14: 동시출제 학습 추천 ═══ */}
      {coocForTopTopic.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Network size={16} color="#6366f1" /> 동시출제 학습 추천</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10, lineHeight: 1.5 }}>
            <b style={{ color: 'var(--t0)' }}>{priorityTopics[0]?.topic}</b>과 실제 시험에서 함께 출제된 토픽 (cooccurrence 데이터 기반).
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {coocForTopTopic.map((c, i) => {
              const dc = DOMAIN_COLORS[c.domain] || '#94a3b8';
              return (
                <div key={i} className="td-topic-row">
                  <span className="td-rank">{i + 1}</span>
                  <span className="td-domain-dot" style={{ background: dc }} />
                  <span className="td-topic-name">{c.topic}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: c.value >= 70 ? '#ef4444' : c.value >= 50 ? '#f59e0b' : '#0ea5e9', minWidth: 44, textAlign: 'right' }}>{c.value}%</span>
                  <span style={{ fontSize: 10.5, color: 'var(--t3)', minWidth: 50, textAlign: 'right' }}>{c.co}회 동시출제</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ EXAM SIMULATION ═══ */}
      {examSim && (
        <div className="td-card">
          <div className="td-card-title"><Layers size={16} color="#f59e0b" /> 2026 출제 구성 청사진 (Exam Simulation) <Badge kind="PREDICTED" /></div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>{examSim.disclaimer}</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            {examSim.domain_quota.map((q, i) => (
              <div key={i} style={{ background: 'var(--bg1)', borderRadius: 9, padding: '8px 12px', border: '1px solid var(--bd0)', minWidth: 90 }}>
                <div style={{ fontSize: 10.5, color: 'var(--t3)', fontWeight: 600, marginBottom: 2 }}>{q.domain_ko}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: DOMAIN_COLORS[q.domain] || 'var(--t0)' }}>{q.count}문항</div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>{q.pct}%</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t0)', marginBottom: 8 }}>
              38문항 상세 예측 청사진 (<b>{examSim.total_questions}</b>문항)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 500 }}>
                <thead>
                  <tr style={{ color: 'var(--t3)', fontSize: 10, textAlign: 'left' }}>
                    <th style={{ padding: '5px 8px', fontWeight: 600 }}>#</th>
                    <th style={{ padding: '5px 8px', fontWeight: 600 }}>영역</th>
                    <th style={{ padding: '5px 8px', fontWeight: 600 }}>예상 토픽</th>
                    <th style={{ padding: '5px 8px', fontWeight: 600, textAlign: 'right' }}>확률</th>
                    <th style={{ padding: '5px 8px', fontWeight: 600 }}>난이도</th>
                    <th style={{ padding: '5px 8px', fontWeight: 600 }}>형식</th>
                  </tr>
                </thead>
                <tbody>
                  {examSim.blueprint.map((b, i) => {
                    const c = DOMAIN_COLORS[b.domain] || 'var(--t3)';
                    const nd = (s) => s === '데이터 없음';
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--bd0)' }}>
                        <td style={{ padding: '6px 8px', color: 'var(--t3)' }}>{b.q_no}</td>
                        <td style={{ padding: '6px 8px' }}><span style={{ display: 'inline-block', width: 4, height: 11, borderRadius: 2, background: c, marginRight: 5, verticalAlign: 'middle' }} />{b.domain_ko}</td>
                        <td style={{ padding: '6px 8px' }}><b style={{ color: 'var(--t0)' }}>{b.topic}</b></td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: b.probability_pct != null ? '#a855f7' : 'var(--t3)', fontWeight: 700 }}>{b.probability_pct != null ? `${b.probability_pct}%` : '—'}</td>
                        <td style={{ padding: '6px 8px', color: nd(b.expected_difficulty) ? 'var(--t3)' : 'var(--t1)' }}>{b.expected_difficulty}</td>
                        <td style={{ padding: '6px 8px', color: nd(b.expected_format) ? 'var(--t3)' : 'var(--t2)' }}>{b.expected_format}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <ChartNarrative
            meaning={`실제 EJU 종합과목과 동일한 <b>${examSim.total_questions}문항</b> 구성, 영역 비중 = 과거 24년 실제 분포 반영. 토픽 = 2026 예측확률 상위로 채움.`}
            action={`이 구성표를 실전 연습 범위로 사용하세요. ⚠️ 문제 텍스트가 아닌 구성 예측이므로 실제 출제 보장은 아닙니다.`}
          />
        </div>
      )}

      {/* ═══ SECTION 9: MATH ANALYSIS ═══ */}
      {math && (
        <div className="td-card">
          <div className="td-card-title"><Calculator size={16} color="#8b5cf6" /> 수학 전용 분석 (EJU 수학Ⅰ)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {math.topics.map((t, i) => (
              <div key={i} className="td-topic-row">
                <div className="td-rank">{i + 1}</div>
                <div className="td-topic-name">{t.name}</div>
                <div className="td-topic-stat">{t.exams}회 출제</div>
                <div style={{ width: 60, textAlign: 'right', fontSize: 11, color: 'var(--t2)' }}>{t.pct}%</div>
                <div style={{ width: 100, height: 6, background: 'var(--bg1)', borderRadius: 3 }}>
                  <div style={{ width: `${t.pct}%`, height: '100%', background: '#8b5cf6', borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>
            총 {math.totalExams}회 분석 · EJU 수학Ⅰ 기준
          </div>
        </div>
      )}

      {/* ═══ SECTION 10: COMPREHENSIVE SUBJECT ANALYSIS ═══ */}
      <div className="td-card">
        <div className="td-card-title"><BookOpen size={16} color="#10b981" /> 종합과목 전용 분석</div>
        <div className="td-grid-2">
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 8 }}>📊 분석 개요</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: '분석 기간', value: stats.period },
                { label: '분석 문항', value: `${stats.totalQuestions.toLocaleString()}문항` },
                { label: '추적 토픽', value: `${stats.topicsTracked}개` },
                { label: '성장 토픽', value: `${stats.growingCount}개`, color: '#ef4444' },
                { label: '감소 토픽', value: `${stats.decliningCount}개`, color: '#0ea5e9' },
                { label: '미출제 복귀 예상', value: `${stats.gapCount}개`, color: '#f59e0b' },
              ].map((item, i) => (
                <div key={i} className="td-topic-row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--t2)' }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: item.color || 'var(--t0)' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 8 }}>📊 데이터 요약</div>
            <div style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.7 }}>
              {rising[0] && <p>📈 <b style={{ color: 'var(--t0)' }}>{rising[0].topic}</b> — 최근 +{rising[0].growth}% (최근5년 {rising[0].recent5}회)</p>}
              {gapTopics[0] && <p>⏰ <b style={{ color: 'var(--t0)' }}>{gapTopics[0].topic}</b> — {gapTopics[0].gapYears}년째 미출제 (총 {gapTopics[0].total}회)</p>}
              {subjectList[0] && <p>🎯 <b style={{ color: 'var(--t0)' }}>{subjectList[0].name}</b> — 전체 {subjectList[0].pct}% ({subjectList[0].count.toLocaleString()}문항)</p>}
              {pred2026[0] && <p>🔮 <b style={{ color: '#a855f7' }}>2026 예측</b> — {pred2026[0].topic} ({Math.round(pred2026[0].probability_pct ?? 0)}%)</p>}
              <p>💡 {stats.topicsTracked}개 토픽 중 상위 10개 = 전체 출제의 약 {top10share}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: 'var(--t3)' }}>
        EJU Intelligence Platform · 데이터 기반 출제경향 분석 · {stats.period} · {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}
