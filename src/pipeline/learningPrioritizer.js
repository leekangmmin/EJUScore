// ═══════════════════════════════════════════════════════════════════════
// Learning Prioritizer — Personalized Study Priority Engine
//
// Analyzes error patterns and generates ranked learning priorities:
//   1. Error frequency analysis by topic/domain
//   2. Exam appearance probability weighting
//   3. Prerequisite deficiency detection
//   4. Difficulty gradient consideration
//   5. Recency-weighted scoring
//   6. Combined ROI (Return on Investment) scoring
//
// Integrates with:
//   - Existing questionRecommender.js for question-level recommendations
//   - weaknessEngine for personal weakness graph
//   - trendAnalyzer for exam frequency data
// ═══════════════════════════════════════════════════════════════════════

/**
 * @typedef {object} PriorityItem
 * @property {string} topic - Topic name
 * @property {string} domain - Domain name
 * @property {number} priorityScore - Combined priority score (0-100)
 * @property {string} priorityLabel - 'critical' | 'high' | 'medium' | 'low'
 * @property {number} errorCount - Number of errors on this topic
 * @property {number} examProbability - Expected exam appearance probability (0-100)
 * @property {number} prerequisiteDeficit - Prerequisite deficiency score (0-100)
 * @property {number} recencyWeight - Recency weight (0-1)
 * @property {string} reason - Human-readable reason
 * @property {Array<string>} suggestedResources - Suggested learning resources
 */

/**
 * @typedef {object} ErrorPatternAnalysis
 * @property {Array<PriorityItem>} priorities - Ranked learning priorities
 * @property {object} summary - Summary statistics
 * @property {Array<string>} insights - Key insights
 */

/**
 * Analyze error patterns from student exam history and generate learning priorities.
 *
 * @param {Array<object>} studentExams - Student's exam records
 * @param {object} [datasets] - Optional datasets (trendAnalysis, prediction, knowledgeGraph)
 * @param {object} [options]
 * @param {number} [options.maxItems=15] - Maximum number of priority items
 * @param {number} [options.recencyMonths=6] - Recency window in months
 * @returns {ErrorPatternAnalysis}
 */
export function analyzeErrorPattern(studentExams = [], datasets = {}, options = {}) {
  const { maxItems = 15, recencyMonths = 6 } = options;
  const now = Date.now();
  const recencyWindow = recencyMonths * 30 * 24 * 60 * 60 * 1000;

  // Step 1: Extract error data from exam history
  const topicErrors = {}; // topic -> { count, recency, domains, lastDate }
  const domainErrors = {}; // domain -> { count, topics }
  const errorTimeline = [];
  let totalExams = 0;
  let totalErrors = 0;

  for (const exam of (studentExams || [])) {
    totalExams++;
    const mistakes = exam.comprehensive?.mistakes || exam.mistakes || [];

    for (const m of mistakes) {
      const topic = m.topic || '';
      const domain = m.domain || '';
      if (!topic && !domain) continue;

      totalErrors++;

      // Track topic
      if (topic) {
        if (!topicErrors[topic]) {
          topicErrors[topic] = { count: 0, recencySum: 0, domains: new Set(), lastDate: null };
        }
        topicErrors[topic].count++;
        topicErrors[topic].domains.add(domain || 'unknown');

        const examDate = exam.date ? new Date(exam.date).getTime() : now;
        const recency = Math.max(0, 1 - (now - examDate) / recencyWindow);
        topicErrors[topic].recencySum += recency;

        if (!topicErrors[topic].lastDate || examDate > topicErrors[topic].lastDate) {
          topicErrors[topic].lastDate = examDate;
        }

        errorTimeline.push({ topic, domain: domain || 'unknown', date: examDate, recency });
      }

      // Track domain
      if (domain) {
        if (!domainErrors[domain]) {
          domainErrors[domain] = { count: 0, topics: new Set() };
        }
        domainErrors[domain].count++;
        if (topic) domainErrors[domain].topics.add(topic);
      }
    }
  }

  // Step 2: Extract prediction and trend data
  const predData = extractPredictionData(datasets);
  const trendData = extractTrendData(datasets);
  const diffData = extractDifficultyData(datasets);
  const prereqMap = extractPrerequisiteMap(datasets);

  // Step 3: Score each topic
  const scoredTopics = [];
  const allTopics = getAllTopics(datasets, topicErrors);
  const avgErrorsPerTopic = totalErrors / Math.max(1, Object.keys(topicErrors).length);

  for (const { name: topic, domain } of allTopics) {
    const errorInfo = topicErrors[topic];
    const predInfo = predData[topic];
    const trendInfo = trendData[topic];
    const diffInfo = diffData[topic];

    // Factor 1: Error frequency (0-35 points)
    let errorScore = 0;
    if (errorInfo) {
      const freqRatio = errorInfo.count / Math.max(1, avgErrorsPerTopic);
      errorScore = Math.min(25, freqRatio * 10);
      const recencyAvg = errorInfo.recencySum / errorInfo.count;
      errorScore += recencyAvg * 10; // up to 10 points for recency
      errorScore = Math.min(35, errorScore);
    }

    // Factor 2: Exam appearance probability (0-25 points)
    let probabilityScore = 0;
    if (predInfo) {
      probabilityScore = (predInfo.probability / 100) * 25;
    } else if (trendInfo) {
      // Estimate from historical frequency
      const freq = trendInfo.recent5 || trendInfo.total || 0;
      probabilityScore = Math.min(25, freq * 3);
    } else {
      // Default medium probability
      probabilityScore = 10;
    }

    // Factor 3: Prerequisite deficiency (0-20 points)
    let prereqScore = 0;
    const prereqs = prereqMap[topic] || [];
    for (const prereq of prereqs) {
      const prereqError = topicErrors[prereq];
      if (prereqError && prereqError.count >= 2) {
        prereqScore += 5;
      }
    }
    prereqScore = Math.min(20, prereqScore);

    // Factor 4: Difficulty gradient (0-10 points)
    let difficultyScore = 0;
    if (diffInfo) {
      // Medium difficulty topics get higher priority (they're "ripe" for learning)
      const diff = diffInfo.avgDifficulty || 5;
      if (diff >= 4 && diff <= 7) {
        difficultyScore = 8;
      } else if (diff < 4) {
        difficultyScore = 5; // Easy topics, quick wins
      } else {
        difficultyScore = 3; // Hard topics, longer ramp
      }
    } else {
      difficultyScore = 5;
    }

    // Factor 5: Domain balance bonus (0-10 points)
    let domainBalanceScore = 0;
    if (domain && domainErrors[domain]) {
      const domainErrorRatio = domainErrors[domain].count / Math.max(1, totalErrors);
      domainBalanceScore = Math.min(10, domainErrorRatio * 15);
    }

    // Combined score
    const combinedScore = Math.min(100, errorScore + probabilityScore + prereqScore + difficultyScore + domainBalanceScore);

    // Priority label
    let priorityLabel, reason;
    if (combinedScore >= 60 && errorInfo && errorInfo.count >= 2) {
      priorityLabel = 'critical';
      reason = generatePriorityReason('critical', topic, errorInfo, predInfo, prereqs);
    } else if (combinedScore >= 40) {
      priorityLabel = 'high';
      reason = generatePriorityReason('high', topic, errorInfo, predInfo, prereqs);
    } else if (combinedScore >= 25) {
      priorityLabel = 'medium';
      reason = generatePriorityReason('medium', topic, errorInfo, predInfo, prereqs);
    } else {
      priorityLabel = 'low';
      reason = '복습 시 추가 학습 권장';
    }

    scoredTopics.push({
      topic,
      domain: domain || 'unknown',
      priorityScore: parseFloat(combinedScore.toFixed(1)),
      priorityLabel,
      errorCount: errorInfo?.count || 0,
      examProbability: predInfo?.probability || (trendInfo ? Math.min(100, (trendInfo.recent5 || 0) * 10) : 30),
      prerequisiteDeficit: parseFloat(prereqScore.toFixed(0)),
      recencyWeight: errorInfo ? parseFloat((errorInfo.recencySum / Math.max(1, errorInfo.count)).toFixed(2)) : 0,
      reason,
      suggestedResources: suggestResources(topic, domain, datasets),
    });
  }

  // Sort by priority score descending
  scoredTopics.sort((a, b) => b.priorityScore - a.priorityScore);

  // Generate summary and insights
  const summary = {
    totalExams,
    totalErrors,
    uniqueTopicsWithErrors: Object.keys(topicErrors).length,
    criticalCount: scoredTopics.filter(t => t.priorityLabel === 'critical').length,
    highCount: scoredTopics.filter(t => t.priorityLabel === 'high').length,
    mediumCount: scoredTopics.filter(t => t.priorityLabel === 'medium').length,
    topDomain: Object.entries(domainErrors).sort((a, b) => b[1].count - a[1].count)[0]?.[0] || null,
    averagePriority: scoredTopics.length > 0
      ? parseFloat((scoredTopics.reduce((s, t) => s + t.priorityScore, 0) / scoredTopics.length).toFixed(1))
      : 0,
  };

  const insights = generateInsights(scoredTopics, summary, studentExams);

  return {
    priorities: scoredTopics.slice(0, maxItems),
    summary,
    insights,
  };
}

/**
 * Generate learning priority recommendations based on error analysis.
 * Delegates to analyzeErrorPattern and formats the output.
 *
 * @param {Array<object>} studentExams
 * @param {object} [datasets]
 * @param {object} [options]
 * @returns {Array<PriorityItem>}
 */
export function recommendLearningPriority(studentExams = [], datasets = {}, options = {}) {
  const analysis = analyzeErrorPattern(studentExams, datasets, options);
  return analysis.priorities;
}

/**
 * Generate human-readable reason for priority assignment.
 */
function generatePriorityReason(level, topic, errorInfo, predInfo, prereqs) {
  const parts = [];

  if (errorInfo) {
    parts.push(`오답 ${errorInfo.count}회`);
    if (errorInfo.count >= 3) parts.push('반복 출현');
  }

  if (predInfo && predInfo.probability >= 50) {
    parts.push(`출제 확률 ${predInfo.probability}%`);
  }

  if (prereqs.length > 0) {
    parts.push('선행 개념 필요');
  }

  if (level === 'critical') {
    return `[최우선] ${topic}: ` + (parts.length > 0 ? parts.join(' · ') : '집중 학습 필요');
  }

  return parts.length > 0 ? parts.join(' · ') : '학습 권장';
}

/**
 * Generate key insights from error analysis.
 */
function generateInsights(scoredTopics, summary, studentExams) {
  const insights = [];

  if (summary.criticalCount > 0) {
    const criticalTopics = scoredTopics.filter(t => t.priorityLabel === 'critical');
    insights.push(`🔴 ${summary.criticalCount}개 주제에서 반복 오답 발생: ${criticalTopics.map(t => t.topic).join(', ')}`);
  }

  if (summary.highCount > 0) {
    insights.push(`🟠 ${summary.highCount}개 주제 집중 학습 추천`);
  }

  if (summary.topDomain) {
    const domainLabel = {
      economy: '경제', politics: '정치', history: '역사',
      geography: '지리', society: '사회',
    }[summary.topDomain] || summary.topDomain;
    insights.push(`📊 가장 취약한 영역: ${domainLabel}`);
  }

  if (studentExams && studentExams.length >= 2) {
    const recent = studentExams.slice(-2);
    const recentScores = recent.map(e => e.comprehensive?.score || 0).filter(s => s > 0);
    if (recentScores.length === 2 && recentScores[1] > recentScores[0]) {
      insights.push(`📈 최근 성적 향상 중: ${recentScores[0]}점 → ${recentScores[1]}점`);
    }
  }

  if (scoredTopics.filter(t => t.prerequisiteDeficit > 10).length > 0) {
    insights.push('📚 선행 개념 복습이 필요한 주제가 있습니다.');
  }

  return insights;
}

/**
 * Suggest learning resources for a topic.
 */
function suggestResources(topic, domain, datasets) {
  const resources = [];

  const gs = datasets?.goldStandard;
  if (gs?.questions) {
    const matching = gs.questions.filter(q => q.topic === topic || q.domain === domain);
    if (matching.length > 0) {
      resources.push(`기출 ${matching.length}문항`);
    }
  }

  if (domain) {
    resources.push(`${domain} 영역 교재 복습`);
  }

  return resources;
}

// ── Data extraction helpers ──────────────────────────────────────────

function extractPredictionData(datasets) {
  const data = {};
  const pred = datasets?.prediction2026 || datasets?.prediction2026_2028;
  if (pred?.top_30_predictions) {
    for (const p of pred.top_30_predictions) {
      data[p.topic] = {
        probability: p.prediction_probability_pct || 0,
        combined_score: p.combined_score || 0,
      };
    }
  }
  return data;
}

function extractTrendData(datasets) {
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

function extractDifficultyData(datasets) {
  const data = {};
  const diff = datasets?.difficultyDB;
  if (diff?.questions) {
    for (const q of diff.questions) {
      const key = q.topic || q.domain;
      if (!key) continue;
      if (!data[key]) data[key] = { sum: 0, count: 0 };
      data[key].sum += q.difficulty_score || 5;
      data[key].count++;
    }
    for (const [key, d] of Object.entries(data)) {
      data[key] = { avgDifficulty: d.count > 0 ? d.sum / d.count : 5 };
    }
  }
  return data;
}

function extractPrerequisiteMap(datasets) {
  const map = {};
  const kg = datasets?.knowledgeGraph;
  if (kg?.edges) {
    for (const edge of kg.edges) {
      if (edge.type === 'prerequisite') {
        const targetParts = (edge.targetId || '').split(':');
        const targetTopic = targetParts[targetParts.length - 1];
        const sourceParts = (edge.sourceId || '').split(':');
        const sourceTopic = sourceParts[sourceParts.length - 1];
        if (!map[targetTopic]) map[targetTopic] = [];
        if (sourceTopic && !map[targetTopic].includes(sourceTopic)) {
          map[targetTopic].push(sourceTopic);
        }
      }
    }
  }

  // Fallback using weakness_profile
  if (Object.keys(map).length === 0 && datasets?.weakProfile?.domain_structure) {
    for (const [domain, domData] of Object.entries(datasets.weakProfile.domain_structure)) {
      const order = domData.prerequisite_order || [];
      for (let i = 1; i < order.length; i++) {
        if (!map[order[i]]) map[order[i]] = [];
        map[order[i]].push(order[i - 1]);
      }
    }
  }

  return map;
}

function getAllTopics(datasets, topicErrors) {
  const topics = [];

  // From knowledge graph taxonomy
  const kg = datasets?.knowledgeGraph;
  if (kg?.taxonomy) {
    for (const [domain, data] of Object.entries(kg.taxonomy)) {
      const domainTopics = data.topics || {};
      for (const topicName of Object.keys(domainTopics)) {
        topics.push({ name: topicName, domain });
      }
    }
  }

  // Add topics from error data not in taxonomy
  for (const [topic, info] of Object.entries(topicErrors)) {
    if (!topics.find(t => t.name === topic)) {
      const domain = [...info.domains][0] || 'unknown';
      topics.push({ name: topic, domain });
    }
  }

  if (topics.length === 0) {
    // Hardcoded fallback
    const fallback = {
      economy: ['수요·공급', 'GDP·국민소득', '환율·국제수지', '금융·통화정책', '재정·조세정책', '국제무역'],
      politics: ['헌법·기본권', '통치기구', '선거·정당', '국제정치', '지방자치'],
      history: ['시민혁명', '산업혁명', '제국주의', '세계대전', '냉전', '일본근대사'],
      geography: ['기후', '지형', '인구', '자원', '지도·GIS'],
      society: ['환경문제', '사회보장', '저출산고령화', '정보화사회'],
    };
    for (const [domain, topicList] of Object.entries(fallback)) {
      for (const topic of topicList) {
        topics.push({ name: topic, domain });
      }
    }
  }

  return topics;
}

export default {
  analyzeErrorPattern,
  recommendLearningPriority,
};
