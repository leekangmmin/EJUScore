// EJU 출제경향 — 기출 사전분석 뱅크(하드코딩) + 내 업로드 자료를 문항 단위로 집계.
// 핵심: 시험 1개=1문항이 아니라, 각 기출을 개별 문항(~34/회)으로 쪼개 과목별 출제 비중을 낸다.
// 데이터: src/data/ejuPastExamBank.js (배포 시 기본 표시) + localStorage 'eju_photo_questions'(내 업로드).
import { useMemo } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, FileText, Inbox,
  CalendarDays, Layers, Target, Gauge, Sparkles, Calculator, BookOpen,
  Image, Clock, Globe2, Coins, Landmark,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend, LabelList, CartesianGrid,
} from 'recharts';
import { PAST_EXAM_BANK } from '../data/ejuPastExamBank';

/* ── 과목 메타 ── */
const SUBJECT_MAP = {
  economy:   { name: '경제',   color: '#10b981', icon: '💰' },
  politics:  { name: '정치',   color: '#ef4444', icon: '🏛️' },
  geography: { name: '지리',   color: '#0ea5e9', icon: '🌍' },
  history:   { name: '역사',   color: '#8b5cf6', icon: '📖' },
  society:   { name: '사회',   color: '#f59e0b', icon: '👥' },
  unknown:   { name: '미분류', color: '#94a3b8', icon: '❓' },
};
const COMP_KEYS = ['economy', 'politics', 'geography', 'history', 'society'];

const CARD = { background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 18, padding: 24, marginBottom: 20 };
const AXIS_COLOR = '#8B95A1';
const GRID_COLOR = 'rgba(148,163,184,0.18)';
const TOOLTIP_STYLE = { background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 10, fontSize: 12, color: 'var(--t0)', boxShadow: '0 8px 24px rgba(0,27,55,0.12)' };

/* ── 내 업로드 로드(뱅크에 없는 새 자료만 추가 집계, 중복 방지) ── */
function loadUserEntries() {
  try { return JSON.parse(localStorage.getItem('eju_photo_questions') || '[]'); }
  catch { return []; }
}

/* ── 집계 ── */
function buildModel() {
  const jk = PAST_EXAM_BANK.jongkwa;
  const subj = { ...jk.subjectTotals };               // 뱅크 종과 과목별 문항 수
  let totalQ = jk.totalQuestions;
  const bankNames = new Set(jk.perExam.map((e) => e.name));

  // 내 업로드: 뱅크에 없는 새 자료만 문항 단위로 추가
  const userEntries = loadUserEntries();
  let userNewExams = 0, userNewQ = 0;
  userEntries.forEach((e) => {
    if (bankNames.has(e.examName)) return;             // 뱅크에 이미 있는 기출 → 중복 방지
    const qs = e.parsed?.questions;
    if (!Array.isArray(qs) || qs.length < 3) return;
    userNewExams++;
    qs.forEach((q) => {
      const st = SUBJECT_MAP[q.subjectType] ? q.subjectType : 'unknown';
      if (st !== 'unknown') { subj[st] = (subj[st] || 0) + 1; totalQ++; userNewQ++; }
    });
  });

  const subjectList = COMP_KEYS
    .map((k) => ({ id: k, ...SUBJECT_MAP[k], count: subj[k] || 0, pct: totalQ ? Math.round(((subj[k] || 0) / totalQ) * 100) : 0 }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  // 연도별(절대 적층) — 표본(회차) 함께 보관
  const byYear = jk.byYear.map((y) => ({
    year: String(y.year), exams: y.exams, numQ: y.numQ,
    경제: y.economy, 정치: y.politics, 지리: y.geography, 역사: y.history, 사회: y.society,
  }));

  // 과목별 추이(초기 vs 최근) — 회당 평균 문항으로 비교
  const years = jk.byYear;
  const early = years.slice(0, Math.min(6, years.length));
  const late = years.slice(-Math.min(6, years.length));
  const perExamAvg = (slice, key) => {
    const ex = slice.reduce((s, y) => s + y.exams, 0);
    const q = slice.reduce((s, y) => s + y[key], 0);
    return ex ? q / ex : 0;
  };
  const trend = {};
  COMP_KEYS.forEach((k) => {
    const a = perExamAvg(early, k), b = perExamAvg(late, k);
    trend[k] = { early: a, late: b, dir: b - a > 0.8 ? 'up' : b - a < -0.8 ? 'down' : 'flat', delta: b - a };
  });

  // 수학 토픽
  const math = PAST_EXAM_BANK.math;
  const mathTopics = math
    ? Object.entries(math.topics)
        .map(([id, name]) => ({ id, name, exams: math.topicExams[id] || 0, total: math.totalExams,
          pct: Math.round(((math.topicExams[id] || 0) / math.totalExams) * 100) }))
        .filter((t) => t.exams > 0)
        .sort((a, b) => b.exams - a.exams)
    : [];

  // 심층 차원(뱅크 하드코딩) — 자료유형/역사 시대/지리 지역/경제·정치 세부영역
  const sumCounts = (arr) => (arr || []).reduce((s, x) => s + x.count, 0);
  const withPct = (arr, denom) => (arr || []).map((x) => ({ ...x, pct: denom ? Math.round((x.count / denom) * 100) : 0 }));
  const material = withPct(jk.material, jk.totalQuestions);
  const history = withPct(jk.history, jk.subjectTotals.history);
  const regions = withPct(jk.regions, jk.subjectTotals.geography);
  const econSub = withPct(jk.econSub, jk.subjectTotals.economy);
  const polSub = withPct(jk.polSub, jk.subjectTotals.politics);

  return {
    jk, totalQ, subjectList, byYear, trend, math, mathTopics,
    userNewExams, userNewQ,
    material, history, regions, econSub, polSub,
    canonicalTotal: jk.canonicalTotal || 38,
    canonicalAll: jk.canonicalAll || (jk.totalExams * 38),
    recallPct: jk.recallPct || Math.round((jk.totalQuestions / (jk.totalExams * 38)) * 100),
    avgRecognized: Math.round(jk.totalQuestions / jk.totalExams),
    avgPerExam: jk.canonicalTotal || 38,
    compShare: { pe: Math.round(((subj.economy + subj.politics) / totalQ) * 100) },
  };
}

/* ── 인사이트 문장 생성 ── */
function buildInsights(m) {
  const out = [];
  const top = m.subjectList[0];
  if (top) out.push({ icon: '🎯', text: `<b>${top.name}</b> 분야가 <b>${top.pct}%</b>로 가장 많이 출제돼요`, color: top.color });
  out.push({ icon: '⚖️', text: `정치·경제가 전체의 <b>${m.compShare.pe}%</b> — 3문제 중 2문제 수준`, color: '#10b981' });
  // 가장 크게 증가/감소한 과목
  let up = null, down = null;
  COMP_KEYS.forEach((k) => {
    const t = m.trend[k];
    if (!up || t.delta > up.d) up = { k, d: t.delta };
    if (!down || t.delta < down.d) down = { k, d: t.delta };
  });
  if (up && up.d > 0.8) out.push({ icon: '📈', text: `<b>${SUBJECT_MAP[up.k].name}</b> 출제가 최근 늘어나는 추세예요`, color: '#ef4444' });
  // 자료해석 비중
  const passagePct = m.material?.find((x) => x.id === 'passage')?.pct ?? null;
  if (passagePct != null) out.push({ icon: '🗺️', text: `문항의 <b>${100 - passagePct}%</b>가 지도·그래프·표 등 <b>자료 해석형</b>이에요`, color: '#0ea5e9' });
  // 역사 최빈 시대
  if (m.history?.[0]) out.push({ icon: '📜', text: `역사는 <b>${m.history[0].name}</b> 관련 출제가 가장 많아요`, color: '#8b5cf6' });
  // 지리 최빈 지역
  if (m.regions?.[0]) out.push({ icon: '🌍', text: `지리는 <b>${m.regions[0].name}</b> 지역이 최다 출제`, color: '#0284c7' });
  if (m.mathTopics[0]) out.push({ icon: '📐', text: `수학은 <b>${m.mathTopics[0].name}</b>이 ${m.mathTopics[0].pct}%로 최빈출`, color: '#8b5cf6' });
  return out.slice(0, 6);
}

/* ── 작은 컴포넌트 ── */
function SectionTitle({ icon: Icon, color, children, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t0)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && <Icon size={18} color={color} />}{children}
      </div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--t2)', marginTop: 4, lineHeight: 1.6 }}>{sub}</div>}
    </div>
  );
}
function StatTile({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg1)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--bd0)' }}>
      <div style={{ fontSize: 11.5, color: 'var(--t2)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || 'var(--t0)' }}>{value}</div>
    </div>
  );
}
function TrendArrow({ dir }) {
  if (dir === 'up') return <TrendingUp size={13} color="#ef4444" />;
  if (dir === 'down') return <TrendingDown size={13} color="#0ea5e9" />;
  return <Minus size={13} color="var(--t3)" />;
}
function SubjectCard({ s, trend, avgPerExam }) {
  const t = trend[s.id] || {};
  const label = t.dir === 'up' ? '증가 추세' : t.dir === 'down' ? '감소 추세' : '유지';
  return (
    <div style={{ background: 'var(--bg1)', borderRadius: 14, padding: 16, border: '1px solid var(--bd0)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: `${s.color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t0)' }}>{s.name}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{s.count.toLocaleString()}문항 · 회당 약 {(t.late || 0).toFixed(1)}문제</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1, flexShrink: 0 }}>{s.pct}%</div>
      </div>
      <div style={{ height: 7, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--t2)', alignItems: 'center' }}>
        <span>초기→최근 추이</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: t.dir === 'up' ? '#ef4444' : t.dir === 'down' ? '#0ea5e9' : 'var(--t3)' }}>
          <TrendArrow dir={t.dir} />{label}
        </span>
      </div>
    </div>
  );
}

/* ── 심층 차원 막대(자료유형·시대·지역·세부영역 공용) ── */
function DimBars({ items, color, unit = '문항', max }) {
  if (!items || items.length === 0) return <div style={{ fontSize: 12, color: 'var(--t3)' }}>분석 가능한 데이터가 부족합니다.</div>;
  const peak = max || Math.max(...items.map((x) => x.count), 1);
  const grad = `linear-gradient(90deg, ${color}, ${color}b3)`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {items.map((t) => {
        const w = Math.round((t.count / peak) * 100);
        return (
          <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 116, fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
            <div style={{ flex: 1, height: 22, background: 'var(--bg3)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: `${Math.max(w, 2)}%`, height: '100%', background: grad, borderRadius: 6, transition: 'width .4s' }} />
              <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: w > 22 ? '#fff' : 'var(--t2)', right: w > 22 ? 8 : 'auto', left: w > 22 ? 'auto' : `calc(${Math.max(w, 2)}% + 8px)` }}>
                {t.count}{unit}{t.pct != null ? ` · ${t.pct}%` : ''}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 4px' }}>
      <div style={{ ...CARD, textAlign: 'center', padding: '48px 28px' }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, margin: '0 auto 18px', background: 'rgba(49,130,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Inbox size={34} color="var(--blue)" />
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--t0)', marginBottom: 8 }}>분석할 기출 데이터가 없어요</div>
      </div>
    </div>
  );
}

/* ── 메인 ── */
export default function TrendDashboard() {
  const m = useMemo(buildModel, []);
  if (!m || m.totalQ === 0) return <EmptyState />;
  const insights = buildInsights(m);

  const barData = m.subjectList.map((x) => ({ name: x.name, 문항: x.count, color: x.color }));
  const pieData = m.subjectList.map((x) => ({ name: x.name, value: x.count, color: x.color }));
  const [y0, y1] = m.jk.yearRange;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 4px' }}>
      {/* 헤더 */}
      <div style={{ ...CARD, padding: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--t0)', display: 'flex', alignItems: 'center', gap: 9, letterSpacing: '-0.3px' }}>
            <TrendingUp size={24} color="var(--blue)" />EJU 기출 출제경향
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--t2)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <CalendarDays size={13} />
            종합과목 {m.jk.totalExams}회분 ({y0}~{y1}) · 회당 {m.canonicalTotal}문항 중 평균 {m.avgRecognized}문항 인식({m.recallPct}%)
            {m.math && <> · 수학 코스1 {m.math.totalExams}회분</>}
            {m.userNewExams > 0 && <span style={{ fontSize: 10.5, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 6 }}>+ 내 자료 {m.userNewExams}건</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--blue)', lineHeight: 1 }}>{m.totalQ.toLocaleString()}</div>
          <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 2 }}>분석 문항</div>
        </div>
      </div>

      {/* 핵심 인사이트 */}
      <div style={CARD}>
        <SectionTitle icon={Sparkles} color="#f59e0b">핵심 인사이트</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {insights.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg1)', border: '1px solid var(--bd0)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>{it.icon}</div>
              <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: it.text }} />
            </div>
          ))}
        </div>
      </div>

      {/* 수집 현황 */}
      <div style={CARD}>
        <SectionTitle icon={Layers} color="var(--blue)">수집 현황</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <StatTile label="분석 문항" value={`${m.jk.totalQuestions.toLocaleString()}개`} color="#3182F6" />
          <StatTile label="기출 연도" value={`${y0}~${y1}`} color="#1B64DA" />
          <StatTile label="회당 공식 문항" value={`${m.canonicalTotal}문제`} color="#0ea5e9" />
          <StatTile label="OCR 인식률" value={`${m.recallPct}%`} color="#f59e0b" />
          <StatTile label="수학 회분" value={`${m.math ? m.math.totalExams : 0}회`} color="#8b5cf6" />
          <StatTile label="내 추가 자료" value={`${m.userNewExams}건`} color="#10b981" />
        </div>
      </div>

      {/* 과목별 출제 비중 */}
      <div style={CARD}>
        <SectionTitle icon={BarChart3} color="#3b82f6" sub={`기출 ${m.jk.totalExams}회분을 문항 단위로 쪼개 과목을 자동 분류한 비중입니다. (전체 ${m.totalQ.toLocaleString()}문항)`}>종합과목 과목별 출제 비중</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'center' }}>
          <ResponsiveContainer width="100%" height={Math.max(200, barData.length * 46)}>
            <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
              <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: AXIS_COLOR }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--t1)' }} tickLine={false} axisLine={false} width={54} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v.toLocaleString()}문항`, '출제 수']} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Bar dataKey="문항" radius={[0, 6, 6, 0]} barSize={22}>
                {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
                <LabelList dataKey="문항" position="right" style={{ fontSize: 11, fill: 'var(--t2)', fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={92} paddingAngle={2} stroke="none">
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                <LabelList dataKey="value" position="outside" style={{ fontSize: 11, fill: 'var(--t2)' }} />
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v.toLocaleString()}문항`, n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 연도별 출제 추이 */}
      <div style={CARD}>
        <SectionTitle icon={TrendingUp} color="#10b981" sub="연도별 과목 구성 변화입니다. 막대 높이는 그 해 출제 문항 수(회차 수에 비례).">연도별 출제 추이</SectionTitle>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={m.byYear} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 10.5, fill: AXIS_COLOR }} tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={48} />
            <YAxis tick={{ fontSize: 11, fill: AXIS_COLOR }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.08)' }}
              formatter={(v, n) => [`${v}문항`, n]}
              labelFormatter={(l) => { const r = m.byYear.find((x) => x.year === l); return `${l}년 · ${r ? r.exams : 0}회 · ${r ? r.numQ : 0}문항`; }} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            {['경제', '정치', '지리', '역사', '사회'].map((k) => {
              const id = { 경제: 'economy', 정치: 'politics', 지리: 'geography', 역사: 'history', 사회: 'society' }[k];
              return <Bar key={k} dataKey={k} stackId="a" fill={SUBJECT_MAP[id].color} radius={k === '사회' ? [4, 4, 0, 0] : 0} maxBarSize={34} />;
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 과목별 상세 */}
      <div style={CARD}>
        <SectionTitle icon={Target} color="#10b981" sub="과목별 문항 수·비중·회당 출제량·초기 대비 최근 추이.">종합과목 과목별 상세</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {m.subjectList.map((x) => <SubjectCard key={x.id} s={x} trend={m.trend} avgPerExam={m.avgPerExam} />)}
        </div>
      </div>

      {/* 제시자료 유형 — 어떤 그래프·지도·표가 나오나 */}
      {m.material.length > 0 && (
        <div style={CARD}>
          <SectionTitle icon={Image} color="#0ea5e9" sub={`문항이 어떤 자료를 제시하는지 분류했습니다. 지도·그래프·표 등 자료 해석형이 전체의 약 ${100 - (m.material.find((x) => x.id === 'passage')?.pct || 0)}%.`}>제시자료 유형 — 무슨 그래프·자료가 나오나</SectionTitle>
          <DimBars items={m.material} color="#0ea5e9" />
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 12, lineHeight: 1.6 }}>
            ※ 지도·지형도, 막대·꺾은선·원 그래프와 모식도, 통계표, 연표·연대순 배열, 사진·풍자화·사료로 분류. 순수 지문 독해는 "문장 독해".
          </div>
        </div>
      )}

      {/* 역사 — 어느 시대·사건이 나오나 */}
      {m.history.length > 0 && (
        <div style={CARD}>
          <SectionTitle icon={Clock} color="#8b5cf6" sub={`역사 ${m.jk.subjectTotals.history}문항에서 자주 등장하는 시대·사건입니다(한 문항이 여러 시대를 다룰 수 있어 합계는 문항 수보다 클 수 있음).`}>역사 — 어느 시대·사건이 집중 출제되나</SectionTitle>
          <DimBars items={m.history.slice(0, 8)} color="#8b5cf6" unit="회" />
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 12, lineHeight: 1.6 }}>
            ※ <b>양차 세계대전·러시아혁명·제국주의·냉전</b> 등 19세기 후반~20세기 근현대사가 압도적입니다. 시민혁명·산업혁명·근대 동아시아(아편전쟁·메이지유신)도 단골.
          </div>
        </div>
      )}

      {/* 지리 — 어느 지역이 나오나 */}
      {m.regions.length > 0 && (
        <div style={CARD}>
          <SectionTitle icon={Globe2} color="#0ea5e9" sub={`지리 ${m.jk.subjectTotals.geography}문항에서 다뤄진 지역 분포입니다.`}>지리 — 어느 지역이 자주 나오나</SectionTitle>
          <DimBars items={m.regions.slice(0, 8)} color="#0284c7" unit="회" />
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 12, lineHeight: 1.6 }}>
            ※ <b>유럽</b>이 최다, 그다음 아시아 각 지역과 아프리카가 고르게 출제됩니다. 기후·지형·인구·자원·무역을 지역과 엮어 묻습니다.
          </div>
        </div>
      )}

      {/* 경제·정치 세부영역 */}
      {(m.econSub.length > 0 || m.polSub.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {m.econSub.length > 0 && (
            <div style={CARD}>
              <SectionTitle icon={Coins} color="#10b981" sub={`경제 ${m.jk.subjectTotals.economy}문항의 세부영역 분포(다중 라벨).`}>경제 — 어느 부분이 집중 출제되나</SectionTitle>
              <DimBars items={m.econSub} color="#10b981" unit="회" />
            </div>
          )}
          {m.polSub.length > 0 && (
            <div style={CARD}>
              <SectionTitle icon={Landmark} color="#ef4444" sub={`정치 ${m.jk.subjectTotals.politics}문항의 세부영역 분포(다중 라벨).`}>정치 — 어느 부분이 집중 출제되나</SectionTitle>
              <DimBars items={m.polSub} color="#ef4444" unit="회" />
            </div>
          )}
        </div>
      )}

      {/* 수학 코스1 토픽 */}
      {m.mathTopics.length > 0 && (
        <div style={CARD}>
          <SectionTitle icon={Calculator} color="#8b5cf6" sub={`수학 코스1 ${m.math.totalExams}회분에서 단원별 출제 빈도(회차 수)입니다.`}>수학 코스1 출제 토픽</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {m.mathTopics.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 120, fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', flexShrink: 0, textAlign: 'right' }}>{t.name}</div>
                <div style={{ flex: 1, height: 24, background: 'var(--bg3)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: `${t.pct}%`, height: '100%', background: 'linear-gradient(90deg,#8b5cf6,#a78bfa)', borderRadius: 6, transition: 'width .4s' }} />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 700, color: t.pct > 12 ? '#fff' : 'var(--t2)', left: t.pct > 12 ? 'auto' : `calc(${t.pct}% + 8px)` }}>
                    {t.exams}/{t.total}회 · {t.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 12, lineHeight: 1.6 }}>
            ※ 수식 위주 시험 특성상 토픽 분류는 키워드 추정치입니다. 삼각비·수와 식·경우의 수·확률·정수가 매 회 거의 빠짐없이 출제됩니다.
          </div>
        </div>
      )}

      {/* 기출 커버리지 */}
      <div style={CARD}>
        <SectionTitle icon={BookOpen} color="#3182F6" sub="분석에 포함된 기출 회차입니다.">기출 커버리지</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 200, overflow: 'auto' }}>
          {m.jk.perExam.map((e) => (
            <span key={e.name} style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', background: 'var(--bg1)', border: '1px solid var(--bd0)', borderRadius: 8, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <FileText size={11} color="var(--blue)" />
              {e.year}{e.round ? ` 제${e.round}회` : ''} · {e.recognized || e.numQ}/{e.total || m.canonicalTotal}문항
            </span>
          ))}
        </div>
      </div>

      {/* 푸터 */}
      <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: 'var(--t3)' }}>
        <Gauge size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        기출 {m.jk.totalExams}회분({m.jk.totalQuestions.toLocaleString()}문항) 사전분석 + 내 업로드 기반 · 과목 분류는 OCR 키워드 추정치
        <span style={{ marginLeft: 8 }}>⚖️ 문제 내용 미저장</span>
      </div>
    </div>
  );
}
