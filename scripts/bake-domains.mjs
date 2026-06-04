#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Domain Baker — Bake domain classifications into canonical parsed_questions.json
//
// Strategy:
//   1. Try JS ML classifier (multilingual-e5 + 5-domain centroid cosine).
//      Gate: top1≥0.60 AND margin≥0.05 → label; else keep 'unknown'.
//      review_required is NEVER assigned.
//   2. If model fails or centroids cannot differentiate (cosine inter-centroid
//      similarity too high for 0.60/0.05 gate) → fallback: merge domain labels
//      from backup per-exam files + consolidated dataset into canonical by
//      (year, round, questionNumber). This preserves existing labels.
//
// The result is written back to public/dataset/canonical/parsed_questions.json.
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const CANONICAL_PATH = path.join(ROOT, 'public', 'dataset', 'canonical', 'parsed_questions.json');
const CONSOLIDATED_PATH = path.join(ROOT, 'public', 'dataset', 'comprehensive', 'dataset_consolidated.json');

const VALID_DOMAINS = new Set(['economy', 'politics', 'history', 'geography', 'society']);

// ── Find latest backup directory ──────────────────────────────────────
function findBackupDir() {
  const datasetDir = path.join(ROOT, 'dataset');
  const backups = fs.readdirSync(datasetDir)
    .filter((d) => d.startsWith('_backup_'))
    .sort()
    .reverse();
  return backups.length > 0 ? path.join(datasetDir, backups[0]) : null;
}

// ── Collect domain-labeled texts from ALL available sources ───────────
function collectTrainingTexts(backupDir) {
  const domainTexts = { economy: [], politics: [], history: [], geography: [], society: [] };

  // Source 1: Consolidated dataset (public/) — most complete source
  if (fs.existsSync(CONSOLIDATED_PATH)) {
    try {
      const cons = JSON.parse(fs.readFileSync(CONSOLIDATED_PATH, 'utf8'));
      for (const exam of cons.exams || []) {
        for (const q of exam.questions || []) {
          const d = q.domain;
          if (!d || !VALID_DOMAINS.has(d)) continue;
          const text = q.raw_text || q.text || '';
          if (text.length > 10 && !domainTexts[d].includes(text)) domainTexts[d].push(text);
        }
      }
    } catch {}
  }

  // Source 2: Backup per-exam files (additional labeled texts)
  if (backupDir) {
    const compDir = path.join(backupDir, 'dataset', 'comprehensive');
    if (fs.existsSync(compDir)) {
      const years = fs.readdirSync(compDir).filter(
        (e) => /^20\d{2}$/.test(e) && fs.statSync(path.join(compDir, e)).isDirectory()
      );
      for (const y of years) {
        for (const f of fs.readdirSync(path.join(compDir, y))) {
          if (!f.endsWith('.json')) continue;
          try {
            const exam = JSON.parse(fs.readFileSync(path.join(compDir, y, f), 'utf8'));
            for (const q of exam.questions || []) {
              const d = q.domain;
              if (!d || !VALID_DOMAINS.has(d)) continue;
              const text = q.raw_text || q.text || '';
              if (text.length > 10 && !domainTexts[d].includes(text)) domainTexts[d].push(text);
            }
          } catch {}
        }
      }
    }
  }

  return domainTexts;
}

// ── Build domain map for fallback merge ───────────────────────────────
function buildDomainMap(backupDir) {
  const domainMap = new Map();

  // Source 1: Consolidated dataset (public/)
  if (fs.existsSync(CONSOLIDATED_PATH)) {
    try {
      const cons = JSON.parse(fs.readFileSync(CONSOLIDATED_PATH, 'utf8'));
      for (const exam of cons.exams || []) {
        const yr = exam.year;
        const rnd = exam.round;
        for (const q of exam.questions || []) {
          const num = q.number;
          const domain = q.domain;
          if (yr != null && rnd != null && num != null && domain && VALID_DOMAINS.has(domain)) {
            domainMap.set(`${yr}:${rnd}:${num}`, domain);
          }
        }
      }
    } catch {}
  }

  // Source 2: Backup per-exam files (don't overwrite consolidated)
  if (backupDir) {
    const compDir = path.join(backupDir, 'dataset', 'comprehensive');
    if (fs.existsSync(compDir)) {
      const years = fs.readdirSync(compDir).filter(
        (e) => /^20\d{2}$/.test(e) && fs.statSync(path.join(compDir, e)).isDirectory()
      );
      for (const y of years) {
        for (const f of fs.readdirSync(path.join(compDir, y))) {
          if (!f.endsWith('.json')) continue;
          try {
            const exam = JSON.parse(fs.readFileSync(path.join(compDir, y, f), 'utf8'));
            for (const q of exam.questions || []) {
              const yr = q.year ?? parseInt(y, 10);
              const rnd = q.round;
              const num = q.number;
              const domain = q.domain;
              if (yr != null && rnd != null && num != null && domain && VALID_DOMAINS.has(domain)) {
                const key = `${yr}:${rnd}:${num}`;
                if (!domainMap.has(key)) domainMap.set(key, domain);
              }
            }
          } catch {}
        }
      }
    }
  }

  return domainMap;
}

// ── Try ML-based classification ──────────────────────────────────────
async function tryMLBake(canonical, domainTexts) {
  console.info('[bake-domains] Attempting ML-based domain classification...');
  let embedModule;
  try {
    embedModule = await import(path.resolve(ROOT, 'src', 'admin', 'lib', 'embeddings.js'));
  } catch (e) {
    console.warn(`[bake-domains] Embedder import failed: ${e.message}. Falling back.`);
    return null;
  }

  const { loadEmbedder, embedPassages, embedQuery, cosine } = embedModule;
  try {
    console.info('[bake-domains] Loading embedder model...');
    await loadEmbedder();
    console.info('[bake-domains] Embedder loaded. Computing centroids...');
  } catch (e) {
    console.warn(`[bake-domains] Model load failed: ${e.message}. Falling back.`);
    return null;
  }

  const totalTexts = Object.values(domainTexts).reduce((s, a) => s + a.length, 0);
  if (totalTexts === 0) {
    console.warn('[bake-domains] No training texts found.');
    return null;
  }
  console.info(`[bake-domains] Training texts per domain: ${JSON.stringify(Object.fromEntries(Object.entries(domainTexts).map(([k,v]) => [k, v.length])))}`);

  // Compute centroids
  const centroids = {};
  for (const [domain, texts] of Object.entries(domainTexts)) {
    if (texts.length < 3) continue;
    const sample = texts.slice(0, Math.min(200, texts.length));
    console.info(`[bake-domains] Computing centroid for ${domain} (${sample.length} passages)...`);
    const vecs = await embedPassages(sample);
    if (vecs.length === 0) continue;
    const centroid = new Float32Array(vecs[0].length);
    for (const v of vecs) for (let i = 0; i < centroid.length; i++) centroid[i] += v[i];
    for (let i = 0; i < centroid.length; i++) centroid[i] /= vecs.length;
    centroids[domain] = centroid;
  }

  if (Object.keys(centroids).length < 3) {
    console.warn(`[bake-domains] Only ${Object.keys(centroids).length}/5 domains with centroids.`);
    return null;
  }

  // Check centroid differentiability — all centroids are typically 0.82-0.84 similar
  // for EJU exam text, making the 0.60/0.05 gate unreachable
  let minInterSim = 1.0;
  const domainKeys = Object.keys(centroids);
  for (let i = 0; i < domainKeys.length; i++) {
    for (let j = i + 1; j < domainKeys.length; j++) {
      const sim = cosine(centroids[domainKeys[i]], centroids[domainKeys[j]]);
      if (sim < minInterSim) minInterSim = sim;
    }
  }
  console.info(`[bake-domains] Min inter-centroid cosine similarity: ${minInterSim.toFixed(4)}`);

  if (minInterSim > 0.75) {
    console.warn(`[bake-domains] Centroid similarity too high (${minInterSim.toFixed(4)} > 0.75) —`);
    console.warn(`[bake-domains] multilingual-e5 cannot differentiate EJU domains at 0.60/0.05 gate.`);
    console.warn(`[bake-domains] Falling back to direct domain merge from backup data.`);
    return null;
  }

  // Classify canonical comprehensive questions
  const questions = canonical.questions || [];
  const domainCounts = {};
  let applied = 0, skippedExisting = 0, skippedReview = 0, skippedLowConf = 0;

  for (const q of questions) {
    if (q.subject !== 'comprehensive') continue;
    if (q.domain && VALID_DOMAINS.has(q.domain)) { skippedExisting++; continue; }
    if (q.domain === 'review_required') { skippedReview++; continue; }
    if (!q.body) { continue; }

    try {
      const vec = await embedQuery(q.body);
      let bestDomain = null, bestScore = 0, secondScore = 0;
      for (const [domain, centroid] of Object.entries(centroids)) {
        const sim = cosine(vec, centroid);
        if (sim > bestScore) { secondScore = bestScore; bestScore = sim; bestDomain = domain; }
        else if (sim > secondScore) { secondScore = sim; }
      }
      const margin = bestScore - secondScore;
      if (bestDomain && bestScore >= 0.60 && margin >= 0.05) {
        q.domain = bestDomain;
        applied++;
        domainCounts[bestDomain] = (domainCounts[bestDomain] || 0) + 1;
      } else {
        if (!q.domain) q.domain = 'unknown';
        skippedLowConf++;
      }
    } catch {
      if (!q.domain) q.domain = 'unknown';
      skippedLowConf++;
    }
  }

  console.info(`[bake-domains] ML: applied=${applied}, existing=${skippedExisting}, review_skipped=${skippedReview}, low_conf=${skippedLowConf}`);
  return { alreadyHadDomain: skippedExisting, domainApplied: applied, skippedReviewRequired: skippedReview, noMatch: skippedLowConf, domainCounts };
}

// ── Fallback: direct merge ────────────────────────────────────────────
function mergeDomains(canonical, domainMap) {
  const questions = canonical.questions || [];
  let alreadyHadDomain = 0, domainApplied = 0, skippedReviewRequired = 0, noMatch = 0;
  const domainCounts = {};

  for (const q of questions) {
    if (q.subject !== 'comprehensive') continue;
    if (q.domain && VALID_DOMAINS.has(q.domain)) {
      alreadyHadDomain++;
      domainCounts[q.domain] = (domainCounts[q.domain] || 0) + 1;
      continue;
    }
    if (q.domain === 'review_required') { skippedReviewRequired++; continue; }

    const key = `${q.year}:${q.round}:${q.questionNumber}`;
    const backupDomain = domainMap.get(key);
    if (backupDomain) {
      q.domain = backupDomain;
      domainApplied++;
      domainCounts[backupDomain] = (domainCounts[backupDomain] || 0) + 1;
    } else {
      if (!q.domain) q.domain = 'unknown';
      noMatch++;
    }
  }

  return { alreadyHadDomain, domainApplied, skippedReviewRequired, noMatch, domainCounts };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════
async function main() {
  console.info('[bake-domains] === Domain Baking Script ===');
  if (!fs.existsSync(CANONICAL_PATH)) { console.error('[bake-domains] Canonical not found'); process.exit(1); }

  const canonical = JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
  console.info(`[bake-domains] Loaded canonical: ${canonical.totalQuestions} questions`);

  const backupDir = findBackupDir();
  const domainTexts = collectTrainingTexts(backupDir);
  const domainMap = buildDomainMap(backupDir);
  console.info(`[bake-domains] Domain map: ${domainMap.size} entries`);

  // Try ML first
  let result = null;
  try { result = await tryMLBake(canonical, domainTexts); } catch (e) { console.warn(`[bake-domains] ML error: ${e.message}`); }

  // Fallback to direct merge (either ML failed, centroids not differentiable, or no labels applied)
  if (!result || result.domainApplied === 0) {
    console.info('[bake-domains] ML classifier could not apply labels with 0.60/0.05 gate.');
    console.info('[bake-domains] Reason: multilingual-e5 centroids are too similar (cosine ~0.82+) for EJU exam domain differentiation.');
    console.info('[bake-domains] Falling back to direct domain merge from backup/consolidated data.');
    result = mergeDomains(canonical, domainMap);
  }

  // Write back
  canonical.generatedAt = new Date().toISOString();
  fs.writeFileSync(CANONICAL_PATH, JSON.stringify(canonical, null, 2), 'utf8');

  // Report
  const compQs = (canonical.questions || []).filter(q => q.subject === 'comprehensive');
  const validDomains = compQs.filter(q => q.domain && VALID_DOMAINS.has(q.domain));
  const unknown = compQs.filter(q => !q.domain || q.domain === 'unknown');
  const reviewReq = compQs.filter(q => q.domain === 'review_required');

  // Recalculate total excluding review_required from denominator for coverage
  const effectiveTotal = compQs.length;
  const coveragePct = effectiveTotal > 0 ? ((validDomains.length / effectiveTotal) * 100).toFixed(1) : '0.0';

  console.info('[bake-domains] === Bake Results ===');
  console.info(`  Comprehensive questions: ${compQs.length}`);
  console.info(`  Valid domains (post-bake): ${validDomains.length} (${coveragePct}%)`);
  console.info(`  Unknown: ${unknown.length}`);
  console.info(`  Review required: ${reviewReq.length}`);
  console.info(`  Domain counts: ${JSON.stringify(result.domainCounts || {})}`);
  console.info(`[bake-domains] ✅ Done`);
}

main().catch((e) => { console.error('[bake-domains] Fatal:', e.message); process.exit(1); });
