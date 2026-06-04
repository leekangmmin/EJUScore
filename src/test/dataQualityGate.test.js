// CI data-quality gate (PHASE 4). Fails the build if canonical datasets regress.
import { describe, it, expect } from 'vitest';
import { runGate } from '../../scripts/data-repair/quality_gate.mjs';

describe('data quality gate (canonical target)', () => {
  const r = runGate(process.cwd());

  it('canonical parsed_questions.json exists', () => {
    expect(r.metrics.canonical_total).toBeGreaterThan(0);
    expect(r.metrics.canonical_path).toBe('public/dataset/canonical/parsed_questions.json');
  });

  it('comprehensive domain coverage ≥ 52.8% baseline', () => {
    const v = r.violations.find((x) => x.rule === 'domain_coverage_below_baseline');
    expect(v, v && `domain coverage ${v.value}% < ${v.baseline}% baseline`).toBeUndefined();
    expect(r.metrics.comprehensive_domain_coverage_pct).toBeGreaterThanOrEqual(52.8);
  });

  it('review_required ratio is 0% (no increase from baseline)', () => {
    const v = r.violations.find((x) => x.rule === 'review_required_increased');
    expect(v, v && `review_required ${v.value}% > ${v.baseline}% baseline`).toBeUndefined();
    expect(r.metrics.comprehensive_review_required_pct).toBe(0);
  });

  it('has NO question number > 100 in canonical (no OCR artifacts)', () => {
    const v = r.violations.find((x) => x.rule === 'canonical_number_gt_100');
    expect(v, v && JSON.stringify(v)).toBeUndefined();
    expect(r.metrics.canonical_number_gt_100).toBe(0);
  });

  it('math has exactly ONE schema', () => {
    const v = r.violations.find((x) => x.rule === 'mixed_math_schemas');
    expect(v, v && `found ${v.distinct} distinct schemas`).toBeUndefined();
    expect(r.metrics.math_distinct_schemas).toBe(1);
  });

  it('engine datasets (trendComplete, insights, prediction2026, knowledgeGraph) are loadable', () => {
    for (const key of ['trendComplete', 'insights', 'prediction2026', 'knowledgeGraph']) {
      const v = r.violations.find((x) => x.rule === `engine_dataset_${key}_not_found` || x.rule === `engine_dataset_${key}_empty`);
      expect(v, `${key}: ${JSON.stringify(v)}`).toBeUndefined();
      expect(r.metrics.engine_datasets[key]).toBe('OK');
    }
  });

  it('overall gate passes', () => {
    expect(r.pass, JSON.stringify(r.violations, null, 2)).toBe(true);
  });
});
