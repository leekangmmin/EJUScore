// ═══════════════════════════════════════════════════════════════════
// OCR Quality Auditor (PURE) — ocr_output.json → quality metrics + score.
//
// 10 checks: text length, Japanese ratio, kanji ratio, digit ratio,
// OCR-garbage ratio, question-separation rate, formula detection,
// graph-mention detection, year detection, empty-document detection.
//
// Score 0–100 (transparent rubric). <60 → re-OCR candidate.
// No I/O here → fully unit-testable. CLI (audit.mjs) handles files + output.
// ═══════════════════════════════════════════════════════════════════

// ── character classes ──────────────────────────────────────
const RE_HIRA  = /[぀-ゟ]/;
const RE_KATA  = /[゠-ヿｦ-ﾝ]/;          // incl. half-width kana
const RE_KANJI = /[一-鿿㐀-䶿]/;
const RE_HAN   = /[가-힣]/;
const RE_LATIN = /[A-Za-zＡ-Ｚａ-ｚ]/;
const RE_DIGIT = /[0-9０-９]/;
const RE_PUNCT = /[\s。、・「」『』（）()［］【】，．,.!?！？:：;；…ー―─\-—–%％&/／＝=+×÷±°「」〜~|｜’'"“”]/;

/** Classify a single character into one bucket. */
function classify(ch) {
  if (RE_HIRA.test(ch)) return 'hira';
  if (RE_KATA.test(ch)) return 'kata';
  if (RE_KANJI.test(ch)) return 'kanji';
  if (RE_HAN.test(ch)) return 'han';
  if (RE_DIGIT.test(ch)) return 'digit';
  if (RE_LATIN.test(ch)) return 'latin';
  if (RE_PUNCT.test(ch)) return 'punct';
  return 'other';
}

/** Count chars in same-char runs (len>=4) AND repeated-bigram runs (e.g. バーバーバー).
 *  Both are strong OCR-garbage signals in this corpus. */
function repeatedRunChars(s) {
  let n = 0, runLen = 1;
  for (let i = 1; i <= s.length; i++) {       // single-char runs
    if (i < s.length && s[i] === s[i - 1]) { runLen++; }
    else { if (runLen >= 4) n += runLen; runLen = 1; }
  }
  // repeated 2-gram: a bigram repeated >=3x consecutively (バー×3 → 6 chars)
  let i = 0;
  while (i + 4 <= s.length) {
    const bg = s.slice(i, i + 2);
    if (bg[0] === bg[1]) { i++; continue; }   // already covered by single runs
    let reps = 1, j = i + 2;
    while (j + 2 <= s.length && s.slice(j, j + 2) === bg) { reps++; j += 2; }
    if (reps >= 3) { n += reps * 2; i = j; } else { i++; }
  }
  return n;
}

/** Per-text character analysis → ratios in [0,1]. */
export function analyzeText(text) {
  const s = String(text || '');
  const chars = [...s].filter((c) => !/\s/.test(c)); // ignore whitespace in ratios
  const total = chars.length;
  if (total === 0) {
    return {
      total: 0, length: s.length,
      japaneseRatio: 0, kanjiRatio: 0, digitRatio: 0, latinRatio: 0,
      meaningfulRatio: 0, brokenRatio: 1,
      counts: { hira: 0, kata: 0, kanji: 0, han: 0, digit: 0, latin: 0, punct: 0, other: 0 },
    };
  }
  const c = { hira: 0, kata: 0, kanji: 0, han: 0, digit: 0, latin: 0, punct: 0, other: 0 };
  for (const ch of chars) c[classify(ch)]++;

  const japanese = c.hira + c.kata + c.kanji;
  const meaningful = japanese + c.han + c.latin + c.digit;
  const runs = repeatedRunChars(s);
  const brokenChars = c.other + 0.5 * runs;

  return {
    total,
    length: s.length,
    japaneseRatio: japanese / total,
    kanjiRatio: c.kanji / total,
    digitRatio: c.digit / total,
    latinRatio: c.latin / total,
    meaningfulRatio: meaningful / total,
    brokenRatio: Math.min(1, brokenChars / total),
    counts: c,
  };
}

// ── content detectors ──────────────────────────────────────
const RE_FORMULA = /[=＝×÷±√∫∑≦≧≠≒]|[0-9０-９]\s*[+\-*/＋−×÷]\s*[0-9０-９]|\^|²|³|√|分の|方程式|関数|不等式|式\s*[0-9０-９]|\bsin\b|\bcos\b|\btan\b|log/;
const RE_GRAPH   = /グラフ|図\s*[0-9０-９]|表\s*[0-9０-９]|地図|チャート|円グラフ|棒グラフ|折れ線|グラフ中|図中|次の図|次の表/;
const RE_YEAR    = /令和|平成|昭和|西暦|(19|20)[0-9]{2}\s*年|[0-9０-９]{1,2}\s*年度/;

export function hasFormula(text) { return RE_FORMULA.test(String(text || '')); }
export function hasGraphMention(q) {
  if ((q.graphs || []).length || (q.diagrams || []).length || (q.tables || []).length || (q.maps || []).length) return true;
  return RE_GRAPH.test(String(q.text || q.raw_text || ''));
}

// ── per-question scoring ───────────────────────────────────
export const WEIGHTS = {
  broken: 70,        // brokenRatio penalty (max −70)
  unmeaningful: 30,  // (1−meaningfulRatio) penalty (max −30)
  shortLt10: 25, shortLt25: 8,
  heuristicWeight: 0.7, confidenceWeight: 0.3, // blend with real ocr_confidence
};

export function scoreQuestion(q) {
  const text = q.text || q.raw_text || '';
  const a = analyzeText(text);
  let s = 100
    - a.brokenRatio * WEIGHTS.broken
    - (1 - a.meaningfulRatio) * WEIGHTS.unmeaningful
    - (a.length < 10 ? WEIGHTS.shortLt10 : a.length < 25 ? WEIGHTS.shortLt25 : 0);
  s = Math.max(0, Math.min(100, s));

  const conf = typeof q.ocr_confidence === 'number' ? q.ocr_confidence * 100 : null;
  // Empty text → hard 0 (confidence is meaningless for empty OCR output).
  const final = a.total === 0 ? 0
    : conf == null ? s
    : WEIGHTS.heuristicWeight * s + WEIGHTS.confidenceWeight * conf;

  const reasons = [];
  if (a.length < 10) reasons.push('too_short');
  if (a.brokenRatio > 0.3) reasons.push('high_garbage');
  if (a.meaningfulRatio < 0.5) reasons.push('low_meaningful');
  if (conf != null && conf < 60) reasons.push('low_ocr_confidence');

  return {
    id: q.id ?? null,
    number: q.number ?? null,
    score: Math.round(final),
    reocr: final < 60,
    length: a.length,
    japaneseRatio: round3(a.japaneseRatio),
    kanjiRatio: round3(a.kanjiRatio),
    digitRatio: round3(a.digitRatio),
    brokenRatio: round3(a.brokenRatio),
    ocrConfidence: q.ocr_confidence ?? null,
    reasons,
  };
}

// ── per-document analysis ──────────────────────────────────
export function analyzeDocument(doc, meta = {}) {
  const questions = Array.isArray(doc.questions) ? doc.questions : [];
  const qResults = questions.map(scoreQuestion);

  const nonEmpty = questions.filter((q) => String(q.text || q.raw_text || '').trim().length >= 3);
  const empty = questions.length === 0 || nonEmpty.length === 0;

  // 6. question separation success: valid number, enough text, not duplicate, not garbage
  const numSeen = new Map();
  for (const q of questions) numSeen.set(q.number, (numSeen.get(q.number) || 0) + 1);
  let sepOk = 0;
  questions.forEach((q, i) => {
    const r = qResults[i];
    const numValid = Number.isInteger(q.number) && q.number > 0;
    const unique = (numSeen.get(q.number) || 0) === 1;
    if (numValid && unique && r.length >= 10 && r.brokenRatio < 0.5) sepOk++;
  });
  const separationRate = questions.length ? sepOk / questions.length : 0;

  // 7/8 detection rates
  const formulaRate = questions.length
    ? questions.filter((q) => hasFormula(q.text || q.raw_text)).length / questions.length : 0;
  const graphRate = questions.length
    ? questions.filter((q) => hasGraphMention(q)).length / questions.length : 0;

  // 9 year detection (doc-level)
  const combined = questions.map((q) => q.raw_text || q.text || '').join('\n');
  const yearDetected = !!(doc.year || doc.metadata?.year || RE_YEAR.test(combined));

  const avgScore = qResults.length
    ? qResults.reduce((s, r) => s + r.score, 0) / qResults.length : 0;
  // document score: question mean, lightly shaped by separation + empties + year
  let docScore = avgScore;
  if (empty) docScore = 0;
  else {
    docScore = avgScore * (0.85 + 0.15 * separationRate);  // weak separation drags it down
    if (!yearDetected) docScore -= 5;
  }
  docScore = Math.max(0, Math.min(100, Math.round(docScore)));

  return {
    file: meta.file || doc.source_file || null,
    subject: doc.subject || meta.subject || null,
    year: doc.year ?? doc.metadata?.year ?? null,
    round: doc.round ?? null,
    totalQuestions: questions.length,
    emptyQuestions: questions.length - nonEmpty.length,
    score: docScore,
    empty,
    yearDetected,
    reocr: docScore < 60,
    rates: {
      separation: round3(separationRate),
      formula: round3(formulaRate),
      graphMention: round3(graphRate),
    },
    avgMetrics: avgMetrics(qResults),
    questions: qResults,
  };
}

// ── corpus aggregation ─────────────────────────────────────
export function auditCorpus(docsWithMeta) {
  const documents = docsWithMeta.map(({ doc, meta }) => analyzeDocument(doc, meta));
  const allQ = documents.flatMap((d) => d.questions);
  const totalQ = allQ.length;

  const reocrQ = allQ.filter((q) => q.reocr);
  const reocrDocs = documents.filter((d) => d.reocr);
  const emptyDocs = documents.filter((d) => d.empty);

  const corpus = {
    avg_quality_score: round1(mean(documents.map((d) => d.score))),
    total_documents: documents.length,
    total_questions: totalQ,
    reocr_question_count: reocrQ.length,
    reocr_question_ratio: round3(totalQ ? reocrQ.length / totalQ : 0),
    reocr_document_count: reocrDocs.length,
    empty_document_count: emptyDocs.length,
    metrics: {
      avg_text_length: round1(mean(allQ.map((q) => q.length))),
      japanese_ratio: round3(mean(allQ.map((q) => q.japaneseRatio))),
      kanji_ratio: round3(mean(allQ.map((q) => q.kanjiRatio))),
      digit_ratio: round3(mean(allQ.map((q) => q.digitRatio))),
      broken_ratio: round3(mean(allQ.map((q) => q.brokenRatio))),
      question_separation_rate: round3(mean(documents.map((d) => d.rates.separation))),
      formula_detection_rate: round3(mean(documents.map((d) => d.rates.formula))),
      graph_mention_rate: round3(mean(documents.map((d) => d.rates.graphMention))),
      year_detection_rate: round3(documents.length ? documents.filter((d) => d.yearDetected).length / documents.length : 0),
    },
  };

  const reprocess_candidates = {
    documents: reocrDocs
      .map((d) => ({ file: d.file, subject: d.subject, year: d.year, round: d.round, score: d.score, reasons: docReasons(d) }))
      .sort((a, b) => a.score - b.score),
    questions: reocrQ
      .map((q) => ({ id: q.id, number: q.number, score: q.score, reasons: q.reasons }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 200), // worst 200
  };

  return {
    generated_at: new Date().toISOString(),
    rubric: { weights: WEIGHTS, reocr_threshold: 60 },
    corpus,
    reprocess_candidates,
    documents: documents.map(stripQuestionsForReport),
  };
}

// ── markdown report ────────────────────────────────────────
export function renderMarkdown(report) {
  const c = report.corpus;
  const m = c.metrics;
  const pct = (x) => `${Math.round(x * 100)}%`;
  const lines = [];
  lines.push('# OCR 품질 감사 리포트', '');
  lines.push(`- 생성: ${report.generated_at}`);
  lines.push(`- 문서: **${c.total_documents}** · 문항: **${c.total_questions}**`);
  lines.push(`- 평균 품질 점수: **${c.avg_quality_score}/100**`);
  lines.push(`- 재OCR 대상 문항: **${c.reocr_question_count}** (${pct(c.reocr_question_ratio)}) · 재OCR 문서: **${c.reocr_document_count}** · 빈 문서: **${c.empty_document_count}**`, '');
  lines.push('## 코퍼스 지표 (10항목)', '');
  lines.push('| 항목 | 값 |');
  lines.push('|---|---|');
  lines.push(`| 1. 평균 텍스트 길이 | ${m.avg_text_length}자 |`);
  lines.push(`| 2. 일본어 비율 | ${pct(m.japanese_ratio)} |`);
  lines.push(`| 3. 한자 비율 | ${pct(m.kanji_ratio)} |`);
  lines.push(`| 4. 숫자 비율 | ${pct(m.digit_ratio)} |`);
  lines.push(`| 5. OCR 깨짐 문자 비율 | ${pct(m.broken_ratio)} |`);
  lines.push(`| 6. 문항 분리 성공률 | ${pct(m.question_separation_rate)} |`);
  lines.push(`| 7. 수식 검출률 | ${pct(m.formula_detection_rate)} |`);
  lines.push(`| 8. 그래프 언급 검출률 | ${pct(m.graph_mention_rate)} |`);
  lines.push(`| 9. 연도 검출 성공률 | ${pct(m.year_detection_rate)} |`);
  lines.push(`| 10. 빈 문서 수 | ${c.empty_document_count} |`, '');

  lines.push('## 문서별 점수', '');
  lines.push('| 파일 | 과목 | 연/회 | 문항 | 점수 | 재OCR |');
  lines.push('|---|---|---|---|---|---|');
  for (const d of [...report.documents].sort((a, b) => a.score - b.score)) {
    lines.push(`| ${d.file || '-'} | ${d.subject || '-'} | ${d.year ?? '?'}/${d.round ?? '?'} | ${d.totalQuestions} | ${d.score} | ${d.reocr ? '⚠️ 예' : '아니오'} |`);
  }
  lines.push('');

  if (report.reprocess_candidates.documents.length) {
    lines.push('## 재처리 후보 문서 (점수<60)', '');
    for (const d of report.reprocess_candidates.documents) {
      lines.push(`- **${d.file}** (${d.score}) — ${d.reasons.join(', ')}`);
    }
    lines.push('');
  }
  lines.push('## 재처리 후보 문항 (최저 점수, 최대 20개 표시)', '');
  for (const q of report.reprocess_candidates.questions.slice(0, 20)) {
    lines.push(`- #${q.number ?? '?'} \`${(q.id || '').slice(0, 8)}\` 점수 ${q.score} — ${q.reasons.join(', ')}`);
  }
  lines.push('');
  lines.push('> 점수는 휴리스틱 품질 신호이며 정답·정밀 OCR 정확도의 절대값이 아님. 60 미만 = 재OCR 권장.');
  return lines.join('\n');
}

// ── helpers ────────────────────────────────────────────────
function docReasons(d) {
  const r = [];
  if (d.empty) r.push('empty_document');
  if (!d.yearDetected) r.push('year_not_detected');
  if (d.rates.separation < 0.5) r.push('low_separation');
  if (d.avgMetrics.brokenRatio > 0.3) r.push('high_garbage');
  if (d.emptyQuestions > 0) r.push(`empty_questions:${d.emptyQuestions}`);
  return r.length ? r : ['low_overall_score'];
}
function avgMetrics(qResults) {
  return {
    brokenRatio: round3(mean(qResults.map((q) => q.brokenRatio))),
    japaneseRatio: round3(mean(qResults.map((q) => q.japaneseRatio))),
  };
}
function stripQuestionsForReport(d) {
  // keep doc summary; drop per-question detail (lives in reprocess_candidates)
  const { questions, avgMetrics, ...rest } = d;
  return rest;
}
function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function round1(x) { return Math.round(x * 10) / 10; }
function round3(x) { return Math.round(x * 1000) / 1000; }
