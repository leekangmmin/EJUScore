// ═══════════════════════════════════════════════════════════════════
// Diagram Understanding — Graph, Chart, Map, Table, Formula Detection
// Converts visual elements into structured JSON representations.
// ═══════════════════════════════════════════════════════════════════

/**
 * Extract diagram information from an image region.
 * Detects: graphs, charts, maps, tables, timelines, formulas.
 *
 * @param {ImageData} imageData - Image region data
 * @param {object} block - Layout block information
 * @returns {Promise<Array>} Detected diagrams with structured data
 */
export async function extractDiagrams(imageData, block) {
  const diagrams = [];

  if (!imageData) return diagrams;

  // Try ML-based diagram detection first
  if (window.DiagramDetector) {
    try {
      const mlResult = await window.DiagramDetector.detect(imageData);
      if (mlResult && mlResult.length > 0) {
        return mlResult.map(d => ({
          type: d.type,
          ...d,
          confidence: d.confidence || 0.7,
          detectionMethod: 'ml',
        }));
      }
    } catch (e) {
      console.warn('[Diagram] ML detector failed, using rule-based fallback:', e.message);
    }
  }

  // Rule-based detection
  const pixels = getPixelData(imageData);
  if (!pixels) return diagrams;

  // Detect graph (presence of axes - horizontal and vertical lines)
  const graphResult = detectGraph(pixels, imageData.width, imageData.height);
  if (graphResult) diagrams.push(graphResult);

  // Detect table (grid pattern)
  const tableResult = detectTable(pixels, imageData.width, imageData.height);
  if (tableResult) diagrams.push(tableResult);

  // Detect chart (bar/pie patterns)
  const chartResult = detectChart(pixels, imageData.width, imageData.height);
  if (chartResult) diagrams.push(chartResult);

  // Detect map (geographic patterns)
  const mapResult = detectMap(pixels, imageData.width, imageData.height);
  if (mapResult) diagrams.push(mapResult);

  // Detect timeline (horizontal sequential markers)
  const timelineResult = detectTimeline(pixels, imageData.width, imageData.height);
  if (timelineResult) diagrams.push(timelineResult);

  // Detect mathematical formula
  const formulaResult = detectFormula(block);
  if (formulaResult) diagrams.push(formulaResult);

  return diagrams;
}

/**
 * Detect a graph (x/y axis structure).
 */
function detectGraph(pixels, width, height) {
  // Look for perpendicular lines (axes)
  const hLineDensity = getHorizontalLineDensity(pixels, width, height);
  const vLineDensity = getVerticalLineDensity(pixels, width, height);

  // A graph should have at least one significant horizontal and vertical line
  const hasHAxis = hLineDensity.some(d => d > 0.3);
  const hasVAxis = vLineDensity.some(d => d > 0.3);

  if (hasHAxis && hasVAxis) {
    // Determine trend direction from pixel distribution
    const trend = analyzeTrend(pixels, width, height);
    return {
      type: 'graph',
      x_axis: 'horizontal',
      y_axis: 'vertical',
      trend: trend,
      confidence: 0.6,
      detectionMethod: 'rule-based',
    };
  }

  return null;
}

/**
 * Detect a table (grid pattern with cells).
 */
function detectTable(pixels, width, height) {
  // Count horizontal and vertical lines
  const hLines = getHorizontalLineDensity(pixels, width, height);
  const vLines = getVerticalLineDensity(pixels, width, height);

  const hLineCount = hLines.filter(d => d > 0.5).length;
  const vLineCount = vLines.filter(d => d > 0.5).length;

  // Tables typically have multiple horizontal and vertical lines
  if (hLineCount >= 2 && vLineCount >= 2) {
    return {
      type: 'table',
      rows: hLineCount - 1,
      columns: vLineCount - 1,
      confidence: 0.5,
      detectionMethod: 'rule-based',
    };
  }

  return null;
}

/**
 * Detect a chart (bar, pie, area chart).
 */
function detectChart(pixels, width, height) {
  // Look for patterns typical of charts
  //   - Bar chart: vertical rectangles
  //   - Pie chart: circular patterns
  //   - Line chart: connected points

  // Simple heuristic: check for clustered vertical bars
  const vLineDensity = getVerticalLineDensity(pixels, width, height);
  const barClusters = countClusters(vLineDensity, 0.4);

  if (barClusters >= 3 && barClusters <= 20) {
    return {
      type: 'chart',
      chart_type: 'bar', // Default assumption
      data_points: barClusters,
      confidence: 0.5,
      detectionMethod: 'rule-based',
    };
  }

  return null;
}

/**
 * Detect a map (geographic pattern).
 */
function detectMap(pixels, width, height) {
  // Maps typically have irregular boundaries with labeled regions
  // This is a complex detection; in production use a dedicated model.
  // Rule-based: look for irregular closed contours.

  return null; // Placeholder — ML-based detection recommended
}

/**
 * Detect a timeline (sequential markers with labels).
 */
function detectTimeline(pixels, width, height) {
  // Look for horizontal line with vertical tick marks
  const hLines = getHorizontalLineDensity(pixels, width, height);
  const vLines = getVerticalLineDensity(pixels, width, height);

  // Timeline: strong horizontal line with several short vertical marks
  const strongHLines = hLines.filter(d => d > 0.6).length;
  const shortVLines = vLines.filter(d => d > 0.2 && d < 0.5).length;

  if (strongHLines === 1 && shortVLines >= 3) {
    return {
      type: 'timeline',
      markers: shortVLines,
      confidence: 0.4,
      detectionMethod: 'rule-based',
    };
  }

  return null;
}

/**
 * Detect a mathematical formula based on block metadata or text patterns.
 */
function detectFormula(block) {
  if (!block) return null;

  // Check if block has formula indicators
  const hasFormula = block.subBlocks?.some(
    sb => sb.type === 'formula' || sb.type === 'equation'
  );

  if (hasFormula) {
    return {
      type: 'formula',
      confidence: 0.7,
      detectionMethod: 'layout',
    };
  }

  return null;
}

// ── Pixel Analysis Utilities ─────────────────────────────

function getPixelData(imageData) {
  if (!imageData) return null;
  if (imageData.data instanceof Uint8ClampedArray) return imageData;
  if (imageData.getContext) {
    const ctx = imageData.getContext('2d');
    if (ctx) return ctx.getImageData(0, 0, imageData.width, imageData.height);
  }
  return null;
}

function getHorizontalLineDensity(pixels, width, height) {
  const densities = [];
  for (let y = 0; y < height; y++) {
    let darkCount = 0;
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const brightness = (pixels.data[idx] + pixels.data[idx + 1] + pixels.data[idx + 2]) / 3;
      if (brightness < 100) darkCount++;
    }
    densities.push(darkCount / (width / 2));
  }
  return densities;
}

function getVerticalLineDensity(pixels, width, height) {
  const densities = [];
  for (let x = 0; x < width; x++) {
    let darkCount = 0;
    for (let y = 0; y < height; y += 2) {
      const idx = (y * width + x) * 4;
      const brightness = (pixels.data[idx] + pixels.data[idx + 1] + pixels.data[idx + 2]) / 3;
      if (brightness < 100) darkCount++;
    }
    densities.push(darkCount / (height / 2));
  }
  return densities;
}

/**
 * Analyze trend direction from pixel distribution.
 * Detects if a graph line is increasing, decreasing, or stable.
 */
function analyzeTrend(pixels, width, height) {
  // Sample pixel brightness at multiple heights
  // For an increasing trend: dark pixels shift right as y decreases (top to bottom)
  const samples = [];
  const step = Math.max(1, Math.floor(height / 20));

  for (let y = 0; y < height; y += step) {
    let leftBrightness = 0;
    let rightBrightness = 0;
    const halfW = Math.floor(width / 2);

    for (let x = 0; x < halfW; x++) {
      const idx = (y * width + x) * 4;
      leftBrightness += (pixels.data[idx] + pixels.data[idx + 1] + pixels.data[idx + 2]) / 3;
    }
    for (let x = halfW; x < width; x++) {
      const idx = (y * width + x) * 4;
      rightBrightness += (pixels.data[idx] + pixels.data[idx + 1] + pixels.data[idx + 2]) / 3;
    }

    const leftAvg = leftBrightness / halfW;
    const rightAvg = rightBrightness / (width - halfW);
    samples.push({ y, leftAvg, rightAvg, diff: leftAvg - rightAvg });
  }

  // Analyze how the difference changes across the graph
  // If later rows have more content on the right → increasing trend
  const firstHalf = samples.slice(0, Math.floor(samples.length / 2));
  const secondHalf = samples.slice(Math.floor(samples.length / 2));

  const firstAvg = firstHalf.reduce((s, r) => s + r.diff, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((s, r) => s + r.diff, 0) / secondHalf.length;

  if (secondAvg - firstAvg > 20) return 'increasing';
  if (firstAvg - secondAvg > 20) return 'decreasing';
  return 'stable';
}

function countClusters(arr, threshold) {
  let clusters = 0;
  let inCluster = false;
  for (const val of arr) {
    if (val > threshold && !inCluster) {
      clusters++;
      inCluster = true;
    } else if (val <= threshold) {
      inCluster = false;
    }
  }
  return clusters;
}
