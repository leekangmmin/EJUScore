// ═══════════════════════════════════════════════════════════════════
// Engine Initializer Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeEngine,
  isEngineInitialized,
  getDatasetCache,
  getDataset,
  onEngineReady,
  resetEngine,
  setDatasets,
} from '../intelligence/engineInitializer';

describe('engineInitializer', () => {
  beforeEach(() => {
    resetEngine();
  });

  it('starts uninitialized', () => {
    expect(isEngineInitialized()).toBe(false);
    expect(getDatasetCache()).toBeNull();
  });

  it('getDataset returns null before initialization', () => {
    expect(getDataset('goldStandard')).toBeNull();
    expect(getDataset('knowledgeGraph')).toBeNull();
  });

  it('setDatasets initializes the engine', () => {
    const mockDatasets = {
      goldStandard: { data: 'gold' },
      knowledgeGraph: { data: 'kg' },
      trendAnalysis: null,
      difficultyDB: null,
      prediction2026: null,
      weakProfile: null,
      studyPlan: null,
    };
    setDatasets(mockDatasets);
    expect(isEngineInitialized()).toBe(true);
    expect(getDatasetCache()).toEqual(mockDatasets);
    expect(getDataset('goldStandard')).toEqual({ data: 'gold' });
  });

  it('onEngineReady fires immediately if initialized', () => {
    const mock = { goldStandard: {} };
    setDatasets(mock);
    let called = false;
    onEngineReady((cache) => {
      called = true;
      expect(cache).toBe(mock);
    });
    expect(called).toBe(true);
  });

  it('onEngineReady queues callback if not initialized', () => {
    let called = false;
    onEngineReady(() => { called = true; });
    expect(called).toBe(false);

    const mock = { goldStandard: {} };
    setDatasets(mock);
    expect(called).toBe(true);
  });

  it('resetEngine clears all state', () => {
    setDatasets({ goldStandard: {} });
    expect(isEngineInitialized()).toBe(true);
    resetEngine();
    expect(isEngineInitialized()).toBe(false);
    expect(getDatasetCache()).toBeNull();
  });

  it('initializeEngine returns a promise', async () => {
    const promise = initializeEngine();
    expect(promise).toBeInstanceOf(Promise);
    // The actual fetch will fail in test environment, but handle gracefully
    try {
      const result = await promise;
      expect(result).toBeDefined();
    } catch {
      // In test environment, fetches will fail — that's expected
    }
  });
});
