// ═══════════════════════════════════════════════════════════════════════
// Year Detector — EJU Exam Year & Round Detection from OCR Text
// ═══════════════════════════════════════════════════════════════════════

const ERA_MAP = {
  '令和': { start: 2019 },
  '平成': { start: 1989 },
  '昭和': { start: 1926 },
};

const JP_NUMBERS = {
  '元': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '〇': 0, '０': 0, '１': 1, '２': 2, '３': 3, '４': 4,
  '５': 5, '６': 6, '７': 7, '８': 8, '９': 9,
  // ASCII digits as fallback
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

const WESTERN_YEAR_RE = /(?:20|19)\d{2}/;
const ERA_YEAR_RE = /(令和|平成|昭和)\s*(\d{1,2}|元)\s*(?:年|年度)/;

/**
 * Detect year from OCR text.
 */
export function detectYear(text, options = {}) {
  const minConfidence = options.minConfidence ?? 0.3;
  if (!text || typeof text !== 'string') {
    return { year: null, round: null, confidence: 0, method: 'none', rawMatch: null };
  }

  const headerResult = detectYearFromHeader(text);
  if (headerResult && headerResult.confidence >= minConfidence) return headerResult;

  const eraResult = detectYearFromEra(text);
  if (eraResult && eraResult.confidence >= minConfidence) return eraResult;

  const westernResult = detectYearFromWestern(text);
  if (westernResult && westernResult.confidence >= minConfidence) return westernResult;

  const contextResult = detectYearFromContext(text);
  if (contextResult && contextResult.confidence >= minConfidence) return contextResult;

  return { year: null, round: null, confidence: 0, method: 'none', rawMatch: null };
}

function detectYearFromHeader(text) {
  const headerMatch = text.match(/日本留学試験\s*(令和|平成|昭和)\s*(\d{1,2}|元)\s*年度\s*第\s*(\d)\s*回/);
  if (headerMatch) {
    const era = headerMatch[1];
    const eraYear = headerMatch[2] === '元' ? 1 : parseInt(headerMatch[2], 10);
    const round = parseInt(headerMatch[3], 10);
    const year = convertEraToWestern(era, eraYear);
    return { year, round: (round >= 1 && round <= 2) ? round : null, confidence: 0.95, method: 'eju_header_full', rawMatch: headerMatch[0] };
  }

  const simpleMatch = text.match(/(令和|平成|昭和)\s*(\d{1,2}|元)\s*年度\s*第\s*(\d)\s*回/);
  if (simpleMatch) {
    const era = simpleMatch[1];
    const eraYear = simpleMatch[2] === '元' ? 1 : parseInt(simpleMatch[2], 10);
    const round = parseInt(simpleMatch[3], 10);
    const year = convertEraToWestern(era, eraYear);
    return { year, round: (round >= 1 && round <= 2) ? round : null, confidence: 0.9, method: 'era_year_round', rawMatch: simpleMatch[0] };
  }

  const westernHeaderMatch = text.match(/(20\d{2})\s*年度\s*日本留学試験\s*第\s*(\d)\s*回/);
  if (westernHeaderMatch) {
    const year = parseInt(westernHeaderMatch[1], 10);
    const round = parseInt(westernHeaderMatch[2], 10);
    if (year >= 2000 && year <= 2030) {
      return { year, round: (round >= 1 && round <= 2) ? round : null, confidence: 0.95, method: 'western_eju_header', rawMatch: westernHeaderMatch[0] };
    }
  }

  const yearOnlyMatch = text.match(/日本留学試験\s*(20\d{2})\s*年度/);
  if (yearOnlyMatch) {
    const year = parseInt(yearOnlyMatch[1], 10);
    if (year >= 2000 && year <= 2030) {
      return { year, round: null, confidence: 0.85, method: 'eju_header_year_only', rawMatch: yearOnlyMatch[0] };
    }
  }

  return null;
}

function detectYearFromEra(text) {
  const match = text.match(ERA_YEAR_RE);
  if (!match) return null;

  const era = match[1];
  const eraYear = match[2] === '元' ? 1 : parseJapaneseNumber(match[2]);
  if (eraYear === null || eraYear < 1 || eraYear > 100) return null;

  const year = convertEraToWestern(era, eraYear);
  if (!year) return null;

  return { year, round: null, confidence: 0.8, method: 'era_year', rawMatch: match[0] };
}

function detectYearFromWestern(text) {
  const matches = text.match(WESTERN_YEAR_RE);
  if (!matches) return null;
  for (const match of matches) {
    const year = parseInt(match, 10);
    if (year >= 2000 && year <= 2030) {
      return { year, round: null, confidence: 0.7, method: 'western_year', rawMatch: match };
    }
  }
  return null;
}

function detectYearFromContext(text) {
  const examMatch = text.match(/(20\d{2})\s*(?:年\s*)?(?:追試|追試験|本試験|過去問)/);
  if (examMatch) {
    const year = parseInt(examMatch[1], 10);
    if (year >= 2000 && year <= 2030) {
      return { year, round: null, confidence: 0.6, method: 'exam_name_context', rawMatch: examMatch[0] };
    }
  }
  const pastMatch = text.match(/過去問[\s:：]*(20\d{2})/);
  if (pastMatch) {
    const year = parseInt(pastMatch[1], 10);
    if (year >= 2000 && year <= 2030) {
      return { year, round: null, confidence: 0.5, method: 'past_exam_context', rawMatch: pastMatch[0] };
    }
  }
  return null;
}

export function detectRound(text) {
  if (!text) return { round: null, confidence: 0 };

  const roundMatch = text.match(/第\s*([1-2１２])\s*回/);
  if (roundMatch) {
    const round = (roundMatch[1] === '１' || roundMatch[1] === '1' || roundMatch[1] === '一') ? 1 : 2;
    return { round, confidence: 0.9 };
  }

  if (/(?:6|06|六)\s*月/.test(text)) return { round: 1, confidence: 0.7 };
  if (/(?:11|十一)\s*月/.test(text)) return { round: 2, confidence: 0.7 };
  if (/前\s*期/.test(text)) return { round: 1, confidence: 0.6 };
  if (/後\s*期/.test(text)) return { round: 2, confidence: 0.6 };

  return { round: null, confidence: 0 };
}

function convertEraToWestern(era, eraYear) {
  const eraInfo = ERA_MAP[era];
  if (!eraInfo) return null;
  return eraInfo.start + eraYear - 1;
}

function parseJapaneseNumber(str) {
  if (!str) return null;
  // Try table lookup first
  if (str.length === 1 && JP_NUMBERS[str] !== undefined) return JP_NUMBERS[str];
  // Handle two-digit kanji like "十二"
  if (str.length === 2 && str[0] === '十') {
    const unit = JP_NUMBERS[str[1]];
    if (unit !== undefined) return 10 + unit;
  }
  // Try direct integer parse (handles ASCII and full-width digit strings)
  const parsed = parseInt(str, 10);
  if (!isNaN(parsed)) return parsed;
  return null;
}

export function detectYearBatch(pageTexts, options = {}) {
  if (!pageTexts || pageTexts.length === 0) {
    return { year: null, round: null, confidence: 0, method: 'none', rawMatch: null };
  }

  const combinedText = pageTexts.map(p => p.text || p.rawText || '').filter(Boolean).join('\n');
  const combinedResult = detectYear(combinedText, options);
  if (combinedResult && combinedResult.confidence >= 0.85) {
    const roundResult = detectRound(combinedText);
    return { ...combinedResult, round: roundResult.round || combinedResult.round };
  }

  const results = pageTexts.map(p => detectYear(p.text || p.rawText || '', options)).filter(r => r.year !== null);
  if (results.length === 0) return combinedResult;

  const highConfResults = results.filter(r => r.confidence >= 0.5);
  const voteTarget = highConfResults.length > 0 ? highConfResults : results;

  const yearVotes = {};
  for (const r of voteTarget) {
    if (r.year) yearVotes[r.year] = (yearVotes[r.year] || 0) + r.confidence;
  }

  const bestYear = Object.entries(yearVotes).sort((a, b) => b[1] - a[1])[0];
  if (!bestYear) return combinedResult;

  const roundResult = detectRound(combinedText);
  const consensusConfidence = Math.min(0.95,
    voteTarget.reduce((s, r) => s + r.confidence, 0) / voteTarget.length +
    (highConfResults.length / results.length) * 0.2
  );

  return {
    year: parseInt(bestYear[0], 10),
    round: roundResult.round,
    confidence: parseFloat(consensusConfidence.toFixed(3)),
    method: highConfResults.length >= 2 ? 'consensus_high' : 'consensus',
    rawMatch: null,
  };
}

export default { detectYear, detectYearBatch, detectRound };
