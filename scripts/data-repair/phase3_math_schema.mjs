#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// PHASE 3 — Math Schema Unification.
// Rewrites ALL dataset/mathematics/**/exam_*.json to ONE canonical schema.
// Required fields guaranteed: id, number, domain, raw_text, text,
//   answer_choices, difficulty, confidence, source (+ rich fields).
// Writes SCHEMA_MIGRATION_REPORT.md. Syncs public/ mirrors.
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);

// canonical key order (identical for every math record)
const CANONICAL = [
  'id', 'number', 'year', 'round', 'subject', 'domain', 'topic', 'subtopic',
  'raw_text', 'text', 'answer_choices', 'difficulty', 'confidence', 'ocr_confidence',
  'question_type', 'keywords', 'concepts', 'word_count', 'lines',
  'tables', 'diagrams', 'graphs', 'maps', 'source', 'flags',
];
const REQUIRED = ['id', 'number', 'domain', 'raw_text', 'text', 'answer_choices', 'difficulty', 'confidence', 'source'];

function writeAndSync(absPath, obj) {
  fs.writeFileSync(absPath, JSON.stringify(obj, null, 2));
  const rel = path.relative(ROOT, absPath);
  const mirror = path.join(ROOT, 'public', rel);
  if (exists(mirror)) fs.writeFileSync(mirror, JSON.stringify(obj, null, 2));
}

function normalizeRecord(q, year, round, idx) {
  const txt = q.text ?? q.text_snippet ?? q.raw_text ?? '';
  const raw = q.raw_text ?? q.text_snippet ?? q.text ?? '';
  const out = {
    id: q.id ?? `math_${year}_r${round}_${idx}_${crypto.randomUUID().slice(0, 8)}`,
    number: q.number ?? null,
    year: q.year ?? year,
    round: q.round ?? round,
    subject: 'mathematics',
    domain: q.domain ?? q.section ?? 'unknown',
    topic: q.topic ?? '',
    subtopic: q.subtopic ?? '',
    raw_text: raw,
    text: txt,
    answer_choices: Array.isArray(q.answer_choices) ? q.answer_choices : [],
    difficulty: typeof q.difficulty === 'number' ? q.difficulty : null,
    confidence: q.confidence ?? q.ocr_confidence ?? null,
    ocr_confidence: q.ocr_confidence ?? q.confidence ?? null,
    question_type: q.question_type ?? 'unknown',
    keywords: Array.isArray(q.keywords) ? q.keywords : [],
    concepts: Array.isArray(q.concepts) ? q.concepts : [],
    word_count: q.word_count ?? null,
    lines: q.lines ?? null,
    tables: Array.isArray(q.tables) ? q.tables : [],
    diagrams: Array.isArray(q.diagrams) ? q.diagrams : [],
    graphs: Array.isArray(q.graphs) ? q.graphs : [],
    maps: Array.isArray(q.maps) ? q.maps : [],
    source: q.source ?? 'ocr',
    flags: Array.isArray(q.flags) ? q.flags : [],
  };
  // enforce canonical key order
  const ordered = {};
  for (const k of CANONICAL) ordered[k] = out[k];
  return ordered;
}

const dir = path.join(ROOT, 'dataset/mathematics');
const report = []; // {file, before:'reduced'|'full', addedFields:[]}
let migrated = 0;

for (const y of fs.readdirSync(dir).filter((d) => /^20/.test(d))) {
  for (const f of fs.readdirSync(path.join(dir, y))) {
    if (!/^exam_.*\.json$/.test(f)) continue;
    const abs = path.join(dir, y, f);
    const doc = J(abs);
    const m = f.match(/exam_(\d{4})_r(\d)/);
    const year = Number(m?.[1] || y), round = Number(m?.[2] || 1);
    const qs = doc.questions || [];
    const beforeKeys = new Set(Object.keys(qs[0] || {}));
    const wasReduced = !beforeKeys.has('raw_text');
    doc.questions = qs.map((q, i) => normalizeRecord(q, year, round, i));
    // ensure doc-level subject present
    doc.subject = doc.subject || 'mathematics';
    writeAndSync(abs, doc);
    if (wasReduced) migrated++;
    const added = CANONICAL.filter((k) => !beforeKeys.has(k));
    report.push({ file: path.relative(ROOT, abs), before: wasReduced ? 'reduced' : 'full', records: qs.length, addedFields: added });
  }
}

// verify identical schema + required fields across all files
let schemaSet = new Set();
let requiredOK = true;
for (const y of fs.readdirSync(dir).filter((d) => /^20/.test(d))) {
  for (const f of fs.readdirSync(path.join(dir, y))) {
    if (!/^exam_.*\.json$/.test(f)) continue;
    const q = (J(path.join(dir, y, f)).questions || [])[0];
    if (!q) continue;
    schemaSet.add(Object.keys(q).join(','));
    for (const r of REQUIRED) if (!(r in q)) requiredOK = false;
  }
}

const L = [];
L.push('# SCHEMA_MIGRATION_REPORT', '');
L.push(`- Generated: ${new Date().toISOString()}`);
L.push(`- Math files processed: **${report.length}** | reduced→full migrated: **${migrated}**`);
L.push(`- Distinct schemas after migration: **${schemaSet.size}** (target: 1)`);
L.push(`- Required fields present in all: **${requiredOK ? 'YES' : 'NO'}**`);
L.push(`- Required: ${REQUIRED.join(', ')}`, '');
L.push('## Canonical schema', '', '```', CANONICAL.join(', '), '```', '');
L.push('## Migrated (reduced→full) files', '', '| file | records | fields added |', '|---|---|---|');
for (const r of report.filter((r) => r.before === 'reduced')) {
  L.push(`| ${r.file} | ${r.records} | ${r.addedFields.join(', ')} |`);
}
fs.writeFileSync(path.join(ROOT, 'SCHEMA_MIGRATION_REPORT.md'), L.join('\n'));

console.log(`[phase3] processed ${report.length} math files | migrated ${migrated} reduced→full`);
console.log(`[phase3] distinct schemas now: ${schemaSet.size} | required fields OK: ${requiredOK}`);
console.log('[phase3] wrote SCHEMA_MIGRATION_REPORT.md + synced public mirrors');
