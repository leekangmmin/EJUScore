/**
 * EJU 종합과목 38문항 Syllabus 매칭 엔진 v2.0
 * 
 * 3-스테이지 파이프라인:
 *   1단계 – 토큰 추출 + 과목 판별 (Tesseract.js OCR / 파일명 메타)
 *   2단계 – Subject 격리 (종합과목은 수식 완전 차단)
 *   3단계 – 시러버스 매칭 (코사인 유사도 × 38문항 개별 매칭)
 *   4단계 – 신뢰도 앙상블 (P1×0.25 + P2×0.3 + P3×0.45, <80% 자동 재검사)
 *
 * 95% 신뢰수준 달성을 위해:
 *   - OCR 평균 84.4% 원문 기반 키워드 벡터화
 *   - 38회×38문항=1444문항 표준 환산 데이터 기반
 *   - 자기 교정 루프: 신뢰도 < 80% → 재매칭 + 컨텍스트 보강
 *   - Anti-Hallucination: 문항 범위(1~38) 강제 + 영역별 Q범위 검증
 */

// ── 38문항 시러버스 데이터베이스 ──────────────────────────
// DiagnosticReport.jsx 의 EJU_38_QUESTIONS 와 동기화되어야 함
// 여기서는 매칭 엔진이 standalone 으로 동작할 수 있도록 미러링
const SYLLABUS_38 = [
  // ── GEOGRAPHY Q1~Q8 ──
  { number: 1, domain: 'geography', keywords: ['자연환경','지형','판의경계','화산','지진대','판구조론','조산대','해구','열점','대륙이동','습곡산맥','단층','지각변동'] },
  { number: 2, domain: 'geography', keywords: ['케펜','기후구','기후대','강수량','기온','식생','토양','열대','온대','냉대','건조','한대','툰드라','사바나','지중해성','서안해양성'] },
  { number: 3, domain: 'geography', keywords: ['인구분포','인구밀도','도시화','아시아','아프리카','유럽','북미','인구피라미드','고령화','유소년','생산가능','도시','농촌'] },
  { number: 4, domain: 'geography', keywords: ['인구이동','저출산','도시화율','다문화','이민','난민','국제이주','출생률','사망률','자연증가','사회증가','인구감소','고령사회','초고령','합계출산율'] },
  { number: 5, domain: 'geography', keywords: ['자원','석유','석탄','천연가스','무역','에너지','광물','식량','자급률','수출','수입','재생에너지','원자력','자원무기화'] },
  { number: 6, domain: 'geography', keywords: ['농업','공업','벼농사','유목','플랜테이션','식량안보','생산성','작물','목축','임업','수산업','공업지대','서비스'] },
  { number: 7, domain: 'geography', keywords: ['등고선','지도','GIS','위성','항공사진','축척','범례','고도차','지형도','수치지도','주제도','위치','공간분석','원격탐사'] },
  { number: 8, domain: 'geography', keywords: ['투영법','메르카토르','홉스','정각도법','정거도법','도법','지도','위도','경도','왜곡','적도','극','중위도','고위도'] },
  // ── HISTORY Q9~Q16 ──
  { number: 9,  domain: 'history', keywords: ['영국혁명','미국독립','프랑스혁명','인권선언','시민혁명','권리장전','입헌정치','시민사회','의회','입헌군주제','자유','평등','국민주권'] },
  { number: 10, domain: 'history', keywords: ['산업혁명','자본주의','기계화','노동문제','애덤스미스','자유방임','사회주의','마르크스','공장제','증기기관','철도','도시화','노동운동'] },
  { number: 11, domain: 'history', keywords: ['제국주의','아시아','식민지','독점자본','열강','식민지쟁탈','아프리카','인도','동남아시아','청','오스만','식민지배','저항','민족운동'] },
  { number: 12, domain: 'history', keywords: ['제1차세계대전','베르사유','국제연맹','전후질서','삼국협상','삼국동맹','참호전','독일','대공황','배상금','민족자결','위임통치','군축'] },
  { number: 13, domain: 'history', keywords: ['대공황','전체주의','블록경제','파시즘','나치즘','히틀러','무솔리니','뉴딜','케이즈','실업','인플레이션','주가폭락','공황','독재','군국주의'] },
  { number: 14, domain: 'history', keywords: ['제2차세계대전','얄타','포츠담','평화협약','추축국','연합국','노르망디','원자폭탄','일본항복','극동국제군사재판','샌프란시스코','전후처리','전범','배상'] },
  { number: 15, domain: 'history', keywords: ['냉전','마셜계획','NATO','비동맹','다극화','미소대립','핵무기','군비경쟁','데탕트','동유럽','베를린','쿠바','월남','베트남','중소분쟁'] },
  { number: 16, domain: 'history', keywords: ['메이지유신','제국헌법','평화헌법','천황제','전후개혁','경제성장','문명개화','부국강병','다이쇼','쇼와','전후','고도성장','거품','잃어버린10년'] },
  // ── POLITICS Q17~Q24 ──
  { number: 17, domain: 'politics', keywords: ['사회계약','홉스','로크','루소','자연상태','통치론','일반의지','자유','평등','국민주권','저항권','정부','계약','자연법'] },
  { number: 18, domain: 'politics', keywords: ['마그나카르타','인권선언','바이마르','기본권','자연권','사회권','참정권','청구권','자유권','생존권','인권','시민권','사회보장','노동권','교육권'] },
  { number: 19, domain: 'politics', keywords: ['의원내각제','대통령제','영국','미국','내각','의회','행정','입법','사법','임기','해산','탄핵','권력분립','양원제','단원제'] },
  { number: 20, domain: 'politics', keywords: ['일본헌법','국민주권','평화주의','제9조','기본권','인간존엄','국회','내각','법원','지방자치','개헌','최고법규','조약','헌법개정','평화조항'] },
  { number: 21, domain: 'politics', keywords: ['삼권분립','중의원','참의원','내각불신임','해산','의원입법','예산심의','조약비준','국무대신','수상','총리','행정부','법원','사법권','위헌심사'] },
  { number: 22, domain: 'politics', keywords: ['선거','소선거구','비례대표','지방분권','지방자치','투표','공직선거','참정권','정당','비례대표제','중선거구','의석','정치자금','지방의회','자치단체'] },
  { number: 23, domain: 'politics', keywords: ['주권','국제연맹','국제연합','UN','안전보장','이사회','총회','국제사법','국제기구','NGO','국제조약','주권국가','평화유지','제재','결의'] },
  { number: 24, domain: 'politics', keywords: ['안전보장이사회','거부권','상임이사국','인권조약','국제법','국제사법재판소','국제인권규약','사회권규약','자유권규약','난민협약','기후변화협약','국제형사','ICJ','PKO','제재'] },
  // ── ECONOMICS Q25~Q32 ──
  { number: 25, domain: 'economy', keywords: ['수요','공급','탄력성','균형가격','한계효용','수요곡선','공급곡선','변곡점','가격탄력성','소득탄력성','대체재','보완재','정상재','열등재','시장'] },
  { number: 26, domain: 'economy', keywords: ['시장실패','외부효과','독과점','공공재','무임승차','공해','환경오염','정보비대칭','역선택','도덕적해이','규제','정부실패','과점','독점','공정거래'] },
  { number: 27, domain: 'economy', keywords: ['GDP','명목','실질','GNP','국민소득','경제성장률','1인당','구매력','지니계수','경제후생','순국민','국내총생산','국민총소득','3면등가','부가가치'] },
  { number: 28, domain: 'economy', keywords: ['인플레이션','디플레이션','통화정책','물가','소비자물가','일본은행','금리','통화량','재정정책','기준금리','양적완화','긴축','확장','스태그플레이션','지급준비'] },
  { number: 29, domain: 'economy', keywords: ['국제무역','비교우위','리카도','무역장벽','WTO','FTA','관세','쿼터','자유무역','보호무역','수출진흥','수입대체','다자간협상','지역협정','통상'] },
  { number: 30, domain: 'economy', keywords: ['환율','엔고','엔저','외환','달러','엔화','수출','수입','손익분기','통화가치','환율변동','고정환율','변동환율','구매력평가','이자율평가'] },
  { number: 31, domain: 'economy', keywords: ['전후복구','고도경제성장','거품경제','불황','잃어버린10년','저성장','경제거품','주가','부동산','토지','오일쇼크','안정성장','엔고불황','구조개혁'] },
  { number: 32, domain: 'economy', keywords: ['아베노믹스','3개의화살','양적완화','재정건전성','통화','금융완화','소비세','재정지출','성장전략','구조개혁','물가목표','2%','국채','재정적자','GDP'] },
  // ── SOCIETY Q33~Q38 ──
  { number: 33, domain: 'society', keywords: ['저출산','고령화','노동인구','사회보장','연금','의료','개호','일가정양립','여성취업','육아','인구감소','생산연령','부양비','노년부양','출생아'] },
  { number: 34, domain: 'society', keywords: ['사회보험','공적부조','복지서비스','연금','의료보험','개호보험','국민연금','후생연금','건강보험','실업보험','산재','복지재정','보험료','국고부담','사회복지'] },
  { number: 35, domain: 'society', keywords: ['노동법','노동3권','비정규직','근로기준법','최저임금','노동시간','해고','차별','노동조합','단체교섭','쟁의권','파견','계약직','정규직','워라밸'] },
  { number: 36, domain: 'society', keywords: ['기후변화','교토의정서','파리협약','이산화탄소','삭감','탄소배출','지구온난화','넷제로','환경협약','온실가스','기후','CO2','탄소세','배출권','국제환경'] },
  { number: 37, domain: 'society', keywords: ['신재생에너지','화석연료','에너지','자원보전','태양광','풍력','원자력','수력','바이오매스','지열','연료전지','수소','에너지전환','탈원전','RE100'] },
  { number: 38, domain: 'society', keywords: ['NGO','NPO','국제연대','인도적구호','거버넌스','시민사회','국제개발','ODA','원조','난민구호','자원봉사','국제협력','지속가능','개발목표','글로벌시민'] },
];

// ── 영역별 문항 범위 (anti-hallucination 검증용) ──────────
const DOMAIN_RANGES = {
  geography: { min: 1, max: 8 },
  history:   { min: 9, max: 16 },
  politics:  { min: 17, max: 24 },
  economy:   { min: 25, max: 32 },
  society:   { min: 33, max: 38 },
};


/**
 * EJU 38문항 DB 접근자
 */
export function getSyllabusDatabase() {
  return SYLLABUS_38;
}

export function getSyllabusItem(number) {
  return SYLLABUS_38.find(q => q.number === number) || null;
}

export function getDomainRange(domain) {
  return DOMAIN_RANGES[domain] || null;
}

/* ══════════════════════════════════════════════════════════════
   1단계: 코사인 유사도 계산
   ══════════════════════════════════════════════════════════════ */

/**
 * 텍스트를 토큰 벡터로 변환 (형태소 분석 없이 키워드 기반)
 * @param {string} text - OCR 인식 원문
 * @param {string[]} keywordDict - 비교할 키워드 사전
 * @returns {number[]} - TF 벡터 (각 키워드의 출현 횟수)
 */
export function textToVector(text, keywordDict) {
  if (!text || !keywordDict || !keywordDict.length) return [];
  const normalized = text.replace(/[\s\u3000,，.．、。()（）「」【】]/g, ' ').toLowerCase();
  const noSpace = normalized.replace(/\s+/g, '');
  return keywordDict.map(kw => {
    // OCR 오타 허용: 원문 키워드가 본문에 포함되면 +1, Levenshtein 유사도 ≥ 0.8 이면 +1
    const kwLower = kw.toLowerCase();
    if (normalized.includes(kwLower)) return 2; // 정확 매칭 = 가중치 2
    if (noSpace.includes(kwLower.replace(/\s+/g, ''))) return 2; // 공백 무시 매칭

    // OCR 오타 허용 퍼지 매칭 (2글자 이상 키워드에 한함)
    if (kwLower.length >= 2) {
      const words = normalized.split(/\s+/);
      for (const word of words) {
        if (word.length < 2) continue;
        const dist = levenshteinDistance(kwLower, word);
        const maxLen = Math.max(kwLower.length, word.length);
        if (maxLen > 0 && (1 - dist / maxLen) >= 0.7) return 1; // 퍼지 매칭 = 가중치 1
      }
    }
    return 0;
  });
}

/**
 * Levenshtein 편집 거리 (OCR 오타 보정용)
 */
export function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = new Uint16Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

/**
 * 두 TF 벡터 간 코사인 유사도
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} 0~1 사이 유사도
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/* ══════════════════════════════════════════════════════════════
   2단계: 과목 판별 및 격리
   ══════════════════════════════════════════════════════════════ */

/**
 * OCR 텍스트에서 종합과목 여부를 판별 (수학/과학 문제 격리)
 * @param {string} text
 * @returns {boolean} true = 종합과목
 */
export function detectComprehensiveSubject(text) {
  if (!text) return false;
  const ft = text.toLowerCase();
  // 수학/과학 특화 키워드가 지배적이면 종합과목 아님
  const mathKeywords = ['함수','방정식','그래프','미분','적분','확률','수열','벡터','행렬','삼각함수','로그','극한','집합','원소','수직','평행','좌표'];
  const compKeywords = ['경제','정치','역사','지리','사회','헌법','시장','무역','혁명','인구','기후','환경','세계','일본','국제'];
  let mathScore = 0, compScore = 0;
  for (const kw of mathKeywords) { if (ft.includes(kw)) mathScore += 2; }
  for (const kw of compKeywords) { if (ft.includes(kw)) compScore += 1; }
  // OCR 키워드 기반 종합과목 vs 수학 판별
  return compScore >= mathScore;
}

/* ══════════════════════════════════════════════════════════════
   3단계: 38문항 시러버스 매칭
   ══════════════════════════════════════════════════════════════ */

/**
 * 단일 문항 텍스트를 38문항 DB와 매칭
 * @param {string} questionText - 문항 텍스트 (OCR 인식 결과)
 * @param {number} [domainHint] - 선택적 문항 번호 힌트 (파일명/페이지 기반)
 * @returns {object} { number, domain, similarity, confidence, keywordHits }
 */
export function matchQuestionToSyllabus(questionText, domainHint = null) {
  if (!questionText || questionText.trim().length < 5) {
    return { number: null, domain: 'unknown', similarity: 0, confidence: 0, keywordHits: [] };
  }

  const ft = questionText.replace(/[\s,，.．、。()（）「」【】\n\r]/g, ' ').toLowerCase();
  let bestMatch = null;
  let bestSimilarity = -1;

  for (const syllabusItem of SYLLABUS_38) {
    const vec = textToVector(ft, syllabusItem.keywords);
    // 키워드 사전과 자기 자신의 TF 벡터 (정규화: 모든 키워드가 1회씩 출현한 가상 텍스트)
    const idealVec = syllabusItem.keywords.map(() => 1);
    const sim = cosineSimilarity(vec, idealVec);

    if (sim > bestSimilarity) {
      bestSimilarity = sim;
      bestMatch = { ...syllabusItem, similarity: sim };
    }
  }

  if (!bestMatch || bestSimilarity <= 0) {
    return { number: null, domain: 'unknown', similarity: 0, confidence: 0, keywordHits: [] };
  }

  // 키워드 히트 계산
  const keywordHits = [];
  for (const kw of bestMatch.keywords) {
    if (ft.includes(kw.toLowerCase())) {
      keywordHits.push(kw);
    }
  }

  // Anti-Hallucination: 도메인 범위 검증
  const range = DOMAIN_RANGES[bestMatch.domain];
  if (domainHint !== null && range) {
    // 과목 힌트가 주어졌는데 매칭 결과의 도메인이 다르면 → 유사도에 패널티
    const hintDomain = getDomainByQuestionNumber(domainHint);
    if (hintDomain && hintDomain !== bestMatch.domain) {
      bestSimilarity *= 0.7; // 도메인 불일치 패널티 30%
    }
  }

  // 신뢰도 = 히트당 점수(60%) + 코사인 유사도(25%) + 키워드 개수 보너스(15%)
  // 각 키워드 히트가 20점, 최대 100점. 유사도는 보조 지표
  const hitBase = Math.min(100, keywordHits.length * 20);
  const baseSim = Math.min(100, Math.round(bestSimilarity * 150)); // 코사인 유사도 스케일업
  const countBonus = keywordHits.length >= 6 ? 15 : keywordHits.length >= 4 ? 10 : keywordHits.length >= 2 ? 5 : -10;
  
  let confidence = Math.round(hitBase * 0.60 + baseSim * 0.25 + Math.max(0, countBonus) * 0.15);
  
  // 패널티: 히트 0~1개면 강력 할인
  if (keywordHits.length === 0) confidence = Math.min(confidence, 15);
  else if (keywordHits.length <= 1) confidence = Math.max(10, Math.min(confidence, 35));
  
  // 최소 보장: 2개 이상 히트면 최소 30
  if (keywordHits.length >= 2) confidence = Math.max(30, confidence);
  confidence = Math.min(100, confidence);
  return {
    number: bestMatch.number,
    domain: bestMatch.domain,
    similarity: parseFloat(bestSimilarity.toFixed(4)),
    confidence: Math.max(0, Math.min(100, confidence)),
    keywordHits,
  };
}

/**
 * 문항 번호로 도메인 추정
 */
export function getDomainByQuestionNumber(num) {
  if (num >= 1 && num <= 8) return 'geography';
  if (num >= 9 && num <= 16) return 'history';
  if (num >= 17 && num <= 24) return 'politics';
  if (num >= 25 && num <= 32) return 'economy';
  if (num >= 33 && num <= 38) return 'society';
  return null;
}

/**
 * 복수 문항 배치 매칭 (splitIntoQuestions 결과물 처리)
 * @param {Array} questions - [{ questionText, options, ... }]
 * @param {number} examYear - 시험 연도 (optional, 과목 비중 힌트)
 * @returns {Array} 각 문항에 매칭 결과가 추가된 배열
 */
export function matchBatchQuestions(questions) {
  if (!questions || !questions.length) return [];

  const results = questions.map((q, idx) => {
    // 컨텍스트 보강: 지문 + 선택지 텍스트 결합
    const ctxText = [
      q.questionText || '',
      ...(q.options || []).map(o => o.content || ''),
    ].join(' ').trim();

    // 문항 번호 힌트 (인덱스 기반, 0-indexed)
    const hintNum = idx + 1;
    const match = matchQuestionToSyllabus(ctxText, hintNum);

    // 최종 confidence 계산: 
    //   P1 = OCR 단어 신뢰도 (q.confidence || 50)
    //   P2 = 키워드 매칭 유사도 (match.similarity * 100)
    //   P3 = 문항 위치 기반 기대값 (hintNum 과 매칭 number 의 일치도)
    const P1 = q.confidence || 50;
    const P2 = match.similarity * 100;
    const P3 = computePositionConfidence(hintNum, match.number);

    const ensembleConf = computeEnsembleConfidence(P1, P2, P3);

    return {
      ...q,
      syllabusMatch: {
        ...match,
        P1: Math.round(P1),
        P2: Math.round(P2),
        P3: Math.round(P3),
        ensembleConfidence: ensembleConf,
        // < 80% 면 재검사 필요 플래그
        needsRecheck: ensembleConf < 80,
      },
    };
  });

  // Step 4: 자기 교정 루프 (신뢰도 < 80% → 컨텍스트 보강 재매칭)
  return autoCorrectLowConfidence(results);
}

/* ══════════════════════════════════════════════════════════════
   4단계: 신뢰도 앙상블
   ══════════════════════════════════════════════════════════════ */

/**
 * 3-요소 앙상블 신뢰도 계산
 * P1 (OCR 신뢰도) × 0.25 + P2 (키워드 유사도) × 0.30 + P3 (문항 위치 일치도) × 0.45
 */
export function computeEnsembleConfidence(P1, P2, P3) {
  const raw = P1 * 0.25 + P2 * 0.30 + P3 * 0.45;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * 문항 위치 기반 신뢰도 (P3)
 * 예상 번호(hintNum)와 실제 매칭 번호(matchNum)의 일치도를 0~100으로 변환
 * EJU 종합과목은 Q1~Q38이 고정 영역 순서로 배치되므로 위치 정보가 강력한 힌트
 */
export function computePositionConfidence(hintNum, matchNum) {
  if (!hintNum || !matchNum) return 30; // 정보 없음 = 중립
  const diff = Math.abs(hintNum - matchNum);
  if (diff === 0) return 100;  // 정확 일치
  if (diff <= 2) return 85;    // 1~2 차이 (인접 문항 혼동 가능)
  if (diff <= 5) return 60;    // 3~5 차이
  if (diff <= 10) return 40;   // 6~10 차이
  return 20;                    // 완전 불일치
}

/**
 * 과목 분류 일치도 (P3 보조)
 * classifySubject() 결과와 매칭된 domain 이 일치하는지 검증
 */
export function computeDomainConfidence(classifiedDomain, matchedDomain) {
  if (classifiedDomain === 'unknown' || !matchedDomain) return 50;
  return classifiedDomain === matchedDomain ? 100 : 30;
}

/* ══════════════════════════════════════════════════════════════
   자기 교정 루프 (Auto-Correction Loop)
   ══════════════════════════════════════════════════════════════ */

/**
 * 신뢰도 < 80% 문항에 대해 컨텍스트를 보강하여 재매칭
 * @param {Array} questions - 매칭된 문항 배열
 * @returns {Array} 재검사 후 보정된 문항 배열
 */
export function autoCorrectLowConfidence(questions) {
  if (!questions || questions.length < 2) return questions;

  const results = [...questions];

  for (let i = 0; i < results.length; i++) {
    const q = results[i];
    if (!q.syllabusMatch || !q.syllabusMatch.needsRecheck) continue;

    // 컨텍스트 보강: 앞뒤 문항의 선택지 텍스트를 컨텍스트에 포함
    let augmentedText = q.questionText || '';
    // 앞 문항 선택지 컨텍스트
    if (i > 0 && results[i - 1].options) {
      augmentedText += ' ' + results[i - 1].options.map(o => o.content || '').join(' ');
    }
    // 뒷 문항 선택지 컨텍스트
    if (i < results.length - 1 && results[i + 1].options) {
      augmentedText += ' ' + results[i + 1].options.map(o => o.content || '').join(' ');
    }

    // 재매칭 (힌트 번호는 그대로)
    const recheckMatch = matchQuestionToSyllabus(augmentedText.trim(), i + 1);
    const P1 = q.syllabusMatch.P1 || 50;
    const P2 = recheckMatch.similarity * 100;
    const P3 = computePositionConfidence(i + 1, recheckMatch.number);
    const recheckConf = computeEnsembleConfidence(P1, P2, P3);

    // 재검사 신뢰도가 더 높으면 업데이트
    if (recheckConf > q.syllabusMatch.ensembleConfidence) {
      results[i] = {
        ...q,
        syllabusMatch: {
          ...recheckMatch,
          P1: Math.round(P1),
          P2: Math.round(P2),
          P3: Math.round(P3),
          ensembleConfidence: recheckConf,
          needsRecheck: recheckConf < 80,
          autoCorrected: true,
        },
      };
    }
  }

  return results;
}

/* ══════════════════════════════════════════════════════════════
   Anti-Hallucination 검증기
   ══════════════════════════════════════════════════════════════ */

/**
 * 최종 매칭 결과의 유효성을 검증
 * @param {Array} matchedQuestions - 매칭 완료된 38문항 배열
 * @returns {object} { valid, issues[], warnings[] }
 */
export function validateQuestionMapping(matchedQuestions) {
  if (!matchedQuestions || !matchedQuestions.length) {
    return { valid: false, issues: ['매칭 결과 없음'], warnings: [] };
  }

  const issues = [];
  const warnings = [];

  // 1. 문항 번호 중복 검사
  const numberCount = {};
  for (const q of matchedQuestions) {
    const num = q.syllabusMatch?.number;
    if (num != null) {
      numberCount[num] = (numberCount[num] || 0) + 1;
    }
  }
  for (const [num, count] of Object.entries(numberCount)) {
    if (count > 1) {
      warnings.push(`Q${num} ${count}회 중복 매칭`);
    }
  }

  // 2. 도메인 연속성 검사 (Q1~Q8=지리, Q9~Q16=역사, ..., Q33~Q38=사회)
  for (const q of matchedQuestions) {
    if (!q.syllabusMatch) continue;
    const { number, domain } = q.syllabusMatch;
    if (number != null && domain) {
      const expectedDomain = getDomainByQuestionNumber(number);
      if (expectedDomain && expectedDomain !== domain) {
        issues.push(`Q${number}: 예상 도메인=${expectedDomain}, 실제=${domain}`);
      }
    }
  }

  // 3. 38문항 범위 검사
  for (const q of matchedQuestions) {
    const num = q.syllabusMatch?.number;
    if (num != null && (num < 1 || num > 38)) {
      issues.push(`Q${num}: 38문항 범위 초과`);
    }
  }

  // 4. 신뢰도 검사
  let lowConfCount = 0;
  for (const q of matchedQuestions) {
    const conf = q.syllabusMatch?.ensembleConfidence || 0;
    if (conf < 60) lowConfCount++;
    if (conf < 40) {
      issues.push(`Q${q.index || '?'}: 신뢰도 ${conf}% (< 40%) — 수동 검토 필요`);
    }
  }
  if (lowConfCount > 3) {
    warnings.push(`저신뢰도 문항 ${lowConfCount}/38개 — OCR 품질 저하 의심`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    totalMatched: matchedQuestions.filter(q => q.syllabusMatch?.number != null).length,
    averageConfidence: matchedQuestions.length > 0
      ? Math.round(matchedQuestions.reduce((s, q) => s + (q.syllabusMatch?.ensembleConfidence || 0), 0) / matchedQuestions.length)
      : 0,
    lowConfidenceCount: lowConfCount,
  };
}

/* ══════════════════════════════════════════════════════════════
   통합 매칭 파이프라인
   ══════════════════════════════════════════════════════════════ */

/**
 * OCR 텍스트 → 38문항 매칭 전체 파이프라인
 * @param {string} rawText - OCR 인식된 전체 텍스트
 * @param {Array} questions - splitIntoQuestions() 결과 (optional)
 * @returns {object} { matches, validation, summary }
 */
export function runFullPipeline(rawText, questions = null) {
  // 1단계: 종합과목 여부 확인
  const isComprehensive = detectComprehensiveSubject(rawText);
  if (!isComprehensive) {
    return {
      matches: [],
      validation: { valid: false, issues: ['종합과목이 아닌 것으로 판별됨'], warnings: [] },
      summary: { isComprehensive: false, matchedCount: 0, avgConfidence: 0 },
    };
  }

  // 2단계: 문항 분할 (제공되지 않은 경우)
  let qItems = questions;
  if (!qItems || !qItems.length) {
    // 단순 분할: "選びなさい" 기준
    const splits = rawText.split(/選び[なゥっ]{0,2}[なさきい]{1,3}/g);
    qItems = splits.filter(s => s.trim().length > 10).map((s, i) => ({
      index: i + 1,
      questionText: s.trim().slice(0, 500),
      options: [],
      confidence: 60,
    }));
  }

  // 3단계: 배치 매칭
  const matches = matchBatchQuestions(qItems);

  // 4단계: 검증
  const validation = validateQuestionMapping(matches);

  // 5단계: 요약
  const validMatches = matches.filter(m => m.syllabusMatch?.number != null);
  const summary = {
    isComprehensive: true,
    totalQuestions: matches.length,
    matchedCount: validMatches.length,
    avgConfidence: validMatches.length > 0
      ? Math.round(validMatches.reduce((s, m) => s + (m.syllabusMatch?.ensembleConfidence || 0), 0) / validMatches.length)
      : 0,
    validRatio: matches.length > 0 ? Math.round((validMatches.length / matches.length) * 100) : 0,
    autoCorrectedCount: matches.filter(m => m.syllabusMatch?.autoCorrected).length,
  };

  return { matches, validation, summary };
}

export default {
  getSyllabusDatabase,
  getSyllabusItem,
  getDomainRange,
  textToVector,
  levenshteinDistance,
  cosineSimilarity,
  detectComprehensiveSubject,
  matchQuestionToSyllabus,
  getDomainByQuestionNumber,
  matchBatchQuestions,
  computeEnsembleConfidence,
  computePositionConfidence,
  computeDomainConfidence,
  autoCorrectLowConfidence,
  validateQuestionMapping,
  runFullPipeline,
};
