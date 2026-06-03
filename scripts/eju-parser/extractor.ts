// ═══════════════════════════════════════════════════════════════════
// Problem Extractor — split a problem document into 問N questions,
// then extract body / sub-questions (1)(2) / choices ①②③④.
// Runs on OCR-normalized text (間/同→問 already applied).
// ═══════════════════════════════════════════════════════════════════
import { normalizeOcr, looksGarbled } from './normalize';
import type { SourceDoc, ParsedQuestion, Choice, SubQuestion } from './model';

const RE_MON = /問\s*([0-9]{1,2})/g;
const RE_CHOICE_SPLIT = /(?=[①-⑩])/;
const RE_SUBQ_SPLIT = /(?=[（(][1-9][）)])/;

/** Circled-number choices (①②③④) — present in answer tables, rare in problems. */
function extractCircledChoices(segment: string): Choice[] {
  return segment
    .split(RE_CHOICE_SPLIT)
    .filter((p) => /^[①-⑩]/.test(p))
    .map((p) => ({ marker: p[0], text: p.slice(1).replace(/\s+/g, ' ').trim().slice(0, 160) }))
    .filter((c) => c.text.length > 0);
}

/**
 * Numeric inline choices — the REAL EJU 종합 format, e.g.
 *   "1 東ヨーロッパ 2 南アジア 3 南アメリカ 4 北アフリカ"
 * Captures option text between digit markers (text stops at the next digit).
 */
function extractNumericChoices(segment: string): Choice[] {
  const flat = segment.replace(/\s+/g, ' ');
  // each option = "N <text>" where text is non-digits (stops before next marker).
  // lookbehind keeps the boundary char so consecutive markers all match.
  const re = /(?<![0-9])([1-4])\s+([^0-9]{1,24})/g;
  const found = new Map<number, string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat)) !== null) {
    const n = Number(m[1]);
    const txt = m[2].trim();
    if (txt && !found.has(n)) found.set(n, txt);
  }
  // require a contiguous run starting at 1 (1,2,3[,4]); ≥3 options
  const out: Choice[] = [];
  for (let i = 1; i <= 4; i++) {
    if (!found.has(i)) break;
    out.push({ marker: String(i), text: found.get(i)!.slice(0, 160) });
  }
  return out.length >= 3 ? out : [];
}

export function extractChoices(segment: string): Choice[] {
  const circled = extractCircledChoices(segment);
  if (circled.length) return circled;
  return extractNumericChoices(segment);
}

export function extractSubQuestions(segment: string): SubQuestion[] {
  const parts = segment.split(RE_SUBQ_SPLIT);
  const subs: SubQuestion[] = [];
  for (const p of parts) {
    const m = p.match(/^[（(]([1-9])[）)]/);
    if (!m) continue;
    const rest = p.slice(m[0].length);
    subs.push({
      label: `(${m[1]})`,
      text: rest.split(RE_CHOICE_SPLIT)[0].replace(/\s+/g, ' ').trim().slice(0, 240),
      choices: extractChoices(rest),
    });
  }
  return subs;
}

/** Extract all 問N questions from one problem document. */
export function extractQuestions(doc: SourceDoc, rawText: string): ParsedQuestion[] {
  const examId = `${doc.subject}_${doc.year ?? 'x'}_r${doc.round ?? 'x'}`;
  const norm = normalizeOcr(rawText);
  const marks = [...norm.matchAll(RE_MON)];
  const out: ParsedQuestion[] = [];

  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index!;
    const end = i + 1 < marks.length ? marks[i + 1].index! : norm.length;
    const segment = norm.slice(start, end);
    const number = Number(marks[i][1]);

    const subQuestions = extractSubQuestions(segment);
    const choices = subQuestions.length ? [] : extractChoices(segment);
    // body = text before first sub-question or choice marker
    const bodyEnd = segment.search(/[（(][1-9][）)]|[①-⑩]/);
    const body = segment
      .slice(segment.indexOf(marks[i][0]) + marks[i][0].length, bodyEnd >= 0 ? bodyEnd : Math.min(segment.length, 300))
      .replace(/\s+/g, ' ').trim();

    const g = looksGarbled(segment);
    out.push({
      id: `${examId}#問${number}@${i}`,
      examId,
      subject: doc.subject,
      year: doc.year,
      round: doc.round,
      questionNumber: number,
      body: body.slice(0, 400),
      subQuestions,
      choices,
      answer: null,
      answerStatus: 'no_answer_doc',
      sourceFile: doc.file,
      ocrSuspect: g.suspect,
      ocrSuspectReasons: g.reasons,
    });
  }
  return out;
}
