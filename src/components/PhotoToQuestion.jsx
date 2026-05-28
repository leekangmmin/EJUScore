/**
 * PhotoToQuestion v2.0 — 사진 속 문제를 자동으로 문제 형식으로 변환
 *
 * 파이프라인:
 *   이미지 업로드
 *   → Canvas 전처리 (Grayscale → 히스토그램 스트레치 → Sauvola 적응형 이진화)
 *   → Tesseract.js OCR (jpn+eng, 단어 레벨 신뢰도)
 *   → 질문 구조 파싱
 *   → [선택] Qwen2.5-0.5B 로컬 AI 개념 분석
 *       Electron: electronAPI.ai IPC (Node Worker Thread)
 *       Web/PWA:  aiAnalysisWorker.js (Web Worker + @huggingface/transformers)
 */
import { useState, useRef, useCallback } from 'react';
import {
  Camera, Upload, FileImage, ScanLine, Check, X,
  Save, Edit3, RefreshCw, Sparkles,
  HelpCircle, BookOpen, Image, Brain,
  ChevronRight, BarChart2, Zap,
} from 'lucide-react';

const CARD = {
  background: 'var(--bg2)',
  border: '1px solid var(--bd0)',
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
};

/* ══════════════════════════════════════════════════════════════
   SECTION 1  OCR 워커 싱글톤
══════════════════════════════════════════════════════════════ */
let _ocrWorker = null;
let _ocrWorkerPromise = null;

function getOCRWorker() {
  if (_ocrWorker) return Promise.resolve(_ocrWorker);
  if (_ocrWorkerPromise) return _ocrWorkerPromise;
  _ocrWorkerPromise = (async () => {
    const Tesseract = await import('tesseract.js');
    const w = await Tesseract.createWorker('jpn+eng', 1, { logger: () => {} });
    _ocrWorker = w;
    _ocrWorkerPromise = null;
    return w;
  })();
  return _ocrWorkerPromise;
}

/* ══════════════════════════════════════════════════════════════
   SECTION 2  이미지 전처리 파이프라인
   Grayscale → 히스토그램 스트레치 → Sauvola 적응형 이진화
══════════════════════════════════════════════════════════════ */
async function preprocessImageForOCR(file) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      // 해상도 정규화: 짧은 쪽 최소 1 200 px, 긴 쪽 최대 2 400 px
      const longer = Math.max(img.width, img.height);
      const shorter = Math.min(img.width, img.height);
      let scale = 1;
      if (longer > 2400) scale = 2400 / longer;
      else if (shorter < 600) scale = 600 / shorter;
      const W = Math.round(img.width * scale);
      const H = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);

      const imageData = ctx.getImageData(0, 0, W, H);
      const data = imageData.data;
      const N = W * H;

      /* ── Step 1: Grayscale (perceptual luminance) ── */
      const gray = new Float32Array(N);
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      /* ── Step 2: 히스토그램 스트레치 (1 %–99 % 퍼센타일) ── */
      const sorted = Float32Array.from(gray).sort();
      const lo = sorted[Math.floor(N * 0.01)];
      const hi = sorted[Math.floor(N * 0.99)];
      const rng = hi - lo || 1;
      for (let i = 0; i < N; i++) {
        gray[i] = Math.max(0, Math.min(255, ((gray[i] - lo) / rng) * 255));
      }

      /* ── Step 3: Sauvola 적응형 이진화 (integral image) ── */
      // window half = 12 → effective size 25×25, k=0.15, R=128
      const HALF = 12, K = 0.15, R = 128;
      const W1 = W + 1, H1 = H + 1;
      const intSum = new Float64Array(W1 * H1);
      const intSq  = new Float64Array(W1 * H1);

      for (let y = 1; y < H1; y++) {
        for (let x = 1; x < W1; x++) {
          const g   = gray[(y - 1) * W + (x - 1)];
          const idx = y * W1 + x;
          intSum[idx] = g + intSum[(y-1)*W1+x] + intSum[y*W1+(x-1)] - intSum[(y-1)*W1+(x-1)];
          intSq[idx]  = g*g + intSq[(y-1)*W1+x] + intSq[y*W1+(x-1)] - intSq[(y-1)*W1+(x-1)];
        }
      }

      for (let y = 0; y < H; y++) {
        const y1 = Math.max(0, y - HALF), y2 = Math.min(H - 1, y + HALF);
        for (let x = 0; x < W; x++) {
          const x1 = Math.max(0, x - HALF), x2 = Math.min(W - 1, x + HALF);
          const area = (x2 - x1 + 1) * (y2 - y1 + 1);
          const sum = intSum[(y2+1)*W1+(x2+1)] - intSum[y1*W1+(x2+1)] - intSum[(y2+1)*W1+x1] + intSum[y1*W1+x1];
          const sq  = intSq[(y2+1)*W1+(x2+1)]  - intSq[y1*W1+(x2+1)]  - intSq[(y2+1)*W1+x1]  + intSq[y1*W1+x1];
          const mean   = sum / area;
          const stddev = Math.sqrt(Math.max(0, sq / area - mean * mean));
          const thresh = mean * (1 + K * (stddev / R - 1));
          const p = y * W + x;
          const v = gray[p] >= thresh ? 255 : 0;
          const i4 = p * 4;
          data[i4] = data[i4+1] = data[i4+2] = v;
          data[i4+3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(resolve, 'image/png');
    };

    img.onerror = reject;
    img.src = url;
  });
}

/* ══════════════════════════════════════════════════════════════
   SECTION 3  질문 파서 (EJU 스타일)
══════════════════════════════════════════════════════════════ */
function parseQuestionFromText(rawText) {
  if (!rawText || rawText.trim().length < 10) return null;
  const text = rawText.trim();
  let questionNumber = null, questionText = '', options = [], answerKey = null;

  // 문제 번호
  const numMatch = text.match(/(?:問|문제|No\.?|Question)\s*(\d+)|^(\d+)[.．]/m);
  if (numMatch) questionNumber = parseInt(numMatch[1] || numMatch[2]);

  // 선택지 위치 탐색
  const optionRegex = /(?:[①-④]|(?:^|\n)\s*(?:[A-D][.．)])|(?:^|\n)\s*(?:[1-4][.．)]))/gm;
  let m;
  const optStarts = [];
  while ((m = optionRegex.exec(text)) !== null) {
    optStarts.push({ index: m.index, text: m[0] });
  }

  if (optStarts.length >= 2) {
    for (let i = 0; i < optStarts.length; i++) {
      const start = optStarts[i].index + optStarts[i].text.length;
      const end   = i < optStarts.length - 1 ? optStarts[i+1].index : text.length;
      const label = optStarts[i].text.trim().replace(/[.．)]/g, '').trim();
      const content = text.slice(start, end).trim().split('\n')[0].trim();
      options.push({ label, content });
    }
    questionText = text.slice(0, optStarts[0].index).trim();
    if (numMatch) questionText = questionText.replace(/(?:問|문제|No\.?|Question)\s*\d+\s*/m, '').trim();
  } else {
    questionText = text;
    if (numMatch) questionText = questionText.replace(/(?:問|문제|No\.?|Question)\s*\d+\s*/m, '').trim();
  }

  // 정답 패턴
  const answerMatch = text.match(/(?:正解|정답|답|answer|Ans)\s*[：:]\s*([①-④A-Da-d1-4])/i);
  if (answerMatch) answerKey = answerMatch[1];

  // 과목 판별 (확장 키워드)
  let subjectType = 'unknown';
  const ft = text.toLowerCase();
  if (/경제|수요|공급|gdp|환율|시장|무역|재정|금융|인플레이|관세|경기|소비|투자/.test(ft)) subjectType = 'economy';
  else if (/헌법|정치|민주|선거|의회|내각|삼권|대통령|의원내각|국회|입법|행정|사법/.test(ft)) subjectType = 'politics';
  else if (/역사|혁명|전쟁|냉전|제국|독립|메이지|프랑스|세계대전|봉건|왕조|근대|고대|식민/.test(ft)) subjectType = 'history';
  else if (/지리|기후|지형|인구|도시|농업|자원|지도|온도|강수|산맥|평야|해류|대륙/.test(ft)) subjectType = 'geography';
  else if (/사회|환경|복지|고령|에너지|ngo|파리|협약|저출산|이민|다문화|지속가능|인권/.test(ft)) subjectType = 'society';
  else if (/함수|방정식|그래프|미분|적분|확률|수열|벡터|행렬|삼각|로그|극한|집합/.test(ft)) subjectType = 'math';

  return {
    questionNumber,
    questionText: questionText || text.slice(0, 200),
    options, answerKey, subjectType,
    confidence: options.length >= 2 ? 75 : 40,
    rawLength: text.length,
  };
}

/* ══════════════════════════════════════════════════════════════
   SECTION 4  과목 메타데이터
══════════════════════════════════════════════════════════════ */
const SUBJECT_MAP = {
  economy:   { name: '경제',       color: '#10b981', icon: '💰' },
  politics:  { name: '정치',       color: '#ef4444', icon: '🏛️' },
  history:   { name: '역사',       color: '#d4880f', icon: '📖' },
  geography: { name: '지리',       color: '#b8730a', icon: '🌍' },
  society:   { name: '사회',       color: '#f59e0b', icon: '👥' },
  math:      { name: '수학 코스1', color: '#8b5cf6', icon: '📐' },
  unknown:   { name: '미분류',     color: '#94a3b8', icon: '❓' },
};

/* ══════════════════════════════════════════════════════════════
   SECTION 5  로컬 AI 개념 분석
   Electron: window.electronAPI.ai (IPC → Node Worker Thread)
   Web/PWA:  Web Worker + @huggingface/transformers
══════════════════════════════════════════════════════════════ */
let _webWorker = null;
let _webWorkerLoaded = false;
let _webWorkerLoading = false;

function getWebAIWorker() {
  if (!_webWorker) {
    _webWorker = new Worker(
      new URL('../workers/aiAnalysisWorker.js', import.meta.url),
      { type: 'module' }
    );
  }
  return _webWorker;
}

function buildAnalysisMessages(parsedQ) {
  const subject = SUBJECT_MAP[parsedQ.subjectType]?.name || '미분류';
  const optText = parsedQ.options.length >= 2
    ? '\n선택지:\n' + parsedQ.options.map(o => `  ${o.label}: ${o.content}`).join('\n')
    : '';
  return [
    {
      role: 'system',
      content: 'EJU 일본유학시험 전문 튜터. 핵심만 간결하게 한국어로 분석한다.',
    },
    {
      role: 'user',
      content: `EJU 시험 문제를 분석하라.\n\n과목: ${subject}\n문제: ${(parsedQ.questionText || '').slice(0, 400)}${optText}\n\n아래 3가지를 총 200자 이내로 답하라:\n1. 핵심 개념\n2. 자주 틀리는 포인트\n3. 학습 권장사항`,
    },
  ];
}

/**
 * AI 분석 실행
 * @param {{ parsedQ, onToken, onProgress, onDone, onError }} params
 */
function analyzeConceptWithAI({ parsedQ, onToken, onProgress, onDone, onError }) {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.ai;
  const messages = buildAnalysisMessages(parsedQ);

  if (isElectron) {
    /* ── Electron IPC 경로 ── */
    const ai = window.electronAPI.ai;
    ai.cleanup();
    ai.onToken((text) => onToken?.(text));

    (async () => {
      try {
        const loaded = await ai.isLoaded();
        if (!loaded) {
          ai.onProgress?.((d) => onProgress?.(d));
          await ai.load();
        }
        await ai.generate(messages);
        ai.cleanup();
        onDone?.();
      } catch (err) {
        ai.cleanup();
        onError?.(err.message);
      }
    })();
  } else {
    /* ── Web Worker 경로 ── */
    const worker = getWebAIWorker();

    const handleMsg = ({ data }) => {
      switch (data.type) {
        case 'progress':
          onProgress?.(data.data);
          break;
        case 'loaded':
          _webWorkerLoaded = true;
          _webWorkerLoading = false;
          worker.postMessage({ type: 'generate', messages });
          break;
        case 'token':
          onToken?.(data.text);
          break;
        case 'done':
          worker.removeEventListener('message', handleMsg);
          onDone?.();
          break;
        case 'error':
          worker.removeEventListener('message', handleMsg);
          _webWorkerLoading = false;
          onError?.(data.message);
          break;
      }
    };

    worker.addEventListener('message', handleMsg);

    if (_webWorkerLoaded) {
      worker.postMessage({ type: 'generate', messages });
    } else if (!_webWorkerLoading) {
      _webWorkerLoading = true;
      worker.postMessage({ type: 'load' });
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   SECTION 6  UI 서브 컴포넌트
══════════════════════════════════════════════════════════════ */
function ImagePreview({ src, onRemove }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <img src={src} alt="captured" style={{
        maxWidth: '100%', maxHeight: 320, borderRadius: 12,
        objectFit: 'contain', background: '#000',
      }} />
      <button onClick={onRemove} style={{
        position: 'absolute', top: 6, right: 6, width: 28, height: 28,
        borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none',
        color: '#fff', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}><X size={14} /></button>
    </div>
  );
}

function OptionBlock({ opt }) {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px',
      background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 4,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6,
        background: 'rgba(240,160,48,0.12)', color: '#b8730a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>{opt.label}</span>
      <span style={{ fontSize: 13, color: 'var(--t0)', lineHeight: 1.5 }}>{opt.content}</span>
    </div>
  );
}

/** AI 개념 분석 패널 */
function ConceptAnalysisPanel({ streamText, loading, loadProgress, error, onStart, hasParsed }) {
  if (!hasParsed) return null;

  const progressPct = loadProgress?.progress != null
    ? Math.round(loadProgress.progress * 100)
    : 0;
  const modelLabel = loadProgress?.name || '';

  const panelStyle = {
    ...CARD,
    background: 'rgba(240,160,48,0.03)',
    border: '1px solid rgba(240,160,48,0.14)',
    padding: 14,
  };

  /* 초기 상태 (분석 전) */
  if (!loading && !streamText && !error) {
    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={16} color="#f0a030" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)' }}>AI 개념 분석</span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
              background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', letterSpacing: 0.5,
            }}>Qwen2.5-0.5B</span>
          </div>
          <button onClick={onStart} style={{
            background: 'linear-gradient(135deg, #f0a030, #d4880f)',
            color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Zap size={12} /> 분석 시작
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
          로컬 AI로 핵심 개념 · 오답 포인트 · 학습 방향을 분석합니다.
          Electron: Worker Thread · Web: WebGPU/WASM (첫 실행 시 모델 다운로드 필요)
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Brain size={16} color="#f0a030" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)' }}>AI 개념 분석</span>
        {loading && (
          <span style={{ fontSize: 10, color: '#f0a030', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ScanLine size={11} style={{ animation: 'spin 1.5s linear infinite' }} />
            {streamText ? '분석 중...' : progressPct > 0 ? `모델 로드 ${progressPct}%` : '모델 초기화 중...'}
          </span>
        )}
      </div>

      {/* 모델 로드 프로그레스 바 */}
      {loading && !streamText && progressPct > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${progressPct}%`, height: '100%',
              background: 'linear-gradient(90deg, #f0a030, #8b5cf6)',
              borderRadius: 2, transition: 'width 0.3s',
            }} />
          </div>
          {modelLabel && (
            <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 3 }}>
              {modelLabel} · {progressPct}%
            </div>
          )}
        </div>
      )}

      {/* 스트리밍 출력 */}
      {streamText && (
        <div style={{
          fontSize: 13, color: 'var(--t0)', lineHeight: 1.85, padding: '10px 12px',
          background: 'rgba(0,0,0,0.15)', borderRadius: 8,
          whiteSpace: 'pre-wrap', fontFamily: 'inherit',
        }}>
          {streamText}
          {loading && (
            <span style={{
              display: 'inline-block', width: 2, height: 14,
              background: '#f0a030', verticalAlign: 'text-bottom', marginLeft: 2,
              opacity: 0.85,
            }} />
          )}
        </div>
      )}

      {/* 오류 */}
      {error && (
        <div style={{
          fontSize: 12, color: '#ef4444', padding: '8px 12px',
          background: 'rgba(239,68,68,0.08)', borderRadius: 8, lineHeight: 1.5,
        }}>
          분석 실패: {error}
          <br />
          <span style={{ fontSize: 10, color: 'var(--t3)' }}>
            WebGPU 미지원 환경이거나 모델 다운로드에 실패했을 수 있습니다.
          </span>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SECTION 7  메인 컴포넌트
══════════════════════════════════════════════════════════════ */
export default function PhotoToQuestion({ onSaved }) {
  const [photo, setPhoto]             = useState(null);         // { file, dataUrl }
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrPhase, setOcrPhase]       = useState('');           // preprocessing|ocr|parsing
  const [progress, setProgress]       = useState(0);
  const [ocrConfidence, setOcrConfidence] = useState(null);     // 0–100
  const [parsed, setParsed]           = useState(null);
  const [editing, setEditing]         = useState(false);
  const [editForm, setEditForm]       = useState(null);
  const [mode, setMode]               = useState('upload');     // upload|result
  const [savedQuestions, setSavedQuestions] = useState([]);
  const [isDragging, setIsDragging]   = useState(false);

  // AI 분석 상태
  const [aiStreamText, setAiStreamText]     = useState('');
  const [aiLoading, setAiLoading]           = useState(false);
  const [aiLoadProgress, setAiLoadProgress] = useState(null);
  const [aiError, setAiError]               = useState(null);

  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);

  /* ── 초기 로드 ── */
  const [initialLoaded, setInitialLoaded] = useState(false);
  if (!initialLoaded) {
    try {
      const data = JSON.parse(localStorage.getItem('eju_photo_questions') || '[]');
      setSavedQuestions(data);
    } catch {}
    setInitialLoaded(true);
  }

  /* ──────────────────────────────────────────────
     OCR 실행
  ────────────────────────────────────────────── */
  const runOCR = useCallback(async (file) => {
    setIsProcessing(true);
    setOcrPhase('preprocessing');
    setProgress(5);
    setOcrConfidence(null);

    try {
      /* 1. 이미지 전처리 */
      const processedBlob = await preprocessImageForOCR(file);
      setProgress(28);
      setOcrPhase('ocr');

      /* 2. OCR */
      const worker = await getOCRWorker();
      setProgress(32);

      const { data } = await worker.recognize(processedBlob, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(32 + Math.round(m.progress * 52));
          }
        },
      });

      setProgress(88);
      setOcrPhase('parsing');

      /* 3. 단어 레벨 신뢰도 집계 */
      let totalConf = 0, wordCount = 0;
      if (Array.isArray(data.words)) {
        for (const w of data.words) {
          if (w.confidence > 0) { totalConf += w.confidence; wordCount++; }
        }
      }
      const avgConf = wordCount > 0
        ? Math.round(totalConf / wordCount)
        : (typeof data.confidence === 'number' ? Math.round(data.confidence) : 0);
      setOcrConfidence(avgConf);

      /* 4. 파싱 */
      const rawText = data.text || '';
      const parsedQ = parseQuestionFromText(rawText);
      setProgress(100);

      if (parsedQ) {
        parsedQ.rawText = rawText;
        parsedQ.confidence = Math.max(parsedQ.confidence, avgConf);
        setParsed(parsedQ);
        setEditForm({
          questionNumber: parsedQ.questionNumber || '',
          questionText:   parsedQ.questionText,
          options:        parsedQ.options.map(o => ({ ...o })),
          answerKey:      parsedQ.answerKey || '',
          subjectType:    parsedQ.subjectType,
          memo:           '',
        });
      }

      setMode('result');
    } catch (err) {
      console.error('[OCR] Error:', err);
      alert('OCR 변환에 실패했습니다: ' + err.message);
    } finally {
      setIsProcessing(false);
      setOcrPhase('');
    }
  }, []);

  /* ──────────────────────────────────────────────
     파일 핸들러
  ────────────────────────────────────────────── */
  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다 (JPG/PNG/WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhoto({ file, dataUrl: e.target.result });
      setMode('upload');
      setParsed(null);
      setAiStreamText('');
      setAiError(null);
      setAiLoading(false);
      runOCR(file);
    };
    reader.readAsDataURL(file);
  }, [runOCR]);

  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = ()  => setIsDragging(false);
  const handleDrop      = (e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  /* ──────────────────────────────────────────────
     AI 분석 시작
  ────────────────────────────────────────────── */
  const startAIAnalysis = useCallback(() => {
    if (!parsed || aiLoading) return;
    setAiStreamText('');
    setAiError(null);
    setAiLoading(true);
    setAiLoadProgress(null);

    analyzeConceptWithAI({
      parsedQ:    parsed,
      onToken:    (text) => setAiStreamText(prev => prev + text),
      onProgress: (data) => setAiLoadProgress(data),
      onDone:     ()     => setAiLoading(false),
      onError:    (msg)  => { setAiError(msg); setAiLoading(false); },
    });
  }, [parsed, aiLoading]);

  /* ──────────────────────────────────────────────
     수정 저장
  ────────────────────────────────────────────── */
  const handleSaveEdit = () => {
    setParsed(prev => ({
      ...prev,
      questionText: editForm.questionText,
      options:      editForm.options,
      answerKey:    editForm.answerKey,
      subjectType:  editForm.subjectType,
    }));
    setEditing(false);
  };

  /* ──────────────────────────────────────────────
     틀린 문제 저장
  ────────────────────────────────────────────── */
  const handleSaveAsWrong = () => {
    const entry = {
      id:           crypto.randomUUID(),
      date:         new Date().toISOString().slice(0, 10),
      examName:     `사진변환 문제 #${parsed.questionNumber || '?'}`,
      photoDataUrl: photo?.dataUrl || null,
      parsed:       { ...parsed },
      aiAnalysis:   aiStreamText || null,
      type:         parsed.subjectType === 'math' ? 'math' : 'comprehensive',
      savedAt:      new Date().toISOString(),
    };
    try {
      const existing = JSON.parse(localStorage.getItem('eju_photo_questions') || '[]');
      existing.unshift(entry);
      localStorage.setItem('eju_photo_questions', JSON.stringify(existing));
      setSavedQuestions(prev => [entry, ...prev]);
      alert('✅ 변환된 문제가 저장되었습니다! 대시보드에서 확인하세요.');
      resetAll();
    } catch {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  /* ──────────────────────────────────────────────
     리셋
  ────────────────────────────────────────────── */
  const resetAll = () => {
    setPhoto(null); setParsed(null); setMode('upload'); setEditing(false);
    setProgress(0); setOcrConfidence(null);
    setAiStreamText(''); setAiError(null); setAiLoading(false); setAiLoadProgress(null);
  };

  /* ──────────────────────────────────────────────
     스타일 헬퍼
  ────────────────────────────────────────────── */
  const dropzoneStyle = {
    border:       `2px dashed ${isDragging ? '#f0a030' : 'var(--bd1)'}`,
    borderRadius: 16, padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
    background:   isDragging ? 'rgba(240,160,48,0.05)' : 'var(--bg2)', transition: 'all 0.2s',
  };
  const btnPrimary = {
    background: 'linear-gradient(135deg, var(--blue), var(--purple))',
    color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', gap: 6,
  };
  const btnSecondary = {
    background: 'transparent', color: 'var(--t2)', border: '1px solid var(--bd1)',
    borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
  };

  const ocrPhaseLabel = {
    preprocessing: '이미지 전처리 (Grayscale → Sauvola 이진화)...',
    ocr:           'Tesseract OCR 인식 중 (jpn+eng)...',
    parsing:       '질문 구조 분석 중...',
  }[ocrPhase] || 'OCR 변환 중...';

  const confColor = ocrConfidence == null ? 'var(--t3)'
    : ocrConfidence >= 70 ? '#10b981'
    : ocrConfidence >= 40 ? '#f59e0b'
    : '#ef4444';

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* ── 헤더 ── */}
      <div style={{ ...CARD, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t0)', marginBottom: 4 }}>
          <Camera size={20} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--blue)' }} />
          사진 → 문제 변환
        </div>
        <div style={{ fontSize: 12, color: 'var(--t2)' }}>
          사진 업로드 → Sauvola 전처리 → Tesseract.js OCR → 로컬 AI 개념 분석 (Qwen2.5-0.5B)
        </div>
      </div>

      {/* ── OCR 진행 상태 ── */}
      {isProcessing && (
        <div style={{ ...CARD, textAlign: 'center' }}>
          <ScanLine size={32} color="var(--blue)"
            style={{ margin: '12px 0', animation: 'spin 1.5s linear infinite' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t0)', marginBottom: 8 }}>
            {ocrPhaseLabel}
          </div>
          <div style={{
            maxWidth: 300, margin: '0 auto', height: 6,
            background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: 'linear-gradient(90deg, var(--blue), var(--purple))',
              borderRadius: 3, transition: 'width 0.4s',
            }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>{progress}%</div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          업로드 영역
      ══════════════════════════════════════════ */}
      {mode === 'upload' && !isProcessing && (
        <>
          <div
            style={dropzoneStyle}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={36} color="var(--t2)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t0)', marginBottom: 6 }}>
              이미지를 드래그하거나 클릭하여 업로드
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 14 }}>
              JPG, PNG, WebP 지원 · EJU 기출문제 / 오답노트 사진
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                style={{ ...btnSecondary, padding: '9px 14px' }}>
                <Camera size={14} /> 카메라 촬영
              </button>
              <button onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                style={{ ...btnPrimary, padding: '9px 14px' }}>
                <FileImage size={14} /> 갤러리에서 선택
              </button>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />

          {/* OCR 파이프라인 표시 */}
          <div style={{ ...CARD, padding: 14, marginTop: 0, background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', marginBottom: 8 }}>
              <BarChart2 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              OCR 처리 파이프라인
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {['Grayscale', '히스토그램 스트레치', 'Sauvola 이진화', 'Tesseract jpn+eng', 'AI 개념 분석'].map((step, i, arr) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(240,160,48,0.08)', color: '#b8730a', fontWeight: 600,
                  }}>{step}</span>
                  {i < arr.length - 1 && <ChevronRight size={10} color="var(--t3)" />}
                </span>
              ))}
            </div>
          </div>

          {/* 저장된 문제 목록 */}
          {savedQuestions.length > 0 && (
            <div style={{ ...CARD, marginTop: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)', marginBottom: 10 }}>
                <BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: '#f59e0b' }} />
                최근 변환 문제 ({savedQuestions.length}개)
              </div>
              {savedQuestions.slice(0, 5).map((q) => {
                const subj = SUBJECT_MAP[q.parsed?.subjectType] || SUBJECT_MAP.unknown;
                return (
                  <div key={q.id} style={{
                    display: 'flex', gap: 10, padding: '10px 12px',
                    background: 'rgba(255,255,255,0.02)', borderRadius: 10,
                    marginBottom: 6, border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    {q.photoDataUrl
                      ? <img src={q.photoDataUrl} alt="thumb"
                          style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                      : <Image size={20} color="var(--t3)" style={{ margin: 10 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, color: 'var(--t0)', fontWeight: 500,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {q.parsed?.questionText?.slice(0, 60)}...
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: subj.color, fontWeight: 600 }}>
                          {subj.icon} {subj.name}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{q.date}</span>
                        {q.aiAnalysis && (
                          <span style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 600 }}>
                            <Sparkles size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />AI 분석
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════
          결과 화면
      ══════════════════════════════════════════ */}
      {mode === 'result' && parsed && !isProcessing && (
        <>
          {/* 원본 이미지 */}
          <div style={{ ...CARD, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 8 }}>
              <Image size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 원본 이미지
            </div>
            {photo?.dataUrl && <ImagePreview src={photo.dataUrl} onRemove={resetAll} />}
          </div>

          {/* OCR 신뢰도 배너 */}
          {ocrConfidence !== null && (
            <div style={{
              ...CARD, padding: '10px 14px',
              background: `${confColor}0d`,
              border: `1px solid ${confColor}30`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <BarChart2 size={13} color={confColor} />
                <span style={{ fontSize: 12, fontWeight: 700, color: confColor }}>
                  OCR 신뢰도 {ocrConfidence}%
                </span>
                <span style={{ fontSize: 11, color: 'var(--t2)' }}>
                  {ocrConfidence >= 70
                    ? '✓ 고정밀 — 변환 결과를 신뢰할 수 있습니다'
                    : ocrConfidence >= 40
                      ? '△ 보통 — 수정 모드로 검토를 권장합니다'
                      : '✗ 저정밀 — 수동 입력 권장 (사진 화질 개선 후 재시도)'}
                </span>
              </div>
            </div>
          )}

          {/* 파싱된 문제 */}
          <div style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>
                <ScanLine size={16} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--blue)' }} />
                변환된 문제
              </div>
              <button onClick={() => setEditing(!editing)} style={btnSecondary}>
                <Edit3 size={12} /> {editing ? '완료' : '수정'}
              </button>
            </div>

            {/* 과목 태그 */}
            <div style={{ marginBottom: 10 }}>
              {(() => {
                const subj = SUBJECT_MAP[editForm?.subjectType || parsed.subjectType] || SUBJECT_MAP.unknown;
                return (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: subj.color,
                    background: `${subj.color}18`, padding: '3px 10px', borderRadius: 6,
                  }}>
                    {subj.icon} {subj.name}
                  </span>
                );
              })()}
            </div>

            {/* 수정 모드 */}
            {editing && editForm ? (
              <div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>문제 번호</div>
                  <input value={editForm.questionNumber}
                    onChange={e => setEditForm({ ...editForm, questionNumber: e.target.value })}
                    style={inputStyle} placeholder="예: 15" />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>문제 본문</div>
                  <textarea value={editForm.questionText}
                    onChange={e => setEditForm({ ...editForm, questionText: e.target.value })}
                    style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>선택지</div>
                  {editForm.options.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <span style={{
                        width: 26, padding: '7px 0', textAlign: 'center', fontSize: 11, fontWeight: 700,
                        background: 'rgba(240,160,48,0.1)', borderRadius: 6, color: '#b8730a', flexShrink: 0,
                      }}>{opt.label}</span>
                      <input value={opt.content} onChange={e => {
                        const newOpts = [...editForm.options];
                        newOpts[i] = { ...newOpts[i], content: e.target.value };
                        setEditForm({ ...editForm, options: newOpts });
                      }} style={{ ...inputStyle, flex: 1 }} />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>정답</div>
                  <input value={editForm.answerKey}
                    onChange={e => setEditForm({ ...editForm, answerKey: e.target.value })}
                    style={inputStyle} placeholder="예: ① 또는 1" />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>과목 수정</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(SUBJECT_MAP).map(([key, val]) => (
                      <button key={key} onClick={() => setEditForm({ ...editForm, subjectType: key })} style={{
                        background:  editForm.subjectType === key ? `${val.color}22` : 'transparent',
                        color:       editForm.subjectType === key ? val.color : 'var(--t2)',
                        border:      `1px solid ${editForm.subjectType === key ? val.color : 'var(--bd1)'}`,
                        borderRadius: 8, padding: '6px 10px', fontSize: 11,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        {val.icon} {val.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>메모 (선택)</div>
                  <input value={editForm.memo}
                    onChange={e => setEditForm({ ...editForm, memo: e.target.value })}
                    style={inputStyle} placeholder="이 문제에서 틀린 이유를 기록하세요" />
                </div>
                <button onClick={handleSaveEdit} style={btnPrimary}>
                  <Check size={14} /> 수정 완료
                </button>
              </div>
            ) : (
              /* 보기 모드 */
              <div>
                {parsed.questionNumber && (
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>
                    <HelpCircle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    문제 #{parsed.questionNumber}
                  </div>
                )}
                <div style={{
                  fontSize: 14, color: 'var(--t0)', lineHeight: 1.7,
                  padding: '12px 14px', background: 'rgba(255,255,255,0.03)',
                  borderRadius: 10, marginBottom: 10,
                }}>
                  {parsed.questionText}
                </div>
                {parsed.options.length >= 2 && (
                  <div style={{ marginBottom: 10 }}>
                    {parsed.options.map((opt, i) => <OptionBlock key={i} opt={opt} />)}
                  </div>
                )}
                {parsed.answerKey && (
                  <div style={{
                    padding: '8px 12px', background: 'rgba(16,185,129,0.08)',
                    borderRadius: 8, fontSize: 12, color: '#10b981', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Check size={14} /> 정답: {parsed.answerKey}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 8 }}>
                  OCR 신뢰도 {parsed.confidence}% · 원문 {parsed.rawLength}자
                  {parsed.options.length < 2 && ' · 선택지 미검출 — 수정 모드로 직접 입력 가능'}
                </div>
              </div>
            )}

            {!editing && (
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button onClick={handleSaveAsWrong} style={btnPrimary}>
                  <Save size={14} /> 틀린 문제로 저장
                </button>
                <button onClick={resetAll} style={btnSecondary}>
                  <RefreshCw size={13} /> 새로 찍기
                </button>
              </div>
            )}
          </div>

          {/* AI 개념 분석 패널 */}
          <ConceptAnalysisPanel
            streamText={aiStreamText}
            loading={aiLoading}
            loadProgress={aiLoadProgress}
            error={aiError}
            onStart={startAIAnalysis}
            hasParsed={!!parsed}
          />

          {/* OCR 원문 */}
          <details style={{ ...CARD, padding: 14 }}>
            <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', cursor: 'pointer' }}>
              OCR 원문 보기
            </summary>
            <div style={{
              fontSize: 11, color: 'var(--t3)', lineHeight: 1.6, marginTop: 10,
              whiteSpace: 'pre-wrap', fontFamily: 'monospace', padding: 10,
              background: 'rgba(0,0,0,0.2)', borderRadius: 8, maxHeight: 200, overflowY: 'auto',
            }}>
              {parsed.rawText || '원문 없음'}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

const inputStyle = {
  background: 'var(--bg3)', border: '1px solid var(--bd1)', borderRadius: 8,
  padding: '8px 10px', color: 'var(--t0)', fontSize: 13,
  fontFamily: 'inherit', width: '100%', outline: 'none',
};
