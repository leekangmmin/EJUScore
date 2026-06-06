# -*- coding: utf-8 -*-
# Shared metric computation from the real OCR corpus of 38 종합과목 past exams.
# Single source of truth so trend / insights / prediction stay consistent.
import json, os
from collections import defaultdict
import sys
sys.path.insert(0, os.path.dirname(__file__))
from lexicon import TOPICS, DOMAIN_KO

CORPUS = '/tmp/eju_comp_ocr.json'
Q_PER_EXAM = 38
DOMAINS = ['economy', 'politics', 'history', 'geography', 'society']

_corpus = json.load(open(CORPUS))
_corpus.sort(key=lambda r: (r['year'], r['round']))
YEARS = sorted({r['year'] for r in _corpus})
Y0, Y1 = YEARS[0], YEARS[-1]
N_EXAMS = len(_corpus)

topic_domain = {t: d for t, (d, _) in TOPICS.items()}
topics_by_domain = defaultdict(list)
for t, (d, _) in TOPICS.items():
    topics_by_domain[d].append(t)

EXAMS_IN_YEAR = defaultdict(int)
for r in _corpus:
    EXAMS_IN_YEAR[r['year']] += 1
LAST5_YEARS = [Y1 - i for i in range(5)]
EXAMS_LAST5 = sum(EXAMS_IN_YEAR[y] for y in LAST5_YEARS)
EXAMS_BEFORE5 = N_EXAMS - EXAMS_LAST5


def largest_remainder(weights, total):
    s = sum(weights.values())
    if s <= 0 or total <= 0:
        return {k: 0 for k in weights}
    raw = {k: total * w / s for k, w in weights.items()}
    floor = {k: int(v) for k, v in raw.items()}
    rem = total - sum(floor.values())
    order = sorted(weights, key=lambda k: (raw[k] - floor[k]), reverse=True)
    for i in range(rem):
        floor[order[i % len(order)]] += 1
    return floor


def _per_exam_keyword_hits():
    """Return (topic_keyword_counts_total, per_topic_keyword_breakdown)."""
    kw_total = defaultdict(int)
    for ex in _corpus:
        text = ex['text']
        for t, (d, kws) in TOPICS.items():
            for k in kws:
                c = text.count(k)
                if c:
                    kw_total[(t, k)] += c
    return kw_total


def compute():
    """Return dict with topic_yearly, domain_yearly, per-exam appear matrices, key_concepts."""
    topic_yearly = {t: defaultdict(int) for t in TOPICS}
    domain_yearly = {d: defaultdict(int) for d in DOMAINS}
    # per-exam appearance (allocated questions>0) for markov/bayes
    topic_exam_series = {t: [] for t in TOPICS}   # list over exams (chronological) of allocated q
    exam_years = []

    for ex in _corpus:
        text = ex['text']
        y = ex['year']
        exam_years.append(y)
        topic_occ = {t: sum(text.count(k) for k in kws) for t, (d, kws) in TOPICS.items()}
        domain_occ = {d: sum(topic_occ[t] for t in topics_by_domain[d]) for d in DOMAINS}
        dom_q = largest_remainder(domain_occ, Q_PER_EXAM)
        per_topic_q = {t: 0 for t in TOPICS}
        for d in DOMAINS:
            w = {t: topic_occ[t] for t in topics_by_domain[d]}
            alloc = largest_remainder(w, dom_q[d])
            for t, q in alloc.items():
                per_topic_q[t] = q
                topic_yearly[t][y] += q
            domain_yearly[d][y] += dom_q[d]
        for t in TOPICS:
            topic_exam_series[t].append(per_topic_q[t])

    # key_concepts: top Japanese keywords by real corpus frequency, per topic
    kw_total = _per_exam_keyword_hits()
    key_concepts = {}
    for t, (d, kws) in TOPICS.items():
        ranked = sorted(kws, key=lambda k: kw_total.get((t, k), 0), reverse=True)
        key_concepts[t] = [k for k in ranked if kw_total.get((t, k), 0) > 0][:6] or kws[:4]

    return dict(topic_yearly=topic_yearly, domain_yearly=domain_yearly,
                topic_exam_series=topic_exam_series, exam_years=exam_years,
                key_concepts=key_concepts)


def topic_metrics(yd):
    """Derived metrics for one topic's yearly dict (per-exam normalized rates)."""
    total = sum(yd.values())
    present = sorted([y for y in YEARS if yd.get(y, 0) > 0])
    years_appeared = len(present)
    first = present[0] if present else None
    last = present[-1] if present else None
    gap = (Y1 - last) if last is not None else (Y1 - Y0 + 1)
    best = run = 0
    for y in YEARS:
        if yd.get(y, 0) > 0:
            run += 1; best = max(best, run)
        else:
            run = 0
    # avg interval between appearance years
    if len(present) >= 2:
        intervals = [present[i + 1] - present[i] for i in range(len(present) - 1)]
        avg_period = round(sum(intervals) / len(intervals), 1)
    else:
        avg_period = None
    p3 = sum(yd.get(y, 0) for y in [Y1 - i for i in range(3)])
    p5 = sum(yd.get(y, 0) for y in LAST5_YEARS)
    p10 = sum(yd.get(y, 0) for y in [Y1 - i for i in range(10)])
    before5 = total - p5
    recent_avg = p5 / EXAMS_LAST5 if EXAMS_LAST5 else 0
    before_avg = before5 / EXAMS_BEFORE5 if EXAMS_BEFORE5 else 0
    growth = round((recent_avg - before_avg) / before_avg * 100, 1) if before_avg > 0 else (100.0 if recent_avg > 0 else 0.0)
    return dict(total_count=total, years_appeared=years_appeared,
                first_appeared_year=first, last_appeared_year=last,
                gap_years=gap, period_3yr_count=p3, period_5yr_count=p5,
                period_10yr_count=p10, before_5yr_count=before5,
                growth_rate_pct=growth, recent_avg_per_year=round(recent_avg, 2),
                before_avg_per_year=round(before_avg, 2),
                consecutive_appearances=best, avg_period=avg_period,
                frequency_per_exam=round(total / N_EXAMS, 2))


def yearly_full(yd):
    return {str(y): yd.get(y, 0) for y in YEARS}
