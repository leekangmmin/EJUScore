// ═══════════════════════════════════════════════════════════════════════
// Engine Initializer — Runtime Dataset Loader
// Loads all 9 dataset JSON files into a shared cache.
// Auto-executes on app boot via main.jsx.
// ═══════════════════════════════════════════════════════════════════════

/**
 * @typedef {object} DatasetCache
 * @property {object|null} goldStandard - gold_standard.json
 * @property {object|null} knowledgeGraph - knowledge_graph_v3.json
 * @property {object|null} trendAnalysis - trend_analysis_v2.json
 * @property {object|null} trendComplete - trend_analysis_complete.json (new complete analysis)
 * @property {object|null} difficultyDB - difficulty_database.json
 * @property {object|null} prediction2026 - prediction_2026.json
 * @property {object|null} prediction2026_2028 - prediction_2026_2028.json (new 3-year prediction)
 * @property {object|null} weakProfile - weakness_profile.json
 * @property {object|null} studyPlan - study_plan.json
 */

let _datasetCache = null;
let _initialized = false;
let _initPromise = null;
let _initCallbacks = [];

// Dataset paths relative to the app root
const DATASET_PATHS = {
  goldStandard: './dataset/gold_standard/gold_standard.json',
  knowledgeGraph: './dataset/knowledge-graph/knowledge_graph_v3.json',
  trendAnalysis: './dataset/trend-analysis/trend_analysis_v2.json',
  trendComplete: './dataset/trend-analysis/trend_analysis_complete.json',
  difficultyDB: './dataset/difficulty/difficulty_database.json',
  prediction2026: './dataset/prediction/prediction_2026.json',
  prediction2026_2028: './dataset/prediction/prediction_2026_2028.json',
  weakProfile: './dataset/weakness_profile.json',
  studyPlan: './dataset/study_plan.json',
};

// Storage keys for caching datasets in localStorage
const STORAGE_KEYS = {
  goldStandard: 'eju_gold_standard',
  knowledgeGraph: 'eju_knowledge_graph_v3',
  trendAnalysis: 'eju_trend_analysis_v2',
  trendComplete: 'eju_trend_analysis_complete',
  difficultyDB: 'eju_difficulty_database',
  prediction2026: 'eju_prediction_2026',
  prediction2026_2028: 'eju_prediction_2026_2028',
  weakProfile: 'eju_weakness_profile',
  studyPlan: 'eju_study_plan',
};

/**
 * Fetch a single JSON dataset by path.
 * Falls back to localStorage if fetch fails.
 * @param {string} path
 * @param {string} storageKey
 * @returns {Promise<object|null>}
 */
async function fetchDataset(path, storageKey) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    // Cache in localStorage for offline use
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (_) { /* storage full — ignore */ }
    return data;
  } catch (e) {
    console.warn(`[EngineInit] Failed to fetch ${path}: ${e.message}. Trying localStorage...`);
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) return JSON.parse(cached);
    } catch (_) { /* ignore */ }
    return null;
  }
}

/**
 * Initialize all engines by loading datasets.
 * Safe to call multiple times — returns the same promise.
 *
 * @returns {Promise<DatasetCache>}
 */
export function initializeEngine() {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    console.info('[EngineInit] Loading datasets...');

    const entries = Object.entries(DATASET_PATHS);
    const results = await Promise.all(
      entries.map(([key, path]) =>
        fetchDataset(path, STORAGE_KEYS[key]).then(data => [key, data])
      )
    );

    const cache = {};
    let loadedCount = 0;
    for (const [key, data] of results) {
      cache[key] = data;
      if (data) loadedCount++;
    }

    _datasetCache = cache;
    _initialized = true;

    console.info(`[EngineInit] Loaded ${loadedCount}/${entries.length} datasets`);

    // Fire callbacks
    for (const cb of _initCallbacks) {
      try { cb(_datasetCache); } catch (_) {}
    }
    _initCallbacks = [];

    return _datasetCache;
  })();

  return _initPromise;
}

/**
 * Check if engine has been initialized.
 * @returns {boolean}
 */
export function isEngineInitialized() {
  return _initialized;
}

/**
 * Get the current dataset cache.
 * @returns {DatasetCache|null}
 */
export function getDatasetCache() {
  return _datasetCache;
}

/**
 * Get a specific dataset by key.
 * @param {string} key - One of: goldStandard, knowledgeGraph, trendAnalysis, trendComplete, difficultyDB, prediction2026, prediction2026_2028, weakProfile, studyPlan
 * @returns {object|null}
 */
export function getDataset(key) {
  return _datasetCache?.[key] ?? null;
}

/**
 * Register a callback to be called when initialization completes.
 * If already initialized, calls immediately.
 * @param {function} callback - Receives (cache)
 */
export function onEngineReady(callback) {
  if (_initialized && _datasetCache) {
    try { callback(_datasetCache); } catch (_) {}
  } else {
    _initCallbacks.push(callback);
  }
}

/**
 * Reset engine state (for testing).
 */
export function resetEngine() {
  _datasetCache = null;
  _initialized = false;
  _initPromise = null;
  _initCallbacks = [];
}

/**
 * Manually set datasets (for SSR / testing).
 * @param {object} datasets
 */
export function setDatasets(datasets) {
  _datasetCache = datasets;
  _initialized = true;
  for (const cb of _initCallbacks) {
    try { cb(_datasetCache); } catch (_) {}
  }
  _initCallbacks = [];
}

// ── Exports for engine modules ────────────────────────────────────────
export default {
  initializeEngine,
  isEngineInitialized,
  getDatasetCache,
  getDataset,
  onEngineReady,
  resetEngine,
  setDatasets,
};
