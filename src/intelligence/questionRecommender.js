// ═══════════════════════════════════════════════════════════════════════
// Question Recommendation Engine v2
// Recommends next questions to solve based on:
//   Priority 1: Frequently wrong topics
//   Priority 2: High exam probability topics
//   Priority 3: Prerequisite-deficient topics
//
// Leverages: All dataset files
// ═══════════════════════════════════════════════════════════════════════

// ── Constants ─────────────────────────────────────────────────────────

const DOMAIN_LABELS = {
  economy: '경제', politics: '정치', history: '역사',
  geography: '지리', society: '사회',
};

// ── Main Recommender ──────────────────────────────────────────────────

/**
 * Recommend questions based on student's error patterns.
 *
 * @param {Array} studentExams - Student's exam history
 * @param {object} datasets - Dataset files
 * @param {object} options - { count, excludeTopics }
 * @returns {Array} Recommended questions with explanations
 */
export function recommendQuestions(studentExams = [], datasets = {}, options = {}) {
  const count = options.count || 10;
  const excludeTopics = options.excludeTopics || [];

  // Step 1: Extract error patterns
  const errorPatterns = extractErrorPatterns(studentExams);

  // Step 2: Score each topic for recommendation
  const topicScores = scoreTopicsForRecommendation(errorPatterns, datasets);

  // Step 3: Filter and remove excluded topics
  const filtered = topicScores.filter(t => !excludeTopics.includes(t.topic));

  // Step 4: Sort by combined score
  filtered.sort((a, b) => b.combinedScore - a.combinedScore);

  // Step 5: Find specific questions for top topics
  const recommendations = [];
  for (const topic of filtered.slice(0, count)) {
    const questions = findQuestionsForTopic(topic.topic, topic.domain, datasets);
    recommendations.push({
      topic: topic.topic,
      domain: topic.domain,
      domainLabel: DOMAIN_LABELS[topic.domain] || topic.domain,
      reason: topic.reason,
      priority: topic.priority,
      combinedScore: topic.combinedScore,
      estimatedDifficulty: topic.difficultyLabel,
      questions: questions.slice(0, 5), // Top 5 questions
      totalAvailable: questions.length,
    });
  }

  return recommendations;
}

// ═══════════════════════════════════════════════════════════════════════
// ERROR PATTERN EXTRACTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Extract error patterns from exam history.
 *
 * @param {Array} studentExams
 * @returns {object} { topicErrors, domainErrors, recentErrors, errorTopics }
 */
function extractErrorPatterns(studentExams) {
  const topicErrors = {};  // topic -> { count, recentCount, domains }
  const domainErrors = {};
  const recentErrors = [];
  const errorTopics = new Set();

  for (const exam of (studentExams || [])) {
    const mistakes = exam.comprehensive?.mistakes || [];

    for (const m of mistakes) {
      const topic = m.topic || '';
      const domain = m.domain || '';

      if (!topic && !domain) continue;

      // Track topic errors
      if (topic) {
        if (!topicErrors[topic]) {
          topicErrors[topic] = { count: 0, recentCount: 0, domains: new Set(), lastSeen: null };
        }
        topicErrors[topic].count++;
        topicErrors[topic].domains.add(domain);

        if (exam.date) {
          try {
            const d = new Date(exam.date);
            const monthsAgo = (Date.now() - d.getTime()) / (30 * 24 * 60 * 60 * 1000);
            if (monthsAgo <= 6) {
              topicErrors[topic].recentCount++;
              recentErrors.push({ topic, domain, date: exam.date });
            }
            if (!topicErrors[topic].lastSeen || d > new Date(topicErrors[topic].lastSeen)) {
              topicErrors[topic].lastSeen = exam.date;
            }
          } catch {}
        }

        errorTopics.add(topic);
      }

      // Track domain errors
      if (domain) {
        if (!domainErrors[domain]) {
          domainErrors[domain] = { count: 0, topics: new Set() };
        }
        domainErrors[domain].count++;
        if (topic) domainErrors[domain].topics.add(topic);
      }
    }
  }

  return { topicErrors, domainErrors, recentErrors, errorTopics };
}

// ═══════════════════════════════════════════════════════════════════════
// TOPIC SCORING
// ═══════════════════════════════════════════════════════════════════════

/**
 * Score each topic based on recommendation priority factors.
 */
function scoreTopicsForRecommendation(errorPatterns, datasets) {
  const { topicErrors, domainErrors } = errorPatterns;
  const scores = [];

  // Get all topics
  const allTopics = getAllTopics(datasets);

  // Extract trend and prediction data
  const trendData = extractTrendDataSimple(datasets);
  const predData = extractPredictionDataSimple(datasets);
  const diffData = extractDifficultyDataSimple(datasets);

  // Get prerequisite map
  const prerequisiteMap = getPrerequisiteMapSimple(datasets);

  for (const { name: topic, domain } of allTopics) {
    const errorInfo = topicErrors[topic];

    // Factor 1: Error frequency (0-35 points)
    let errorScore = 0;
    if (errorInfo) {
      const baseCount = Math.min(errorInfo.count, 10);
      errorScore = (baseCount / 5) * 25; // max 25, each mistake weighted more
      const recencyBonus = Math.min(errorInfo.recentCount, 5) * 2; // max 10
      errorScore = Math.min(35, errorScore + recencyBonus);
    }

    // Factor 2: Exam probability (0-30 points)
    const pred = predData[topic];
    const probabilityScore = pred
      ? (pred.probability_pct / 100) * 30
      : 10;

    // Factor 3: Prerequisite deficiency (0-20 points)
    const prereqs = prerequisiteMap[topic] || [];
    let prereqScore = 0;
    for (const prereq of prereqs) {
      const prereqError = topicErrors[prereq];
      if (prereqError && prereqError.count >= 2) {
        prereqScore += 10; // +10 per weak prerequisite
      }
    }
    prereqScore = Math.min(20, prereqScore);

    // Factor 4: Domain balance (0-15 points)
    const domainErrorCount = domainErrors[domain]?.count || 0;
    const domainScore = Math.min(15, domainErrorCount * 3);

    // Combined score (0-100)
    const combinedScore = Math.min(100, errorScore + probabilityScore + prereqScore + domainScore);

    // Determine priority based on combined score
    let priority, reason;
    if (combinedScore >= 40) {
      priority = 'high';
      reason = generateReason(topic, errorInfo, pred, prereqScore);
    } else if (combinedScore >= 25) {
      priority = 'medium';
      reason = generateReason(topic, errorInfo, pred, prereqScore);
    } else {
      priority = 'low';
      reason = '추가 학습 시 도움되는 주제';
    }

    // Difficulty label
    const diff = diffData[topic];
    const difficultyLabel = diff
      ? (diff.score >= 60 ? '어려움' : diff.score >= 35 ? '보통' : '쉬움')
      : '보통';

    scores.push({
      topic,
      domain,
      domainLabel: DOMAIN_LABELS[domain] || domain,
      errorScore: parseFloat(errorScore.toFixed(1)),
      probabilityScore: parseFloat(probabilityScore.toFixed(1)),
      prereqDeficitScore: parseFloat(prereqScore.toFixed(1)),
      domainScore: parseFloat(domainScore.toFixed(1)),
      combinedScore: parseFloat(combinedScore.toFixed(1)),
      priority,
      difficultyLabel,
      reason,
    });
  }

  return scores;
}

/**
 * Generate human-readable reason for recommendation.
 */
function generateReason(topic, errorInfo, pred, prereqScore) {
  const parts = [];

  if (errorInfo) {
    parts.push(`최근 ${errorInfo.recentCount}회 오답 (총 ${errorInfo.count}회)`);
  }

  if (pred && pred.probability_pct >= 50) {
    parts.push(`2026 출제확률 ${pred.probability_pct}%`);
  }

  if (prereqScore >= 10) {
    parts.push('선행개념 부족');
  }

  return parts.length > 0 ? parts.join(' · ') : '학습 권장 주제';
}

// ═══════════════════════════════════════════════════════════════════════
// QUESTION FINDER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Find specific questions for a topic from the gold standard dataset.
 */
function findQuestionsForTopic(topic, domain, datasets) {
  const questions = [];

  // Search gold_standard
  const gs = datasets?.goldStandard;
  if (gs?.questions) {
    for (const q of gs.questions) {
      if (q.topic === topic && (!domain || q.domain === domain)) {
        questions.push({
          id: q.id,
          source: 'gold_standard',
          year: q.year,
          round: q.round,
          questionNumber: q.question_number,
          difficulty: q.difficulty,
          difficultyScore: q.difficulty_score,
          keywords: q.keywords || [],
          material: q.material || '',
        });
      }
    }
  }

  // Sort by year (newest first)
  questions.sort((a, b) => (b.year || 0) - (a.year || 0));

  return questions;
}

// ═══════════════════════════════════════════════════════════════════════
// DATA HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get all topics from datasets.
 */
function getAllTopics(datasets) {
  const topics = [];

  const kg = datasets?.knowledgeGraph;
  if (kg?.taxonomy) {
    for (const [domain, data] of Object.entries(kg.taxonomy)) {
      const domainTopics = data.topics || {};
      for (const topicName of Object.keys(domainTopics)) {
        topics.push({ name: topicName, domain });
      }
    }
    return topics;
  }

  // Hardcoded fallback
  const topicMap = {
    economy: ['수요·공급과 시장균형', 'GDP·국민소득', '환율·국제수지', '금융·통화정책',
      '재정·조세정책', '국제무역', '고용·노동', '경제성장·경기변동', '소득분배·지니계수', '일본경제사'],
    politics: ['헌법·기본권', '통치기구', '선거·정당', '국제정치·국제기구',
      '지방자치', '사법·재판', '정치사상', '안전보장·방위'],
    history: ['시민혁명', '산업혁명·자본주의', '제국주의·식민지', '세계대전',
      '냉전', '일본근대사', '전후세계질서', '세계화·지역통합'],
    geography: ['기후·케펜구분', '지형·판구조', '인구·도시화', '자원·농업',
      '지도·GIS', '환경·생태', '산업·교통'],
    society: ['환경문제', '사회보장·복지', '저출산·고령화', '정보화사회', '젠더·평등'],
  };

  for (const [domain, topicList] of Object.entries(topicMap)) {
    for (const topic of topicList) {
      topics.push({ name: topic, domain });
    }
  }

  return topics;
}

/**
 * Extract simple trend data.
 */
function extractTrendDataSimple(datasets) {
  const data = {};
  const trend = datasets?.trendAnalysis;
  if (trend?.topic_trends) {
    for (const [topic, t] of Object.entries(trend.topic_trends)) {
      data[topic] = {
        total: t.total || 0,
        recent5: t.recent_5yr || 0,
        growth: t.growth_rate_pct || 0,
      };
    }
  }
  return data;
}

/**
 * Extract simple prediction data.
 */
function extractPredictionDataSimple(datasets) {
  const data = {};
  const pred = datasets?.prediction2026;
  if (pred?.top_30_predictions) {
    for (const p of pred.top_30_predictions) {
      data[p.topic] = {
        probability_pct: p.prediction_probability_pct || 0,
        combined_score: p.combined_score || 0,
      };
    }
  }
  return data;
}

/**
 * Extract simple difficulty data.
 */
function extractDifficultyDataSimple(datasets) {
  const data = {};
  const diff = datasets?.difficultyDB;
  if (diff?.questions) {
    const totals = {};
    for (const q of diff.questions) {
      const key = q.topic || q.domain;
      if (!key) continue;
      if (!totals[key]) totals[key] = { sum: 0, count: 0 };
      totals[key].sum += q.difficulty_score || 0;
      totals[key].count++;
    }
    for (const [key, t] of Object.entries(totals)) {
      data[key] = { score: t.count > 0 ? t.sum / t.count : 40 };
    }
  }
  return data;
}

/**
 * Get simple prerequisite map.
 */
function getPrerequisiteMapSimple(datasets) {
  const map = {};

  const kg = datasets?.knowledgeGraph;
  if (kg?.edges) {
    for (const edge of kg.edges) {
      if (edge.type === 'prerequisite') {
        const targetParts = (edge.targetId || '').split(':');
        const targetTopic = targetParts[targetParts.length - 1];
        const sourceParts = (edge.sourceId || '').split(':');
        const sourceTopic = sourceParts[sourceParts.length - 1];

        if (targetTopic && sourceTopic) {
          if (!map[targetTopic]) map[targetTopic] = [];
          if (!map[targetTopic].includes(sourceTopic)) {
            map[targetTopic].push(sourceTopic);
          }
        }
      }
    }
  }

  return map;
}

// ═══════════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════════

/**
 * Format recommendations for display.
 */
export function formatRecommendations(recommendations) {
  if (!recommendations || recommendations.length === 0) return [];

  return recommendations.map(r => ({
    topic: r.topic,
    domain: r.domainLabel,
    reason: r.reason,
    priority: r.priority,
    difficulty: r.estimatedDifficulty,
    score: r.combinedScore,
    questionsAvailable: r.totalAvailable,
    color: r.priority === 'high' ? '#ef4444'
      : r.priority === 'medium' ? '#f59e0b'
      : '#94a3b8',
    icon: r.priority === 'high' ? '🔴'
      : r.priority === 'medium' ? '🟡'
      : '⚪',
  }));
}

// ── Exports ────────────────────────────────────────────────────────────
export default {
  recommendQuestions,
  formatRecommendations,
};
