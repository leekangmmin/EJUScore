/**
 * PhotoToQuestion — 사진 속 문제를 자동으로 문제 형식으로 변환
 * Tesseract.js OCR + 구조화된 질문 파싱 + 틀린 문제 저장
 */
import { useState, useRef, useCallback } from 'react';
import {
  Camera, Upload, FileImage, ScanLine, Check, X,
  Plus, Save, Edit3, RefreshCw, AlertCircle, Sparkles,
  HelpCircle, BookOpen, Layers, Image,
} from 'lucide-react';

const CARD = {
  background: 'var(--bg2)',
  border: '1px solid var(--bd0)',
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
};

/* ── OCR 엔진 (Tesseract.js 싱글톤) ── */
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

/* ── 질문 파서 (EJU 스타일) ── */
function parseQuestionFromText(rawText) {
  if (!rawText || rawText.trim().length < 10) return null;

  const text = rawText.trim();
  let questionNumber = null;
  let questionText = '';
  let options = [];
  let answerKey = null;

  // 1) 문제 번호 추출: "問1", "문제 1", "1.", "[1]" 등
  const numMatch = text.match(/(?:問|문제|No\.?|Question)\s*(\d+)|^(\d+)[.．]/m);
  if (numMatch) {
    questionNumber = parseInt(numMatch[1] || numMatch[2]);
  }

  // 2) 선택지 추출 (한국어/일본어 EJU 스타일)
  // 패턴: ①, ②, ③, ④ 또는 1., 2., 3., 4. 또는 A., B., C., D.
  const optionRegex = /(?:[①-④]|(?:^|\n)\s*(?:[A-D][.．)])|(?:^|\n)\s*(?:[1-4][.．)]))/gm;
  let optMatch;
  const optionStarts = [];
  while ((optMatch = optionRegex.exec(text)) !== null) {
    optionStarts.push({ index: optMatch.index, text: optMatch[0] });
  }

  if (optionStarts.length >= 2) {
    // 선택지들을 추출
    for (let i = 0; i < optionStarts.length; i++) {
      const start = optionStarts[i].index + optionStarts[i].text.length;
      const end = i < optionStarts.length - 1 ? optionStarts[i + 1].index : text.length;
      const optLabel = optionStarts[i].text.trim();
      const optContent = text.slice(start, end).trim().split('\n')[0].trim();
      const optionLetter = optLabel.replace(/[.．)]/g, '').trim();
      options.push({ label: optionLetter, content: optContent });
    }
    // 문제 텍스트는 첫 번째 선택지 이전까지
    questionText = text.slice(0, optionStarts[0].index).trim();
    // 문제 번호 텍스트 제거
    if (numMatch) {
      questionText = questionText.replace(/(?:問|문제|No\.?|Question)\s*\d+\s*/m, '').trim();
    }
  } else {
    // 선택지가 없으면 전체를 문제 텍스트로
    questionText = text;
    if (numMatch) {
      questionText = questionText.replace(/(?:問|문제|No\.?|Question)\s*\d+\s*/m, '').trim();
    }
  }

  // 3) 정답 추출 (끝부분에 "正解：①" 또는 "답: 1" 등)
  const answerMatch = text.match(/(?:正解|정답|답|answer|Ans)\s*[：:]\s*([①-④A-Da-d1-4])/i);
  if (answerMatch) {
    answerKey = answerMatch[1];
  }

  // 4) 과목 판별 (키워드 기반)
  let subjectType = 'unknown';
  const fullText = text.toLowerCase();
  if (/경제|수요|공급|GDP|환율|시장|무역|재정|금융|인플레이|수요공급/.test(fullText)) subjectType = 'economy';
  else if (/헌법|정치|민주|선거|의회|내각|삼권|대통령|의원내각/.test(fullText)) subjectType = 'politics';
  else if (/역사|혁명|전쟁|냉전|제국|독립|메이지|프랑스|세계대전/.test(fullText)) subjectType = 'history';
  else if (/지리|기후|지형|인구|도시|농업|자원|지도|온도|강수/.test(fullText)) subjectType = 'geography';
  else if (/사회|환경|복지|고령|에너지|NGO|파리|협약|저출산/.test(fullText)) subjectType = 'society';
  else if (/함수|방정식|그래프|미분|적분|확률|수열|벡터|행렬|삼각|로그/.test(fullText)) subjectType = 'math';

  return {
    questionNumber,
    questionText: questionText || text.slice(0, 200),
    options,
    answerKey,
    subjectType,
    confidence: options.length >= 2 ? 75 : 40,
    rawLength: text.length,
  };
}

/* ── 과목 이름 & 컬러 매핑 ── */
const SUBJECT_MAP = {
  economy: { name: '경제', color: '#10b981', icon: '💰' },
  politics: { name: '정치', color: '#ef4444', icon: '🏛️' },
  history: { name: '역사', color: '#a855f7', icon: '📖' },
  geography: { name: '지리', color: '#3b82f6', icon: '🌍' },
  society: { name: '사회', color: '#f59e0b', icon: '👥' },
  math: { name: '수학 코스1', color: '#6366f1', icon: '📐' },
  unknown: { name: '미분류', color: '#94a3b8', icon: '❓' },
};

/* ── 프리뷰 이미지 컴포넌트 ── */
function ImagePreview({ src, onRemove }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <img src={src} alt="captured" style={{
        maxWidth: '100%', maxHeight: 320, borderRadius: 12,
        objectFit: 'contain', background: '#000',
      }} />
      <button onClick={onRemove} style={{
        position: 'absolute', top: 6, right: 6,
        width: 28, height: 28, borderRadius: '50%',
        background: 'rgba(0,0,0,0.6)', border: 'none',
        color: '#fff', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}><X size={14} /></button>
    </div>
  );
}

/* ── 옵션 렌더러 ── */
function OptionBlock({ opt, idx }) {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
      borderRadius: 8, marginBottom: 4,
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6,
        background: 'rgba(59,130,246,0.12)', color: '#3b82f6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>{opt.label}</span>
      <span style={{ fontSize: 13, color: 'var(--t0)', lineHeight: 1.5 }}>{opt.content}</span>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
export default function PhotoToQuestion({ onSaved }) {
  const [photo, setPhoto] = useState(null);          // { file, dataUrl }
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsed, setParsed] = useState(null);         // 파싱 결과
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);      // 수정 폼
  const [mode, setMode] = useState('upload');          // 'upload' | 'result' | 'edit'
  const [savedQuestions, setSavedQuestions] = useState([]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  /* ── OCR 실행 ── */
  const runOCR = useCallback(async (file, dataUrl) => {
    setIsProcessing(true);
    setProgress(5);

    try {
      const worker = await getOCRWorker();
      setProgress(20);

      const { data } = await worker.recognize(file, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(20 + Math.round(m.progress * 60));
          }
        },
      });

      setProgress(85);

      const rawText = data.text || '';
      const parsedQ = parseQuestionFromText(rawText);
      
      setProgress(100);

      if (parsedQ) {
        parsedQ.rawText = rawText;
        setParsed(parsedQ);
        setEditForm({
          questionNumber: parsedQ.questionNumber || '',
          questionText: parsedQ.questionText,
          options: parsedQ.options.map(o => ({ label: o.label, content: o.content })),
          answerKey: parsedQ.answerKey || '',
          subjectType: parsedQ.subjectType,
          memo: '',
        });
      }

      setMode('result');
    } catch (err) {
      console.error('[OCR] Error:', err);
      alert('OCR 변환에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /* ── 파일 업로드 핸들러 ── */
  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다 (JPG/PNG/WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setPhoto({ file, dataUrl });
      setMode('upload');
      setParsed(null);
      runOCR(file, dataUrl);
    };
    reader.readAsDataURL(file);
  }, [runOCR]);

  /* ── 드래그 앤 드롭 ── */
  const [isDragging, setIsDragging] = useState(false);
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  /* ── 수정 저장 ── */
  const handleSaveEdit = () => {
    setParsed(prev => ({
      ...prev,
      questionText: editForm.questionText,
      options: editForm.options,
      answerKey: editForm.answerKey,
      subjectType: editForm.subjectType,
    }));
    setEditing(false);
  };

  /* ── 틀린 문제 저장 (Exam Entry) ── */
  const handleSaveAsWrong = () => {
    const entry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      examName: `사진변환 문제 #${parsed.questionNumber || '?'}`,
      photoDataUrl: photo?.dataUrl || null,
      parsed: { ...parsed },
      type: parsed.subjectType === 'math' ? 'math' : 'comprehensive',
      savedAt: new Date().toISOString(),
    };
    
    // localStorage에 저장
    try {
      const existing = JSON.parse(localStorage.getItem('eju_photo_questions') || '[]');
      existing.unshift(entry);
      localStorage.setItem('eju_photo_questions', JSON.stringify(existing));
      setSavedQuestions(prev => [entry, ...prev]);
      alert('✅ 변환된 문제가 저장되었습니다! 대시보드에서 확인하세요.');
      resetAll();
    } catch (err) {
      console.error('Save failed:', err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  /* ── 리셋 ── */
  const resetAll = () => {
    setPhoto(null);
    setParsed(null);
    setMode('upload');
    setEditing(false);
    setProgress(0);
  };

  /* ── 저장된 문제 불러오기 ── */
  const loadSaved = useCallback(() => {
    try {
      const data = JSON.parse(localStorage.getItem('eju_photo_questions') || '[]');
      setSavedQuestions(data);
    } catch {}
  }, []);

  // 초기 로드
  const [initialLoaded, setInitialLoaded] = useState(false);
  if (!initialLoaded) {
    loadSaved();
    setInitialLoaded(true);
  }

  /* ── 업로드 영역 스타일 ── */
  const dropzoneStyle = {
    border: `2px dashed ${isDragging ? 'var(--blue)' : 'var(--bd1)'}`,
    borderRadius: 16,
    padding: '40px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    background: isDragging ? 'rgba(79,142,247,0.05)' : 'var(--bg2)',
    transition: 'all 0.2s',
  };

  const btnPrimary = {
    background: 'linear-gradient(135deg, var(--blue), var(--purple))',
    color: '#fff', border: 'none', borderRadius: 10,
    padding: '10px 18px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  };

  const btnSecondary = {
    background: 'transparent', color: 'var(--t2)',
    border: '1px solid var(--bd1)', borderRadius: 10,
    padding: '10px 16px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* 헤더 */}
      <div style={{ ...CARD, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t0)', marginBottom: 4 }}>
          <Camera size={20} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--blue)' }} />
          사진 → 문제 변환
        </div>
        <div style={{ fontSize: 12, color: 'var(--t2)' }}>
          틀린 문제를 사진으로 찍어 업로드하면 AI가 자동으로 문제 형식으로 변환합니다
        </div>
      </div>

      {/* 처리 상태 */}
      {isProcessing && (
        <div style={{ ...CARD, textAlign: 'center' }}>
          <ScanLine size={32} color="var(--blue)" style={{ margin: '12px 0', animation: 'spin 1.5s linear infinite' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t0)', marginBottom: 8 }}>OCR 변환 중...</div>
          <div style={{ maxWidth: 300, margin: '0 auto', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--blue), var(--purple))', borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>{progress}%</div>
        </div>
      )}

      {/* 업로드 영역 */}
      {mode === 'upload' && !isProcessing && (
        <>
          <div
            style={dropzoneStyle}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={36} color="var(--t2)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t0)', marginBottom: 6 }}>
              이미지를 드래그하거나 클릭하여 업로드
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 14 }}>
              JPG, PNG, WebP 지원 · EJU 기출문제/오답노트 사진
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Camera size={14} /> 카메라 촬영
              </button>
              <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileImage size={14} /> 갤러리에서 선택
              </button>
            </div>
          </div>

          {/* 숨겨진 input */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />

          {/* 저장된 문제 목록 */}
          {savedQuestions.length > 0 && (
            <div style={{ ...CARD, marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)', marginBottom: 10 }}>
                <BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: '#f59e0b' }} />
                최근 변환 문제 ({savedQuestions.length}개)
              </div>
              {savedQuestions.slice(0, 5).map((q, i) => {
                const subj = SUBJECT_MAP[q.parsed?.subjectType] || SUBJECT_MAP.unknown;
                return (
                  <div key={q.id} style={{
                    display: 'flex', gap: 10, padding: '10px 12px',
                    background: 'rgba(255,255,255,0.02)', borderRadius: 10,
                    marginBottom: 6, border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    {q.photoDataUrl ? (
                      <img src={q.photoDataUrl} alt="thumb" style={{
                        width: 40, height: 40, borderRadius: 6,
                        objectFit: 'cover', flexShrink: 0,
                      }} />
                    ) : <Image size={20} color="var(--t3)" style={{ margin: 10 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--t0)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.parsed?.questionText?.slice(0, 60)}...
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: subj.color, fontWeight: 600 }}>{subj.icon} {subj.name}</span>
                        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{q.date}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ====== 결과 화면 ====== */}
      {mode === 'result' && parsed && !isProcessing && (
        <>
          {/* 이미지 프리뷰 */}
          <div style={{ ...CARD, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 8 }}>
              <Image size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 원본 이미지
            </div>
            {photo?.dataUrl && <ImagePreview src={photo.dataUrl} onRemove={resetAll} />}
          </div>

          {/* 파싱된 문제 */}
          <div style={{ ...CARD }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>
                <ScanLine size={16} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--blue)' }} />
                변환된 문제
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditing(!editing)} style={btnSecondary}>
                  <Edit3 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {editing ? '완료' : '수정'}
                </button>
              </div>
            </div>

            {/* 과목 태그 */}
            <div style={{ marginBottom: 10 }}>
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: SUBJECT_MAP[editForm?.subjectType || parsed.subjectType]?.color || '#94a3b8',
                background: `${SUBJECT_MAP[editForm?.subjectType || parsed.subjectType]?.color}15` || 'rgba(255,255,255,0.05)',
                padding: '3px 10px', borderRadius: 6,
              }}>
                {SUBJECT_MAP[editForm?.subjectType || parsed.subjectType]?.icon}{' '}
                {SUBJECT_MAP[editForm?.subjectType || parsed.subjectType]?.name || '미분류'}
              </span>
            </div>

            {/* 수정 모드 vs 보기 모드 */}
            {editing && editForm ? (
              <div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>문제 번호</div>
                  <input value={editForm.questionNumber} onChange={e => setEditForm({ ...editForm, questionNumber: e.target.value })}
                    style={inputStyle} placeholder="예: 15" />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>문제 본문</div>
                  <textarea value={editForm.questionText} onChange={e => setEditForm({ ...editForm, questionText: e.target.value })}
                    style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>선택지</div>
                  {editForm.options.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 26, padding: '7px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, background: 'rgba(59,130,246,0.1)', borderRadius: 6, color: '#3b82f6' }}>{opt.label}</span>
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
                  <input value={editForm.answerKey} onChange={e => setEditForm({ ...editForm, answerKey: e.target.value })}
                    style={inputStyle} placeholder="예: ① 또는 1" />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>과목 수정</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {Object.entries(SUBJECT_MAP).map(([key, val]) => (
                      <button key={key} onClick={() => setEditForm({ ...editForm, subjectType: key })}
                        style={{
                          background: editForm.subjectType === key ? `${val.color}22` : 'transparent',
                          color: editForm.subjectType === key ? val.color : 'var(--t2)',
                          border: `1px solid ${editForm.subjectType === key ? val.color : 'var(--bd1)'}`,
                          borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        {val.icon} {val.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>메모 (선택)</div>
                  <input value={editForm.memo} onChange={e => setEditForm({ ...editForm, memo: e.target.value })}
                    style={inputStyle} placeholder="이 문제에서 틀린 이유를 기록하세요" />
                </div>
                <button onClick={handleSaveEdit} style={btnPrimary}>
                  <Check size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> 수정 완료
                </button>
              </div>
            ) : (
              <div>
                {/* 문제 번호 */}
                {parsed.questionNumber && (
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>
                    <HelpCircle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    문제 #{parsed.questionNumber}
                  </div>
                )}
                {/* 문제 텍스트 */}
                <div style={{
                  fontSize: 14, color: 'var(--t0)', lineHeight: 1.7,
                  padding: '12px 14px', background: 'rgba(255,255,255,0.03)',
                  borderRadius: 10, marginBottom: 10,
                }}>
                  {parsed.questionText}
                </div>
                {/* 선택지 */}
                {parsed.options.length >= 2 && (
                  <div style={{ marginBottom: 10 }}>
                    {parsed.options.map((opt, i) => <OptionBlock key={i} opt={opt} idx={i} />)}
                  </div>
                )}
                {/* 정답 */}
                {parsed.answerKey && (
                  <div style={{
                    padding: '8px 12px', background: 'rgba(16,185,129,0.08)',
                    borderRadius: 8, fontSize: 12, color: '#10b981', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Check size={14} /> 정답: {parsed.answerKey}
                  </div>
                )}
                {/* 신뢰도 */}
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 8 }}>
                  OCR 신뢰도: {parsed.confidence}% · 원문 {parsed.rawLength}자
                  {parsed.options.length < 2 && ' (선택지 미검출 — 수정 모드로 직접 입력 가능)'}
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            {!editing && (
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={handleSaveAsWrong} style={btnPrimary}>
                  <Save size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  틀린 문제로 저장
                </button>
                <button onClick={resetAll} style={btnSecondary}>
                  <RefreshCw size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  새로 찍기
                </button>
              </div>
            )}
          </div>

          {/* 원문 OCR 텍스트 */}
          <details style={{ ...CARD, padding: 14 }}>
            <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', cursor: 'pointer' }}>
              OCR 원문 보기
            </summary>
            <div style={{
              fontSize: 11, color: 'var(--t3)', lineHeight: 1.6,
              marginTop: 10, whiteSpace: 'pre-wrap', fontFamily: 'monospace',
              padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 8,
              maxHeight: 200, overflowY: 'auto',
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
  background: 'var(--bg3)', border: '1px solid var(--bd1)',
  borderRadius: 8, padding: '8px 10px',
  color: 'var(--t0)', fontSize: 13,
  fontFamily: 'inherit', width: '100%',
  outline: 'none',
};
