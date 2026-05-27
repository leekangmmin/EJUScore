// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { useState, useMemo, useCallback } from 'react';
import {
  Brain, AlertTriangle, CheckCircle2, XCircle, TrendingUp,
  BookOpen, MapPin, Globe, Landmark, BarChart3, Users,
  ArrowRight, Lightbulb, Target, Zap, Search, ClipboardList,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
   EJU 종합과목 38문항 DB — 개별 문항 독립 노드
   ═══════════════════════════════════════════════════════════════════ */

const EJU_38_QUESTIONS = [
  // ── GEOGRAPHY Q1~Q8 ──
  { number: 1, domain: 'geography', domainName: '지리', syllabusId: 'geography-natural', name: '자연환경 및 지형', subTopic: '자연환경 (기후구/지형/판구조론)', keywords: ['자연환경','지형','판의경계','화산','지진대','판구조론','조산대','해구','열점','대륙이동','습곡산맥','단층','지각변동'], hasVisual: true, visualType: '지형도' },
  { number: 2, domain: 'geography', domainName: '지리', syllabusId: 'geography-climate', name: '세계 기후구 구분', subTopic: '세계 기후구 (케펜 분류)', keywords: ['케펜','기후구','기후대','강수량','기온','식생','토양','열대','온대','냉대','건조','한대','툰드라','사바나','지중해성','서안해양성'], hasVisual: true, visualType: '기후 그래프' },
  { number: 3, domain: 'geography', domainName: '지리', syllabusId: 'geography-population', name: '세계 인구 분포', subTopic: '인구 분포 및 밀도', keywords: ['인구분포','인구밀도','도시화','아시아','아프리카','유럽','북미','인구피라미드','고령화','유소년','생산가능','도시','농촌'], hasVisual: true, visualType: '인구 피라미드' },
  { number: 4, domain: 'geography', domainName: '지리', syllabusId: 'geography-migration', name: '인구 이동 및 저출산', subTopic: '인구 이동과 저출산', keywords: ['인구이동','저출산','도시화율','다문화','이민','난민','국제이주','출생률','사망률','자연증가','사회증가','인구감소','고령사회','초고령','합계출산율'], hasVisual: true, visualType: '통계 그래프' },
  { number: 5, domain: 'geography', domainName: '지리', syllabusId: 'geography-resources', name: '자원 및 에너지', subTopic: '자원·에너지 분포와 무역', keywords: ['자원','석유','석탄','천연가스','무역','에너지','광물','식량','자급률','수출','수입','재생에너지','원자력','자원무기화'], hasVisual: true, visualType: '자원 분포도' },
  { number: 6, domain: 'geography', domainName: '지리', syllabusId: 'geography-agriculture', name: '세계 산업 및 농업', subTopic: '세계 농업과 산업', keywords: ['농업','공업','벼농사','유목','플랜테이션','식량안보','생산성','작물','목축','임업','수산업','공업지대','서비스'], hasVisual: true, visualType: '생산량 그래프' },
  { number: 7, domain: 'geography', domainName: '지리', syllabusId: 'geography-gis', name: '지리 정보 분석', subTopic: '지리 정보 시스템(GIS)', keywords: ['등고선','지도','GIS','위성','항공사진','축척','범례','고도차','지형도','수치지도','주제도','위치','공간분석','원격탐사'], hasVisual: true, visualType: '등고선 지도' },
  { number: 8, domain: 'geography', domainName: '지리', syllabusId: 'geography-projection', name: '지도 투영법 및 공간 인지', subTopic: '지도 투영법 비교', keywords: ['투영법','메르카토르','홉스','정각도법','정거도법','도법','지도','위도','경도','왜곡','적도','극','중위도','고위도'], hasVisual: true, visualType: '투영법 비교도' },
  // ── HISTORY Q9~Q16 ──
  { number: 9, domain: 'history', domainName: '역사', syllabusId: 'history-civic-revolution', name: '시민 사회 형성과 혁명', subTopic: '시민 혁명과 인권', keywords: ['영국혁명','미국독립','프랑스혁명','인권선언','시민혁명','권리장전','입헌정치','시민사회','의회','입헌군주제','자유','평등','국민주권'], hasVisual: true, visualType: '사료 이미지' },
  { number: 10, domain: 'history', domainName: '역사', syllabusId: 'history-industrial-revolution', name: '산업 혁명과 자본주의', subTopic: '산업 혁명·자본주의 성립', keywords: ['산업혁명','자본주의','기계화','노동문제','애덤스미스','자유방임','사회주의','마르크스','공장제','증기기관','철도','도시화','노동운동'], hasVisual: true, visualType: '통계 도표' },
  { number: 11, domain: 'history', domainName: '역사', syllabusId: 'history-imperialism', name: '제국주의와 아시아 침탈', subTopic: '제국주의·식민지 지배', keywords: ['제국주의','아시아','식민지','독점자본','열강','식민지쟁탈','아프리카','인도','동남아시아','청','오스만','식민지배','저항','민족운동'], hasVisual: true, visualType: '식민지 분할 지도' },
  { number: 12, domain: 'history', domainName: '역사', syllabusId: 'history-ww1', name: '제1차 세계 대전과 전후 질서', subTopic: '1차 대전·베르사유 체제', keywords: ['제1차세계대전','베르사유','국제연맹','전후질서','삼국협상','삼국동맹','참호전','독일','대공황','배상금','민족자결','위임통치','군축'], hasVisual: true, visualType: '전쟁 지도' },
  { number: 13, domain: 'history', domainName: '역사', syllabusId: 'history-great-depression', name: '대공황 및 전체주의 발흥', subTopic: '대공황·전체주의 대두', keywords: ['대공황','전체주의','블록경제','파시즘','나치즘','히틀러','무솔리니','뉴딜','케이즈','실업','인플레이션','주가폭락','공황','독재','군국주의'], hasVisual: true, visualType: '경제 그래프' },
  { number: 14, domain: 'history', domainName: '역사', syllabusId: 'history-ww2', name: '제2차 세계 대전과 전후 수습', subTopic: '2차 대전·전후 처리', keywords: ['제2차세계대전','얄타','포츠담','평화협약','추축국','연합국','노르망디','원자폭탄','일본항복','극동국제군사재판','샌프란시스코','전후처리','전범','배상'], hasVisual: true, visualType: '연표' },
  { number: 15, domain: 'history', domainName: '역사', syllabusId: 'history-cold-war', name: '냉전 체제와 다극화', subTopic: '냉전·다극화', keywords: ['냉전','마셜계획','NATO','비동맹','다극화','미소대립','핵무기','군비경쟁','데탕트','동유럽','베를린','쿠바','월남','베트남','중소분쟁'], hasVisual: true, visualType: '냉전 지도' },
  { number: 16, domain: 'history', domainName: '역사', syllabusId: 'history-japan-modern', name: '일본 근현대사 흐름', subTopic: '일본 근현대사', keywords: ['메이지유신','제국헌법','평화헌법','천황제','전후개혁','경제성장','문명개화','부국강병','다이쇼','쇼와','전후','고도성장','거품','잃어버린10년'], hasVisual: true, visualType: '연표/사료' },
  // ── POLITICS Q17~Q24 ──
  { number: 17, domain: 'politics', domainName: '정치', syllabusId: 'politics-democracy', name: '민주주의 기본 원리', subTopic: '사회 계약설과 통치론', keywords: ['사회계약','홉스','로크','루소','자연상태','통치론','일반의지','자유','평등','국민주권','저항권','정부','계약','자연법'], hasVisual: false, visualType: null },
  { number: 18, domain: 'politics', domainName: '정치', syllabusId: 'politics-human-rights', name: '인권 보장의 역사적 발전', subTopic: '인권 선언의 역사', keywords: ['마그나카르타','인권선언','바이마르','기본권','자연권','사회권','참정권','청구권','자유권','생존권','인권','시민권','사회보장','노동권','교육권'], hasVisual: false, visualType: null },
  { number: 19, domain: 'politics', domainName: '정치', syllabusId: 'politics-government', name: '정부 형태 비교 - 의회제와 대통령제', subTopic: '정부 형태 비교', keywords: ['의원내각제','대통령제','영국','미국','내각','의회','행정','입법','사법','임기','해산','탄핵','권력분립','양원제','단원제'], hasVisual: false, visualType: null },
  { number: 20, domain: 'politics', domainName: '정치', syllabusId: 'politics-japan-constitution-1', name: '일본 헌법 기본 원리', subTopic: '일본 헌법 원리', keywords: ['일본헌법','국민주권','평화주의','제9조','기본권','인간존엄','국회','내각','법원','지방자치','개헌','최고법규','조약','헌법개정','평화조항'], hasVisual: false, visualType: null },
  { number: 21, domain: 'politics', domainName: '정치', syllabusId: 'politics-japan-parliament', name: '일본 삼권 분립과 국회 구조', subTopic: '삼권 분립·국회', keywords: ['삼권분립','중의원','참의원','내각불신임','해산','의원입법','예산심의','조약비준','국무대신','수상','총리','행정부','법원','사법권','위헌심사'], hasVisual: false, visualType: null },
  { number: 22, domain: 'politics', domainName: '정치', syllabusId: 'politics-election', name: '선거 제도 및 지방 자치', subTopic: '선거·지방 자치', keywords: ['선거','소선거구','비례대표','지방분권','지방자치','투표','공직선거','참정권','정당','비례대표제','중선거구','의석','정치자금','지방의회','자치단체'], hasVisual: false, visualType: null },
  { number: 23, domain: 'politics', domainName: '정치', syllabusId: 'politics-international-order', name: '국제 정치와 동맹 질서', subTopic: '국제 정치 구조', keywords: ['주권','국제연맹','국제연합','UN','안전보장','이사회','총회','국제사법','국제기구','NGO','국제조약','주권국가','평화유지','제재','결의'], hasVisual: false, visualType: null },
  { number: 24, domain: 'politics', domainName: '정치', syllabusId: 'politics-un-humanrights', name: 'UN 안보리와 인권 조약', subTopic: 'UN·인권 조약', keywords: ['안전보장이사회','거부권','상임이사국','인권조약','국제법','국제사법재판소','국제인권규약','사회권규약','자유권규약','난민협약','기후변화협약','국제형사','ICJ','PKO','제재'], hasVisual: false, visualType: null },
  // ── ECONOMICS Q25~Q32 ──
  { number: 25, domain: 'economy', domainName: '경제', syllabusId: 'economy-supply-demand', name: '시장 경제와 수요공급 탄력성', subTopic: '수요·공급 탄력성', keywords: ['수요','공급','탄력성','균형가격','한계효용','수요곡선','공급곡선','변곡점','가격탄력성','소득탄력성','대체재','보완재','정상재','열등재','시장'], hasVisual: true, visualType: '수요공급 곡선' },
  { number: 26, domain: 'economy', domainName: '경제', syllabusId: 'economy-market-failure', name: '시장 실패와 외부 효과', subTopic: '시장 실패·외부 효과', keywords: ['시장실패','외부효과','독과점','공공재','무임승차','공해','환경오염','정보비대칭','역선택','도덕적해이','규제','정부실패','과점','독점','공정거래'], hasVisual: false, visualType: null },
  { number: 27, domain: 'economy', domainName: '경제', syllabusId: 'economy-gdp', name: '국민 소득과 거시 지표', subTopic: '국민 소득·GDP', keywords: ['GDP','명목','실질','GNP','국민소득','경제성장률','1인당','구매력','지니계수','경제후생','순국민','국내총생산','국민총소득','3면등가','부가가치'], hasVisual: true, visualType: 'GDP 그래프' },
  { number: 28, domain: 'economy', domainName: '경제', syllabusId: 'economy-inflation', name: '인플레이션과 통화 정책', subTopic: '인플레이션·통화 정책', keywords: ['인플레이션','디플레이션','통화정책','물가','소비자물가','일본은행','금리','통화량','재정정책','기준금리','양적완화','긴축','확장','스태그플레이션','지급준비'], hasVisual: true, visualType: '금리 그래프' },
  { number: 29, domain: 'economy', domainName: '경제', syllabusId: 'economy-trade', name: '국제 무역과 비교 우위', subTopic: '국제 무역 이론', keywords: ['국제무역','비교우위','리카도','무역장벽','WTO','FTA','관세','쿼터','자유무역','보호무역','수출진흥','수입대체','다자간협상','지역협정','통상'], hasVisual: true, visualType: '무역 그래프' },
  { number: 30, domain: 'economy', domainName: '경제', syllabusId: 'economy-forex', name: '환율 변동과 외환 시장', subTopic: '환율·외환 시장', keywords: ['환율','엔고','엔저','외환','달러','엔화','수출','수입','손익분기','통화가치','환율변동','고정환율','변동환율','구매력평가','이자율평가'], hasVisual: true, visualType: '환율 그래프' },
  { number: 31, domain: 'economy', domainName: '경제', syllabusId: 'economy-japan-history', name: '일본 경제사 - 전후부터 거품까지', subTopic: '일본 경제사', keywords: ['전후복구','고도경제성장','거품경제','불황','잃어버린10년','저성장','경제거품','주가','부동산','토지','오일쇼크','안정성장','엔고불황','구조개혁'], hasVisual: true, visualType: '경제 성장률 그래프' },
  { number: 32, domain: 'economy', domainName: '경제', syllabusId: 'economy-abenomics', name: '아베노믹스와 현대 금융', subTopic: '아베노믹스·금융 정책', keywords: ['아베노믹스','3개의화살','양적완화','재정건전성','통화','금융완화','소비세','재정지출','성장전략','구조개혁','물가목표','2%','국채','재정적자','GDP'], hasVisual: true, visualType: '경제 지표 그래프' },
  // ── SOCIETY Q33~Q38 ──
  { number: 33, domain: 'society', domainName: '사회', syllabusId: 'society-aging', name: '저출산과 고령화', subTopic: '저출산·고령화 문제', keywords: ['저출산','고령화','노동인구','사회보장','연금','의료','개호','일가정양립','여성취업','육아','인구감소','생산연령','부양비','노년부양','출생아'], hasVisual: true, visualType: '인구 피라미드' },
  { number: 34, domain: 'society', domainName: '사회', syllabusId: 'society-welfare', name: '사회 보장 제도 변천', subTopic: '사회 보장 제도', keywords: ['사회보험','공적부조','복지서비스','연금','의료보험','개호보험','국민연금','후생연금','건강보험','실업보험','산재','복지재정','보험료','국고부담','사회복지'], hasVisual: true, visualType: '보험 재정 그래프' },
  { number: 35, domain: 'society', domainName: '사회', syllabusId: 'society-labor', name: '현대 노동 환경과 노동법', subTopic: '노동 환경·노동법', keywords: ['노동법','노동3권','비정규직','근로기준법','최저임금','노동시간','해고','차별','노동조합','단체교섭','쟁의권','파견','계약직','정규직','워라밸'], hasVisual: false, visualType: null },
  { number: 36, domain: 'society', domainName: '사회', syllabusId: 'society-climate', name: '지구 환경 이슈와 기후 협약', subTopic: '기후 변화·환경 협약', keywords: ['기후변화','교토의정서','파리협약','이산화탄소','삭감','탄소배출','지구온난화','넷제로','환경협약','온실가스','기후','CO2','탄소세','배출권','국제환경'], hasVisual: true, visualType: 'CO2 배출량 그래프' },
  { number: 37, domain: 'society', domainName: '사회', syllabusId: 'society-energy', name: '자원 및 에너지 보전 대책', subTopic: '에너지·자원 보전', keywords: ['신재생에너지','화석연료','에너지','자원보전','태양광','풍력','원자력','수력','바이오매스','지열','연료전지','수소','에너지전환','탈원전','RE100'], hasVisual: true, visualType: '에너지 비중 그래프' },
  { number: 38, domain: 'society', domainName: '사회', syllabusId: 'society-global-governance', name: '글로벌 거버넌스와 NGO', subTopic: '글로벌 거버넌스', keywords: ['NGO','NPO','국제연대','인도적구호','거버넌스','시민사회','국제개발','ODA','원조','난민구호','자원봉사','국제협력','지속가능','개발목표','글로벌시민'], hasVisual: false, visualType: null },
];

/* ── Domain metadata ── */
const DOMAIN_META = {
  geography: { label: '지리', icon: '🌍', range: 'Q1~Q8', color: '#10b981', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))' },
  history:   { label: '역사', icon: '📜', range: 'Q9~Q16', color: '#8b5cf6', gradient: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))' },
  politics:  { label: '정치', icon: '🏛', range: 'Q17~Q24', color: '#3b82f6', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))' },
  economy:   { label: '경제', icon: '📊', range: 'Q25~Q32', color: '#f59e0b', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))' },
  society:   { label: '사회', icon: '🤝', range: 'Q33~Q38', color: '#ec4899', gradient: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(236,72,153,0.04))' },
};

/* ── Error type classification ── */
const ERROR_TYPES = [
  { id: 'concept', label: '개념 혼동', description: '유사 개념을 착각하여 선택한 경우', icon: '🔄' },
  { id: 'source',  label: '사료 해석 오류', description: '지문/사료/헌법 조문을 잘못 읽은 경우', icon: '📖' },
  { id: 'graph',   label: '그래프 변곡점 오판', description: '수치/그래프/통계의 변곡점을 오독한 경우', icon: '📈' },
  { id: 'system',  label: '제도 구조 이해 부족', description: '정치/경제 제도의 작동 원리를 이해하지 못한 경우', icon: '🏗' },
];

/* ── Error type detection engine ── */
function detectErrorType(question, chosenAnswer, correctAnswer, reason) {
  const r = reason + ' ' + (chosenAnswer || '') + ' ' + (correctAnswer || '');
  const visual = question.hasVisual;

  // Graph misjudgment: visual questions + numeric/misread keywords
  if (visual && (/그래프|곡선|변곡|수치|증가|감소|기울기|교차|탄력|한계|균형|최대|최소|치|값|수|률|율|량/i.test(r) || /숫자|수치|오독|방향|증감/i.test(r))) {
    return 'graph';
  }
  // Source interpretation: history/politics with document keywords
  if ((question.domain === 'history' || question.domain === 'politics') && /사료|문서|조약|헌법|법률|조문|선언|규약|헌장|연설|기록|발췌|인용|원문/i.test(r)) {
    return 'source';
  }
  // System understanding: politics/economy with structure keywords
  if ((question.domain === 'politics' || question.domain === 'economy') && /제도|구조|체계|절차|과정|기관|권한|역할|구성|조직|체제|시스템|메커니즘/i.test(r)) {
    return 'system';
  }
  // Concept confusion: similarity keywords
  if (/혼동|착각|비슷|유사|헷갈|구분|차이|구별|대비|비교|까먹|기억|연상|착오/i.test(r)) {
    return 'concept';
  }
  // Default: concept confusion
  return 'concept';
}

/* ── Knowledge structure tree generator ── */
function generateMindMap(weakDomains, wrongItems) {
  const tree = {};
  for (const [domainId, stats] of Object.entries(weakDomains)) {
    if (stats.count === 0) continue;
    const dm = DOMAIN_META[domainId];
    const domainQuestions = EJU_38_QUESTIONS.filter(q => q.domain === domainId);
    const wrongForDomain = wrongItems.filter(w => {
      const q = EJU_38_QUESTIONS.find(x => x.number === w.questionNumber);
      return q && q.domain === domainId;
    });
    const errorTypes = [...new Set(wrongForDomain.map(w => w.errorType))];
    tree[domainId] = {
      label: dm.label,
      icon: dm.icon,
      errorCount: stats.count,
      errorTypes,
      subTopics: domainQuestions.map(q => ({
        number: q.number,
        name: q.name,
        wrong: wrongForDomain.some(w => w.questionNumber === q.number),
      })),
    };
  }
  return tree;
}

/* ── Priority generator ── */
function generatePriorities(weakDomains, errorTypeCounts) {
  const sorted = Object.entries(weakDomains)
    .filter(([, s]) => s.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  if (sorted.length === 0) return [];

  const topDomain = sorted[0];
  const dm = DOMAIN_META[topDomain[0]];

  const priorities = [];

  // Priority 1: Most frequent error type in the weakest domain
  const topErrors = Object.entries(errorTypeCounts)
    .sort((a, b) => b[1] - a[1]);
  const topErrorType = topErrors.length > 0
    ? ERROR_TYPES.find(e => e.id === topErrors[0][0])
    : ERROR_TYPES[0];

  const topWrongItems = sorted[0][1].items || [];
  const topQNumbers = topWrongItems.map(w => w.questionNumber).slice(0, 3);

  priorities.push({
    rank: 1,
    title: `${dm.label} — ${topErrorType ? topErrorType.label : '취약'} 집중 복습`,
    detail: `${dm.label} 영역(${dm.range})에서 ${topDomain[1].count}개의 오답이 발생했습니다. 특히 ${topErrorType ? topErrorType.label : ''} 유형이 지배적입니다.`,
    action: `${topQNumbers.length > 0 ? topQNumbers.join('번, ') : '해당'}번 문항의 개념을 재정립하고, 유사 문제 5개를 추가로 풀어보세요.`,
    link: `#${topDomain[0]}`,
    icon: Target,
  });

  // Priority 2: Second weakest domain
  if (sorted.length >= 2) {
    const second = sorted[1];
    const dm2 = DOMAIN_META[second[0]];
    const secondItems = second[1].items || [];
    const secondQNumbers = secondItems.map(w => w.questionNumber).slice(0, 3);
    priorities.push({
      rank: 2,
      title: `${dm2.label} — 보완 학습 필요`,
      detail: `${dm2.label} 영역(${dm2.range})에서 ${second[1].count}개의 오답이 발생했습니다. ${secondQNumbers.length > 0 ? secondQNumbers.join('번, ') : '해당'}번 문항을 중심으로 복습하세요.`,
      action: `${dm2.label}의 핵심 개념을 마인드맵으로 정리하고, 오답 유형별로 분류하여 취약점을 파악하세요.`,
      link: `#${second[0]}`,
      icon: BookOpen,
    });
  }

  // Priority 3: Cross-domain integrated review
  const allDomains = sorted.map(([id]) => DOMAIN_META[id]?.label).filter(Boolean);
  if (allDomains.length >= 2) {
    priorities.push({
      rank: 3,
      title: '전 영역 통합 복습 — 연계성 강화',
      detail: `${allDomains.slice(0, -1).join(', ')}${allDomains.length > 1 ? ', ' : ''}${allDomains.slice(-1)} 영역이 연계되었습니다. 종합과목은 개별 과목의 경계를 넘나드는 통합적 사고가 필요합니다.`,
      action: '영역 간 연계 문제(예: 지리-경제 자원무역, 역사-정치 제도 비교)를集中적으로 풀어보고, 각 사건이 다른 영역에 미친 영향을 설명하는 연습을 하세요.',
      icon: TrendingUp,
    });
  }

  return priorities;
}

/* ── Summary sentence generator ── */
function generateSummary(weakDomains, totalWrong, errorTypeCounts, wrongItems) {
  const sorted = Object.entries(weakDomains).filter(([, s]) => s.count > 0).sort((a, b) => b[1].count - a[1].count);
  if (sorted.length === 0) return '아직 오답 데이터가 없습니다. 오답을 입력하면 AI가 맞춤형 진단을 제공합니다.';

  const topDomain = DOMAIN_META[sorted[0][0]];
  const topPct = Math.round((sorted[0][1].count / totalWrong) * 100);
  const topError = Object.entries(errorTypeCounts).sort((a, b) => b[1] - a[1]);
  const topErrorLabel = topError.length > 0 ? (ERROR_TYPES.find(e => e.id === topError[0][0])?.label || '') : '';
  const secondDomain = sorted.length >= 2 ? DOMAIN_META[sorted[1][0]] : null;

  let sentence = `총 ${totalWrong}개의 오답 중 `;
  sentence += `${topDomain.label} 영역이 ${topPct}%(${sorted[0][1].count}개)로 가장 높은 오답률을 보이며, `;
  if (topErrorLabel) sentence += `주요 오답 유형은 '${topErrorLabel}'입니다. `;
  if (secondDomain) sentence += `${secondDomain.label} 영역(${sorted[1][1].count}개)도 추가 취약 영역으로 확인됩니다. `;
  sentence += '아래 분석 결과를 바탕으로 맞춤형 학습을 진행하세요.';

  return sentence;
}

/* ═══════════════════════════════════════════════════════════════════
   진단 결과 출력 카드 컴포넌트
   ═══════════════════════════════════════════════════════════════════ */

function SummaryCard({ summary }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 24, padding: 24, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Brain size={22} color="#fff" strokeWidth={1.8} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', letterSpacing: '-0.015em' }}>진단 결과</div>
        <div style={{ fontSize: 13, color: 'var(--t1)', marginTop: 6, lineHeight: 1.7, fontWeight: 400 }}>{summary}</div>
      </div>
    </div>
  );
}

function DetailedTable({ wrongItems }) {
  const domainOrder = ['geography', 'history', 'politics', 'economy', 'society'];
  const grouped = {};
  for (const item of wrongItems) {
    const q = EJU_38_QUESTIONS.find(x => x.number === item.questionNumber);
    const domain = q ? q.domain : 'unknown';
    if (!grouped[domain]) grouped[domain] = [];
    grouped[domain].push({ ...item, question: q });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {domainOrder.map(dId => {
        const items = grouped[dId];
        if (!items || items.length === 0) return null;
        const dm = DOMAIN_META[dId];
        return (
          <div key={dId} style={{ borderRadius: 20, border: '1px solid var(--bd0)', overflow: 'hidden', background: dm.gradient }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--bd0)' }}>
              <span style={{ fontSize: 18 }}>{dm.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)' }}>{dm.label}</span>
              <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 4 }}>{dm.range}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: dm.color, background: `${dm.color}15`, padding: '3px 9px', borderRadius: 7 }}>{items.length}개 오답</span>
            </div>
            <div style={{ padding: '12px 18px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bd0)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--t3)', fontWeight: 600, whiteSpace: 'nowrap' }}>문항</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--t3)', fontWeight: 600, whiteSpace: 'nowrap' }}>주제</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--t3)', fontWeight: 600, whiteSpace: 'nowrap' }}>선택 답안</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--t3)', fontWeight: 600, whiteSpace: 'nowrap' }}>정답</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--t3)', fontWeight: 600, whiteSpace: 'nowrap' }}>오답 유형</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--t3)', fontWeight: 600, whiteSpace: 'nowrap' }}>사유</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const et = ERROR_TYPES.find(e => e.id === item.errorType);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bd0)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--t0)', fontWeight: 600, whiteSpace: 'nowrap' }}>Q{item.questionNumber}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--t1)', whiteSpace: 'nowrap' }}>{item.question?.name || '-'}</td>
                        <td style={{ padding: '8px 10px', color: '#ef4444' }}>{item.chosenAnswer || '-'}</td>
                        <td style={{ padding: '8px 10px', color: '#10b981', fontWeight: 600 }}>{item.correctAnswer || '-'}</td>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: item.errorType === 'graph' ? 'rgba(245,158,11,0.12)' : item.errorType === 'source' ? 'rgba(139,92,246,0.12)' : item.errorType === 'system' ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)', color: item.errorType === 'graph' ? '#f59e0b' : item.errorType === 'source' ? '#8b5cf6' : item.errorType === 'system' ? '#3b82f6' : '#ef4444' }}>{et?.label || item.errorType}</span>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--t3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.reason || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MindMapTree({ tree }) {
  const domainIds = Object.keys(tree);
  if (domainIds.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {domainIds.map(dId => {
        const node = tree[dId];
        const dm = DOMAIN_META[dId];
        return (
          <div key={dId} style={{ borderRadius: 20, border: '1px solid var(--bd0)', overflow: 'hidden', background: dm.gradient }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--bd0)' }}>
              <span style={{ fontSize: 18 }}>{node.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)' }}>{node.label}</span>
              <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 4 }}>(오답 {node.errorCount}개)</span>
              {node.errorTypes.map(et => {
                const etMeta = ERROR_TYPES.find(e => e.id === et);
                return etMeta ? (
                  <span key={et} style={{ marginLeft: 6, fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)', fontWeight: 500 }}>{etMeta.label}</span>
                ) : null;
              })}
            </div>
            <div style={{ padding: '12px 18px 14px' }}>
              {node.subTopics.map(st => (
                <div key={st.number} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, color: st.wrong ? '#ef4444' : 'var(--t2)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: st.wrong ? '#ef4444' : 'var(--bd1)', flexShrink: 0 }} />
                  <span style={{ fontWeight: st.wrong ? 600 : 400 }}>Q{st.number}. {st.name}</span>
                  {st.wrong && <XCircle size={12} color="#ef4444" style={{ flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PriorityList({ priorities }) {
  if (priorities.length === 0) return null;
  const rankColors = ['#6366f1', '#3b82f6', '#10b981'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {priorities.map(p => {
        const Icon = p.icon;
        return (
          <div key={p.rank} style={{ borderRadius: 20, border: '1px solid var(--bd0)', overflow: 'hidden', background: 'var(--card-bg)' }}>
            <div style={{ padding: 16, display: 'flex', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${rankColors[p.rank - 1]}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: rankColors[p.rank - 1] }}>{p.rank}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={16} color={rankColors[p.rank - 1]} strokeWidth={2} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t0)' }}>{p.title}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 6, lineHeight: 1.6 }}>{p.detail}</div>
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', letterSpacing: '-0.01em' }}>실행 액션</div>
                  <div style={{ fontSize: 12, color: 'var(--t1)', marginTop: 4, lineHeight: 1.6 }}>{p.action}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

const TOSS_CARD = { background: 'var(--card-bg)', border: '1px solid var(--bd0)', borderRadius: 24, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.01), 0 12px 32px rgba(0,0,0,0.03)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' };
const BADGE_BASE = { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 9px', borderRadius: 8, fontSize: 10, fontWeight: 700, letterSpacing: '-0.015em' };

export default function DiagnosticReport({ exams = [] }) {
  // ── Input state ──
  const [inputs, setInputs] = useState([{ questionNumber: '', chosenAnswer: '', correctAnswer: '', reason: '' }]);
  const [results, setResults] = useState(null);
  const [showDetails, setShowDetails] = useState(true);

  // ── Add/remove input rows ──
  const addRow = useCallback(() => {
    setInputs(prev => [...prev, { questionNumber: '', chosenAnswer: '', correctAnswer: '', reason: '' }]);
  }, []);
  const removeRow = useCallback((idx) => {
    setInputs(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }, []);
  const updateRow = useCallback((idx, field, value) => {
    setInputs(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }, []);

  // ── Run diagnosis ──
  const runDiagnosis = useCallback(() => {
    const validInputs = inputs.filter(inp => inp.questionNumber && inp.correctAnswer);
    if (validInputs.length === 0) return;

    const wrongItems = [];
    for (const inp of validInputs) {
      const qNum = parseInt(inp.questionNumber);
      if (isNaN(qNum) || qNum < 1 || qNum > 38) continue;
      const question = EJU_38_QUESTIONS.find(q => q.number === qNum);
      if (!question) continue;
      const errorType = detectErrorType(question, inp.chosenAnswer, inp.correctAnswer, inp.reason);
      wrongItems.push({ questionNumber: qNum, chosenAnswer: inp.chosenAnswer, correctAnswer: inp.correctAnswer, reason: inp.reason, errorType, question });
    }

    if (wrongItems.length === 0) return;

    // Per-domain aggregation
    const weakDomains = {};
    const errorTypeCounts = {};
    for (const item of wrongItems) {
      const domain = item.question.domain;
      weakDomains[domain] = weakDomains[domain] || { count: 0, items: [] };
      weakDomains[domain].count++;
      weakDomains[domain].items.push(item);
      errorTypeCounts[item.errorType] = (errorTypeCounts[item.errorType] || 0) + 1;
    }

    const totalWrong = wrongItems.length;

    // Generate all outputs
    const mindMap = generateMindMap(weakDomains, wrongItems);
    const priorities = generatePriorities(weakDomains, errorTypeCounts);
    const summary = generateSummary(weakDomains, totalWrong, errorTypeCounts, wrongItems);

    setResults({ wrongItems, weakDomains, errorTypeCounts, totalWrong, mindMap, priorities, summary });
  }, [inputs]);

  // ── Error type distribution ──
  const errorDist = useMemo(() => {
    if (!results) return [];
    return Object.entries(results.errorTypeCounts)
      .map(([id, count]) => ({ id, ...ERROR_TYPES.find(e => e.id === id), count }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [results]);

  // ── Prefill from exam data ──
  const extractFromExams = useCallback(() => {
    if (!exams || exams.length === 0) return;
    const mistakes = [];
    for (const exam of exams) {
      if (exam.comprehensive?.mistakes) {
        for (const m of exam.comprehensive.mistakes) {
          if (m.questionNumber) {
            mistakes.push({
              questionNumber: String(m.questionNumber),
              chosenAnswer: m.chosen || '',
              correctAnswer: m.correct || '',
              reason: m.reason || '',
            });
          }
        }
      }
    }
    if (mistakes.length > 0) {
      setInputs(mistakes);
    }
  }, [exams]);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: 20, letterSpacing: '-0.015em' }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.25)' }}>
          <ClipboardList size={22} color="#fff" strokeWidth={1.8} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t0)', letterSpacing: '-0.02em' }}>EJU 종합과목 오답 정밀 진단</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>AI가 분석하는 맞춤형 오답 리포트 — 개념 혼동부터 학습 우선순위까지</div>
        </div>
      </div>

      {/* ═══ INPUT FORM ═══ */}
      <div style={TOSS_CARD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Search size={16} color="#6366f1" strokeWidth={2} /></div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>오답 입력</span>
          {exams.length > 0 && (
            <button onClick={extractFromExams} style={{ marginLeft: 'auto', fontSize: 11, padding: '6px 12px', borderRadius: 9, border: '1px solid var(--bd1)', background: 'transparent', color: 'var(--t2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              시험 기록에서 가져오기
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {inputs.map((inp, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number" min={1} max={38} placeholder="문항 번호"
                value={inp.questionNumber}
                onChange={e => updateRow(idx, 'questionNumber', e.target.value)}
                style={{ width: 70, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--bd1)', background: 'var(--bg2)', color: 'var(--t0)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
              />
              <input
                type="text" placeholder="선택한 답"
                value={inp.chosenAnswer}
                onChange={e => updateRow(idx, 'chosenAnswer', e.target.value)}
                style={{ width: 90, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--bd1)', background: 'var(--bg2)', color: 'var(--t0)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
              />
              <input
                type="text" placeholder="정답"
                value={inp.correctAnswer}
                onChange={e => updateRow(idx, 'correctAnswer', e.target.value)}
                style={{ width: 90, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--bd1)', background: 'var(--bg2)', color: 'var(--t0)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
              />
              <select
                value={inp.reason}
                onChange={e => updateRow(idx, 'reason', e.target.value)}
                style={{ flex: 1, minWidth: 120, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--bd1)', background: 'var(--bg2)', color: 'var(--t0)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
              >
                <option value="">오답 이유 선택</option>
                <option value="유사 개념과 혼동함">개념 혼동 — 유사 개념과 착각</option>
                <option value="지문/사료를 잘못 해석함">사료 해석 오류 — 지문/사료 오독</option>
                <option value="그래프 변곡점을 오판함">그래프 변곡점 오판 — 수치 오독</option>
                <option value="제도/구조 이해가 부족함">제도 구조 이해 부족 — 원리 미숙지</option>
                <option value="단순 암기 부족">단순 암기 부족</option>
                <option value="시간 부족으로 찍음">시간 부족으로 추측</option>
              </select>
              {inputs.length > 1 && (
                <button onClick={() => removeRow(idx)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>x</button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={addRow} style={{ padding: '9px 16px', borderRadius: 12, border: '1px solid var(--bd1)', background: 'transparent', color: 'var(--t2)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 500 }}>
            + 문항 추가
          </button>
          <button onClick={runDiagnosis} className="btn-toss-bounce" style={{ padding: '9px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>
            <Zap size={14} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
            진단 시작
          </button>
        </div>

        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)', fontSize: 11, color: 'var(--t3)', lineHeight: 1.6 }}>
          <strong style={{ color: '#6366f1' }}>진단 대상:</strong> 종합과목 38문항 전범위 (지리 Q1~8, 역사 Q9~16, 정치 Q17~24, 경제 Q25~32, 사회 Q33~38)
        </div>
      </div>

      {/* ═══ RESULTS ═══ */}
      {results && (
        <>
          {/* Summary */}
          <SummaryCard summary={results.summary} />

          {/* Error type distribution */}
          {errorDist.length > 0 && (
            <div style={TOSS_CARD}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)', marginBottom: 14, letterSpacing: '-0.015em' }}>오답 유형 분포</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {errorDist.map(et => {
                  const pct = Math.round((et.count / results.totalWrong) * 100);
                  return (
                    <div key={et.id} style={{ flex: '1 0 140px', padding: '12px 14px', borderRadius: 14, border: '1px solid var(--bd0)', background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 500 }}>{et.icon} {et.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t0)', letterSpacing: '-0.02em' }}>{et.count}<span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400, marginLeft: 4 }}>/{results.totalWrong}</span></div>
                      <div style={{ height: 4, borderRadius: 3, background: 'var(--bd0)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Area-by-area detailed analysis */}
          <div style={TOSS_CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={16} color="#10b981" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>영역별 오답 상세 분석</span>
              <button onClick={() => setShowDetails(v => !v)} style={{ marginLeft: 'auto', fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--bd1)', background: 'transparent', color: 'var(--t3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {showDetails ? '접기' : '펼치기'}
              </button>
            </div>
            {showDetails && <DetailedTable wrongItems={results.wrongItems} />}
          </div>

          {/* Knowledge structure tree (Mind-map) */}
          <div style={TOSS_CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lightbulb size={16} color="#f59e0b" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>지식 구조화 트리 (Mind-map)</span>
            </div>
            <MindMapTree tree={results.mindMap} />
          </div>

          {/* Priority review list */}
          <div style={TOSS_CARD}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(236,72,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={16} color="#ec4899" strokeWidth={2} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t0)' }}>다음 학습을 위한 우선순위</span>
            </div>
            <PriorityList priorities={results.priorities} />
          </div>

          {/* Reset */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => { setResults(null); setInputs([{ questionNumber: '', chosenAnswer: '', correctAnswer: '', reason: '' }]); }} style={{ padding: '10px 24px', borderRadius: 14, border: '1px solid var(--bd1)', background: 'transparent', color: 'var(--t3)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 500 }}>
              진단 초기화
            </button>
          </div>
        </>
      )}

      {/* ═══ EMPTY STATE (no results yet) ═══ */}
      {!results && (
        <div style={{ ...TOSS_CARD, textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList size={28} color="#6366f1" strokeWidth={1.5} style={{ opacity: 0.5 }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t0)', marginTop: 4 }}>오답 데이터를 입력해주세요</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.6, maxWidth: 320 }}>
            위 입력 폼에 시험에서 틀린 문항 번호와 선택한 답안, 정답을 입력하면<br />
            AI가 4가지 오답 유형(개념 혼동/사료 해석 오류/그래프 변곡점 오판/제도 구조 이해 부족)으로 분류하고<br />
            맞춤형 학습 우선순위를 제공합니다.
          </div>
        </div>
      )}

      {/* ═══ CSS ═══ */}
      <style>{`
        .btn-toss-bounce { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .btn-toss-bounce:hover { transform: scale(1.015); }
        .btn-toss-bounce:active { transform: scale(0.95); opacity: 0.85; }
      `}</style>
    </div>
  );
}
