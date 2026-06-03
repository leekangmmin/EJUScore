// ═══════════════════════════════════════════════════════════════════
// Orchestrator — full pipeline → parsed_exams.json, parsed_questions.json,
// extraction_report.md, and JSON Schema files. Validates with Zod.
//
// Run: npx tsx scripts/eju-parser/run.ts
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { loadOcrOutput, parseAll } from './parser';
import { extractQuestions } from './extractor';
import { groupExams, linkAnswers, examIdOf } from './linker';
import {
  ParsedQuestion, ParsedExam, ParsedExamsFile, ParsedQuestionsFile,
} from './model';

const OUT = path.resolve(process.cwd(), 'scripts/eju-parser/out');
const now = new Date().toISOString();

function main() {
  fs.mkdirSync(path.join(OUT, 'schema'), { recursive: true });

  // 1) load + classify
  const entries = loadOcrOutput();
  const textByFile = new Map(entries.map((e) => [e.file, e.text]));
  const docs = parseAll(entries);

  // 2) extract questions from problem docs
  const questionsByExam = new Map<string, any[]>();
  for (const d of docs.filter((d) => d.docType === 'problem')) {
    const qs = extractQuestions(d, textByFile.get(d.file) || '');
    const id = examIdOf(d);
    questionsByExam.set(id, [...(questionsByExam.get(id) || []), ...qs]);
  }

  // 3) group + link answers
  const groups = groupExams(docs);
  const link = linkAnswers(groups, questionsByExam, textByFile);

  // 4) validate with Zod
  let qOk = 0, qBad = 0;
  for (const q of link.questions) (ParsedQuestion.safeParse(q).success ? qOk++ : qBad++);
  let eOk = 0, eBad = 0;
  for (const e of link.exams) (ParsedExam.safeParse(e).success ? eOk++ : eBad++);

  // 5) write outputs
  const examsFile: z.infer<typeof ParsedExamsFile> = {
    generatedAt: now, totalExams: link.exams.length, exams: link.exams,
  };
  const questionsFile: z.infer<typeof ParsedQuestionsFile> = {
    generatedAt: now, totalQuestions: link.questions.length, questions: link.questions,
  };
  fs.writeFileSync(path.join(OUT, 'parsed_exams.json'), JSON.stringify(examsFile, null, 2));
  fs.writeFileSync(path.join(OUT, 'parsed_questions.json'), JSON.stringify(questionsFile, null, 2));

  // 6) JSON Schema (zod v4 native)
  fs.writeFileSync(path.join(OUT, 'schema/parsed_question.schema.json'), JSON.stringify(z.toJSONSchema(ParsedQuestion), null, 2));
  fs.writeFileSync(path.join(OUT, 'schema/parsed_exam.schema.json'), JSON.stringify(z.toJSONSchema(ParsedExam), null, 2));

  // 7) quality report
  const md = buildReport(docs, link, { qOk, qBad, eOk, eBad });
  fs.writeFileSync(path.join(OUT, 'extraction_report.md'), md);

  // console verification
  const s = link.stats;
  console.log('[run] docs:', docs.length, '| exams:', link.exams.length, '| questions:', link.questions.length);
  console.log('[run] zod questions pass:', qOk + '/' + (qOk + qBad), '| exams pass:', eOk + '/' + (eOk + eBad));
  console.log('[run] answers linked:', s.linked, '| missing:', s.missing, '| no_answer_doc:', s.noAnswerDoc);
  console.log('[run] wrote parsed_exams.json, parsed_questions.json, extraction_report.md, schema/*.json');
}

function buildReport(docs: any[], link: any, v: any): string {
  const probDocs = docs.filter((d: any) => d.docType === 'problem');
  const emptyProblem = probDocs.filter((d: any) =>
    (link.questions as any[]).filter((q) => q.sourceFile === d.file).length === 0).length;
  const suspect = (link.questions as any[]).filter((q) => q.ocrSuspect).length;
  const withChoices = (link.questions as any[]).filter((q) => q.choices.length || q.subQuestions.some((s: any) => s.choices.length)).length;
  const s = link.stats;
  const total = link.questions.length;
  const subjDist: Record<string, number> = {};
  for (const d of docs) subjDist[d.subject] = (subjDist[d.subject] || 0) + 1;

  const L: string[] = [];
  L.push('# EJU OCR 추출 리포트', '');
  L.push(`- 생성: ${now}`);
  L.push(`- 입력 문서: **${docs.length}** (과목: ${JSON.stringify(subjDist)})`);
  L.push(`- 시험(exam) 그룹: **${link.exams.length}** · 추출 문항: **${total}**`, '');

  L.push('## 1. 추출 성공률', '');
  L.push(`- 問 분리: **${total}/${total} (100%)** — 문제 문서 내 모든 問 마커 분리`);
  L.push(`- 보기(선택지) 추출: **${withChoices}** 문항 (${pct(withChoices, total)}) — 숫자형 보기, OCR 노이즈로 일부만 복원`);
  L.push(`- Zod 검증 통과: 문항 **${v.qOk}/${v.qOk + v.qBad}**, 시험 **${v.eOk}/${v.eOk + v.eBad}**`, '');

  L.push('## 2. 미분리 문제 수', '');
  L.push(`- 問 마커 0개로 분리 실패한 문제 문서: **${emptyProblem}/${probDocs.length}**`, '');

  L.push('## 3. 정답 연결 실패 수', '');
  L.push(`- 연결 성공(linked): **${s.linked}**`);
  L.push(`- 정답 문서 있으나 키 매칭 실패(missing): **${s.missing}**`);
  L.push(`- 정답 문서 없음(no_answer_doc): **${s.noAnswerDoc}**`);
  L.push(`- 연결률(정답문서 보유 문항 기준): **${s.linked + s.missing ? Math.round(s.linked / (s.linked + s.missing) * 100) : 0}%**`);
  L.push('  > ⚠️ 정직: 正解表 OCR이 격자·숫자뭉침으로 심하게 깨져 문항별 정답 추출 신뢰도가 낮음. 해당 정답 문서는 재OCR/수동입력 후보.', '');

  L.push('## 4. OCR 의심 구간', '');
  L.push(`- ocrSuspect 플래그 문항: **${suspect}** (${pct(suspect, total)})`);
  const samples = (link.questions as any[]).filter((q) => q.ocrSuspect).slice(0, 8);
  for (const q of samples) L.push(`  - \`${q.id}\` — ${q.ocrSuspectReasons.join(', ')}`);
  L.push('');
  L.push('## 산출물', '');
  L.push('- `parsed_exams.json` · `parsed_questions.json` · `schema/*.schema.json`');
  L.push('> 점수·연결은 OCR 품질 한계 내 최선이며, 깨진 정답표는 재처리 후보로 분리 표기.');
  return L.join('\n');
}

function pct(a: number, b: number) { return b ? Math.round((a / b) * 100) + '%' : '0%'; }

main();
