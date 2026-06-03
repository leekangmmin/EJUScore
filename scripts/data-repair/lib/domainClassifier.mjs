// ═══════════════════════════════════════════════════════════════════
// Confidence-based domain classifier (wraps the project's REAL classifier).
// confidence = share(top/total keyword score) × saturation(absolute evidence).
// Honest: low-evidence text yields low confidence → review_required.
// ═══════════════════════════════════════════════════════════════════
import { scoreSubjects, SUBJECT_PRIORITY } from '../../../src/utils/subjectClassifier.js';

export function classifyDomain(text) {
  const scores = scoreSubjects(text || '');
  let best = 'unknown', bestScore = 0, sum = 0;
  for (const d of SUBJECT_PRIORITY) {
    const v = scores[d] || 0;
    sum += v;
    if (v > bestScore) { bestScore = v; best = d; }
  }
  const share = sum > 0 ? bestScore / sum : 0;
  const evidence = Math.min(1, bestScore / 4); // saturate ~4 keyword-weight
  const confidence = +(share * evidence).toFixed(3);
  return { predicted_domain: sum > 0 ? best : 'unknown', confidence, share: +share.toFixed(3), bestScore };
}
