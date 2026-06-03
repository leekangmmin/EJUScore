// ═══════════════════════════════════════════════════════════════════════════
// Dataset Generator — AI Training Dataset Builder
//
// Converts analyzed EJU problems into structured training datasets
// suitable for fine-tuning LLMs (e.g., Qwen, LLaMA) and embedding models.
//
// Output formats:
//   1. JSONL (JSON Lines) — prompt-completion pairs for LLM fine-tuning
//   2. Structured JSON — full metadata for RAG / knowledge base
//   3. CSV — tabular format for traditional ML models
//   4. Embedding-ready — text + metadata for vector database ingestion
//
// Each training example includes:
//   - Input: OCR text + context metadata
//   - Output: Normalized problem analysis (structured JSON)
//   - Optional: Reasoning traces, explanations, distractors
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @typedef {object} TrainingExample
 * @property {string} id - Unique example ID
 * @property {object} input - Model input
 * @property {object} output - Expected output
 * @property {object} metadata - Dataset metadata
 */

/**
 * @typedef {object} DatasetConfig
 * @property {string} [format='jsonl'] - Output format: 'jsonl' | 'json' | 'csv'
 * @property {boolean} [includeMetadata=true] - Include metadata in output
 * @property {boolean} [includeReasoning=false] - Include reasoning traces
 * @property {string} [taskType='analysis'] - Task type: 'analysis' | 'classification' | 'qa'
 * @property {string} [outputPath] - Optional output path (Node.js only)
 * @property {number} [maxExamples=1000] - Maximum number of examples
 */

/**
 * Generate training dataset from analyzed problems.
 *
 * @param {Array<object>} problems - Analyzed problem objects (from analyzeEJUProblem)
 * @param {DatasetConfig} [config]
 * @returns {object} Generated dataset with multiple output formats
 */
export function generateTrainingDataset(problems = [], config = {}) {
  const {
    format = 'jsonl',
    includeMetadata = true,
    includeReasoning = false,
    taskType = 'analysis',
    maxExamples = 1000,
  } = config;

  if (!problems || problems.length === 0) {
    return { examples: [], format, totalExamples: 0 };
  }

  const limited = problems.slice(0, maxExamples);

  // Generate examples in different task formats
  let examples;

  switch (taskType) {
    case 'classification':
      examples = generateClassificationExamples(limited, config);
      break;
    case 'qa':
      examples = generateQAExamples(limited, config);
      break;
    case 'analysis':
    default:
      examples = generateAnalysisExamples(limited, config);
      break;
  }

  // Format output
  const output = formatOutput(examples, format);

  return {
    examples,
    formatted: output,
    format,
    totalExamples: examples.length,
    config: {
      taskType,
      includeMetadata,
      includeReasoning,
      maxExamples,
    },
    stats: generateDatasetStats(examples),
    generatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate analysis task examples (input → structured output).
 * This is the primary format for EJU problem analysis training.
 */
function generateAnalysisExamples(problems, config) {
  const { includeMetadata, includeReasoning } = config;

  return problems.map((p, idx) => {
    const input = {
      text: p.metadata?.rawText || '',
      subject: p.subject,
      question_number: p.question_number,
    };

    const output = {
      year: p.year,
      subject: p.subject,
      section: p.section,
      question_number: p.question_number,
      difficulty: p.difficulty,
      difficulty_score: p.difficulty_score,
      topic: p.topic,
      tags: p.tags,
      answer: p.answer,
      explanation: p.explanation,
    };

    const example = {
      id: `eju_train_${idx + 1}`,
      input,
      output,
      metadata: {
        source: 'eju_ocr_analysis',
        task_type: 'analysis',
        year: p.year,
        subject: p.subject,
        difficulty_score: p.difficulty_score,
      },
    };

    // Add reasoning trace if requested
    if (includeReasoning && p.metadata) {
      example.reasoning = generateReasoningTrace(p);
    }

    // Add full metadata if requested
    if (includeMetadata) {
      example.metadata.fullAnalysis = {
        domain: p.metadata?.domain,
        domainConfidence: p.metadata?.domainConfidence,
        yearConfidence: p.metadata?.yearConfidence,
        round: p.metadata?.round,
        languages: p.metadata?.languages,
        hasFormulas: p.metadata?.hasFormulas,
      };
    }

    return example;
  });
}

/**
 * Generate classification task examples (text → category).
 * Useful for training lightweight classifiers for subject/domain/difficulty.
 */
function generateClassificationExamples(problems, config) {
  const examples = [];

  for (const p of problems) {
    const text = p.metadata?.rawText || '';
    if (!text) continue;

    // Subject classification example
    examples.push({
      id: `eju_cls_subj_${p.question_number}`,
      input: { text, task: 'subject_classification' },
      output: { subject: p.subject, section: p.section },
      metadata: { type: 'subject_classification' },
    });

    // Difficulty classification example
    examples.push({
      id: `eju_cls_diff_${p.question_number}`,
      input: { text, task: 'difficulty_classification' },
      output: { difficulty: p.difficulty, difficulty_score: p.difficulty_score },
      metadata: { type: 'difficulty_classification' },
    });

    // Domain classification example (for comprehensive subject)
    if (p.subject === 'comprehensive' || p.section) {
      examples.push({
        id: `eju_cls_dom_${p.question_number}`,
        input: { text, task: 'domain_classification' },
        output: { domain: p.section },
        metadata: { type: 'domain_classification' },
      });
    }

    // Topic classification example
    if (p.topic) {
      examples.push({
        id: `eju_cls_topic_${p.question_number}`,
        input: { text, task: 'topic_classification' },
        output: { topic: p.topic },
        metadata: { type: 'topic_classification' },
      });
    }
  }

  return examples;
}

/**
 * Generate QA (Question-Answer) task examples.
 * Useful for training retrieval or reading comprehension models.
 */
function generateQAExamples(problems, config) {
  const examples = [];

  for (const p of problems) {
    const text = p.metadata?.rawText || '';
    if (!text) continue;

    // Answer prediction example
    if (p.answer) {
      examples.push({
        id: `eju_qa_ans_${p.question_number}`,
        input: {
          question_text: text,
          context: `${p.subject} ${p.section || ''} ${p.topic || ''}`.trim(),
        },
        output: { answer: p.answer },
        metadata: {
          type: 'question_answering',
          hasExplanation: !!p.explanation,
        },
      });
    }

    // Explanation generation example
    if (p.explanation) {
      examples.push({
        id: `eju_qa_exp_${p.question_number}`,
        input: {
          question_text: text,
          correct_answer: p.answer,
          difficulty: p.difficulty,
          topic: p.topic,
        },
        output: { explanation: p.explanation },
        metadata: { type: 'explanation_generation' },
      });
    }

    // Tag prediction example
    if (p.tags && p.tags.length > 0) {
      examples.push({
        id: `eju_qa_tag_${p.question_number}`,
        input: { question_text: text },
        output: { tags: p.tags },
        metadata: { type: 'tag_prediction' },
      });
    }
  }

  return examples;
}

/**
 * Generate a human-readable reasoning trace for the analysis.
 */
function generateReasoningTrace(p) {
  const steps = [];

  steps.push(`1. 연도 감지: ${p.year || '알 수 없음'}`);
  steps.push(`2. 과목 분류: ${p.subject || 'unknown'}`);
  if (p.section) steps.push(`3. 섹션/도메인: ${p.section}`);
  steps.push(`4. 난이도 추정: ${p.difficulty} (${p.difficulty_score}/10)`);
  if (p.topic) steps.push(`5. 주제: ${p.topic}`);
  steps.push(`6. 태그 추출: ${p.tags.slice(0, 5).join(', ')}${p.tags.length > 5 ? '...' : ''}`);

  return steps.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format examples into the requested output format.
 */
function formatOutput(examples, format) {
  switch (format) {
    case 'jsonl':
      return formatJSONL(examples);
    case 'json':
      return { examples };
    case 'csv':
      return formatCSV(examples);
    default:
      return formatJSONL(examples);
  }
}

/**
 * Format as JSON Lines (one JSON object per line).
 */
function formatJSONL(examples) {
  return examples.map(ex => JSON.stringify(ex)).join('\n');
}

/**
 * Format as CSV (flattened structure).
 */
function formatCSV(examples) {
  if (examples.length === 0) return '';

  // Flatten first example to get headers
  const headers = flattenObjectKeys(examples[0]);
  const lines = [headers.join(',')];

  for (const ex of examples) {
    const flattened = flattenObject(ex);
    const row = headers.map(h => {
      const val = flattened[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape CSV
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Flatten nested object to dot-notation keys.
 */
function flattenObjectKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenObjectKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/**
 * Flatten nested object to dot-notation key-value pairs.
 */
function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else if (Array.isArray(value)) {
      result[fullKey] = value.join('; ');
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate dataset statistics.
 */
function generateDatasetStats(examples) {
  const stats = {
    totalExamples: examples.length,
    bySubject: {},
    byDifficulty: {},
    byYear: {},
    avgTagsPerExample: 0,
    totalTags: 0,
  };

  let totalTags = 0;

  for (const ex of examples) {
    const output = ex.output || {};
    const metadata = ex.metadata || {};

    // Count by subject
    const subject = output.subject || metadata.subject || 'unknown';
    stats.bySubject[subject] = (stats.bySubject[subject] || 0) + 1;

    // Count by difficulty
    const difficulty = output.difficulty || 'unknown';
    stats.byDifficulty[difficulty] = (stats.byDifficulty[difficulty] || 0) + 1;

    // Count by year
    const year = output.year || metadata.year || 'unknown';
    stats.byYear[year] = (stats.byYear[year] || 0) + 1;

    // Count tags
    if (output.tags) {
      totalTags += output.tags.length;
    }
  }

  stats.avgTagsPerExample = examples.length > 0
    ? parseFloat((totalTags / examples.length).toFixed(2))
    : 0;
  stats.totalTags = totalTags;

  return stats;
}

/**
 * Export dataset in embedding-ready format (text + metadata for vector DB).
 *
 * @param {Array<object>} problems
 * @param {object} [options]
 * @returns {Array<{id: string, text: string, metadata: object}>}
 */
export function generateEmbeddingDataset(problems = [], options = {}) {
  const { includeRawText = true, includeAnalysis = true } = options;

  return problems.map((p, idx) => {
    // Build the text to embed
    const textParts = [];

    if (includeRawText && p.metadata?.rawText) {
      textParts.push(p.metadata.rawText);
    }

    if (includeAnalysis) {
      const analysisParts = [
        p.subject && `과목: ${p.subject}`,
        p.section && `영역: ${p.section}`,
        p.topic && `주제: ${p.topic}`,
        p.difficulty && `난이도: ${p.difficulty}`,
        p.tags?.length > 0 && `태그: ${p.tags.join(', ')}`,
      ].filter(Boolean);
      textParts.push(analysisParts.join('\n'));
    }

    return {
      id: `eju_emb_${idx + 1}`,
      text: textParts.join('\n\n'),
      metadata: {
        year: p.year,
        subject: p.subject,
        section: p.section,
        question_number: p.question_number,
        difficulty: p.difficulty,
        difficulty_score: p.difficulty_score,
        topic: p.topic,
        tags: p.tags,
        charLength: (p.metadata?.rawText || '').length,
      },
    };
  });
}

export default {
  generateTrainingDataset,
  generateEmbeddingDataset,
};
