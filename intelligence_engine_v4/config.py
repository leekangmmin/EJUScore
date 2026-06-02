"""
V4 Configuration
=================
Centralized hyperparameters and constants for all V4 components.

V4 Strategic Update (2026-06-02):
  - Cluster_Multiplier: 0.85 → 0.40 (FP flood fix)
  - Cluster_Min_Confidence: 0.30 → 0.50 (FP flood fix)
  - Added: CLUSTER_MIN_HISTORY_COUNT = 1 (history filter)
  - V3 Improved: Bayesian prior Beta(3,3), Structural Break Weight,
    Markov Factor Fix, Cycle Score guard fix
  - Best config: slack=2, strictness=0.7, cluster=OFF
    → P=0.798, R=0.806, F1=0.796
  - Target: P≥0.85, R≥0.80, F1≥0.82 (Phase 2-3)
"""

import os

# ── Data ──────────────────────────────────────────────────────────────
GOLD_STANDARD_PATH = "dataset/gold_standard/gold_standard.json"
KNOWLEDGE_GRAPH_PATH = "dataset/knowledge-graph/knowledge_graph_v3.json"
DIFFICULTY_DB_PATH = "dataset/difficulty/difficulty_database.json"
CONSOLIDATED_PATH = "dataset/comprehensive/dataset_consolidated.json"

# ── Feature Dimensions ───────────────────────────────────────────────
N_FEATURES_PER_TOPIC = 8
EMBED_DIM = 32
GNN_HIDDEN_DIM = 32
GNN_OUTPUT_DIM = 16

# ── GNN Predictor (DISABLED — graph too sparse for effective propagation) ─
GNN_DROPOUT = 0.3
GNN_LR = 0.001
GNN_EPOCHS = 200
GNN_WEIGHT_DECAY = 1e-4
GNN_EDGE_DROPOUT = 0.1
GNN_NUM_LAYERS = 2
GNN_ENSEMBLE_SEEDS = 5

# ── Dynamic N ────────────────────────────────────────────────────────
N_MIN = 8
N_MAX = 28
N_DEFAULT = 14

# ── Adaptive Threshold ───────────────────────────────────────────────
THRESHOLD_MIN = 0.15
THRESHOLD_MAX = 0.70
THRESHOLD_DEFAULT = 0.35

# ── Cluster Completion ───────────────────────────────────────────────
# multiplier=0.40: Calibrated boost. Prevents FP flood from 0.85.
# min_confidence=0.50: Only highly active clusters get completion.
# min_history_count=1: Topics with zero historical appearances are not boosted.
CLUSTER_PROB_MULTIPLIER = 0.40
CLUSTER_MIN_CONFIDENCE = 0.50
CLUSTER_MIN_HISTORY_COUNT = 1

# ── Default Prediction Config ────────────────────────────────────────
DEFAULT_STRICTNESS = 0.7
DEFAULT_SLACK = 2
DEFAULT_USE_CLUSTER = False
DEFAULT_USE_PREREQUISITE = False

# ── XGBoost Ensemble ─────────────────────────────────────────────────
XGB_MAX_DEPTH = 3
XGB_N_ESTIMATORS = 100
XGB_LEARNING_RATE = 0.1
XGB_N_FOLDS = 24

# ── Thompson Bandit ──────────────────────────────────────────────────
BANDIT_ALPHA_PRIOR = 2.0
BANDIT_BETA_PRIOR = 5.0

# ── Evaluation ───────────────────────────────────────────────────────
TEST_YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
TARGET_YEARS = [2026, 2027, 2028]
