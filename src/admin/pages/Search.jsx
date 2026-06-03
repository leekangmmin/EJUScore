import { useEffect, useMemo, useRef, useState } from 'react';
import { Search as SearchIcon, Sparkles, Calendar, Lightbulb, Gauge, User, Info, Loader2 } from 'lucide-react';
import { SUBJECTS, loadSubject } from '../lib/searchData';
import { buildIndex, search as runSearch, buildCoTopicMap, relatedConcepts, difficultyLabel } from '../lib/searchEngine';
import { getPersonalAccuracyMap } from '../lib/personalAccuracy';
import { loadEmbedder, embedQuery, embedPassages, cosine, EMBED_MODEL } from '../lib/embeddings';
import { PageHeader, EmptyState } from '../components/shared';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Progress, Skeleton } from '../ui/misc';
import { toast } from '../ui/toaster';
import { cn } from '../lib/utils';

const EXAMPLES = {
  comprehensive: ['국제연합 헌장 초안 회의', '브레튼우즈 체제', '냉전 데탕트', '지구온난화 파리협정'],
  mathematics: ['행렬 문제', '벡터 내적', '삼각함수 가법정리', '확률 기댓값'],
  japanese: ['읽기 어휘', '청해'],
};

// per-subject caches (module scope → survive tab switches)
const _idxCache = new Map();   // subject → { questions, index, coTopics, years }
const _vecCache = new Map();   // subject → Float32Array[]

export default function Search() {
  const [subject, setSubject] = useState('comprehensive');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState(null);     // current subject bundle
  const [result, setResult] = useState(null);   // last search result
  const [personal, setPersonal] = useState(new Map());
  const [useModel, setUseModel] = useState(false);
  const [modelStatus, setModelStatus] = useState(null); // {status, progress}
  const inputRef = useRef(null);

  useEffect(() => { getPersonalAccuracyMap().then(setPersonal); }, []);

  // load + index the active subject
  useEffect(() => {
    let alive = true;
    setResult(null);
    if (_idxCache.has(subject)) { setState(_idxCache.get(subject)); return; }
    setLoading(true);
    loadSubject(subject).then((questions) => {
      if (!alive) return;
      const index = buildIndex(questions);
      const coTopics = buildCoTopicMap(questions);
      const bundle = { questions, index, coTopics };
      _idxCache.set(subject, bundle);
      setState(bundle);
      setLoading(false);
    }).catch((e) => { setLoading(false); toast.error(e.message); });
    return () => { alive = false; };
  }, [subject]);

  const doSearch = async (qStr) => {
    const q = (qStr ?? query).trim();
    if (!q) return;
    if (!state || state.questions.length === 0) {
      setResult({ results: [], concepts: [], empty: true });
      return;
    }

    let vectorScores = null;
    if (useModel) {
      try {
        let vecs = _vecCache.get(subject);
        if (!vecs) {
          setModelStatus({ status: 'embedding', progress: 0 });
          await loadEmbedder((s) => setModelStatus(s));
          vecs = await embedPassages(
            state.questions.map((d) => d.text),
            (p) => setModelStatus({ status: 'embedding', progress: p })
          );
          _vecCache.set(subject, vecs);
        }
        setModelStatus({ status: 'querying' });
        const qv = await embedQuery(q);
        vectorScores = vecs.map((v) => Math.max(0, cosine(qv, v)));
        setModelStatus({ status: 'ready' });
      } catch (e) {
        toast.error(`모델 로드 실패 — 렉시컬 검색으로 진행: ${e.message}`);
        setModelStatus(null);
        vectorScores = null;
      }
    }

    const r = runSearch(state.index, q, { topK: 15, vectorScores });
    setResult({ ...r, query: q });
  };

  // query-level facets (출제년도 distribution + aggregate concepts)
  const facets = useMemo(() => {
    if (!result?.results?.length) return null;
    const yearCount = {};
    const conceptCount = {};
    for (const r of result.results) {
      yearCount[r.q.year] = (yearCount[r.q.year] || 0) + 1;
      if (r.q.topic) conceptCount[r.q.topic] = (conceptCount[r.q.topic] || 0) + 1;
    }
    return {
      years: Object.entries(yearCount).sort((a, b) => Number(a[0]) - Number(b[0])),
      topics: Object.entries(conceptCount).sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }, [result]);

  return (
    <>
      <PageHeader
        title="자연어 검색"
        description="EJU 종합·수학 기출을 자연어로 검색합니다. 관련 문제 · 출제년도 · 정답률 · 관련 개념을 함께 제공합니다."
        actions={
          <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            의미검색 강화
            <Switch checked={useModel} onCheckedChange={setUseModel} />
          </label>
        }
      />

      {/* subject tabs */}
      <div className="mb-4 flex gap-1.5">
        {SUBJECTS.map((s) => (
          <button
            key={s.id}
            onClick={() => { setSubject(s.id); setQuery(''); }}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              subject === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* search box */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="예: 브레튼우즈 체제 / 벡터 내적"
            className="h-12 w-full rounded-lg border border-input bg-card pl-10 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button size="lg" onClick={() => doSearch()}>검색</Button>
      </div>

      {/* example chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(EXAMPLES[subject] || []).map((ex) => (
          <button
            key={ex}
            onClick={() => { setQuery(ex); doSearch(ex); }}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* model status */}
      {useModel && modelStatus && modelStatus.status !== 'ready' && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            {modelStatus.status === 'downloading' ? `모델 다운로드 중 (${EMBED_MODEL})` :
             modelStatus.status === 'embedding' ? '문항 임베딩 생성 중' : '질의 임베딩 중'}
            {modelStatus.progress != null && <span className="ml-auto tabular-nums">{modelStatus.progress}%</span>}
          </div>
          {modelStatus.progress != null && <Progress value={modelStatus.progress} />}
        </div>
      )}

      {/* japanese: no corpus */}
      {subject === 'japanese' && (
        <Card className="mt-5 border-warning/40 bg-warning/5">
          <CardContent className="flex gap-3 p-4">
            <Info className="h-5 w-5 shrink-0 text-warning-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              EJU 일본어는 현재 <b>문제 코퍼스가 없습니다</b>(저장소에 일본어 기출 문항 데이터 미존재). 검색 파이프라인은
              준비되어 있어, 일본어 OCR 데이터가 적재되면 <code className="font-mono">search_manifest.json</code> 에 자동 연결됩니다.
              실제 없는 데이터를 지어내지 않습니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* results */}
      <div className="mt-5">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : !result ? (
          subject !== 'japanese' && (
            <EmptyState icon={SearchIcon} title="검색어를 입력하세요" description={`${SUBJECTS.find((s) => s.id === subject)?.label} 기출에서 관련 문제·출제년도·관련 개념을 찾습니다.`} />
          )
        ) : result.results.length === 0 ? (
          <EmptyState
            icon={SearchIcon}
            title={result.concepts?.length ? `'${result.concepts.map((c) => c.label).join(', ')}' 개념은 인식했으나 해당 문제가 없습니다` : '일치하는 문제가 없습니다'}
            description={
              result.empty
                ? '이 과목은 검색 가능한 코퍼스가 없습니다.'
                : result.concepts?.length
                  ? '질의 개념은 한↔일 브릿지로 인식했지만, 이 과목 기출 코퍼스에 해당 문항이 존재하지 않습니다 (예: EJU 수학은 교육과정상 행렬 미출제). 허위 결과를 만들지 않습니다.'
                  : '다른 표현으로 검색하거나 의미검색 강화를 켜보세요.'
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <div className="text-xs text-muted-foreground">
                {result.results.length}개 결과
                {result.concepts.length > 0 && <> · 브릿지 개념: {result.concepts.map((c) => c.label).join(', ')}</>}
              </div>
              {result.results.map((r) => (
                <ResultCard
                  key={r.q.id}
                  r={r}
                  concepts={relatedConcepts(r.q, result.concepts, state.coTopics)}
                  personal={personal.get(r.q.topic)}
                />
              ))}
            </div>
            {facets && <FacetPanel facets={facets} />}
          </div>
        )}
      </div>
    </>
  );
}

function ResultCard({ r, concepts, personal }) {
  const { q } = r;
  const diff = difficultyLabel(q.difficulty);
  return (
    <Card className="animate-admin-in">
      <CardContent className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary"><Calendar className="mr-1 h-3 w-3" />{q.year}년 {q.round}회</Badge>
          {q.number != null && <Badge variant="outline">문항 {q.number}</Badge>}
          <Badge>{q.domainKo}{q.topic ? ` · ${q.topic}` : ''}</Badge>
          <Badge variant="muted" className="ml-auto tabular-nums">관련도 {(r.score * 100).toFixed(0)}%</Badge>
        </div>

        <p className="mb-3 line-clamp-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed">{q.text}</p>

        {/* accuracy / difficulty (honest: official 정답률 unavailable) */}
        <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
          {diff && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" /> 추정 난이도
              <b className="text-foreground">{diff.value}/{diff.max}</b>
              <span className="text-muted-foreground">({diff.label})</span>
            </span>
          )}
          {personal ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <User className="h-3.5 w-3.5" /> 내 정답률
              <b className="text-foreground">{Math.round((personal.accuracy || 0) * 100)}%</b>
              <span className="text-muted-foreground">({personal.attemptCount}회 응시)</span>
            </span>
          ) : (
            <span className="text-muted-foreground/70">내 정답률 데이터 없음 · 공식 정답률 미제공</span>
          )}
        </div>

        {/* related concepts */}
        {concepts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
            {concepts.map((c) => (
              <span key={c} className="rounded-md bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary">{c}</span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FacetPanel({ facets }) {
  const maxY = Math.max(...facets.years.map(([, n]) => n), 1);
  return (
    <div className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Calendar className="h-4 w-4" />출제년도 분포</div>
          <div className="space-y-1">
            {facets.years.map(([y, n]) => (
              <div key={y} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-xs text-muted-foreground">{y}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(n / maxY) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-xs font-semibold tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Lightbulb className="h-4 w-4" />관련 개념</div>
          <div className="flex flex-wrap gap-1.5">
            {facets.topics.map(([t, n]) => (
              <span key={t} className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">{t} <b className="text-foreground">{n}</b></span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
