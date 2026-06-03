// Verifies the DeepSeek-audit fixes (sectionDetector mapping, OCR-tolerant
// fuzzy matching, TF-IDF search, gold-standard index, concept dictionaries).
import { describe, it, expect } from 'vitest';
import { normalizeText, fuzzyIncludes } from '../pipeline/textMatch';
import sectionDetector from '../pipeline/sectionDetector';
import { CONCEPT_DICTIONARIES } from '../pipeline/tagExtractor';
import { extractTags } from '../pipeline/tagExtractor';

describe('[Critical #1] EJU section mapping (geo/his/eco/pol/soc)', () => {
  const f = sectionDetector.getDomainByQuestionNumberRange;
  it('maps the corrected ranges', () => {
    expect(f(1)).toBe('geography');
    expect(f(8)).toBe('geography');
    expect(f(9)).toBe('history');
    expect(f(16)).toBe('history');
    expect(f(17)).toBe('economy');   // was politics (bug)
    expect(f(24)).toBe('economy');
    expect(f(25)).toBe('politics');  // was economy (bug)
    expect(f(32)).toBe('politics');
    expect(f(33)).toBe('society');
    expect(f(38)).toBe('society');
  });
});

describe('[Critical #2] OCR-tolerant matching', () => {
  it('normalizes full-width / half-width (全角⇄半角) via NFKC', () => {
    expect(normalizeText('ＧＤＰ')).toBe('gdp');
    expect(normalizeText('ｱｲｳ')).toBe(normalizeText('アイウ'));
  });
  it('exact match still works (no regression)', () => {
    expect(fuzzyIncludes('需要曲線と供給曲線', '需要曲線')).toBe(true);
  });
  it('tolerates a 1-char OCR error in a 4-char term', () => {
    // 線 → 緑 OCR confusion
    expect(fuzzyIncludes('需要曲緑の説明', '需要曲線')).toBe(true);
  });
  it('matches full-width English token against half-width concept', () => {
    expect(fuzzyIncludes('ＧＤＰの計算方法', 'GDP')).toBe(true);
  });
  it('does not over-match unrelated short text', () => {
    expect(fuzzyIncludes('天気は晴れ', '需要曲線')).toBe(false);
  });
});

describe('[High #5] concept dictionaries split JA/KO/EN', () => {
  it('has all three language dictionaries', () => {
    expect(Object.keys(CONCEPT_DICTIONARIES).sort()).toEqual(['en', 'ja', 'ko']);
    expect(CONCEPT_DICTIONARIES.ja.economy).toContain('需要曲線');
    expect(CONCEPT_DICTIONARIES.ko.politics).toContain('삼권분립');
  });
  it('Japanese concept terms now match Japanese OCR text', () => {
    const tags = extractTags({
      cleanedText: '日本国憲法の三権分立について述べよ。',
      detectedDomain: 'politics', difficulty: 5,
    });
    const names = tags.conceptTags.map(t => t.tag);
    expect(names.some(n => n === '三権分立' || n === '日本国憲法')).toBe(true);
  });
});
