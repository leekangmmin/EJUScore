// ═══════════════════════════════════════════════════════════════════
// EJU Intelligence Platform — Database Layer
// IndexedDB-backed storage with schema versioning and migrations.
// Stores: exam records, OCR results, knowledge graph, embeddings, settings
// ═══════════════════════════════════════════════════════════════════

const DB_NAME = 'eju_intelligence_db';
const DB_VERSION = 3;

const STORES = {
  EXAMS: 'exams',
  OCR_RESULTS: 'ocr_results',
  QUESTIONS: 'questions',
  KNOWLEDGE_NODES: 'knowledge_nodes',
  KNOWLEDGE_EDGES: 'knowledge_edges',
  WEAKNESS_PROFILES: 'weakness_profiles',
  TREND_CACHE: 'trend_cache',
  SETTINGS: 'settings',
  EMBEDDINGS: 'embeddings',
  STUDY_SCHEDULES: 'study_schedules',
  ROOT_CAUSE_ANALYSES: 'root_cause_analyses',
};

/**
 * Open/upgrade the IndexedDB database.
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion || 0;

      // Version 1: Core stores
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORES.EXAMS)) {
          const examStore = db.createObjectStore(STORES.EXAMS, { keyPath: 'id' });
          examStore.createIndex('date', 'date', { unique: false });
          examStore.createIndex('subject', 'subject', { unique: false });
          examStore.createIndex('source', 'source', { unique: false });
          examStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.OCR_RESULTS)) {
          const ocrStore = db.createObjectStore(STORES.OCR_RESULTS, { keyPath: 'id' });
          ocrStore.createIndex('examId', 'examId', { unique: false });
          ocrStore.createIndex('sourceFile', 'sourceFile', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.QUESTIONS)) {
          const qStore = db.createObjectStore(STORES.QUESTIONS, { keyPath: 'id' });
          qStore.createIndex('examId', 'examId', { unique: false });
          qStore.createIndex('number', 'number', { unique: false });
          qStore.createIndex('domain', 'domain', { unique: false });
          qStore.createIndex('topic', 'topic', { unique: false });
          qStore.createIndex('year', ['metadata.year', 'metadata.round'], { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.EMBEDDINGS)) {
          const embStore = db.createObjectStore(STORES.EMBEDDINGS, { keyPath: 'id' });
          embStore.createIndex('questionId', 'questionId', { unique: true });
          embStore.createIndex('vectorType', 'vectorType', { unique: false });
        }
      }

      // Version 2: Knowledge graph stores
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORES.KNOWLEDGE_NODES)) {
          const nodeStore = db.createObjectStore(STORES.KNOWLEDGE_NODES, { keyPath: 'id' });
          nodeStore.createIndex('type', 'type', { unique: false });
          nodeStore.createIndex('domain', 'domain', { unique: false });
          nodeStore.createIndex('masteryLevel', 'masteryLevel', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.KNOWLEDGE_EDGES)) {
          const edgeStore = db.createObjectStore(STORES.KNOWLEDGE_EDGES, { keyPath: 'id' });
          edgeStore.createIndex('sourceId', 'sourceId', { unique: false });
          edgeStore.createIndex('targetId', 'targetId', { unique: false });
          edgeStore.createIndex('type', 'type', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.WEAKNESS_PROFILES)) {
          const wpStore = db.createObjectStore(STORES.WEAKNESS_PROFILES, { keyPath: 'id' });
          wpStore.createIndex('studentId', 'studentId', { unique: false });
          wpStore.createIndex('generatedAt', 'generatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.ROOT_CAUSE_ANALYSES)) {
          const rcStore = db.createObjectStore(STORES.ROOT_CAUSE_ANALYSES, { keyPath: 'id' });
          rcStore.createIndex('questionId', 'questionId', { unique: false });
          rcStore.createIndex('examId', 'examId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.TREND_CACHE)) {
          const tcStore = db.createObjectStore(STORES.TREND_CACHE, { keyPath: 'id' });
          tcStore.createIndex('topic', 'topic', { unique: false });
          tcStore.createIndex('generatedAt', 'generatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.STUDY_SCHEDULES)) {
          db.createObjectStore(STORES.STUDY_SCHEDULES, { keyPath: 'id' });
        }
      }

      // Version 3: Full-text search indexes for questions
      if (oldVersion < 3) {
        const tx = event.target.transaction;
        if (tx) {
          const qStore = tx.objectStore(STORES.QUESTIONS);
          if (!qStore.indexNames.contains('domain_year')) {
            qStore.createIndex('domain_year', ['domain', 'metadata.year'], { unique: false });
          }
          if (!qStore.indexNames.contains('topic_year')) {
            qStore.createIndex('topic_year', ['topic', 'metadata.year'], { unique: false });
          }
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Generic CRUD operations.
 */
export const db = {
  async getAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  },

  async get(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => { resolve(req.result ?? null); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  },

  async put(storeName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  },

  async putMany(storeName, values) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      values.forEach(v => store.put(v));
      tx.oncomplete = () => { resolve(); db.close(); };
      tx.onerror = () => { reject(tx.error); db.close(); };
    });
  },

  async delete(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => { resolve(); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  },

  async clear(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => { resolve(); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  },

  async getByIndex(storeName, indexName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  },

  async getByIndexRange(storeName, indexName, range) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(range);
      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  },

  async count(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  },

  /** Query questions by domain and year range */
  async queryQuestions(filters = {}) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.QUESTIONS, 'readonly');
      const store = tx.objectStore(STORES.QUESTIONS);
      let req;

      if (filters.domain && filters.year) {
        const index = store.index('domain_year');
        req = index.getAll([filters.domain, filters.year]);
      } else if (filters.domain) {
        const index = store.index('domain');
        req = index.getAll(filters.domain);
      } else if (filters.year) {
        const index = store.index('year');
        const range = IDBKeyRange.only([filters.year, filters.round ?? 1]);
        req = index.getAll(range);
      } else {
        req = store.getAll();
      }

      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  },

  /** Aggregate questions by domain, year */
  async aggregateByDomainAndYear() {
    const questions = await this.getAll(STORES.QUESTIONS);
    const agg = {};
    questions.forEach(q => {
      const year = q.metadata?.year || 'unknown';
      const domain = q.domain || 'unknown';
      if (!agg[year]) agg[year] = {};
      if (!agg[year][domain]) agg[year][domain] = 0;
      agg[year][domain]++;
    });
    return agg;
  },

  /** Count questions by topic */
  async countByTopic() {
    const questions = await this.getAll(STORES.QUESTIONS);
    const counts = {};
    questions.forEach(q => {
      const topic = q.topic || 'unknown';
      if (!counts[topic]) counts[topic] = { count: 0, years: new Set(), avgDifficulty: 0, difficulties: [] };
      counts[topic].count++;
      counts[topic].years.add(q.metadata?.year);
      counts[topic].difficulties.push(q.difficulty || 5);
    });
    Object.values(counts).forEach(c => {
      c.avgDifficulty = c.difficulties.reduce((a, b) => a + b, 0) / c.difficulties.length;
      delete c.difficulties;
      c.years = [...c.years].sort();
    });
    return counts;
  },
};

export { STORES, DB_NAME, DB_VERSION, openDB };
export default db;
