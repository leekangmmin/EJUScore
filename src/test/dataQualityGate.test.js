// CI data-quality gate (PHASE 4, v3 accuracy-driven). Fails the build if
// canonical datasets regress. runGate() is async (loads a classifier for the
// accuracy check), so it must be awaited.
import { describe, it, expect, beforeAll } from 'vitest';
import { runGate } from '../../scripts/data-repair/quality_gate.mjs';

describe('data quality gate (canonical target)', () => {
  let r;
  beforeAll(async () => { r = await runGate(process.cwd()); });

  it('canonical parsed_questions.json exists', () => {
    expect(r.metrics.canonical_total).toBeGreaterThan(0);
    expect(r.metrics.canonical_path).toBe('public/dataset/canonical/parsed_questions.json');
  });

  // v3: domain coverage is INFORMATIONAL (correctness > coverage). Domains may
  // be honestly 'unknown' until a reliable classifier fills them — the gate must
  // NOT fail on low coverage, only on WRONG labels (accuracy gate below).
  it('domain coverage metric is reported (informational, not a pass gate)', () => {
    expect(typeof r.metrics.comprehensive_domain_coverage_pct).toBe('number');
  });

  it('no WRONG labels: assigned domains pass the accuracy gate', () => {
    expect(r.violations.find((x) => x.rule === 'domain_accuracy_below_baseline')).toBeUndefined();
  });

  it('review_required ratio is 0%', () => {
    expect(r.metrics.comprehensive_review_required_pct).toBe(0);
  });

  it('has NO question number > 100 in canonical (no OCR artifacts)', () => {
    expect(r.violations.find((x) => x.rule === 'canonical_number_gt_100')).toBeUndefined();
    expect(r.metrics.canonical_number_gt_100).toBe(0);
  });

  it('math has exactly ONE schema', () => {
    expect(r.violations.find((x) => x.rule === 'mixed_math_schemas')).toBeUndefined();
    expect(r.metrics.math_distinct_schemas).toBe(1);
  });

  it('engine datasets (trendComplete, insights, prediction2026, knowledgeGraph) are loadable', () => {
    for (const key of ['trendComplete', 'insights', 'prediction2026', 'knowledgeGraph']) {
      expect(r.metrics.engine_datasets[key]).toBe('OK');
    }
  });

  it('overall gate passes', () => {
    expect(r.pass, JSON.stringify(r.violations, null, 2)).toBe(true);
  });
});
