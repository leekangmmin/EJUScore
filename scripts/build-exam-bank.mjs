import fs from 'fs';

/* ═══════════ 종합과목 분류기 (앱 subjectClassifier.js와 동일 키워드) ═══════════ */
const KW = {
  geography: { strong: ['次の地図','地図中','地形図','雨温図','ケッペン','気候区','緯度','経度','標準時','時差','降水量','プレート','造山','三角州','扇状地','リアス','海流','モンスーン','人口ピラミッド','過疎','過密','鉄鉱石','原油産出','排他的経済水域','プランテーション','焼畑','地中海性気候','サバナ気候','ステップ気候','ツンドラ','針葉樹林','等高線','本初子午線','大陸棚'],
    weak: ['地図','気候','地形','都市化','鉱産','山脈','平野','大陸','貿易風','砂漠','流域','半島','諸島','灌漑','輸出品'] },
  history: { strong: ['第一次世界大戦','第二次世界大戦','フランス革命','産業革命','ロシア革命','市民革命','名誉革命','宗教改革','ルネサンス','十字軍','植民地支配','帝国主義','絶対王政','明治維新','辛亥革命','独立宣言','ナポレオン','ヒトラー','ナチス','ベルサイユ条約','ウィーン会議','大航海時代','奴隷貿易','冷戦','東西冷戦','ヤルタ','ポツダム'],
    weak: ['革命','帝国','独立運動','王朝','近代化','古代','中世','文明','王国','侵略','併合','19世紀','18世紀'] },
  politics: { strong: ['三権分立','立法権','行政権','司法権','違憲審査','国民主権','基本的人権','社会権','参政権','比例代表','小選挙区','議院内閣制','大統領制','連邦制','国際連合','安全保障理事会','拒否権','国連総会','法の支配','法治主義','日本国憲法','人権宣言','普通選挙','地方自治'],
    weak: ['政治','民主主義','選挙','立法','行政','司法','主権','国連','政府','首相','与党','野党','政党','議会','内閣','国会'] },
  economy: { strong: ['需要曲線','供給曲線','国内総生産','インフレーション','デフレーション','財政政策','金融政策','中央銀行','為替相場','円高','円安','自由貿易','保護貿易','比較優位','市場経済','独占','寡占','失業率','国際収支','ケインズ','マルクス','アダム・スミス','累進課税','社会保障給付','需給','均衡価格','機会費用','GDP','GNP'],
    weak: ['経済','市場','貿易','財政','金融','金利','物価','株価','企業','所得','価格','投資','消費','輸出','輸入'] },
  society: { strong: ['少子高齢化','高齢化社会','少子化','社会保障制度','年金制度','介護保険','地球温暖化','再生可能エネルギー','持続可能な開発','京都議定書','パリ協定','情報社会','グローバル化','多文化共生','男女共同参画','ジェンダー','生物多様性','循環型社会','SDGs'],
    weak: ['環境問題','福祉','高齢者','エネルギー','移民','多文化','情報化','格差','差別','地域社会','人口減少','NGO','NPO'] },
};
const PRI = ['economy','politics','history','geography','society'];
function classify(s) {
  const sc = { economy:0,politics:0,history:0,geography:0,society:0 };
  for (const subj of PRI) { for (const k of KW[subj].strong) if (s.includes(k)) sc[subj]+=3; for (const k of KW[subj].weak) if (s.includes(k)) sc[subj]+=1; }
  let best='unknown',bv=0; for (const subj of PRI) if (sc[subj]>bv){bv=sc[subj];best=subj;}
  return bv>0?best:'unknown';
}
const DAEMUN = /[問間](?:\s|　)?[0-9０-９一二三四五六七八九]/;
function splitJongkwa(rawText) {
  if (!rawText) return [];
  const t = rawText.replace(/──────/g,'\n').replace(/総合科目\s*[ー\-]?\s*\d+/g,'\n').replace(/[一ー]\s*\d{2,3}\s*[一ー]/g,'\n');
  const SEL=/選び[なゥっ]{0,2}[なさきい]{1,3}/g; const bounds=[]; let m;
  while((m=SEL.exec(t))!==null) bounds.push({s:m.index,e:m.index+m[0].length});
  if (bounds.length<3) return [];
  function parseOpts(win){ const re=/[①②③④]/g; const hits=[]; let mm; while((mm=re.exec(win))!==null) hits.push({sym:mm[0],i:mm.index});
    const opts=[]; let last=0; const seen=new Set();
    for(let k=0;k<hits.length;k++){ const sym=hits[k].sym; if(seen.has(sym)){if(seen.size>=4)break;else continue;} seen.add(sym);
      const start=hits[k].i+1; const end=k+1<hits.length?hits[k+1].i:win.length; opts.push(win.slice(start,end)); last=end; if(seen.size>=4)break; }
    return {n:opts.length, after:last, txt:opts.join(' ')}; }
  const raw=[]; let cursor=0;
  for(let k=0;k<bounds.length;k++){ const b=bounds[k]; const stemFull=t.slice(cursor,b.s); const stem=stemFull.replace(/\s+/g,' ').trim();
    const winEnd=k+1<bounds.length?bounds[k+1].s:t.length; const win=t.slice(b.e,winEnd); const o=parseOpts(win); cursor=b.e+o.after;
    if(stem.length<8 && o.n<2) continue;
    const ctxBefore=t.slice(Math.max(0,b.s-700),b.s).replace(/\s+/g,' ');
    raw.push({subject:classify(ctxBefore+' '+stem+' '+o.txt), newDae:DAEMUN.test(stemFull)}); }
  let last='unknown';
  for(let i=0;i<raw.length;i++){ if(raw[i].newDae) last='unknown'; if(raw[i].subject!=='unknown') last=raw[i].subject; else if(last!=='unknown') raw[i].subject=last; }
  let next='unknown';
  for(let i=raw.length-1;i>=0;i--){ if(raw[i].subject!=='unknown') next=raw[i].subject; else if(next!=='unknown'&&!raw[i].newDae) raw[i].subject=next; if(raw[i].newDae) next=raw[i].subject!=='unknown'?raw[i].subject:'unknown'; }
  return raw.map(q=>q.subject);
}

/* ═══════════ 수학 코스1 토픽 분류기 (大問 단위 토픽 존재 빈도) ═══════════ */
const MATH_TOPICS = {
  quadratic: { name:'이차함수', kw:['二次関数','放物線','頂点','y=ax','x^2','判別式','最大値','最小値'] },
  prob:      { name:'경우의 수·확률', kw:['確率','場合の数','順列','組合せ','期待値','サイコロ','硬貨','取り出','並べ'] },
  trig:      { name:'삼각비·도형계량', kw:['三角比','正弦定理','余弦定理','sin','cos','tan','内接円','外接円','面積'] },
  setlogic:  { name:'집합·명제', kw:['集合','命題','必要条件','十分条件','補集合','要素','ド・モルガン'] },
  integer:   { name:'정수의 성질', kw:['整数','約数','倍数','素数','公約数','公倍数','余り','ユークリッド'] },
  data:      { name:'데이터 분석', kw:['データ','平均値','分散','標準偏差','中央値','箱ひげ','相関','四分位'] },
  figure:    { name:'도형의 성질', kw:['円周角','接線','方べき','チェバ','メネラウス','相似','合同'] },
  numexpr:   { name:'수와 식', kw:['因数分解','展開','根号','有理化','不等式','絶対値','分数式'] },
};
function mathTopics(rawText) {
  const hit = {};
  for (const id in MATH_TOPICS) { let c=0; for (const k of MATH_TOPICS[id].kw) if (rawText.includes(k)) c++; hit[id]=c; }
  return hit; // id -> 키워드 적중수 (0이면 미출제 추정)
}

/* ═══════════ 메타 파싱 ═══════════ */
function parseMeta(name) {
  const y=name.match(/(\d{4})/); const year=y?parseInt(y[1]):null;
  const r=name.match(/第([12])回/); const round=r?parseInt(r[1]):(year>=2024?1:null);
  return { year, round };
}

/* ═══════════ 종합과목 집계 ═══════════ */
const jk = JSON.parse(fs.readFileSync('scripts/exam-bank-raw/jongkwa_raw.json','utf8'));
const SUBS=['economy','politics','history','geography','society'];
const jkTotal={economy:0,politics:0,history:0,geography:0,society:0,unknown:0};
const jkByYear={}; const jkExams=[]; let jkTotalQ=0;
for (const e of jk) {
  const {year,round}=parseMeta(e.name); const subs=splitJongkwa(e.rawText);
  const cnt={economy:0,politics:0,history:0,geography:0,society:0,unknown:0};
  for (const s of subs){ cnt[s]++; jkTotal[s]++; jkTotalQ++; }
  jkExams.push({ name:e.name, year, round, conf:Math.round(e.conf||0), pages:e.pages||null, numQ:subs.length,
    economy:cnt.economy, politics:cnt.politics, history:cnt.history, geography:cnt.geography, society:cnt.society });
  if (year!=null){ jkByYear[year]=jkByYear[year]||{economy:0,politics:0,history:0,geography:0,society:0,numQ:0,exams:0};
    for (const s of SUBS) jkByYear[year][s]+=cnt[s]; jkByYear[year].numQ+=subs.length; jkByYear[year].exams++; }
}
const jkYears=Object.keys(jkByYear).map(Number).sort((a,b)=>a-b);

/* ═══════════ 수학 집계 (있을 때만) ═══════════ */
let math=null;
if (fs.existsSync('scripts/exam-bank-raw/math_raw.json')) {
  const md=JSON.parse(fs.readFileSync('scripts/exam-bank-raw/math_raw.json','utf8'));
  const topicExams={}; // id -> 출제된 시험 수
  const topicKw={};    // id -> 누적 적중수
  for (const id in MATH_TOPICS){ topicExams[id]=0; topicKw[id]=0; }
  const mExams=[];
  for (const e of md){ const {year,round}=parseMeta(e.name); const h=mathTopics(e.rawText);
    const present={}; for (const id in h){ if (h[id]>0){ topicExams[id]++; } topicKw[id]+=h[id]; present[id]=h[id]; }
    mExams.push({ name:e.name, year, round, conf:Math.round(e.conf||0), pages:e.pages||null, topics:present }); }
  math={ totalExams:md.length, topics:Object.fromEntries(Object.entries(MATH_TOPICS).map(([id,v])=>[id,v.name])),
    topicExams, topicKw, perExam:mExams };
}

/* ═══════════ 출력 ═══════════ */
console.log('종합과목: 시험',jk.length,'| 문항',jkTotalQ,'| 미분류',jkTotal.unknown,
  '\n  ', SUBS.map(s=>`${s} ${jkTotal[s]}(${Math.round(jkTotal[s]/jkTotalQ*100)}%)`).join('  '));
if (math) { console.log('수학: 시험',math.totalExams);
  for (const id in math.topicExams) console.log('  ',MATH_TOPICS[id].name, math.topicExams[id]+'/'+math.totalExams,'회'); }
else console.log('수학: (아직 scripts/exam-bank-raw/math_raw.json 없음)');

/* ═══════════ JS 데이터 파일 생성 ═══════════ */
const bank = {
  generatedAt: new Date().toISOString().slice(0,10),
  jongkwa: {
    label:'종합과목', totalExams:jk.length, totalQuestions:jkTotalQ,
    yearsCovered:jkYears, yearRange:[jkYears[0], jkYears[jkYears.length-1]],
    subjectTotals:{ economy:jkTotal.economy, politics:jkTotal.politics, history:jkTotal.history, geography:jkTotal.geography, society:jkTotal.society },
    unknown:jkTotal.unknown,
    byYear:jkYears.map(y=>({ year:y, exams:jkByYear[y].exams, numQ:jkByYear[y].numQ,
      economy:jkByYear[y].economy, politics:jkByYear[y].politics, history:jkByYear[y].history, geography:jkByYear[y].geography, society:jkByYear[y].society })),
    perExam:jkExams,
  },
  math,
};
const js = `// ⚠️ 자동 생성 파일 — scripts/build-exam-bank로 빌드. 직접 수정 금지.
// EJU 기출 사전 분석 뱅크: 종합과목 ${jk.length}회분(${jkTotalQ}문항) + 수학 코스1.
// 배포 시에도 출제경향 화면에 기본 표시되는 하드코딩 데이터.
// 과목 분류는 OCR 원문 키워드 기반 추정치 (정치·경제·현대사회 영역은 실제로 겹침).
export const PAST_EXAM_BANK = ${JSON.stringify(bank, null, 2)};
export default PAST_EXAM_BANK;
`;
const out='src/data/ejuPastExamBank.js';
fs.writeFileSync(out, js);
console.log('\nwrote', out, '('+(js.length/1024).toFixed(1)+'KB)');
