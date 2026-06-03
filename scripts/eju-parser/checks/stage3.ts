// Stage 3 verification: Problem Extractor over REAL problem documents.
import { loadOcrOutput, parseAll } from '../parser';
import { extractQuestions } from '../extractor';

const entries = loadOcrOutput();
const byFile = new Map(entries.map((e) => [e.file, e.text]));
const docs = parseAll(entries).filter((d) => d.docType === 'problem');

import { normalizeOcr } from '../normalize';

// ground truth: 問+num markers present in PROBLEM files only
let monInProblems = 0;
for (const d of docs) monInProblems += (normalizeOcr(byFile.get(d.file) || '').match(/問\s*[0-9]{1,2}/g) || []).length;

let totalQ = 0, withChoices = 0, withSub = 0, suspect = 0, subWithChoices = 0;
let perFileMin = Infinity, perFileMax = 0, filesWithQ = 0;
for (const d of docs) {
  const qs = extractQuestions(d, byFile.get(d.file) || '');
  if (qs.length) filesWithQ++;
  perFileMin = Math.min(perFileMin, qs.length);
  perFileMax = Math.max(perFileMax, qs.length);
  totalQ += qs.length;
  for (const q of qs) {
    if (q.choices.length) withChoices++;
    if (q.subQuestions.length) withSub++;
    if (q.subQuestions.some((s) => s.choices.length)) subWithChoices++;
    if (q.ocrSuspect) suspect++;
  }
}
console.log('[stage3] problem docs:', docs.length);
console.log('問+num present in problem files:', monInProblems);
console.log('total 問 questions extracted:', totalQ, `(separation rate ${Math.round((totalQ / monInProblems) * 100)}%)`);
console.log('files with ≥1 question:', filesWithQ + '/' + docs.length);
console.log('per-file questions min/max:', perFileMin, '/', perFileMax);
console.log('questions w/ top-level choices:', withChoices);
console.log('questions w/ sub-questions:', withSub, '| of those, with extracted choices:', subWithChoices);
console.log('questions flagged ocrSuspect:', suspect, `(${Math.round((suspect / totalQ) * 100)}%)`);

let fail = 0;
if (totalQ !== monInProblems) { fail++; console.log(`  ✗ extracted ${totalQ} != ${monInProblems} present`); }
if (filesWithQ !== docs.length) { fail++; console.log(`  ✗ ${docs.length - filesWithQ} files yielded 0 questions`); }
if (subWithChoices + withChoices === 0) { fail++; console.log('  ✗ no choices extracted at all'); }
console.log(`\n[stage3] checks failed: ${fail}`);
process.exit(0);
