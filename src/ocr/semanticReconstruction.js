// ═══════════════════════════════════════════════════════════════════
// Semantic Reconstruction — Raw OCR → Structured Question Objects
// Post-processes OCR output, reconstructs question structure, 
// classifies subject/domain/topic, and builds canonical QuestionObjects.
// ═══════════════════════════════════════════════════════════════════

import { postProcessJapanese, extractFurigana, normalizeJapanese } from './japaneseOptimizer';
import { classifySubject, scoreSubjects, getSubjectLabel, carryForwardSubjects } from '../utils/subjectClassifier';
import { matchQuestionToSyllabus } from '../utils/syllabusMatcher';

/**
 * Reconstruct a structured QuestionObject from OCR pipeline output.
 *
 * @param {object} ocrBlockResult - Output from ensemble OCR for one block
 * @param {number} index - Question index within page
 * @param {object} options - Page-level options
 * @returns {object} Canonical QuestionObject
 */
export function semanticReconstruct(ocrBlockResult, index, options = {}) {
  const rawText = ocrBlockResult.text || '';
  const block = ocrBlockResult.block || {};
  const diagrams = ocrBlockResult.diagrams || [];

  // Stage 1: Post-process OCR text (Japanese optimizations)
  const { text: cleanedText, corrections } = postProcessJapanese(rawText);

  // Stage 2: Extract furigana annotations
  const furigana = extractFurigana(cleanedText);

  // Stage 3: Normalize text for analysis
  const normalizedText = normalizeJapanese(cleanedText);

  // Stage 4: Classify subject and domain
  const questionNumber = block.questionNumber || (index + 1);
  const subject = classifySubject(normalizedText, questionNumber);
  const subjectScores = scoreSubjects(normalizedText, questionNumber);

  // Stage 5: Match to EJU syllabus (for comprehensive subject)
  let syllabusMatch = null;
  let topic = '';
  let subtopic = '';

  if (subject !== 'unknown') {
    syllabusMatch = matchQuestionToSyllabus(normalizedText, questionNumber);
    if (syllabusMatch && syllabusMatch.number) {
      topic = syllabusMatch.domain || subject;
      subtopic = syllabusMatch.keywordHits?.slice(0, 3).join(', ') || '';
    }
  }

  // Stage 6: Extract formulas from text
  const formulas = extractFormulas(normalizedText);

  // Stage 7: Detect question type
  const questionType = detectQuestionType(normalizedText);

  // Stage 8: Estimate difficulty
  const difficulty = estimateDifficulty({
    text: normalizedText,
    subject,
    subjectScores,
    diagrams,
    formulas,
    questionType,
  });

  // Stage 9: Extract materials (tables, graphs, etc.)
  const materials = [
    ...diagrams.map(d => ({
      type: d.type,
      data: d,
      confidence: d.confidence,
    })),
    ...(block.subBlocks || [])
      .filter(sb => sb.type === 'table')
      .map(sb => ({ type: 'table', bbox: sb.bbox, confidence: 0.5 })),
  ];

  // Stage 10: Build final question object
  const question = {
    id: generateQuestionId(options.examId, questionNumber),
    examId: options.examId || '',
    number: questionNumber,
    rawText,
    cleanedText,
    normalizedText,
    subject: subject === 'unknown' ? 'comprehensive' : subject,
    domain: syllabusMatch?.domain || subject,
    topic,
    subtopic,
    difficulty,
    type: questionType,
    materials,
    formulas,
    diagrams,
    ocrConfidence: ocrBlockResult.confidence || 0,
    correctAnswer: null,
    userAnswer: null,
    isCorrect: null,
    errorAnalysis: null,
    metadata: {
      year: options.year || null,
      round: options.round || null,
      source: 'ocr',
      ocrEngine: ocrBlockResult.primaryEngine || '',
      pageNumber: options.pageNumber || 1,
      corrections: corrections.length > 0 ? corrections : undefined,
      furigana: furigana.length > 0 ? furigana : undefined,
      subjectScores,
    },
  };

  return question;
}

/**
 * Extract mathematical formulas from text.
 * Detects: equations, expressions, scientific notation.
 */
function extractFormulas(text) {
  if (!text) return [];
  const formulas = [];

  // Pattern: numbers with operators (+, -, ×, ÷, =)
  const mathExprRegex = /[\d.]+[\s]*[+\-×÷=±><][\s]*[\d.]+/g;
  let match;
  while ((match = mathExprRegex.exec(text)) !== null) {
    formulas.push({
      type: 'expression',
      latex: match[0], // Simplified — use proper LaTeX conversion in production
      raw: match[0],
      position: match.index,
    });
  }

  // Pattern: exponential/scientific notation
  const sciNotationRegex = /(\d+)\s*×\s*10\^[−\-]?\d+/g;
  while ((match = sciNotationRegex.exec(text)) !== null) {
    formulas.push({
      type: 'scientific_notation',
      raw: match[0],
      position: match.index,
    });
  }

  return formulas;
}

/**
 * Detect question type from text patterns.
 */
function detectQuestionType(text) {
  if (!text) return 'multiple_choice';

  // EJU typical question patterns
  const patterns = [
    { type: 'multiple_choice', regex: /[①②③④⑤]|1\.\s*2\.\s*3\.\s*4\.|選択肢|次の/ },
    { type: 'fill_blank', regex: /空欄|\[.*\]|\(.*\)\s*に入/ },
    { type: 'short_answer', regex: /答えよ|記述|説明せよ|述べよ/ },
    { type: 'graph_analysis', regex: /グラフ|図[0-9]|グラフから/ },
    { type: 'table_analysis', regex: /表[0-9]|次の表|タブルの/ },
  ];

  for (const { type, regex } of patterns) {
    if (regex.test(text)) return type;
  }

  return 'multiple_choice'; // Default for EJU
}

/**
 * Estimate question difficulty (1-10) based on multiple signals.
 */
function estimateDifficulty({ text, subject, subjectScores, diagrams, formulas, questionType }) {
  let difficulty = 5; // Default medium

  // Factor 1: Text length and complexity
  if (text) {
    const sentences = text.split(/[。．.]/).length;
    const avgWordLength = text.length / Math.max(1, sentences);

    if (avgWordLength > 60) difficulty += 1.5;
    else if (avgWordLength > 40) difficulty += 0.5;
    else if (avgWordLength < 15) difficulty -= 0.5;
  }

  // Factor 2: Multiple diagrams increase difficulty
  if (diagrams.length >= 2) difficulty += 1;
  else if (diagrams.length === 1) difficulty += 0.5;

  // Factor 3: Formulas increase difficulty
  if (formulas.length > 0) difficulty += 0.5;

  // Factor 4: Question type
  if (questionType === 'graph_analysis' || questionType === 'fill_blank') difficulty += 0.5;

  // Factor 5: Subject-specific baseline difficulty
  const subjectBias = {
    economy: 4.3,
    politics: 3.7,
    history: 4.0,
    geography: 3.4,
    society: 3.0,
  };

  if (subjectBias[subject]) {
    difficulty = (difficulty + subjectBias[subject]) / 2;
  }

  return Math.round(Math.max(1, Math.min(10, difficulty)));
}

/**
 * Generate a deterministic question ID.
 */
function generateQuestionId(examId, questionNumber) {
  const base = examId || 'unknown';
  return `${base}_q${String(questionNumber).padStart(3, '0')}`;
}

/**
 * Batch reconstruct multiple questions, applying carry-forward correction.
 */
export function batchReconstruct(ocrResults, options = {}) {
  const questions = ocrResults.map((result, index) =>
    semanticReconstruct(result, index, options)
  );

  // Apply carry-forward subject correction for comprehensive exams
  if (options.subject === 'comprehensive' || !options.subject) {
    const withSubjects = questions.map(q => ({
      subject: q.domain,
      newDaemun: q.number === 1 || q.metadata?.pageNumber !== questions[Math.max(0, questions.indexOf(q) - 1)]?.metadata?.pageNumber,
    }));
    const corrected = carryForwardSubjects(withSubjects);

    corrected.forEach((c, i) => {
      if (c.inherited && questions[i]) {
        questions[i].domain = c.subject;
        if (!questions[i].topic) {
          questions[i].topic = c.subject;
        }
      }
    });
  }

  return questions;
}
