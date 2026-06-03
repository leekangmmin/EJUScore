import { useEffect, useMemo, useState } from 'react';
import { Scissors, KeyRound, CopyCheck, Check, X, Split, Merge } from 'lucide-react';
import { listExams, loadExam, getDuplicateGroups } from '../lib/dataAdapter';
import { getDecision, setDecision, reviewProgress } from '../lib/reviewStore';
import { PageHeader, ConfidenceBadge, EmptyState } from '../components/shared';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress, Skeleton } from '../ui/misc';
import { toast } from '../ui/toaster';
import { cn } from '../lib/utils';

export default function QuestionReview() {
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('split');

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
      .then(setExam)
      .catch((e) => toast.error(`불러오기 실패: ${e.message}`))
      .finally(() => setLoading(false));
  }, [examId]);

  return (
    <>
      <PageHeader title="문제 검수" description="문항 분리·정답·중복을 사람이 직접 확인합니다." />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="split" className="flex-1 gap-1.5"><Scissors className="h-4 w-4" />분리</TabsTrigger>
          <TabsTrigger value="answer" className="flex-1 gap-1.5"><KeyRound className="h-4 w-4" />정답</TabsTrigger>
          <TabsTrigger value="duplicate" className="flex-1 gap-1.5"><CopyCheck className="h-4 w-4" />중복</TabsTrigger>
        </TabsList>

        {(tab === 'split' || tab === 'answer') && (
          <div className="mt-4">
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-72"
            >
              {exams.map((m) => (
                <option key={m.examId} value={m.examId}>{m.year}년 {m.round}회 · 종합과목</option>
              ))}
            </select>
          </div>
        )}

        <TabsContent value="split">
          {loading ? <Skeleton className="h-64" /> : <SplitReview questions={exam?.questions || []} />}
        </TabsContent>
        <TabsContent value="answer">
          {loading ? <Skeleton className="h-64" /> : <AnswerReview questions={exam?.questions || []} />}
        </TabsContent>
        <TabsContent value="duplicate">
          <DuplicateReview />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ── 분리 검수 ──────────────────────────────────────────────
function SplitReview({ questions }) {
  const [, force] = useState(0);
  const ids = questions.map((q) => q.id);
  const prog = reviewProgress(ids, 'split');

  if (questions.length === 0) return <EmptyState icon={Split} title="문항이 없습니다" />;

  const mark = (id, value) => {
    setDecision(id, { split: value });
    force((n) => n + 1);
    toast.success(value === 'ok' ? '분리 정상' : '분리 오류 표시');
  };

  return (
    <div className="space-y-3">
      <ProgressLine label="분리 검수" prog={prog} />
      {questions.map((q) => {
        const d = getDecision(q.id);
        // heuristic flag: very long stem + many option fragments may indicate a bad split
        const suspicious = q.optionCount > 5 || (q.wordCount && q.wordCount > 120);
        return (
          <Card key={q.id}>
            <CardContent className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">문항 {q.number ?? '—'}</Badge>
                <Badge variant="secondary">선택지 {q.optionCount}</Badge>
                {q.wordCount != null && <Badge variant="muted">단어 {q.wordCount}</Badge>}
                {suspicious && <Badge variant="warning">분리 점검 권장</Badge>}
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant={d.split === 'ok' ? 'success' : 'outline'} onClick={() => mark(q.id, 'ok')}>
                    <Merge className="h-3.5 w-3.5" /> 정상
                  </Button>
                  <Button size="sm" variant={d.split === 'fix' ? 'destructive' : 'outline'} onClick={() => mark(q.id, 'fix')}>
                    <Scissors className="h-3.5 w-3.5" /> 오류
                  </Button>
                </div>
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{q.rawText}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── 정답 검수 ──────────────────────────────────────────────
function AnswerReview({ questions }) {
  const [, force] = useState(0);
  const withOptions = useMemo(() => questions.filter((q) => q.optionCount > 0), [questions]);
  const ids = withOptions.map((q) => q.id);
  const prog = reviewProgress(ids, 'answer');

  if (withOptions.length === 0) {
    return <EmptyState icon={KeyRound} title="선택지가 있는 문항이 없습니다" description="이 시험에는 정답키를 지정할 객관식 문항이 없습니다." />;
  }

  const setKey = (id, optionIndex) => {
    setDecision(id, { answer: 'ok', answerKey: optionIndex });
    force((n) => n + 1);
    toast.success(`정답 ${optionIndex + 1}번으로 확정`);
  };
  const flag = (id) => {
    setDecision(id, { answer: 'fix' });
    force((n) => n + 1);
    toast('정답 불명확으로 표시');
  };

  return (
    <div className="space-y-3">
      <ProgressLine label="정답 검수" prog={prog} />
      <p className="text-xs text-muted-foreground">
        ※ 원본 데이터에는 정답키가 없습니다. 검수자가 정답을 직접 지정합니다 (로컬 저장).
      </p>
      {withOptions.map((q) => {
        const d = getDecision(q.id);
        return (
          <Card key={q.id}>
            <CardContent className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">문항 {q.number ?? '—'}</Badge>
                <ConfidenceBadge value={q.ocrConfidence} />
                {d.answer === 'ok' && <Badge variant="success">정답 {d.answerKey != null ? d.answerKey + 1 : ''}번</Badge>}
                <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => flag(q.id)}>
                  <X className="h-3.5 w-3.5" /> 불명확
                </Button>
              </div>
              <p className="mb-2 line-clamp-2 text-[13px] text-muted-foreground">{q.rawText}</p>
              <div className="grid gap-1.5">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setKey(q.id, i)}
                    className={cn(
                      'flex items-start gap-2 rounded-md border px-3 py-2 text-left text-[13px] transition-colors',
                      d.answerKey === i
                        ? 'border-success bg-success/10 text-foreground'
                        : 'border-border bg-card hover:bg-accent'
                    )}
                  >
                    <span className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                      d.answerKey === i ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                    )}>
                      {d.answerKey === i ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="break-words">{opt}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── 중복 검수 ──────────────────────────────────────────────
function DuplicateReview() {
  const [groups, setGroups] = useState(null);
  const [, force] = useState(0);

  useEffect(() => { getDuplicateGroups().then(setGroups); }, []);

  if (!groups) return <Skeleton className="mt-4 h-64" />;
  if (groups.length === 0) {
    return <div className="mt-4"><EmptyState icon={CopyCheck} title="중복 의심 문항이 없습니다" description="정규화 텍스트 해시가 일치하는 문항이 발견되지 않았습니다." /></div>;
  }

  const mark = (id, value) => {
    setDecision(id, { duplicate: value });
    force((n) => n + 1);
    toast.success(value === 'duplicate' ? '중복으로 표시' : '고유 문항으로 표시');
  };

  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        정규화 텍스트가 동일한 문항을 묶었습니다. 실제 중복인지 검수자가 판단합니다. (총 {groups.length}개 그룹)
      </p>
      {groups.map((g) => (
        <Card key={g.hash}>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="warning">중복 의심 {g.items.length}건</Badge>
              <code className="truncate text-[11px] text-muted-foreground">#{g.hash.slice(0, 24)}</code>
            </div>
            <div className="space-y-2">
              {g.items.map((q) => {
                const d = getDecision(q.id);
                return (
                  <div key={q.id} className="flex items-start gap-2 rounded-md border border-border p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">{q.year}년 {q.round}회</Badge>
                        <Badge variant="outline">문항 {q.number ?? '—'}</Badge>
                        {d.duplicate === 'duplicate' && <Badge variant="destructive">중복</Badge>}
                        {d.duplicate === 'unique' && <Badge variant="success">고유</Badge>}
                      </div>
                      <p className="line-clamp-2 break-words text-[12px] text-muted-foreground">{q.rawText}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <Button size="sm" variant={d.duplicate === 'duplicate' ? 'destructive' : 'outline'} onClick={() => mark(q.id, 'duplicate')}>중복</Button>
                      <Button size="sm" variant={d.duplicate === 'unique' ? 'success' : 'outline'} onClick={() => mark(q.id, 'unique')}>고유</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProgressLine({ label, prog }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label} · 완료 {prog.ok + prog.fix} / {prog.total}</span>
        <span className="font-semibold tabular-nums text-foreground">{prog.pct}%</span>
      </div>
      <Progress value={prog.pct} />
    </div>
  );
}
