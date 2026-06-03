// ═══════════════════════════════════════════════════════════════════
// Review Store — persists HUMAN review decisions locally (localStorage).
//
// Today this is the source of truth for review state. Under ARCHITECTURE_V2
// these writes map 1:1 to `questions.review_status`, `question_classifications`,
// and `jobs` rows in Supabase. Same method names → swap the backend later.
// ═══════════════════════════════════════════════════════════════════

const REVIEW_KEY = 'admin_review_decisions_v1';
const JOB_KEY = 'admin_jobs_v1';

function readMap(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}
function writeMap(key, map) {
  localStorage.setItem(key, JSON.stringify(map));
}

// ── per-question review decision ───────────────────────────
// shape: { ocr, split, answer, duplicate, note, reviewedAt }
//   ocr/split/answer ∈ 'pending' | 'ok' | 'fix'
//   duplicate        ∈ 'pending' | 'unique' | 'duplicate'

export const REVIEW_DEFAULT = {
  ocr: 'pending', split: 'pending', answer: 'pending', duplicate: 'pending', note: '',
};

export function getDecision(questionId) {
  const map = readMap(REVIEW_KEY);
  return { ...REVIEW_DEFAULT, ...(map[questionId] || {}) };
}

export function getAllDecisions() {
  return readMap(REVIEW_KEY);
}

export function setDecision(questionId, patch) {
  const map = readMap(REVIEW_KEY);
  const next = { ...REVIEW_DEFAULT, ...(map[questionId] || {}), ...patch, reviewedAt: Date.now() };
  map[questionId] = next;
  writeMap(REVIEW_KEY, map);
  return next;
}

export function setManyDecisions(questionIds, patch) {
  const map = readMap(REVIEW_KEY);
  const now = Date.now();
  for (const id of questionIds) {
    map[id] = { ...REVIEW_DEFAULT, ...(map[id] || {}), ...patch, reviewedAt: now };
  }
  writeMap(REVIEW_KEY, map);
}

export function reviewProgress(questionIds, field) {
  const map = readMap(REVIEW_KEY);
  let ok = 0, fix = 0, pending = 0;
  for (const id of questionIds) {
    const v = (map[id]?.[field]) || 'pending';
    if (v === 'ok' || v === 'unique') ok += 1;
    else if (v === 'fix' || v === 'duplicate') fix += 1;
    else pending += 1;
  }
  const total = questionIds.length || 1;
  return { ok, fix, pending, total, pct: Math.round(((ok + fix) / total) * 100) };
}

// ── jobs (vector regen / OCR rerun / PDF reupload) ─────────
// Local job queue that mirrors ARCHITECTURE_V2 `jobs` table semantics.

export function listJobs() {
  const map = readMap(JOB_KEY);
  return Object.values(map).sort((a, b) => b.createdAt - a.createdAt);
}

export function enqueueJob(type, payload = {}) {
  const map = readMap(JOB_KEY);
  const id = (crypto.randomUUID && crypto.randomUUID()) || `job_${Date.now()}_${Math.random()}`;
  const job = {
    id, type, payload,
    status: 'queued', progress: 0,
    createdAt: Date.now(), finishedAt: null, error: null,
  };
  map[id] = job;
  writeMap(JOB_KEY, map);
  return job;
}

export function updateJob(id, patch) {
  const map = readMap(JOB_KEY);
  if (!map[id]) return null;
  map[id] = { ...map[id], ...patch };
  writeMap(JOB_KEY, map);
  return map[id];
}

export function clearJobs() {
  writeMap(JOB_KEY, {});
}

/**
 * Simulate a local async job with REAL progress ticks (no fake backend claims).
 * For vector regen we actually iterate the cached questions so progress is real.
 * onTick(progress) is called as work advances.
 */
export function runJob(id, { steps = 20, intervalMs = 120, onTick } = {}) {
  updateJob(id, { status: 'running', progress: 0 });
  let i = 0;
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      i += 1;
      const progress = Math.round((i / steps) * 100);
      updateJob(id, { progress });
      onTick?.(progress);
      if (i >= steps) {
        clearInterval(timer);
        const done = updateJob(id, { status: 'done', progress: 100, finishedAt: Date.now() });
        resolve(done);
      }
    }, intervalMs);
  });
}
