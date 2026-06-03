# REOCR Pipeline Design — EJU Exam PDF Multi-Engine Recovery

> **Version:** 1.0.0  
> **Date:** 2026-06-04  
> **Target:** Recovery of 386 `review_required` records from comprehensive subject dataset  
> **Design Principle:** Route each document/page through the optimal OCR engine based on layout classification

---

## Architecture Overview

```
                    ┌─────────────────────────────┐
                    │     PDF Input (EJU Exam)     │
                    └────────────┬────────────────┘
                                 │
                    ┌────────────▼────────────────┐
                    │  Stage 1: Document           │
                    │  Classification              │
                    │  (Layout + Content Type)     │
                    └────────────┬────────────────┘
                                 │
                    ┌────────────▼────────────────┐
                    │  Stage 2: OCR Engine         │
                    │  Routing                     │
                    └────────────┬────────────────┘
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ Text     │ │ Formula  │ │ Table    │
              │ Regions  │ │ Regions  │ │ Regions  │
              └────┬─────┘ └────┬─────┘ └────┬─────┘
                   │            │            │
              ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐
              │ Stage 3  │ │ Stage 3  │ │ Stage 4  │
              │ Primary  │ │ Formula  │ │ Table    │
              │ OCR      │ │ Extract  │ │ Extract  │
              └────┬─────┘ └────┬─────┘ └────┬─────┘
                   │            │            │
                   └────────────┴────────────┘
                                 │
                    ┌────────────▼────────────────┐
                    │  Stage 5: Question           │
                    │  Reconstruction              │
                    │  (Structure + Knowledge)     │
                    └────────────┬────────────────┘
                                 │
                    ┌────────────▼────────────────┐
                    │  Stage 6: Confidence         │
                    │  Scoring                     │
                    │  (Multi-Engine Voting)       │
                    └────────────┬────────────────┘
                                 │
                    ┌────────────▼────────────────┐
                    │     Structured JSON Output   │
                    └─────────────────────────────┘
```

---

## Stage 1: Document Classification

### Purpose
Classify each PDF page into a document type to determine optimal processing strategy.

### Input
- Raw PDF page image (PIL.Image, 200–300 DPI)
- Page metadata: year, round, subject

### Classification Categories

| Category | Description | EJU Examples | Handling Strategy |
|----------|-------------|-------------|-------------------|
| `text_dominant` | Mostly Japanese/English text, few visual elements | Question text pages, reading passages | PaddleOCR Japanese |
| `formula_dominant` | Dense math formulas, equations, symbols | Mathematics course questions | Nougat + Pix2Tex |
| `table_dominant` | Structured tabular data, statistical tables | Economic data tables, demographic tables | PaddleOCR TableStructureRec |
| `chart_dominant` | Graphs, charts, plots with labels | Supply-demand curves, bar/line charts | Crop + PaddleOCR labels |
| `mixed_layout` | Multi-column text + tables + diagrams | Comprehensive subject pages with graphs | Surya (reading order) |
| `map_dominant` | Geographic maps with labels | World maps, climate zone maps | Crop + PaddleOCR Japanese |
| `instruction_only` | Test instructions, headers, answer sheets | "注意事項", "マークシート記入例" | Minimal processing, filter |
| `answer_key` | Answer key pages (separate PDF) | Correct answer tables | Dedicated answer key OCR |

### Classification Method

**Primary:** PaddleOCR Layout Model (`layout_mllm`) — detects regions:
- `text`, `title`, `figure`, `table`, `figure_caption`, `table_caption`, `header`, `footer`, `page_number`, `reference`, `equation`

**Fallback:** Surya Layout Analyzer — detects:
- `TextBlock`, `TitleBlock`, `TableBlock`, `FigureBlock`, `MathBlock`, `ListBlock`, `CaptionBlock`, `HeaderBlock`, `FooterBlock`

**Decision Logic:**
```python
def classify_page(layout_regions):
    area_scores = {cat: 0 for cat in ALL_CATEGORIES}
    
    for region in layout_regions:
        area = region_bbox_area(region)
        
        if region.type in ('equation', 'formula', 'MathBlock'):
            area_scores['formula_dominant'] += area
        elif region.type in ('table', 'TableBlock'):
            area_scores['table_dominant'] += area
        elif region.type in ('figure', 'FigureBlock'):
            if has_axes(region):  # has coordinate axes
                area_scores['chart_dominant'] += area
            elif has_map_features(region):  # geographic shapes
                area_scores['map_dominant'] += area
            else:
                area_scores['mixed_layout'] += area
        elif region.type in ('text', 'TextBlock'):
            area_scores['text_dominant'] += area
        elif region.type in ('header', 'footer', 'page_number'):
            area_scores['instruction_only'] += area
    
    # Multi-column detection
    if count_columns(layout_regions) > 1:
        area_scores['mixed_layout'] *= 1.5  # Boost for multi-column
    
    return max(area_scores, key=area_scores.get)
```

### Expected Classification Accuracy
| Current (Tesseract PSM4) | Target (Layout Model) |
|:------------------------:|:---------------------:|
| ~40% (text vs table vs graph) | **~92%** (all 8 categories) |

### Stage 1 Output
```json
{
  "page_classification": {
    "category": "mixed_layout",
    "confidence": 0.87,
    "regions": [
      {"type": "text", "bbox": [100, 50, 500, 300], "confidence": 0.95},
      {"type": "table", "bbox": [100, 320, 500, 600], "confidence": 0.88},
      {"type": "figure", "bbox": [520, 50, 800, 400], "confidence": 0.76}
    ],
    "column_count": 2,
    "has_formula": false,
    "has_table": true,
    "has_chart": true
  }
}
```

---

## Stage 2: OCR Engine Routing

### Purpose
Route each detected region to the optimal OCR engine based on region type and content characteristics.

### Routing Table

| Region Type | Primary Engine | Fallback Engine | Configuration |
|-------------|---------------|-----------------|---------------|
| `text` (Japanese dominant) | **PaddleOCR** (japan model) | Tesseract (jpn+eng, PSM 6) | `lang='japan'`, `det_db_thresh=0.3` |
| `text` (English dominant) | **PaddleOCR** (en model) | Tesseract (eng, PSM 6) | `lang='en'` |
| `title` / `header` | **PaddleOCR** (japan) | Surya | High resolution crop |
| `equation` / `formula` | **Pix2Tex** (LaTeX-OCR) | Nougat | 300 DPI crop, no rotation |
| `table` | **PaddleOCR TableStructureRec** | Custom column projection | `table_algorithm='TableMaster'` |
| `figure` / `chart` | **Crop + PaddleOCR** (labels only) | — | Axis label extraction, not chart understanding |
| `map` | **Crop + PaddleOCR** | — | Extract place names only |
| `page_number` / `footer` | **Skip or minimal** | — | Extract number only |
| `instruction_only` | **Skip** (register as metadata) | — | Record as header/footer |

### Engine Selection Logic

```python
def route_region(region, page_classification):
    """Select OCR engine for a detected region."""
    
    # Region type routing
    if region.type in ('equation', 'formula', 'MathBlock'):
        return {
            'engine': 'pix2tex',
            'fallback': 'nougat',
            'config': {'dpi': 300, 'crop_padding': 10},
            'post_process': 'latex_normalize'
        }
    
    if region.type in ('table', 'TableBlock'):
        return {
            'engine': 'paddleocr_table',
            'fallback': 'custom_column_projection',
            'config': {'algorithm': 'TableMaster'},
            'post_process': 'table_to_markdown'
        }
    
    # Text routing based on language detection
    if region.type in ('text', 'TextBlock'):
        lang_composition = detect_language_composition(region)
        if lang_composition['japanese_ratio'] > 0.4:
            return {
                'engine': 'paddleocr',
                'fallback': 'tesseract',
                'config': {'lang': 'japan', 'det_db_thresh': 0.3},
                'post_process': 'japanese_normalize'
            }
        else:
            return {
                'engine': 'paddleocr',
                'fallback': 'tesseract',
                'config': {'lang': 'en'},
                'post_process': 'english_normalize'
            }
    
    # Figure/map routing
    if region.type in ('figure', 'FigureBlock'):
        if has_chart_features(region):
            return {
                'engine': 'crop_paddleocr',
                'config': {'extract': 'axis_labels_only'},
                'post_process': 'chart_label_extract'
            }
        elif has_map_features(region):
            return {
                'engine': 'crop_paddleocr',
                'config': {'lang': 'japan'},
                'post_process': 'location_name_extract'
            }
    
    # Default fallback
    return {
        'engine': 'paddleocr',
        'fallback': 'tesseract',
        'config': {'lang': 'japan'},
        'post_process': 'japanese_normalize'
    }
```

### Multi-Engine Voting (Confidence >0.8 Required)

For any region where the primary engine returns confidence < 0.6, run the fallback engine and compare:

```python
def merge_engine_results(primary_result, fallback_result, region_type):
    """Merge multi-engine results with confidence-weighted voting."""
    if fallback_result is None:
        return primary_result
    
    primary_conf = primary_result.get('confidence', 0)
    fallback_conf = fallback_result.get('confidence', 0)
    
    # High confidence from either engine → accept it
    if primary_conf >= 0.8:
        return primary_result
    if fallback_conf >= 0.8:
        return fallback_result
    
    # Both medium confidence → character-level voting
    if primary_conf >= 0.4 and fallback_conf >= 0.4:
        merged_text = char_level_vote(
            primary_result['text'],
            fallback_result['text'],
            primary_conf / (primary_conf + fallback_conf)
        )
        return {
            'text': merged_text,
            'confidence': max(primary_conf, fallback_conf),
            'engine': 'voted',
            'source_engines': [primary_result.get('engine'), fallback_result.get('engine')],
        }
    
    # Low confidence from both → return best and mark as low_confidence
    best = primary_result if primary_conf >= fallback_conf else fallback_result
    best['low_confidence_warning'] = True
    return best
```

### Stage 2 Output
```json
{
  "region_ocr_results": {
    "text_region_1": {
      "engine": "paddleocr",
      "text": "次のグラフは日本の人口推移を示している。",
      "confidence": 0.94,
      "language": "japanese"
    },
    "table_region_2": {
      "engine": "paddleocr_table",
      "table_markdown": "| 年 | 人口(万人) |\n|----|----------|\n| 1950 | 8,320 |\n| 2000 | 12,693 |",
      "table_html": "<table>...</table>",
      "confidence": 0.87
    },
    "chart_region_3": {
      "engine": "crop_paddleocr",
      "axis_labels": {"x": ["1950", "1970", "1990", "2010"], "y": ["0", "5000", "10000", "15000"]},
      "title": "日本の人口推移",
      "confidence": 0.72
    }
  }
}
```

---

## Stage 3: Formula Extraction

### Purpose
Extract mathematical formulas from detected `equation`/`formula` regions, producing LaTeX and plain-text representations.

### Sub-Stages

#### 3.1 Formula Region Detection
- Use layout model to identify formula regions (contiguous math blocks)
- Expand bounding box by 10px padding to capture all symbols
- Classify as: `inline_formula`, `display_formula`, `matrix`, `integration`, `fraction`

#### 3.2 Primary Formula OCR: Pix2Tex

**Architecture:** ViT encoder + Transformer decoder (image → LaTeX sequence)

**Configuration:**
```python
pix2tex_config = {
    'model': 'pix2tex_resources/weights.pth',
    'device': 'cuda' if torch.cuda.is_available() else 'cpu',
    'temperature': 0.1,  # Low temperature for deterministic output
    'max_length': 512,
    'beam_size': 5,
}
```

**Post-processing:**
- Validate LaTeX syntax (balanced braces, valid commands)
- Convert common EJU formula patterns:
  - `\sqrt{x}` → `√(x)`
  - `\frac{a}{b}` → `a/b`
  - `\int_{a}^{b}` → `∫[a→b]`
  - `\sum_{i=1}^{n}` → `∑[i=1→n]`
- Generate both LaTeX and plain-text representations

#### 3.3 Fallback: Nougat (for complex formulas)

If Pix2Tex confidence < 0.5 or formula contains >10 symbols:
- Route to Nougat (better at complex matrices, multi-line equations)
- Takes ~15s per formula but handles edge cases

#### 3.4 Formula-to-Text Bridge

For each formula, produce three representations:
```json
{
  "formula": {
    "latex": "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
    "plain_text": "(-b ± √(b² - 4ac)) / 2a",
    "spoken": "minus b plus minus square root of b squared minus 4ac divided by 2a",
    "confidence": 0.92,
    "engine": "pix2tex"
  }
}
```

### Recovery Impact

| Metric | Current | Expected |
|--------|:-------:|:--------:|
| Formula detection rate | ~3% | **~85%** |
| LaTeX correctness | N/A | **~80%** |
| Math question domain classification | ~40% | **~90%** |
| Math answer choice extraction | ~15% | **~85%** |

---

## Stage 4: Table Extraction

### Purpose
Extract structured tabular data from detected `table` regions, preserving cell structure, headers, and numeric alignment.

### Sub-Stages

#### 4.1 Table Region Preprocessing
- Crop table region from page image
- Apply adaptive thresholding (Otsu's method) if scan quality is low
- Deskew if table lines are rotated (>2 degrees)
- Split into: `has_borders` (explicit grid lines) vs `borderless` (aligned text only)

#### 4.2 Primary: PaddleOCR TableStructureRec

**Architecture:** TableMaster — detects:
- Table boundaries
- Row and column separators
- Cell content regions
- Cell spanning (colspan/rowspan)

**Configuration:**
```python
table_config = {
    'algorithm': 'TableMaster',
    'max_col_count': 10,
    'max_row_count': 30,
    'merge_threshold': 0.3,  # Merge adjacent cells with same content
    'ocr_engine': 'paddleocr',
    'ocr_lang': 'japan',
}
```

#### 4.3 Fallback: Custom Column Projection

For borderless tables or when TableMaster fails:
```python
def extract_borderless_table(cropped_image):
    # 1. Horizontal projection to find row boundaries
    h_proj = horizontal_projection(cropped_image)
    row_boundaries = find_gaps_in_projection(h_proj, min_gap=5)
    
    # 2. For each row, vertical projection to find column boundaries
    rows = []
    for y0, y1 in row_boundaries:
        row_image = cropped_image[y0:y1]
        v_proj = vertical_projection(row_image)
        col_boundaries = find_gaps_in_projection(v_proj, min_gap=10)
        
        # 3. OCR each cell with PaddleOCR
        cells = []
        for x0, x1 in col_boundaries:
            cell_image = row_image[:, x0:x1]
            cell_text = paddleocr_region(cell_image)
            cells.append(cell_text)
        rows.append(cells)
    
    # 4. Align columns across rows
    return align_table_structure(rows)
```

#### 4.4 Table Output Format

```json
{
  "table": {
    "markdown": "| 年 | GDP(億円) | 成長率 |\n|----|----------|-------|\n| 2000 | 5,340,000 | 2.8% |\n| 2005 | 5,570,000 | 1.6% |",
    "html": "<table><tr><th>年</th><th>GDP(億円)</th><th>成長率</th></tr><tr><td>2000</td><td>5,340,000</td><td>2.8%</td></tr></table>",
    "json_data": [
      {"年": "2000", "GDP(億円)": 5340000, "成長率": 2.8},
      {"年": "2005", "GDP(億円)": 5570000, "成長率": 1.6}
    ],
    "rows": 2,
    "columns": 3,
    "confidence": 0.88,
    "engine": "paddleocr_table"
  }
}
```

### Recovery Impact

| Metric | Current | Expected |
|--------|:-------:|:--------:|
| Table-structured extraction | 0% (raw text only) | **~80%** |
| Numeric data extraction | 0% | **~75%** |
| Table-containing question classification | ~40% | **~90%** |

---

## Stage 5: Question Reconstruction

### Purpose
Reconstruct structured question objects from multi-engine OCR output, handling EJU-specific numbering, sub-question structure, and element association.

### Sub-Stages

#### 5.1 Text Assembly in Reading Order

Use layout model's reading-order metadata to assemble OCR text in correct sequence:

```python
def assemble_reading_order(regions, page_width):
    """Reconstruct reading order from layout regions."""
    # Sort by reading order if available (layout model provides order ID)
    if all(r.get('reading_order') is not None for r in regions):
        regions.sort(key=lambda r: r['reading_order'])
    else:
        # Fallback: sort by (column, y_position)
        columns = cluster_by_x_position(regions, page_width)
        left_col = [r for r in columns[0]] if len(columns) > 0 else []
        right_col = [r for r in columns[1]] if len(columns) > 1 else []
        left_col.sort(key=lambda r: r['bbox']['y0'])
        right_col.sort(key=lambda r: r['bbox']['y0'])
        regions = left_col + right_col
    
    return regions
```

#### 5.2 Enhanced Question Number Detection

Replace the current `re.compile(r'^[問第]\s*(\d+)\s*[問題]?')` with:

```python
def detect_question_numbers(text_lines, page_regions, year_context):
    """Detect and validate question numbers."""
    candidates = []
    
    # Pattern 1: 問N, 第N問
    for m in re.finditer(r'(?:問|第)\s*(\d+)\s*(?:問|問題)?', text):
        candidates.append({
            'number': int(m.group(1)),
            'position': m.start(),
            'method': 'formal_question_marker'
        })
    
    # Pattern 2: N. or N) at line start (numeric)
    for m in re.finditer(r'^(\d+)\s*[\.\s\)）]\s', text, re.MULTILINE):
        n = int(m.group(1))
        if 1 <= n <= 50:
            candidates.append({
                'number': n,
                'position': m.start(),
                'method': 'numeric_start'
            })
    
    # Pattern 3: Layout-based (region starts near page top, large font)
    for region in page_regions:
        if region.get('type') == 'question_number':
            n = extract_number_from_region(region)
            if n and 1 <= n <= 50:
                candidates.append({
                    'number': n,
                    'position': region['bbox']['y0'],
                    'method': 'layout_detection',
                    'confidence': region.get('confidence', 0.7)
                })
    
    # Validate with per-exam continuity
    expected_range = get_expected_question_count(year_context)
    validated = validate_question_sequence(candidates, expected_range)
    
    return validated
```

#### 5.3 Sub-Question Structure

Replace flat question structure with hierarchical:

```python
def build_question_hierarchy(questions_with_subq):
    """Build 問N → (1)(2)(3) → ①~④ hierarchy."""
    hierarchy = {}
    
    for q in questions_with_subq:
        text = q['text']
        
        # Find parent question (問N)
        parent_match = re.search(r'問\s*(\d+)', text)
        parent_num = int(parent_match.group(1)) if parent_match else q.get('number', 1)
        
        # Find sub-questions (1), (2), (3)
        sub_matches = list(re.finditer(r'\((\d+)\)\s*', text))
        
        if parent_num not in hierarchy:
            hierarchy[parent_num] = {
                'number': parent_num,
                'text': '',
                'sub_questions': [],
                'tables': [],
                'graphs': [],
                'maps': []
            }
        
        if sub_matches:
            for m in sub_matches:
                sub_num = int(m.group(1))
                # Extract text until next sub-question or end
                sub_end = sub_matches[sub_matches.index(m) + 1].start() \
                    if sub_matches.index(m) + 1 < len(sub_matches) else len(text)
                sub_text = text[m.end():sub_end].strip()
                
                # Extract choices for this sub-question
                choices = extract_choices(sub_text)
                
                hierarchy[parent_num]['sub_questions'].append({
                    'sub_number': sub_num,
                    'text': clean_text(sub_text),
                    'answer_choices': choices,
                    'answer_choice_count': len(choices),
                })
        else:
            # No sub-questions detected, treat as main question
            choices = extract_choices(text)
            hierarchy[parent_num]['text'] = clean_text(text)
            hierarchy[parent_num]['answer_choices'] = choices
            hierarchy[parent_num]['answer_choice_count'] = len(choices)
    
    return list(hierarchy.values())
```

#### 5.4 Element Association

Associate tables, charts, and maps with their nearest question based on spatial proximity:

```python
def associate_elements(questions, tables, charts, maps, page_height):
    """Spatially associate visual elements with questions."""
    for q in questions:
        q_bbox = estimate_question_bbox(q)
        q_center_y = (q_bbox['y0'] + q_bbox['y1']) / 2
        
        # Find nearest elements below the question
        for elem_list, elem_type in [
            (tables, 'tables'), (charts, 'graphs'), (maps, 'maps')
        ]:
            nearest = None
            min_dist = float('inf')
            for elem in elem_list:
                elem_center_y = (elem['bbox']['y0'] + elem['bbox']['y1']) / 2
                dist = elem_center_y - q_center_y
                if 0 < dist < min_dist and dist < page_height * 0.4:
                    min_dist = dist
                    nearest = elem
            
            if nearest:
                if elem_type not in q:
                    q[elem_type] = []
                q[elem_type].append(nearest)
    
    return questions
```

### Recovery Impact

| Metric | Current | Expected |
|--------|:-------:|:--------:|
| Correct question numbering | ~35% | **~88%** |
| Sub-question hierarchy | ~5% | **~75%** |
| Element association (table→question) | 0% | **~80%** |
| Instruction/noise filtering | ~65% | **~95%** |

---

## Stage 6: Confidence Scoring

### Purpose
Assign per-question confidence scores based on multi-engine consistency, structural completeness, and domain classifier certainty.

### Multi-Dimensional Confidence Model

```python
def compute_question_confidence(question, original_ocr, reocr_result, engine_votes):
    """
    Compute aggregate confidence from 6 dimensions.
    Returns score 0.0–1.0 and breakdown.
    """
    
    # Dimension 1: OCR Character Confidence (0.0–1.0, weight 0.25)
    ocr_scores = []
    for region_result in reocr_result.get('regions', []):
        ocr_scores.append(region_result.get('confidence', 0))
    char_conf = np.mean(ocr_scores) if ocr_scores else 0.0
    
    # Dimension 2: Multi-Engine Agreement (0.0–1.0, weight 0.15)
    if len(engine_votes) >= 2:
        # Compare text outputs from different engines
        agreement = compare_text_similarity(engine_votes[0]['text'], engine_votes[1]['text'])
    else:
        agreement = 0.5  # Neutral if only one engine
    
    # Dimension 3: Structural Completeness (0.0–1.0, weight 0.25)
    structure_score = compute_structure_completeness(question)
    # Has valid number: +0.3, has answer choices: +0.3, has domain: +0.2
    # Has proper sub-question structure: +0.1, has visual elements associated: +0.1
    
    # Dimension 4: Language Coherence (0.0–1.0, weight 0.10)
    lang_score = compute_language_coherence(question.get('text', ''))
    # Japanese/English ratio in expected range, low garbage ratio
    
    # Dimension 5: Domain Classifier Certainty (0.0–1.0, weight 0.15)
    domain_evidence = question.get('_domain_classifier', {}).get('evidence_score', 0)
    
    # Dimension 6: Text Length Adequacy (0.0–1.0, weight 0.10)
    text = question.get('text', '')
    if len(text) > 200:
        length_score = 1.0
    elif len(text) > 100:
        length_score = 0.8
    elif len(text) > 50:
        length_score = 0.5
    elif len(text) > 20:
        length_score = 0.3
    else:
        length_score = 0.0
    
    # Aggregated confidence
    weights = {'char': 0.25, 'agreement': 0.15, 'structure': 0.25, 
               'language': 0.10, 'domain': 0.15, 'length': 0.10}
    
    total_conf = (
        weights['char'] * char_conf +
        weights['agreement'] * agreement +
        weights['structure'] * structure_score +
        weights['language'] * lang_score +
        weights['domain'] * domain_evidence +
        weights['length'] * length_score
    )
    
    return {
        'confidence': round(min(1.0, total_conf), 4),
        'breakdown': {
            'char_confidence': round(char_conf, 4),
            'engine_agreement': round(agreement, 4),
            'structure_completeness': round(structure_score, 4),
            'language_coherence': round(lang_score, 4),
            'domain_evidence': round(domain_evidence, 4),
            'text_length_adequacy': round(length_score, 4),
        },
        'decision': 'accept' if total_conf >= 0.7 else 'review_required'
    }
```

### Confidence Thresholds

| Score Range | Decision | Action | Count Expected (of 386 unknowns) |
|:-----------:|:--------:|--------|:--------------------------------:|
| 0.90–1.00 | **Auto-accept** | Direct integration into dataset | ~80 (21%) |
| 0.70–0.89 | **Accept with flag** | Included, marked as `auto_recovered` | ~206 (53%) |
| 0.50–0.69 | **Manual review suggested** | Queued for human verification | ~60 (16%) |
| < 0.50 | **Reject** | Returned to low-confidence pool | ~40 (10%) |

### Expected Domain Classification Improvement

After 6-stage pipeline, domain coverage of the original 386 unknowns:

| Domain | Current (of 386) | Expected Newly Classified | Total Expected |
|--------|:----------------:|:------------------------:|:--------------:|
| economy | 0 | ~98 | ~98 |
| politics | 0 | ~72 | ~72 |
| history | 0 | ~65 | ~65 |
| geography | 0 | ~54 | ~54 |
| society | 0 | ~45 | ~45 |
| Still `review_required` | 386 | — | **~52** (13.5%) |

**Domain classification improvement: 53% → 93.5%** (334 of 386 unknowns recovered)

---

## Summary: Recovery Estimates

| Dimension | Current | After 6-Stage Pipeline | Improvement |
|-----------|:-------:|:---------------------:|:-----------:|
| **Question Separation Accuracy** | 32.8% | **80–88%** | +47–55pp |
| **Domain Classification Rate** | 53.0% | **93.5%** | +40.5pp |
| **Answer Choice Extraction** | 15.0% (full) | **85–90%** | +70–75pp |
| **Formula Detection (Math)** | 3.0% | **80–85%** | +77–82pp |
| **Table Structured Extraction** | 0.0% | **75–80%** | +75–80pp |
| **Multi-Column Correct Order** | ~50% | **90–95%** | +40–45pp |
| **Overall System Score** | 75.6/100 | **88–93/100** | +12–17pp |
| **Unknown Questions Recovered** | 0/386 (0%) | **334/386 (86.5%)** | +86.5pp |

---

## Implementation Phasing

### Phase 1 (Week 1–2): Foundation
1. Integrate PaddleOCR with layout model (`layout_mllm`)
2. Implement Stage 1 document classifier
3. Implement Stage 2 engine router (PaddleOCR + Tesseract fallback)
4. Enhance `StructureReconstructor` with reading-order assembly

### Phase 2 (Week 3–4): Content Recovery
5. Add Pix2Tex formula extraction pipeline (Stage 3)
6. Add PaddleOCR TableStructureRec (Stage 4)
7. Implement spatial element association (Stage 5)
8. Implement multi-dimensional confidence scoring (Stage 6)

### Phase 3 (Week 5–6): Validation
9. Run re-OCR on 386 unknown questions
10. Run domain classifier on recovered question text
11. Validate answer choice extraction
12. Generate `REOCR_RECOVERY_REPORT.md` with per-question status

### Success Criteria
- ≥86% of 386 unknowns classified into known domains
- ≥85% answer choice extraction rate on recovered questions
- Question separation accuracy ≥80% across all exams
- All 15 existing tests continue to pass
