// ═══════════════════════════════════════════════════════════════════
// Advanced Trend Analysis Engine — Exam Intelligence Center
// Analyzes all OCR-imported exams for:
//   - Topic frequency and trends (20+ year analysis)
//   - Topic growth/decline patterns
//   - Question evolution over time
//   - Bayesian future exam prediction
// ═══════════════════════════════════════════════════════════════════

import { getSyllabusDatabase } from '../utils/syllabusMatcher';
import db, { STORES } from '../db/database';

/**
 * Full trend analysis across all available exam data.
 * Combines hardcoded exam bank data with user's OCR-imported exams.
 *
 * @param {Array} hardcodedData - From ejuPastExamBank.js
 * @param {Array} userQuestions - User's OCR-imported questions
 * @returns {object} Complete trend analysis
 */
export async function analyzeTrends(hardcodedData, userQuestions = []) {
  const analysis = {
    generatedAt: new Date().toISOString(),
    dataSources: {
      hardcodedExams: hardcodedData?.jongkwa?.totalExams || 0,
      userImportedExams: 0,
      totalQuestionsAnalyzed: 0,
    },
    topicFrequency: [],
    topicGrowth: [],
    questionEvolution: [],
    futurePredictions: [],
    domainTrends: {},
    methodology: 'bayesian_recency_weighted',
  };

  // 1. Aggregate all questions (hardcoded + user)
  const allYearlyData = aggregateYearlyData(hardcodedData, userQuestions);

  analysis.dataSources.userImportedExams = countUserExams(userQuestions);
  analysis.dataSources.totalQuestionsAnalyzed = Object.values(allYearlyData)
    .reduce((sum, year) => sum + Object.values(year.domains || {}).reduce((s, c) => s + c, 0), 0);

  // 2. Topic frequency analysis
  analysis.topicFrequency = analyzeTopicFrequency(allYearlyData);

  // 3. Topic growth/decline
  analysis.topicGrowth = analyzeTopicGrowth(allYearlyData);

  // 4. Question evolution
  analysis.questionEvolution = analyzeQuestionEvolution(allYearlyData, hardcodedData);

  // 5. Domain-level trends
  analysis.domainTrends = analyzeDomainTrends(allYearlyData);

  // 6. Future exam prediction using Bayesian inference
  analysis.futurePredictions = predictFutureExams(allYearlyData, analysis.topicGrowth);

  return analysis;
}

/**
 * Aggregate yearly data from hardcoded bank + user imports.
 */
function aggregateYearlyData(hardcodedData, userQuestions) {
  const yearlyData = {};

  // From hardcoded exam bank
  const byYear = hardcodedData?.jongkwa?.byYear || [];
  for (const yearEntry of byYear) {
    const year = yearEntry.year;
    if (!yearlyData[year]) {
      yearlyData[year] = { domains: {}, totalQuestions: 0, materialTypes: {} };
    }
    yearlyData[year].domains.economy = (yearlyData[year].domains.economy || 0) + (yearEntry.economy || 0);
    yearlyData[year].domains.politics = (yearlyData[year].domains.politics || 0) + (yearEntry.politics || 0);
    yearlyData[year].domains.history = (yearlyData[year].domains.history || 0) + (yearEntry.history || 0);
    yearlyData[year].domains.geography = (yearlyData[year].domains.geography || 0) + (yearEntry.geography || 0);
    yearlyData[year].domains.society = (yearlyData[year].domains.society || 0) + (yearEntry.society || 0);
    yearlyData[year].totalQuestions += yearEntry.numQ || 0;
  }

  // From user's OCR-imported questions
  for (const q of (userQuestions || [])) {
    const year = q.metadata?.year;
    if (!year) continue;
    if (!yearlyData[year]) {
      yearlyData[year] = { domains: {}, totalQuestions: 0, materialTypes: {} };
    }
    const domain = q.domain || 'unknown';
    yearlyData[year].domains[domain] = (yearlyData[year].domains[domain] || 0) + 1;
    yearlyData[year].totalQuestions++;
  }

  return yearlyData;
}

/**
 * Analyze topic frequency across all years.
 */
function analyzeTopicFrequency(yearlyData) {
  const topicFreq = {};

  // Build topic frequency from domain-year data
  for (const [year, data] of Object.entries(yearlyData)) {
    for (const [domain, count] of Object.entries(data.domains)) {
      if (!topicFreq[domain]) {
        topicFreq[domain] = { total: 0, years: [], perYear: {} };
      }
      topicFreq[domain].total += count;
      topicFreq[domain].years.push(Number(year));
      topicFreq[domain].perYear[year] = count;
    }
  }

  return Object.entries(topicFreq)
    .map(([topic, data]) => ({
      topic,
      label: getTopicLabel(topic),
      totalAppearances: data.total,
      yearRange: data.years.length > 0
        ? [Math.min(...data.years), Math.max(...data.years)]
        : [0, 0],
      yearsActive: data.years.length,
      perYear: data.perYear,
      averagePerExam: data.years.length > 0
        ? (data.total / data.years.length).toFixed(1)
        : 0,
      trend: calculateTrend(data.perYear),
    }))
    .sort((a, b) => b.totalAppearances - a.totalAppearances);
}

/**
 * Analyze which topics are growing or declining.
 */
function analyzeTopicGrowth(yearlyData) {
  const years = Object.keys(yearlyData).sort();
  if (years.length < 3) return [];

  const midPoint = Math.floor(years.length / 2);
  const firstHalf = years.slice(0, midPoint);
  const secondHalf = years.slice(midPoint);

  const growth = [];

  // Compile all domains
  const allDomains = new Set();
  for (const data of Object.values(yearlyData)) {
    for (const domain of Object.keys(data.domains)) {
      allDomains.add(domain);
    }
  }

  for (const domain of allDomains) {
    const firstCount = firstHalf.reduce((sum, y) => sum + (yearlyData[y]?.domains[domain] || 0), 0);
    const secondCount = secondHalf.reduce((sum, y) => sum + (yearlyData[y]?.domains[domain] || 0), 0);

    const firstAvg = firstCount / Math.max(1, firstHalf.length);
    const secondAvg = secondCount / Math.max(1, secondHalf.length);

    const changePct = firstAvg > 0
      ? ((secondAvg - firstAvg) / firstAvg) * 100
      : secondAvg > 0 ? 100 : 0;

    growth.push({
      topic: domain,
      label: getTopicLabel(domain),
      firstHalfAvg: parseFloat(firstAvg.toFixed(2)),
      secondHalfAvg: parseFloat(secondAvg.toFixed(2)),
      changePercent: parseFloat(changePct.toFixed(1)),
      direction: changePct > 10 ? 'growing' : changePct < -10 ? 'declining' : 'stable',
      status: secondCount === 0 ? 'disappeared' :
              firstCount === 0 && secondCount > 0 ? 'emerging' : 'persistent',
    });
  }

  return growth.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

/**
 * Analyze how question styles/formats evolved.
 */
function analyzeQuestionEvolution(yearlyData, hardcodedData) {
  const evolution = [];

  // Analyze format changes over time
  const formatByYear = {};
  const materials = hardcodedData?.jongkwa?.material || [];
  for (const m of materials) {
    if (!formatByYear[m.id]) {
      // Use the overall count as a proxy distributed across years
      formatByYear[m.id] = {
        name: m.name,
        count: m.count,
        years: {},
      };
    }
  }

  // Analyze per-domain question format evolution
  const years = Object.keys(yearlyData).sort();
  if (years.length < 2) return evolution;

  // Pick representative years for comparison
  const sampleYears = [];
  if (years.length >= 20) {
    sampleYears.push(years[0], years[Math.floor(years.length / 2)], years[years.length - 1]);
  } else if (years.length >= 5) {
    sampleYears.push(years[0], years[Math.floor(years.length / 2)], years[years.length - 1]);
  } else {
    sampleYears.push(years[0], years[years.length - 1]);
  }

  const uniqueYears = [...new Set(sampleYears)].map(Number).sort((a, b) => a - b);

  for (const domain of ['economy', 'politics', 'history', 'geography', 'society']) {
    const domainData = uniqueYears.map(year => ({
      year,
      count: yearlyData[year]?.domains[domain] || 0,
      percentage: yearlyData[year]?.totalQuestions
        ? ((yearlyData[year].domains[domain] || 0) / yearlyData[year].totalQuestions * 100).toFixed(1)
        : '0.0',
    }));

    evolution.push({
      domain,
      label: getTopicLabel(domain),
      sampleYears: uniqueYears,
      data: domainData,
      shift: domainData.length >= 2
        ? parseFloat((domainData[domainData.length - 1].percentage - domainData[0].percentage).toFixed(1))
        : 0,
    });
  }

  return evolution;
}

/**
 * Analyze domain-level trends over time.
 */
function analyzeDomainTrends(yearlyData) {
  const trends = {};
  const years = Object.keys(yearlyData).sort();

  if (years.length === 0) return trends;

  for (const domain of ['economy', 'politics', 'history', 'geography', 'society']) {
    const values = years.map(y => yearlyData[y]?.domains[domain] || 0);
    const total = values.reduce((s, v) => s + v, 0);

    // Linear regression for trend direction
    const n = values.length;
    const indices = values.map((_, i) => i);
    const sumX = indices.reduce((s, v) => s + v, 0);
    const sumY = values.reduce((s, v) => s + v, 0);
    const sumXY = indices.reduce((s, i) => s + i * values[i], 0);
    const sumX2 = indices.reduce((s, i) => s + i * i, 0);
    const denom = n * sumX2 - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;

    // Volatility (standard deviation)
    const avg = sumY / n;
    const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    trends[domain] = {
      label: getTopicLabel(domain),
      total,
      averagePerYear: parseFloat((total / n).toFixed(2)),
      slope: parseFloat(slope.toFixed(3)),
      direction: slope > 0.3 ? 'increasing' : slope < -0.3 ? 'decreasing' : 'stable',
      volatility: parseFloat(stdDev.toFixed(2)),
      recentValues: values.slice(-5),
      isEmerging: values.slice(-3).reduce((s, v) => s + v, 0) > values.slice(0, 3).reduce((s, v) => s + v, 0) + 2,
    };
  }

  return trends;
}

/**
 * Predict future exam topics using Bayesian inference with recency weighting.
 * Uses a combination of:
 *   - Historical frequency (prior)
 *   - Recency weighting (recent exams weighted more)
 *   - Growth/decline trends
 *   - Bayesian updating
 */
function predictFutureExams(yearlyData, topicGrowth) {
  const predictions = [];
  const years = Object.keys(yearlyData).sort();
  const latestYear = Number(years[years.length - 1]) || new Date().getFullYear();
  const nextYear = latestYear + 1;

  // All domains with their historical data
  const allDomains = ['economy', 'politics', 'history', 'geography', 'society'];

  for (const domain of allDomains) {
    // Historical frequencies with recency weighting
    const weightedFrequencies = years.map((y, i) => {
      const count = yearlyData[y]?.domains[domain] || 0;
      // Recency weight: linear from 0.5 (oldest) to 1.5 (newest)
      const recencyWeight = 0.5 + (i / Math.max(1, years.length - 1)) * 1.0;
      return count * recencyWeight;
    });

    const totalWeighted = weightedFrequencies.reduce((s, v) => s + v, 0);
    const totalYears = years.length;

    // Prior probability (average weighted frequency per year)
    const priorProbability = totalWeighted / Math.max(1, totalYears);

    // Trend adjustment from growth analysis
    const growthEntry = topicGrowth.find(g => g.topic === domain);
    const trendFactor = growthEntry
      ? 1 + (growthEntry.changePercent / 100) * 0.3  // 30% of trend reflected
      : 1;

    // Bayesian posterior prediction
    const posterior = priorProbability * trendFactor;

    // Calculate confidence interval
    const frequencies = years.map(y => yearlyData[y]?.domains[domain] || 0);
    const avg = frequencies.reduce((s, v) => s + v, 0) / Math.max(1, frequencies.length);
    const variance = frequencies.reduce((s, v) => s + (v - avg) ** 2, 0) / Math.max(1, frequencies.length);
    const stdDev = Math.sqrt(variance);

    // Prediction confidence: based on data consistency
    const coefficientOfVariation = avg > 0 ? stdDev / avg : 1;
    const confidence = Math.max(0.3, Math.min(0.95, 1 - coefficientOfVariation * 0.5));

    predictions.push({
      topic: domain,
      label: getTopicLabel(domain),
      predictedYear: nextYear,
      predictedAppearances: Math.round(Math.max(0, posterior)),
      priorProbability: parseFloat(priorProbability.toFixed(2)),
      trendAdjustedProbability: parseFloat(posterior.toFixed(2)),
      confidence: parseFloat(confidence.toFixed(2)),
      confidenceLabel: confidence >= 0.78 ? '높음' : confidence >= 0.52 ? '보통' : '낮음',
      lowerBound: Math.round(Math.max(0, posterior - stdDev)),
      upperBound: Math.round(posterior + stdDev),
      methodology: 'bayesian_recency_weighted',
      factors: {
        historicalFrequency: parseFloat(avg.toFixed(2)),
        trendAdjustment: parseFloat(trendFactor.toFixed(3)),
        recencyWeight: 'linear (0.5→1.5)',
        dataPoints: years.length,
      },
    });
  }

  // Emerging topics (topics that appeared recently but not historically)
  const emergingTopics = findEmergingTopics(yearlyData, topicGrowth);
  predictions.push(...emergingTopics);

  return predictions.sort((a, b) => b.predictedAppearances - a.predictedAppearances);
}

/**
 * Find emerging topics that may appear in future exams.
 */
function findEmergingTopics(yearlyData, topicGrowth) {
  const emerging = [];

  // Topics that have appeared in recent years with increasing frequency
  const growingTopics = topicGrowth.filter(t =>
    t.status === 'emerging' || (t.direction === 'growing' && t.secondHalfAvg > t.firstHalfAvg * 1.5)
  );

  for (const topic of growingTopics) {
    emerging.push({
      topic: topic.topic,
      label: topic.label,
      predictedYear: new Date().getFullYear() + 1,
      predictedAppearances: Math.round(Math.max(1, topic.secondHalfAvg * 1.2)),
      priorProbability: parseFloat(topic.firstHalfAvg.toFixed(2)),
      trendAdjustedProbability: parseFloat((topic.secondHalfAvg * 1.2).toFixed(2)),
      confidence: 0.45,
      confidenceLabel: '보통',
      lowerBound: 0,
      upperBound: Math.round(topic.secondHalfAvg * 2),
      methodology: 'emerging_topic_detection',
      isEmerging: true,
      factors: {
        firstHalfAverage: topic.firstHalfAvg,
        secondHalfAverage: topic.secondHalfAvg,
        growthRate: topic.changePercent + '%',
      },
    });
  }

  return emerging;
}

/**
 * Calculate trend direction from yearly data.
 */
function calculateTrend(perYear) {
  const years = Object.keys(perYear).sort();
  if (years.length < 3) return 'stable';

  const third = Math.floor(years.length / 3);
  const firstThird = years.slice(0, third);
  const lastThird = years.slice(-third);

  const firstAvg = firstThird.reduce((s, y) => s + (perYear[y] || 0), 0) / Math.max(1, firstThird.length);
  const lastAvg = lastThird.reduce((s, y) => s + (perYear[y] || 0), 0) / Math.max(1, lastThird.length);

  if (lastAvg > firstAvg * 1.2) return 'increasing';
  if (lastAvg < firstAvg * 0.8) return 'decreasing';
  return 'stable';
}

/**
 * Count user-imported exams.
 */
function countUserExams(questions) {
  if (!questions) return 0;
  const examIds = new Set(questions.filter(q => q.examId).map(q => q.examId));
  return examIds.size;
}

/**
 * Get Korean label for a topic/domain.
 */
function getTopicLabel(topic) {
  const labels = {
    economy: '경제',
    politics: '정치',
    history: '역사',
    geography: '지리',
    society: '사회',
    japanese: '일본어',
    comprehensive: '종합과목',
  };
  return labels[topic] || topic;
}

export default { analyzeTrends };
