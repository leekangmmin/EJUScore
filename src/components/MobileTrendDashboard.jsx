// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// MobileTrendDashboard — mobile-only (≤768px) view of EJU 출제경향 인텔리전스
//
// Renders the SAME data computed by TrendDashboard, restructured for a
// single narrow column. Desktop JSX is untouched: TrendDashboard branches
// to this component only when useIsMobile() is true.
//
// Design rules followed:
//   • All multi-column grids → single column
//   • All <table> → stacked cards
//   • Sankey is NOT charted on mobile → rendered as a flow list from the
//     same cooc.sankey nodes/links
//   • Collapsible sections via native <details> (no extra state/libraries)
//   • Default-open : 수치요약 · 예측 · TOP토픽 · 영역분석
//   • Default-collapsed : Topic Intelligence · Study Planner · Action Plan
//     · Exam Simulation · Co-occurrence · Sankey
// ═══════════════════════════════════════════════════════════════════
import {
  BarChart3, Sparkles, FileText, Layers, Brain, ListChecks,
  Network, GitBranch, Clock, TrendingUp, TrendingDown, Target,
} from 'lucide-react';

const DOMAIN_COLORS = {
  economy: '#10b981',
  politics: '#ef4444',
  history: '#8b5cf6',
  geography: '#0ea5e9',
  society: '#f59e0b',
};

const BADGE_META = {
  REAL:      { label: 'REAL',      c: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  DERIVED:   { label: 'DERIVED',   c: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  PREDICTED: { label: 'PREDICTED', c: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  UNKNOWN:   { label: 'UNKNOWN',   c: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

function Badge({ kind, size = 9 }) {
  const m = BADGE_META[kind] || BADGE_META.UNKNOWN;
  return (
    <span style={{ fontSize: size, fontWeight: 800, color: m.c, background: m.bg, border: `1px solid ${m.c}55`, padding: '1px 5px', borderRadius: 5, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

const tierColor = (t) => (t === 'S' ? '#ef4444' : t === 'A' ? '#f59e0b' : t === 'B' ? '#0ea5e9' : '#94a3b8');

// ── Collapsible section (native <details>) ──
function Section({ icon, title, badge, defaultOpen = false, children }) {
  return (
    <details open={defaultOpen} style={{ background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
      <summary style={{ listStyle: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, padding: '13px 14px', fontSize: 14, fontWeight: 800, color: 'var(--t0)', userSelect: 'none' }}>
        {icon}
        <span style={{ flex: 1 }}>{title}</span>
        {badge && <Badge kind={badge} />}
        <span className="mtd-chev" style={{ color: 'var(--t3)', fontSize: 12 }}>▾</span>
      </summary>
      <div style={{ padding: '0 14px 14px' }}>{children}</div>
    </details>
  );
}

// ── A single stacked data card (table-row replacement) ──
function RowCard({ accent, children }) {
  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd0)', borderLeft: accent ? `3px solid ${accent}` : '1px solid var(--bd0)', borderRadius: 9, padding: '9px 11px', marginBottom: 6 }}>
      {children}
    </div>
  );
}

// ── label : value line inside a card ──
function KV({ k, v, color }) {
  if (v == null || v === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, lineHeight: 1.7 }}>
      <span style={{ color: 'var(--t3)' }}>{k}</span>
      <span style={{ color: color || 'var(--t1)', fontWeight: 700, textAlign: 'right' }}>{v}</span>
    </div>
  );
}

export default function MobileTrendDashboard({ data }) {
  const {
    compStats, execSummary, pePct,
    pred2026 = [], pred2027 = [], pred2028 = [],
    top100 = [], rising = [], falling = [], gapTopics = [],
    subjectList = [], topicIntel = [],
    studyPlanner, actionPlan = [], sTier = [], aTier = [],
    examSim, coocPairs = [], sankey,
    priorityTopics = [], errorTypes = { types: [], total: 0 },
    expandedTopics = [], coocForTopTopic = [],
    explainForTopTopic = null, explainPred = [],
    cycleIntel = [], coocEdges = [], weakConnectorTopics = [],
    knowledgeGraphData = null, personalAccuracy = {},
  } = data;

  // Build Sankey flow list (index-referenced links → readable rows, grouped by source)
  const sankeyRows = (() => {
    if (!sankey?.links?.length || !sankey?.nodes?.length) return [];
    const name = (i) => sankey.nodes[i]?.name ?? `#${i}`;
    return sankey.links
      .map((l) => ({ from: name(l.source), to: name(l.target), value: l.value || 0 }))
      .sort((a, b) => b.value - a.value);
  })();

  const sTotalContribution = [...sTier, ...aTier]
    .reduce((s, a) => s + (a.score_contribution_pct || 0), 0)
    .toFixed(0);

  return (
    <div style={{ padding: '0 2px 24px' }}>
      <style>{`
        details > summary::-webkit-details-marker { display: none; }
        details > summary { list-style: none; }
        details[open] .mtd-chev { transform: rotate(180deg); }
        .mtd-chev { transition: transform .15s ease; display: inline-block; }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t0)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <BarChart3 size={18} /> EJU 출제경향 인텔리전스
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 4 }}>
          {compStats?.period} · {compStats?.totalQuestions?.toLocaleString()}문항 · {compStats?.topicsTracked}개 토픽
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {[['표준 토픽', top100.length, '#a855f7'], ['2026 예측', pred2026.length, '#10b981'], ['미출제', gapTopics.length, '#ef4444']].map(([l, v, c], i) => (
            <div key={i} style={{ flex: 1, background: 'var(--bg1)', border: '1px solid var(--bd0)', borderRadius: 9, padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div>
              <div style={{ fontSize: 9.5, color: 'var(--t3)', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 수치 요약 (default open) ═══ */}
      {execSummary?.lines?.length > 0 && (
        <Section icon={<Sparkles size={15} color="#10b981" />} title="수치 요약" badge="DERIVED" defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {execSummary.lines.map((ln, i) => {
              const colors = ['#10b981', '#f59e0b', '#0ea5e9'];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--t0)', fontWeight: 600, lineHeight: 1.5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: colors[i] || '#94a3b8', flexShrink: 0, marginTop: 6 }} />
                  {ln}
                </div>
              );
            })}
          </div>
          {execSummary.basis && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 8 }}>근거: {execSummary.basis}</div>}
        </Section>
      )}

      {/* ═══ 2026~2028 예측 (default open) ═══ */}
      <Section icon={<Sparkles size={15} color="#a855f7" />} title="2026~2028 출제 예측" badge="PREDICTED" defaultOpen>
        {[['2026', pred2026], ['2027', pred2027], ['2028', pred2028]].map(([year, list]) => (
          <div key={year} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#a855f7', marginBottom: 6 }}>{year}년 TOP 10</div>
            {list.slice(0, 10).map((p, i) => {
              const prob = Math.round(p.probability_pct ?? p.prediction_probability_pct ?? p.combined_score ?? 0);
              const c = DOMAIN_COLORS[p.domain] || '#94a3b8';
              const pc = prob > 60 ? '#10b981' : prob > 40 ? '#f59e0b' : '#94a3b8';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg1)', borderRadius: 7, marginBottom: 4 }}>
                  <span style={{ width: 16, fontSize: 10.5, color: 'var(--t3)', fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ width: 4, height: 18, borderRadius: 2, background: c, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--t0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.topic}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: pc, minWidth: 34, textAlign: 'right' }}>{prob}%</span>
                  <span style={{ fontSize: 10.5, color: 'var(--t2)', minWidth: 30, textAlign: 'right' }}>{p.total_24yr_count || p.total_historical || p.total_count || 0}회</span>
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ fontSize: 10.5, color: 'var(--t3)', lineHeight: 1.5 }}>
          예측 점수는 4개 독립 신호(베이지안 빈도·마르코프 전이·추세 기울기·최신성)의 합의값입니다(probability_pct). 예측은 과거 빈도 분석이며 실제 출제를 보장하지 않습니다.
        </div>
      </Section>

      {/* ═══ TOP 토픽 (default open) ═══ */}
      <Section icon={<FileText size={15} color="#6366f1" />} title={`전체 ${top100.length}개 출제 토픽 (빈도순)`} defaultOpen>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {top100.slice(0, 50).map((t, i) => {
            const c = DOMAIN_COLORS[t.domain] || '#94a3b8';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg1)', borderRadius: 7, marginBottom: 4 }}>
                <span style={{ width: 18, fontSize: 10.5, color: 'var(--t3)', fontWeight: 700, textAlign: 'center' }}>{i + 1}</span>
                <span style={{ width: 4, height: 18, borderRadius: 2, background: c, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--t0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</span>
                <span style={{ fontSize: 11.5, color: 'var(--t2)' }}>{t.total?.toLocaleString() || 0}회</span>
              </div>
            );
          })}
        </div>

        {/* rising / falling / gap as compact lists */}
        {rising.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><TrendingUp size={13} /> 최근 상승 토픽</div>
            {rising.slice(0, 8).map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'var(--bg1)', borderRadius: 7, marginBottom: 4 }}>
                <span style={{ width: 4, height: 16, borderRadius: 2, background: DOMAIN_COLORS[t.domain] || '#94a3b8', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--t0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#ef4444' }}>+{t.growth}%</span>
                <span style={{ fontSize: 10.5, color: 'var(--t2)' }}>{t.recent5}회</span>
              </div>
            ))}
          </div>
        )}
        {falling.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0ea5e9', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><TrendingDown size={13} /> 최근 하락 토픽</div>
            {falling.slice(0, 6).map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'var(--bg1)', borderRadius: 7, marginBottom: 4 }}>
                <span style={{ width: 4, height: 16, borderRadius: 2, background: DOMAIN_COLORS[t.domain] || '#94a3b8', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--t0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0ea5e9' }}>{t.growth}%</span>
                <span style={{ fontSize: 10.5, color: 'var(--t2)' }}>{t.total}회</span>
              </div>
            ))}
          </div>
        )}
        {gapTopics.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> 장기 미출제 토픽</div>
            {gapTopics.slice(0, 10).map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'var(--bg1)', borderRadius: 7, marginBottom: 4 }}>
                <span style={{ width: 4, height: 16, borderRadius: 2, background: DOMAIN_COLORS[t.domain] || '#94a3b8', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--t0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#f59e0b' }}>{t.gapYears}년</span>
                <span style={{ fontSize: 10.5, color: 'var(--t2)' }}>~{t.lastYear}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ═══ 영역 분석 (default open) ═══ */}
      <Section icon={<Layers size={15} color="#10b981" />} title="영역별 출제 비중" defaultOpen>
        {subjectList.map((s) => (
          <div key={s.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, marginBottom: 3 }}>
              <span style={{ width: 4, height: 16, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 600, color: 'var(--t0)' }}>{s.name}</span>
              <span style={{ fontWeight: 700, color: s.color }}>{s.count?.toLocaleString()}문항</span>
              <span style={{ fontSize: 11, color: 'var(--t2)', minWidth: 34, textAlign: 'right' }}>{s.pct}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--bg1)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 3 }} />
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8, lineHeight: 1.5 }}>
          정치·경제 합산 {pePct}%. 비중이 작은 사회({subjectList.find((s) => s.id === 'society')?.pct ?? 0}%)는 정의 위주로 학습.
        </div>
      </Section>

      {/* ═══ Topic Intelligence (collapsed) ═══ */}
      {topicIntel.length > 0 && (
        <Section icon={<Brain size={15} color="#6366f1" />} title="토픽 인텔리전스" defaultOpen={false}>
          <div style={{ fontSize: 10.5, color: 'var(--t3)', marginBottom: 10, lineHeight: 1.5 }}>
            {topicIntel.length}개 표준 토픽별 지표·예측 점수 (probability_pct)·데이터신뢰도(evidence_pct). 실제 기출 38회 OCR(2005-2025)에서 산출.
          </div>
          {topicIntel.map((t, i) => {
            const c = DOMAIN_COLORS[t.domain] || '#94a3b8';
            const confColor = t.confidence?.tier === '높음' ? '#10b981' : t.confidence?.tier === '보통' ? '#f59e0b' : '#94a3b8';
            return (
              <RowCard key={i} accent={c}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700 }}>#{t.rank}</span>
                  <b style={{ fontSize: 13, color: 'var(--t0)' }}>{t.topic}</b>
                  <span style={{ fontSize: 9.5, color: c, fontWeight: 700, background: 'var(--bg2)', padding: '1px 6px', borderRadius: 5 }}>{t.domain_ko}</span>
                  {t.tier && <span style={{ fontSize: 9.5, fontWeight: 800, color: tierColor(t.tier), background: 'var(--bg2)', padding: '1px 6px', borderRadius: 5 }}>학습 {t.tier}</span>}
                </div>
                <KV k="2026 예측 점수" v={t.probability_pct != null ? `${t.probability_pct}%` : null} color="#a855f7" />
                <KV k="데이터신뢰도" v={t.confidence?.tier != null ? `${t.confidence.tier} (${t.confidence.evidence_pct}%)` : null} color={confColor} />
                <KV k="Risk" v={t.risk_grade ? `${t.risk_grade} (${t.risk_score})` : null} color="#ef4444" />
                <KV k="누적 출제" v={t.total != null ? `${t.total}회` : null} />
                <KV k="최근5년" v={t.recent5 != null ? `${t.recent5}회` : null} />
                <KV k="현재 공백" v={t.gap_now != null ? `${t.gap_now}년` : null} />
              </RowCard>
            );
          })}
        </Section>
      )}

      {/* ═══ Study Planner (collapsed) ═══ */}
      {studyPlanner && (
        <Section icon={<ListChecks size={15} color="#10b981" />} title="학습 플래너" badge="DERIVED" defaultOpen={false}>
          {studyPlanner.basis && <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 10 }}>{studyPlanner.basis}</div>}
          {[['오늘', studyPlanner.today, '#ef4444'], ['이번주', studyPlanner.week, '#f59e0b'], ['이번달', studyPlanner.month, '#10b981']].map(([title, list, col], k) => (
            <div key={k} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: col, marginBottom: 5 }}>{title}</div>
              {(list || []).map((a, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, padding: '4px 8px', background: 'var(--bg1)', borderRadius: 7, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: col, background: 'var(--bg2)', padding: '1px 5px', borderRadius: 4 }}>{a.tier}</span>
                  <span style={{ flex: 1, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.topic}</span>
                  <b style={{ color: 'var(--t2)' }}>{a.hours}h</b>
                </div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {/* ═══ Action Plan (collapsed, table → cards) ═══ */}
      {actionPlan.length > 0 && (
        <Section icon={<ListChecks size={15} color="#10b981" />} title="학생 액션 플랜" defaultOpen={false}>
          <div style={{ fontSize: 10.5, color: 'var(--t3)', marginBottom: 8, lineHeight: 1.5 }}>
            우선도 = 출제 빈도(55%) + 2026 예측 점수(45%). 학습 시간은 100시간 예산을 우선도 비례 배분.
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[['최우선(S)', `${sTier.length}개`, '#ef4444'], ['상위(A)', `${aTier.length}개`, '#f59e0b'], ['S+A 기여', `${sTotalContribution}%`, '#10b981']].map(([l, v, c], i) => (
              <div key={i} style={{ flex: 1, background: 'var(--bg1)', border: '1px solid var(--bd0)', borderRadius: 8, padding: '7px 5px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: c }}>{v}</div>
                <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          {actionPlan.slice(0, 20).map((a, i) => (
            <RowCard key={i} accent={tierColor(a.tier)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700 }}>{a.priority}</span>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: tierColor(a.tier), background: 'var(--bg2)', padding: '1px 6px', borderRadius: 5 }}>{a.tier}</span>
                <b style={{ flex: 1, fontSize: 12.5, color: 'var(--t0)' }}>{a.topic}</b>
                <span style={{ fontSize: 10, color: 'var(--t3)' }}>{a.domain_ko}</span>
              </div>
              <KV k="우선도" v={a.importance} color={tierColor(a.tier)} />
              <KV k="학습시간" v={a.study_hours != null ? `${a.study_hours}h` : null} />
              <KV k="점수기여" v={a.score_contribution_pct != null ? `${a.score_contribution_pct}%` : null} />
              {a.advice && <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 5, lineHeight: 1.45 }}>{a.advice}</div>}
            </RowCard>
          ))}
        </Section>
      )}

      {/* ═══ Exam Simulation (collapsed, table → cards) ═══ */}
      {examSim && (
        <Section icon={<FileText size={15} color="#a855f7" />} title={`${examSim.target_year} 예상 모의고사 구성`} defaultOpen={false}>
          <div style={{ fontSize: 10.5, color: 'var(--t3)', marginBottom: 10, padding: '8px 10px', background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 8, lineHeight: 1.5 }}>
            <b style={{ color: '#a855f7' }}>고지:</b> {examSim.disclaimer}<br />근거: {examSim.basis}
          </div>

          {/* 영역 비중 */}
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>영역 비중 ({examSim.total_questions}문항)</div>
          {(examSim.domain_quota || []).map((q) => (
            <div key={q.domain} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 8px', background: 'var(--bg1)', borderRadius: 7, marginBottom: 4 }}>
              <span style={{ width: 4, height: 14, borderRadius: 2, background: DOMAIN_COLORS[q.domain] || '#94a3b8', flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--t0)' }}>{q.domain_ko}</span>
              <b style={{ color: 'var(--t1)' }}>{q.count}문항</b>
              {q.pct != null && <span style={{ fontSize: 10.5, color: 'var(--t2)' }}>{q.pct}%</span>}
            </div>
          ))}

          {/* 난이도 / 형식 분포 */}
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)', margin: '12px 0 6px' }}>예상 난이도 분포</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(examSim.difficulty_dist || {}).map(([k, v]) => (
              <span key={k} style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 7, background: 'var(--bg1)', border: '1px solid var(--bd0)', color: k === '데이터 없음' ? 'var(--t3)' : 'var(--t1)' }}>
                {k} <b style={{ color: k === '상' ? '#ef4444' : k === '중상' ? '#f59e0b' : 'var(--t1)' }}>{v}문항</b>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)', margin: '12px 0 6px' }}>예상 출제 형식 분포 <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 400 }}>(2005-2025 OCR 기반)</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(examSim.format_dist || {}).map(([k, v]) => (
              <span key={k} style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 7, background: 'var(--bg1)', border: '1px solid var(--bd0)', color: k === '데이터 없음' ? 'var(--t3)' : 'var(--t1)' }}>
                {k} <b>{v}문항</b>
              </span>
            ))}
          </div>

          {/* 청사진 카드화 */}
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)', margin: '12px 0 6px' }}>문항 구성 청사진 ({examSim.total_questions}문항)</div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {(examSim.blueprint || []).map((b, i) => {
              const c = DOMAIN_COLORS[b.domain] || '#94a3b8';
              const nd = (s) => s === '데이터 없음';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, padding: '5px 8px', background: 'var(--bg1)', borderRadius: 7, marginBottom: 4 }}>
                  <span style={{ width: 18, color: 'var(--t3)', textAlign: 'center' }}>{b.q_no}</span>
                  <span style={{ width: 4, height: 16, borderRadius: 2, background: c, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: 'var(--t0)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.topic}
                    <span style={{ color: 'var(--t3)', fontWeight: 400 }}> · {b.domain_ko}</span>
                  </span>
                  <span style={{ color: b.probability_pct != null ? '#a855f7' : 'var(--t3)', fontWeight: 700, minWidth: 30, textAlign: 'right' }}>{b.probability_pct != null ? `${b.probability_pct}%` : '—'}</span>
                  <span style={{ color: nd(b.expected_difficulty) ? 'var(--t3)' : 'var(--t1)', minWidth: 26, textAlign: 'right' }}>{b.expected_difficulty}</span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 8, lineHeight: 1.5 }}>
            ⚠️ 문제 텍스트가 아닌 구성 예측이므로 실제 출제 보장은 아닙니다.
          </div>
        </Section>
      )}

      {/* ═══ Co-occurrence (collapsed) ═══ */}
      {coocPairs.length > 0 && (
        <Section icon={<Network size={15} color="#6366f1" />} title="토픽 동시 출제 (Co-occurrence)" defaultOpen={false}>
          <div style={{ fontSize: 10.5, color: 'var(--t3)', marginBottom: 10, lineHeight: 1.5 }}>
            같은 회차에 함께 등장한 비율(Jaccard) 상위 {Math.min(coocPairs.length, 30)}쌍.
          </div>
          {coocPairs.slice(0, 30).map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, padding: '5px 8px', background: 'var(--bg1)', borderRadius: 7, marginBottom: 4 }}>
              <span style={{ width: 16, color: 'var(--t3)', fontWeight: 700 }}>{i + 1}</span>
              <span style={{ flex: 1, color: 'var(--t0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>{p.a}</b> <span style={{ color: 'var(--t3)' }}>↔</span> <b>{p.b}</b></span>
              <span style={{ width: 56, height: 5, background: 'var(--bg2)', borderRadius: 3, flexShrink: 0, overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${p.rate_pct}%`, height: '100%', background: '#6366f1', borderRadius: 3 }} />
              </span>
              <b style={{ minWidth: 34, textAlign: 'right', color: '#6366f1' }}>{p.rate_pct}%</b>
            </div>
          ))}
        </Section>
      )}

      {/* ═══ Sankey → flow list (collapsed, NO chart) ═══ */}
      {sankeyRows.length > 0 && (
        <Section icon={<GitBranch size={15} color="#6366f1" />} title="영역 → 상위 토픽 흐름 (Flow)" defaultOpen={false}>
          <div style={{ fontSize: 10.5, color: 'var(--t3)', marginBottom: 10, lineHeight: 1.5 }}>
            Sankey 차트와 동일한 데이터입니다. 모바일에서는 흐름(영역 → 토픽)을 굵기(value) 순 리스트로 표시합니다.
          </div>
          {sankeyRows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, padding: '5px 8px', background: 'var(--bg1)', borderRadius: 7, marginBottom: 4 }}>
              <span style={{ flex: 1, color: 'var(--t0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <b>{r.from}</b> <span style={{ color: 'var(--t3)' }}>→</span> <b>{r.to}</b>
              </span>
              <b style={{ color: '#6366f1', minWidth: 28, textAlign: 'right' }}>{r.value}</b>
            </div>
          ))}
        </Section>
      )}

      {/* ═══ NEW MOBILE: 출제경향 × 내 약점 ═══ */}
      {priorityTopics.length > 0 && (
        <Section icon={<Target size={15} color="#ef4444" />} title="출제경향 × 내 약점" defaultOpen={false}>
          <div style={{ fontSize: 10.5, color: 'var(--t3)', marginBottom: 8, lineHeight: 1.5 }}>
            예측 점수 높음 × 내 정답률 낮음 = 최우선 학습. 오답 데이터 <b>{errorTypes.total}건</b> 기반.
          </div>
          {priorityTopics.slice(0, 8).map((p, i) => {
            const pc = p.priorityScore >= 50 ? '#ef4444' : p.priorityScore >= 30 ? '#f59e0b' : '#94a3b8';
            return (
              <RowCard key={i} accent={pc}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--t3)', minWidth: 14 }}>{i + 1}</span>
                  <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--t0)', flex: 1 }}>{p.topic}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: pc, padding: '1px 6px', borderRadius: 4, background: `${pc}18` }}>
                    {p.priorityTier}
                  </span>
                </div>
                <KV k="예측 점수" v={`${p.predictionProbability}%`} color="#a855f7" />
                <KV k="내 정답률" v={p.hasAccuracy ? `${p.personalAccuracy}%` : '데이터 없음'} color={p.hasAccuracy && p.personalAccuracy < 40 ? '#ef4444' : undefined} />
                <KV k="예상 점수 영향" v={`+${p.estimatedScoreImpact}점`} color="#10b981" />
              </RowCard>
            );
          })}
          <div style={{ fontSize: 9.5, color: 'var(--t3)', marginTop: 6, lineHeight: 1.5 }}>
            우선순위 = 예측 점수 × (1 − 내 정답률). 정답률은 오답 데이터 기반 추정치.
          </div>
        </Section>
      )}

      {/* ═══ NEW MOBILE: 오답노트 확장 추천 ═══ */}
      {expandedTopics.length > 0 && (
        <Section icon={<GitBranch size={15} color="#0ea5e9" />} title="오답노트 확장 추천" defaultOpen={false}>
          <div style={{ fontSize: 10.5, color: 'var(--t3)', marginBottom: 8, lineHeight: 1.5 }}>
            <b>{priorityTopics[0]?.topic}</b>과 함께 학습할 토픽.
          </div>
          {expandedTopics.map((r, i) => (
            <RowCard key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--t3)', minWidth: 14 }}>{i + 1}</span>
                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--t0)', flex: 1 }}>{r.topic}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 40, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, r.weight)}%`, height: '100%', background: r.weight >= 70 ? '#ef4444' : r.weight >= 50 ? '#f59e0b' : '#0ea5e9', borderRadius: 2 }} />
                  </div>
                  <b style={{ fontSize: 11, color: 'var(--t0)', minWidth: 30, textAlign: 'right' }}>{r.weight}%</b>
                </div>
              </div>
              <KV k="출처" v={r.sources?.includes('knowledgeGraph') ? '지식그래프' : r.sources?.includes('cooccurrence') ? `동시출제 ${r.co || ''}회` : '연관토픽'} />
            </RowCard>
          ))}
          <div style={{ fontSize: 9.5, color: 'var(--t3)', marginTop: 6 }}>
            * Knowledge Graph({knowledgeGraphData?.total_edges || 0}개 연결) + 동시출제({coocEdges.length}개) 기반.
          </div>
        </Section>
      )}

      {/* ═══ NEW MOBILE: 예측 신뢰도 설명 ═══ */}
      {explainForTopTopic && (
        <Section icon={<Brain size={15} color="#a855f7" />} title="예측 신뢰도 설명" defaultOpen={false}>
          <div style={{ fontSize: 10.5, color: 'var(--t3)', marginBottom: 8, lineHeight: 1.5 }}>
            <b style={{ color: '#a855f7' }}>{priorityTopics[0]?.topic}</b>의 예측 점수 <b>{priorityTopics[0]?.predictionProbability}%</b>를 구성하는 5개 신호.
          </div>
          {[
            { label: 'Bayesian', value: explainForTopTopic.bayesian, c: '#10b981' },
            { label: 'Markov', value: explainForTopTopic.markov, c: '#0ea5e9' },
            { label: 'Trend', value: explainForTopTopic.trend, c: '#f59e0b' },
            { label: 'Momentum', value: explainForTopTopic.momentum, c: '#ec4899' },
            { label: 'Recency', value: explainForTopTopic.recency, c: '#06b6d4' },
            { label: 'Cycle', value: explainForTopTopic.cycle, c: '#8b5cf6' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, padding: '5px 8px', background: 'var(--bg1)', borderRadius: 7 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: item.c, minWidth: 80 }}>{item.label}</span>
              <div style={{ flex: 1, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, item.value ?? 0)}%`, height: '100%', background: item.c, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--t0)', minWidth: 28, textAlign: 'right' }}>{item.value ?? 'N/A'}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 6, padding: '6px 8px', background: 'var(--bg1)', borderRadius: 7, lineHeight: 1.5 }}>
            <b>근거:</b> {explainForTopTopic.basis || '데이터 없음'}
            {explainForTopTopic.model_confidence != null && (
              <span> · <b>신뢰도:</b> {Math.round(explainForTopTopic.model_confidence * 100)}%</span>
            )}
          </div>
        </Section>
      )}

      {/* ═══ NEW MOBILE: 동시출제 학습 추천 ═══ */}
      {coocForTopTopic.length > 0 && (
        <Section icon={<Network size={15} color="#6366f1" />} title="동시출제 학습 추천" defaultOpen={false}>
          <div style={{ fontSize: 10.5, color: 'var(--t3)', marginBottom: 8, lineHeight: 1.5 }}>
            <b>{priorityTopics[0]?.topic}</b>과 실제 시험에서 함께 출제된 토픽.
          </div>
          {coocForTopTopic.map((c, i) => (
            <RowCard key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--t3)', minWidth: 14 }}>{i + 1}</span>
                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--t0)', flex: 1 }}>{c.topic}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 40, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, c.value)}%`, height: '100%', background: c.value >= 70 ? '#ef4444' : c.value >= 50 ? '#f59e0b' : '#0ea5e9', borderRadius: 2 }} />
                  </div>
                  <b style={{ fontSize: 11, color: 'var(--t0)', minWidth: 30, textAlign: 'right' }}>{c.value}%</b>
                </div>
              </div>
              <KV k="동시출제 횟수" v={`${c.co}회`} />
            </RowCard>
          ))}
        </Section>
      )}

    </div>
  );
}
