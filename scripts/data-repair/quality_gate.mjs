#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// PHASE 4 — Data Quality Gate (CI). Fails the build on:
//   • any question number > 100 (artifact)
//   • out-of-range numbers (4+ digits)
//   • comprehensive unknown-domain > 10%
//   • mixed math schemas (>1 distinct)
// Exposed as runGate() for the vitest CI test + a CLI (non-zero exit on fail).
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);

function perExamRecords(root, sub) {
  const dir = path.join(root, 'dataset', sub);
  const recs = [];
  if (!exists(dir)) return recs;
  for (const y of fs.readdirSync(dir).filter((d) => /^20/.test(d))) {
    for (const f of fs.readdirSync(path.join(dir, y))) {
      if (!/^exam_.*\.json$/.test(f)) continue;
      for (const q of J(path.join(dir, y, f)).questions || []) recs.push(q);
    }
  }
  return recs;
}

export function runGate(root = process.cwd()) {
  const violations = [];
  const num = (q) => (typeof q.number === 'number' ? q.number
    : typeof q.question_number === 'number' ? q.question_number : null);

  // gather every question record across all datasets
  const all = [];
  all.push(...perExamRecords(root, 'comprehensive'));
  all.push(...perExamRecords(root, 'mathematics'));
  const cons = path.join(root, 'dataset/comprehensive/dataset_consolidated.json');
  if (exists(cons)) for (const ex of J(cons).exams || []) all.push(...(ex.questions || []));
  for (const gf of ['dataset/gold_standard/gold_standard.json', 'dataset/gold_standard/math_gold_standard.json']) {
    const p = path.join(root, gf); if (exists(p)) all.push(...(J(p).questions || []));
  }
  const rc = path.join(root, 'dataset/training/reclassified_ocr_data.json');
  if (exists(rc)) { const d = J(rc); all.push(...(d.ocr_questions || []), ...(d.vision_questions || [])); }

  // [1] number > 100 / artifacts
  const overflow = all.filter((q) => { const n = num(q); return typeof n === 'number' && n > 100; });
  if (overflow.length) violations.push({ rule: 'number_gt_100', count: overflow.length, sample: overflow.slice(0, 5).map(num) });
  const fourDigit = all.filter((q) => { const n = num(q); return typeof n === 'number' && n >= 1000; });
  if (fourDigit.length) violations.push({ rule: 'four_plus_digit_artifact', count: fourDigit.length, sample: fourDigit.slice(0, 5).map(num) });

  // [2] comprehensive unknown-domain > 10% (review_required is NOT unknown)
  const comp = perExamRecords(root, 'comprehensive');
  const unknown = comp.filter((q) => q.domain === 'unknown' || q.domain === '' || q.domain == null).length;
  const unkPct = comp.length ? (100 * unknown) / comp.length : 0;
  if (unkPct > 10) violations.push({ rule: 'comprehensive_unknown_gt_10pct', value: +unkPct.toFixed(1) });

  // [3] mixed math schemas
  const mdir = path.join(root, 'dataset/mathematics');
  const schemas = new Set();
  if (exists(mdir)) for (const y of fs.readdirSync(mdir).filter((d) => /^20/.test(d))) {
    for (const f of fs.readdirSync(path.join(mdir, y))) {
      if (!/^exam_.*\.json$/.test(f)) continue;
      const q = (J(path.join(mdir, y, f)).questions || [])[0];
      if (q) schemas.add(Object.keys(q).sort().join(','));
    }
  }
  if (schemas.size > 1) violations.push({ rule: 'mixed_math_schemas', distinct: schemas.size });

  return {
    pass: violations.length === 0,
    violations,
    metrics: {
      totalRecords: all.length,
      comprehensive_unknown_pct: +unkPct.toFixed(1),
      math_distinct_schemas: schemas.size,
      max_number: Math.max(0, ...all.map(num).filter((n) => typeof n === 'number')),
    },
  };
}

// CLI (robust to non-ASCII paths)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = runGate();
  console.log('[data-gate]', JSON.stringify(r.metrics));
  if (r.pass) { console.log('[data-gate] ✅ PASS'); process.exit(0); }
  console.error('[data-gate] ❌ FAIL:', JSON.stringify(r.violations, null, 2));
  process.exit(1);
}
