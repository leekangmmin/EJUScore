// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License

export function generateDiagnosis(exams) {
  if (!exams.length) return [];
  const d = [];

  // ── Japanese wrong-question frequency ─────────────
  const rC = {}, lC = {};
  exams.forEach(e => {
    (e.japanese?.wrongQuestions?.reading   || []).forEach(q => { rC[q] = (rC[q]||0)+1; });
    (e.japanese?.wrongQuestions?.listening || []).forEach(q => { lC[q] = (lC[q]||0)+1; });
  });

  const topR = Object.entries(rC).sort((a,b)=>b[1]-a[1]);
  const topL = Object.entries(lC).sort((a,b)=>b[1]-a[1]);

  // Reading range buckets
  const rBkt = {'1-10번':0,'11-20번':0,'21-35번':0};
  Object.entries(rC).forEach(([q,c]) => {
    const n=Number(q);
    if(n<=10) rBkt['1-10번']+=c; else if(n<=20) rBkt['11-20번']+=c; else rBkt['21-35번']+=c;
  });
  const worstRBkt = Object.entries(rBkt).sort((a,b)=>b[1]-a[1]).find(([,c])=>c>0);

  // Listening range buckets
  const lBkt = {'1-15번':0,'16-30번':0,'31-40번':0};
  Object.entries(lC).forEach(([q,c]) => {
    const n=Number(q);
    if(n<=15) lBkt['1-15번']+=c; else if(n<=30) lBkt['16-30번']+=c; else lBkt['31-40번']+=c;
  });
  const worstLBkt = Object.entries(lBkt).sort((a,b)=>b[1]-a[1]).find(([,c])=>c>0);

  // ── Score trends ───────────────────────────────────
  const japScores  = exams.filter(e=>e.japanese).map(e=>e.japanese.reading+e.japanese.listening);
  const compScores = exams.filter(e=>e.comprehensive?.score!=null).map(e=>e.comprehensive.score);

  const japTrend3  = japScores.length  >= 3 ? japScores.slice(-1)[0]  - japScores.slice(-3)[0]  : null;
  const compTrend3 = compScores.length >= 3 ? compScores.slice(-1)[0] - compScores.slice(-3)[0] : null;

  const japStagnant = japScores.length >= 3 &&
    Math.abs(japScores.at(-1)-japScores.at(-2)) < 5 &&
    Math.abs(japScores.at(-2)-japScores.at(-3)) < 5;

  // ── Comprehensive unit analysis ────────────────────
  const unitErr = {};
  exams.forEach(e => (e.comprehensive?.mistakes||[]).forEach(m => {
    if(!unitErr[m.unit]) unitErr[m.unit]={ 실수:0, 정보부족:0, 연계사고부족:0 };
    unitErr[m.unit][m.errorType] = (unitErr[m.unit][m.errorType]||0)+1;
  }));
  const unitRanked = Object.entries(unitErr)
    .map(([u,e])=>({ u, score: e['정보부족']*3+e['연계사고부족']*2+e['실수'], dominant: Object.entries(e).sort((a,b)=>b[1]-a[1])[0][0] }))
    .sort((a,b)=>b.score-a.score);

  // ── Build diagnosis items ──────────────────────────
  if(topR[0]?.[1] >= 2) {
    const [q,c]=topR[0];
    d.push({ level:c>=4?'critical':'warning', icon:'🎯', title:`독해 ${q}번 반복 오답`, desc:`${c}회 틀림 — 해당 문제 유형 집중 공략 필요` });
  }
  if(topL[0]?.[1] >= 2) {
    const [q,c]=topL[0];
    d.push({ level:c>=4?'critical':'warning', icon:'🎧', title:`청해 ${q}번 반복 오답`, desc:`${c}회 틀림 — 해당 파트 집중 청취 훈련 권장` });
  }
  if(worstRBkt) {
    d.push({ level:'info', icon:'📖', title:`독해 ${worstRBkt[0]} 구간 집중 약점`, desc:'해당 구간 오답 비율 최고 — 관련 파트 반복 풀이 권장' });
  }
  if(worstLBkt && worstLBkt[0] !== worstRBkt?.[0]) {
    d.push({ level:'info', icon:'🎙', title:`청해 ${worstLBkt[0]} 구간 집중 약점`, desc:'해당 구간 오답 비율 최고 — 집중 청취 훈련 권장' });
  }
  if(unitRanked[0]) {
    const w=unitRanked[0];
    const tip = w.dominant==='정보부족'?'관련 이론 지식 보완 필요':
                w.dominant==='연계사고부족'?'복합 논리 문제 연습 필요':'실수 방지를 위한 꼼꼼한 검토 필요';
    d.push({ level:'warning', icon:'📚', title:`종합과목 '${w.u}' 집중 약점`, desc:`${w.dominant} 오답 다수 — ${tip}` });
  }
  if(japTrend3 !== null) {
    if(japTrend3 > 10)       d.push({ level:'good',     icon:'📈', title:'일본어 상승세', desc:`최근 3회 기준 +${japTrend3}점 상승 — 현 페이스 유지하세요!` });
    else if(japTrend3 < -5)  d.push({ level:'critical', icon:'📉', title:'일본어 점수 하락 추세', desc:`최근 3회 기준 ${japTrend3}점 하락 — 학습 방식 점검 필요` });
    else if(japStagnant)     d.push({ level:'info',     icon:'😐', title:'일본어 점수 정체 구간', desc:'3회 연속 유사한 점수 — 새로운 전략 시도 권장' });
  }
  if(compTrend3 !== null && compTrend3 > 5) {
    d.push({ level:'good', icon:'📊', title:'종합과목 상승세', desc:`최근 3회 기준 +${compTrend3}점 상승 — 잘하고 있어요!` });
  }
  if(d.length === 0 && exams.length >= 2) {
    d.push({ level:'good', icon:'✅', title:'눈에 띄는 약점 없음', desc:'오답 패턴이 안정적입니다. 현재 페이스를 유지하세요!' });
  }

  return d;
}

export function getDday(nextExamDate) {
  if (!nextExamDate) return null;
  const diff = Math.ceil((new Date(nextExamDate) - new Date()) / 86400000);
  return diff;
}
