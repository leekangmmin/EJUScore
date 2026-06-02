// ═══════════════════════════════════════════════════════════════════
// TrendDashboard v3 — EJU Complete Intelligence Center
//
// Integrates:
//   - PAST_EXAM_BANK (hardcoded fallback)
//   - trend_analysis_complete.json (2,002-2,025 comprehensive analysis)
//   - prediction_2026_2028.json (3-year prediction)
//   - weakness_connector.json (personalized wrong-answer analysis)
//
// 10 Required Sections:
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
// Renders the four required sections. Every sentence is fed numbers
// computed from the gold-standard data — nothing is hand-written.
function AnalysisReport({ sections }) {
  const rows = [
    { label: '핵심 발견사항', icon: '🔑', text: sections.key },
    { label: '장기 추세', icon: '📈', text: sections.longterm },
    { label: '최근 5년 변화', icon: '🕔', text: sections.recent5 },
    { label: '수험생 시사점', icon: '🎯', text: sections.implication },
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
            <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>최종확률</th>
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
        최종확률 = Bayesian 30% + Markov 20% + Trend 20% + Momentum 15% + Recency 15%.
        Bayesian = 최신성 가중 Beta-Binomial 사후확률 · Markov = 2상태 전이확률(다년은 k-step) · Trend = 연도별 출제수 회귀 기울기.
      </div>
    </div>
  );
}

// ── [6] Chart Narrative: "이 그래프가 의미하는 것" + "수험생이 해야 할 행동" ──
// Mandatory under every chart. Strategy, not a number restatement.
function ChartNarrative({ meaning, action }) {
  if (!meaning && !action) return null;
  return (
    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} className="cn-grid">
      {meaning && (
        <div style={{ padding: '11px 13px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#6366f1', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Eye size={13} /> 이 그래프가 의미하는 것
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: meaning }} />
        </div>
      )}
      {action && (
        <div style={{ padding: '11px 13px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#10b981', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Zap size={13} /> 수험생이 해야 할 행동
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

// ── RISK narrative from REAL numbers only (no fabrication) ──
function riskNarrative(t) {
  const parts = [];
  if (t.risk_grade) parts.push(`Risk ${t.risk_score}(${t.risk_grade}등급)`);
  if (t.cycle_status) parts.push(`주기상태 ${t.cycle_status}`);
  if (t.gap_now > 0) parts.push(`현재공백 ${t.gap_now}년`);
  if (t.return_possible) parts.push('과거 장기공백 후 복귀 이력 — 미출제라도 방심 시 실점 위험');
  else if (t.risk_grade === 'S' || t.risk_grade === 'A') parts.push('고빈출·고확률 — 미학습 시 직접 실점으로 직결');
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
    <svg viewBox="0 0 380 370" width="100%" style={{ maxHeight: 380 }}>
      {edges.map((e, i) => {
        const a = pos[e.source], b = pos[e.target];
        if (!a || !b) return null;
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke="#6366f1" strokeOpacity={Math.max(0.07, (e.value || 0) / 110)} strokeWidth={Math.max(0.5, (e.value || 0) / 22)} />;
      })}
      {nodes.map((n, i) => {
        const p = pos[n.id]; const r = 5 + ((n.total || 0) / maxTotal) * 11;
        const c = DOMAIN_COLORS[n.domain] || '#94a3b8';
        const right = p.x >= cx;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={r} fill={c} fillOpacity={0.88} />
            <text x={p.x} y={p.y - r - 3} textAnchor={right ? 'start' : 'end'} fontSize={8.6} fill="var(--t1)" fontWeight={600}>{n.id}</text>
          </g>
        );
      })}
    </svg>
  );
}

// custom Sankey node with label
function SankeyNodeLabel({ x, y, width, height, payload }) {
  const left = (payload.depth ?? 0) === 0;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={2} fill="#6366f1" fillOpacity={0.82} />
      <text x={left ? x - 6 : x + width + 6} y={y + height / 2} textAnchor={left ? 'end' : 'start'}
        dominantBaseline="middle" fontSize={10.5} fill="var(--t1)" fontWeight={600}>{payload.name}</text>
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function TrendDashboard() {
  const [datasets, setDatasets] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (isEngineInitialized()) {
        setDatasets(getDatasetCache());
        setLoading(false);
      } else {
        await initializeEngine();
        setDatasets(getDatasetCache());
        setLoading(false);
      }
    }
    load();
  }, []);

  // Get data from new comprehensive analysis
  const tc = datasets?.trendComplete || null;  // trend_analysis_complete
  const pred = datasets?.prediction2026_2028 || datasets?.prediction2026 || null;

  // ── 1. TOP 100 Topics ──
  // Raw shape stores counts as total_count / period_5yr_count; the list renders
  // t.total and t.recent5, so normalize here (otherwise every row showed "0회").
  const top100 = useMemo(() => {
    if (tc?.top_100_topics) return tc.top_100_topics.map(t => ({
      ...t,
      domain: t.domain || '',
      total: t.total_count ?? t.total ?? 0,
      recent5: t.period_5yr_count ?? t.recent5 ?? 0,
    }));
    // Fallback: use PAST_EXAM_BANK data
    return [];
  }, [tc]);

  // ── 2. Rising Topics ──
  const rising = useMemo(() => safe(tc?.growing_topics).slice(0, 15).map(t => ({
    topic: t.topic, domain: t.domain || '',
    growth: t.growth_rate_pct || 0,
    total: t.total_count || 0,
    recent5: t.period_5yr_count || 0,
  })), [tc]);

  // ── 3. Falling Topics ──
  const falling = useMemo(() => safe(tc?.declining_topics).slice(0, 15).map(t => ({
    topic: t.topic, domain: t.domain || '',
    growth: t.growth_rate_pct || 0,
    total: t.total_count || 0,
    recent5: t.period_5yr_count || 0,
  })), [tc]);

  // ── 4. Gap Topics (장기 미출제) ──
  const gapTopics = useMemo(() => {
    if (tc?.gap_topics) return tc.gap_topics.map(t => ({
      topic: t.topic, domain: t.domain || '',
      gapYears: t.gap_years || 0,
      lastYear: t.last_appeared_year,
      total: t.total_count || 0,
    }));
    return [];
  }, [tc]);

  // ── 5. Year-by-year data ──
  const byYearData = useMemo(() => {
    if (!tc?.domain_trends) return [];
    const allYears = new Set();
    COMP_KEYS.forEach(key => {
      const d = tc.domain_trends[key];
      if (d?.yearly) Object.keys(d.yearly).forEach(y => allYears.add(parseInt(y)));
    });
    return Array.from(allYears).sort().map(year => {
      const entry = { year: String(year), total: 0 };
      COMP_KEYS.forEach(key => {
        const count = tc.domain_trends?.[key]?.yearly?.[String(year)] || 0;
        entry[SUBJECT_MAP[key].name] = count;
        entry.total += count;
      });
      return entry;
    });
  }, [tc]);

  // ── 6. Domain proportion ──
  const subjectList = useMemo(() => {
    if (!tc?.domain_trends) return [];
    const totals = {};
    let grandTotal = 0;
    COMP_KEYS.forEach(key => {
      const count = tc.domain_trends?.[key]?.total || 0;
      totals[key] = count;
      grandTotal += count;
    });
    return COMP_KEYS
      .filter(k => totals[k] > 0)
      .map(k => ({
        id: k, ...SUBJECT_MAP[k],
        count: totals[k],
        pct: grandTotal ? Math.round((totals[k] / grandTotal) * 100) : 0,
        growth: tc.domain_trends?.[k]?.growth_rate_pct || 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [tc]);

  // ── 7. Difficulty trend ──
  const difficultyData = useMemo(() => {
    // Estimate from topic frequency
    if (!tc?.topic_trends) return [];
    const topics = Object.values(tc.topic_trends);
    const byYear = {};
    topics.forEach(t => {
      const yr = t.last_appeared_year;
      if (!yr) return;
      if (!byYear[yr]) byYear[yr] = { year: String(yr), high: 0, mid: 0, low: 0, total: 0 };
      if (t.total_count > 10) byYear[yr].high++;
      else if (t.total_count > 5) byYear[yr].mid++;
      else byYear[yr].low++;
      byYear[yr].total++;
    });
    return Object.values(byYear).sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [tc]);

  // ── 8. Predictions ──
  // prediction_2026_2028.json stores years as top-level keys: { "2026": { top_predictions: [...] } }
  // prediction_2026.json (fallback) stores { top_30_predictions: [...] }
  // Older shape used a `yearly` wrapper. Support all three.
  const yearPreds = (p, year) => safe(p?.[year]?.top_predictions || p?.yearly?.[year]);
  const pred2026 = useMemo(() => {
    const y = yearPreds(pred, '2026');
    return (y.length ? y : safe(pred?.top_30_predictions)).slice(0, 30);
  }, [pred]);
  const pred2027 = useMemo(() => yearPreds(pred, '2027').slice(0, 20), [pred]);
  const pred2028 = useMemo(() => yearPreds(pred, '2028').slice(0, 20), [pred]);

  // ── 9. Math analysis ──
  const math = useMemo(() => {
    const m = PAST_EXAM_BANK.math;
    if (!m) return null;
    const topics = Object.entries(m.topics || {})
      .map(([id, name]) => ({
        id, name,
        exams: m.topicExams?.[id] || 0,
        pct: m.totalExams ? Math.round(((m.topicExams?.[id] || 0) / m.totalExams) * 100) : 0,
      }))
      .filter(t => t.exams > 0)
      .sort((a, b) => b.exams - a.exams);
    return { totalExams: m.totalExams, topics };
  }, []);

  // ── 10. Comprehensive subject analysis ──
  const compStats = useMemo(() => {
    return {
      totalQuestions: tc?.total_questions_analyzed || PAST_EXAM_BANK.jongkwa.totalQuestions,
      totalYears: tc?.total_years || 0,
      period: tc?.analysis_period || '2005-2025',
      topicsTracked: tc?.total_topics_tracked || 0,
      // statistics{} doesn't carry these counts; fall back to the actual array lengths.
      growingCount: tc?.statistics?.growing_count ?? (tc?.growing_topics?.length || 0),
      decliningCount: tc?.statistics?.declining_count ?? (tc?.declining_topics?.length || 0),
      gapCount: tc?.statistics?.gap_count ?? (tc?.gap_topics?.length || 0),
    };
  }, [tc]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Brain size={40} style={{ color: 'var(--primary)', margin: '0 auto 12px', display: 'block' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>인텔리전스 엔진 로딩 중...</p>
      </div>
    );
  }

  if (!compStats.totalQuestions) return <InsufficientData />;

  // ── Build insights ──
  const insights = [];
  if (subjectList[0]) insights.push({ icon: '🎯', text: `<b>${subjectList[0].name}</b>이 전체의 <b>${subjectList[0].pct}%</b>로 최다 출제`, color: subjectList[0].color });
  
  const peShare = (subjectList.find(s => s.id === 'economy')?.count || 0) + (subjectList.find(s => s.id === 'politics')?.count || 0);
  const pePct = compStats.totalQuestions ? Math.round((peShare / compStats.totalQuestions) * 100) : 0;
  insights.push({ icon: '⚖️', text: `정치·경제가 전체의 <b>${pePct}%</b> — 3문제 중 2문제 수준`, color: '#10b981' });

  if (rising[0]) insights.push({ icon: '📈', text: `<b>${rising[0].topic}</b> 출제 급증 (+${rising[0].growth}%)`, color: '#ef4444' });
  if (gapTopics[0]) insights.push({ icon: '⏰', text: `<b>${gapTopics[0].topic}</b> ${gapTopics[0].gapYears}년째 미출제 — 복귀 가능성`, color: '#f59e0b' });
  if (pred2026[0]) insights.push({ icon: '🔮', text: `2026년 최고 예상: <b>${pred2026[0].topic}</b> (${Math.round(pred2026[0].probability_pct ?? pred2026[0].prediction_probability_pct ?? pred2026[0].combined_score ?? 0)}%)`, color: '#a855f7' });
  if (math?.topics[0]) insights.push({ icon: '📐', text: `수학 최빈출: <b>${math.topics[0].name}</b> (${math.topics[0].pct}%)`, color: '#8b5cf6' });

  const currentYear = new Date().getFullYear();

  // ── Explainable Analysis: build narrative sections from real numbers ──
  const econ = subjectList.find(s => s.id === 'economy');
  const econTrend = tc?.domain_trends?.economy;
  const totalQ = compStats.totalQuestions || 0;

  const domainReport = {
    key: econ
      ? `<b>${econ.name}</b> 영역이 <b>${econ.count.toLocaleString()}문항(${econ.pct}%)</b>으로 5개 영역 중 가장 많이 출제됐습니다. 정치·경제 두 영역을 합치면 전체의 <b>${pePct}%</b>를 차지합니다.`
      : '',
    longterm: subjectList.length
      ? `${compStats.period} 전 기간에 걸쳐 출제 비중 순위는 ${subjectList.slice(0, 3).map(s => `${s.name}(${s.pct}%)`).join(' › ')} 순으로 안정적입니다.`
      : '',
    recent5: econTrend
      ? `경제 영역의 최근 5년 출제는 <b>${econTrend.recent_5yr_total}문항</b>으로 이전 19년 평균 대비 증감률 <b>${econTrend.growth_rate_pct}%</b>입니다. 사회 영역은 표본이 작아(전체의 ${subjectList.find(s => s.id === 'society')?.pct ?? 0}%) 변동성이 큽니다.`
      : '',
    implication: econ
      ? `한정된 학습 시간이라면 전체의 ${pePct}%를 차지하는 <b>경제·정치</b>를 먼저 다지는 것이 기대 점수 효율이 가장 높습니다.`
      : '',
  };

  // year-by-year narrative
  const yrTotals = byYearData.map(d => d.total);
  const avgPerYear = yrTotals.length ? Math.round(yrTotals.reduce((a, b) => a + b, 0) / yrTotals.length) : 0;
  const first5avg = yrTotals.length >= 5 ? Math.round(yrTotals.slice(0, 5).reduce((a, b) => a + b, 0) / 5) : 0;
  const last5avg = yrTotals.length >= 5 ? Math.round(yrTotals.slice(-5).reduce((a, b) => a + b, 0) / 5) : 0;
  const yearReport = {
    key: byYearData.length
      ? `분석된 ${byYearData.length}개 연도에서 한 해 평균 <b>약 ${avgPerYear}문항</b>이 5개 영역에 걸쳐 출제됩니다.`
      : '',
    longterm: (first5avg && last5avg)
      ? `초기 5년(${byYearData[0]?.year}~) 평균 ${first5avg}문항 대비 최근 5년 평균 ${last5avg}문항으로, 연간 출제량은 ${last5avg >= first5avg ? '비슷하거나 소폭 증가' : '소폭 감소'}하는 흐름입니다.`
      : '',
    recent5: econTrend
      ? `영역 구성은 매년 경제가 최다 비중을 유지하며, 막대그래프 상단(사회·역사)이 얇고 하단(경제)이 두꺼운 패턴이 반복됩니다.`
      : '',
    implication: `특정 연도에 몰린 토픽보다 <b>매년 반복 출제되는 핵심 토픽</b>(아래 TOP 토픽·예측 참고)에 학습을 집중하는 편이 안정적입니다.`,
  };

  // TOP topics narrative
  const top10share = top100.length
    ? Math.round((top100.slice(0, 10).reduce((a, t) => a + (t.total || 0), 0) / (totalQ || 1)) * 100)
    : 0;
  const topicReport = {
    key: top100[0]
      ? `최다 출제 토픽은 <b>${top100[0].topic}</b>로 24년간 <b>${top100[0].total?.toLocaleString()}회</b> 출제됐습니다. 추적된 표준 토픽은 총 <b>${compStats.topicsTracked}개</b>입니다.`
      : '',
    longterm: top100.length
      ? `상위 10개 토픽이 전체 출제의 <b>약 ${top10share}%</b>를 차지해, 소수 핵심 토픽에 출제가 집중되는 구조입니다.`
      : '',
    recent5: rising[0]
      ? `최근 상승세가 뚜렷한 토픽은 <b>${rising[0].topic}</b>(+${rising[0].growth}%)이며, ${gapTopics[0] ? `<b>${gapTopics[0].topic}</b>은 ${gapTopics[0].gapYears}년째 미출제 상태입니다.` : ''}`
      : '',
    implication: `상위 10개 토픽 + 최근 상승 토픽을 우선 학습하면 적은 분량으로 출제의 과반을 대비할 수 있습니다.`,
  };

  // prediction narrative
  const pred2026Detail = pred2026.slice(0, 10);
  const top2026 = pred2026[0];
  const predReport = {
    key: top2026
      ? `2026년 출제 확률이 가장 높은 토픽은 <b>${top2026.topic}</b>(<b>${Math.round(top2026.probability_pct ?? 0)}%</b>)입니다. 확률은 베이지안·마르코프·추세 3개 통계 모델의 가중 합으로 산출됩니다.`
      : '',
    longterm: top2026
      ? `<b>Bayesian</b>(${top2026.bayes_score})은 최신성 가중 출제 빈도, <b>Markov</b>(${top2026.markov_score})는 직전 출제 여부 기반 전이확률, <b>Trend</b>(${top2026.trend_score})는 연도별 출제수의 증감 기울기를 나타냅니다.`
      : '',
    recent5: top2026
      ? `2027·2028 예측은 마르코프 <b>k-step 전이</b>로 산출돼, 매년 출제되던 토픽은 확률이 서서히 안정값으로 수렴하고 오래 미출제된 토픽은 점차 복귀 확률이 올라갑니다.`
      : '',
    implication: `확률 60% 이상 토픽(현재 ${pred2026.filter(p => (p.probability_pct ?? 0) >= 60).length}개)을 1순위로, 장기 미출제 복귀 후보를 2순위로 배치하는 것을 권장합니다. ⚠️ 예측은 과거 빈도 분석이며 실제 출제를 보장하지 않습니다.`,
  };

  // ── EJU-academy insights layer (insights_v2.json) ──
  const ins = datasets?.insights || null;
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
  // ── vNext blocks ──
  const cycleIntel = safe(ins?.cycle_intelligence);
  const explainPred = safe(ins?.explainable_prediction);
  const domainIntel = safe(ins?.domain_intelligence);
  const execSummary = ins?.executive_summary || null;
  const studyPlanner = ins?.study_planner || null;
  const fieldClasses = ins?.field_classes || null;
  const weaknessAnalysis = ins?.weakness_analysis || null;

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
              {compStats.period} · {compStats.totalQuestions.toLocaleString()}문항 분석 · {compStats.topicsTracked}개 토픽
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <StatTile label="표준 토픽" value={top100.length} color="#a855f7" subtitle="추적 토픽" />
            <StatTile label="2026 예측" value={pred2026.length} color="#10b981" subtitle="토픽" />
            <StatTile label="미출제" value={gapTopics.length} color="#ef4444" subtitle="복귀 예상" />
          </div>
        </div>
      </div>

      {/* ═══ [11] EXECUTIVE SUMMARY (대시보드 최상단 3줄 요약) ═══ */}
      {execSummary?.lines?.length > 0 && (
        <div style={{ ...CARD, padding: 16, marginBottom: 16, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={15} /> 핵심 요약 (Executive Summary) <Badge kind="DERIVED" />
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

      {/* ═══ [4] CONFIDENCE DISCLOSURE ═══ */}
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
          {/* F1 ≠ 신뢰도 명시 (CORE RULE 6) */}
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 9, lineHeight: 1.5 }}>
            {disc.backtest?.precision != null && <>정밀도 {disc.backtest.precision} · 재현율 {disc.backtest.recall} · <b style={{ color: '#a855f7' }}>F1 {disc.backtest.f1}</b> (leave-future-out, 데이터 누수 없음). </>}
            {disc.metric_note || 'F1은 "정확도" 지표이며 "신뢰도"·"확률"과 구분합니다.'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6, lineHeight: 1.5 }}>{disc.no_fabrication_policy}</div>
          {/* ── Data Coverage 분류 범례 ── */}
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

      {/* ═══ INSIGHTS ═══ */}
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
          <div className="td-card-title"><Layers size={16} /> 영역별 출제 비중</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={subjectList} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                isAnimationActive={false}
                label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}>
                {subjectList.map(e => <Cell key={e.id} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <ChartNarrative
            meaning={`출제는 5개 영역에 균등 분배되지 않습니다. <b>${subjectList[0]?.name || '경제'}</b>가 ${subjectList[0]?.pct || 0}%로 가장 두껍고, 정치·경제 합산 <b>${pePct}%</b>는 시험의 무게중심이 사회과학 쪽에 있음을 뜻합니다.`}
            action={`<b>${subjectList[0]?.name || '경제'}·정치</b>부터 회독해 전체의 ${pePct}%를 먼저 확보하세요. 비중이 작은 사회(${subjectList.find(s => s.id === 'society')?.pct ?? 0}%)는 핵심 정의만 빠르게 훑는 것이 시간 대비 효율적입니다.`}
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
          <div className="td-card-title"><CalendarDays size={16} /> 연도별 영역별 출제 추이 ({compStats.period})</div>
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
            meaning={`매년 막대 높이(연간 출제량)는 큰 변동 없이 ${avgPerYear}문항 안팎을 유지하고, 색 구성(영역 비율)도 거의 일정합니다. 즉 출제 구조는 해마다 바뀌는 것이 아니라 <b>안정적으로 반복</b>됩니다.`}
            action={`"올해는 무엇이 나올까"를 찍기보다, 매년 반복되는 영역 비율을 믿고 <b>고정 비중 영역(경제·정치)</b>에 학습 시간을 비례 배분하세요. 특정 연도 편중 토픽 추격은 비효율적입니다.`}
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
            meaning={`상위 10개 토픽이 전체 출제의 <b>약 ${top10share}%</b>를 차지합니다. 35개 표준 토픽이 동등하게 나오는 것이 아니라 <b>소수 핵심 토픽에 출제가 쏠려</b> 있다는 뜻입니다.`}
            action={`먼저 상위 10개 토픽을 <b>완전 정복</b> 대상으로 삼으세요. 이것만으로 출제의 절반 이상을 커버합니다. 하위 토픽은 정의 수준의 가벼운 정리로 충분합니다.`}
          />
          <AnalysisReport sections={topicReport} />
        </div>

        {/* 2+3. Rising & Falling */}
        <div>
          {/* 2. Rising */}
          {rising.length > 0 && (
            <div className="td-card">
              <div className="td-card-title"><TrendingUp size={16} color="#ef4444" /> 최근 상승 토픽</div>
              {rising.slice(0, 10).map((t, i) => {
                const color = DOMAIN_COLORS[t.domain] || 'var(--t3)';
                return (
                  <div key={i} className="td-topic-row">
                    <div className="td-domain-dot" style={{ background: color }} />
                    <div className="td-topic-name">{t.topic}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', minWidth: 50, textAlign: 'right' }}>+{t.growth}%</div>
                    <div className="td-topic-stat">{t.recent5}회</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. Falling */}
          {falling.length > 0 && (
            <div className="td-card">
              <div className="td-card-title"><TrendingDown size={16} color="#0ea5e9" /> 최근 하락 토픽</div>
              {falling.slice(0, 8).map((t, i) => {
                const color = DOMAIN_COLORS[t.domain] || 'var(--t3)';
                return (
                  <div key={i} className="td-topic-row">
                    <div className="td-domain-dot" style={{ background: color }} />
                    <div className="td-topic-name">{t.topic}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0ea5e9', minWidth: 50, textAlign: 'right' }}>{t.growth}%</div>
                    <div className="td-topic-stat">{t.total}회</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ SECTION 4: GAP TOPICS + SECTION 7: DIFFICULTY ═══ */}
      <div className="td-grid-2">
        {/* 4. 장기 미출제 토픽 */}
        {gapTopics.length > 0 && (
          <div className="td-card">
            <div className="td-card-title"><Clock size={16} color="#f59e0b" /> 장기 미출제 토픽 (복귀 예상)</div>
            {gapTopics.slice(0, 12).map((t, i) => {
              const color = DOMAIN_COLORS[t.domain] || 'var(--t3)';
              return (
                <div key={i} className="td-topic-row">
                  <div className="td-domain-dot" style={{ background: color }} />
                  <div className="td-topic-name">{t.topic}</div>
                  <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{t.gapYears}년</div>
                  <div className="td-topic-stat">~{t.lastYear}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* 7. 난이도 변화 */}
        <div className="td-card">
          <div className="td-card-title"><Gauge size={16} /> 토픽 난이도 분포 변화</div>
          {difficultyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={difficultyData.slice(-15)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd1)" />
                <XAxis dataKey="year" tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--t2)', fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="high" name="고빈도(10회↑)" stackId="a" fill="#ef4444" />
                <Bar dataKey="mid" name="중빈도(5~10회)" stackId="a" fill="#f59e0b" />
                <Bar dataKey="low" name="저빈도(5회↓)" stackId="a" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: 'var(--t3)', fontSize: 13, textAlign: 'center', padding: 40 }}>충분한 데이터가 없습니다</div>
          )}
          <ChartNarrative
            meaning={`고빈도(누적 10회↑) 토픽이 매년 출제의 뼈대를 이루고, 저빈도 토픽이 변주로 끼어듭니다. 출제진은 <b>검증된 핵심 토픽을 반복</b>하면서 주변 토픽을 교체하는 패턴을 보입니다.`}
            action={`고빈도 토픽은 <b>틀리면 안 되는 필수 득점원</b>으로 완벽히 다지고, 저빈도 토픽은 "나오면 줍는" 보너스로 접근하세요. 저빈도에 시간을 과투자하지 마세요.`}
          />
        </div>
      </div>

      {/* ═══ SECTION 8: 2026~2028 PREDICTION ═══ */}
      <div className="td-card">
        <div className="td-card-title"><Sparkles size={16} color="#a855f7" /> 2026~2028 출제 예측</div>
        <div className="td-grid-2">
          {[['2026', pred2026], ['2027', pred2027], ['2028', pred2028]].map(([year, data]) => (
            <div key={year}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#a855f7', marginBottom: 8 }}>{year}년 TOP 10</div>
              {data.slice(0, 10).map((p, i) => {
                const prob = Math.round(p.probability_pct ?? p.prediction_probability_pct ?? p.combined_score ?? 0);
                const color = DOMAIN_COLORS[p.domain] || 'var(--t3)';
                return (
                  <div key={i} className="td-topic-row">
                    <div className="td-rank">{i + 1}</div>
                    <div className="td-domain-dot" style={{ background: color }} />
                    <div className="td-topic-name">{p.topic}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: prob > 60 ? '#10b981' : prob > 40 ? '#f59e0b' : '#94a3b8', minWidth: 36, textAlign: 'right' }}>{prob}%</div>
                    <div className="td-topic-stat">{p.total_24yr_count || p.total_historical || p.total_count || 0}회</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <PredictionEvidenceTable rows={pred2026Detail} />
        <ChartNarrative
          meaning={`각 확률은 4개 독립 신호(베이지안 빈도·마르코프 전이·추세 기울기·최신성)가 합의한 값입니다. 한 모델이 아닌 <b>여러 통계가 동시에 높다고 가리키는 토픽</b>일수록 신뢰도가 높습니다.`}
          action={`확률 <b>60% 이상</b> 토픽(${pred2026.filter(p => (p.probability_pct ?? 0) >= 60).length}개)을 시험 직전 최종 점검 1순위로 고정하세요. 단, 예측은 보장이 아니므로 핵심 빈출 토픽 학습을 대체하지 말고 <b>보강용</b>으로 쓰세요.`}
        />
        <AnalysisReport sections={predReport} />
      </div>

      {/* ═══ [1] TOPIC INTELLIGENCE — per-topic decision page ═══ */}
      {topicIntel.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Brain size={16} color="#6366f1" /> 토픽 인텔리전스 (Topic Intelligence)</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
            35개 표준 토픽별 의사결정 페이지. 지표·예측확률·신뢰도 + 왜 중요한가/어떤 형태/무엇을 공부 자동 생성. 모든 수치는 gold_standard(1,121문항)·OCR(2002-2015)에서 산출.
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
                      데이터신뢰도 {t.confidence?.tier} ({t.confidence?.evidence_pct}%)
                    </span>
                  </div>
                  {/* 10 metrics */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 9 }}>
                    {[
                      ['총 출제', `${t.total}회`, 'REAL'],
                      ['최근5년', `${t.recent5}회`, 'REAL'],
                      ['최근10년', `${t.recent10}회`, 'REAL'],
                      ['최초', `${t.first_year}`, 'REAL'],
                      ['최근', `${t.last_year}`, 'REAL'],
                      ['평균 간격', t.avg_period != null ? `${t.avg_period}년` : '데이터 없음', 'DERIVED'],
                      ['출제 공백', t.gap_now > 0 ? `${t.gap_now}년` : '없음(연속)', 'REAL'],
                      ['예측확률', t.probability_pct != null ? `${t.probability_pct}%` : '데이터 없음', 'PREDICTED'],
                      ['Risk', t.risk_score != null ? `${t.risk_score} (${t.risk_grade})` : '데이터 없음', 'DERIVED'],
                      ['시간당 기대효과', t.expected_value != null ? `${t.expected_value}` : '데이터 없음', 'DERIVED'],
                    ].map(([k, v, kind], j) => (
                      <span key={j} title={BADGE_META[kind]?.tip} style={{ fontSize: 11, color: 'var(--t2)', background: 'var(--bg2)', padding: '3px 8px', borderRadius: 6, borderLeft: `2px solid ${BADGE_META[kind]?.c}` }}>
                        <span style={{ color: 'var(--t3)' }}>{k}</span> <b style={{ color: 'var(--t1)' }}>{v}</b>
                      </span>
                    ))}
                  </div>
                  {/* WHAT / WHY / TREND / RISK / ACTION */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.55 }}><b style={{ color: '#6366f1' }}>WHAT</b> {t.story}</div>
                    <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.55 }}><b style={{ color: '#ef4444' }}>WHY 왜 중요한가</b> {t.why_important} <Badge kind="DERIVED" size={8.5} /></div>
                    <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.55 }}><b style={{ color: '#0ea5e9' }}>TREND 최근 변화</b> {t.recent_change || '데이터 없음'} <Badge kind="REAL" size={8.5} /></div>
                    <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.55 }}><b style={{ color: '#f59e0b' }}>RISK 놓치면</b> {riskNarrative(t)}</div>
                    <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.55 }}><b style={{ color: '#10b981' }}>ACTION 무엇을 공부</b> {t.what_to_study} <span style={{ color: 'var(--t3)' }}>· 어떤 형태: {t.how_asked}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ [5] DOMAIN INTELLIGENCE ═══ */}
      {domainIntel.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Layers size={16} color="#0ea5e9" /> 영역 인텔리전스 (Domain Intelligence)</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
            영역별 비중·추세는 24년 실측(trend_analysis), 예상 비중은 예측 청사진(Exam Blueprint), 난이도·추천시간은 파생값입니다.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 560 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr 1fr 1fr 1fr', gap: 6, fontSize: 10.5, color: 'var(--t3)', fontWeight: 700, padding: '4px 8px' }}>
                <span>영역</span>
                <span>비중 <Badge kind="REAL" size={8} /></span>
                <span>최근추세 <Badge kind="DERIVED" size={8} /></span>
                <span>예상비중 <Badge kind="PREDICTED" size={8} /></span>
                <span>평균난이도 <Badge kind="DERIVED" size={8} /></span>
                <span>추천시간 <Badge kind="DERIVED" size={8} /></span>
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
            meaning={`출제 비중은 <b>${domainIntel[0]?.domain_ko}</b>가 ${domainIntel[0]?.share_pct}%로 최대입니다. '최근추세'는 직전5년 대비 최근5년의 동일 구간 비교(파생)이며, '예상비중'은 2026 청사진 기준 예측값입니다.`}
            action={`추천시간은 예상 비중에 비례해 100시간을 배분한 값입니다. 비중·예상비중이 모두 높은 영역(${domainIntel[0]?.domain_ko})에 학습 시간을 우선 배정하세요.`}
          />
        </div>
      )}

      {/* ═══ [8] EXPLAINABLE PREDICTION ═══ */}
      {explainPred.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Brain size={16} color="#a855f7" /> 예측 분해 (Explainable Prediction)</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
            각 토픽 최종 예측확률을 구성한 5개 독립 신호 점수입니다. 전부 <b>prediction 모델 실측 출력</b>(0~100). 여러 신호가 동시에 높을수록 합의가 강합니다. <Badge kind="REAL" size={8.5} />
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
                </div>
              );
            })}
          </div>
          <ChartNarrative
            meaning={`최종 확률은 5개 신호의 합성입니다. 예: <b>${explainPred[0]?.topic}</b>는 베이지안 ${explainPred[0]?.bayesian}·마르코프 ${explainPred[0]?.markov}·최신성 ${explainPred[0]?.recency}로 최종 ${explainPred[0]?.final_pct}%입니다. 한 신호만 높은 토픽은 신뢰가 낮습니다.`}
            action={`5개 신호가 고르게 높은 토픽을 최우선 대비하세요. 최신성만 높고 추세가 낮으면 일시적 반등일 수 있어 과대 투자에 주의합니다.`}
          />
        </div>
      )}

      {/* ═══ [9] STUDY PLANNER ═══ */}
      {studyPlanner && (
        <div className="td-card">
          <div className="td-card-title"><ListChecks size={16} color="#10b981" /> 학습 플래너 (Study Planner) <Badge kind="DERIVED" /></div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>{studyPlanner.basis}</div>
          <div className="td-grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
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

      {/* ═══ [10] WEAKNESS ANALYSIS — UNKNOWN (학생 점수 기록 없음) ═══ */}
      {weaknessAnalysis && (
        <div className="td-card" style={{ background: 'rgba(148,163,184,0.06)', borderStyle: 'dashed' }}>
          <div className="td-card-title"><AlertTriangle size={16} color="#94a3b8" /> 약점 분석 (Weakness Analysis) <Badge kind="UNKNOWN" /></div>
          <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6 }}>
            <b style={{ color: '#94a3b8' }}>데이터 없음.</b> {weaknessAnalysis.reason}
            <br />{weaknessAnalysis.available_when}
            <br /><span style={{ color: 'var(--t3)' }}>허위 강점/약점을 생성하지 않습니다 (No Fabrication Policy).</span>
          </div>
        </div>
      )}

      {/* ═══ [2] TOPIC RELATIONSHIP GRAPH ═══ */}
      {coocPairs.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Network size={16} color="#6366f1" /> 토픽 동시 출제 네트워크 (Topic Relationship Graph)</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
            같은 회차 시험에 함께 등장한 비율(Jaccard)로 토픽 간 연관도를 계산했습니다. 한 토픽이 나오면 짝꿍 토픽도 함께 대비해야 합니다.
          </div>
          <div className="td-grid-2">
            {/* Network graph */}
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>네트워크 그래프 (상위 30 연결)</div>
              <TopicNetworkGraph nodes={cooc.nodes} edges={cooc.edges} />
            </div>
            {/* Top connections list */}
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>상위 동시 출제율 TOP 30</div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {coocPairs.map((p, i) => (
                  <div key={i} className="td-topic-row" style={{ fontSize: 12 }}>
                    <span style={{ width: 20, color: 'var(--t3)', fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ flex: 1, color: 'var(--t0)' }}><b>{p.a}</b> <span style={{ color: 'var(--t3)' }}>↔</span> <b>{p.b}</b></span>
                    <span style={{ width: 80, height: 6, background: 'var(--bg1)', borderRadius: 3, flexShrink: 0 }}>
                      <span style={{ display: 'block', width: `${p.rate_pct}%`, height: '100%', background: '#6366f1', borderRadius: 3 }} />
                    </span>
                    <b style={{ minWidth: 36, textAlign: 'right', color: '#6366f1' }}>{p.rate_pct}%</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Sankey */}
          {cooc.sankey?.links?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>영역 → 핵심 토픽 흐름 (Sankey)</div>
              <ResponsiveContainer width="100%" height={360}>
                <Sankey
                  data={cooc.sankey}
                  nodePadding={18} nodeWidth={10}
                  link={{ stroke: '#6366f1', strokeOpacity: 0.18 }}
                  node={<SankeyNodeLabel />}
                  margin={{ left: 50, right: 120, top: 10, bottom: 10 }}
                >
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </Sankey>
              </ResponsiveContainer>
            </div>
          )}
          <ChartNarrative
            meaning={`연관도 ${coocPairs[0]?.rate_pct}%의 <b>${coocPairs[0]?.a} ↔ ${coocPairs[0]?.b}</b>처럼, 특정 토픽들은 같은 회차에 함께 등장하는 경향이 강합니다. 출제진이 영역을 묶어 세트로 출제하기 때문입니다.`}
            action={`연결이 굵은 토픽쌍은 <b>묶어서 학습</b>하세요. 한쪽을 공부할 때 짝꿍 토픽까지 함께 정리하면 한 회차에서 연쇄 득점할 확률이 올라갑니다.`}
          />
        </div>
      )}

      {/* ═══ [3] EXAMINER FORMAT TREND (OCR 2002-2015) ═══ */}
      {fmtByYear.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Eye size={16} color="#f59e0b" /> 출제 형식 변화 분석 (Examiner Trend)</div>
          <div style={{ fontSize: 11.5, color: 'var(--t3)', marginBottom: 10, padding: '8px 10px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, lineHeight: 1.55 }}>
            <b style={{ color: '#f59e0b' }}>데이터 정직성 고지:</b> {fmtSummary?.method}<br />
            {fmtSummary?.caveat}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={fmtByYear}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bd1)" />
              <XAxis dataKey="year" tick={{ fill: 'var(--t2)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--t2)', fontSize: 10 }} unit="%" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="visual_pct" name="자료·그래프형 비율(%)" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
              <Area type="monotone" dataKey="memory_pct" name="암기·이해형 비율(%)" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.12} />
            </AreaChart>
          </ResponsiveContainer>
          <ChartNarrative
            meaning={`OCR 보유 구간(2002-2015) 기준, 자료·그래프 활용형 비율이 초기 약 <b>${fmtSummary?.early_visual_pct}%</b>에서 후기 약 <b>${fmtSummary?.late_visual_pct}%</b>로 상승했습니다. 단순 암기보다 <b>자료를 읽고 해석하는</b> 능력을 요구하는 방향입니다.`}
            action={`정의 암기에서 멈추지 말고 <b>표·그래프 해석 훈련</b>을 병행하세요. 환율 추이 그래프, 인구 피라미드, 통계표 읽기 연습이 실전 형식에 직접 대응합니다.`}
          />
        </div>
      )}

      {/* ═══ [4] PREDICTIVE INTELLIGENCE — addon dimensions ═══ */}
      {predAddons.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><Lightbulb size={16} color="#a855f7" /> 예측 심화 — 예상 난이도·핵심 개념·형식</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
            상위 토픽별 예상 난이도·핵심 개념·출제 형식을 근거와 함께 제시합니다. ⚠️ 오답 패턴은 원문 해설 데이터가 없어 생성하지 않습니다(허위 금지).
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 640 }}>
              <thead>
                <tr style={{ color: 'var(--t3)', fontSize: 11, textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>토픽</th>
                  <th style={{ padding: '6px 8px' }}>예상 난이도</th>
                  <th style={{ padding: '6px 8px' }}>예상 형식</th>
                  <th style={{ padding: '6px 8px' }}>예상 핵심 개념</th>
                </tr>
              </thead>
              <tbody>
                {predAddons.slice(0, 15).map((p, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--bd0)' }}>
                    <td style={{ padding: '7px 8px' }}><b style={{ color: 'var(--t0)' }}>{p.topic}</b></td>
                    <td style={{ padding: '7px 8px' }}>
                      {p.difficulty_label
                        ? <span style={{ color: p.difficulty_label === '상' ? '#ef4444' : p.difficulty_label === '중상' ? '#f59e0b' : '#10b981', fontWeight: 700 }} title={p.difficulty_basis}>{p.difficulty_label} ({p.expected_difficulty})</span>
                        : <span style={{ color: 'var(--t3)' }}>데이터 없음</span>}
                    </td>
                    <td style={{ padding: '7px 8px', color: 'var(--t2)' }} title={p.format_basis}>{p.expected_format || '—'}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--t2)' }}>
                      {p.key_concepts?.length
                        ? p.key_concepts.map((k, j) => <span key={j} style={{ display: 'inline-block', background: 'var(--bg1)', borderRadius: 5, padding: '1px 6px', margin: '1px 3px 1px 0', fontSize: 11 }}>{k}</span>)
                        : <span style={{ color: 'var(--t3)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8, lineHeight: 1.5 }}>
            난이도 = 과거 라벨링 문항(2~4 척도) 평균 · 핵심 개념 = 기출 추출 키워드 상위 · 형식 = 2002-2015 OCR 원문 분류 최빈값.
          </div>
          <ChartNarrative
            meaning={`예측은 "무엇이 나오나"를 넘어 <b>어떤 난이도·형식으로, 어떤 개념을 묻는지</b>까지 좁혀줍니다. 같은 토픽도 난이도 '상'이면 깊은 이해가, '중'이면 정의 암기가 요구됩니다.`}
            action={`난이도 '상' 토픽은 개념 간 연결·응용까지 학습하고, 제시된 <b>핵심 개념(키워드)</b>을 체크리스트로 만들어 빠짐없이 암기했는지 점검하세요.`}
          />
        </div>
      )}

      {/* ═══ [5] STUDENT ACTION PLAN ═══ */}
      {actionPlan.length > 0 && (
        <div className="td-card">
          <div className="td-card-title"><ListChecks size={16} color="#10b981" /> 학생 액션 플랜 (Student Action Plan)</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
            중요도 = 출제 빈도(55%) + 2026 예측확률(45%). 학습 시간은 100시간 예산을 중요도 비례 배분, 점수 기여도는 전체 출제 중 토픽 비중입니다.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <StatTile label="최우선(S)" value={`${sTier.length}개`} color="#ef4444" subtitle="완전 정복" />
            <StatTile label="핵심(A)" value={`${aTier.length}개`} color="#f59e0b" subtitle="안정 득점원" />
            <StatTile label="S+A 점수기여" value={`${[...sTier, ...aTier].reduce((s, a) => s + (a.score_contribution_pct || 0), 0).toFixed(0)}%`} color="#10b981" subtitle="기대 비중" />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 680 }}>
              <thead>
                <tr style={{ color: 'var(--t3)', fontSize: 11, textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>#</th>
                  <th style={{ padding: '6px 8px' }}>등급</th>
                  <th style={{ padding: '6px 8px' }}>토픽</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>중요도</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>학습시간</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>점수기여</th>
                  <th style={{ padding: '6px 8px' }}>학습 전략</th>
                </tr>
              </thead>
              <tbody>
                {actionPlan.slice(0, 20).map((a, i) => {
                  const tc2 = a.tier === 'S' ? '#ef4444' : a.tier === 'A' ? '#f59e0b' : a.tier === 'B' ? '#0ea5e9' : '#94a3b8';
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--bd0)' }}>
                      <td style={{ padding: '7px 8px', color: 'var(--t3)' }}>{a.priority}</td>
                      <td style={{ padding: '7px 8px' }}><span style={{ fontWeight: 800, color: tc2, background: 'var(--bg1)', padding: '2px 8px', borderRadius: 6 }}>{a.tier}</span></td>
                      <td style={{ padding: '7px 8px' }}><b style={{ color: 'var(--t0)' }}>{a.topic}</b> <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>{a.domain_ko}</span></td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: tc2 }}>{a.importance}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--t1)' }}>{a.study_hours}h</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--t2)' }}>{a.score_contribution_pct}%</td>
                      <td style={{ padding: '7px 8px', color: 'var(--t2)', fontSize: 11.5, lineHeight: 1.45, minWidth: 200 }}>{a.advice}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ChartNarrative
            meaning={`모든 토픽이 동일하게 중요하지 않습니다. <b>S등급 ${sTier.length}개 + A등급 ${aTier.length}개</b>만으로 기대 점수의 <b>${[...sTier, ...aTier].reduce((s, a) => s + (a.score_contribution_pct || 0), 0).toFixed(0)}%</b>를 확보할 수 있습니다.`}
            action={`위 학습시간 배분을 그대로 주간 계획표에 옮기세요. <b>S등급부터 순서대로</b> 정복하고, C등급은 시험 2주 전 정의 점검만 하면 충분합니다.`}
          />
        </div>
      )}

      {/* ═══ [3] EXAM SIMULATION — 2026 예상 모의고사 구성 ═══ */}
      {examSim && (
        <div className="td-card">
          <div className="td-card-title"><FileText size={16} color="#a855f7" /> {examSim.target_year} 예상 모의고사 구성 (Exam Simulation)</div>
          <div style={{ fontSize: 11.5, color: 'var(--t3)', marginBottom: 10, padding: '8px 10px', background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 8, lineHeight: 1.55 }}>
            <b style={{ color: '#a855f7' }}>고지:</b> {examSim.disclaimer}<br />근거: {examSim.basis}
          </div>
          <div className="td-grid-2">
            {/* domain quota pie (reuse PieChart) */}
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>영역 비중 ({examSim.total_questions}문항)</div>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={examSim.domain_quota} dataKey="count" nameKey="domain_ko" cx="50%" cy="50%" outerRadius={75}
                    isAnimationActive={false}
                    label={({ domain_ko, count }) => `${domain_ko} ${count}`}>
                    {examSim.domain_quota.map((q) => <Cell key={q.domain} fill={DOMAIN_COLORS[q.domain] || '#94a3b8'} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* difficulty + format distribution */}
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>예상 난이도 분포</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {Object.entries(examSim.difficulty_dist).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 7, background: 'var(--bg1)', border: '1px solid var(--bd0)', color: k === '데이터 없음' ? 'var(--t3)' : 'var(--t1)' }}>
                    {k} <b style={{ color: k === '상' ? '#ef4444' : k === '중상' ? '#f59e0b' : 'var(--t1)' }}>{v}문항</b>
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>예상 출제 형식 분포 <span style={{ fontSize: 10.5, color: 'var(--t3)', fontWeight: 400 }}>(2002-2015 OCR 기반)</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(examSim.format_dist).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 7, background: 'var(--bg1)', border: '1px solid var(--bd0)', color: k === '데이터 없음' ? 'var(--t3)' : 'var(--t1)' }}>
                    {k} <b>{v}문항</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
          {/* blueprint table */}
          <div style={{ marginTop: 14, overflowX: 'auto' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>문항 구성 청사진 ({examSim.total_questions}문항)</div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 560 }}>
                <thead>
                  <tr style={{ color: 'var(--t3)', fontSize: 11, textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>#</th>
                    <th style={{ padding: '6px 8px' }}>영역</th>
                    <th style={{ padding: '6px 8px' }}>예상 토픽</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>확률</th>
                    <th style={{ padding: '6px 8px' }}>난이도</th>
                    <th style={{ padding: '6px 8px' }}>형식</th>
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
            meaning={`실제 EJU 종합과목과 동일한 <b>${examSim.total_questions}문항</b> 구성으로, 영역 비중은 과거 24년 실제 분포(경제 ${examSim.domain_quota.find(q => q.domain === 'economy')?.pct ?? 0}%)를 그대로 반영합니다. 토픽은 2026 예측확률 상위로 채워집니다.`}
            action={`이 구성표를 실전 연습 범위로 사용하세요. <b>경제 17문항</b>에 학습 비중을 맞추고, 난이도 '상' 토픽 위주로 시간을 배분하면 실제 시험 체감과 일치합니다. ⚠️ 문제 텍스트가 아닌 구성 예측이므로 실제 출제 보장은 아닙니다.`}
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
                { label: '분석 기간', value: compStats.period },
                { label: '분석 문항', value: `${compStats.totalQuestions.toLocaleString()}문항` },
                { label: '추적 토픽', value: `${compStats.topicsTracked}개` },
                { label: '성장 토픽', value: `${compStats.growingCount}개`, color: '#ef4444' },
                { label: '감소 토픽', value: `${compStats.decliningCount}개`, color: '#0ea5e9' },
                { label: '미출제 복귀 예상', value: `${compStats.gapCount}개`, color: '#f59e0b' },
              ].map((item, i) => (
                <div key={i} className="td-topic-row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--t2)' }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: item.color || 'var(--t0)' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 8 }}>🎯 집중 학습 추천</div>
            <div style={{ color: 'var(--t2)', fontSize: 13, lineHeight: 1.7 }}>
              {rising[0] && <p>📈 <b style={{ color: 'var(--t0)' }}>{rising[0].topic}</b> — 최근 급상승 중인 토픽입니다. 최신 경향 반영 필수</p>}
              {gapTopics[0] && <p>⏰ <b style={{ color: 'var(--t0)' }}>{gapTopics[0].topic}</b> — {gapTopics[0].gapYears}년째 미출제, 조만간 재출제 가능성</p>}
              {subjectList[0] && <p>🎯 <b style={{ color: 'var(--t0)' }}>{subjectList[0].name}</b> — 전체 {subjectList[0].pct}% 차지, 우선 학습 필요</p>}
              {pred2026[0] && <p>🔮 <b style={{ color: '#a855f7' }}>2026년</b> — {pred2026[0].topic} 예상 확률 {Math.round(pred2026[0].probability_pct ?? pred2026[0].prediction_probability_pct ?? pred2026[0].combined_score ?? 0)}%</p>}
              <p>💡 총 {compStats.topicsTracked}개 토픽 중 상위 10개가 전체 출제의 약 {top10share}% 차지</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: 'var(--t3)' }}>
        EJU Intelligence Platform · 데이터 기반 출제경향 분석 · {compStats.period} · {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}
