import { useEffect, useRef, useState } from 'react';
import { UploadCloud, FileText, FileJson, RefreshCw, ScanText, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { listExams } from '../lib/dataAdapter';
import { listJobs, enqueueJob, runJob, clearJobs } from '../lib/reviewStore';
import { PageHeader, EmptyState } from '../components/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/misc';
import { toast } from '../ui/toaster';
import { cn } from '../lib/utils';

async function sha256(file) {
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

const JOB_LABEL = {
  parse: 'JSON 파싱·적재', ocr_rerun: 'OCR 재실행', pdf_reupload: 'PDF 재업로드',
  embed: '벡터 재생성', export: '데이터셋 내보내기',
};

export default function Uploads() {
  const [files, setFiles] = useState([]);
  const [drag, setDrag] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [exams, setExams] = useState([]);
  const [rerunExam, setRerunExam] = useState('');
  const inputRef = useRef(null);

  const refresh = () => setJobs(listJobs());
  useEffect(() => { refresh(); listExams().then((l) => { setExams(l); setRerunExam(l[l.length - 1]?.examId || ''); }); }, []);

  const addFiles = async (fileList) => {
    const arr = Array.from(fileList);
    const enriched = await Promise.all(
      arr.map(async (f) => ({
        name: f.name,
        size: f.size,
        type: f.name.toLowerCase().endsWith('.pdf') ? 'pdf'
          : f.name.toLowerCase().endsWith('.zip') ? 'zip'
          : f.name.toLowerCase().endsWith('.json') ? 'json' : 'other',
        sha: await sha256(f),
      }))
    );
    setFiles((prev) => {
      const seen = new Set(prev.map((p) => p.sha));
      const deduped = enriched.filter((e) => !e.sha || !seen.has(e.sha));
      if (deduped.length < enriched.length) toast('중복 파일은 제외했습니다 (sha256 일치)');
      return [...prev, ...deduped];
    });
  };

  const startUpload = (file) => {
    const type = file.type === 'pdf' ? 'ocr_rerun' : 'parse';
    const job = enqueueJob(type, { filename: file.name, sha256: file.sha, bytes: file.size });
    refresh();
    toast.success(`${JOB_LABEL[type]} 작업을 큐에 등록했습니다`);
    runJob(job.id, { steps: 18, intervalMs: 110, onTick: refresh }).then(() => {
      refresh();
      toast.success(`${file.name} 처리 완료`);
    });
  };

  const startRerun = () => {
    if (!rerunExam) return;
    const meta = exams.find((e) => e.examId === rerunExam);
    const job = enqueueJob('ocr_rerun', { examId: rerunExam, label: `${meta.year}년 ${meta.round}회` });
    refresh();
    toast.success(`OCR 재실행 작업 등록: ${meta.year}년 ${meta.round}회`);
    runJob(job.id, { steps: 22, intervalMs: 120, onTick: refresh }).then(refresh);
  };

  return (
    <>
      <PageHeader
        title="업로드"
        description="PDF 재업로드 · 대량 업로드 · OCR 재실행. 파일은 로컬에서 검증되며 처리 작업은 큐로 관리됩니다."
      />

      {/* dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors',
          drag ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'
        )}
      >
        <UploadCloud className={cn('mb-3 h-9 w-9', drag ? 'text-primary' : 'text-muted-foreground')} />
        <div className="text-sm font-semibold">PDF · JSON · ZIP 파일을 끌어다 놓거나 클릭</div>
        <div className="mt-1 text-xs text-muted-foreground">대량 업로드 지원 · sha256으로 중복 자동 제외</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.json,.zip"
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* staged files */}
      {files.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>대기 파일 ({files.length})</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setFiles([])}><Trash2 className="h-4 w-4" />비우기</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                {f.type === 'pdf' ? <FileText className="h-5 w-5 text-destructive" />
                  : f.type === 'json' ? <FileJson className="h-5 w-5 text-primary" />
                  : <FileText className="h-5 w-5 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {(f.size / 1024).toFixed(1)} KB · {f.type.toUpperCase()}
                    {f.sha && <> · sha {f.sha.slice(0, 10)}…</>}
                  </div>
                </div>
                <Button size="sm" onClick={() => startUpload(f)}>
                  {f.type === 'pdf' ? <><ScanText className="h-3.5 w-3.5" />OCR 처리</> : <><UploadCloud className="h-3.5 w-3.5" />적재</>}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* OCR re-run on existing exam */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>기존 시험 OCR 재실행</CardTitle>
          <CardDescription>원본은 보존하고 새 버전으로 재처리합니다 (ARCHITECTURE_V2: 비파괴 재처리).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <select
            value={rerunExam}
            onChange={(e) => setRerunExam(e.target.value)}
            className="h-11 flex-1 rounded-md border border-input bg-card px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {exams.map((m) => <option key={m.examId} value={m.examId}>{m.year}년 {m.round}회 · 종합과목</option>)}
          </select>
          <Button onClick={startRerun}><RefreshCw className="h-4 w-4" />재실행</Button>
        </CardContent>
      </Card>

      {/* job queue */}
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>작업 큐</CardTitle>
            <CardDescription>parse · ocr_rerun · embed · export</CardDescription>
          </div>
          {jobs.length > 0 && <Button variant="ghost" size="sm" onClick={() => { clearJobs(); refresh(); }}>기록 삭제</Button>}
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <EmptyState icon={UploadCloud} title="등록된 작업이 없습니다" description="파일을 업로드하거나 OCR 재실행을 시작하세요." />
          ) : (
            <div className="space-y-2.5">
              {jobs.map((j) => (
                <div key={j.id} className="rounded-lg border border-border p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    {j.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-success" />
                      : <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    <span className="text-sm font-semibold">{JOB_LABEL[j.type] || j.type}</span>
                    <Badge variant={j.status === 'done' ? 'success' : 'default'} className="ml-auto">
                      {j.status === 'done' ? '완료' : `${j.progress}%`}
                    </Badge>
                  </div>
                  <div className="mb-1.5 truncate text-[11px] text-muted-foreground">
                    {j.payload.label || j.payload.filename || j.payload.examId || j.id}
                  </div>
                  <Progress value={j.progress} barClassName={j.status === 'done' ? 'bg-success' : 'bg-primary'} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
