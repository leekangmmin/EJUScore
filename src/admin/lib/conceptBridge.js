// ═══════════════════════════════════════════════════════════════════
// Concept Bridge — KO/EN → JA surface-form expansion for EJU search.
//
// THE core fix for the audit's #1 flaw: the corpus is Japanese OCR but
// queries arrive in Korean / mixed. A Korean query token never matches a
// Japanese corpus token. This dictionary maps a query concept (KO or EN)
// to the Japanese surface forms that actually appear in EJU questions,
// plus the canonical concept label used for "관련 개념".
//
// Every mapping is a real translation/equivalent — no fabricated data.
// Extendable: add rows as new query patterns are observed in review.
// ═══════════════════════════════════════════════════════════════════

/**
 * Each entry: { ko: [...aliases], ja: [...surface forms], label, domain }
 * `ko` aliases are matched (substring, normalized) against the query.
 * `ja` forms are injected as extra query tokens against the JA corpus.
 */
export const CONCEPT_BRIDGE = [
  // ── 경제 (economy) ───────────────────────────────────────
  { ko: ['브레튼우즈', '브레튼 우즈', '브레턴우즈', 'bretton woods'], ja: ['ブレトンウッズ', 'ブレトン・ウッズ', '金本位', '固定相場制', 'IMF', '国際通貨基金'], label: '브레튼우즈 체제', domain: 'economy' },
  { ko: ['환율', '엔고', '엔저', 'exchange rate'], ja: ['為替', '為替相場', '円高', '円安', '変動相場'], label: '환율·국제수지', domain: 'economy' },
  { ko: ['인플레이션', 'inflation', '물가'], ja: ['インフレ', 'インフレーション', '物価', '物価上昇'], label: '인플레이션', domain: 'economy' },
  { ko: ['국제수지', '무역수지', 'balance of payments'], ja: ['国際収支', '貿易収支', '経常収支'], label: '국제수지', domain: 'economy' },
  { ko: ['수요', '공급', 'supply', 'demand'], ja: ['需要', '供給', '需給', '均衡価格'], label: '수요와 공급', domain: 'economy' },
  { ko: ['국제무역', '무역', '관세', 'trade', 'tariff'], ja: ['貿易', '関税', '自由貿易', '比較優位', 'WTO'], label: '국제무역', domain: 'economy' },
  { ko: ['버블경제', '거품경제', 'bubble'], ja: ['バブル', 'バブル経済', '平成不況'], label: '버블경제', domain: 'economy' },
  { ko: ['재정정책', '금융정책', '통화정책'], ja: ['財政政策', '金融政策', '公開市場操作', '日本銀行'], label: '재정·금융정책', domain: 'economy' },

  // ── 정치 (politics) ──────────────────────────────────────
  { ko: ['국제연합', '국제연합 헌장', '유엔', '유엔 헌장', 'united nations', 'un charter'], ja: ['国際連合', '国連', '国連憲章', 'サンフランシスコ会議', '安全保障理事会'], label: '국제연합(UN)', domain: 'politics' },
  { ko: ['헌법', 'constitution'], ja: ['憲法', '日本国憲法', '立憲主義'], label: '헌법', domain: 'politics' },
  { ko: ['삼권분립', '권력분립', 'separation of powers'], ja: ['三権分立', '権力分立', '立法', '行政', '司法'], label: '삼권분립', domain: 'politics' },
  { ko: ['선거', '의회', 'election', 'parliament'], ja: ['選挙', '国会', '議会', '議院内閣制'], label: '선거·의회', domain: 'politics' },
  { ko: ['인권', '기본권', 'human rights'], ja: ['人権', '基本的人権', '社会権', '自由権'], label: '인권', domain: 'politics' },

  // ── 역사 (history) ───────────────────────────────────────
  { ko: ['냉전', 'cold war'], ja: ['冷戦', '東西対立', 'ベルリンの壁', 'キューバ危機'], label: '냉전', domain: 'history' },
  { ko: ['프랑스혁명', 'french revolution'], ja: ['フランス革命', '人権宣言', 'バスティーユ'], label: '프랑스혁명', domain: 'history' },
  { ko: ['산업혁명', 'industrial revolution'], ja: ['産業革命', '蒸気機関', '工場制'], label: '산업혁명', domain: 'history' },
  { ko: ['세계대전', '제1차', '제2차', 'world war'], ja: ['世界大戦', '第一次世界大戦', '第二次世界大戦', 'ベルサイユ'], label: '세계대전', domain: 'history' },
  { ko: ['메이지유신', '명치유신', 'meiji'], ja: ['明治維新', '明治', '富国強兵', '殖産興業'], label: '메이지유신', domain: 'history' },

  // ── 지리 (geography) ─────────────────────────────────────
  { ko: ['기후', 'climate'], ja: ['気候', '気候区分', 'ケッペン', 'モンスーン'], label: '기후', domain: 'geography' },
  { ko: ['인구', '고령화', '저출산', 'population'], ja: ['人口', '高齢化', '少子化', '人口ピラミッド'], label: '인구', domain: 'geography' },
  { ko: ['지형', '판구조', 'landform', 'plate'], ja: ['地形', 'プレート', '造山帯', '海流'], label: '지형', domain: 'geography' },

  // ── 사회 (society) ───────────────────────────────────────
  { ko: ['환경문제', '온난화', '지구온난화', 'global warming'], ja: ['地球温暖化', '温暖化', '環境問題', '京都議定書', 'パリ協定'], label: '환경·온난화', domain: 'society' },
  { ko: ['지속가능', 'sdgs', '지속가능발전'], ja: ['持続可能', 'SDGs', '持続可能な開発'], label: '지속가능발전(SDGs)', domain: 'society' },

  // ── 수학 (mathematics) ───────────────────────────────────
  { ko: ['행렬', '행렬 문제', 'matrix'], ja: ['行列', '逆行列', '行列式', '成分'], label: '행렬', domain: 'math_algebra' },
  { ko: ['벡터 내적', '내적', 'dot product', 'inner product'], ja: ['ベクトル', '内積', '成分', '大きさ'], label: '벡터 내적', domain: 'math_vector' },
  { ko: ['벡터', 'vector'], ja: ['ベクトル', '位置ベクトル', '成分表示'], label: '벡터', domain: 'math_vector' },
  { ko: ['미분', '도함수', 'derivative', 'differentiation'], ja: ['微分', '導関数', '接線', '極値'], label: '미분', domain: 'math_calculus' },
  { ko: ['적분', 'integral', 'integration'], ja: ['積分', '定積分', '面積', '不定積分'], label: '적분', domain: 'math_calculus' },
  { ko: ['확률', '경우의 수', 'probability'], ja: ['確率', '場合の数', '順列', '組合せ', '期待値'], label: '확률', domain: 'math_probability' },
  { ko: ['수열', '등차', '등비', 'sequence'], ja: ['数列', '等差数列', '等比数列', '漸化式', 'シグマ'], label: '수열', domain: 'math_sequence' },
  { ko: ['이차함수', '포물선', 'quadratic'], ja: ['二次関数', '放物線', '頂点', '判別式'], label: '이차함수', domain: 'math_function' },
  { ko: ['삼각함수', 'trigonometric', '사인', '코사인'], ja: ['三角関数', '正弦', '余弦', '加法定理', 'sin', 'cos'], label: '삼각함수', domain: 'math_trig' },
  { ko: ['로그', '지수', 'logarithm', 'exponential'], ja: ['対数', '指数', '指数関数', '対数関数'], label: '지수·로그', domain: 'math_function' },
  { ko: ['도형', '기하', '원', 'geometry', 'circle'], ja: ['図形', '円', '三角形', '相似', '面積'], label: '도형', domain: 'math_geometry' },
];

const KATAKANA = /[ァ-ヿ]/;

/** Normalize a query for KO alias matching. */
function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '');
}

/**
 * Expand a raw query into:
 *  - jaTokens: Japanese surface forms to inject against the corpus
 *  - concepts: matched concept labels (for "관련 개념")
 *  - domains:  domains implied by the matched concepts (for boosting/facets)
 */
export function bridgeExpand(query) {
  const q = norm(query);
  const jaTokens = new Set();
  const concepts = [];
  const domains = new Set();

  for (const entry of CONCEPT_BRIDGE) {
    const hit = entry.ko.some((alias) => q.includes(norm(alias)));
    // also match if the query already contains one of the JA forms directly
    const jaHit = entry.ja.some((form) => query.includes(form));
    if (hit || jaHit) {
      entry.ja.forEach((t) => jaTokens.add(t));
      concepts.push({ label: entry.label, domain: entry.domain, ja: entry.ja });
      if (entry.domain) domains.add(entry.domain);
    }
  }

  return { jaTokens: [...jaTokens], concepts, domains: [...domains], hadKatakana: KATAKANA.test(query) };
}

/** Quick check used by the UI to explain why a query did/didn't bridge. */
export function bridgeMatchedConcepts(query) {
  return bridgeExpand(query).concepts;
}
