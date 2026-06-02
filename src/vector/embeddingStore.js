// ═══════════════════════════════════════════════════════════════════
// Vector Embedding Store — RAG & Similarity Search for EJU Questions
// Stores and retrieves question embeddings for semantic search.
// Uses cosine similarity for nearest-neighbor search.
// ═══════════════════════════════════════════════════════════════════

import db, { STORES } from '../db/database';

// Simple in-memory vector store (for environments without IndexedDB)
const inMemoryStore = new Map();

/**
 * Compute a simple TF-style embedding vector for Japanese text.
 * In production, use a proper embedding model (e.g., all-MiniLM-L6-v2).
 *
 * @param {string} text
 * @returns {Float64Array} Embedding vector
 */
export function computeEmbedding(text) {
  if (!text) return new Float64Array(384); // Standard embedding dimension

  // Create a bag-of-words-style embedding using EJU-relevant tokens
  const normalized = text.toLowerCase().replace(/[\s,，.．、。()（）「」【】\n\r]+/g, ' ');
  const words = normalized.split(/\s+/).filter(w => w.length >= 2);

  // EJU concept lexicon — maps terms to fixed index positions
  const lexicon = buildEjuLexicon();
  const embedding = new Float64Array(lexicon.size);

  for (const word of words) {
    if (lexicon.has(word)) {
      const idx = lexicon.get(word);
      embedding[idx] = (embedding[idx] || 0) + 1;
    }
  }

  // Normalize
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }
  }

  return embedding;
}

/**
 * Build a lexicon of EJU-relevant terms with fixed index positions.
 */
function buildEjuLexicon() {
  const lexicon = new Map();
  const terms = [
    // Economy
    '수요', '공급', '시장', '가격', '균형', '탄력성', '소비', '생산', '비용', '한계',
    '이윤', '독점', '경쟁', '과점', 'GDP', 'GNP', '국민소득', '경제성장', '인플레이션',
    '디플레이션', '스태그플레이션', '실업', '고용', '물가', '금리', '통화', '환율',
    '엔고', '엔저', '무역', '관세', '수출', '수입', '재정', '조세', '소비세', '국채',
    '연금', '사회보장', '아베노믹스', '버블', '잃어버린10년', '양적완화',
    // Politics
    '헌법', '민주주의', '선거', '정당', '의회', '내각', '국회', '행정', '입법', '사법',
    '권력분립', '기본권', '국민주권', '평화주의', '삼권분립', '의원내각제', '대통령제',
    '연방제', '지방자치', '국제연합', 'UN', '안전보장이사회', 'NATO', '국제기구',
    '국제법', '조약', '인권', '사회계약', '자연법', '마그나카르타',
    // History
    '혁명', '전쟁', '독립', '제국', '왕조', '식민지', '제국주의', '민족운동', '냉전',
    '프랑스혁명', '미국독립혁명', '산업혁명', '세계대전', '러시아혁명', '베르사유',
    '국제연맹', '파시즘', '나치즘', '히틀러', '스탈린', '마셜플랜', '데탕트',
    '메이지유신', '천황제', '평화헌법', '전후처리', '고도성장', '탈냉전',
    // Geography
    '기후', '지형', '인구', '도시', '자원', '에너지', '농업', '공업', '지도',
    '위도', '경도', '케이펜', '판구조', '해류', '몬순', '사막', '열대', '온대', '냉대',
    '툰드라', '플랜테이션', '도시화', '과밀', '과소', '고령화', '이민',
    // Society
    '환경', '복지', '고령', '저출산', 'SDGs', '온난화', '탄소', '에너지', '재생',
    '노동', '고용', '차별', '평등', '젠더', '다문화', '정보', '지속가능', 'NGO',
    'ODA', '국제협력', '기후변화', '파리협약',
  ];

  terms.forEach((term, index) => lexicon.set(term, index));
  return lexicon;
}

/**
 * Store a question embedding in the database.
 */
export async function storeEmbedding(questionId, text, metadata = {}) {
  const embedding = computeEmbedding(text);

  const record = {
    id: `emb_${questionId}`,
    questionId,
    text: text.slice(0, 500), // Store truncated text for reference
    embedding: Array.from(embedding), // Convert to array for storage
    vectorType: 'tf_bow',
    dimension: embedding.length,
    metadata,
    createdAt: new Date().toISOString(),
  };

  try {
    await db.put(STORES.EMBEDDINGS, record);
  } catch (e) {
    // Fallback to in-memory store
    inMemoryStore.set(record.id, record);
  }

  return record;
}

/**
 * Batch store embeddings for multiple questions.
 */
export async function storeEmbeddings(questions) {
  const promises = questions
    .filter(q => q && q.id && (q.cleanedText || q.rawText))
    .map(q => storeEmbedding(q.id, q.cleanedText || q.rawText, {
      domain: q.domain,
      topic: q.topic,
      year: q.metadata?.year,
    }));

  await Promise.allSettled(promises);
}

/**
 * Find similar questions by embedding similarity.
 */
export async function findSimilarQuestions(text, topK = 5, threshold = 0.3) {
  const queryEmbedding = computeEmbedding(text);

  // Retrieve all stored embeddings
  let allEmbeddings;
  try {
    allEmbeddings = await db.getAll(STORES.EMBEDDINGS);
  } catch {
    allEmbeddings = [...inMemoryStore.values()];
  }

  if (!allEmbeddings || allEmbeddings.length === 0) return [];

  // Compute cosine similarity
  const similarities = allEmbeddings
    .map(record => {
      const storedEmb = new Float64Array(record.embedding || []);
      const similarity = cosineSimilarity(queryEmbedding, storedEmb);
      return {
        questionId: record.questionId,
        text: record.text,
        similarity,
        metadata: record.metadata || {},
      };
    })
    .filter(r => r.similarity >= threshold);

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

/**
 * Get stored embedding for a question (for RAG lookups).
 */
export async function getQuestionEmbedding(questionTextOrId) {
  try {
    // Try to find by text similarity
    const all = await db.getAll(STORES.EMBEDDINGS);
    return all || [];
  } catch {
    return [...inMemoryStore.values()];
  }
}

/**
 * Delete embeddings for a question.
 */
export async function deleteEmbedding(questionId) {
  try {
    await db.delete(STORES.EMBEDDINGS, `emb_${questionId}`);
  } catch {
    inMemoryStore.delete(`emb_${questionId}`);
  }
}

export default {
  computeEmbedding,
  storeEmbedding,
  storeEmbeddings,
  findSimilarQuestions,
  cosineSimilarity,
  deleteEmbedding,
};
