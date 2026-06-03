# EJU Document Intelligence System — Final Architecture

> **Date:** 2026-06-04
> **Root cause:** 68% classifier_gap — this is a **semantic understanding problem**, not OCR.

## 1. System Overview

```
                                    ┌─────────────────────────┐
                                    │    OCR Text + Layout     │
                                    │    Metadata Input        │
                                    └────────┬────────────────┘
                                             │
                                             ▼
                              ┌────────────────────────────┐
                              │   Failure Routing System    │
                              │   (detect failure type)     │
                              └────┬────────┬────────┬─────┘
                                   │        │        │
                    ┌──────────────┘        │        └──────────────┐
                    ▼                       ▼                       ▼
         ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
         │ classifier_gap  │    │ seg_failure     │    │ ocr_noise       │
         │ → Semantic      │    │ → Structure     │    │ → Minimal       │
         │   Classifier    │    │   Repair        │    │   Re-OCR        │
         └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
                  │                      │                      │
                  ▼                      ▼                      ▼
         ┌──────────────────────────────────────────────────────────┐
         │              Confidence Scoring System                   │
         │  • classifier_confidence  • segmentation_confidence     │
         │  • ocr_confidence         • overall_confidence           │
         └──────────────────────────┬───────────────────────────────┘
                                    │
                                    ▼
                        ┌──────────────────────┐
                        │  Structured EJU      │
                        │  Dataset Output      │
                        └──────────────────────┘
```

## 2. Pipeline Components

### 2.1 Failure Routing System (NEW)

Located in `pipeline/failure_routing.py`. Detects failure type from incoming OCR data:

| Condition | Route | Target |
|-----------|-------|--------|
| text_len ≥ 20, ocr_conf ≥ 0.6 | `classifier_gap` | Semantic Classifier (2.2) |
| text_len < 20, ocr_conf ≥ 0.6 | `segmentation_failure` | Structure Repair (2.3) |
| ocr_conf < 0.6, text_len ≥ 10 | `ocr_noise` | Minimal Re-OCR (2.4) |
| has table/graph/diagram ref | `image_content` | Structure Repair (2.3) |

### 2.2 Hybrid Classification System (NEW)

Three-tier approach:

```
Tier 1: Rule-based (fast path)
  ├── Extended keyword lexicon (500+ domain-specific terms)
  ├── Pattern matching for domain-specific constructs
  └── Returns: domain + confidence (if ≥ 0.85)

Tier 2: Embedding-based (medium path)
  ├── TF-IDF vectorization of question text
  ├── Cosine similarity to domain exemplars
  ├── Context window: ±3 questions for domain hints
  └── Returns: domain + confidence (if ≥ 0.70)

Tier 3: LLM fallback (slow path)
  ├── Uses context window (question + choices + neighbors)
  ├── Structured prompt for domain classification
  └── Returns: domain + confidence (always)
```

### 2.3 Question Segmentation Engine (IMPROVED)

Key improvements over current implementation:

1. **Hierarchical boundary detection:**
   - Primary: `問N` / `第N問` markers
   - Secondary: `N.` / `(N)` numeric sequences
   - Tertiary: vertical whitespace + layout column detection

2. **Multi-question OCR fragment handling:**
   - Detect merged questions via multiple `問N` patterns in single block
   - Split at known boundaries, preserving context
   - Reconstruct fragmented questions across pages

3. **Layout-aware reconstruction:**
   - Column detection from bbox data
   - Reading order recovery (top-to-bottom, right-to-left for Japanese)
   - Answer choice association

### 2.4 Minimal OCR Fallback Layer (TRIMMED)

Only for the ~8% OCR-noise subset:

```
IF ocr_confidence < 0.6:
  tesseract --psm 4 --oem 1   # Alternative engine config
  IF still < 0.6:
    tesseract --psm 6 --oem 1  # Single uniform block
    IF still < 0.6:
      flag as image_review
```

## 3. Confidence Scoring System

Three independent scores, each 0.0–1.0:

### 3.1 classifier_confidence
- **Tier 1 (rule):** max(pattern_match_density, keyword_coverage)
- **Tier 2 (embedding):** cosine_similarity_to_best_domain
- **Tier 3 (LLM):** logit_confidence / self-reported_confidence
- Final: `max(tier_score * tier_multiplier)` where tier_multiplier = 0.9/0.8/0.7

### 3.2 segmentation_confidence
- `layout_coherence × boundary_clarity × completeness_ratio`
- layout_coherence: how well text aligns within detected boundaries
- boundary_clarity: confidence in question start detection
- completeness_ratio: estimated % of expected content present

### 3.3 ocr_confidence
- Already exists in system as `ocr_confidence`
- Calculated from Tesseract per-word confidence averages
- Threshold: ≥0.8 = good, ≥0.6 = fair, <0.6 = poor

### 3.4 overall_confidence
- `min(classifier_conf, segmentation_conf, ocr_conf)` for strict
- Or weighted: `0.4 × classifier + 0.3 × segmentation + 0.3 × ocr`

## 4. State Machine for Failure Recovery

```
                  ┌──────────┐
                  │  INPUT   │
                  └────┬─────┘
                       ▼
              ┌────────────────┐
              │ Route Failure  │
              └────┬──────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   ┌────────┐ ┌────────┐ ┌────────┐
   │Semantic│ │Struct  │ │Re-OCR  │
   │Classify│ │Repair  │ │(minimal)│
   └───┬────┘ └───┬────┘ └───┬────┘
       │          │          │
       ▼          ▼          ▼
   ┌─────────────────────────────┐
   │     Confidence Gate: ≥0.6?  │
   └──────┬──────────────┬───────┘
          │ YES          │ NO
          ▼              ▼
   ┌──────────┐   ┌──────────────┐
   │  OUTPUT  │   │ review_flag  │
   └──────────┘   └──────────────┘
```

## 5. Implementation Priority

| Priority | Component | Records affected | Effort |
|----------|-----------|-----------------|--------|
| **P0** | Hybrid Classifier (Tier 1 + 2) | 271 classifier_gap | 3 days |
| **P1** | Segmentation Engine | 84 seg_failure | 2 days |
| **P2** | Confidence Scoring + Failure Routing | All 386 | 1 day |
| **P3** | Minimal Re-OCR | 31 ocr_noise | 1 day |
| **P4** | LLM Fallback (Tier 3) | Remaining failures | 2 days |

**Target:** review_required: 386 → **<50**, classifier_gap: 271 → **near 0**

## 6. Data Flow (Detailed)

```
OCR Input → LayoutDetector → StructureReconstructor → KnowledgeExtractor → Validator → Output
                              │                        │
                              ▼                        ▼
                     Segmentation Engine         Hybrid Classifier
                     (boundary detection)        (3-tier system)
                              │                        │
                              ▼                        ▼
                     segmentation_confidence    classifier_confidence
                     → route failures           → route failures
```

## 7. Runtime Profile

- **Processing time per question:** ~50ms (Tier 1) / ~200ms (Tier 2) / ~2s (Tier 3)
- **Expected throughput:** ~500 questions/min with Tier 1+2
- **Memory:** ~200MB for TF-IDF vectors + exemplars
