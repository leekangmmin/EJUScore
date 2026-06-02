// ═══════════════════════════════════════════════════════════════════
// EJU Knowledge Graph — Personal Knowledge Representation
// Builds and analyzes a directed graph of student knowledge.
// Finds bottlenecks, gaps, and highest-impact study areas.
// ═══════════════════════════════════════════════════════════════════

import db, { STORES } from '../db/database';

/**
 * Build or update the student's knowledge graph from exam history.
 * @param {Array} exams - Array of exam records
 * @param {Array} questions - Array of QuestionObjects
 * @returns {Promise<object>} { nodes, edges, stats }
 */
export async function buildKnowledgeGraph(exams, questions) {
  const nodes = new Map();   // id → KnowledgeNode
  const edges = new Map();   // key → KnowledgeEdge

  // 1. Process all questions to extract topics and concepts
  for (const question of questions || []) {
    if (!question || !question.domain) continue;

    const domain = question.domain;
    const topic = question.topic || '';
    const subtopic = question.subtopic || '';

    // Create/update domain node
    const domainId = `domain:${domain}`;
    if (!nodes.has(domainId)) {
      nodes.set(domainId, createNode(domainId, 'domain', getDomainLabel(domain), domain));
    }

    // Create/update topic node
    if (topic) {
      const topicId = `topic:${domain}:${topic}`;
      if (!nodes.has(topicId)) {
        nodes.set(topicId, createNode(topicId, 'topic', topic, domain));
      }

      // Add edge: domain → topic
      addEdge(edges, domainId, topicId, 'has_topic');

      // Update mastery based on correct/incorrect
      const node = nodes.get(topicId);
      if (question.isCorrect === true) {
        node.masteryLevel = Math.min(1, node.masteryLevel + 0.1);
        node.reviewCount++;
      } else if (question.isCorrect === false) {
        node.masteryLevel = Math.max(0, node.masteryLevel - 0.15);
        node.errorCount++;
        node.errorHistory.push({
          questionId: question.id,
          date: question.metadata?.year ? String(question.metadata.year) : '',
          errorType: question.errorAnalysis?.primaryCause || 'unknown',
        });
        node.lastReviewed = Date.now();
      }

      // Add edge: topic → subtopic (if exists)
      if (subtopic) {
        const subId = `subtopic:${domain}:${topic}:${subtopic}`;
        if (!nodes.has(subId)) {
          nodes.set(subId, createNode(subId, 'subtopic', subtopic, domain));
        }
        addEdge(edges, topicId, subId, 'has_subtopic');
      }
    }
  }

  // 2. Add prerequisite edges from syllabus data
  const prerequisites = getPrerequisiteEdges();
  for (const { source, target } of prerequisites) {
    addEdge(edges, source, target, 'prerequisite');
  }

  // 3. Compute graph statistics
  const stats = computeGraphStats(nodes, edges);

  // 4. Identify bottlenecks
  const bottlenecks = findBottlenecks(nodes, edges);

  // 5. Identify highest-impact study areas
  const highImpact = findHighImpactAreas(nodes, edges, bottlenecks);

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    stats,
    bottlenecks,
    highImpactAreas: highImpact,
  };
}

/**
 * Create a knowledge graph node.
 */
function createNode(id, type, label, domain) {
  return {
    id,
    type,
    label,
    description: label,
    domain,
    masteryLevel: 0,
    retentionScore: 0,
    lastReviewed: null,
    reviewCount: 0,
    errorCount: 0,
    dominantErrorType: '',
    errorHistory: [],
    source: 'syllabus',
  };
}

/**
 * Add a directed edge between two nodes.
 */
function addEdge(edges, sourceId, targetId, type) {
  const key = `${sourceId}:${type}:${targetId}`;
  if (!edges.has(key)) {
    edges.set(key, {
      id: key,
      sourceId,
      targetId,
      type,
      weight: 1.0,
    });
  } else {
    edges.get(key).weight += 0.5;
  }
}

/**
 * Get prerequisite relationships from the EJU syllabus.
 */
function getPrerequisiteEdges() {
  return [
    // Economy prerequisites
    { source: 'topic:economy:수요·공급과 시장균형', target: 'topic:economy:GDP·국민소득' },
    { source: 'topic:economy:GDP·국민소득', target: 'topic:economy:환율·국제수지' },
    { source: 'topic:economy:수요·공급과 시장균형', target: 'topic:economy:재정·조세정책' },
    { source: 'topic:economy:GDP·국민소득', target: 'topic:economy:국제무역' },
    { source: 'topic:economy:금융·통화정책', target: 'topic:economy:아베노믹스' },
    { source: 'topic:economy:재정·조세정책', target: 'topic:economy:아베노믹스' },
    { source: 'domain:economy', target: 'topic:economy:수요·공급과 시장균형' },
    { source: 'domain:economy', target: 'topic:economy:GDP·국민소득' },
    { source: 'domain:economy', target: 'topic:economy:환율·국제수지' },
    { source: 'domain:economy', target: 'topic:economy:재정·조세정책' },
    { source: 'domain:economy', target: 'topic:economy:금융·통화정책' },
    { source: 'domain:economy', target: 'topic:economy:국제무역' },
    { source: 'domain:economy', target: 'topic:economy:아베노믹스' },

    // Politics prerequisites
    { source: 'topic:politics:헌법·기본권', target: 'topic:politics:통치기구' },
    { source: 'topic:politics:헌법·기본권', target: 'topic:politics:선거·정당' },
    { source: 'topic:politics:통치기구', target: 'topic:politics:지방자치' },
    { source: 'topic:politics:헌법·기본권', target: 'topic:politics:사법·재판' },
    { source: 'domain:politics', target: 'topic:politics:헌법·기본권' },
    { source: 'domain:politics', target: 'topic:politics:통치기구' },
    { source: 'domain:politics', target: 'topic:politics:선거·정당' },
    { source: 'domain:politics', target: 'topic:politics:국제정치·국제기구' },

    // History prerequisites
    { source: 'topic:history:시민혁명', target: 'topic:history:산업혁명·자본주의' },
    { source: 'topic:history:산업혁명·자본주의', target: 'topic:history:제국주의·식민지' },
    { source: 'topic:history:제국주의·식민지', target: 'topic:history:세계대전' },
    { source: 'topic:history:세계대전', target: 'topic:history:냉전' },
    { source: 'domain:history', target: 'topic:history:시민혁명' },
    { source: 'domain:history', target: 'topic:history:산업혁명·자본주의' },
    { source: 'domain:history', target: 'topic:history:제국주의·식민지' },
    { source: 'domain:history', target: 'topic:history:세계대전' },
    { source: 'domain:history', target: 'topic:history:냉전' },
    { source: 'domain:history', target: 'topic:history:일본근대사' },

    // Geography prerequisites
    { source: 'domain:geography', target: 'topic:geography:기후' },
    { source: 'domain:geography', target: 'topic:geography:지형·판구조' },
    { source: 'domain:geography', target: 'topic:geography:인구·도시화' },
    { source: 'domain:geography', target: 'topic:geography:자원·농업' },
    { source: 'domain:geography', target: 'topic:geography:지도·GIS' },

    // Society prerequisites
    { source: 'domain:society', target: 'topic:society:환경문제' },
    { source: 'domain:society', target: 'topic:society:사회보장·복지' },
    { source: 'domain:society', target: 'topic:society:저출산·고령화' },
    { source: 'domain:society', target: 'topic:society:정보화사회' },
    { source: 'domain:society', target: 'topic:society:젠더·평등' },
  ];
}

/**
 * Compute graph statistics.
 */
function computeGraphStats(nodes, edges) {
  const nodeList = [...nodes.values()];
  const edgeList = [...edges.values()];

  const domainNodes = nodeList.filter(n => n.type === 'domain');
  const topicNodes = nodeList.filter(n => n.type === 'topic');

  const weakTopics = topicNodes.filter(t => t.masteryLevel < 0.3);
  const strongTopics = topicNodes.filter(t => t.masteryLevel >= 0.7);
  const unreviewedTopics = topicNodes.filter(t => t.reviewCount === 0);

  return {
    totalNodes: nodeList.length,
    totalEdges: edgeList.length,
    domainCount: domainNodes.length,
    topicCount: topicNodes.length,
    weakTopicCount: weakTopics.length,
    strongTopicCount: strongTopics.length,
    unreviewedCount: unreviewedTopics.length,
    averageMastery: topicNodes.length > 0
      ? topicNodes.reduce((s, n) => s + n.masteryLevel, 0) / topicNodes.length
      : 0,
    density: nodeList.length > 1
      ? (2 * edgeList.length) / (nodeList.length * (nodeList.length - 1))
      : 0,
  };
}

/**
 * Find bottleneck nodes — topics with many prerequisites that are weak.
 * These are high-impact because strengthening them unlocks many downstream topics.
 */
function findBottlenecks(nodes, edges) {
  const bottlenecks = [];
  const edgeList = [...edges.values()];

  // Compute in-degree and out-degree for each node
  const inDegree = {};
  const outDegree = {};
  for (const edge of edgeList) {
    outDegree[edge.sourceId] = (outDegree[edge.sourceId] || 0) + 1;
    inDegree[edge.targetId] = (inDegree[edge.targetId] || 0) + 1;
  }

  for (const [id, node] of nodes) {
    if (node.type !== 'topic') continue;

    const outD = outDegree[id] || 0;
    const inD = inDegree[id] || 0;

    // Bottleneck: high out-degree (many dependents) + low mastery
    if (outD >= 2 && node.masteryLevel < 0.5) {
      bottlenecks.push({
        node,
        dependentCount: outD,
        prerequisiteCount: inD,
        impactScore: outD * (1 - node.masteryLevel),
        recommendation: getBottleneckRecommendation(node),
      });
    }
  }

  return bottlenecks.sort((a, b) => b.impactScore - a.impactScore);
}

/**
 * Find highest-impact study areas.
 * These are nodes that, if improved, would unlock the most downstream nodes.
 */
function findHighImpactAreas(nodes, edges, bottlenecks) {
  const highImpact = [];
  const edgeList = [...edges.values()];

  // Build adjacency list
  const downstream = {};
  for (const edge of edgeList) {
    if (!downstream[edge.sourceId]) downstream[edge.sourceId] = [];
    downstream[edge.sourceId].push(edge.targetId);
  }

  // BFS to count all downstream nodes
  function countAllDownstream(nodeId, visited = new Set()) {
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);
    let count = 0;
    for (const next of (downstream[nodeId] || [])) {
      count += 1 + countAllDownstream(next, visited);
    }
    return count;
  }

  for (const [id, node] of nodes) {
    if (node.type !== 'topic') continue;
    const downstreamCount = countAllDownstream(id, new Set([id]));
    const improvementPotential = (1 - node.masteryLevel) * downstreamCount;

    if (improvementPotential > 0) {
      highImpact.push({
        node,
        downstreamCount,
        masteryGap: 1 - node.masteryLevel,
        impactScore: improvementPotential,
      });
    }
  }

  return highImpact.sort((a, b) => b.impactScore - a.impactScore).slice(0, 10);
}

/**
 * Generate recommendation for bottleneck topics.
 */
function getBottleneckRecommendation(node) {
  if (node.errorCount > 3) {
    return `${node.label} — 반복 오답 발생(${node.errorCount}회). 기초 개념 재학습 필요.`;
  }
  return `${node.label} — 낮은 숙련도(평균 ${(node.masteryLevel * 100).toFixed(0)}%). 집중 학습 권장.`;
}

/**
 * Get domain label in Korean.
 */
function getDomainLabel(domain) {
  const labels = { economy: '경제', politics: '정치', history: '역사', geography: '지리', society: '사회' };
  return labels[domain] || domain;
}

/**
 * Find related topics (co-occurring in same questions).
 */
export function findRelatedTopics(questions, topic) {
  const cooccurrence = {};

  for (const q of questions) {
    if (!q || !q.topic) continue;
    if (q.topic !== topic) continue;

    // Find other questions in same exam that have different topics
    // In production, use actual exam grouping
    const otherTopics = questions
      .filter(other => other.examId === q.examId && other.id !== q.id && other.topic && other.topic !== topic);

    for (const other of otherTopics) {
      cooccurrence[other.topic] = (cooccurrence[other.topic] || 0) + 1;
    }
  }

  return Object.entries(cooccurrence)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, cooccurrence: count }));
}

export default { buildKnowledgeGraph, findRelatedTopics };
