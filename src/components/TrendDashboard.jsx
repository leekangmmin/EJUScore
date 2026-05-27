// EJU 기출 트렌드 분석 대시보드 — 문제 내용 미포함 (저작권 준수)
import { useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, AlertTriangle, Target, Lightbulb,
  CalendarDays, BookOpen, Globe, Landmark, Banknote, Users,
  Hash, ArrowUpRight, ChevronRight, Layers, Sigma,
} from 'lucide-react';
import TREND_DATA from '../data/ejuTrendData';

const CARD = {
  background: 'var(--bg2)',
  border: '1px solid var(--bd0)',
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
};

function InfoBadge({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color || 'var(--t0)' }}>{value}</span>
    </div>
  );
}

function ProgressBar({ value, color, height = 6 }) {
  return (
    <div style={{ width: '100%', height, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${Math.min(100, value)}%`, height: '100%', background: color || 'var(--blue)', borderRadius: 3, transition: 'width 0.8s ease' }} />
    </div>
  );
}

function DomainCard({ domain, icon: Icon }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${domain.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={domain.color} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)' }}>{domain.name}</div>
          <div style={{ fontSize: 10, color: 'var(--t2)' }}>문항 {domain.qRange} · 회당 {domain.avgPerExam}문항</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: 'var(--t2)' }}>출제 비중</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: domain.color }}>{(domain.weight * 100).toFixed(0)}%</span>
      </div>
      <ProgressBar value={domain.weight * 100} color={domain.color} />
    </div>
  );
}

function EraCard({ era }) {
  const domainIcons = { 경제: Banknote, 정치: Landmark, 역사: BookOpen, 지리: Globe, 사회: Users };
  const mathIcons = { 함수: Sigma, 계산: Hash, 도형: Layers, 확률: BarChart3, 정수: Hash };
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)' }}>{era.range}</span>
        <span style={{ fontSize: 10, color: 'var(--t2)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6 }}>{era.era}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#3b82f6', marginBottom: 4 }}>종합과목</div>
          {era.comp.focus.map((f, i) => <div key={i} style={{ fontSize: 10, color: 'var(--t2)', marginBottom: 2 }}>· {f}</div>)}
          <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 4, fontStyle: 'italic' }}>{era.comp.note}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#10b981', marginBottom: 4 }}>수학 코스1</div>
          {era.math.focus.map((f, i) => <div key={i} style={{ fontSize: 10, color: 'var(--t2)', marginBottom: 2 }}>· {f}</div>)}
          <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 4, fontStyle: 'italic' }}>{era.math.note}</div>
        </div>
      </div>
    </div>
  );
}

function MistakeCard({ mistake, idx }) {
  const freqColors = { high: '#ef4444', mid: '#f59e0b', low: '#3b82f6' };
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, marginBottom: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: `${freqColors[mistake.freq]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: freqColors[mistake.freq], fontWeight: 700 }}>
        {idx + 1}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--t0)', fontWeight: 500, marginBottom: 2 }}>{mistake.desc}</div>
        <div style={{ fontSize: 10, color: 'var(--t2)' }}>💡 {mistake.tip}</div>
        <div style={{ fontSize: 9, color: freqColors[mistake.freq], marginTop: 2 }}>
          {mistake.freq === 'high' ? '⚠️ 빈출' : mistake.freq === 'mid' ? '⚡ 보통' : '✅ 소수'}
        </div>
      </div>
    </div>
  );
}

function RoadmapCard({ item, isMath }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, marginBottom: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: isMath ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: isMath ? '#10b981' : '#3b82f6' }}>
        {item.priority}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t0)' }}>{item.phase}</span>
          <span style={{ fontSize: 11, color: 'var(--t2)' }}>{item.time}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>{item.topic}</div>
        <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>목표 {item.target}</div>
      </div>
    </div>
  );
}

export default function TrendDashboard() {
  const [tab, setTab] = useState('overview');
  const td = TREND_DATA;

  const totalAnalyzed = useMemo(() => td.sourceStats.mathProblems + td.sourceStats.compProblems, []);

  const tabs = [
    { id: 'overview', label: '개요', Icon: BarChart3 },
    { id: 'domains', label: '영역별 비중', Icon: Target },
    { id: 'eras', label: '시대별 트렌드', Icon: CalendarDays },
    { id: 'mistakes', label: '오답 분석', Icon: AlertTriangle },
    { id: 'roadmap', label: '개선 로드맵', Icon: TrendingUp },
  ];

  const tabBarStyle = (active) => ({
    background: active ? 'var(--blue)' : 'transparent',
    color: active ? '#fff' : 'var(--t2)',
    border: active ? 'none' : '1px solid var(--bd1)',
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ ...CARD, padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t0)', marginBottom: 2 }}>
            <TrendingUp size={18} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--blue)' }} />
            EJU 기출 트렌드 인사이트
          </div>
          <div style={{ fontSize: 11, color: 'var(--t2)' }}>
            <CalendarDays size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {td.sourceStats.yearRange} · {td.sourceStats.totalFiles}개 파일 분석
            <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--t3)' }}>⚖️ 저작권 보호 통계</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--blue)' }}>{totalAnalyzed}</div>
          <div style={{ fontSize: 9, color: 'var(--t3)' }}>문제 분석</div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={tabBarStyle(tab === t.id)}>
            <t.Icon size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ====== 개요 ====== */}
      {tab === 'overview' && (
        <>
          <div style={{ ...CARD }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 12 }}>📊 수집 현황</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              <InfoBadge label="수학 문제" value={`${td.sourceStats.mathProblems}개`} color="#10b981" />
              <InfoBadge label="종합 문제" value={`${td.sourceStats.compProblems}개`} color="#3b82f6" />
              <InfoBadge label="답안지" value={`${td.sourceStats.mathAnswers + td.sourceStats.compAnswers}개`} color="#a855f7" />
              <InfoBadge label="커버 기간" value={td.sourceStats.yearRange} color="#f59e0b" />
              <InfoBadge label="커버 년수" value={`${td.sourceStats.totalExamYears}년`} color="#ec4899" />
            </div>
          </div>

          <div style={{ ...CARD }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 8 }}>🔥 핵심 인사이트</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 12, padding: 14, border: '1px solid rgba(16,185,129,0.12)' }}>
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginBottom: 4 }}>최다 출제 (수학)</div>
                <div style={{ fontSize: 13, color: 'var(--t0)', fontWeight: 600 }}>{td.summary.mostFrequentMath}</div>
              </div>
              <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: 12, padding: 14, border: '1px solid rgba(59,130,246,0.12)' }}>
                <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginBottom: 4 }}>최다 출제 (종합)</div>
                <div style={{ fontSize: 13, color: 'var(--t0)', fontWeight: 600 }}>{td.summary.mostFrequentComp}</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 12, padding: 14, border: '1px solid rgba(239,68,68,0.12)' }}>
                <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>최고 난도 (수학)</div>
                <div style={{ fontSize: 13, color: 'var(--t0)', fontWeight: 600 }}>{td.summary.toughestMath}</div>
              </div>
              <div style={{ background: 'rgba(168,85,247,0.06)', borderRadius: 12, padding: 14, border: '1px solid rgba(168,85,247,0.12)' }}>
                <div style={{ fontSize: 11, color: '#a855f7', fontWeight: 600, marginBottom: 4 }}>최고 난도 (종합)</div>
                <div style={{ fontSize: 13, color: 'var(--t0)', fontWeight: 600 }}>{td.summary.toughestComp}</div>
              </div>
            </div>
          </div>

          <div style={{ ...CARD }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 8 }}>🤔 당신을 위한 조언</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.8 }}>
              <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--t0)' }}>경제(35%)</strong>와 <strong style={{ color: 'var(--t0)' }}>정치(26%)</strong>가 종합과목의 61%를 차지합니다.
                이 두 영역에 집중하면 단기간에 큰 점수 향상이 가능합니다.
              </p>
              <p style={{ margin: '6px 0 0' }}>
                수학은 <strong style={{ color: 'var(--t0)' }}>이차함수(23%)</strong>와 <strong style={{ color: 'var(--t0)' }}>식과 계산(20%)</strong>이 핵심입니다.
                특히 이차함수 그래프 문제는 매회 1~2문항씩 꾸준히 출제됩니다.
              </p>
              <p style={{ margin: '6px 0 0', color: '#f59e0b' }}>
                🎯 목표: 종합과목 160+점, 수학 150+점을 위해 '개선 로드맵' 탭의 단계별 계획을 따라보세요.
              </p>
            </div>
          </div>
        </>
      )}

      {/* ====== 영역별 비중 ====== */}
      {tab === 'domains' && (
        <>
          <div style={{ ...CARD }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 12 }}>
              <BookOpen size={15} style={{ verticalAlign: 'middle', marginRight: 6, color: '#3b82f6' }} />
              종합과목 5대 영역 출제 비중
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {td.compDomainWeights.map(d => {
                const icons = { economy: Banknote, politics: Landmark, history: BookOpen, geography: Globe, society: Users };
                return <DomainCard key={d.id} domain={d} icon={icons[d.id] || Hash} />;
              })}
            </div>
          </div>

          <div style={{ ...CARD }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 12 }}>
              <Sigma size={15} style={{ verticalAlign: 'middle', marginRight: 6, color: '#10b981' }} />
              수학 코스1 6대 주제 출제 비중
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {td.mathTopicWeights.map(t => {
                const icons = { 'quad-func': TrendingUp, 'calc-expr': Hash, 'geo-measure': Layers, 'prob-count': BarChart3, 'int-theory': Hash, 'geo-props': Target };
                return (
                  <div key={t.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${t.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp size={14} color={t.color} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)' }}>{t.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--t3)' }}>{t.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: 'var(--t2)' }}>출제 비중</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{(t.weight * 100).toFixed(0)}%</span>
                    </div>
                    <ProgressBar value={t.weight * 100} color={t.color} />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ====== 시대별 트렌드 ====== */}
      {tab === 'eras' && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 12 }}>
            <CalendarDays size={15} style={{ verticalAlign: 'middle', marginRight: 6, color: '#f59e0b' }} />
            시대별 출제 트렌드 변화
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
            {td.eraTrends.map((e, i) => <EraCard key={i} era={e} />)}
          </div>
        </div>
      )}

      {/* ====== 오답 분석 ====== */}
      {tab === 'mistakes' && (
        <div style={{ ...CARD }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 4 }}>
            <AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: 6, color: '#ef4444' }} />
            한국 수험생 공통 오답 유형
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 12 }}>실제 EJU 수험생들이 가장 많이 틀리는 유형과 해결 팁입니다.</div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6', marginBottom: 8 }}>종합과목</div>
            {td.commonMistakes.comprehensive.map((m, i) => <MistakeCard key={i} mistake={m} idx={i} />)}
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981', marginBottom: 8 }}>수학 코스1</div>
            {td.commonMistakes.mathCourse1.map((m, i) => <MistakeCard key={i} mistake={m} idx={i} />)}
          </div>
        </div>
      )}

      {/* ====== 개선 로드맵 ====== */}
      {tab === 'roadmap' && (
        <>
          <div style={{ ...CARD }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 4 }}>
              <TrendingUp size={15} style={{ verticalAlign: 'middle', marginRight: 6, color: '#10b981' }} />
              수학 코스1 개선 로드맵
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 10 }}>단계별로 따라하면 150+점 목표 달성</div>
            {td.roadmap.math.map((r, i) => <RoadmapCard key={i} item={r} isMath />)}
          </div>

          <div style={{ ...CARD }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 4 }}>
              <Lightbulb size={15} style={{ verticalAlign: 'middle', marginRight: 6, color: '#3b82f6' }} />
              종합과목 개선 로드맵
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 10 }}>6주 프로그램으로 160+점 목표 달성</div>
            {td.roadmap.comprehensive.map((r, i) => <RoadmapCard key={i} item={r} />)}
          </div>
        </>
      )}

      {/* 푸터 */}
      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 10, color: 'var(--t3)' }}>
        <ArrowUpRight size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        분석 기준: {td.sourceStats.yearRange} ({td.sourceStats.totalFiles}개 파일)
        <span style={{ marginLeft: 8 }}>⚖️ 문제 저작권 침해 없음</span>
      </div>
    </div>
  );
}
