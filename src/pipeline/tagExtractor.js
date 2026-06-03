// ═══════════════════════════════════════════════════════════════════════
// Tag Extractor — Structured Tag & Concept Extraction from EJU Problems
//
// Extracts rich metadata tags from problem text:
//   - Domain tags (economy, politics, history, geography, society)
//   - Concept tags (specific EJU topic names from knowledge graph)
//   - Material type tags (graph, table, map, diagram, text-only)
//   - Difficulty tags (easy, medium, hard, killer)
//   - Question type tags
//   - Formula presence tags
//   - Language tags (Japanese, Korean mixed, etc.)
//
// Integrates with:
//   - subjectClassifier for keyword-based extraction
//   - knowledge graph taxonomy for concept hierarchy
//   - gold standard dataset for known question references
// ═══════════════════════════════════════════════════════════════════════

/**
 * @typedef {object} TagSet
 * @property {Array<{tag: string, weight: number, source: string}>} domainTags
 * @property {Array<{tag: string, weight: number, confidence: number}>} conceptTags
 * @property {Array<{tag: string, type: string}>} materialTags
 * @property {Array<{tag: string}>} difficultyTags
 * @property {Array<{tag: string}>} typeTags
 * @property {Array<{tag: string}>} formulaTags
 * @property {Array<{tag: string}>} languageTags
 */

import { SUBJECT_KEYWORDS, SUBJECT_PRIORITY, scoreSubjects } from '../utils/subjectClassifier';
import { extractFormulas, detectQuestionType } from '../ocr/semanticReconstruction';
import { makeFuzzyMatcher } from './textMatch';

// ── Difficulty thresholds ───────────────────────────────────────────
const DIFFICULTY_LABELS = {
  1: '기초', 2: '기초', 3: '쉬움', 4: '쉬움',
  5: '보통', 6: '보통',
  7: '어려움', 8: '어려움',
  9: '킬러', 10: '킬러',
};

// ── Material type patterns ──────────────────────────────────────────
const MATERIAL_PATTERNS = [
  { type: 'graph', patterns: [/グラフ/, /그래프/, /折れ線/, /棒グラフ/, /円グラフ/,
      /曲線/, /chart/i, /graph/i] },
  { type: 'table', patterns: [/表[0-9]/, /次の表/, /一覧/, /테이블/, /table/i,
      /統計表/, /数値表/] },
  { type: 'map', patterns: [/地図/, /지도/, /地圖/, /map/i, /地形図/, /地図中/,
      /地図上/] },
  { type: 'diagram', patterns: [/図[0-9]/, /사진/, /写真/, /그림/, /schema/i,
      /fig/i, /figure/i, /略図/] },
  { type: 'timeline', patterns: [/年表/, /연표/, /年代順/, /chronology/i,
      /timeline/i] },
  { type: 'quotation', patterns: [/資料/, /자료/, /史料/, /原文/, /引用/,
      /source/i, /excerpt/i] },
  { type: 'political_cartoon', patterns: [/風刺/, /만평/, /caricature/i,
      /political cartoon/i] },
  { type: 'formula', patterns: [/式[0-9]/, /公式/, /方程式/, /수식/] },
];

// ── Language detection patterns ─────────────────────────────────────
const LANGUAGE_PATTERNS = {
  japanese: /[ぁ-んァ-ン一-龯]/,
  korean: /[ㄱ-ㅎㅏ-ㅣ가-힣]/,
  english: /[a-zA-Z]/,
};

// Known EJU concept list (topic-level) for concept tag extraction.
// DeepSeek audit [High #5]: split into per-language dictionaries so that
// Japanese concept terms actually match the Japanese OCR corpus (the old
// Korean-only list rarely matched JA text), with KO/EN bridges for queries.
const CONCEPT_DICTIONARIES = {
  ko: {
    economy: [
      '수요·공급', '시장균형', 'GDP', '국민소득', '경제성장', '경기변동',
      '인플레이션', '디플레이션', '통화정책', '재정정책', '금리', '환율',
      '국제수지', '무역', '비교우위', '관세', 'FTA', '소득분배', '지니계수',
      '일본경제', '버블경제', '아베노믹스', '소비세', '노동시장', '실업',
      '공공재', '외부효과', '독과점', '시장실패', '케인즈', '통화량',
    ],
    politics: [
      '삼권분립', '의원내각제', '대통령제', '일본헌법', '제9조', '기본권',
      '참정권', '사회권', '선거제도', '비례대표', '소선거구', '정당',
      '지방자치', '사법심사', '위헌심사', '국제연합', '안전보장이사회',
      '헌법개정', '천황', '국회', '내각', '홉스', '로크', '루소',
      '민주주의', '법의지배', '평화주의', '인권', 'NATO',
    ],
    history: [
      '시민혁명', '프랑스혁명', '산업혁명', '세계대전', '냉전', '제국주의',
      '식민지', '메이지유신', '러시아혁명', '중국혁명', '나치즘', '파시즘',
      '대항해시대', '르네상스', '종교개혁', '십자군', '베르사유체제',
      '국제연맹', '대공황', '뉴딜', '마셜플랜', '탈냉전', '글로벌화',
      '일본근대화', '전후처리', '경제성장',
    ],
    geography: [
      '기후', '케이펜', '지형', '판구조', '인구', '도시화', '자원',
      '농업', '공업', '환경', '지도', 'GIS', '위도', '경도', '표준시',
      '해류', '플랜테이션', '배타적경제수역', '사막화', '지구온난화',
      '신재생에너지', '식량문제', '수자원',
    ],
    society: [
      '저출산', '고령화', '사회보장', '연금', '의료보험', '개호보험',
      'SDGs', '지속가능발전', '환경문제', '탄소배출', '파리협약',
      '젠더', '다문화공생', '정보화사회', 'NGO', 'NPO', 'ODA',
      '노동법', '비정규직', '최저임금', '워라밸', '인권',
    ],
  },
  ja: {
    economy: [
      '需要曲線', '供給曲線', '需要', '供給', '均衡価格', '市場均衡', '国民所得',
      '経済成長', '景気変動', 'インフレ', 'インフレーション', 'デフレ', '金融政策',
      '財政政策', '金利', '為替', '為替相場', '円高', '円安', '国際収支', '貿易',
      '比較優位', '関税', '所得分配', 'ジニ係数', 'バブル経済', 'アベノミクス',
      '消費税', '労働市場', '失業', '公共財', '外部効果', '独占', '寡占',
      '市場の失敗', 'ケインズ', '通貨量',
    ],
    politics: [
      '三権分立', '議院内閣制', '大統領制', '日本国憲法', '第九条', '第9条',
      '基本的人権', '参政権', '社会権', '選挙制度', '比例代表', '小選挙区',
      '政党', '地方自治', '司法審査', '違憲審査', '国際連合', '国連',
      '安全保障理事会', '憲法改正', '天皇', '国会', '内閣', 'ホッブズ', 'ロック',
      'ルソー', '民主主義', '法の支配', '平和主義', '人権',
    ],
    history: [
      '市民革命', 'フランス革命', '産業革命', '世界大戦', '第一次世界大戦',
      '第二次世界大戦', '冷戦', '帝国主義', '植民地', '明治維新', 'ロシア革命',
      '中国革命', 'ナチズム', 'ファシズム', '大航海時代', 'ルネサンス',
      '宗教改革', '十字軍', 'ベルサイユ体制', '国際連盟', '世界恐慌',
      'ニューディール', 'マーシャル・プラン', 'デタント', 'グローバル化',
    ],
    geography: [
      '気候', 'ケッペン', '気候区分', '地形', 'プレート', '人口', '都市化',
      '資源', '農業', '工業', '環境', '地図', '緯度', '経度', '標準時',
      '海流', 'プランテーション', '排他的経済水域', '砂漠化', '地球温暖化',
      '再生可能エネルギー', '食料問題', '水資源', 'モンスーン',
    ],
    society: [
      '少子化', '高齢化', '社会保障', '年金', '医療保険', '介護保険',
      'SDGs', '持続可能', '環境問題', '炭素', 'パリ協定', '京都議定書',
      'ジェンダー', '多文化共生', '情報化社会', 'NGO', 'NPO', 'ODA',
      '労働法', '非正規雇用', '最低賃金', '人権',
    ],
  },
  en: {
    economy: ['supply', 'demand', 'GDP', 'inflation', 'deflation', 'exchange rate',
      'tariff', 'trade', 'monetary policy', 'fiscal policy', 'Keynes', 'unemployment'],
    politics: ['constitution', 'separation of powers', 'United Nations', 'democracy',
      'human rights', 'parliament', 'election', 'NATO', 'Hobbes', 'Locke', 'Rousseau'],
    history: ['French Revolution', 'Industrial Revolution', 'World War', 'Cold War',
      'imperialism', 'Meiji', 'Renaissance', 'Reformation', 'New Deal', 'Marshall Plan'],
    geography: ['climate', 'Koppen', 'landform', 'plate', 'population', 'urbanization',
      'monsoon', 'desertification', 'global warming', 'resources'],
    society: ['aging', 'SDGs', 'gender', 'sustainable', 'welfare', 'NGO', 'ODA',
      'climate change', 'Paris Agreement'],
  },
};

// Backward-compatible export (API frozen): the Korean dictionary.
const KNOWN_CONCEPTS = CONCEPT_DICTIONARIES.ko;

/**
 * Extract comprehensive tags from a problem's text and metadata.
 *
 * @param {object} question - Question object with text, domain, difficulty, etc.
 * @param {object} [datasets] - Optional datasets (knowledgeGraph, goldStandard)
 * @returns {TagSet}
 */
export function extractTags(question, datasets = {}) {
  const text = question.cleanedText || question.normalizedText || question.rawText || '';
  const domain = question.detectedDomain || question.domain || '';
  const difficulty = question.difficulty || 5;
  const materials = question.materials || [];

  const tags = {
    domainTags: [],
    conceptTags: [],
    materialTags: [],
    difficultyTags: [],
    typeTags: [],
    formulaTags: [],
    languageTags: [],
  };

  // ── 1. Domain tags ─────────────────────────────────────────────
  if (domain && domain !== 'unknown') {
    tags.domainTags.push({
      tag: domain,
      weight: 1.0,
      source: 'classification',
    });
  }

  // Also add secondary domains with significant keyword presence
  const scores = scoreSubjects(text);
  const maxScore = Math.max(...Object.values(scores), 1);
  for (const d of SUBJECT_PRIORITY) {
    if (d !== domain && scores[d] / maxScore >= 0.3) {
      tags.domainTags.push({
        tag: d,
        weight: parseFloat((scores[d] / maxScore).toFixed(2)),
        source: 'keyword_overlap',
      });
    }
  }

  // ── 2. Concept tags ──────────────────────────────────────────
  const conceptHits = extractConceptTags(text, domain, datasets);
  tags.conceptTags.push(...conceptHits);

  // ── 3. Material type tags ────────────────────────────────────
  tags.materialTags.push(...detectMaterialTypes(text, materials));

  // ── 4. Difficulty tags ───────────────────────────────────────
  const diffLabel = DIFFICULTY_LABELS[difficulty] || '보통';
  tags.difficultyTags.push({ tag: diffLabel });
  if (difficulty >= 8) {
    tags.difficultyTags.push({ tag: '고난도' });
  }
  if (difficulty >= 9) {
    tags.difficultyTags.push({ tag: '킬러문항' });
  }

  // ── 5. Question type tags ────────────────────────────────────
  const qType = question.type || detectQuestionType(text);
  tags.typeTags.push({ tag: qType });

  // ── 6. Formula tags ──────────────────────────────────────────
  const formulas = question.formulas || extractFormulas(text);
  if (formulas.length > 0) {
    tags.formulaTags.push({ tag: '수식포함' });
    for (const f of formulas) {
      if (f.type === 'scientific_notation') {
        tags.formulaTags.push({ tag: '과학표기법' });
      }
    }
  }

  // ── 7. Language tags ─────────────────────────────────────────
  const langDetected = detectLanguage(text);
  tags.languageTags = langDetected.map(l => ({ tag: l }));

  return tags;
}

/**
 * Extract concept-level tags from text using keyword matching + knowledge graph.
 */
function extractConceptTags(text, domain, datasets) {
  const concepts = [];
  const seen = new Set();
  // OCR-tolerant matcher built once over the (normalized) text [Critical #2].
  const match = makeFuzzyMatcher(text);

  // Strategy 1: Known concept list matching across JA/KO/EN dictionaries.
  const searchDomains = domain && domain !== 'unknown'
    ? [domain, ...SUBJECT_PRIORITY.filter(d => d !== domain)]
    : SUBJECT_PRIORITY;

  for (const lang of ['ja', 'ko', 'en']) {
    const dict = CONCEPT_DICTIONARIES[lang] || {};
    for (const d of searchDomains) {
      const domainConcepts = dict[d] || [];
      for (const concept of domainConcepts) {
        if (seen.has(concept)) continue;
        if (match(concept)) {
          const confidence = calculateConceptConfidence(concept, text, d);
          concepts.push({
            tag: concept,
            weight: parseFloat(confidence.toFixed(2)),
            confidence: parseFloat(confidence.toFixed(2)),
          });
          seen.add(concept);
        }
      }
    }
  }

  // Strategy 2: Knowledge graph taxonomy lookup
  const kg = datasets?.knowledgeGraph;
  if (kg?.taxonomy) {
    // Search across all domains in taxonomy
    for (const [, domData] of Object.entries(kg.taxonomy)) {
      const topics = domData.topics || {};
      for (const [topicName, subtopics] of Object.entries(topics)) {
        if (seen.has(topicName)) continue;
        if (match(topicName)) {
          concepts.push({
            tag: topicName,
            weight: 0.85,
            confidence: 0.85,
          });
          seen.add(topicName);
          continue;
        }
        // Check subtopics
        if (Array.isArray(subtopics)) {
          for (const sub of subtopics) {
            if (!seen.has(sub) && match(sub)) {
              concepts.push({
                tag: sub,
                weight: 0.75,
                confidence: 0.75,
              });
              seen.add(sub);
            }
          }
        }
      }
    }
  }

  // Strategy 3: Strong keyword matching
  for (const d of SUBJECT_PRIORITY) {
    const keywords = SUBJECT_KEYWORDS[d];
    if (!keywords) continue;

    for (const level of ['critical', 'strong']) {
      const words = keywords[level] || [];
      for (const kw of words) {
        if (seen.has(kw)) continue;
        if (match(kw)) {
          const weight = level === 'critical' ? 0.95 : 0.7;
          concepts.push({
            tag: kw,
            weight,
            confidence: weight,
          });
          seen.add(kw);
        }
      }
    }
  }

  // Deduplicate and limit
  return concepts
    .filter((c, i, arr) => arr.findIndex(x => x.tag === c.tag) === i)
    .slice(0, 20);
}

/**
 * Calculate confidence for a concept match based on context.
 */
function calculateConceptConfidence(concept, text, domain) {
  const idx = text.indexOf(concept);
  if (idx === -1) return 0.5;

  // Higher confidence if concept appears early in text
  const positionFactor = 1 - (idx / text.length);

  // Higher confidence for longer/more specific concepts
  const lengthFactor = Math.min(1, concept.length / 10);

  // Domain match bonus
  const domainBonus = 0.2;

  return Math.min(0.98, 0.5 + positionFactor * 0.3 + lengthFactor * 0.2 + domainBonus);
}

/**
 * Detect material types in the problem (graph, table, map, etc.).
 */
function detectMaterialTypes(text, existingMaterials = []) {
  const types = new Set();

  // From existing materials
  for (const m of existingMaterials) {
    if (m.type) types.add({ tag: m.type, type: m.type });
  }

  // From text patterns
  for (const { type, patterns } of MATERIAL_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        types.add({ tag: type, type });
        break;
      }
    }
  }

  return [...types];
}

/**
 * Detect languages present in the text.
 */
function detectLanguage(text) {
  const languages = [];
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    if (pattern.test(text)) {
      languages.push(lang);
    }
  }
  return languages.length > 0 ? languages : ['unknown'];
}

/**
 * Aggregate tags from multiple questions into exam-level tag cloud.
 *
 * @param {Array<TagSet>} questionTagSets
 * @returns {object} Aggregated tags with frequencies
 */
export function aggregateTags(questionTagSets) {
  const aggregation = {
    domainTags: {},
    conceptTags: {},
    materialTags: {},
    difficultyTags: {},
    typeTags: {},
  };

  for (const qTags of questionTagSets) {
    // Domain tags
    for (const dt of qTags.domainTags) {
      if (!aggregation.domainTags[dt.tag]) {
        aggregation.domainTags[dt.tag] = { count: 0, totalWeight: 0 };
      }
      aggregation.domainTags[dt.tag].count++;
      aggregation.domainTags[dt.tag].totalWeight += dt.weight;
    }

    // Concept tags
    for (const ct of qTags.conceptTags) {
      if (!aggregation.conceptTags[ct.tag]) {
        aggregation.conceptTags[ct.tag] = { count: 0, totalWeight: 0, totalConfidence: 0 };
      }
      aggregation.conceptTags[ct.tag].count++;
      aggregation.conceptTags[ct.tag].totalWeight += ct.weight || 0.5;
      aggregation.conceptTags[ct.tag].totalConfidence += ct.confidence || 0.5;
    }

    // Material tags
    for (const mt of qTags.materialTags) {
      if (!aggregation.materialTags[mt.tag]) {
        aggregation.materialTags[mt.tag] = { count: 0 };
      }
      aggregation.materialTags[mt.tag].count++;
    }

    // Difficulty
    for (const dt of qTags.difficultyTags) {
      if (!aggregation.difficultyTags[dt.tag]) {
        aggregation.difficultyTags[dt.tag] = { count: 0 };
      }
      aggregation.difficultyTags[dt.tag].count++;
    }

    // Type tags
    for (const tt of qTags.typeTags) {
      if (!aggregation.typeTags[tt.tag]) {
        aggregation.typeTags[tt.tag] = { count: 0 };
      }
      aggregation.typeTags[tt.tag].count++;
    }
  }

  // Compute averages
  for (const tags of Object.values(aggregation.conceptTags)) {
    if (tags.count > 0) {
      tags.avgWeight = parseFloat((tags.totalWeight / tags.count).toFixed(2));
      tags.avgConfidence = parseFloat((tags.totalConfidence / tags.count).toFixed(2));
    }
  }

  return aggregation;
}

export { CONCEPT_DICTIONARIES, KNOWN_CONCEPTS };

export default {
  extractTags,
  aggregateTags,
  KNOWN_CONCEPTS,
  CONCEPT_DICTIONARIES,
};
