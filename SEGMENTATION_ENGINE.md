# EJU Question Segmentation Engine

> **Problem:** 84/386 (22%) review_required records are segmentation failures — 
> header/footer fragments, merged questions, or broken OCR lines.
> **Solution:** Hierarchical boundary detection + layout-aware reconstruction.

## 1. Architecture

```
┌────────────────────────────────────────────────────────────┐
│                 Question Segmentation Engine                 │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Stage 1: Raw Text Ingestion                                 │
│  ├── Accept OCR text + layout blocks + bbox data             │
│  ├── Preserve line-level metadata (position, confidence)     │
│  └── Normalize whitespace and fix broken lines               │
│                                                             │
│  Stage 2: Boundary Detection                                 │
│  ├── Primary: `問N` / `第N問` markers                        │
│  ├── Secondary: `N.` numeric sequences with validation       │
│  ├── Tertiary: Layout column breaks + whitespace gaps        │
│  └── Confidence scoring per boundary                         │
│                                                             │
│  Stage 3: Fragment Grouping                                  │
│  ├── Detect header/footer fragments (平成N年, - N -)        │
│  ├── Re-attach fragments to parent questions                 │
│  └── Merge split questions across boundaries                 │
│                                                             │
│  Stage 4: Layout-Aware Reconstruction                        │
│  ├── Column detection from bbox positions                    │
│  ├── Reading order: RTL for Japanese multi-column            │
│  ├── Answer choice association                               │
│  └── Visual element mapping (table/graph to question)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 2. Boundary Detection Algorithm

### 2.1 Primary: Question Markers (問)

```
Regex patterns (in priority order):
1. r'^問\s*(\d+)'            → "問1", "問 12"
2. r'^第\s*(\d+)\s*問'       → "第1問", "第 12 問"
3. r'^[問第]\s*(\d+)\s*[問題]?' 

Validation:
- Number must be 1 ≤ N ≤ 50 (EJU range)
- Must not be inside an answer choice section
- Must appear at start of line or after clear boundary
```

**Confidence scoring:**
- `conf = 1.0` if exact match with `問N` pattern at line start
- `conf = 0.9` if "第N問" pattern
- `conf = 0.8` if number followed by period/dot but no `問` prefix
- `conf = 0.6` if pattern found mid-line (possible OCR glitch)

### 2.2 Secondary: Numeric Markers

```
Regex: r'(?:^|\s)(\d{1,2})\s*[\.\s\)）]'

Heuristics:
- Only accept 1-50
- Must form increasing sequence (within ±1 tolerance for gaps)
- Reject if number appears in what looks like a table cell
```

### 2.3 Tertiary: Layout-Based

When no explicit markers found:

1. **Column detection:** Analyze x-coordinates of text blocks
   - Cluster blocks by x-position (within 20px tolerance)
   - Each cluster = potential column
   - Sort columns: right-to-left (Japanese) or left-to-right

2. **Whitespace gap detection:**
   - Measure vertical gaps between blocks
   - Gap > 2× median line height → potential boundary
   - Gap > 5× median line height → strong boundary

3. **Answer choice separation:**
   - Circle markers (①②③④) or parentheses choices
   - Format marker: 選択肢, 解答群, 下の
   - These delineate question body from answer options

## 3. Fragment Handling

### 3.1 Header/Footer Detection

Known fragment patterns:

| Pattern | Example | Action |
|---------|---------|--------|
| `平成N年|令和N年` | "平成14年度" | Remove or attach to first question |
| `- N -` | "- 1 -" | Remove (page number) |
| `総合科目一N` | "総合科目一10" | Attach to next question |
| `試験` | "試験fA) ee" | Remove (instruction noise) |
| `[①②③④⑤]つ選びなさい` | "1つ選びなさい" | Attach to previous question |

### 3.2 Merged Question Splitting

When a single OCR block contains multiple question markers:

```
Input: "問3 次の文章中の空欄 (a) 一(c ) ... 問4 次のグラフを見て..."
Output: [
  {question: 3, text: "問3 次の文章中の空欄 (a) 一(c ) ..."},
  {question: 4, text: "問4 次のグラフを見て..."}
]
```

Algorithm:
1. Split text at each `問N` / `第N問` marker
2. Verify each fragment is ≥ 10 chars (minimum question content)
3. If fragment < 10 chars, merge with adjacent fragment
4. Re-number if gaps detected

### 3.3 Fragmented Question Reconstruction

When a question spans multiple OCR blocks/pages:

```
Block 1: "問12 次の文章と図を見て，(1)，(2) に答えなさい。日本は細長い島国である。"
Block 2: "その島々は北東から南西に向かって細長く延びるように分布している。"
→ Reconstruct: "問12 次の文章と図を見て，(1)，(2) に答えなさい。日本は細長い島国である。その島々は..."
```

Detection:
- Block starts mid-sentence (no question marker, lowercase start)
- Block is continuation of previous question's sub-parts
- Block is within same layout column

## 4. Multi-Column PDF Handling

### 4.1 Column Detection

```
1. Collect all block x-coordinates
2. Cluster using DBSCAN (eps=50px)
3. Sort clusters left-to-right or right-to-left
4. For Japanese documents, default: top-to-bottom, right-to-left
```

### 4.2 Reading Order

Rules for column ordering:
1. **Right-to-left (tategaki vertical):** 
   - Japanese text with vertical glyphs
   - Right column contains earlier content
2. **Left-to-right (yokogaki horizontal):**
   - Modern EJU format with horizontal text
   - Left column contains earlier content
3. **Mixed:** Detect from first column's first block content

### 4.3 Cross-Column Question Detection

If same question number appears in multiple columns:
- Merge text in reading order
- Remove duplicate header text
- Combine answer choices from both columns

## 5. Broken Line Recovery

### 5.1 Line Continuation Detection

A line is likely broken if:
- Line ends with particle (は, が, を, に, の) or conjunction (そして, しかし)
- Next line starts with lowercase or continuation (その, この, これらの)
- Combined line length < 200 chars (reasonable for EJU)

### 5.2 Whitespace Normalization

```
Before: "問 3 次の文章中の空欄 (a) 一(c ) に当てはまる語句の組み合わせとして正しいもの
         を、下の"
After:  "問3 次の文章中の空欄 (a)一(c)に当てはまる語句の組み合わせとして正しいものを、下の"
```

## 6. Implementation

### 6.1 New File: `pipeline/segmentation_engine.py`

```python
class SegmentationEngine:
    def detect_boundaries(self, ocr_text, layout_blocks) -> List[Boundary]
    def extract_questions(self, boundaries, raw_lines) -> List[Question]
    def repair_fragments(self, questions) -> List[Question]
    def detect_columns(self, blocks) -> List[Column]
    def resolve_reading_order(self, columns) -> List[int]
```

### 6.2 Modified File: `pipeline/structure_reconstruction.py`

Replace `_find_question_starts()` and `_merge_fragments()` with calls to `SegmentationEngine`.

### 6.3 Data Structures

```python
@dataclass
class Boundary:
    line_index: int
    type: Literal['primary', 'secondary', 'tertiary']
    confidence: float
    question_number: Optional[int]

@dataclass 
class Question:
    number: int
    text: str
    answer_choices: List[str]
    lines: List[Dict]
    confidence: float
    has_visual_element: bool
```

## 7. Edge Cases

| Case | Strategy |
|------|----------|
| `問` without number (OCR missed digit) | Search ±5 chars for number; if not found, assign next sequential |
| No markers at all | Layout-based splitting by content density + whitespace |
| Page break mid-question | Preserve question ID, merge text from both pages |
| Answer choices mixed with next question | Search for choice markers (①②③), use as split point |
| Multiple sub-questions (1)(2)(3) | Keep as single question, add sub_questions field |
| Vertical Japanese text | Rotate and process as horizontal; detect via glyph orientation |

## 8. Expected Impact

| Metric | Before | Target After |
|--------|--------|-------------|
| seg_failure | 84 | <15 |
| Fragment rate | ~22% | <5% |
| Correct boundary detection | ~78% | >95% |
| Cross-page reconstruction | None | Full support |
