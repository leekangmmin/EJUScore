// ═══════════════════════════════════════════════════════════════════════════
// EJU Problem Analyzer — Main Orchestrator
// ═══════════════════════════════════════════════════════════════════════════

import { detectYear, detectYearBatch, detectRound } from './yearDetector';
import { detectSections, quickDetectDomain } from './sectionDetector';
import { extractTags, aggregateTags } from './tagExtractor';
import { similaritySearch, findSimilarQuestions } from './similaritySearch';
import { recommendLearningPriority, analyzeErrorPattern } from './learningPrioritizer';
import { generateTrainingDataset } from './datasetGenerator';
import { classifySubject, scoreSubjects, getSubjectLabel, SUBJECT_KEYWORDS } from '../utils/subjectClassifier';
import { makeFuzzyMatcher } from './textMatch';

export {
  detectYear, detectYearBatch, detectRound,
  detectSections, quickDetectDomain,
  extractTags, aggregateTags,
  similaritySearch, findSimilarQuestions,
  recommendLearningPriority, analyzeErrorPattern,
  generateTrainingDataset,
};

/**
 * Main entry: Analyze OCR JSON input → normalized structured output.
 */
export async function analyzeEJUProblem(ocrJson, config = {}) {
  const {
    includeMetadata = true,
    minConfidence = 0.3,
    minSectionConfidence = minConfidence,
    generateTags = true,
    datasets = null,
  } = config;

  const errors = [];
  const { questions, examMeta, parseErrors } = parseInput(ocrJson);
  errors.push(...parseErrors);

  if (questions.length === 0) {
    return { problems: [], examMetadata: examMeta, tags: {}, errors: ['No questions could be extracted from the input'] };
  }

  const yearResult = detectYearFromInput(ocrJson, questions);
  if (yearResult.year) {
    examMeta.year = yearResult.year;
    examMeta.round = yearResult.round;
    examMeta.yearConfidence = yearResult.confidence;
    examMeta.yearMethod = yearResult.method;
  }

  const subject = examMeta.subject || detectOverallSubject(questions);
  const { questions: qWithDomains } = detectSections(questions, { useQuestionNumberHints: true, minSectionConfidence });

  const problems = [];
  const allTagSets = [];

  for (const q of qWithDomains) {
    try {
      const problem = processSingleQuestion(q, subject, yearResult, datasets, { includeMetadata, generateTags });
      problems.push(problem);
      if (generateTags && problem.metadata?.tags) allTagSets.push(problem.metadata.tags);
    } catch (err) {
      errors.push(`Question ${q.number || '?'}: ${err.message}`);
      problems.push({
        year: yearResult.year, subject, section: null, question_number: q.number || 0,
        difficulty: '보통', difficulty_score: 5, topic: '', tags: [], answer: null, explanation: null,
        metadata: { error: err.message },
      });
    }
  }

  const aggregatedTags = generateTags ? aggregateTags(allTagSets) : {};
  return { problems, examMetadata: examMeta, tags: aggregatedTags, errors };
}

export function parseInput(ocrJson) {
  const errors = [];
  let questions = [];
  const examMeta = { year: null, round: null, subject: null, source: 'ocr', totalQuestions: 0 };

  if (!ocrJson) return { questions: [], examMeta, parseErrors: ['Empty input'] };

  if (Array.isArray(ocrJson)) {
    questions = ocrJson.filter(q => q && (q.text || q.rawText)).map((q, i) => ({
      number: q.number || q.questionNumber || q.question_number || (i + 1),
      text: q.cleanedText || q.text || q.rawText || '',
      rawText: q.rawText || q.text || '',
      domain: q.domain || q.detectedDomain || null,
      difficulty: q.difficulty || null, type: q.type || null,
      materials: q.materials || [], formulas: q.formulas || [],
      diagrams: q.diagrams || [], metadata: q.metadata || {},
    }));
  } else if (ocrJson.pages && Array.isArray(ocrJson.pages)) {
    const seen = new Set();
    let qCounter = 1;
    for (const page of ocrJson.pages) {
      for (const q of (page.questions || [])) {
        const qNum = q.number || qCounter++;
        if (!seen.has(`q${qNum}`)) {
          seen.add(`q${qNum}`);
          questions.push({
            number: qNum, text: q.cleanedText || q.text || q.rawText || '',
            rawText: q.rawText || q.text || '', domain: q.domain || null,
            difficulty: q.difficulty || null, type: q.type || null,
            materials: q.materials || [], formulas: q.formulas || [],
            diagrams: q.diagrams || [], metadata: q.metadata || {},
          });
        }
      }
    }
    if (ocrJson.metadata) examMeta.ocrMetadata = ocrJson.metadata;
    examMeta.totalQuestions = questions.length;
  } else if (ocrJson.questions && Array.isArray(ocrJson.questions)) {
    questions = ocrJson.questions.map((q, i) => ({
      number: q.number || q.questionNumber || (i + 1),
      text: q.cleanedText || q.text || q.rawText || '',
      rawText: q.rawText || q.text || '', domain: q.domain || null,
      difficulty: q.difficulty || null, type: q.type || null,
      materials: q.materials || [], formulas: q.formulas || [],
      diagrams: q.diagrams || [], metadata: q.metadata || {},
    }));
    examMeta.totalQuestions = questions.length;
    if (ocrJson.metadata) examMeta.ocrMetadata = ocrJson.metadata;
  } else if (typeof ocrJson === 'string') {
    const blocks = splitIntoQuestions(ocrJson);
    questions = blocks.map((block, i) => ({ number: i + 1, text: block, rawText: block, domain: null }));
  } else if (ocrJson.rawText || ocrJson.text) {
    questions = [{
      number: 1, text: ocrJson.cleanedText || ocrJson.text || ocrJson.rawText || '',
      rawText: ocrJson.rawText || ocrJson.text || '', domain: ocrJson.domain || null,
      difficulty: ocrJson.difficulty || null, materials: ocrJson.materials || [],
    }];
  }

  if (questions.length === 0) errors.push('Could not parse any questions from input');
  if (ocrJson.subject) examMeta.subject = ocrJson.subject;
  else if (ocrJson.metadata?.subject) examMeta.subject = ocrJson.metadata.subject;

  questions.sort((a, b) => a.number - b.number);
  return { questions, examMeta, parseErrors: errors };
}

function detectYearFromInput(ocrJson, questions) {
  if (ocrJson?.pages && Array.isArray(ocrJson.pages)) {
    const pageTexts = ocrJson.pages.map(p => ({
      text: p.questions?.map(q => q.rawText || q.text || '').join('\n') || '',
    }));
    return detectYearBatch(pageTexts);
  }
  if (ocrJson?.metadata?.year) {
    return { year: ocrJson.metadata.year, round: ocrJson.metadata.round || null, confidence: 0.9, method: 'metadata', rawMatch: null };
  }
  const combinedText = questions.map(q => q.rawText || q.text || '').filter(Boolean).join('\n');
  const result = detectYear(combinedText);
  if (!result.year || result.confidence < 0.5) {
    const roundResult = detectRound(combinedText);
    if (roundResult.round && !result.round) result.round = roundResult.round;
  }
  return result;
}

export function detectOverallSubject(questions) {
  const counts = { japanese: 0, comprehensive: 0, math: 0, science: 0, unknown: 0 };
  for (const q of questions) {
    const text = q.text || q.rawText || '';
    if (/読解|聴解|聴読解|日本語/.test(text)) counts.japanese++;
    if (/総合科目|종합과목|第1問|第2問/.test(text)) counts.comprehensive++;
    if (/数学|コース[12]|方程式|関数|ベクトル/.test(text)) counts.math++;
    if (/理科|物理|化学|生物|科学/.test(text)) counts.science++;
    if (Math.max(...Object.values(scoreSubjects(text))) > 5) counts.comprehensive++;
  }
  let best = 'comprehensive', bestCount = 0;
  for (const [subj, count] of Object.entries(counts)) {
    if (count > bestCount) { bestCount = count; best = subj; }
  }
  return best;
}

function processSingleQuestion(q, subject, yearResult, datasets, config) {
  const text = q.text || q.rawText || '';
  const domainResult = q.domain
    ? { domain: q.domain, confidence: 0.9, scores: {} }
    : quickDetectDomain(text, q.number);
  const difficultyScore = q.difficulty || estimateSimpleDifficulty(text, domainResult.domain);
  const topic = determineTopic(text, domainResult.domain, datasets);
  const tagSet = extractTags({ ...q, detectedDomain: domainResult.domain, difficulty: difficultyScore }, datasets);

  const tagStrings = [
    ...tagSet.domainTags.map(t => t.tag),
    ...tagSet.conceptTags.slice(0, 5).map(t => t.tag),
    ...tagSet.materialTags.map(t => t.tag),
    ...tagSet.difficultyTags.map(t => t.tag),
    ...tagSet.typeTags.map(t => t.tag),
  ];

  let answer = q.correctAnswer || null;
  let explanation = null;
  if (!answer && datasets?.goldStandard) {
    const match = findInGoldStandard(q.number, domainResult.domain, datasets.goldStandard);
    if (match) { answer = match.answer; explanation = match.explanation || null; }
  }

  const normalized = {
    year: yearResult.year || q.metadata?.year || null,
    subject, section: domainResult.domain || null,
    question_number: q.number || 0,
    difficulty: getDifficultyLabel(difficultyScore),
    difficulty_score: difficultyScore, topic,
    tags: [...new Set(tagStrings)],
    answer, explanation,
  };

  if (config.includeMetadata) {
    normalized.metadata = {
      domain: domainResult.domain, domainConfidence: domainResult.confidence,
      domainScores: domainResult.scores, difficultyRaw: difficultyScore,
      yearConfidence: yearResult.confidence, round: yearResult.round,
      tags: { domainTags: tagSet.domainTags, conceptTags: tagSet.conceptTags, materialTags: tagSet.materialTags, typeTags: tagSet.typeTags, difficultyTags: tagSet.difficultyTags },
      rawText: q.rawText?.substring(0, 500), textLength: text.length,
      hasFormulas: tagSet.formulaTags.length > 0, languages: tagSet.languageTags.map(l => l.tag),
    };
  }
  return normalized;
}

function estimateSimpleDifficulty(text, domain) {
  let score = 5;
  if (text.length > 300) score += 1.5;
  else if (text.length > 150) score += 0.5;
  else if (text.length < 50) score -= 0.5;
  if (/グラフ|図[0-9]|表[0-9]/.test(text)) score += 1;
  if (/資料[0-9]|史料/.test(text)) score += 0.5;
  const bias = { economy: 0.3, politics: -0.3, history: 0, geography: -0.3, society: -0.5 };
  score += bias[domain] || 0;
  return Math.round(Math.max(1, Math.min(10, score)));
}

function determineTopic(text, domain, datasets) {
  const match = makeFuzzyMatcher(text); // OCR-tolerant [Critical #2]
  const kg = datasets?.knowledgeGraph;
  if (kg?.taxonomy && domain) {
    const domData = kg.taxonomy[domain];
    if (domData?.topics) {
      for (const [topic, subtopics] of Object.entries(domData.topics)) {
        if (match(topic)) return topic;
        if (Array.isArray(subtopics)) for (const sub of subtopics) if (match(sub)) return topic;
      }
    }
  }
  const keywords = SUBJECT_KEYWORDS[domain];
  if (keywords) {
    for (const level of ['critical', 'strong']) {
      for (const kw of (keywords[level] || [])) if (match(kw)) return kw;
    }
  }
  return domain || 'unknown';
}

// [High #4] O(1) lookup via a per-goldStandard Map index (was O(N) .find()
// called once per question → O(N²) over an exam). The index is memoized on
// the goldStandard object identity, so repeated calls reuse it.
const _goldIndexCache = new WeakMap();

function getGoldStandardIndex(goldStandard) {
  if (!goldStandard?.questions) return null;
  let index = _goldIndexCache.get(goldStandard);
  if (index) return index;
  index = new Map(); // question_number → entry[]
  for (const q of goldStandard.questions) {
    const key = q.question_number;
    const bucket = index.get(key);
    if (bucket) bucket.push(q);
    else index.set(key, [q]);
  }
  _goldIndexCache.set(goldStandard, index);
  return index;
}

function findInGoldStandard(questionNumber, domain, goldStandard) {
  const index = getGoldStandardIndex(goldStandard);
  if (!index) return null;
  const bucket = index.get(questionNumber);
  if (!bucket) return null;
  if (!domain) return bucket[0];
  return bucket.find(q => q.domain === domain) || null;
}

function getDifficultyLabel(score) {
  if (score <= 2) return '기초';
  if (score <= 4) return '쉬움';
  if (score <= 6) return '보통';
  if (score <= 8) return '어려움';
  return '킬러';
}

export function splitIntoQuestions(rawText) {
  const markers = [
    /(?:^|\n)\s*(?:問|第)\s*[一二三四五六七八九十\d]+\s*[.．:：]/,
    /(?:^|\n)\s*\d+\s*[.．)）]/,
    /(?:^|\n)\s*[①②③④⑤]/,
  ];
  for (const marker of markers) {
    const blocks = rawText.split(marker).filter(b => b.trim().length > 0);
    if (blocks.length >= 2) return blocks;
  }
  return [rawText];
}

export default {
  analyzeEJUProblem, parseInput, detectOverallSubject, processSingleQuestion, splitIntoQuestions,
};
