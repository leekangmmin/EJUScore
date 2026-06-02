"""
Knowledge Graph Analyzer v3
============================
Upgrades the knowledge graph with:

Dynamic Edge Properties:
  - edge_weight (combination of prerequisite strength + frequency co-occurrence)
  - influence_score (how much upstream nodes affect downstream)
  - dependency_strength (direct prerequisite weight 0-1)
  - topic_similarity (semantic similarity between topic pairs)

Graph Analytics:
  - PageRank centrality
  - Betweenness centrality
  - Eigenvector centrality (approximated)
  - Community detection (Louvain-like)

Graph Propagation:
  - Prerequisite propagation: when topic probability rises, propagate forward
  - Decay-weighted propagation through edges
  - Multi-hop with configurable decay

Leverages: dataset/knowledge-graph/knowledge_graph_v3.json
"""

import json
import math
from collections import defaultdict, deque, Counter
from typing import Dict, List, Tuple, Set, Optional

from .predictor import get_all_topics, load_knowledge_graph, DOMAIN_TOPICS
from .weakness_engine import PREREQUISITE_MAP, CONCEPT_PREREQUISITE_MAP


# ═══════════════════════════════════════════════════════════════════════
# TOPIC SIMILARITY (for edge topic_similarity)
# ═══════════════════════════════════════════════════════════════════════

# Domain overlap similarity (same domain = more similar)
DOMAIN_SIMILARITY = {
    'economy': {'economy': 1.0, 'politics': 0.4, 'history': 0.5, 'geography': 0.2, 'society': 0.5},
    'politics': {'economy': 0.4, 'politics': 1.0, 'history': 0.6, 'geography': 0.1, 'society': 0.5},
    'history': {'economy': 0.5, 'politics': 0.6, 'history': 1.0, 'geography': 0.3, 'society': 0.4},
    'geography': {'economy': 0.2, 'politics': 0.1, 'history': 0.3, 'geography': 1.0, 'society': 0.3},
    'society': {'economy': 0.5, 'politics': 0.5, 'history': 0.4, 'geography': 0.3, 'society': 1.0},
}

# Keyword-based topic similarity (shared keywords score)
TOPIC_KEYWORD_SETS = {
    '수요·공급과 시장균형': {'수요', '공급', '시장', '균형', '가격'},
    'GDP·국민소득': {'GDP', '국민소득', '경제성장', '국내총생산', '1인당소득'},
    '환율·국제수지': {'환율', '국제수지', '경상수지', '변동환율', '고정환율'},
    '금융·통화정책': {'금융', '통화', '금리', '중앙은행', '통화량', '인플레이션'},
    '재정·조세정책': {'재정', '조세', '국채', '예산', '소득세'},
    '국제무역': {'무역', '수출', '수입', '관세', '자유무역'},
    '고용·노동': {'고용', '노동', '실업', '임금', '고용률'},
    '경제성장·경기변동': {'경제성장', '경기변동', 'GDP', '불황', '호황'},
    '소득분배·지니계수': {'소득분배', '지니계수', '소득격차', '빈곤율'},
    '일본경제사': {'일본', '경제', '전후', '고도성장', '버블'},
    '헌법·기본권': {'헌법', '기본권', '인권', '국민주권', '평등권'},
    '통치기구': {'통치', '내각', '의회', '행정', '입법'},
    '선거·정당': {'선거', '정당', '비례대표', '소선거구', '투표'},
    '국제정치·국제기구': {'국제정치', '국제기구', '유엔', 'NATO', '안보리'},
    '지방자치': {'지방자치', '지방분권', '지방의회', '지방행정'},
    '사법·재판': {'사법', '재판', '법원', '위헌심사', '재판소'},
    '정치사상': {'정치사상', '민주주의', '사회계약', '자연권', '자유'},
    '안전보장·방위': {'안전보장', '방위', '자위대', '안보', '국방'},
    '시민혁명': {'시민혁명', '혁명', '프랑스혁명', '명예혁명', '시민'},
    '산업혁명·자본주의': {'산업혁명', '자본주의', '공업화', '사회주의'},
    '제국주의·식민지': {'제국주의', '식민지', '제국', '식민통치'},
    '세계대전': {'세계대전', '제1차', '제2차', '전쟁', '대전'},
    '냉전': {'냉전', '동서', '데탕트', '핵', '군비'},
    '일본근대사': {'일본', '근대', '메이지', '개국', '유신'},
    '전후세계질서': {'전후', '세계질서', '복구', '국제질서'},
    '세계화·지역통합': {'세계화', '지역통합', 'EU', '글로벌', 'WTO'},
    '러시아혁명·소련': {'러시아', '혁명', '소련', '공산주의', '레닌'},
    '대공황': {'대공황', '공황', '불황', '경제위기', '뉴딜'},
    '기후·케펜구분': {'기후', '케펜', '기온', '강수', '기후대'},
    '지형·판구조': {'지형', '판구조', '산맥', '단층', '화산'},
    '인구·도시화': {'인구', '도시화', '인구밀도', '도시', '과밀'},
    '자원·농업': {'자원', '농업', '광물', '에너지', '식량'},
    '지도·GIS': {'지도', 'GIS', '투영', '위도', '경도'},
    '환경·생태': {'환경', '생태', '생물', '기후변화', '생태계'},
    '산업·교통': {'산업', '교통', '공업', '물류', '교통망'},
    '환경문제': {'환경문제', '오염', '온난화', '탄소', '재활용'},
    '사회보장·복지': {'사회보장', '복지', '연금', '의료', '사회복지'},
    '저출산·고령화': {'저출산', '고령화', '출산율', '노인', '인구감소'},
    '정보화사회': {'정보화', 'IT', '인터넷', '디지털', '정보'},
    '젠더·평등': {'젠더', '평등', '양성', '차별', '남녀'},
    '다문화사회': {'다문화', '이민', '난민', '다양성', '공존'},
}

# Topic-to-domain mapping
TOPIC_DOMAIN_MAP = {}
for domain, topics in DOMAIN_TOPICS.items():
    for t in topics:
        TOPIC_DOMAIN_MAP[t] = domain


def compute_topic_similarity(topic_a: str, topic_b: str) -> float:
    """
    Compute semantic similarity between two topics.
    Uses Jaccard similarity on keyword sets and domain overlap.
    """
    if topic_a == topic_b:
        return 1.0

    # Keyword Jaccard similarity
    keywords_a = TOPIC_KEYWORD_SETS.get(topic_a, set())
    keywords_b = TOPIC_KEYWORD_SETS.get(topic_b, set())

    if not keywords_a or not keywords_b:
        keyword_sim = 0.0
    else:
        intersection = keywords_a & keywords_b
        union = keywords_a | keywords_b
        keyword_sim = len(intersection) / max(1, len(union))

    # Domain overlap
    domain_a = TOPIC_DOMAIN_MAP.get(topic_a, '')
    domain_b = TOPIC_DOMAIN_MAP.get(topic_b, '')
    domain_sim = DOMAIN_SIMILARITY.get(domain_a, {}).get(domain_b, 0.1)

    # Combined: keyword similarity weighted more heavily
    return 0.6 * keyword_sim + 0.4 * domain_sim


# ═══════════════════════════════════════════════════════════════════════
# TOPIC ID HELPERS
# ═══════════════════════════════════════════════════════════════════════

def topic_to_node_id(topic: str) -> str:
    return f"topic_{topic}"


def node_id_to_topic(node_id: str) -> str:
    return node_id.replace("topic_", "", 1) if node_id.startswith("topic_") else node_id


# ═══════════════════════════════════════════════════════════════════════
# GRAPH ANALYTICS
# ═══════════════════════════════════════════════════════════════════════

class DynamicKnowledgeGraph:
    """
    Dynamic knowledge graph with per-edge properties and full graph analytics.
    """

    def __init__(self):
        self.nodes: Dict[str, dict] = {}
        self.edges: List[dict] = []
        self.adjacency: Dict[str, List[str]] = defaultdict(list)
        self.reverse_adjacency: Dict[str, List[str]] = defaultdict(list)
        self.edge_weights: Dict[Tuple[str, str], float] = {}
        self.topic_to_domain: Dict[str, str] = {}

        for t, d in get_all_topics():
            self.topic_to_domain[t] = d

    def load_from_data(self, questions: List[dict] = None):
        """Build graph from gold standard data and prerequisite maps."""
        topic_ids = {}
        for topic, _ in get_all_topics():
            node_id = topic_to_node_id(topic)
            topic_ids[topic] = node_id
            if node_id not in self.nodes:
                self.nodes[node_id] = {
                    'id': node_id,
                    'label': topic,
                    'type': 'topic',
                    'domain': self.topic_to_domain.get(topic, ''),
                }

        # Build frequency co-occurrence from data
        topic_cooccurrence = defaultdict(lambda: defaultdict(int))
        topic_year_freq = defaultdict(lambda: defaultdict(int))

        if questions:
            for q in questions:
                topic = q.get('topic', '').strip()
                year = q.get('year')
                if topic and year:
                    topic_year_freq[topic][int(year)] += 1

            # Co-occurrence: topics appearing in same year
            topic_year_set = defaultdict(set)
            for topic, yearly in topic_year_freq.items():
                for year in yearly:
                    topic_year_set[year].add(topic)

            for year, topics_set in topic_year_set.items():
                topic_list = list(topics_set)
                for i in range(len(topic_list)):
                    for j in range(i + 1, len(topic_list)):
                        topic_cooccurrence[topic_list[i]][topic_list[j]] += 1
                        topic_cooccurrence[topic_list[j]][topic_list[i]] += 1

        # Add prerequisite edges with dynamic properties
        self._add_prerequisite_edges(topic_ids, topic_cooccurrence, topic_year_freq)

        # Add co-occurrence-based similarity edges (for topics not connected by prerequisites)
        self._add_similarity_edges(topic_ids, topic_cooccurrence, topic_year_freq)

    def _add_prerequisite_edges(self, topic_ids, topic_cooccurrence, topic_year_freq):
        """Add prerequisite edges with computed dynamic properties."""
        for topic, prereqs in PREREQUISITE_MAP.items():
            target_id = topic_ids.get(topic)
            if not target_id:
                continue

            for prereq in prereqs:
                source_id = topic_ids.get(prereq)
                if not source_id:
                    continue

                # Core: dependency_strength (based on prerequisite map directness)
                direct_prereqs = PREREQUISITE_MAP.get(topic, [])
                if prereq in direct_prereqs:
                    dependency_strength = 0.9
                else:
                    dependency_strength = 0.5

                # topic_similarity (semantic)
                topic_sim = compute_topic_similarity(prereq, topic)

                # edge_weight = combination of dependency + similarity + co-occurrence
                cooccur = topic_cooccurrence.get(prereq, {}).get(topic, 0)
                cooccur_norm = min(1.0, cooccur / 5.0)  # normalize
                edge_weight = 0.5 * dependency_strength + 0.3 * topic_sim + 0.2 * cooccur_norm

                # influence_score = dependency * (1 + co-occurrence bonus)
                influence = dependency_strength * (1.0 + 0.2 * cooccur_norm)

                self._add_edge(
                    source_id, target_id,
                    weight=round(edge_weight, 4),
                    edge_type='requires',
                    metadata={
                        'dependency_strength': round(dependency_strength, 4),
                        'topic_similarity': round(topic_sim, 4),
                        'influence_score': round(influence, 4),
                        'cooccurrence_count': cooccur,
                        'prerequisite_type': 'direct' if dependency_strength >= 0.9 else 'indirect',
                    }
                )

    def _add_similarity_edges(self, topic_ids, topic_cooccurrence, topic_year_freq):
        """Add similarity edges for topics not connected by prerequisites."""
        topics = list(topic_ids.keys())
        # Only add edges for topics with significant co-occurrence
        for i in range(len(topics)):
            for j in range(i + 1, len(topics)):
                t_a, t_b = topics[i], topics[j]
                node_a, node_b = topic_ids[t_a], topic_ids[t_b]

                # Skip if already have a prerequisite edge
                if (node_a, node_b) in self.edge_weights or (node_b, node_a) in self.edge_weights:
                    continue

                cooccur = topic_cooccurrence.get(t_a, {}).get(t_b, 0)
                if cooccur < 2:  # Require at least 2 co-occurrences
                    continue

                topic_sim = compute_topic_similarity(t_a, t_b)
                edge_weight = 0.4 * topic_sim + 0.6 * min(1.0, cooccur / 8.0)

                if edge_weight >= 0.3:  # Only add edges with meaningful similarity
                    self._add_edge(
                        node_a, node_b,
                        weight=round(edge_weight, 4),
                        edge_type='similar_to',
                        metadata={
                            'dependency_strength': 0.0,
                            'topic_similarity': round(topic_sim, 4),
                            'influence_score': round(edge_weight * 0.5, 4),
                            'cooccurrence_count': cooccur,
                            'prerequisite_type': 'semantic',
                        }
                    )

    def _add_edge(self, source: str, target: str, weight: float, edge_type: str, metadata: dict):
        """Add or update an edge."""
        edge_key = (source, target)
        if edge_key in self.edge_weights:
            return  # No duplicate edges

        self.edges.append({
            'source': source,
            'target': target,
            'type': edge_type,
            'weight': weight,
            'metadata': metadata,
        })
        self.edge_weights[edge_key] = weight
        self.adjacency[source].append(target)
        self.reverse_adjacency[target].append(source)

    # ═══════════════════════════════════════════════════════════════════
    # GRAPH PROPAGATION
    # ═══════════════════════════════════════════════════════════════════

    def propagate_probability(
        self,
        topic_probabilities: Dict[str, float],
        decay_factor: float = 0.5,
        max_hops: int = 3,
    ) -> Dict[str, float]:
        """
        Propagate probability through prerequisite edges.

        When a topic's probability rises, propagate forward to its
        downstream topics (topics that depend on this one).

        Args:
            topic_probabilities: Dict mapping topic_name -> probability (0-1)
            decay_factor: How much probability decays per hop
            max_hops: Maximum propagation distance

        Returns:
            Updated topic probabilities after propagation
        """
        result = dict(topic_probabilities)

        # Convert to node IDs
        node_probs = {}
        for topic, prob in topic_probabilities.items():
            node_probs[topic_to_node_id(topic)] = prob

        # BFS propagation
        for topic, prob in topic_probabilities.items():
            if prob < 0.2:
                continue  # Weak signal — don't propagate

            node_id = topic_to_node_id(topic)
            queue = deque([(node_id, 0)])  # (node, distance)
            visited = {node_id}

            while queue:
                current, dist = queue.popleft()
                if dist >= max_hops:
                    continue

                # Propagate to downstream (forward adjacency)
                for neighbor in self.adjacency.get(current, []):
                    if neighbor in visited:
                        continue
                    visited.add(neighbor)

                    edge_key = (current, neighbor)
                    edge_weight = self.edge_weights.get(edge_key, 0.5)

                    # Boost = original_prob * decay^distance * edge_weight
                    boost = prob * (decay_factor ** (dist + 1)) * edge_weight

                    # Apply to node
                    neighbor_topic = node_id_to_topic(neighbor)
                    if neighbor_topic in result:
                        result[neighbor_topic] = min(1.0, result[neighbor_topic] + boost)

                    queue.append((neighbor, dist + 1))

        return result

    # ═══════════════════════════════════════════════════════════════════
    # PAGERANK CENTRALITY
    # ═══════════════════════════════════════════════════════════════════

    def compute_pagerank(
        self, damping: float = 0.85, max_iter: int = 100, tol: float = 1e-6
    ) -> Dict[str, float]:
        """
        Compute PageRank centrality for all topic nodes.

        Higher PageRank = more influential topic in the graph.
        """
        topic_nodes = [
            n['id'] for n in self.nodes.values() if n.get('type') == 'topic'
        ]
        if not topic_nodes:
            return {}

        n = len(topic_nodes)
        if n == 0:
            return {}

        node_to_idx = {node: i for i, node in enumerate(topic_nodes)}
        pr = {node: 1.0 / n for node in topic_nodes}

        # Build out-degree map
        out_degree = {}
        for node in topic_nodes:
            out = [t for t in self.adjacency.get(node, []) if t in node_to_idx]
            out_degree[node] = len(out)

        # Handle dangling nodes (no outgoing edges)
        dangling_nodes = [node for node in topic_nodes if out_degree[node] == 0]
        dangling_pr = 1.0 / n

        for _ in range(max_iter):
            prev_pr = dict(pr)
            dangling_sum = sum(prev_pr.get(node, 0.0) for node in dangling_nodes)
            total_pr = 0.0

            for node in topic_nodes:
                inbound_pr = 0.0
                for neighbor in self.reverse_adjacency.get(node, []):
                    if neighbor in node_to_idx:
                        inbound_pr += prev_pr.get(neighbor, 0.0) / max(1, out_degree[neighbor])
                pr[node] = (1 - damping) / n + damping * (inbound_pr + dangling_sum * dangling_pr)
                total_pr += pr[node]

            # Normalize
            for node in topic_nodes:
                pr[node] /= total_pr

            # Check convergence
            diff = sum(abs(pr[n] - prev_pr.get(n, 0.0)) for n in topic_nodes)
            if diff < tol:
                break

        return {node_id_to_topic(k): round(v, 6) for k, v in pr.items()}

    # ═══════════════════════════════════════════════════════════════════
    # BETWEENNESS CENTRALITY
    # ═══════════════════════════════════════════════════════════════════

    def compute_betweenness(self) -> Dict[str, float]:
        """
        Compute betweenness centrality using Brandes' algorithm.

        Betweenness measures how often a node lies on the shortest paths
        between other nodes. High betweenness = critical bridge.
        """
        topic_nodes = [
            n['id'] for n in self.nodes.values() if n.get('type') == 'topic'
        ]
        if not topic_nodes:
            return {}

        node_set = set(topic_nodes)
        betweenness = {n: 0.0 for n in topic_nodes}
        n = len(topic_nodes)

        for s in topic_nodes:
            # BFS from s
            stack = []
            predecessors = defaultdict(list)
            sigma = {t: 0 for t in topic_nodes}
            sigma[s] = 1
            dist = {t: -1 for t in topic_nodes}
            dist[s] = 0
            queue = deque([s])

            while queue:
                v = queue.popleft()
                stack.append(v)
                for w in self.adjacency.get(v, []):
                    if w not in node_set:
                        continue
                    if dist[w] < 0:
                        queue.append(w)
                        dist[w] = dist[v] + 1
                    if dist[w] == dist[v] + 1:
                        sigma[w] += sigma[v]
                        predecessors[w].append(v)

            # Accumulation
            delta = {t: 0.0 for t in topic_nodes}
            while stack:
                w = stack.pop()
                for v in predecessors[w]:
                    delta[v] += (sigma[v] / sigma[w]) * (1.0 + delta[w])
                if w != s:
                    betweenness[w] += delta[w]

        # Normalize
        if n > 2:
            for node in betweenness:
                betweenness[node] /= ((n - 1) * (n - 2))
                betweenness[node] = round(betweenness[node], 6)

        return {node_id_to_topic(k): v for k, v in betweenness.items()}

    # ═══════════════════════════════════════════════════════════════════
    # EIGENVECTOR CENTRALITY (Power iteration)
    # ═══════════════════════════════════════════════════════════════════

    def compute_eigenvector_centrality(
        self, max_iter: int = 100, tol: float = 1e-6
    ) -> Dict[str, float]:
        """
        Compute eigenvector centrality using power iteration.

        A node has high eigenvector centrality if it is connected to
        other high-centrality nodes (influential neighbors).
        """
        topic_nodes = [
            n['id'] for n in self.nodes.values() if n.get('type') == 'topic'
        ]
        if not topic_nodes:
            return {}

        n = len(topic_nodes)
        idx_map = {node: i for i, node in enumerate(topic_nodes)}

        # Initialize
        x = [1.0 / n] * n

        for _ in range(max_iter):
            x_new = [0.0] * n
            for i, node in enumerate(topic_nodes):
                for neighbor in self.adjacency.get(node, []):
                    if neighbor in idx_map:
                        j = idx_map[neighbor]
                        edge_weight = self.edge_weights.get((node, neighbor), 0.5)
                        x_new[j] += x[i] * edge_weight

                for neighbor in self.reverse_adjacency.get(node, []):
                    if neighbor in idx_map:
                        j = idx_map[neighbor]
                        edge_weight = self.edge_weights.get((neighbor, node), 0.5)
                        x_new[j] += x[i] * edge_weight * 0.5  # reverse edges count half

            # Normalize
            norm = math.sqrt(sum(v ** 2 for v in x_new))
            if norm == 0:
                break
            x_new = [v / norm for v in x_new]

            # Check convergence
            diff = sum(abs(x_new[i] - x[i]) for i in range(n))
            x = x_new
            if diff < tol:
                break

        return {
            node_id_to_topic(topic_nodes[i]): round(x[i], 6)
            for i in range(n)
        }

    # ═══════════════════════════════════════════════════════════════════
    # COMMUNITY DETECTION (Louvain-like)
    # ═══════════════════════════════════════════════════════════════════

    def detect_communities(self) -> Dict[str, int]:
        """
        Detect topic communities using a Louvain-like algorithm.

        Groups topics into clusters of densely connected topics.
        Returns a dict mapping topic_name -> community_id.
        """
        topic_nodes = [
            n['id'] for n in self.nodes.values() if n.get('type') == 'topic'
        ]
        if not topic_nodes:
            return {}

        # Initialize: each node in its own community
        community = {node: i for i, node in enumerate(topic_nodes)}
        node_list = list(topic_nodes)

        # Total weight of all edges
        m = 0.0
        for (src, tgt), w in self.edge_weights.items():
            if src in community and tgt in community:
                m += w

        if m == 0:
            return {node_id_to_topic(k): 0 for k in topic_nodes}

        # Compute weighted degree
        k = defaultdict(float)
        for node in topic_nodes:
            for neighbor in self.adjacency.get(node, []):
                if neighbor in community:
                    k[node] += self.edge_weights.get((node, neighbor), 0.5)
            for neighbor in self.reverse_adjacency.get(node, []):
                if neighbor in community:
                    k[node] += self.edge_weights.get((neighbor, node), 0.5) * 0.5

        # Iterate
        improved = True
        max_passes = 10
        for _ in range(max_passes):
            if not improved:
                break
            improved = False
            for node in node_list:
                # Compute best community for this node
                current_comm = community[node]
                neighbor_comms = defaultdict(float)
                for neighbor in self.adjacency.get(node, []):
                    if neighbor in community:
                        w = self.edge_weights.get((node, neighbor), 0.5)
                        neighbor_comms[community[neighbor]] += w
                for neighbor in self.reverse_adjacency.get(node, []):
                    if neighbor in community:
                        w = self.edge_weights.get((neighbor, node), 0.5) * 0.5
                        neighbor_comms[community[neighbor]] += w

                # Remove node from its community
                # Evaluate moving to neighbor communities
                best_comm = current_comm
                best_gain = 0.0
                self_loop = self.edge_weights.get((node, node), 0.0)

                for target_comm, sum_neighbor_weight in neighbor_comms.items():
                    # Modularity gain (simplified)
                    ki = k[node]
                    sum_tot = sum(
                        k[n] for n in node_list if community[n] == target_comm
                    )
                    gain = (sum_neighbor_weight - ki * sum_tot / (2 * m)) / m
                    if gain > best_gain:
                        best_gain = gain
                        best_comm = target_comm

                if best_comm != current_comm:
                    community[node] = best_comm
                    improved = True

        # Renumber communities
        comm_ids = {}
        next_id = 0
        result = {}
        for node in topic_nodes:
            c = community[node]
            if c not in comm_ids:
                comm_ids[c] = next_id
                next_id += 1
            result[node_id_to_topic(node)] = comm_ids[c]

        return result

    # ═══════════════════════════════════════════════════════════════════
    # BOTTLENECK DETECTION
    # ═══════════════════════════════════════════════════════════════════

    def detect_bottlenecks(self) -> List[Dict]:
        """
        Detect bottleneck topics — topics that are prerequisites for many
        other topics AND have high downstream depth.

        Uses the knowledge graph's prerequisite edges.
        """
        topic_nodes = [
            n['id'] for n in self.nodes.values() if n.get('type') == 'topic'
        ]
        bottlenecks = []

        for node_id in topic_nodes:
            # Outgoing: topics this is prerequisite for
            outgoing = [t for t in self.adjacency.get(node_id, []) if t in topic_nodes]
            # Incoming: prerequisites of this topic
            incoming = [t for t in self.reverse_adjacency.get(node_id, []) if t in topic_nodes]

            forward_impact = len(outgoing)
            depth_impact = self._compute_downstream_depth(node_id, set(), topic_nodes)
            bottleneck_score = forward_impact * 0.6 + depth_impact * 0.4

            if bottleneck_score > 0:
                topic = node_id_to_topic(node_id)
                bottlenecks.append({
                    'topic': topic,
                    'label': self.nodes.get(node_id, {}).get('label', topic),
                    'domain': self.topic_to_domain.get(topic, ''),
                    'forward_impact': forward_impact,
                    'num_prerequisites': len(incoming),
                    'downstream_depth': depth_impact,
                    'bottleneck_score': round(bottleneck_score, 4),
                    'is_bottleneck': bottleneck_score >= 2.0,
                })

        bottlenecks.sort(key=lambda x: x['bottleneck_score'], reverse=True)
        return bottlenecks

    def _compute_downstream_depth(
        self, node_id: str, visited: Set, topic_nodes: List[str]
    ) -> int:
        """Compute the maximum depth of downstream dependencies."""
        if node_id in visited:
            return 0
        visited.add(node_id)

        max_depth = 0
        for neighbor in self.adjacency.get(node_id, []):
            if neighbor in topic_nodes:
                depth = 1 + self._compute_downstream_depth(neighbor, visited, topic_nodes)
                max_depth = max(max_depth, depth)

        return max_depth

    # ═══════════════════════════════════════════════════════════════════
    # GRAPH QUALITY EVALUATION
    # ═══════════════════════════════════════════════════════════════════

    def evaluate_graph_quality(self) -> Dict:
        """Evaluate the quality of the knowledge graph."""
        topic_nodes = [
            n['id'] for n in self.nodes.values() if n.get('type') == 'topic'
        ]
        n_topics = len(topic_nodes)

        n_edges = len(self.edges)
        max_edges = n_topics * (n_topics - 1) / 2 if n_topics > 1 else 1
        edge_density = n_edges / max_edges if max_edges > 0 else 0

        # Prerequisite edges count
        prereq_edges = [e for e in self.edges if e.get('type') == 'requires']

        # Check for cycles
        has_cycles = self._has_cycles(topic_nodes)

        # Connectivity
        connectivity = self._compute_connectivity(topic_nodes)

        return {
            'node_coverage': round(n_topics / max(1, len(get_all_topics())), 4),
            'edge_density': round(edge_density, 6),
            'total_prerequisite_edges': len(prereq_edges),
            'total_similarity_edges': len([e for e in self.edges if e.get('type') == 'similar_to']),
            'has_cycles': has_cycles,
            'connectivity_ratio': round(connectivity, 4),
            'avg_out_degree': round(
                sum(len(self.adjacency.get(n, [])) for n in topic_nodes) / max(1, n_topics), 4
            ),
        }

    def _has_cycles(self, topic_nodes: List[str]) -> bool:
        """Detect cycles using DFS."""
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {n: WHITE for n in topic_nodes}

        def dfs(node):
            color[node] = GRAY
            for neighbor in self.adjacency.get(node, []):
                if neighbor not in color:
                    continue
                if color[neighbor] == GRAY:
                    return True
                if color[neighbor] == WHITE and dfs(neighbor):
                    return True
            color[node] = BLACK
            return False

        for node in topic_nodes:
            if color[node] == WHITE:
                if dfs(node):
                    return True
        return False

    def _compute_connectivity(self, topic_nodes: List[str]) -> float:
        """Compute what fraction of nodes are reachable from root nodes."""
        roots = [
            n for n in topic_nodes
            if not self.reverse_adjacency.get(n, [])
            or all(r not in topic_nodes for r in self.reverse_adjacency.get(n, []))
        ]
        if not roots:
            return 0.0

        reachable = set()
        for root in roots:
            queue = deque([root])
            visited = {root}
            while queue:
                current = queue.popleft()
                reachable.add(current)
                for neighbor in self.adjacency.get(current, []):
                    if neighbor in topic_nodes and neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)
        return len(reachable) / max(1, len(topic_nodes))

    # ═══════════════════════════════════════════════════════════════════
    # SHORTEST LEARNING PATH
    # ═══════════════════════════════════════════════════════════════════

    def find_shortest_learning_path(
        self, target_topic: str, known_topics: List[str] = None
    ) -> Dict:
        """
        Find the optimal learning path to reach a target topic.
        Uses BFS on the reverse prerequisite graph.
        """
        if known_topics is None:
            known_topics = []

        target_id = topic_to_node_id(target_topic)
        known_ids = {topic_to_node_id(t) for t in known_topics}

        # BFS from target backward to find all prerequisites
        needed = set()
        queue = deque([target_id])
        visited = {target_id}

        while queue:
            current = queue.popleft()
            for prereq in self.reverse_adjacency.get(current, []):
                if prereq not in visited:
                    visited.add(prereq)
                    needed.add(prereq)
                    queue.append(prereq)

        # Remove already-known topics
        needed -= known_ids

        # Order by depth (fundamentals first)
        depth_map = {}
        for node_id in needed:
            depth = 0
            current = node_id
            while current in self.reverse_adjacency:
                prereqs = [
                    p for p in self.reverse_adjacency[current]
                    if p in needed or p in known_ids
                ]
                if not prereqs:
                    break
                depth += 1
                current = prereqs[0]
            depth_map[node_id] = depth

        ordered_path = sorted(
            [(node_id_to_topic(n), depth_map.get(n, 0)) for n in needed],
            key=lambda x: (-x[1], x[0])
        )

        return {
            'target_topic': target_topic,
            'known_topics': known_topics,
            'prerequisites_needed': [t for t, _ in ordered_path],
            'total_steps': len(ordered_path),
        }

    # ═══════════════════════════════════════════════════════════════════
    # EXPORT
    # ═══════════════════════════════════════════════════════════════════

    def to_dict(self) -> Dict:
        """Export the full graph with all analytics."""
        # Compute all analytics
        pagerank = self.compute_pagerank()
        betweenness = self.compute_betweenness()
        eigenvector = self.compute_eigenvector_centrality()
        communities = self.detect_communities()
        bottlenecks = self.detect_bottlenecks()
        quality = self.evaluate_graph_quality()

        # Build node lookup
        node_lookup = {n['id']: n for n in self.nodes.values()}

        # Enrich nodes with analytics
        enriched_nodes = []
        for node_id, node in self.nodes.items():
            topic = node_id_to_topic(node_id)
            enriched = dict(node)
            enriched['pagerank'] = pagerank.get(topic, 0.0)
            enriched['betweenness'] = betweenness.get(topic, 0.0)
            enriched['eigenvector_centrality'] = eigenvector.get(topic, 0.0)
            enriched['community_id'] = communities.get(topic, 0)
            enriched['bottleneck_score'] = next(
                (b['bottleneck_score'] for b in bottlenecks if b['topic'] == topic), 0.0
            )
            enriched['is_bottleneck'] = any(b['topic'] == topic and b['is_bottleneck'] for b in bottlenecks)
            enriched_nodes.append(enriched)

        return {
            'name': 'EJU Dynamic Knowledge Graph v3',
            'version': '3.1.0',
            'nodes': enriched_nodes,
            'edges': self.edges,
            'analysis': {
                'centrality': {k: v for k, v in sorted(
                    pagerank.items(), key=lambda x: x[1], reverse=True
                )},
                'betweenness': {k: v for k, v in sorted(
                    betweenness.items(), key=lambda x: x[1], reverse=True
                )},
                'eigenvector': {k: v for k, v in sorted(
                    eigenvector.items(), key=lambda x: x[1], reverse=True
                )},
                'communities': {
                    str(c): [t for t, cc in communities.items() if cc == c]
                    for c in sorted(set(communities.values()))
                },
                'bottlenecks': {
                    'total_bottlenecks': sum(1 for b in bottlenecks if b['is_bottleneck']),
                    'bottleneck_topics': [b for b in bottlenecks if b['is_bottleneck']],
                },
                'graph_quality': quality,
            },
        }


# ═══════════════════════════════════════════════════════════════════════
# BACKWARD COMPATIBILITY WRAPPER
# ═══════════════════════════════════════════════════════════════════════

class KnowledgeGraphAnalyzer:
    """Backward-compatible wrapper using DynamicKnowledgeGraph."""

    def __init__(self):
        self.dkg = DynamicKnowledgeGraph()
        self.nodes = self.dkg.nodes
        self.edges = self.dkg.edges
        self.adjacency = self.dkg.adjacency
        self.reverse_adjacency = self.dkg.reverse_adjacency
        self.topic_to_domain = self.dkg.topic_to_domain

    def load_from_file(self, path: str = 'dataset/knowledge-graph/knowledge_graph_v3.json'):
        """Load from existing file (backward compat)."""
        kg = load_knowledge_graph(path)
        self.dkg.nodes = {n['id']: n for n in kg.get('nodes', [])}
        self.dkg.edges = kg.get('edges', [])
        self.nodes = self.dkg.nodes
        self.edges = self.dkg.edges

        self.dkg.adjacency = defaultdict(list)
        self.dkg.reverse_adjacency = defaultdict(list)
        for edge in self.dkg.edges:
            source = edge.get('source') or edge.get('sourceId', '')
            target = edge.get('target') or edge.get('targetId', '')
            if source and target:
                self.dkg.adjacency[source].append(target)
                self.dkg.reverse_adjacency[target].append(source)
        self.adjacency = self.dkg.adjacency
        self.reverse_adjacency = self.dkg.reverse_adjacency

    def build_prerequisite_graph(self):
        """Build prerequisite graph (backward compat)."""
        self.dkg.load_from_data()
        self.nodes = self.dkg.nodes
        self.edges = self.dkg.edges
        self.adjacency = self.dkg.adjacency
        self.reverse_adjacency = self.dkg.reverse_adjacency

    def compute_topic_centrality(self) -> Dict[str, float]:
        """Backward-compat: returns PageRank as default centrality."""
        return self.dkg.compute_pagerank()

    def detect_bottlenecks(self) -> List[Dict]:
        return self.dkg.detect_bottlenecks()

    def _compute_downstream_depth(self, node_id: str, visited: Set = None) -> int:
        topic_nodes = [n['id'] for n in self.nodes.values() if n.get('type') in ('topic', 'concept')]
        if visited is None:
            visited = set()
        return self.dkg._compute_downstream_depth(node_id, visited, topic_nodes)

    def _estimate_betweenness(self, node_id: str, all_nodes: List[str]) -> float:
        return 0.0

    def find_shortest_learning_path(self, target_topic: str, known_topics: List[str] = None) -> Dict:
        return self.dkg.find_shortest_learning_path(target_topic, known_topics)

    def evaluate_graph_quality(self) -> Dict:
        return self.dkg.evaluate_graph_quality()

    def generate_enhanced_graph(self) -> Dict:
        """Generate enhanced graph with all analytics."""
        return self.dkg.to_dict()

    def propagate_probability(
        self, topic_probabilities: Dict[str, float], decay_factor: float = 0.5, max_hops: int = 3
    ) -> Dict[str, float]:
        return self.dkg.propagate_probability(topic_probabilities, decay_factor, max_hops)

    def compute_pagerank(self) -> Dict[str, float]:
        return self.dkg.compute_pagerank()

    def compute_betweenness(self) -> Dict[str, float]:
        return self.dkg.compute_betweenness()

    def compute_eigenvector_centrality(self) -> Dict[str, float]:
        return self.dkg.compute_eigenvector_centrality()

    def detect_communities(self) -> Dict[str, int]:
        return self.dkg.detect_communities()
