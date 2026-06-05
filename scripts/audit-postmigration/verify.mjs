#!/usr/bin/env node
// Independent migration verification: reproduce Phase 1–4 metrics AND
// diff backup→current field-by-field to detect accidental corruption.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BK = (fs.existsSync('/tmp/eju_backup_dir.txt')
  ? fs.readFileSync('/tmp/eju_backup_dir.txt', 'utf8').trim()
  : path.join(ROOT, fs.readdirSync(path.join(ROOT, 'dataset')).filter((d) => d.startsWith('_backup_repair_')).sort().pop()));
const BKDIR = path.isAbsolute(BK) ? BK : path.join(ROOT, BK);
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const S = JSON.stringify;
const out = { backup: path.relative(ROOT, BKDIR) };

// ── Retired post-diet: the legacy per-exam source (dataset/comprehensive)
// was intentionally removed in the dist-diet. This one-time migration audit
// no longer applies; exit 0 so it is not a false deploy gate. ──────────────
if (!fs.existsSync(path.join(ROOT, 'dataset/comprehensive'))) {
  console.log('[verify] SKIPPED — legacy source dataset/comprehensive removed (dist-diet). '
    + 'Migration was verified at v1.1.x; this audit is retired. (exit 0)');
  process.exit(0);
}

// ── helper: list per-exam files relative ───────────────────
function perExamFiles(base) {
  const dir = path.join(base, 'dataset/comprehensive');
  const files = [];
  for (const y of fs.readdirSync(dir).filter((d) => /^20/.test(d)))
    for (const f of fs.readdirSync(path.join(dir, y)))
      if (/^exam_.*\.json$/.test(f)) files.push(path.join('dataset/comprehensive', y, f));
  return files;
}

// ── corruption diff: comprehensive per-exam (match by id) ──
const EXPECTED_MODIFIED = new Set(['number', 'domain']);
const EXPECTED_ADDED = new Set(['flags', 'domain_confidence']);
const unexpected = {}; // key -> count
let recBefore = 0, recAfter = 0, idMismatchFiles = 0, modifiedKeyHist = {};
for (const rel of perExamFiles(BKDIR)) {
  const before = J(path.join(BKDIR, rel)).questions || [];
  const cur = J(path.join(ROOT, rel)).questions || [];
  recBefore += before.length; recAfter += cur.length;
  if (before.length !== cur.length) idMismatchFiles++;
  const curById = new Map(cur.map((r) => [r.id, r]));
  for (const b of before) {
    const a = curById.get(b.id);
    if (!a) { unexpected['__record_lost__'] = (unexpected['__record_lost__'] || 0) + 1; continue; }
    const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
    for (const k of keys) {
      const inB = k in b, inA = k in a;
      if (inB && inA && S(b[k]) !== S(a[k])) {
        modifiedKeyHist[k] = (modifiedKeyHist[k] || 0) + 1;
        if (!EXPECTED_MODIFIED.has(k)) unexpected[k] = (unexpected[k] || 0) + 1;
      } else if (!inB && inA) {
        if (!EXPECTED_ADDED.has(k)) unexpected[`+${k}`] = (unexpected[`+${k}`] || 0) + 1;
      } else if (inB && !inA) {
        unexpected[`-${k}`] = (unexpected[`-${k}`] || 0) + 1;
      }
    }
  }
}
out.comprehensive_corruption = {
  recordsBefore: recBefore, recordsAfter: recAfter, recordCountChanged: recBefore !== recAfter,
  modifiedKeyHistogram: modifiedKeyHist,
  unexpectedChanges: unexpected, // MUST be empty for a clean migration
};

// ── reproduce Phase 1 metrics (current) ────────────────────
function flatComp(base) {
  const out = [];
  for (const rel of perExamFiles(base)) for (const q of J(path.join(base, rel)).questions || []) out.push(q);
  return out;
}
const compNow = flatComp(ROOT);
out.phase1 = {
  number_eq_1: compNow.filter((q) => q.number === 1).length,
  artifacts_gt_100: compNow.filter((q) => typeof q.number === 'number' && q.number > 100).length,
  number_null: compNow.filter((q) => q.number === null).length,
  flag_invalid_qnum: compNow.filter((q) => (q.flags || []).includes('invalid_question_number')).length,
  max_number: Math.max(...compNow.map((q) => q.number).filter((n) => typeof n === 'number')),
};

// ── reproduce Phase 2 metrics (current) ────────────────────
const VALID = ['economy', 'politics', 'history', 'geography', 'society'];
out.phase2 = {
  unknown: compNow.filter((q) => q.domain === 'unknown').length,
  review_required: compNow.filter((q) => q.domain === 'review_required').length,
  recovered_flag: compNow.filter((q) => (q.flags || []).includes('domain_recovered')).length,
  valid_domain: compNow.filter((q) => VALID.includes(q.domain)).length,
};

// ── Phase 3: math schema + value preservation ──────────────
function mathFiles(base) {
  const dir = path.join(base, 'dataset/mathematics'); const fl = [];
  for (const y of fs.readdirSync(dir).filter((d) => /^20/.test(d)))
    for (const f of fs.readdirSync(path.join(dir, y))) if (/^exam_.*\.json$/.test(f)) fl.push(path.join('dataset/mathematics', y, f));
  return fl;
}
const schemas = new Set();
let mathRecBefore = 0, mathRecAfter = 0, topicPreserved = 0, topicTotal = 0;
for (const rel of mathFiles(ROOT)) {
  const cur = J(path.join(ROOT, rel)).questions || [];
  if (cur[0]) schemas.add(Object.keys(cur[0]).sort().join(','));
  const before = J(path.join(BKDIR, rel)).questions || [];
  mathRecBefore += before.length; mathRecAfter += cur.length;
  // value preservation by index (reduced files had no id)
  for (let i = 0; i < Math.min(before.length, cur.length); i++) {
    const bt = before[i].topic, ct = cur[i].topic;
    if (bt != null) { topicTotal++; if (bt === ct) topicPreserved++; }
  }
}
out.phase3 = {
  distinct_schemas: schemas.size,
  recordsBefore: mathRecBefore, recordsAfter: mathRecAfter, recordCountChanged: mathRecBefore !== mathRecAfter,
  topic_preserved: `${topicPreserved}/${topicTotal}`,
};

// ── gold_standard corruption (field diff by question_number+year+round? use index) ──
const gsB = J(path.join(BKDIR, 'dataset/gold_standard/gold_standard.json')).questions;
const gsA = J(path.join(ROOT, 'dataset/gold_standard/gold_standard.json')).questions;
let gsUnexpected = {};
for (let i = 0; i < Math.min(gsB.length, gsA.length); i++) {
  const b = gsB[i], a = gsA[i];
  for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (k in b && k in a && S(b[k]) !== S(a[k]) && k !== 'question_number') gsUnexpected[k] = (gsUnexpected[k] || 0) + 1;
    if (!(k in b) && k in a && !EXPECTED_ADDED.has(k)) gsUnexpected[`+${k}`] = (gsUnexpected[`+${k}`] || 0) + 1;
  }
}
out.gold_standard = {
  recordsBefore: gsB.length, recordsAfter: gsA.length, recordCountChanged: gsB.length !== gsA.length,
  max_qnum: Math.max(...gsA.map((q) => q.question_number).filter((n) => typeof n === 'number')),
  unexpectedChanges: gsUnexpected,
};

// ── public vs root parity for consumed files ───────────────
function sameFile(a, b) { return fs.existsSync(a) && fs.existsSync(b) && S(J(a)) === S(J(b)); }
out.public_root_parity = {
  gold_standard: sameFile(path.join(ROOT, 'dataset/gold_standard/gold_standard.json'), path.join(ROOT, 'public/dataset/gold_standard/gold_standard.json')),
  comp_2013_r1: sameFile(path.join(ROOT, 'dataset/comprehensive/2013/exam_2013_r1.json'), path.join(ROOT, 'public/dataset/comprehensive/2013/exam_2013_r1.json')),
  math_2013_r1: sameFile(path.join(ROOT, 'dataset/mathematics/2013/exam_2013_r1.json'), path.join(ROOT, 'public/dataset/mathematics/2013/exam_2013_r1.json')),
};

console.log(JSON.stringify(out, null, 2));
