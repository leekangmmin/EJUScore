/**
 * aiAnalysisWorker.js — Web Worker
 * @huggingface/transformers 기반 로컬 AI 개념 분석 (Web/PWA 환경 전용)
 * Electron 환경에서는 electron/aiWorker.js (Node Worker Thread) 가 사용됨
 */
import { pipeline, TextStreamer } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
let generator = null;

self.addEventListener('message', async ({ data }) => {
  const { type, messages } = data;

  /* ── 모델 로드 ── */
  if (type === 'load') {
    try {
      generator = await pipeline('text-generation', MODEL_ID, {
        dtype: 'q4',
        progress_callback: (p) => self.postMessage({ type: 'progress', data: p }),
      });
      self.postMessage({ type: 'loaded' });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }

  /* ── 텍스트 생성 (스트리밍) ── */
  if (type === 'generate') {
    if (!generator) {
      self.postMessage({ type: 'error', message: '모델이 로드되지 않았습니다.' });
      return;
    }
    try {
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text) => self.postMessage({ type: 'token', text }),
      });
      await generator(messages, {
        max_new_tokens: 250,
        do_sample: true,
        temperature: 0.7,
        repetition_penalty: 1.1,
        streamer,
      });
      self.postMessage({ type: 'done' });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
});
