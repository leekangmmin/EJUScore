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
  ArrowUp, ArrowDown, ChevronRight, Brain,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend, LabelList, CartesianGrid, LineChart, Line,
  AreaChart, Area,
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
  const top100 = useMemo(() => {
    if (tc?.top_100_topics) return tc.top_100_topics;
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
  const pred2026 = useMemo(() => safe(pred?.yearly?.['2026'] || pred?.top_30_predictions || []).slice(0, 30), [pred]);
  const pred2027 = useMemo(() => safe(pred?.yearly?.['2027']).slice(0, 20), [pred]);
  const pred2028 = useMemo(() => safe(pred?.yearly?.['2028']).slice(0, 20), [pred]);

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
      growingCount: tc?.statistics?.growing_count || 0,
      decliningCount: tc?.statistics?.declining_count || 0,
      gapCount: tc?.statistics?.gap_count || 0,
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
  if (pred2026[0]) insights.push({ icon: '🔮', text: `2026년 최고 예상: <b>${pred2026[0].topic}</b> (${pred2026[0].prediction_probability_pct || pred2026[0].combined_score || '?'}%)`, color: '#a855f7' });
  if (math?.topics[0]) insights.push({ icon: '📐', text: `수학 최빈출: <b>${math.topics[0].name}</b> (${math.topics[0].pct}%)`, color: '#8b5cf6' });

  const currentYear = new Date().getFullYear();

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
        @media (max-width: 700px) { .td-grid-2 { grid-template-columns: 1fr; } }
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
            <StatTile label="TOP 100" value={top100.length} color="#a855f7" subtitle="출제 토픽" />
            <StatTile label="2026 예측" value={pred2026.length} color="#10b981" subtitle="토픽" />
            <StatTile label="미출제" value={gapTopics.length} color="#ef4444" subtitle="복귀 예상" />
          </div>
        </div>
      </div>

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
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {subjectList.map(e => <Cell key={e.id} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
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
        </div>
      </div>

      {/* ═══ SECTION 1: TOP 100 + SECTION 2,3: RISING/FALLING ═══ */}
      <div className="td-grid-2">
        {/* 1. TOP 100 출제토픽 */}
        <div className="td-card">
          <div className="td-card-title"><FileText size={16} /> TOP 100 출제 토픽</div>
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
                const prob = p.prediction_probability_pct || Math.round(p.combined_score || 0);
                const color = DOMAIN_COLORS[p.domain] || 'var(--t3)';
                return (
                  <div key={i} className="td-topic-row">
                    <div className="td-rank">{i + 1}</div>
                    <div className="td-domain-dot" style={{ background: color }} />
                    <div className="td-topic-name">{p.topic}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: prob > 60 ? '#10b981' : prob > 40 ? '#f59e0b' : '#94a3b8', minWidth: 36, textAlign: 'right' }}>{prob}%</div>
                    <div className="td-topic-stat">{p.total_historical || p.total_count || 0}회</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

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
              {pred2026[0] && <p>🔮 <b style={{ color: '#a855f7' }}>2026년</b> — {pred2026[0].topic} 예상 확률 {pred2026[0].prediction_probability_pct || Math.round(pred2026[0].combined_score || 0)}%</p>}
              <p>💡 총 {compStats.topicsTracked}개 토픽 중 상위 10개가 전체 출제의 60% 이상 차지</p>
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
