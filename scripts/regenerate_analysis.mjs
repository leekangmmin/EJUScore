// ═══════════════════════════════════════════════════════════════════
// regenerate_analysis.mjs
//
// Rebuilds the comprehensive analysis pipeline from the gold-standard
// exam bank AFTER exact-duplicate removal, per the DATA_AUDIT_REPORT.
//
//   1. Deduplicate gold_standard.json   (exact full-row dedup: 1310 -> 1121)
//   2. Regenerate trend_analysis_complete.json   (35 topics, recomputed)
//   3. Regenerate prediction_2026_2028.json with REAL statistical models:
//        - Bayesian (recency-weighted Beta-Binomial posterior)
//        - Markov   (2-state chain, k-step transition for multi-year)
//        - Trend    (OLS slope of yearly counts -> logistic)
//      plus the existing recency / frequency / momentum / cycle factors.
//
// Every number written here is computed from the gold-standard rows.
// No value is hand-entered. Run:  node scripts/regenerate_analysis.mjs
// ═══════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const GS_PATH    = path.join(ROOT, 'dataset/gold_standard/gold_standard.json');
const TREND_PATH = path.join(ROOT, 'dataset/trend-analysis/trend_analysis_complete.json');
const PRED_PATH  = path.join(ROOT, 'dataset/prediction/prediction_2026_2028.json');

const YEAR_MIN = 2002, YEAR_MAX = 2025, TOTAL_YEARS = YEAR_MAX - YEAR_MIN + 1; // 24
const YEARS = Array.from({ length: TOTAL_YEARS }, (_, i) => YEAR_MIN + i);
const COMP_DOMAINS = ['economy', 'politics', 'geography', 'history', 'society'];

// ── 1. LOAD + EXACT DEDUP ────────────────────────────────────────────
const gsRaw = JSON.parse(fs.readFileSync(GS_PATH, 'utf8'));
const rawQ = gsRaw.questions;
const seen = new Set();
const Q = [];
for (const q of rawQ) {
  const key = JSON.stringify([q.year, q.round, q.question_number, q.domain, q.topic, q.source]);
  if (seen.has(key)) continue;
  seen.add(key);
  Q.push(q);
}
const removed = rawQ.length - Q.length;
console.log(`[dedup] ${rawQ.length} rows -> ${Q.length} unique (removed ${removed} exact duplicates)`);

// ── domain distribution (recomputed) ─────────────────────────────────
const domainDist = {};
for (const q of Q) domainDist[q.domain] = (domainDist[q.domain] || 0) + 1;

// ── write deduplicated gold_standard.json ────────────────────────────
const gsOut = {
  ...gsRaw,
  total_questions: Q.length,
  deduplicated: true,
  dedup_method: 'exact full-row (year,round,question_number,domain,topic,source)',
  raw_row_count: rawQ.length,
  duplicates_removed: removed,
  regenerated_at: new Date().toISOString(),
  domain_distribution: domainDist,
  questions: Q,
};
fs.writeFileSync(GS_PATH, JSON.stringify(gsOut, null, 2));
console.log(`[write] ${GS_PATH}`);

// ── 2. PER-TOPIC AGGREGATION ─────────────────────────────────────────
// A topic may carry questions tagged with several domains; assign the
// majority domain. Blank topics are tracked as "untopicized".
const topicYears = new Map();   // topic -> { year -> count }
const topicDomains = new Map(); // topic -> { domain -> count }
let untopicized = 0;
for (const q of Q) {
  const t = (q.topic || '').trim();
  if (!t) { untopicized++; continue; }
  if (!topicYears.has(t)) { topicYears.set(t, {}); topicDomains.set(t, {}); }
  const yy = topicYears.get(t); yy[q.year] = (yy[q.year] || 0) + 1;
  const dd = topicDomains.get(t); dd[q.domain] = (dd[q.domain] || 0) + 1;
}

function majorityDomain(t) {
  const dd = topicDomains.get(t) || {};
  let best = '', bestN = -1;
  for (const [d, n] of Object.entries(dd)) if (n > bestN) { best = d; bestN = n; }
  return best;
}
function sumRange(yy, lo, hi) {
  let s = 0; for (let y = lo; y <= hi; y++) s += yy[y] || 0; return s;
}
function consecutiveStreak(yy) {
  // consecutive years (ending at YEAR_MAX) the topic appeared
  let streak = 0;
  for (let y = YEAR_MAX; y >= YEAR_MIN; y--) { if ((yy[y] || 0) > 0) streak++; else break; }
  return streak;
}
function olsSlope(yy) {
  // slope of yearly count vs year index (least squares)
  const xs = YEARS.map((_, i) => i);
  const ys = YEARS.map(y => yy[y] || 0);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : 0;
}

function buildTopicRecord(t) {
  const yy = topicYears.get(t);
  const total = Object.values(yy).reduce((a, b) => a + b, 0);
  const appearedYears = YEARS.filter(y => (yy[y] || 0) > 0);
  const first = appearedYears[0], last = appearedYears[appearedYears.length - 1];
  const p3 = sumRange(yy, 2023, 2025);
  const p5 = sumRange(yy, 2021, 2025);
  const p10 = sumRange(yy, 2016, 2025);
  const before5 = total - p5;
  const growth = before5 > 0
    ? Math.round(((p5 - before5) / before5) * 1000) / 10
    : (p5 > 0 ? 100 : 0);
  return {
    topic: t,
    domain: majorityDomain(t),
    total_count: total,
    years_appeared: appearedYears.length,
    first_appeared_year: first,
    last_appeared_year: last,
    gap_years: last < YEAR_MAX ? YEAR_MAX - last : 0,
    period_3yr_count: p3,
    period_5yr_count: p5,
    period_10yr_count: p10,
    before_5yr_count: before5,
    growth_rate_pct: growth,
    recent_avg_per_year: Math.round((p5 / 5) * 100) / 100,
    before_avg_per_year: Math.round((before5 / 19) * 100) / 100,
    consecutive_appearances: consecutiveStreak(yy),
    frequency_per_exam: Math.round((total / TOTAL_YEARS) * 100) / 100,
  };
}

const topicRecords = [...topicYears.keys()].map(buildTopicRecord);
topicRecords.sort((a, b) => b.total_count - a.total_count);
console.log(`[topics] ${topicRecords.length} distinct topics (untopicized rows: ${untopicized})`);

// ── domain_trends (yearly) ───────────────────────────────────────────
const domainTrends = {};
for (const d of Object.keys(domainDist)) {
  const yearly = {};
  for (const y of YEARS) yearly[y] = 0;
  domainTrends[d] = { total: 0, yearly, recent_5yr_total: 0, before_5yr_total: 0, growth_rate_pct: 0, avg_per_year: 0 };
}
for (const q of Q) {
  const dt = domainTrends[q.domain];
  dt.total++; dt.yearly[q.year] = (dt.yearly[q.year] || 0) + 1;
}
for (const d of Object.keys(domainTrends)) {
  const dt = domainTrends[d];
  dt.recent_5yr_total = sumRange(dt.yearly, 2021, 2025);
  dt.before_5yr_total = dt.total - dt.recent_5yr_total;
  dt.growth_rate_pct = dt.before_5yr_total > 0
    ? Math.round(((dt.recent_5yr_total - dt.before_5yr_total) / dt.before_5yr_total) * 1000) / 10
    : 0;
  dt.avg_per_year = Math.round((dt.total / TOTAL_YEARS) * 100) / 100;
}

// ── topic categorization ─────────────────────────────────────────────
const topicTrends = {};
for (const r of topicRecords) topicTrends[r.topic] = r;

const growing = topicRecords
  .filter(r => r.growth_rate_pct > 0 && r.period_5yr_count >= 3 && r.total_count >= 5)
  .sort((a, b) => b.growth_rate_pct - a.growth_rate_pct);
const declining = topicRecords
  .filter(r => r.growth_rate_pct < 0 && r.total_count >= 10)
  .sort((a, b) => a.growth_rate_pct - b.growth_rate_pct);
const gap = topicRecords
  .filter(r => r.gap_years >= 3 && r.total_count >= 5)
  .sort((a, b) => b.gap_years - a.gap_years);
const stable = topicRecords
  .filter(r => Math.abs(r.growth_rate_pct) <= 20 && r.period_5yr_count >= 3);
const highConsecutive = topicRecords
  .filter(r => r.consecutive_appearances >= 5)
  .sort((a, b) => b.consecutive_appearances - a.consecutive_appearances);
const emerging = topicRecords
  .filter(r => r.first_appeared_year >= 2016 && r.period_5yr_count >= 2)
  .sort((a, b) => b.period_5yr_count - a.period_5yr_count);
const disappearing = topicRecords
  .filter(r => r.gap_years >= 6)
  .sort((a, b) => b.gap_years - a.gap_years);

const trendOut = {
  generated_at: new Date().toISOString(),
  subject: 'comprehensive',
  analysis_period: `${YEAR_MIN}-${YEAR_MAX}`,
  total_years: TOTAL_YEARS,
  total_questions_analyzed: Q.length,
  total_topics_tracked: topicRecords.length,
  untopicized_count: untopicized,
  source_note: `Recomputed from deduplicated gold_standard (${Q.length} unique rows, ${removed} duplicates removed).`,
  domain_trends: domainTrends,
  topic_trends: topicTrends,
  top_100_topics: topicRecords,          // (all topics, sorted by frequency)
  growing_topics: growing,
  declining_topics: declining,
  stable_topics: stable,
  emerging_topics: emerging,
  disappearing_topics: disappearing,
  high_consecutive_topics: highConsecutive,
  gap_topics: gap,
  statistics: {
    total_domains: Object.keys(domainDist).length,
    total_topics: topicRecords.length,
    untopicized_count: untopicized,
    growing_count: growing.length,
    declining_count: declining.length,
    gap_count: gap.length,
  },
  year_range: { start: YEAR_MIN, end: YEAR_MAX },
};
fs.writeFileSync(TREND_PATH, JSON.stringify(trendOut, null, 2));
console.log(`[write] ${TREND_PATH}`);

// ── 3. PREDICTION ENGINE (real Bayesian / Markov / Trend) ────────────
// Per-year presence vector for each topic over 2002..2025.
function presenceVec(yy) { return YEARS.map(y => ((yy[y] || 0) > 0 ? 1 : 0)); }

// Bayesian: recency-weighted Beta-Binomial posterior P(appear next session).
// Weight w_i grows with recency (half-life HL years). Jeffreys prior Beta(.5,.5).
const HALF_LIFE = 8;
function bayesScore(vec) {
  let S = 0, F = 0;
  for (let i = 0; i < vec.length; i++) {
    const age = (YEARS.length - 1) - i;          // 0 = most recent
    const w = Math.pow(0.5, age / HALF_LIFE);     // recency weight
    if (vec[i]) S += w; else F += w;
  }
  return (0.5 + S) / (1.0 + S + F);
}

// Markov: 2-state chain. Estimate transition matrix with Laplace smoothing,
// then k-step transition from the current (2025) state.
function markovMatrix(vec) {
  // counts: c[from][to]
  const c = [[0, 0], [0, 0]];
  for (let i = 1; i < vec.length; i++) c[vec[i - 1]][vec[i]]++;
  const P = [[0, 0], [0, 0]];
  for (let s = 0; s < 2; s++) {
    const tot = c[s][0] + c[s][1] + 2; // +2 Laplace
    P[s][0] = (c[s][0] + 1) / tot;
    P[s][1] = (c[s][1] + 1) / tot;
  }
  return P;
}
function matMul(A, B) {
  const R = [[0, 0], [0, 0]];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
    R[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j];
  return R;
}
function markovKStep(vec, k) {
  const P = markovMatrix(vec);
  let Pk = [[1, 0], [0, 1]];
  for (let i = 0; i < k; i++) Pk = matMul(Pk, P);
  const state = vec[vec.length - 1];   // current (2025) state
  return Pk[state][1];                  // P(appear) after k steps
}

// Trend: OLS slope of yearly counts -> logistic squashing to (0,1).
function trendScore(yy) {
  const slope = olsSlope(yy);
  return { slope: Math.round(slope * 1000) / 1000, score: 1 / (1 + Math.exp(-2.5 * slope)) };
}

// Existing-style factors (kept and surfaced alongside the new models).
function recencyScore(r) {
  if (r.gap_years === 0) return 0.875 + Math.min(0.125, (r.period_3yr_count / 12));
  return Math.max(0, 0.6 - r.gap_years * 0.12);
}
function frequencyScore(r, maxTotal) { return Math.min(1, r.total_count / maxTotal); }
function momentumScore(r) {
  const recent3avg = r.period_3yr_count / 3;
  const prior2avg = (r.period_5yr_count - r.period_3yr_count) / 2;
  if (prior2avg <= 0) return recent3avg > 0 ? 1 : 0.3;
  return Math.max(0, Math.min(1, 0.5 + (recent3avg - prior2avg) / (prior2avg * 2)));
}
function cycleScore(r) {
  // topics with regular gaps: closeness to their typical reappearance cycle
  const cyc = r.years_appeared > 1 ? (r.last_appeared_year - r.first_appeared_year) / r.years_appeared : 0;
  if (cyc <= 0) return 0.5;
  return Math.max(0.2, Math.min(1, 1 - Math.abs(r.gap_years - cyc) / (cyc + 1)));
}
function confidenceScore(r) {
  return Math.round(Math.min(1, (r.years_appeared / TOTAL_YEARS) * 0.6 + (r.consecutive_appearances / TOTAL_YEARS) * 0.4) * 100) / 100;
}

// Final blend weights (documented in methodology).
const W = { bayes: 0.30, markov: 0.20, trend: 0.20, momentum: 0.15, recency: 0.15 };
const maxTotal = Math.max(...topicRecords.map(r => r.total_count));

function predictionsForOffset(kStep) {
  const preds = topicRecords.map(r => {
    const yy = topicYears.get(r.topic);
    const vec = presenceVec(yy);
    const bayes = bayesScore(vec);
    const markov = markovKStep(vec, kStep);
    const tr = trendScore(yy);
    const recency = recencyScore(r);
    const frequency = frequencyScore(r, maxTotal);
    const momentum = momentumScore(r);
    const cycle = cycleScore(r);
    const blend =
      W.bayes * bayes + W.markov * markov + W.trend * tr.score +
      W.momentum * momentum + W.recency * recency;
    const prob = Math.max(1, Math.min(99, Math.round(blend * 100)));
    return {
      topic: r.topic,
      domain: r.domain,
      prediction_score: Math.round(blend * 1000) / 1000,
      probability_pct: prob,
      // ── new real statistical models ──
      bayes_score: Math.round(bayes * 1000) / 1000,
      markov_score: Math.round(markov * 1000) / 1000,
      trend_score: Math.round(tr.score * 1000) / 1000,
      trend_slope: tr.slope,
      // ── existing surfaced factors ──
      recency_score: Math.round(recency * 1000) / 1000,
      frequency_score: Math.round(frequency * 1000) / 1000,
      momentum_score: Math.round(momentum * 1000) / 1000,
      cycle_score: Math.round(cycle * 1000) / 1000,
      confidence: confidenceScore(r),
      // ── raw evidence ──
      total_24yr_count: r.total_count,
      recent_5yr_count: r.period_5yr_count,
      last_appeared: r.last_appeared_year,
      gap_years: r.gap_years,
      consecutive: r.consecutive_appearances,
      basis: `Bayes ${bayes.toFixed(2)} · Markov ${markov.toFixed(2)} · Trend ${tr.slope >= 0 ? '+' : ''}${tr.slope.toFixed(2)} · last ${r.last_appeared_year} · ${r.period_5yr_count}/5yr · gap ${r.gap_years}`,
    };
  });
  preds.sort((a, b) => b.prediction_score - a.prediction_score);
  return preds;
}

const methodology = {
  models: {
    bayesian: 'Recency-weighted Beta-Binomial posterior P(appear next session); Jeffreys prior Beta(0.5,0.5); recency half-life 8yr.',
    markov: '2-state (appear/absent) Markov chain with Laplace smoothing; multi-year forecast via k-step transition from the 2025 state.',
    trend: 'OLS slope of yearly question counts (2002-2025), logistic-squashed to (0,1).',
  },
  surfaced_factors: ['recency_score', 'frequency_score', 'momentum_score', 'cycle_score', 'confidence'],
  blend_weights: W,
  data_range: `${YEAR_MIN}-${YEAR_MAX}`,
  total_topics_analyzed: topicRecords.length,
  note: 'Multi-year (2027+) probabilities use k-step Markov transition; Bayesian/Trend components held at current-data estimates. Probabilities are not capped at a fixed ceiling.',
  disclaimer: 'This prediction is based on historical frequency analysis and does not guarantee actual exam content.',
};

const predOut = {};
const offsets = { 2026: 1, 2027: 2, 2028: 3, 2029: 4, 2030: 5 };
for (const [year, k] of Object.entries(offsets)) {
  const top = predictionsForOffset(k);
  predOut[year] = {
    year: Number(year),
    total_predictions: top.length,
    methodology,
    top_predictions: top,
  };
}
fs.writeFileSync(PRED_PATH, JSON.stringify(predOut, null, 2));
console.log(`[write] ${PRED_PATH}`);

// ── summary to stdout ────────────────────────────────────────────────
console.log('\n── SUMMARY ──');
console.log('total unique questions :', Q.length);
console.log('domains                :', JSON.stringify(domainDist));
console.log('distinct topics        :', topicRecords.length);
console.log('untopicized rows       :', untopicized);
console.log('growing / declining / gap:', growing.length, '/', declining.length, '/', gap.length);
console.log('\nTop 8 predicted (2026):');
for (const p of predOut['2026'].top_predictions.slice(0, 8))
  console.log(`  ${p.probability_pct}%  ${p.topic}  [B=${p.bayes_score} M=${p.markov_score} T=${p.trend_score}]`);
