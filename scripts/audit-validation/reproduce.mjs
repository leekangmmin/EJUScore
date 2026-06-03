#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Independent reproduction of the DeepSeek OCR Audit findings.
// Source of truth: real ocr_output.json + generated pipeline outputs.
// Run: node scripts/audit-validation/reproduce.mjs
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OCR_OUTPUT = process.env.EJU_OCR_INPUT || '/Users/igangmin/Desktop/eju-test/ocr_output.json';
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) : '0') + '%';

function flattenPerExam(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const y of fs.readdirSync(dir).filter((d) => /^20/.test(d))) {
    for (const f of fs.readdirSync(path.join(dir, y))) {
      if (!f.endsWith('.json')) continue;
      for (const q of J(path.join(dir, y, f)).questions || []) out.push(q);
    }
  }
  return out;
}

const R = {};

// [1] total PDFs
R.pdfs = fs.existsSync(OCR_OUTPUT) ? J(OCR_OUTPUT).length : null;

// audited per-question source = dataset/comprehensive/** (field: number)
const comp = flattenPerExam(path.join(ROOT, 'dataset/comprehensive'));
R.comp_n = comp.length;

// [2] total questions across known generated outputs
R.totals = {
  'dataset/comprehensive (per-exam, AUDITED)': comp.length,
  'comprehensive consolidated': (() => { try { return J(path.join(ROOT, 'dataset/comprehensive/dataset_consolidated.json')).exams.flatMap((e) => e.questions || []).length; } catch { return null; } })(),
  'gold_standard.json': (() => { try { return J(path.join(ROOT, 'dataset/gold_standard/gold_standard.json')).questions.length; } catch { return null; } })(),
  'eju-parser out (problem 問N)': (() => { try { return J(path.join(ROOT, 'scripts/eju-parser/out/parsed_questions.json')).totalQuestions; } catch { return null; } })(),
};

// [3] number==1
R.num1 = comp.filter((q) => q.number === 1).length;
R.num1_pct = pct(R.num1, comp.length);

// [4] domain unknown (unknown + empty + absent)
let unk = 0; for (const q of comp) { const d = q.domain; if (d === undefined || d === null || d === '' || d === 'unknown') unk++; }
R.unknown = unk;
R.unknown_pct = pct(unk, comp.length);

// [6] artifacts in number field
const art = comp.filter((q) => typeof q.number === 'number' && q.number > 100).map((q) => q.number);
R.artifacts = { count: art.length, distinct: new Set(art).size, top: [...new Set(art)].sort((a, b) => b - a).slice(0, 10), has_321980: art.includes(321980), has_271929: art.includes(271929) };

// cross-source numbers (to show findings are SOURCE-SPECIFIC)
function srcStats(arr, nf) {
  if (!arr) return null;
  let u = 0; for (const q of arr) { const d = q.domain; if (d == null || d === '' || d === 'unknown') u++; }
  return { n: arr.length, num1: arr.filter((q) => q[nf] === 1).length, unknown_pct: pct(u, arr.length), max_num: Math.max(...arr.map((q) => q[nf]).filter((x) => typeof x === 'number')) };
}
R.cross = {
  'dataset/comprehensive (number)': srcStats(comp, 'number'),
  'gold_standard (question_number)': (() => { try { return srcStats(J(path.join(ROOT, 'dataset/gold_standard/gold_standard.json')).questions, 'question_number'); } catch { return null; } })(),
  'reclassified ocr_questions': (() => { try { return srcStats(J(path.join(ROOT, 'dataset/training/reclassified_ocr_data.json')).ocr_questions, 'question_number'); } catch { return null; } })(),
};

// [5] math schema heterogeneity
const mathDir = path.join(ROOT, 'dataset/mathematics');
const schemas = {};
let mtot = 0, mdom = 0, mans = 0, mtopic = 0;
for (const y of fs.readdirSync(mathDir).filter((d) => /^20/.test(d))) {
  for (const f of fs.readdirSync(path.join(mathDir, y))) {
    if (!f.endsWith('.json')) continue;
    const qs = J(path.join(mathDir, y, f)).questions || [];
    const key = Object.keys(qs[0] || {}).sort().join(',');
    schemas[key] = (schemas[key] || 0) + 1;
    for (const q of qs) { mtot++; if (q.domain && q.domain !== 'unknown') mdom++; if ((q.answer_choices || []).length) mans++; if (q.topic) mtopic++; }
  }
}
R.math = {
  schemaVariants: Object.entries(schemas).map(([k, v]) => ({ files: v, hasRichFields: k.includes('raw_text'), keys: k })),
  fill: { total: mtot, domain: mdom, answer_choices: mans, topic: mtopic },
};

console.log(JSON.stringify(R, null, 2));
