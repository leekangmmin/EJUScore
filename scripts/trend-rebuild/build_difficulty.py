# -*- coding: utf-8 -*-
# Per-exam (year/round) difficulty & composition analysis from REAL OCR.
#   · summary  : domain mix, format mix, estimated difficulty band, top topics
#                (over the OCR-recognized questions of that exam — complete-ish)
#   · questions: choice-set-segmented question blocks (~28/38) with estimated
#                domain / format / difficulty. NOT official item statistics —
#                EJU does not publish per-item difficulty, so difficulty is a
#                transparent heuristic estimate from text features.
import json, os, re, sys
from collections import defaultdict
sys.path.insert(0, os.path.dirname(__file__))
from lexicon import TOPICS, DOMAIN_KO

CORPUS = '/tmp/eju_comp_ocr.json'
OUT = os.path.join(os.path.dirname(__file__), '..', '..',
                   'public', 'dataset', 'difficulty', 'exam_difficulty.json')
DOMAINS = ['economy', 'politics', 'history', 'geography', 'society']

# domain -> keyword set (flatten topic lexicon)
DOM_KW = defaultdict(list)
for t, (d, kws) in TOPICS.items():
    DOM_KW[d].extend(kws)
TOPIC_KW = {t: (d, kws) for t, (d, kws) in TOPICS.items()}

FMT_MARK = {
    '지도': ['地図', '地図中', '位置', '都市の位置'],
    '그래프·도표': ['グラフ', '縦軸', '横軸', '推移を示し', '示したもの', '次の図'],
    '자료해석': ['表', '資料', '統計', '次の表', 'データ'],
}
QPAT = re.compile(r'①.{0,700}?②.{0,700}?③.{0,700}?④', re.S)
BOXPAT = re.compile(r'[\|\[「]\s*([0-9]{1,2})\s*[\|\]」]')
CLEAN = re.compile(r'\s+')


def classify_domain(text):
    best, bestc = 'unknown', 0
    for d in DOMAINS:
        c = sum(text.count(k) for k in DOM_KW[d])
        if c > bestc:
            best, bestc = d, c
    return best, bestc


def classify_format(text):
    for fmt, marks in FMT_MARK.items():
        if any(m in text for m in marks):
            return fmt
    return '암기·이해'


def difficulty_of(domain, fmt, stem_len):
    base = {'자료해석': 3.4, '그래프·도표': 3.45, '지도': 3.2, '암기·이해': 2.8}[fmt]
    if domain == 'economy':
        base += 0.3
    if stem_len > 140:
        base += 0.3
    elif stem_len < 60:
        base -= 0.2
    base = max(1.0, min(5.0, base))
    label = '상' if base >= 3.6 else '중' if base >= 2.8 else '하'
    return round(base, 1), label


def top_topics(full, k=5):
    counts = []
    for t, (d, kws) in TOPIC_KW.items():
        c = sum(full.count(w) for w in kws)
        if c:
            counts.append({'name': t, 'domain': d, 'count': c})
    counts.sort(key=lambda x: x['count'], reverse=True)
    return counts[:k]


corpus = json.load(open(CORPUS))
corpus.sort(key=lambda r: (r['year'], r['round']))
exams = {}
year_rounds = defaultdict(list)

for ex in corpus:
    y, r = ex['year'], ex['round']
    text = ex['text']
    blocks = list(QPAT.finditer(text))
    questions = []
    prev_end = 0
    for i, mm in enumerate(blocks):
        stem = text[prev_end:mm.start()]
        prev_end = mm.end()
        # strip page headers/footers noise lines, keep meaningful tail
        stem_clean = CLEAN.sub(' ', stem).strip()
        # the question prompt is the tail of the stem (closest to the choices)
        prompt = stem_clean[-220:]
        ctx = prompt + ' ' + CLEAN.sub(' ', text[mm.start():mm.end()])
        domain, dc = classify_domain(ctx)
        fmt = classify_format(ctx)
        diff, dlabel = difficulty_of(domain, fmt, len(prompt))
        box = BOXPAT.findall(text[mm.start():mm.end() + 30])
        officialN = int(box[0]) if box and 1 <= int(box[0]) <= 40 else None
        questions.append({
            'seq': i + 1, 'officialN': officialN,
            'domain': domain, 'domainKo': DOMAIN_KO.get(domain, '미분류'),
            'format': fmt, 'difficulty': diff, 'diffLabel': dlabel,
            'stem': prompt[-110:].strip(),
        })
    # summary over recognized questions
    dom_count = defaultdict(int); fmt_count = defaultdict(int)
    for q in questions:
        if q['domain'] != 'unknown':
            dom_count[q['domain']] += 1
        fmt_count[q['format']] += 1
    diffs = [q['difficulty'] for q in questions]
    avg = round(sum(diffs) / len(diffs), 2) if diffs else None
    band = '상' if (avg or 0) >= 3.4 else '중' if (avg or 0) >= 2.9 else '하'
    key = f'{y}_{r}'
    year_rounds[y].append(r)
    exams[key] = {
        'year': y, 'round': r, 'label': f'{y}년 제{r}회',
        'recognizedQ': len(questions), 'totalQ': 38,
        'pageCount': ex.get('pageCount'),
        'summary': {
            'domains': {DOMAIN_KO[d]: dom_count.get(d, 0) for d in DOMAINS},
            'formats': dict(fmt_count),
            'avgDifficulty': avg, 'diffBand': band,
            'visualQ': sum(v for k, v in fmt_count.items() if k != '암기·이해'),
            'topTopics': top_topics(text),
        },
        'questions': questions,
    }

out = {
    'generated_at': '2026-06-06',
    'source_note': ('실제 종합과목 기출 OCR에서 선택지(①~④) 기준으로 분할한 문항별 추정 분석입니다. '
                    'EJU는 문항별 정답률·난이도를 공개하지 않으므로 난이도는 본문 특징(자료유형·지문 '
                    '길이·영역)에서 산출한 추정치이며 실측이 아닙니다. OCR 한계로 회차당 일부 문항만 '
                    '인식됩니다(미인식 문항은 표시되지 않음).'),
    'difficulty_method': '자료해석/그래프 +, 지도 +, 경제영역 +, 긴 지문 + → 1~5 척도 환산(추정).',
    'years': sorted(year_rounds.keys()),
    'yearRounds': {str(y): sorted(set(rs)) for y, rs in year_rounds.items()},
    'exams': exams,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=2)

print('WROTE', os.path.relpath(OUT))
print('exams:', len(exams), '| years', out['years'][0], '-', out['years'][-1])
s = exams['2023_1']
print('2023_1 recognized %d/38 · avgDiff %.2f(%s) · domains %s' %
      (s['recognizedQ'], s['summary']['avgDifficulty'], s['summary']['diffBand'], s['summary']['domains']))
print('  q1:', s['questions'][0])
print('  formats:', s['summary']['formats'])
