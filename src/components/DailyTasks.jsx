// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, Clock, RefreshCw, Zap,
  BookOpen, Headphones, Layers, Target, Trophy,
  TrendingUp, AlertTriangle, Activity, Flame, Info,
} from 'lucide-react';
import {
  generateDailyTasks,
  markTaskDone, unmarkTaskDone, getTaskRecord,
  getTodayKey, getCompletionStats, TASK_CATEGORY,
} from '../utils/taskEngine';
import { getStudyStreak, getStudyConsistency, detectBurnoutRisk } from '../utils/analytics';
import { getDday } from '../utils/diagnosis';

const CARD = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: 18, padding: 22,
  boxShadow: 'var(--card-shadow)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
};

const PRIORITY_LABEL = {
  high:   { label: '높음', bg: 'rgba(239,68,68,0.12)',   color: 'var(--red)',    border: 'rgba(239,68,68,0.3)' },
  medium: { label: '보통', bg: 'rgba(245,158,11,0.12)', color: 'var(--yellow)', border: 'rgba(245,158,11,0.3)' },
  low:    { label: '낮음', bg: 'rgba(107,163,255,0.1)', color: 'var(--blue)',   border: 'rgba(107,163,255,0.3)' },
};

const DIFF_LABEL = {
  easy:   { label: '쉬움', color: 'var(--green)' },
  medium: { label: '보통', color: 'var(--yellow)' },
  hard:   { label: '어려움', color: 'var(--red)' },
};

const CAT_ICON = {
  [TASK_CATEGORY.READING]:   BookOpen,
  [TASK_CATEGORY.LISTENING]: Headphones,
  [TASK_CATEGORY.COMP]:      Layers,
  [TASK_CATEGORY.STRATEGY]:  Target,
  [TASK_CATEGORY.MOCK]:      Trophy,
  [TASK_CATEGORY.REST]:      Activity,
};

// ── 하루 완료 히트맵 ──────────────────────────────────
function WeekHeatmap({ stats }) {
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const today = new Date().getDay();
  const reordered = stats.slice(-7);

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {reordered.map((s, i) => {
        const dayIdx = (today - 6 + i + 7) % 7;
        const active = s.count > 0;
        return (
          <div key={s.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: active
                ? s.count >= 3 ? 'var(--blue)' : 'rgba(107,163,255,0.4)'
                : 'var(--bg3)',
              border: i === 6 ? '1.5px solid rgba(107,163,255,0.5)' : '1px solid var(--bd0)',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {active && <span style={{ fontSize: 11, fontWeight: 700, color: i === 6 || active ? '#fff' : 'var(--t3)' }}>{s.count}</span>}
            </div>
            <span style={{ fontSize: 9, color: i === 6 ? 'var(--blue)' : 'var(--t3)', fontWeight: i === 6 ? 700 : 400 }}>
              {days[dayIdx]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── 개별 태스크 카드 ──────────────────────────────────
function TaskCard({ task, done, onToggle }) {
  const [hovered, setHovered] = useState(false);
  const pStyle = PRIORITY_LABEL[task.priority] || PRIORITY_LABEL.low;
  const dStyle = DIFF_LABEL[task.difficulty]   || DIFF_LABEL.easy;
  const CatIcon = CAT_ICON[task.category] || Target;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '16px 18px',
        background: done ? 'var(--bg3)' : 'var(--card-bg)',
        border: `1px solid ${done ? 'var(--bd0)' : hovered ? 'rgba(107,163,255,0.25)' : 'var(--card-border)'}`,
        borderRadius: 16,
        boxShadow: done ? 'none' : hovered ? 'var(--card-shadow-hover)' : 'var(--card-shadow)',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
        opacity: done ? 0.6 : 1,
      }}
      onClick={() => onToggle(task.id)}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      {/* 체크 아이콘 */}
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        {done
          ? <CheckCircle2 size={22} color="var(--green)" strokeWidth={2} />
          : <Circle size={22} color="var(--t3)" strokeWidth={1.5} />
        }
      </div>

      {/* 카테고리 아이콘 */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${task.color}18`,
        border: `1px solid ${task.color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s',
      }}>
        <CatIcon size={16} color={task.color} strokeWidth={2} />
      </div>

      {/* 내용 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: done ? 'var(--t2)' : 'var(--t0)',
          textDecoration: done ? 'line-through' : 'none',
          marginBottom: 4,
        }}>
          {task.title}
        </div>
        <div style={{
          fontSize: 12, color: 'var(--t2)', lineHeight: 1.5,
          textDecoration: done ? 'line-through' : 'none',
        }}>
          {task.description}
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 카테고리 뱃지 */}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
            background: `${task.color}14`, color: task.color,
            border: `1px solid ${task.color}28`,
          }}>{task.category}</span>

          {/* 우선순위 */}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
            background: pStyle.bg, color: pStyle.color, border: `1px solid ${pStyle.border}`,
          }}>{pStyle.label}</span>

          {/* 난이도 */}
          <span style={{ fontSize: 10, color: dStyle.color, fontWeight: 600 }}>
            {dStyle.label}
          </span>

          {/* 시간 */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--t3)' }}>
            <Clock size={11} strokeWidth={2} />
            {task.duration}분
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── 분석 인사이트 카드 ────────────────────────────────
function InsightCard({ streak, consistency, burnout, dday }) {
  const items = [];

  if (burnout.risk === 'high') {
    items.push({
      icon: AlertTriangle, color: 'var(--red)', bg: 'rgba(239,68,68,0.08)',
      border: 'rgba(239,68,68,0.25)',
      text: `번아웃 주의 — ${burnout.reasons[0] || '학습 리듬 재점검 필요'}`,
    });
  }

  if (streak.current >= 2) {
    items.push({
      icon: Flame, color: 'var(--orange)', bg: 'rgba(245,147,78,0.08)',
      border: 'rgba(245,147,78,0.25)',
      text: `${streak.current}개월 연속 학습 중 🔥`,
    });
  }

  items.push({
    icon: Activity, color: 'var(--blue)', bg: 'rgba(107,163,255,0.08)',
    border: 'rgba(107,163,255,0.2)',
    text: `최근 3개월 학습 일관성 ${consistency}%`,
  });

  if (dday != null && dday > 0 && dday <= 30) {
    items.push({
      icon: Target, color: dday <= 7 ? 'var(--red)' : 'var(--orange)',
      bg: dday <= 7 ? 'rgba(239,68,68,0.08)' : 'rgba(245,147,78,0.08)',
      border: dday <= 7 ? 'rgba(239,68,68,0.25)' : 'rgba(245,147,78,0.25)',
      text: `EJU 시험 D-${dday} — 집중 모드!`,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.slice(0, 3).map((it, i) => {
        const Ic = it.icon;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12,
            background: it.bg, border: `1px solid ${it.border}`,
          }}>
            <Ic size={14} color={it.color} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500 }}>{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────
export default function DailyTasks({ exams, settings }) {
  const todayKey = getTodayKey();
  const [doneIds, setDoneIds] = useState(() => getTaskRecord()[todayKey] || []);
  // tasks를 state로 관리해 명시적 재생성 트리거 지원
  const [tasks, setTasks] = useState(() => generateDailyTasks(exams, settings));

  const weekStats   = useMemo(() => getCompletionStats(7), [doneIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const streak      = useMemo(() => getStudyStreak(exams), [exams]);
  const consistency = useMemo(() => getStudyConsistency(exams, 3), [exams]);
  const burnout     = useMemo(() => detectBurnoutRisk(exams), [exams]);
  const dday        = getDday(settings?.nextExamDate);

  const totalMinutes  = tasks.reduce((s, t) => s + (t.duration || 0), 0);
  const doneCount     = doneIds.filter(id => tasks.some(t => t.id === id)).length;
  const progress      = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const allDone       = tasks.length > 0 && doneCount === tasks.length;

  const handleToggle = useCallback((taskId) => {
    setDoneIds(prev => {
      if (prev.includes(taskId)) {
        unmarkTaskDone(taskId, todayKey);
        return prev.filter(id => id !== taskId);
      } else {
        markTaskDone(taskId, todayKey);
        return [...prev, taskId];
      }
    });
  }, [todayKey]);

  const handleRefresh = () => setTasks(generateDailyTasks(exams, settings));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--t0)', letterSpacing: '-0.5px', marginBottom: 5 }}>
            오늘의 학습
          </h1>
          <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
            성적 데이터 기반 맞춤형 태스크 · {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg3)', color: 'var(--t2)',
            border: '1px solid var(--bd1)', borderRadius: 10,
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bd1)'; e.currentTarget.style.color = 'var(--t2)'; }}
        >
          <RefreshCw size={13} strokeWidth={2} />
          태스크 재생성
        </button>
      </div>

      {/* 진행 카드 */}
      <div style={{ ...CARD, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: allDone
                ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(56,204,232,0.15))'
                : 'linear-gradient(135deg, rgba(107,163,255,0.12), rgba(164,110,245,0.12))',
              border: `1px solid ${allDone ? 'rgba(16,185,129,0.3)' : 'rgba(107,163,255,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {allDone
                ? <CheckCircle2 size={24} color="var(--green)" strokeWidth={1.8} />
                : <Zap size={24} color="var(--blue)" strokeWidth={1.8} />
              }
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 2 }}>
                {allDone ? '오늘 목표 완료!' : `${doneCount} / ${tasks.length} 완료`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                예상 시간 {totalMinutes}분 · 우선 과제 {tasks.filter(t => t.priority === 'high').length}개
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 32, fontWeight: 800, letterSpacing: '-1px',
              background: allDone ? 'linear-gradient(135deg, var(--green), var(--cyan))' : 'var(--grad-primary)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>{progress}%</div>
          </div>
        </div>
        {/* 진행바 */}
        <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
          <motion.div
            style={{
              height: '100%', borderRadius: 4,
              background: allDone
                ? 'linear-gradient(90deg, var(--green), var(--cyan))'
                : 'var(--grad-primary)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* 투 컬럼 레이아웃 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, alignItems: 'start' }}>

        {/* 태스크 리스트 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <AnimatePresence>
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                done={doneIds.includes(task.id)}
                onToggle={handleToggle}
              />
            ))}
          </AnimatePresence>
          {tasks.length === 0 && (
            <div style={{
              ...CARD, textAlign: 'center', padding: '40px 24px',
              color: 'var(--t2)', fontSize: 13,
            }}>
              점수를 입력하면 맞춤 태스크가 생성됩니다.
            </div>
          )}
        </div>

        {/* 사이드 패널 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 주간 히트맵 */}
          <div style={{ ...CARD, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <TrendingUp size={14} color="var(--blue)" strokeWidth={2} /> 이번 주 학습 현황
            </div>
            <WeekHeatmap stats={weekStats} />
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--t3)' }}>
              숫자 = 완료한 태스크 수
            </div>
          </div>

          {/* 스트릭 + 일관성 */}
          <div style={{ ...CARD, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Flame size={14} color="var(--orange)" strokeWidth={2} /> 학습 통계
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: '연속 학습', value: `${streak.current}개월`, sub: `최고 ${streak.best}개월`, color: 'var(--orange)' },
                { label: '학습 일관성', value: `${consistency}%`, sub: '최근 3개월', color: 'var(--blue)' },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'var(--bg3)', borderRadius: 12, padding: '12px 14px',
                  border: '1px solid var(--bd0)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 인사이트 */}
          <div style={{ ...CARD, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Info size={14} color="var(--purple)" strokeWidth={2} /> 학습 인사이트
            </div>
            <InsightCard streak={streak} consistency={consistency} burnout={burnout} dday={dday} />
          </div>

        </div>
      </div>

      {/* 전체 완료 축하 */}
      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{
              ...CARD,
              textAlign: 'center', padding: '28px 24px',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(56,204,232,0.06))',
              border: '1px solid rgba(16,185,129,0.25)',
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)', marginBottom: 6 }}>
              오늘의 학습 완료!
            </div>
            <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7 }}>
              훌륭해요! 오늘 목표를 모두 달성했습니다.<br />꾸준한 학습이 합격의 지름길입니다.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
