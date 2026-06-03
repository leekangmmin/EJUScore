import { useEffect, useMemo, useState } from 'react';
import { Database, Download, FlaskConical, SlidersHorizontal, GitBranch } from 'lucide-react';
import { loadAll } from '../lib/dataAdapter';
import { getAllDecisions, enqueueJob, updateJob } from '../lib/reviewStore';
import { PageHeader, StatTile } from '../components/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Skeleton } from '../ui/misc';
import { toast } from '../ui/toaster';

const PURPOSES = [
  { id: 'type_classifier', label: '문제 유형 분류', labelField: 'questionType' },
  { id: 'difficulty', label: 'EJU 난이도 추정', labelField: 'difficulty' },
  { id: 'domain', label: '영역 분류', labelField: 'domain' },
];

// deterministic split by exam (year,round) → no question-level leakage
function splitOf(examKey) {
  let h = 0;
  for (let i = 0; i < examKey.length; i++) h = (h * 31 + examKey.charCodeAt(i)) >>> 0;
  const r = (h % 100) / 100;
  if (r < 0.7) return 'train';
  if (r < 0.85) return 'val';
  return 'test';
}

export default function Datasets() {
  const [data, setData] = useState(null);
  const [minConf, setMinConf] = useState(0.6);
  const [excludeNoisy, setExcludeNoisy] = useState(true);
  const [onlyOcrOk, setOnlyOcrOk] = useState(false);
  const [purpose, setPurpose] = useState('type_classifier');

  useEffect(() => { loadAll().then(setData); }, []);

  const decisions = getAllDecisions();
  const purposeDef = PURPOSES.find((p) => p.id === purpose);

  const eligible = useMemo(() => {
    if (!data) return [];
    return data.questions.filter((q) => {
      if (q.ocrConfidence != null && q.ocrConfidence < minConf) return false;
      if (excludeNoisy && q.quality < 0.55) return false;
      if (onlyOcrOk && (decisions[q.id]?.ocr !== 'ok')) return false;
      const label = q[purposeDef.labelField];
      if (label == null || label === '' || label === 'unknown') return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, minConf, excludeNoisy, onlyOcrOk, purpose]);

  const splitCounts = useMemo(() => {
    const c = { train: 0, val: 0, test: 0 };
    for (const q of eligible) c[splitOf(`${q.year}_${q.round}`)] += 1;
    return c;
  }, [eligible]);

  const exportJsonl = () => {
    if (eligible.length === 0) { toast('내보낼 문항이 없습니다'); return; }
    const job = enqueueJob('export', { purpose, rows: eligible.length });
    const lines = eligible.map((q) => {
      const d = decisions[q.id] || {};
      return JSON.stringify({
        id: q.id,
        split: splitOf(`${q.year}_${q.round}`),
        text: q.cleanedText || q.rawText,
        features: {
          year: q.year, round: q.round, subject: q.subject,
          domain: q.domain, topic: q.topic,
          option_count: q.optionCount, word_count: q.wordCount,
          ocr_confidence: q.ocrConfidence,
        },
        label: { value: q[purposeDef.labelField], source: d.ocr === 'ok' ? 'verified' : 'auto' },
      });
    });
    const blob = new Blob([lines.join('\n')], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eju_${purpose}_${new Date().toISOString().slice(0, 10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    updateJob(job.id, { status: 'done', progress: 100, finishedAt: Date.now() });
    toast.success(`${eligible.length}행 JSONL 내보내기 완료`);
  };

  if (!data) {
    return (<><PageHeader title="데이터셋" description="AI 학습용 데이터셋 생성" /><Skeleton className="h-64" /></>);
  }

  return (
    <>
      <PageHeader
        title="데이터셋"
        description="검수된 실데이터로 학습셋을 만들고 JSONL로 내보냅니다. (시험 단위 분할로 누수 방지)"
        actions={<Button onClick={exportJsonl}><Download className="h-4 w-4" />JSONL 내보내기</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="적격 문항" value={eligible.length.toLocaleString()} sub={`전체 ${data.questions.length}`} icon={Database} tone="primary" />
        <StatTile label="train" value={splitCounts.train.toLocaleString()} sub="70%" icon={GitBranch} />
        <StatTile label="val" value={splitCounts.val.toLocaleString()} sub="15%" icon={GitBranch} />
        <StatTile label="test" value={splitCounts.test.toLocaleString()} sub="15%" icon={GitBranch} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4" />학습 목적</CardTitle>
          <CardDescription>라벨로 사용할 필드를 선택합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PURPOSES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPurpose(p.id)}
                className={
                  'rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ' +
                  (purpose === p.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent')
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />품질 게이트</CardTitle>
          <CardDescription>스냅샷 필터 조건 (ARCHITECTURE_V2 §5: 재현 가능한 filter)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">최소 OCR 신뢰도</span>
              <Badge variant="outline" className="tabular-nums">{Math.round(minConf * 100)}%</Badge>
            </div>
            <input
              type="range" min="0" max="1" step="0.05" value={minConf}
              onChange={(e) => setMinConf(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
          </div>
          <Row label="노이즈 텍스트 제외" desc="의미 글자 비율 55% 미만 제거" checked={excludeNoisy} onChange={setExcludeNoisy} />
          <Row label="OCR 검수 완료만" desc="사람이 '양호'로 표시한 문항만 포함" checked={onlyOcrOk} onChange={setOnlyOcrOk} />
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        라벨 출처(source)는 검수 완료 문항은 <code className="font-mono">verified</code>, 그 외는 <code className="font-mono">auto</code>로 기록됩니다.
      </p>
    </>
  );
}

function Row({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
