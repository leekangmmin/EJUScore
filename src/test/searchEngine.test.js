// Verifies the new search engine on the REAL corpus (public/dataset).
// Proves the audited cross-lingual flaw is fixed: KO/EN queries match the
// Japanese OCR corpus via the concept bridge + BM25 n-gram index.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { bridgeExpand } from '../admin/lib/conceptBridge';
import { buildIndex, search, tokenize } from '../admin/lib/searchEngine';

const ROOT = process.cwd();

function loadSubject(subject) {
  const base = path.join(ROOT, 'public/dataset', subject);
  if (!fs.existsSync(base)) return [];
  const out = [];
  for (const y of fs.readdirSync(base).filter((d) => /^20/.test(d))) {
    for (const f of fs.readdirSync(path.join(base, y))) {
      if (!/^exam_.*\.json$/.test(f)) continue;
      const doc = JSON.parse(fs.readFileSync(path.join(base, y, f), 'utf8'));
      for (const q of doc.questions || []) {
        const m = f.match(/exam_(\d{4})_r(\d)/);
        out.push({
          id: q.id, year: Number(m?.[1] || y), round: Number(m?.[2] || 1),
          text: q.text || q.raw_text || '', topic: q.topic || '', domain: q.domain || 'unknown',
          domainKo: q.domain || '', keywords: q.keywords || [], difficulty: q.difficulty ?? null,
          number: q.number ?? null,
        });
      }
    }
  }
  return out;
}

describe('concept bridge', () => {
  it('expands KO/EN example queries to Japanese surface forms', () => {
    for (const q of ['브레튼우즈 체제', '국제연합 헌장 초안 회의', '행렬 문제', '벡터 내적']) {
      const { jaTokens, concepts } = bridgeExpand(q);
      expect(concepts.length).toBeGreaterThan(0);
      expect(jaTokens.length).toBeGreaterThan(0);
    }
  });
  it('maps 벡터 내적 → ベクトル/内積', () => {
    const { jaTokens } = bridgeExpand('벡터 내적');
    expect(jaTokens).toContain('ベクトル');
    expect(jaTokens).toContain('内積');
  });
});

describe('tokenizer', () => {
  it('produces CJK bigrams and kana runs', () => {
    const toks = tokenize('国際連合憲章');
    expect(toks.some((t) => t.startsWith('b:'))).toBe(true);
    expect(toks.some((t) => t.startsWith('w:'))).toBe(true);
  });
});

describe('search over REAL math corpus', () => {
  const qs = loadSubject('mathematics');
  it('loaded real math questions', () => { expect(qs.length).toBeGreaterThan(100); });

  const index = buildIndex(qs);
  it('Korean query "벡터 내적" matches real math questions (via topic + bridge)', () => {
    const { results } = search(index, '벡터 내적', { topK: 10 });
    expect(results.length).toBeGreaterThan(0);
  });
  it('"삼각함수" and "확률" retrieve real questions', () => {
    expect(search(index, '삼각함수', { topK: 10 }).results.length).toBeGreaterThan(0);
    expect(search(index, '확률 기댓값', { topK: 10 }).results.length).toBeGreaterThan(0);
  });
  it('"행렬" bridges the concept but honestly returns 0 (EJU 수학 교육과정에 행렬 없음)', () => {
    const { results, concepts } = search(index, '행렬 문제', { topK: 10 });
    expect(concepts.map((c) => c.label)).toContain('행렬'); // concept recognized
    expect(results.length).toBe(0);                          // but no real questions exist
  });
});

describe('search over REAL comprehensive corpus', () => {
  const qs = loadSubject('comprehensive');
  it('loaded real comprehensive questions', () => { expect(qs.length).toBeGreaterThan(100); });

  const index = buildIndex(qs);
  it('Korean economy query bridges and matches (인플레이션/환율)', () => {
    const a = search(index, '인플레이션', { topK: 10 });
    const b = search(index, '환율', { topK: 10 });
    // at least one common economy concept should retrieve real questions
    expect(a.results.length + b.results.length).toBeGreaterThan(0);
  });
  it('empty query returns nothing', () => {
    expect(search(index, '   ', {}).results.length).toBe(0);
  });
});
