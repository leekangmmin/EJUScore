// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// EJU 득점등화(Equating) 기반 정밀 점수 예측 시스템

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function confidenceLabel(score) {
  if (score >= 0.78) return '높음';
  if (score >= 0.52) return '보통';
  return '낮음';
}

// ── EJU 득점등화 상수 ─────────────────────────────────
// EJU 일본어: 독해 25문항(만점 185), 청해 40문항(만점 185)
// 실제 EJU는 원점수를 등화 처리해 0~185 척도로 변환
export const JAP_MAX = 370;       // 일본어 합계 만점
export const JAP_READ_MAX = 185;  // 독해 만점
export const JAP_LISTEN_MAX = 185; // 청해 만점
export const JAP_READ_QUESTIONS = 25;   // 독해 문항 수
export const JAP_LISTEN_QUESTIONS = 40; // 청해 문항 수
export const COMP_MAX = 198;       // 종합과목 만점 (득점등화)
export const COMP_QUESTIONS = 40;  // 종합과목 문항 수

// 문항별 기본 배점 가중치 (독해)
// 문법·어휘 문항(1-10): 표준 배점
// 독해 지문 문항(11-22): 표준 배점
// 장문 독해(23-25): 배점 낮음 (EJU 특성상 장문은 부분점수 개념)
const READING_QUESTION_WEIGHTS = {
  default: 1.0,
  low: 0.45,    // 배점 낮은 문항
  high: 1.3,    // 배점 높은 문항
};

// 독해 문항별 가중치 매핑
function getReadingQuestionWeight(q, difficultyOverrides = {}) {
  const qNum = Number(q);
  // 선생님이 어렵다고 인정한 문항 → 감점 낮춤
  if (difficultyOverrides[qNum] === 'hard') return READING_QUESTION_WEIGHTS.low;
  // 장문 독해 (23-25번)
  if (qNum >= 23 && qNum <= 25) return READING_QUESTION_WEIGHTS.low;
  return READING_QUESTION_WEIGHTS.default;
}

// 청해 문항별 가중치 매핑
function getListeningQuestionWeight(q, difficultyOverrides = {}) {
  const qNum = Number(q);
  if (difficultyOverrides[qNum] === 'hard') return READING_QUESTION_WEIGHTS.low;
  return READING_QUESTION_WEIGHTS.default;
}

// ── 등화 보정 함수 ────────────────────────────────────
// EJU 득점등화: 원점수 → 등화점수 변환
// 시험 난이도에 따라 같은 원점수라도 등화점수가 달라짐
// difficulty: 'easy' | 'normal' | 'hard'
function equatingAdjustment(rawScore, maxScore, difficulty = 'normal') {
  const ratio = rawScore / maxScore;
  switch (difficulty) {
    case 'easy':
      // 쉬운 시험: 고득점 구간에서 등화 불리 (상위 점수 압축)
      return clamp(Math.round(maxScore * (ratio * 0.92 + ratio * ratio * 0.08)), 0, maxScore);
    case 'hard':
      // 어려운 시험: 저득점 구간에서 등화 유리 (하위 점수 보정)
      return clamp(Math.round(maxScore * (ratio * 1.08 - ratio * ratio * 0.08)), 0, maxScore);
    default:
      return clamp(Math.round(rawScore), 0, maxScore);
  }
}

// ── 정답률 기반 감점 보정 ─────────────────────────────
// 정답률이 낮은 문항(어려운 문항)을 틀렸을 때 감점을 줄임
// correctRate: 0~1 (해당 문항의 전체 수험생 정답률)
function difficultyDeduction(baseDeduction, correctRate) {
  if (correctRate === null || correctRate === undefined) return baseDeduction;
  // 정답률 30% 이하: 감점 50% 감소
  if (correctRate <= 0.30) return baseDeduction * 0.50;
  // 정답률 30~50%: 감점 25% 감소
  if (correctRate <= 0.50) return baseDeduction * 0.75;
  // 정답률 50~70%: 감점 10% 감소
  if (correctRate <= 0.70) return baseDeduction * 0.90;
  // 정답률 70% 이상: 표준 감점
  return baseDeduction;
}

// ── 가중 오답 계산 (독해) ─────────────────────────────
// wrongItems: [{ q: number, correctRate?: number, teacherHard?: boolean }] 또는 단순 숫자 배열
export function weightedWrongReading(arr = [], difficultyOverrides = {}) {
  return arr.reduce((sum, item) => {
    const q = typeof item === 'object' ? Number(item.q ?? item) : Number(item);
    if (!Number.isInteger(q) || q <= 0) return sum;

    const correctRate = typeof item === 'object' ? (item.correctRate ?? null) : null;
    const teacherHard = typeof item === 'object' ? Boolean(item.teacherHard) : false;
    const overrideHard = difficultyOverrides[q] === 'hard';

    let baseWeight = getReadingQuestionWeight(q, difficultyOverrides);

    // 선생님이 어렵다고 인정한 경우 추가 감점 감소
    if (teacherHard || overrideHard) {
      baseWeight = Math.min(baseWeight, READING_QUESTION_WEIGHTS.low);
    }

    // 정답률 기반 보정
    const adjusted = difficultyDeduction(baseWeight, correctRate);
    return sum + adjusted;
  }, 0);
}

// ── 가중 오답 계산 (청해) ─────────────────────────────
export function weightedWrongListening(arr = [], difficultyOverrides = {}) {
  return arr.reduce((sum, item) => {
    const q = typeof item === 'object' ? Number(item.q ?? item) : Number(item);
    if (!Number.isInteger(q) || q <= 0) return sum;

    const correctRate = typeof item === 'object' ? (item.correctRate ?? null) : null;
    const teacherHard = typeof item === 'object' ? Boolean(item.teacherHard) : false;
    const overrideHard = difficultyOverrides[q] === 'hard';

    let baseWeight = getListeningQuestionWeight(q, difficultyOverrides);

    if (teacherHard || overrideHard) {
      baseWeight = Math.min(baseWeight, READING_QUESTION_WEIGHTS.low);
    }

    const adjusted = difficultyDeduction(baseWeight, correctRate);
    return sum + adjusted;
  }, 0);
}

// ── 유틸리티 ──────────────────────────────────────────
function setFromNumbers(arr = []) {
  return new Set(
    arr
      .map(item => typeof item === 'object' ? Number(item.q ?? item) : Number(item))
      .filter(n => Number.isInteger(n) && n > 0)
  );
}

function setFromMistakes(arr = []) {
  const s = new Set();
  arr.forEach(m => {
    if (m?.unit) s.add(`u:${String(m.unit).trim().toLowerCase()}`);
    if (m?.errorType) s.add(`e:${String(m.errorType).trim().toLowerCase()}`);
    if (m?.questionNumber) s.add(`q:${Number(m.questionNumber)}`);
  });
  return s;
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  const inter = [...a].filter(x => b.has(x)).length;
  const uni = new Set([...a, ...b]).size;
  return uni === 0 ? 0 : inter / uni;
}

function recencyWeight(dateStr) {
  if (!dateStr) return 1;
  const [y, m] = String(dateStr).split('-').map(Number);
  if (!y || !m) return 1;
  const t = new Date(y, m - 1, 1).getTime();
  const now = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const months = Math.max(0, Math.floor((now - t) / monthMs));
  return clamp(1 - months * 0.03, 0.72, 1);
}

function weightedAverage(rows) {
  const wSum = rows.reduce((s, r) => s + r.w, 0);
  if (!wSum) return null;
  return rows.reduce((s, r) => s + r.value * r.w, 0) / wSum;
}

function applyWrongCountCap(predicted, weightedWrong, totalQuestions, maxScore) {
  if (!Number.isFinite(weightedWrong) || weightedWrong <= 0) return clamp(predicted, 0, maxScore);
  const safeWrong = clamp(weightedWrong, 0, totalQuestions);
  // 등화 고려: 이론적 최대 = (정답 문항 / 전체) * 만점 + 등화 버퍼
  const theoreticalMax = ((totalQuestions - safeWrong) / totalQuestions) * maxScore;
  const equatingBuffer = maxScore * 0.05; // 등화로 인한 상향 여지 5%
  const bufferedCap = clamp(Math.round(theoreticalMax + equatingBuffer), 0, maxScore);
  return Math.min(clamp(predicted, 0, maxScore), bufferedCap);
}

function estimateBySimilarity(history, targetSet, scoreKey, maxScore) {
  if (!history.length) {
    return { score: Math.round(maxScore * 0.6), confidence: 0.2, sampleSize: 0 };
  }

  const scored = history.map(h => {
    const sim = jaccard(targetSet, h.features);
    const recency = recencyWeight(h.date);
    const w = (0.15 + sim * 0.85) * recency;
    return { value: h[scoreKey], w, sim };
  });

  const top = scored.sort((a, b) => b.w - a.w).slice(0, 6);
  const pred = weightedAverage(top);
  const similarityMean = top.reduce((s, r) => s + r.sim, 0) / Math.max(1, top.length);
  const sampleFactor = clamp(history.length / 10, 0.25, 1);
  const confidence = Number(clamp(similarityMean * 0.75 + sampleFactor * 0.25, 0.18, 0.95).toFixed(2));

  return {
    score: clamp(Math.round(pred ?? maxScore * 0.6), 0, maxScore),
    confidence,
    sampleSize: history.length,
  };
}

// ── 트렌드 기반 예측 ──────────────────────────────────
// 최근 시험 점수 추세를 반영한 예측
function trendBasedPrediction(history, maxScore) {
  if (history.length < 2) return null;
  const recent = history.slice(-5); // 최근 5회
  const n = recent.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = recent.reduce((a, b) => a + b, 0);
  const sumXY = recent.reduce((s, v, i) => s + i * v, 0);
  const sumX2 = recent.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (!denom) return recent[recent.length - 1];
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return clamp(Math.round(slope * n + intercept), 0, maxScore);
}

// ── 메인 일본어 점수 예측 ─────────────────────────────
// wrongReading/wrongListening: 숫자 배열 또는 { q, correctRate, teacherHard } 객체 배열
// options: { examDifficulty?: 'easy'|'normal'|'hard', difficultyOverrides?: {[qNum]: 'hard'} }
export function estimateJapaneseScore(
  exams,
  wrongReading = [],
  wrongListening = [],
  options = {}
) {
  const {
    examDifficulty = 'normal',
    difficultyOverrides = {},
  } = options;

  const rTarget = setFromNumbers(wrongReading);
  const lTarget = setFromNumbers(wrongListening);

  // 시험 기록만 사용 (평소 문제집은 예측에서 제외하거나 가중치 낮춤)
  const examHistory = exams.filter(e => !e.recordType || e.recordType === 'exam');
  const workbookHistory = exams.filter(e => e.recordType === 'workbook');

  const rHistory = examHistory
    .filter(e => e?.japanese && typeof e.japanese.reading === 'number')
    .map(e => ({
      reading: e.japanese.reading,
      features: setFromNumbers(e.japanese?.wrongQuestions?.reading || []),
      date: e.date,
    }));

  const lHistory = examHistory
    .filter(e => e?.japanese && typeof e.japanese.listening === 'number')
    .map(e => ({
      listening: e.japanese.listening,
      features: setFromNumbers(e.japanese?.wrongQuestions?.listening || []),
      date: e.date,
    }));

  // 평소 문제집 기록도 낮은 가중치로 반영 (원점수인 경우 등화 환산 후 적용)
  const rWorkbookHistory = workbookHistory
    .filter(e => e?.japanese && typeof e.japanese.reading === 'number')
    .map(e => {
      const normReading = e.japanese.rawMeta?.isRaw
        ? Math.round(e.japanese.reading * JAP_READ_MAX / (e.japanese.rawMeta.readingMax || JAP_READ_QUESTIONS))
        : e.japanese.reading;
      return {
        reading: Math.round(normReading * 0.95),
        features: setFromNumbers(e.japanese?.wrongQuestions?.reading || []),
        date: e.date,
      };
    });

  const lWorkbookHistory = workbookHistory
    .filter(e => e?.japanese && typeof e.japanese.listening === 'number')
    .map(e => {
      const normListening = e.japanese.rawMeta?.isRaw
        ? Math.round(e.japanese.listening * JAP_LISTEN_MAX / (e.japanese.rawMeta.listeningMax || JAP_LISTEN_QUESTIONS))
        : e.japanese.listening;
      return {
        listening: Math.round(normListening * 0.95),
        features: setFromNumbers(e.japanese?.wrongQuestions?.listening || []),
        date: e.date,
      };
    });

  const combinedRHistory = [...rHistory, ...rWorkbookHistory];
  const combinedLHistory = [...lHistory, ...lWorkbookHistory];

  const r = estimateBySimilarity(combinedRHistory, rTarget, 'reading', JAP_READ_MAX);
  const l = estimateBySimilarity(combinedLHistory, lTarget, 'listening', JAP_LISTEN_MAX);

  // 가중 오답 수 계산 (등화 보정 포함)
  const weightedR = weightedWrongReading(wrongReading, difficultyOverrides);
  const weightedL = weightedWrongListening(wrongListening, difficultyOverrides);
  const weightedTotalWrong = weightedR + weightedL;

  // ── 등화 기반 원점수 계산 ──────────────────────────
  // 독해: 25문항, 만점 185점 → 문항당 평균 7.4점
  // 청해: 40문항, 만점 185점 → 문항당 평균 4.625점
  const readPointPerQ = JAP_READ_MAX / JAP_READ_QUESTIONS;   // ~7.4
  const listenPointPerQ = JAP_LISTEN_MAX / JAP_LISTEN_QUESTIONS; // ~4.625

  // 원점수 기반 예측 (오답 가중치 반영)
  const rawReadScore = clamp(
    Math.round(JAP_READ_MAX - weightedR * readPointPerQ),
    0, JAP_READ_MAX
  );
  const rawListenScore = clamp(
    Math.round(JAP_LISTEN_MAX - weightedL * listenPointPerQ),
    0, JAP_LISTEN_MAX
  );

  // 등화 보정 적용
  const equatedReadScore = equatingAdjustment(rawReadScore, JAP_READ_MAX, examDifficulty);
  const equatedListenScore = equatingAdjustment(rawListenScore, JAP_LISTEN_MAX, examDifficulty);
  const equatedTotal = equatedReadScore + equatedListenScore;

  // 유사도 기반 예측
  const similarityTotal = r.score + l.score;

  // 트렌드 기반 예측
  const examReadScores = rHistory.map(h => h.reading);
  const examListenScores = lHistory.map(h => h.listening);
  const trendRead = trendBasedPrediction(examReadScores, JAP_READ_MAX);
  const trendListen = trendBasedPrediction(examListenScores, JAP_LISTEN_MAX);
  const trendTotal = trendRead !== null && trendListen !== null ? trendRead + trendListen : null;

  // ── 앙상블 블렌딩 ──────────────────────────────────
  // 데이터가 충분할수록 유사도/트렌드 비중 증가
  const dataCount = Math.min(rHistory.length, lHistory.length);
  const equatingWeight = clamp(0.55 - dataCount * 0.03, 0.30, 0.55);
  const similarityWeight = clamp(0.25 + dataCount * 0.02, 0.20, 0.40);
  const trendWeight = trendTotal !== null ? clamp(0.20 + dataCount * 0.01, 0.10, 0.30) : 0;
  const totalWeight = equatingWeight + similarityWeight + trendWeight;

  let blendedTotal;
  if (trendTotal !== null) {
    blendedTotal = clamp(Math.round(
      (equatedTotal * equatingWeight + similarityTotal * similarityWeight + trendTotal * trendWeight) / totalWeight
    ), 0, JAP_MAX);
  } else {
    blendedTotal = clamp(Math.round(
      (equatedTotal * equatingWeight + similarityTotal * similarityWeight) / (equatingWeight + similarityWeight)
    ), 0, JAP_MAX);
  }

  // ── 독해/청해 비율 분배 ────────────────────────────
  const readShare = examHistory
    .filter(e => e?.japanese)
    .reduce((s, e) => {
      const total = (e.japanese.reading || 0) + (e.japanese.listening || 0);
      return total > 0 ? s + (e.japanese.reading / total) : s;
    }, 0);
  const readShareCount = examHistory.filter(e => e?.japanese && (e.japanese.reading + e.japanese.listening) > 0).length;
  const avgReadShare = readShareCount > 0 ? readShare / readShareCount : 0.5;
  const finalReadShare = clamp(avgReadShare || 0.5, 0.42, 0.58);

  let reading = clamp(Math.round(blendedTotal * finalReadShare), 0, JAP_READ_MAX);
  let listening = clamp(blendedTotal - reading, 0, JAP_LISTEN_MAX);

  // 상한으로 인한 합계 불일치 보정
  if (reading + listening !== blendedTotal) {
    const diff = blendedTotal - (reading + listening);
    if (diff > 0) {
      if (reading < JAP_READ_MAX) reading = clamp(reading + diff, 0, JAP_READ_MAX);
      else listening = clamp(listening + diff, 0, JAP_LISTEN_MAX);
    }
  }

  // 오답 수 상한 적용
  reading = applyWrongCountCap(reading, weightedR, JAP_READ_QUESTIONS, JAP_READ_MAX);
  listening = applyWrongCountCap(listening, weightedL, JAP_LISTEN_QUESTIONS, JAP_LISTEN_MAX);

  // ── 신뢰도 계산 ────────────────────────────────────
  // 데이터 수, 유사도, 등화 일관성을 종합
  const baseConfidence = (r.confidence + l.confidence) / 2;
  const dataBonus = clamp(dataCount * 0.03, 0, 0.15);
  const equatingConsistency = 1 - Math.abs(equatedTotal - similarityTotal) / JAP_MAX;
  const finalConfidence = Number(clamp(
    baseConfidence * 0.6 + equatingConsistency * 0.25 + dataBonus,
    0.18, 0.95
  ).toFixed(2));

  return {
    reading,
    listening,
    total: reading + listening,
    confidence: finalConfidence,
    sampleSize: Math.min(r.sampleSize, l.sampleSize),
    // 디버그 정보
    _debug: {
      equatedRead: equatedReadScore,
      equatedListen: equatedListenScore,
      equatedTotal,
      similarityTotal,
      trendTotal,
      blendedTotal,
      weightedR: Number(weightedR.toFixed(2)),
      weightedL: Number(weightedL.toFixed(2)),
      examDifficulty,
    },
  };
}

// ── 종합과목 점수 예측 ────────────────────────────────
export function estimateComprehensiveScore(exams, mistakes = []) {
  const target = setFromMistakes(mistakes);

  // 시험 기록 우선, 문제집 기록은 낮은 가중치
  const examHistory = exams
    .filter(e => e?.comprehensive && typeof e.comprehensive.score === 'number' && (!e.recordType || e.recordType === 'exam'))
    .map(e => ({
      score: e.comprehensive.score,
      features: setFromMistakes(e.comprehensive?.mistakes || []),
      date: e.date,
    }));

  const workbookHistory = exams
    .filter(e => e?.comprehensive && typeof e.comprehensive.score === 'number' && e.recordType === 'workbook')
    .map(e => {
      const normScore = e.comprehensive.rawMeta?.isRaw
        ? Math.round(e.comprehensive.score * COMP_MAX / (e.comprehensive.rawMeta.max || 200))
        : e.comprehensive.score;
      return {
        score: Math.round(normScore * 0.95),
        features: setFromMistakes(e.comprehensive?.mistakes || []),
        date: e.date,
      };
    });

  const combined = [...examHistory, ...workbookHistory];
  const result = estimateBySimilarity(combined, target, 'score', COMP_MAX);

  // 트렌드 보정
  const scores = examHistory.map(h => h.score);
  const trend = trendBasedPrediction(scores, COMP_MAX);
  if (trend !== null && examHistory.length >= 3) {
    const blended = Math.round(result.score * 0.7 + trend * 0.3);
    return { ...result, score: clamp(blended, 0, COMP_MAX) };
  }

  return result;
}

// ── 목표 달성 예상 시점 계산 ──────────────────────────
// exams: 시험 기록 배열, targetScore: 목표 점수, scoreExtractor: 점수 추출 함수
// 반환: { monthsAhead: number, date: string } | null
export function predictGoalDate(exams, targetScore, scoreExtractor) {
  const scores = exams
    .map(e => ({ score: scoreExtractor(e), date: e.date }))
    .filter(x => x.score != null && x.score > 0);
  if (scores.length < 2) return null;

  const recent = scores.slice(-6);
  const n = recent.length;
  const lastScore = recent[n - 1].score;
  if (lastScore >= targetScore) return { monthsAhead: 0, date: recent[n - 1].date, alreadyAchieved: true };

  const sumX = (n * (n - 1)) / 2;
  const sumY = recent.reduce((a, x) => a + x.score, 0);
  const sumXY = recent.reduce((s, x, i) => s + i * x.score, 0);
  const sumX2 = recent.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (!denom) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  if (slope <= 0) return null;
  const intercept = (sumY - slope * sumX) / n;

  const k = Math.ceil((targetScore - intercept) / slope - n + 1);
  if (k <= 0 || k > 60) return null;

  const lastDate = recent[n - 1].date;
  const [y, m] = lastDate.split('-').map(Number);
  const target = new Date(y, m - 1 + k);
  const dateStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
  return { monthsAhead: k, date: dateStr, alreadyAchieved: false };
}
