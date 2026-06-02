// ═══════════════════════════════════════════════════════════════════
// Knowledge Extraction Engine — Automatic Question Classification
// Builds taxonomy automatically from OCR results.
// Classifies: subject → domain → topic → subtopic → difficulty
// ═══════════════════════════════════════════════════════════════════

import { classifySubject, scoreSubjects, getSubjectLabel } from '../utils/subjectClassifier';
import { matchQuestionToSyllabus, getSyllabusDatabase } from '../utils/syllabusMatcher';
import { QuestionSchema } from '../schemas/core';

/**
 * Extract full knowledge from a question object.
 * Returns enriched question with taxonomy and knowledge graph nodes.
 *
 * @param {object} question - QuestionObject
 * @returns {object} Enriched question with knowledge metadata
 */
export function extractQuestionKnowledge(question) {
  if (!question || !question.cleanedText) {
    return { question, knowledge: null, nodes: [] };
  }

  const text = question.cleanedText;
  const qNum = question.number;

  // 1. Subject & Domain classification
  const subjectScores = scoreSubjects(text, qNum);
  const domain = classifySubject(text, qNum);
  const subjectLabel = getSubjectLabel(domain);

  // 2. Syllabus matching
  const syllabusMatch = matchQuestionToSyllabus(text, qNum);

  // 3. Topic extraction
  const topics = extractTopics(text, domain, syllabusMatch);

  // 4. Concept extraction
  const concepts = extractConcepts(text, domain);

  // 5. Difficulty calibration
  const difficulty = calibrateDifficulty(question, subjectScores, syllabusMatch);

  // 6. Knowledge graph nodes for this question
  const nodes = buildKnowledgeNodes(question, domain, topics, concepts);

  // 7. Prerequisite identification
  const prerequisites = identifyPrerequisites(domain, topics);

  return {
    question: {
      ...question,
      domain,
      topic: topics[0] || '',
      subtopic: topics[1] || '',
      difficulty,
      metadata: {
        ...question.metadata,
        subjectLabel,
        subjectScores,
        syllabusMatch,
      },
    },
    knowledge: {
      domain,
      subjectLabel,
      topics,
      concepts,
      syllabusMatch,
      difficulty,
      prerequisites,
    },
    nodes,
  };
}

/**
 * Extract topics from question text based on domain-specific taxonomies.
 */
function extractTopics(text, domain, syllabusMatch) {
  const topics = [];

  // Use syllabus match if available
  if (syllabusMatch && syllabusMatch.keywordHits && syllabusMatch.keywordHits.length > 0) {
    topics.push(syllabusMatch.keywordHits[0]);
    if (syllabusMatch.keywordHits.length > 1) {
      topics.push(syllabusMatch.keywordHits[1]);
    }
    return topics;
  }

  if (domain === 'unknown' || !text) return topics;

  // Domain-specific topic extraction
  const topicPatterns = {
    economy: [
      { pattern: /需[給要]|供給|需要|市場|価格|均衡/gi, topic: '수요·공급과 시장균형' },
      { pattern: /GDP|GNP|国民所得|経済成長|景気/gi, topic: 'GDP·국민소득' },
      { pattern: /為替|円[高安]|外貨|ドル|ユーロ|国際収支/gi, topic: '환율·국제수지' },
      { pattern: /財政|税[金制]|国債|予算/gi, topic: '재정·조세정책' },
      { pattern: /金融|金利|日銀|物価|インフレ|デフレ/gi, topic: '금융·통화정책' },
      { pattern: /貿易|輸[出入]|関税|自由貿易|保護貿易/gi, topic: '국제무역' },
      { pattern: /雇用|失業|労働|賃金|最低/gi, topic: '고용·노동' },
    ],
    politics: [
      { pattern: /憲法|基本的人権|[平国]民主権/gi, topic: '헌법·기본권' },
      { pattern: /議会|国会|内閣|首相|立法|行政/gi, topic: '통치기구' },
      { pattern: /選挙|政党|比例|小選挙/gi, topic: '선거·정당' },
      { pattern: /国連|安保理|国際[機法裁]|PKO/gi, topic: '국제정치·국제기구' },
      { pattern: /地方自治|地方[分権]|住民/gi, topic: '지방자치' },
      { pattern: /司法|裁判|[違合]憲審査/gi, topic: '사법·재판' },
    ],
    history: [
      { pattern: /革命|市民|名誉|フランス/gi, topic: '시민혁명' },
      { pattern: /産業革命|資本主義|社会主義/gi, topic: '산업혁명·자본주의' },
      { pattern: /帝国主義|植民地|独立/gi, topic: '제국주의·식민지' },
      { pattern: /第一次大戦|第二次大戦|世界大戦/gi, topic: '세계대전' },
      { pattern: /冷戦|東西|NATO|デタント/gi, topic: '냉전' },
      { pattern: /明治維新|近代化|開国/gi, topic: '일본근대사' },
    ],
    geography: [
      { pattern: /気候|ケッペン|降水量|気温/gi, topic: '기후' },
      { pattern: /地形|プレート|山地|平原|川/gi, topic: '지형·판구조' },
      { pattern: /人口|都市|過[疎密]|ピラミッド/gi, topic: '인구·도시화' },
      { pattern: /資源|エネルギ[ー]|鉱産|農業/gi, topic: '자원·농업' },
      { pattern: /地図|GIS|投影|緯度|経度/gi, topic: '지도·GIS' },
    ],
    society: [
      { pattern: /環境|温暖化|CO2|排出|リサイクル/gi, topic: '환경문제' },
      { pattern: /福祉|年金|医療|介護|社会保障/gi, topic: '사회보장·복지' },
      { pattern: /少子|高齢|人口減少/gi, topic: '저출산·고령화' },
      { pattern: /情報化|IT|メディア/gi, topic: '정보화사회' },
      { pattern: /ジェンダ[ー]|男女|平等|差別/gi, topic: '젠더·평등' },
    ],
  };

  const patterns = topicPatterns[domain] || [];
  for (const { pattern, topic } of patterns) {
    if (pattern.test(text) && !topics.includes(topic)) {
      topics.push(topic);
    }
  }

  return topics.slice(0, 3);
}

/**
 * Extract specific concepts from question text.
 */
function extractConcepts(text, domain) {
  if (!text) return [];
  const concepts = [];

  // High-value EJU concepts to detect
  const conceptBank = {
    economy: [
      '수요곡선', '공급곡선', '균형가격', '소비자잉여', '생산자잉여',
      '명목GDP', '실질GDP', 'GDP디플레이터', '지니계수', '라퍼곡선',
      '비교우위', '절대우위', '환율변동', '엔고', '엔저', '금리',
      '양적완화', '재정정책', '통화정책', '무역수지', '경상수지',
      '아베노믹스', '잃어버린10년', '버블경제', '소비세',
    ],
    politics: [
      '삼권분립', '의원내각제', '대통령제', '국민주권', '기본권',
      '평화주의', '제9조', '안전보장이사회', '거부권', '비례대표',
      '소선거구', '지방분권', '위헌법률심판', '국제사법재판소',
      '사회계약', '자연법', '마그나카르타', '바이마르헌법',
    ],
    history: [
      '프랑스혁명', '미국독립혁명', '산업혁명', '제1차세계대전',
      '제2차세계대전', '러시아혁명', '냉전', '베르사유조약',
      '국제연맹', 'UN', '마셜플랜', '나치즘', '파시즘', '히틀러',
      '메이지유신', '제국헌법', '평화헌법', '탈냉전',
    ],
    geography: [
      '케펜기후구분', '판구조론', '인구피라미드', '도시화',
      '지도투영법', '메르카토르도법', '등고선', 'GIS',
      '열대기후', '온대기후', '냉대기후', '건조기후', '한대기후',
      '플랜테이션', '배타적경제수역',
    ],
    society: [
      '지구온난화', '교토의정서', '파리협약', 'SDGs', 'RE100',
      '초고령사회', '국민연금', '건강보험', '개호보험',
      '노동3권', '근로기준법', '지속가능발전', '탄소중립',
    ],
  };

  const domainConcepts = conceptBank[domain] || [];
  for (const concept of domainConcepts) {
    if (text.includes(concept) || text.includes(concept.toLowerCase())) {
      concepts.push(concept);
    }
  }

  return concepts;
}

/**
 * Calibrate difficulty using multiple signals.
 */
function calibrateDifficulty(question, subjectScores, syllabusMatch) {
  let difficulty = question.difficulty || 5;

  // Syllabus-based calibration
  if (syllabusMatch && syllabusMatch.confidence) {
    if (syllabusMatch.confidence < 0.3) difficulty += 1; // Hard to classify = harder
    if (syllabusMatch.confidence > 0.8) difficulty -= 0.5; // Clearly classified = easier
  }

  // Keyword intensity
  const totalScore = Object.values(subjectScores).reduce((a, b) => a + b, 0);
  if (totalScore > 20) difficulty += 0.5; // Dense with domain keywords
  if (totalScore < 3 && totalScore > 0) difficulty += 1; // Sparse keywords

  return Math.round(Math.max(1, Math.min(10, difficulty)));
}

/**
 * Build knowledge graph nodes from question analysis.
 */
function buildKnowledgeNodes(question, domain, topics, concepts) {
  const nodes = [];
  const baseId = question.id || 'unknown';

  // Domain node
  if (domain && domain !== 'unknown') {
    nodes.push({
      id: `domain_${domain}`,
      type: 'domain',
      label: getSubjectLabel(domain),
      description: `${getSubjectLabel(domain)} 영역`,
      source: 'ocr_extracted',
      domain,
      errorCount: question.isCorrect === false ? 1 : 0,
    });
  }

  // Topic nodes
  topics.forEach((topic, i) => {
    nodes.push({
      id: `${baseId}_topic_${i}`,
      type: 'topic',
      label: topic,
      description: topic,
      source: 'ocr_extracted',
      domain,
      errorCount: 0,
    });
  });

  // Concept nodes
  concepts.forEach((concept, i) => {
    nodes.push({
      id: `${baseId}_concept_${i}`,
      type: 'concept',
      label: concept,
      description: concept,
      source: 'ocr_extracted',
      domain,
      errorCount: question.isCorrect === false ? 1 : 0,
    });
  });

  return nodes;
}

/**
 * Identify prerequisite topics for a given domain/topic.
 * Used for the knowledge graph dependency analysis.
 */
function identifyPrerequisites(domain, topics) {
  const prerequisites = [];

  const prerequisiteMap = {
    economy: {
      '금융·통화정책': ['수요·공급과 시장균형', 'GDP·국민소득'],
      '환율·국제수지': ['GDP·국민소득', '국제무역'],
      '재정·조세정책': ['수요·공급과 시장균형'],
      '아베노믹스': ['금융·통화정책', '재정·조세정책', '일본경제사'],
    },
    politics: {
      '통치기구': ['헌법·기본권', '사회계약론'],
      '선거·정당': ['헌법·기본권', '통치기구'],
      '국제정치·국제기구': ['냉전', '세계대전'],
    },
    history: {
      '냉전': ['제2차세계대전', '제국주의·식민지'],
      '제2차세계대전': ['제1차세계대전', '제국주의·식민지'],
      '제국주의·식민지': ['산업혁명·자본주의'],
    },
  };

  const domainMap = prerequisiteMap[domain];
  if (domainMap) {
    for (const topic of topics) {
      const prereqs = domainMap[topic];
      if (prereqs) {
        prereqs.forEach(p => {
          if (!topics.includes(p)) {
            prerequisites.push(p);
          }
        });
      }
    }
  }

  return prerequisites;
}
