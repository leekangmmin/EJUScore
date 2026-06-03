import { useEffect, useState } from 'react';
import {
  FileStack, ScanText, AlertTriangle, CopyCheck, Layers, TriangleAlert, Image, Activity,
} from 'lucide-react';
import { getCorpusStats } from '../lib/dataAdapter';
import { getAllDecisions } from '../lib/reviewStore';
import { PageHeader, StatTile, BarRow } from '../components/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Skeleton } from '../ui/misc';
import { Badge } from '../ui/badge';

function reviewedCount(decisions, field) {
  return Object.values(decisions).filter((d) => {
    const v = d[field];
    return v && v !== 'pending';
  }).length;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    let alive = true;
    getCorpusStats().then((s) => { if (alive) setStats(s); });
    setDecisions(getAllDecisions());
    return () => { alive = false; };
  }, []);

  if (!stats) {
    return (
      <>
        <PageHeader title="대시보드" description="실제 로컬 OCR 코퍼스 검수 현황" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="mt-4 h-64" />
      </>
    );
  }

  const domainTotal = Object.values(stats.byDomain).reduce((a, b) => a + b, 0);
  const typeTotal = Object.values(stats.byType).reduce((a, b) => a + b, 0);
  const ocrReviewed = reviewedCount(decisions, 'ocr');
  const dupReviewed = reviewedCount(decisions, 'duplicate');

  return (
    <>
      <PageHeader
        title="대시보드"
        description={`실데이터 · 종합과목 ${stats.yearRange.start}–${stats.yearRange.end} · ${stats.totalExams}개 시험`}
        actions={<Badge variant="outline">source: local dataset</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="총 문항" value={stats.totalQuestions.toLocaleString()} sub={`${stats.totalExams}개 시험 문서`} icon={FileStack} tone="primary" />
        <StatTile label="평균 OCR 신뢰도" value={`${Math.round(stats.avgConfidence * 100)}%`} sub="문항 평균" icon={ScanText} />
        <StatTile label="저신뢰 문항" value={stats.lowConf.toLocaleString()} sub="신뢰도 < 60%" icon={AlertTriangle} tone="warning" />
        <StatTile label="중복 의심" value={stats.duplicateCount.toLocaleString()} sub={`${stats.duplicateGroups}개 그룹`} icon={CopyCheck} tone="danger" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="노이즈 텍스트" value={stats.noisy.toLocaleString()} sub="의미 글자 비율 낮음" icon={TriangleAlert} tone="warning" />
        <StatTile label="영역 미분류" value={stats.missingDomain.toLocaleString()} sub="domain=unknown" icon={Layers} />
        <StatTile label="자료 포함" value={stats.withDiagram.toLocaleString()} sub="표·도표·그래프·지도" icon={Image} />
        <StatTile label="OCR 검수 완료" value={ocrReviewed.toLocaleString()} sub={`중복검수 ${dupReviewed}`} icon={Activity} tone="success" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>영역별 분포</CardTitle>
            <CardDescription>실제 분류된 문항 기준 (미분류 포함)</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.entries(stats.byDomain)
              .sort((a, b) => b[1] - a[1])
              .map(([label, value]) => (
                <BarRow key={label} label={label} value={value} total={domainTotal} />
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>문제 유형 분포</CardTitle>
            <CardDescription>OCR 파이프라인 자동 분류 결과</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.entries(stats.byType)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([label, value]) => (
                <BarRow key={label} label={label} value={value} total={typeTotal} tone="bg-primary/70" />
              ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>연도별 문항 수</CardTitle>
          <CardDescription>검수 대상 코퍼스 구성</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1.5 overflow-x-auto pb-2">
            {Object.entries(stats.byYear)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([year, value]) => {
                const max = Math.max(...Object.values(stats.byYear));
                return (
                  <div key={year} className="flex min-w-[34px] flex-col items-center gap-1">
                    <div className="text-[10px] font-semibold tabular-nums text-muted-foreground">{value}</div>
                    <div
                      className="w-5 rounded-t bg-primary"
                      style={{ height: `${Math.max(6, (value / max) * 120)}px` }}
                    />
                    <div className="text-[10px] text-muted-foreground">{String(year).slice(2)}</div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
