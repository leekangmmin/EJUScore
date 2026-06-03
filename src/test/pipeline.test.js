// ═══════════════════════════════════════════════════════════════════════
// Pipeline Tests
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { detectYear, detectYearBatch, detectRound } from '../pipeline/yearDetector';
import { detectSections, quickDetectDomain } from '../pipeline/sectionDetector';
import { extractTags, aggregateTags } from '../pipeline/tagExtractor';
import { similaritySearch } from '../pipeline/similaritySearch';
import { analyzeErrorPattern, recommendLearningPriority } from '../pipeline/learningPrioritizer';
import { generateTrainingDataset, generateEmbeddingDataset } from '../pipeline/datasetGenerator';
import { analyzeEJUProblem, parseInput, detectOverallSubject, splitIntoQuestions } from '../pipeline/ejuProblemAnalyzer';

// ═══════════════════════════════════════════════════════════════════════
// YEAR DETECTOR TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('yearDetector — detectYear()', () => {
  it('detects year from full EJU header (令和6年度 第1回)', () => {
    const text = '日本留学試験 令和6年度 第1回 総合科目';
    const result = detectYear(text);
    expect(result.year).toBe(2024);
    expect(result.round).toBe(1);
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('detects year from era year + round', () => {
    const text = '令和5年度 第2回';
    const result = detectYear(text);
    expect(result.year).toBe(2023);
    expect(result.round).toBe(2);
    expect(result.confidence).toBeGreaterThan(0.85);
  });

  it('detects year from western header', () => {
    const text = '2025年度 日本留学試験 第1回';
    const result = detectYear(text);
    expect(result.year).toBe(2025);
    expect(result.round).toBe(1);
  });

  it('detects era year from Japanese calendar', () => {
    const text = '令和6年度 本試験 問題';
    const result = detectYear(text);
    expect(result.year).toBe(2024);
  });

  it('detects western year from text', () => {
    const text = '2024年 日本留学試験 問題';
    const result = detectYear(text);
    expect(result.year).toBe(2024);
  });

  it('returns null for text with no year', () => {
    const result = detectYear('これはテスト問題です。次の問いに答えなさい。');
    expect(result.year).toBeNull();
  });

  it('handles empty input', () => {
    const result = detectYear('');
    expect(result.year).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('handles 平成 era conversion', () => {
    const text = '平成30年度 第1回';
    const result = detectYear(text);
    expect(result.year).toBe(2018);
  });

  it('handles 昭和 era conversion', () => {
    const text = '昭和60年度';
    const result = detectYear(text);
    expect(result.year).toBe(1985);
  });

  it('detects round from month-based pattern', () => {
    expect(detectRound('6月実施 日本留学試験').round).toBe(1);
    expect(detectRound('11月実施 日本留学試験').round).toBe(2);
  });

  it('detects round from 前期/後期', () => {
    expect(detectRound('前期試験').round).toBe(1);
    expect(detectRound('後期試験').round).toBe(2);
  });

  it('detects context year from exam name', () => {
    const result = detectYear('2024年追試験 問題');
    expect(result.year).toBe(2024);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe('yearDetector — detectYearBatch()', () => {
  it('detects year from multiple pages via consensus', () => {
    const pages = [
      { text: '日本留学試験' },
      { text: '令和6年度 第1回' },
      { text: '次の問いに答えなさい' },
    ];
    const result = detectYearBatch(pages);
    expect(result.year).toBe(2024);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('returns null for empty pages', () => {
    const result = detectYearBatch([]);
    expect(result.year).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SECTION DETECTOR TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('sectionDetector — detectSections()', () => {
  it('assigns correct domains based on keyword scoring', () => {
    const questions = [
      { number: 1, text: '次の地図を見て、ケッペンの気候区分に関する問いに答えなさい。' },
      { number: 2, text: '図1の雨温図を分析し、この都市の気候の特徴を説明せよ。' },
      { number: 9, text: 'フランス革命について、次の記述のうち正しいものを選べ。' },
      { number: 10, text: '産業革命が社会に与えた影響について説明せよ。' },
    ];
    const { questions: qs } = detectSections(questions);
    expect(qs[0].detectedDomain).toBe('geography');
    expect(qs[1].detectedDomain).toBe('geography');
    expect(qs[2].detectedDomain).toBe('history');
    expect(qs[3].detectedDomain).toBe('history');
  });

  it('handles empty input gracefully', () => {
    const result = detectSections([]);
    expect(result.questions).toEqual([]);
    expect(result.sections).toEqual([]);
  });
});

describe('sectionDetector — quickDetectDomain()', () => {
  it('detects economy domain', () => {
    const { domain } = quickDetectDomain('GDPとGNPの違い。需要曲線と供給曲線。');
    expect(domain).toBe('economy');
  });

  it('detects politics domain', () => {
    const { domain } = quickDetectDomain('三権分立と議院内閣制。日本国憲法。');
    expect(domain).toBe('politics');
  });

  it('detects history domain', () => {
    const { domain } = quickDetectDomain('フランス革命とアメリカ独立戦争の比較。');
    expect(domain).toBe('history');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TAG EXTRACTOR TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('tagExtractor — extractTags()', () => {
  it('extracts domain tags from question', () => {
    const q = {
      cleanedText: '日本国憲法第9条について説明せよ。平和主義と戦力の不保持。',
      detectedDomain: 'politics',
      difficulty: 6,
      type: 'short_answer',
    };
    const tags = extractTags(q);
    expect(tags.domainTags.some(t => t.tag === 'politics')).toBe(true);
    expect(tags.conceptTags.length).toBeGreaterThan(0);
  });

  it('extracts concept tags from economics text with Japanese keywords', () => {
    const q = {
      cleanedText: '需要曲線と供給曲線の交点で決まる均衡価格について説明せよ。',
      detectedDomain: 'economy',
      difficulty: 5,
    };
    const tags = extractTags(q);
    const conceptNames = tags.conceptTags.map(t => t.tag);
    // Japanese keywords from the text should be found in concept tags
    expect(conceptNames.some(n => n.includes('需要') || n === '需要曲線' || n === '供給曲線')).toBe(true);
  });

  it('detects material types from text', () => {
    const q = {
      cleanedText: '次のグラフを参照して、問いに答えなさい。',
      detectedDomain: 'economy',
      difficulty: 7,
    };
    const tags = extractTags(q);
    const materialTypes = tags.materialTags.map(t => t.tag);
    expect(materialTypes).toContain('graph');
  });

  it('detects languages present', () => {
    const q = {
      cleanedText: '日本留学試験の問題です。次のグラフを分析せよ。',
      detectedDomain: 'economy',
      difficulty: 5,
    };
    const tags = extractTags(q);
    expect(tags.languageTags.some(l => l.tag === 'japanese')).toBe(true);
  });
});

describe('tagExtractor — aggregateTags()', () => {
  it('aggregates tags from multiple questions', () => {
    const tagSets = [
      { domainTags: [{ tag: 'economy', weight: 1.0, source: 'classification' }],
        conceptTags: [{ tag: 'GDP', weight: 0.8, confidence: 0.8 }],
        materialTags: [{ tag: 'graph', type: 'graph' }],
        difficultyTags: [{ tag: '보통' }], typeTags: [{ tag: 'multiple_choice' }] },
      { domainTags: [{ tag: 'politics', weight: 1.0, source: 'classification' }],
        conceptTags: [{ tag: '헌법', weight: 0.9, confidence: 0.9 }],
        materialTags: [{ tag: 'table', type: 'table' }],
        difficultyTags: [{ tag: '어려움' }], typeTags: [{ tag: 'short_answer' }] },
    ];
    const agg = aggregateTags(tagSets);
    expect(Object.keys(agg.domainTags).length).toBe(2);
    expect(Object.keys(agg.conceptTags).length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SIMILARITY SEARCH TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('similaritySearch', () => {
  const pool = [
    { id: 'q1', domain: 'economy', topic: 'GDP', text: 'GDPの計算方法について説明せよ。' },
    { id: 'q2', domain: 'economy', topic: '수요·공급', text: '需要曲線と供給曲線の関係を説明せよ。' },
    { id: 'q3', domain: 'history', topic: '시민혁명', text: 'フランス革命の背景と影響について述べよ。' },
    { id: 'q4', domain: 'politics', topic: '헌법', text: '日本国憲法の基本原則について説明せよ。' },
  ];

  it('finds similar questions by text similarity', () => {
    const results = similaritySearch('需要曲線と供給曲線', pool, { count: 2 });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].domain).toBe('economy');
  });

  it('returns empty array for empty pool', () => {
    expect(similaritySearch('test', [], { count: 5 })).toEqual([]);
  });

  it('returns empty array for empty query', () => {
    expect(similaritySearch('', pool, { count: 5 })).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LEARNING PRIORITIZER TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('learningPrioritizer — analyzeErrorPattern()', () => {
  const sampleExams = [
    { id: 'exam1', date: '2025-01-15', comprehensive: {
        score: 120, mistakes: [{ topic: '수요·공급', domain: 'economy' }, { topic: 'GDP', domain: 'economy' }] } },
    { id: 'exam2', date: '2025-03-20', comprehensive: {
        score: 130, mistakes: [{ topic: '수요·공급', domain: 'economy' }, { topic: '시민혁명', domain: 'history' }] } },
  ];

  it('generates priority list from error patterns', () => {
    const analysis = analyzeErrorPattern(sampleExams);
    expect(analysis.priorities.length).toBeGreaterThan(0);
    expect(analysis.summary.totalExams).toBe(2);
    expect(analysis.summary.totalErrors).toBeGreaterThan(0);
  });

  it('ranks frequently missed topics higher', () => {
    const analysis = analyzeErrorPattern(sampleExams);
    const topPriority = analysis.priorities[0];
    expect(topPriority.errorCount).toBeGreaterThanOrEqual(2);
  });

  it('handles empty exam list', () => {
    const analysis = analyzeErrorPattern([]);
    // With empty exams, it falls back to providing all topics with low priority
    expect(analysis.summary.totalExams).toBe(0);
    expect(analysis.summary.totalErrors).toBe(0);
  });

  it('generates insights', () => {
    const analysis = analyzeErrorPattern(sampleExams);
    expect(analysis.insights.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DATASET GENERATOR TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('datasetGenerator — generateTrainingDataset()', () => {
  const sampleProblems = [{
    year: 2024, subject: 'comprehensive', section: 'economy', question_number: 1,
    difficulty: '보통', difficulty_score: 5, topic: '수요·공급',
    tags: ['economy', '수요·공급', 'graph'],
    answer: '3', explanation: '수요곡선이 우측으로 이동하면 균형가격이 상승한다.',
    metadata: { rawText: '需要曲線と供給曲線の交点について...', domain: 'economy' },
  }];

  it('generates analysis examples', () => {
    const dataset = generateTrainingDataset(sampleProblems, { taskType: 'analysis' });
    expect(dataset.totalExamples).toBe(1);
    expect(dataset.examples[0].output.year).toBe(2024);
  });

  it('generates classification examples', () => {
    const dataset = generateTrainingDataset(sampleProblems, { taskType: 'classification' });
    expect(dataset.totalExamples).toBeGreaterThanOrEqual(3);
  });

  it('generates JSONL formatted output', () => {
    const dataset = generateTrainingDataset(sampleProblems, { format: 'jsonl' });
    expect(typeof dataset.formatted).toBe('string');
    expect(dataset.formatted).toContain('year');
  });

  it('handles empty input', () => {
    expect(generateTrainingDataset([]).totalExamples).toBe(0);
  });
});

describe('datasetGenerator — generateEmbeddingDataset()', () => {
  it('generates embedding-ready records', () => {
    const problems = [{ year: 2024, subject: 'comprehensive', section: 'economy',
      question_number: 1, difficulty: '보통', difficulty_score: 5, topic: '수요·공급',
      tags: ['economy'], metadata: { rawText: '需要曲線と供給曲線の交点について説明せよ。' } }];
    const embeddings = generateEmbeddingDataset(problems);
    expect(embeddings.length).toBe(1);
    expect(embeddings[0].text).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('ejuProblemAnalyzer — parseInput()', () => {
  it('parses array of question objects', () => {
    const { questions } = parseInput([
      { number: 1, text: '問題1のテキスト', rawText: '問題1のテキスト' },
      { number: 2, text: '問題2のテキスト', rawText: '問題2のテキスト' },
    ]);
    expect(questions.length).toBe(2);
    expect(questions[0].number).toBe(1);
  });

  it('parses OCR result with pages', () => {
    const { questions } = parseInput({
      pages: [{ questions: [{ number: 1, text: 'Q1', rawText: 'Q1' }] },
              { questions: [{ number: 2, text: 'Q2', rawText: 'Q2' }] }],
    });
    expect(questions.length).toBe(2);
  });

  it('parses raw text string by splitting', () => {
    const { questions } = parseInput('問1. 最初の問題です。\n問2. 次の問題です。');
    expect(questions.length).toBeGreaterThanOrEqual(2);
  });

  it('handles empty input', () => {
    const result = parseInput(null);
    expect(result.questions).toEqual([]);
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });
});

describe('ejuProblemAnalyzer — detectOverallSubject()', () => {
  it('detects comprehensive subject', () => {
    expect(detectOverallSubject([
      { text: '総合科目の問題です。第1問。' },
      { text: '需要曲線と供給曲線について説明せよ。' },
    ])).toBe('comprehensive');
  });

  it('detects japanese subject', () => {
    expect(detectOverallSubject([
      { text: '読解問題。次の文章を読んで問いに答えなさい。' },
      { text: '聴解問題。これから話を聞きます。' },
    ])).toBe('japanese');
  });
});

describe('ejuProblemAnalyzer — splitIntoQuestions()', () => {
  it('splits text by 問 markers', () => {
    const blocks = splitIntoQuestions('問1. 最初の問題\n問2. 次の問題\n問3. 最後の問題');
    expect(blocks.length).toBe(3);
  });

  it('returns single block if no markers found', () => {
    expect(splitIntoQuestions('単一のテキスト')).toEqual(['単一のテキスト']);
  });
});

describe('ejuProblemAnalyzer — analyzeEJUProblem()', () => {
  const sampleInput = [
    { number: 1, rawText: '次の地図を見て、ケッペンの気候区分に関する問いに答えなさい。', text: '次の地図を見て、ケッペンの気候区分に関する問いに答えなさい。' },
    { number: 2, rawText: '需要曲線と供給曲線の交点で決まる価格を何というか。', text: '需要曲線と供給曲線の交点で決まる価格を何というか。' },
  ];

  it('analyzes problems and returns structured output', async () => {
    const result = await analyzeEJUProblem(sampleInput);
    expect(result.problems.length).toBe(2);
    expect(result.problems[0]).toHaveProperty('year');
    expect(result.problems[0]).toHaveProperty('subject');
    expect(result.problems[0]).toHaveProperty('question_number');
    expect(result.problems[0]).toHaveProperty('difficulty');
    expect(result.problems[0]).toHaveProperty('difficulty_score');
    expect(result.problems[0]).toHaveProperty('topic');
    expect(result.problems[0]).toHaveProperty('tags');
  });

  it('assigns correct domains', async () => {
    const result = await analyzeEJUProblem(sampleInput);
    expect(result.problems[0].section).toBe('geography');
    expect(result.problems[1].section).toBe('economy');
  });

  it('generates aggregated tags', async () => {
    const result = await analyzeEJUProblem(sampleInput, { generateTags: true });
    expect(result.tags).toBeDefined();
    expect(Object.keys(result.tags.domainTags).length).toBeGreaterThan(0);
  });

  it('handles empty input gracefully', async () => {
    const result = await analyzeEJUProblem(null);
    expect(result.problems).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles string input', async () => {
    const result = await analyzeEJUProblem('単一のテキスト入力です。');
    expect(result.problems.length).toBeGreaterThanOrEqual(1);
  });

  it('returns metadata when configured', async () => {
    const result = await analyzeEJUProblem(sampleInput, { includeMetadata: true });
    expect(result.problems[0].metadata).toBeDefined();
    expect(result.problems[0].metadata.domain).toBeTruthy();
  });
});
