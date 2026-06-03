#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// PHASE 1 — Question Number Integrity.
// Cleans `number`/`question_number` across all affected datasets:
//   invalid (artifact/out-of-range) OR duplicate-in-exam → null + flag.
// Writes QUESTION_NUMBER_MIGRATION_REPORT.md. Syncs public/ mirrors.
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { repairGroup } from './lib/questionNumberValidator.mjs';

const ROOT = process.cwd();
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);

const allChanges = [];
const fileStats = []; // {file, records, changed}

function writeAndSync(absPath, obj) {
  fs.writeFileSync(absPath, JSON.stringify(obj, null, 2));
  const rel = path.relative(ROOT, absPath);
  // sync dataset/** ↔ public/dataset/**
  let mirror = null;
  if (rel.startsWith('dataset/')) mirror = path.join(ROOT, 'public', rel);
  else if (rel.startsWith('public/dataset/')) mirror = path.join(ROOT, rel.replace(/^public\//, ''));
  if (mirror && exists(mirror)) fs.writeFileSync(mirror, JSON.stringify(obj, null, 2));
}

function perExam(dir, subject) {
  if (!exists(dir)) return;
  for (const y of fs.readdirSync(dir).filter((d) => /^20/.test(d))) {
    for (const f of fs.readdirSync(path.join(dir, y))) {
      if (!/^exam_.*\.json$/.test(f)) continue;
      const abs = path.join(dir, y, f);
      const doc = J(abs);
      const qs = doc.questions || [];
      const ch = repairGroup(qs, {
        getNum: (r) => r.number, setNum: (r, v) => { r.number = v; },
        subject, file: path.relative(ROOT, abs), idOf: (r) => r.id ?? null,
      });
      if (ch.length) { allChanges.push(...ch); writeAndSync(abs, doc); }
      fileStats.push({ file: path.relative(ROOT, abs), records: qs.length, changed: ch.length });
    }
  }
}

function consolidated(file, subject) {
  if (!exists(file)) return;
  const doc = J(file);
  let changed = 0, recs = 0;
  for (const ex of doc.exams || []) {
    const qs = ex.questions || []; recs += qs.length;
    const ch = repairGroup(qs, {
      getNum: (r) => r.number, setNum: (r, v) => { r.number = v; },
      subject, file: `${path.relative(ROOT, file)}#${ex.year}_r${ex.round}`, idOf: (r) => r.id ?? null,
    });
    allChanges.push(...ch); changed += ch.length;
  }
  if (changed) writeAndSync(file, doc);
  fileStats.push({ file: path.relative(ROOT, file), records: recs, changed });
}

function flatGrouped(file, arrKeys, numField, subject) {
  if (!exists(file)) return;
  const doc = J(file);
  let changed = 0, recs = 0;
  for (const key of arrKeys) {
    const arr = doc[key]; if (!Array.isArray(arr)) continue;
    recs += arr.length;
    // group by (year, round)
    const groups = new Map();
    for (const r of arr) {
      const gk = `${r.year}_${r.round}`;
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk).push(r);
    }
    for (const [gk, recsInGroup] of groups) {
      const ch = repairGroup(recsInGroup, {
        getNum: (r) => r[numField], setNum: (r, v) => { r[numField] = v; },
        subject, file: `${path.relative(ROOT, file)}#${key}#${gk}`, idOf: (r) => r.id ?? null,
      });
      allChanges.push(...ch); changed += ch.length;
    }
  }
  if (changed) writeAndSync(file, doc);
  fileStats.push({ file: path.relative(ROOT, file), records: recs, changed });
}

// ── targets ────────────────────────────────────────────────
perExam(path.join(ROOT, 'dataset/comprehensive'), 'comprehensive');
perExam(path.join(ROOT, 'dataset/mathematics'), 'mathematics');
consolidated(path.join(ROOT, 'dataset/comprehensive/dataset_consolidated.json'), 'comprehensive');
flatGrouped(path.join(ROOT, 'dataset/gold_standard/gold_standard.json'), ['questions'], 'question_number', 'comprehensive');
flatGrouped(path.join(ROOT, 'dataset/gold_standard/math_gold_standard.json'), ['questions'], 'question_number', 'mathematics');
flatGrouped(path.join(ROOT, 'dataset/training/reclassified_ocr_data.json'), ['ocr_questions', 'vision_questions'], 'question_number', 'comprehensive');

// ── migration report ───────────────────────────────────────
const byReason = {};
for (const c of allChanges) byReason[c.reason] = (byReason[c.reason] || 0) + 1;

const L = [];
L.push('# QUESTION_NUMBER_MIGRATION_REPORT', '');
L.push(`- Generated: ${new Date().toISOString()}`);
L.push(`- Total records changed: **${allChanges.length}**`);
L.push(`- Validator ranges: comprehensive 1–38, mathematics 1–27, japanese 1–60`, '');
L.push('## Changes by reason', '');
L.push('| reason | count |', '|---|---|');
for (const [r, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) L.push(`| ${r} | ${n} |`);
L.push('', '## Per-file summary (changed only)', '');
L.push('| file | records | changed |', '|---|---|---|');
for (const f of fileStats.filter((f) => f.changed > 0).sort((a, b) => b.changed - a.changed)) {
  L.push(`| ${f.file} | ${f.records} | ${f.changed} |`);
}
L.push('', '## Full change log (old → new)', '');
L.push('| file/group | id | old | new | reason | subject |', '|---|---|---|---|---|---|');
for (const c of allChanges.slice(0, 400)) {
  L.push(`| ${c.file} | ${(c.id || '').slice(0, 8)} | ${c.oldNumber} | ${c.newNumber} | ${c.reason} | ${c.subject} |`);
}
if (allChanges.length > 400) L.push(`| … | | | | (+${allChanges.length - 400} more) | |`);
fs.writeFileSync(path.join(ROOT, 'QUESTION_NUMBER_MIGRATION_REPORT.md'), L.join('\n'));

console.log(`[phase1] records changed: ${allChanges.length} | by reason: ${JSON.stringify(byReason)}`);
console.log('[phase1] wrote QUESTION_NUMBER_MIGRATION_REPORT.md + synced public mirrors');
