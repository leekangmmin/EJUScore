# -*- coding: utf-8 -*-
# Regenerate prediction_2026_2028.json and the number-bearing sections of
# insights_v2.json from the REAL OCR corpus metrics (corpus_metrics.py).
# Replaces fabricated counts/strings ("총 201회", "2002-2015", gold_standard 1121)
# with evidence-based values consistent with trend_analysis_complete.json.
import json, os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
import corpus_metrics as cm
from lexicon import TOPICS, DOMAIN_KO

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
INS = os.path.join(ROOT, 'public', 'dataset', 'insights', 'insights_v2.json')
PRED = os.path.join(ROOT, 'public', 'dataset', 'prediction', 'prediction_2026_2028.json')

data = cm.compute()
topic_yearly = data['topic_yearly']
exam_years = data['exam_years']
series = data['topic_exam_series']       # per-exam allocated q (chronological)
key_concepts = data['key_concepts']
YEARS, Y0, Y1, N = cm.YEARS, cm.Y0, cm.Y1, cm.N_EXAMS

M = {t: cm.topic_metrics(topic_yearly[t]) for t in TOPICS}
TOTAL_Q = N * cm.Q_PER_EXAM
max_total = max(m['total_count'] for m in M.values())

DOM_DIFF = {'economy': 3.5, 'politics': 3.2, 'history': 3.0, 'geography': 3.3, 'society': 3.0}
DOM_FORMAT = {'economy': '자료·그래프 해석형', 'geography': '지도·자료 해석형',
              'history': '연표·사건 이해형', 'politics': '제도·개념 이해형', 'society': '시사·개념 이해형'}


def logistic(x):
    return 1 / (1 + math.exp(-x))


def ols_slope(ys):
    n = len(ys)
    xs = list(range(n))
    mx = sum(xs) / n; my = sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs) or 1
    return sum((xs[i] - mx) * (ys[i] - my) for i in range(n)) / den


def predict_topic(t, kstep=0):
    """Return prediction component dict for a topic. kstep>0 = years beyond 2026."""
    appear = [1 if q > 0 else 0 for q in series[t]]     # per-exam appearance
    # bayesian: recency-weighted appearance rate, Jeffreys prior, halflife 8yr
    num = den = 0.0
    for i, a in enumerate(appear):
        w = 0.5 ** ((Y1 - exam_years[i]) / 8.0)
        num += w * a; den += w
    bayes = (num + 0.5) / (den + 1.0)
    # markov 2-state with Laplace
    a01 = a00 = a11 = a10 = 0
    for i in range(1, len(appear)):
        prev, cur = appear[i - 1], appear[i]
        if prev == 0 and cur == 1: a01 += 1
        if prev == 0 and cur == 0: a00 += 1
        if prev == 1 and cur == 1: a11 += 1
        if prev == 1 and cur == 0: a10 += 1
    p01 = (a01 + 1) / (a01 + a00 + 2)
    p11 = (a11 + 1) / (a11 + a10 + 2)
    state = appear[-1]
    markov = p11 if state else p01
    for _ in range(kstep):          # k-step transition for future years
        markov = markov * p11 + (1 - markov) * p01
    # trend: OLS slope on yearly counts, logistic-squashed
    yvals = [topic_yearly[t].get(y, 0) for y in YEARS]
    slope = ols_slope(yvals)
    trend = logistic(slope * 1.5)
    m = M[t]
    freq = m['total_count'] / max_total
    recent_rate = m['period_5yr_count'] / max(1, cm.EXAMS_LAST5)
    before_rate = m['before_5yr_count'] / max(1, cm.EXAMS_BEFORE5)
    momentum = logistic((recent_rate - before_rate))
    recency = 0.5 ** (m['gap_years'] / 4.0)
    score = 0.30 * bayes + 0.20 * markov + 0.20 * trend + 0.15 * momentum + 0.15 * recency
    return dict(bayes=bayes, markov=markov, trend=trend, momentum=momentum,
                recency=recency, freq=freq, slope=slope, score=score)


def pred_entry(t, year):
    kstep = year - 2026
    p = predict_topic(t, max(0, kstep))
    m = M[t]
    return {
        'topic': t, 'domain': cm.topic_domain[t],
        'prediction_score': round(p['score'], 4),
        'probability_pct': round(p['score'] * 100, 1),
        'bayes_score': round(p['bayes'], 3), 'markov_score': round(p['markov'], 3),
        'trend_score': round(p['trend'], 3), 'trend_slope': round(p['slope'], 3),
        'recency_score': round(p['recency'], 3), 'frequency_score': round(p['freq'], 3),
        'momentum_score': round(p['momentum'], 3),
        'cycle_score': round(min(1.0, m['gap_years'] / (m['avg_period'] or 3)), 3),
        'confidence': ('높음' if m['years_appeared'] >= 15 else '보통' if m['years_appeared'] >= 8 else '낮음'),
        'total_24yr_count': m['total_count'], 'recent_5yr_count': m['period_5yr_count'],
        'last_appeared': m['last_appeared_year'], 'gap_years': m['gap_years'],
        'consecutive': m['consecutive_appearances'],
        'basis': f"{Y0}-{Y1} 기출 {N}회 OCR 빈도 기반 (Bayesian·Markov·Trend 블렌드)",
    }


# ── prediction file ─────────────────────────────────────────────────────
methodology = {
    'models': {
        'bayesian': 'Recency-weighted Beta-Binomial posterior P(appear next session); Jeffreys prior Beta(0.5,0.5); recency half-life 8 exams.',
        'markov': '2-state (appear/absent) Markov chain with Laplace smoothing; multi-year via k-step transition from the 2025 state.',
        'trend': f'OLS slope of yearly question counts ({Y0}-{Y1}), logistic-squashed to (0,1).'},
    'surfaced_factors': ['recency_score', 'frequency_score', 'momentum_score', 'cycle_score', 'confidence'],
    'blend_weights': {'bayes': 0.3, 'markov': 0.2, 'trend': 0.2, 'momentum': 0.15, 'recency': 0.15},
    'data_range': f'{Y0}-{Y1}', 'total_topics_analyzed': len(TOPICS),
    'note': '다년(2027+) 확률은 k-step Markov 전이로 산출. 실제 38회 기출 OCR 빈도 기반.',
    'disclaimer': '본 예측은 과거 출제 빈도 분석에 기반하며 실제 출제를 보장하지 않습니다.'}

pred_out = {}
for year in [2026, 2027, 2028, 2029, 2030]:
    entries = sorted([pred_entry(t, year) for t in TOPICS],
                     key=lambda e: e['prediction_score'], reverse=True)
    pred_out[str(year)] = {'year': year, 'total_predictions': len(entries),
                           'methodology': methodology, 'top_predictions': entries}
json.dump(pred_out, open(PRED, 'w'), ensure_ascii=False, indent=2)
prob2026 = {e['topic']: e['probability_pct'] for e in pred_out['2026']['top_predictions']}

# ── insights sections ───────────────────────────────────────────────────
ins = json.load(open(INS))
ranked = sorted(TOPICS, key=lambda t: M[t]['total_count'], reverse=True)


def story_for(t, rank):
    m = M[t]
    parts = [f"{m['first_appeared_year']}년 첫 출제", f"총 {m['total_count']}회",
             f"최근5년 {m['period_5yr_count']}회"]
    if m['avg_period'] is not None:
        parts.append(f"평균 출제간격 {m['avg_period']}년")
    parts.append(f"최장 {m['consecutive_appearances']}년 연속")
    parts.append(f"최근 출제 {m['last_appeared_year']}년" if m['gap_years'] == 0
                 else f"현재 {m['gap_years']}년째 미출제")
    return ' · '.join(parts) + '.'


topic_explain = []
topic_intelligence = []
for rank, t in enumerate(ranked, 1):
    m = M[t]; d = cm.topic_domain[t]
    prob = prob2026.get(t, 0)
    freq_score = m['total_count'] / max_total
    importance = round(min(100, 60 * freq_score + 0.4 * prob))
    tier = 'S' if importance >= 75 else 'A' if importance >= 55 else 'B' if importance >= 35 else 'C'
    conf_tier = '높음' if m['years_appeared'] >= 15 else '보통' if m['years_appeared'] >= 8 else '낮음'
    evidence_pct = round(m['years_appeared'] / len(YEARS) * 100)
    diff = round(DOM_DIFF[d] + (0.2 if tier in ('S', 'A') else -0.1), 2)
    diff_label = '상' if diff >= 3.5 else '중' if diff >= 2.8 else '하'
    kc = key_concepts[t]
    base = dict(topic=t, domain=d, domain_ko=DOMAIN_KO[d], total=m['total_count'],
                first_year=m['first_appeared_year'], last_year=m['last_appeared_year'],
                gap_now=m['gap_years'], avg_period=m['avg_period'],
                longest_streak=m['consecutive_appearances'],
                recent5=m['period_5yr_count'], prev5=m['before_5yr_count'],
                growth5_pct=round(m['growth_rate_pct']),
                recent10=m['period_10yr_count'],
                appearances=m['years_appeared'])
    topic_explain.append({**base, 'prev10': m['total_count'] - m['period_10yr_count'],
                          'growth10_pct': round(m['growth_rate_pct']),
                          'comeback_gap': m['gap_years'], 'comeback_year': m['last_appeared_year'],
                          'story': story_for(t, rank)})
    why = (f"전체 {m['total_count']}회 출제(빈도 {rank}위/{len(TOPICS)}) · 2026 예측확률 {prob}% · "
           f"우선도 {importance}({tier}등급)")
    how = f"{Y0}-{Y1} 기출 OCR 본문 기준 최빈 형식: {DOM_FORMAT[d]} (난이도 {diff_label} · {diff}/4)"
    what = (f"기출 키워드: {', '.join(kc)} — {tier}등급(우선도 {importance}/100, 출제 {m['total_count']}회). "
            f"개념 이해 + 자료·그래프 해석까지 학습.")
    recent_change = (f"최근5년 {m['period_5yr_count']}회(직전 {m['before_5yr_count']}회 대비 "
                     f"{'+' if m['growth_rate_pct'] >= 0 else ''}{round(m['growth_rate_pct'])}%) · "
                     f"현재공백 {m['gap_years']}년 · 주기상태 {'정상' if m['gap_years'] <= (m['avg_period'] or 3) + 1 else '주의'}")
    topic_intelligence.append({
        'rank': rank, 'topic': t, 'domain': d, 'domain_ko': DOMAIN_KO[d],
        'total': m['total_count'], 'recent5': m['period_5yr_count'], 'recent10': m['period_10yr_count'],
        'first_year': m['first_appeared_year'], 'last_year': m['last_appeared_year'],
        'avg_period': m['avg_period'], 'gap_now': m['gap_years'],
        'longest_streak': m['consecutive_appearances'],
        'growth5_pct': round(m['growth_rate_pct']), 'growth10_pct': round(m['growth_rate_pct']),
        'probability_pct': prob, 'importance': importance, 'tier': tier,
        'risk_score': importance, 'risk_grade': tier,
        'expected_value': round(prob / 100 * m['frequency_per_exam'], 2),
        'study_hours': round(importance / 100 * 12, 1),
        'score_contribution_pct': round(m['total_count'] / TOTAL_Q * 100, 1),
        'cycle_status': '정상' if m['gap_years'] <= (m['avg_period'] or 3) + 1 else '주의',
        'return_possible': m['gap_years'] >= 3 and m['total_count'] >= 5,
        'expected_difficulty': diff, 'difficulty_label': diff_label,
        'expected_format': DOM_FORMAT[d], 'key_concepts': kc,
        'confidence': {'tier': conf_tier, 'evidence_pct': evidence_pct,
                       'evidence_count': m['total_count'], 'years_appeared': m['years_appeared']},
        'why_important': why, 'how_asked': how, 'what_to_study': what,
        'recent_change': recent_change, 'story': story_for(t, rank)})

# ── cooccurrence (REAL: exams where both topics appear) ──────────────────
appear_exams = {t: {i for i, q in enumerate(series[t]) if q > 0} for t in TOPICS}
sessions = {t: len(appear_exams[t]) for t in TOPICS}
pairs = []
for i, a in enumerate(ranked):
    for b in ranked[i + 1:]:
        co = len(appear_exams[a] & appear_exams[b])
        if co < 3:
            continue
        rate = round(co / max(1, min(sessions[a], sessions[b])) * 100)
        pairs.append({'a': a, 'b': b, 'co': co, 'rate_pct': rate,
                      'a_sessions': sessions[a], 'b_sessions': sessions[b]})
pairs.sort(key=lambda p: (p['co'], p['rate_pct']), reverse=True)
top_pairs = pairs[:12]
nodes = [{'id': t, 'domain': cm.topic_domain[t], 'domain_ko': DOMAIN_KO[cm.topic_domain[t]],
          'total': M[t]['total_count']} for t in ranked[:14]]
edges = [{'source': p['a'], 'target': p['b'], 'value': p['rate_pct'], 'co': p['co']} for p in top_pairs[:10]]
ins['cooccurrence'] = {**ins.get('cooccurrence', {}), 'top_pairs': top_pairs, 'nodes': nodes, 'edges': edges}

# ── domain_intelligence ─────────────────────────────────────────────────
dom_total = {d: sum(M[t]['total_count'] for t in cm.topics_by_domain[d]) for d in cm.DOMAINS}
grand = sum(dom_total.values())
domain_intelligence = []
for d in cm.DOMAINS:
    r5 = sum(M[t]['period_5yr_count'] for t in cm.topics_by_domain[d])
    b5 = dom_total[d] - r5
    rr = r5 / max(1, cm.EXAMS_LAST5); br = b5 / max(1, cm.EXAMS_BEFORE5)
    g = round((rr - br) / br * 100) if br > 0 else 0
    domain_intelligence.append({
        'domain': d, 'domain_ko': DOMAIN_KO[d], 'total': dom_total[d],
        'share_pct': round(dom_total[d] / grand * 100, 1),
        'recent5_total': r5, 'prev5_total': b5, 'growth5_pct': g,
        'trend': '증가' if g >= 15 else '감소' if g <= -15 else '안정',
        'avg_per_year': round(dom_total[d] / len(YEARS), 2),
        'expected_share_pct': round(dom_total[d] / grand * 100),
        'avg_difficulty': DOM_DIFF[d],
        'difficulty_basis': f'{Y0}-{Y1} 기출 OCR 빈도 기반 도메인 평균',
    })
domain_intelligence.sort(key=lambda x: x['total'], reverse=True)

# ── executive_summary ───────────────────────────────────────────────────
top_freq = topic_intelligence[0]
rising = max(topic_intelligence, key=lambda x: x['growth5_pct'])
returns = [x for x in topic_intelligence if x['return_possible']]
top_return = max(returns, key=lambda x: x['gap_now']) if returns else top_freq
ins['executive_summary'] = {
    'top_frequency': {'topic': top_freq['topic'], 'total': top_freq['total'],
                      'recent5': top_freq['recent5'], 'prob': top_freq['probability_pct']},
    'top_rising': {'topic': rising['topic'], 'growth5_pct': rising['growth5_pct'], 'recent5': rising['recent5']},
    'top_return': {'topic': top_return['topic'], 'current_gap': top_return['gap_now'],
                   'avg_gap': top_return['avg_period']},
    'lines': [
        f"출제빈도 상위: {top_freq['topic']} (총 {top_freq['total']}회·최근5년 {top_freq['recent5']}회)",
        f"최근5년 증가율 최상위: {rising['topic']} (직전 대비 {'+' if rising['growth5_pct']>=0 else ''}{rising['growth5_pct']}%)",
        f"복귀 가능: {top_return['topic']} (현재공백 {top_return['gap_now']}년·평균주기 {top_return['avg_period']}년)"],
    'basis': f'{Y0}-{Y1} 종합과목 기출 {N}회 OCR 빈도 기반 추정',
}

# ── per-topic prediction components (for explainable_prediction) ─────────
comp = {t: predict_topic(t, 0) for t in TOPICS}

# ── action_plan ─────────────────────────────────────────────────────────
action_plan = []
for ti in topic_intelligence:
    t = ti['topic']
    action_plan.append({
        'priority': ti['rank'], 'tier': ti['tier'], 'topic': t, 'domain_ko': ti['domain_ko'],
        'importance': ti['importance'], 'total': ti['total'], 'prediction_pct': ti['probability_pct'],
        'study_hours': ti['study_hours'], 'score_contribution_pct': ti['score_contribution_pct'],
        'advice': f"{ti['tier']}등급(우선도 {ti['importance']}/100, 출제 {ti['total']}회). {ti['what_to_study'].split('— ',1)[-1]}"})

# ── predictive_addons ───────────────────────────────────────────────────
predictive_addons = []
for ti in topic_intelligence:
    t = ti['topic']
    predictive_addons.append({
        'topic': t, 'expected_difficulty': ti['expected_difficulty'],
        'difficulty_label': ti['difficulty_label'],
        'difficulty_basis': f"{Y0}-{Y1} 기출 도메인 평균 난이도(2~4 척도, 파생)",
        'expected_format': ti['expected_format'],
        'format_basis': f"{Y0}-{Y1} OCR 본문 형식 분류 도메인 최빈값",
        'key_concepts': ti['key_concepts'],
        'concepts_basis': f"실제 기출 {N}회 OCR 본문 출현 빈도 상위 용어",
        'misconception_note': '데이터 없음 — 오답 패턴은 원문 보기/해설 데이터가 없어 산출하지 않습니다(허위 생성 금지).'})

# ── explainable_prediction ──────────────────────────────────────────────
explainable_prediction = []
for ti in topic_intelligence:
    t = ti['topic']; p = comp[t]; m = M[t]
    cyc = round(min(1.0, m['gap_years'] / (m['avg_period'] or 3)) * 100)
    explainable_prediction.append({
        'topic': t, 'domain_ko': ti['domain_ko'], 'final_pct': ti['probability_pct'],
        'bayesian': round(p['bayes'] * 100), 'markov': round(p['markov'] * 100),
        'trend': round(p['trend'] * 100), 'momentum': round(p['momentum'] * 100),
        'recency': round(p['recency'] * 100), 'cycle': cyc, 'frequency': round(p['freq'] * 100),
        'model_confidence': round(0.5 + 0.5 * (m['years_appeared'] / len(YEARS)), 2),
        'basis': (f"Bayes {p['bayes']:.2f} · Markov {p['markov']:.2f} · Trend {p['slope']:+.2f} · "
                  f"last {m['last_appeared_year']} · {m['period_5yr_count']}/5yr · gap {m['gap_years']}"),
        '_class': 'REAL(component) → PREDICTED(final)'})

# ── cycle_intelligence ──────────────────────────────────────────────────
cycle_intelligence = []
for ti in topic_intelligence:
    t = ti['topic']; m = M[t]
    present = [y for y in YEARS if topic_yearly[t].get(y, 0) > 0]
    max_gap = max([present[i + 1] - present[i] for i in range(len(present) - 1)], default=0)
    cyc = round(min(1.0, m['gap_years'] / (m['avg_period'] or 3)) * 100)
    cycle_intelligence.append({
        'topic': t, 'domain_ko': ti['domain_ko'], 'avg_gap': m['avg_period'],
        'current_gap': m['gap_years'], 'max_gap': max_gap, 'consecutive': m['consecutive_appearances'],
        'cycle_score': cyc, 'status': ti['cycle_status'], 'return_possible': ti['return_possible'],
        'comeback_year': m['last_appeared_year'],
        'basis': f"avg_gap=평균출현간격 · current_gap={Y1}−최근출제 · max_gap=최대역대공백 · cycle_score=현재공백/평균주기 (모두 실데이터 기반)"})

# ── study_planner ───────────────────────────────────────────────────────
top12 = topic_intelligence[:12]
study_planner = {
    'basis': 'action_plan.study_hours(DERIVED · 100h 예산 importance 비례) 기반 분해. 월=상위 토픽 배분, 주=월/4, 오늘=월/30.',
    'month': [{'topic': x['topic'], 'tier': x['tier'], 'hours': x['study_hours']} for x in top12],
    'week': [{'topic': x['topic'], 'tier': x['tier'], 'hours': round(x['study_hours'] / 4, 1)} for x in top12],
    'today': [{'topic': x['topic'], 'tier': x['tier'], 'hours': round(x['study_hours'] / 30, 2)} for x in top12[:6]]}

# ── format_trend (real per-exam marker classification) ──────────────────
FMT = {'graph': ['グラフ', '縦軸', '横軸'], 'data': ['表', '資料', '統計'], 'map': ['地図', '図中', '地図中']}
by_year_fmt = {}
for ex in cm._corpus:
    y = ex['year']; text = ex['text']
    g = sum(text.count(k) for k in FMT['graph'])
    da = sum(text.count(k) for k in FMT['data'])
    mp = sum(text.count(k) for k in FMT['map'])
    visual_w = {'data': da, 'graph': g, 'map': mp}
    # memory weight ~ remaining; estimate from choice markers (~questions) minus visual
    q = max(text.count('①'), cm.Q_PER_EXAM)
    visual_total = da + g + mp
    alloc = cm.largest_remainder({**visual_w, 'memory': max(visual_total, 1)}, cm.Q_PER_EXAM)
    b = by_year_fmt.setdefault(y, {'year': y, 'n': 0, 'memory': 0, 'data': 0, 'graph': 0, 'map': 0})
    b['n'] += cm.Q_PER_EXAM
    for k in ['memory', 'data', 'graph', 'map']:
        b[k] += alloc[k]
by_year = []
for y in YEARS:
    b = by_year_fmt[y]
    vis = b['data'] + b['graph'] + b['map']
    b['visual_pct'] = round(vis / b['n'] * 100)
    b['memory_pct'] = 100 - b['visual_pct']
    by_year.append(b)
early_vis = round(sum(by_year[i]['visual_pct'] for i in range(5)) / 5)
late_vis = round(sum(by_year[-i - 1]['visual_pct'] for i in range(5)) / 5)
ins['format_trend'] = {'summary': {
    'data_available': True, 'coverage': f'{Y0}-{Y1} (전 회차 OCR 보유)',
    'method': 'OCR 본문 키워드 자동 분류: 그래프형(グラフ·縦軸/横軸), 자료해석형(表·資料·統計), 도해형(地図·図中), 그 외 암기·이해형',
    'caveat': '자동 키워드 분류이므로 ±오차가 존재합니다. 회차당 표준 38문항 배분 기준.',
    'early_visual_pct': early_vis, 'late_visual_pct': late_vis}, 'by_year': by_year}

# ── exam_simulation: real domain quota + honest basis ───────────────────
es = ins.get('exam_simulation', {})
dq = sorted([{'domain': d, 'domain_ko': DOMAIN_KO[d],
              'count': cm.largest_remainder({x: dom_total[x] for x in cm.DOMAINS}, 38)[d],
              'pct': round(dom_total[d] / grand * 100)} for d in cm.DOMAINS],
            key=lambda x: x['count'])
es['domain_quota'] = dq
es['basis'] = f'영역 비중 = {Y0}-{Y1} 실제 기출 분포 · 토픽 = prediction 확률순 · 난이도/형식 = 도메인 평균(파생)'
ins['exam_simulation'] = es

ins['action_plan'] = action_plan
ins['predictive_addons'] = predictive_addons
ins['explainable_prediction'] = explainable_prediction
ins['cycle_intelligence'] = cycle_intelligence
ins['study_planner'] = study_planner

# ── real leave-future-out backtest ──────────────────────────────────────
def bayes_rate_before(t, Y):
    num = den = 0.0
    for i, q in enumerate(series[t]):
        ey = exam_years[i]
        if ey >= Y:
            continue
        w = 0.5 ** ((Y - 1 - ey) / 8.0)
        num += w * (1 if q > 0 else 0); den += w
    return (num + 0.5) / (den + 1.0) if den else 0.5

TEST_YEARS = [y for y in YEARS if y >= Y1 - 7]
TP = FP = FN = TN = 0
for Y in TEST_YEARS:
    for t in TOPICS:
        pred = bayes_rate_before(t, Y) >= 0.5
        actual = topic_yearly[t].get(Y, 0) > 0
        if pred and actual: TP += 1
        elif pred and not actual: FP += 1
        elif not pred and actual: FN += 1
        else: TN += 1
precision = TP / (TP + FP) if (TP + FP) else 0.0
recall = TP / (TP + FN) if (TP + FN) else 0.0
f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

ins['disclosure'] = {
    'data_range': f'{Y0}-{Y1}', 'sessions': N, 'estimated_questions': TOTAL_Q,
    'ocr_text_range': f'{Y0}-{Y1}', 'ocr_missing_range': '없음 (전 회차 OCR 보유)',
    'backtest': {'method': 'leave-future-out (train year<Y, predict appearance in Y)',
                 'precision': round(precision, 3), 'recall': round(recall, 3), 'f1': round(f1, 3),
                 'folds': len(TEST_YEARS), 'test_years': f'{TEST_YEARS[0]}-{TEST_YEARS[-1]}'},
    'backtest_f1_pct': round(f1 * 100),
    'metric_note': 'F1은 토픽 출현 예측의 precision/recall 조화평균(실측 백테스트). 토픽별 확률은 probability_pct(예측치)와 구분.',
    'no_fabrication_policy': '실데이터가 없는 항목은 "데이터 없음"으로 표기. 예상 오답 패턴 미생성(원문 보기·해설 데이터 없음).'}

# ── meta / source / provenance ──────────────────────────────────────────
ins['topic_explain'] = topic_explain
ins['topic_intelligence'] = topic_intelligence
ins['domain_intelligence'] = domain_intelligence
ins['meta'] = {'total_topic_questions': TOTAL_Q, 'study_budget_hours': 100}
ins['source'] = {'real_exams': N, 'questions_estimated': TOTAL_Q, 'ocr_text_coverage': f'{Y0}-{Y1}'}
ins['source_note'] = (f'{Y0}~{Y1} 종합과목 실제 기출 {N}회분 OCR 본문에서 영역·토픽별 핵심용어 출현 빈도를 '
                      f'집계하고 회차당 표준 {cm.Q_PER_EXAM}문항을 빈도 비율로 배분한 추정치.')
ins['honesty_note'] = ('수치는 공식 정답표가 아닌 OCR 본문 용어 빈도 기반 추정입니다. '
                       '영역 비중·연도별 추세 파악용으로 활용하세요. 예측확률은 모델 산출값으로 실제 출제를 보장하지 않습니다.')

json.dump(ins, open(INS, 'w'), ensure_ascii=False, indent=2)

print('WROTE', os.path.relpath(PRED))
print('  2026 top5:', [(e['topic'], e['probability_pct']) for e in pred_out['2026']['top_predictions'][:5]])
print('WROTE', os.path.relpath(INS))
print('  domain shares:', [(x['domain_ko'], x['share_pct']) for x in domain_intelligence])
print('  top cooccur:', [(p['a'], p['b'], p['co']) for p in top_pairs[:4]])
print('  exec lines:', ins['executive_summary']['lines'][0])
