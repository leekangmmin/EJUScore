// ═══════════════════════════════════════════════════════════════════
// generate_insights.mjs
//
// EJU-academy-level analysis layer. ALL numbers derived from REAL data:
//   - gold_standard.json (1,121 Q, 2002-2025, 35 topics)  -> authoritative
//   - comprehensive/dataset_consolidated.json (OCR text)  -> 2002-2015 only
//
// Emits dataset/insights/insights_v2.json consumed by TrendDashboard.
// HONESTY: no fabricated dimensions. Features that lack real data are
// flagged data_available:false rather than invented.
//
// Run:  node scripts/generate_insights.mjs
// ═══════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const GS = JSON.parse(fs.readFileSync(path.join(ROOT, 'dataset/gold_standard/gold_standard.json'), 'utf8'));
const COMP = JSON.parse(fs.readFileSync(path.join(ROOT, 'dataset/comprehensive/dataset_consolidated.json'), 'utf8'));
const PRED = JSON.parse(fs.readFileSync(path.join(ROOT, 'dataset/prediction/prediction_2026_2028.json'), 'utf8'));

const Q = GS.questions;
const YEAR_MIN = 2002, YEAR_MAX = 2025;
const Y_TEXT_MAX = 2015;            // OCR question text exists only through 2015
const EXAM_COUNT = 44;             // distinct (year, round) sessions

const DOMAIN_KO = { economy: '경제', politics: '정치', geography: '지리', history: '역사', society: '사회' };
const COMP_KEYS = ['economy', 'politics', 'geography', 'history', 'society'];

// ── topic -> sorted appearance years (with counts) ──────────────────
const topicYears = new Map();   // topic -> {year -> count}
const topicDomain = new Map();  // topic -> {domain -> count}
for (const q of Q) {
  const t = (q.topic || '').trim();
  if (!t) continue;
  if (!topicYears.has(t)) { topicYears.set(t, {}); topicDomain.set(t, {}); }
  const yy = topicYears.get(t); yy[q.year] = (yy[q.year] || 0) + 1;
  const dd = topicDomain.get(t); dd[q.domain] = (dd[q.domain] || 0) + 1;
}
const ALL_TOPICS = [...topicYears.keys()];
const majorityDomain = (t) => {
  const dd = topicDomain.get(t); let best = 'society', n = -1;
  for (const d in dd) if (dd[d] > n) { n = dd[d]; best = d; }
  return best;
};
const sumRange = (yy, lo, hi) => { let s = 0; for (let y = lo; y <= hi; y++) s += yy[y] || 0; return s; };
const appearedYears = (yy) => Object.keys(yy).map(Number).filter(y => yy[y] > 0).sort((a, b) => a - b);

// ════════════════════════════════════════════════════════════════
// [1] EXPLAINABLE ANALYSIS — per-topic stats + natural-language story
// ════════════════════════════════════════════════════════════════
function explainTopic(t) {
  const yy = topicYears.get(t);
  const ys = appearedYears(yy);
  const total = sumRange(yy, YEAR_MIN, YEAR_MAX);
  const first = ys[0], last = ys[ys.length - 1];
  const gapNow = YEAR_MAX - last;                       // years since last appearance

  // average period = mean gap between consecutive appearance YEARS
  let avgPeriod = null;
  if (ys.length >= 2) {
    let g = 0; for (let i = 1; i < ys.length; i++) g += ys[i] - ys[i - 1];
    avgPeriod = +(g / (ys.length - 1)).toFixed(1);
  }
  // longest consecutive-year streak
  let streak = 1, best = 1;
  for (let i = 1; i < ys.length; i++) { if (ys[i] === ys[i - 1] + 1) { streak++; best = Math.max(best, streak); } else streak = 1; }
  // biggest comeback: largest gap that was later broken
  let comebackGap = 0, comebackYear = null;
  for (let i = 1; i < ys.length; i++) { const g = ys[i] - ys[i - 1]; if (g > comebackGap) { comebackGap = g; comebackYear = ys[i]; } }

  const recent5 = sumRange(yy, YEAR_MAX - 4, YEAR_MAX);
  const prev5 = sumRange(yy, YEAR_MAX - 9, YEAR_MAX - 5);
  const recent10 = sumRange(yy, YEAR_MAX - 9, YEAR_MAX);
  const prev10 = sumRange(yy, YEAR_MAX - 19, YEAR_MAX - 10);
  const growth5 = prev5 > 0 ? Math.round((recent5 - prev5) / prev5 * 100) : (recent5 > 0 ? 100 : 0);
  const growth10 = prev10 > 0 ? Math.round((recent10 - prev10) / prev10 * 100) : (recent10 > 0 ? 100 : 0);

  // natural-language interpretation (numbers only, no fabricated qualitative claims)
  const dirWord = growth5 > 15 ? '뚜렷한 상승세' : growth5 < -15 ? '하락세' : '안정적인 출제 빈도';
  let story = `${t}은(는) ${first}년 이후 총 ${total}회 출제되었으며, 최근 5년간 ${growth5 >= 0 ? '+' : ''}${growth5}%의 변화를 보이며 ${dirWord}를 나타냅니다.`;
  if (avgPeriod !== null) story += ` 평균 ${avgPeriod}년 주기로 등장하고`;
  if (best >= 3) story += `, 최대 ${best}년 연속 출제된 핵심 빈출 주제입니다.`;
  else if (gapNow >= 3) story += `, 최근 ${last}년 이후 ${gapNow}년간 공백 상태로 재출제 가능성을 주시해야 합니다.`;
  else story += `, 가장 최근 출제는 ${last}년입니다.`;
  if (comebackGap >= 4 && comebackYear) story += ` 과거 ${comebackGap}년 공백 후 ${comebackYear}년에 재등장한 이력이 있어 장기 공백이 출제 종료를 의미하지 않습니다.`;

  return {
    topic: t, domain: majorityDomain(t), domain_ko: DOMAIN_KO[majorityDomain(t)] || majorityDomain(t),
    total, first_year: first, last_year: last, gap_now: gapNow,
    avg_period: avgPeriod, longest_streak: best,
    comeback_gap: comebackGap, comeback_year: comebackYear,
    recent5, prev5, growth5_pct: growth5,
    recent10, prev10, growth10_pct: growth10,
    appearances: ys.length, story,
  };
}
const topicExplain = ALL_TOPICS.map(explainTopic).sort((a, b) => b.total - a.total);

// ════════════════════════════════════════════════════════════════
// [2] TOPIC RELATIONSHIP GRAPH — co-occurrence in same (year, round)
// ════════════════════════════════════════════════════════════════
const sessionTopics = new Map();   // "year_round" -> Set(topics)
for (const q of Q) {
  const t = (q.topic || '').trim(); if (!t) continue;
  const k = q.year + '_' + q.round;
  if (!sessionTopics.has(k)) sessionTopics.set(k, new Set());
  sessionTopics.get(k).add(t);
}
const topicSessionCount = new Map();   // topic -> # sessions it appears in
for (const set of sessionTopics.values()) for (const t of set) topicSessionCount.set(t, (topicSessionCount.get(t) || 0) + 1);

const pairCount = new Map();           // "A|B" -> co-occurring session count
for (const set of sessionTopics.values()) {
  const arr = [...set].sort();
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
    const key = arr[i] + '|' + arr[j];
    pairCount.set(key, (pairCount.get(key) || 0) + 1);
  }
}
const pairs = [];
for (const [key, co] of pairCount) {
  const [a, b] = key.split('|');
  const ca = topicSessionCount.get(a), cb = topicSessionCount.get(b);
  // Jaccard = co-sessions / sessions where either appears
  const jaccard = co / (ca + cb - co);
  pairs.push({ a, b, co, rate_pct: Math.round(jaccard * 100), a_sessions: ca, b_sessions: cb });
}
pairs.sort((x, y) => y.rate_pct - x.rate_pct || y.co - x.co);
const topPairs = pairs.filter(p => p.co >= 3).slice(0, 30);

// graph nodes / edges (force + network)
const nodeTopics = new Set();
topPairs.forEach(p => { nodeTopics.add(p.a); nodeTopics.add(p.b); });
const nodes = [...nodeTopics].map(t => {
  const ex = topicExplain.find(e => e.topic === t);
  return { id: t, domain: ex.domain, domain_ko: ex.domain_ko, total: ex.total };
});
const edges = topPairs.map(p => ({ source: p.a, target: p.b, value: p.rate_pct, co: p.co }));

// Sankey: domain -> topic flow (top topics by total), for recharts Sankey
const sankeyTopics = topicExplain.slice(0, 14);
const sankeyNodeNames = [];
const domSet = [...new Set(sankeyTopics.map(t => t.domain_ko))];
domSet.forEach(d => sankeyNodeNames.push(d));
sankeyTopics.forEach(t => sankeyNodeNames.push(t.topic));
const nameIdx = (n) => sankeyNodeNames.indexOf(n);
const sankeyLinks = sankeyTopics.map(t => ({ source: nameIdx(t.domain_ko), target: nameIdx(t.topic), value: t.total }));

// ════════════════════════════════════════════════════════════════
// [3] EXAMINER TREND — question-format mix (OCR-based, 2002-2015 ONLY)
// ════════════════════════════════════════════════════════════════
function classifyFormat(text) {
  const t = text || '';
  if (/グラフ|縦軸|横軸|折れ線|棒グラフ/.test(t)) return 'graph';     // 그래프형
  if (/次の表|下の表|表 |資料|統計|データ/.test(t)) return 'data';    // 자료해석형
  if (/地図|次の図|下の図/.test(t)) return 'map';                     // 지도/도해형
  return 'memory';                                                    // 암기·이해형
}
const formatByYear = {};
for (const ex of COMP.exams) {
  if (ex.year > Y_TEXT_MAX) continue;
  const y = ex.year;
  formatByYear[y] = formatByYear[y] || { memory: 0, data: 0, graph: 0, map: 0, n: 0 };
  for (const q of ex.questions) {
    const txt = q.text || '';
    if (txt.length < 15) continue;                 // skip OCR header garbage
    formatByYear[y][classifyFormat(txt)]++;
    formatByYear[y].n++;
  }
}
const formatTrend = Object.keys(formatByYear).sort().map(y => {
  const b = formatByYear[y];
  const visual = b.data + b.graph + b.map;
  return {
    year: +y, n: b.n,
    memory: b.memory, data: b.data, graph: b.graph, map: b.map,
    visual_pct: b.n ? Math.round(visual / b.n * 100) : 0,
    memory_pct: b.n ? Math.round(b.memory / b.n * 100) : 0,
  };
});
// honest early-vs-late comparison within available window
const early = formatTrend.filter(r => r.year <= 2005);
const late = formatTrend.filter(r => r.year >= 2011 && r.year <= 2015);
const avg = (arr, k) => arr.length ? Math.round(arr.reduce((s, r) => s + r[k], 0) / arr.length) : 0;
const formatSummary = {
  data_available: true,
  coverage: `${YEAR_MIN}-${Y_TEXT_MAX} (OCR 원문 보유 구간)`,
  method: 'OCR 원문 키워드 자동 분류: 그래프형(グラフ·縦軸/横軸), 자료해석형(表·資料·統計), 도해형(地図·図), 그 외 암기·이해형',
  caveat: '2016년 이후 회차는 원문 OCR이 없어 본 분석은 2002-2015 구간으로 한정됩니다. 자동 분류이므로 ±오차가 존재합니다.',
  early_visual_pct: avg(early, 'visual_pct'),
  late_visual_pct: avg(late, 'visual_pct'),
};

// ════════════════════════════════════════════════════════════════
// [4] PREDICTIVE INTELLIGENCE add-ons — difficulty + key concepts
//     (predictions themselves come from prediction_2026_2028.json)
// ════════════════════════════════════════════════════════════════
// per-topic avg difficulty (real field, 840/1448 labeled) + top keywords
const diffAgg = new Map();      // topic -> {sum, n}
const kwAgg = new Map();        // topic -> Map(keyword -> count)
const fmtAgg = new Map();       // topic -> {memory,data,graph,map} (2002-2015)
for (const ex of COMP.exams) {
  for (const q of ex.questions) {
    const t = (q.topic || '').trim(); if (!t) continue;
    if (typeof q.difficulty === 'number') {
      const d = diffAgg.get(t) || { sum: 0, n: 0 }; d.sum += q.difficulty; d.n++; diffAgg.set(t, d);
    }
    if (Array.isArray(q.keywords)) {
      const m = kwAgg.get(t) || new Map();
      // keep only CJK (kana/kanji) tokens — drop OCR latin garbage (e.g. "FOO","TT")
      for (const k of q.keywords) if (k && /[぀-ヿ一-鿿]/.test(k)) m.set(k, (m.get(k) || 0) + 1);
      kwAgg.set(t, m);
    }
    if (ex.year <= Y_TEXT_MAX && (q.text || '').length >= 15) {
      const f = fmtAgg.get(t) || { memory: 0, data: 0, graph: 0, map: 0 };
      f[classifyFormat(q.text)]++; fmtAgg.set(t, f);
    }
  }
}
const FMT_KO = { memory: '암기·이해형', data: '자료해석형', graph: '그래프형', map: '도해·지도형' };
function predictiveAddon(t) {
  const d = diffAgg.get(t);
  const avgDiff = d ? +(d.sum / d.n).toFixed(2) : null;     // scale ~2-4
  const diffLabel = avgDiff === null ? null : avgDiff >= 3.5 ? '상' : avgDiff >= 2.7 ? '중상' : avgDiff >= 2.2 ? '중' : '중하';
  const m = kwAgg.get(t);
  let keywords = [];
  if (m) keywords = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0]);
  const f = fmtAgg.get(t);
  let domFormat = null;
  if (f) { const e = Object.entries(f).sort((a, b) => b[1] - a[1])[0]; if (e && e[1] > 0) domFormat = FMT_KO[e[0]]; }
  return {
    topic: t,
    expected_difficulty: avgDiff, difficulty_label: diffLabel,
    difficulty_basis: avgDiff === null ? '난이도 라벨 데이터 없음' : `과거 라벨링된 ${d.n}개 문항 평균(2~4 척도)`,
    expected_format: domFormat, format_basis: domFormat ? '2002-2015 OCR 원문 형식 분류 최빈값' : '원문 형식 데이터 없음',
    key_concepts: keywords, concepts_basis: keywords.length ? `과거 문항 추출 키워드(${m.size}종) 상위` : '키워드 데이터 없음',
    misconception_note: '데이터 없음 — 오답 패턴은 원문 보기/해설 데이터가 없어 산출하지 않습니다(허위 생성 금지).',
  };
}
const predictiveAddons = topicExplain.map(e => predictiveAddon(e.topic));

// ════════════════════════════════════════════════════════════════
// [5] STUDENT ACTION PLAN — importance / priority / hours / contribution
// ════════════════════════════════════════════════════════════════
const pred2026 = (PRED['2026']?.top_predictions) || [];
const predProb = new Map(pred2026.map(p => [p.topic, p.probability_pct ?? p.prediction_score ?? 0]));
const totalQ = topicExplain.reduce((s, e) => s + e.total, 0);
const TOTAL_STUDY_HOURS = 100;     // recommend an allocation over a 100h budget

// importance = 0.55*frequency-share(normalized) + 0.45*2026 prediction prob
const maxTotal = Math.max(...topicExplain.map(e => e.total));
const actionRaw = topicExplain.map(e => {
  const prob = predProb.get(e.topic) || 0;
  const freqNorm = e.total / maxTotal;                 // 0..1
  const importance = Math.round((0.55 * freqNorm + 0.45 * prob / 100) * 100);
  return { topic: e.topic, domain_ko: e.domain_ko, total: e.total, prob, importance, growth5: e.growth5_pct };
});
const impSum = actionRaw.reduce((s, a) => s + a.importance, 0);
actionRaw.sort((a, b) => b.importance - a.importance);
const actionPlan = actionRaw.map((a, i) => {
  const tier = a.importance >= 70 ? 'S' : a.importance >= 50 ? 'A' : a.importance >= 30 ? 'B' : 'C';
  const hours = +(a.importance / impSum * TOTAL_STUDY_HOURS).toFixed(1);
  const contribution = +(a.total / totalQ * 100).toFixed(1);   // expected score share %
  let advice;
  if (tier === 'S') advice = `최우선 정복 대상. 핵심 개념 암기 + 자료/그래프 해석까지 완성하세요.`;
  else if (tier === 'A') advice = `고빈출 핵심군. 기출 회독으로 안정적 득점원으로 만드세요.`;
  else if (tier === 'B') advice = a.growth5 > 0 ? `상승세 주의 영역. 최소 정의·핵심 개념은 확보하세요.` : `기본 개념 위주로 효율 학습하세요.`;
  else advice = `저빈도. 시간 대비 효율이 낮아 후순위로 두되 정의 수준은 점검하세요.`;
  return {
    priority: i + 1, tier, topic: a.topic, domain_ko: a.domain_ko,
    importance: a.importance, total: a.total, prediction_pct: a.prob,
    study_hours: hours, score_contribution_pct: contribution, advice,
  };
});

// ════════════════════════════════════════════════════════════════
// [8] EXPLAINABLE PREDICTION — per-topic model component scores (REAL)
//   source: prediction_2026_2028.json top_predictions[] (0..1 → 0..100)
// ════════════════════════════════════════════════════════════════
const predByTopic = new Map(pred2026.map(p => [p.topic, p]));
const pct01 = v => (v == null ? null : Math.round(v * 100));
const explainByTopic = new Map();
for (const p of pred2026) {
  explainByTopic.set(p.topic, {
    topic: p.topic, domain_ko: DOMAIN_KO[majorityDomain(p.topic)] || majorityDomain(p.topic),
    final_pct: p.probability_pct ?? pct01(p.prediction_score),       // PREDICTED
    bayesian: pct01(p.bayes_score),                                  // REAL (model output)
    markov: pct01(p.markov_score),
    trend: pct01(p.trend_score),
    momentum: pct01(p.momentum_score),
    recency: pct01(p.recency_score),
    cycle: pct01(p.cycle_score),
    frequency: pct01(p.frequency_score),
    model_confidence: p.confidence ?? null,
    basis: p.basis ?? null,
    _class: 'REAL(component) → PREDICTED(final)',
  });
}
const explainablePrediction = topicExplain
  .map(e => explainByTopic.get(e.topic))
  .filter(Boolean);

// ════════════════════════════════════════════════════════════════
// [2] CYCLE INTELLIGENCE — average/current/max gap + status (no fabricated prob)
//   avg_gap,max_gap = DERIVED(gold_standard) · current_gap,consecutive,cycle_score = REAL
// ════════════════════════════════════════════════════════════════
const cycleIntel = topicExplain.map(e => {
  const p = predByTopic.get(e.topic);
  const avg_gap = e.avg_period;            // DERIVED — mean inter-appearance gap
  const current_gap = e.gap_now;           // REAL — 2025 - last_year
  const max_gap = e.comeback_gap || 0;     // DERIVED — largest historical gap
  const cycle_score = p?.cycle_score != null ? Math.round(p.cycle_score * 100) : null; // REAL
  const had_comeback = (e.comeback_gap || 0) >= 4;   // evidence of past long-gap return
  let status;
  if (current_gap === 0) status = '정상';
  else if (avg_gap != null && current_gap <= avg_gap) status = '정상';
  else if (max_gap && current_gap <= max_gap) status = '주의';
  else status = '고위험';
  // 복귀가능성: REAL 수치(current_gap≥avg_gap) + 과거 comeback 이력 有일 때만. 확률 날조 금지.
  const return_possible = current_gap > 0 && avg_gap != null && current_gap >= avg_gap && had_comeback;
  return {
    topic: e.topic, domain_ko: e.domain_ko,
    avg_gap, current_gap, max_gap,
    consecutive: p?.consecutive ?? null, cycle_score,
    status, return_possible, comeback_year: e.comeback_year,
    basis: `avg_gap=평균출현간격(DERIVED·gold_standard) · current_gap=${YEAR_MAX}−최근출제(REAL) · max_gap=최대역대공백(DERIVED) · cycle_score=예측모델(REAL)`,
  };
});
const cycleByTopic = new Map(cycleIntel.map(c => [c.topic, c]));

// ════════════════════════════════════════════════════════════════
// [3] RISK SCORE = probability × importance × score_impact → 0..100 (DERIVED)
//   각 인자 0..1 곱 후 35토픽 최댓값으로 정규화. S/A/B/C 등급.
// ════════════════════════════════════════════════════════════════
const contribMax = Math.max(...actionPlan.map(a => a.score_contribution_pct || 0)) || 1;
const riskRaw = actionPlan.map(a => {
  const prob = (a.prediction_pct || 0) / 100;        // PREDICTED 0..1
  const imp = (a.importance || 0) / 100;             // DERIVED 0..1
  const impact = (a.score_contribution_pct || 0) / contribMax; // DERIVED 0..1
  return { topic: a.topic, raw: prob * imp * impact };
});
const riskMax = Math.max(...riskRaw.map(r => r.raw)) || 1;
const riskByTopic = new Map(riskRaw.map(r => {
  const score = Math.round(r.raw / riskMax * 100);
  const grade = score >= 70 ? 'S' : score >= 50 ? 'A' : score >= 30 ? 'B' : 'C';
  return [r.topic, { score, grade }];
}));

// ════════════════════════════════════════════════════════════════
// [4] EXPECTED VALUE = score_contribution_pct / study_hours (DERIVED)
// ════════════════════════════════════════════════════════════════
const evByTopic = new Map(actionPlan.map(a => [a.topic,
  a.study_hours > 0 ? +((a.score_contribution_pct || 0) / a.study_hours).toFixed(2) : null]));

// ════════════════════════════════════════════════════════════════
// [4-DISCLOSURE] Confidence & data-range disclosure (real backtest)
// ════════════════════════════════════════════════════════════════
let backtest = { method: 'leave-future-out', precision: null, recall: null, f1: null, folds: null, test_years: null };
try {
  const acc = JSON.parse(fs.readFileSync(path.join(ROOT, 'dataset/prediction_accuracy_v2.json'), 'utf8'));
  backtest = { method: acc.method, precision: acc.avg_precision, recall: acc.avg_recall, f1: acc.avg_f1, folds: acc.folds, test_years: acc.test_years };
} catch (_) { /* leave nulls -> rendered as 데이터 없음 */ }
const disclosure = {
  data_range: `${YEAR_MIN}-${YEAR_MAX}`,
  sessions: EXAM_COUNT,
  gold_questions: GS.total_questions,
  ocr_text_range: `${YEAR_MIN}-${Y_TEXT_MAX}`,
  ocr_missing_range: `${Y_TEXT_MAX + 1}-${YEAR_MAX} (원문 OCR 없음 · 토픽 라벨만 보유)`,
  backtest,                                   // real measured numbers
  // CORE RULE 6: F1은 "정확도" 지표이며 "신뢰도"가 아님 — 혼용 금지.
  backtest_f1_pct: backtest.f1 != null ? Math.round(backtest.f1 * 100) : null,
  metric_note: 'F1 0.779는 모델 예측 "정확도"(precision/recall 조화평균). "신뢰도"·"확률"과 구분. 토픽별 신뢰도는 confidence.evidence_pct(데이터 커버리지), 토픽별 확률은 probability_pct(예측치).',
  no_fabrication_policy: '실데이터가 없는 항목은 "데이터 없음"으로 표기. 예상 오답 패턴 미생성. 예상 형식은 2002-2015 OCR 보유 토픽만 산출.',
};

// per-topic confidence purely from evidence volume (no fabricated %)
function topicConfidence(e) {
  const ap = e.appearances;                   // # distinct years appeared (max 24)
  const tier = ap >= 15 ? '높음' : ap >= 6 ? '보통' : '낮음';
  // transparent 0-100 evidence index = appearances / 24-year window
  const evidence_pct = Math.round(ap / (YEAR_MAX - YEAR_MIN + 1) * 100);
  return { tier, evidence_pct, evidence_count: e.total, years_appeared: ap };
}

// ════════════════════════════════════════════════════════════════
// [1] TOPIC INTELLIGENCE — merge explain + addon + action + prediction
//     + 3 auto blocks (왜 중요 / 어떤 형태 / 무엇을 공부). 수치 우선.
// ════════════════════════════════════════════════════════════════
const addonByTopic = new Map(predictiveAddons.map(a => [a.topic, a]));
const actionByTopic = new Map(actionPlan.map(a => [a.topic, a]));
const topicIntelligence = topicExplain.map((e, i) => {
  const ad = addonByTopic.get(e.topic) || {};
  const ac = actionByTopic.get(e.topic) || {};
  const prob = predProb.get(e.topic) ?? null;
  const conf = topicConfidence(e);
  const freqRank = i + 1;                      // topicExplain is sorted by total desc
  const why_important = `전체 ${e.total}회 출제(빈도 ${freqRank}위/35) · 2026 예측확률 ${prob ?? '데이터 없음'}${prob != null ? '%' : ''} · 예상 점수기여 ${ac.score_contribution_pct ?? 'N/A'}% · 중요도 ${ac.importance ?? 'N/A'}(${ac.tier ?? '-'}등급)`;
  const how_asked = ad.expected_format
    ? `2002-2015 OCR 원문 기준 최빈 형식: ${ad.expected_format} (난이도 ${ad.difficulty_label ?? '데이터 없음'}${ad.expected_difficulty != null ? ` · ${ad.expected_difficulty}/4` : ''})`
    : '데이터 없음 (2016+ 원문 OCR 부재로 형식 분류 불가)';
  const what_to_study = (ad.key_concepts && ad.key_concepts.length)
    ? `핵심 개념(기출 추출 키워드): ${ad.key_concepts.join(', ')} — ${ac.advice ?? ''}`
    : `키워드 데이터 없음 — ${ac.advice ?? '기출 회독으로 핵심 개념을 직접 정리하세요.'}`;
  const cyc = cycleByTopic.get(e.topic);
  const risk = riskByTopic.get(e.topic) || { score: null, grade: null };
  const ev = evByTopic.get(e.topic) ?? null;
  const recent_change = `최근5년 ${e.recent5}회(직전5년 ${e.prev5}회 대비 ${e.growth5_pct >= 0 ? '+' : ''}${e.growth5_pct}%) · 현재공백 ${e.gap_now}년 · 주기상태 ${cyc?.status ?? '데이터 없음'}${cyc?.return_possible ? ' · 복귀가능성있음' : ''}`;
  return {
    rank: freqRank, topic: e.topic, domain: e.domain, domain_ko: e.domain_ko,
    total: e.total, recent5: e.recent5, recent10: e.recent10,
    first_year: e.first_year, last_year: e.last_year, avg_period: e.avg_period,
    gap_now: e.gap_now, longest_streak: e.longest_streak,
    growth5_pct: e.growth5_pct, growth10_pct: e.growth10_pct,
    probability_pct: prob,
    importance: ac.importance ?? null, tier: ac.tier ?? null,
    risk_score: risk.score, risk_grade: risk.grade,        // DERIVED
    expected_value: ev,                                    // DERIVED (점수기여%/시간)
    study_hours: ac.study_hours ?? null, score_contribution_pct: ac.score_contribution_pct ?? null,
    cycle_status: cyc?.status ?? null, return_possible: cyc?.return_possible ?? null,
    expected_difficulty: ad.expected_difficulty ?? null, difficulty_label: ad.difficulty_label ?? null,
    expected_format: ad.expected_format ?? null, key_concepts: ad.key_concepts ?? [],
    confidence: conf,
    why_important, how_asked, what_to_study, recent_change,
    story: e.story,
  };
});

// ════════════════════════════════════════════════════════════════
// [3] EXAM SIMULATION — 2026 출제 구성 청사진 (NOT real question text)
//   영역비중 = gold_standard 도메인분포, 토픽 = 2026 예측확률, 난이도 = 과거 라벨
// ════════════════════════════════════════════════════════════════
const EXAM_N = 38;                              // 실제 EJU 종합과목 2016+ = 38문항(검증)
const domDist = GS.domain_distribution || {};
const domTotal = COMP_KEYS.reduce((s, k) => s + (domDist[k] || 0), 0);
// largest-remainder quota so sum == EXAM_N
const rawQuota = COMP_KEYS.map(k => ({ k, exact: (domDist[k] || 0) / domTotal * EXAM_N }));
let domainQuota = rawQuota.map(q => ({ ...q, n: Math.floor(q.exact), rem: q.exact - Math.floor(q.exact) }));
let assigned = domainQuota.reduce((s, q) => s + q.n, 0);
domainQuota.sort((a, b) => b.rem - a.rem);
for (let i = 0; assigned < EXAM_N; i++, assigned++) domainQuota[i % domainQuota.length].n++;
const quotaMap = new Map(domainQuota.map(q => [q.k, q.n]));

// predicted topics grouped by majority domain, sorted by probability
const predByDomain = {};
for (const k of COMP_KEYS) predByDomain[k] = [];
for (const p of pred2026) {
  const dom = majorityDomain(p.topic);
  if (predByDomain[dom]) predByDomain[dom].push(p);
}
for (const k of COMP_KEYS) predByDomain[k].sort((a, b) => (b.probability_pct || 0) - (a.probability_pct || 0));

const blueprint = [];
let qno = 0;
for (const k of COMP_KEYS) {
  const need = quotaMap.get(k) || 0;
  const pool = predByDomain[k];
  for (let i = 0; i < need; i++) {
    const p = pool[i % Math.max(1, pool.length)];        // cycle highest-prob topics
    const ad = p ? addonByTopic.get(p.topic) : null;
    blueprint.push({
      q_no: ++qno,
      domain: k, domain_ko: DOMAIN_KO[k],
      topic: p ? p.topic : '데이터 없음',
      probability_pct: p ? (p.probability_pct ?? null) : null,
      expected_difficulty: ad?.difficulty_label ?? '데이터 없음',
      expected_format: ad?.expected_format ?? '데이터 없음',
    });
  }
}
// distributions over the 38-question blueprint
const diffDist = {}; const fmtDist = {};
for (const b of blueprint) {
  diffDist[b.expected_difficulty] = (diffDist[b.expected_difficulty] || 0) + 1;
  fmtDist[b.expected_format] = (fmtDist[b.expected_format] || 0) + 1;
}
const examSimulation = {
  target_year: 2026,
  total_questions: EXAM_N,
  basis: '영역 비중 = gold_standard.domain_distribution · 토픽 = prediction_2026_2028 확률순 · 난이도/형식 = 과거 라벨·OCR(2002-2015)',
  disclaimer: '실제 2026 문제 텍스트가 아닌 "출제 구성 예측 청사진"입니다. 2026 원문은 존재하지 않으며, 토픽·비중·난이도 구성만 예측합니다.',
  domain_quota: domainQuota.map(q => ({ domain: q.k, domain_ko: DOMAIN_KO[q.k], count: q.n, pct: Math.round(q.n / EXAM_N * 100) })),
  difficulty_dist: diffDist,
  format_dist: fmtDist,
  blueprint,
};

// ════════════════════════════════════════════════════════════════
// [5] DOMAIN INTELLIGENCE — per-domain share/trend/growth/difficulty/hours
//   share·total·yearly = REAL(trend_analysis_complete) · growth5·hours = DERIVED · expected_share = PREDICTED
// ════════════════════════════════════════════════════════════════
let DOMTREND = {};
try {
  DOMTREND = JSON.parse(fs.readFileSync(path.join(ROOT, 'dataset/trend-analysis/trend_analysis_complete.json'), 'utf8')).domain_trends || {};
} catch (_) { /* leave empty -> 데이터 없음 */ }
const domGrand = COMP_KEYS.reduce((s, k) => s + (DOMTREND[k]?.total || 0), 0);
// difficulty per domain from labeled addons (majorityDomain mapping)
const domDiffSum = {}, domDiffCnt = {};
for (const ad of predictiveAddons) {
  if (ad.expected_difficulty != null) {
    const d = majorityDomain(ad.topic);
    domDiffSum[d] = (domDiffSum[d] || 0) + ad.expected_difficulty;
    domDiffCnt[d] = (domDiffCnt[d] || 0) + 1;
  }
}
const examQuotaPct = new Map(examSimulation.domain_quota.map(q => [q.domain, q.pct]));
const domainIntelligence = COMP_KEYS.map(k => {
  const d = DOMTREND[k] || {};
  const yy = d.yearly || {};
  const r5 = sumRange(yy, YEAR_MAX - 4, YEAR_MAX);
  const p5 = sumRange(yy, YEAR_MAX - 9, YEAR_MAX - 5);
  const growth5 = p5 > 0 ? Math.round((r5 - p5) / p5 * 100) : (r5 > 0 ? null : null); // DERIVED, comparable windows
  const share = domGrand ? +(((d.total || 0) / domGrand) * 100).toFixed(1) : null;
  const diff = domDiffCnt[k] ? +(domDiffSum[k] / domDiffCnt[k]).toFixed(2) : null;
  const trendWord = growth5 == null ? '데이터 없음' : growth5 > 15 ? '상승' : growth5 < -15 ? '하락' : '안정';
  return {
    domain: k, domain_ko: DOMAIN_KO[k],
    total: d.total ?? null, share_pct: share,                         // REAL/DERIVED
    recent5_total: r5, prev5_total: p5, growth5_pct: growth5, trend: trendWord, // DERIVED
    avg_per_year: d.avg_per_year ?? null,                             // REAL
    expected_share_pct: examQuotaPct.get(k) ?? null,                  // PREDICTED (blueprint quota)
    avg_difficulty: diff, difficulty_basis: domDiffCnt[k] ? `라벨 ${domDiffCnt[k]}토픽 평균(/4)` : '데이터 없음',
    recommend_hours: null,
  };
});
const eShareSum = domainIntelligence.reduce((s, x) => s + (x.expected_share_pct || 0), 0);
domainIntelligence.forEach(x => { x.recommend_hours = eShareSum ? +(((x.expected_share_pct || 0) / eShareSum) * TOTAL_STUDY_HOURS).toFixed(1) : null; });

// ════════════════════════════════════════════════════════════════
// [11] EXECUTIVE SUMMARY — top frequency / top rising / top return (DERIVED)
// ════════════════════════════════════════════════════════════════
const topFreq = topicExplain[0];
const topRising = [...topicExplain].filter(e => e.recent5 > 0 && e.growth5_pct != null)
  .sort((a, b) => b.growth5_pct - a.growth5_pct)[0];
const topReturn = cycleIntel.filter(c => c.return_possible)
  .sort((a, b) => (b.current_gap || 0) - (a.current_gap || 0))[0];
const executiveSummary = {
  top_frequency: topFreq ? { topic: topFreq.topic, total: topFreq.total, recent5: topFreq.recent5, prob: predProb.get(topFreq.topic) ?? null } : null,
  top_rising: topRising ? { topic: topRising.topic, growth5_pct: topRising.growth5_pct, recent5: topRising.recent5 } : null,
  top_return: topReturn ? { topic: topReturn.topic, current_gap: topReturn.current_gap, avg_gap: topReturn.avg_gap } : null,
  lines: [
    topFreq ? `출제빈도 상위: ${topFreq.topic} (총 ${topFreq.total}회·최근5년 ${topFreq.recent5}회)` : '데이터 없음',
    topRising ? `상승세: ${topRising.topic} (직전5년 대비 +${topRising.growth5_pct}%)` : '상승세: 데이터 없음',
    topReturn ? `복귀 가능: ${topReturn.topic} (현재공백 ${topReturn.current_gap}년·평균주기 ${topReturn.avg_gap}년)` : '복귀 가능: 해당 없음',
  ],
  basis: 'top_frequency·top_rising=topicExplain(DERIVED) · top_return=cycleIntel return_possible(REAL 수치 기반)',
};

// ════════════════════════════════════════════════════════════════
// [9] STUDY PLANNER — 오늘/이번주/이번달 (DERIVED, study_hours 비례 배분)
// ════════════════════════════════════════════════════════════════
const studyPlanner = {
  basis: 'actionPlan.study_hours(DERIVED · 100h 예산 importance 비례) 기반 분해. 월=상위 토픽 배분, 주=월/4, 오늘=월/30.',
  month: actionPlan.slice(0, 12).map(a => ({ topic: a.topic, tier: a.tier, hours: a.study_hours })),
  week: actionPlan.slice(0, 5).map(a => ({ topic: a.topic, tier: a.tier, hours: +(a.study_hours / 4).toFixed(1) })),
  today: actionPlan.slice(0, 2).map(a => ({ topic: a.topic, tier: a.tier, hours: +(a.study_hours / 30).toFixed(1) })),
};

// ════════════════════════════════════════════════════════════════
// [10] WEAKNESS ANALYSIS — UNKNOWN (학생 실제 점수 기록 없음, 허위 생성 금지)
// ════════════════════════════════════════════════════════════════
const weaknessAnalysis = {
  status: 'UNKNOWN',
  reason: '학생 실제 시험 점수 기록 없음. weakness_profile.json은 출제빈도 기반(성적 아님), system_score.json은 시스템 자가평가.',
  available_when: '학생이 회차별 점수를 입력하면 강점/약점/위험영역 산출 가능.',
  strengths: null, weaknesses: null, risk_areas: null,
};

// ── DATA CLASSIFICATION LEGEND (REAL/DERIVED/PREDICTED/UNKNOWN) ──
const field_classes = {
  REAL: ['total', 'recent5', 'recent10', 'first_year', 'last_year', 'gap_now', 'current_gap', 'consecutive', 'longest_streak', 'domain_trends.total/yearly/avg_per_year', 'explainable_prediction.{bayesian,markov,trend,momentum,recency,cycle,frequency}', 'cycle_score', 'disclosure.backtest'],
  DERIVED: ['avg_period/avg_gap', 'max_gap', 'growth5_pct', 'growth10_pct', 'importance', 'study_hours', 'score_contribution_pct', 'risk_score', 'expected_value', 'domain_intelligence.recommend_hours/avg_difficulty', 'executive_summary', 'study_planner'],
  PREDICTED: ['probability_pct', 'explainable_prediction.final_pct', 'exam_simulation.*', 'domain_intelligence.expected_share_pct'],
  UNKNOWN: ['weakness_analysis', '2016+ expected_format/difficulty(미보유 토픽)', 'cycle return_probability(독립검증치 없음 — boolean return_possible로 대체)'],
};

// ════════════════════════════════════════════════════════════════
// WRITE
// ════════════════════════════════════════════════════════════════
const out = {
  generated_at: new Date().toISOString(),
  source: { gold_standard: GS.total_questions, sessions: 44, ocr_text_coverage: `${YEAR_MIN}-${Y_TEXT_MAX}` },
  honesty_note: '모든 수치는 gold_standard(1,121문항) 및 OCR 원문(2002-2015)에서 직접 산출. 데이터가 없는 차원(오답 패턴, 2016+ 형식)은 생성하지 않고 명시함.',
  topic_explain: topicExplain,
  cooccurrence: { top_pairs: topPairs, nodes, edges, sankey: { nodes: sankeyNodeNames.map(n => ({ name: n })), links: sankeyLinks } },
  format_trend: { summary: formatSummary, by_year: formatTrend },
  predictive_addons: predictiveAddons,
  action_plan: actionPlan,
  topic_intelligence: topicIntelligence,
  cycle_intelligence: cycleIntel,
  explainable_prediction: explainablePrediction,
  domain_intelligence: domainIntelligence,
  executive_summary: executiveSummary,
  study_planner: studyPlanner,
  weakness_analysis: weaknessAnalysis,
  exam_simulation: examSimulation,
  disclosure,
  field_classes,
  meta: { total_topic_questions: totalQ, study_budget_hours: TOTAL_STUDY_HOURS },
};
const dir = path.join(ROOT, 'dataset/insights');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'insights_v2.json'), JSON.stringify(out, null, 2));
// sync to public for runtime fetch
const pdir = path.join(ROOT, 'public/dataset/insights');
fs.mkdirSync(pdir, { recursive: true });
fs.writeFileSync(path.join(pdir, 'insights_v2.json'), JSON.stringify(out, null, 2));

console.log('insights_v2.json written.');
console.log('  topics:', topicExplain.length, '| top pairs:', topPairs.length, '| format years:', formatTrend.length);
console.log('  top pair:', topPairs[0]?.a, '↔', topPairs[0]?.b, topPairs[0]?.rate_pct + '%');
console.log('  visual%% early(02-05):', formatSummary.early_visual_pct, '-> late(11-15):', formatSummary.late_visual_pct);
console.log('  action S-tier:', actionPlan.filter(a => a.tier === 'S').map(a => a.topic).join(', '));
console.log('  exam-sim quota:', examSimulation.domain_quota.map(q => `${q.domain_ko}${q.count}`).join(' '), '=', blueprint.length, 'Q');
console.log('  exam-sim difficulty:', JSON.stringify(examSimulation.difficulty_dist));
console.log('  disclosure backtest F1(정확도):', disclosure.backtest.f1, '-> f1_pct', disclosure.backtest_f1_pct, '(신뢰도 아님)');
