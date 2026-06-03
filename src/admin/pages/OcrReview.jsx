import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Check, X, ChevronLeft, ChevronRight, Table2, ImageIcon, Hash, AlignLeft, Keyboard, ScanText,
} from 'lucide-react';
import { listExams, loadExam } from '../lib/dataAdapter';
import { getDecision, setDecision, reviewProgress } from '../lib/reviewStore';
import { PageHeader, ConfidenceBadge, EmptyState } from '../components/shared';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress, Skeleton } from '../ui/misc';
import { toast } from '../ui/toaster';
import { cn } from '../lib/utils';

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'pending', label: '미검수' },
  { id: 'lowconf', label: '저신뢰' },
  { id: 'noisy', label: '노이즈' },
];

export default function OcrReview() {
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [idx, setIdx] = useState(0);
  const [tick, setTick] = useState(0); // re-read decisions after writes

  useEffect(() => {
    listExams().then((list) => {
      setExams(list);
      setExamId((cur) => cur || list[list.length - 1]?.examId || '');
    });
  }, []);

  useEffect(() => {
    if (!examId) return;
    setLoading(true);
    loadExam(examId)
      .then((e) => { setExam(e); setIdx(0); })
      .catch((err) => toast.error(`불러오기 실패: ${err.message}`))
      .finally(() => setLoading(false));
  }, [examId]);

  const questions = exam?.questions || [];

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      const d = getDecision(q.id);
      if (filter === 'pending') return d.ocr === 'pending';
      if (filter === 'lowconf') return q.ocrConfidence != null && q.ocrConfidence < 0.6;
      if (filter === 'noisy') return q.quality < 0.55;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, filter, tick]);

  const safeIdx = Math.min(idx, Math.max(0, filtered.length - 1));
  const q = filtered[safeIdx];
  const progress = useMemo(
    () => reviewProgress(questions.map((x) => x.id), 'ocr'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, tick]
  );

  const advance = useCallback(() => {
    setIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const decide = useCallback((value) => {
    if (!q) return;
    setDecision(q.id, { ocr: value });
    setTick((t) => t + 1);
    toast.success(value === 'ok' ? 'OCR 양호로 표시' : '수정 필요로 표시');
    // auto-advance within current filter view
    setTimeout(() => {
      if (filter === 'pending') setIdx((i) => Math.min(i, Math.max(0, filtered.length - 2)));
      else advance();
    }, 0);
  }, [q, filter, filtered.length, advance]);

  // keyboard shortcuts for fast review
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'o' || e.key === 'O') decide('ok');
      else if (e.key === 'f' || e.key === 'F') decide('fix');
      else if (e.key === 'ArrowRight') setIdx((i) => Math.min(i + 1, filtered.length - 1));
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide, filtered.length]);

  return (
    <>
      <PageHeader
        title="OCR 검수"
        description="실제 OCR 인식 결과를 빠르게 확인하고 양호/수정필요로 분류합니다."
        actions={
          <div className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex">
            <Keyboard className="h-3.5 w-3.5" />
            <kbd className="font-semibold text-foreground">O</kbd> 양호
            <kbd className="ml-1 font-semibold text-foreground">F</kbd> 수정
            <kbd className="ml-1 font-semibold text-foreground">← →</kbd> 이동
          </div>
        }
      />

      {/* controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <select
          value={examId}
          onChange={(e) => setExamId(e.target.value)}
          className="h-11 rounded-md border border-input bg-card px-3 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {exams.map((m) => (
            <option key={m.examId} value={m.examId}>
              {m.year}년 {m.round}회 · 종합과목
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); setIdx(0); }}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                filter === f.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* progress */}
      {exam && (
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>검수 진행 · 양호 {progress.ok} / 수정 {progress.fix} / 미검수 {progress.pending}</span>
            <span className="font-semibold tabular-nums text-foreground">{progress.pct}%</span>
          </div>
          <Progress value={progress.pct} />
        </div>
      )}

      {loading ? (
        <Skeleton className="h-80" />
      ) : !q ? (
        <EmptyState
          icon={ScanText}
          title={filter === 'pending' ? '미검수 문항이 없습니다' : '표시할 문항이 없습니다'}
          description="필터를 바꾸거나 다른 시험을 선택하세요."
        />
      ) : (
        <QuestionCard
          q={q}
          index={safeIdx}
          total={filtered.length}
          decision={getDecision(q.id)}
          onPrev={() => setIdx((i) => Math.max(i - 1, 0))}
          onNext={() => setIdx((i) => Math.min(i + 1, filtered.length - 1))}
          onDecide={decide}
          onNote={(note) => { setDecision(q.id, { note }); setTick((t) => t + 1); }}
        />
      )}
    </>
  );
}

function QuestionCard({ q, index, total, decision, onPrev, onNext, onDecide, onNote }) {
  return (
    <Card className="animate-admin-in">
      <CardContent className="p-0">
        {/* meta header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <Badge variant="outline" className="gap-1"><Hash className="h-3 w-3" />문항 {q.number ?? '—'}</Badge>
          <Badge variant="secondary">{q.year}년 {q.round}회</Badge>
          <Badge>{q.domainKo}{q.topic ? ` · ${q.topic}` : ''}</Badge>
          <Badge variant="muted">{q.questionTypeKo}</Badge>
          <ConfidenceBadge value={q.ocrConfidence} />
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{index + 1} / {total}</span>
        </div>

        {/* raw OCR text */}
        <div className="p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <AlignLeft className="h-3.5 w-3.5" /> OCR 원문 (raw_text)
          </div>
          <div className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/60 p-3.5 font-mono text-[13px] leading-relaxed">
            {q.rawText || <span className="text-muted-foreground">(빈 텍스트)</span>}
          </div>

          {q.options.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">선택지 ({q.options.length})</div>
              <ul className="space-y-1">
                {q.options.map((opt, i) => (
                  <li key={i} className="rounded-md bg-card px-3 py-1.5 text-[13px] ring-1 ring-border">{opt}</li>
                ))}
              </ul>
            </div>
          )}

          {/* signal chips */}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {q.wordCount != null && <span className="rounded-md bg-muted px-2 py-1">단어 {q.wordCount}</span>}
            {q.lines != null && <span className="rounded-md bg-muted px-2 py-1">줄 {q.lines}</span>}
            <span className="rounded-md bg-muted px-2 py-1">의미글자 {Math.round(q.quality * 100)}%</span>
            {q.hasTable && <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1"><Table2 className="h-3 w-3" />표</span>}
            {(q.hasDiagram || q.hasGraph || q.hasMap) && <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1"><ImageIcon className="h-3 w-3" />도표</span>}
          </div>

          {/* note */}
          <input
            defaultValue={decision.note}
            onBlur={(e) => onNote(e.target.value)}
            placeholder="검수 메모 (선택)"
            className="mt-3 h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* actions */}
        <div className="flex items-center gap-2 border-t border-border p-4">
          <Button variant="outline" size="icon" onClick={onPrev} aria-label="이전"><ChevronLeft className="h-4 w-4" /></Button>
          <Button
            variant={decision.ocr === 'ok' ? 'success' : 'outline'}
            className="flex-1"
            onClick={() => onDecide('ok')}
          >
            <Check className="h-4 w-4" /> 양호 <kbd className="ml-1 opacity-60">O</kbd>
          </Button>
          <Button
            variant={decision.ocr === 'fix' ? 'destructive' : 'outline'}
            className="flex-1"
            onClick={() => onDecide('fix')}
          >
            <X className="h-4 w-4" /> 수정 필요 <kbd className="ml-1 opacity-60">F</kbd>
          </Button>
          <Button variant="outline" size="icon" onClick={onNext} aria-label="다음"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
