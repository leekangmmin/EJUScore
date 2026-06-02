// ═══════════════════════════════════════════════════════════════════
// Weakness Intelligence Engine — Deep Analysis of Student Mistakes
// Answers: WHY does this student keep making mistakes?
// Detects: recurring concepts, question types, keywords, reasoning failures
// ═══════════════════════════════════════════════════════════════════

import { classifySubject } from '../utils/subjectClassifier';

/**
 * Analyze all historical exam data to produce a comprehensive weakness profile.
 *
 * @param {Array} exams - All exam records
 * @param {Array} questions - All OCR-imported QuestionObjects
 * @returns {object} WeaknessProfile
 */
export function analyzeWeaknesses(exams, questions) {
  const profile = {
    id: `wp_${Date.now()}`,
    studentId: 'default',
    generatedAt: new Date().toISOString(),
    rootCauses: [],
    recurringConcepts: [],
    recurringQuestionTypes: [],
    recurringKeywords: [],
    recurringSubjects: [],
    recurringReasoningFailures: [],
    domainWeakness: {},
    temporalTrends: {},
    analysis: '',
    recommendations: [],
  };

  // Collect all mistakes across exams
  const allMistakes = collectMistakes(exams, questions);

  if (allMistakes.length === 0) {
    profile.analysis = '아직 충분한 오답 데이터가 없습니다. 더 많은 시험을 추가하면 정확한 분석이 가능합니다.';
    return profile;
  }

  // 1. Recurring concept analysis
  profile.recurringConcepts = analyzeRecurringConcepts(allMistakes);

  // 2. Recurring question type analysis
  profile.recurringQuestionTypes = analyzeRecurringTypes(allMistakes);

  // 3. Recurring keyword analysis
  profile.recurringKeywords = analyzeRecurringKeywords(allMistakes);

  // 4. Recurring subject/domain analysis
  profile.recurringSubjects = analyzeRecurringDomains(allMistakes);
  profile.recurringReasoningFailures = analyzeReasoningFailures(allMistakes);

  // 5. Domain-level weakness scores
  profile.domainWeakness = computeDomainWeaknessScores(allMistakes);

  // 6. Temporal trends (how weaknesses evolve over time)
  profile.temporalTrends = analyzeTemporalTrends(allMistakes);

  // 7. Root cause analysis
  profile.rootCauses = computeRootCauses(allMistakes, profile);

  // 8. Natural language analysis summary
  profile.analysis = generateAnalysisSummary(profile);

  // 9. Actionable recommendations
  profile.recommendations = generateWeaknessRecommendations(profile);

  return profile;
}

/**
 * Collect all mistakes from exams and questions into a unified format.
 */
function collectMistakes(exams, questions) {
  const mistakes = [];

  // From exam.comprehensive.mistakes
  for (const exam of (exams || [])) {
    const compMistakes = exam.comprehensive?.mistakes || [];
    for (const m of compMistakes) {
      mistakes.push({
        source: 'exam',
        examId: exam.id,
        examDate: exam.date,
        questionNumber: m.questionNumber,
        domain: classifySubject(m.memo || '') || m.unit,
        errorType: m.errorType,
        memo: m.memo || '',
        context: m.unit || '',
      });
    }

    // From japanese wrong questions
    const jap = exam.japanese;
    if (jap?.wrongQuestions) {
      for (const q of (jap.wrongQuestions.reading || [])) {
        mistakes.push({
          source: 'japanese_reading',
          examId: exam.id,
          examDate: exam.date,
          questionNumber: q,
          domain: 'japanese_reading',
          errorType: jap.wrongMemos?.[`r${q}`] || 'unknown',
          memo: jap.wrongMemos?.[`r${q}`] || '',
          context: 'reading',
        });
      }
      for (const q of (jap.wrongQuestions.listening || [])) {
        mistakes.push({
          source: 'japanese_listening',
          examId: exam.id,
          examDate: exam.date,
          questionNumber: q,
          domain: 'japanese_listening',
          errorType: jap.wrongMemos?.[`l${q}`] || 'unknown',
          memo: jap.wrongMemos?.[`l${q}`] || '',
          context: 'listening',
        });
      }
    }
  }

  // From OCR-imported questions with incorrect answers
  for (const q of (questions || [])) {
    if (q.isCorrect === false) {
      mistakes.push({
        source: 'ocr_question',
        examId: q.examId,
        examDate: q.metadata?.year ? String(q.metadata.year) : '',
        questionNumber: q.number,
        domain: q.domain || 'unknown',
        errorType: q.errorAnalysis?.primaryCause || 'unknown',
        memo: q.errorAnalysis?.explanation || q.cleanedText?.slice(0, 100) || '',
        context: q.topic || '',
        topic: q.topic,
        errorAnalysis: q.errorAnalysis,
      });
    }
  }

  return mistakes;
}

/**
 * Analyze recurring concepts that appear across multiple mistakes.
 */
function analyzeRecurringConcepts(mistakes) {
  const conceptFrequency = {};

  for (const m of mistakes) {
    const concepts = extractConceptsFromText(m.memo || '');

    for (const concept of concepts) {
      if (!conceptFrequency[concept]) {
        conceptFrequency[concept] = { count: 0, examples: [], domains: new Set(), timeline: [] };
      }
      conceptFrequency[concept].count++;
      conceptFrequency[concept].examples.push(m.memo);
      conceptFrequency[concept].domains.add(m.domain);
      conceptFrequency[concept].timeline.push(m.examDate);
    }
  }

  return Object.entries(conceptFrequency)
    .map(([concept, data]) => ({
      concept,
      count: data.count,
      frequency: data.count / Math.max(1, mistakes.length),
      domains: [...data.domains],
      firstSeen: [...data.timeline].sort()[0] || '',
      lastSeen: [...data.timeline].sort().reverse()[0] || '',
      examples: data.examples.slice(0, 3),
    }))
    .filter(item => item.count >= 2) // At least 2 occurrences
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

/**
 * Analyze recurring question types.
 */
function analyzeRecurringTypes(mistakes) {
  const typeFrequency = {};

  for (const m of mistakes) {
    const type = m.errorType || 'unknown';
    if (!typeFrequency[type]) {
      typeFrequency[type] = { count: 0, examples: [], domains: new Set() };
    }
    typeFrequency[type].count++;
    typeFrequency[type].examples.push(m.memo);
    typeFrequency[type].domains.add(m.domain);
  }

  return Object.entries(typeFrequency)
    .map(([type, data]) => ({
      type,
      count: data.count,
      percentage: (data.count / Math.max(1, mistakes.length)) * 100,
      domains: [...data.domains],
      examples: data.examples.slice(0, 3),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Analyze recurring keywords in mistake descriptions.
 */
function analyzeRecurringKeywords(mistakes) {
  const keywordFrequency = {};
  const stopwords = new Set(['the', 'a', 'an', '이', '그', '저', '수', '것', '등', '및', '의', '에', '를', '을', '은', '는', '과', '와', '에서', '하다']);

  for (const m of mistakes) {
    const text = `${m.memo || ''} ${m.context || ''}`;
    const words = text.split(/[\s,，.．、。()（）「」【】\n\r]+/).filter(w => w.length >= 2 && !stopwords.has(w));

    for (const word of words) {
      if (!keywordFrequency[word]) {
        keywordFrequency[word] = { count: 0, domains: new Set() };
      }
      keywordFrequency[word].count++;
      keywordFrequency[word].domains.add(m.domain);
    }
  }

  return Object.entries(keywordFrequency)
    .map(([keyword, data]) => ({
      keyword,
      count: data.count,
      domains: [...data.domains],
    }))
    .filter(item => item.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

/**
 * Analyze recurring domains/subjects where mistakes happen.
 */
function analyzeRecurringDomains(mistakes) {
  const domainFrequency = {};

  for (const m of mistakes) {
    const domain = m.domain || 'unknown';
    if (!domainFrequency[domain]) {
      domainFrequency[domain] = { count: 0, mistakeTypes: {}, questions: new Set() };
    }
    domainFrequency[domain].count++;
    domainFrequency[domain].mistakeTypes[m.errorType || 'unknown'] =
      (domainFrequency[domain].mistakeTypes[m.errorType || 'unknown'] || 0) + 1;
    domainFrequency[domain].questions.add(m.questionNumber);
  }

  return Object.entries(domainFrequency)
    .map(([domain, data]) => ({
      domain,
      count: data.count,
      percentage: (data.count / Math.max(1, mistakes.length)) * 100,
      dominantMistakeType: Object.entries(data.mistakeTypes)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || '',
      uniqueQuestions: data.questions.size,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Analyze reasoning failures — patterns in how the student reasons.
 */
function analyzeReasoningFailures(mistakes) {
  const reasoningPatterns = [];

  // Pattern 1: Consistent errors in graph interpretation
  const graphErrors = mistakes.filter(m =>
    (m.memo || '').toLowerCase().includes('graph') ||
    (m.memo || '').includes('그래프') ||
    (m.memo || '').includes('도표')
  );

  if (graphErrors.length >= 2) {
    reasoningPatterns.push({
      pattern: 'graph_misinterpretation',
      label: '그래프·도표 해석 오류',
      count: graphErrors.length,
      description: '그래프나 도표의 데이터를 읽거나 해석하는 과정에서 일관된 오류 발생',
      examples: graphErrors.slice(0, 3).map(m => m.memo),
    });
  }

  // Pattern 2: Consistent comparative reasoning errors
  const comparisonErrors = mistakes.filter(m =>
    (m.memo || '').includes('비교') ||
    (m.memo || '').includes('대비') ||
    (m.memo || '').includes('vs') ||
    m.memo?.includes('연계')
  );

  if (comparisonErrors.length >= 2) {
    reasoningPatterns.push({
      pattern: 'comparative_reasoning',
      label: '비교·연계 사고 부족',
      count: comparisonErrors.length,
      description: '둘 이상의 개념이나 사건을 비교·연결하는 추론 과정에서 오류 발생',
      examples: comparisonErrors.slice(0, 3).map(m => m.memo),
    });
  }

  // Pattern 3: Time pressure errors (questions at end of section)
  if (mistakes.length >= 10) {
    const lastQuarterMistakes = mistakes
      .filter(m => m.source === 'japanese_reading' || m.source === 'japanese_listening')
      .filter(m => {
        if (m.source === 'japanese_reading') return m.questionNumber >= 20;
        if (m.source === 'japanese_listening') return m.questionNumber >= 32;
        return false;
      });

    if (lastQuarterMistakes.length >= 3) {
      reasoningPatterns.push({
        pattern: 'time_pressure',
        label: '시간 압박 오류',
        count: lastQuarterMistakes.length,
        description: '시험 후반부에 집중된 오답 — 시간 관리 및 속도 향상 필요',
        examples: lastQuarterMistakes.slice(0, 3).map(m => `#${m.questionNumber}번`),
      });
    }
  }

  // Pattern 4: Knowledge gap (same topic across multiple exams)
  const topicClusters = {};
  for (const m of mistakes) {
    if (m.topic || m.context) {
      const key = m.topic || m.context;
      if (!topicClusters[key]) topicClusters[key] = [];
      topicClusters[key].push(m);
    }
  }

  for (const [topic, ms] of Object.entries(topicClusters)) {
    const uniqueExams = new Set(ms.map(m => m.examId));
    if (uniqueExams.size >= 2 && ms.length >= 2) {
      reasoningPatterns.push({
        pattern: 'knowledge_gap',
        label: `'${topic}' 지식 격차`,
        count: ms.length,
        description: `${uniqueExams.size}회 시험에 걸쳐 '${topic}' 관련 문제 반복 오답`,
        examples: ms.slice(0, 3).map(m => `${m.examDate || ''} ${m.questionNumber}번`),
      });
    }
  }

  return reasoningPatterns;
}

/**
 * Compute domain-level weakness scores (0-1).
 */
function computeDomainWeaknessScores(mistakes) {
  const scores = {};
  const domainMistakes = {};

  for (const m of mistakes) {
    const domain = m.domain || 'unknown';
    if (!domainMistakes[domain]) domainMistakes[domain] = [];
    domainMistakes[domain].push(m);
  }

  for (const [domain, ms] of Object.entries(domainMistakes)) {
    const recencyWeighted = ms.map(m => {
      // Weight recent mistakes more heavily
      let weight = 1;
      if (m.examDate) {
        try {
          const examDate = new Date(m.examDate);
          const monthsAgo = (Date.now() - examDate.getTime()) / (30 * 24 * 60 * 60 * 1000);
          weight = Math.max(0.5, 1 - monthsAgo * 0.05);
        } catch { /* default weight */ }
      }
      return weight;
    });

    const totalWeight = recencyWeighted.reduce((a, b) => a + b, 0);
    const maxPossibleWeight = ms.length * 1.0;

    scores[domain] = {
      weaknessScore: Math.min(1, totalWeight / Math.max(1, maxPossibleWeight * 0.5)),
      totalMistakes: ms.length,
      recentMistakes: ms.filter(m => {
        if (!m.examDate) return false;
        try {
          const monthsAgo = (Date.now() - new Date(m.examDate).getTime()) / (30 * 24 * 60 * 60 * 1000);
          return monthsAgo <= 6;
        } catch { return false; }
      }).length,
      dominantErrorType: Object.entries(
        ms.reduce((acc, m) => { acc[m.errorType] = (acc[m.errorType] || 0) + 1; return acc; }, {})
      ).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    };
  }

  return scores;
}

/**
 * Analyze how weaknesses evolve over time.
 */
function analyzeTemporalTrends(mistakes) {
  const trends = {};
  const sorted = [...mistakes].sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));

  for (const m of sorted) {
    const domain = m.domain || 'unknown';
    const year = String(m.examDate).slice(0, 4) || 'unknown';
    if (!trends[domain]) trends[domain] = {};
    if (!trends[domain][year]) trends[domain][year] = 0;
    trends[domain][year]++;
  }

  // Compute change direction
  const result = {};
  for (const [domain, yearly] of Object.entries(trends)) {
    const years = Object.entries(yearly).sort(([a], [b]) => a.localeCompare(b));
    const firstHalf = years.slice(0, Math.floor(years.length / 2));
    const secondHalf = years.slice(Math.floor(years.length / 2));

    const firstCount = firstHalf.reduce((s, [, c]) => s + c, 0);
    const secondCount = secondHalf.reduce((s, [, c]) => s + c, 0);

    result[domain] = {
      yearly,
      trend: secondCount > firstCount ? 'worsening' : secondCount < firstCount ? 'improving' : 'stable',
      firstHalfCount: firstCount,
      secondHalfCount: secondCount,
    };
  }

  return result;
}

/**
 * Compute root causes from mistake patterns.
 */
function computeRootCauses(mistakes, profile) {
  const causeScores = {};

  // GPT-based root cause scoring from mistake patterns
  // Each pattern maps to one or more root causes

  // Knowledge Gap: repeated mistakes on same topic across exams
  const topicRepeats = profile.recurringConcepts.filter(c => c.count >= 2);
  causeScores.knowledgeGap = Math.min(1, topicRepeats.length * 0.15 +
    profile.recurringReasoningFailures
      .filter(r => r.pattern === 'knowledge_gap')
      .reduce((s, r) => s + r.count * 0.05, 0));

  // Misreading: mistakes noted as '실수' or misread
  const misreadMistakes = mistakes.filter(m =>
    m.errorType === '실수' || (m.memo || '').includes('실수') ||
    (m.memo || '').includes('misread') || (m.memo || '').includes('오독')
  );
  causeScores.misreading = Math.min(1, misreadMistakes.length * 0.1);

  // Vocabulary Deficiency: Japanese reading/listening mistakes
  const vocabMistakes = mistakes.filter(m =>
    m.source === 'japanese_reading' || m.source === 'japanese_listening'
  );
  causeScores.vocabularyDeficiency = Math.min(1, vocabMistakes.length * 0.08);

  // Time Pressure: mistakes clustering at section ends
  causeScores.timePressure = Math.min(1,
    profile.recurringReasoningFailures
      .filter(r => r.pattern === 'time_pressure')
      .reduce((s, r) => s + r.count * 0.1, 0));

  // Calculation Error: mistakes involving numbers/formulas
  const calcMistakes = mistakes.filter(m =>
    (m.memo || '').match(/[\d]|계산|calculate/));
  causeScores.calculationError = Math.min(1, calcMistakes.length * 0.1);

  // Concept Confusion: mixing up related concepts
  const confusionMistakes = mistakes.filter(m =>
    (m.memo || '').includes('혼동') || (m.memo || '').includes('confuse') ||
    m.errorType === '연계사고부족');
  causeScores.conceptConfusion = Math.min(1, confusionMistakes.length * 0.12);

  // Question Misinterpretation
  const misinterpretMistakes = mistakes.filter(m =>
    (m.memo || '').includes('이해') || (m.memo || '').includes('해석') ||
    m.errorType === '정보부족');
  causeScores.questionMisinterpretation = Math.min(1, misinterpretMistakes.length * 0.08);

  // Pattern Recognition Failure
  causeScores.patternRecognitionFailure = Math.min(1,
    profile.recurringReasoningFailures
      .filter(r => r.pattern === 'graph_misinterpretation' || r.pattern === 'comparative_reasoning')
      .reduce((s, r) => s + r.count * 0.08, 0));

  // Overconfidence
  causeScores.overconfidence = Math.min(1,
    mistakes.filter(m =>
      (m.memo || '').includes('over') || m.questionNumber >= 30
    ).length * 0.05);

  // Guessing Bias
  causeScores.guessingBias = 0; // Requires answer pattern analysis

  // Normalize to sum to 100%
  const total = Object.values(causeScores).reduce((a, b) => a + b, 0) || 1;
  const normalized = {};
  for (const [cause, score] of Object.entries(causeScores)) {
    normalized[cause] = Math.round((score / total) * 100);
  }

  return Object.entries(normalized)
    .map(([cause, probability]) => ({ cause, probability }))
    .sort((a, b) => b.probability - a.probability);
}

/**
 * Generate a natural language analysis summary.
 */
function generateAnalysisSummary(profile) {
  const parts = [];

  const topDomain = profile.recurringSubjects[0];
  const topReasoning = profile.recurringReasoningFailures[0];
  const topRootCause = profile.rootCauses[0];
  const topConcept = profile.recurringConcepts[0];

  if (topDomain) {
    parts.push(`주요 취약 영역은 '${topDomain.domain}' 영역으로, 전체 오답의 ${topDomain.percentage.toFixed(1)}%를 차지합니다.`);
  }

  if (topConcept) {
    parts.push(`'${topConcept.concept}' 개념이 ${topConcept.count}회 반복 출제되어 지속적인 오답 패턴을 보입니다.`);
  }

  if (topReasoning) {
    parts.push(`추론 방식에서 '${topReasoning.label}' 패턴이 감지되었습니다.`);
  }

  if (topRootCause) {
    const causeLabels = {
      knowledgeGap: '지식 격차',
      misreading: '문제 오독',
      vocabularyDeficiency: '어휘 부족',
      timePressure: '시간 압박',
      calculationError: '계산 실수',
      conceptConfusion: '개념 혼동',
      questionMisinterpretation: '문제 해석 오류',
      patternRecognitionFailure: '패턴 인식 실패',
      overconfidence: '과신',
      guessingBias: '추측 편향',
    };
    parts.push(`근본 원인으로는 '${causeLabels[topRootCause.cause] || topRootCause.cause}'이(가) ${topRootCause.probability}% 확률로 추정됩니다.`);
  }

  if (parts.length === 0) {
    return '아직 충분한 데이터가 분석되지 않았습니다. 시험 기록을 추가해주세요.';
  }

  return parts.join(' ');
}

/**
 * Generate actionable recommendations based on weakness profile.
 */
function generateWeaknessRecommendations(profile) {
  const recommendations = [];

  const topDomain = profile.recurringSubjects[0];
  if (topDomain && topDomain.percentage > 30) {
    recommendations.push({
      type: 'domain_focus',
      priority: 'high',
      title: `${topDomain.domain} 영역 집중 학습`,
      description: `해당 영역이 전체 오답의 ${topDomain.percentage.toFixed(0)}%를 차지합니다. 기초 개념부터 재학습하세요.`,
      estimatedImpact: `${topDomain.domain} 오답률 ${Math.min(50, topDomain.percentage * 0.3).toFixed(0)}% 감소 예상`,
    });
  }

  const topRootCause = profile.rootCauses[0];
  if (topRootCause && topRootCause.probability > 30) {
    const strategies = {
      knowledgeGap: '해당 주제의 교재 단원을 다시 정리하고, 유사 문제 20문항 이상 풀어보세요.',
      misreading: '문제를 천천히 두 번 읽는 습관을 들이세요. 키워드에 밑줄을 긋는 방법이 효과적입니다.',
      vocabularyDeficiency: 'EJU 빈출 어휘집을 매일 20단어씩 복습하세요. 일본어 뉴스 청취도 도움이 됩니다.',
      timePressure: '타이머를 설정한 모의 연습을 늘리세요. 각 문제당 1분 30초를 목표로 합니다.',
      calculationError: '계산 과정을 상세히 적는 습관을 들이고, 검산 시간을 확보하세요.',
      conceptConfusion: '비슷한 개념을 비교표로 정리하고, 각 개념의 차이점을 설명할 수 있을 때까지 반복하세요.',
      questionMisinterpretation: '문제의 조건을 번호로 나열한 후, 하나씩 확인하며 풀이하세요.',
      patternRecognitionFailure: '그래프/도표 유형별로 풀이 템플릿을 만들어 반복 연습하세요.',
    };

    recommendations.push({
      type: 'root_cause_strategy',
      priority: 'high',
      title: '근본 원인 대처 전략',
      description: strategies[topRootCause.cause] || '오답 노트를 정리하고 패턴을 분석하세요.',
      estimatedImpact: `전체 오답률 ${Math.min(30, topRootCause.probability * 0.3).toFixed(0)}% 감소 예상`,
    });
  }

  // Spaced repetition recommendation
  recommendations.push({
    type: 'study_method',
    priority: 'medium',
    title: '간격 반복 학습 도입',
    description: '취약 개념을 하루, 3일, 1주, 2주 간격으로 복습하는 간격 반복 시스템을 활용하세요.',
    estimatedImpact: '장기 기억 전환율 40% 향상 예상',
  });

  return recommendations;
}

/**
 * Extract key concepts from text.
 */
function extractConceptsFromText(text) {
  if (!text) return [];
  const concepts = [];
  const lines = text.split(/[,.、。()（）\s\n\r]+/).filter(w => w.length >= 2);

  const ejuKeywords = [
    '수요', '공급', 'GDP', '환율', '금리', '물가', '인플레이션', '디플레이션',
    '무역', '관세', '재정', '통화', '시장', '독점', '경쟁',
    '헌법', '선거', '정당', '의회', '내각', '국제연합', '안전보장',
    '혁명', '전쟁', '냉전', '식민지', '제국주의', '독립',
    '기후', '지형', '인구', '도시', '자원', '지도',
    '환경', '복지', '연금', '고령화', '에너지',
  ];

  for (const word of lines) {
    for (const keyword of ejuKeywords) {
      if (word.includes(keyword) || keyword.includes(word)) {
        concepts.push(keyword);
        break;
      }
    }
  }

  return [...new Set(concepts)];
}
