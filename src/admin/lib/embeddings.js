// ═══════════════════════════════════════════════════════════════════
// Optional real multilingual embeddings (transformers.js, lazy).
//
// Off by default. When the user enables "의미검색 강화", we load a real
// multilingual sentence-embedding model (multilingual-e5-small) — the
// honest cross-lingual fix. e5 expects "query:"/"passage:" prefixes.
// These vectors are the SAME representation targeted by pgvector in prod.
//
// @huggingface/transformers is already a project dependency (used by the
// AI workers), so this adds no new library. The model itself downloads on
// first enable (hundreds of MB) — surfaced in the UI, never silent.
// ═══════════════════════════════════════════════════════════════════

const MODEL_ID = 'Xenova/multilingual-e5-small'; // 384-dim, multilingual
let _extractor = null;
let _loading = null;

export const EMBED_MODEL = MODEL_ID;

export async function loadEmbedder(onStatus) {
  if (_extractor) return _extractor;
  if (_loading) return _loading;
  _loading = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    try { env.allowLocalModels = true; } catch { /* ignore */ }
    const extractor = await pipeline('feature-extraction', MODEL_ID, {
      progress_callback: (p) => {
        if (p?.status === 'progress' && onStatus) {
          onStatus({ status: 'downloading', file: p.file, progress: Math.round(p.progress || 0) });
        } else if (p?.status === 'ready' && onStatus) {
          onStatus({ status: 'ready' });
        }
      },
    });
    _extractor = extractor;
    return extractor;
  })();
  return _loading;
}

function toVec(output) {
  // transformers.js Tensor → Float32Array (already mean-pooled + normalized)
  return output?.data ? Float32Array.from(output.data) : new Float32Array();
}

export async function embedQuery(text) {
  const ex = await loadEmbedder();
  const out = await ex(`query: ${text}`, { pooling: 'mean', normalize: true });
  return toVec(out);
}

/** Embed a batch of passages with progress; returns array of Float32Array. */
export async function embedPassages(texts, onProgress) {
  const ex = await loadEmbedder();
  const vecs = new Array(texts.length);
  for (let i = 0; i < texts.length; i++) {
    const out = await ex(`passage: ${texts[i]}`, { pooling: 'mean', normalize: true });
    vecs[i] = toVec(out);
    if (onProgress && (i % 25 === 0 || i === texts.length - 1)) {
      onProgress(Math.round(((i + 1) / texts.length) * 100));
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return vecs;
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are already L2-normalized
}
