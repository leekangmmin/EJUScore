// ═══════════════════════════════════════════════════════════════════
// Learning Science Engine — Evidence-Based Study Optimization
// Implements:
//   - Forgetting curve analysis (Ebbinghaus)
//   - Spaced repetition scheduling
//   - Mastery score tracking
//   - Retention score prediction
//   - Learning velocity measurement
//   - Burnout detection
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate forgetting curve value using Ebbinghaus formula.
 * R(t) = e^(-t/S) where R is retention, t is time, S is stability.
 *
 * @param {number} hoursSinceLastReview - Hours elapsed
 * @param {number} stability - Memory stability factor (higher = slower forgetting)
 * @returns {number} Retention probability (0-1)
 */
export function forgettingCurve(hoursSinceLastReview, stability = 1.0) {
  if (hoursSinceLastReview <= 0) return 1.0;
  // Ebbinghaus: R = e^(-t / (S * 24)) where S is days of stability
  return Math.exp(-hoursSinceLastReview / (stability * 24));
}

/**
 * Calculate optimal review interval based on mastery level.
 * Uses expanding intervals: 1 day → 3 days → 1 week → 2 weeks → 1 month
 *
 * @param {number} masteryLevel - Current mastery (0-1)
 * @param {number} reviewCount - Number of previous reviews
 * @returns {object} { nextReviewHours, nextReviewDate, interval }
 */
export function calculateNextReview(masteryLevel, reviewCount) {
  // Base intervals in hours
  const intervals = [4, 8, 24, 72, 168, 336, 720]; // 4h, 8h, 1d, 3d, 1w, 2w, 1m

  // Adjust based on mastery
  const masteryIndex = Math.floor((1 - masteryLevel) * (intervals.length - 1));
  const baseInterval = intervals[Math.min(masteryIndex, intervals.length - 1)];

  // Adjust based on review count (spacing effect)
  const reviewMultiplier = Math.min(2, 1 + reviewCount * 0.1);
  const interval = Math.round(baseInterval * reviewMultiplier);

  return {
    nextReviewHours: interval,
    nextReviewDate: new Date(Date.now() + interval * 3600000).toISOString(),
    interval,
  };
}

/**
 * Calculate mastery score for a topic based on performance history.
 * Uses weighted average with recency bias.
 *
 * @param {Array} attempts - Array of { correct: boolean, timestamp }
 * @returns {number} Mastery score (0-1)
 */
export function calculateMastery(attempts) {
  if (!attempts || attempts.length === 0) return 0;

  const now = Date.now();
  const recentWeight = 0.6;
  const olderWeight = 0.4;

  let recentCorrect = 0;
  let recentTotal = 0;
  let olderCorrect = 0;
  let olderTotal = 0;

  const recentPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days

  for (const attempt of attempts) {
    const isRecent = (now - (attempt.timestamp || now)) < recentPeriod;
    if (isRecent) {
      recentTotal++;
      if (attempt.correct) recentCorrect++;
    } else {
      olderTotal++;
      if (attempt.correct) olderCorrect++;
    }
  }

  const recentScore = recentTotal > 0 ? recentCorrect / recentTotal : 0;
  const olderScore = olderTotal > 0 ? olderCorrect / olderTotal : 0;

  if (recentTotal === 0) return olderScore;
  if (olderTotal === 0) return recentScore;

  return (recentScore * recentWeight + olderScore * olderWeight);
}

/**
 * Calculate retention score at a given point in time.
 *
 * @param {number} mastery - Current mastery (0-1)
 * @param {number} hoursSinceReview - Hours since last review
 * @param {number} averageInterval - Average review interval in hours
 * @returns {number} Retention score (0-1)
 */
export function calculateRetention(mastery, hoursSinceReview, averageInterval = 24) {
  // Stability grows with mastery and consistent review
  const stability = 1 + mastery * 3 + (averageInterval / 24) * 0.5;
  const retention = forgettingCurve(hoursSinceReview, stability);

  return Math.max(0, Math.min(1, retention));
}

/**
 * Calculate learning velocity (rate of mastery improvement).
 *
 * @param {Array} masteryHistory - Array of { mastery: number, date: string }
 * @returns {object} { velocity, trend, projectedMastery }
 */
export function calculateLearningVelocity(masteryHistory) {
  if (!masteryHistory || masteryHistory.length < 2) {
    return { velocity: 0, trend: 'stable', projectedMastery: null };
  }

  const sorted = [...masteryHistory].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const daysDiff = (new Date(last.date) - new Date(first.date)) / (24 * 3600 * 1000);
  const masteryDiff = last.mastery - first.mastery;

  const velocity = daysDiff > 0 ? masteryDiff / daysDiff : 0;

  // Trend
  const trend = velocity > 0.02 ? 'improving' : velocity < -0.01 ? 'declining' : 'stable';

  // Projected mastery (30 days from now)
  const projectedMastery = Math.min(1, Math.max(0, last.mastery + velocity * 30));

  return {
    velocity: parseFloat(velocity.toFixed(4)),
    trend,
    projectedMastery: parseFloat(projectedMastery.toFixed(3)),
    improvementRate: `${(velocity * 30 * 100).toFixed(1)}%/월`,
  };
}

/**
 * Detect learning burnout based on performance pattern.
 *
 * @param {Array} performanceHistory - Array of { date, score, effort }
 * @returns {object} { risk, score, warningSigns }
 */
export function detectBurnout(performanceHistory) {
  if (!performanceHistory || performanceHistory.length < 3) {
    return { risk: 'low', score: 0, warningSigns: [] };
  }

  const warningSigns = [];
  let burnoutScore = 0;

  const sorted = [...performanceHistory].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  // Sign 1: Declining performance despite consistent effort
  const recentScores = sorted.slice(-3).map(s => s.score || 0);
  if (recentScores.length >= 3) {
    const declining = recentScores[2] < recentScores[0] && recentScores[1] <= recentScores[0];
    if (declining) {
      warningSigns.push('점수 하락 추세 (3회 연속)');
      burnoutScore += 3;
    }
  }

  // Sign 2: Increasing effort with decreasing returns
  if (sorted.length >= 4) {
    const recent = sorted.slice(-4);
    const effortIncreasing = recent[3].effort > recent[0].effort * 1.3;
    const scoreDecreasing = (recent[3].score || 0) < (recent[0].score || 0);
    if (effortIncreasing && scoreDecreasing) {
      warningSigns.push('노력 대비 성과 정체');
      burnoutScore += 3;
    }
  }

  // Sign 3: High study density (many consecutive days)
  if (sorted.length >= 7) {
    const dates = sorted.map(s => new Date(s.date).toDateString());
    const uniqueDates = new Set(dates);
    if (uniqueDates.size >= 5) {
      warningSigns.push('높은 학습 밀도 (휴식일 부족)');
      burnoutScore += 2;
    }
  }

  // Sign 4: Score volatility
  if (sorted.length >= 5) {
    const scores = sorted.map(s => s.score || 0).filter(s => s > 0);
    if (scores.length >= 5) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev > mean * 0.3) {
        warningSigns.push('점수 변동성 높음');
        burnoutScore += 1;
      }
    }
  }

  const risk = burnoutScore >= 5 ? 'high' : burnoutScore >= 3 ? 'medium' : 'low';

  return { risk, score: burnoutScore, warningSigns };
}

/**
 * Generate a personalized spaced repetition schedule.
 *
 * @param {Array} topics - Array of { id, label, mastery, reviewCount, lastReviewDate }
 * @param {number} availableHoursPerWeek - Hours available for study
 * @returns {object} Schedule with daily review items
 */
export function generateSpacedRepetitionSchedule(topics, availableHoursPerWeek = 10) {
  if (!topics || topics.length === 0) {
    return { schedule: [], totalReviews: 0, estimatedMinutes: 0 };
  }

  const now = Date.now();
  const schedule = [];

  for (const topic of topics) {
    const lastReview = topic.lastReviewDate ? new Date(topic.lastReviewDate).getTime() : 0;
    const hoursSinceReview = (now - lastReview) / 3600000;

    const retention = calculateRetention(topic.mastery || 0, hoursSinceReview);
    const nextReview = calculateNextReview(topic.mastery || 0, topic.reviewCount || 0);

    // Priority = low retention items reviewed sooner
    const priority = Math.max(0, 1 - retention);

    schedule.push({
      topicId: topic.id,
      topicLabel: topic.label,
      mastery: topic.mastery || 0,
      retention: parseFloat(retention.toFixed(3)),
      hoursSinceReview: Math.round(hoursSinceReview),
      nextReviewInHours: nextReview.nextReviewHours,
      priority: parseFloat(priority.toFixed(3)),
      suggestedDuration: Math.round(10 + (1 - (topic.mastery || 0)) * 20), // 10-30 minutes
      needsReview: retention < 0.6 || hoursSinceReview >= nextReview.nextReviewHours,
    });
  }

  // Sort by priority (high to low) and then by need for review
  schedule.sort((a, b) => {
    if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1;
    return b.priority - a.priority;
  });

  // Limit to available time
  const availableMinutes = availableHoursPerWeek * 60;
  let totalMinutes = 0;
  const finalSchedule = [];

  for (const item of schedule) {
    if (totalMinutes + item.suggestedDuration <= availableMinutes) {
      finalSchedule.push(item);
      totalMinutes += item.suggestedDuration;
    }
  }

  return {
    schedule: finalSchedule,
    totalReviews: finalSchedule.length,
    estimatedMinutes: totalMinutes,
    averageRetention: finalSchedule.length > 0
      ? parseFloat(finalSchedule.reduce((s, i) => s + i.retention, 0) / finalSchedule.length).toFixed(3)
      : 0,
  };
}

/**
 * Calculate optimal study session duration based on attention span research.
 *
 * @param {number} studyStreak - Days of consecutive study
 * @param {number} fatigueLevel - Current fatigue (0-1)
 * @returns {object} { recommendedMinutes, breakMinutes, focusTechnique }
 */
export function calculateOptimalSession(studyStreak = 0, fatigueLevel = 0) {
  // Pomodoro-based optimization
  const baseDuration = 25; // Base pomodoro
  const breakDuration = 5;

  // Adjust for streak (longer sessions for consistent learners)
  const streakBonus = Math.min(10, studyStreak * 0.5);
  const fatiguePenalty = fatigueLevel * 10;

  const recommendedMinutes = Math.round(Math.max(15, baseDuration + streakBonus - fatiguePenalty));

  return {
    recommendedMinutes,
    breakMinutes: breakDuration,
    focusTechnique: recommendedMinutes <= 25 ? 'standard_pomodoro' : 'extended_focus',
    sessionsBeforeBreak: 4,
    dailyLimit: Math.round(120 * (1 - fatigueLevel * 0.3)),
  };
}

export default {
  forgettingCurve,
  calculateNextReview,
  calculateMastery,
  calculateRetention,
  calculateLearningVelocity,
  detectBurnout,
  generateSpacedRepetitionSchedule,
  calculateOptimalSession,
};
