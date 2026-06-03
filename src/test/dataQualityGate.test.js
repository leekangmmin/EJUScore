// CI data-quality gate (PHASE 4). Fails the build if repaired datasets regress.
import { describe, it, expect } from 'vitest';
import { runGate } from '../../scripts/data-repair/quality_gate.mjs';

describe('data quality gate', () => {
  const r = runGate(process.cwd());

  it('has NO question number > 100 (no OCR artifacts)', () => {
    const v = r.violations.find((x) => x.rule === 'number_gt_100');
    expect(v, v && JSON.stringify(v)).toBeUndefined();
    expect(r.metrics.max_number).toBeLessThanOrEqual(100);
  });

  it('has NO 4+ digit artifact numbers', () => {
    expect(r.violations.find((x) => x.rule === 'four_plus_digit_artifact')).toBeUndefined();
  });

  it('comprehensive unknown-domain ≤ 10%', () => {
    expect(r.metrics.comprehensive_unknown_pct).toBeLessThanOrEqual(10);
  });

  it('math has exactly ONE schema', () => {
    expect(r.metrics.math_distinct_schemas).toBe(1);
  });

  it('overall gate passes', () => {
    expect(r.pass, JSON.stringify(r.violations)).toBe(true);
  });
});
