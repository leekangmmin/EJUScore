import { useEffect, useState, useMemo } from 'react';
import { Boxes, Search, RefreshCw, Cpu, Database, Info } from 'lucide-react';
import { computeEmbedding, cosineSimilarity } from '../../vector/embeddingStore';
import { loadAll } from '../lib/dataAdapter';
import { enqueueJob, updateJob } from '../lib/reviewStore';
import { PageHeader, StatTile, EmptyState } from '../components/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress, Skeleton } from '../ui/misc';
import { Input } from '../ui/input';
import { toast } from '../ui/toaster';

// In-memory index built from the project's REAL embedding function.
let _index = null; // [{ id, vec, q }]

export default function Vector() {
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [index, setIndex] = useState(_index);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [corpusSize, setCorpusSize] = useState(null);

  useEffect(() => { loadAll().then(({ questions }) => setCorpusSize(questions.length)); }, []);

  const dim = useMemo(() => (index?.[0]?.vec?.length ?? computeEmbedding('샘플').length), [index]);

  const rebuild = async () => {
    setBuilding(true);
    setProgress(0);
    const job = enqueueJob('embed', { model: 'tf_bow', note: '벡터 재생성' });
    const { questions } = await loadAll();
    const idx = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const text = q.cleanedText || q.rawText;
      idx.push({ id: q.id, vec: computeEmbedding(text), q });
      if (i % 40 === 0 || i === questions.length - 1) {
        const pct = Math.round(((i + 1) / questions.length) * 100);
        setProgress(pct);
        updateJob(job.id, { progress: pct });
        // yield to keep UI responsive
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    _index = idx;
    setIndex(idx);
    updateJob(job.id, { status: 'done', progress: 100, finishedAt: Date.now() });
    setBuilding(false);
    toast.success(`${idx.length}개 문항 벡터 재생성 완료 (${dim}차원)`);
  };

  const runSearch = () => {
    if (!index) { toast('먼저 벡터를 생성하세요'); return; }
    if (!query.trim()) { setResults([]); return; }
    const qv = computeEmbedding(query);
    const scored = index
      .map((e) => ({ q: e.q, score: cosineSimilarity(qv, e.vec) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    setResults(scored);
    if (scored.length === 0) toast('일치하는 결과가 없습니다 (TF-BoW 사전 외 토큰)');
  };

  return (
    <>
      <PageHeader
        title="벡터"
        description="문항 임베딩을 재생성하고 의미 검색을 검증합니다."
        actions={<Button onClick={rebuild} disabled={building}><RefreshCw className={building ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />벡터 재생성</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="코퍼스" value={corpusSize == null ? '…' : corpusSize.toLocaleString()} sub="대상 문항" icon={Database} />
        <StatTile label="인덱싱됨" value={index ? index.length.toLocaleString() : '0'} sub="벡터 생성 완료" icon={Boxes} tone={index ? 'success' : 'default'} />
        <StatTile label="차원" value={dim} sub="현재 모델" icon={Cpu} />
        <StatTile label="모델" value="TF-BoW" sub="교체 예정" icon={Info} tone="warning" />
      </div>

      {building && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>벡터 재생성 중…</span><span className="font-semibold text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      <Card className="mt-4 border-warning/40 bg-warning/5">
        <CardContent className="flex gap-3 p-4">
          <Info className="h-5 w-5 shrink-0 text-warning-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            현재 임베딩은 프로젝트의 실제 <code className="font-mono">computeEmbedding()</code>(384차원 TF-BoW, 고정 EJU 사전)입니다.
            ARCHITECTURE_V2 계획대로 추후 실제 다국어 임베딩 모델(bge-m3 / multilingual-e5) + pgvector HNSW로 교체됩니다.
            이 화면은 그 전까지 검색 품질을 정성 검증하는 용도입니다. (허위 성능 수치 미표기)
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>의미 검색 테스트</CardTitle>
          <CardDescription>질의 텍스트를 임베딩해 코사인 유사도 상위 문항을 찾습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="예: 환율 인플레이션 무역 헌법 선거"
            />
            <Button onClick={runSearch}><Search className="h-4 w-4" />검색</Button>
          </div>

          {results.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={Search} title="검색 결과가 여기에 표시됩니다" description="벡터 생성 후 질의어를 입력하세요." />
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {results.map(({ q, score }) => (
                <div key={q.id} className="rounded-lg border border-border p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <Badge>{q.domainKo}{q.topic ? ` · ${q.topic}` : ''}</Badge>
                    <Badge variant="secondary">{q.year}년 {q.round}회</Badge>
                    <Badge variant="outline" className="ml-auto tabular-nums">유사도 {(score * 100).toFixed(1)}%</Badge>
                  </div>
                  <p className="line-clamp-2 break-words text-[13px] text-muted-foreground">{q.rawText}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
