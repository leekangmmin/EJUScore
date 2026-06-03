// Validates the OCR quality auditor on synthetic edge cases + REAL corpus.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeText, scoreQuestion, analyzeDocument, auditCorpus, renderMarkdown,
  hasFormula, hasGraphMention,
} from '../../scripts/audit/ocrQuality.mjs';

describe('analyzeText character ratios', () => {
  it('clean Japanese prose → high meaningful, low garbage', () => {
    const a = analyzeText('日本国憲法の三権分立について説明しなさい。');
    expect(a.japaneseRatio).toBeGreaterThan(0.7);
    expect(a.brokenRatio).toBeLessThan(0.1);
  });
  it('empty text → broken=1, no NaN', () => {
    const a = analyzeText('');
    expect(a.brokenRatio).toBe(1);
    expect(Number.isNaN(a.meaningfulRatio)).toBe(false);
  });
  it('repeated-bigram OCR noise (バーバーバー…) flagged as garbage', () => {
    const a = analyzeText('バーバーバーバーバーバー');
    expect(a.brokenRatio).toBeGreaterThan(0.3);
  });
  it('long dash run flagged as garbage', () => {
    const a = analyzeText('問題ーーーーーーーーーー');
    expect(a.brokenRatio).toBeGreaterThan(0.3);
  });
});

describe('scoreQuestion', () => {
  it('clean question scores high, not re-OCR', () => {
    const r = scoreQuestion({ text: '次のグラフを見て、需要曲線と供給曲線の均衡点を求めなさい。', ocr_confidence: 0.9 });
    expect(r.score).toBeGreaterThan(60);
    expect(r.reocr).toBe(false);
  });
  it('empty question scores 0 → re-OCR', () => {
    const r = scoreQuestion({ text: '', ocr_confidence: 0.2 });
    expect(r.score).toBe(0);
    expect(r.reocr).toBe(true);
    expect(r.reasons).toContain('too_short');
  });
});

describe('content detectors', () => {
  it('detects formulas', () => {
    expect(hasFormula('2x + 3 = 7 を解け')).toBe(true);
    expect(hasFormula('フランス革命について')).toBe(false);
  });
  it('detects graph mentions (text or material arrays)', () => {
    expect(hasGraphMention({ text: '次のグラフを参照' })).toBe(true);
    expect(hasGraphMention({ text: '計算せよ', graphs: [{}] })).toBe(true);
    expect(hasGraphMention({ text: '計算せよ' })).toBe(false);
  });
});

describe('auditDocument + auditCorpus on REAL corpus', () => {
  const file = path.join(process.cwd(), 'public/dataset/comprehensive/2013/exam_2013_r1.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));

  it('produces a numeric document score (no NaN) + all rates', () => {
    const d = analyzeDocument(doc, { file: 'exam_2013_r1.json' });
    expect(Number.isNaN(d.score)).toBe(false);
    expect(d.score).toBeGreaterThanOrEqual(0);
    expect(d.score).toBeLessThanOrEqual(100);
    expect(d.rates).toHaveProperty('separation');
    expect(d.rates).toHaveProperty('formula');
    expect(d.rates).toHaveProperty('graphMention');
    expect(d.yearDetected).toBe(true);
  });

  it('auditCorpus yields all 10 metrics with no NaN + reprocess candidates', () => {
    const rep = auditCorpus([{ doc, meta: { file: 'exam_2013_r1.json' } }]);
    const m = rep.corpus.metrics;
    for (const k of ['avg_text_length', 'japanese_ratio', 'kanji_ratio', 'digit_ratio',
      'broken_ratio', 'question_separation_rate', 'formula_detection_rate',
      'graph_mention_rate', 'year_detection_rate']) {
      expect(Number.isNaN(m[k])).toBe(false);
    }
    expect(rep.corpus.empty_document_count).toBe(0); // this real exam is not empty
    expect(rep.rubric.reocr_threshold).toBe(60);
    expect(rep.reprocess_candidates).toHaveProperty('documents');
    expect(rep.reprocess_candidates).toHaveProperty('questions');
  });

  it('flags an all-empty document as empty + re-OCR', () => {
    const empty = { subject: 'mathematics', year: 2099, round: 1,
      questions: [{ id: 'x', number: 1, text: '', raw_text: '' }] };
    const d = analyzeDocument(empty, { file: 'empty.json' });
    expect(d.empty).toBe(true);
    expect(d.reocr).toBe(true);
    expect(d.score).toBe(0);
  });

  it('renderMarkdown returns a report with the 10-item table', () => {
    const md = renderMarkdown(auditCorpus([{ doc, meta: { file: 'exam_2013_r1.json' } }]));
    expect(md).toContain('# OCR 품질 감사 리포트');
    expect(md).toContain('OCR 깨짐 문자 비율');
    expect(md).toContain('재처리 후보');
  });
});
