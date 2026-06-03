#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Bulk ingester — ocr_output.json → Supabase (batch insert, idempotent).
//
// Handles ≥10,000 questions: streams file-by-file, chunked inserts,
// upserts on natural keys so re-runs are no-ops.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
//   node scripts/ingest/ingest.mjs <file-or-dir> [--batch=500] [--dry-run] [--subject=comprehensive]
//
// Input accepted:
//   • a single exam JSON ({ subject, year, round, questions[] })
//   • a JSON array of exam docs
//   • a directory → all exam_*.json under it (recursive)
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { transformExam, collectTags } from './transform.mjs';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => {
  const m = args.find((a) => a.startsWith(`--${k}=`));
  return m ? m.split('=')[1] : d;
};
const DRY = args.includes('--dry-run');
const BATCH = Math.max(50, Math.min(1000, Number(opt('batch', 500))));
const SUBJECT = opt('subject', null);

if (!target) {
  console.error('usage: node ingest.mjs <file-or-dir> [--batch=500] [--dry-run] [--subject=...]');
  process.exit(1);
}

// ── gather input files ─────────────────────────────────────
function listFiles(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return [p];
  const out = [];
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const fp = path.join(p, e.name);
    if (e.isDirectory()) out.push(...listFiles(fp));
    else if (/^exam_.*\.json$|ocr_output.*\.json$/.test(e.name)) out.push(fp);
  }
  return out;
}

function loadDocs(file) {
  const buf = fs.readFileSync(file);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const json = JSON.parse(buf.toString('utf8'));
  const docs = Array.isArray(json) ? json : [json];
  return docs.map((d) => ({ doc: d, sha256, filename: path.basename(file) }));
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ── main ───────────────────────────────────────────────────
async function main() {
  const files = listFiles(target);
  const transformed = [];
  for (const f of files) {
    for (const { doc, sha256, filename } of loadDocs(f)) {
      const t = transformExam(doc, { sha256, filename, subject: SUBJECT || undefined });
      if (t.ok) transformed.push(t);
      else console.warn(`skip ${filename}: ${t.error}`);
    }
  }

  const totals = transformed.reduce(
    (a, t) => {
      a.exams += 1;
      a.questions += t.questions.length;
      a.choices += t.questions.reduce((s, q) => s + q.choices.length, 0);
      a.qtags += t.questions.reduce((s, q) => s + q.tags.length, 0);
      return a;
    },
    { exams: 0, questions: 0, choices: 0, qtags: 0 }
  );
  const tagVocab = collectTags(transformed);
  console.log(`[ingest] files=${files.length} exams=${totals.exams} questions=${totals.questions} ` +
    `choices=${totals.choices} question_tags=${totals.qtags} unique_tags=${tagVocab.length}`);

  if (DRY) {
    console.log('[dry-run] no writes performed. Counts above are what would be inserted.');
    return;
  }

  // ── live insert via Supabase service-role client ─────────
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars for live ingest.');
    process.exit(2);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // 1) tags upsert → name|kind → id map
  const tagIdByKey = new Map();
  for (const part of chunk(tagVocab, BATCH)) {
    const { data, error } = await sb.from('tags').upsert(part, { onConflict: 'name,kind' }).select('id,name,kind');
    if (error) throw new Error('tags: ' + error.message);
    for (const row of data) tagIdByKey.set(row.name + '|' + row.kind, row.id);
  }

  for (const t of transformed) {
    // 2) source upsert (idempotent by sha256)
    let sourceId = null;
    if (t.source.sha256) {
      const { data, error } = await sb.from('ocr_sources')
        .upsert(t.source, { onConflict: 'sha256' }).select('id').single();
      if (error) throw new Error('ocr_sources: ' + error.message);
      sourceId = data.id;
    }
    // 3) exam upsert (idempotent by subject,year,round)
    const { data: exam, error: exErr } = await sb.from('exams')
      .upsert(t.exam, { onConflict: 'subject,exam_year,exam_round' }).select('id').single();
    if (exErr) throw new Error('exams: ' + exErr.message);

    // 4) questions: assign ids + fks, batch insert (ignore dup by exam,number,hash)
    const qRows = t.questions.map((q) => ({
      id: q.id || crypto.randomUUID(),
      exam_id: exam.id, source_id: sourceId,
      subject: q.subject, exam_year: q.exam_year, exam_round: q.exam_round,
      number: q.number, domain: q.domain, topic: q.topic, subtopic: q.subtopic,
      question_type: q.question_type, difficulty: q.difficulty,
      raw_text: q.raw_text, text: q.text, ocr_confidence: q.ocr_confidence,
      word_count: q.word_count, line_count: q.line_count,
      has_table: q.has_table, has_diagram: q.has_diagram,
      has_graph: q.has_graph, has_map: q.has_map,
      content_hash: q.content_hash, review_status: q.review_status,
    }));
    for (const part of chunk(qRows, BATCH)) {
      const { error } = await sb.from('questions')
        .upsert(part, { onConflict: 'exam_id,number,content_hash', ignoreDuplicates: true });
      if (error) throw new Error('questions: ' + error.message);
    }

    // 5) choices + 6) question_tags (reference q.id)
    const choiceRows = [];
    const qtagRows = [];
    t.questions.forEach((q, i) => {
      const qid = qRows[i].id;
      for (const c of q.choices) choiceRows.push({ question_id: qid, ...c });
      for (const tag of q.tags) {
        const tid = tagIdByKey.get(tag.name + '|' + tag.kind);
        if (tid) qtagRows.push({ question_id: qid, tag_id: tid, weight: tag.weight, source: tag.source });
      }
    });
    for (const part of chunk(choiceRows, BATCH)) {
      const { error } = await sb.from('choices').upsert(part, { onConflict: 'question_id,ordinal', ignoreDuplicates: true });
      if (error) throw new Error('choices: ' + error.message);
    }
    for (const part of chunk(qtagRows, BATCH)) {
      const { error } = await sb.from('question_tags').upsert(part, { onConflict: 'question_id,tag_id', ignoreDuplicates: true });
      if (error) throw new Error('question_tags: ' + error.message);
    }
    console.log(`  ✓ ${t.exam.exam_name}: ${qRows.length} questions`);
  }

  console.log('[ingest] done. Remember: refresh topic_frequency + backfill embeddings (see BACKEND_PLAN.md).');
}

main().catch((e) => { console.error('[ingest] FAILED:', e.message); process.exit(1); });
