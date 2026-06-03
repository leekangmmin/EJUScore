// ═══════════════════════════════════════════════════════════════════════
// Text Match — OCR-tolerant normalization + fuzzy substring matching.
//
// DeepSeek audit [Critical #2]: concept detection used exact text.includes(),
// which breaks on OCR noise (1–2 char errors), full/half-width (全角/半角)
// variance, and Unicode form differences. This module provides:
//   • normalizeText()  — NFKC (folds 全角⇄半角) + case-fold + space-strip
//   • makeFuzzyMatcher() — closure over one normalized haystack, reused for
//     many needles; exact fast-path, then bounded fuzzy-substring fallback
//     allowing 1–2 OCR character errors (length-scaled).
//
// Pure JS, no new dependency. O(needle × haystack) per fuzzy check, only
// taken when the exact fast-path misses.
// ═══════════════════════════════════════════════════════════════════════

/** NFKC normalize, fold case, strip whitespace (OCR spacing is unreliable). */
export function normalizeText(s) {
  if (!s) return '';
  let out;
  try { out = String(s).normalize('NFKC'); } catch { out = String(s); }
  return out.toLowerCase().replace(/\s+/g, '');
}

/** Allowed OCR errors scaled by needle length (short terms get no slack). */
export function maxErrorsFor(len) {
  if (len <= 2) return 0;
  if (len <= 5) return 1;
  return 2;
}

/**
 * Minimum edit distance treating `pattern` as a substring of `text`
 * (row-0 = 0 → the match may start at any offset). O(|pattern|·|text|).
 */
function fuzzySubstringDistance(text, pattern) {
  const n = pattern.length;
  const m = text.length;
  if (n === 0) return 0;
  if (m === 0) return n;
  let prev = new Array(m + 1).fill(0); // allow start anywhere
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1);
    cur[0] = i;
    const pc = pattern.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const cost = pc === text.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = cur[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      cur[j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
    }
    prev = cur;
  }
  let min = prev[0];
  for (let j = 1; j <= m; j++) if (prev[j] < min) min = prev[j];
  return min;
}

/**
 * Build a reusable matcher over one text. Returns (needle, maxErrors?) → bool.
 * Exact (normalized) substring is the fast path; otherwise bounded fuzzy.
 */
export function makeFuzzyMatcher(text) {
  const H = normalizeText(text);
  return (needle, maxErrors) => {
    const N = normalizeText(needle);
    if (!N) return false;
    if (H.includes(N)) return true;                 // exact (post-normalize)
    const k = maxErrors == null ? maxErrorsFor(N.length) : maxErrors;
    if (k <= 0 || N.length < 3) return false;       // too short to fuzz safely
    return fuzzySubstringDistance(H, N) <= k;
  };
}

/** One-shot convenience (normalizes the haystack each call). */
export function fuzzyIncludes(haystack, needle, maxErrors) {
  return makeFuzzyMatcher(haystack)(needle, maxErrors);
}

export default { normalizeText, makeFuzzyMatcher, fuzzyIncludes, maxErrorsFor };
