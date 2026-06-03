// ═══════════════════════════════════════════════════════════════════
// OCR normalization & error tolerance.
//
// Findings-driven (real data): 間+digit appears 565× as a mis-OCR of 問;
// answer tables mix 問/間. Plus full/half-width variance and stray noise.
//   • NFKC folds 全角⇄半角.
//   • 間/同 + digit → 問 + digit  (the systematic confusion).
//   • collapse junk whitespace.
// ═══════════════════════════════════════════════════════════════════

/** NFKC normalize (folds 全角/半角); never throws. */
export function nfkc(s: string): string {
  try { return s.normalize('NFKC'); } catch { return s; }
}

/**
 * Repair the 問 mis-OCR family in question-marker context only:
 *   間 12 / 同 3  →  問 12 / 問 3   (when immediately followed by a number)
 * Context-guarded so real words (時間, 同じ) are untouched — they are not
 * followed by a bare digit.
 */
export function fixMonMarkers(s: string): string {
  return s.replace(/[間同]\s*([0-9０-９]{1,2})/g, '問$1');
}

/** Full OCR normalization used before extraction. */
export function normalizeOcr(s: string): string {
  if (!s) return '';
  let t = nfkc(s);
  t = fixMonMarkers(t);
  // collapse 3+ identical punctuation/space runs that confuse splitting
  t = t.replace(/[ \t　]{2,}/g, ' ');
  return t;
}

/** Convert full-width digits to ASCII for numeric parsing. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[０-９]/g, (d) => String('０１２３４５６７８９'.indexOf(d)));
}

/** Heuristic: does a text span look like OCR garbage? (for ocrSuspect flag) */
export function looksGarbled(s: string): { suspect: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const chars = [...s].filter((c) => !/\s/.test(c));
  if (chars.length === 0) return { suspect: true, reasons: ['empty'] };
  const meaningful = chars.filter((c) => /[぀-ゟ゠-ヿ一-鿿가-힣A-Za-z0-9]/.test(c)).length;
  const ratio = meaningful / chars.length;
  if (ratio < 0.6) reasons.push('low_meaningful_ratio');
  // repeated short n-gram noise (バーバー…) or long dash runs
  if (/(.)\1{4,}/.test(s)) reasons.push('long_run');
  if (/(..)\1{2,}/.test(s)) reasons.push('repeated_ngram');
  return { suspect: reasons.length > 0, reasons };
}
