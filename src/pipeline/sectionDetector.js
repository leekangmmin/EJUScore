// ═══════════════════════════════════════════════════════════════════════
// Section Detector — EJU Exam Section & Subject Domain Detection
//
// Detects exam sections (第1問, 第2問, etc.) and assigns subject domains
// (economy, politics, history, geography, society) to each question.
//
// Uses:
//   - Row-wise keyword scoring from subjectClassifier
//   - Section header text analysis
//   - Carry-forward correction for cross-section continuity
//   - Question-number-based domain hints (EJU comprehensive has known
//     domain ordering per question block)
// ═══════════════════════════════════════════════════════════════════════

import {
  scoreSubjects,
  classifySubject,
  getSubjectLabel,
  carryForwardSubjects,
  SUBJECT_KEYWORDS,
  SUBJECT_PRIORITY,
} from '../utils/subjectClassifier';
import { makeFuzzyMatcher } from './textMatch';

/**
 * @typedef {object} SectionInfo
 * @property {number} sectionNumber - 1-based section number within the exam
 * @property {string} detectedDomain - Primary domain for this section
 * @property {number} domainConfidence - Confidence in domain detection (0-1)
 * @property {object} domainScores - Raw scores for each domain
 * @property {Array<number>} questionNumbers - Question numbers in this section
 * @property {string|null} headerText - Raw header text if detected
 * @property {string} method - Detection method used
 */

/**
 * @typedef {object} SectionDetectorConfig
 * @property {boolean} [useQuestionNumberHints=true] - Use question number based domain hints
 * @property {number} [minSectionConfidence=0.35] - Minimum confidence to accept a section domain
 * @property {boolean} [carryForward=true] - Apply carry-forward correction
 * @property {number} [fuzzyThreshold=0.72] - Fuzzy matching threshold for keywords
 */

/**
 * Detect sections and assign domains to each question in a batch.
 *
 * @param {Array<{number: number, text: string, rawText: string}>} questions
 *   Array of question objects with number and text fields.
 * @param {SectionDetectorConfig} [config]
 * @returns {{questions: Array, sections: Array<SectionInfo>}}
 */
export function detectSections(questions, config = {}) {
  const {
    useQuestionNumberHints = true,
    minSectionConfidence = 0.35,
    carryForward = true,
    fuzzyThreshold = 0.72,
  } = config;

  if (!questions || questions.length === 0) {
    return { questions: [], sections: [] };
  }

  // Step 1: Detect section boundaries from header patterns
  const rawSections = detectSectionBoundaries(questions);

  // Step 2: For each section, determine the domain
  const sections = rawSections.map((sec, idx) => {
    return analyzeSectionDomain(sec, questions, idx, {
      useQuestionNumberHints,
      minSectionConfidence,
      fuzzyThreshold,
    });
  });

  // Step 3: Apply carry-forward correction across sections
  if (carryForward && sections.length > 1) {
    applySectionCarryForward(sections);
  }

  // Step 4: Assign domains to individual questions
  const analyzedQuestions = assignQuestionDomains(questions, sections);

  return { questions: analyzedQuestions, sections };
}

/**
 * Detect section boundaries by looking for block/major question markers.
 * EJU 종합과목 typically has sections delineated by "第1問", "第2問", etc.,
 * or by major topic shifts.
 *
 * @param {Array} questions
 * @returns {Array<{startIdx: number, endIdx: number, headerText: string|null}>}
 */
function detectSectionBoundaries(questions) {
  const sectionMarkers = [];
  const SECTION_HEADER_RE = /^(?:第\s*[一二三四五六七八九十\d]+\s*問|[問間]\s*\d+\s*[:：]|【.+?】)/;

  for (let i = 0; i < questions.length; i++) {
    const text = questions[i].text || questions[i].rawText || '';
    const firstLine = text.split('\n')[0].trim();

    if (SECTION_HEADER_RE.test(firstLine)) {
      // Also check the previous question's last line for continuity
      const isNewSection =
        sectionMarkers.length === 0 ||
        // Check if there's a clear break from the previous section
        !isContinuationOfPreviousSection(firstLine, questions, i);

      if (isNewSection) {
        sectionMarkers.push({
          startIdx: i,
          headerText: firstLine,
          rawHeaderText: firstLine,
        });
      }
    }
  }

  // If no explicit section markers found, treat the whole set as one section
  if (sectionMarkers.length === 0) {
    return [{ startIdx: 0, endIdx: questions.length - 1, headerText: null }];
  }

  // Set end indices
  for (let i = 0; i < sectionMarkers.length; i++) {
    if (i < sectionMarkers.length - 1) {
      sectionMarkers[i].endIdx = sectionMarkers[i + 1].startIdx - 1;
    } else {
      sectionMarkers[i].endIdx = questions.length - 1;
    }
  }

  return sectionMarkers;
}

/**
 * Check if a header line suggests continuation of the previous section.
 */
function isContinuationOfPreviousSection(headerLine, questions, currentIdx) {
  // If the header is simply "問X" where X increments from the previous question
  // number, it's likely a continuation.
  if (currentIdx > 0) {
    const prevText = questions[currentIdx - 1].text || questions[currentIdx - 1].rawText || '';
    const prevLastLine = prevText.split('\n').filter(l => l.trim()).slice(-1)[0] || '';

    // If previous question ends mid-sentence (no period), likely continuation
    if (prevLastLine && !/[。．.）)]/.test(prevLastLine.slice(-1))) {
      return true;
    }
  }

  return false;
}

/**
 * Analyze a section to determine its domain.
 */
function analyzeSectionDomain(section, questions, sectionIdx, config) {
  const { useQuestionNumberHints, minSectionConfidence, fuzzyThreshold } = config;

  // Collect all text in this section
  const sectionTexts = [];
  const questionNumbers = [];

  for (let i = section.startIdx; i <= section.endIdx; i++) {
    const q = questions[i];
    if (q) {
      sectionTexts.push(q.text || q.rawText || '');
      questionNumbers.push(q.number);
    }
  }

  const combinedText = sectionTexts.join('\n');

  // Strategy 1: Analyze header text (most reliable)
  let headerText = section.headerText || '';
  let headerScores = headerText ? scoreSubjects(headerText) : null;

  // Strategy 2: Aggregate keyword scores across all questions
  const aggregateScores = { economy: 0, politics: 0, history: 0, geography: 0, society: 0 };
  for (const text of sectionTexts) {
    const scores = scoreSubjects(text);
    for (const domain of SUBJECT_PRIORITY) {
      aggregateScores[domain] += scores[domain];
    }
  }

  // Strategy 3: Majority vote across individual questions
  const questionDomains = [];
  for (const text of sectionTexts) {
    const domain = classifySubject(text);
    if (domain !== 'unknown') {
      questionDomains.push(domain);
    }
  }
  const majorityDomain = getMajority(questionDomains);

  // Strategy 4: Question number based hints (for EJU comprehensive subject)
  let numberHintDomain = null;
  if (useQuestionNumberHints) {
    // EJU 종합과목 question-to-domain mapping based on standard structure
    const firstQNum = questionNumbers[0];
    numberHintDomain = getDomainByQuestionNumberRange(firstQNum);
  }

  // Combine strategies with weighted scoring
  const finalScores = { economy: 0, politics: 0, history: 0, geography: 0, society: 0 };

  // Weight 1: Header scores (if available)
  if (headerScores) {
    for (const domain of SUBJECT_PRIORITY) {
      finalScores[domain] += headerScores[domain] * 3.0;
    }
  }

  // Weight 2: Aggregate scores
  const maxAgg = Math.max(...Object.values(aggregateScores), 1);
  for (const domain of SUBJECT_PRIORITY) {
    finalScores[domain] += (aggregateScores[domain] / maxAgg) * 5.0;
  }

  // Weight 3: Majority vote bonus
  if (majorityDomain) {
    finalScores[majorityDomain] += 2.0;
  }

  // Weight 4: Number hint bonus
  if (numberHintDomain) {
    finalScores[numberHintDomain] += 2.5;
  }

  // Weight 5: Critical keyword detection (OCR-tolerant fuzzy match)
  const sectionMatch = makeFuzzyMatcher(combinedText);
  for (const domain of SUBJECT_PRIORITY) {
    const criticalKeywords = SUBJECT_KEYWORDS[domain]?.critical || [];
    for (const kw of criticalKeywords) {
      if (sectionMatch(kw)) {
        finalScores[domain] += 3.0;
      }
    }
  }

  // Determine winner
  let bestDomain = 'unknown';
  let bestScore = 0;
  for (const domain of SUBJECT_PRIORITY) {
    if (finalScores[domain] > bestScore) {
      bestScore = finalScores[domain];
      bestDomain = domain;
    }
  }

  // Normalize confidence
  const totalScore = Math.max(Object.values(finalScores).reduce((a, b) => a + b, 0), 1);
  const confidence = Math.min(0.99, bestScore / totalScore);

  // Determine method
  const methods = [];
  if (headerScores && Object.values(headerScores).some(s => s > 0)) methods.push('header');
  if (majorityDomain) methods.push('majority_vote');
  if (numberHintDomain) methods.push('number_hint');
  methods.push('keyword_scoring');

  return {
    sectionNumber: sectionIdx + 1,
    detectedDomain: confidence >= minSectionConfidence ? bestDomain : 'unknown',
    domainConfidence: parseFloat(confidence.toFixed(3)),
    domainScores: finalScores,
    questionNumbers: [...questionNumbers],
    headerText: section.headerText || null,
    method: methods.join('+'),
  };
}

/**
 * Assign domains to individual questions based on section analysis.
 */
function assignQuestionDomains(questions, sections) {
  return questions.map((q, idx) => {
    // Find the section this question belongs to
    const section = sections.find(
      s => idx >= s.startIdx && idx <= s.endIdx
    );

    if (!section) {
      return {
        ...q,
        detectedDomain: classifySubject(q.text || q.rawText || ''),
        sectionNumber: null,
        domainConfidence: 0,
      };
    }

    // Determine individual question domain (might differ from section)
    const text = q.text || q.rawText || '';
    const individualScores = scoreSubjects(text);

    // Use section domain as baseline
    let finalDomain = section.detectedDomain;
    let domainConfidence = section.domainConfidence;

    // If individual scores strongly suggest a different domain, adjust
    const individualBest = SUBJECT_PRIORITY.reduce(
      (best, d) => individualScores[d] > individualScores[best] ? d : best,
      'unknown'
    );

    if (
      individualBest !== 'unknown' &&
      individualScores[individualBest] > individualScores[section.detectedDomain] + 3
    ) {
      // Strong individual signal overrides section domain
      finalDomain = individualBest;
      const total = Math.max(Object.values(individualScores).reduce((a, b) => a + b, 0), 1);
      domainConfidence = Math.min(0.95, individualScores[individualBest] / total);
    }

    return {
      ...q,
      detectedDomain: finalDomain,
      domainConfidence: parseFloat(domainConfidence.toFixed(3)),
      domainScores: individualScores,
      sectionNumber: section.sectionNumber,
    };
  });
}

/**
 * Apply carry-forward correction across sections to smooth domain transitions.
 */
function applySectionCarryForward(sections) {
  // Forward pass
  for (let i = 1; i < sections.length; i++) {
    const prev = sections[i - 1];
    const curr = sections[i];

    // If current section is unknown or very low confidence,
    // and adjacent to a high-confidence section, inherit
    if (
      curr.domainConfidence < 0.4 &&
      prev.domainConfidence > 0.6
    ) {
      curr.detectedDomain = prev.detectedDomain;
      curr.domainConfidence = prev.domainConfidence * 0.6;
      curr.method += '+carry_forward';
    }
  }

  // Backward pass
  for (let i = sections.length - 2; i >= 0; i--) {
    const next = sections[i + 1];
    const curr = sections[i];

    if (
      curr.domainConfidence < 0.4 &&
      next.domainConfidence > 0.6
    ) {
      curr.detectedDomain = next.detectedDomain;
      curr.domainConfidence = next.domainConfidence * 0.6;
      curr.method += '+carry_backward';
    }
  }
}

/**
 * Get the most frequent element in an array.
 */
function getMajority(arr) {
  if (!arr || arr.length === 0) return null;
  const freq = {};
  let best = arr[0];
  let bestCount = 0;
  for (const item of arr) {
    freq[item] = (freq[item] || 0) + 1;
    if (freq[item] > bestCount) {
      bestCount = freq[item];
      best = item;
    }
  }
  return best;
}

/**
 * Get expected domain for a given question number range in EJU 종합과목.
 * Corrected to the actual EJU comprehensive structure (38 questions)
 * per DeepSeek audit [Critical #1]:
 *   Questions 1-8:   지리 (Geography)
 *   Questions 9-16:  역사 (History)
 *   Questions 17-24: 경제 (Economy)
 *   Questions 25-32: 정치 (Politics)
 *   Questions 33-38: 사회 (Society)
 *
 * Note: This is a guideline; actual exam ordering may vary slightly.
 *
 * @param {number} questionNumber
 * @returns {string|null}
 */
function getDomainByQuestionNumberRange(questionNumber) {
  if (questionNumber < 1 || questionNumber > 40) return null;

  if (questionNumber <= 8) return 'geography';
  if (questionNumber <= 16) return 'history';
  if (questionNumber <= 24) return 'economy';
  if (questionNumber <= 32) return 'politics';
  return 'society';
}

/**
 * Quick domain detection for a single question (lightweight).
 *
 * @param {string} text - Question text
 * @param {number} [questionNumber] - Optional question number for hints
 * @returns {{ domain: string, confidence: number, scores: object }}
 */
export function quickDetectDomain(text, questionNumber) {
  const scores = scoreSubjects(text, questionNumber);

  let bestDomain = 'unknown';
  let bestScore = 1;
  for (const domain of SUBJECT_PRIORITY) {
    if (scores[domain] > bestScore) {
      bestScore = scores[domain];
      bestDomain = domain;
    }
  }

  const total = Math.max(Object.values(scores).reduce((a, b) => a + b, 0), 1);
  const confidence = Math.min(0.95, bestScore / total);

  return {
    domain: bestDomain,
    confidence: parseFloat(confidence.toFixed(3)),
    scores,
  };
}

export default {
  detectSections,
  quickDetectDomain,
  getDomainByQuestionNumberRange,
};
