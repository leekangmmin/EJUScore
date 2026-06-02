// ═══════════════════════════════════════════════════════════════════
// Root Cause Analysis (RCA) Engine
// For every mistake: determine root cause with probability scores.
// Possible causes: Knowledge Gap, Misreading, Vocabulary Deficiency,
//   Time Pressure, Calculation Error, Concept Confusion,
//   Question Misinterpretation, Pattern Recognition Failure,
//   Overconfidence, Guessing Bias
// ═══════════════════════════════════════════════════════════════════

import { classifySubject } from '../utils/subjectClassifier';
import { analyzeTemporalTrends } from './weaknessEngine';

const ROOT_CAUSE_TYPES = {
  knowledgeGap: {
    id: 'knowledgeGap',
    label: 'Knowledge Gap',
    labelKo: '지식 격차',
    description: '해당 개념에 대한 학습이 부족하거나 누락됨',
  },
  misreading: {
    id: 'misreading',
    label: 'Misreading',
    labelKo: '문제 오독',
    description: '문제의 조건이나 질문을 잘못 읽음',
  },
  vocabularyDeficiency: {
    id: 'vocabularyDeficiency',
    label: 'Vocabulary Deficiency',
    labelKo: '어휘 부족',
    description: '일본어 어휘/표현 이해 부족으로 내용 파악 실패',
  },
  timePressure: {
    id: 'timePressure',
    label: 'Time Pressure',
    labelKo: '시간 압박',
    description: '시간 부족으로 충분한 사고 없이 선택함',
  },
  calculationError: {
    id: 'calculationError',
    label: 'Calculation Error',
    labelKo: '계산 실수',
    description: '숫자 계산 과정에서 실수가 발생함',
  },
  conceptConfusion: {
    id: 'conceptConfusion',
    label: 'Concept Confusion',
    labelKo: '개념 혼동',
    description: '유사 개념을 혼동하여 잘못된 선택을 함',
  },
  questionMisinterpretation: {
    id: 'questionMisinterpretation',
    label: 'Question Misinterpretation',
    labelKo: '문제 해석 오류',
    description: '문제의 의도나 요구를 다르게 해석함',
  },
  patternRecognitionFailure: {
    id: 'patternRecognitionFailure',
    label: 'Pattern Recognition Failure',
    labelKo: '패턴 인식 실패',
    description: '자료(그래프/표)의 패턴을 올바르게 인식하지 못함',
  },
  overconfidence: {
    id: 'overconfidence',
    label: 'Overconfidence',
    labelKo: '과신',
    description: '자신의 답에 지나치게 확신하여 검토를 생략함',
  },
  guessingBias: {
    id: 'guessingBias',
    label: 'Guessing Bias',
    labelKo: '추측 편향',
    description: '특정 선택지에 편향된 추측 패턴을 보임',
  },
};

/**
 * Analyze root cause for a single mistake/question.
 *
 * @param {object} mistake - Mistake data
 * @param {object} context - Context including related mistakes, question data
 * @returns {object} RootCauseAnalysis with probabilities
 */
export function analyzeSingleMistake(mistake, context = {}) {
  const causes = {
    knowledgeGap: 0,
    misreading: 0,
    vocabularyDeficiency: 0,
    timePressure: 0,
    calculationError: 0,
    conceptConfusion: 0,
    questionMisinterpretation: 0,
    patternRecognitionFailure: 0,
    overconfidence: 0,
    guessingBias: 0,
  };

  const memo = (mistake.memo || '').toLowerCase();
  const errorType = (mistake.errorType || '').toLowerCase();
  const domain = mistake.domain || 'unknown';
  const source = mistake.source || '';

  // ── Signal analysis ──────────────────────────────────────

  // Signal: Error type indicators
  if (errorType.includes('실수') || errorType.includes('mistake') || errorType.includes('careless')) {
    causes.misreading += 0.5;
    causes.overconfidence += 0.2;
  }
  if (errorType.includes('정보부족') || errorType.includes('knowledge') || errorType.includes('lack')) {
    causes.knowledgeGap += 0.7;
  }
  if (errorType.includes('연계사고') || errorType.includes('연계') || errorType.includes('connection')) {
    causes.conceptConfusion += 0.6;
    causes.patternRecognitionFailure += 0.2;
  }

  // Signal: Domain-specific patterns
  if (domain === 'japanese_reading' || domain === 'japanese_listening') {
    causes.vocabularyDeficiency += 0.4;

    // Last section mistakes → time pressure
    if (mistake.questionNumber >= 20 && source === 'japanese_reading') {
      causes.timePressure += 0.4;
    }
    if (mistake.questionNumber >= 35 && source === 'japanese_listening') {
      causes.timePressure += 0.4;
    }
  }

  // Signal: Mathematical/economy calculation errors
  if (domain === 'economy' && (memo.match(/[\d]|계산|숫자|수치|rate|percent|%/))) {
    causes.calculationError += 0.5;
    causes.patternRecognitionFailure += 0.2;
  }

  // Signal: Graph/chart related errors
  if (memo.includes('그래프') || memo.includes('graph') || memo.includes('도표') || memo.includes('chart')) {
    causes.patternRecognitionFailure += 0.6;
    causes.questionMisinterpretation += 0.2;
  }

  // Signal: Comparison/concept confusion
  if (memo.includes('비교') || memo.includes('차이') || memo.includes('구분') ||
      memo.includes('혼동') || memo.includes('confuse') || memo.includes('difference')) {
    causes.conceptConfusion += 0.5;
    causes.questionMisinterpretation += 0.2;
  }

  // Signal: Context-specific
  if (mistake.context === 'listening' && memo.includes('몰랐')) {
    causes.vocabularyDeficiency += 0.3;
  }

  // Signal: Repeated same-topic mistakes → knowledge gap
  if (context.similarMistakes && context.similarMistakes >= 2) {
    causes.knowledgeGap += 0.2 * Math.min(3, context.similarMistakes);
  }

  // Signal: Question at end of exam → time pressure boost
  if (context.isAtEnd) {
    causes.timePressure += 0.3;
  }

  // Signal: Wrong answer distribution suggests guessing bias
  if (context.guessingPatterns && context.guessingPatterns.length >= 3) {
    causes.guessingBias += 0.3;
  }

  // ── Normalize probabilities ────────────────────────────
  const total = Object.values(causes).reduce((a, b) => a + b, 0) || 1;
  const normalized = {};
  for (const [cause, score] of Object.entries(causes)) {
    normalized[cause] = Math.round((score / total) * 100);
  }

  // Primary cause
  const primaryCause = Object.entries(normalized)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'knowledgeGap';

  return {
    questionId: mistake.questionId || '',
    examId: mistake.examId || '',
    questionNumber: mistake.questionNumber || 0,
    causes: normalized,
    primaryCause,
    primaryCauseLabel: ROOT_CAUSE_TYPES[primaryCause]?.labelKo || primaryCause,
    explanation: generateRootCauseExplanation(primaryCause, mistake, normalized),
    tutorExplanation: null, // Filled by AI Tutor
  };
}

/**
 * Analyze all mistakes in an exam to find root cause patterns.
 *
 * @param {Array} mistakes - All mistakes from an exam
 * @param {object} studentProfile - Student's weakness profile
 * @returns {Array<object>} Root cause analyses
 */
export function analyzeBatchRootCauses(mistakes, studentProfile = null) {
  // Build context for each mistake
  const topicCounts = {};
  for (const m of mistakes) {
    const key = m.topic || m.domain || 'unknown';
    topicCounts[key] = (topicCounts[key] || 0) + 1;
  }

  const analyses = mistakes.map((m, index, arr) => {
    const topicKey = m.topic || m.domain || 'unknown';
    const domainMistakes = arr.filter(
      other => (other.topic || other.domain) === topicKey
    );

    // Is this question in the last section?
    const isAtEnd = m.source === 'japanese_reading'
      ? m.questionNumber >= 22
      : m.source === 'japanese_listening'
        ? m.questionNumber >= 35
        : false;

    return analyzeSingleMistake(m, {
      similarMistakes: domainMistakes.length,
      isAtEnd,
      guessingPatterns: findGuessingPatterns(arr, m),
    });
  });

  return analyses;
}

/**
 * Find guessing patterns (e.g., always choosing option 2 or 3).
 */
function findGuessingPatterns(allMistakes, currentMistake) {
  // In production, analyze actual answer choices
  // For now, return empty unless we have answer data
  return [];
}

/**
 * Generate human-readable explanation for root cause.
 */
function generateRootCauseExplanation(primaryCause, mistake, causes) {
  const causeInfo = ROOT_CAUSE_TYPES[primaryCause];
  if (!causeInfo) return '';

  const questionRef = mistake.questionNumber
    ? `${mistake.questionNumber}번 문제`
    : '이 문제';

  const causeDescriptions = {
    knowledgeGap: `${questionRef}에서 요구하는 개념에 대한 학습이 부족했습니다. 관련 단원을 다시 학습할 필요가 있습니다.`,
    misreading: `${questionRef}의 조건이나 지문을 정확히 읽지 못했습니다. 문제를 천천히 다시 읽어보세요.`,
    vocabularyDeficiency: `${questionRef}에서 사용된 일본어 어휘를 이해하지 못해 내용 파악이 어려웠습니다.`,
    timePressure: `${questionRef}는 시간 부족으로 충분히 생각하지 못하고 답을 선택했을 가능성이 높습니다.`,
    calculationError: `${questionRef}의 계산 과정에서 실수가 발생했습니다. 계산 단계를 꼼꼼히 확인하세요.`,
    conceptConfusion: `${questionRef}에서 유사 개념을 혼동하여 잘못된 선택을 했습니다. 두 개념의 차이점을 정리하세요.`,
    questionMisinterpretation: `${questionRef}의 의도나 요구사항을 다르게 해석했습니다. 문제가 정말 묻는 것이 무엇인지 다시 파악하세요.`,
    patternRecognitionFailure: `${questionRef}의 자료(그래프/표)에서 패턴을 올바르게 읽지 못했습니다.`,
    overconfidence: `${questionRef}를 너무 쉽게 생각하고 검토를 생략했을 수 있습니다. 항상 검토 습관을 들이세요.`,
    guessingBias: `${questionRef}에서 특정 선택지에 편향된 추측을 했습니다.`,
  };

  return causeDescriptions[primaryCause] || `${questionRef}의 오답 원인을 분석 중입니다.`;
}

/**
 * Get aggregate root cause distribution across all mistakes.
 * Returns the distribution of primary causes.
 */
export function getAggregateRootCauses(analyses) {
  if (!analyses || analyses.length === 0) return [];

  const causeCounts = {};
  for (const analysis of analyses) {
    const primary = analysis.primaryCause;
    causeCounts[primary] = (causeCounts[primary] || 0) + 1;
  }

  const total = analyses.length;
  return Object.entries(causeCounts)
    .map(([cause, count]) => ({
      cause,
      label: ROOT_CAUSE_TYPES[cause]?.labelKo || cause,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export { ROOT_CAUSE_TYPES };
export default { analyzeSingleMistake, analyzeBatchRootCauses, getAggregateRootCauses };
