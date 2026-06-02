// ═══════════════════════════════════════════════════════════════════════
// Explainable AI (XAI) — 모든 추천은 이유를 설명해야 한다.
//
// Every recommendation must include a clear explanation:
// "금융·통화정책을 추천한 이유"
// - 최근 정답률 42%
// - 선행개념 부족
// - 2026 출제확률 56%
// - 난이도 적정
// ═══════════════════════════════════════════════════════════════════════

// ── Constants ─────────────────────────────────────────────────────────

const DOMAIN_LABELS = {
  economy: '경제', politics: '정치', history: '역사',
  geography: '지리', society: '사회',
};

const DIFFICULTY_DESCRIPTIONS = {
  very_easy: '매우 쉬움 — 기본 개념 확인 수준',
  easy: '쉬움 — 주요 개념 이해 필요',
  medium: '보통 — 응용 및 분석 필요',
  hard: '어려움 — 심층 이해 필요',
  very_hard: '매우 어려움 — 고난도 추론 필요',
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN EXPLANATION GENERATOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate a comprehensive explanation for a recommendation.
 *
 * @param {object} recommendation - A single recommendation object
 * @param {Array} studentExams - Student's exam history
 * @param {object} datasets - Dataset cache
 * @returns {object} Explanation object with structured reasons
 */
export function explainRecommendation(recommendation, studentExams = [], datasets = {}) {
  const { topic = '', domain = '' } = recommendation;
  if (!topic) return { summary: '추천 이유를 생성할 수 없습니다.', factors: [] };

  const factors = [];

  // Factor 1: Accuracy/Error rate
  const accuracyFactor = explainAccuracy(topic, domain, recommendation, studentExams);
  factors.push(accuracyFactor);

  // Factor 2: Prerequisite analysis
  const prereqFactor = explainPrerequisites(topic, domain, datasets, studentExams);
  if (prereqFactor) factors.push(prereqFactor);

  // Factor 3: Future exam probability
  const predictionFactor = explainPrediction(topic, domain, datasets);
  factors.push(predictionFactor);

  // Factor 4: Difficulty assessment
  const difficultyFactor = explainDifficulty(topic, domain, datasets);
  factors.push(difficultyFactor);

  // Factor 5: Frequency/importance
  const frequencyFactor = explainFrequency(topic, domain, datasets);
  factors.push(frequencyFactor);

  // Factor 6: Domain balance
  const balanceFactor = explainDomainBalance(topic, domain, datasets);
  if (balanceFactor) factors.push(balanceFactor);

  // Generate summary
  const summary = generateExplanationSummary(topic, factors);

  return {
    topic,
    domain: DOMAIN_LABELS[domain] || domain,
    summary,
    factors,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate batch explanations for multiple recommendations.
 */
export function explainBatchRecommendations(recommendations, studentExams, datasets) {
  return recommendations.map(rec =>
    explainRecommendation(rec, studentExams, datasets)
  );
}

// ═══════════════════════════════════════════════════════════════════════
// INDIVIDUAL FACTOR EXPLAINERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Explain the accuracy/error rate factor.
 */
function explainAccuracy(topic, domain, recommendation, studentExams) {
  let errorCount = 0;
  let totalCorrect = 0;
  let totalAttempts = 0;

  for (const exam of (studentExams || [])) {
    const mistakes = exam.comprehensive?.mistakes || [];
    for (const m of mistakes) {
      if (m.topic === topic || m.domain === domain) {
        errorCount++;
      }
    }
  }

  // Estimate total attempts from score
  const compScore = studentExams
    .filter(e => e.comprehensive?.score != null)
    .length;

  totalAttempts = Math.max(errorCount, Math.round(compScore * 0.3));
  totalCorrect = Math.max(0, totalAttempts - errorCount);

  const accuracy = totalAttempts > 0
    ? (totalCorrect / totalAttempts) * 100
    : 0;

  let severity;
  if (accuracy < 30) {
    severity = '매우 낮음 — 집중 학습 필요';
  } else if (accuracy < 50) {
    severity = '낮음 — 개선 여지 큼';
  } else if (accuracy < 70) {
    severity = '보통 — 추가 학습 권장';
  } else {
    severity = '양호 — 유지 필요';
  }

  return {
    type: 'accuracy',
    label: '최근 정답률',
    value: `${Math.round(accuracy)}%`,
    detail: `총 ${totalAttempts}회 중 ${errorCount}회 오답`,
    severity,
    importance: errorCount >= 2 ? 'high' : 'medium',
    icon: accuracy < 50 ? '🔴' : accuracy < 70 ? '🟡' : '🟢',
  };
}

/**
 * Explain prerequisite relationships.
 */
function explainPrerequisites(topic, domain, datasets, studentExams) {
  const prereqs = findPrerequisites(topic, datasets);
  if (!prereqs || prereqs.length === 0) return null;

  // Check which prerequisites the student struggles with
  const weakPrereqs = [];
  for (const prereq of prereqs) {
    let prereqErrorCount = 0;
    for (const exam of (studentExams || [])) {
      const mistakes = exam.comprehensive?.mistakes || [];
      for (const m of mistakes) {
        if (m.topic === prereq) {
          prereqErrorCount++;
        }
      }
    }
    if (prereqErrorCount >= 1) {
      weakPrereqs.push({ name: prereq, errorCount: prereqErrorCount });
    }
  }

  const allPrereqsMet = weakPrereqs.length === 0;

  return {
    type: 'prerequisite',
    label: '선행개념 분석',
    value: allPrereqsMet ? '선행개념 충족' : `${weakPrereqs.length}개 선행개념 부족`,
    detail: allPrereqsMet
      ? `'${topic}'의 선행개념이 모두 충분합니다.`
      : `'${weakPrereqs[0].name}'(${weakPrereqs[0].errorCount}회 오답) 등 선행개념 학습 필요`,
    severity: allPrereqsMet ? '양호' : '부족',
    importance: allPrereqsMet ? 'low' : 'high',
    icon: allPrereqsMet ? '✅' : '⚠️',
    weakPrereqs,
    allPrerequisites: prereqs,
  };
}

/**
 * Find all prerequisites for a topic.
 */
function findPrerequisites(topic, datasets) {
  const prereqs = [];

  // From knowledge_graph edges
  const kg = datasets?.knowledgeGraph;
  if (kg?.edges) {
    for (const edge of kg.edges) {
      if (edge.type === 'prerequisite') {
        const targetParts = (edge.targetId || '').split(':');
        const targetTopic = targetParts[targetParts.length - 1];
        if (targetTopic === topic) {
          const sourceParts = (edge.sourceId || '').split(':');
          const sourceTopic = sourceParts[sourceParts.length - 1];
          if (sourceTopic) prereqs.push(sourceTopic);
        }
      }
    }
  }

  // From weakness_profile prerequisite_order
  const wp = datasets?.weakProfile;
  if (wp?.domain_structure && prereqs.length === 0) {
    for (const [, data] of Object.entries(wp.domain_structure)) {
      const order = data.prerequisite_order || [];
      const idx = order.indexOf(topic);
      if (idx > 0) {
        for (let i = 0; i < idx; i++) {
          prereqs.push(order[i]);
        }
        break;
      }
    }
  }

  return prereqs;
}

/**
 * Explain future exam prediction probability.
 */
function explainPrediction(topic, domain, datasets) {
  let probability = 0;
  let source = '';

  // From prediction_2026
  const pred = datasets?.prediction2026;
  if (pred?.top_30_predictions) {
    const match = pred.top_30_predictions.find(p => p.topic === topic);
    if (match) {
      probability = match.prediction_probability_pct || 0;
      source = 'prediction_2026';
    }
  }

  // Fallback from trend analysis
  if (probability === 0) {
    const trend = datasets?.trendAnalysis?.topic_trends?.[topic];
    if (trend) {
      const recentBoost = (trend.recent_5yr || 0) / Math.max(1, (trend.total || 1)) * 30;
      const historicalBase = Math.min(60, ((trend.total || 0) / 24) * 10);
      probability = Math.min(95, Math.round(historicalBase + recentBoost));
      source = 'trend_analysis';
    }
  }

  if (probability === 0) {
    probability = 30; // default
  }

  let assessment;
  if (probability >= 60) {
    assessment = '매우 높음 — 반드시 학습 필요';
  } else if (probability >= 40) {
    assessment = '높음 — 학습 권장';
  } else if (probability >= 20) {
    assessment = '보통 — 기본 학습 필요';
  } else {
    assessment = '낮음 — 여유 있을 때 학습';
  }

  return {
    type: 'prediction',
    label: `${new Date().getFullYear() + (new Date().getMonth() >= 6 ? 1 : 0)} 출제확률`,
    value: `${probability}%`,
    detail: `데이터 기반 예측 (${source})`,
    severity: probability >= 60 ? '높음' : probability >= 40 ? '보통' : '낮음',
    importance: probability >= 50 ? 'high' : 'medium',
    icon: probability >= 60 ? '🔥' : probability >= 40 ? '📈' : '📊',
  };
}

/**
 * Explain difficulty level.
 */
function explainDifficulty(topic, domain, datasets) {
  let difficultyScore = 40;
  let difficultyCategory = 'medium';

  // From difficulty_database
  const diffDB = datasets?.difficultyDB;
  if (diffDB?.questions) {
    const matching = diffDB.questions.filter(q => q.topic === topic);
    if (matching.length > 0) {
      difficultyScore = matching.reduce((s, q) => s + (q.difficulty_score || 0), 0) / matching.length;
      const cats = {};
      for (const q of matching) {
        const cat = q.difficulty_category || 'medium';
        cats[cat] = (cats[cat] || 0) + 1;
      }
      difficultyCategory = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium';
    }
  }

  // Determine appropriateness
  let appropriateness;
  if (difficultyScore >= 30 && difficultyScore <= 60) {
    appropriateness = '적정 — 학습에 적합한 난이도';
  } else if (difficultyScore < 30) {
    appropriateness = '쉬움 — 기본 확인용';
  } else {
    appropriateness = '어려움 — 충분한 학습 후 도전';
  }

  return {
    type: 'difficulty',
    label: '난이도',
    value: getDifficultyLabel(difficultyScore),
    detail: `${difficultyScore.toFixed(0)}/100 (${appropriateness})`,
    severity: difficultyCategory,
    importance: difficultyScore >= 30 && difficultyScore <= 60 ? 'high' : 'medium',
    icon: difficultyScore >= 60 ? '💪' : difficultyScore >= 35 ? '📝' : '📖',
  };
}

/**
 * Get difficulty label from score.
 */
function getDifficultyLabel(score) {
  if (score >= 70) return '매우 어려움';
  if (score >= 55) return '어려움';
  if (score >= 40) return '보통';
  if (score >= 25) return '쉬움';
  return '매우 쉬움';
}

/**
 * Explain frequency/importance of the topic.
 */
function explainFrequency(topic, domain, datasets) {
  let totalAppearances = 0;
  let yearsActive = 0;
  let totalYears = 24;

  // From trend analysis
  const trend = datasets?.trendAnalysis?.topic_trends?.[topic];
  if (trend) {
    totalAppearances = trend.total || 0;
    yearsActive = trend.years_active || 0;
  }

  // From gold standard
  if (totalAppearances === 0) {
    const gs = datasets?.goldStandard;
    if (gs?.questions) {
      const matching = gs.questions.filter(q => q.topic === topic);
      totalAppearances = matching.length;
      yearsActive = new Set(matching.map(q => q.year)).size;
      totalYears = gs.year_range ? (gs.year_range.end - gs.year_range.start + 1) : 10;
    }
  }

  let frequencyAssessment;
  if (totalAppearances >= 30) {
    frequencyAssessment = '최상 빈도 — EJU 필수 주제';
  } else if (totalAppearances >= 15) {
    frequencyAssessment = '높은 빈도 — 주요 주제';
  } else if (totalAppearances >= 5) {
    frequencyAssessment = '보통 빈도 — 준수한 출제';
  } else {
    frequencyAssessment = '낮은 빈도 — 선택적 학습';
  }

  return {
    type: 'frequency',
    label: '출제 빈도',
    value: `${totalYears}년 중 ${yearsActive}년 출제 (${totalAppearances}문항)`,
    detail: frequencyAssessment,
    severity: totalAppearances >= 15 ? '높음' : totalAppearances >= 5 ? '보통' : '낮음',
    importance: totalAppearances >= 15 ? 'high' : totalAppearances >= 5 ? 'medium' : 'low',
    icon: totalAppearances >= 30 ? '🏆' : totalAppearances >= 15 ? '⭐' : '📌',
  };
}

/**
 * Explain domain balance contribution.
 */
function explainDomainBalance(topic, domain, datasets) {
  if (!domain) return null;

  // Calculate domain representation
  const trend = datasets?.trendAnalysis;
  const domainTrend = trend?.domain_trends?.[domain];

  if (!domainTrend) return null;

  const recentCount = domainTrend.recent_5yr_total || 0;
  const growthRate = domainTrend.growth_rate_pct || 0;

  let balanceAssessment;
  if (growthRate > 10) {
    balanceAssessment = '출제 비중 증가 추세 — 집중 필요';
  } else if (growthRate < -10) {
    balanceAssessment = '출제 비중 감소 추세';
  } else {
    balanceAssessment = '안정적인 출제 비중';
  }

  return {
    type: 'domain_balance',
    label: `${DOMAIN_LABELS[domain] || domain} 영역 동향`,
    value: balanceAssessment,
    detail: `최근 5년 ${recentCount}문항 출제`,
    severity: growthRate > 10 ? '증가' : growthRate < -10 ? '감소' : '안정',
    importance: growthRate > 10 ? 'high' : 'medium',
    icon: growthRate > 10 ? '📈' : growthRate < -10 ? '📉' : '➡️',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SUMMARY GENERATOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate a concise summary of all factors.
 */
function generateExplanationSummary(topic, factors) {
  const highFactors = factors.filter(f => f.importance === 'high');
  const mediumFactors = factors.filter(f => f.importance === 'medium');

  const parts = [];

  if (highFactors.length > 0) {
    const highReasons = highFactors.map(f => f.label).join(', ');
    parts.push(`'${topic}'을(를) 추천한 주요 이유: ${highReasons}`);
  }

  if (mediumFactors.length > 0) {
    parts.push(`추가 고려사항: ${mediumFactors.map(f => f.label).join(', ')}`);
  }

  return parts.join('. ');
}

// ═══════════════════════════════════════════════════════════════════════
// EXPLANATION FORMATTING
// ═══════════════════════════════════════════════════════════════════════

/**
 * Format explanation for display in the UI.
 */
export function formatExplanation(explanation) {
  if (!explanation) return null;

  return {
    title: `"${explanation.topic}"을 추천한 이유`,
    summary: explanation.summary,
    factors: explanation.factors.map(f => ({
      icon: f.icon,
      label: f.label,
      value: f.value,
      detail: f.detail,
      severity: f.severity,
      importance: f.importance,
    })),
  };
}

/**
 * Format explanation as simple lines for text display.
 */
export function formatExplanationAsLines(explanation) {
  if (!explanation || !explanation.factors) return [];

  return explanation.factors.map(f =>
    `- ${f.icon} ${f.label}: ${f.value} (${f.detail})`
  );
}

// ── Exports ────────────────────────────────────────────────────────────
export default {
  explainRecommendation,
  explainBatchRecommendations,
  formatExplanation,
  formatExplanationAsLines,
};
