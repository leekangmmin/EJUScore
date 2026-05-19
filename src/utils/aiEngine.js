// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { normalizeJapaneseScore, normalizeCompScore } from './storage';

const api = window.electronAPI?.ai;

export const isElectronAI = () => !!api;

export async function loadModel(onProgress) {
  if (!api) throw new Error('Electron AI API not available');
  api.cleanup();
  api.onProgress(onProgress);
  await api.load();
}

export async function generateFeedback(exams, settings, onToken) {
  if (!api) throw new Error('Electron AI API not available');
  api.cleanup();
  api.onToken(onToken);
  const messages = buildPrompt(exams, settings);
  await api.generate(messages);
}

// ── 프롬프트 빌더 ─────────────────────────────────────────
function buildPrompt(exams, settings) {
  const tJap  = settings?.targetJapanese      ?? 320;
  const tComp = settings?.targetComprehensive ?? 170;

  // 최근 5회 일본어
  const japArr = exams
    .filter(e => e.japanese)
    .slice(-5)
    .map(e => {
      const n = normalizeJapaneseScore(e.japanese);
      return n ? { date: e.date, total: n.reading + n.listening } : null;
    })
    .filter(Boolean);

  // 최근 5회 종합
  const compArr = exams
    .filter(e => e.comprehensive?.score != null)
    .slice(-5)
    .map(e => ({ date: e.date, score: normalizeCompScore(e.comprehensive) }))
    .filter(e => e.score != null);

  let dataLines = [];

  if (japArr.length > 0) {
    const scores = japArr.map(e => e.total).join(', ');
    const latest = japArr.at(-1).total;
    const diff   = japArr.length >= 2 ? latest - japArr[0].total : 0;
    const gap    = tJap - latest;
    dataLines.push(
      `■ 일본어 최근 ${japArr.length}회 점수: ${scores}점`,
      `  목표: ${tJap}점 | 최신: ${latest}점 | 목표까지 ${gap}점 남음 | 변화: ${diff >= 0 ? '+' : ''}${diff}점`
    );
  }

  if (compArr.length > 0) {
    const scores = compArr.map(e => e.score).join(', ');
    const latest = compArr.at(-1).score;
    const diff   = compArr.length >= 2 ? latest - compArr[0].score : 0;
    const gap    = tComp - latest;
    dataLines.push(
      `■ 종합과목 최근 ${compArr.length}회 점수: ${scores}점`,
      `  목표: ${tComp}점 | 최신: ${latest}점 | 목표까지 ${gap}점 남음 | 변화: ${diff >= 0 ? '+' : ''}${diff}점`
    );
  }

  if (dataLines.length === 0) {
    dataLines.push('아직 입력된 시험 데이터가 없습니다.');
  }

  return [
    {
      role: 'system',
      content: [
        'EJU(일본유학시험) 전담 AI 학습 코치입니다.',
        '성적 데이터를 분석해 한국어로 간결하고 따뜻한 피드백을 제공합니다.',
        '피드백 형식(200자 이내):',
        '① 성적 추세 한 줄  ② 잘하고 있는 점 한 줄  ③ 구체적 개선 조언 한 줄',
        '이모지를 1-2개 활용하고 응원하는 톤으로 작성하세요.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `[내 EJU 성적 데이터]\n${dataLines.join('\n')}\n\n피드백 부탁드립니다.`,
    },
  ];
}
