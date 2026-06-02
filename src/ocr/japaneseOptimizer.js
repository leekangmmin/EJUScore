// ═══════════════════════════════════════════════════════════════════
// Japanese Text Optimizer — Specialized EJU Japanese Language Support
// Handles: horizontal text, vertical text, furigana, scientific notation
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect vertical Japanese text regions in an image.
 * Japanese vertical text (縦書き) is written top-to-bottom, right-to-left.
 *
 * @param {ImageData} imageData
 * @param {object} layout - Layout detection result
 * @returns {Promise<Array>} Vertical text regions with detected text
 */
export async function detectJapaneseVertical(imageData, layout) {
  const verticalRegions = [];

  if (!imageData || !layout) return verticalRegions;

  // Use ML-based vertical text detector if available
  if (window.VerticalTextDetector) {
    try {
      const mlResult = await window.VerticalTextDetector.detect(imageData);
      if (mlResult && mlResult.length > 0) {
        return mlResult.map(r => ({
          ...r,
          direction: 'vertical',
          confidence: r.confidence || 0.7,
        }));
      }
    } catch (e) {
      console.warn('[Japanese] Vertical text ML detector failed:', e.message);
    }
  }

  // Rule-based detection: vertical text regions typically have:
  // 1. Narrow width (single character wide)
  // 2. Tall height (multiple characters)
  // 3. Right-to-left column arrangement
  const blocks = layout.blocks || [];
  for (const block of blocks) {
    const bbox = block.bbox;
    if (!bbox) continue;

    const aspectRatio = (bbox.y1 - bbox.y0) / Math.max(1, bbox.x1 - bbox.x0);
    // Vertical text blocks are typically tall and narrow (aspect ratio > 2)
    if (aspectRatio > 2 && (bbox.x1 - bbox.x0) < 80) {
      verticalRegions.push({
        bbox,
        direction: 'vertical',
        confidence: 0.5,
        detectionMethod: 'rule-based',
      });
    }
  }

  return verticalRegions;
}

/**
 * Post-process OCR output for Japanese text.
 * Handles special Japanese OCR artifacts.
 */
export function postProcessJapanese(text, options = {}) {
  if (!text) return { text: '', corrections: [] };

  let corrected = text;
  const corrections = [];

  // Fix common Japanese OCR errors
  const ocrReplacements = [
    // Common misrecognitions in Japanese OCR
    [/([ぁ-ん])ー([ぁ-ん])/g, '$1$2'],           // ー (long vowel) between hiragana
    [/〇/g, '0'],                                  // circle character → zero
    [/第(\s*)零/g, '第0'],                         // 第零 → 第0
    [/[lI1](?=[ぁ-んァ-ン])/g, '1'],               // l/I/1 before kana → 1
    
    // Kanji number normalization
    [/[一二三四五六七八九〇十百千]/g, (match) => {
      return kanjiToArabic(match);
    }],
    
    // Fix common furigana artifacts
    [/[｜|]\s*([ぁ-んァ-ン]+)/g, '$1'],           // Remove furigana markers
    
    // Fix punctuation spacing
    [/\.\s+\./g, '..'],                            // Ellipsis spacing
    [/、\s+/g, '、'],                              // Remove space after comma
    [/。\s+/g, '。'],                              // Remove space after period
    
    // Fix full-width/half-width consistency
    [/[A-Za-z0-9]/g, (match) => {
      // Keep half-width alphanumeric as-is (standard in Japanese exams)
      return match;
    }],
    
    // Fix scientific notation
    [/(\d+)\s*×\s*10\s*\^?\s*[−\-]?\s*(\d+)/g, '$1×10^$2'],
    [/(\d+)\s*\.\s*(\d+)\s*×\s*10/g, '$1.$2×10'],
  ];

  for (const [pattern, replacement] of ocrReplacements) {
    const before = corrected;
    corrected = corrected.replace(pattern, replacement);
    if (before !== corrected) {
      corrections.push({
        type: typeof replacement === 'function' ? 'normalization' : 'replacement',
        before,
        after: corrected,
      });
    }
  }

  return { text: corrected, corrections };
}

/**
 * Detect furigana (ruby) annotations in OCR output.
 * Furigana appear as small kana above/beside kanji.
 */
export function extractFurigana(text) {
  if (!text) return [];
  const furiganaAnnotations = [];

  // Match common furigana patterns
  // Pattern: kanji with furigana in parentheses: 日本語(にほんご)
  const furiganaRegex = /([\u4e00-\u9fff\u3400-\u4dbf]+)[（(]([ぁ-んァ-ンー\s]+)[)）]/g;
  let match;
  while ((match = furiganaRegex.exec(text)) !== null) {
    furiganaAnnotations.push({
      kanji: match[1],
      reading: match[2].trim(),
      position: match.index,
    });
  }

  // Pattern: ｜漢字《かんじ》 (vertical text furigana)
  const verticalFuriganaRegex = /[｜|]([\u4e00-\u9fff]+)《([ぁ-んァ-ンー]+)》/g;
  while ((match = verticalFuriganaRegex.exec(text)) !== null) {
    furiganaAnnotations.push({
      kanji: match[1],
      reading: match[2],
      position: match.index,
      style: 'vertical',
    });
  }

  return furiganaAnnotations;
}

/**
 * Normalize Japanese text for comparison/search.
 * Strips furigana, normalizes kanji variants.
 */
export function normalizeJapanese(text) {
  if (!text) return '';
  let normalized = text;

  // Remove furigana annotations
  normalized = normalized.replace(/[（(][ぁ-んァ-ンー\s]+[)）]/g, '');
  normalized = normalized.replace(/[｜|][\u4e00-\u9fff]+《[ぁ-んァ-ンー]+》/g, '');

  // Normalize unicode
  normalized = normalized.normalize('NFKC');

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Simple kanji to arabic number converter.
 * Handles 1-99 (enough for question numbers).
 */
function kanjiToArabic(kanjiStr) {
  const numMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '〇': 0, '十': 10, '百': 100, '千': 1000 };
  let result = 0;
  let temp = 0;

  for (const ch of kanjiStr) {
    const val = numMap[ch];
    if (val === undefined) return kanjiStr; // Non-numeric kanji found
    if (val >= 10) {
      temp = temp === 0 ? val : temp * val;
      result += temp;
      temp = 0;
    } else {
      temp = val;
    }
  }
  result += temp;
  return String(result);
}
