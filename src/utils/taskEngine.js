// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { normalizeJapaneseScore } from './storage';
import { detectStagnation, getStudyConsistency } from './analytics';

// ── 타입 상수 ─────────────────────────────────────────
export const TASK_CATEGORY = {
  READING:   '독해',
  LISTENING: '청해',
  COMP:      '종합과목',
  STRATEGY:  '전략',
  MOCK:      '모의고사',
  REST:      '회복',
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// ── 내부 유틸 ─────────────────────────────────────────
function topEntries(countMap, limit = 5) {
  return Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function readingBucket(q) {
  const n = Number(q);
  if (n <= 10) return '1~10번 (문법·어휘)';
  if (n <= 20) return '11~20번 (독해 지문)';
  return '21~25번 (장문 독해)';
}

function listeningBucket(q) {
  const n = Number(q);
  if (n <= 15) return '1~15번 (단문 청취)';
  if (n <= 30) return '16~30번 (대화 청취)';
  return '31~40번 (장문 청취)';
}

// ── 메인 엔진 ─────────────────────────────────────────
export function generateDailyTasks(exams, settings) {
  if (!exams || exams.length === 0) return getDefaultTasks();

  const tJap  = settings?.targetJapanese ?? 320;
  const ddayMs = settings?.nextExamDate
    ? new Date(settings.nextExamDate) - new Date()
    : null;
  const dday = ddayMs != null ? Math.ceil(ddayMs / 86400000) : null;

  // ── 오답 빈도 집계 ────────────────────────────────
  const rC = {}, lC = {};
  exams.forEach(e => {
    (e.japanese?.wrongQuestions?.reading   || []).forEach(q => { rC[q] = (rC[q] || 0) + 1; });
    (e.japanese?.wrongQuestions?.listening || []).forEach(q => { lC[q] = (lC[q] || 0) + 1; });
  });

  const topReading   = topEntries(rC, 5);
  const topListening = topEntries(lC, 5);

  // ── 종합과목 단원 오류 집계 ───────────────────────
  const unitErr = {};
  exams.forEach(e => (e.comprehensive?.mistakes || []).forEach(m => {
    if (!m.unit) return;
    unitErr[m.unit] = (unitErr[m.unit] || 0) + 1;
  }));
  const topUnits = topEntries(unitErr, 3);

  // ── 점수 추이 ─────────────────────────────────────
  const japScores = exams
    .filter(e => e.japanese)
    .map(e => { const n = normalizeJapaneseScore(e.japanese); return n ? n.reading + n.listening : null; })
    .filter(v => v != null);
  const latestJap = japScores.at(-1) ?? null;

  // ── 약점 버킷 ─────────────────────────────────────
  const rBkt = {};
  topReading.forEach(([q]) => {
    const bk = readingBucket(q);
    rBkt[bk] = (rBkt[bk] || 0) + (rC[q] || 0);
  });
  const worstRBkt = Object.entries(rBkt).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const lBkt = {};
  topListening.forEach(([q]) => {
    const bk = listeningBucket(q);
    lBkt[bk] = (lBkt[bk] || 0) + (lC[q] || 0);
  });
  const worstLBkt = Object.entries(lBkt).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // ── 분석 ─────────────────────────────────────────
  const stag        = detectStagnation(exams);
  const consistency = getStudyConsistency(exams, 3);
  const urgency     = dday != null && dday <= 14 ? 'high'
                    : dday != null && dday <= 30 ? 'medium'
                    : 'normal';

  const tasks = [];

  // Task 1: 독해 반복 오답 복습
  if (topReading.length > 0) {
    const nums = topReading.slice(0, 3).map(([q]) => `${q}번`).join(', ');
    const maxCount = topReading[0][1];
    tasks.push({
      id: 'reading_weak',
      category: TASK_CATEGORY.READING,
      title: '독해 반복 오답 복습',
      description: `${nums} 유형 집중 풀이 · ${worstRBkt ? worstRBkt + ' 구간' : ''}`,
      duration: 30,
      priority: maxCount >= 3 ? 'high' : 'medium',
      difficulty: maxCount >= 3 ? 'hard' : 'medium',
      color: 'var(--purple)',
    });
  }

  // Task 2: 청해 섀도잉 훈련
  if (topListening.length > 0) {
    const maxCount = topListening[0][1];
    tasks.push({
      id: 'listening_weak',
      category: TASK_CATEGORY.LISTENING,
      title: '청해 집중 훈련',
      description: `${worstLBkt ?? ''} 구간 섀도잉 + 반복 청취 × 20분`,
      duration: 20,
      priority: maxCount >= 3 ? 'high' : 'medium',
      difficulty: 'medium',
      color: 'var(--pink)',
    });
  }

  // Task 3: 종합과목 약점 단원
  if (topUnits.length > 0) {
    const [unit, count] = topUnits[0];
    tasks.push({
      id: 'comp_unit',
      category: TASK_CATEGORY.COMP,
      title: `종합과목 '${unit}' 단원 강화`,
      description: `오답 ${count}회 누적 — 관련 이론 재점검 + 유사 문제 풀이`,
      duration: 40,
      priority: count >= 3 ? 'high' : 'medium',
      difficulty: 'hard',
      color: 'var(--green)',
    });
  }

  // Task 4: 정체 극복 (스타그네이션 감지 시)
  if (stag.japanese || stag.comprehensive) {
    const which = stag.japanese ? '일본어 독해' : '종합과목';
    tasks.push({
      id: 'stagnation_break',
      category: TASK_CATEGORY.STRATEGY,
      title: '정체 극복 집중 전략',
      description: `${which} 점수 정체 — 새 문제집 유형 도전 + 오답 노트 정리`,
      duration: 45,
      priority: 'high',
      difficulty: 'hard',
      color: 'var(--orange)',
    });
  }

  // Task 5: 목표 달성 스프린트 (10점 이내)
  if (latestJap != null && tJap - latestJap > 0 && tJap - latestJap <= 20) {
    tasks.push({
      id: 'goal_sprint',
      category: TASK_CATEGORY.MOCK,
      title: '목표 달성 스프린트',
      description: `일본어 목표까지 ${tJap - latestJap}점 — 실전 모의고사 1회분 + 오답 즉시 분석`,
      duration: 90,
      priority: 'high',
      difficulty: 'hard',
      color: 'var(--blue)',
    });
  }

  // Task 6: D-day 임박 최종 점검
  if (urgency === 'high' && dday != null && dday > 0) {
    tasks.push({
      id: 'dday_final',
      category: TASK_CATEGORY.MOCK,
      title: `D-${dday} 최종 점검`,
      description: '실전 감각 유지 — 타이머 설정 후 전 영역 풀기',
      duration: 120,
      priority: 'high',
      difficulty: 'hard',
      color: 'var(--red)',
    });
  }

  // Task 7: 학습 공백 복귀 (일관성 낮을 때)
  if (consistency < 50 && japScores.length >= 1) {
    tasks.push({
      id: 'comeback',
      category: TASK_CATEGORY.STRATEGY,
      title: '학습 루틴 재확립',
      description: '최근 학습 빈도가 낮아요. 짧게라도 매일 한 파트씩 풀어보세요.',
      duration: 15,
      priority: 'medium',
      difficulty: 'easy',
      color: 'var(--cyan)',
    });
  }

  // 중복 제거 + 우선순위 정렬 + 상위 5개만
  const seen = new Set();
  return tasks
    .filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; })
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2))
    .slice(0, 5);
}

// ── 기본 태스크 (데이터 없을 때) ────────────────────
function getDefaultTasks() {
  return [
    {
      id: 'default_reading',
      category: TASK_CATEGORY.READING,
      title: '독해 기초 연습',
      description: '독해 문제 10문항 풀기 (30분)',
      duration: 30,
      priority: 'medium',
      difficulty: 'easy',
      color: 'var(--purple)',
    },
    {
      id: 'default_listening',
      category: TASK_CATEGORY.LISTENING,
      title: '청해 기초 청취',
      description: '청해 연습 문제 10문항 (20분)',
      duration: 20,
      priority: 'medium',
      difficulty: 'easy',
      color: 'var(--pink)',
    },
    {
      id: 'default_comp',
      category: TASK_CATEGORY.COMP,
      title: '종합과목 단원 학습',
      description: '취약 단원 하나 골라 교재 복습',
      duration: 40,
      priority: 'low',
      difficulty: 'easy',
      color: 'var(--green)',
    },
  ];
}

// ── 태스크 완료 기록 관리 ─────────────────────────────
const TASKS_KEY = 'eju_daily_tasks';

export function getTaskRecord() {
  try {
    return JSON.parse(localStorage.getItem(TASKS_KEY) || '{}');
  } catch { return {}; }
}

export function markTaskDone(taskId, date) {
  const record = getTaskRecord();
  if (!record[date]) record[date] = [];
  if (!record[date].includes(taskId)) record[date].push(taskId);
  localStorage.setItem(TASKS_KEY, JSON.stringify(record));
}

export function unmarkTaskDone(taskId, date) {
  const record = getTaskRecord();
  if (record[date]) record[date] = record[date].filter(id => id !== taskId);
  localStorage.setItem(TASKS_KEY, JSON.stringify(record));
}

export function getTodayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// 최근 N일간 완료된 태스크 수 (스트릭용)
export function getCompletionStats(days = 7) {
  const record = getTaskRecord();
  const stats = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    stats.push({ date: key, count: (record[key] || []).length });
  }
  return stats;
}
