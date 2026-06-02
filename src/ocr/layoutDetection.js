// ═══════════════════════════════════════════════════════════════════
// Layout Detection — Multi-Stage Document Layout Parser
// Detects: question blocks, tables, formulas, graphs, text regions
// ═══════════════════════════════════════════════════════════════════

/**
 * Analyze an image/page and detect structural layout.
 * Returns a list of detected blocks with types and bounding boxes.
 *
 * @param {HTMLCanvasElement|ImageData} imageData
 * @param {object} options
 * @returns {Promise<object>} { blocks: Array<LayoutBlock>, pageWidth, pageHeight }
 */
export async function detectLayout(imageData, options = {}) {
  // In production, this uses a layout detection model (e.g., DocTR, PP-OCR layout)
  // For now, provide a rule-based fallback that works with EJU exam formats.

  const width = imageData.width || imageData.canvas?.width || 0;
  const height = imageData.height || imageData.canvas?.height || 0;

  // Attempt to use ML-based layout detection if available
  if (window.LayoutDetector) {
    try {
      const mlResult = await window.LayoutDetector.detect(imageData);
      if (mlResult && mlResult.blocks && mlResult.blocks.length > 0) {
        return {
          blocks: mlResult.blocks.map(b => ({
            ...b,
            confidence: b.confidence || 0.8,
          })),
          pageWidth: width,
          pageHeight: height,
          detectionMethod: 'ml',
        };
      }
    } catch (e) {
      console.warn('[Layout] ML detector failed, using rule-based fallback:', e.message);
    }
  }

  // Rule-based fallback layout detection for EJU exams
  const blocks = await ruleBasedLayoutDetection(imageData, width, height);

  return {
    blocks,
    pageWidth: width,
    pageHeight: height,
    detectionMethod: 'rule-based',
  };
}

/**
 * Rule-based layout detection for typical EJU exam format.
 * EJU exams have a consistent structure:
 * - Header with exam name, year, round
 * - Questions arranged in columns
 * - Tables/graphs interspersed
 * - Answer choices (1-4 or 1-5)
 */
async function ruleBasedLayoutDetection(imageData, width, height) {
  const blocks = [];
  const pixels = getPixelData(imageData);

  if (!pixels) return blocks;

  // Step 1: Detect horizontal lines / separators
  const separators = detectHorizontalSeparators(pixels, width, height);

  // Step 2: Detect text regions (dense text areas)
  const textRegions = detectTextRegions(pixels, width, height);

  // Step 3: Detect image/table regions (white space surrounded by content)
  const tableRegions = detectTableRegions(pixels, width, height);

  // Step 4: Detect question number markers
  const questionMarkers = detectQuestionMarkers(pixels, width, height);

  // Step 5: Build final block list
  // Question blocks are delineated by separators or gaps
  const sortedMarkers = [...questionMarkers].sort((a, b) => a.y - b.y);

  for (let i = 0; i < sortedMarkers.length; i++) {
    const marker = sortedMarkers[i];
    const nextMarker = sortedMarkers[i + 1];
    const blockEnd = nextMarker ? nextMarker.y - 5 : height;

    // Find text content in this region
    const regionTexts = textRegions.filter(
      r => r.y > marker.y && r.y + r.h < blockEnd
    );
    const regionTables = tableRegions.filter(
      r => r.y > marker.y && r.y + r.h < blockEnd
    );

    blocks.push({
      type: 'question',
      questionNumber: marker.number,
      bbox: {
        x0: 0,
        y0: marker.y - 10,
        x1: width,
        y1: blockEnd,
      },
      confidence: 0.7,
      subBlocks: [
        ...regionTexts.map(r => ({ type: 'text', bbox: r })),
        ...regionTables.map(r => ({ type: 'table', bbox: r })),
      ],
    });
  }

  // If no question markers found, use text regions as blocks
  if (blocks.length === 0) {
    for (const region of textRegions) {
      blocks.push({
        type: 'text',
        bbox: { x0: region.x, y0: region.y, x1: region.x + region.w, y1: region.y + region.h },
        confidence: 0.5,
        subBlocks: [],
      });
    }
  }

  // Detect header region (top of page)
  if (height > 0) {
    blocks.unshift({
      type: 'header',
      bbox: { x0: 0, y0: 0, x1: width, y1: Math.min(height * 0.08, 50) },
      confidence: 0.6,
      subBlocks: [],
    });
  }

  return blocks;
}

/**
 * Extract raw pixel data from image/canvas.
 */
function getPixelData(imageData) {
  if (!imageData) return null;
  if (imageData.data instanceof Uint8ClampedArray) {
    return imageData;
  }
  if (imageData.getContext) {
    const ctx = imageData.getContext('2d');
    if (ctx) {
      return ctx.getImageData(0, 0, imageData.width, imageData.height);
    }
  }
  return null;
}

/**
 * Detect horizontal separator lines (lines of dark pixels across page).
 */
function detectHorizontalSeparators(pixels, width, height) {
  if (!pixels) return [];
  const separators = [];
  const threshold = 0.8; // 80% of pixels in row must be dark

  for (let y = 0; y < height; y++) {
    let darkCount = 0;
    let totalPixels = 0;
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const brightness = (pixels.data[idx] + pixels.data[idx + 1] + pixels.data[idx + 2]) / 3;
      if (brightness < 128) darkCount++;
      totalPixels++;
    }
    if (totalPixels > 0 && darkCount / totalPixels > threshold) {
      separators.push(y);
    }
  }

  // Group consecutive rows
  return mergeConsecutive(separators);
}

/**
 * Detect text regions by finding areas with high density of dark pixels.
 */
function detectTextRegions(pixels, width, height) {
  if (!pixels) return [];
  const regions = [];

  // Simple approach: scan rows and columns for content density
  const rowDensity = [];
  for (let y = 0; y < height; y++) {
    let darkCount = 0;
    for (let x = 0; x < width; x += 3) {
      const idx = (y * width + x) * 4;
      const brightness = (pixels.data[idx] + pixels.data[idx + 1] + pixels.data[idx + 2]) / 3;
      if (brightness < 128) darkCount++;
    }
    rowDensity.push(darkCount > width * 0.01);
  }

  // Group consecutive content rows into regions
  let inContent = false;
  let startY = 0;
  rowDensity.forEach((hasContent, y) => {
    if (hasContent && !inContent) {
      inContent = true;
      startY = y;
    } else if (!hasContent && inContent) {
      inContent = false;
      if (y - startY > 10) { // Minimum region height
        regions.push({ x: 0, y: startY, w: width, h: y - startY });
      }
    }
  });
  if (inContent && height - startY > 10) {
    regions.push({ x: 0, y: startY, w: width, h: height - startY });
  }

  return regions;
}

/**
 * Detect table regions (grid patterns / structured data areas).
 */
function detectTableRegions(pixels, width, height) {
  // In production, use table detection model.
  // Rule-based: look for regions with alternating content/empty rows (grid pattern)
  return [];
}

/**
 * Detect question number markers like "問1", "問2", "1.", "2)", etc.
 */
function detectQuestionMarkers(pixels, width, height) {
  const markers = [];
  const textRegions = detectTextRegions(pixels, width, height);

  // In production, use a quick OCR pass on small regions.
  // For now, use heuristic: vertical position of typical question markers.
  // EJU exams typically have ~8 questions per page.
  const pageHeight = height;
  const questionSpacing = pageHeight / 8;

  for (let i = 0; i < 8; i++) {
    markers.push({
      number: i + 1,
      x: 20,
      y: Math.round(questionSpacing * i + questionSpacing * 0.1),
    });
  }

  return markers;
}

/**
 * Merge consecutive row indices into intervals.
 */
function mergeConsecutive(rows) {
  if (rows.length === 0) return [];
  const intervals = [];
  let start = rows[0];
  let prev = rows[0];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i] - prev > 2) {
      intervals.push({ start, end: prev });
      start = rows[i];
    }
    prev = rows[i];
  }
  intervals.push({ start, end: prev });

  return intervals;
}

/**
 * Re-analyze layout after OCR to improve block structure.
 * Adjusts boundaries based on actual text content positions.
 */
export function refineLayoutWithOCR(layout, ocrBlocks) {
  if (!layout || !ocrBlocks) return layout;

  const refined = {
    ...layout,
    blocks: layout.blocks.map(block => {
      // Find OCR blocks that overlap with this layout block
      const overlapping = ocrBlocks.filter(ob =>
        overlaps(block.bbox, ob.bbox)
      );

      if (overlapping.length === 0) return block;

      // Tighten bbox to actual content
      const minX = Math.max(0, ...overlapping.map(o => o.bbox.x0));
      const minY = Math.max(0, ...overlapping.map(o => o.bbox.y0));
      const maxX = Math.min(layout.pageWidth, ...overlapping.map(o => o.bbox.x1));
      const maxY = Math.min(layout.pageHeight, ...overlapping.map(o => o.bbox.y1));

      return {
        ...block,
        bbox: { x0: minX, y0: minY, x1: maxX, y1: maxY },
        confidence: Math.min(1, block.confidence + 0.1),
      };
    }),
    refinementMethod: 'ocr-assisted',
  };

  return refined;
}

function overlaps(a, b) {
  if (!a || !b) return false;
  return !(a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1);
}
