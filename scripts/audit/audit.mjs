#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// OCR Quality Auditor CLI
//
// Usage:
//   node scripts/audit/audit.mjs <ocr_output.json | dir> [--out=.] [--json=ocr_quality_report.json] [--md=report.md]
//
// Input: a single exam doc, an array of exam docs, or a directory of
//        exam_*.json / ocr_output*.json files.
// Output: ocr_quality_report.json + report.md (score 0–100, <60 = re-OCR).
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { auditCorpus, renderMarkdown } from './ocrQuality.mjs';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => {
  const m = args.find((a) => a.startsWith(`--${k}=`));
  return m ? m.split('=')[1] : d;
};
const OUT = opt('out', '.');
const JSON_NAME = opt('json', 'ocr_quality_report.json');
const MD_NAME = opt('md', 'report.md');

if (!target) {
  console.error('usage: node scripts/audit/audit.mjs <file|dir> [--out=.] [--json=...] [--md=...]');
  process.exit(1);
}

function listFiles(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return [p];
  const out = [];
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const fp = path.join(p, e.name);
    if (e.isDirectory()) out.push(...listFiles(fp));
    else if (/^exam_.*\.json$|ocr_output.*\.json$/.test(e.name)) out.push(fp);
  }
  return out;
}

const files = listFiles(target);
const docsWithMeta = [];
for (const f of files) {
  let json;
  try { json = JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { console.warn(`skip ${f}: ${e.message}`); continue; }
  const docs = Array.isArray(json) ? json : [json];
  for (const doc of docs) docsWithMeta.push({ doc, meta: { file: path.relative(process.cwd(), f) } });
}

if (docsWithMeta.length === 0) {
  console.error('No OCR documents found.');
  process.exit(2);
}

const report = auditCorpus(docsWithMeta);
const md = renderMarkdown(report);

fs.mkdirSync(OUT, { recursive: true });
const jsonPath = path.join(OUT, JSON_NAME);
const mdPath = path.join(OUT, MD_NAME);
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
fs.writeFileSync(mdPath, md);

const c = report.corpus;
console.log(`[ocr-audit] docs=${c.total_documents} questions=${c.total_questions} ` +
  `avg_score=${c.avg_quality_score}/100 reocr_q=${c.reocr_question_count} (${Math.round(c.reocr_question_ratio * 100)}%) ` +
  `reocr_docs=${c.reocr_document_count} empty_docs=${c.empty_document_count}`);
console.log(`[ocr-audit] wrote ${jsonPath} + ${mdPath}`);
