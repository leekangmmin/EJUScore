"""
EJU Intelligence Engine V4
==========================
GNN-enhanced topic prediction, Deep Knowledge Tracing,
adaptive threshold with cluster completion, and explainable recommendations.

Key Improvements over V3:
  - GraphSAGE-based topic predictor (exploits KG structure)
  - Dynamic N prediction (no more fixed top-N)
  - Cluster completion (covers sparse topics within active clusters)
  - Adaptive probability threshold (calibrated by year)
  - XGBoost ensemble meta-learner
  - Thompson sampling for study recommendations
"""

__version__ = "4.0.0"
