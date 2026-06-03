// Stage 1 verification: data model + normalization.
import { z } from 'zod';
import { ParsedQuestion, ParsedExam } from '../model';
import { normalizeOcr, fixMonMarkers, nfkc, looksGarbled } from '../normalize';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { if (cond) { pass++; } else { fail++; console.log('  ✗', name); } };

// JSON Schema generation (zod v4 native)
const qSchema = z.toJSONSchema(ParsedQuestion);
ok('JSON Schema has $ref-able object', typeof qSchema === 'object' && (qSchema as any).type === 'object');

// Zod parse of a valid question
const sample = {
  id: 'comprehensive_2006_r1#問1', examId: 'comprehensive_2006_r1',
  subject: 'comprehensive', year: 2006, round: 1, questionNumber: 1,
  body: '次の文章を読み', subQuestions: [], choices: [{ marker: '①', text: 'A' }],
  answer: '3', answerStatus: 'linked', sourceFile: '/x.pdf',
  ocrSuspect: false, ocrSuspectReasons: [],
};
ok('valid ParsedQuestion parses', ParsedQuestion.safeParse(sample).success);
ok('invalid (year string) rejected', !ParsedQuestion.safeParse({ ...sample, year: 'x' }).success);

// normalization — the core OCR fix
ok('間17 → 問17', fixMonMarkers('解答欄間17') === '解答欄問17');
ok('同3 → 問3', fixMonMarkers('同3を見よ') === '問3を見よ');
ok('時間 untouched (no digit)', fixMonMarkers('試験時間は') === '試験時間は');
ok('full-width ＡＢ→AB (NFKC)', nfkc('ＡＢ') === 'AB');
ok('normalizeOcr composes', normalizeOcr('間 18　次') === '問18 次');
ok('garbled detected', looksGarbled('バーバーバーバー').suspect === true);
ok('clean not garbled', looksGarbled('日本国憲法について説明せよ').suspect === false);

console.log(`\n[stage1] pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
