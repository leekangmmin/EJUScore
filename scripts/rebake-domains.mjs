#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// REBAKE DOMAINS v3 — Exact text-based domain matching (no prefix)
//
// Matching: ONLY exact match of first 40 normalized chars.
// No prefix matching, no fuzzy matching, no number-join.
//
// NORMALIZATION:
//   norm(text) = NFKC → remove /問\s*\d+/ → remove whitespace/punctuation → first 40 chars
//
// SOURCES (all available):
//   - dataset/comprehensive/20xx/exam_*.json          (individual exam files)
//   - dataset/comprehensive/dataset_consolidated.json  (consolidated)
//   - dataset/_backup_repair_*/dataset/comprehensive/  (backup files)
//
// RULES:
//   - Only index questions with valid domains (economy/politics/history/geography/society)
//   - Exact 40-char norm match only → copy domain + set domain_source='text_match'
//   - No match → domain='unknown', domain_source='none'
//   - NEVER assign review_required or guess
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const CANONICAL_PATH = path.join(ROOT, 'public', 'dataset', 'canonical', 'parsed_questions.json');
const VALID_DOMAINS = new Set(['economy', 'politics', 'history', 'geography', 'society']);

function norm(text, len = 40) {
  if (!text) return '';
  let s = text.normalize('NFKC');
  s = s.replace(/問\s*\d+/g, '');
  s = s.replace(/[\s\u3000\u2000-\u200f\u2028\u2029\u3000,，.．、。()（）「」【】\n\r\t]+/g, '');
  return s.slice(0, len);
}

function collectTexts(q) {
  const texts = [];
  for (const field of ['raw_text', 'text', 'page_text']) {
    const v = q[field];
    if (v && typeof v === 'string' && v.length > 20) texts.push(v);
  }
  // Add answer_choices combined text
  if (Array.isArray(q.answer_choices)) {
    const t = q.answer_choices.map(c => c.text || c).join(' ');
    if (t.length > 20) texts.push(t);
  }
  return [...new Set(texts)];
}

function indexQuestion(entries, q, sourceLabel) {
  const d = q.domain;
  if (!d || !VALID_DOMAINS.has(d)) return 0;
  const texts = collectTexts(q);
  let count = 0;
  for (const text of texts) {
    const key = norm(text, 40);
    if (key && !entries.has(key)) {
      entries.set(key, { domain: d, source: sourceLabel });
      count++;
    }
  }
  return count;
}

function indexExam(entries, examData, label) {
  let count = 0;
  for (const q of examData.questions || []) {
    count += indexQuestion(entries, q, label);
  }
  return count;
}

function buildSourceIndex() {
  const entries = new Map();

  // Source A: Main individual exam files
  const mainDir = path.join(ROOT, 'dataset', 'comprehensive');
  if (fs.existsSync(mainDir)) {
    const years = fs.readdirSync(mainDir).filter(
      (e) => /^20\d{2}$/.test(e) && fs.statSync(path.join(mainDir, e)).isDirectory()
    );
    for (const y of years) {
      for (const f of fs.readdirSync(path.join(mainDir, y))) {
        if (!/^exam_.*\.json$/.test(f)) continue;
        try {
          indexExam(entries, JSON.parse(fs.readFileSync(path.join(mainDir, y, f), 'utf8')), `main_${y}/${f}`);
        } catch (e) {
          console.error(`[rebake] Error ${y}/${f}: ${e.message}`);
        }
      }
    }
    console.error(`[rebake] Source A (main indiv files): indexed`);
  }

  // Source B: Consolidated
  const consPaths = [
    path.join(ROOT, 'dataset', 'comprehensive', 'dataset_consolidated.json'),
    path.join(ROOT, 'public', 'dataset', 'comprehensive', 'dataset_consolidated.json'),
  ];
  for (const cp of consPaths) {
    if (fs.existsSync(cp)) {
      try {
        const cons = JSON.parse(fs.readFileSync(cp, 'utf8'));
        let cnt = 0;
        for (const exam of cons.exams || []) {
          cnt += indexExam(entries, exam, path.basename(path.dirname(path.dirname(cp))) + '_cons');
        }
        if (cnt > 0) console.error(`[rebake] Source B (${path.basename(cp)}): +${cnt}`);
      } catch (e) {
        console.error(`[rebake] Error ${cp}: ${e.message}`);
      }
    }
  }

  // Source C: Backup dirs
  const dsDir = path.join(ROOT, 'dataset');
  if (fs.existsSync(dsDir)) {
    const backups = fs.readdirSync(dsDir).filter(d => d.startsWith('_backup_repair_')).sort().reverse();
    for (const backup of backups) {
      const bDir = path.join(dsDir, backup, 'dataset', 'comprehensive');
      if (!fs.existsSync(bDir)) continue;

      // Individual files
      const years = fs.readdirSync(bDir).filter(e => /^20\d{2}$/.test(e) && fs.statSync(path.join(bDir, e)).isDirectory());
      for (const y of years) {
        for (const f of fs.readdirSync(path.join(bDir, y))) {
          if (!/^exam_.*\.json$/.test(f)) continue;
          try {
            indexExam(entries, JSON.parse(fs.readFileSync(path.join(bDir, y, f), 'utf8')), `backup_${backup}_${y}/${f}`);
          } catch {}
        }
      }
      // Consolidated in backup
      const bcp = path.join(bDir, 'dataset_consolidated.json');
      if (fs.existsSync(bcp)) {
        try {
          const cons = JSON.parse(fs.readFileSync(bcp, 'utf8'));
          for (const exam of cons.exams || []) {
            indexExam(entries, exam, `backup_cons_${backup}`);
          }
        } catch {}
      }
    }
  }

  return entries;
}

function main() {
  console.error('[rebake] === REBAKE DOMAINS v3 (exact 40-char match) ===');

  if (!fs.existsSync(CANONICAL_PATH)) {
    console.error(`[rebake] FATAL: canonical not found`);
    process.exit(1);
  }
  const canonical = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
  console.error(`[rebake] Loaded canonical: ${canonical.totalQuestions} questions`);

  console.error('[rebake] Building source index...');
  const sourceEntries = buildSourceIndex();
  console.error(`[rebake] Source index: ${sourceEntries.size} unique keys`);

  const questions = canonical.questions || [];
  let textMatched = 0, unknownSet = 0, notComp = 0;
  const domainCounts = {};

  for (const q of questions) {
    if (q.subject !== 'comprehensive') { notComp++; continue; }

    const key = norm(q.body, 40);
    const match = key ? sourceEntries.get(key) : null;

    if (match) {
      q.domain = match.domain;
      q.domain_source = 'text_match';
      textMatched++;
      domainCounts[match.domain] = (domainCounts[match.domain] || 0) + 1;
    } else {
      q.domain = 'unknown';
      q.domain_source = 'none';
      unknownSet++;
    }
  }

  fs.writeFileSync(CANONICAL_PATH, JSON.stringify(canonical, null, 2));
  const mirror = path.join(ROOT, 'dataset', 'canonical', 'parsed_questions.json');
  if (fs.existsSync(path.dirname(mirror))) fs.writeFileSync(mirror, JSON.stringify(canonical, null, 2));

  console.error('');
  console.error('=== REBAKE RESULTS ===');
  console.error(`Comprehensive: ${textMatched + unknownSet}`);
  console.error(`  text_match: ${textMatched}`);
  console.error(`  unknown: ${unknownSet}`);
  console.error(`Domain distribution:`);
  for (const [d, c] of Object.entries(domainCounts).sort((a, b) => b[1] - a[1])) {
    console.error(`  ${d}: ${c}`);
  }

  console.log(JSON.stringify({ totalComprehensive: textMatched + unknownSet, textMatch: textMatched, unknown: unknownSet }));
  console.error('[rebake] Done.');
}

main();
