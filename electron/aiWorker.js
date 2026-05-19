// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import { parentPort, workerData } from 'worker_threads';
import { pipeline, env, TextStreamer } from '@huggingface/transformers';

env.cacheDir = workerData.cacheDir;
env.allowRemoteModels = true;
env.allowLocalModels  = true;

const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';

let generator = null;

function send(msg) { parentPort.postMessage(msg); }

parentPort.on('message', async (msg) => {
  // ── 모델 로드 ────────────────────────────────────────
  if (msg.type === 'load') {
    try {
      generator = await pipeline('text-generation', MODEL_ID, {
        dtype: 'q4',
        device: 'cpu',
        progress_callback: (p) => send({ type: 'progress', data: p }),
      });
      send({ type: 'loaded' });
    } catch (err) {
      send({ type: 'error', message: err.message });
    }
  }

  // ── 텍스트 생성 ──────────────────────────────────────
  if (msg.type === 'generate') {
    if (!generator) { send({ type: 'error', message: 'Model not loaded' }); return; }
    try {
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text) => send({ type: 'token', text }),
      });
      await generator(msg.messages, {
        max_new_tokens: 220,
        do_sample: true,
        temperature: 0.75,
        repetition_penalty: 1.15,
        streamer,
      });
      send({ type: 'done' });
    } catch (err) {
      send({ type: 'error', message: err.message });
    }
  }
});
