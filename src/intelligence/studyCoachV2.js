// ═══════════════════════════════════════════════════════════════════════
// AI Study Coach v2
// Goal-driven personalized study planner.
// Input: target score, current score
// Output: highest-ROI topics, study sequence, weekly plan, score projection
//
// Leverages: dataset/weakness_profile.json, dataset/study_plan.json,
//            dataset/knowledge-graph/knowledge_graph_v3.json,
//            dataset/trend-analysis/trend_analysis_v2.json,
//            dataset/prediction/prediction_2026.json
// ═══════════════════════════════════════════════════════════════════════

// ── Constants ─────────────────────────────────────────────────────────

const DOMAIN_LABELS = {
  economy: '경제', politics: '정치', history: '역사',
  geography: '지리', society: '사회',
};

const EJU_COMPREHENSIVE_MAX = 198;
const TOPICS_PER_DOMAIN = {
  economy: 10, politics: 8, history: 8, geography: 7, society: 5,
};

// Estimated score gain per topic improvement (points)
const SCORE_PER_TOPIC_GAIN = {
  high: 8,   // High priority topic
  medium: 5, // Medium priority topic
  low: 2,    // Low priority topic
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN COACH ENGINE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute personalized study plan based on target vs current score.
 *
 * @param {Array} studentExams - Student's exam records
 * @param {object} datasets - Dataset cache
 * @param {object} targets - { targetComprehensive, targetDate }
 * @returns {object} Study plan with ROI analysis, sequence, weekly plan
 */
export function computeStudyCoachV2(studentExams = [], datasets = {}, targets = {}) {
  const targetComp = targets.targetComprehensive || 180;
  const targetDate = targets.targetDate || '2026-11-01'; // Next EJU exam date

  // Calculate current level
  const currentLevel = computeCurrentLevel(studentExams);

  // Calculate gap
  const gap = Math.max(0, targetComp - currentLevel.currentScore);

  // Analyze per-topic performance
  const topicPerformance = analyzeTopicPerformance(studentExams, datasets);

  // Compute ROI for each topic
  const topicROI = computeTopicROI(topicPerformance, datasets, studentExams);

  // Generate study sequence
  const studySequence = generateStudySequence(topicROI, datasets);

  // Generate weekly plan
  const weeklyPlan = generateWeeklyPlan(studySequence, targetDate, datasets);

  // Project score improvement
  const scoreProjection = projectScoreImprovement(topicROI, currentLevel, targetComp, datasets);

  return {
    generatedAt: new Date().toISOString(),
    studentProfile: {
      totalExams: studentExams.length,
      currentScore: currentLevel.currentScore,
      targetScore: targetComp,
      gap,
      currentMastery: currentLevel.averageMastery,
    },
    gapAnalysis: {
      requiredImprovement: gap,
      domainsNeedingWork: topicPerformance
        .filter(t => t.priority === 'high')
        .map(t => t.domain),
      estimatedWeeksToTarget: scoreProjection.estimatedWeeks,
    },
    topicROI: topicROI.slice(0, 20),
    studySequence: studySequence.slice(0, 15),
    weeklyPlan: weeklyPlan.slice(0, 8), // 8 weeks
    scoreProjection,
    recommendations: generateCoachRecommendations(topicROI, gap, scoreProjection, datasets),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CURRENT LEVEL ASSESSMENT
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute the student's current performance level.
 */
function computeCurrentLevel(studentExams) {
  if (!studentExams || studentExams.length === 0) {
    return {
      currentScore: 0,
      averageMastery: 0,
      examCount: 0,
      recentTrend: 'no_data',
      scoreHistory: [],
    };
  }

  // Get comprehensive scores
  const compScores = studentExams
    .filter(e => e.comprehensive?.score != null)
    .map(e => ({
      date: e.date,
      score: normalizeCompScore(e.comprehensive.score),
    }))
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  const currentScore = compScores.length > 0
    ? compScores[compScores.length - 1].score
    : 0;

  const averageMastery = compScores.length > 0
    ? compScores.reduce((s, c) => s + (c.score / EJU_COMPREHENSIVE_MAX), 0) / compScores.length
    : 0;

  // Trend analysis
  let recentTrend = 'stable';
  if (compScores.length >= 3) {
    const recent = compScores.slice(-3);
    const first = recent[0].score;
    const last = recent[recent.length - 1].score;
    const diff = last - first;
    recentTrend = diff > 5 ? 'improving' : diff < -5 ? 'declining' : 'stable';
  }

  return {
    currentScore,
    averageMastery: parseFloat(averageMastery.toFixed(3)),
    examCount: studentExams.length,
    recentTrend,
    scoreHistory: compScores,
  };
}

/**
 * Normalize comprehensive score to 0-198 scale.
 */
function normalizeCompScore(score) {
  if (score == null) return 0;
  const num = Number(score);
  if (isNaN(num)) return 0;
  return Math.max(0, Math.min(EJU_COMPREHENSIVE_MAX, num));
}

// ═══════════════════════════════════════════════════════════════════════
// TOPIC PERFORMANCE ANALYSIS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Analyze per-topic performance from exam history.
 */
function analyzeTopicPerformance(studentExams, datasets) {
  const topicStats = {};

  // Initialize from knowledge graph taxonomy
  const allTopics = getAllTopics(datasets);
  for (const { name, domain } of allTopics) {
    topicStats[name] = {
      topic: name,
      domain,
      label: name,
      domainLabel: DOMAIN_LABELS[domain] || domain,
      errorCount: 0,
      totalEncountered: 0,
      accuracy: 0,
      priority: 'low',
      score: 0,
    };
  }

  // Process mistakes
  for (const exam of (studentExams || [])) {
    const mistakes = exam.comprehensive?.mistakes || [];
    for (const m of mistakes) {
      const topic = m.topic || '';
      if (!topic) continue;
      if (topicStats[topic]) {
        topicStats[topic].errorCount++;
        topicStats[topic].totalEncountered++;
      }
    }
  }

  // Calculate accuracy and priority
  const result = Object.values(topicStats);
  for (const ts of result) {
    if (ts.totalEncountered > 0) {
      ts.accuracy = Math.max(0, 1 - (ts.errorCount / ts.totalEncountered));
    } else {
      ts.accuracy = -1; // No data
    }

    // Priority: high error count + low accuracy = high priority
    if (ts.errorCount >= 3 && ts.accuracy < 0.5) {
      ts.priority = 'high';
      ts.score = 100;
    } else if (ts.errorCount >= 1 && ts.accuracy < 0.7) {
      ts.priority = 'medium';
      ts.score = 60;
    } else if (ts.totalEncountered === 0) {
      ts.priority = 'unseen';
      ts.score = 30;
    } else {
      ts.priority = 'low';
      ts.score = 10;
    }
  }

  return result.sort((a, b) => b.score - a.score);
}

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

// ═══════════════════════════════════════════════════════════════════════
// ROI COMPUTATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute Return on Investment for each topic.
 * ROI = (expected score gain × exam probability) / required study time
 */
function computeTopicROI(topicPerformance, datasets, studentExams) {
  const trendData = extractTrendDataSimple(datasets);
  const predData = extractPredictionDataSimple(datasets);
  const diffData = extractDifficultyDataSimple(datasets);

  const roiResults = [];

  for (const tp of topicPerformance) {
    // Factor 1: Weakness factor (0-40)
    const weaknessFactor = tp.priority === 'high' ? 40
      : tp.priority === 'medium' ? 25
      : tp.priority === 'unseen' ? 15
      : 5;

    // Factor 2: Exam frequency factor (0-25)
    const trend = trendData[tp.topic];
    const frequencyFactor = trend
      ? Math.min(25, (trend.total || 0) / 4)
      : 10;

    // Factor 3: Future prediction factor (0-25)
    const pred = predData[tp.topic];
    const predictionFactor = pred
      ? (pred.probability_pct || 30) / 4
      : 7.5;

    // Factor 4: Difficulty factor (0-10)
    const diff = diffData[tp.topic];
    // Medium difficulty (30-60) provides best ROI
    const difficultyFactor = diff
      ? (diff.score >= 30 && diff.score <= 60) ? 10
        : diff.score > 60 ? 5
        : 8
      : 5;

    // Combined ROI score (0-100)
    const roiScore = weaknessFactor + frequencyFactor + predictionFactor + difficultyFactor;

    // Estimate required study time (minutes)
    const estimatedTime = tp.priority === 'high' ? 180
      : tp.priority === 'medium' ? 120
      : tp.priority === 'unseen' ? 90
      : 60;

    // ROI per hour
    const roiPerHour = roiScore / (estimatedTime / 60);

    // Expected score gain
    const expectedGain = tp.priority === 'high' ? SCORE_PER_TOPIC_GAIN.high
      : tp.priority === 'medium' ? SCORE_PER_TOPIC_GAIN.medium
      : SCORE_PER_TOPIC_GAIN.low;

    roiResults.push({
      topic: tp.topic,
      domain: tp.domain,
      domainLabel: tp.domainLabel,
      currentAccuracy: tp.accuracy,
      errorCount: tp.errorCount,
      priority: tp.priority,
      roiScore: parseFloat(roiScore.toFixed(1)),
      roiPerHour: parseFloat(roiPerHour.toFixed(1)),
      expectedScoreGain: expectedGain,
      estimatedStudyMinutes: estimatedTime,
      factors: {
        weakness: weaknessFactor,
        frequency: frequencyFactor,
        prediction: predictionFactor,
        difficulty: difficultyFactor,
      },
    });
  }

  return roiResults.sort((a, b) => b.roiScore - a.roiScore);
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

// ═══════════════════════════════════════════════════════════════════════
// STUDY SEQUENCE GENERATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate optimal study sequence respecting prerequisite order.
 */
function generateStudySequence(topicROI, datasets) {
  const sequence = [];

  // Get prerequisite map
  const prerequisiteMap = getPrerequisiteMap(datasets);

  // Process topics in ROI order, respecting prerequisites
  const processed = new Set();
  const remaining = [...topicROI];

  while (remaining.length > 0) {
    let found = false;

    for (let i = 0; i < remaining.length; i++) {
      const topic = remaining[i];
      const prereqs = prerequisiteMap[topic.topic] || [];

      // Check if all prerequisites are processed (or don't exist)
      const allPrereqsMet = prereqs.every(p =>
        processed.has(p) || !topicROI.some(t => t.topic === p)
      );

      if (allPrereqsMet) {
        sequence.push({
          ...topic,
          order: sequence.length + 1,
          prerequisite: prereqs.filter(p => processed.has(p)),
        });
        processed.add(topic.topic);
        remaining.splice(i, 1);
        found = true;
        break;
      }
    }

    // If no topic can be processed (circular dependency), add highest ROI remaining
    if (!found && remaining.length > 0) {
      const next = remaining.shift();
      sequence.push({
        ...next,
        order: sequence.length + 1,
        prerequisite: [],
        note: '선행개념 없음 또는 독립 주제',
      });
      processed.add(next.topic);
    }
  }

  return sequence;
}

/**
 * Get prerequisite map from datasets.
 */
function getPrerequisiteMap(datasets) {
  const map = {};

  const wp = datasets?.weakProfile;
  if (wp?.domain_structure) {
    for (const [domain, data] of Object.entries(wp.domain_structure)) {
      const order = data.prerequisite_order || [];
      for (let i = 1; i < order.length; i++) {
        if (!map[order[i]]) map[order[i]] = [];
        map[order[i]].push(order[i - 1]);
      }
    }
  }

  // Also add from knowledge_graph edges
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
// WEEKLY PLAN GENERATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate weekly study schedule.
 */
function generateWeeklyPlan(studySequence, targetDate, datasets) {
  const weeks = [];
  const dailyMinutes = 120; // Default 2 hours per day
  const daysPerWeek = 5;    // 5 days a week

  // Distribute topics across weeks
  const topicsPerWeek = Math.max(1, Math.ceil(studySequence.length / 8));

  for (let w = 0; w < 8; w++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() + w * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekTopics = studySequence.slice(w * topicsPerWeek, (w + 1) * topicsPerWeek);

    // Build daily tasks
    const dailyTasks = [];
    const tasksPerDay = Math.ceil(weekTopics.length / daysPerWeek);

    for (let d = 0; d < daysPerWeek; d++) {
      const dayTopics = weekTopics.slice(d * tasksPerDay, (d + 1) * tasksPerDay);
      if (dayTopics.length === 0) break;

      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + d);

      dailyTasks.push({
        day: dayDate.toLocaleDateString('ko-KR', { weekday: 'long' }),
        date: dayDate.toISOString().split('T')[0],
        focus: dayTopics.map(t => t.domainLabel).filter((v, i, a) => a.indexOf(v) === i).join(' & '),
        topics: dayTopics.map(t => t.topic),
        estimatedMinutes: dayTopics.reduce((s, t) => s + t.estimatedStudyMinutes, 0),
        tasks: generateDayTasks(dayTopics),
      });
    }

    // Calculate total time
    const totalMinutes = dailyTasks.reduce((s, d) => s + d.estimatedMinutes, 0);

    weeks.push({
      week: w + 1,
      startDate: weekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      focus: weekTopics.map(t => t.domainLabel).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      topics: weekTopics.map(t => t.topic),
      totalEstimatedMinutes: totalMinutes,
      totalEstimatedHours: parseFloat((totalMinutes / 60).toFixed(1)),
      dailyTasks,
    });
  }

  return weeks;
}

/**
 * Generate daily tasks for a set of topics.
 */
function generateDayTasks(topics) {
  const tasks = [];

  for (const topic of topics) {
    tasks.push({
      type: 'concept_review',
      text: `'${topic.topic}' 개념 정리 및 노트 작성`,
      estimatedMinutes: Math.round(topic.estimatedStudyMinutes * 0.4),
    });
    tasks.push({
      type: 'practice',
      text: `'${topic.topic}' 연습문제 5-10문항 풀이`,
      estimatedMinutes: Math.round(topic.estimatedStudyMinutes * 0.4),
    });
    tasks.push({
      type: 'review',
      text: `'${topic.topic}' 오답 복습`,
      estimatedMinutes: Math.round(topic.estimatedStudyMinutes * 0.2),
    });
  }

  return tasks;
}

// ═══════════════════════════════════════════════════════════════════════
// SCORE PROJECTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Project score improvement based on study plan execution.
 */
function projectScoreImprovement(topicROI, currentLevel, targetScore, datasets) {
  const highRoiTopics = topicROI.filter(t => t.roiScore >= 40);
  const mediumRoiTopics = topicROI.filter(t => t.roiScore >= 25 && t.roiScore < 40);
  const lowRoiTopics = topicROI.filter(t => t.roiScore < 25);

  // Estimate score improvement from each group
  const highGain = Math.min(highRoiTopics.length, 8) * SCORE_PER_TOPIC_GAIN.high;
  const mediumGain = Math.min(mediumRoiTopics.length, 10) * SCORE_PER_TOPIC_GAIN.medium;
  const lowGain = Math.min(lowRoiTopics.length, 5) * SCORE_PER_TOPIC_GAIN.low;

  const totalPotentialGain = highGain + mediumGain + lowGain;

  // Estimate weeks to reach target
  const remainingGap = targetScore - currentLevel.currentScore;
  const weeklyGainRate = totalPotentialGain / 12; // Assume 12 weeks
  const estimatedWeeks = weeklyGainRate > 0
    ? Math.ceil(remainingGap / weeklyGainRate)
    : 99;

  // Weekly projection
  const weeklyProjection = [];
  const numWeeks = Math.min(estimatedWeeks, 24);

  for (let w = 1; w <= numWeeks; w++) {
    const projectedScore = Math.min(
      targetScore,
      currentLevel.currentScore + weeklyGainRate * w
    );
    weeklyProjection.push({
      week: w,
      projectedScore: Math.round(projectedScore),
      gain: Math.round(weeklyGainRate),
    });
  }

  return {
    currentScore: currentLevel.currentScore,
    targetScore,
    totalPotentialGain,
    estimatedWeeks,
    weeklyGainRate: parseFloat(weeklyGainRate.toFixed(1)),
    isAchievable: estimatedWeeks <= 24,
    weeklyProjection,
    confidence: estimatedWeeks <= 8 ? 'high'
      : estimatedWeeks <= 16 ? 'medium'
      : 'low',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate coach recommendations.
 */
function generateCoachRecommendations(topicROI, gap, scoreProjection, datasets) {
  const recs = [];

  // 1. Focus areas
  const topROI = topicROI.slice(0, 3);
  if (topROI.length > 0) {
    recs.push({
      type: 'focus',
      priority: 'high',
      text: `최우선 학습: ${topROI.map(t => t.topic).join(', ')}`,
      reason: `ROI 분석 결과 이 주제들이 가장 효율적인 점수 향상을 보여줍니다.`,
    });
  }

  // 2. Domain balance
  const domainsNeeded = topicROI
    .filter(t => t.priority === 'high')
    .map(t => t.domainLabel)
    .filter((v, i, a) => a.indexOf(v) === i);

  if (domainsNeeded.length > 0) {
    recs.push({
      type: 'domain_focus',
      priority: 'high',
      text: `집중 영역: ${domainsNeeded.join(', ')}`,
      reason: `이 영역들의 취약도가 높아 개선 시 큰 점수 향상이 기대됩니다.`,
    });
  }

  // 3. Score projection insight
  if (scoreProjection.isAchievable) {
    recs.push({
      type: 'motivation',
      priority: 'medium',
      text: `목표 달성 가능: 약 ${scoreProjection.estimatedWeeks}주 집중 학습 시 목표(${scoreProjection.targetScore}점) 도달 예상`,
      reason: `주당 약 ${scoreProjection.weeklyGainRate}점 향상 가능`,
    });
  } else {
    recs.push({
      type: 'warning',
      priority: 'medium',
      text: `현재 목표(${scoreProjection.targetScore}점)까지 ${scoreProjection.estimatedWeeks}주 소요 예상. 목표 조정 또는 학습 시간 증대 고려.`,
      reason: `더 많은 학습 시간이 필요합니다.`,
    });
  }

  // 4. Study routine
  recs.push({
    type: 'routine',
    priority: 'medium',
    text: '주 5일, 1일 2시간 학습 권장',
    reason: '일관된 학습이 가장 효과적입니다.',
  });

  // 5. Weak prerequisite warning
  const weakPrereqs = topicROI.filter(t =>
    t.priority === 'high' && t.currentAccuracy < 0.3
  );
  if (weakPrereqs.length > 0) {
    recs.push({
      type: 'prerequisite_warning',
      priority: 'high',
      text: `기초 개념 부족 감지: ${weakPrereqs.slice(0, 2).map(t => t.topic).join(', ')}`,
      reason: '기본 개념부터 차근차근 학습하세요.',
    });
  }

  return recs;
}

// ═══════════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════════

/**
 * Format study plan for display.
 */
export function formatStudyPlanForDisplay(studyPlan) {
  if (!studyPlan) return null;

  return {
    summary: {
      currentScore: studyPlan.studentProfile?.currentScore || 0,
      targetScore: studyPlan.studentProfile?.targetScore || 0,
      gap: studyPlan.studentProfile?.gap || 0,
      estimatedWeeks: studyPlan.scoreProjection?.estimatedWeeks || 0,
    },
    topROITopics: (studyPlan.topicROI || []).slice(0, 5).map(t => ({
      topic: t.topic,
      domain: t.domainLabel,
      roiScore: t.roiScore,
      expectedGain: t.expectedScoreGain,
      priority: t.priority,
    })),
    studySequence: (studyPlan.studySequence || []).map(s => ({
      order: s.order,
      topic: s.topic,
      domain: s.domainLabel,
      estimatedMinutes: s.estimatedStudyMinutes,
    })),
    weeklyPlan: (studyPlan.weeklyPlan || []).map(w => ({
      week: w.week,
      focus: w.focus,
      totalHours: w.totalEstimatedHours,
      dailyTasks: w.dailyTasks,
    })),
    recommendations: studyPlan.recommendations || [],
  };
}

// ── Exports ────────────────────────────────────────────────────────────
export default {
  computeStudyCoachV2,
  formatStudyPlanForDisplay,
};
