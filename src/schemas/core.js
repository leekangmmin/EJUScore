// ═══════════════════════════════════════════════════════════════════
// EJU Intelligence Platform — Core Schema Definitions
// These define the canonical data structures for the entire system.
// All modules import from here to ensure type consistency.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} QuestionObject
 * The canonical structured question after OCR pipeline processing.
 */
export const QuestionSchema = {
  /** Unique identifier (UUID) */
  id: '',
  /** Source exam reference */
  examId: '',
  /** Question number within the exam (1-based) */
  number: 1,
  /** Raw OCR text output */
  rawText: '',
  /** Cleaned/semantically reconstructed text */
  cleanedText: '',
  /** Subject classification */
  subject: 'unknown', // 'japanese' | 'comprehensive' | 'math' | 'science'
  /** Domain within subject */
  domain: 'unknown',  // e.g. 'economy' | 'politics' | 'history' | 'geography' | 'society'
  /** Specific topic */
  topic: '',
  /** Subtopic */
  subtopic: '',
  /** Difficulty estimate (1-10) */
  difficulty: 5,
  /** Question type */
  type: 'multiple_choice', // 'multiple_choice' | 'fill_blank' | 'short_answer' | 'essay' | 'graph_analysis'
  /** The detected materials in the question */
  materials: [],
  /** Extracted formulas */
  formulas: [],
  /** Extracted diagram data */
  diagrams: [],
  /** OCR confidence for this question (0-1) */
  ocrConfidence: 0,
  /** The correct answer (if known from answer key) */
  correctAnswer: null,
  /** User's answer (if taken) */
  userAnswer: null,
  /** Whether the user answered correctly */
  isCorrect: null,
  /** Error analysis when wrong */
  errorAnalysis: null,
  /** Metadata */
  metadata: {
    year: null,
    round: null, // 1 or 2
    source: '',  // 'ocr' | 'manual' | 'import'
    ocrEngine: '', // which engine was primary
  },
};

/**
 * @typedef {object} OcrResult
 * Complete OCR pipeline output for one page/exam document.
 */
export const OcrResultSchema = {
  id: '',
  examId: '',
  sourceFile: '',   // original filename
  sourceType: '',   // 'image' | 'pdf'
  totalPages: 1,
  pages: [],
  questions: [],    // Array<QuestionObject>
  metadata: {
    ocrDate: null,
    processingTimeMs: 0,
    primaryEngine: '',
    ensembleEngines: [],
    averageConfidence: 0,
    layoutQuality: 0, // 0-1
  },
};

/**
 * @typedef {object} ExamRecord
 * A full exam record with scores and structured question data.
 */
export const ExamRecordSchema = {
  id: '',
  date: '',           // 'YYYY-MM' or 'YYYY-MM-DD'
  examName: '',
  examType: 'mock',   // 'mock' | 'past_official' | 'workbook' | 'real_eju'
  subject: '',        // 'japanese' | 'comprehensive' | 'math' | 'science'
  
  // Score data
  japanese: null,     // { reading: number, listening: number, rawMeta?: {...} }
  comprehensive: null, // { score: number, mistakes: [...], rawMeta?: {...} }
  math: null,
  science: null,
  
  // OCR-imported structured questions
  questions: [],      // Array<QuestionObject>
  
  // Source tracking
  source: 'manual',   // 'manual' | 'ocr' | 'import'
  ocrResultId: null,  // reference to OcrResult if imported via OCR
  
  // Metadata
  createdAt: null,
  updatedAt: null,
};

/**
 * @typedef {object} KnowledgeNode
 * A node in the student's personal knowledge graph.
 */
export const KnowledgeNodeSchema = {
  id: '',
  type: 'topic',      // 'subject' | 'domain' | 'topic' | 'subtopic' | 'concept' | 'weakness'
  label: '',
  description: '',
  
  // Learning state
  masteryLevel: 0,      // 0-1
  retentionScore: 0,    // 0-1
  lastReviewed: null,
  reviewCount: 0,
  
  // Error tracking
  errorCount: 0,
  dominantErrorType: '',
  errorHistory: [],
  
  // Metadata
  source: '',          // 'syllabus' | 'ocr_extracted' | 'manual'
  domain: '',
  subject: '',
};

/**
 * @typedef {object} KnowledgeEdge
 * A relationship between two knowledge nodes.
 */
export const KnowledgeEdgeSchema = {
  id: '',
  sourceId: '',
  targetId: '',
  type: 'prerequisite', // 'prerequisite' | 'dependency' | 'related' | 'is_a' | 'part_of'
  weight: 1.0,          // strength of relationship
};

/**
 * @typedef {object} WeaknessProfile
 * The student's detected weakness profile.
 */
export const WeaknessProfileSchema = {
  id: '',
  studentId: 'default',
  generatedAt: null,
  
  // Root cause clusters
  rootCauses: [],
  
  // Recurring patterns
  recurringConcepts: [],
  recurringQuestionTypes: [],
  recurringKeywords: [],
  recurringSubjects: [],
  recurringReasoningFailures: [],
  
  // Per-domain weakness scores
  domainWeakness: {},
  
  // Detailed analysis
  analysis: '',
};

/**
 * @typedef {object} RootCauseAnalysis
 * Root cause for a specific mistake.
 */
export const RootCauseAnalysisSchema = {
  questionId: '',
  examId: '',
  questionNumber: 0,
  
  // Root cause probabilities
  causes: {
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
  },
  
  primaryCause: '',
  explanation: '',
  
  // Tutor output
  tutorExplanation: null,
};

/**
 * @typedef {object} TrendAnalysis
 * Exam intelligence trend data.
 */
export const TrendAnalysisSchema = {
  topic: '',
  years: [],
  appearances: 0,
  frequency: [],
  frequencyTrend: 'stable', // 'increasing' | 'decreasing' | 'stable'
  averageDifficulty: 0,
  questionEvolution: [],
  predictedAppearances: 0,
  predictionConfidence: 0,
};

/**
 * @typedef {object} LearningSchedule
 * Spaced repetition schedule for a student.
 */
export const LearningScheduleSchema = {
  id: '',
  studentId: 'default',
  generatedAt: null,
  items: [],
  totalMasteryScore: 0,
  averageRetentionScore: 0,
  learningVelocity: 0,
  burnoutRisk: 'low',
  nextReviewDate: null,
};

// ═══════════════════════════════════════════════════════════════════════
// V2 SCHEMAS — Exam Intelligence Engine v2
// ═══════════════════════════════════════════════════════════════════════

/**
 * @typedef {object} WrongAnswerAnalysis
 * Complete analysis of a single wrong answer.
 */
export const WrongAnswerAnalysisSchema = {
  questionId: '',
  domain: '',
  topic: '',
  subtopic: '',
  year: 0,
  round: 0,
  analysis: {
    conceptChain: [],           // Traced concept hierarchy
    prerequisiteChain: [],       // Missing prerequisite topics
    weakness: {},               // Weakness inference results
    frequency: {},              // Exam frequency data
    difficulty: {},             // Difficulty assessment
    prediction: {},             // Future exam probability
    relatedQuestions: [],       // Related past questions
  },
  feedback: {},                // AI-generated feedback
  recommendations: [],         // Actionable recommendations
  generatedAt: '',
};

/**
 * @typedef {object} WeaknessNodeV2
 * Enhanced knowledge graph node for personal weakness tracking.
 */
export const WeaknessNodeV2Schema = {
  id: '',
  type: 'domain',              // 'domain' | 'topic' | 'subtopic' | 'concept'
  label: '',
  domain: '',
  accuracy: 0,                  // 0-1 correct rate
  attemptCount: 0,              // Total attempts
  correctCount: 0,              // Correct answers
  masteryLevel: 0,              // 0-1 computed mastery
  retentionScore: 0,            // 0-1 retention estimate
  status: 'unseen',             // 'mastered' | 'learning' | 'weak' | 'unseen'
  lastAttemptDate: null,        // Timestamp
  errorHistory: [],             // Recent error records
  importanceScore: 0.5,         // 0-1 based on exam frequency
  recentAccuracyTrend: [],      // Last 5 accuracy values
};

/**
 * @typedef {object} WeaknessEdgeV2
 * Enhanced edge with prerequisite tracking.
 */
export const WeaknessEdgeV2Schema = {
  id: '',
  sourceId: '',
  targetId: '',
  type: 'prerequisite',         // 'prerequisite' | 'belongs_to' | 'cross_domain'
  weight: 1.0,                  // 0-1 strength
};

/**
 * @typedef {object} FuturePredictionV2
 * Enhanced future exam prediction.
 */
export const FuturePredictionV2Schema = {
  predictionYear: 0,
  generatedAt: '',
  methodology: {
    factors: [],                // Factor descriptions with weights
    dataRange: '',
    predictionYears: [],
  },
  yearly: {},                   // year -> array of topic predictions
  domainRotation: {},           // Domain-level rotation analysis
  difficultyDistribution: {},   // Expected difficulty mix
  insights: [],                 // Human-readable insights
};

/**
 * @typedef {object} StudyPlanV2
 * Enhanced personalized study plan.
 */
export const StudyPlanV2Schema = {
  generatedAt: '',
  studentProfile: {
    totalExams: 0,
    currentScore: 0,
    targetScore: 0,
    gap: 0,
    currentMastery: 0,
  },
  gapAnalysis: {},
  topicROI: [],                 // Topics ranked by ROI
  studySequence: [],            // Optimal learning order
  weeklyPlan: [],               // Week-by-week schedule
  scoreProjection: {},          // Expected score improvement
  recommendations: [],          // Coach recommendations
};

/**
 * @typedef {object} QuestionRecommendation
 * A recommended question with explanation.
 */
export const QuestionRecommendationSchema = {
  topic: '',
  domain: '',
  domainLabel: '',
  reason: '',
  priority: 'medium',           // 'high' | 'medium' | 'low'
  combinedScore: 0,
  estimatedDifficulty: '',
  questions: [],                // Specific question references
  totalAvailable: 0,
};

/**
 * @typedef {object} ExplanationFactor
 * Individual factor in an AI explanation.
 */
export const ExplanationFactorSchema = {
  type: '',                     // 'accuracy' | 'prerequisite' | 'prediction' | 'difficulty' | 'frequency' | 'domain_balance'
  label: '',                    // Korean label
  value: '',                    // Current value
  detail: '',                   // Detailed description
  severity: '',                 // Assessment
  importance: 'medium',         // 'high' | 'medium' | 'low'
  icon: '',                     // Emoji icon
};

// EJU Constants
export const EJU_CONSTANTS = {
  JAP_MAX: 370,
  JAP_READ_MAX: 185,
  JAP_LISTEN_MAX: 185,
  JAP_READ_QUESTIONS: 25,
  JAP_LISTEN_QUESTIONS: 40,
  COMP_MAX: 198,
  COMP_QUESTIONS: 40,
  COMP_RAW_MAX: 200,
  SUBJECTS: ['japanese', 'comprehensive', 'math', 'science'],
  COMP_DOMAINS: ['economy', 'politics', 'history', 'geography', 'society'],
  ROOT_CAUSES: [
    'knowledgeGap', 'misreading', 'vocabularyDeficiency', 'timePressure',
    'calculationError', 'conceptConfusion', 'questionMisinterpretation',
    'patternRecognitionFailure', 'overconfidence', 'guessingBias', 'prerequisiteGap',
  ],
};
