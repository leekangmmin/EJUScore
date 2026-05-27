// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { normalizeJapaneseScore, normalizeCompScore } from './storage';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// ── 학습 스트릭 ───────────────────────────────────────
// 연속으로 기록이 있는 월 수를 계산
export function getStudyStreak(exams) {
  if (!exams.length) return { current: 0, best: 0, lastActiveMonth: null };

  const months = [...new Set(exams.map(e => String(e.date).slice(0, 7)))].sort();
  if (months.length === 0) return { current: 0, best: 0, lastActiveMonth: null };

  let streak = 1;
  let best = 1;

  for (let i = 1; i < months.length; i++) {
    const [py, pm] = months[i - 1].split('-').map(Number);
    const [cy, cm] = months[i].split('-').map(Number);
    const monthDiff = (cy - py) * 12 + (cm - pm);

    if (monthDiff <= 1) {
      streak++;
      best = Math.max(best, streak);
    } else {
      streak = 1;
    }
  }

  return { current: streak, best, lastActiveMonth: months[months.length - 1] };
}

// ── 학습 일관성 ───────────────────────────────────────
// 최근 N개월 중 기록이 있는 월 비율 (0~100)
export function getStudyConsistency(exams, lookbackMonths = 3) {
  if (!exams.length) return 0;

  const now = new Date();
  let active = 0;

  for (let i = 0; i < lookbackMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (exams.some(e => String(e.date).startsWith(key))) active++;
  }

  return Math.round((active / lookbackMonths) * 100);
}

// ── 스타그네이션(정체) 감지 ───────────────────────────
// 최근 window 회 동안 점수 변동 < threshold 이면 정체로 판정
export function detectStagnation(exams, threshold = 8, window = 4) {
  const japScores = exams
    .filter(e => e.japanese)
    .map(e => {
      const n = normalizeJapaneseScore(e.japanese);
      return n ? n.reading + n.listening : null;
    })
    .filter(v => v != null);

  const compScores = exams
    .filter(e => e.comprehensive?.score != null)
    .map(e => normalizeCompScore(e.comprehensive))
    .filter(v => v != null);

  const isStagnant = (scores) => {
    if (scores.length < window) return false;
    const recent = scores.slice(-window);
    return Math.max(...recent) - Math.min(...recent) < threshold;
  };

  return {
    japanese: isStagnant(japScores),
    comprehensive: isStagnant(compScores),
    japaneseScores: japScores,
    comprehensiveScores: compScores,
  };
}

// ── 번아웃 리스크 감지 ────────────────────────────────
export function detectBurnoutRisk(exams) {
  if (exams.length < 2) return { risk: 'low', score: 0, reasons: [] };

  const japScores = exams
    .filter(e => e.japanese)
    .map(e => {
      const n = normalizeJapaneseScore(e.japanese);
      return n ? n.reading + n.listening : null;
    })
    .filter(v => v != null);

  const reasons = [];
  let riskScore = 0;

  // 최근 3회 점수 하락 체크
  if (japScores.length >= 3) {
    const recent = japScores.slice(-3);
    const drop = recent[0] - recent[recent.length - 1];
    if (drop > 20) {
      reasons.push(`최근 3회 ${drop}점 하락`);
      riskScore += 3;
    } else if (drop > 10) {
      reasons.push('최근 점수 소폭 하락 추세');
      riskScore += 1;
    }
  }

  // 최근 학습 빈도 저조
  const consistency = getStudyConsistency(exams, 3);
  if (consistency < 50) {
    reasons.push('최근 3개월 학습 빈도 저조');
    riskScore += 2;
  }

  // 시험 간격이 2개월 이상
  if (exams.length >= 2) {
    const sorted = [...exams].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const lastTwo = sorted.slice(-2);
    const [ay, am] = String(lastTwo[0].date).slice(0, 7).split('-').map(Number);
    const [by, bm] = String(lastTwo[1].date).slice(0, 7).split('-').map(Number);
    const gap = (by - ay) * 12 + (bm - am);
    if (gap > 2) {
      reasons.push('최근 시험 간격 2개월 초과');
      riskScore += 1;
    }
  }

  // 정체 감지
  const stag = detectStagnation(exams);
  if (stag.japanese || stag.comprehensive) {
    reasons.push('점수 정체 구간 감지');
    riskScore += 1;
  }

  const risk = riskScore >= 4 ? 'high' : riskScore >= 2 ? 'medium' : 'low';
  return { risk, score: riskScore, reasons };
}

// ── 목표 달성 확률 추정 ───────────────────────────────
// 점수 분포와 현재 추세를 기반으로 목표 달성 확률 추정
export function getAchievementProbability(exams, targetJap, targetComp) {
  const japScores = exams
    .filter(e => e.japanese)
    .map(e => {
      const n = normalizeJapaneseScore(e.japanese);
      return n ? n.reading + n.listening : null;
    })
    .filter(v => v != null);

  const compScores = exams
    .filter(e => e.comprehensive?.score != null)
    .map(e => normalizeCompScore(e.comprehensive))
    .filter(v => v != null);

  const calcProb = (scores, target) => {
    if (!scores.length) return null;
    const latest = scores[scores.length - 1];
    if (latest >= target) return 99;

    const n = scores.length;
    const avg = scores.reduce((a, b) => a + b, 0) / n;
    const variance = scores.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance) || 1;

    // 트렌드 계산 (최근 5회)
    const recent = scores.slice(-5);
    const trend = recent.length >= 2
      ? (recent[recent.length - 1] - recent[0]) / (recent.length - 1)
      : 0;

    // 트렌드 기반 예측 점수
    const projected = latest + trend * 3;

    // 가우시안 근사로 확률 계산
    const zScore = (projected - target) / stdDev;
    const rawProb = clamp(50 + zScore * 18, 5, 95);
    return Math.round(rawProb);
  };

  return {
    japanese: calcProb(japScores, targetJap),
    comprehensive: calcProb(compScores, targetComp),
  };
}

// ── 간단한 인사이트 메시지 생성 (규칙 기반) ──────────
// AI 모델 없이도 의미있는 개인화 메시지 생성
export function generateQuickInsight(exams, settings) {
  if (!exams.length) return null;

  const tJap  = settings?.targetJapanese      ?? 320;
  const tComp = settings?.targetComprehensive ?? 170;

  const japScores = exams
    .filter(e => e.japanese)
    .map(e => {
      const n = normalizeJapaneseScore(e.japanese);
      return n ? n.reading + n.listening : null;
    })
    .filter(v => v != null);

  const latest = japScores.at(-1);
  const prev   = japScores.length >= 2 ? japScores.at(-2) : null;
  const streak = getStudyStreak(exams);
  const burnout = detectBurnoutRisk(exams);
  const stag = detectStagnation(exams);
  const prob = getAchievementProbability(exams, tJap, tComp);

  // 우선순위 순으로 인사이트 선택
  if (burnout.risk === 'high') {
    return {
      type: 'warning',
      title: '번아웃 주의',
      body: `${burnout.reasons[0]} — 학습 리듬을 재점검하고 짧은 휴식 후 재시작을 권장합니다.`,
    };
  }

  if (latest != null && tJap - latest <= 10 && latest < tJap) {
    return {
      type: 'success',
      title: '목표 코앞!',
      body: `일본어 목표 ${tJap}점까지 단 ${tJap - latest}점 남았습니다. 조금만 더!`,
    };
  }

  if (stag.japanese && japScores.length >= 4) {
    return {
      type: 'info',
      title: '성장 정체 감지',
      body: '최근 점수 변동이 거의 없어요. 새로운 풀이 전략이나 단원을 시도해보세요.',
    };
  }

  if (prev != null && latest != null && latest - prev >= 10) {
    return {
      type: 'success',
      title: '큰 폭 상승!',
      body: `지난 회차 대비 ${latest - prev}점 올랐어요. 이 기세를 유지하세요!`,
    };
  }

  if (streak.current >= 3) {
    return {
      type: 'success',
      title: `${streak.current}개월 연속 학습 중`,
      body: '꾸준한 학습이 가장 빠른 성장입니다. 지금처럼만 이어가세요!',
    };
  }

  if (prob.japanese != null && prob.japanese >= 70) {
    return {
      type: 'info',
      title: `일본어 목표 달성 확률 ${prob.japanese}%`,
      body: '현재 페이스라면 목표 달성 가능성이 높아요. 꾸준히 유지하세요.',
    };
  }

  return {
    type: 'info',
    title: '학습을 계속하세요',
    body: '더 많은 데이터가 쌓일수록 AI 인사이트가 정확해집니다.',
  };
}
