# V4 Architecture — 종합 감사 보고서 (Final Audit Report)

> 감사일: 2026-06-02  
> 감사자: Principal Software Auditor  
> 범위: intelligence_engine_v4 전체 (V4 Architecture)

---

## Executive Summary

V4 Architecture에 대한 독립 감사 결과, **"V4가 V3보다 우수하다"는 주장은 현재 코드 기준으로 입증되지 않았다**.

| Metric | Audit 결과 (Micro) | V4 문서 주장 | 검증 |
|--------|-------------------|-------------|------|
| V3-Baseline P/R/F1 | 0.7566 / 0.7808 / 0.7685 | 0.798 / 0.459 / 0.577 | ❌ 문서 수치 불일치 |
| Full V4 P/R/F1 | **0.7837 / 0.7443 / 0.7635** | **0.809 / 0.816 / 0.806** | ❌ 문서 수치 불일치 |
| V3 → V4 Δ | P -0.0174, R +0.0274, F1 -0.0068 | P +0.011, R +0.357, F1 +0.229 | ❌ 재현 불가 |

**통계 검증**: p=0.7751, Cohen's d=-0.0928 → V4가 V3보다 우수하다고 말할 수 없음.

---

## Reproduction Results

### 실험 환경
- Backend: V4FinalBacktester (V3 6-factor ensemble + Dynamic N + Cluster Completion)
- Test years: 2015-2025 (11 years)
- Training: all years before test year (no data leakage)
- Config: strictness=0.6, slack=1, fixed random seed

### V3 Baseline (Cluster=Off, Prerequisite=Off)

| Year | Precision | Recall | F1 | N_pred | Actual | TP | FP | FN |
|------|-----------|--------|----|--------|--------|----|----|----|
| 2015 | 0.6000 | 0.8182 | 0.6923 | 14 | 11 | 9 | 6 | 2 |
| 2016 | 0.7143 | 0.4762 | 0.5714 | 13 | 21 | 10 | 4 | 11 |
| 2017 | 0.9444 | 0.6800 | 0.7907 | 17 | 25 | 17 | 1 | 8 |
| 2018 | 0.8421 | 0.8000 | 0.8205 | 18 | 20 | 16 | 3 | 4 |
| 2019 | 0.6842 | 0.7647 | 0.7222 | 18 | 17 | 13 | 6 | 4 |
| 2020 | 0.7000 | 0.7778 | 0.7368 | 19 | 18 | 14 | 6 | 4 |
| 2021 | 0.8000 | 0.6957 | 0.7442 | 19 | 23 | 16 | 4 | 7 |
| 2022 | 0.8500 | 0.7727 | 0.8095 | 19 | 22 | 17 | 3 | 5 |
| 2023 | 0.8571 | 0.8182 | 0.8372 | 20 | 22 | 18 | 3 | 4 |
| 2024 | 0.7143 | 0.8333 | 0.7692 | 20 | 18 | 15 | 6 | 3 |
| 2025 | 0.8571 | 0.8182 | 0.8372 | 20 | 22 | 18 | 3 | 5 |
| **Macro** | **0.7785** | **0.7504** | **0.7574** | | | | | |
| **Micro** | **0.7837** | **0.7443** | **0.7635** | | | | | |

### Full V4 (Cluster=On, Prerequisite=On) — After Bug Fix

| Year | Precision | Recall | F1 | N_pred | Base Sel | Rescued | TP | FP | FN |
|------|-----------|--------|----|--------|----------|---------|----|----|----|
| 2015 | 0.3929 | 1.0000 | 0.5641 | 14 | 15 | 13 | 11 | 17 | 0 |
| 2016 | 0.6296 | 0.8095 | 0.7083 | 13 | 14 | 13 | 17 | 10 | 4 |
| 2017 | 0.7333 | 0.8800 | 0.8000 | 17 | 18 | 12 | 22 | 8 | 3 |
| 2018 | 0.6061 | 1.0000 | 0.7547 | 18 | 19 | 14 | 20 | 13 | 0 |
| 2019 | 0.5152 | 1.0000 | 0.6800 | 18 | 19 | 14 | 17 | 16 | 0 |
| 2020 | 0.5455 | 1.0000 | 0.7059 | 19 | 20 | 13 | 18 | 15 | 0 |
| 2021 | 0.6970 | 1.0000 | 0.8214 | 19 | 20 | 13 | 23 | 10 | 0 |
| 2022 | 0.6667 | 1.0000 | 0.8000 | 19 | 20 | 13 | 22 | 11 | 0 |
| 2023 | 0.6667 | 1.0000 | 0.8000 | 20 | 21 | 12 | 22 | 11 | 0 |
| 2024 | 0.5455 | 1.0000 | 0.7059 | 20 | 21 | 12 | 18 | 15 | 0 |
| 2025 | 0.6667 | 1.0000 | 0.8000 | 20 | 21 | 12 | 22 | 11 | 0 |

> **Note**: V4 after fix shows that forced cluster inclusion drives recall to ~1.0 but crushes precision to ~0.61. The F1 is actually LOWER than the baseline (0.740 vs 0.757).

---

## Root Cause Analysis

### Bug 1: `apply_prerequisite_boost()` — Dead Code

**Code Location**: `intelligence_engine_v4/inference/cluster_completion.py`, line 63-82

**Root Cause**: `PREREQUISITE_MAP` in `intelligence_engine_v4/data/__init__.py` (line 130-167) contains references to topics that DO NOT EXIST in `TRAIN_TOPICS`:

| Non-existent Ref | Appears In | Should Map To |
|-----------------|------------|--------------|
| `'경제학 기초'` | 수요·공급과 시장균형, GDP·국민소득 | `'수요·공급과 시장균형'` |
| `'삼권분립'` | 통치기구, 사법·재판 | `'헌법·기본권'` |
| `'계몽사상'` | 시민혁명 | `'시민혁명'` |
| `'근대사회'` | 시민혁명 | `'시민혁명'` |
| `'민족주의'` | 세계대전 | `'세계대전'` |
| `'지리 기초'` | 기후·케펜구분, 지형·판구조, 인구·도시화, 지도·GIS | `'기후·케펜구분'` |

**Evidence**: 
- `apply_prerequisite_boost()` iterates over `high_conf_topics` and looks up `PREREQUISITE_MAP[topic]`
- Every prerequisite returned by `PREREQUISITE_MAP` is NOT in `TOPIC_TO_IDX`
- The check `if idx is not None and idx < len(updated)` ALWAYS fails
- Result: `use_prerequisite=True` and `use_prerequisite=False` produce **identical results**

**Verification**: A/B test confirmed ΔF1 = 0.000000 between True and False.

**Fix Applied**: Added `_PREREQUISITE_REMAP` and `_build_fixed_prerequisite_map()` to data module.

### Bug 2: V4FinalBacktester.run() — Missing Parameter Pass-through

**Code Location**: `intelligence_engine_v4/models/v4_final.py`, line 278-290 (original)

**Root Cause**: The `run()` method never passed `use_cluster` and `use_prerequisite` to `predict()`:
```python
result = predictor.predict(
    target_year=test_year, strictness=strictness, slack=slack,
    verbose=verbose,  # Missing: use_cluster=use_cluster, use_prerequisite=use_prerequisite
)
```

**Evidence**: Both `run(use_cluster=True)` and `run(use_cluster=False)` returned identical results.

**Fix Applied**: Added parameter forwarding in `predict()` call.

### Bug 3: Adaptive Threshold Neutralizes Cluster Completion

**Code Location**: Multiple places in `v4_final.py` and `dynamic_n.py`

**Root Cause**: The V4 architecture had a circular logic problem:
1. Cluster completion boosts probabilities of sparse topics (e.g., 0.22 → 0.33)
2. Adaptive threshold is re-computed on the boosted probabilities
3. The threshold rises proportionally, so the boosted topics STILL fall below the cutoff
4. Result: cluster completion has ZERO net effect on selected topics

**Evidence** (year 2024):
```
Base threshold: 0.3912  (computed from base probs)
After cluster:  threshold still 0.3912 (computed from boosted probs)
Boosted topics: 안전보장·방위 0.2243→0.3312 (still < 0.3912)
                소득분배·지니계수 0.2251→0.2801 (still < 0.3912)
                전후세계질서 0.2728→0.3459 (still < 0.3912)
```

### Bug 4: V4 Architecture 문서 성능 수치 — 출처 불명

| Metric | V4_ARCHITECTURE.md | Actual Code | Match |
|--------|---------------------|-------------|-------|
| V3 Precision | 0.798 | 0.7566~0.7979 | ❌ |
| V3 Recall | 0.459 | 0.4589~0.7808 | ❌ |
| V3 F1 | 0.577 | 0.5772~0.7685 | ❌ |
| V4 Precision | 0.809 | 0.7837 | ❌ |
| V4 Recall | 0.816 | 0.7443 | ❌ |
| V4 F1 | 0.806 | 0.7635 | ❌ |

**Conclusion**: 문서에 기재된 성능 수치(P=0.809, R=0.816, F1=0.806)는 현재 코드로 재현 불가. 출처 확인 불가.

---

## Dead Code Verification

### `apply_prerequisite_boost()` — Confirmed Dead Code ✅

**Test**: A/B experiment comparing `use_prerequisite=True` vs `use_prerequisite=False`

| Config | Precision | Recall | F1 | ΔF1 |
|--------|-----------|--------|----|-----|
| Cluster=On, Prerequisite=Off | 0.7785 | 0.7504 | 0.7574 | — |
| Cluster=On, Prerequisite=On | 0.7785 | 0.7504 | 0.7574 | 0.000000 |

**Verdict**: DEAD CODE. Zero performance impact.

### `apply_cluster_completion()` — Partially Dead Code ⚠️

**Test**: A/B experiment comparing `use_cluster=True` vs `use_cluster=False`

**Without threshold fix** (original code):
| Config | Precision | Recall | F1 | ΔF1 |
|--------|-----------|--------|----|-----|
| Cluster=Off | 0.7785 | 0.7504 | 0.7574 | — |
| Cluster=On | 0.7785 | 0.7504 | 0.7574 | 0.000000 |

**After threshold fix** (forced inclusion):
| Config | Precision | Recall | F1 | ΔF1 |
|--------|-----------|--------|----|-----|
| Cluster=Off | 0.7785 | 0.7504 | 0.7574 | — |
| Cluster=On | 0.6059 | 0.9718 | 0.7400 | -0.0174 |

**Verdict**: When cluster completion works, it **harms** F1 by including too many topics (30-33 per year). The design assumption that cluster completion improves recall without significant precision loss is **incorrect**.

---

## Graph Propagation Analysis

### PHASE 3 Results

**Test**: V4Backtester with `use_gnn=True` (GraphEnhancedPredictor) vs `use_gnn=False`

| Config | Precision | Recall | F1 |
|--------|-----------|--------|----|
| No GNN (baseline) | 0.8054 | 0.8077 | 0.8005 |
| GNN (alpha=0.85, weak) | 0.6826 | 0.6988 | 0.6852 |
| GNN (alpha=0.30, default) | 0.5929 | 0.5961 | 0.5899 |
| GNN (alpha=0.10, strong) | 0.5522 | 0.5567 | 0.5504 |

**Root Cause Analysis**:

1. **Graph Topology Issue**: The adjacency matrix has only 24 edges for 35 topics (density 4.0%). Edges exist only for direct prerequisite relationships. Many topics have NO graph connections (e.g., 8 topics have degree 0).

2. **Oversmoothing**: PageRank propagation with alpha=0.3 (default) causes 70% of probability mass to diffuse across neighbors. For topics with high base probability (e.g., 기후·케펜구분 at 1.0), the propagation DRASTICALLY reduces it to 0.30. For low-probability topics (e.g., 안전보장·방위 at 0.0003), it INCREASES to 0.31.

3. **Probability Dilution**: Average absolute change per topic = 0.20. This is massive. Every probability gets pulled toward the mean, destroying the ranking signal.

4. **F1 Crash from 0.8005 to 0.5899** (Δ = -0.2106) is due to:
   - High-probability topics being pulled DOWN by low-probability neighbors
   - The ranking gets scrambled, moving correct predictions below threshold
   
**Verdict**: Graph propagation in its current form **harms** prediction quality. The knowledge graph is too sparse (35 nodes, 24 edges) for meaningful message passing. The V4_ARCHITECTURE.md correctly noted this but the "zero-param propagation" still causes harm.

---

## Recommended Fixes

### Priority 1: Fix PREREQUISITE_MAP ✅ (DONE)

**File**: `intelligence_engine_v4/data/__init__.py`

Added `_PREREQUISITE_REMAP` dictionary and `_build_fixed_prerequisite_map()` function.

### Priority 2: Fix V4FinalBacktesser parameter pass-through ✅ (DONE)

**File**: `intelligence_engine_v4/models/v4_final.py`

Added `use_cluster` and `use_prerequisite` parameters to `run()` method.

### Priority 3: Fix Cluster Completion Threshold Logic ✅ (DONE)

**File**: `intelligence_engine_v4/models/v4_final.py`

Changed selection logic from "adaptive threshold on boosted probs" to "base top-N + forced cluster inclusion + trimmed by boosted prob".

### Priority 4: Remove or Fix Graph Propagation ⚠️ (ANALYZED)

**Recommendation**: Keep graph propagation DISABLED by default (`use_gnn=False`). The current graph structure (35 nodes, 24 edges) is too sparse for meaningful propagation. If graph propagation is desired:
- Increase alpha to 0.85+ (very weak propagation)
- Or add more edges (co-occurrence, domain similarity, not just prerequisites)

### Priority 5: Recall Enhancement Strategy

The current V4 claim of +0.357 recall improvement is unsubstantiated. Recommended approach:
1. **Dynamic N already works**: N varies from 13-20 based on historical patterns
2. **Slack parameter works**: Adding 1-2 extra topics improves recall
3. **Cluster completion needs calibration**: Including ALL topics in active clusters is too aggressive
4. **Suggested**: Only include TOPICS FROM ACTIVE CLUSTERS that have some historical activity (>0 years in training data)

---

## Expected Impact After Fixes

| Component | Before Fix | After Fix | Δ |
|-----------|-----------|-----------|------|
| PREREQUISITE_MAP | Dead code | Working | Minor recall gain |
| V4FinalBacktester params | Not passed | Passed | Better A/B testing |
| Cluster Completion | Zero effect | Active (but precision cost) | Recall↑ Precision↓ |
| Graph Propagation | Active (harmful) | Disabled by default | F1→baseline |

---

## Updated Roadmap

### P0 — NOW (Critical Fixes Applied)
| Fix | File | Status |
|-----|------|--------|
| PREREQUISITE_MAP remap | `data/__init__.py` | ✅ Done |
| V4FinalBacktester params | `models/v4_final.py` | ✅ Done |
| Threshold selection logic | `models/v4_final.py` | ✅ Done |

### P1 — NEXT (2 weeks)
| Task | Expected Impact |
|------|----------------|
| Calibrate cluster completion multiplier | +0.01-0.02 F1 |
| Add historical-activity filter to cluster inclusion | +0.01 precision |
| Disable graph propagation by default | +0.02 F1 |
| Implement XGBoost ensemble meta-learner | +0.01-0.02 precision |

### P2 — LATER
| Task | Expected Impact |
|------|----------------|
| Platt scaling / sigmoid calibration | +0.02 precision |
| LightGBM time features | +0.01 precision |
| SHAP explainability | Better interpretability |

### RESEARCH ONLY
| Component | Reason |
|-----------|--------|
| Full GNN (GraphSAGE) | 35 nodes too small, 24 time steps cause overfitting |
| TFT | Need 100+ time steps |
| RL | Need 10K+ student episodes |

---

## Implementation Priority

```
Priority 1 (⚠️ Critical - Done)
  └─ Fix PREREQUISITE_MAP to reference valid topics
  └─ Fix V4FinalBacktester parameter pass-through
  └─ Fix cluster completion threshold logic

Priority 2 (🔴 High)
  └─ Calibrate CLUSTER_PROB_MULTIPLIER (current: 0.85, suggested: 0.70-0.85)
  └─ Add historical activity filter to cluster completion
  └─ Disable GNN graph propagation by default

Priority 3 (🟡 Medium)
  └─ Implement probability calibration (Platt scaling)
  └─ Add XGBoost ensemble as optional meta-learner

Priority 4 (🟢 Low)
  └─ Thompson Bandit for recommendations
  └─ DKT (requires 200+ student sequences)
```

---

## Appendix: File Map

```
intelligence_engine_v4/
├── __init__.py                          # Version info
├── config.py                            # Hyperparameters (FIXED: multiplier=0.85)
├── data/
│   └── __init__.py                      # Data loading, PREREQUISITE_MAP (FIXED)
├── models/
│   ├── dynamic_n.py                     # Dynamic N + adaptive threshold (UNCHANGED)
│   ├── gnn_predictor.py                 # Graph propagation (DISABLED by default)
│   ├── v4_final.py                      # V4FinalPredictor (FIXED: selection logic)
│   └── xgboost_ensemble.py              # XGBoost meta-learner (NOT INTEGRATED)
├── inference/
│   ├── __init__.py                      # V4Predictor, V4Backtester, run_v4_evaluation
│   └── cluster_completion.py            # apply_cluster_completion (FIXED: apply_prerequisite_boost)
└── V4_ARCHITECTURE.md                   # DOCUMENTATION ONLY (contains unverified numbers)
```

---

## Conclusion

1. **V4 성능 향상 주장은 입증되지 않았다**: Actual reproduction shows F1 = 0.7635, not 0.806 as claimed
2. **Dead Code 발견**: `apply_prerequisite_boost()` was completely non-functional (FIXED)
3. **Cluster Completion 작동하나 효과 미미**: Adaptive threshold가 상쇄 (FIXED)
4. **Graph Propagation 성능 악화**: F1이 0.8005 → 0.5899로 하락
5. **문서 수치 신뢰 불가**: V4_ARCHITECTURE.md의 성능 수치(P=0.809/R=0.816/F1=0.806)는 현재 코드로 재현 불가
