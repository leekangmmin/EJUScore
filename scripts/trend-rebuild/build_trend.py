# -*- coding: utf-8 -*-
# Rebuild trend_analysis_complete.json from REAL OCR of 38 종합과목(文综) past exams.
# Uses shared corpus_metrics (single source of truth). See corpus_metrics.py / lexicon.py.
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import corpus_metrics as cm
from lexicon import TOPICS

OUT = os.path.join(os.path.dirname(__file__), '..', '..',
                   'public', 'dataset', 'trend-analysis', 'trend_analysis_complete.json')

data = cm.compute()
topic_yearly, domain_yearly = data['topic_yearly'], data['domain_yearly']

topic_objs = []
for t in TOPICS:
    m = cm.topic_metrics(topic_yearly[t])
    topic_objs.append({'topic': t, 'domain': cm.topic_domain[t], **m,
                       'total': m['total_count'],  # UI alias
                       'yearly': cm.yearly_full(topic_yearly[t])})
topic_objs.sort(key=lambda o: o['total_count'], reverse=True)

domain_trends = {}
for d in cm.DOMAINS:
    yd = domain_yearly[d]
    total = sum(yd.values())
    p5 = sum(yd.get(y, 0) for y in cm.LAST5_YEARS)
    before5 = total - p5
    recent_avg = p5 / cm.EXAMS_LAST5 if cm.EXAMS_LAST5 else 0
    before_avg = before5 / cm.EXAMS_BEFORE5 if cm.EXAMS_BEFORE5 else 0
    growth = round((recent_avg - before_avg) / before_avg * 100, 1) if before_avg > 0 else 0.0
    domain_trends[d] = {'total': total, 'yearly': cm.yearly_full(yd),
                        'recent_5yr_total': p5, 'before_5yr_total': before5,
                        'growth_rate_pct': growth, 'avg_per_year': round(total / len(cm.YEARS), 2)}


def strip_yearly(o):
    return {k: v for k, v in o.items() if k != 'yearly'}


growing = [strip_yearly(o) for o in topic_objs if o['growth_rate_pct'] >= 25 and o['period_5yr_count'] >= 3]
declining = [strip_yearly(o) for o in topic_objs if o['growth_rate_pct'] <= -25 and o['before_5yr_count'] >= 3]
stable = [strip_yearly(o) for o in topic_objs if -25 < o['growth_rate_pct'] < 25]
emerging = [strip_yearly(o) for o in topic_objs if o['first_appeared_year'] and o['first_appeared_year'] >= cm.Y1 - 6]
disappearing = [strip_yearly(o) for o in topic_objs if o['last_appeared_year'] and o['last_appeared_year'] <= cm.Y1 - 7]
high_consec = [strip_yearly(o) for o in topic_objs if o['consecutive_appearances'] >= 10]
gap_topics = sorted([strip_yearly(o) for o in topic_objs if o['gap_years'] >= 4],
                    key=lambda o: o['gap_years'], reverse=True)

out = {
    'generated_at': '2026-06-06', 'subject': 'comprehensive',
    'analysis_period': f'{cm.Y0}-{cm.Y1}', 'total_years': len(cm.YEARS),
    'total_questions_analyzed': cm.N_EXAMS * cm.Q_PER_EXAM,
    'total_topics_tracked': len(TOPICS), 'untopicized_count': 0,
    'source_note': (
        f'{cm.Y0}~{cm.Y1} 종합과목(文综) 실제 기출 {cm.N_EXAMS}회분을 직접 OCR한 본문에서 영역·토픽별 '
        f'핵심 일본어 용어의 출현 빈도를 집계하고, 각 회차 표준 {cm.Q_PER_EXAM}문항을 그 빈도 비율로 '
        f'배분하여 산출한 추정치입니다. 공식 정답표 기반 문항 라벨이 아니라 본문 용어 빈도 기반 '
        f'추정이므로 절대 수치보다 영역 간 비중·연도별 추세 파악에 활용하세요.'),
    'domain_trends': domain_trends,
    'topic_trends': {o['topic']: {**strip_yearly(o), 'yearly': o['yearly']} for o in topic_objs},
    'top_100_topics': [strip_yearly(o) for o in topic_objs],
    'growing_topics': growing, 'declining_topics': declining, 'stable_topics': stable,
    'emerging_topics': emerging, 'disappearing_topics': disappearing,
    'high_consecutive_topics': high_consec, 'gap_topics': gap_topics,
    'statistics': {'total_domains': len(cm.DOMAINS), 'total_topics': len(TOPICS),
                   'untopicized_count': 0, 'growing_count': len(growing),
                   'declining_count': len(declining), 'gap_count': len(gap_topics)},
    'year_range': {'start': cm.Y0, 'end': cm.Y1},
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=2)
print('WROTE', os.path.relpath(OUT), '| questions', out['total_questions_analyzed'],
      '| domains', {d: domain_trends[d]['total'] for d in cm.DOMAINS})
