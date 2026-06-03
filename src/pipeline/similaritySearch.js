// ═══════════════════════════════════════════════════════════════════════
// Similarity Search Engine — EJU Problem Retrieval & Matching
//
// Implements multi-strategy similarity search:
//   1. Text-based cosine similarity (TF-IDF style)
//   2. Domain + topic level exact matching
//   3. Knowledge graph concept overlap scoring
//   4. Vector embedding similarity (if embeddings available)
//   5. Combined hybrid scoring
//
// Use cases:
//   - Find similar past questions for a given problem
//   - Detect duplicate or near-duplicate questions
//   - Recommend practice questions based on error patterns
//   - Build training data by clustering similar problems
// ═══════════════════════════════════════════════════════════════════════

/**
 * @typedef {object} SimilarQuestion
 * @property {string} id - Question identifier
 * @property {number} question_number - Question number
 * @property {number} year - Exam year
 * @property {number} round - Exam round
 * @property {string} domain - Subject domain
 * @property {string} topic - Topic name
 * @property {string} text - Question text (truncated)
 * @property {number} similarity - Similarity score (0-1)
 * @property {string} method - Matching method used
 * @property {Array<string>} sharedTags - Tags in common
 */

// ── Stopwords / Japanese particles (助詞) [Critical #3] ──────────────
const JP_PARTICLES = new Set([
  'の', 'は', 'が', 'を', 'に', 'へ', 'と', 'で', 'も', 'や', 'か', 'ね',
  'よ', 'わ', 'な', 'し', 'て', 'だ', 'ば', 'つ', 'る', 'れ', 'ら',
]);
const SHINGLE_STOPWORDS = new Set([
  'について', 'なさい', 'ものを', '次の', '問い', 'ついて', 'として', 'という',
  'ように', 'こと', 'もの', 'ある', 'いる', 'する', 'れる', 'られ',
]);
const EN_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'and', 'or', 'is', 'are',
  'for', 'with', 'by', 'at', 'as', 'be', 'this', 'that',
]);

/** Weight a TF map by IDF → TF-IDF map [Critical #3]. */
function applyIdf(tf, idfFn) {
  const out = {};
  for (const [term, val] of Object.entries(tf)) out[term] = val * idfFn(term);
  return out;
}

// ── Text tokenization helpers ──────────────────────────────────────

/**
 * Tokenize text into normalized word tokens.
 * Handles Japanese (without word boundaries) by using character n-grams
 * and keyword extraction. Stopwords and Japanese particles are removed.
 *
 * @param {string} text
 * @returns {Array<string>} Normalized tokens
 */
function tokenize(text) {
  if (!text) return [];

  let normalized = text
    .toLowerCase()
    .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // For CJK text, extract characters; drop Japanese particle unigrams.
  const allCjk = normalized.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g) || [];
  const cjkChars = allCjk.filter(c => !JP_PARTICLES.has(c));
  const alphanum = normalized.split(/[\s]+/).filter(w => /[a-zA-Z0-9]/.test(w) && !EN_STOPWORDS.has(w));

  // 2-3 char shingles over the full char stream, minus function-word shingles.
  const shingles = new Set();
  for (let i = 0; i < allCjk.length - 1; i++) {
    const bi = allCjk[i] + allCjk[i + 1];
    if (!SHINGLE_STOPWORDS.has(bi)) shingles.add(bi);
  }
  for (let i = 0; i < allCjk.length - 2; i++) {
    const tri = allCjk[i] + allCjk[i + 1] + allCjk[i + 2];
    if (!SHINGLE_STOPWORDS.has(tri)) shingles.add(tri);
  }

  return [...new Set([...cjkChars, ...alphanum, ...shingles])];
}

/**
 * Compute TF (term frequency) for a tokenized document.
 *
 * @param {Array<string>} tokens
 * @returns {object} term -> frequency map
 */
function computeTF(tokens) {
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  const len = tokens.length || 1;
  for (const key of Object.keys(tf)) {
    tf[key] /= len;
  }
  return tf;
}

/**
 * Compute cosine similarity between two TF vectors.
 *
 * @param {object} tf1 - Term frequency vector 1
 * @param {object} tf2 - Term frequency vector 2
 * @returns {number} Cosine similarity (0-1)
 */
function cosineSimilarity(tf1, tf2) {
  const union = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
  let dot = 0, mag1 = 0, mag2 = 0;

  for (const term of union) {
    const v1 = tf1[term] || 0;
    const v2 = tf2[term] || 0;
    dot += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  }

  const mag = Math.sqrt(mag1) * Math.sqrt(mag2);
  return mag === 0 ? 0 : dot / mag;
}

// ── Main similarity search ─────────────────────────────────────────

/**
 * Search for questions similar to a query.
 *
 * @param {string|object} query - Query text or question object
 * @param {Array<object>} questionPool - Pool of questions to search
 * @param {object} [options]
 * @param {number} [options.count=10] - Max results to return
 * @param {number} [options.minSimilarity=0.1] - Minimum similarity threshold
 * @param {boolean} [options.useDomainBoost=true] - Boost same-domain matches
 * @param {boolean} [options.useTopicBoost=true] - Boost same-topic matches
 * @returns {Array<SimilarQuestion>} Ranked similar questions
 */
export function similaritySearch(query, questionPool, options = {}) {
  const {
    count = 10,
    minSimilarity = 0.1,
    useDomainBoost = true,
    useTopicBoost = true,
  } = options;

  if (!query || !questionPool || questionPool.length === 0) return [];

  // Normalize query
  const queryText = typeof query === 'string' ? query
    : query.cleanedText || query.text || query.rawText || '';
  const queryDomain = query.domain || query.detectedDomain || '';
  const queryTopic = query.topic || '';
  const queryTokens = tokenize(queryText);
  const queryTF = computeTF(queryTokens);

  if (queryTokens.length === 0) return [];

  // ── TF-IDF [Critical #3]: document frequencies over the pool ──────
  const N = questionPool.length || 1;
  const df = new Map();
  for (const q of questionPool) {
    const t = q.cleanedText || q.text || q.rawText || '';
    if (!t) continue;
    for (const tok of new Set(tokenize(t))) df.set(tok, (df.get(tok) || 0) + 1);
  }
  const idf = (tok) => Math.log(1 + N / ((df.get(tok) || 0) + 1));
  const queryVec = applyIdf(queryTF, idf);

  // Score each question
  const scored = [];
  const seen = new Set();

  for (const q of questionPool) {
    const qId = q.id || `${q.year}_${q.question_number}`;
    if (seen.has(qId)) continue;
    seen.add(qId);

    const qText = q.cleanedText || q.text || q.rawText || '';
    if (!qText) continue;

    // Strategy 1: Text similarity (TF-IDF cosine)
    const qTokens = tokenize(qText);
    const qTF = computeTF(qTokens);
    const textSimilarity = cosineSimilarity(queryVec, applyIdf(qTF, idf));

    // Strategy 2: Domain match
    let domainScore = 0;
    if (useDomainBoost && queryDomain && q.domain) {
      domainScore = queryDomain === q.domain ? 0.3 : 0;
    }

    // Strategy 3: Topic match
    let topicScore = 0;
    if (useTopicBoost && queryTopic && q.topic) {
      topicScore = queryTopic === q.topic ? 0.25 : 0;
      // Partial match
      if (topicScore === 0 && q.topic.includes(queryTopic)) {
        topicScore = 0.15;
      }
    }

    // Strategy 4: Shared concept tags
    const sharedTags = findSharedTags(query, q);
    const tagBonus = Math.min(0.2, sharedTags.length * 0.05);

    // Combined score
    const combined = textSimilarity + domainScore + topicScore + tagBonus;

    if (combined > minSimilarity) {
      scored.push({
        id: qId,
        question_number: q.question_number || q.number || 0,
        year: q.year || q.metadata?.year || 0,
        round: q.round || q.metadata?.round || 0,
        domain: q.domain || q.detectedDomain || '',
        topic: q.topic || '',
        text: qText.substring(0, 200),
        similarity: parseFloat(Math.min(1, combined).toFixed(4)),
        method: textSimilarity > 0.3 ? 'text_match' : 'hybrid',
        sharedTags,
      });
    }
  }

  // Sort by similarity (descending) and return top-k
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, count);
}

/**
 * Find shared tags between query and a pool question.
 */
function findSharedTags(query, question) {
  const shared = [];
  const queryTags = new Set();

  // Collect tags from query
  if (query.tags) query.tags.forEach(t => queryTags.add(t));
  if (query.domain) queryTags.add(query.domain);
  if (query.topic) queryTags.add(query.topic);

  // Collect tags from question
  const qTags = new Set();
  if (question.tags) question.tags.forEach(t => qTags.add(t));
  if (question.domain) qTags.add(question.domain);
  if (question.topic) qTags.add(question.topic);

  for (const t of queryTags) {
    if (qTags.has(t)) shared.push(t);
  }

  return shared;
}

/**
 * Convenience: find similar questions from datasets (gold standard).
 *
 * @param {object} query - Query question object
 * @param {object} datasets - Dataset cache
 * @param {object} [options]
 * @returns {Array<SimilarQuestion>}
 */
export function findSimilarQuestions(query, datasets = {}, options = {}) {
  const count = options.count || 10;

  // Gather question pool from all available datasets
  const pool = [];

  const gs = datasets?.goldStandard;
  if (gs?.questions) {
    pool.push(...gs.questions.map(q => ({
      ...q,
      id: q.id || `gs_${q.year}_${q.question_number}`,
    })));
  }

  const trend = datasets?.trendAnalysis;
  if (trend?.questions) {
    pool.push(...trend.questions.map(q => ({
      ...q,
      id: q.id || `trend_${q.year}_${q.question_number}`,
    })));
  }

  // Exclude exact match from pool
  const filtered_pool = pool.filter(q =>
    q.question_number !== query.question_number ||
    q.year !== query.year
  );

  return similaritySearch(query, filtered_pool, { ...options, count });
}

/**
 * Cluster questions by similarity (for dataset organization).
 *
 * @param {Array<object>} questions - Questions to cluster
 * @param {object} [options]
 * @param {number} [options.threshold=0.4] - Similarity threshold for clustering
 * @returns {Array<{cluster: number, questions: Array}>}
 */
export function clusterBySimilarity(questions, options = {}) {
  const { threshold = 0.4 } = options;
  if (!questions || questions.length === 0) return [];

  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < questions.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = { cluster: clusters.length, questions: [questions[i]] };
    assigned.add(i);

    for (let j = i + 1; j < questions.length; j++) {
      if (assigned.has(j)) continue;

      const results = similaritySearch(questions[i], [questions[j]], {
        minSimilarity: threshold, useDomainBoost: true, useTopicBoost: true,
      });

      if (results.length > 0 && results[0].similarity >= threshold) {
        cluster.questions.push(questions[j]);
        assigned.add(j);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

export default {
  similaritySearch,
  findSimilarQuestions,
  clusterBySimilarity,
};
