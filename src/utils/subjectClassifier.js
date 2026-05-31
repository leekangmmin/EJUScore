// EJU 종합과목(文综) 과목 분류기 — 가중 키워드 스코어링
// 앱(PhotoToQuestion)과 기출 뱅크 빌드 스크립트가 공유 → 분류 기준 일관성 보장.
// 일본어 원문 OCR 텍스트 기준. (정치·경제·현대사회는 실제 시험에서 영역이 겹침 — 추정치)

export const SUBJECT_KEYWORDS = {
  geography: {
    strong: ['次の地図', '地図中', '地形図', '雨温図', 'ケッペン', '気候区', '緯度', '経度', '標準時', '時差', '降水量', 'プレート', '造山', '三角州', '扇状地', 'リアス', '海流', 'モンスーン', '人口ピラミッド', '過疎', '過密', '鉄鉱石', '原油産出', '排他的経済水域', 'プランテーション', '焼畑', '地中海性気候', 'サバナ気候', 'ステップ気候', 'ツンドラ', '針葉樹林', '等高線', '本初子午線', '大陸棚'],
    weak: ['地図', '気候', '地形', '都市化', '鉱産', '山脈', '平野', '大陸', '貿易風', '砂漠', '流域', '半島', '諸島', '灌漑', '輸出品'],
  },
  history: {
    strong: ['第一次世界大戦', '第二次世界大戦', 'フランス革命', '産業革命', 'ロシア革命', '市民革命', '名誉革命', '宗教改革', 'ルネサンス', '十字軍', '植民地支配', '帝国主義', '絶対王政', '明治維新', '辛亥革命', '独立宣言', 'ナポレオン', 'ヒトラー', 'ナチス', 'ベルサイユ条約', 'ウィーン会議', '大航海時代', '奴隷貿易', '冷戦', '東西冷戦', 'ヤルタ', 'ポツダム'],
    weak: ['革命', '帝国', '独立運動', '王朝', '近代化', '古代', '中世', '文明', '王国', '侵略', '併合', '19世紀', '18世紀'],
  },
  politics: {
    strong: ['三権分立', '立法権', '行政権', '司法権', '違憲審査', '国民主権', '基本的人権', '社会権', '参政権', '比例代表', '小選挙区', '議院内閣制', '大統領制', '連邦制', '国際連合', '安全保障理事会', '拒否権', '国連総会', '法の支配', '法治主義', '日本国憲法', '人権宣言', '普通選挙', '地方自治'],
    weak: ['政治', '民主主義', '選挙', '立法', '行政', '司法', '主権', '国連', '政府', '首相', '与党', '野党', '政党', '議会', '内閣', '国会'],
  },
  economy: {
    strong: ['需要曲線', '供給曲線', '国内総生産', 'インフレーション', 'デフレーション', '財政政策', '金融政策', '中央銀行', '為替相場', '円高', '円安', '自由貿易', '保護貿易', '比較優位', '市場経済', '独占', '寡占', '失業率', '国際収支', 'ケインズ', 'マルクス', 'アダム・スミス', '累進課税', '社会保障給付', '需給', '均衡価格', '機会費用', 'GDP', 'GNP'],
    weak: ['経済', '市場', '貿易', '財政', '金融', '金利', '物価', '株価', '企業', '所得', '価格', '投資', '消費', '輸出', '輸入'],
  },
  society: {
    strong: ['少子高齢化', '高齢化社会', '少子化', '社会保障制度', '年金制度', '介護保険', '地球温暖化', '再生可能エネルギー', '持続可能な開発', '京都議定書', 'パリ協定', '情報社会', 'グローバル化', '多文化共生', '男女共同参画', 'ジェンダー', '生物多様性', '循環型社会', 'SDGs'],
    weak: ['環境問題', '福祉', '高齢者', 'エネルギー', '移民', '多文化', '情報化', '格差', '差別', '地域社会', '人口減少', 'NGO', 'NPO'],
  },
};

export const SUBJECT_PRIORITY = ['economy', 'politics', 'history', 'geography', 'society'];

// 한 문장/문항 텍스트의 과목별 점수
export function scoreSubjects(s) {
  const sc = { economy: 0, politics: 0, history: 0, geography: 0, society: 0 };
  if (!s) return sc;
  for (const subj of SUBJECT_PRIORITY) {
    for (const k of SUBJECT_KEYWORDS[subj].strong) if (s.includes(k)) sc[subj] += 3;
    for (const k of SUBJECT_KEYWORDS[subj].weak) if (s.includes(k)) sc[subj] += 1;
  }
  return sc;
}

// 단일 텍스트 → 과목 ('unknown' 가능)
export function classifySubject(s) {
  const sc = scoreSubjects(s);
  let best = 'unknown', bestv = 0;
  for (const subj of SUBJECT_PRIORITY) if (sc[subj] > bestv) { bestv = sc[subj]; best = subj; }
  return best;
}

// 大問 단위 carry-forward 보정: 같은 大問 안에서 unknown 문항은 본문 주제를 상속
// items: [{ subject, newDaemun }] 를 받아 보정된 subject 배열을 반환
export function carryForwardSubjects(items) {
  const out = items.map((x) => ({ ...x }));
  let last = 'unknown';
  for (let i = 0; i < out.length; i++) {
    if (out[i].newDaemun) last = 'unknown';
    if (out[i].subject !== 'unknown') last = out[i].subject;
    else if (last !== 'unknown') { out[i].subject = last; out[i].inherited = true; }
  }
  let next = 'unknown';
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].subject !== 'unknown') next = out[i].subject;
    else if (next !== 'unknown' && !out[i].newDaemun) { out[i].subject = next; out[i].inherited = true; }
    if (out[i].newDaemun) next = out[i].subject !== 'unknown' ? out[i].subject : 'unknown';
  }
  return out;
}

export const DAEMUN_RE = /[問間](?:\s|　)?[0-9０-９一二三四五六七八九]/;
