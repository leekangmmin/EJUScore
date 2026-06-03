// ═══════════════════════════════════════════════════════════════════
// Answer Linker — pair problem ↔ answer ↔ listening docs by exam, then
// best-effort link answer keys to questions by number.
//
// Reality (verified): 正解表 OCR is heavily garbled (grids, run-together
// digits, 問/間 mixed). Exam-LEVEL pairing is reliable (filename metadata);
// per-question key extraction is low-yield and is reported honestly.
// ═══════════════════════════════════════════════════════════════════
import { normalizeOcr, toAsciiDigits } from './normalize';
import type { SourceDoc, ParsedExam, ParsedQuestion } from './model';

export interface OcrEntry { file: string; text: string; }

export function examIdOf(d: { subject: string; year: number | null; round: number | null }): string {
  return `${d.subject}_${d.year ?? 'x'}_r${d.round ?? 'x'}`;
}

export interface ExamGroup {
  id: string;
  problem: SourceDoc | null;
  answer: SourceDoc | null;
  listening: SourceDoc | null;
}

/** Group documents into exams by (subject, year, round). */
export function groupExams(docs: SourceDoc[]): Map<string, ExamGroup> {
  const groups = new Map<string, ExamGroup>();
  for (const d of docs) {
    const id = examIdOf(d);
    let g = groups.get(id);
    if (!g) { g = { id, problem: null, answer: null, listening: null }; groups.set(id, g); }
    if (d.docType === 'problem' && !g.problem) g.problem = d;
    else if (d.docType === 'answer' && !g.answer) g.answer = d;
    else if (d.docType === 'listening' && !g.listening) g.listening = d;
  }
  return groups;
}

/**
 * Best-effort answer-key extraction from a 正解表.
 * Looks for "問N <digit>" / "間N <digit>" adjacency (after 間→問 normalize).
 * Returns map: questionNumber → answer digit. Low yield on garbled tables.
 */
export function parseAnswerKey(answerText: string): Map<number, string> {
  const t = normalizeOcr(answerText);
  const map = new Map<number, string>();
  // pattern: 問N (sep) answer digit. EJU choices are predominantly 1–4, so we
  // constrain the answer to [1-4] for precision (prefer missing over wrong).
  const re = /問\s*([0-9]{1,2})[^0-9]{0,4}([1-4])(?![0-9])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const n = Number(toAsciiDigits(m[1]));
    if (!map.has(n)) map.set(n, toAsciiDigits(m[2]));
  }
  return map;
}

export interface LinkResult {
  exams: ParsedExam[];
  questions: ParsedQuestion[];
  stats: {
    examGroups: number;
    problemWithAnswerDoc: number;
    answersExtractedTotal: number;
    linked: number;
    missing: number;
    noAnswerDoc: number;
  };
}

/** Link extracted questions to answer keys. Mutates question.answer/status. */
export function linkAnswers(
  groups: Map<string, ExamGroup>,
  questionsByExam: Map<string, ParsedQuestion[]>,
  answerTextByFile: Map<string, string>
): LinkResult {
  const exams: ParsedExam[] = [];
  const questions: ParsedQuestion[] = [];
  let problemWithAnswerDoc = 0, answersExtractedTotal = 0, linked = 0, missing = 0, noAnswerDoc = 0;

  for (const [id, g] of groups) {
    const qs = questionsByExam.get(id) || [];
    const keyMap = g.answer ? parseAnswerKey(answerTextByFile.get(g.answer.file) || '') : null;
    if (g.answer) problemWithAnswerDoc += g.problem ? 1 : 0;
    if (keyMap) answersExtractedTotal += keyMap.size;

    let answered = 0;
    for (const q of qs) {
      if (!g.answer) { q.answerStatus = 'no_answer_doc'; noAnswerDoc++; }
      else if (keyMap && keyMap.has(q.questionNumber)) {
        q.answer = keyMap.get(q.questionNumber)!;
        q.answerStatus = 'linked'; linked++; answered++;
      } else { q.answerStatus = 'missing'; missing++; }
      questions.push(q);
    }

    if (g.problem || g.answer || qs.length) {
      exams.push({
        id,
        subject: (g.problem || g.answer || g.listening)!.subject,
        year: (g.problem || g.answer || g.listening)!.year,
        round: (g.problem || g.answer || g.listening)!.round,
        problemFile: g.problem?.file ?? null,
        answerFile: g.answer?.file ?? null,
        listeningFile: g.listening?.file ?? null,
        questionCount: qs.length,
        answeredCount: answered,
        missingAnswers: qs.length - answered,
      });
    }
  }

  return {
    exams,
    questions,
    stats: { examGroups: groups.size, problemWithAnswerDoc, answersExtractedTotal, linked, missing, noAnswerDoc },
  };
}
