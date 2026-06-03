#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// PHASE 2 — Domain Recovery for unknown-domain comprehensive questions.
//   confidence ≥ 0.8 → assign predicted domain (+flag domain_recovered)
//   else            → domain = 'review_required' (+flag domain_review_required)
// Writes DOMAIN_RECOVERY_REPORT.md. Syncs public/ mirrors.
// Run with: npx tsx scripts/data-repair/phase2_domain_recovery.mjs
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { classifyDomain } from './lib/domainClassifier.mjs';

const ROOT = process.cwd();
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);
const THRESHOLD = 0.8;

function writeAndSync(absPath, obj) {
  fs.writeFileSync(absPath, JSON.stringify(obj, null, 2));
  const rel = path.relative(ROOT, absPath);
  let mirror = null;
  if (rel.startsWith('dataset/')) mirror = path.join(ROOT, 'public', rel);
  if (mirror && exists(mirror)) fs.writeFileSync(mirror, JSON.stringify(obj, null, 2));
}

const isUnknown = (d) => d === undefined || d === null || d === '' || d === 'unknown';
const conf = []; // confidences of attempted recoveries
let recovered = 0, review = 0, attempted = 0;
const recoveredByDomain = {};

function processRecord(rec) {
  if (!isUnknown(rec.domain)) return;
  attempted++;
  const text = rec.text || rec.raw_text || rec.text_snippet || '';
  const { predicted_domain, confidence } = classifyDomain(text);
  conf.push(confidence);
  if (!Array.isArray(rec.flags)) rec.flags = [];
  if (confidence >= THRESHOLD && predicted_domain !== 'unknown') {
    rec.domain = predicted_domain;
    rec.domain_confidence = confidence;
    if (!rec.flags.includes('domain_recovered')) rec.flags.push('domain_recovered');
    recovered++;
    recoveredByDomain[predicted_domain] = (recoveredByDomain[predicted_domain] || 0) + 1;
  } else {
    rec.domain = 'review_required';
    rec.domain_confidence = confidence;
    if (!rec.flags.includes('domain_review_required')) rec.flags.push('domain_review_required');
    review++;
  }
}

// targets: per-exam comprehensive + consolidated
const compDir = path.join(ROOT, 'dataset/comprehensive');
for (const y of fs.readdirSync(compDir).filter((d) => /^20/.test(d))) {
  for (const f of fs.readdirSync(path.join(compDir, y))) {
    if (!/^exam_.*\.json$/.test(f)) continue;
    const abs = path.join(compDir, y, f);
    const doc = J(abs);
    const before = JSON.stringify(doc);
    for (const q of doc.questions || []) processRecord(q);
    if (JSON.stringify(doc) !== before) writeAndSync(abs, doc);
  }
}
const consPath = path.join(ROOT, 'dataset/comprehensive/dataset_consolidated.json');
if (exists(consPath)) {
  const doc = J(consPath);
  const before = JSON.stringify(doc);
  for (const ex of doc.exams || []) for (const q of ex.questions || []) processRecord(q);
  if (JSON.stringify(doc) !== before) writeAndSync(consPath, doc);
}

// confidence distribution
const buckets = { '0.0-0.2': 0, '0.2-0.4': 0, '0.4-0.6': 0, '0.6-0.8': 0, '0.8-1.0': 0 };
for (const c of conf) {
  if (c < 0.2) buckets['0.0-0.2']++;
  else if (c < 0.4) buckets['0.2-0.4']++;
  else if (c < 0.6) buckets['0.4-0.6']++;
  else if (c < 0.8) buckets['0.6-0.8']++;
  else buckets['0.8-1.0']++;
}

const L = [];
L.push('# DOMAIN_RECOVERY_REPORT', '');
L.push(`- Generated: ${new Date().toISOString()}`);
L.push(`- Classifier: project subjectClassifier; confidence = share × evidence-saturation; threshold = ${THRESHOLD}`, '');
L.push('## Summary', '');
L.push(`- Unknown-domain questions attempted: **${attempted}**`);
L.push(`- Recovered (confidence ≥ ${THRESHOLD}): **${recovered}**`);
L.push(`- Remaining (review_required): **${review}**`, '');
L.push('## Recovered by domain', '', '| domain | count |', '|---|---|');
for (const [d, n] of Object.entries(recoveredByDomain).sort((a, b) => b[1] - a[1])) L.push(`| ${d} | ${n} |`);
L.push('', '## Confidence distribution', '', '| bucket | count |', '|---|---|');
for (const [b, n] of Object.entries(buckets)) L.push(`| ${b} | ${n} |`);
fs.writeFileSync(path.join(ROOT, 'DOMAIN_RECOVERY_REPORT.md'), L.join('\n'));

console.log(`[phase2] attempted: ${attempted} | recovered: ${recovered} | review_required: ${review}`);
console.log(`[phase2] confidence buckets: ${JSON.stringify(buckets)}`);
console.log('[phase2] wrote DOMAIN_RECOVERY_REPORT.md + synced public mirrors');
