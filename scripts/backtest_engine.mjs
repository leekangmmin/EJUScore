// ═══════════════════════════════════════════════════════════════════
// backtest_engine.mjs
//
// Leave-future-out backtest of the NEW prediction engine
// (Bayesian + Markov + Trend + momentum + recency).
//
// For each test year Y in [START..2025]:
//   - train ONLY on questions with year <= Y-1   (no data leakage)
//   - predict which of the 35 topics appear in year Y (prob >= THRESHOLD)
//   - compare to the actual topics that appeared in Y
// Reports per-year and average precision / recall / F1.
//
// Run:  node scripts/backtest_engine.mjs
// Writes: dataset/prediction_accuracy_v2.json
// ═══════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const GS_PATH = path.join(ROOT, 'dataset/gold_standard/gold_standard.json');
const OUT_PATH = path.join(ROOT, 'dataset/prediction_accuracy_v2.json');

const gs = JSON.parse(fs.readFileSync(GS_PATH, 'utf8'));
const Q = gs.questions;
const YEAR_MIN = 2002, YEAR_MAX = 2025;
const THRESHOLD = 0.5;     // predict "appears" if blended prob >= 0.5
const HALF_LIFE = 8;
const W = { bayes: 0.30, markov: 0.20, trend: 0.20, momentum: 0.15, recency: 0.15 };

// topic -> {year -> count} over the full dataset
const topicYears = new Map();
for (const q of Q) {
  const t = (q.topic || '').trim();
  if (!t) continue;
  if (!topicYears.has(t)) topicYears.set(t, {});
  const yy = topicYears.get(t);
  yy[q.year] = (yy[q.year] || 0) + 1;
}
const ALL_TOPICS = [...topicYears.keys()];

function years(lo, hi) { const a = []; for (let y = lo; y <= hi; y++) a.push(y); return a; }
function presence(yy, lo, hi) { return years(lo, hi).map(y => ((yy[y] || 0) > 0 ? 1 : 0)); }

function bayesScore(vec, n) {
  let S = 0, F = 0;
  for (let i = 0; i < vec.length; i++) {
    const age = (n - 1) - i;
    const w = Math.pow(0.5, age / HALF_LIFE);
    if (vec[i]) S += w; else F += w;
  }
  return (0.5 + S) / (1.0 + S + F);
}
function markov1(vec) {
  const c = [[0, 0], [0, 0]];
  for (let i = 1; i < vec.length; i++) c[vec[i - 1]][vec[i]]++;
  const state = vec[vec.length - 1];
  const tot = c[state][0] + c[state][1] + 2;
  return (c[state][1] + 1) / tot;
}
function olsSlope(yy, lo, hi) {
  const ys = years(lo, hi).map(y => yy[y] || 0);
  const n = ys.length;
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - mx) * (ys[i] - my); den += (i - mx) ** 2; }
  return den ? num / den : 0;
}
function trendScore(yy, lo, hi) { return 1 / (1 + Math.exp(-2.5 * olsSlope(yy, lo, hi))); }
function sumRange(yy, lo, hi) { let s = 0; for (let y = lo; y <= hi; y++) s += yy[y] || 0; return s; }
function momentumScore(yy, hi) {
  const p3 = sumRange(yy, hi - 2, hi);
  const p5 = sumRange(yy, hi - 4, hi);
  const recent3avg = p3 / 3, prior2avg = (p5 - p3) / 2;
  if (prior2avg <= 0) return recent3avg > 0 ? 1 : 0.3;
  return Math.max(0, Math.min(1, 0.5 + (recent3avg - prior2avg) / (prior2avg * 2)));
}
function recencyScore(yy, hi) {
  let last = null;
  for (let y = hi; y >= YEAR_MIN; y--) if ((yy[y] || 0) > 0) { last = y; break; }
  if (last === null) return 0;
  const gap = hi - last;            // gap from the last training year
  if (gap === 0) return 0.875 + Math.min(0.125, sumRange(yy, hi - 2, hi) / 12);
  return Math.max(0, 0.6 - gap * 0.12);
}

function predictYear(Y) {
  const lo = YEAR_MIN, hi = Y - 1, n = hi - lo + 1;
  const results = [];
  for (const t of ALL_TOPICS) {
    const yy = topicYears.get(t);
    if ((yy[hi] === undefined) && sumRange(yy, lo, hi) === 0) continue; // unseen before Y
    const vec = presence(yy, lo, hi);
    const blend =
      W.bayes * bayesScore(vec, n) +
      W.markov * markov1(vec) +
      W.trend * trendScore(yy, lo, hi) +
      W.momentum * momentumScore(yy, hi) +
      W.recency * recencyScore(yy, hi);
    results.push({ topic: t, prob: blend });
  }
  return results;
}

const START = 2016;
const perYear = [];
let sP = 0, sR = 0, sF = 0;
for (let Y = START; Y <= YEAR_MAX; Y++) {
  const preds = predictYear(Y);
  const actual = new Set(ALL_TOPICS.filter(t => (topicYears.get(t)[Y] || 0) > 0));
  let TP = 0, FP = 0, FN = 0;
  const predictedPos = new Set(preds.filter(p => p.prob >= THRESHOLD).map(p => p.topic));
  for (const t of predictedPos) (actual.has(t) ? TP++ : FP++);
  for (const t of actual) if (!predictedPos.has(t)) FN++;
  const prec = TP + FP ? TP / (TP + FP) : 0;
  const rec = TP + FN ? TP / (TP + FN) : 0;
  const f1 = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
  perYear.push({ year: Y, TP, FP, FN, precision: +prec.toFixed(3), recall: +rec.toFixed(3), f1: +f1.toFixed(3) });
  sP += prec; sR += rec; sF += f1;
}
const nY = perYear.length;
const summary = {
  method: 'leave-future-out (train year<=Y-1, predict Y)',
  engine: 'Bayesian(30%)+Markov(20%)+Trend(20%)+Momentum(15%)+Recency(15%)',
  threshold: THRESHOLD,
  test_years: `${START}-${YEAR_MAX}`,
  folds: nY,
  avg_precision: +(sP / nY).toFixed(3),
  avg_recall: +(sR / nY).toFixed(3),
  avg_f1: +(sF / nY).toFixed(3),
  per_year: perYear,
  generated_at: new Date().toISOString(),
  note: 'Task = predict which of the 35 standard topics appear (>=1 question) in the target year, using only prior-year data. No data leakage.',
};
fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2));
console.log('Backtest (leave-future-out, 2016-2025):');
console.log('  avg precision/recall/f1 =', summary.avg_precision, '/', summary.avg_recall, '/', summary.avg_f1);
console.table(perYear);
console.log('written:', OUT_PATH);
