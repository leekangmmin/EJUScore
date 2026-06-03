// Validates the Supabase ingest transform on the REAL ocr_output shape.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { transformExam, contentHash, normalizeText, collectTags } from '../../scripts/ingest/transform.mjs';

const FILE = path.join(process.cwd(), 'public/dataset/comprehensive/2013/exam_2013_r1.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));

describe('ingest transform', () => {
  const t = transformExam(doc, { sha256: 'deadbeef', filename: 'exam_2013_r1.json' });

  it('transforms a real exam into normalized row sets', () => {
    expect(t.ok).toBe(true);
    expect(t.exam.subject).toBe('comprehensive');
    expect(t.exam.exam_year).toBe(2013);
    expect(t.questions.length).toBeGreaterThan(0);
  });

  it('explodes answer_choices into ordered choice rows with no fabricated answer key', () => {
    const withChoices = t.questions.find((q) => q.choices.length > 0);
    expect(withChoices).toBeTruthy();
    expect(withChoices.choices[0]).toHaveProperty('ordinal', 0);
    // honest: answer key unknown → is_correct stays null
    expect(withChoices.choices.every((c) => c.is_correct === null)).toBe(true);
  });

  it('builds typed tags (domain/topic/keyword) and de-duplicates them', () => {
    const q = t.questions.find((x) => x.tags.length > 1);
    const keys = q.tags.map((x) => x.name + '|' + x.kind);
    expect(new Set(keys).size).toBe(keys.length); // no dup
    expect(q.tags.some((x) => ['domain', 'topic', 'keyword', 'type'].includes(x.kind))).toBe(true);
  });

  it('content_hash is deterministic and normalization is NFKC + space-strip', () => {
    expect(contentHash('需要 曲線')).toBe(contentHash('需要曲線'));
    expect(normalizeText('ＧＤＰ ')).toBe('gdp');
  });

  it('rejects malformed docs without fabricating rows', () => {
    expect(transformExam({}).ok).toBe(false);
    expect(transformExam(null).ok).toBe(false);
  });

  it('collectTags yields a global unique vocabulary', () => {
    const vocab = collectTags([t]);
    const keys = vocab.map((v) => v.name + '|' + v.kind);
    expect(new Set(keys).size).toBe(keys.length);
    expect(vocab.length).toBeGreaterThan(0);
  });
});
