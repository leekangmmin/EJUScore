function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function confidenceLabel(score) {
  if (score >= 0.78) return '높음';
  if (score >= 0.52) return '보통';
  return '낮음';
}

function setFromNumbers(arr = []) {
  return new Set(arr.filter(n => Number.isInteger(Number(n)) && Number(n) > 0).map(Number));
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

function applyWrongCountCap(predicted, wrongCount, totalQuestions, maxScore) {
  if (!Number.isFinite(wrongCount) || wrongCount <= 0) return clamp(predicted, 0, maxScore);
  const safeWrong = clamp(wrongCount, 0, totalQuestions);
  const theoreticalMax = ((totalQuestions - safeWrong) / totalQuestions) * maxScore;
  // 문제 배점 편차를 감안해 소폭 버퍼를 주되, 만점 오예측은 확실히 차단
  const bufferedCap = clamp(Math.round(theoreticalMax + maxScore * 0.04), 0, maxScore);
  return Math.min(clamp(predicted, 0, maxScore), bufferedCap);
}

function weightedWrongReading(arr = []) {
  return arr.reduce((sum, qRaw) => {
    const q = Number(qRaw);
    if (!Number.isInteger(q) || q <= 0) return sum;
    // 요청 반영: 독해 23~25번은 배점(감점 영향) 낮춤
    if (q === 23 || q === 24 || q === 25) return sum + 0.45;
    return sum + 1;
  }, 0);
}

function weightedWrongListening(arr = []) {
  return arr.reduce((sum, qRaw) => {
    const q = Number(qRaw);
    if (!Number.isInteger(q) || q <= 0) return sum;
    return sum + 1;
  }, 0);
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

export function estimateJapaneseScore(exams, wrongReading = [], wrongListening = []) {
  const rTarget = setFromNumbers(wrongReading);
  const lTarget = setFromNumbers(wrongListening);

  const rHistory = exams
    .filter(e => e?.japanese && typeof e.japanese.reading === 'number')
    .map(e => ({
      reading: e.japanese.reading,
      features: setFromNumbers(e.japanese?.wrongQuestions?.reading || []),
      date: e.date,
    }));

  const lHistory = exams
    .filter(e => e?.japanese && typeof e.japanese.listening === 'number')
    .map(e => ({
      listening: e.japanese.listening,
      features: setFromNumbers(e.japanese?.wrongQuestions?.listening || []),
      date: e.date,
    }));

  const r = estimateBySimilarity(rHistory, rTarget, 'reading', 200);
  const l = estimateBySimilarity(lHistory, lTarget, 'listening', 200);

  const weightedR = weightedWrongReading(wrongReading);
  const weightedL = weightedWrongListening(wrongListening);
  const weightedTotalWrong = weightedR + weightedL;

  // 사용자 기준 보정: 전체 오답 10개일 때 약 320점
  const calibratedTotal = clamp(Math.round(400 - weightedTotalWrong * 8), 0, 400);
  const similarityTotal = r.score + l.score;
  // 보정식을 기본축으로 두고, 유사패턴 결과는 미세 보정만 수행
  const blendedTotal = clamp(Math.round(calibratedTotal * 0.75 + similarityTotal * 0.25), 0, 400);

  const readShare =
    exams.filter(e => e?.japanese).reduce((s, e) => s + (e.japanese.reading || 0), 0) /
    Math.max(
      1,
      exams.filter(e => e?.japanese).reduce((s, e) => s + (e.japanese.reading || 0) + (e.japanese.listening || 0), 0)
    );
  const finalReadShare = clamp(readShare || 0.5, 0.42, 0.58);
  let reading = clamp(Math.round(blendedTotal * finalReadShare), 0, 200);
  let listening = clamp(blendedTotal - reading, 0, 200);
  // 200 상한으로 인해 합이 어긋난 경우 보정
  if (reading + listening !== blendedTotal) {
    const diff = blendedTotal - (reading + listening);
    if (diff > 0) {
      if (reading < 200) reading = clamp(reading + diff, 0, 200);
      else listening = clamp(listening + diff, 0, 200);
    }
  }

  reading = applyWrongCountCap(reading, Math.ceil(weightedR), 35, 200);
  listening = applyWrongCountCap(listening, Math.ceil(weightedL), 40, 200);

  return {
    reading,
    listening,
    total: reading + listening,
    confidence: Number(((r.confidence + l.confidence) / 2).toFixed(2)),
    sampleSize: Math.min(r.sampleSize, l.sampleSize),
  };
}

export function estimateComprehensiveScore(exams, mistakes = []) {
  const target = setFromMistakes(mistakes);
  const history = exams
    .filter(e => e?.comprehensive && typeof e.comprehensive.score === 'number')
    .map(e => ({
      score: e.comprehensive.score,
      features: setFromMistakes(e.comprehensive?.mistakes || []),
      date: e.date,
    }));

  return estimateBySimilarity(history, target, 'score', 200);
}
