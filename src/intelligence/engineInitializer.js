// ═══════════════════════════════════════════════════════════════════════
// Engine Initializer — Multi-Source Dataset Loader (v3)
//
// Loads canonical + supporting datasets at boot:
//   - CANONICAL:    public/dataset/canonical/parsed_questions.json
//   - trendComplete: public/dataset/trend-analysis/trend_analysis_complete.json
//   - insights:      public/dataset/insights/insights_v2.json
//   - prediction2026: public/dataset/prediction/prediction_2026.json
//   - knowledgeGraph: public/dataset/knowledge-graph/knowledge_graph_v3.json
//   - goldStandard:   public/dataset/gold_standard/gold_standard.json
//   - difficultyDB:   public/dataset/difficulty/difficulty_database.json
//   - weakProfile:    public/dataset/weakness_profile.json
//   - studyPlan:      public/dataset/study_plan.json
//   - trendAnalysis:  public/dataset/trend-analysis/trend_analysis_v2.json
//
// Canonical is the single source of truth for questions; the other datasets
// provide pre-computed analysis (trends, predictions, KG, insights, etc.).
// ═══════════════════════════════════════════════════════════════════════

/**
 * @typedef {object} DatasetCache
 * @property {object|null} parsedQuestions - parsed_questions.json (CANONICAL)
 * @property {object|null} goldStandard - gold_standard.json
 * @property {object|null} knowledgeGraph - knowledge_graph_v3.json
 * @property {object|null} trendAnalysis - trend_analysis_v2.json
 * @property {object|null} trendComplete - trend_analysis_complete.json
 * @property {object|null} difficultyDB - difficulty_database.json
 * @property {object|null} prediction2026 - prediction_2026.json
 * @property {object|null} prediction2026_2028 - prediction_2026_2028.json
 * @property {object|null} weakProfile - weakness_profile.json
 * @property {object|null} studyPlan - study_plan.json
 * @property {object|null} insights - insights_v2.json
 */

let _datasetCache = null;
let _initialized = false;
let _initPromise = null;
let _initCallbacks = [];

// ── Dataset paths (relative to public/) ───────────────────────────────
const DATASET_PATHS = {
  parsedQuestions:   './dataset/canonical/parsed_questions.json',
  goldStandard:      './dataset/gold_standard/gold_standard.json',
  knowledgeGraph:    './dataset/knowledge-graph/knowledge_graph_v3.json',
  trendAnalysis:     './dataset/trend-analysis/trend_analysis_v2.json',
  trendComplete:     './dataset/trend-analysis/trend_analysis_complete.json',
  difficultyDB:      './dataset/difficulty/difficulty_database.json',
  prediction2026:    './dataset/prediction/prediction_2026.json',
  prediction2026_2028: './dataset/prediction/prediction_2026_2028.json',
  weakProfile:       './dataset/weakness_profile.json',
  studyPlan:         './dataset/study_plan.json',
  insights:          './dataset/insights/insights_v2.json',
};

/**
 * Fetch a single JSON dataset from the given path.
 * @param {string} path - Relative URL path
 * @param {string} label - Human-readable label for logging
 * @returns {Promise<object|null>}
 */
async function fetchDataset(path, label) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    console.info(`[EngineInit] Loaded ${label}: ${JSON.stringify(data).length} bytes`);
    return data;
  } catch (e) {
    console.warn(`[EngineInit] ${label} not available from ${path}: ${e.message}`);
    return null;
  }
}

/**
 * Initialize all engines by loading all datasets.
 * Safe to call multiple times — returns the same promise.
 *
 * @returns {Promise<DatasetCache>}
 */
export function initializeEngine() {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    console.info('[EngineInit] Loading all datasets...');

    // Load canonical first, then supporting datasets in parallel
    const parsedQuestions = await fetchDataset(
      DATASET_PATHS.parsedQuestions,
      'canonical corpus'
    );

    if (parsedQuestions) {
      console.info(
        `[EngineInit] Loaded canonical corpus: ${
          parsedQuestions.totalQuestions ||
          parsedQuestions.questions?.length ||
          '?'
        } questions`
      );
    } else {
      console.warn(
        '[EngineInit] Canonical corpus not available — app will run without dataset'
      );
    }

    // Load supporting datasets in parallel (non-blocking for boot)
    const [
      goldStandard,
      knowledgeGraph,
      trendAnalysis,
      trendComplete,
      difficultyDB,
      prediction2026,
      prediction2026_2028,
      weakProfile,
      studyPlan,
      insights,
    ] = await Promise.all([
      fetchDataset(DATASET_PATHS.goldStandard, 'gold_standard'),
      fetchDataset(DATASET_PATHS.knowledgeGraph, 'knowledge_graph_v3'),
      fetchDataset(DATASET_PATHS.trendAnalysis, 'trend_analysis_v2'),
      fetchDataset(DATASET_PATHS.trendComplete, 'trend_analysis_complete'),
      fetchDataset(DATASET_PATHS.difficultyDB, 'difficulty_database'),
      fetchDataset(DATASET_PATHS.prediction2026, 'prediction_2026'),
      fetchDataset(DATASET_PATHS.prediction2026_2028, 'prediction_2026_2028'),
      fetchDataset(DATASET_PATHS.weakProfile, 'weakness_profile'),
      fetchDataset(DATASET_PATHS.studyPlan, 'study_plan'),
      fetchDataset(DATASET_PATHS.insights, 'insights_v2'),
    ]);

    _datasetCache = {
      parsedQuestions,       // ⬅ CANONICAL — single source of truth for questions
      goldStandard,
      knowledgeGraph,
      trendAnalysis,
      trendComplete,
      difficultyDB,
      prediction2026,
      prediction2026_2028,
      weakProfile,
      studyPlan,
      insights,
    };
    _initialized = true;

    const loaded = Object.entries(_datasetCache).filter(([, v]) => v !== null).length;
    const total = Object.keys(_datasetCache).length;
    console.info(`[EngineInit] Engine initialized (${loaded}/${total} datasets loaded)`);

    // Fire callbacks
    for (const cb of _initCallbacks) {
      try {
        cb(_datasetCache);
      } catch (_) {
        /* ignore */
      }
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
 * @param {string} key - dataset key (parsedQuestions, goldStandard, etc.)
 * @returns {object|null}
 */
export function getDataset(key) {
  return _datasetCache?.[key] ?? null;
}

/**
 * Get the canonical parsed questions array.
 * @returns {Array|null}
 */
export function getParsedQuestions() {
  return _datasetCache?.parsedQuestions?.questions ?? null;
}

/**
 * Register a callback to be called when initialization completes.
 * If already initialized, calls immediately.
 * @param {function} callback - Receives (cache)
 */
export function onEngineReady(callback) {
  if (_initialized && _datasetCache) {
    try {
      callback(_datasetCache);
    } catch (_) {}
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
    try {
      cb(_datasetCache);
    } catch (_) {}
  }
  _initCallbacks = [];
}

// ── Exports for engine modules ────────────────────────────────────────
export default {
  initializeEngine,
  isEngineInitialized,
  getDatasetCache,
  getDataset,
  getParsedQuestions,
  onEngineReady,
  resetEngine,
  setDatasets,
};
