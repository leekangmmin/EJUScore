// CI test for the EJU OCR parser pipeline (pure functions, synthetic input —
// does not depend on the external ~/Desktop/eju-test/ocr_output.json).
import { describe, it, expect } from 'vitest';
import { classifyDoc, detectYear, detectRound, detectSubject, detectDocType } from '../../scripts/eju-parser/parser.ts';
import { extractQuestions } from '../../scripts/eju-parser/extractor.ts';
import { parseAnswerKey, groupExams, linkAnswers, examIdOf } from '../../scripts/eju-parser/linker.ts';
import { fixMonMarkers, normalizeOcr } from '../../scripts/eju-parser/normalize.ts';

describe('OCR Parser (filename + header)', () => {
  it('classifies a comprehensive past-paper path', () => {
    const d = classifyDoc({ file: '/x/종합과목/【3】EJU文综/【1】文综真题/2006平成18年第1回文综.pdf', text: '問題用紙' });
    expect(d.subject).toBe('comprehensive');
    expect(d.year).toBe(2006);
    expect(d.round).toBe(1);
    expect(d.docType).toBe('problem');
  });
  it('detects era-only + western year, and round variants', () => {
    expect(detectYear('2025令和7年文综.pdf').year).toBe(2025);
    expect(detectYear('令和3年第1回数学.pdf').year).toBe(2021); // era→western fallback
    expect(detectRound('…第二回…')).toBe(2);
  });
  it('subject + docType from keywords', () => {
    expect(detectSubject('/a/数学/2010数学1.pdf')).toBe('mathematics');
    expect(detectDocType('/a/2010答案.pdf')).toBe('answer');
    expect(detectDocType('/a/2010听力原文.pdf')).toBe('listening');
  });
});

describe('Problem Extractor', () => {
  const doc = { file: '/a/2006第1回文综.pdf', basename: '2006第1回文综.pdf', subject: 'comprehensive',
    year: 2006, round: 1, era: null, docType: 'problem', course: null, textLength: 0, metaConfidence: 1 };
  const text = '問1 次の文を読みなさい。(1) 正しいものを次の1～4から選べ。1 東京 2 大阪 3 京都 4 奈良 問2 本文の内容。';

  it('splits by 問N and extracts sub-questions + numeric choices', () => {
    const qs = extractQuestions(doc, text);
    expect(qs.length).toBe(2);
    expect(qs[0].questionNumber).toBe(1);
    const sub = qs[0].subQuestions[0];
    expect(sub.choices.map((c) => c.text)).toContain('東京');
    expect(sub.choices.length).toBe(4);
  });

  it('recovers 間→問 mis-OCR before splitting', () => {
    const qs = extractQuestions(doc, '間1 本文。間2 次の問い。');
    expect(qs.length).toBe(2); // 間 corrected to 問
  });
});

describe('Answer Linker', () => {
  it('parses 問N→answer (constrained to 1-4)', () => {
    const m = parseAnswerKey('正解表 問1 3 問2 1 問3 4 問4 9');
    expect(m.get(1)).toBe('3');
    expect(m.get(2)).toBe('1');
    expect(m.has(4)).toBe(false); // 9 rejected (not 1-4)
  });

  it('groups exams and links answers, flags missing', () => {
    const docs = [
      { file: '/p.pdf', basename: 'p', subject: 'comprehensive', year: 2006, round: 1, era: null, docType: 'problem', course: null, textLength: 0, metaConfidence: 1 },
      { file: '/a.pdf', basename: 'a', subject: 'comprehensive', year: 2006, round: 1, era: null, docType: 'answer', course: null, textLength: 0, metaConfidence: 1 },
    ];
    const groups = groupExams(docs);
    const id = examIdOf(docs[0]);
    const q = { id: `${id}#問1@0`, examId: id, subject: 'comprehensive', year: 2006, round: 1,
      questionNumber: 1, body: '', subQuestions: [], choices: [], answer: null,
      answerStatus: 'no_answer_doc', sourceFile: '/p.pdf', ocrSuspect: false, ocrSuspectReasons: [] };
    const res = linkAnswers(groups, new Map([[id, [q]]]), new Map([['/a.pdf', '問1 2']]));
    expect(res.questions[0].answer).toBe('2');
    expect(res.questions[0].answerStatus).toBe('linked');
  });
});

describe('OCR normalization', () => {
  it('間/同 + digit → 問, NFKC folds width', () => {
    expect(fixMonMarkers('解答欄間17')).toBe('解答欄問17');
    expect(normalizeOcr('間 18　次')).toBe('問18 次');
  });
});
