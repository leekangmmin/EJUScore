"""
GNN-Enhanced Topic Predictor — V4 Revised
==========================================
Due to the extremely small dataset (only 24 time steps/years),
the full GraphSAGE GNN overfits severely.

Instead, we use:

1. Graph Propagation (Personalized PageRank / label propagation)
   - Zero parameters to train
   - Smooths probabilities across the knowledge graph
   - Frequent topics naturally boost their neighbors (sparse topics)
   
2. Graph-Aware Feature Augmentation
   - Uses graph topology to build better input features
   - Degree centrality, PageRank, community affiliation

This approach is proven to work well with very small graphs (35 nodes).
"""

import math
import numpy as np
from collections import defaultdict
from typing import Dict, List, Optional

from intelligence_engine_v4.config import (
    GNN_HIDDEN_DIM, GNN_OUTPUT_DIM,
    GNN_DROPOUT, GNN_ENSEMBLE_SEEDS,
)
from intelligence_engine_v4.data import (
    TRAIN_TOPICS, TOPIC_TO_IDX, IDX_TO_TOPIC,
    TOPIC_TO_CLUSTER, CLUSTER_TO_TOPICS, TOPIC_CLUSTERS,
    DOMAINS, N_TOPICS, N_CLUSTERS,
    build_topic_year_matrix, build_topic_features,
    build_knowledge_graph_adjacency, build_labels,
    compute_ground_truth_count, PREREQUISITE_MAP,
)

TORCH_AVAILABLE = False  # GNN disabled; using graph propagation instead


# ── Graph Propagation (Personalized PageRank / Label Propagation) ──

def normalize_adjacency(adj: np.ndarray) -> np.ndarray:
    """Row-normalize adjacency matrix."""
    row_sum = np.sum(adj, axis=1, keepdims=True)
    row_sum = np.where(row_sum > 0, row_sum, 1.0)
    return adj / row_sum


def graph_propagate(
    topic_probs: np.ndarray,
    adj: np.ndarray,
    alpha: float = 0.15,
    n_iter: int = 10,
) -> np.ndarray:
    """
    Personalized PageRank propagation on topic probabilities.

    P^{t+1} = alpha * P_init + (1-alpha) * A_norm @ P^{t}

    This smooths probabilities across the graph:
    - Frequent topics boost their neighbors
    - Sparse topics "borrow" signal from connected frequent topics

    Args:
        topic_probs: Initial topic probabilities (N_TOPICS,)
        adj: Adjacency matrix (N_TOPICS, N_TOPICS)
        alpha: Teleport probability (higher = stay closer to original)
        n_iter: Number of iterations

    Returns:
        Smoothed topic probabilities
    """
    adj_norm = normalize_adjacency(adj)
    p = topic_probs.copy()

    for _ in range(n_iter):
        p = alpha * topic_probs + (1.0 - alpha) * adj_norm @ p

    return p


def compute_pagerank(adj: np.ndarray, alpha: float = 0.85, n_iter: int = 50) -> np.ndarray:
    """Compute PageRank centrality for all topics."""
    N = adj.shape[0]
    adj_norm = normalize_adjacency(adj)
    pr = np.ones(N) / N

    for _ in range(n_iter):
        pr = (1 - alpha) / N + alpha * adj_norm.T @ pr

    return pr / pr.sum()


def compute_graph_features(
    adj: np.ndarray,
    year_matrix: Dict[str, Dict[int, int]],
) -> np.ndarray:
    """
    Compute graph-based features for each topic.

    Returns:
        (N_TOPICS, 4) feature array:
        - PageRank centrality
        - Degree centrality
        - Clustering coefficient (triangle count)
        - Prerequisite depth (longest prerequisite chain)
    """
    N = adj.shape[0]
    features = np.zeros((N, 4), dtype=np.float32)

    # 0: PageRank centrality
    pr = compute_pagerank(adj)
    features[:, 0] = pr / pr.max()

    # 1: Degree centrality
    degrees = adj.sum(axis=1)
    features[:, 1] = degrees / degrees.max() if degrees.max() > 0 else 0

    # 2: Topic frequency (proportion of years appeared) 
    # — not graph-based, but useful context
    for i, topic in enumerate(TRAIN_TOPICS):
        yearly = year_matrix.get(topic, {})
        active = sum(1 for y, c in yearly.items() if c > 0)
        features[i, 2] = active / max(1, 24)  # max 24 years

    # 3: Prerequisite depth (how many topics depend on this one)
    for i, topic in enumerate(TRAIN_TOPICS):
        as_prereq = sum(1 for t, p in PREREQUISITE_MAP.items() if topic in p)
        features[i, 3] = min(1.0, as_prereq / 8.0)

    return features


# ── Simplified Predictor (Frequency + Graph Propagation) ──────────

class GraphEnhancedPredictor:
    """
    Predictor that combines frequency analysis with graph propagation.

    This replaces the full GNN. It has zero trainable parameters
    and will not overfit.

    Components:
    1. Recency-weighted frequency (base prediction)
    2. Graph propagation (smooths across KG)
    3. Graph centrality boost (prioritizes central topics)
    4. Cluster-level aggregation
    """

    def __init__(self):
        self.year_matrix = {}
        self.adj = build_knowledge_graph_adjacency()
        self.graph_features = None

    def load_data(self, year_matrix: Dict[str, Dict[int, int]]):
        self.year_matrix = year_matrix
        self.graph_features = compute_graph_features(self.adj, year_matrix)

    def predict(
        self,
        target_year: int = 2026,
        alpha: float = 0.3,  # graph propagation strength
        verbose: bool = False,
    ) -> Dict:
        """
        Generate topic predictions using frequency + graph propagation.

        Args:
            target_year: Year to predict
            alpha: Graph propagation teleport (lower = more smoothing)
            verbose: Print progress

        Returns:
            Dict with topic_probs, cluster_probs, graph_features
        """
        # Step 1: Base probabilities from recency-weighted frequency
        decay_constant = math.log(2) / 3.0
        years_range = list(range(2002, target_year))

        topic_probs = np.zeros(N_TOPICS, dtype=np.float32)

        for i, topic in enumerate(TRAIN_TOPICS):
            yearly = self.year_matrix.get(topic, {})
            tw, ws = 0.0, 0.0
            for year in years_range:
                cnt = yearly.get(year, 0)
                w = math.exp(-decay_constant * (target_year - year))
                tw += cnt * w
                ws += w
            if ws > 0:
                # Normalize: ~5 max questions per year per topic
                topic_probs[i] = min(1.0, (tw / ws) / 5.0)
            else:
                topic_probs[i] = 0.05

        # Step 2: Graph propagation (smooth probabilities across KG)
        propagated = graph_propagate(topic_probs, self.adj, alpha=alpha)

        # Step 3: Graph centrality boost for sparse topics
        # Topics with high PageRank but low frequency get a small boost
        if self.graph_features is not None:
            centrality = self.graph_features[:, 0]  # PageRank
            freq_density = self.graph_features[:, 2]
            # Boost: high centrality + low frequency = hidden potential
            boost = np.where(
                (centrality > 0.3) & (freq_density < 0.3),
                0.1 * centrality,
                0.0
            )
            propagated = np.clip(propagated + boost, 0.0, 1.0)

        # Step 4: Cluster-level probabilities
        cluster_probs = np.zeros(len(TOPIC_CLUSTERS), dtype=np.float32)
        for ci, cname in enumerate(TOPIC_CLUSTERS):
            topics_in_cluster = TOPIC_CLUSTERS[cname]["topics"]
            indices = [TOPIC_TO_IDX[t] for t in topics_in_cluster if t in TOPIC_TO_IDX]
            if indices:
                cluster_probs[ci] = float(np.mean(propagated[indices]))
            else:
                cluster_probs[ci] = 0.2

        return {
            'topic_probs': propagated,
            'cluster_probs': cluster_probs,
            'graph_features': self.graph_features,
        }


# Export compatible API
def train_gnn_ensemble(*args, **kwargs):
    """No-op: graph propagation doesn't need training."""
    return []


def ensemble_predict(predictor, year_matrix, target_year):
    """Use GraphEnhancedPredictor instead of GNN."""
    gep = GraphEnhancedPredictor()
    gep.load_data(year_matrix)
    return gep.predict(target_year)
