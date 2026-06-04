#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// PHASE 4 — Data Quality Gate (CI) — v2 (canonical target)
//
// Fails the build on:
//   • canonical canonical/parsed_questions.json not found
//   • comprehensive domain coverage < 52.8% baseline
//   • review_required ratio increased vs baseline (currently 0%)
//   • number > 100 artifacts in canonical comprehensive
//   • mixed math schemas (>1 distinct)
//   • engine datasets (trendComplete/insights/prediction2026/knowledgeGraph)
//     not loadable or null
//
// Exposed as runGate() for vitest CI test + CLI (non-zero exit on fail).
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);

export function runGate(root = process.cwd()) {
  const violations = [];
  const metrics = {};
  const now = new Date().toISOString();

  // ── [0] Canonical source ─────────────────────────────────────
  const CANONICAL_PATH = path.join(root, 'public', 'dataset', 'canonical', 'parsed_questions.json');
  const CANONICAL_REL = 'public/dataset/canonical/parsed_questions.json';

  if (!exists(CANONICAL_PATH)) {
    violations.push({ rule: 'canonical_not_found', path: CANONICAL_REL });
    return { pass: false, violations, metrics: { ...metrics, canonical: 'NOT_FOUND' } };
  }

  const canonical = J(CANONICAL_PATH);
  const questions = canonical.questions || [];
  const total = questions.length;
  metrics.canonical_total = total;
  metrics.canonical_generatedAt = canonical.generatedAt;

  // ── [1] Domain coverage (comprehensive questions) ────────────
  const VALID_DOMAINS = new Set(['economy', 'politics', 'history', 'geography', 'society']);
  const compQs = questions.filter((q) => q.subject === 'comprehensive');
  const compTotal = compQs.length;
  const validDomain = compQs.filter((q) => q.domain && VALID_DOMAINS.has(q.domain));
  const domainCoverage = compTotal > 0 ? (validDomain.length / compTotal) * 100 : 0;
  metrics.comprehensive_total = compTotal;
  metrics.comprehensive_valid_domains = validDomain.length;
  metrics.comprehensive_domain_coverage_pct = +domainCoverage.toFixed(1);

  // Domain coverage baseline: ≥52.8%
  const DOMAIN_COVERAGE_BASELINE = 52.8;
  if (domainCoverage < DOMAIN_COVERAGE_BASELINE) {
    violations.push({
      rule: 'domain_coverage_below_baseline',
      value: +domainCoverage.toFixed(1),
      baseline: DOMAIN_COVERAGE_BASELINE,
    });
  }

  // ── [2] Review required check (must not increase) ────────────
  const reviewRequired = compQs.filter((q) => q.domain === 'review_required').length;
  const reviewReqPct = compTotal > 0 ? (reviewRequired / compTotal) * 100 : 0;
  metrics.comprehensive_review_required = reviewRequired;
  metrics.comprehensive_review_required_pct = +reviewReqPct.toFixed(1);

  // Baseline: review_required should be 0 (we never introduce it)
  const REVIEW_REQUIRED_BASELINE_PCT = 0;
  if (reviewReqPct > REVIEW_REQUIRED_BASELINE_PCT) {
    violations.push({
      rule: 'review_required_increased',
      value: +reviewReqPct.toFixed(1),
      baseline: REVIEW_REQUIRED_BASELINE_PCT,
    });
  }

  // ── [3] Number > 100 artifacts in canonical comprehensive ────
  const overflow = compQs.filter((q) => {
    const n = q.questionNumber;
    return typeof n === 'number' && n > 100;
  });
  if (overflow.length > 0) {
    violations.push({
      rule: 'canonical_number_gt_100',
      count: overflow.length,
      sample: overflow.slice(0, 5).map((q) => ({
        id: q.id,
        questionNumber: q.questionNumber,
      })),
    });
  }
  metrics.canonical_number_gt_100 = overflow.length;

  // Number > 90 is suspicious (max legit EJU is 38-40)
  const overflow90 = compQs.filter((q) => {
    const n = q.questionNumber;
    return typeof n === 'number' && n > 90;
  });
  metrics.canonical_number_gt_90 = overflow90.length;

  // ── [4] Math schema check ────────────────────────────────────
  const MATH_DIR = path.join(root, 'public', 'dataset', 'mathematics');
  const schemas = new Set();
  if (exists(MATH_DIR)) {
    for (const y of fs.readdirSync(MATH_DIR).filter((d) => /^20/.test(d))) {
      const yearDir = path.join(MATH_DIR, y);
      if (!fs.statSync(yearDir).isDirectory()) continue;
      for (const f of fs.readdirSync(yearDir)) {
        if (!/^exam_.*\.json$/.test(f)) continue;
        try {
          const exam = J(path.join(yearDir, f));
          const q0 = (exam.questions || [])[0];
          if (q0) schemas.add(Object.keys(q0).sort().join(','));
        } catch {}
      }
    }
  }
  if (schemas.size > 1) {
    violations.push({ rule: 'mixed_math_schemas', distinct: schemas.size });
  }
  metrics.math_distinct_schemas = schemas.size;

  // ── [5] Engine datasets presence ─────────────────────────────
  const ENGINE_DATASETS = {
    trendComplete:   path.join(root, 'public', 'dataset', 'trend-analysis', 'trend_analysis_complete.json'),
    insights:        path.join(root, 'public', 'dataset', 'insights', 'insights_v2.json'),
    prediction2026:  path.join(root, 'public', 'dataset', 'prediction', 'prediction_2026.json'),
    knowledgeGraph:  path.join(root, 'public', 'dataset', 'knowledge-graph', 'knowledge_graph_v3.json'),
  };

  const engineResults = {};
  for (const [key, filePath] of Object.entries(ENGINE_DATASETS)) {
    if (!exists(filePath)) {
      engineResults[key] = 'NOT_FOUND';
      violations.push({ rule: `engine_dataset_${key}_not_found`, path: filePath });
    } else {
      try {
        const data = J(filePath);
        if (data === null || (typeof data === 'object' && Object.keys(data).length === 0)) {
          engineResults[key] = 'EMPTY';
          violations.push({ rule: `engine_dataset_${key}_empty` });
        } else {
          engineResults[key] = 'OK';
        }
      } catch (e) {
        engineResults[key] = 'PARSE_ERROR';
        violations.push({ rule: `engine_dataset_${key}_parse_error`, error: e.message });
      }
    }
  }
  metrics.engine_datasets = engineResults;

  // ── Summary ─────────────────────────────────────────────────
  const pass = violations.length === 0;

  return {
    pass,
    violations,
    metrics: {
      ...metrics,
      canonical_path: CANONICAL_REL,
      checkedAt: now,
    },
  };
}

// CLI (robust to non-ASCII paths)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = runGate();
  const status = r.pass ? '✅ PASS' : '❌ FAIL';
  console.log(`[data:gate] ${status} — checkedAt=${r.metrics.checkedAt}`);
  console.log('[data:gate]', JSON.stringify(r.metrics, null, 2));
  if (!r.pass) {
    console.error('[data:gate] Violations:', JSON.stringify(r.violations, null, 2));
    process.exit(1);
  }
}
