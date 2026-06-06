// 연도·회차별 문항 난이도/구성 분석 — 독립 패널
// 데이터: public/dataset/difficulty/exam_difficulty.json (실제 기출 OCR 기반 추정)
// ⚠ 난이도는 EJU 미공개 항목이라 본문 특징 기반 "추정치"이며 실측이 아님.
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Info, Layers } from 'lucide-react';

const BASE = import.meta.env.BASE_URL || '/';

const DOMAIN_COLOR = {
  경제: '#3182f6', 정치: '#8b5cf6', 역사: '#ef4444', 지리: '#10b981', 사회: '#f59e0b', 미분류: '#94a3b8',
};
const FMT_COLOR = {
  '암기·이해': '#64748b', '자료해석': '#0ea5e9', '그래프·도표': '#6366f1', '지도': '#10b981',
};
const DIFF_COLOR = { 상: '#ef4444', 중: '#f59e0b', 하: '#10b981' };

const card = { background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 14, padding: 16, marginBottom: 14 };
const chip = (bg, color) => ({ fontSize: 10.5, fontWeight: 700, color, background: bg, padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' });

export default function ExamDifficultyPanel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [year, setYear] = useState(null);
  const [round, setRound] = useState(null);

  useEffect(() => {
    let on = true;
    fetch(`${BASE}dataset/difficulty/exam_difficulty.json`)
      .then(r => { if (!r.ok) throw new Error('load'); return r.json(); })
      .then(d => { if (!on) return; setData(d); const y = d.years[d.years.length - 1]; setYear(y); setRound((d.yearRounds[String(y)] || [1])[0]); })
      .catch(() => on && setErr(true));
    return () => { on = false; };
  }, []);

  const rounds = useMemo(() => (data && year ? (data.yearRounds[String(year)] || []) : []), [data, year]);
  const exam = useMemo(() => (data && year && round ? data.exams[`${year}_${round}`] : null), [data, year, round]);

  if (err) return null;
  if (!data) return <div style={{ ...card, color: 'var(--t3)', fontSize: 13 }}>난이도 데이터 불러오는 중…</div>;

  const s = exam?.summary;
  const maxDom = s ? Math.max(1, ...Object.values(s.domains)) : 1;

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: 'var(--t0)', marginBottom: 4 }}>
        <BarChart3 size={16} color="#6366f1" /> 연도·회차별 문항 난이도 분석
      </div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 12, lineHeight: 1.5 }}>
        실제 기출 OCR에서 문항을 분할해 영역·자료유형·<b>추정 난이도</b>를 산출. EJU는 문항별 난이도를 공개하지 않아
        난이도는 본문 특징 기반 <b>추정치(실측 아님)</b>이며, OCR 한계로 회차당 일부 문항만 인식됩니다.
      </div>

      {/* ── 연도 / 회차 선택 ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select value={year || ''} onChange={e => { const y = Number(e.target.value); setYear(y); setRound((data.yearRounds[String(y)] || [1])[0]); }}
          style={{ fontSize: 13, fontWeight: 700, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--bd0)', background: 'var(--bg1)', color: 'var(--t0)' }}>
          {data.years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {rounds.map(r => (
            <button key={r} onClick={() => setRound(r)}
              style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${round === r ? '#3182f6' : 'var(--bd0)'}`,
                background: round === r ? '#3182f6' : 'var(--bg1)', color: round === r ? '#fff' : 'var(--t1)' }}>
              제{r}회
            </button>
          ))}
        </div>
      </div>

      {!exam ? (
        <div style={{ color: 'var(--t3)', fontSize: 13 }}>해당 회차 데이터가 없습니다.</div>
      ) : (
        <>
          {/* ── 회차 요약 ── */}
          <div style={{ background: 'var(--bg1)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <Layers size={14} color="var(--t2)" />
              <b style={{ fontSize: 13, color: 'var(--t0)' }}>{exam.label} 요약</b>
              <span style={chip('var(--bg2)', 'var(--t2)')}>OCR 인식 {exam.recognizedQ}/{exam.totalQ}문항</span>
              <span style={chip('rgba(245,158,11,0.12)', DIFF_COLOR[s.diffBand])}>추정 난이도 {s.avgDifficulty} · {s.diffBand}</span>
              <span style={chip('var(--bg2)', 'var(--t2)')}>자료/그래프/지도형 {s.visualQ}문항</span>
            </div>

            {/* 영역 분포 막대 */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', marginBottom: 6 }}>영역 분포 (인식 문항 기준)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {Object.entries(s.domains).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 34, fontSize: 11, color: 'var(--t2)', fontWeight: 700 }}>{k}</span>
                  <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 4, height: 14, overflow: 'hidden' }}>
                    <div style={{ width: `${(v / maxDom) * 100}%`, height: '100%', background: DOMAIN_COLOR[k], borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 22, textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--t1)' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* 자료유형 칩 + 핵심 토픽 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {Object.entries(s.formats).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <span key={k} style={chip('var(--bg2)', FMT_COLOR[k] || 'var(--t2)')}>{k} {v}</span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.6 }}>
              <b>핵심 토픽:</b> {s.topTopics.map(t => `${t.name}`).join(' · ')}
            </div>
          </div>

          {/* ── 문항별 표 ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 8 }}>
            문항별 분석 <Info size={11} color="var(--t3)" />
            <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--t3)' }}>· 번호=OCR 인식 채점번호(없으면 인식순)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 460, overflowY: 'auto' }}>
            {exam.questions.map((q, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg1)', borderRadius: 8, borderLeft: `3px solid ${DIFF_COLOR[q.diffLabel]}` }}>
                <span style={{ width: 30, textAlign: 'center', fontSize: 12, fontWeight: 800, color: 'var(--t0)' }}>
                  {q.officialN ?? `~${q.seq}`}
                </span>
                <span style={{ ...chip('var(--bg2)', DOMAIN_COLOR[q.domainKo]), minWidth: 30, textAlign: 'center' }}>{q.domainKo}</span>
                <span style={{ ...chip('var(--bg2)', FMT_COLOR[q.format] || 'var(--t2)'), display: 'inline-block' }}>{q.format}</span>
                <span style={{ ...chip('var(--bg2)', DIFF_COLOR[q.diffLabel]), minWidth: 56, textAlign: 'center' }}>{q.diffLabel} {q.difficulty}</span>
                <span style={{ flex: 1, fontSize: 11, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.stem}>{q.stem}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 8, lineHeight: 1.5 }}>
            ※ 난이도는 자료유형·지문 길이·영역 등 본문 특징으로 산출한 추정치입니다(정답률 통계 아님). 미인식 문항은 표에서 제외됩니다.
          </div>
        </>
      )}
    </div>
  );
}
