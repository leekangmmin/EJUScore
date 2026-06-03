# EJU Domain Classifier Redesign — Semantic Classifier

> **Problem:** Keyword-based classifier fails on 271/386 (70%) review_required records.
> Clean, substantive text exists but domain keywords are missing from the lexicon.
> **Solution:** Replace single keyword classifier with 3-tier hybrid system.

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Hybrid Domain Classifier                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Tier 1: Rule-based (Extended Keyword + Pattern)             │
│  ├── 500+ domain-specific keyword lexicon                    │
│  ├── Domain-specific regex patterns                           │
│  ├── Japanese/Korean/English multilingual support             │
│  └── Returns: domain + confidence if ≥ 0.85                   │
│                                                              │
│  Tier 2: Embedding-based (TF-IDF + Cosine Similarity)         │
│  ├── Question text vectorization                              │
│  ├── Context window (±3 questions, answer choices)            │
│  ├── Multi-language embedding space                           │
│  └── Returns: domain + confidence if ≥ 0.70                   │
│                                                              │
│  Tier 3: LLM Fallback (Heuristic + LLM)                       │
│  ├── Context-aware prompt construction                        │
│  ├── Structured output parsing                                │
│  └── Returns: domain + confidence (always)                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 2. Extended Domain Ontology

### 2.1 Economy (経済)
- **Core concepts:** 需要/供給, GDP, 為替/円高/円安, 財政/税制, 金融/金利, 貿易/関税, 雇用/失業, 格差/所得分配, 経済成長/景気, インフレ/デフレ
- **Edge concepts (currently missing):** 桑畑/養蚕, 標準時/タイムゾーン, 島国経済, 特化/分業, 保護貿易/自由貿易, 産業連関, 経済圏/経済統合
- **New patterns:** `(桑|養蚕|生糸|繊維|紡績)`, `(標準時|時差|タイムゾーン|GMT|UTC)`, `(島国|資源|エネルギー自給)`

### 2.2 Politics (政治)
- **Core concepts:** 憲法, 三権分立, 選挙/政党, 国会/内閣, 国際法/国連, 地方自治, 司法/裁判
- **Edge concepts:** 参政権/外国人参政権, 条約/批准, 主権/領土, 政治思想/イデオロギー, 民主主義/独裁
- **New patterns:** `(投票|参政権|選挙権|被選挙権)`, `(条約|批准|署名|締結)`, `(主権|領土|国境|領海)`

### 2.3 History (歴史)
- **Core concepts:** 市民革命, 産業革命, 世界大戦, 冷戦, 明治維新, 植民地/帝国主義
- **Edge concepts:** 技術革新/産業革命の波, 桑畑/農業史, 流通革命, 戦後改革, 高度経済成長
- **New patterns:** `(技術革新|第[1-9]の技術革新|産業革命)`, `(戦後|復興|占領|連合国)`, `(農地改革|自作地|小作地)`

### 2.4 Geography (地理)
- **Core concepts:** 気候/ケッペン, 地形/プレート, 人口/都市, 資源/農業, 地図/GIS
- **Edge concepts:** 標準時/時差計算, 島国/国土, 排他的経済水域, 交通/物流, 貿易/港湾
- **New patterns:** `(標準時|時差|経度|緯度|グリニッジ|GMT)`, `(排他的経済水域|EEZ|領海)`, `(島嶼|島国|離島|半島)`

### 2.5 Society (社会)
- **Core concepts:** 環境問題, 社会保障, 少子高齢化, 情報化, ジェンダー, 多文化共生
- **Edge concepts:** 消費者問題, 労働/雇用形態, 教育, 都市問題/過疎, 国際化/グローバル化
- **New patterns:** `(消費者|消費生活|物価|インフレ)`, `(労働|雇用|働き方|賃金)`, `(教育|学校|学習|識字)`

## 3. Multilingual Support Strategy

EJU exams contain mixed Japanese (primary), English (terms), and Korean (Korean examinee notes):

### 3.1 Japanese Detection
- Unicode range: 0x3040–0x309F (Hiragana), 0x30A0–0x30FF (Katakana), 0x4E00–0x9FFF (Kanji)
- Primary domain detection language
- All keyword lexicons are Japanese-first

### 3.2 English Term Detection
- Domain-specific English terms mapped to Japanese equivalents
- Fallback: if Japanese keywords missing, check English terms
- English term mapping: `{"GDP": ["経済", "国民所得"], "UN": ["国連", "国際連合"], ...}`

### 3.3 Korean Handling
- Korean text presence check (0xAC00–0xD7AF)
- Korean terms extracted and mapped to domain via Japanese cognates
- Sino-Korean → Kanji mapping for domain detection

## 4. Context-Aware Classification

### 4.1 Context Window Construction

```
For each question Q_i:
  window = {
    'current': Q_i.text + Q_i.answer_choices,
    'previous': Q_{i-1}.text if exists,
    'next': Q_{i+1}.text if exists,
    'exam_metadata': {year, round, subject}
  }
```

### 4.2 Usage in Each Tier

**Tier 2 (Embedding):**
- Concatenate `previous + current + next` for vectorization
- Weight: current=0.6, previous=0.2, next=0.2
- Allows domain coherence across consecutive questions

**Tier 3 (LLM):**
- Prompt includes current question text + answer choices + adjacent context
- Structured output: `{"domain": "...", "confidence": 0.XX, "reasoning": "..."}`

## 5. Embedding Strategy (Tier 2)

### 5.1 Vectorization
- **Method:** TF-IDF with n-grams (unigrams + bigrams)
- **N-gram range:** (1, 3) for Japanese character sequences
- **Max features:** 10,000
- **Stop words:** Japanese common particles (は, が, を, に, の, の, へ, で, と, から, より)

### 5.2 Domain Exemplars
- Build from high-confidence existing classifications (n=454 valid domains)
- 5 domain clusters: economy (161), politics (112), history (72), geography (76), society (33)
- Centroids recomputed after each successful classification

### 5.3 Distance Metric
- Cosine similarity to domain centroids
- Softmax normalization to produce confidence scores
- Threshold: ≥0.70 for direct classification, else fall to Tier 3

## 6. LLM Fallback Strategy (Tier 3)

### 6.1 When to Use
- Tier 1 confidence < 0.85 AND Tier 2 confidence < 0.70
- Expected to handle ~5-10% of all classifications

### 6.2 Prompt Template

```
System: You are an EJU (Examination for Japanese University Admission) 
document classifier. Analyze the question text and classify it into 
exactly one of: economy, politics, history, geography, society.

Question: {question_text}
Answer Choices: {answer_choices}
Surrounding Context: {context}

Output JSON: {"domain": "economy|politics|history|geography|society", 
"confidence": 0.0-1.0, "reasoning": "brief explanation"}
```

### 6.3 Output Parsing
- Regex extraction of JSON from LLM response
- Fallback: keyword-based domain extraction from reasoning text
- Confidence calibration: if reasoning is contradictory, reduce confidence by 0.1

## 7. Implementation Plan

### 7.1 Files to Create

| File | Purpose |
|------|---------|
| `pipeline/semantic_classifier.py` | Hybrid classifier (Tier 1 + 2) |
| `pipeline/llm_classifier.py` | LLM fallback (Tier 3) |
| `pipeline/domain_lexicon.py` | Extended keyword lexicon |
| `pipeline/embedding_store.py` | TF-IDF vectors + exemplars |

### 7.2 Files to Modify

| File | Change |
|------|--------|
| `pipeline/knowledge_extraction.py` | Replace `classify_comprehensive_domain()` with new hybrid |
| `pipeline/pipeline_config.py` | Add classifier thresholds |

### 7.3 Tests to Add

- `tests/test_semantic_classifier.py`
- Tests for each Tier with known domain questions
- Tests for context-window enhancement
- Tests for multilingual detection (JP/EN/KR)

## 8. Expected Impact

| Metric | Before | Target After |
|--------|--------|-------------|
| classifier_gap | 271 | <20 |
| domain coverage | 54.05% | >90% |
| classification accuracy | ~70% (keyword limited) | >92% |
| review_required (total) | 386 | <50 |
