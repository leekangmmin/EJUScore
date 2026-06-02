// ═══════════════════════════════════════════════════════════════════════
// EJU Future Predictor v2
// Predicts exam topic probabilities for 2026, 2027, 2028.
// Factors:
//   - Recent 5-year weighted frequency (40%)
//   - Consecutive appearance gap/break (20%)
//   - Domain balance requirement (15%)
//   - Difficulty balance requirement (10%)
//   - Topic rotation pattern (15%)
//
// Leverages: dataset/trend-analysis/trend_analysis_v2.json,
//            dataset/prediction/prediction_2026.json,
//            dataset/difficulty/difficulty_database.json
// ═══════════════════════════════════════════════════════════════════════

// ── Constants ─────────────────────────────────────────────────────────

const DOMAINS = ['economy', 'politics', 'history', 'geography', 'society'];

const DOMAIN_LABELS = {
  economy: '경제', politics: '정치', history: '역사',
  geography: '지리', society: '사회',
};

const DOMAIN_TOPICS = {
  economy: [
    '수요·공급과 시장균형', 'GDP·국민소득', '환율·국제수지',
    '금융·통화정책', '재정·조세정책', '국제무역', '고용·노동',
    '경제성장·경기변동', '소득분배·지니계수', '일본경제사',
  ],
  politics: [
    '헌법·기본권', '통치기구', '선거·정당', '국제정치·국제기구',
    '지방자치', '사법·재판', '정치사상', '안전보장·방위',
  ],
  history: [
    '시민혁명', '산업혁명·자본주의', '제국주의·식민지', '세계대전',
    '냉전', '일본근대사', '전후세계질서', '세계화·지역통합',
  ],
  geography: [
    '기후·케펜구분', '지형·판구조', '인구·도시화', '자원·농업',
    '지도·GIS', '환경·생태', '산업·교통',
  ],
  society: [
    '환경문제', '사회보장·복지', '저출산·고령화', '정보화사회', '젠더·평등',
  ],
};

// Expected domain balance in a typical EJU exam (approximate %)
const DOMAIN_BALANCE_TARGET = {
  economy: 32,
  politics: 24,
  history: 21,
  geography: 18,
  society: 5,
};

// Weight configuration for prediction factors
const WEIGHTS = {
  RECENT_5YR: 0.40,
  GAP_ANALYSIS: 0.20,
  DOMAIN_BALANCE: 0.15,
  DIFFICULTY_BALANCE: 0.10,
  TOPIC_ROTATION: 0.15,
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN PREDICTOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * Predict future exam topic probabilities for 2026-2028.
 *
 * @param {object} datasets - Dataset cache
 * @returns {object} Predictions per year with detailed scoring
 */
export function predictFutureExamsV2(datasets = {}) {
  const predictions = {
    generatedAt: new Date().toISOString(),
    methodology: {
      factors: [
        { name: '최근 5년 가중 빈도', weight: WEIGHTS.RECENT_5YR },
        { name: '출제 공백 분석', weight: WEIGHTS.GAP_ANALYSIS },
        { name: '도메인 균형 요구', weight: WEIGHTS.DOMAIN_BALANCE },
        { name: '난이도 균형 요구', weight: WEIGHTS.DIFFICULTY_BALANCE },
        { name: '주제 로테이션 패턴', weight: WEIGHTS.TOPIC_ROTATION },
      ],
      dataRange: '2002-2025',
      predictionYears: [2026, 2027, 2028],
    },
    // Core predictions: map of year -> array of topic predictions
    yearly: {},
    // Domain-level rotation analysis
    domainRotation: {},
    // Difficulty distribution prediction
    difficultyDistribution: {},
    // Summary insights
    insights: [],
  };

  // Extract trend data
  const trendData = extractTrendData(datasets);
  const difficultyData = extractDifficultyData(datasets);
  const allTopics = getAllTopics(datasets);

  // Predict for each year
  for (const year of [2026, 2027, 2028]) {
    const yearPredictions = predictForYear(year, allTopics, trendData, difficultyData, datasets);
    predictions.yearly[year] = yearPredictions;
  }

  // Analyze domain rotation
  predictions.domainRotation = analyzeDomainRotation(allTopics, trendData);

  // Predict difficulty distribution
  predictions.difficultyDistribution = predictDifficultyDistribution(allTopics, difficultyData, trendData);

  // Generate insights
  predictions.insights = generatePredictionInsights(predictions, trendData);

  return predictions;
}

/**
 * Predict topic probabilities for a single year.
 */
function predictForYear(year, allTopics, trendData, difficultyData, datasets) {
  const predictions = [];
  let predictionId = 0;

  // Calculate per-topic scores
  const topicScores = [];

  for (const topic of allTopics) {
    const { name, domain } = topic;

    // Factor 1: Recent 5-year weighted frequency (40%)
    const recentScore = computeRecentFrequencyScore(name, trendData, year);

    // Factor 2: Gap analysis — how long since last appearance (20%)
    const gapScore = computeGapScore(name, trendData, year);

    // Factor 3: Domain balance requirement (15%)
    const domainBalanceScore = computeDomainBalanceScore(domain, trendData, year);

    // Factor 4: Difficulty balance (10%)
    const difficultyScore = computeDifficultyScore(name, domain, difficultyData);

    // Factor 5: Topic rotation pattern (15%)
    const rotationScore = computeRotationScore(name, domain, trendData, year);

    // Combined score
    const combinedScore = (
      recentScore * WEIGHTS.RECENT_5YR +
      gapScore * WEIGHTS.GAP_ANALYSIS +
      domainBalanceScore * WEIGHTS.DOMAIN_BALANCE +
      difficultyScore * WEIGHTS.DIFFICULTY_BALANCE +
      rotationScore * WEIGHTS.TOPIC_ROTATION
    ) * 100;

    const probabilityPct = Math.min(99, Math.max(1, Math.round(combinedScore)));

    topicScores.push({
      topic: name,
      domain,
      rank: 0, // Will be set after sorting
      predictionProbabilityPct: probabilityPct,
      combinedScore: parseFloat(combinedScore.toFixed(1)),
      factorScores: {
        recentFrequency: parseFloat(recentScore.toFixed(3)),
        gapAnalysis: parseFloat(gapScore.toFixed(3)),
        domainBalance: parseFloat(domainBalanceScore.toFixed(3)),
        difficultyBalance: parseFloat(difficultyScore.toFixed(3)),
        topicRotation: parseFloat(rotationScore.toFixed(3)),
      },
    });
  }

  // Sort by combined score descending
  topicScores.sort((a, b) => b.combinedScore - a.combinedScore);

  // Assign ranks
  topicScores.forEach((ts, i) => {
    ts.rank = i + 1;
    ts.id = `${year}_${String(i + 1).padStart(2, '0')}`;
  });

  return topicScores;
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR COMPUTATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Factor 1: Recent 5-year weighted frequency.
 * Topics that appeared more in the last 5 years get higher scores.
 * Weighted: more recent years get higher weight.
 */
function computeRecentFrequencyScore(topic, trendData, targetYear) {
  const data = trendData[topic];
  if (!data) return 0;

  const { yearly = {} } = data;
  const recentYears = [targetYear - 1, targetYear - 2, targetYear - 3, targetYear - 4, targetYear - 5];

  // Weight: T-1: 5, T-2: 4, T-3: 3, T-4: 2, T-5: 1
  const weights = [5, 4, 3, 2, 1];
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < recentYears.length; i++) {
    const y = String(recentYears[i]);
    const count = yearly[y] || 0;
    weightedSum += count * weights[i];
    totalWeight += weights[i];
  }

  if (totalWeight === 0) return 0;

  // Normalize: max possible weighted sum per year is ~20 questions
  const normalizedScore = Math.min(1, (weightedSum / totalWeight) / 5);
  return normalizedScore;
}

/**
 * Factor 2: Gap analysis.
 * Topics that haven't appeared in a while get a boost (due for reappearance).
 * Topics that appeared continuously for many years get a slight penalty (may rotate out).
 */
function computeGapScore(topic, trendData, targetYear) {
  const data = trendData[topic];
  if (!data) return 0.3; // default medium score

  const { yearly = {}, years_active = 0 } = data;
  const yearStr = String(targetYear - 1);

  // Check if appeared last year
  const lastYearCount = yearly[yearStr] || 0;
  const last2YearCount = yearly[String(targetYear - 2)] || 0;

  // Check for consecutive streak
  let streak = 0;
  for (let y = targetYear - 1; y >= 2002; y--) {
    if ((yearly[String(y)] || 0) > 0) {
      streak++;
    } else {
      break;
    }
  }

  // Compute gap: how many years since last appearance
  let gap = 0;
  for (let y = targetYear - 1; y >= 2002; y--) {
    if ((yearly[String(y)] || 0) > 0) {
      break;
    }
    gap++;
  }

  // Gap score: moderate gaps (2-4 years) get highest scores
  if (gap === 0) {
    // Appeared last year — high continuity, but may rotate out
    return streak > 5 ? 0.3 : 0.6;
  } else if (gap >= 1 && gap <= 2) {
    // 1-2 year gap — high probability of reappearance
    return 0.8;
  } else if (gap >= 3 && gap <= 5) {
    // 3-5 year gap — moderate
    return 0.6;
  } else if (gap > 5) {
    // Very long gap — low probability (topic may have been phased out)
    return 0.2;
  }

  return 0.5;
}

/**
 * Factor 3: Domain balance.
 * Ensures predictions maintain the expected domain distribution.
 */
function computeDomainBalanceScore(domain, trendData, targetYear) {
  const targetPct = DOMAIN_BALANCE_TARGET[domain] || 15;
  const targetFraction = targetPct / 100;

  // Calculate recent domain proportion
  const recentYears = [targetYear - 1, targetYear - 2, targetYear - 3, targetYear - 4, targetYear - 5];
  let domainCount = 0;
  let totalCount = 0;

  for (const y of recentYears) {
    const yStr = String(y);
    if (trendData.domainTotals?.[yStr]) {
      domainCount += trendData.domainTotals[yStr][domain] || 0;
      totalCount += trendData.domainTotals[yStr].total || 0;
    }
  }

  const recentFraction = totalCount > 0 ? domainCount / totalCount : 0;

  // If recent fraction is below target, boost score (need more of this domain)
  // If above target, slightly penalize
  const deviation = recentFraction - targetFraction;
  const balanceScore = Math.max(0.2, Math.min(1, 0.5 - deviation * 2));

  return balanceScore;
}

/**
 * Factor 4: Difficulty balance.
 * Ensures predictions include a mix of difficulties.
 */
function computeDifficultyScore(topic, domain, difficultyData) {
  if (!difficultyData) return 0.5;

  // Look up topic difficulty
  const topicDiff = difficultyData[topic];
  if (!topicDiff) return 0.5;

  // Medium difficulty topics get highest score (most likely to appear)
  // Very easy or very hard topics are less common
  const diffScore = topicDiff.difficultyScore || 40;

  // Optimal range: 30-60 (medium difficulty)
  if (diffScore >= 30 && diffScore <= 60) {
    return 0.8;
  } else if (diffScore > 60 && diffScore <= 75) {
    return 0.5;
  } else if (diffScore > 75) {
    return 0.3;
  } else {
    return 0.6; // easier topics
  }
}

/**
 * Factor 5: Topic rotation pattern.
 * Analyzes the cyclical pattern of topic appearances.
 */
function computeRotationScore(topic, domain, trendData, targetYear) {
  const data = trendData[topic];
  if (!data || !data.yearly) return 0.5;

  const yearly = data.yearly;
  const years = Object.keys(yearly).sort();

  if (years.length < 5) return 0.4; // Not enough data

  // Calculate appearance interval
  const appearanceYears = years.filter(y => (yearly[y] || 0) > 0).map(Number);
  if (appearanceYears.length < 2) return 0.3;

  // Calculate average interval
  let intervals = [];
  for (let i = 1; i < appearanceYears.length; i++) {
    intervals.push(appearanceYears[i] - appearanceYears[i - 1]);
  }
  const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;

  // Predict next appearance based on rotation
  const lastAppearance = appearanceYears[appearanceYears.length - 1];
  const yearsSinceLast = targetYear - 1 - lastAppearance;
  const nextExpected = lastAppearance + avgInterval;

  // If we're near the expected next appearance, high score
  if (Math.abs(targetYear - nextExpected) <= 1) {
    return 0.9;
  } else if (yearsSinceLast >= Math.floor(avgInterval)) {
    return 0.7;
  } else if (yearsSinceLast >= Math.floor(avgInterval * 0.7)) {
    return 0.5;
  } else {
    return 0.3;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// DATA EXTRACTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Extract trend data from datasets into a normalized format.
 */
function extractTrendData(datasets) {
  const trendData = {
    domainTotals: {},
  };

  // Use trend_analysis_v2
  const trend = datasets?.trendAnalysis;
  if (trend?.topic_trends) {
    for (const [topic, data] of Object.entries(trend.topic_trends)) {
      trendData[topic] = {
        total: data.total || 0,
        years_active: data.years_active || 0,
        avg_per_year: data.avg_per_year || 0,
        recent_5yr: data.recent_5yr || 0,
        growth_rate_pct: data.growth_rate_pct || 0,
        yearly: data.yearly || {},
      };
    }
  }

  // Build domain totals from yearly data
  if (trend?.domain_trends) {
    for (const [domain, data] of Object.entries(trend.domain_trends)) {
      const yearly = data.yearly || {};
      for (const [year, count] of Object.entries(yearly)) {
        if (!trendData.domainTotals[year]) {
          trendData.domainTotals[year] = { total: 0 };
        }
        trendData.domainTotals[year][domain] = count;
        trendData.domainTotals[year].total += count;
      }
    }
  }

  // Also incorporate prediction_2026 data
  const pred = datasets?.prediction2026;
  if (pred?.top_30_predictions) {
    for (const p of pred.top_30_predictions) {
      if (!trendData[p.topic]) {
        trendData[p.topic] = {
          total: p.total_historical || 0,
          recent_5yr: p.recent_5yr_count || 0,
          recent_3yr: p.recent_3yr_count || 0,
          last_year_count: p.last_year_count || 0,
          momentum_score: p.momentum_score || 0,
          recency_score: p.recency_score || 0,
        };
      } else {
        // Augment with prediction data
        trendData[p.topic].recent_3yr = p.recent_3yr_count || 0;
        trendData[p.topic].last_year_count = p.last_year_count || 0;
        trendData[p.topic].momentum_score = p.momentum_score || 0;
        trendData[p.topic].recency_score = p.recency_score || 0;
      }
    }
  }

  return trendData;
}

/**
 * Extract difficulty data from datasets.
 */
function extractDifficultyData(datasets) {
  const diffData = {};

  const diffDB = datasets?.difficultyDB;
  if (diffDB?.questions) {
    for (const q of diffDB.questions) {
      const key = q.topic || q.domain;
      if (!key) continue;

      if (!diffData[key]) {
        diffData[key] = {
          scores: [],
          categories: {},
          count: 0,
        };
      }
      diffData[key].scores.push(q.difficulty_score || 0);
      const cat = q.difficulty_category || 'medium';
      diffData[key].categories[cat] = (diffData[key].categories[cat] || 0) + 1;
      diffData[key].count++;
    }
  }

  // Compute averages
  for (const [key, data] of Object.entries(diffData)) {
    data.difficultyScore = data.scores.length > 0
      ? data.scores.reduce((s, v) => s + v, 0) / data.scores.length
      : 40;
    data.dominantCategory = Object.entries(data.categories)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium';
  }

  return diffData;
}

/**
 * Get all topics from datasets or hardcoded list.
 */
function getAllTopics(datasets) {
  const topics = [];

  // Use knowledge_graph_v3 taxonomy
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

  // Fallback to hardcoded topics
  for (const [domain, topicList] of Object.entries(DOMAIN_TOPICS)) {
    for (const topic of topicList) {
      topics.push({ name: topic, domain });
    }
  }

  return topics;
}

// ═══════════════════════════════════════════════════════════════════════
// DOMAIN ROTATION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Analyze how domains rotate over time.
 */
function analyzeDomainRotation(allTopics, trendData) {
  const rotation = {};

  for (const domain of DOMAINS) {
    const domainTopics = allTopics.filter(t => t.domain === domain);
    const topicData = domainTopics.map(t => ({
      topic: t.name,
      yearlyAppearances: trendData[t.name]?.yearly || {},
      totalAppearances: trendData[t.name]?.total || 0,
      recentTrend: computeRecentTrend(trendData[t.name]),
    }));

    rotation[domain] = {
      label: DOMAIN_LABELS[domain],
      topics: topicData,
      totalAppearances: topicData.reduce((s, t) => s + t.totalAppearances, 0),
      rotationPattern: detectRotationPattern(topicData),
      predictedShift: predictDomainShift(domain, topicData, trendData),
    };
  }

  return rotation;
}

/**
 * Detect rotation pattern for a topic (e.g., appears every 2 years).
 */
function detectRotationPattern(topicData) {
  // Simple pattern detection
  const allYears = new Set();
  for (const t of topicData) {
    for (const y of Object.keys(t.yearlyAppearances)) {
      allYears.add(Number(y));
    }
  }

  const sortedYears = [...allYears].sort((a, b) => a - b);
  if (sortedYears.length < 4) return 'insufficient_data';

  // Check for alternating patterns
  let gaps = [];
  for (let i = 1; i < sortedYears.length; i++) {
    gaps.push(sortedYears[i] - sortedYears[i - 1]);
  }

  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

  if (avgGap <= 1.5) return 'yearly';
  if (avgGap <= 2.5) return 'biennial';
  if (avgGap <= 4) return 'triennial';
  return 'irregular';
}

/**
 * Predict how a domain's share will shift.
 */
function predictDomainShift(domain, topicData, trendData) {
  const recentYears = ['2021', '2022', '2023', '2024', '2025'];
  const olderYears = ['2002', '2003', '2004', '2005', '2006'];

  let recentCount = 0;
  let olderCount = 0;

  for (const t of topicData) {
    for (const y of recentYears) {
      recentCount += t.yearlyAppearances[y] || 0;
    }
    for (const y of olderYears) {
      olderCount += t.yearlyAppearances[y] || 0;
    }
  }

  const change = recentCount - olderCount;
  if (change > 3) return 'increasing';
  if (change < -3) return 'decreasing';
  return 'stable';
}

/**
 * Compute recent trend for a single topic.
 */
function computeRecentTrend(topicTrend) {
  if (!topicTrend) return 'stable';

  const growth = topicTrend.growth_rate_pct || 0;
  if (growth > 10) return 'increasing';
  if (growth < -10) return 'decreasing';
  return 'stable';
}

// ═══════════════════════════════════════════════════════════════════════
// DIFFICULTY DISTRIBUTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Predict the difficulty distribution for future exams.
 */
function predictDifficultyDistribution(allTopics, difficultyData, trendData) {
  // Count topic difficulties
  let easy = 0, medium = 0, hard = 0;

  for (const topic of allTopics) {
    const diff = difficultyData[topic.name];
    if (!diff) {
      medium++;
      continue;
    }
    const score = diff.difficultyScore || 40;
    if (score >= 60) hard++;
    else if (score >= 35) medium++;
    else easy++;
  }

  const total = easy + medium + hard;

  return {
    easy: { count: easy, percentage: total > 0 ? parseFloat(((easy / total) * 100).toFixed(1)) : 0 },
    medium: { count: medium, percentage: total > 0 ? parseFloat(((medium / total) * 100).toFixed(1)) : 0 },
    hard: { count: hard, percentage: total > 0 ? parseFloat(((hard / total) * 100).toFixed(1)) : 0 },
    predictedDistribution: {
      easy: '25-30%',
      medium: '55-65%',
      hard: '10-15%',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// INSIGHTS GENERATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate human-readable insights from predictions.
 */
function generatePredictionInsights(predictions, trendData) {
  const insights = [];

  // Top topics for 2026
  const top2026 = predictions.yearly[2026]?.slice(0, 5) || [];
  if (top2026.length > 0) {
    insights.push({
      type: 'top_topics',
      year: 2026,
      text: `2026년 최고 출제 예상 주제: ${top2026.map(t => t.topic).join(', ')}`,
      topics: top2026.map(t => t.topic),
    });
  }

  // Biggest movers (topics that changed most from 2025 to 2026)
  const bigMovers = findBigMovers(predictions);
  if (bigMovers.length > 0) {
    insights.push({
      type: 'big_movers',
      text: `출제 확률 큰 변화 주제: ${bigMovers.slice(0, 3).map(m => `${m.topic}(${m.change > 0 ? '+' : ''}${m.change}%)`).join(', ')}`,
      movers: bigMovers.slice(0, 5),
    });
  }

  // Domain rotation insight
  const rotation = predictions.domainRotation || {};
  for (const [domain, data] of Object.entries(rotation)) {
    if (data.predictedShift === 'increasing') {
      insights.push({
        type: 'domain_increasing',
        domain,
        text: `${DOMAIN_LABELS[domain] || domain} 출제 비중 증가 예상 — 집중 학습 필요`,
      });
    } else if (data.predictedShift === 'decreasing') {
      insights.push({
        type: 'domain_decreasing',
        domain,
        text: `${DOMAIN_LABELS[domain] || domain} 출제 비중 감소 예상 — 기본 수준 유지`,
      });
    }
  }

  // New/emerging topics
  const emergingTopics = findEmergingTopics(predictions, trendData);
  if (emergingTopics.length > 0) {
    insights.push({
      type: 'emerging_topics',
      text: `주의 깊게 봐야 할 주제: ${emergingTopics.slice(0, 3).join(', ')}`,
      topics: emergingTopics.slice(0, 5),
    });
  }

  return insights;
}

/**
 * Find topics with biggest probability change.
 */
function findBigMovers(predictions) {
  const movers = [];

  // This compares 2025 actual vs 2026 prediction
  // For now, compare 2026 vs 2027 predictions as a proxy
  const y2026 = predictions.yearly[2026] || [];
  const y2027 = predictions.yearly[2027] || [];

  const y2026Map = {};
  for (const t of y2026) y2026Map[t.topic] = t.predictionProbabilityPct;

  for (const t of y2027) {
    const prev = y2026Map[t.topic];
    if (prev !== undefined) {
      const change = t.predictionProbabilityPct - prev;
      if (Math.abs(change) >= 10) {
        movers.push({
          topic: t.topic,
          domain: t.domain,
          prev: prev,
          current: t.predictionProbabilityPct,
          change,
        });
      }
    }
  }

  return movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 10);
}

/**
 * Find emerging topics (rising in probability).
 */
function findEmergingTopics(predictions, trendData) {
  const emerging = [];
  const y2026 = predictions.yearly[2026] || [];

  for (const t of y2026.slice(0, 20)) {
    const trend = trendData[t.topic];
    const growthRate = trend?.growth_rate_pct || 0;
    const recentCount = trend?.recent_5yr || 0;
    const totalCount = trend?.total || 0;

    // Emerging: high growth rate, relatively new, high prediction
    if (growthRate > 20 && recentCount > 3 && totalCount < 50) {
      emerging.push(t.topic);
    }
  }

  return emerging;
}

// ═══════════════════════════════════════════════════════════════════════
// FORMATTING & EXPORT
// ═══════════════════════════════════════════════════════════════════════

/**
 * Format predictions for dashboard display.
 */
export function formatPredictionsForDisplay(predictions) {
  if (!predictions) return { yearly: {}, insights: [] };

  const display = {
    yearly: {},
    insights: predictions.insights || [],
  };

  for (const [year, preds] of Object.entries(predictions.yearly)) {
    display.yearly[year] = preds.map(p => ({
      id: p.id,
      rank: p.rank,
      topic: p.topic,
      domain: p.domain,
      probability: p.predictionProbabilityPct,
      score: p.combinedScore,
      color: p.predictionProbabilityPct >= 60 ? '#10b981'
        : p.predictionProbabilityPct >= 40 ? '#f59e0b'
        : '#94a3b8',
    }));
  }

  return display;
}

/**
 * Get top N predictions for a specific year.
 */
export function getTopPredictions(predictions, year = 2026, n = 10) {
  if (!predictions?.yearly?.[year]) return [];
  return predictions.yearly[year].slice(0, n);
}

/**
 * Get prediction for a specific topic.
 */
export function getTopicPrediction(predictions, topic, year = 2026) {
  if (!predictions?.yearly?.[year]) return null;
  return predictions.yearly[year].find(p => p.topic === topic) || null;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

export default {
  predictFutureExamsV2,
  formatPredictionsForDisplay,
  getTopPredictions,
  getTopicPrediction,
};
