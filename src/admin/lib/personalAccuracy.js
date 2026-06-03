// ═══════════════════════════════════════════════════════════════════
// Personal Accuracy — REAL per-topic accuracy from the user's own data.
//
// Official per-question 정답률 does NOT exist in any dataset, so we never
// fabricate one. The only real accuracy signal is the user's own answer
// history. We reuse the existing, validated buildPersonalWeaknessGraph()
// (topic nodes carry accuracy/attemptCount). Returns a Map only for topics
// the user has actually attempted; everything else stays null in the UI.
// ═══════════════════════════════════════════════════════════════════

let _cache = null;

export async function getPersonalAccuracyMap() {
  if (_cache) return _cache;
  const map = new Map(); // topicLabel → { accuracy, attemptCount, status }
  try {
    const [{ getExams }, graphMod, engineMod] = await Promise.all([
      import('../../utils/storage'),
      import('../../intelligence/personalWeaknessGraph'),
      import('../../intelligence/engineInitializer'),
    ]);
    const exams = getExams?.() || [];
    if (!exams.length) { _cache = map; return map; }
    const datasets = engineMod.getDatasetCache?.() || {};
    const graph = graphMod.buildPersonalWeaknessGraph?.(exams, datasets);
    for (const node of graph?.nodes || []) {
      if (node.type === 'topic' && node.attemptCount > 0 && node.label) {
        map.set(node.label, {
          accuracy: node.accuracy,
          attemptCount: node.attemptCount,
          correctCount: node.correctCount,
          status: node.status,
        });
      }
    }
  } catch {
    // best-effort: if anything is unavailable, return empty (no fake numbers)
  }
  _cache = map;
  return map;
}

export function clearPersonalAccuracyCache() { _cache = null; }
