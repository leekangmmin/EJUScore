#!/usr/bin/env node
// Part 3 + 4: cluster review_required records by failure cause, estimate
// recoverability, and emit a ranked re-OCR priority list.
import fs from 'node:fs';
import path from 'node:path';
import { analyzeText } from '../audit/ocrQuality.mjs';

const ROOT = process.cwd();
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// gather review_required records WITH provenance
const recs = [];
const dir = path.join(ROOT, 'dataset/comprehensive');
for (const y of fs.readdirSync(dir).filter((d) => /^20/.test(d))) {
  for (const f of fs.readdirSync(path.join(dir, y))) {
    if (!/^exam_.*\.json$/.test(f)) continue;
    const rel = path.join('dataset/comprehensive', y, f);
    for (const q of J(path.join(ROOT, rel)).questions || []) {
      if (q.domain === 'review_required') recs.push({ q, file: rel });
    }
  }
}

// recoverability = expected benefit of *re-OCR* specifically (estimate).
// classifier_gap is NOT an OCR problem → re-OCR ≈ no benefit (needs a better classifier).
const RECOVER = {
  missing_segmentation: 0.85,
  ocr_garbage: 0.65,
  table_chart_extraction_failure: 0.45,
  image_only_content: 0.40,
  mathematical_formula_loss: 0.40,
  classifier_gap: 0.05, // clean text the keyword classifier missed → re-OCR won't help
};

function classify(q) {
  const text = q.text || q.raw_text || '';
  const a = analyzeText(text);
  const hasMaterial = (q.tables || []).length + (q.diagrams || []).length + (q.graphs || []).length + (q.maps || []).length > 0;
  const refsMaterial = /表|グラフ|図|地図|グラフ中|次の図/.test(text);
  const mathy = /[=＝∫∑√]|方程式|関数|[0-9]\s*[+\-×÷]\s*[0-9]/.test(text);
  // repeated-noise garbage (バーバーバー / ーーーー); space-safe to avoid
  // matching table-layout whitespace runs.
  const compact = text.replace(/\s+/g, '');
  const repeatedNoise = /(.)\1{6,}/.test(compact) || /(..)\1{4,}/.test(compact);
  const reasons = [];
  let cause;

  if (repeatedNoise || a.brokenRatio > 0.35 || a.meaningfulRatio < 0.5) {
    cause = 'ocr_garbage';
    reasons.push(repeatedNoise ? 'repeated_noise' : `broken=${a.brokenRatio.toFixed(2)}`, `meaningful=${a.meaningfulRatio.toFixed(2)}`);
  } else if (a.length < 8) {
    cause = hasMaterial ? 'image_only_content' : 'missing_segmentation';
    reasons.push('text_too_short'); if (hasMaterial) reasons.push('has_material');
  } else if (a.length < 30) {
    cause = 'missing_segmentation'; reasons.push('fragment_<30chars'); // header/instruction stub
  } else if (hasMaterial && refsMaterial && a.length < 60) {
    cause = 'table_chart_extraction_failure'; reasons.push('material+reference+shorttext');
  } else if (mathy && a.brokenRatio > 0.2) {
    cause = 'mathematical_formula_loss'; reasons.push('formula_garbled');
  } else {
    // clean, substantive text the keyword classifier could not label → NOT an OCR issue
    cause = 'classifier_gap'; reasons.push('clean_content_classifier_miss');
  }

  const badness = Math.max(1 - a.meaningfulRatio, a.length < 15 ? 0.8 : 0);
  const recoverability = RECOVER[cause];
  const priority = +(recoverability * badness).toFixed(3);
  return { cause, reasons, quality: +a.meaningfulRatio.toFixed(2), brokenRatio: +a.brokenRatio.toFixed(2), length: a.length, hasMaterial, recoverability, badness: +badness.toFixed(2), priority };
}

const clusters = {};
const ranked = [];
for (const { q, file } of recs) {
  const c = classify(q);
  clusters[c.cause] = clusters[c.cause] || { count: 0, recoverability: c.recoverability, sumPriority: 0 };
  clusters[c.cause].count++;
  clusters[c.cause].sumPriority += c.priority;
  ranked.push({
    id: q.id, year: q.year, round: q.round, number: q.number, file,
    cause: c.cause, recoverability: c.recoverability, priority: c.priority,
    quality: c.quality, brokenRatio: c.brokenRatio, length: c.length, hasMaterial: c.hasMaterial,
    reasons: c.reasons, textPreview: (q.text || q.raw_text || '').slice(0, 80),
  });
}
ranked.sort((a, b) => b.priority - a.priority);

// expected recovery = sum(recoverability) across all (estimated # that re-OCR could fix)
const expectedRecoverable = Math.round(ranked.reduce((s, r) => s + r.recoverability, 0));

// ── REOCR_PRIORITY_LIST.json ───────────────────────────────
fs.writeFileSync(path.join(ROOT, 'REOCR_PRIORITY_LIST.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'dataset/comprehensive/** review_required records',
  total: ranked.length,
  estimatedRecoverable: expectedRecoverable,
  scoring: 'priority = recoverability(cause) × badness(1 − meaningful_ratio, min 0.8 if text<15chars)',
  records: ranked,
}, null, 2));

// ── REVIEW_REQUIRED_ANALYSIS.md ────────────────────────────
const L = [];
L.push('# REVIEW_REQUIRED_ANALYSIS', '');
L.push(`- Generated: ${new Date().toISOString()}`);
L.push(`- review_required records analyzed: **${ranked.length}** (dataset/comprehensive/**)`, '');
L.push('## Cluster by failure cause', '', '| cause | count | est. recoverability | est. recoverable |', '|---|---|---|---|');
for (const [c, v] of Object.entries(clusters).sort((a, b) => b[1].count - a[1].count)) {
  L.push(`| ${c} | ${v.count} | ${v.recoverability} | ~${Math.round(v.count * v.recoverability)} |`);
}
L.push(`| **TOTAL** | **${ranked.length}** | — | **~${expectedRecoverable}** |`, '');
const classifierGap = clusters.classifier_gap?.count || 0;
L.push('## Recoverability estimate (honest)', '');
L.push(`- Of ${ranked.length} review_required, **~${expectedRecoverable} (${Math.round(100 * expectedRecoverable / ranked.length)}%)** could plausibly be recovered by higher-quality **re-OCR** (engine/segmentation), per the per-cause assumptions above — **an estimate, not a guarantee**.`);
L.push(`- ⚠️ **Key finding:** **${classifierGap}** records (**${Math.round(100 * classifierGap / ranked.length)}%**) are \`classifier_gap\` — *clean, substantive text* that the keyword classifier failed to label (e.g. 桑畑/標準時/島国 not in the lexicon). **These are NOT OCR failures; re-OCR will not help them.** The real fix is a better classifier (expanded lexicon or LLM classification). They are deliberately given low re-OCR priority.`, '');
L.push('## Cause definitions', '');
L.push('- **ocr_garbage**: broken-char ratio > 0.30, meaningful ratio < 0.55, or repeated-noise runs (バーバー/ーーー)');
L.push('- **missing_segmentation**: text < 30 chars — a header/instruction fragment, not a full question');
L.push('- **image_only_content**: text < 8 chars but a table/diagram/graph/map is present (content is in the image)');
L.push('- **table_chart_extraction_failure**: material present + references 表/グラフ/図 but short/unusable text');
L.push('- **mathematical_formula_loss**: formula tokens present but garbled');
L.push('- **classifier_gap**: clean substantive text the keyword classifier could not label — **not an OCR problem**', '');
L.push('## Top 15 re-OCR candidates (see REOCR_PRIORITY_LIST.json for full ranked list)', '');
L.push('| priority | cause | year/round | quality | text preview |', '|---|---|---|---|---|');
for (const r of ranked.slice(0, 15)) {
  L.push(`| ${r.priority} | ${r.cause} | ${r.year}/${r.round} | ${r.quality} | ${r.textPreview.replace(/\|/g, '/').slice(0, 40)} |`);
}
fs.writeFileSync(path.join(ROOT, 'REVIEW_REQUIRED_ANALYSIS.md'), L.join('\n'));

console.log('[review-analysis] clusters:', JSON.stringify(Object.fromEntries(Object.entries(clusters).map(([k, v]) => [k, v.count]))));
console.log('[review-analysis] estimatedRecoverable:', expectedRecoverable, '/', ranked.length);
console.log('[review-analysis] wrote REVIEW_REQUIRED_ANALYSIS.md + REOCR_PRIORITY_LIST.json');
