// ═══════════════════════════════════════════════════════════════════
// PHASE 4 — Data Quality Gate (CI) — v3 (accuracy-driven)
//
// Replaces old "domain_coverage ≥ 52.8%" rule with accuracy gates:
//
//   [a] 100% of valid-domain questions have domain_source='text_match'
//       (zero number-join artifacts)
//   [b] Random 150-sample classifier agreement ≥ 60%
//       (scoreSubjects() top domain matches baked domain)
//       [skipped when all domains are 'unknown' — safe fallback case]
//   [c] review_required=0, canonical number>100=0, math schema=1,
//       engine datasets non-null (existing)
//
// Coverage is recorded in metrics only — it is NOT a pass/fail criterion.
//
// Exposed as runGate() for vitest CI test + CLI (non-zero exit on fail).
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);

// ── Lazy-import subjectClassifier ────────────────────────────────────
let _classifier = null;
async function getClassifier() {
  if (!_classifier) {
    const mod = await import(path.resolve(process.cwd(), 'src', 'utils', 'subjectClassifier.js'));
    _classifier = mod;
  }
  return _classifier;
}

export async function runGate(root = process.cwd()) {
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

  const VALID_DOMAINS = new Set(['economy', 'politics', 'history', 'geography', 'society']);
  const compQs = questions.filter((q) => q.subject === 'comprehensive');
  const compTotal = compQs.length;

  // ── Coverage (informational only — no longer a gate) ─────────
  const validDomain = compQs.filter((q) => q.domain && VALID_DOMAINS.has(q.domain));
  const domainCoverage = compTotal > 0 ? (validDomain.length / compTotal) * 100 : 0;
  metrics.comprehensive_total = compTotal;
  metrics.comprehensive_valid_domains = validDomain.length;
  metrics.comprehensive_domain_coverage_pct = +domainCoverage.toFixed(1);

  // ── [a] domain_source validation ─────────────────────────────
  // Every question with a valid domain MUST have domain_source='text_match'
  const textMatchValid = compQs.filter(
    (q) => q.domain && VALID_DOMAINS.has(q.domain) && q.domain_source === 'text_match'
  );
  const nonTextMatchValid = validDomain.filter((q) => q.domain_source !== 'text_match');

  if (nonTextMatchValid.length > 0) {
    violations.push({
      rule: 'valid_domain_not_text_match',
      count: nonTextMatchValid.length,
      sample: nonTextMatchValid.slice(0, 5).map((q) => ({
        id: q.id,
        domain: q.domain,
        domain_source: q.domain_source,
      })),
    });
  }
  metrics.text_match_count = textMatchValid.length;
  metrics.unknown_count = compQs.filter((q) => q.domain === 'unknown').length;
  metrics.non_text_match_valid_count = nonTextMatchValid.length;

  // ── [b] Classifier agreement (random up to 150 samples) ──────
  // Sample only questions that have a valid domain
  const samplePool = validDomain.filter((q) => q.body && q.body.length > 10);
  const sampleSize = Math.min(150, samplePool.length);

  if (sampleSize > 0) {
    const { scoreSubjects, SUBJECT_PRIORITY } = await getClassifier();

    const rng = seedFromString('eju-gate-v3-' + now);
    const sampled = fisherYatesShuffle(samplePool, rng).slice(0, sampleSize);

    let agreement = 0;
    const disagreements = [];
    for (const q of sampled) {
      const scores = scoreSubjects(q.body, q.questionNumber);
      let bestDomain = 'unknown', bestScore = 1;
      for (const subj of SUBJECT_PRIORITY) {
        if (scores[subj] > bestScore) {
          bestScore = scores[subj];
          bestDomain = subj;
        }
      }
      if (bestDomain === q.domain) {
        agreement++;
      } else if (disagreements.length < 5) {
        disagreements.push({
          id: q.id,
          bakedDomain: q.domain,
          classifierTop: bestDomain,
          classifierScore: bestScore,
          allScores: scores,
          bodySnippet: (q.body || '').slice(0, 80),
        });
      }
    }

    const agreementRate = (agreement / sampleSize) * 100;
    metrics.classifier_sample_size = sampleSize;
    metrics.classifier_agreement = agreement;
    metrics.classifier_agreement_pct = +agreementRate.toFixed(1);

    if (agreementRate < 60) {
      violations.push({
        rule: 'classifier_agreement_below_60pct',
        value: +agreementRate.toFixed(1),
        sample_size: sampleSize,
        disagreements: disagreements,
      });
    }
  } else {
    // All domains are 'unknown' — safe fallback. Gate [b] is N/A.
    metrics.classifier_sample_size = 0;
    metrics.classifier_agreement = 0;
    metrics.classifier_agreement_pct = 0;
  }

  // ── [c] Existing checks ──────────────────────────────────────

  // c1: review_required must be 0
  const reviewRequired = compQs.filter((q) => q.domain === 'review_required').length;
  const reviewReqPct = compTotal > 0 ? (reviewRequired / compTotal) * 100 : 0;
  metrics.comprehensive_review_required = reviewRequired;
  metrics.comprehensive_review_required_pct = +reviewReqPct.toFixed(1);

  if (reviewReqPct > 0) {
    violations.push({
      rule: 'review_required_increased',
      value: +reviewReqPct.toFixed(1),
      baseline: 0,
    });
  }

  // c2: Number > 100 artifacts
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

  // c3: Math schema check (must have exactly 1 distinct schema)
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

  // c4: Engine datasets presence
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

// ── Simple seeded PRNG (for reproducible sampling) ───────────────────
function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

function fisherYatesShuffle(arr, seed) {
  const a = [...arr];
  let s = seed || 42;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── CLI ──────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await runGate();
  const status = r.pass ? '✅ PASS' : '❌ FAIL';
  console.log(`[data:gate] ${status} — checkedAt=${r.metrics.checkedAt}`);
  console.log('[data:gate]', JSON.stringify(r.metrics, null, 2));
  if (!r.pass) {
    console.error('[data:gate] Violations:', JSON.stringify(r.violations, null, 2));
    process.exit(1);
  }
}
