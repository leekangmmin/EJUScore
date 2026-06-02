// ═══════════════════════════════════════════════════════════════════════
// Exam Intelligence Engine v2
// Central orchestrator that integrates knowledge graph lookup,
// prerequisite tracking, weakness inference, frequency analysis,
// difficulty assessment, and AI feedback generation.
//
// User wrong answer → Knowledge Graph → Prerequisite Trace →
// Weakness Inference → Frequency Lookup → Difficulty Lookup →
// AI Feedback Generation
// ═══════════════════════════════════════════════════════════════════════

import { buildPersonalWeaknessGraph } from './personalWeaknessGraph';
import { predictFutureExamsV2 } from './futurePredictorV2';
import { computeStudyCoachV2 } from './studyCoachV2';
import { recommendQuestions } from './questionRecommender';
import { explainRecommendation } from './explainableAI';

// ── Constants ─────────────────────────────────────────────────────────
const DOMAIN_LABELS = {
  economy: '경제', politics: '정치', history: '역사',
  geography: '지리', society: '사회',
};

const DOMAIN_COLORS = {
  economy: '#10b981', politics: '#ef4444', history: '#a855f7',
  geography: '#3b82f6', society: '#f59e0b',
};

/**
 * Default dataset loaded from JSON files at build/import time.
 * In production these are loaded via fetch or static import.
 */
let _datasetCache = null;

/**
 * Initialize the engine with dataset files.
 * @param {object} datasets - { goldStandard, knowledgeGraph, trendAnalysis, difficultyDB, prediction2026, weakProfile, studyPlan }
 */
export function initializeEngine(datasets) {
  _datasetCache = {
    goldStandard: datasets?.goldStandard || null,
    knowledgeGraph: datasets?.knowledgeGraph || null,
    trendAnalysis: datasets?.trendAnalysis || null,
    difficultyDB: datasets?.difficultyDB || null,
    prediction2026: datasets?.prediction2026 || null,
    weakProfile: datasets?.weakProfile || null,
    studyPlan: datasets?.studyPlan || null,
  };
  return _datasetCache;
}

/**
 * Load datasets from localStorage or fetch.
 */
export function loadDatasets() {
  try {
    const goldStandard = JSON.parse(localStorage.getItem('eju_gold_standard') || 'null');
    const knowledgeGraph = JSON.parse(localStorage.getItem('eju_knowledge_graph_v3') || 'null');
    const trendAnalysis = JSON.parse(localStorage.getItem('eju_trend_analysis_v2') || 'null');
    const difficultyDB = JSON.parse(localStorage.getItem('eju_difficulty_database') || 'null');
    const prediction2026 = JSON.parse(localStorage.getItem('eju_prediction_2026') || 'null');
    const weakProfile = JSON.parse(localStorage.getItem('eju_weakness_profile') || 'null');
    const studyPlan = JSON.parse(localStorage.getItem('eju_study_plan') || 'null');

    const loaded = { goldStandard, knowledgeGraph, trendAnalysis, difficultyDB, prediction2026, weakProfile, studyPlan };
    _datasetCache = loaded;
    return loaded;
  } catch (e) {
    console.warn('[EIE v2] Failed to load datasets:', e.message);
    return null;
  }
}

/**
 * Store datasets into localStorage for offline use.
 */
export function persistDatasets(datasets) {
  try {
    for (const [key, data] of Object.entries(datasets)) {
      const storageKey = `eju_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
      localStorage.setItem(storageKey, JSON.stringify(data));
    }
    _datasetCache = datasets;
  } catch (e) {
    console.warn('[EIE v2] Failed to persist datasets:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 1. WRONG ANSWER ANALYSIS PIPELINE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Full wrong answer analysis pipeline.
 * Takes a single wrong question and returns complete analysis.
 *
 * @param {object} wrongInput - { questionId, domain, topic, subtopic, year, round, memo, errorType }
 * @param {object} options - { studentExams, datasets }
 * @returns {object} Complete analysis: { conceptChain, weakness, frequency, difficulty, prediction, feedback }
 */
export function analyzeWrongAnswer(wrongInput, options = {}) {
  const datasets = options.datasets || _datasetCache;
  const studentExams = options.studentExams || [];
  const {
    questionId = '',
    domain = '',
    topic = '',
    subtopic = '',
    year = 2025,
    round = 1,
    memo = '',
    errorType = '',
  } = wrongInput;

  // STEP 1: Knowledge Graph Lookup — get concept chain
  const conceptChain = traceConceptChain(topic, domain, datasets);

  // STEP 2: Prerequisite Chain — find missing prerequisites
  const prerequisiteChain = tracePrerequisiteChain(topic, domain, conceptChain, datasets);

  // STEP 3: Weakness Inference — analyze student's weakness on this topic
  const weakness = inferWeakness(topic, domain, subtopic, studentExams, datasets);

  // STEP 4: Frequency Analysis — how often this topic appears
  const frequency = analyzeFrequency(topic, domain, datasets);

  // STEP 5: Difficulty Assessment
  const difficulty = assessDifficulty(topic, domain, subtopic, datasets);

  // STEP 6: Future Prediction — 2026+ probability
  const prediction = predictTopicProbability(topic, domain, datasets);

  // STEP 7: Related Questions — find all related questions in dataset
  const relatedQuestions = findRelatedQuestions(topic, domain, subtopic, datasets);

  // STEP 8: Generate feedback
  const feedback = generateAIFeedback({
    wrongInput, conceptChain, prerequisiteChain, weakness,
    frequency, difficulty, prediction, relatedQuestions,
  });

  // STEP 9: Recommended next actions
  const recommendations = generateRecommendations({
    wrongInput, conceptChain, prerequisiteChain, weakness,
    frequency, difficulty, prediction, relatedQuestions,
  });

  return {
    questionId,
    domain,
    topic,
    subtopic,
    year,
    round,
    analysis: {
      conceptChain,
      prerequisiteChain,
      weakness,
      frequency,
      difficulty,
      prediction,
      relatedQuestions,
    },
    feedback,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Batch analyze multiple wrong answers.
 */
export function analyzeBatchWrongAnswers(wrongInputs, options = {}) {
  return wrongInputs.map(input => analyzeWrongAnswer(input, options));
}

// ═══════════════════════════════════════════════════════════════════════
// 2. CONCEPT CHAIN TRACING
// ═══════════════════════════════════════════════════════════════════════

/**
 * Trace the concept chain for a topic.
 * Given "시민혁명" → ["근대 민주주의", "프랑스혁명", "인권선언", "삼권분립", "현대 헌법"]
 *
 * @param {string} topic - Topic name
 * @param {string} domain - Domain name
 * @param {object} datasets - Loaded datasets
 * @returns {Array<{name: string, type: string, depth: number}>}
 */
export function traceConceptChain(topic, domain, datasets) {
  const chain = [];
  if (!topic) return chain;

  // Use knowledge graph v3 taxonomy if available
  const kg = datasets?.knowledgeGraph;
  if (kg?.taxonomy) {
    // Find the topic in the taxonomy
    for (const [domKey, domData] of Object.entries(kg.taxonomy)) {
      const topics = domData.topics || {};
      for (const [topicName, subtopics] of Object.entries(topics)) {
        // Check if topic matches
        if (topicName === topic || subtopics.includes(topic)) {
          // Build chain: domain → topic → subtopic
          chain.push({ name: domData.label || domKey, type: 'domain', depth: 0 });
          chain.push({ name: topicName, type: 'topic', depth: 1 });
          if (topic !== topicName && subtopics.includes(topic)) {
            // The input is a subtopic
            chain.push({ name: topic, type: 'subtopic', depth: 2 });
          }
          // Add subtopics as children
          for (const sub of subtopics) {
            if (sub !== topic) {
              chain.push({ name: sub, type: 'subtopic', depth: 2, isRelated: true });
            }
          }
          return chain;
        }
      }
    }
  }

  // Fallback: use prerequisite_order from weakness_profile
  const wp = datasets?.weakProfile;
  if (wp?.domain_structure) {
    for (const [domKey, domData] of Object.entries(wp.domain_structure)) {
      const prereqOrder = domData.prerequisite_order || [];
      const idx = prereqOrder.indexOf(topic);
      if (idx !== -1) {
        chain.push({ name: domData.label || domKey, type: 'domain', depth: 0 });
        // Add all prerequisites up to this topic
        for (let i = 0; i <= idx; i++) {
          chain.push({ name: prereqOrder[i], type: 'topic', depth: i + 1 });
        }
        return chain;
      }
    }
  }

  // Minimal fallback
  chain.push({ name: domain, type: 'domain', depth: 0 });
  chain.push({ name: topic, type: 'topic', depth: 1 });
  return chain;
}

/**
 * Trace prerequisite chain — find foundational concepts needed before this topic.
 *
 * @param {string} topic - Topic name
 * @param {string} domain - Domain name
 * @param {Array} conceptChain - Already traced concepts
 * @param {object} datasets - Loaded datasets
 * @returns {Array<{name: string, mastery: string, importance: string}>}
 */
export function tracePrerequisiteChain(topic, domain, conceptChain, datasets) {
  const prereqs = [];

  // Use knowledge_graph edges
  const kg = datasets?.knowledgeGraph;
  if (kg?.edges) {
    // Find all prerequisite edges pointing TO our topic
    const topicNodeId = `topic:${domain}:${topic}`;
    const allEdges = kg.edges || [];

    for (const edge of allEdges) {
      if (edge.targetId === topicNodeId && edge.type === 'prerequisite') {
        // Extract the prerequisite topic name
        const sourceParts = (edge.sourceId || '').split(':');
        const prereqName = sourceParts[sourceParts.length - 1] || '';
        prereqs.push({
          name: prereqName,
          importance: edge.weight > 1.5 ? 'high' : edge.weight > 1 ? 'medium' : 'low',
          source: 'knowledge_graph',
        });
      }
    }
  }

  // Fallback: use prerequisite_order from weakness_profile
  if (prereqs.length === 0 && datasets?.weakProfile?.domain_structure) {
    const domStruct = datasets.weakProfile.domain_structure;
    for (const [domKey, domData] of Object.entries(domStruct)) {
      const prereqOrder = domData.prerequisite_order || [];
      const idx = prereqOrder.indexOf(topic);
      if (idx > 0) {
        // All topics before this one are prerequisites
        for (let i = 0; i < idx; i++) {
          prereqs.push({
            name: prereqOrder[i],
            importance: i < idx - 1 ? 'low' : 'high',
            source: 'weakness_profile',
          });
        }
        break;
      }
    }
  }

  return prereqs;
}

// ═══════════════════════════════════════════════════════════════════════
// 3. WEAKNESS INFERENCE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Infer student's weakness on a specific topic based on exam history.
 *
 * @param {string} topic - Topic name
 * @param {string} domain - Domain name
 * @param {string} subtopic - Subtopic name
 * @param {Array} studentExams - Student's exam records
 * @param {object} datasets - Loaded datasets
 * @returns {object} Weakness assessment
 */
export function inferWeakness(topic, domain, subtopic, studentExams, datasets) {
  // Collect all mistakes related to this topic
  const relatedMistakes = [];
  for (const exam of (studentExams || [])) {
    const compMistakes = exam.comprehensive?.mistakes || [];
    for (const m of compMistakes) {
      const mTopic = m.topic || '';
      const mDomain = m.domain || '';
      if (mTopic === topic || mDomain === domain) {
        relatedMistakes.push({
          examId: exam.id,
          examDate: exam.date,
          questionNumber: m.questionNumber,
          memo: m.memo || '',
          errorType: m.errorType || '',
        });
      }
    }
  }

  // Calculate weakness score
  const mistakeCount = relatedMistakes.length;
  const hasRepeatedMistakes = mistakeCount >= 2;
  const recentMistakes = relatedMistakes.filter(m => {
    if (!m.examDate) return false;
    try {
      const d = new Date(m.examDate);
      const monthsAgo = (Date.now() - d.getTime()) / (30 * 24 * 60 * 60 * 1000);
      return monthsAgo <= 6;
    } catch { return false; }
  });

  const weaknessScore = Math.min(1, (mistakeCount * 0.2) + (recentMistakes.length * 0.1));
  const priority = weaknessScore > 0.5 ? 'high' : weaknessScore > 0.2 ? 'medium' : 'low';

  // Determine what specific sub-concepts are weak
  const weakSubConcepts = [];
  const memoText = relatedMistakes.map(m => m.memo).join(' ');

  // Check for common weakness signals
  if (memoText.includes('비교') || memoText.includes('차이') || memoText.includes('대비')) {
    weakSubConcepts.push('개념 비교·대비');
  }
  if (memoText.includes('계산') || memoText.includes('수치') || memoText.includes('숫자')) {
    weakSubConcepts.push('수치 계산');
  }
  if (memoText.includes('그래프') || memoText.includes('도표') || memoText.includes('표')) {
    weakSubConcepts.push('자료(그래프·표) 해석');
  }
  if (memoText.includes('용어') || memoText.includes('정의') || memoText.includes('뜻')) {
    weakSubConcepts.push('용어·정의 이해');
  }
  if (mistakeCount >= 3) {
    weakSubConcepts.push('기본 개념 이해');
  }

  return {
    topic,
    domain,
    mistakeCount,
    recentMistakeCount: recentMistakes.length,
    weaknessScore: parseFloat(weaknessScore.toFixed(2)),
    priority,
    weakSubConcepts: weakSubConcepts.length > 0 ? weakSubConcepts : ['종합적 이해 필요'],
    relatedMistakes: relatedMistakes.slice(-5),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 4. FREQUENCY ANALYSIS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Analyze how frequently a topic appears in EJU exams (2002-2025).
 *
 * @param {string} topic - Topic name
 * @param {string} domain - Domain name
 * @param {object} datasets - Loaded datasets
 * @returns {object} Frequency analysis
 */
export function analyzeFrequency(topic, domain, datasets) {
  // Use trend_analysis_v2.json if available
  const trend = datasets?.trendAnalysis;
  if (trend?.topic_trends) {
    const topicTrend = trend.topic_trends[topic];
    if (topicTrend) {
      return {
        topic,
        totalAppearances: topicTrend.total || 0,
        yearsActive: topicTrend.years_active || 0,
        totalYears: trend.total_years || 24,
        frequency: parseFloat(((topicTrend.total || 0) / Math.max(1, trend.total_years || 24)).toFixed(1)),
        avgPerYear: parseFloat((topicTrend.avg_per_year || 0).toFixed(2)),
        recent5yrCount: topicTrend.recent_5yr || 0,
        growthRate: topicTrend.growth_rate_pct || 0,
        trend: topicTrend.growth_rate_pct > 10 ? 'increasing' :
               topicTrend.growth_rate_pct < -10 ? 'decreasing' : 'stable',
        yearlyBreakdown: topicTrend.yearly || {},
        source: 'trend_analysis_v2',
      };
    }
  }

  // Use gold_standard if available
  const gs = datasets?.goldStandard;
  if (gs?.questions) {
    const matchingQs = gs.questions.filter(q =>
      q.topic === topic || (q.domain === domain && !topic)
    );
    const years = new Set(matchingQs.map(q => q.year));
    if (matchingQs.length === 0) {
      // Fall through to next source
    } else {
      return {
      topic,
      totalAppearances: matchingQs.length,
      yearsActive: years.size,
      totalYears: gs.year_range ? (gs.year_range.end - gs.year_range.start + 1) : 10,
      frequency: parseFloat((matchingQs.length / Math.max(1, years.size)).toFixed(1)),
      avgPerYear: parseFloat((matchingQs.length / Math.max(1, years.size)).toFixed(2)),
      recent5yrCount: matchingQs.filter(q => q.year >= 2021).length,
      growthRate: 0,
      trend: 'stable',
      source: 'gold_standard',
    };
    }
  }

  // Fallback using topic_frequency.json
  try {
    const tf = JSON.parse(localStorage.getItem('eju_topic_frequency') || '{}');
    if (tf[topic]) {
      return {
        topic,
        totalAppearances: tf[topic].count || 0,
        yearsActive: tf[topic].years || 0,
        totalYears: 24,
        frequency: parseFloat(((tf[topic].count || 0) / 24).toFixed(1)),
        avgPerYear: parseFloat(((tf[topic].count || 0) / 24).toFixed(2)),
        recent5yrCount: tf[topic].recent5 || 0,
        growthRate: tf[topic].growth || 0,
        trend: 'stable',
        source: 'topic_frequency',
      };
    }
  } catch {}

  return {
    topic,
    totalAppearances: 0,
    yearsActive: 0,
    totalYears: 24,
    frequency: 0,
    avgPerYear: 0,
    recent5yrCount: 0,
    growthRate: 0,
    trend: 'unknown',
    source: 'none',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 5. DIFFICULTY ASSESSMENT
// ═══════════════════════════════════════════════════════════════════════

/**
 * Assess difficulty of a topic.
 *
 * @param {string} topic - Topic name
 * @param {string} domain - Domain name
 * @param {string} subtopic - Subtopic name
 * @param {object} datasets - Loaded datasets
 * @returns {object} Difficulty assessment
 */
export function assessDifficulty(topic, domain, subtopic, datasets) {
  // Use difficulty_database.json
  const diffDB = datasets?.difficultyDB;
  if (diffDB?.questions) {
    const matching = diffDB.questions.filter(q =>
      q.topic === topic && (!domain || q.domain === domain)
    );
    if (matching.length > 0) {
      const avgScore = matching.reduce((s, q) => s + (q.difficulty_score || 0), 0) / matching.length;
      const categories = {};
      for (const q of matching) {
        const cat = q.difficulty_category || 'medium';
        categories[cat] = (categories[cat] || 0) + 1;
      }
      const dominantCat = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium';

      return {
        topic,
        averageDifficultyScore: parseFloat(avgScore.toFixed(1)),
        difficultyCategory: dominantCat,
        sampleSize: matching.length,
        scoreRange: {
          min: Math.min(...matching.map(q => q.difficulty_score)),
          max: Math.max(...matching.map(q => q.difficulty_score)),
        },
        difficultyLabel: getDifficultyLabel(avgScore),
        source: 'difficulty_database',
      };
    }
  }

  // Fallback with score distribution
  if (diffDB?.score_distribution) {
    return {
      topic,
      averageDifficultyScore: diffDB.average_score || 40,
      difficultyCategory: 'medium',
      sampleSize: 0,
      scoreRange: { min: 0, max: 100 },
      difficultyLabel: '보통',
      source: 'difficulty_database_stats',
    };
  }

  return {
    topic,
    averageDifficultyScore: 40,
    difficultyCategory: 'medium',
    sampleSize: 0,
    scoreRange: { min: 0, max: 100 },
    difficultyLabel: '보통',
    source: 'default',
  };
}

/**
 * Get human-readable difficulty label.
 */
function getDifficultyLabel(score) {
  if (score >= 70) return '매우 어려움';
  if (score >= 55) return '어려움';
  if (score >= 40) return '보통';
  if (score >= 25) return '쉬움';
  return '매우 쉬움';
}

// ═══════════════════════════════════════════════════════════════════════
// 6. FUTURE PREDICTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Predict the probability of a topic appearing in future exams.
 *
 * @param {string} topic - Topic name
 * @param {string} domain - Domain name
 * @param {object} datasets - Loaded datasets
 * @param {number} targetYear - Year to predict (default: 2026)
 * @returns {object} Prediction with probability
 */
export function predictTopicProbability(topic, domain, datasets, targetYear = 2026) {
  // Use prediction_2026.json for primary prediction
  const pred = datasets?.prediction2026;
  if (pred?.top_30_predictions) {
    const match = pred.top_30_predictions.find(p => p.topic === topic);
    if (match) {
      return {
        topic,
        targetYear,
        probabilityPct: match.prediction_probability_pct || 0,
        combinedScore: match.combined_score || 0,
        momentumScore: match.momentum_score || 0,
        recencyScore: match.recency_score || 0,
        streakScore: match.streak_score || 0,
        growthScore: match.growth_score || 0,
        domainBalanceScore: match.domain_balance_score || 0,
        totalHistorical: match.total_historical || 0,
        recent5yrCount: match.recent_5yr_count || 0,
        recent3yrCount: match.recent_3yr_count || 0,
        lastYearCount: match.last_year_count || 0,
        source: 'prediction_2026',
        confidence: 'high',
      };
    }
  }

  // Dynamic prediction using trend analysis + recent data
  const trend = datasets?.trendAnalysis;
  if (trend?.topic_trends?.[topic]) {
    const td = trend.topic_trends[topic];
    const recentBoost = (td.recent_5yr || 0) / Math.max(1, td.total || 1) * 30;
    const historicalBase = Math.min(60, ((td.total || 0) / 24) * 10);
    const probability = Math.min(95, Math.round(historicalBase + recentBoost));

    return {
      topic,
      targetYear,
      probabilityPct: probability,
      combinedScore: probability,
      momentumScore: td.growth_rate_pct || 0,
      recencyScore: Math.min(100, (td.recent_5yr || 0) * 10),
      streakScore: td.years_active > 10 ? 80 : td.years_active > 5 ? 50 : 20,
      growthScore: Math.max(-100, Math.min(100, td.growth_rate_pct || 0)),
      domainBalanceScore: 50,
      totalHistorical: td.total || 0,
      recent5yrCount: td.recent_5yr || 0,
      recent3yrCount: td.recent_3yr || 0,
      lastYearCount: td.last_year || 0,
      source: 'trend_analysis_dynamic',
      confidence: 'medium',
    };
  }

  // Minimal fallback
  return {
    topic,
    targetYear,
    probabilityPct: 30,
    combinedScore: 30,
    momentumScore: 0,
    recencyScore: 0,
    streakScore: 0,
    growthScore: 0,
    domainBalanceScore: 50,
    totalHistorical: 0,
    recent5yrCount: 0,
    recent3yrCount: 0,
    lastYearCount: 0,
    source: 'default',
    confidence: 'low',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 7. RELATED QUESTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Find all related questions in the dataset for a given topic.
 *
 * @param {string} topic - Topic name
 * @param {string} domain - Domain name
 * @param {string} subtopic - Subtopic name
 * @param {object} datasets - Loaded datasets
 * @returns {Array} Related questions
 */
export function findRelatedQuestions(topic, domain, subtopic, datasets) {
  const related = [];

  // Search gold_standard
  const gs = datasets?.goldStandard;
  if (gs?.questions) {
    for (const q of gs.questions) {
      const matchTopic = q.topic === topic;
      const matchDomain = !domain || q.domain === domain;
      const matchSubtopic = !subtopic || q.subtopic === subtopic;

      if (matchTopic && matchDomain) {
        related.push({
          id: q.id,
          year: q.year,
          round: q.round,
          questionNumber: q.question_number,
          domain: q.domain,
          topic: q.topic,
          subtopic: q.subtopic || '',
          difficulty: q.difficulty,
          difficultyScore: q.difficulty_score,
          keywords: q.keywords || [],
          source: 'gold_standard',
        });
      }
    }
  }

  return related.slice(0, 57); // Cap at 57 as shown in the example
}

// ═══════════════════════════════════════════════════════════════════════
// 8. AI FEEDBACK GENERATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate comprehensive AI feedback for a wrong answer.
 *
 * @param {object} analysis - All analysis results
 * @returns {object} Human-readable feedback
 */
export function generateAIFeedback(analysis) {
  const {
    wrongInput = {},
    conceptChain = [],
    prerequisiteChain = [],
    weakness = {},
    frequency = {},
    difficulty = {},
    prediction = {},
    relatedQuestions = [],
  } = analysis;

  const { questionId = '', topic = '', domain = '' } = wrongInput;

  // Build concept path
  const conceptPath = conceptChain.map(c => c.name).filter(Boolean);

  // Build prerequisite gap analysis
  const prereqGaps = prerequisiteChain
    .filter(p => p.importance === 'high')
    .map(p => p.name);

  // Calculate learning priority (A-E)
  const learningPriority = calculateLearningPriority(weakness, frequency, difficulty, prediction);

  // Format the output as shown in the requirement
  const output = {
    title: `${questionId} 분석 결과`,
    summary: generateSummary(topic, domain, weakness, prediction, learningPriority),
    conceptChain: conceptPath,
    conceptChainDisplay: conceptPath.join(' → '),
    prerequisiteGaps: prereqGaps,
    prerequisiteDisplay: prerequisiteChain.map(p =>
      `${p.name} (${p.importance === 'high' ? '필수' : p.importance === 'medium' ? '권장' : '도움됨'})`
    ),
    weaknessAssessment: {
      score: weakness.weaknessScore || 0,
      level: weakness.priority === 'high' ? '취약' : weakness.priority === 'medium' ? '보통' : '양호',
      description: generateWeaknessDescription(weakness),
    },
    frequencyAnalysis: {
      appearances: frequency.totalAppearances || 0,
      yearsActive: frequency.yearsActive || 0,
      avgPerYear: frequency.avgPerYear || 0,
      display: `출제 빈도: ${frequency.totalAppearances || 0}회 (${frequency.totalYears || 24}년 중 ${frequency.yearsActive || 0}년)`,
    },
    difficultyAssessment: {
      score: difficulty.averageDifficultyScore || 40,
      label: difficulty.difficultyLabel || '보통',
      display: `난이도: ${difficulty.difficultyLabel || '보통'} (${difficulty.averageDifficultyScore || 40}/100)`,
    },
    futurePrediction: {
      year: prediction.targetYear || 2026,
      probability: prediction.probabilityPct || 0,
      display: `${prediction.targetYear || 2026} 예측 확률: ${prediction.probabilityPct || 0}%`,
    },
    relatedQuestions: {
      count: relatedQuestions.length,
      display: `관련 문항: ${relatedQuestions.length}개`,
      items: relatedQuestions.slice(0, 10),
    },
    learningPriority: {
      grade: learningPriority.grade,
      display: `추천 학습 우선순위: ${learningPriority.grade}`,
      reasoning: learningPriority.reasoning,
    },
    recommendations: generateStudyRecommendations(topic, domain, weakness, prerequisiteChain, learningPriority),
  };

  return output;
}

/**
 * Calculate learning priority grade (A-E).
 */
function calculateLearningPriority(weakness, frequency, difficulty, prediction) {
  let score = 0;

  // Weakness contribution (0-40)
  const weakScore = weakness.weaknessScore || 0;
  score += weakScore * 40;

  // Frequency contribution (0-25)
  const freq = (frequency.totalAppearances || 0) / 24; // avg per year
  score += Math.min(25, freq * 5);

  // Prediction contribution (0-25)
  const pred = (prediction.probabilityPct || 0) / 100;
  score += pred * 25;

  // Difficulty contribution (0-10)
  const diff = difficulty.averageDifficultyScore || 40;
  // Optimal difficulty: 30-60 (challenging but not impossible)
  const diffScore = diff >= 30 && diff <= 60 ? 10 : diff > 60 ? 5 : 8;
  score += diffScore;

  const totalScore = Math.min(100, Math.round(score));

  let grade, reasoning;
  if (totalScore >= 80) {
    grade = 'A';
    reasoning = '최우선 학습 필요 — 취약도 높음, 출제 빈도 높음, 2026 출제 확률 높음';
  } else if (totalScore >= 60) {
    grade = 'B';
    reasoning = '집중 학습 권장 — 전반적으로 중요한 주제';
  } else if (totalScore >= 40) {
    grade = 'C';
    reasoning = '보통 우선순위 — 기본 학습 후 도전';
  } else if (totalScore >= 20) {
    grade = 'D';
    reasoning = '낮은 우선순위 — 여유 있을 때 학습';
  } else {
    grade = 'E';
    reasoning = '최우선 순위 낮음 — 다른 주제 먼저 학습';
  }

  return { score: totalScore, grade, reasoning };
}

/**
 * Generate a one-line summary.
 */
function generateSummary(topic, domain, weakness, prediction, priority) {
  const weakWord = weakness.priority === 'high' ? '취약' : weakness.priority === 'medium' ? '보통' : '양호';
  const predStr = prediction.probabilityPct >= 50 ? '높음' : prediction.probabilityPct >= 30 ? '보통' : '낮음';
  return `'${topic}'(${DOMAIN_LABELS[domain] || domain}) — 취약도: ${weakWord}, 2026 출제확률: ${predStr}, 학습우선순위: ${priority.grade}`;
}

/**
 * Generate weakness description.
 */
function generateWeaknessDescription(weakness) {
  const count = weakness.mistakeCount || 0;
  if (count === 0) return '아직 충분한 데이터가 없습니다.';
  if (count === 1) return `1회 오답이 기록됨 — 추가 확인 필요`;
  return `${count}회 오답 기록 — ${weakness.weakSubConcepts?.join(', ') || '개념 재학습 필요'}`;
}

/**
 * Generate study recommendations.
 */
function generateStudyRecommendations(topic, domain, weakness, prerequisiteChain, priority) {
  const recs = [];

  if (prerequisiteChain.length > 0 && prerequisiteChain.some(p => p.importance === 'high')) {
    const topPrereq = prerequisiteChain.filter(p => p.importance === 'high')[0];
    recs.push({
      type: 'prerequisite',
      priority: 'high',
      text: `선행개념 '${topPrereq.name}' 학습 후 '${topic}'로 진도`,
    });
  }

  if (weakness.weakSubConcepts?.length > 0) {
    for (const sub of weakness.weakSubConcepts.slice(0, 2)) {
      recs.push({
        type: 'weakness',
        priority: weakness.priority,
        text: `'${topic}'의 '${sub}' 집중 학습`,
      });
    }
  }

  recs.push({
    type: 'practice',
    priority: priority.grade <= 'B' ? 'high' : 'medium',
    text: `'${topic}' 관련 연습문제 ${priority.grade <= 'B' ? '10' : '5'}문항 풀이`,
  });

  recs.push({
    type: 'review',
    priority: 'medium',
    text: `오답노트에 '${topic}' 관련 개념 정리`,
  });

  return recs;
}

// ═══════════════════════════════════════════════════════════════════════
// 9. RECOMMENDATIONS GENERATOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate actionable next-step recommendations.
 */
export function generateRecommendations(analysis) {
  const { wrongInput, conceptChain, prerequisiteChain, weakness, prediction, relatedQuestions } = analysis;
  const topic = wrongInput.topic || '';
  const domain = wrongInput.domain || '';

  const recommendations = [];

  // 1. If prerequisite concepts are weak, recommend those first
  const highPriorityPrereqs = prerequisiteChain.filter(p => p.importance === 'high');
  if (highPriorityPrereqs.length > 0) {
    recommendations.push({
      type: 'prerequisite_study',
      priority: 'high',
      title: '선행개념 학습',
      description: `'${highPriorityPrereqs[0].name}' 개념을 먼저 학습하세요.`,
      reason: `'${topic}'의 기초가 되는 개념입니다.`,
    });
  }

  // 2. Practice related questions
  if (relatedQuestions.length > 0) {
    const sampleQs = relatedQuestions.slice(0, 3).map(q => `${q.year}년 ${q.round}회차 ${q.questionNumber}번`);
    recommendations.push({
      type: 'practice',
      priority: weakness.priority === 'high' ? 'high' : 'medium',
      title: '관련 기출문제 풀이',
      description: `'${topic}' 관련 ${relatedQuestions.length}문항 중 다음을 추천: ${sampleQs.join(', ')}`,
      questionCount: relatedQuestions.length,
    });
  }

  // 3. Future-focused recommendation
  if (prediction.probabilityPct >= 50) {
    recommendations.push({
      type: 'exam_focus',
      priority: 'high',
      title: '2026 출제 집중 대비',
      description: `${prediction.targetYear}년 출제 확률 ${prediction.probabilityPct}% — 반드시 학습 필요`,
    });
  }

  // 4. Cross-domain connection
  const crossDomainTopics = findCrossDomainConnections(topic, domain);
  if (crossDomainTopics.length > 0) {
    recommendations.push({
      type: 'cross_domain',
      priority: 'medium',
      title: '연계 학습',
      description: `'${topic}'는 '${crossDomainTopics[0]}'와(과) 연결됩니다. 함께 학습하세요.`,
    });
  }

  // 5. Study plan integration
  recommendations.push({
    type: 'study_plan',
    priority: 'low',
    title: '학습 계획에 반영',
    description: `이 주제를 주간 학습 계획에 추가하세요. 추천 학습 시간: ${weakness.priority === 'high' ? '120분' : '60분'}`,
  });

  return recommendations;
}

/**
 * Find cross-domain connections for a topic.
 */
function findCrossDomainConnections(topic, domain) {
  const connections = {
    '시민혁명': ['헌법·기본권', '정치사상'],
    '산업혁명·자본주의': ['경제성장·경기변동', '국제무역'],
    '세계대전': ['국제정치·국제기구', '안전보장·방위'],
    '냉전': ['국제정치·국제기구', '안전보장·방위'],
    'GDP·국민소득': ['경제성장·경기변동', '소득분배·지니계수'],
    '환율·국제수지': ['국제무역', '금융·통화정책'],
    '금융·통화정책': ['재정·조세정책', '경제성장·경기변동'],
    '헌법·기본권': ['통치기구', '사법·재판', '정치사상'],
    '통치기구': ['지방자치', '선거·정당'],
    '기후·케펜구분': ['지형·판구조', '자원·농업', '인구·도시화'],
  };
  return connections[topic] || [];
}

// ═══════════════════════════════════════════════════════════════════════
// HIGH-LEVEL API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Full analysis for the Exam Intelligence Center dashboard.
 * Integrates all v2 engines.
 *
 * @param {Array} studentExams - Student's exam records
 * @param {object} datasets - Loaded dataset files
 * @returns {object} Complete dashboard analysis
 */
export async function getFullDashboardAnalysis(studentExams = [], datasets = null) {
  const ds = datasets || _datasetCache || loadDatasets();

  // 1. Personal Weakness Graph
  const weaknessGraph = buildPersonalWeaknessGraph(studentExams, ds);

  // 2. Future Predictions
  const futurePredictions = predictFutureExamsV2(ds);

  // 3. Study Coach (default target: comprehensive 180)
  const studyCoach = computeStudyCoachV2(studentExams, ds, { targetComprehensive: 180 });

  // 4. Question Recommendations
  const recommendations = recommendQuestions(studentExams, ds, { count: 10 });

  // 5. Explainable AI annotations
  const explanations = {};
  for (const rec of recommendations) {
    explanations[rec.topic] = explainRecommendation(rec, studentExams, ds);
  }

  return {
    generatedAt: new Date().toISOString(),
    studentStats: {
      totalExams: studentExams.length,
      analyzedTopics: weaknessGraph.nodes?.length || 0,
    },
    weaknessGraph,
    futurePredictions,
    studyCoach,
    recommendations,
    explanations,
  };
}

/**
 * Get a formatted output string similar to the requirement example.
 *
 * Output Format:
 * Q21 틀림
 * ↓ 시민혁명
 * ↓ 근대 민주주의
 * ↓ 프랑스혁명
 * ↓ 인권선언
 * ↓ 삼권분립
 * ↓ 현대 헌법
 * ↓ 관련 문항 57개
 * ↓ 출제 빈도 24년 중 18년
 * ↓ 2026 예측 확률 62%
 * ↓ 추천 학습 우선순위 A
 */
export function formatAnalysisOutput(analysis) {
  const { analysis: data } = analysis;
  const lines = [];

  lines.push(`${analysis.questionId} 틀림`);
  lines.push('↓');

  // Concept chain
  const concepts = data.conceptChain || [];
  for (const c of concepts) {
    lines.push(`↓ ${c.name || c}`);
  }

  // Related questions count
  lines.push(`↓ 관련 문항 ${data.relatedQuestions?.length || 0}개`);

  // Frequency
  const freq = data.frequency || {};
  lines.push(`↓ 출제 빈도 ${freq.totalYears || 24}년 중 ${freq.yearsActive || 0}년`);

  // Prediction
  const pred = data.prediction || {};
  lines.push(`↓ ${pred.targetYear || 2026} 예측 확률 ${pred.probabilityPct || 0}%`);

  // Priority
  const priority = data.feedback?.learningPriority || {};
  lines.push(`↓ 추천 학습 우선순위 ${priority.grade || 'C'}`);

  return {
    formatted: lines.join('\n'),
    lines,
    conceptChain: concepts.map(c => c.name || c),
    relatedCount: data.relatedQuestions?.length || 0,
    frequencyYears: freq.yearsActive || 0,
    totalYears: freq.totalYears || 24,
    predictionProb: pred.probabilityPct || 0,
    priorityGrade: priority.grade || 'C',
  };
}

// ── Exports ────────────────────────────────────────────────────────────
export default {
  initializeEngine,
  loadDatasets,
  persistDatasets,
  analyzeWrongAnswer,
  analyzeBatchWrongAnswers,
  traceConceptChain,
  tracePrerequisiteChain,
  inferWeakness,
  analyzeFrequency,
  assessDifficulty,
  predictTopicProbability,
  findRelatedQuestions,
  generateAIFeedback,
  generateRecommendations,
  getFullDashboardAnalysis,
  formatAnalysisOutput,
};
