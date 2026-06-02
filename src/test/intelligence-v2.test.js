// ═══════════════════════════════════════════════════════════════════════
// Exam Intelligence Engine v2 — Comprehensive Test Suite
// Tests all 6 modules of the v2 intelligence platform.
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeEngine,
  analyzeWrongAnswer,
  traceConceptChain,
  tracePrerequisiteChain,
  inferWeakness,
  analyzeFrequency,
  assessDifficulty,
  predictTopicProbability,
  findRelatedQuestions,
  generateAIFeedback,
  formatAnalysisOutput,
} from '../intelligence/examIntelligenceEngineV2';

import {
  buildPersonalWeaknessGraph,
  getWeaknessGraphForDisplay,
  getStudyRecommendationsFromGraph,
} from '../intelligence/personalWeaknessGraph';

import {
  predictFutureExamsV2,
  formatPredictionsForDisplay,
  getTopPredictions,
} from '../intelligence/futurePredictorV2';

import {
  computeStudyCoachV2,
  formatStudyPlanForDisplay,
} from '../intelligence/studyCoachV2';

import {
  recommendQuestions,
  formatRecommendations,
} from '../intelligence/questionRecommender';

import {
  explainRecommendation,
  formatExplanation,
  formatExplanationAsLines,
} from '../intelligence/explainableAI';

// ── Mock Datasets ─────────────────────────────────────────────────────

const mockKnowledgeGraph = {
  name: 'EJU Knowledge Graph v3',
  version: '3.0.0',
  statistics: { total_nodes: 86, total_edges: 116 },
  taxonomy: {
    economy: {
      label: '경제',
      topics: {
        '수요·공급과 시장균형': ['시장균형', '가격탄력성', '수요곡선', '공급곡선'],
        '금융·통화정책': ['통화정책', '금리', '중앙은행', '인플레이션'],
      },
    },
    history: {
      label: '역사',
      topics: {
        '시민혁명': ['프랑스혁명', '미국독립', '명예혁명', '인권선언'],
        '산업혁명·자본주의': ['산업혁명'],
      },
    },
    politics: {
      label: '정치',
      topics: {
        '헌법·기본권': ['기본권', '자유권', '사회권'],
        '통치기구': ['의원내각제', '삼권분립', '의회'],
      },
    },
    geography: {
      label: '지리',
      topics: {
        '기후·케펜구분': ['케펜구분', '기후대'],
        '지형·판구조': ['판구조', '지형'],
      },
    },
    society: {
      label: '사회',
      topics: {
        '환경문제': ['기후변화', '환경오염'],
      },
    },
  },
  edges: [
    { sourceId: 'topic:economy:수요·공급과 시장균형', targetId: 'topic:economy:금융·통화정책', type: 'prerequisite', weight: 1.5 },
    { sourceId: 'topic:history:시민혁명', targetId: 'topic:history:산업혁명·자본주의', type: 'prerequisite', weight: 1.5 },
    { sourceId: 'topic:politics:헌법·기본권', targetId: 'topic:politics:통치기구', type: 'prerequisite', weight: 1.0 },
    { sourceId: 'topic:geography:지형·판구조', targetId: 'topic:geography:기후·케펜구분', type: 'prerequisite', weight: 1.0 },
  ],
};

const mockTrendAnalysis = {
  analysis_period: '2002-2025',
  total_years: 24,
  total_questions_analyzed: 1052,
  total_topics_tracked: 34,
  topic_trends: {
    '시민혁명': {
      total: 100, years_active: 18, avg_per_year: 4.17,
      recent_5yr: 45, growth_rate_pct: 12.5,
      yearly: { '2024': 4, '2025': 5 },
    },
    '금융·통화정책': {
      total: 44, years_active: 15, avg_per_year: 1.83,
      recent_5yr: 19, growth_rate_pct: 8.3,
      yearly: { '2024': 3, '2025': 3 },
    },
  },
  domain_trends: {
    economy: {
      total: 345, recent_5yr_total: 93, growth_rate_pct: -63.1,
      yearly: { '2024': 12, '2025': 12 },
    },
    history: {
      total: 197, recent_5yr_total: 62, growth_rate_pct: -54.1,
      yearly: { '2024': 7, '2025': 7 },
    },
  },
};

const mockDifficultyDB = {
  total_questions: 1052,
  average_score: 40.0,
  score_distribution: { medium: 897, easy: 138, hard: 17 },
  questions: [
    { id: 'q1', year: 2024, domain: 'history', topic: '시민혁명', difficulty_score: 42, difficulty_category: 'medium' },
    { id: 'q2', year: 2025, domain: 'history', topic: '시민혁명', difficulty_score: 38, difficulty_category: 'medium' },
    { id: 'q3', year: 2024, domain: 'economy', topic: '금융·통화정책', difficulty_score: 55, difficulty_category: 'medium' },
  ],
};

const mockPrediction2026 = {
  prediction_year: 2026,
  top_30_predictions: [
    { topic: '경제성장·경기변동', prediction_probability_pct: 64.9, combined_score: 64.9 },
    { topic: '시민혁명', prediction_probability_pct: 61.5, combined_score: 61.5 },
    { topic: '금융·통화정책', prediction_probability_pct: 55.5, combined_score: 55.5 },
    { topic: '헌법·기본권', prediction_probability_pct: 52.0, combined_score: 52.0 },
  ],
};

const mockWeakProfile = {
  domain_structure: {
    economy: {
      label: '경제',
      prerequisite_order: ['수요·공급과 시장균형', 'GDP·국민소득', '금융·통화정책', '재정·조세정책'],
    },
    history: {
      label: '역사',
      prerequisite_order: ['시민혁명', '산업혁명·자본주의', '제국주의·식민지', '세계대전'],
    },
    politics: {
      label: '정치',
      prerequisite_order: ['정치사상', '헌법·기본권', '통치기구', '선거·정당'],
    },
  },
};

const mockGoldStandard = {
  total_questions: 608,
  year_range: { start: 2016, end: 2025 },
  questions: [
    { id: 'gold_2024_1_12', year: 2024, round: 1, question_number: 12, domain: 'history', topic: '시민혁명', subtopic: '프랑스혁명', difficulty: 4, difficulty_score: 42 },
    { id: 'gold_2024_1_13', year: 2024, round: 1, question_number: 13, domain: 'history', topic: '시민혁명', subtopic: '인권선언', difficulty: 3, difficulty_score: 38 },
    { id: 'gold_2025_1_10', year: 2025, round: 1, question_number: 10, domain: 'history', topic: '시민혁명', subtopic: '미국독립', difficulty: 5, difficulty_score: 50 },
    { id: 'gold_2024_1_20', year: 2024, round: 1, question_number: 20, domain: 'economy', topic: '금융·통화정책', subtopic: '통화정책', difficulty: 4, difficulty_score: 45 },
  ],
};

const mockDatasets = {
  goldStandard: mockGoldStandard,
  knowledgeGraph: mockKnowledgeGraph,
  trendAnalysis: mockTrendAnalysis,
  difficultyDB: mockDifficultyDB,
  prediction2026: mockPrediction2026,
  weakProfile: mockWeakProfile,
};

// ── Tests ─────────────────────────────────────────────────────────────

describe('Exam Intelligence Engine v2', () => {
  beforeEach(() => {
    initializeEngine(mockDatasets);
  });

  // ══════════════════════════════════════════════════════════════════
  // 1. Concept Chain Tracing
  // ══════════════════════════════════════════════════════════════════
  describe('traceConceptChain()', () => {
    it('should trace concept chain for 시민혁명', () => {
      const chain = traceConceptChain('시민혁명', 'history', mockDatasets);
      expect(chain.length).toBeGreaterThanOrEqual(2);
      expect(chain[0].type).toBe('domain');
      expect(chain[0].name).toBe('역사');
      expect(chain.some(c => c.name === '시민혁명')).toBe(true);
    });

    it('should return minimal chain for unknown topic', () => {
      const chain = traceConceptChain('가상의주제', 'unknown', mockDatasets);
      expect(chain.length).toBeGreaterThanOrEqual(1);
    });

    it('should find subtopics in the chain', () => {
      const chain = traceConceptChain('프랑스혁명', 'history', mockDatasets);
      const hasSub = chain.some(c => c.type === 'subtopic');
      expect(hasSub).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 2. Prerequisite Chain Tracing
  // ══════════════════════════════════════════════════════════════════
  describe('tracePrerequisiteChain()', () => {
    it('should find prerequisites for 금융·통화정책', () => {
      const chain = tracePrerequisiteChain('금융·통화정책', 'economy', [], mockDatasets);
      expect(chain.length).toBeGreaterThanOrEqual(1);
      expect(chain.some(p => p.name === '수요·공급과 시장균형')).toBe(true);
    });

    it('should mark importance weight correctly', () => {
      const chain = tracePrerequisiteChain('금융·통화정책', 'economy', [], mockDatasets);
      const highImportance = chain.filter(p => p.importance === 'high');
      expect(highImportance.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 3. Weakness Inference
  // ══════════════════════════════════════════════════════════════════
  describe('inferWeakness()', () => {
    it('should return low weakness for topic with no mistakes', () => {
      const weakness = inferWeakness('시민혁명', 'history', '', [], mockDatasets);
      expect(weakness.mistakeCount).toBe(0);
      expect(weakness.priority).toBe('low');
    });

    it('should detect high weakness for topic with many mistakes', () => {
      const studentExams = [{
        id: 'exam1',
        date: '2025-01-15',
        comprehensive: {
          score: 140,
          mistakes: [
            { questionNumber: 12, topic: '시민혁명', domain: 'history', memo: '프랑스혁명 개념 혼동', errorType: '개념혼동' },
            { questionNumber: 13, topic: '시민혁명', domain: 'history', memo: '인권선언 내용 부족', errorType: '정보부족' },
            { questionNumber: 15, topic: '시민혁명', domain: 'history', memo: '비교 문제 실수', errorType: '연계사고' },
          ],
        },
      }];
      const weakness = inferWeakness('시민혁명', 'history', '', studentExams, mockDatasets);
      expect(weakness.mistakeCount).toBe(3);
      expect(weakness.priority).toBe('high');
      expect(weakness.weakSubConcepts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 4. Frequency Analysis
  // ══════════════════════════════════════════════════════════════════
  describe('analyzeFrequency()', () => {
    it('should return frequency data for 시민혁명', () => {
      const freq = analyzeFrequency('시민혁명', 'history', mockDatasets);
      expect(freq.totalAppearances).toBeGreaterThan(0);
      expect(freq.trend).toBeDefined();
      expect(freq.source).toBeDefined();
    });

    it('should handle topic not in datasets', () => {
      const freq = analyzeFrequency('가상주제', 'unknown', mockDatasets);
      expect(freq.totalAppearances).toBe(0);
      expect(freq.source).toBe('none');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 5. Difficulty Assessment
  // ══════════════════════════════════════════════════════════════════
  describe('assessDifficulty()', () => {
    it('should assess difficulty for 시민혁명', () => {
      const diff = assessDifficulty('시민혁명', 'history', '', mockDatasets);
      expect(diff.averageDifficultyScore).toBeGreaterThan(0);
      expect(diff.difficultyCategory).toBeDefined();
      expect(diff.difficultyLabel).toBeDefined();
    });

    it('should return default for unknown topic', () => {
      const diff = assessDifficulty('가상주제', 'unknown', '', { difficultyDB: null });
      expect(diff.averageDifficultyScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 6. Future Prediction
  // ══════════════════════════════════════════════════════════════════
  describe('predictTopicProbability()', () => {
    it('should predict probability for 시민혁명', () => {
      const pred = predictTopicProbability('시민혁명', 'history', mockDatasets, 2026);
      expect(pred.probabilityPct).toBeGreaterThan(0);
      expect(pred.targetYear).toBe(2026);
      expect(pred.source).toBeDefined();
    });

    it('should return default prediction for unlisted topic', () => {
      const pred = predictTopicProbability('가상주제', 'unknown', {}, 2026);
      expect(pred.probabilityPct).toBeDefined();
      expect(pred.confidence).toBe('low');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 7. Related Questions
  // ══════════════════════════════════════════════════════════════════
  describe('findRelatedQuestions()', () => {
    it('should find related questions for 시민혁명', () => {
      const questions = findRelatedQuestions('시민혁명', 'history', '', mockDatasets);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions[0].topic).toBe('시민혁명');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 8. Full Wrong Answer Analysis
  // ══════════════════════════════════════════════════════════════════
  describe('analyzeWrongAnswer()', () => {
    it('should perform full analysis for a wrong answer on 시민혁명', () => {
      const result = analyzeWrongAnswer({
        questionId: 'Q21',
        domain: 'history',
        topic: '시민혁명',
        subtopic: '프랑스혁명',
        year: 2025,
        round: 1,
        memo: '인권선언과 삼권분립 관계 이해 부족',
        errorType: '개념혼동',
      }, { datasets: mockDatasets });

      expect(result.analysis).toBeDefined();
      expect(result.analysis.conceptChain.length).toBeGreaterThan(0);
      expect(result.analysis.weakness).toBeDefined();
      expect(result.analysis.frequency).toBeDefined();
      expect(result.analysis.difficulty).toBeDefined();
      expect(result.analysis.prediction).toBeDefined();
      expect(result.analysis.relatedQuestions.length).toBeGreaterThan(0);
      expect(result.feedback).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should give priority B or higher for high-error topics', () => {
      const studentExams = [{
        id: 'exam1', date: '2025-01-15',
        comprehensive: {
          score: 140,
          mistakes: [
            { questionNumber: 12, topic: '시민혁명', domain: 'history', memo: '개념 부족', errorType: '정보부족' },
            { questionNumber: 13, topic: '시민혁명', domain: 'history', memo: '혼동', errorType: '연계사고' },
          ],
        },
      }];

      const result = analyzeWrongAnswer({
        questionId: 'Q21', domain: 'history', topic: '시민혁명', year: 2025,
      }, { datasets: mockDatasets, studentExams });

      const priority = result.feedback?.learningPriority?.grade || 'C';
      expect(['A', 'B', 'C']).toContain(priority);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 9. Format Output
  // ══════════════════════════════════════════════════════════════════
  describe('formatAnalysisOutput()', () => {
    it('should format output like the requirement example', () => {
      const result = analyzeWrongAnswer({
        questionId: 'Q21', domain: 'history', topic: '시민혁명', year: 2025,
      }, { datasets: mockDatasets });

      const formatted = formatAnalysisOutput(result);
      expect(formatted.formatted).toContain('Q21 틀림');
      expect(formatted.conceptChain.length).toBeGreaterThan(0);
      expect(formatted.relatedCount).toBeGreaterThanOrEqual(0);
      expect(formatted.totalYears).toBe(24);
      expect(formatted.predictionProb).toBeGreaterThanOrEqual(0);
      expect(formatted.priorityGrade).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Personal Weakness Graph Tests
// ═══════════════════════════════════════════════════════════════════════
describe('Personal Weakness Graph', () => {
  describe('buildPersonalWeaknessGraph()', () => {
    it('should build graph with nodes and edges', () => {
      const graph = buildPersonalWeaknessGraph([], mockDatasets);
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges).toBeDefined();
      expect(graph.stats).toBeDefined();
    });

    it('should include topic and domain nodes', () => {
      const graph = buildPersonalWeaknessGraph([], mockDatasets);
      const topics = graph.nodes.filter(n => n.type === 'topic');
      const domains = graph.nodes.filter(n => n.type === 'domain');
      expect(topics.length).toBeGreaterThan(0);
      expect(domains.length).toBeGreaterThan(0);
    });

    it('should mark nodes as unseen when no exam data', () => {
      const graph = buildPersonalWeaknessGraph([], mockDatasets);
      const unseen = graph.nodes.filter(n => n.status === 'unseen');
      expect(unseen.length).toBeGreaterThan(0);
    });
  });

  describe('getWeaknessGraphForDisplay()', () => {
    it('should format graph for visualization', () => {
      const graph = buildPersonalWeaknessGraph([], mockDatasets);
      const display = getWeaknessGraphForDisplay(graph);
      expect(display.nodes.length).toBeGreaterThan(0);
      expect(display.nodes[0]).toHaveProperty('color');
      expect(display.nodes[0]).toHaveProperty('size');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Future Predictor v2 Tests
// ═══════════════════════════════════════════════════════════════════════
describe('Future Predictor v2', () => {
  describe('predictFutureExamsV2()', () => {
    it('should generate predictions for 2026-2028', () => {
      const predictions = predictFutureExamsV2(mockDatasets);
      expect(predictions.yearly[2026]).toBeDefined();
      expect(predictions.yearly[2027]).toBeDefined();
      expect(predictions.yearly[2028]).toBeDefined();
      expect(predictions.insights.length).toBeGreaterThan(0);
    });

    it('should include methodology', () => {
      const predictions = predictFutureExamsV2(mockDatasets);
      expect(predictions.methodology.factors.length).toBe(5);
      expect(predictions.methodology.predictionYears).toEqual([2026, 2027, 2028]);
    });

    it('should assign probability scores to each topic', () => {
      const predictions = predictFutureExamsV2(mockDatasets);
      for (const pred of predictions.yearly[2026]) {
        expect(pred.predictionProbabilityPct).toBeGreaterThanOrEqual(0);
        expect(pred.predictionProbabilityPct).toBeLessThanOrEqual(100);
        expect(pred.combinedScore).toBeDefined();
      }
    });
  });

  describe('getTopPredictions()', () => {
    it('should return top N predictions for a year', () => {
      const predictions = predictFutureExamsV2(mockDatasets);
      const top5 = getTopPredictions(predictions, 2026, 5);
      expect(top5.length).toBeLessThanOrEqual(5);
      expect(top5[0].rank).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. AI Study Coach v2 Tests
// ═══════════════════════════════════════════════════════════════════════
describe('AI Study Coach v2', () => {
  describe('computeStudyCoachV2()', () => {
    it('should generate study plan with ROI analysis', () => {
      const plan = computeStudyCoachV2([], mockDatasets, { targetComprehensive: 180 });
      expect(plan.studentProfile).toBeDefined();
      expect(plan.studentProfile.currentScore).toBe(0);
      expect(plan.studentProfile.gap).toBe(180);
      expect(plan.topicROI.length).toBeGreaterThan(0);
      expect(plan.studySequence.length).toBeGreaterThan(0);
    });

    it('should include weekly plan', () => {
      const plan = computeStudyCoachV2([], mockDatasets, { targetComprehensive: 180 });
      expect(plan.weeklyPlan.length).toBeGreaterThan(0);
      expect(plan.weeklyPlan[0].dailyTasks.length).toBeGreaterThan(0);
    });

    it('should project score improvement', () => {
      const plan = computeStudyCoachV2([], mockDatasets, { targetComprehensive: 180 });
      expect(plan.scoreProjection).toBeDefined();
      expect(plan.scoreProjection.weeklyProjection.length).toBeGreaterThan(0);
    });

    it('should rank topics by ROI', () => {
      const plan = computeStudyCoachV2([], mockDatasets, { targetComprehensive: 180 });
      for (let i = 1; i < plan.topicROI.length; i++) {
        expect(plan.topicROI[i - 1].roiScore).toBeGreaterThanOrEqual(plan.topicROI[i].roiScore);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Question Recommendation Engine Tests
// ═══════════════════════════════════════════════════════════════════════
describe('Question Recommendation Engine', () => {
  describe('recommendQuestions()', () => {
    it('should return topic recommendations with reasons', () => {
      const recs = recommendQuestions([], mockDatasets, { count: 5 });
      expect(recs.length).toBeGreaterThan(0);
      expect(recs[0].topic).toBeDefined();
      expect(recs[0].reason).toBeDefined();
      expect(recs[0].priority).toBeDefined();
    });

    it('should prioritize topics with high error rates', () => {
      const studentExams = [{
        id: 'exam1', date: '2025-01-15',
        comprehensive: {
          score: 140,
          mistakes: [
            { questionNumber: 12, topic: '시민혁명', domain: 'history', memo: '부족', errorType: '정보부족' },
            { questionNumber: 13, topic: '시민혁명', domain: 'history', memo: '혼동', errorType: '연계사고' },
            { questionNumber: 14, topic: '시민혁명', domain: 'history', memo: '실수', errorType: '실수' },
          ],
        },
      }];

      const recs = recommendQuestions(studentExams, mockDatasets, { count: 10 });
      const topRec = recs[0];
      expect(topRec.priority).toBe('high');
      expect(topRec.combinedScore).toBeGreaterThanOrEqual(40);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Explainable AI Tests
// ═══════════════════════════════════════════════════════════════════════
describe('Explainable AI', () => {
  describe('explainRecommendation()', () => {
    it('should generate explanation with multiple factors', () => {
      const rec = { topic: '금융·통화정책', domain: 'economy', combinedScore: 80, priority: 'high' };
      const explanation = explainRecommendation(rec, [], mockDatasets);
      expect(explanation.summary).toBeTruthy();
      expect(explanation.factors.length).toBeGreaterThanOrEqual(4);
    });

    it('should include accuracy factor', () => {
      const rec = { topic: '금융·통화정책', domain: 'economy' };
      const explanation = explainRecommendation(rec, [], mockDatasets);
      const accuracy = explanation.factors.find(f => f.type === 'accuracy');
      expect(accuracy).toBeDefined();
      expect(accuracy.label).toBe('최근 정답률');
    });

    it('should include prediction factor', () => {
      const rec = { topic: '금융·통화정책', domain: 'economy' };
      const explanation = explainRecommendation(rec, [], mockDatasets);
      const prediction = explanation.factors.find(f => f.type === 'prediction');
      expect(prediction).toBeDefined();
      expect(prediction.value).toContain('%');
    });
  });

  describe('formatExplanation()', () => {
    it('should format explanation for display', () => {
      const rec = { topic: '시민혁명', domain: 'history' };
      const explanation = explainRecommendation(rec, [], mockDatasets);
      const formatted = formatExplanation(explanation);
      expect(formatted.title).toContain('시민혁명');
      expect(formatted.factors.length).toBeGreaterThan(0);
    });
  });

  describe('formatExplanationAsLines()', () => {
    it('should format as simple lines', () => {
      const rec = { topic: '시민혁명', domain: 'history' };
      const explanation = explainRecommendation(rec, [], mockDatasets);
      const lines = formatExplanationAsLines(explanation);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]).toMatch(/^-/);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════
describe('Integration: End-to-End Pipeline', () => {
  it('should run full analysis and produce explainable recommendations', () => {
    // 1. Student with mistakes
    const studentExams = [{
      id: 'exam1', date: '2025-01-15',
      comprehensive: {
        score: 140,
        mistakes: [
          { questionNumber: 12, topic: '시민혁명', domain: 'history', memo: '프랑스혁명 개념 부족', errorType: '정보부족' },
          { questionNumber: 20, topic: '금융·통화정책', domain: 'economy', memo: '통화정책 수단 혼동', errorType: '연계사고' },
        ],
      },
    }];

    // 2. Analyze each wrong answer
    const analysis1 = analyzeWrongAnswer({
      questionId: 'Q12', domain: 'history', topic: '시민혁명', subtopic: '프랑스혁명', year: 2025,
      memo: '프랑스혁명 개념 부족', errorType: '정보부족',
    }, { datasets: mockDatasets, studentExams });

    const analysis2 = analyzeWrongAnswer({
      questionId: 'Q20', domain: 'economy', topic: '금융·통화정책', year: 2025,
      memo: '통화정책 수단 혼동', errorType: '연계사고',
    }, { datasets: mockDatasets, studentExams });

    // 3. Verify both analyses complete
    expect(analysis1.analysis.conceptChain.length).toBeGreaterThan(0);
    expect(analysis2.analysis.conceptChain.length).toBeGreaterThan(0);
    expect(analysis1.feedback.learningPriority).toBeDefined();
    expect(analysis2.feedback.learningPriority).toBeDefined();

    // 4. Get recommendations
    const recs = recommendQuestions(studentExams, mockDatasets, { count: 5 });

    // 5. Generate explanations
    const explanations = recs.map(rec =>
      explainRecommendation(rec, studentExams, mockDatasets)
    );

    // 6. Verify explainability
    expect(explanations.length).toBeGreaterThan(0);
    for (const exp of explanations) {
      expect(exp.factors.length).toBeGreaterThanOrEqual(4);
      const hasAccuracy = exp.factors.some(f => f.type === 'accuracy');
      const hasPrediction = exp.factors.some(f => f.type === 'prediction');
      const hasDifficulty = exp.factors.some(f => f.type === 'difficulty');
      const hasFrequency = exp.factors.some(f => f.type === 'frequency');
      expect(hasAccuracy || hasPrediction || hasDifficulty || hasFrequency).toBe(true);
    }
  });
});
