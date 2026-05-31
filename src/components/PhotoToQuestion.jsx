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
// ⚠️ Electron(file://)에서는 동적 import() 청크 fetch가 막히므로 정적 import로 번들에 포함
import { createWorker } from 'tesseract.js';
// PDF 래스터화는 PDFium(WASM)로 처리한다. pdfjs 는 구형 Chromium(Electron 35)에서
// CCITTFaxDecode(팩스 G4) 스캔본을 흰 화면으로 렌더해 OCR 불가 → 기출 PDF의 74%가 인식 실패.
// PDFium 은 Chrome 내장 엔진과 동일하게 CCITT·JPEG·JBIG2 등 모든 인코딩을 정확히 디코딩한다.
// base64 변환본을 사용해 WASM 을 번들에 내장 → file:// 에서 별도 fetch 없이 동작.
import { PDFiumLibrary } from '@hyzyla/pdfium/browser/base64';
import {
  Camera, Upload, FileImage, ScanLine, Check, X,
  Save, Edit3, RefreshCw, Sparkles,
  HelpCircle, BookOpen, Image, Brain,
  ChevronRight, BarChart2, Zap, FileText, Trash2,
} from 'lucide-react';

const CARD = {
  background: 'var(--bg2)',
  border: '1px solid var(--bd0)',
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
};

/* ══════════════════════════════════════════════════════════════
   SECTION 1  OCR 워커 싱글톤 (tessdata_best + 다중 PSM 투표)
══════════════════════════════════════════════════════════════ */
let _ocrWorker = null;
let _ocrWorkerPromise = null;

// 로컬 번들 경로 — Electron(file://)에서 CDN fetch가 막히거나 멈추는 문제 해결.
// public/tesseract/ 에 worker·core(wasm)·언어데이터(jpn+eng best)를 함께 배포한다.
// window.location 기준 절대 URL로 변환해야 file:// 컨텍스트에서 워커/wasm 로드가 안정적.
function tessUrl(rel) {
  try { return new URL(rel, window.location.href).href; }
  catch { return rel; }
}
const LOCAL_TESS = {
  workerPath: tessUrl('tesseract/worker.min.js'),
  // ⚠️ 코어를 명시적으로 simd-lstm 으로 고정.
  //   자동 선택 시 Electron(Chromium 134)에서 relaxedsimd 코어를 골라
  //   "missing function: _ZN9tesseract13DotProductSSE..." 로 OCR 이 크래시함.
  //   simd-lstm / 기본 lstm 두 변형만 정상 동작 → 가장 빠른 simd-lstm 고정.
  corePath:   tessUrl('tesseract/tesseract-core-simd-lstm.wasm.js'),
  langPath:   tessUrl('tesseract/'),            // best 모델: jpn.traineddata.gz (정밀)
};
// 온라인 폴백(로컬 자산이 없는 웹 배포 환경용)
const CDN_BEST_LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0_best';

async function createTunedWorker(opts) {
  // OEM 1 = LSTM only (best 모델과 호환). 언어는 jpn 단독 사용.
  //   EJU 종합과목(文综)은 일본어 문서라 eng 모델을 빼도 인식률이 사실상 동일하고
  //   (jpn 모델이 숫자·기본 라틴자도 인식), 언어 1개만 돌려 OCR 이 약 30% 빨라진다.
  const w = await createWorker('jpn', 1, { ...opts, gzip: true, logger: () => {} });
  await w.setParameters({
    preserve_interword_spaces: '1',   // 띄어쓰기/수식 간격 보존
    user_defined_dpi: '300',          // 300DPI 가정 → 인식률 향상
    tessedit_pageseg_mode: '3',       // 기본: 자동 페이지 분할
  });
  return w;
}

function getOCRWorker() {
  if (_ocrWorker) return Promise.resolve(_ocrWorker);
  if (_ocrWorkerPromise) return _ocrWorkerPromise;
  _ocrWorkerPromise = (async () => {
    let w;
    try {
      // 1순위: 완전 로컬 번들(워커+코어+언어데이터) — 오프라인·고속·file:// 안전
      w = await withTimeout(createTunedWorker(LOCAL_TESS), 60000, 'OCR 엔진 초기화');
    } catch (e) {
      console.warn('[OCR] 로컬 번들 로드 실패 → CDN best 모델 폴백:', e?.message);
      w = await withTimeout(createTunedWorker({ langPath: CDN_BEST_LANG_PATH }), 60000, 'OCR 엔진 초기화(CDN)');
    }
    _ocrWorker = w;
    _ocrWorkerPromise = null;
    return w;
  })();
  return _ocrWorkerPromise;
}

/* ──────────────────────────────────────────────────────────────
   OCR 워커 풀 — 페이지 단위 병렬 인식 (정확도 동일, 처리량 N배)
   단일 워커는 페이지를 1장씩 순차 처리하지만, 코어가 여러 개인 데스크톱에서는
   워커를 N개 띄워 여러 페이지를 동시에 인식하면 같은 모델·해상도로 N배 빨라진다.
────────────────────────────────────────────────────────────── */
let _ocrPool = null;
let _ocrPoolPromise = null;

// 동시 OCR 워커 수 — 코어 수에 맞추되 2~4로 제한.
// (메인 스레드 래스터화/전처리가 생산자라 4 초과는 이득이 작고 메모리만 늘어남)
function ocrPoolSize() {
  const c = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  return Math.max(2, Math.min(4, c - 1));
}

function getOCRPool() {
  if (_ocrPool) return Promise.resolve(_ocrPool);
  if (_ocrPoolPromise) return _ocrPoolPromise;
  _ocrPoolPromise = (async () => {
    const N = ocrPoolSize();
    // 첫 워커는 로컬→CDN 폴백 로직(getOCRWorker)을 그대로 재사용
    const first = await getOCRWorker();
    const workers = [first];
    // 나머지는 로컬 번들로 병렬 생성 — 하나라도 실패하면 그 워커만 제외하고 진행
    const rest = await Promise.all(
      Array.from({ length: N - 1 }, () =>
        withTimeout(createTunedWorker(LOCAL_TESS), 60000, 'OCR 엔진 초기화').catch(() => null)
      )
    );
    for (const w of rest) if (w) workers.push(w);
    _ocrPool = workers;
    _ocrPoolPromise = null;
    return workers;
  })();
  return _ocrPoolPromise;
}

// 워치독: Promise 가 지정 시간 내 끝나지 않으면 거부 — OCR 무한 멈춤 방지
function withTimeout(promise, ms, label = 'OCR') {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} 시간 초과(${ms}ms)`)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); },
                 e => { clearTimeout(t); reject(e); });
  });
}

function meanWordConfidence(data) {
  if (Array.isArray(data?.words) && data.words.length) {
    let s = 0, n = 0;
    for (const w of data.words) if (w.confidence > 0) { s += w.confidence; n++; }
    if (n) return s / n;
  }
  return typeof data?.confidence === 'number' ? data.confidence : 0;
}

/**
 * 다중 PSM 투표 인식 — 자동분할(PSM 3) + 단일 블록(PSM 6) 두 모드로 인식한 뒤
 * 단어 신뢰도가 더 높은 결과를 채택한다. (레이아웃이 다양한 기출문제에 강함)
 */
async function recognizeBest(worker, image, onProgress, psms = ['3', '6']) {
  const PSMS = psms; // 기본: AUTO(3) + SINGLE_BLOCK(6) 투표 / 대형 페이지는 단일 패스
  let best = null;
  for (let i = 0; i < PSMS.length; i++) {
    try { await worker.setParameters({ tessedit_pageseg_mode: PSMS[i] }); } catch {}
    // ⚠️ tesseract.js v7 에서는 recognize() 의 옵션 객체가 워커로 structuredClone 되어
    //   전달된다. 여기에 logger 같은 '함수'를 넣으면 DataCloneError 로 인식이 즉시 실패하고
    //   (워치독 타임아웃까지 멈춤) OCR 이 전혀 진행되지 않는다. → 함수 옵션 절대 금지.
    //   진행률은 페이지 완료 단위(tick)로 보고하므로 per-call logger 는 불필요.
    onProgress?.(i / PSMS.length);
    const { data } = await worker.recognize(image);
    onProgress?.((i + 1) / PSMS.length);
    const conf = meanWordConfidence(data);
    if (!best || conf > best.conf) best = { data, conf, psm: PSMS[i] };
  }
  return best;
}

/* ══════════════════════════════════════════════════════════════
   SECTION 2  이미지 전처리 파이프라인
   해상도 정규화 → Grayscale → 3×3 미디언 디노이즈 → 기울기 보정(deskew)
   → 히스토그램 스트레치 → Sauvola 적응형 이진화
══════════════════════════════════════════════════════════════ */
function canvasToGray(canvas) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, W, H).data;
  const gray = new Float32Array(W * H);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  return gray;
}

/** 투영 프로파일 분산 최대화로 ±8° 범위 기울기(도) 추정 */
function estimateSkewAngle(gray, W, H) {
  const maxDim = 480;
  const s = Math.min(1, maxDim / Math.max(W, H));
  const w = Math.max(1, Math.round(W * s));
  const h = Math.max(1, Math.round(H * s));
  const small = new Float32Array(w * h);
  let sum = 0;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(H - 1, Math.floor(y / s));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(W - 1, Math.floor(x / s));
      const g = gray[sy * W + sx];
      small[y * w + x] = g; sum += g;
    }
  }
  const mean = sum / (w * h);
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = small[i] < mean * 0.9 ? 1 : 0;

  const offset = w;
  const accLen = h + 2 * w;
  let best = 0, bestScore = -1;
  for (let deg = -8; deg <= 8.0001; deg += 0.5) {
    const rad = deg * Math.PI / 180;
    const sinr = Math.sin(rad), cosr = Math.cos(rad);
    const acc = new Float64Array(accLen);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!ink[y * w + x]) continue;
        const r = Math.round(y * cosr - x * sinr) + offset;
        if (r >= 0 && r < accLen) acc[r]++;
      }
    }
    let m = 0; for (let i = 0; i < accLen; i++) m += acc[i]; m /= accLen;
    let v = 0; for (let i = 0; i < accLen; i++) { const dv = acc[i] - m; v += dv * dv; }
    if (v > bestScore) { bestScore = v; best = deg; }
  }
  return best;
}

/** 3×3 미디언 디노이즈 (사진 노이즈/JPEG 아티팩트 제거)
 *  9원소 중앙값 전용 정렬망(Smith 1996, 19비교)으로 계산 — 픽셀당 배열 할당·정렬
 *  호출이 없어 삽입정렬 대비 빠르며 결과는 완전히 동일하다(무손실 가속). */
function medianDenoise(gray, W, H) {
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const yu = y > 0 ? y - 1 : 0, yd = y < H - 1 ? y + 1 : H - 1;
    const ru = yu * W, rc = y * W, rd = yd * W;
    for (let x = 0; x < W; x++) {
      const xl = x > 0 ? x - 1 : 0, xr = x < W - 1 ? x + 1 : W - 1;
      let a0 = gray[ru + xl], a1 = gray[ru + x], a2 = gray[ru + xr],
          a3 = gray[rc + xl], a4 = gray[rc + x], a5 = gray[rc + xr],
          a6 = gray[rd + xl], a7 = gray[rd + x], a8 = gray[rd + xr], t;
      // median-of-9 정렬망 — s(a,b): a=min, b=max. 마지막에 a4 가 중앙값.
      if (a1 > a2) { t = a1; a1 = a2; a2 = t; } if (a4 > a5) { t = a4; a4 = a5; a5 = t; } if (a7 > a8) { t = a7; a7 = a8; a8 = t; }
      if (a0 > a1) { t = a0; a0 = a1; a1 = t; } if (a3 > a4) { t = a3; a3 = a4; a4 = t; } if (a6 > a7) { t = a6; a6 = a7; a7 = t; }
      if (a1 > a2) { t = a1; a1 = a2; a2 = t; } if (a4 > a5) { t = a4; a4 = a5; a5 = t; } if (a7 > a8) { t = a7; a7 = a8; a8 = t; }
      if (a0 > a3) { t = a0; a0 = a3; a3 = t; } if (a5 > a8) { a5 = a8; } if (a4 > a7) { t = a4; a4 = a7; a7 = t; }
      if (a3 > a6) { a6 = a3; } if (a1 > a4) { t = a1; a1 = a4; a4 = t; } if (a2 > a5) { a2 = a5; }
      if (a4 > a7) { a4 = a7; } if (a4 > a2) { t = a4; a4 = a2; a2 = t; } if (a6 > a4) { a4 = a6; }
      if (a4 > a2) { a4 = a2; }
      out[rc + x] = a4;
    }
  }
  return out;
}

/** gray(Float32) → 히스토그램 스트레치 + Sauvola 이진화 → 캔버스 기록 → PNG Blob */
function grayToBinaryBlob(gray, W, H, canvas) {
  const N = W * H;
  // 히스토그램 스트레치 (2–98 퍼센타일)
  // 256빈 히스토그램의 누적분포로 퍼센타일 추정 — 전체 정렬(O(N log N), 수백 ms)
  // 대비 O(N) 으로 ~35배 빠르고, 0~255 정수 그레이라 결과는 사실상 동일.
  const hist = new Int32Array(256);
  for (let i = 0; i < N; i++) { let v = gray[i] | 0; if (v < 0) v = 0; else if (v > 255) v = 255; hist[v]++; }
  const loCount = N * 0.02, hiCount = N * 0.98;
  let acc = 0, lo = 0, hi = 255, loSet = false;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (!loSet && acc >= loCount) { lo = v; loSet = true; }
    if (acc >= hiCount) { hi = v; break; }
  }
  const rng = hi - lo || 1;
  for (let i = 0; i < N; i++) gray[i] = Math.max(0, Math.min(255, ((gray[i] - lo) / rng) * 255));

  // Sauvola 적응형 이진화 (integral image, window는 해상도에 비례)
  const shorter = Math.min(W, H);
  const HALF = Math.max(10, Math.min(22, Math.round(shorter / 90)));
  const K = 0.18, R = 128;
  const W1 = W + 1, H1 = H + 1;
  const intSum = new Float64Array(W1 * H1);
  const intSq  = new Float64Array(W1 * H1);
  for (let y = 1; y < H1; y++) {
    for (let x = 1; x < W1; x++) {
      const g = gray[(y - 1) * W + (x - 1)];
      const idx = y * W1 + x;
      intSum[idx] = g + intSum[(y-1)*W1+x] + intSum[y*W1+(x-1)] - intSum[(y-1)*W1+(x-1)];
      intSq[idx]  = g*g + intSq[(y-1)*W1+x] + intSq[y*W1+(x-1)] - intSq[(y-1)*W1+(x-1)];
    }
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;
  for (let y = 0; y < H; y++) {
    const y1 = Math.max(0, y - HALF), y2 = Math.min(H - 1, y + HALF);
    for (let x = 0; x < W; x++) {
      const x1 = Math.max(0, x - HALF), x2 = Math.min(W - 1, x + HALF);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sm = intSum[(y2+1)*W1+(x2+1)] - intSum[y1*W1+(x2+1)] - intSum[(y2+1)*W1+x1] + intSum[y1*W1+x1];
      const sq = intSq[(y2+1)*W1+(x2+1)]  - intSq[y1*W1+(x2+1)]  - intSq[(y2+1)*W1+x1]  + intSq[y1*W1+x1];
      const mn = sm / area;
      const stddev = Math.sqrt(Math.max(0, sq / area - mn * mn));
      const thresh = mn * (1 + K * (stddev / R - 1));
      const p = y * W + x;
      const v = gray[p] >= thresh ? 255 : 0;
      const i4 = p * 4;
      data[i4] = data[i4+1] = data[i4+2] = v;
      data[i4+3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return new Promise(res => canvas.toBlob(res, 'image/png'));
}

/** 렌더된 캔버스(PDF 페이지 등) 전처리 — 이미 축 정렬이므로 deskew 생략 */
async function preprocessCanvasForOCR(srcCanvas) {
  let gray = canvasToGray(srcCanvas);
  gray = medianDenoise(gray, srcCanvas.width, srcCanvas.height);
  return grayToBinaryBlob(gray, srcCanvas.width, srcCanvas.height, srcCanvas);
}

/** 업로드 이미지 파일 전처리 (해상도 정규화 + 기울기 보정 포함) */
async function preprocessImageForOCR(file) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      // 해상도 정규화: 짧은 쪽 최소 1 200 px, 긴 쪽 최대 3 000 px (고DPI = 고정밀)
      const longer = Math.max(img.width, img.height);
      const shorter = Math.min(img.width, img.height);
      let scale = 1;
      if (longer > 3000) scale = 3000 / longer;
      else if (shorter < 1200) scale = Math.min(1200 / shorter, 3000 / longer);
      const W = Math.round(img.width * scale);
      const H = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, W, H);

      // 기울기 추정 후 보정 (촬영 기출문제의 비뚤어짐 교정)
      let gray = canvasToGray(canvas);
      let theta = 0;
      try { theta = estimateSkewAngle(gray, W, H); } catch { theta = 0; }
      if (Math.abs(theta) > 0.4) {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);
        ctx.translate(W / 2, H / 2);
        ctx.rotate(-theta * Math.PI / 180);
        ctx.drawImage(img, -W / 2, -H / 2, W, H);
        ctx.restore();
        gray = canvasToGray(canvas);
      }
      URL.revokeObjectURL(url);

      gray = medianDenoise(gray, W, H);
      grayToBinaryBlob(gray, W, H, canvas).then(resolve).catch(reject);
    };

    img.onerror = reject;
    img.src = url;
  });
}

/* ══════════════════════════════════════════════════════════════
   SECTION 2.5  PDF 기출문제 인식
   디지털 텍스트층 우선 추출 → 스캔본은 고DPI 렌더 후 OCR
══════════════════════════════════════════════════════════════ */
let _pdfium = null;
async function getPdfium() {
  if (_pdfium) return _pdfium;
  _pdfium = await PDFiumLibrary.init();
  return _pdfium;
}

/** PDFium Gray 비트맵(1byte/px) → RGBA 캔버스 (전처리 파이프라인 입력용) */
function grayBitmapToCanvas(data, W, H) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const cx = c.getContext('2d', { willReadFrequently: true });
  const img = cx.createImageData(W, H);
  const out = img.data;
  for (let p = 0, i = 0; p < data.length; p++, i += 4) {
    const g = data[p];
    out[i] = out[i + 1] = out[i + 2] = g; out[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return c;
}

async function extractFromPDF(file, { onProgress, onPhase } = {}) {
  const lib = await getPdfium();
  const buf = new Uint8Array(await file.arrayBuffer());
  const doc = await lib.loadDocument(buf);
  const n = doc.getPageCount();
  const results = new Array(n).fill('');   // 페이지 순서 보존
  let ocrUsed = false, confSum = 0, confN = 0;

  // 진행률: 디지털 텍스트·OCR 완료 페이지를 합산해 단조 증가
  let done = 0;
  const tick = () => onProgress?.(Math.min(1, ++done / n));

  // best 모델 OCR 워커 풀(지연 생성) + 가용 워커 스택 + 진행 중 잡 목록
  let pool = null;
  const free = [];
  const inFlight = [];

  // 한 페이지를 풀의 한 워커에 맡겨 OCR (best 모델, PSM 3 단일 패스)
  function dispatchOCR(idx, blob) {
    const worker = free.pop();
    const job = (async () => {
      try {
        // 페이지당 최대 90초 — 초과 시 해당 페이지만 건너뛰고 배치는 계속.
        const best = await withTimeout(
          recognizeBest(worker, blob, null, ['3']),
          90000, `${idx + 1}페이지 OCR`,
        );
        const txt = (best?.data?.text || '').trim();
        if (txt.length > 3) { results[idx] = txt; confSum += best.conf; confN++; }
      } catch (e) {
        console.warn(`[OCR] ${idx + 1}페이지 건너뜀:`, e?.message);
      } finally {
        free.push(worker);   // 워커 반납
        tick();
      }
    })();
    inFlight.push(job);
    job.finally(() => {
      const k = inFlight.indexOf(job);
      if (k >= 0) inFlight.splice(k, 1);
    });
  }

  try {
    for (let i = 0; i < n; i++) {
      const page = doc.getPage(i);
      let native = '';
      try { native = (page.getText() || '').replace(/[ \t]+/g, ' ').trim(); } catch { native = ''; }

      if (native.length >= 40) {
        // 디지털 PDF → 텍스트층 직접 사용 (완벽 정확도, OCR 불필요)
        results[i] = native;
        confSum += 99; confN++;
        tick();
        continue;
      }

      // 스캔 PDF → PDFium 으로 Gray 래스터화(긴 변 ≈ 2200px) + 전처리 (메인 스레드, 순차)
      onPhase?.('ocr');
      ocrUsed = true;
      if (!pool) { pool = await getOCRPool(); free.push(...pool); }

      let sz = { width: 612, height: 792 };
      try { const o = page.getOriginalSize(); sz = { width: o.originalWidth, height: o.originalHeight }; } catch {}
      const longEdgePt = Math.max(sz.width, sz.height) || 792;
      // PDFium scale 은 72DPI 기준 배율 — 2200/longEdgePt 로 긴 변 ≈ 2200px(약 200DPI) 목표.
      const scale = Math.max(1.5, Math.min(4.0, 2200 / longEdgePt));
      const rendered = await page.render({ scale, colorSpace: 'Gray' });
      const srcCanvas = grayBitmapToCanvas(rendered.data, rendered.width, rendered.height);
      const blob = await preprocessCanvasForOCR(srcCanvas);

      // 가용 워커가 없으면 하나 빌 때까지 대기 → 동시 OCR 수를 풀 크기로 제한(메모리 안정)
      while (free.length === 0) await Promise.race(inFlight);
      dispatchOCR(i, blob);
    }
    // 남은 OCR 잡 모두 완료 대기
    await Promise.allSettled(inFlight);
  } finally {
    try { doc.destroy(); } catch {}
  }

  const pages = results.filter(t => t && t.length);
  return {
    text: pages.join('\n\n──────\n\n').trim(),
    numPages: n,
    ocrUsed,
    confidence: confN ? Math.round(confSum / confN) : 0,
  };
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
  history:   { name: '역사',       color: '#1B64DA', icon: '📖' },
  geography: { name: '지리',       color: '#1B64DA', icon: '🌍' },
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
    ? '\n[선택지]\n' + parsedQ.options.map(o => `  ${o.label}. ${o.content}`).join('\n')
    : '';
  const answerLine = parsedQ.answerKey ? `\n[정답] ${parsedQ.answerKey}` : '';
  return [
    {
      role: 'system',
      content:
        'EJU 일본유학시험 전문 튜터다. 한국어로 정확하고 구체적으로 해설한다. ' +
        '문제의 출제 유형을 분류하고, 각 선택지가 왜 정답/오답인지 근거를 들어 설명한다. ' +
        '불확실하면 일반 원리로 설명하되 사실을 지어내지 않는다.',
    },
    {
      role: 'user',
      content:
        `다음 EJU ${subject} 문제를 분석하라.\n\n` +
        `[문제]\n${(parsedQ.questionText || '').slice(0, 600)}${optText}${answerLine}\n\n` +
        `아래 형식 그대로 한국어로 답하라:\n` +
        `■ 출제 유형: (그래프해석 / 계산 / 개념이해 / 자료해석 중 택1) + 세부 단원명\n` +
        `■ 핵심 개념: (1~2줄)\n` +
        `■ 선택지별 해설: ①②③④ 순서로 각 보기가 정답인지 오답인지와 그 이유를 한 줄씩\n` +
        `■ 자주 하는 실수: (이 유형에서 흔한 함정)\n` +
        `■ 학습 포인트: (다음에 맞히려면 무엇을 알아야 하는지)`,
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

    const cleanup = () => {
      worker.removeEventListener('message', handleMsg);
      worker.removeEventListener('error', handleErr);
      worker.removeEventListener('messageerror', handleErr);
    };

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
          cleanup();
          onDone?.();
          break;
        case 'error':
          cleanup();
          _webWorkerLoading = false;
          onError?.(data.message);
          break;
      }
    };

    // 워커가 모듈 import/모델 로드 중 크래시하면 'message' 가 아닌 'error'/'messageerror'
    // 이벤트가 발생함. 이를 잡지 않으면 로딩 스피너가 영원히 멈추지 않음(무한로딩).
    const handleErr = (e) => {
      cleanup();
      _webWorkerLoading = false;
      _webWorker = null;          // 다음 시도에서 워커를 새로 생성
      _webWorkerLoaded = false;
      onError?.(e?.message || 'AI 워커 실행 오류 (모델 로드 실패)');
    };

    worker.addEventListener('message', handleMsg);
    worker.addEventListener('error', handleErr);
    worker.addEventListener('messageerror', handleErr);

    if (_webWorkerLoaded) {
      worker.postMessage({ type: 'generate', messages });
    } else if (!_webWorkerLoading) {
      _webWorkerLoading = true;
      worker.postMessage({ type: 'load' });
    }
    // 그 외(_webWorkerLoading === true): 로드 진행 중 → 'loaded' 수신 시 generate 트리거됨
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
        objectFit: 'contain', background: 'var(--bg3)', border: '1px solid var(--bd0)',
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
      background: 'rgba(0,27,55,0.045)', borderRadius: 8, marginBottom: 4,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6,
        background: 'rgba(49,130,246,0.12)', color: '#1B64DA',
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
    background: 'rgba(49,130,246,0.03)',
    border: '1px solid rgba(49,130,246,0.14)',
    padding: 14,
  };

  /* 초기 상태 (분석 전) */
  if (!loading && !streamText && !error) {
    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={16} color="#3182F6" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)' }}>AI 개념 분석</span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
              background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', letterSpacing: 0.5,
            }}>Qwen2.5-0.5B</span>
          </div>
          <button onClick={onStart} style={{
            background: 'linear-gradient(135deg, #3182F6, #1B64DA)',
            color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Zap size={12} /> 분석 시작
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
          로컬 AI로 <b style={{ color: 'var(--t2)' }}>출제 유형 분류 · 선택지별 정오 해설 · 자주 하는 실수 · 학습 포인트</b>를 분석합니다.
          Electron: Worker Thread · Web: WebGPU/WASM (첫 실행 시 모델 다운로드 필요)
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Brain size={16} color="#3182F6" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)' }}>AI 개념 분석</span>
        {loading && (
          <span style={{ fontSize: 10, color: '#3182F6', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ScanLine size={11} style={{ animation: 'spin 1.5s linear infinite' }} />
            {streamText ? '분석 중...' : progressPct > 0 ? `모델 로드 ${progressPct}%` : '모델 초기화 중...'}
          </span>
        )}
      </div>

      {/* 모델 로드 프로그레스 바 */}
      {loading && !streamText && progressPct > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ height: 4, background: 'rgba(0,27,55,0.045)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${progressPct}%`, height: '100%',
              background: 'linear-gradient(90deg, #3182F6, #8b5cf6)',
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
              background: '#3182F6', verticalAlign: 'text-bottom', marginLeft: 2,
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
   SECTION 6.5  대량 업로드 헬퍼 (PDF/이미지 배치 처리)
══════════════════════════════════════════════════════════════ */
function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/** 단일 파일(PDF/이미지)을 인식·파싱하여 entry 객체로 반환 (UI 단일 상태 변경 없음) */
async function processOneFile(file, onProgress) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  let rawText = '', confidence = 0, pdfMeta = null, dataUrl = null;

  if (isPdf) {
    const res = await extractFromPDF(file, { onProgress, onPhase: () => {} });
    rawText    = res.text || '';
    confidence = res.confidence || 0;
    pdfMeta    = { numPages: res.numPages, ocrUsed: res.ocrUsed };
  } else {
    const blob   = await preprocessImageForOCR(file);
    const worker = await getOCRWorker();
    const best   = await recognizeBest(worker, blob, onProgress);
    rawText      = best.data.text || '';
    confidence   = Math.round(best.conf || 0);
    dataUrl      = await fileToDataUrl(file);
  }

  const parsedQ = parseQuestionFromText(rawText) || {
    questionNumber: null,
    questionText: rawText.slice(0, 600),
    options: [], answerKey: null, subjectType: 'unknown',
    confidence, rawLength: rawText.length,
  };
  parsedQ.rawText    = rawText;
  parsedQ.confidence = Math.max(parsedQ.confidence || 0, confidence);
  if (pdfMeta) parsedQ.pdfMeta = pdfMeta;

  const entry = {
    id:           crypto.randomUUID(),
    date:         new Date().toISOString().slice(0, 10),
    examName:     isPdf ? file.name.replace(/\.pdf$/i, '') : `사진변환 문제 #${parsedQ.questionNumber || '?'}`,
    photoDataUrl: dataUrl,
    parsed:       { ...parsedQ },
    aiAnalysis:   null,
    type:         parsedQ.subjectType === 'math' ? 'math' : 'comprehensive',
    savedAt:      new Date().toISOString(),
    source:       isPdf ? 'pdf-batch' : 'image-batch',
  };
  return { entry, parsedQ, confidence, isPdf };
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
  const [mode, setMode]               = useState('upload');     // upload|result|batch
  const [savedQuestions, setSavedQuestions] = useState([]);
  const [isDragging, setIsDragging]   = useState(false);

  // 대량 업로드 상태
  const [batchActive, setBatchActive] = useState(false);
  const [batchQueue, setBatchQueue]   = useState([]);           // [{ name, status, subject, conf, error }]
  const [batchCurrent, setBatchCurrent] = useState(0);

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

      /* 2. OCR (다중 PSM 투표 — 신뢰도 높은 결과 채택) */
      const worker = await getOCRWorker();
      setProgress(32);

      const best = await recognizeBest(worker, processedBlob, p => {
        setProgress(32 + Math.round(p * 52));
      });
      const data = best.data;

      setProgress(88);
      setOcrPhase('parsing');

      /* 3. 단어 레벨 신뢰도 */
      const avgConf = Math.round(best.conf);
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
     PDF 기출문제 인식
  ────────────────────────────────────────────── */
  const runPDF = useCallback(async (file) => {
    setIsProcessing(true);
    setOcrPhase('pdf');
    setProgress(4);
    setOcrConfidence(null);
    try {
      const res = await extractFromPDF(file, {
        onProgress: (p) => setProgress(4 + Math.round(p * 84)),
        onPhase:    (ph) => setOcrPhase(ph === 'ocr' ? 'ocr' : 'pdf'),
      });
      setProgress(92);
      setOcrPhase('parsing');

      const rawText = res.text || '';
      const parsedQ = parseQuestionFromText(rawText) || {
        questionNumber: null,
        questionText: rawText.slice(0, 600),
        options: [], answerKey: null, subjectType: 'unknown',
        confidence: res.confidence, rawLength: rawText.length,
      };
      parsedQ.rawText = rawText;
      parsedQ.confidence = Math.max(parsedQ.confidence || 0, res.confidence);
      parsedQ.pdfMeta = { numPages: res.numPages, ocrUsed: res.ocrUsed };
      setOcrConfidence(res.confidence);
      setParsed(parsedQ);
      setEditForm({
        questionNumber: parsedQ.questionNumber || '',
        questionText:   parsedQ.questionText,
        options:        parsedQ.options.map(o => ({ ...o })),
        answerKey:      parsedQ.answerKey || '',
        subjectType:    parsedQ.subjectType,
        memo:           '',
      });
      setProgress(100);
      setMode('result');
    } catch (err) {
      console.error('[PDF OCR] Error:', err);
      alert('PDF 인식에 실패했습니다: ' + err.message);
    } finally {
      setIsProcessing(false);
      setOcrPhase('');
    }
  }, []);

  /* ──────────────────────────────────────────────
     파일 핸들러 (이미지 + PDF)
  ────────────────────────────────────────────── */
  const handleFile = useCallback((file) => {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isImage && !isPdf) {
      alert('이미지(JPG/PNG/WebP) 또는 PDF 파일만 업로드 가능합니다.');
      return;
    }
    setMode('upload');
    setParsed(null);
    setAiStreamText('');
    setAiError(null);
    setAiLoading(false);

    if (isPdf) {
      setPhoto({ file, dataUrl: null, isPdf: true, name: file.name });
      runPDF(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhoto({ file, dataUrl: e.target.result });
        runOCR(file);
      };
      reader.readAsDataURL(file);
    }
  }, [runOCR, runPDF]);

  /* ──────────────────────────────────────────────
     대량 업로드 (PDF/이미지 여러 개 순차 배치 처리)
  ────────────────────────────────────────────── */
  const runBatch = useCallback(async (files) => {
    setMode('batch');
    setBatchActive(true);
    setBatchCurrent(0);
    setBatchQueue(files.map(f => ({
      name: f.name,
      isPdf: f.type === 'application/pdf' || /\.pdf$/i.test(f.name),
      status: 'pending', subject: null, conf: null, error: null,
    })));

    const savedEntries = [];
    for (let i = 0; i < files.length; i++) {
      setBatchCurrent(i);
      setProgress(0);
      setBatchQueue(q => q.map((it, idx) => idx === i ? { ...it, status: 'processing' } : it));
      try {
        const { entry, parsedQ, confidence } = await processOneFile(
          files[i], p => setProgress(Math.round(p * 100)),
        );
        savedEntries.push(entry);
        setBatchQueue(q => q.map((it, idx) => idx === i
          ? { ...it, status: 'done', subject: parsedQ.subjectType, conf: confidence } : it));
      } catch (err) {
        console.error('[Batch] Error on', files[i]?.name, err);
        setBatchQueue(q => q.map((it, idx) => idx === i
          ? { ...it, status: 'error', error: err.message } : it));
      }
    }

    if (savedEntries.length > 0) {
      try {
        const existing = JSON.parse(localStorage.getItem('eju_photo_questions') || '[]');
        const merged = [...savedEntries, ...existing];
        localStorage.setItem('eju_photo_questions', JSON.stringify(merged));
        setSavedQuestions(merged);
        if (onSaved) onSaved();
      } catch {
        alert('일괄 저장 중 오류가 발생했습니다.');
      }
    }
    setBatchActive(false);
  }, [onSaved]);

  /* ──────────────────────────────────────────────
     파일 핸들러 (단일=상세 / 다중=배치)
  ────────────────────────────────────────────── */
  const handleFiles = useCallback((fileList) => {
    const files = Array.from(fileList).filter(f =>
      f.type.startsWith('image/') || f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (files.length === 0) {
      alert('이미지(JPG/PNG/WebP) 또는 PDF 파일만 업로드 가능합니다.');
      return;
    }
    if (files.length === 1) { handleFile(files[0]); return; }
    runBatch(files);
  }, [handleFile, runBatch]);

  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = ()  => setIsDragging(false);
  const handleDrop      = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
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
    setBatchQueue([]); setBatchActive(false); setBatchCurrent(0);
  };

  /* ──────────────────────────────────────────────
     저장된 변환 문제 전체 삭제
  ────────────────────────────────────────────── */
  const handleDeleteAllSaved = () => {
    if (!window.confirm('저장된 변환 문제(기출/오답)를 모두 삭제할까요? 되돌릴 수 없습니다.')) return;
    try {
      localStorage.removeItem('eju_photo_questions');
      localStorage.removeItem('eju_ocr_analysis');
      setSavedQuestions([]);
      if (onSaved) onSaved();
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  /* ──────────────────────────────────────────────
     스타일 헬퍼
  ────────────────────────────────────────────── */
  const dropzoneStyle = {
    border:       `2px dashed ${isDragging ? '#3182F6' : 'var(--bd1)'}`,
    borderRadius: 16, padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
    background:   isDragging ? 'rgba(49,130,246,0.05)' : 'var(--bg2)', transition: 'all 0.2s',
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
    preprocessing: '이미지 전처리 (디노이즈 → 기울기보정 → Sauvola 이진화)...',
    ocr:           '정밀 OCR 인식 중 (tessdata_best · 다중 PSM 투표)...',
    pdf:           'PDF 텍스트층 추출 / 스캔 페이지 OCR 중...',
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
          사진/PDF → 정밀 전처리(디노이즈·기울기보정) → tessdata_best 다중 PSM OCR → 유형 분류 + 선택지별 AI 해설
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
            background: 'rgba(0,27,55,0.045)', borderRadius: 3, overflow: 'hidden',
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
          대량 업로드 진행/결과
      ══════════════════════════════════════════ */}
      {mode === 'batch' && (
        <>
          <div style={{ ...CARD }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t0)' }}>
                <FileText size={16} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--blue)' }} />
                대량 업로드 {batchActive ? '처리 중' : '완료'}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>
                {batchQueue.filter(b => b.status === 'done' || b.status === 'error').length} / {batchQueue.length}
              </span>
            </div>

            {/* 전체 진행 바 */}
            <div style={{ height: 6, background: 'rgba(0,27,55,0.045)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{
                width: `${batchQueue.length ? Math.round((batchQueue.filter(b => b.status === 'done' || b.status === 'error').length + (batchActive ? progress / 100 : 0)) / batchQueue.length * 100) : 0}%`,
                height: '100%', background: 'linear-gradient(90deg, var(--blue), var(--purple))',
                borderRadius: 3, transition: 'width 0.3s',
              }} />
            </div>
            {batchActive && (
              <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6 }}>
                현재: {batchQueue[batchCurrent]?.name} · {progress}%
              </div>
            )}

            {/* 파일별 상태 리스트 */}
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 340, overflow: 'auto' }}>
              {batchQueue.map((b, i) => {
                const subj = b.subject ? (SUBJECT_MAP[b.subject] || SUBJECT_MAP.unknown) : null;
                const statusMeta = {
                  pending:    { c: 'var(--t3)', t: '대기' },
                  processing: { c: 'var(--blue)', t: '인식 중…' },
                  done:       { c: 'var(--green)', t: '완료' },
                  error:      { c: 'var(--red)', t: '실패' },
                }[b.status];
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                    background: 'var(--bg1)', borderRadius: 10, border: '1px solid var(--bd0)',
                  }}>
                    {b.isPdf ? <FileText size={16} color="var(--blue)" style={{ flexShrink: 0 }} />
                             : <Image size={16} color="var(--t3)" style={{ flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--t0)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.name}
                      </div>
                      {b.status === 'done' && subj && (
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
                          <span style={{ color: subj.color, fontWeight: 600 }}>{subj.icon} {subj.name}</span>
                          {b.conf != null && <> · 신뢰도 {b.conf}%</>}
                        </div>
                      )}
                      {b.status === 'error' && (
                        <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.error}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: statusMeta.c, flexShrink: 0 }}>
                      {b.status === 'processing'
                        ? <ScanLine size={13} style={{ verticalAlign: 'middle', animation: 'spin 1.5s linear infinite' }} />
                        : statusMeta.t}
                    </span>
                  </div>
                );
              })}
            </div>

            {!batchActive && (
              <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={resetAll} style={btnPrimary}>
                  <Upload size={14} /> 더 업로드하기
                </button>
              </div>
            )}
          </div>
        </>
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
              이미지·PDF를 드래그하거나 클릭하여 업로드
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 14 }}>
              JPG · PNG · WebP · PDF 지원 · 여러 PDF 한 번에 선택 가능 · 기출문제 / 오답노트
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                style={{ ...btnSecondary, padding: '9px 14px' }}>
                <Camera size={14} /> 카메라 촬영
              </button>
              <button onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                style={{ ...btnPrimary, padding: '9px 14px' }}>
                <FileImage size={14} /> 파일 / PDF 선택 (다중)
              </button>
            </div>
          </div>

          <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf,.pdf" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />

          {/* OCR 파이프라인 표시 */}
          <div style={{ ...CARD, padding: 14, marginTop: 0, background: 'rgba(0,27,55,0.045)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', marginBottom: 8 }}>
              <BarChart2 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              OCR 처리 파이프라인
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {['해상도정규화', '디노이즈', '기울기보정', 'Sauvola 이진화', 'best 다중PSM OCR', 'AI 유형·해설'].map((step, i, arr) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(49,130,246,0.08)', color: '#1B64DA', fontWeight: 600,
                  }}>{step}</span>
                  {i < arr.length - 1 && <ChevronRight size={10} color="var(--t3)" />}
                </span>
              ))}
            </div>
          </div>

          {/* 저장된 문제 목록 */}
          {savedQuestions.length > 0 && (
            <div style={{ ...CARD, marginTop: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)' }}>
                  <BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: '#f59e0b' }} />
                  최근 변환 문제 ({savedQuestions.length}개)
                </div>
                <button onClick={handleDeleteAllSaved} style={{
                  background: 'transparent', border: '1px solid var(--bd1)', color: 'var(--red)',
                  borderRadius: 8, padding: '5px 11px', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Trash2 size={12} /> 전체 삭제
                </button>
              </div>
              {savedQuestions.slice(0, 5).map((q) => {
                const subj = SUBJECT_MAP[q.parsed?.subjectType] || SUBJECT_MAP.unknown;
                return (
                  <div key={q.id} style={{
                    display: 'flex', gap: 10, padding: '10px 12px',
                    background: 'rgba(0,27,55,0.045)', borderRadius: 10,
                    marginBottom: 6, border: '1px solid rgba(0,27,55,0.045)',
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
          {/* 원본 이미지 / PDF */}
          <div style={{ ...CARD, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 8 }}>
              {photo?.isPdf
                ? <><FileText size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 원본 PDF</>
                : <><Image size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 원본 이미지</>}
            </div>
            {photo?.isPdf ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                background: 'rgba(49,130,246,0.06)', border: '1px solid rgba(49,130,246,0.18)',
                borderRadius: 12,
              }}>
                <FileText size={28} color="var(--blue)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {photo.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                    {parsed.pdfMeta?.numPages ?? '?'}페이지 · {parsed.pdfMeta?.ocrUsed ? '스캔본 OCR' : '디지털 텍스트층 추출'}
                  </div>
                </div>
                <button onClick={resetAll} style={{
                  background: 'transparent', border: '1px solid var(--bd1)', color: 'var(--t2)',
                  borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                }}>다시</button>
              </div>
            ) : (
              photo?.dataUrl && <ImagePreview src={photo.dataUrl} onRemove={resetAll} />
            )}
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
                        background: 'rgba(49,130,246,0.1)', borderRadius: 6, color: '#1B64DA', flexShrink: 0,
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
                  padding: '12px 14px', background: 'rgba(0,27,55,0.045)',
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
