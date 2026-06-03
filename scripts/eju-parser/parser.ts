// ═══════════════════════════════════════════════════════════════════
// OCR Parser — classify each OCR'd PDF into exam metadata.
// Primary signal: the filename/path (encodes subject/year/round/type).
// Cross-check: document header text (問題用紙 / 正解表 / 聴解 / 作文).
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { nfkc, toAsciiDigits } from './normalize';
import type { SourceDoc, Subject, DocType } from './model';

export const DEFAULT_INPUT = path.resolve(process.cwd(), '../eju-test/ocr_output.json');

export interface OcrEntry { file: string; text: string; }

export function loadOcrOutput(input: string = process.env.EJU_OCR_INPUT || DEFAULT_INPUT): OcrEntry[] {
  const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('ocr_output.json must be an array of {file,text}');
  return raw;
}

// ── subject ────────────────────────────────────────────────
export function detectSubject(file: string, text = ''): Subject {
  const f = file;
  if (/数学|수학|\bmath/i.test(f)) return 'mathematics';
  if (/日本语|日本語|読解|聴解|记述|記述|作文|听力|日语|EJU日本/i.test(f)) return 'japanese';
  if (/文综|종합|総合科目|総合/i.test(f)) return 'comprehensive';
  // header fallback
  if (/数学|微分|積分|ベクトル/.test(text)) return 'mathematics';
  if (/読解|聴解|記述/.test(text)) return 'japanese';
  if (/総合科目/.test(text)) return 'comprehensive';
  return 'unknown';
}

// ── document type ──────────────────────────────────────────
export function detectDocType(file: string, text = ''): DocType {
  const f = file;
  if (/答案|解答|正解|正答|解説|得分标准/i.test(f)) return 'answer';
  if (/聴解|听力|スクリプト|听解|音声|听力原文/i.test(f)) return 'listening';
  if (/作文|記述|记述/i.test(f)) return 'essay';
  if (/真题|問題|问题|过去問|過去問/i.test(f)) return 'problem';
  // header fallback
  if (/正\s*解\s*表|解答用紙|正答/.test(text)) return 'answer';
  if (/聴\s*解/.test(text)) return 'listening';
  if (/問題用紙/.test(text)) return 'problem';
  return 'other';
}

// ── year / era ─────────────────────────────────────────────
const ERA_BASE: Record<string, number> = { 令和: 2018, 平成: 1988, 昭和: 1925 };

export function detectYear(file: string, text = ''): { year: number | null; era: string | null } {
  const src = nfkc(file);
  // western 4-digit
  const w = src.match(/(19|20)\d{2}/);
  // era
  const e = src.match(/(令和|平成|昭和)\s*([0-9]{1,2})/);
  let year = w ? Number(w[0]) : null;
  let era = e ? `${e[1]}${e[2]}` : null;
  if (year == null && e) year = ERA_BASE[e[1]] + Number(e[2]);
  if (year == null) { // header fallback
    const wt = nfkc(text).match(/(19|20)\d{2}\s*年/);
    if (wt) year = Number(wt[0].match(/\d{4}/)![0]);
  }
  return { year, era };
}

// ── round ──────────────────────────────────────────────────
const CJK_NUM: Record<string, number> = { 一: 1, 二: 2, 三: 3 };
export function detectRound(file: string, text = ''): number | null {
  const src = nfkc(file);
  const m = src.match(/第\s*([0-9一二三])\s*回/);
  if (m) return CJK_NUM[m[1]] ?? Number(m[1]);
  const t = nfkc(text).match(/第\s*([0-9一二三])\s*回/);
  if (t) return CJK_NUM[t[1]] ?? Number(t[1]);
  return null;
}

// ── course (math 1/2, japanese section) ────────────────────
export function detectCourse(file: string, subject: Subject): string | null {
  const f = nfkc(file);
  if (subject === 'mathematics') {
    const m = f.match(/数学\s*([12２１])|コース\s*([12２１])|course\s*([12])/i);
    if (m) return toAsciiDigits(m[1] || m[2] || m[3] || '');
    return null;
  }
  if (subject === 'japanese') {
    if (/聴解|听力/.test(f)) return '聴解';
    if (/読解/.test(f)) return '読解';
    if (/記述|作文/.test(f)) return '記述';
  }
  return null;
}

// ── full classify ──────────────────────────────────────────
export function classifyDoc(entry: OcrEntry): SourceDoc {
  const { file, text = '' } = entry;
  const basename = file.split('/').pop() || file;
  const subject = detectSubject(file, text);
  const docType = detectDocType(file, text);
  const { year, era } = detectYear(file, text);
  const round = detectRound(file, text);
  const course = detectCourse(file, subject);

  // confidence: filename-derived signals are high-confidence
  let signals = 0;
  if (subject !== 'unknown') signals++;
  if (docType !== 'other') signals++;
  if (year != null) signals++;
  if (round != null) signals++;
  const metaConfidence = Math.min(1, signals / 4 + 0.0);

  return { file, basename, subject, year, era, round, docType, course, textLength: text.length, metaConfidence };
}

export function parseAll(entries: OcrEntry[]): SourceDoc[] {
  return entries.map(classifyDoc);
}
