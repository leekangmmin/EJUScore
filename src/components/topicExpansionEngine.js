// ═══════════════════════════════════════════════════════════════════
// topicExpansionEngine — Knowledge Graph & Co-occurrence expansion
//
// Expands a given topic to related topics using:
//   1. knowledge_graph_v3.json (requires / contains edges)
//   2. weakness_connector.json (related_topics / prerequisite_concepts)
//   3. cooccurrence edges from insights_v2.json
//
// Pure functions — no React, no side effects.
// ═══════════════════════════════════════════════════════════════════

/**
 * Find related topics from a knowledge graph for a given topic.
 * Scans edges for matching source/target nodes.
 *
 * @param {string} topic - The topic to expand from
 * @param {object} knowledgeGraph - knowledge_graph_v3.json content
 * @param {number} maxResults - Max related topics to return
 * @returns {Array} [{ topic, relation, weight }, ...]
 */
export function findRelatedFromKnowledgeGraph(topic, knowledgeGraph = {}, maxResults = 5) {
  if (!knowledgeGraph?.edges?.length) return [];

  const edges = knowledgeGraph.edges;
  const results = [];

  // Try to match the topic node id
  const topicId = `topic_${topic}`;

  for (const edge of edges) {
    let relatedTopic = null;
    let relation = edge.type || 'related';
    let weight = edge.weight || 0;

    // Edge connects topic -> something
    if (edge.source === topicId && edge.target?.startsWith('topic_')) {
      relatedTopic = edge.target.replace('topic_', '');
    }
    // Edge connects something -> topic
    else if (edge.target === topicId && edge.source?.startsWith('topic_')) {
      relatedTopic = edge.source.replace('topic_', '');
    }
    // Edge connects two non-topic nodes? skip.

    if (relatedTopic && relatedTopic !== topic) {
      // Normalize: keep existing so first occurrence wins (higher weight)
      if (!results.find(r => r.topic === relatedTopic)) {
        results.push({
          topic: relatedTopic,
          relation,
          weight: weight / 50, // normalize weight to 0-1 range
          isKnowledgeGraph: true,
        });
      }
    }
  }

  // Sort by weight descending
  results.sort((a, b) => b.weight - a.weight);
  return results.slice(0, maxResults);
}

/**
 * Find related topics from weakness_connector.json
 *
 * @param {string} topic - The topic to expand from
 * @param {Array} weakTopics - Array from weakness_connector.json topics
 * @param {number} maxResults - Max related topics to return
 * @returns {Array} [{ topic, weight }, ...]
 */
export function findRelatedFromWeaknessConnector(topic, weakTopics = [], maxResults = 5) {
  const entry = weakTopics.find(w => w.topic === topic);
  if (!entry?.related_topics?.length) return [];

  const total = entry.related_topics.length;
  return entry.related_topics
    .slice(0, maxResults)
    .map((rel, i) => ({
      topic: rel,
      relation: 'related',
      weight: Math.round(((total - i) / total) * 100),
      isWeaknessConnector: true,
    }));
}

/**
 * Get co-occurring topics from insights_v2 cooccurrence.edges.
 *
 * @param {string} topic - Topic name
 * @param {Array} coocEdges - cooccurrence.edges from insights_v2.json
 * @param {number} maxResults - Max results to return
 * @returns {Array} [{ topic, value, co }, ...]
 */
export function findCooccurrenceTopics(topic, coocEdges = [], maxResults = 5) {
  const results = [];

  for (const edge of coocEdges) {
    if (edge.source === topic) {
      results.push({
        topic: edge.target,
        value: edge.value,
        co: edge.co,
        isCooccurrence: true,
      });
    } else if (edge.target === topic) {
      results.push({
        topic: edge.source,
        value: edge.value,
        co: edge.co,
        isCooccurrence: true,
      });
    }
  }

  results.sort((a, b) => b.value - a.value);
  return results.slice(0, maxResults);
}

/**
 * Get prerequisite concepts for a topic from weakness_connector.
 *
 * @param {string} topic - Topic name
 * @param {Array} weakTopics - weakness_connector.json topics
 * @returns {Array} Array of concept strings
 */
export function getPrerequisiteConcepts(topic, weakTopics = []) {
  const entry = weakTopics.find(w => w.topic === topic);
  return entry?.prerequisite_concepts || [];
}

/**
 * Combined expansion: merge results from all sources, deduplicate.
 *
 * @param {string} topic - Topic name
 * @param {object} knowledgeGraph - knowledge_graph_v3.json
 * @param {Array} weakTopics - weakness_connector.json topics
 * @param {Array} coocEdges - cooccurrence.edges from insights_v2.json
 * @param {number} maxResults - Max total results
 * @returns {Array} [{ topic, weight, sources }, ...]
 */
export function expandTopic(topic, knowledgeGraph = {}, weakTopics = [], coocEdges = [], maxResults = 8) {
  const seen = new Set();
  const results = [];

  // 1. Knowledge graph relations
  const kgRelations = findRelatedFromKnowledgeGraph(topic, knowledgeGraph, maxResults);
  for (const r of kgRelations) {
    if (!seen.has(r.topic)) {
      seen.add(r.topic);
      results.push({ ...r, sources: ['knowledgeGraph'] });
    }
  }

  // 2. Weakness connector related topics
  const wcRelations = findRelatedFromWeaknessConnector(topic, weakTopics, maxResults);
  for (const r of wcRelations) {
    if (!seen.has(r.topic)) {
      seen.add(r.topic);
      results.push({ ...r, sources: ['weaknessConnector'] });
    }
  }

  // 3. Co-occurrence topics
  const coocRelations = findCooccurrenceTopics(topic, coocEdges, maxResults);
  for (const r of coocRelations) {
    if (!seen.has(r.topic)) {
      seen.add(r.topic);
      results.push({
        topic: r.topic,
        relation: 'cooccurrence',
        weight: r.value,
        co: r.co,
        sources: ['cooccurrence'],
      });
    }
  }

  // Sort by weight descending
  results.sort((a, b) => b.weight - a.weight);
  return results.slice(0, maxResults);
}
