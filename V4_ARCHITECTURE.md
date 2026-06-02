# V4 Architecture Design — EJU Intelligence Engine
## Goal: Precision ≥ 0.85, Recall ≥ 0.80, F1 ≥ 0.82

---

## 1. Current Architecture (V3) — Critical Analysis

### 1.1 Performance Baseline

```
                    Current     Target      Gap
Precision           0.7979      ≥0.8500     +0.0521
Recall              0.4589      ≥0.8000     +0.3411  ← PRIMARY BOTTLENECK
F1                  0.5772      ≥0.8200     +0.2428
```

### 1.2 Root Cause of Low Recall

| Cause | Impact | Evidence |
|-------|--------|----------|
| **Fixed-N prediction** (N=10~13) | Systematic miss of 5~12 topics/year | Avg actual=14~25, avg predicted=10~13 |
| **Sparse topic ignorance** | 8/35 topics (~23%) nearly never predicted | 8 topics appear in <5 years |
| **No cluster completion** | Missing topic within predicted cluster | Cluster appears but not all sub-topics |
| **Conservative Bayesian prior** | Low probability for new/rare topics | Beta(2,10) prior suppresses emergence |
| **No student data feedback** | Predictions are exam-only, no student performance | Student model is not connected to predictor |
| **Static thresholding** | Uses top-N instead of probability threshold | Fixed cut-off regardless of confidence |

### 1.3 Data Characteristics (Critical for Architecture Decisions)

| Property | Value | Implication |
|----------|-------|-------------|
| Total questions | 1,310 | Very small for deep learning |
| Time steps | 24 years (2002-2025) | Extremely short time series |
| Topics | 35 unique | Manageable for graph methods |
| Avg topics/year | 14.0 | Target for prediction |
| Min/Max topics/year | 6 / 25 | High variance |
| Sparse topics (<5yr) | 8 topics (23%) | Need special handling |
| Questions with topic | 1,310 | Clean, well-labeled |

---

## 2. V4 Architecture — Complete Design

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        V4 INTELLIGENCE ENGINE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐    ┌──────────────────────────────┐      │
│  │   DATA LAYER         │    │   INFERENCE LAYER            │      │
│  │  ┌────────────────┐  │    │  ┌───────────────────────┐   │      │
│  │  │ Gold Standard   │  │    │  │ GNN-Enhanced          │   │      │
│  │  │  (1,310 Qs)     │  │    │  │ Topic Predictor        │   │      │
│  │  └────────────────┘  │    │  │  ├─ Temporal Encoder   │   │      │
│  │  ┌────────────────┐  │    │  │  ├─ Graph Propagator   │   │      │
│  │  │ Student         │  │    │  │  ├─ Cluster Completer  │   │      │
│  │  │ Performance     │──┼────┼─>│  └─ Dynamic N Head    │   │      │
│  │  │ Data            │  │    │  └───────────────────────┘   │      │
│  │  └────────────────┘  │    │                              │      │
│  │  ┌────────────────┐  │    │  ┌───────────────────────┐   │      │
│  │  │ OCR/Vision      │  │    │  │ Deep Knowledge        │   │      │
│  │  │ Data            │──┼────┼─>│ Tracing (DKT)         │   │      │
│  │  └────────────────┘  │    │  └───────────────────────┘   │      │
│  │  ┌────────────────┐  │    │                              │      │
│  │  │ Knowledge       │  │    │  ┌───────────────────────┐   │      │
│  │  │ Graph (KG)      │──┼────┼─>│ Explainable           │   │      │
│  │  └────────────────┘  │    │  │ Recommendation Engine  │   │      │
│  └──────────────────────┘    │  └───────────────────────┘   │      │
│                               │                              │      │
│  ┌──────────────────────┐    │  ┌───────────────────────┐   │      │
│  │   TRAINING LAYER     │    │  │   OPTIMIZATION LAYER   │   │      │
│  │  ┌────────────────┐  │    │  │  ┌────────────────┐   │   │      │
│  │  │ GNN (2-layer    │  │    │  │  │ Active Learning │   │      │
│  │  │ GraphSAGE)      │  │    │  │  │ Sampling        │   │      │
│  │  └────────────────┘  │    │  │  └────────────────┘   │   │      │
│  │  ┌────────────────┐  │    │  │  ┌────────────────┐   │   │      │
│  │  │ DKT (GRU-based) │  │    │  │  │ Calibration    │   │      │
│  │  └────────────────┘  │    │  │  │ (Platt/Isotonic)│   │      │
│  │  ┌────────────────┐  │    │  │  └────────────────┘   │   │      │
│  │  │ XGBoost         │  │    │  └───────────────────────┘   │      │
│  │  │ Ensemble Meta   │  │    │                              │      │
│  │  └────────────────┘  │    │                              │      │
│  └──────────────────────┘    └──────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Details

---

#### COMPONENT A: GNN-Enhanced Topic Predictor (CORE IMPROVEMENT)

**Problem**: Recall is low because the system doesn't exploit topic relationships.

**Solution**: Replace basic Markov co-occurrence with **2-layer GraphSAGE** on the knowledge graph.

**Why GraphSAGE over GCN**:
- Handles inductive edges (new topic relationships)
- Works well with 35 nodes (small graph)
- More robust with sparse features than GCN

**Architecture**:
```
Input: Topic Features (35 × D)
  ├─ Historical frequency vector (35-dim, one per topic)
  ├─ Recency-weighted trend (35-dim)
  ├─ Domain embedding (5-dim one-hot)
  ├──┐
     │ KNN-based Feature Construction:
     │ For each topic t, build feature vector [f_1, f_2, ..., f_k]
     │ where f_i = {frequency, recency, domain, difficulty} of topic i
     │
  ▼
GraphSAGE Layer 1 (in_dim=8, out_dim=32)
  ├─ Aggregate: mean of neighbor features
  ├─ Concatenate: self + neighbor
  ├─ Linear + ReLU + Dropout(0.3)
  │
GraphSAGE Layer 2 (in_dim=32, out_dim=16)
  ├─ Same as Layer 1
  │
Multi-Head Output Heads:
  ├─ **Dynamic N Head** → predicts number of topics for target year
  │   (regression: Poisson loss, range 6~25)
  ├─ **Topic Probability Head** → sigmoid binary classifier per topic
  │   (35 binary outputs, weighted BCE loss)
  └─ **Cluster Activation Head** → which clusters will appear
      (12 binary outputs, one per cluster)
```

**Graph Structure Used**:
- Nodes: 35 topics + 5 domain nodes + 12 cluster nodes
- Edges: prerequisite (directed, from KG), co-occurrence (undirected, weighted by frequency), domain membership, cluster membership
- Edge features: {weight, type, co-occurrence_count}

**Expected Recall Gain**: +0.15~0.20 (from 0.46 to ~0.62~0.66)

---

#### COMPONENT B: Cluster Completion & Dynamic N (HIGH IMPACT)

**Problem**: Fixed N (10~13) misses 5~12 actual topics.

**Solution 1 — Dynamic N Head**:
```
N_pred = PoissonRegressor(features=[year_trend, 
                                     previous_N, 
                                     cluster_diversity,
                                     topic_correlation])
```
This predicts how many unique topics will appear in the next exam.

**Solution 2 — Cluster Completion Algorithm**:
```
For each cluster that has ≥1 activated topic:
    Include ALL topics in the cluster at reduced probability
    Prob_adjusted = max(topic_prob, cluster_prob × 0.7)
```

**Solution 3 — Adaptive Threshold**:
```
Instead of top-N:
    threshold = calibrate(0.3, 0.7) based on:
      - Year trend (earlier years had fewer topics)
      - Historical precision/recall trade-off
      - Student ability level
```

**Expected Recall Gain**: +0.08~0.12 (from 0.66 to ~0.74~0.78)

---

#### COMPONENT C: Deep Knowledge Tracing (DKT) (MEDIUM IMPACT)

**Problem**: Current BKT uses only 4 parameters, no student-level patterns.

**Solution**: Replace BKT with **GRU-based DKT**:

```
Input: (student_id, topic_id, correct/incorrect, timestamp)
  │
  ├── Embedding Layer: topic_id → 16-dim, student_id → 8-dim
  │
  ├── GRU(24 → 64) with LayerNorm + Dropout(0.2)
  │   Processes the sequence of student interactions
  │
  ├── Output: P(correct_{t+1}) for each of 35 topics
  │
  └── Loss: Binary Cross-Entropy
```

**Regularization for small data**:
- L2 weight decay (λ=1e-4)
- Early stopping (patience=10)
- Monte Carlo Dropout for uncertainty
- **Key trick**: Pre-train on synthetic data generated from gold standard exam patterns, then fine-tune on real student data

**Integration with Predictor**:
```
student_knowledge = DKT(student_history)  # [35-dim]
exam_prediction = GNN_Predictor(year_features)  # [35-dim]
combined_prob = 0.7 × exam_prediction + 0.3 × student_knowledge
```

**Data Requirement**: ~200-500 student interaction sequences minimum. Below 200, fall back to BKT.

**Expected Recall Gain**: +0.03~0.05 (from 0.78 to ~0.81~0.83)

---

#### COMPONENT D: XGBoost Ensemble Meta-Learner (STABILIZER)

**Problem**: Individual model predictions have high variance.

**Solution**: Train XGBoost as a meta-learner on predictions from:
1. GNN Topic Predictor (probability scores)
2. Cluster-level predictor (cluster probabilities)
3. Multi-horizon ensemble (short/medium/long)
4. Knowledge graph PageRank scores
5. Topic frequency baseline
6. Recency-weighted frequency
7. Student DKT mastery (if available)
8. OCR/Vision data confidence (if available)

**Meta-features**: 8-dim per topic → XGBoost (max_depth=3, n_estimators=100, learning_rate=0.1)

**Cross-Validation**: Leave-one-year-out CV (24 folds)

**Expected F1 Gain**: +0.02~0.03 (from 0.82 to ~0.84~0.85)

---

#### COMPONENT E: GNN vs Alternatives Analysis

**Question**: Is GNN necessary? Can we achieve the same with simpler methods?

| Approach | Pros | Cons | Expected Recall | Verdict |
|----------|------|------|-----------------|---------|
| **GNN (GraphSAGE)** | Exploits graph structure, inductive, 35 nodes is ideal | Requires re-training | ~0.62-0.66 | ✅ **RECOMMENDED** |
| Rule-based propagation | No training needed, interpretable | Limited improvement | ~0.52-0.56 | ❌ Too weak |
| Transformer on topics | Powerful sequence modeling | Needs 10x more data | ~0.55-0.60 | ❌ Overfits |
| Matrix Factorization (NMF) | Simple, fast | No temporal modeling | ~0.50-0.55 | ❌ Static |
| **GNN + Rule-based hybrid** | Best of both | Moderate complexity | ~0.66-0.72 | ✅ **BEST** |

**Verdict**: GNN is **necessary** — the 35-node graph is the ideal size for GraphSAGE, and graph structure is the only way to propagate signal from frequent to sparse topics efficiently.

---

#### COMPONENT F: Temporal Fusion Transformer (TFT) — Research Only

**Question**: Can TFT improve topic prediction as time series?

**Analysis**:
- Time series shape: 24 time steps × 35 topics = 840 observations
- For TFT, minimum recommended: 100+ time steps per series
- With 24 time steps: **severe overfitting risk**

**Alternative**: Use **LightGBM with time features** (year, decade, position-in-cycle) instead of full TFT.

| Approach | Data Required | Expected Gain | Feasibility |
|----------|--------------|---------------|-------------|
| TFT (full) | 100+ years | — | ❌ NOT FEASIBLE |
| Prophet (Facebook) | 24 steps × 35 | +0.01-0.02 recall | ⚠️ Marginal |
| LightGBM + time features | 24 steps × 35 | +0.02-0.03 recall | ✅ VIABLE |
| **ARIMA per topic** | 24 steps | +0.01 recall | ✅ BASELINE |

**Verdict**: **TFT is RESEARCH ONLY**. Use LightGBM with engineered time features instead.

---

#### COMPONENT G: Knowledge Tracing Comparison (BKT vs DKT)

| Aspect | BKT (Current) | DKT (Proposed) |
|--------|---------------|----------------|
| Parameters | 4 per topic | Embeddings + GRU (~5K total) |
| Data needed | 5+ attempts/topic | 200+ sequences |
| Student modeling | Independent topics | Cross-topic transfer |
| Forgetting | Explicit Ebbinghaus | Implicit via RNN state |
| Interpretability | High (explicit P(L), P(T), P(G), P(S)) | Low (black box) |
| **Recommendation** | ✅ Use now (<200 students) | 🔄 Switch when data grows |

**Decision Rule**:
- **If student data < 200 sequences**: Keep BKT (current) + add uncertainty quantification
- **If student data ≥ 200 sequences**: Use DKT with BKT fallback for sparse topics

---

#### COMPONENT H: Reinforcement Learning for Recommendations

**Question**: Is RL worth it for study planning?

**Analysis**:

| Criterion | RL Feasibility | Comment |
|-----------|---------------|---------|
| State space | ~2^35 (too large) | Needs state compression |
| Action space | 35 topics | Manageable |
| Reward | Score improvement | Delayed (months) |
| Simulator needed? | YES | No existing exam simulator |
| Data required | 10,000+ episodes | ~100x current data |

**Problems with RL in this setting**:
1. **No simulator**: Cannot train RL without simulated student responses
2. **High variance**: RL with small data will be worse than rule-based
3. **Cold start**: New students have no history
4. **Explainability**: RL policies are hard to explain

**Verdict**: **RL is RESEARCH ONLY**. Use multi-armed bandit (simple) for topic selection instead:
```
Thompson Sampling on topic mastery improvement:
  For each topic t:
    θ_t ~ Beta(α_t + correct_t, β_t + incorrect_t)
  Select topic with highest θ_t × exam_probability(t)
```

---

## 3. Implementation Plan

### 3.1 Priority Matrix

| Component | Impact | Effort | Risk | Data Need | Priority |
|-----------|--------|--------|------|-----------|----------|
| **Dynamic N prediction** | HIGH | LOW | LOW | None | **P0** |
| **Cluster completion** | HIGH | LOW | LOW | None | **P0** |
| **GNN (GraphSAGE)** | HIGH | MED | MED | None | **P0** |
| **Adaptive threshold** | MED | LOW | LOW | None | **P0** |
| **XGBoost ensemble** | MED | MED | LOW | None | **P1** |
| **DKT (GRU-based)** | MED | HIGH | MED | 200+ seq | **P1** |
| **Thompson Bandit** | MED | MED | LOW | Any | **P1** |
| **LightGBM time features** | LOW | LOW | LOW | None | **P2** |
| **Full TFT** | LOW | HIGH | HIGH | 100+yr | **P3-RESEARCH** |
| **Full RL** | LOW | HIGH | HIGH | 10K+ ep | **P3-RESEARCH** |

### 3.2 Expected Performance by Phase

```
Phase 0 (Baseline):     P=0.80  R=0.46  F1=0.58
Phase 1 (P0 - NOW):     P=0.84  R=0.72  F1=0.77  ← Dynamic N + GNN + Cluster
Phase 2 (P1 - SOON):    P=0.86  R=0.80  F1=0.83  ← DKT + XGBoost + Bandit
Phase 3 (P2 - LATER):   P=0.87  R=0.82  F1=0.84  ← LightGBM features
Phase 4 (Research):     P=0.88  R=0.85  F1=0.86  ← TFT/RL (if data grows)
```

### 3.3 "DO NOW" vs "RESEARCH ONLY"

#### ✅ DO NOW (P0 — Implement Immediately)

1. **Dynamic N Prediction Head**
   - Expected gain: R +0.05~0.08
   - Code change: Add Poisson regression head to predictor
   - Risk: None

2. **Cluster Completion Algorithm**
   - Expected gain: R +0.04~0.06
   - Code change: Post-processing step after prediction
   - Risk: Minimal (precision-safe: reduce prob but don't eliminate)

3. **GNN-Enhanced Topic Predictor (GraphSAGE)**
   - Expected gain: R +0.15~0.20
   - Code change: New module `gnn_predictor.py`
   - Risk: Low (35 nodes is small, can use PyTorch Geometric or pure NumPy)

4. **Adaptive Probability Threshold**
   - Expected gain: R +0.02~0.04
   - Code change: Replace top-N with calibrated threshold
   - Risk: Low (can tune on validation years)

5. **Explainable AI Integration**
   - SHAP values for each prediction factor
   - Graph attention weights visualization

#### 🔄 DO SOON (P1 — Implement Within 2 Weeks)

6. **XGBoost Ensemble Meta-Learner**
   - Expected gain: P +0.01, R +0.01
   - Code change: New module `ensemble_meta.py`
   - Risk: Low

7. **Thompson Sampling for Study Recommendations**
   - Replaces current heuristic recommendation
   - Expected gain: Better student outcomes (not directly P/R)

8. **Deep Knowledge Tracing (DKT)**
   - Conditional on having 200+ student sequences
   - Fallback to BKT with uncertainty bands

#### 🔬 RESEARCH ONLY (P3 — Do NOT Implement Now)

9. **Temporal Fusion Transformer**
   - Insufficient data (24 time steps)

10. **Full Reinforcement Learning**
    - No simulator, insufficient data

11. **Transformer-based Topic Embeddings**
    - Overkill for 35 topics

---

## 4. Detailed Algorithm Analysis

### 4.1 GNN for Topic Prediction — Full Justification

**Why Graph Neural Network?**
The 35 EJU topics form a natural graph with:
- Prerequisite edges (e.g., 시민혁명 → 산업혁명·자본주의 → 제국주의·식민지)
- Co-occurrence edges (topics appearing in same exam year)
- Domain membership edges (5 domains)
- Cluster membership edges (12 clusters)

**Without GNN**: Each topic is predicted independently → misses relational signal
**With GNN**: Information flows from frequent topics (e.g., 세계대전, 환율·국제수지) to sparse topics (e.g., 안전보장·방위, 소득분배·지니계수)

**Expected Benefit for Sparse Topics**:
| Sparse Topic | Appearances | Current Recall | With GNN |
|-------------|------------|---------------|----------|
| 안전보장·방위 | 1 | 0% | ~30% |
| 소득분배·지니계수 | 1 | 0% | ~25% |
| 대공황 | 2 | 0% | ~35% |
| 러시아혁명·소련 | 2 | 0% | ~35% |
| 산업혁명·자본주의 | 2 | 0% | ~40% |
| 전후세계질서 | 1 | 0% | ~30% |

### 4.2 Overfitting Prevention for Small Data

| Strategy | Applied To | Description |
|----------|-----------|-------------|
| Dropout (0.3~0.5) | GNN layers | Prevents co-adaptation |
| L2 regularization | All layers | Weight decay 1e-4 |
| Early stopping | DKT | Patience=10 |
| Leave-one-year-out CV | GNN, XGBoost | 24-fold cross-validation |
| Bayesian priors | Probability calibration | Beta(2,2) prior on predictions |
| Feature selection | XGBoost | Max 8 features, depth 3 |
| Monte Carlo Dropout | All neural | Uncertainty estimation |
| **Ensemble of 5 seeds** | GNN | Average predictions |

### 4.3 Data Augmentation Strategy

**For GNN training** (only 24 years = 24 graphs):
- **Year dropout**: Randomly mask 20% of years during training
- **Node feature noise**: Add Gaussian noise (σ=0.05) to features
- **Edge dropout**: Randomly drop 10% of edges during training
- **Graph mixup**: Interpolate between adjacent years' graphs

**For DKT training** (need 200+ sequences):
- **Synthetic student generation**: Sample from gold standard with noise
  - Perfect student: 85% correct
  - Average student: 60% correct
  - Weak student: 35% correct
- **Sequence augmentation**: Slide window over student history

---

## 5. V4 File Structure

```
intelligence_engine_v4/
├── __init__.py
├── config.py                          # Hyperparameters & constants
├── data/
│   ├── __init__.py
│   ├── dataset.py                     # Data loading & preprocessing
│   ├── features.py                    # Feature engineering
│   └── augmentation.py                # Data augmentation
├── models/
│   ├── __init__.py
│   ├── gnn_predictor.py               # GraphSAGE topic predictor  ← NEW
│   ├── dynamic_n.py                   # Dynamic N prediction      ← NEW
│   ├── dkt.py                         # Deep Knowledge Tracing    ← NEW (P1)
│   ├── xgboost_ensemble.py            # XGBoost meta-learner      ← NEW
│   └── bayesian_baseline.py           # Current BKT (fallback)
├── inference/
│   ├── __init__.py
│   ├── cluster_completion.py          # Cluster completion        ← NEW
│   ├── threshold_calibration.py       # Adaptive threshold        ← NEW
│   └── ensemble.py                    # Model ensemble
├── recommendations/
│   ├── __init__.py
│   ├── thompson_bandit.py             # Thompson sampling         ← NEW
│   └── multi_factor.py                # Current recommender (V3)
├── explainability/
│   ├── __init__.py
│   ├── shap_explainer.py              # SHAP values              ← NEW
│   └── attention_viz.py               # Graph attention viz      ← NEW
├── evaluation/
│   ├── __init__.py
│   ├── v4_metrics.py                  # V4 evaluation suite       ← NEW
│   └── backtest.py                    # Backtesting framework
└── tests/
    ├── test_gnn_predictor.py
    ├── test_dynamic_n.py
    ├── test_cluster_completion.py
    └── test_integration.py
```

---

## 6. Implementation Order & Dependencies

```
Week 1: P0 Foundation
  Day 1-2: Dynamic N + Adaptive Threshold
  Day 3-5: Cluster Completion + Integration
  Day 6-7: GNN Predictor (GraphSAGE) + Evaluation

Week 2: P1 Enhancement
  Day 1-2: XGBoost Ensemble Meta-Learner
  Day 3-5: Thompson Bandit Recommendations
  Day 6-7: DKT (if data available) + Calibration

Week 3: P2 Polish
  Day 1-3: LightGBM Time Features
  Day 4-5: Explainability (SHAP + Attention)
  Day 6-7: Comprehensive Evaluation + Tuning
```

---

## 7. Conclusion: Decision Summary

| Question | Answer | Rationale |
|----------|--------|-----------|
| GNN 도입 필요? | **YES — P0 (Now)** | 35-node graph is ideal for GraphSAGE; +0.15~0.20 recall |
| BKT vs DKT? | **BKT now, DKT when data ≥200** | BKT for <200 students; DKT for ≥200 |
| TFT 개선 가능? | **NO — Research only** | 24 time steps insufficient for TFT |
| RL 전환 가치? | **NO — Research only** | No simulator; use Thompson Bandit instead |
| 과적합 방지? | **Multiple strategies** | Dropout, CV, Bayesian priors, ensemble |
| 최우선 알고리즘? | **1. GNN 2. Dynamic N 3. Cluster Completion** | Highest impact, lowest risk |
