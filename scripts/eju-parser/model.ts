// ═══════════════════════════════════════════════════════════════════
// Data Model — Zod schemas (source of truth) + inferred TS types.
// JSON Schema is generated from these via zod's native z.toJSONSchema().
// ═══════════════════════════════════════════════════════════════════
import { z } from 'zod';

export const Subject = z.enum(['comprehensive', 'mathematics', 'japanese', 'unknown']);
export type Subject = z.infer<typeof Subject>;

export const DocType = z.enum(['problem', 'answer', 'listening', 'essay', 'other']);
export type DocType = z.infer<typeof DocType>;

// ── source document (one OCR'd PDF) ────────────────────────
export const SourceDoc = z.object({
  file: z.string(),                 // absolute path from ocr_output.json
  basename: z.string(),
  subject: Subject,
  year: z.number().int().nullable(),
  era: z.string().nullable(),       // e.g. "令和7" / "平成18"
  round: z.number().int().nullable(),
  docType: DocType,
  course: z.string().nullable(),    // math: "1"|"2"; japanese: "読解"/"聴解"/"記述" if known
  textLength: z.number().int(),
  metaConfidence: z.number().min(0).max(1),
});
export type SourceDoc = z.infer<typeof SourceDoc>;

// ── choices / sub-questions / questions ────────────────────
export const Choice = z.object({
  marker: z.string(),               // "①".."⑩" or "1".."4"
  text: z.string(),
});
export type Choice = z.infer<typeof Choice>;

export const SubQuestion = z.object({
  label: z.string(),                // "(1)" / "問1の(2)" etc.
  text: z.string(),
  choices: z.array(Choice),
});
export type SubQuestion = z.infer<typeof SubQuestion>;

export const AnswerStatus = z.enum(['linked', 'missing', 'unmatched', 'no_answer_doc']);
export type AnswerStatus = z.infer<typeof AnswerStatus>;

export const ParsedQuestion = z.object({
  id: z.string(),                   // `${examId}#問${number}`
  examId: z.string(),
  subject: Subject,
  year: z.number().int().nullable(),
  round: z.number().int().nullable(),
  questionNumber: z.number().int(), // 問N
  body: z.string(),                 // stem text (before sub-questions/choices)
  subQuestions: z.array(SubQuestion),
  choices: z.array(Choice),         // top-level choices if no sub-questions
  answer: z.string().nullable(),    // linked answer key (digit/letter) or null
  answerStatus: AnswerStatus,
  sourceFile: z.string(),
  ocrSuspect: z.boolean(),          // flagged garbled/low-confidence span
  ocrSuspectReasons: z.array(z.string()),
});
export type ParsedQuestion = z.infer<typeof ParsedQuestion>;

export const ParsedExam = z.object({
  id: z.string(),                   // `${subject}_${year}_r${round}`
  subject: Subject,
  year: z.number().int().nullable(),
  round: z.number().int().nullable(),
  problemFile: z.string().nullable(),
  answerFile: z.string().nullable(),
  listeningFile: z.string().nullable(),
  questionCount: z.number().int(),
  answeredCount: z.number().int(),
  missingAnswers: z.number().int(),
});
export type ParsedExam = z.infer<typeof ParsedExam>;

// ── output containers ──────────────────────────────────────
export const ParsedExamsFile = z.object({
  generatedAt: z.string(),
  totalExams: z.number().int(),
  exams: z.array(ParsedExam),
});
export const ParsedQuestionsFile = z.object({
  generatedAt: z.string(),
  totalQuestions: z.number().int(),
  questions: z.array(ParsedQuestion),
});

export type ParsedExamsFile = z.infer<typeof ParsedExamsFile>;
export type ParsedQuestionsFile = z.infer<typeof ParsedQuestionsFile>;
