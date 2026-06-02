// ═══════════════════════════════════════════════════════════════════
// Exam Intelligence Center v2 — Complete Integration
// Connects all 7 datasets + 9 intelligence engines into one UI.
//
// User wrong answer → WrongAnswerAnalysis →
// Knowledge Graph → Concept Chain → Prerequisite Trace →
// Weakness Inference → Frequency Lookup → Difficulty Lookup →
// Prediction 2026-2028 → AI Feedback → Study Priority
//
// "왜 틀렸는가" explains why the user got it wrong.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts';
import {
  Brain, TrendingUp, Target, AlertTriangle, BookOpen,
  Lightbulb, BarChart3, Network, Sparkles, ChevronRight,
  Search, AlertCircle, ArrowRight, Clock, FileText,
  BarChart as BarChartIcon, PieChart as PieChartIcon,
  LineChart as LineChartIcon, Layers, Flag, Gauge,
} from 'lucide-react';

import { getDatasetCache, onEngineReady, isEngineInitialized, initializeEngine } from '../intelligence/engineInitializer';
import {
  analyzeWrongAnswer, traceConceptChain, tracePrerequisiteChain,
  inferWeakness, analyzeFrequency, assessDifficulty,
  predictTopicProbability, findRelatedQuestions,
} from '../intelligence/examIntelligenceEngineV2';
import { getExams, getSettings } from '../utils/storage';
import { PAST_EXAM_BANK } from '../data/ejuPastExamBank';

// ── Color Theme ───────────────────────────────────────────
const DOMAIN_COLORS = {
  economy: '#10b981',
  politics: '#ef4444',
  history: '#a855f7',
  geography: '#3b82f6',
  society: '#f59e0b',
};

const DOMAIN_LABELS = {
  economy: '경제', politics: '정치', history: '역사',
  geography: '지리', society: '사회',
};

const ERROR_TYPE_COLORS = {
  '개념혼동': '#ef4444',
  '자료해석오류': '#f59e0b',
  '그래프변곡점오판': '#3b82f6',
  '제도구조이해부족': '#a855f7',
  '실수': '#f59e0b',
  '정보부족': '#ef4444',
  '연계사고부족': '#8b5cf6',
};

const COLORS = ['#10b981', '#ef4444', '#a855f7', '#3b82f6', '#f59e0b', '#ec4899', '#06b6d4'];

const tabs = [
  { id: 'wronganswer', label: '오답 분석', icon: <Search size={16} /> },
  { id: 'trends', label: '출제 경향', icon: <BarChart3 size={16} /> },
  { id: 'weakness', label: '취약점', icon: <Target size={16} /> },
  { id: 'prediction', label: '2026 예측', icon: <TrendingUp size={16} /> },
  { id: 'knowledge', label: '지식 그래프', icon: <Network size={16} /> },
  { id: 'math', label: '수학', icon: <BookOpen size={16} /> },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function ExamIntelligenceCenter() {
  const [activeTab, setActiveTab] = useState('wronganswer');
  const [exams] = useState(() => getExams());
  const [settings] = useState(() => getSettings());
  const [datasets, setDatasets] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isEngineInitialized()) {
      setDatasets(getDatasetCache());
      setLoading(false);
    } else {
      onEngineReady((cache) => {
        setDatasets(cache);
        setLoading(false);
      });
      // Also try initializing if not started
      initializeEngine().then((cache) => {
        setDatasets(cache);
        setLoading(false);
      });
    }
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Brain size={48} style={{ color: 'var(--primary)', marginBottom: 16, animation: 'pulse 2s infinite' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Exam Intelligence Engine 초기화 중...</p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>데이터셋 로딩 (7개)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="eic-container">
      <style>{eicStyles}</style>

      {/* Header */}
      <div className="eic-header">
        <h1><Brain size={28} /> Exam Intelligence Center</h1>
        <p>AI 기반 EJU 출제 경향 + 개인 맞춤 취약점 분석 — "왜 틀렸는가"를 설명합니다</p>
        <div className="eic-stats">
          <div className="stat-chip">데이터셋: {datasets ? Object.values(datasets).filter(Boolean).length : 0}/7 로드됨</div>
          <div className="stat-chip">내 시험 기록: {exams.length}회</div>
          <div className="stat-chip">엔진: Exam Intelligence Engine v2</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="eic-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`eic-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="eic-content">
        {activeTab === 'wronganswer' && <WrongAnswerPanel datasets={datasets} exams={exams} />}
        {activeTab === 'trends' && <TrendAnalysisPanel datasets={datasets} />}
        {activeTab === 'weakness' && <WeaknessGraphPanel datasets={datasets} exams={exams} />}
        {activeTab === 'prediction' && <PredictionPanel datasets={datasets} />}
        {activeTab === 'knowledge' && <KnowledgeGraphPanel datasets={datasets} />}
        {activeTab === 'math' && <MathAnalysisPanel datasets={datasets} exams={exams} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 1: WRONG ANSWER ANALYSIS — "왜 틀렸는가"
// ═══════════════════════════════════════════════════════════════════
function WrongAnswerPanel({ datasets, exams }) {
  const [domain, setDomain] = useState('history');
  const [topic, setTopic] = useState('');
  const [errorType, setErrorType] = useState('');
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Get all topics from knowledge graph dataset
  const allTopics = useMemo(() => {
    const topics = [];
    const kg = datasets?.knowledgeGraph;
    if (kg?.taxonomy) {
      for (const [d, data] of Object.entries(kg.taxonomy)) {
        const domainTopics = data.topics || {};
        for (const t of Object.keys(domainTopics)) {
          topics.push({ name: t, domain: d, label: DOMAIN_LABELS[d] || d });
        }
      }
    }
    return topics;
  }, [datasets]);

  // Filter topics by selected domain
  const filteredTopics = useMemo(() => {
    return allTopics.filter(t => t.domain === domain);
  }, [allTopics, domain]);

  const handleAnalyze = () => {
    if (!topic) return;
    setAnalyzing(true);
    // Use a micro-delay to show loading state
    setTimeout(() => {
      try {
        const analysisResult = analyzeWrongAnswer({
          questionId: 'manual_' + Date.now(),
          domain,
          topic,
          errorType: errorType || '정보부족',
          year: 2025,
          round: 1,
          memo: '',
        }, { datasets, studentExams: exams });
        setResult(analysisResult);
      } catch (e) {
        console.error('[EIC] Analysis error:', e);
        setResult({ error: e.message });
      }
      setAnalyzing(false);
    }, 100);
  };

  return (
    <div className="eic-panel">
      <h2><Search size={22} /> 오답 분석 — "왜 틀렸는가"</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        틀린 문제의 주제를 선택하면 AI가 개념 연결고리, 취약 원인, 출제 빈도, 예측 점수를 분석합니다.
      </p>

      {/* Input Section */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 16,
        padding: 20, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end'
      }}>
        <div style={{ flex: '1 1 180px' }}>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>영역</label>
          <select
            value={domain}
            onChange={e => { setDomain(e.target.value); setTopic(''); }}
            style={selectStyle}
          >
            {Object.entries(DOMAIN_LABELS).map(([d, l]) => (
              <option key={d} value={d}>{l}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 240px' }}>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>틀린 주제 (토픽)</label>
          <select
            value={topic}
            onChange={e => setTopic(e.target.value)}
            style={selectStyle}
          >
            <option value="">주제를 선택하세요</option>
            {filteredTopics.map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>오답 유형</label>
          <select
            value={errorType}
            onChange={e => setErrorType(e.target.value)}
            style={selectStyle}
          >
            <option value="">자동 진단</option>
            <option value="개념혼동">개념 혼동</option>
            <option value="자료해석오류">자료 해석 오류</option>
            <option value="그래프변곡점오판">그래프 변곡점 오판</option>
            <option value="제도구조이해부족">제도 구조 이해 부족</option>
            <option value="정보부족">정보 부족</option>
            <option value="연계사고부족">연계 사고 부족</option>
          </select>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!topic || analyzing}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: !topic ? 'var(--bg3)' : 'linear-gradient(135deg, var(--primary), #a855f7)',
            color: !topic ? 'var(--text-tertiary)' : '#fff',
            fontWeight: 700, fontSize: 13, cursor: !topic ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {analyzing ? <><div className="spinner-small" /> 분석 중...</> : <><Brain size={16} /> 분석하기</>}
        </button>
      </div>

      {/* Analysis Result */}
      {result && !result.error && (
        <div className="analysis-result">
          {/* WHY WRONG — Core Answer */}
          <WhyWrongSection result={result} datasets={datasets} />

          {/* Concept Chain */}
          <ConceptChainSection conceptChain={result.analysis?.conceptChain} />

          {/* Prerequisite Chain */}
          <PrerequisiteSection prereqs={result.analysis?.prerequisiteChain} />

          {/* Weakness */}
          <WeaknessSection weakness={result.analysis?.weakness} topic={result.topic} />

          {/* Frequency + Difficulty side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <FrequencySection frequency={result.analysis?.frequency} />
            <DifficultySection difficulty={result.analysis?.difficulty} />
          </div>

          {/* 2026 Prediction */}
          <PredictionResultSection prediction={result.analysis?.prediction} topic={result.topic} />

          {/* Recommendations */}
          <RecommendationsSection recommendations={result.recommendations} feedback={result.feedback} />
        </div>
      )}

      {result?.error && (
        <div style={{ padding: 20, background: 'rgba(239,68,68,0.08)', borderRadius: 12, color: 'var(--red)', fontSize: 13 }}>
          분석 중 오류 발생: {result.error}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// "왜 틀렸는가" — Core Explanation
// ═══════════════════════════════════════════════════════════════════
function WhyWrongSection({ result, datasets }) {
  const analysis = result.analysis || {};
  const weakness = analysis.weakness || {};
  const feedback = result.feedback || {};

  // Generate "왜 틀렸는가" explanation
  const whyWrongParts = [];

  // 1. Root cause
  if (weakness.rootCause) {
    whyWrongParts.push(weakness.rootCause);
  } else if (result.errorType) {
    whyWrongParts.push(`${result.topic}에 대한 ${result.errorType} 오류입니다.`);
  }

  // 2. Knowledge gap
  if (weakness.masteryLevel != null) {
    const pct = Math.round(weakness.masteryLevel * 100);
    if (pct < 30) whyWrongParts.push(`이 주제의 숙련도가 ${pct}%로 매우 낮습니다. 기초 개념부터 재학습이 필요합니다.`);
    else if (pct < 60) whyWrongParts.push(`숙련도 ${pct}% — 개념을 알고 있지만 정확도가 부족합니다.`);
    else whyWrongParts.push(`숙련도 ${pct}% — 대부분 알고 있지만 세부 내용에서 실수가 있습니다.`);
  }

  // 3. Prerequisite gaps
  const prereqs = analysis.prerequisiteChain || [];
  const weakPrereqs = prereqs.filter(p => p.importance === 'high');
  if (weakPrereqs.length > 0) {
    whyWrongParts.push(`선행 개념 '${weakPrereqs.map(p => p.name).join(', ')}'의 이해가 필요합니다.`);
  }

  // 4. Frequency context
  const freq = analysis.frequency || {};
  if (freq.totalAppearances != null) {
    whyWrongParts.push(`이 주제는 ${freq.totalAppearances}회 출제되었으며, 출제 확률 ${freq.probability || '높음'}입니다.`);
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.08))',
      border: '1px solid rgba(168,85,247,0.2)',
      borderRadius: 16, padding: 20, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <AlertCircle size={20} color="#a855f7" />
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
          🤔 "{result.topic}" — 왜 틀렸을까요?
        </span>
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 20px', lineHeight: 2 }}>
        {whyWrongParts.map((part, i) => (
          <li key={i} style={{ fontSize: 14, color: 'var(--text-primary)' }}>{part}</li>
        ))}
      </ul>
      {feedback.summary && (
        <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
          💡 {feedback.summary}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Concept Chain Visualization
// ═══════════════════════════════════════════════════════════════════
function ConceptChainSection({ conceptChain }) {
  if (!conceptChain || conceptChain.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Network size={16} color="#a855f7" /> 개념 연결 고리
      </h3>
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
        padding: 14, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--bd0)',
      }}>
        {conceptChain.map((node, i) => (
          <React.Fragment key={i}>
            <div style={{
              padding: '6px 12px', borderRadius: 8,
              background: node.type === 'domain' ? 'rgba(16,185,129,0.15)' :
                node.type === 'topic' ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)',
              border: `1px solid ${
                node.type === 'domain' ? '#10b98144' :
                node.type === 'topic' ? '#a855f744' : '#3b82f644'
              }`,
              fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
              opacity: node.isRelated ? 0.6 : 1,
            }}>
              {node.name}
              {node.isRelated && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>(관련)</span>}
            </div>
            {i < conceptChain.length - 1 && (
              <ChevronRight size={14} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Prerequisite Section
// ═══════════════════════════════════════════════════════════════════
function PrerequisiteSection({ prereqs }) {
  if (!prereqs || prereqs.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Layers size={16} color="#f59e0b" /> 선행 개념 (Prerequisites)
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {prereqs.map((p, i) => (
          <div key={i} style={{
            padding: '8px 14px', borderRadius: 10,
            background: p.importance === 'high' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
            border: `1px solid ${p.importance === 'high' ? '#ef444433' : '#f59e0b33'}`,
            fontSize: 12, color: 'var(--text-primary)',
          }}>
            <span style={{ fontWeight: 700 }}>{p.name}</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 6 }}>
              {p.importance === 'high' ? '🔴 필수' : '🟡 권장'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Weakness Section
// ═══════════════════════════════════════════════════════════════════
function WeaknessSection({ weakness, topic }) {
  if (!weakness) return null;
  const items = [
    { label: '숙련도', value: weakness.masteryLevel != null ? `${Math.round(weakness.masteryLevel * 100)}%` : '데이터 없음', color: '#a855f7' },
    { label: '오답 횟수', value: weakness.mistakeCount ?? 0, color: '#ef4444' },
    { label: '취약 점수', value: weakness.weaknessScore != null ? `${Math.round(weakness.weaknessScore * 100)}%` : '-', color: '#f59e0b' },
    { label: '반복 오답', value: weakness.isRepeated ? '🟡 예' : '🟢 아니오', color: weakness.isRepeated ? '#f59e0b' : '#10b981' },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Target size={16} color="#ef4444" /> 취약점 분석 — "{topic}"
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            padding: '12px', borderRadius: 10, textAlign: 'center',
            background: `${item.color}0a`, border: `1px solid ${item.color}22`,
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Frequency Section
// ═══════════════════════════════════════════════════════════════════
function FrequencySection({ frequency }) {
  if (!frequency) return null;
  return (
    <div style={{
      padding: 16, borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--bd0)',
    }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <BarChart3 size={14} color="#3b82f6" /> 출제 빈도
      </h4>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>
        {frequency.totalAppearances ?? '-'}<span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>회 출제</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
        연평균 {frequency.averagePerExam?.toFixed(1) ?? '-'}회 · 추세: {
          frequency.trend === 'increasing' ? '📈 증가' :
          frequency.trend === 'decreasing' ? '📉 감소' : '➡️ 유지'
        }
      </div>
      {frequency.yearlyData && (
        <div style={{ marginTop: 10, height: 60 }}>
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={frequency.yearlyData}>
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Difficulty Section
// ═══════════════════════════════════════════════════════════════════
function DifficultySection({ difficulty }) {
  if (!difficulty) return null;

  const diffScore = difficulty.score ?? 50;
  const diffLabel = diffScore >= 70 ? '어려움' : diffScore >= 40 ? '중간' : '쉬움';
  const diffColor = diffScore >= 70 ? '#ef4444' : diffScore >= 40 ? '#f59e0b' : '#10b981';
  const barWidth = Math.min(100, diffScore) + '%';

  return (
    <div style={{
      padding: 16, borderRadius: 12, background: 'var(--bg2)', border: '1px solid var(--bd0)',
    }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Gauge size={14} color={diffColor} /> 난이도
      </h4>
      <div style={{ fontSize: 24, fontWeight: 800, color: diffColor }}>
        {diffLabel}
      </div>
      <div style={{ marginTop: 8, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: barWidth, height: '100%', background: diffColor, borderRadius: 3 }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
        <span>쉬움</span>
        <span>난이도 점수: {diffScore}/100</span>
        <span>어려움</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Prediction Result Section
// ═══════════════════════════════════════════════════════════════════
function PredictionResultSection({ prediction, topic }) {
  const pct = prediction?.probabilityPct ?? 0;
  const barColor = pct >= 60 ? '#10b981' : pct >= 30 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      padding: 16, borderRadius: 12, marginBottom: 16,
      background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(59,130,246,0.06))',
      border: '1px solid rgba(16,185,129,0.2)',
    }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <TrendingUp size={14} color="#10b981" /> 2026년 출제 예측
      </h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: barColor }}>{pct}%</div>
        <div style={{ flex: 1 }}>
          <div style={{ height: 10, background: 'var(--bg3)', borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 5 }} />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
        "{topic}"의 2026년 출제 확률. {pct >= 60 ? '집중 학습이 필요한 고빈도 예상 주제입니다.' : pct >= 30 ? '중간 수준의 출제 가능성이 있습니다.' : '출제 가능성이 낮습니다.'}
      </div>
      {/* Show top 5 from prediction dataset */}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Recommendations Section
// ═══════════════════════════════════════════════════════════════════
function RecommendationsSection({ recommendations, feedback }) {
  const recs = recommendations || [];
  if (recs.length === 0 && !feedback?.actionItems) return null;

  const items = recs.length > 0 ? recs : (feedback.actionItems || []);

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={16} color="#10b981" /> 학습 추천 & 우선순위
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.slice(0, 5).map((rec, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 14px', borderRadius: 10,
            background: rec.priority === 'high' ? 'rgba(239,68,68,0.06)' :
              rec.priority === 'medium' ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)',
            border: `1px solid ${
              rec.priority === 'high' ? '#ef444433' :
              rec.priority === 'medium' ? '#f59e0b33' : '#10b98133'
            }`,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>
              {rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢'}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {rec.title || rec.action || rec.description}
              </div>
              {rec.estimatedImpact && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  예상 효과: {rec.estimatedImpact}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 2: TREND ANALYSIS PANEL (ENHANCED)
// ═══════════════════════════════════════════════════════════════════
function TrendAnalysisPanel({ datasets }) {
  const trendData = datasets?.trendAnalysis;

  // Compute TOP 100 topics from trend_analysis_v2.json
  const top100Topics = useMemo(() => {
    if (!trendData?.topic_trends) return [];
    const topics = Object.entries(trendData.topic_trends)
      .map(([topic, data]) => ({
        topic,
        domain: data.domain || '',
        domainLabel: DOMAIN_LABELS[data.domain] || data.domain || '',
        total: data.total || 0,
        recent5: data.recent_5yr || 0,
        growth: data.growth_rate_pct || 0,
        avgPerYear: data.average_per_year || 0,
        trend: data.trend || 'stable',
      }))
      .sort((a, b) => b.total - a.total);
    return topics;
  }, [trendData]);

  // Year-by-year data
  const yearlyData = useMemo(() => {
    if (!trendData?.yearly) return [];
    return Object.entries(trendData.yearly)
      .map(([year, data]) => ({
        year,
        ...data,
      }))
      .sort((a, b) => a.year - b.year);
  }, [trendData]);

  // Rising topics (highest growth rate)
  const risingTopics = useMemo(() =>
    top100Topics.filter(t => t.growth > 10).sort((a, b) => b.growth - a.growth).slice(0, 10),
    [top100Topics]
  );

  // Falling topics
  const fallingTopics = useMemo(() =>
    top100Topics.filter(t => t.growth < -10).sort((a, b) => a.growth - b.growth).slice(0, 10),
    [top100Topics]
  );

  // Domain proportion
  const domainProportion = useMemo(() => {
    const map = {};
    for (const t of top100Topics) {
      const d = t.domainLabel || '기타';
      if (!map[d]) map[d] = 0;
      map[d] += t.total;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [top100Topics]);

  // 2026, 2027, 2028 predicted topics
  const pred2026 = useMemo(() => {
    const pred = datasets?.prediction2026;
    if (pred?.yearly?.['2026']) return pred.yearly['2026'].slice(0, 15);
    if (pred?.top_30_predictions) return pred.top_30_predictions.slice(0, 15);
    return [];
  }, [datasets]);

  return (
    <div className="eic-panel">
      <h2><BarChart3 size={22} /> 출제 경향 인텔리전스</h2>

      {/* TOP 100 Topics */}
      <div className="chart-card">
        <h3>🏆 TOP 100 출제 토픽 (전체 기간)</h3>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bd0)', color: 'var(--text-tertiary)', fontSize: 11 }}>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>순위</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>토픽</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>영역</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>총 출제</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>최근5년</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>성장률</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>추세</th>
              </tr>
            </thead>
            <tbody>
              {top100Topics.slice(0, 100).map((t, i) => (
                <tr key={t.topic} style={{ borderBottom: '1px solid var(--bd0)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.target.style.background = 'var(--bg2)'}
                  onMouseLeave={e => e.target.style.background = 'transparent'}
                >
                  <td style={{ padding: '6px 8px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{t.topic}</td>
                  <td style={{ padding: '6px 8px', color: DOMAIN_COLORS[t.domain] || '#888' }}>{t.domainLabel}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{t.total}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{t.recent5}</td>
                  <td style={{
                    padding: '6px 8px', textAlign: 'right',
                    color: t.growth > 0 ? '#ef4444' : t.growth < 0 ? '#3b82f6' : 'var(--text-tertiary)',
                    fontWeight: 600,
                  }}>
                    {t.growth > 0 ? '+' : ''}{t.growth.toFixed(1)}%
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    {t.trend === 'increasing' ? '📈' : t.trend === 'decreasing' ? '📉' : '➡️'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rising & Falling topics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="chart-card">
          <h3>🚀 급상승 토픽 (Top 10)</h3>
          {risingTopics.map((t, i) => (
            <div key={t.topic} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: i < risingTopics.length - 1 ? '1px solid var(--bd0)' : 'none',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{t.topic}</span>
              <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>+{t.growth.toFixed(1)}%</span>
            </div>
          ))}
          {risingTopics.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>데이터 없음</p>}
        </div>
        <div className="chart-card">
          <h3>📉 급하락 토픽 (Top 10)</h3>
          {fallingTopics.map((t, i) => (
            <div key={t.topic} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: i < fallingTopics.length - 1 ? '1px solid var(--bd0)' : 'none',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{t.topic}</span>
              <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 700 }}>{t.growth.toFixed(1)}%</span>
            </div>
          ))}
          {fallingTopics.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>데이터 없음</p>}
        </div>
      </div>

      {/* Domain Proportion */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="chart-card">
          <h3><PieChartIcon size={14} /> 도메인별 비중</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={domainProportion} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} isAnimationActive={false} label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}>
                {domainProportion.map((entry, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Predicted Topics 2026-2028 */}
        <div className="chart-card">
          <h3><TrendingUp size={14} /> 2026-2028 예상 토픽</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>2026년 출제 예상 TOP 10</div>
            {pred2026.slice(0, 10).map((p, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 0', fontSize: 12,
              }}>
                <span>{i + 1}. {p.topic}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{p.prediction_probability_pct || p.predictionProbabilityPct || 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Yearly change chart */}
      <div className="chart-card">
        <h3>📅 연도별 출제 변화</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={yearlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bd0)" />
            <XAxis dataKey="year" stroke="var(--text-tertiary)" fontSize={11} />
            <YAxis stroke="var(--text-tertiary)" fontSize={11} />
            <Tooltip />
            <Bar dataKey="total" name="총 문항" fill="#a855f7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 3: WEAKNESS GRAPH PANEL
// ═══════════════════════════════════════════════════════════════════
function WeaknessGraphPanel({ datasets, exams }) {
  const [weaknessGraph, setWeaknessGraph] = useState(null);

  useEffect(() => {
    if (!datasets || !exams) return;
    // Build personal weakness graph
    import('../intelligence/personalWeaknessGraph').then(mod => {
      const graph = mod.buildPersonalWeaknessGraph(exams, datasets);
      setWeaknessGraph(graph);
    });
  }, [datasets, exams]);

  if (!weaknessGraph) {
    return (
      <div className="eic-panel">
        <h2><Target size={22} /> 개인 취약점 그래프</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>시험 데이터가 부족하여 취약점 그래프를 생성할 수 없습니다. 점수를 먼저 입력해주세요.</p>
      </div>
    );
  }

  const { nodes, stats, bottlenecks, highImpactAreas } = weaknessGraph;
  const topicNodes = nodes.filter(n => n.type === 'topic');

  return (
    <div className="eic-panel">
      <h2><Target size={22} /> 개인 취약점 그래프</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        각 노드 = 학습 주제. 색상 = 숙련도 (초록: 높음, 빨강: 낮음). 크기 = 출제 가능성.
      </p>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: '전체 노드', value: stats.totalNodes, color: '#3b82f6' },
          { label: '취약 토픽', value: stats.weakTopicCount, color: '#ef4444' },
          { label: '강함 토픽', value: stats.strongTopicCount, color: '#10b981' },
          { label: '평균 숙련도', value: `${(stats.averageMastery * 100).toFixed(0)}%`, color: '#a855f7' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '14px', borderRadius: 10, textAlign: 'center',
            background: `${s.color}0a`, border: `1px solid ${s.color}22`,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Weakness Nodes */}
      <div className="chart-card">
        <h3>📊 노드별 성능 상세</h3>
        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bd0)', color: 'var(--text-tertiary)', fontSize: 11 }}>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>주제</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>영역</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>정확도</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>시도</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>숙련도</th>
                <th style={{ padding: '6px 8px', textAlign: 'center' }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {topicNodes.map((node) => (
                <tr key={node.id} style={{ borderBottom: '1px solid var(--bd0)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{node.label}</td>
                  <td style={{ padding: '6px 8px' }}>{DOMAIN_LABELS[node.domain] || node.domain}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: node.accuracy >= 0.7 ? '#10b981' : '#ef4444' }}>
                    {node.attemptCount > 0 ? `${(node.accuracy * 100).toFixed(0)}%` : '-'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{node.attemptCount}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: node.masteryLevel >= 0.7 ? '#10b981' : node.masteryLevel >= 0.3 ? '#f59e0b' : '#ef4444' }}>
                    {(node.masteryLevel * 100).toFixed(0)}%
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                      background: node.status === 'mastered' ? 'rgba(16,185,129,0.15)' :
                        node.status === 'learning' ? 'rgba(245,158,11,0.15)' :
                        node.status === 'weak' ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.15)',
                      color: node.status === 'mastered' ? '#10b981' :
                        node.status === 'learning' ? '#f59e0b' :
                        node.status === 'weak' ? '#ef4444' : '#94a3b8',
                    }}>
                      {node.status === 'mastered' ? '완료' : node.status === 'learning' ? '학습중' : node.status === 'weak' ? '취약' : '미학습'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottlenecks */}
      {bottlenecks.length > 0 && (
        <div className="chart-card">
          <h3>🔴 병목 노드 (Bottlenecks)</h3>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
            이 주제들을 향상시키면 다수의 하위 주제 학습이 수월해집니다.
          </p>
          {bottlenecks.slice(0, 5).map((b, i) => (
            <div key={i} style={{
              padding: '10px 12px', marginBottom: 6, borderRadius: 8,
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{b.node.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                영향받는 하위 주제: {b.dependentCount}개 · 영향 점수: {b.impactScore.toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: '#a855f7', marginTop: 2 }}>{b.recommendation}</div>
            </div>
          ))}
        </div>
      )}

      {/* High Impact Areas */}
      {highImpactAreas.length > 0 && (
        <div className="chart-card">
          <h3>💡 고효율 학습 영역</h3>
          {highImpactAreas.slice(0, 5).map((h, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: i < Math.min(5, highImpactAreas.length) - 1 ? '1px solid var(--bd0)' : 'none',
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{h.node.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>
                  ({DOMAIN_LABELS[h.node.domain] || h.node.domain})
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>
                +{h.downstreamCount}개 영향
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 4: 2026 PREDICTION PANEL
// ═══════════════════════════════════════════════════════════════════
function PredictionPanel({ datasets }) {
  const pred = datasets?.prediction2026;

  const predictions2026 = useMemo(() => {
    if (pred?.yearly?.['2026']) return pred.yearly['2026'].slice(0, 30);
    if (pred?.top_30_predictions) return pred.top_30_predictions.slice(0, 30);
    return [];
  }, [pred]);

  const predictions2027 = useMemo(() => {
    if (pred?.yearly?.['2027']) return pred.yearly['2027'].slice(0, 20);
    return [];
  }, [pred]);

  const predictions2028 = useMemo(() => {
    if (pred?.yearly?.['2028']) return pred.yearly['2028'].slice(0, 20);
    return [];
  }, [pred]);

  return (
    <div className="eic-panel">
      <h2><TrendingUp size={22} /> 2026-2028 출제 예측</h2>

      {/* Prediction chart */}
      <div className="chart-card">
        <h3>🎯 2026년 출제 예상 TOP 30</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={predictions2026.slice(0, 15)} layout="vertical" margin={{ left: 100, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bd0)" />
            <XAxis type="number" domain={[0, 100]} stroke="var(--text-tertiary)" fontSize={11} />
            <YAxis type="category" dataKey="topic" stroke="var(--text-tertiary)" fontSize={11} width={90} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Bar dataKey={(d) => d.prediction_probability_pct || d.predictionProbabilityPct || 0} name="출제 확률" radius={[0, 6, 6, 0]}>
              {predictions2026.slice(0, 15).map((entry, i) => {
                const domain = entry.domain || '';
                return <Cell key={i} fill={DOMAIN_COLORS[domain] || COLORS[i % COLORS.length]} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Prediction details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {[
          { year: '2026', data: predictions2026 },
          { year: '2027', data: predictions2027 },
          { year: '2028', data: predictions2028 },
        ].map(({ year, data }) => (
          <div key={year} className="chart-card">
            <h3>{year}년 예상 TOP 20</h3>
            {data.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>데이터 없음</p>}
            {data.map((p, i) => {
              const prob = p.prediction_probability_pct || p.predictionProbabilityPct || 0;
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 0', fontSize: 11, borderBottom: i < data.length - 1 ? '1px solid var(--bd0)' : 'none',
                }}>
                  <span style={{ fontWeight: 600, flex: 1 }}>{i + 1}. {p.topic}</span>
                  <div style={{ width: 60, height: 14, background: 'var(--bg3)', borderRadius: 3, margin: '0 8px', overflow: 'hidden' }}>
                    <div style={{ width: `${prob}%`, height: '100%', background: prob > 60 ? '#10b981' : prob > 30 ? '#f59e0b' : '#ef4444', borderRadius: 3 }} />
                  </div>
                  <span style={{ color: 'var(--text-secondary)', minWidth: 30, textAlign: 'right' }}>{prob}%</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 5: KNOWLEDGE GRAPH VISUALIZATION (Interactive)
// ═══════════════════════════════════════════════════════════════════
function KnowledgeGraphPanel({ datasets }) {
  const kg = datasets?.knowledgeGraph;
  const [selectedNode, setSelectedNode] = useState(null);
  const [clickedPath, setClickedPath] = useState([]);

  // Build nodes and edges for visualization
  const { graphNodes, graphEdges } = useMemo(() => {
    const nodes = [];
    const edges = [];

    if (kg?.taxonomy) {
      for (const [domain, data] of Object.entries(kg.taxonomy)) {
        const domainId = `domain:${domain}`;
        nodes.push({
          id: domainId,
          label: data.label || domain,
          type: 'domain',
          domain,
          color: DOMAIN_COLORS[domain] || '#888',
          r: 12,
        });

        const topics = data.topics || {};
        for (const [topic, subtopics] of Object.entries(topics)) {
          const topicId = `topic:${domain}:${topic}`;
          nodes.push({
            id: topicId,
            label: topic,
            type: 'topic',
            domain,
            color: DOMAIN_COLORS[domain] || '#888',
            r: 8,
          });
          edges.push({ source: domainId, target: topicId, type: 'belongs_to' });

          for (const sub of subtopics) {
            const subId = `subtopic:${domain}:${topic}:${sub}`;
            nodes.push({
              id: subId,
              label: sub,
              type: 'subtopic',
              domain,
              color: DOMAIN_COLORS[domain] || '#888',
              r: 5,
            });
            edges.push({ source: topicId, target: subId, type: 'has_subtopic' });
          }
        }
      }
    }

    // Add prerequisite edges if available
    if (kg?.edges) {
      for (const edge of kg.edges) {
        if (edge.type === 'prerequisite') {
          edges.push({ source: edge.sourceId, target: edge.targetId, type: 'prerequisite' });
        }
      }
    }

    return { graphNodes: nodes, graphEdges: edges };
  }, [kg]);

  // Simple force layout positions
  const nodePositions = useMemo(() => {
    const positions = {};
    const domains = [...new Set(graphNodes.map(n => n.domain))];
    const domainGap = 360 / (domains.length || 1);

    domains.forEach((domain, di) => {
      const domainNodes = graphNodes.filter(n => n.domain === domain);
      const centerAngle = (di * domainGap * Math.PI) / 180;
      const radius = 140;

      domainNodes.forEach((node, ni) => {
        const angle = centerAngle + ((ni - domainNodes.length / 2) * 0.15);
        const r = node.type === 'domain' ? 60 : node.type === 'topic' ? 100 : 130;
        positions[node.id] = {
          x: 250 + Math.cos(angle) * r,
          y: 250 + Math.sin(angle) * r,
        };
      });
    });

    return positions;
  }, [graphNodes]);

  const handleNodeClick = (nodeId) => {
    const node = graphNodes.find(n => n.id === nodeId);
    if (!node) return;

    setSelectedNode(node);

    // Trace path: e.g., clicking "시민혁명" shows path
    if (node.type === 'topic') {
      const path = [node];
      // Find domain parent
      const parentEdge = graphEdges.find(e => e.target === nodeId && e.type === 'belongs_to');
      if (parentEdge) {
        const parent = graphNodes.find(n => n.id === parentEdge.source);
        if (parent) path.unshift(parent);
      }
      // Find subtopics
      const childEdges = graphEdges.filter(e => e.source === nodeId);
      for (const ce of childEdges) {
        const child = graphNodes.find(n => n.id === ce.target);
        if (child) path.push(child);
      }
      setClickedPath(path);
    } else {
      setClickedPath([node]);
    }
  };

  return (
    <div className="eic-panel">
      <h2><Network size={22} /> 지식 그래프 인터랙티브</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        노드를 클릭하면 개념 연결 경로를 확인할 수 있습니다.<br />
        예: 시민혁명 → 프랑스혁명 → 인권선언 → 삼권분립 → 현대 민주주의
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Graph Visualization */}
        <div style={{
          background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--bd0)',
          position: 'relative', height: 500, overflow: 'hidden',
        }}>
          <svg width="100%" height="100%" viewBox="0 0 500 500">
            {/* Edges */}
            {graphEdges.map((edge, i) => {
              const source = nodePositions[edge.source];
              const target = nodePositions[edge.target];
              if (!source || !target) return null;
              const isSelected = selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id);
              return (
                <line
                  key={i}
                  x1={source.x} y1={source.y}
                  x2={target.x} y2={target.y}
                  stroke={isSelected ? '#a855f7' : 'var(--bd1)'}
                  strokeWidth={isSelected ? 2 : 1}
                  opacity={isSelected ? 0.8 : 0.3}
                />
              );
            })}
            {/* Nodes */}
            {graphNodes.map((node, i) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;
              const isSelected = selectedNode?.id === node.id;
              const isInPath = clickedPath.some(n => n.id === node.id);
              return (
                <g key={i} onClick={() => handleNodeClick(node.id)} style={{ cursor: 'pointer' }}>
                  <circle
                    cx={pos.x} cy={pos.y} r={node.r}
                    fill={isSelected ? '#a855f7' : isInPath ? node.color : node.color + '88'}
                    stroke={isSelected ? '#fff' : isInPath ? node.color : 'transparent'}
                    strokeWidth={isSelected ? 2 : isInPath ? 1 : 0}
                  />
                  <text
                    x={pos.x} y={pos.y + node.r + 12}
                    textAnchor="middle" fontSize={node.type === 'domain' ? 11 : 9}
                    fill={isSelected || isInPath ? 'var(--text-primary)' : 'var(--text-secondary)'}
                    fontWeight={isSelected || isInPath ? 700 : 400}
                  >
                    {node.label.length > 10 ? node.label.slice(0, 10) + '..' : node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Node Info */}
        <div style={{
          background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--bd0)',
          padding: 16, overflowY: 'auto', maxHeight: 500,
        }}>
          {selectedNode ? (
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                {selectedNode.label}
              </h4>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                유형: {selectedNode.type === 'domain' ? '영역' : selectedNode.type === 'topic' ? '주제' : '하위주제'}
                · 영역: {DOMAIN_LABELS[selectedNode.domain] || selectedNode.domain}
              </div>

              {/* Connected path */}
              {clickedPath.length > 1 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>연결 경로</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                    {clickedPath.map((n, i) => (
                      <React.Fragment key={i}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: DOMAIN_COLORS[n.domain] + '22', color: DOMAIN_COLORS[n.domain],
                        }}>{n.label}</span>
                        {i < clickedPath.length - 1 && <ChevronRight size={12} color="var(--text-tertiary)" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Related connections */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 6 }}>직접 연결된 노드</div>
                {graphEdges
                  .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                  .slice(0, 10)
                  .map((e, i) => {
                    const connectedId = e.source === selectedNode.id ? e.target : e.source;
                    const connected = graphNodes.find(n => n.id === connectedId);
                    if (!connected) return null;
                    return (
                      <div
                        key={i}
                        style={{ padding: '4px 8px', marginBottom: 4, borderRadius: 6, background: 'var(--bg3)', fontSize: 12, cursor: 'pointer' }}
                        onClick={() => handleNodeClick(connected.id)}
                      >
                        {connected.label}
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                          ({e.type === 'prerequisite' ? '선행' : e.type === 'belongs_to' ? '소속' : '하위'})
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>
              <Network size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              왼쪽 그래프에서 노드를 클릭하면<br />상세 정보가 표시됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 6: MATH ANALYSIS
// ═══════════════════════════════════════════════════════════════════
function MathAnalysisPanel({ datasets, exams }) {
  const [mathTab, setMathTab] = useState('trend');

  // Mathematics categories
  const mathCategories = ['수학Ⅰ', '수학A', '수학Ⅱ', '수학B'];

  // Sample math topic data - in production this comes from dataset
  const mathTrendData = useMemo(() => {
    // Try to get from datasets
    const trend = datasets?.trendAnalysis;
    if (trend?.math_trends) return trend.math_trends;
    return null;
  }, [datasets]);

  return (
    <div className="eic-panel">
      <h2><BookOpen size={22} /> 수학 출제 경향 분석</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['trend', 'difficulty', 'prediction'].map(tab => (
          <button
            key={tab}
            onClick={() => setMathTab(tab)}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: mathTab === tab ? 'var(--primary)' : 'var(--bg2)',
              color: mathTab === tab ? '#fff' : 'var(--text-primary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {tab === 'trend' ? '출제 경향' : tab === 'difficulty' ? '난이도' : '예측'}
          </button>
        ))}
      </div>

      {/* Category cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {mathCategories.map((cat, i) => (
          <div key={cat} style={{
            padding: 14, borderRadius: 10, textAlign: 'center',
            background: `rgba(${i * 50 + 59}, ${130 - i * 20}, ${246 - i * 30}, 0.08)`,
            border: '1px solid var(--bd0)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{cat}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              {mathTab === 'trend' ? '출제 빈도 분석중' :
               mathTab === 'difficulty' ? '난이도 분석중' : '출제 예측 분석중'}
            </div>
          </div>
        ))}
      </div>

      {mathTab === 'trend' && (
        <div className="chart-card">
          <h3>📐 수학 코스 1 출제 추이</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            EJU 수학 코스1(수학Ⅰ·A)과 코스2(수학Ⅱ·B)의 연도별 출제 비중 데이터를 불러오는 중입니다.
            {mathTrendData ? '데이터 로드 완료' : '추가 데이터셋이 필요합니다.'}
          </p>
          {/* Show PAST_EXAM_BANK math data */}
          {PAST_EXAM_BANK.math?.topics && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>수학 토픽 출제 빈도</div>
              {Object.entries(PAST_EXAM_BANK.math.topics)
                .sort((a, b) => (PAST_EXAM_BANK.math.topicExams[b[0]] || 0) - (PAST_EXAM_BANK.math.topicExams[a[0]] || 0))
                .slice(0, 15)
                .map(([id, name]) => {
                  const count = PAST_EXAM_BANK.math.topicExams[id] || 0;
                  const pct = PAST_EXAM_BANK.math.totalExams ? Math.round((count / PAST_EXAM_BANK.math.totalExams) * 100) : 0;
                  return (
                    <div key={id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 0', fontSize: 12, borderBottom: '1px solid var(--bd0)',
                    }}>
                      <span style={{ fontWeight: 600 }}>{name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#a855f7', borderRadius: 4 }} />
                        </div>
                        <span style={{ color: 'var(--text-secondary)', minWidth: 30, textAlign: 'right' }}>{count}회</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {mathTab === 'difficulty' && (
        <div className="chart-card">
          <h3>📊 수학 난이도 분포</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            난이도 데이터베이스에서 수학 문항의 난이도 분포를 분석하는 중입니다.
          </p>
          {/* Placeholder — will be filled from difficulty_database.json */}
        </div>
      )}

      {mathTab === 'prediction' && (
        <div className="chart-card">
          <h3>🔮 수학 출제 예측</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            2026년 이후 수학 코스 출제 예측 데이터를 불러오는 중입니다.
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const selectStyle = {
  width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--bd1)',
  background: 'var(--bg3)', color: 'var(--text-primary)', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
};

const eicStyles = `
.eic-container { max-width: 1200px; margin: 0 auto; padding: 0 16px; }
.eic-header { margin-bottom: 20px; }
.eic-header h1 { font-size: 24px; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.eic-header p { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
.eic-stats { display: flex; flex-wrap: wrap; gap: 8px; }
.stat-chip { font-size: 11px; padding: 4px 12px; border-radius: 20px; background: var(--bg2); border: 1px solid var(--bd0); color: var(--text-secondary); }
.eic-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
.eic-tab { padding: 8px 14px; border-radius: 10px; border: 1px solid var(--bd0); background: var(--bg2); color: var(--text-secondary); font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 5px; font-family: inherit; transition: all 0.15s; }
.eic-tab.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.eic-tab:hover:not(.active) { background: var(--bg3); }
.eic-panel { }
.eic-panel h2 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.chart-card { padding: 16px; border-radius: 12px; background: var(--bg2); border: 1px solid var(--bd0); margin-bottom: 16px; }
.chart-card h3 { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
.charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.analysis-summary { margin-bottom: 16px; }
.summary-card { padding: 14px; border-radius: 10px; background: linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.08)); border: 1px solid rgba(168,85,247,0.2); display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--text-primary); line-height: 1.6; }
.insight-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-bottom: 16px; }
.insight-card { padding: 14px; border-radius: 10px; background: var(--bg2); border: 1px solid var(--bd0); border-top: 3px solid; }
.insight-label { font-size: 11px; color: var(--text-tertiary); font-weight: 600; margin-bottom: 4px; }
.insight-value { font-size: 20px; font-weight: 800; color: var(--text-primary); }
.insight-sub { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
.insight-trend { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
@media (max-width: 768px) {
  .charts-grid { grid-template-columns: 1fr; }
  .eic-tabs { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
`;
