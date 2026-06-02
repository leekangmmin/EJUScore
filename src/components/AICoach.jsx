// ═══════════════════════════════════════════════════════════════════════
// AI Study Coach v2 — Full Integration
// Goal-driven personalized study planner.
// Connects to computeStudyCoachV2 engine.
//
// Features:
//   Target score input (e.g., 180)
//   Current score reading (e.g., 145)
//   Gap calculation
//   ROI topic computation
//   Weekly plan generation
//   Score projection chart
// ═══════════════════════════════════════════════════════════════════════

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles, Download, RefreshCw, Bot, AlertCircle, Cpu,
  Target, TrendingUp, Clock, BookOpen, BarChart3, ChevronRight,
  Brain, CalendarDays, ArrowUp, Gauge,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, LineChart, Line, AreaChart, Area,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { COMP_MAX } from '../utils/storage';
import { computeStudyCoachV2 } from '../intelligence/studyCoachV2';
import { getDatasetCache, onEngineReady, isEngineInitialized, initializeEngine } from '../intelligence/engineInitializer';

const CARD = { background: 'var(--card-bg)', border: '1px solid var(--bd0)', borderRadius: 18, padding: 24, boxShadow: 'var(--card-shadow)' };
const CARD_SM = { background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 14, padding: 16 };

const COLORS = ['#10b981', '#ef4444', '#a855f7', '#3b82f6', '#f59e0b', '#ec4899', '#06b6d4'];

const DOMAIN_LABELS = {
  economy: '경제', politics: '정치', history: '역사',
  geography: '지리', society: '사회',
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT — AI Study Coach
// ═══════════════════════════════════════════════════════════════════
export default function AICoach({ exams, settings }) {
  // State
  const [targetScore, setTargetScore] = useState(180);
  const [targetDate, setTargetDate] = useState('2026-11-01');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [datasets, setDatasets] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState('all');
  const outputRef = useRef(null);

  // Calculate current score from exams
  const currentScore = useMemo(() => {
    if (exams.length === 0) return 0;
    const compScores = exams
      .filter(e => e.comprehensive?.score != null)
      .map(e => Number(e.comprehensive.score))
      .filter(s => !isNaN(s));
    if (compScores.length === 0) return 0;
    return compScores[compScores.length - 1];
  }, [exams]);

  const gap = Math.max(0, targetScore - currentScore);

  // Load datasets
  useEffect(() => {
    async function load() {
      if (isEngineInitialized()) {
        setDatasets(getDatasetCache());
      } else {
        const cache = await initializeEngine();
        setDatasets(cache);
      }
    }
    load();
  }, []);

  // Estimate weeks to target
  const estimatedWeeks = useMemo(() => {
    if (gap <= 0) return 0;
    // Rough estimate: 3 points per week with focused study
    return Math.ceil(gap / 3);
  }, [gap]);

  // Compute study plan
  const handleComputePlan = async () => {
    if (exams.length === 0) {
      setError('점수 데이터가 없습니다. 먼저 점수를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Use micro-delay to show loading state
      await new Promise(r => setTimeout(r, 200));
      const result = computeStudyCoachV2(exams, datasets || {}, {
        targetComprehensive: targetScore,
        targetDate,
      });
      setPlan(result);
    } catch (e) {
      console.error('[AICoach] Plan error:', e);
      setError(e.message || '계획 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>
      <style>{coachStyles}</style>

      {/* ── Header ── */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--t0)', letterSpacing: '-0.5px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brain size={24} color="var(--primary)" /> AI 학습 코치
        </div>
        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
          목표 점수에 도달하기 위한 맞춤 학습 계획을 생성합니다.<br />
          ROI 기반 주제 추천, 주간 계획, 점수 상승 예측을 제공합니다.
        </div>
      </div>

      {/* ── Score Input Section ── */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Target size={16} color="var(--primary)" /> 목표 설정
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          {/* Current Score */}
          <div style={{
            padding: 14, borderRadius: 12, textAlign: 'center',
            background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 600, marginBottom: 4 }}>현재 점수</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#3b82f6' }}>
              {currentScore > 0 ? currentScore : '?'}
              <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 400, marginLeft: 2 }}>/{COMP_MAX}</span>
            </div>
            {exams.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
                최근 {exams.length}회 평균
              </div>
            )}
          </div>

          {/* Target Score Input */}
          <div style={{
            padding: 14, borderRadius: 12, textAlign: 'center',
            background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 600, marginBottom: 4 }}>목표 점수</div>
            <input
              type="number"
              min={0}
              max={COMP_MAX}
              value={targetScore}
              onChange={e => setTargetScore(Math.min(COMP_MAX, Math.max(0, Number(e.target.value))))}
              style={{
                width: 60, background: 'transparent', border: 'none',
                fontSize: 28, fontWeight: 800, color: '#10b981', textAlign: 'center',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 400, marginLeft: 2 }}>/{COMP_MAX}</span>
          </div>

          {/* Gap */}
          <div style={{
            padding: 14, borderRadius: 12, textAlign: 'center',
            background: gap > 30 ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
            border: `1px solid ${gap > 30 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
          }}>
            <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 600, marginBottom: 4 }}>부족 점수</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: gap > 30 ? '#ef4444' : '#f59e0b' }}>
              {currentScore > 0 ? gap : '-'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
              필요 점수
            </div>
          </div>

          {/* Estimated Weeks */}
          <div style={{
            padding: 14, borderRadius: 12, textAlign: 'center',
            background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 600, marginBottom: 4 }}>예상 소요 기간</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#a855f7' }}>
              {currentScore > 0 ? estimatedWeeks : '-'}
              <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 400, marginLeft: 2 }}>주</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
              목표일: {targetDate}
            </div>
          </div>
        </div>

        {/* Date input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={14} color="var(--t2)" />
            <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>목표 시험일</span>
          </div>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            style={{
              padding: '7px 11px', borderRadius: 8, border: '1px solid var(--bd1)',
              background: 'var(--bg3)', color: 'var(--t0)', fontSize: 13,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleComputePlan}
          disabled={exams.length === 0 || loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            justifyContent: 'center', padding: '13px 20px', borderRadius: 12,
            border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
            cursor: exams.length === 0 ? 'not-allowed' : 'pointer',
            background: exams.length === 0 ? 'var(--bg3)' : 'linear-gradient(135deg, var(--blue), var(--purple))',
            color: exams.length === 0 ? 'var(--t3)' : '#fff',
            boxShadow: exams.length === 0 ? 'none' : '0 4px 16px rgba(49,130,246,0.3)',
          }}
        >
          {loading ? (
            <><div className="spinner-small" /> 학습 계획 생성 중...</>
          ) : (
            <><Sparkles size={16} strokeWidth={2} /> 맞춤 학습 계획 생성하기</>
          )}
        </button>

        {error && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            color: 'var(--red)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
      </div>

      {/* ── Study Plan Results ── */}
      {plan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary Card */}
          <div style={{ ...CARD_SM, background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(59,130,246,0.06))', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)' }}>
                📊 학습 계획 요약
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                생성일: {new Date(plan.generatedAt).toLocaleDateString('ko-KR')}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { label: '현재 점수', value: `${plan.studentProfile?.currentScore || currentScore}점`, color: '#3b82f6' },
                { label: '목표 점수', value: `${targetScore}점`, color: '#10b981' },
                { label: '점수 차이', value: `${plan.studentProfile?.gap || gap}점`, color: gap > 30 ? '#ef4444' : '#f59e0b' },
                { label: '예상 기간', value: `약 ${plan.scoreProjection?.estimatedWeeks || estimatedWeeks}주`, color: '#a855f7' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ROI Topics */}
          <div style={{ ...CARD_SM }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Target size={16} color="#f59e0b" /> ROI 기반 학습 우선순위
            </div>
            <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 10 }}>
              각 토픽의 ROI 점수 = (취약도 × 출제빈도 × 예측확률 × 난이도) / 필요학습시간
            </p>

            {/* Domain filter */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => setSelectedDomain('all')}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600,
                  background: selectedDomain === 'all' ? 'var(--primary)' : 'var(--bg3)',
                  color: selectedDomain === 'all' ? '#fff' : 'var(--t1)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >전체</button>
              {['economy', 'politics', 'history', 'geography', 'society'].map(domain => (
                <button
                  key={domain}
                  onClick={() => setSelectedDomain(domain)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600,
                    background: selectedDomain === domain ? 'var(--primary)' : 'var(--bg3)',
                    color: selectedDomain === domain ? '#fff' : 'var(--t1)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >{DOMAIN_LABELS[domain] || domain}</button>
              ))}
            </div>

            {/* ROI Bar Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={plan.topicROI
                  .filter(t => selectedDomain === 'all' || t.domain === selectedDomain)
                  .slice(0, 15)
                }
                layout="vertical" margin={{ left: 90, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd0)" />
                <XAxis type="number" domain={[0, 100]} stroke="var(--t3)" fontSize={10} />
                <YAxis type="category" dataKey="topic" stroke="var(--t3)" fontSize={10} width={85} />
                <Tooltip formatter={(v) => `${v.toFixed(1)}점`} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="roiScore" name="ROI 점수" radius={[0, 6, 6, 0]}>
                  {plan.topicROI.filter(t => selectedDomain === 'all' || t.domain === selectedDomain).slice(0, 15).map((entry, i) => (
                    <Cell key={i} fill={entry.priority === 'high' ? '#ef4444' : entry.priority === 'medium' ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* ROI List */}
            <div style={{ marginTop: 12 }}>
              {plan.topicROI
                .filter(t => selectedDomain === 'all' || t.domain === selectedDomain)
                .slice(0, 10)
                .map((topic, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 10px', borderRadius: 8, marginBottom: 4,
                    background: topic.priority === 'high' ? 'rgba(239,68,68,0.06)' :
                      topic.priority === 'medium' ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)',
                    border: `1px solid ${
                      topic.priority === 'high' ? '#ef444422' :
                      topic.priority === 'medium' ? '#f59e0b22' : '#10b98122'
                    }`,
                  }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{topic.topic}</span>
                      <span style={{ fontSize: 11, color: 'var(--t2)', marginLeft: 6 }}>
                        ({topic.domainLabel || DOMAIN_LABELS[topic.domain] || topic.domain})
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--t2)' }}>
                        ROI {topic.roiScore.toFixed(0)} · +{topic.expectedScoreGain}점 · {topic.estimatedStudyMinutes}분
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                        background: topic.priority === 'high' ? 'rgba(239,68,68,0.15)' :
                          topic.priority === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                        color: topic.priority === 'high' ? '#ef4444' :
                          topic.priority === 'medium' ? '#f59e0b' : '#10b981',
                      }}>
                        {topic.priority === 'high' ? '최우선' : topic.priority === 'medium' ? '권장' : '일반'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Weekly Plan */}
          {plan.weeklyPlan.length > 0 && (
            <div style={{ ...CARD_SM }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CalendarDays size={16} color="#3b82f6" /> 주간 학습 계획
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
                {plan.weeklyPlan.map((week, wi) => (
                  <div key={wi} style={{
                    padding: 12, borderRadius: 10,
                    background: 'var(--bg3)', border: '1px solid var(--bd0)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t0)', marginBottom: 6 }}>
                      {wi + 1}주차
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }}>
                      {week.focusTopics?.map(t => t).join(' → ') || '학습 계획을 생성하는 중입니다'}
                    </div>
                    {week.estimatedHours && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                        예상: 주 {week.estimatedHours}시간
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score Projection Chart */}
          {plan.scoreProjection?.projectedScores && plan.scoreProjection.projectedScores.length > 0 && (
            <div style={{ ...CARD_SM }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={16} color="#10b981" /> 예상 점수 상승 그래프
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={plan.scoreProjection.projectedScores}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bd0)" />
                  <XAxis dataKey="week" stroke="var(--t3)" fontSize={11} label={{ value: '주차', position: 'bottom', fontSize: 11 }} />
                  <YAxis domain={[currentScore * 0.85, targetScore * 1.05]} stroke="var(--t3)" fontSize={11} label={{ value: '점수', angle: -90, position: 'left', fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${Math.round(v)}점`} contentStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey={(d) => d.score || d.predictedScore}
                    stroke="#10b981" strokeWidth={3}
                    fill="url(#scoreGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>

              {/* Score table */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6, marginTop: 12 }}>
                {plan.scoreProjection.projectedScores.slice(0, 8).map((week, i) => (
                  <div key={i} style={{
                    textAlign: 'center', padding: '8px 4px', borderRadius: 8,
                    background: 'var(--bg3)', fontSize: 11,
                  }}>
                    <div style={{ color: 'var(--t2)' }}>{week.week || `${i + 1}주`}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#10b981' }}>
                      {Math.round(week.score || week.predictedScore)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {plan.recommendations?.length > 0 && (
            <div style={{ ...CARD_SM }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="#a855f7" /> 맞춤 추천
              </div>
              {plan.recommendations.map((rec, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', marginBottom: 8, borderRadius: 8,
                  background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)',
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{rec.icon || '💡'}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t0)' }}>{rec.title || rec.message}</div>
                    {rec.description && (
                      <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>{rec.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {!plan && !loading && exams.length === 0 && (
        <div style={{ ...CARD, textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, margin: '0 auto 16px', background: 'rgba(49,130,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={34} color="var(--blue)" />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t0)', marginBottom: 6 }}>점수 데이터가 필요합니다</div>
          <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7 }}>
            대시보드에서 점수를 먼저 입력해주세요.<br />
            최소 1회 이상의 시험 점수가 있어야 학습 계획을 생성할 수 있습니다.
          </div>
        </div>
      )}
    </div>
  );
}

const coachStyles = `
  .spinner-small {
    display: inline-block;
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 768px) {
    div[style*="grid-template-columns: 1fr 1fr 1fr 1fr"] { grid-template-columns: 1fr 1fr !important; }
  }
`;
