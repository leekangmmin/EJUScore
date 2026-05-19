// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useState, useRef, useEffect } from 'react';
import { Sparkles, Download, RefreshCw, Bot, AlertCircle, Cpu } from 'lucide-react';
import { loadModel, generateFeedback, isElectronAI } from '../utils/aiEngine';

const CARD = {
  background: 'var(--card-bg)',
  border: '1px solid var(--bd0)',
  borderRadius: 18,
  padding: 24,
  boxShadow: 'var(--card-shadow)',
};

// ── 다운로드 진행 바 ──────────────────────────────────────
function ProgressBar({ progress }) {
  const pct = progress?.progress ?? 0;
  const file = progress?.file ?? '';
  const shortFile = file.split('/').at(-1) ?? '';
  const loaded = progress?.loaded ?? 0;
  const total  = progress?.total  ?? 0;

  const toMB = (b) => b > 0 ? `${(b / 1024 / 1024).toFixed(1)} MB` : '';

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      {shortFile && (
        <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 6, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shortFile}
        </div>
      )}
      <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, var(--blue), var(--purple))',
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)' }}>
        <span>{pct.toFixed(0)}%</span>
        {total > 0 && <span>{toMB(loaded)} / {toMB(total)}</span>}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function AICoach({ exams, settings }) {
  const [phase, setPhase]           = useState('idle'); // idle | downloading | generating | done | error
  const [progress, setProgress]     = useState(null);
  const [feedback, setFeedback]     = useState('');
  const [errorMsg, setErrorMsg]     = useState('');
  const outputRef = useRef(null);

  const available = isElectronAI();

  // 출력 영역 자동 스크롤
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [feedback]);

  const handleLoad = async () => {
    setPhase('downloading');
    setProgress(null);
    setErrorMsg('');
    try {
      await loadModel((p) => setProgress(p));
      // 로드 완료 후 즉시 생성 시작
      await runGenerate();
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  const runGenerate = async () => {
    setPhase('generating');
    setFeedback('');
    setErrorMsg('');
    try {
      await generateFeedback(exams, settings, (token) => {
        setFeedback(prev => prev + token);
      });
      setPhase('done');
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  const handleAnalyze = async () => {
    setErrorMsg('');
    setFeedback('');
    try {
      // 이미 로드됐으면 바로 생성, 아니면 로드 후 생성
      const loaded = await window.electronAPI.ai.isLoaded();
      if (loaded) {
        await runGenerate();
      } else {
        await handleLoad();
      }
    } catch {
      await handleLoad();
    }
  };

  // ── 웹 모드 (Electron 아님) ───────────────────────────
  if (!available) {
    return (
      <div style={{ ...CARD, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, gap: 16, textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'rgba(107,163,255,0.1)',
          border: '1px solid rgba(107,163,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={32} color="var(--blue)" strokeWidth={1.5} style={{ opacity: 0.65 }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t0)', marginBottom: 6 }}>AI 코치는 데스크톱 앱 전용입니다</div>
          <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7, maxWidth: 280 }}>
            Electron 앱으로 실행하면<br />로컬 AI 피드백을 이용할 수 있어요
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 헤더 ── */}
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--t0)', letterSpacing: '-0.5px', marginBottom: 6 }}>
          AI 학습 코치
        </h1>
        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
          성적 데이터를 분석해 맞춤형 피드백을 제공합니다 · 완전 오프라인 · 개인정보 외부 전송 없음
        </div>
      </div>

      {/* ── 모델 정보 카드 ── */}
      <div style={{ ...CARD }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(107,163,255,0.15), rgba(164,110,245,0.15))',
            border: '1px solid rgba(107,163,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Cpu size={22} color="var(--blue)" strokeWidth={1.6} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)', marginBottom: 3 }}>
              Qwen 2.5 · 0.5B Instruct
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
              알리바바 오픈소스 · INT4 양자화 · CPU 실행<br />
              첫 실행 시 <strong style={{ color: 'var(--blue)' }}>~400MB</strong> 다운로드 후 영구 캐시 (오프라인 사용)
            </div>
          </div>
        </div>

        {/* ── 상태별 UI ── */}
        {phase === 'idle' && (
          <button
            onClick={handleAnalyze}
            disabled={exams.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              justifyContent: 'center',
              background: exams.length === 0
                ? 'var(--bg3)'
                : 'linear-gradient(135deg, var(--blue), var(--purple))',
              color: exams.length === 0 ? 'var(--t3)' : '#fff',
              border: 'none', borderRadius: 12,
              padding: '13px 20px', fontSize: 14, fontWeight: 700,
              cursor: exams.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: exams.length === 0 ? 'none' : '0 4px 16px rgba(107,163,255,0.3)',
            }}
          >
            <Sparkles size={16} strokeWidth={2} />
            {exams.length === 0 ? '점수 데이터를 먼저 입력해주세요' : 'AI 피드백 받기'}
          </button>
        )}

        {phase === 'downloading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--blue)', fontSize: 13, fontWeight: 600 }}>
              <Download size={15} strokeWidth={2} />
              모델 다운로드 중... (최초 1회)
            </div>
            <ProgressBar progress={progress} />
            <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>
              다운로드 후 캐시에 저장됩니다. 다음부터는 바로 실행돼요.
            </div>
          </div>
        )}

        {phase === 'generating' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', color: 'var(--purple)', fontSize: 13, fontWeight: 600 }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '2px solid var(--purple)',
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }} />
            AI가 분석 중입니다...
          </div>
        )}

        {phase === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--red)', fontSize: 12,
            }}>
              <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={handleAnalyze}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center',
                background: 'var(--bg3)', color: 'var(--t1)',
                border: '1px solid var(--bd1)', borderRadius: 10,
                padding: '10px 16px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <RefreshCw size={13} strokeWidth={2} />
              다시 시도
            </button>
          </div>
        )}
      </div>

      {/* ── 피드백 출력 ── */}
      {(feedback || phase === 'generating') && (
        <div style={{ ...CARD }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--blue), var(--purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={14} color="#fff" strokeWidth={2} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)' }}>AI 코치 피드백</span>
          </div>

          <div
            ref={outputRef}
            style={{
              fontSize: 14, color: 'var(--t1)', lineHeight: 1.85,
              minHeight: 60, maxHeight: 320,
              overflowY: 'auto', whiteSpace: 'pre-wrap',
              padding: '14px 16px',
              background: 'var(--bg3)',
              borderRadius: 12,
              border: '1px solid var(--bd1)',
            }}
          >
            {feedback}
            {phase === 'generating' && (
              <span style={{
                display: 'inline-block', width: 10, height: 14, marginLeft: 2,
                background: 'var(--blue)', borderRadius: 2, verticalAlign: 'text-bottom',
                animation: 'blink 1s step-end infinite',
              }} />
            )}
          </div>

          {phase === 'done' && (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={runGenerate}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg3)', color: 'var(--t2)',
                  border: '1px solid var(--bd1)', borderRadius: 9,
                  padding: '8px 14px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <RefreshCw size={12} strokeWidth={2} />
                다시 분석
              </button>
            </div>
          )}
        </div>
      )}

      {/* 스피너 CSS */}
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
