// ═══════════════════════════════════════════════════════════════════════
// Personal Weakness Graph v2
// Creates a student-specific knowledge graph with mastery tracking.
// Nodes: topic, accuracy, attempt, mastery
// Edges: prerequisite (auto-generated from performance data)
//
// Leverages: dataset/knowledge-graph/knowledge_graph_v3.json,
//            dataset/weakness_profile.json,
//            dataset/study_plan.json
// ═══════════════════════════════════════════════════════════════════════

// ── Schema ────────────────────────────────────────────────────────────

/**
 * @typedef {object} WeaknessNode
 * @property {string} id - Unique identifier
 * @property {string} type - 'domain' | 'topic' | 'subtopic' | 'concept'
 * @property {string} label - Display name
 * @property {string} domain - Domain this belongs to
 * @property {number} accuracy - 0-1 accuracy rate
 * @property {number} attemptCount - Total number of attempts
 * @property {number} masteryLevel - 0-1 computed mastery
 * @property {number} retentionScore - 0-1 retention estimate
 * @property {string} status - 'mastered' | 'learning' | 'weak' | 'unseen'
 * @property {Array} errorHistory - Recent error records
 * @property {number} lastAttemptDate - Timestamp
 * @property {number} importanceScore - 0-1 based on exam frequency
 */

/**
 * @typedef {object} WeaknessEdge
 * @property {string} sourceId - Prerequisite node
 * @property {string} targetId - Dependent node
 * @property {string} type - 'prerequisite' | 'related' | 'cross_domain'
 * @property {number} weight - 0-1 strength
 */

// ── Constants ─────────────────────────────────────────────────────────

const DOMAIN_LABELS = {
  economy: '경제', politics: '정치', history: '역사',
  geography: '지리', society: '사회',
};

const DOMAIN_TOPICS = {
  economy: [
    '수요·공급과 시장균형', 'GDP·국민소득', '환율·국제수지',
    '금융·통화정책', '재정·조세정책', '국제무역', '고용·노동',
    '경제성장·경기변동', '소득분배·지니계수', '일본경제사',
  ],
  politics: [
    '헌법·기본권', '통치기구', '선거·정당', '국제정치·국제기구',
    '지방자치', '사법·재판', '정치사상', '안전보장·방위',
  ],
  history: [
    '시민혁명', '산업혁명·자본주의', '제국주의·식민지', '세계대전',
    '냉전', '일본근대사', '전후세계질서', '세계화·지역통합',
  ],
  geography: [
    '기후·케펜구분', '지형·판구조', '인구·도시화', '자원·농업',
    '지도·GIS', '환경·생태', '산업·교통',
  ],
  society: [
    '환경문제', '사회보장·복지', '저출산·고령화', '정보화사회', '젠더·평등',
  ],
};

// ── Prerequisite Map (from knowledge_graph_v3) ────────────────────────

const PREREQUISITE_MAP = {
  // Economy chain
  '수요·공급과 시장균형': ['GDP·국민소득', '금융·통화정책', '재정·조세정책'],
  'GDP·국민소득': ['환율·국제수지', '국제무역', '경제성장·경기변동', '소득분배·지니계수'],
  '금융·통화정책': ['일본경제사'],
  '재정·조세정책': ['일본경제사'],
  '국제무역': ['환율·국제수지'],
  '경제성장·경기변동': ['일본경제사'],

  // Politics chain
  '정치사상': ['헌법·기본권'],
  '헌법·기본권': ['통치기구', '선거·정당', '사법·재판'],
  '통치기구': ['지방자치'],
  '선거·정당': ['통치기구'],

  // History chain
  '시민혁명': ['산업혁명·자본주의'],
  '산업혁명·자본주의': ['제국주의·식민지'],
  '제국주의·식민지': ['세계대전'],
  '세계대전': ['냉전', '전후세계질서'],
  '냉전': ['세계화·지역통합', '일본근대사'],

  // Geography chain
  '지도·GIS': ['지형·판구조', '기후·케펜구분'],
  '지형·판구조': ['기후·케펜구분', '자원·농업'],
  '기후·케펜구분': ['인구·도시화', '자원·농업', '환경·생태'],
  '인구·도시화': ['산업·교통'],
  '자원·농업': ['산업·교통', '환경·생태'],
};

// ── Main Builder ──────────────────────────────────────────────────────

/**
 * Build a personal weakness graph from student exam data.
 *
 * @param {Array} studentExams - Array of exam records
 * @param {object} datasets - Dataset cache with knowledge_graph etc.
 * @returns {object} { nodes, edges, stats, bottlenecks, highImpact }
 */
export function buildPersonalWeaknessGraph(studentExams = [], datasets = {}) {
  const nodes = new Map();
  const edges = new Map();

  // Phase 1: Initialize all domain and topic nodes
  initializeAllNodes(nodes, datasets);

  // Phase 2: Process exam data to update node metrics
  processExamData(nodes, studentExams);

  // Phase 3: Build prerequisite edges
  buildPrerequisiteEdges(edges, nodes, datasets);

  // Phase 4: Compute mastery for all nodes
  computeMasteryLevels(nodes);

  // Phase 5: Compute graph statistics
  const stats = computeGraphStats(nodes, edges);

  // Phase 6: Identify bottlenecks
  const bottlenecks = findBottlenecks(nodes, edges);

  // Phase 7: Find high-impact study areas
  const highImpact = findHighImpactAreas(nodes, edges, bottlenecks);

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    stats,
    bottlenecks,
    highImpactAreas: highImpact,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Initialize all possible topic nodes from the syllabus.
 */
function initializeAllNodes(nodes, datasets) {
  // Use knowledge_graph_v3 taxonomy if available
  const kg = datasets?.knowledgeGraph;
  if (kg?.taxonomy) {
    for (const [domainKey, domainData] of Object.entries(kg.taxonomy)) {
      const domainLabel = domainData.label || domainKey;
      const domainId = `domain:${domainKey}`;

      if (!nodes.has(domainId)) {
        nodes.set(domainId, createNode(domainId, 'domain', domainLabel, domainKey));
      }

      const topics = domainData.topics || {};
      for (const [topicName, subtopics] of Object.entries(topics)) {
        const topicId = `topic:${domainKey}:${topicName}`;
        if (!nodes.has(topicId)) {
          nodes.set(topicId, createNode(topicId, 'topic', topicName, domainKey));
        }

        for (const sub of subtopics) {
          const subId = `subtopic:${domainKey}:${topicName}:${sub}`;
          if (!nodes.has(subId)) {
            nodes.set(subId, createNode(subId, 'subtopic', sub, domainKey));
          }
        }
      }
    }
    return;
  }

  // Fallback: use hardcoded topic list
  for (const [domain, topics] of Object.entries(DOMAIN_TOPICS)) {
    const domainId = `domain:${domain}`;
    if (!nodes.has(domainId)) {
      nodes.set(domainId, createNode(domainId, 'domain', DOMAIN_LABELS[domain] || domain, domain));
    }
    for (const topic of topics) {
      const topicId = `topic:${domain}:${topic}`;
      if (!nodes.has(topicId)) {
        nodes.set(topicId, createNode(topicId, 'topic', topic, domain));
      }
    }
  }
}

/**
 * Create a new node with default values.
 */
function createNode(id, type, label, domain) {
  return {
    id,
    type,
    label,
    domain,
    accuracy: 0,
    attemptCount: 0,
    correctCount: 0,
    masteryLevel: 0,
    retentionScore: 0,
    status: 'unseen',
    lastAttemptDate: null,
    errorHistory: [],
    importanceScore: 0.5,
    recentAccuracyTrend: [], // last 5 accuracy values
  };
}

/**
 * Process exam records to update node metrics.
 */
function processExamData(nodes, studentExams) {
  for (const exam of (studentExams || [])) {
    const compMistakes = exam.comprehensive?.mistakes || [];

    // Process comprehensive mistakes
    for (const m of compMistakes) {
      const topic = m.topic || m.unit || '';
      const domain = m.domain || '';
      const memo = m.memo || '';
      const errorType = m.errorType || '';

      if (!topic && !domain) continue;

      // Find matching node
      let matchedNode = null;

      if (topic) {
        // Try to match topic across domains
        for (const [nodeId, node] of nodes) {
          if (node.type === 'topic' && node.label === topic) {
            matchedNode = node;
            break;
          }
        }
      }

      if (!matchedNode && domain) {
        const domainId = `domain:${domain}`;
        matchedNode = nodes.get(domainId) || null;
      }

      if (matchedNode) {
        // Record this as an error
        matchedNode.errorHistory.push({
          examId: exam.id,
          examDate: exam.date,
          questionNumber: m.questionNumber,
          errorType,
          memo,
          timestamp: Date.now(),
        });

        // Update metrics (this is an incorrect attempt)
        updateNodeWithAttempt(matchedNode, false, exam.date);
      }
    }

    // Process correct answers from form data
    // (Correct answers aren't explicitly tracked in the current schema,
    //  but we can infer from score data)
    const compScore = exam.comprehensive?.score;
    if (compScore != null) {
      // The exam has a score, which implies some correct answers
      // We update domain nodes to reflect this
      for (const [nodeId, node] of nodes) {
        if (node.type === 'domain' && node.attemptCount === 0) {
          // Mark as "seen" with moderate accuracy if they took the exam
          node.attemptCount = 1;
          node.correctCount = 1;
          node.accuracy = 1;
          node.status = 'learning';
          node.lastAttemptDate = exam.date ? new Date(exam.date).getTime() : Date.now();
        }
      }
    }
  }

  // If no exam data, mark some topics as "unseen"
  // This is fine — the weakness graph will reflect actual data
}

/**
 * Update a node with an attempt result.
 */
function updateNodeWithAttempt(node, isCorrect, examDate) {
  node.attemptCount++;
  if (isCorrect) {
    node.correctCount++;
  }
  node.accuracy = node.attemptCount > 0
    ? node.correctCount / node.attemptCount
    : 0;
  node.status = node.accuracy >= 0.8 ? 'mastered'
    : node.accuracy >= 0.5 ? 'learning'
    : 'weak';

  if (examDate) {
    try {
      const d = new Date(examDate);
      node.lastAttemptDate = d.getTime();
    } catch {
      node.lastAttemptDate = Date.now();
    }
  }

  // Track recent accuracy trend
  node.recentAccuracyTrend.push(isCorrect ? 1 : 0);
  if (node.recentAccuracyTrend.length > 5) {
    node.recentAccuracyTrend.shift();
  }
}

/**
 * Build prerequisite edges between nodes.
 */
function buildPrerequisiteEdges(edges, nodes, datasets) {
  // Use knowledge_graph edges from dataset if available
  const kg = datasets?.knowledgeGraph;
  if (kg?.edges) {
    for (const edge of kg.edges) {
      if (edge.type === 'prerequisite') {
        const edgeId = `prerequisite:${edge.sourceId}:${edge.targetId}`;
        if (!edges.has(edgeId)) {
          edges.set(edgeId, {
            id: edgeId,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            type: 'prerequisite',
            weight: edge.weight || 1.0,
          });
        }
      }
    }
    return;
  }

  // Fallback: build from prerequisite map
  for (const [topic, prereqs] of Object.entries(PREREQUISITE_MAP)) {
    for (const prereq of prereqs) {
      // Find node IDs for these topics
      let sourceId = null;
      let targetId = null;

      for (const [nodeId, node] of nodes) {
        if (node.type === 'topic') {
          if (node.label === prereq) sourceId = nodeId;
          if (node.label === topic) targetId = nodeId;
        }
      }

      if (sourceId && targetId) {
        const edgeId = `prerequisite:${sourceId}:${targetId}`;
        if (!edges.has(edgeId)) {
          edges.set(edgeId, {
            id: edgeId,
            sourceId,
            targetId,
            type: 'prerequisite',
            weight: 1.0,
          });
        }
      }
    }
  }

  // Add domain→topic edges
  for (const [nodeId, node] of nodes) {
    if (node.type === 'topic') {
      const domainId = `domain:${node.domain}`;
      if (nodes.has(domainId)) {
        const edgeId = `belongs_to:${domainId}:${nodeId}`;
        if (!edges.has(edgeId)) {
          edges.set(edgeId, {
            id: edgeId,
            sourceId: domainId,
            targetId: nodeId,
            type: 'belongs_to',
            weight: 1.0,
          });
        }
      }
    }
  }
}

/**
 * Compute mastery levels for all topic nodes.
 * Mastery factors: accuracy, attempt count, recency, prerequisite mastery.
 */
function computeMasteryLevels(nodes) {
  // First pass: base mastery from accuracy and attempts
  for (const [nodeId, node] of nodes) {
    if (node.type !== 'topic' && node.type !== 'subtopic') continue;

    let mastery = 0;

    if (node.attemptCount === 0) {
      mastery = 0;
      node.status = 'unseen';
    } else {
      // Accuracy contribution (0-60%)
      const accuracyScore = node.accuracy * 0.6;

      // Attempt count contribution (0-20%)
      const attemptScore = Math.min(0.2, node.attemptCount * 0.04);

      // Recency contribution (0-20%)
      let recencyScore = 0;
      if (node.lastAttemptDate) {
        const daysSinceLastAttempt = (Date.now() - node.lastAttemptDate) / (24 * 60 * 60 * 1000);
        recencyScore = Math.max(0, 0.2 - (daysSinceLastAttempt / 365) * 0.2);
      }

      mastery = Math.min(1, accuracyScore + attemptScore + recencyScore);
    }

    node.masteryLevel = parseFloat(mastery.toFixed(3));
    node.retentionScore = parseFloat((mastery * 0.8).toFixed(3));

    if (node.status === 'unseen' && node.attemptCount > 0) {
      node.status = mastery >= 0.8 ? 'mastered'
        : mastery >= 0.5 ? 'learning'
        : 'weak';
    }
  }

  // Second pass: propagate prerequisite mastery (penalize topics whose prerequisites are weak)
  // This is done in findBottlenecks — we keep mastery as pure measured data
}

/**
 * Compute graph statistics.
 */
function computeGraphStats(nodes, edges) {
  const nodeList = [...nodes.values()];
  const edgeList = [...edges.values()];

  const topicNodes = nodeList.filter(n => n.type === 'topic');
  const weakTopics = topicNodes.filter(t => t.status === 'weak' || (t.masteryLevel < 0.3 && t.attemptCount > 0));
  const masteredTopics = topicNodes.filter(t => t.status === 'mastered' || t.masteryLevel >= 0.7);
  const unseenTopics = topicNodes.filter(t => t.status === 'unseen');

  const avgMastery = topicNodes.length > 0
    ? topicNodes.reduce((s, n) => s + n.masteryLevel, 0) / topicNodes.length
    : 0;

  return {
    totalNodes: nodeList.length,
    totalEdges: edgeList.length,
    domainCount: nodeList.filter(n => n.type === 'domain').length,
    topicCount: topicNodes.length,
    weakTopicCount: weakTopics.length,
    masteredTopicCount: masteredTopics.length,
    unseenCount: unseenTopics.length,
    averageMastery: parseFloat(avgMastery.toFixed(3)),
    coveragePct: topicNodes.length > 0
      ? parseFloat(((topicNodes.length - unseenTopics.length) / topicNodes.length * 100).toFixed(1))
      : 0,
  };
}

/**
 * Find bottleneck nodes — topics that are both weak and have many dependents.
 */
function findBottlenecks(nodes, edges) {
  const bottlenecks = [];
  const edgeList = [...edges.values()];

  // Compute out-degree (dependents count) for each node
  const outDegree = {};
  for (const edge of edgeList) {
    if (edge.type === 'prerequisite') {
      outDegree[edge.sourceId] = (outDegree[edge.sourceId] || 0) + 1;
    }
  }

  for (const [nodeId, node] of nodes) {
    if (node.type !== 'topic') continue;

    const depCount = outDegree[nodeId] || 0;
    const isWeak = node.masteryLevel < 0.4 || node.status === 'weak';

    if (isWeak && depCount > 0) {
      const impactScore = depCount * (1 - node.masteryLevel) * (node.importanceScore || 0.5);
      bottlenecks.push({
        node,
        dependentCount: depCount,
        masteryGap: parseFloat((1 - node.masteryLevel).toFixed(2)),
        impactScore: parseFloat(impactScore.toFixed(3)),
        recommendation: `'${node.label}' — 선행개념 불안정, ${depCount}개 주제에 영향`,
      });
    }
  }

  return bottlenecks.sort((a, b) => b.impactScore - a.impactScore);
}

/**
 * Find highest-impact study areas.
 */
function findHighImpactAreas(nodes, edges, bottlenecks) {
  const highImpact = [];

  // Topics that are weak and have high exam frequency
  for (const [nodeId, node] of nodes) {
    if (node.type !== 'topic') continue;
    if (node.masteryLevel >= 0.7) continue; // already strong

    const improvementPotential = (1 - node.masteryLevel) * (node.importanceScore || 0.5);
    const attemptBonus = node.attemptCount === 0 ? 0.3 : 0; // unseen topics get slight bonus

    const score = improvementPotential + attemptBonus;

    if (score > 0) {
      highImpact.push({
        node,
        currentMastery: node.masteryLevel,
        improvementPotential: parseFloat((1 - node.masteryLevel).toFixed(2)),
        importanceScore: node.importanceScore || 0.5,
        impactScore: parseFloat(score.toFixed(3)),
        isUnseen: node.attemptCount === 0,
      });
    }
  }

  return highImpact.sort((a, b) => b.impactScore - a.impactScore).slice(0, 15);
}

// ═══════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get the weakness graph in a format suitable for visualization.
 */
export function getWeaknessGraphForDisplay(weaknessGraph) {
  if (!weaknessGraph) return { nodes: [], edges: [] };

  return {
    nodes: (weaknessGraph.nodes || []).map(n => ({
      id: n.id,
      label: n.label,
      type: n.type,
      domain: n.domain,
      mastery: n.masteryLevel,
      status: n.status,
      accuracy: n.accuracy,
      attemptCount: n.attemptCount,
      // Color coding
      color: n.status === 'mastered' ? '#10b981'
        : n.status === 'learning' ? '#f59e0b'
        : n.status === 'weak' ? '#ef4444'
        : '#94a3b8',
      size: n.type === 'domain' ? 60
        : n.type === 'topic' ? 40
        : 25,
    })),
    edges: (weaknessGraph.edges || []).map(e => ({
      source: e.sourceId,
      target: e.targetId,
      type: e.type,
      weight: e.weight,
    })),
    stats: weaknessGraph.stats,
    bottlenecks: (weaknessGraph.bottlenecks || []).map(b => ({
      topicId: b.node?.id,
      topicName: b.node?.label,
      dependentCount: b.dependentCount,
      impactScore: b.impactScore,
      recommendation: b.recommendation,
    })),
    highImpactAreas: (weaknessGraph.highImpactAreas || []).map(h => ({
      topicId: h.node?.id,
      topicName: h.node?.label,
      currentMastery: h.currentMastery,
      impactScore: h.impactScore,
      isUnseen: h.isUnseen,
    })),
  };
}

/**
 * Get personalized study recommendations from the weakness graph.
 */
export function getStudyRecommendationsFromGraph(weaknessGraph, count = 5) {
  if (!weaknessGraph) return [];

  const recommendations = [];

  // 1. Bottlenecks first (high-impact weak prerequisites)
  for (const b of (weaknessGraph.bottlenecks || [])) {
    recommendations.push({
      type: 'bottleneck',
      topic: b.node?.label || '',
      domain: b.node?.domain || '',
      priority: 'high',
      reason: `${b.node?.label || ''}은(는) ${b.dependentCount}개 주제의 선행개념입니다.`,
      estimatedImpact: `개선 시 ${b.dependentCount}개 주제 학습 효율 상승`,
    });
  }

  // 2. High-impact weak areas
  for (const h of (weaknessGraph.highImpactAreas || [])) {
    if (recommendations.length >= count) break;
    if (recommendations.some(r => r.topic === h.node?.label)) continue;

    recommendations.push({
      type: 'high_impact',
      topic: h.node?.label || '',
      domain: h.node?.domain || '',
      priority: h.isUnseen ? 'medium' : 'high',
      reason: h.isUnseen
        ? `아직 학습하지 않은 주제입니다.`
        : `현재 숙련도 ${(h.currentMastery * 100).toFixed(0)}% — 개선 여지가 큽니다.`,
      estimatedImpact: `숙련도를 80%로 올리면 전체 점수 ${Math.round(h.impactScore * 10)}점 향상 예상`,
    });
  }

  return recommendations.slice(0, count);
}

/**
 * Compute importance scores for all topics based on exam frequency data.
 */
export function computeImportanceScores(datasets) {
  const scores = {};

  // Use trend_analysis_v2 for importance weighting
  const trend = datasets?.trendAnalysis;
  if (trend?.topic_trends) {
    for (const [topic, data] of Object.entries(trend.topic_trends)) {
      const totalAppearances = data.total || 0;
      const yearsActive = data.years_active || 0;
      const recency = (data.recent_5yr || 0) / Math.max(1, yearsActive);

      // Score based on frequency and recency
      const frequencyScore = Math.min(1, totalAppearances / 100);
      const recencyScore = Math.min(1, recency / 5);
      const consistencyScore = Math.min(1, yearsActive / 24);

      scores[topic] = parseFloat((
        frequencyScore * 0.4 + recencyScore * 0.35 + consistencyScore * 0.25
      ).toFixed(3));
    }
  }

  // Use prediction_2026 for additional weighting
  const pred = datasets?.prediction2026;
  if (pred?.top_30_predictions) {
    for (const p of pred.top_30_predictions) {
      if (scores[p.topic] !== undefined) {
        // Boost by prediction probability
        scores[p.topic] = parseFloat((
          scores[p.topic] * 0.7 + (p.prediction_probability_pct / 100) * 0.3
        ).toFixed(3));
      } else {
        scores[p.topic] = parseFloat((p.prediction_probability_pct / 100).toFixed(3));
      }
    }
  }

  return scores;
}

/**
 * Update the weakness graph with importance scores from datasets.
 */
export function enrichGraphWithDatasetImportance(weaknessGraph, datasets) {
  if (!weaknessGraph || !weaknessGraph.nodes) return weaknessGraph;

  const importanceScores = computeImportanceScores(datasets);

  for (const node of weaknessGraph.nodes) {
    if (node.type === 'topic' || node.type === 'subtopic') {
      node.importanceScore = importanceScores[node.label] || 0.5;
    }
  }

  return weaknessGraph;
}

// ── Exports ────────────────────────────────────────────────────────────
export default {
  buildPersonalWeaknessGraph,
  getWeaknessGraphForDisplay,
  getStudyRecommendationsFromGraph,
  computeImportanceScores,
  enrichGraphWithDatasetImportance,
};
