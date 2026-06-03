// Stage 4 verification: Answer Linker over the REAL corpus.
import { loadOcrOutput, parseAll } from '../parser';
import { extractQuestions } from '../extractor';
import { groupExams, linkAnswers, examIdOf, parseAnswerKey } from '../linker';

const entries = loadOcrOutput();
const textByFile = new Map(entries.map((e) => [e.file, e.text]));
const docs = parseAll(entries);

const groups = groupExams(docs);
const questionsByExam = new Map<string, any[]>();
for (const d of docs.filter((d) => d.docType === 'problem')) {
  const qs = extractQuestions(d, textByFile.get(d.file) || '');
  const id = examIdOf(d);
  questionsByExam.set(id, [...(questionsByExam.get(id) || []), ...qs]);
}

const res = linkAnswers(groups, questionsByExam, textByFile);
const s = res.stats;
console.log('[stage4] exam groups:', s.examGroups);
const withProblem = res.exams.filter((e) => e.problemFile).length;
const withAnswer = res.exams.filter((e) => e.answerFile).length;
const withBoth = res.exams.filter((e) => e.problemFile && e.answerFile).length;
console.log('exams with problem doc:', withProblem, '| with answer doc:', withAnswer, '| with BOTH:', withBoth);
console.log('total questions:', res.questions.length);
console.log('answer keys extracted (sum):', s.answersExtractedTotal);
console.log('linked:', s.linked, '| missing(answer doc present, no key):', s.missing, '| no_answer_doc:', s.noAnswerDoc);
console.log('link rate (of q with answer doc):', (() => {
  const denom = s.linked + s.missing; return denom ? Math.round((s.linked / denom) * 100) + '%' : 'n/a';
})());

// honest spot-check: a single answer doc's extracted key size
const anyAns = docs.find((d) => d.docType === 'answer');
if (anyAns) {
  const km = parseAnswerKey(textByFile.get(anyAns.file) || '');
  console.log('\nsample answer doc:', anyAns.basename, '→ keys extracted:', km.size);
}

let fail = 0;
if (withBoth === 0) { fail++; console.log('  ✗ no exam paired problem+answer'); }
if (res.questions.length !== 1588) { fail++; console.log(`  ✗ questions ${res.questions.length} != 1588`); }
console.log(`\n[stage4] checks failed: ${fail}`);
process.exit(0);
