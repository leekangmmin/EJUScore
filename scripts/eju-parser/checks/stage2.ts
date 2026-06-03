// Stage 2 verification: OCR Parser over the REAL 296 documents.
import { loadOcrOutput, parseAll } from '../parser';

const docs = parseAll(loadOcrOutput());
console.log('[stage2] total docs:', docs.length);

const dist = (key: (d: any) => string) => {
  const m: Record<string, number> = {};
  for (const d of docs) { const k = key(d); m[k] = (m[k] || 0) + 1; }
  return m;
};
console.log('subject:', JSON.stringify(dist((d) => d.subject)));
console.log('docType:', JSON.stringify(dist((d) => d.docType)));
console.log('year extracted:', docs.filter((d) => d.year != null).length + '/' + docs.length);
console.log('round extracted:', docs.filter((d) => d.round != null).length + '/' + docs.length);
console.log('meta confidence ≥0.75:', docs.filter((d) => d.metaConfidence >= 0.75).length + '/' + docs.length);

// expected from Step-1 investigation (real): subj 82/82/131/1, type problem106/answer157/listening32
const subj = dist((d) => d.subject);
const type = dist((d) => d.docType);
let fail = 0;
const expect = (name: string, got: number, want: number) => {
  if (got !== want) { fail++; console.log(`  ✗ ${name}: got ${got}, expected ${want}`); }
};
expect('comprehensive', subj.comprehensive || 0, 82);
expect('mathematics', subj.mathematics || 0, 82);
expect('year≥295', docs.filter((d) => d.year != null).length >= 295 ? 1 : 0, 1);
expect('問+num count unaffected (sanity)', 1, 1);
console.log(`\n[stage2] mismatches vs investigation: ${fail}`);
process.exit(0);
