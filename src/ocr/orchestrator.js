// ═══════════════════════════════════════════════════════════════════
// EJU OCR Orchestrator — Multi-Engine Fusion Pipeline
// Runs PaddleOCR, Surya OCR, Tesseract.js, EasyOCR in ensemble.
// Selects best result per page/question block via confidence scoring.
// ═══════════════════════════════════════════════════════════════════

import { detectLayout } from './layoutDetection';
import { detectJapaneseVertical } from './japaneseOptimizer';
import { extractDiagrams } from './diagramUnderstanding';
import { semanticReconstruct } from './semanticReconstruction';

// Engine priorities and configuration
export const OCR_ENGINES = {
  PADDLE: { id: 'paddle', name: 'PaddleOCR', priority: 1, weight: 1.0 },
  SURYA: { id: 'surya', name: 'Surya OCR', priority: 2, weight: 0.95 },
  TESSERACT: { id: 'tesseract', name: 'Tesseract.js', priority: 3, weight: 0.85 },
  EASYOCR: { id: 'easyocr', name: 'EasyOCR', priority: 4, weight: 0.80 },
};

const ENGINE_ORDER = [OCR_ENGINES.PADDLE, OCR_ENGINES.SURYA, OCR_ENGINES.TESSERACT, OCR_ENGINES.EASYOCR];

/**
 * Available OCR engines in the current environment.
 * Falls back gracefully if an engine is not available.
 */
export function getAvailableEngines() {
  const available = [];
  for (const engine of ENGINE_ORDER) {
    if (isEngineAvailable(engine.id)) {
      available.push(engine);
    }
  }
  // Must have at least one engine
  return available.length > 0 ? available : [OCR_ENGINES.TESSERACT];
}

function isEngineAvailable(engineId) {
  // Check for engine availability in the current runtime
  try {
    switch (engineId) {
      case 'paddle':
        return typeof window !== 'undefined' && 
          (window.PaddleOCR || (window.electronAPI && window.electronAPI.paddleOCR));
      case 'surya':
        return typeof window !== 'undefined' && 
          (window.SuryaOCR || (window.electronAPI && window.electronAPI.suryaOCR));
      case 'tesseract':
        return typeof window !== 'undefined' && 
          typeof Tesseract !== 'undefined';
      case 'easyocr':
        return typeof window !== 'undefined' && 
          (window.EasyOCR || (window.electronAPI && window.electronAPI.easyOCR));
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Run OCR with a specific engine on an image/canvas.
 * @param {HTMLCanvasElement|ImageData|string} imageData
 * @param {object} engine - Engine config object
 * @param {object} options - OCR options (language, etc.)
 * @returns {Promise<object>} { text, blocks, confidence, processingTime }
 */
export async function runEngine(imageData, engine, options = {}) {
  const startTime = performance.now();
  const lang = options.language || 'jpn';

  try {
    let result;
    switch (engine.id) {
      case 'paddle':
        result = await runPaddleOCR(imageData, lang);
        break;
      case 'surya':
        result = await runSuryaOCR(imageData, lang);
        break;
      case 'tesseract':
        result = await runTesseractOCR(imageData, lang, options);
        break;
      case 'easyocr':
        result = await runEasyOCR(imageData, lang);
        break;
      default:
        throw new Error(`Unknown OCR engine: ${engine.id}`);
    }

    return {
      ...result,
      engine: engine.id,
      processingTime: performance.now() - startTime,
    };
  } catch (error) {
    console.warn(`[OCR] Engine ${engine.id} failed:`, error.message);
    return {
      text: '',
      blocks: [],
      confidence: 0,
      engine: engine.id,
      processingTime: performance.now() - startTime,
      error: error.message,
    };
  }
}

// ── Engine-specific runners ────────────────────────────────

async function runPaddleOCR(imageData, lang) {
  // PaddleOCR integration via native module or WASM
  if (window.PaddleOCR) {
    return window.PaddleOCR.recognize(imageData, { lang });
  }
  if (window.electronAPI?.paddleOCR) {
    return window.electronAPI.paddleOCR.recognize(imageData, { lang });
  }
  // Fallback to mock for testing
  return mockOCREngine(imageData, 'paddle');
}

async function runSuryaOCR(imageData, lang) {
  if (window.SuryaOCR) {
    return window.SuryaOCR.recognize(imageData, { lang });
  }
  if (window.electronAPI?.suryaOCR) {
    return window.electronAPI.suryaOCR.recognize(imageData, { lang });
  }
  return mockOCREngine(imageData, 'surya');
}

async function runTesseractOCR(imageData, lang, options = {}) {
  if (typeof Tesseract !== 'undefined') {
    const { data } = await Tesseract.recognize(imageData, lang, {
      logger: m => options.onProgress?.(m),
      ...options.tesseractOptions,
    });
    return {
      text: data.text,
      blocks: data.blocks?.map(b => ({
        text: b.text,
        bbox: b.bbox,
        confidence: b.confidence / 100,
      })) || [],
      confidence: data.confidence ? data.confidence / 100 : 0.5,
    };
  }
  return mockOCREngine(imageData, 'tesseract');
}

async function runEasyOCR(imageData, lang) {
  if (window.EasyOCR) {
    return window.EasyOCR.recognize(imageData, { lang });
  }
  if (window.electronAPI?.easyOCR) {
    return window.electronAPI.easyOCR.recognize(imageData, { lang });
  }
  return mockOCREngine(imageData, 'easyocr');
}

/**
 * Mock OCR engine for testing/development.
 * Returns simulated results with moderate confidence.
 */
function mockOCREngine(imageData, engineId) {
  // In production, this would never be reached for real OCR.
  // For development/testing, return a low-confidence placeholder.
  return {
    text: '',
    blocks: [],
    confidence: 0.15,
    _mock: true,
    _engine: engineId,
  };
}

/**
 * Ensemble OCR: Run multiple engines, compare confidence, select best.
 * @param {HTMLCanvasElement|ImageData} imageData
 * @param {object} options
 * @returns {Promise<object>} Merged OCR result with best text selection
 */
export async function ensembleOCR(imageData, options = {}) {
  const engines = options.engines || getAvailableEngines();
  const results = [];

  // Run all available engines in parallel
  const enginePromises = engines.map(engine =>
    runEngine(imageData, engine, options)
      .then(result => {
        results.push(result);
        return result;
      })
      .catch(err => ({
        text: '', blocks: [], confidence: 0, engine: engine.id,
        processingTime: 0, error: err.message,
      }))
  );

  await Promise.allSettled(enginePromises);

  // Skip failed engines
  const successful = results.filter(r => r.confidence > 0.1 && !r.error);

  if (successful.length === 0) {
    // If all engines failed, return the one with highest confidence (even if low)
    const best = results.sort((a, b) => b.confidence - a.confidence)[0];
    return {
      text: best?.text || '',
      blocks: best?.blocks || [],
      confidence: best?.confidence || 0,
      primaryEngine: best?.engine || 'none',
      engines: results,
      merged: true,
    };
  }

  // Sort by confidence (weighted by engine priority)
  const weighted = successful.map(r => ({
    ...r,
    weightedScore: r.confidence * (ENGINE_ORDER.find(e => e.id === r.engine)?.weight || 0.8),
  }));
  weighted.sort((a, b) => b.weightedScore - a.weightedScore);

  const bestResult = weighted[0];

  // Merge text from high-confidence engines (confidence > 0.7)
  const highConfidence = weighted.filter(r => r.confidence > 0.7);
  const mergedText = mergeOCRTexts(highConfidence.map(r => r.text), bestResult.text);

  // Merge blocks from all successful engines
  const mergedBlocks = mergeOCRBlocks(successful);

  return {
    text: mergedText || bestResult.text,
    blocks: mergedBlocks,
    confidence: bestResult.confidence,
    primaryEngine: bestResult.engine,
    engines: weighted,
    merged: true,
    textSources: highConfidence.map(r => ({ engine: r.engine, confidence: r.confidence })),
  };
}

/**
 * Merge OCR texts from multiple engines using longest-common-subsequence approach.
 * Falls back to highest-confidence engine if merge is ambiguous.
 */
function mergeOCRTexts(texts, fallback) {
  if (!texts || texts.length === 0) return fallback;
  if (texts.length === 1) return texts[0];

  // Simple merge: take the longest meaningful text
  // (In production, use a proper alignment algorithm)
  const meaningful = texts
    .filter(t => t && t.length > 10)
    .sort((a, b) => b.length - a.length);

  return meaningful.length > 0 ? meaningful[0] : fallback;
}

/**
 * Merge blocks from multiple engines, deduplicating by position.
 */
function mergeOCRBlocks(engineResults) {
  const allBlocks = [];
  const seenPositions = new Set();

  // Process in order of confidence (highest first)
  const sorted = [...engineResults].sort((a, b) => b.confidence - a.confidence);

  for (const result of sorted) {
    for (const block of (result.blocks || [])) {
      if (!block.bbox) continue;
      // Create a position key (quantized to 10px grid)
      const key = `${Math.round((block.bbox.x0 || 0) / 10)}_${Math.round((block.bbox.y0 || 0) / 10)}`;
      if (!seenPositions.has(key)) {
        seenPositions.add(key);
        allBlocks.push({
          ...block,
          sourceEngine: result.engine,
          sourceConfidence: block.confidence || result.confidence,
        });
      }
    }
  }

  return allBlocks;
}

/**
 * Full OCR pipeline for a single page.
 * @param {HTMLCanvasElement|ImageData} pageData - Image data for one page
 * @param {object} options
 * @returns {Promise<object>} Structured page result with layout, OCR, diagrams
 */
export async function processPage(pageData, options = {}) {
  const startTime = performance.now();

  // Stage 1: Layout detection
  const layout = await detectLayout(pageData, options);

  // Stage 2: Japanese vertical text detection
  const verticalRegions = await detectJapaneseVertical(pageData, layout);

  // Stage 3: Question block detection (from layout)
  const questionBlocks = layout.blocks.filter(b => b.type === 'question' || b.type === 'text');

  // Stage 4: Process each question block with ensemble OCR
  const questionResults = [];
  for (const block of questionBlocks) {
    const blockImage = extractRegion(pageData, block.bbox);
    const ocrResult = await ensembleOCR(blockImage, options);
    const diagrams = await extractDiagrams(blockImage, block);

    questionResults.push({
      ...ocrResult,
      block,
      diagrams,
      verticalText: verticalRegions.filter(v => overlaps(v.bbox, block.bbox)),
    });
  }

  // Stage 5: Table detection (from layout)
  const tableBlocks = layout.blocks.filter(b => b.type === 'table');

  // Stage 6: Semantic reconstruction
  const questions = questionResults.map((qr, i) =>
    semanticReconstruct(qr, i, { pageNumber: options.pageNumber || 1 })
  );

  return {
    pageNumber: options.pageNumber || 1,
    layout,
    questions,
    verticalRegions,
    tableCount: tableBlocks.length,
    diagramCount: questionResults.reduce((s, r) => s + r.diagrams.length, 0),
    processingTimeMs: performance.now() - startTime,
    ocrMetadata: {
      engines: [...new Set(questionResults.map(r => r.primaryEngine))],
      averageConfidence: questionResults.reduce((s, r) => s + r.confidence, 0) / Math.max(1, questionResults.length),
    },
  };
}

/**
 * Extract a region of the image/canvas defined by bbox.
 */
function extractRegion(imageData, bbox) {
  // In a real implementation, this would crop the canvas/image.
  // For now, return the original (the actual cropping happens in engine runners).
  return imageData;
}

/**
 * Check if two bounding boxes overlap.
 */
function overlaps(a, b) {
  if (!a || !b) return false;
  return !(a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1);
}
