// ═══════════════════════════════════════════════════════════════════
// trendPersonalInsights — 출제경향 × 내 약점 분석 helper
//
// Computes per-topic personal accuracy from user exam mistakes,
// then derives priority scores = predictionProbability × (1 - accuracy).
//
// Pure functions — no React, no side effects.
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute per-topic personal accuracy from exam mistake records.
 *
 * Each exam record can carry:
 *   exam.comprehensive.mistakes = [{ topic, unit, errorType, ... }]
 *
 * Accuracy per topic = 1 - (mistake count / total exam sessions for that topic)
 * We use a simple estimate: each session that has the topic in mistakes = wrong.
 * Topics not mentioned in any mistake are considered "not enough data" (NaN).
 *
 * @param {Array} exams - Array of exam records
 * @param {Array} allTopics - Array of topic names to track
 * @returns {Object} { topicName: { accuracy, attempts, mistakes } }
 */
export function computePersonalAccuracy(exams = [], allTopics = []) {
  const result = {};

  // Initialize all topics
  for (const t of allTopics) {
    result[t] = { accuracy: null, attempts: 0, mistakes: 0, sessions: 0, lastDate: null };
  }

  for (const exam of (exams || [])) {
    const mistakes = exam?.comprehensive?.mistakes || [];
    const examDate = exam?.date || null;

    // Track which topics were seen in this exam (from mistakes)
    const seenTopics = new Set();

    for (const m of mistakes) {
      const topic = m.topic || m.unit || '';
      if (!topic) continue;

      if (!result[topic]) {
        result[topic] = { accuracy: null, attempts: 0, mistakes: 0, sessions: 0, lastDate: null };
      }

      result[topic].mistakes++;
      seenTopics.add(topic);
    }

    // Each session counts as one attempt for each topic mentioned
    for (const topic of seenTopics) {
      result[topic].sessions++;
      result[topic].attempts++;
      if (examDate && (!result[topic].lastDate || examDate > result[topic].lastDate)) {
        result[topic].lastDate = examDate;
      }
    }
  }

  // Compute accuracy: for each topic, estimate as 1 - (mistakes / (mistakes + assumed_correct))
  // assumed_correct = max(0, sessions * avg_per_session - mistakes)
  // But we can simplify: accuracy = max(0.05, 1 - mistakes / (sessions * 2))
  // Where sessions * 2 assumes ~2 questions per topic per session (rough estimate)
  for (const topic of Object.keys(result)) {
    const r = result[topic];
    if (r.sessions > 0) {
      // Estimate: assume avg 2 questions per session per topic
      const estimatedTotal = r.sessions * 2;
      const correct = Math.max(0, estimatedTotal - r.mistakes);
      r.accuracy = correct / estimatedTotal;
    } else {
      r.accuracy = null; // no data
    }
  }

  return result;
}

/**
 * Compute priority score for each predicted topic.
 *
 * priorityScore = predictionProbability × (1 - personalAccuracy)
 *
 * High prediction probability + low personal accuracy = HIGH priority.
 *
 * @param {Array} predictions - Array of prediction objects with { topic, probability_pct }
 * @param {Object} personalAccuracy - Map from topic to { accuracy }
 * @returns {Array} Sorted priority items with derived fields
 */
export function computePriorityTopics(predictions = [], personalAccuracy = {}) {
  const results = [];

  for (const p of predictions) {
    const topic = p.topic;
    if (!topic) continue;

    const prob = (p.probability_pct ?? p.prediction_score ?? 0) / 100;
    const pa = personalAccuracy[topic];
    const accuracy = pa?.accuracy;
    const hasAccuracy = accuracy != null && !isNaN(accuracy);

    // Priority score: high prediction * low accuracy = high priority
    const priorityScore = prob * (hasAccuracy ? (1 - accuracy) : 1);

    // Expected score impact: probability × (1 - accuracy) × estimated max points
    // EJU comprehensive: ~100 questions, ~200 points total → ~2 points per question
    // Impact ≈ probability × (1 - accuracy) × 2 × questions_per_topic
    const questionsPerTopic = p.total_24yr_count
      ? Math.max(2, Math.round(p.total_24yr_count / 24))
      : 2;
    const scoreImpact = Math.round(prob * (hasAccuracy ? (1 - accuracy) : 0.5) * questionsPerTopic * 2 * 10) / 10;

    const tier =
      priorityScore >= 0.5 ? '매우 높음' :
      priorityScore >= 0.3 ? '높음' :
      priorityScore >= 0.15 ? '중간' : '낮음';

    results.push({
      topic,
      domain: p.domain || '',
      predictionProbability: Math.round(prob * 100),
      personalAccuracy: hasAccuracy ? Math.round(accuracy * 100) : null,
      priorityScore: Math.round(priorityScore * 100),
      priorityTier: tier,
      estimatedScoreImpact: scoreImpact,
      hasAccuracy,
      totalQuestions: p.total_24yr_count || 0,
      recentCount: p.recent_5yr_count || 0,
    });
  }

  // Sort by priority score descending
  results.sort((a, b) => b.priorityScore - a.priorityScore);

  return results;
}

/**
 * Get explainable prediction data for a specific topic.
 *
 * @param {string} topic - Topic name
 * @param {Array} explainPred - Array from insights_v2.json explainable_prediction
 * @returns {Object|null} Matched explainable prediction or null
 */
export function getExplainablePrediction(topic, explainPred = []) {
  return explainPred.find(e => e.topic === topic) || null;
}

/**
 * Get cycle intelligence data for a specific topic.
 *
 * @param {string} topic - Topic name
 * @param {Array} cycleIntel - Array from insights_v2.json cycle_intelligence
 * @returns {Object|null} Matched cycle intelligence or null
 */
export function getCycleIntelligence(topic, cycleIntel = []) {
  return cycleIntel.find(e => e.topic === topic) || null;
}

/**
 * Get topic intelligence data for a specific topic.
 *
 * @param {string} topic - Topic name
 * @param {Array} topicIntel - Array from insights_v2.json topic_intelligence
 * @returns {Object|null} Matched topic intelligence or null
 */
export function getTopicIntelligence(topic, topicIntel = []) {
  return topicIntel.find(e => e.topic === topic) || null;
}

/**
 * Summarize error type distribution from exam mistakes.
 *
 * @param {Array} exams - Array of exam records
 * @returns {Object} { type: count, total, pct, ... }
 */
export function analyzeErrorTypes(exams = []) {
  const typeCount = {};
  let total = 0;

  for (const exam of (exams || [])) {
    const mistakes = exam?.comprehensive?.mistakes || [];
    for (const m of mistakes) {
      const errorType = m.errorType || m.error_type || '기타';
      typeCount[errorType] = (typeCount[errorType] || 0) + 1;
      total++;
    }
  }

  const types = Object.entries(typeCount)
    .map(([type, count]) => ({
      type,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { types, total };
}
