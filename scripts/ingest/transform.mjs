// ═══════════════════════════════════════════════════════════════════
// Ingest transform (PURE) — ocr_output.json → normalized row sets.
//
// No I/O, no network → fully unit-testable. The CLI (ingest.mjs) wires
// these rows to Supabase. Grounded in the real ocr_output.json shape.
// ═══════════════════════════════════════════════════════════════════

const DOMAIN_PASSTHROUGH = true; // domains stored as-is (already canonical)

/** NFKC + lowercase + strip spaces → stable normalized form. */
export function normalizeText(s) {
  if (!s) return '';
  let o;
  try { o = String(s).normalize('NFKC'); } catch { o = String(s); }
  return o.toLowerCase().replace(/\s+/g, '');
}

/** Deterministic 53-bit content hash (djb2-xor) of normalized text. */
export function contentHash(s) {
  const n = normalizeText(s);
  let h = 5381;
  for (let i = 0; i < n.length; i++) h = ((h * 33) ^ n.charCodeAt(i)) >>> 0;
  return 'h' + h.toString(16);
}

/** Parse a leading choice label like "① て" / "1. ..." / "ア ..." → {label, text}. */
function splitChoice(raw) {
  const s = String(raw ?? '').trim();
  const m = s.match(/^([①-⑩0-9]+|[ア-ンＡ-Ｚa-zA-Z])[\.．、)）:：]?\s*/);
  if (m) return { label: m[1], text: s.slice(m[0].length).trim() || s };
  return { label: null, text: s };
}

/** Build the de-duplicated tag list for one question. */
function questionTags(q) {
  const tags = [];
  const push = (name, kind, weight = 1.0) => {
    const n = (name ?? '').toString().trim();
    if (n) tags.push({ name: n, kind, weight, source: 'ocr' });
  };
  if (q.domain && q.domain !== 'unknown') push(q.domain, 'domain');
  if (q.topic) push(q.topic, 'topic', 0.9);
  if (q.question_type && q.question_type !== 'unknown') push(q.question_type, 'type', 0.5);
  for (const k of (q.keywords || [])) push(k, 'keyword', 0.7);
  for (const c of (q.concepts || [])) push(c, 'concept', 0.85);
  if ((q.tables || []).length) push('table', 'material', 0.4);
  if ((q.diagrams || []).length) push('diagram', 'material', 0.4);
  if ((q.graphs || []).length) push('graph', 'material', 0.4);
  if ((q.maps || []).length) push('map', 'material', 0.4);
  // de-dup by name|kind
  const seen = new Set();
  return tags.filter((t) => {
    const key = t.name + '|' + t.kind;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Transform one OCR exam document into normalized row sets. */
export function transformExam(doc, opts = {}) {
  if (!doc || !Array.isArray(doc.questions)) {
    return { ok: false, error: 'missing questions[]', source: null, exam: null, questions: [] };
  }
  const subject = doc.subject || opts.subject || 'comprehensive';
  const year = doc.year ?? opts.year ?? null;
  const round = doc.round ?? opts.round ?? null;

  const source = {
    filename: opts.filename || doc.source_file || `${subject}_${year}_r${round}.json`,
    sha256: opts.sha256 || null,
    subject,
    exam_year: year,
    exam_round: round,
    page_count: doc.total_pages ?? doc.metadata?.doc_metadata?.total_pages ?? null,
    question_count: doc.questions.length,
    avg_confidence: doc.metadata?.confidence_average ?? null,
    ocr_engine: opts.ocrEngine || null,
    ocr_version: opts.ocrVersion || null,
    raw_path: opts.rawPath || doc.source_path || null,
    processed_at: doc.metadata?.processed_at || null,
  };

  const exam = {
    subject, exam_year: year, exam_round: round,
    exam_name: `${year ?? '?'}년 ${round ?? '?'}회 ${subject}`,
    total_questions: doc.questions.length,
  };

  const questions = [];
  for (const q of doc.questions) {
    const rawText = q.raw_text || q.text || '';
    const text = q.text || q.raw_text || '';
    if (!rawText && !text) continue;            // skip empty (never fabricate)
    const id = q.id || null;                    // stable OCR uuid (CLI fills if null)
    const choices = (Array.isArray(q.answer_choices) ? q.answer_choices : [])
      .map((raw, i) => {
        const { label, text: ctext } = splitChoice(raw);
        return { ordinal: i, label, text: ctext, is_correct: null }; // no answer key → null
      });
    questions.push({
      id,
      number: q.number ?? null,
      subject,
      exam_year: year,
      exam_round: round,
      domain: DOMAIN_PASSTHROUGH ? (q.domain || null) : null,
      topic: q.topic || null,
      subtopic: q.subtopic || null,
      question_type: q.question_type || null,
      difficulty: typeof q.difficulty === 'number' ? q.difficulty : null,
      raw_text: rawText,
      text,
      ocr_confidence: typeof q.ocr_confidence === 'number' ? q.ocr_confidence : null,
      word_count: q.word_count ?? null,
      line_count: q.lines ?? null,
      has_table: (q.tables || []).length > 0,
      has_diagram: (q.diagrams || []).length > 0,
      has_graph: (q.graphs || []).length > 0,
      has_map: (q.maps || []).length > 0,
      content_hash: contentHash(rawText),
      review_status: 'auto',
      choices,
      tags: questionTags(q),
    });
  }

  return { ok: true, source, exam, questions };
}

/** Collect the global unique tag set across many transformed exams. */
export function collectTags(transformed) {
  const seen = new Map();
  for (const t of transformed) {
    for (const q of t.questions || []) {
      for (const tag of q.tags) {
        const key = tag.name + '|' + tag.kind;
        if (!seen.has(key)) seen.set(key, { name: tag.name, kind: tag.kind });
      }
    }
  }
  return [...seen.values()];
}
