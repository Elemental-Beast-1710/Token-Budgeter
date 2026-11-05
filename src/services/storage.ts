import {
  AppSettings,
  Experiment,
  ImportBatchRecord,
  PricingRate,
  ProjectBudget,
  StorageHealth,
  TokenBudgeterBackup,
  UsageEvent,
} from '../types';
import { DEFAULT_PRICING_CATALOG } from './pricing';
import { generateSampleEvents, SAMPLE_PROJECTS } from './sampleData';

export const CURRENT_SCHEMA_VERSION = 2;
export const DB_NAME = 'TokenBudgeterDB';

/**
 * Clean Storage Abstraction Interface.
 * Enables browser-local IndexedDB initially, with seamless migration path
 * to SQLite, PostgreSQL, or remote databases without rewriting business logic.
 */
export interface IStorageAdapter {
  name: string;
  getHealth(): Promise<StorageHealth>;

  // Events
  getAllEvents(): Promise<UsageEvent[]>;
  saveEvents(events: UsageEvent[]): Promise<void>;
  saveImportBatch(batch: ImportBatchRecord, events: UsageEvent[]): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  deleteBatch(batchId: string): Promise<{ deletedEventsCount: number }>;
  clearAllEvents(): Promise<void>;
  removeSampleEvents(): Promise<void>;
  resetSampleData(
    sampleEvents: UsageEvent[],
    sampleProjects: ProjectBudget[],
    defaultRates: PricingRate[]
  ): Promise<void>;

  // Batches
  getAllBatches(): Promise<ImportBatchRecord[]>;
  saveBatchRecord(batch: ImportBatchRecord): Promise<void>;

  // Projects
  getAllProjects(): Promise<ProjectBudget[]>;
  saveProject(project: ProjectBudget): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // Pricing
  getAllPricingRates(): Promise<PricingRate[]>;
  savePricingRate(rate: PricingRate): Promise<void>;
  deletePricingRate(id: string): Promise<void>;

  // Experiments
  getAllExperiments(): Promise<Experiment[]>;
  saveExperiment(experiment: Experiment): Promise<void>;
  deleteExperiment(id: string): Promise<void>;

  // Settings & Preferences
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;

  // Lifecycle & Governance
  wipeAllData(): Promise<void>;
  exportAllToJson(): Promise<string>;
  importBackupJson(jsonString: string): Promise<{
    importedEvents: number;
    importedProjects: number;
    importedPricing: number;
    importedExperiments: number;
    importedBatches: number;
  }>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'USD',
  theme: 'dark',
  timezone: 'UTC',
  hasSeenWelcome: false,
  activeBatchIds: [],
  storageType: 'indexeddb',
  workspaceMode: 'real',
};

const LOCAL_STORAGE_SETTINGS_KEY = 'tb_user_preferences_cache';

// Helper to determine if an error is a storage quota exhaustion
export function isQuotaExceededError(error: any): boolean {
  if (!error) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}

/**
 * Strict backup payload validation and sanitization.
 * Rejects corrupt structures, prototype pollution, wrong application identifiers, and incompatible versions before modifying storage.
 */
export function validateBackupPayload(jsonString: string): TokenBudgeterBackup {
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    throw new Error('Backup content cannot be empty.');
  }

  // Guard against prototype pollution in raw payload
  if (
    jsonString.includes('__proto__') ||
    (jsonString.includes('constructor') && jsonString.includes('prototype'))
  ) {
    const dangerousTest = /"(__proto__|constructor|prototype)"\s*:/;
    if (dangerousTest.test(jsonString)) {
      throw new Error('Security Error: Backup file contains prohibited prototype pollution keys.');
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e: any) {
    throw new Error(`Invalid JSON syntax in backup file: ${e.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid TokenBudgeter backup file format: Root payload must be an object.');
  }

  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    throw new Error('Invalid TokenBudgeter backup file format: missing "data" property.');
  }

  if (parsed.app !== 'TokenBudgeter') {
    throw new Error('Invalid TokenBudgeter backup file format: Missing or invalid "app" identifier.');
  }

  if (
    typeof parsed.schemaVersion !== 'number' ||
    parsed.schemaVersion < 1 ||
    parsed.schemaVersion > CURRENT_SCHEMA_VERSION + 1
  ) {
    throw new Error(
      `Unsupported backup schema version: ${parsed.schemaVersion}. Current supported version is ${CURRENT_SCHEMA_VERSION}.`
    );
  }

  const { events, projects, pricing, experiments, importBatches } = parsed.data;

  if (events !== undefined && !Array.isArray(events)) {
    throw new Error('Corrupt backup: "data.events" must be an array.');
  }
  if (projects !== undefined && !Array.isArray(projects)) {
    throw new Error('Corrupt backup: "data.projects" must be an array.');
  }
  if (pricing !== undefined && !Array.isArray(pricing)) {
    throw new Error('Corrupt backup: "data.pricing" must be an array.');
  }
  if (experiments !== undefined && !Array.isArray(experiments)) {
    throw new Error('Corrupt backup: "data.experiments" must be an array.');
  }
  if (importBatches !== undefined && !Array.isArray(importBatches)) {
    throw new Error('Corrupt backup: "data.importBatches" must be an array.');
  }

  // Validate structural integrity of events if present
  if (Array.isArray(events)) {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev || typeof ev !== 'object') {
        throw new Error(`Corrupt backup: Event at index ${i} is not a valid object.`);
      }
      if (!ev.id || typeof ev.id !== 'string') {
        throw new Error(`Corrupt backup: Event at index ${i} is missing a string "id".`);
      }
      if (!ev.timestamp || typeof ev.timestamp !== 'string') {
        throw new Error(`Corrupt backup: Event ${ev.id} is missing a string "timestamp".`);
      }
      if (!ev.model || typeof ev.model !== 'string') {
        throw new Error(`Corrupt backup: Event ${ev.id} is missing a string "model".`);
      }
    }
  }

  return parsed as TokenBudgeterBackup;
}

/**
 * Memory Storage Adapter
 * Used in headless testing environments, SSR, or when IndexedDB is restricted.
 */
export class MemoryStorageAdapter implements IStorageAdapter {
  name = 'memory';
  events: Map<string, UsageEvent> = new Map();
  projects: Map<string, ProjectBudget> = new Map();
  pricing: Map<string, PricingRate> = new Map();
  experiments: Map<string, Experiment> = new Map();
  batches: Map<string, ImportBatchRecord> = new Map();
  settings: AppSettings = { ...DEFAULT_SETTINGS, storageType: 'memory' };
  corruptedRecordsCount = 0;

  async getHealth(): Promise<StorageHealth> {
    return {
      isAvailable: true,
      storageType: 'memory',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      corruptedRecordsCount: this.corruptedRecordsCount,
      totalBatchesCount: this.batches.size,
      statusMessage: 'In-memory fallback store active (transient session storage).',
    };
  }

  async getAllEvents(): Promise<UsageEvent[]> {
    const raw = Array.from(this.events.values());
    const clean: UsageEvent[] = [];
    for (const item of raw) {
      if (item && item.id && item.timestamp && item.model) {
        clean.push({
          ...item,
          recordOrigin:
            item.recordOrigin ||
            (item.isSample ? 'sample' : item.source === 'manual' ? 'manual' : 'imported'),
        });
      } else {
        this.corruptedRecordsCount++;
      }
    }
    return clean.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async saveEvents(events: UsageEvent[]): Promise<void> {
    for (const ev of events) {
      if (!ev || !ev.id) continue;
      this.events.set(ev.id, {
        ...ev,
        recordOrigin: ev.recordOrigin || (ev.isSample ? 'sample' : ev.source === 'manual' ? 'manual' : 'imported'),
      });
    }
  }

  async saveImportBatch(batch: ImportBatchRecord, events: UsageEvent[]): Promise<void> {
    this.batches.set(batch.id, batch);
    for (const ev of events) {
      if (!ev || !ev.id) continue;
      this.events.set(ev.id, {
        ...ev,
        importBatchId: batch.id,
        isSample: batch.isSample,
        recordOrigin: batch.isSample ? 'sample' : 'imported',
      });
    }
  }

  async deleteEvent(id: string): Promise<void> {
    this.events.delete(id);
  }

  async deleteBatch(batchId: string): Promise<{ deletedEventsCount: number }> {
    let count = 0;
    for (const [id, ev] of Array.from(this.events.entries())) {
      if (ev.importBatchId === batchId) {
        this.events.delete(id);
        count++;
      }
    }
    this.batches.delete(batchId);
    return { deletedEventsCount: count };
  }

  async clearAllEvents(): Promise<void> {
    this.events.clear();
    this.batches.clear();
  }

  async removeSampleEvents(): Promise<void> {
    for (const [id, ev] of Array.from(this.events.entries())) {
      if (ev.isSample || ev.recordOrigin === 'sample' || ev.importBatchId.startsWith('sample_')) {
        this.events.delete(id);
      }
    }
    for (const [bId, batch] of Array.from(this.batches.entries())) {
      if (batch.isSample || bId.startsWith('sample_')) {
        this.batches.delete(bId);
      }
    }
  }

  async resetSampleData(
    sampleEvents: UsageEvent[],
    sampleProjects: ProjectBudget[],
    defaultRates: PricingRate[]
  ): Promise<void> {
    await this.removeSampleEvents();
    const sampleBatch: ImportBatchRecord = {
      id: `sample_batch_${Date.now()}`,
      fileName: 'fictional-sample-workload.json',
      fileType: 'json',
      fileSize: 10240,
      importedAt: new Date().toISOString(),
      validCount: sampleEvents.length,
      duplicateCount: 0,
      rejectedCount: 0,
      totalTokens: sampleEvents.reduce((s, e) => s + (e.inputTokens + e.outputTokens), 0),
      totalCostUsd: sampleEvents.reduce((s, e) => s + (e.reportedCost || e.estimatedCost || 0), 0),
      isSample: true,
    };
    await this.saveImportBatch(sampleBatch, sampleEvents);
    for (const p of sampleProjects) {
      this.projects.set(p.id, p);
    }
    for (const r of defaultRates) {
      if (!this.pricing.has(r.id)) {
        this.pricing.set(r.id, r);
      }
    }
  }

  async getAllBatches(): Promise<ImportBatchRecord[]> {
    return Array.from(this.batches.values()).sort(
      (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    );
  }

  async saveBatchRecord(batch: ImportBatchRecord): Promise<void> {
    this.batches.set(batch.id, batch);
  }

  async getAllProjects(): Promise<ProjectBudget[]> {
    return Array.from(this.projects.values());
  }

  async saveProject(project: ProjectBudget): Promise<void> {
    this.projects.set(project.id, project);
  }

  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
  }

  async getAllPricingRates(): Promise<PricingRate[]> {
    const list = Array.from(this.pricing.values());
    return list.length > 0 ? list : DEFAULT_PRICING_CATALOG;
  }

  async savePricingRate(rate: PricingRate): Promise<void> {
    this.pricing.set(rate.id, rate);
  }

  async deletePricingRate(id: string): Promise<void> {
    this.pricing.delete(id);
  }

  async getAllExperiments(): Promise<Experiment[]> {
    return Array.from(this.experiments.values());
  }

  async saveExperiment(experiment: Experiment): Promise<void> {
    this.experiments.set(experiment.id, experiment);
  }

  async deleteExperiment(id: string): Promise<void> {
    this.experiments.delete(id);
  }

  async getSettings(): Promise<AppSettings> {
    return this.settings;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    this.settings = { ...settings, storageType: 'memory' };
  }

  async wipeAllData(): Promise<void> {
    this.events.clear();
    this.projects.clear();
    this.pricing.clear();
    this.experiments.clear();
    this.batches.clear();
    this.settings = { ...DEFAULT_SETTINGS, storageType: 'memory' };
  }

  async exportAllToJson(): Promise<string> {
    const allEvents = await this.getAllEvents();
    const sampleEventsCount = allEvents.filter((e) => e.isSample || e.recordOrigin === 'sample').length;
    const realEventsCount = allEvents.length - sampleEventsCount;

    const backup: TokenBudgeterBackup = {
      app: 'TokenBudgeter',
      version: '1.0.0',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      provenanceSummary: {
        sampleEventsCount,
        realEventsCount,
        totalEventsCount: allEvents.length,
      },
      data: {
        events: allEvents,
        projects: await this.getAllProjects(),
        pricing: await this.getAllPricingRates(),
        experiments: await this.getAllExperiments(),
        importBatches: await this.getAllBatches(),
        settings: await this.getSettings(),
      },
    };
    return JSON.stringify(backup, null, 2);
  }
  async importBackupJson(jsonString: string): Promise<{
    importedEvents: number;
    importedProjects: number;
    importedPricing: number;
    importedExperiments: number;
    importedBatches: number;
  }> {
    const parsed = validateBackupPayload(jsonString);
    const { events, projects, pricing, experiments, importBatches, settings } = parsed.data;

    let eCount = 0;
    if (Array.isArray(events)) {
      for (const ev of events) {
        if (ev && ev.id) {
          this.events.set(ev.id, {
            ...ev,
            isSample: Boolean(ev.isSample),
            recordOrigin: ev.recordOrigin || (ev.isSample ? 'sample' : ev.source === 'manual' ? 'manual' : 'imported'),
          });
          eCount++;
        }
      }
    }

    let pCount = 0;
    if (Array.isArray(projects)) {
      for (const p of projects) {
        if (p && p.id) {
          this.projects.set(p.id, p);
          pCount++;
        }
      }
    }

    let prCount = 0;
    if (Array.isArray(pricing)) {
      for (const pr of pricing) {
        if (pr && pr.id) {
          this.pricing.set(pr.id, pr);
          prCount++;
        }
      }
    }

    let expCount = 0;
    if (Array.isArray(experiments)) {
      for (const exp of experiments) {
        if (exp && exp.id) {
          this.experiments.set(exp.id, exp);
          expCount++;
        }
      }
    }

    let bCount = 0;
    if (Array.isArray(importBatches)) {
      for (const b of importBatches) {
        if (b && b.id) {
          this.batches.set(b.id, b);
          bCount++;
        }
      }
    }

    if (settings) {
      this.settings = { ...settings, storageType: 'memory' };
    }

    return {
      importedEvents: eCount,
      importedProjects: pCount,
      importedPricing: prCount,
      importedExperiments: expCount,
      importedBatches: bCount,
    };
  }
}

/**
 * Production IndexedDB Storage Adapter.
 * Features schema versioning (v2), transactional batch updates,
 * index governance, quota error recovery, and safe migrations.
 */
export class IndexedDbStorageAdapter implements IStorageAdapter {
  name = 'indexeddb';
  private db: IDBDatabase | null = null;
  private corruptedCount = 0;

  private hasIndexedDbSupport(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (!this.hasIndexedDbSupport()) {
      throw new Error('IndexedDB is not supported in this environment.');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, CURRENT_SCHEMA_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // Base stores from v1
        let eventStore: IDBObjectStore;
        if (!db.objectStoreNames.contains('events')) {
          eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('timestamp', 'timestamp', { unique: false });
          eventStore.createIndex('project', 'project', { unique: false });
          eventStore.createIndex('model', 'model', { unique: false });
          eventStore.createIndex('provider', 'provider', { unique: false });
        } else {
          eventStore = (event.target as IDBOpenDBRequest).transaction!.objectStore('events');
        }

        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pricing')) {
          db.createObjectStore('pricing', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('experiments')) {
          db.createObjectStore('experiments', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Schema v2 additions: import batches, schema meta, and batch indices
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('import_batches')) {
            const batchStore = db.createObjectStore('import_batches', { keyPath: 'id' });
            batchStore.createIndex('importedAt', 'importedAt', { unique: false });
            batchStore.createIndex('isSample', 'isSample', { unique: false });
          }

          if (!db.objectStoreNames.contains('schema_meta')) {
            db.createObjectStore('schema_meta', { keyPath: 'key' });
          }

          if (!eventStore.indexNames.contains('importBatchId')) {
            eventStore.createIndex('importBatchId', 'importBatchId', { unique: false });
          }
          if (!eventStore.indexNames.contains('isSample')) {
            eventStore.createIndex('isSample', 'isSample', { unique: false });
          }
        }
      };

      request.onsuccess = async () => {
        this.db = request.result;
        try {
          // Record schema version in metadata
          await this.recordSchemaMigration(this.db, CURRENT_SCHEMA_VERSION);
        } catch {
          // ignore migration record write error
        }
        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private async recordSchemaMigration(db: IDBDatabase, version: number): Promise<void> {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('schema_meta', 'readwrite');
        const store = tx.objectStore('schema_meta');
        store.put({
          key: 'schema_version',
          version,
          migratedAt: new Date().toISOString(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async getHealth(): Promise<StorageHealth> {
    try {
      await this.getDB();
      let quotaEstimate: StorageHealth['quotaEstimate'] | undefined = undefined;

      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        try {
          const est = await navigator.storage.estimate();
          quotaEstimate = {
            usageBytes: est.usage,
            quotaBytes: est.quota,
            percentUsed:
              est.quota && est.usage ? Number(((est.usage / est.quota) * 100).toFixed(1)) : undefined,
          };
        } catch {
          // Quota estimate not available
        }
      }

      const batches = await this.getAllBatches();

      return {
        isAvailable: true,
        storageType: 'indexeddb',
        quotaEstimate,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        corruptedRecordsCount: this.corruptedCount,
        totalBatchesCount: batches.length,
        statusMessage: 'IndexedDB storage online and operational.',
      };
    } catch (err: any) {
      return {
        isAvailable: false,
        storageType: 'indexeddb',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        corruptedRecordsCount: this.corruptedCount,
        totalBatchesCount: 0,
        statusMessage: `IndexedDB unavailable: ${err?.message || 'Storage blocked.'}`,
      };
    }
  }

  async getAllEvents(): Promise<UsageEvent[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('events', 'readonly');
      const store = transaction.objectStore('events');
      const request = store.getAll();

      request.onsuccess = () => {
        const raw = request.result || [];
        const clean: UsageEvent[] = [];
        for (const item of raw) {
          if (item && item.id && item.timestamp && item.model) {
            clean.push({
              ...item,
              recordOrigin:
                item.recordOrigin ||
                (item.isSample ? 'sample' : item.source === 'manual' ? 'manual' : 'imported'),
            });
          } else {
            this.corruptedCount++;
          }
        }
        resolve(
          clean.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        );
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveEvents(events: UsageEvent[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('events', 'readwrite');
      const store = transaction.objectStore('events');

      transaction.onabort = () => {
        if (isQuotaExceededError(transaction.error)) {
          reject(
            new Error(
              'Storage quota exceeded. Please export a backup and delete older import batches to free space.'
            )
          );
        } else {
          reject(transaction.error);
        }
      };

      for (const ev of events) {
        if (!ev || !ev.id) continue;
        store.put({
          ...ev,
          recordOrigin:
            ev.recordOrigin || (ev.isSample ? 'sample' : ev.source === 'manual' ? 'manual' : 'imported'),
        });
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        if (isQuotaExceededError(transaction.error)) {
          reject(
            new Error(
              'Storage quota exceeded. Please export a backup and delete older import batches to free space.'
            )
          );
        } else {
          reject(transaction.error);
        }
      };
    });
  }

  /**
   * Transactionally saves an import batch and all its records.
   * If any record fails or quota is exceeded, the whole transaction rolls back.
   */
  async saveImportBatch(batch: ImportBatchRecord, events: UsageEvent[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['events', 'import_batches'], 'readwrite');
      const eventStore = transaction.objectStore('events');
      const batchStore = transaction.objectStore('import_batches');

      transaction.onabort = () => {
        if (isQuotaExceededError(transaction.error)) {
          reject(
            new Error(
              'Storage quota exceeded during batch import. Import was rolled back cleanly to preserve consistency.'
            )
          );
        } else {
          reject(transaction.error || new Error('Batch import transaction aborted.'));
        }
      };

      batchStore.put(batch);

      for (const ev of events) {
        if (!ev || !ev.id) continue;
        eventStore.put({
          ...ev,
          importBatchId: batch.id,
          isSample: batch.isSample,
          recordOrigin: batch.isSample ? 'sample' : 'imported',
        });
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        if (isQuotaExceededError(transaction.error)) {
          reject(
            new Error(
              'Storage quota exceeded during batch import. Import was rolled back cleanly to preserve consistency.'
            )
          );
        } else {
          reject(transaction.error);
        }
      };
    });
  }

  async deleteEvent(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('events', 'readwrite');
      const store = transaction.objectStore('events');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteBatch(batchId: string): Promise<{ deletedEventsCount: number }> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['events', 'import_batches'], 'readwrite');
      const eventStore = transaction.objectStore('events');
      const batchStore = transaction.objectStore('import_batches');
      let count = 0;

      // Use index if available, else cursor
      let request: IDBRequest;
      if (eventStore.indexNames.contains('importBatchId')) {
        const index = eventStore.index('importBatchId');
        request = index.openCursor(IDBKeyRange.only(batchId));
      } else {
        request = eventStore.openCursor();
      }

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          if (cursor.value.importBatchId === batchId) {
            cursor.delete();
            count++;
          }
          cursor.continue();
        } else {
          batchStore.delete(batchId);
        }
      };

      transaction.oncomplete = () => resolve({ deletedEventsCount: count });
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearAllEvents(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['events', 'import_batches'], 'readwrite');
      transaction.objectStore('events').clear();
      transaction.objectStore('import_batches').clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async removeSampleEvents(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['events', 'import_batches'], 'readwrite');
      const eventStore = transaction.objectStore('events');
      const batchStore = transaction.objectStore('import_batches');

      const req = eventStore.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          if (cursor.value.isSample || cursor.value.recordOrigin === 'sample' || String(cursor.value.importBatchId).startsWith('sample_')) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      const bReq = batchStore.openCursor();
      bReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          if (cursor.value.isSample || cursor.value.id.startsWith('sample_')) {
            cursor.delete();
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async resetSampleData(
    sampleEvents: UsageEvent[],
    sampleProjects: ProjectBudget[],
    defaultRates: PricingRate[]
  ): Promise<void> {
    await this.removeSampleEvents();

    const sampleBatch: ImportBatchRecord = {
      id: `sample_batch_${Date.now()}`,
      fileName: 'fictional-sample-workload.json',
      fileType: 'json',
      fileSize: 10240,
      importedAt: new Date().toISOString(),
      validCount: sampleEvents.length,
      duplicateCount: 0,
      rejectedCount: 0,
      totalTokens: sampleEvents.reduce((s, e) => s + (e.inputTokens + e.outputTokens), 0),
      totalCostUsd: sampleEvents.reduce((s, e) => s + (e.reportedCost || e.estimatedCost || 0), 0),
      isSample: true,
    };

    await this.saveImportBatch(sampleBatch, sampleEvents);

    for (const p of sampleProjects) {
      await this.saveProject(p);
    }
    for (const r of defaultRates) {
      await this.savePricingRate(r);
    }
  }

  async getAllBatches(): Promise<ImportBatchRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('import_batches', 'readonly');
      const store = transaction.objectStore('import_batches');
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result || []) as ImportBatchRecord[];
        resolve(list.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveBatchRecord(batch: ImportBatchRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('import_batches', 'readwrite');
      const store = transaction.objectStore('import_batches');
      const req = store.put(batch);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllProjects(): Promise<ProjectBudget[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveProject(project: ProjectBudget): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      const req = store.put(project);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllPricingRates(): Promise<PricingRate[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('pricing', 'readonly');
      const store = transaction.objectStore('pricing');
      const request = store.getAll();
      request.onsuccess = () => {
        const res = request.result || [];
        resolve(res.length > 0 ? res : DEFAULT_PRICING_CATALOG);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async savePricingRate(rate: PricingRate): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('pricing', 'readwrite');
      const store = transaction.objectStore('pricing');
      const req = store.put(rate);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deletePricingRate(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('pricing', 'readwrite');
      const store = transaction.objectStore('pricing');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllExperiments(): Promise<Experiment[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('experiments', 'readonly');
      const store = transaction.objectStore('experiments');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveExperiment(experiment: Experiment): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('experiments', 'readwrite');
      const store = transaction.objectStore('experiments');
      const req = store.put(experiment);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteExperiment(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('experiments', 'readwrite');
      const store = transaction.objectStore('experiments');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getSettings(): Promise<AppSettings> {
    // Check localStorage cache first for zero-latency hydration
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            return { ...DEFAULT_SETTINGS, ...parsed, storageType: 'indexeddb' };
          }
        }
      }
    } catch {
      // ignore localStorage read error
    }

    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction('settings', 'readonly');
        const store = transaction.objectStore('settings');
        const req = store.get('app_settings');
        req.onsuccess = () => {
          const val = req.result?.value;
          resolve(val ? { ...DEFAULT_SETTINGS, ...val, storageType: 'indexeddb' } : DEFAULT_SETTINGS);
        };
        req.onerror = () => resolve(DEFAULT_SETTINGS);
      });
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const payload = { ...settings, storageType: 'indexeddb' as const };
    // Synchronous localStorage write for small preference resilience
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(payload));
      }
    } catch {
      // ignore localStorage quota error
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readwrite');
      const store = transaction.objectStore('settings');
      const req = store.put({ key: 'app_settings', value: payload });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async wipeAllData(): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_SETTINGS_KEY);
      }
    } catch {
      // ignore
    }

    const db = await this.getDB();
    const stores = ['events', 'projects', 'pricing', 'experiments', 'settings', 'import_batches', 'schema_meta'];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(stores, 'readwrite');
      for (const s of stores) {
        if (db.objectStoreNames.contains(s)) {
          transaction.objectStore(s).clear();
        }
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async exportAllToJson(): Promise<string> {
    const [events, projects, pricing, experiments, importBatches, settings] = await Promise.all([
      this.getAllEvents(),
      this.getAllProjects(),
      this.getAllPricingRates(),
      this.getAllExperiments(),
      this.getAllBatches(),
      this.getSettings(),
    ]);

    const sampleEventsCount = events.filter((e) => e.isSample || e.recordOrigin === 'sample').length;
    const realEventsCount = events.length - sampleEventsCount;

    const backup: TokenBudgeterBackup = {
      app: 'TokenBudgeter',
      version: '1.0.0',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      provenanceSummary: {
        sampleEventsCount,
        realEventsCount,
        totalEventsCount: events.length,
      },
      data: {
        events,
        projects,
        pricing,
        experiments,
        importBatches,
        settings,
      },
    };

    return JSON.stringify(backup, null, 2);
  }

  async importBackupJson(jsonString: string): Promise<{
    importedEvents: number;
    importedProjects: number;
    importedPricing: number;
    importedExperiments: number;
    importedBatches: number;
  }> {
    const parsed = validateBackupPayload(jsonString);
    const { events, projects, pricing, experiments, importBatches, settings } = parsed.data;

    const db = await this.getDB();
    const stores = ['events', 'projects', 'pricing', 'experiments', 'import_batches', 'settings'];

    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(stores, 'readwrite');
      } catch (err) {
        return reject(err);
      }

      let eCount = 0;
      if (Array.isArray(events) && events.length > 0) {
        const eventStore = transaction.objectStore('events');
        for (const ev of events) {
          if (ev && ev.id) {
            eventStore.put({
              ...ev,
              recordOrigin: ev.recordOrigin || (ev.isSample ? 'sample' : ev.source === 'manual' ? 'manual' : 'imported'),
            });
            eCount++;
          }
        }
      }

      let pCount = 0;
      if (Array.isArray(projects) && projects.length > 0) {
        const projectStore = transaction.objectStore('projects');
        for (const p of projects) {
          if (p && p.id) {
            projectStore.put(p);
            pCount++;
          }
        }
      }

      let prCount = 0;
      if (Array.isArray(pricing) && pricing.length > 0) {
        const pricingStore = transaction.objectStore('pricing');
        for (const pr of pricing) {
          if (pr && pr.id) {
            pricingStore.put(pr);
            prCount++;
          }
        }
      }

      let expCount = 0;
      if (Array.isArray(experiments) && experiments.length > 0) {
        const expStore = transaction.objectStore('experiments');
        for (const exp of experiments) {
          if (exp && exp.id) {
            expStore.put(exp);
            expCount++;
          }
        }
      }

      let bCount = 0;
      if (Array.isArray(importBatches) && importBatches.length > 0) {
        const batchStore = transaction.objectStore('import_batches');
        for (const b of importBatches) {
          if (b && b.id) {
            batchStore.put(b);
            bCount++;
          }
        }
      }

      if (settings) {
        const settingsStore = transaction.objectStore('settings');
        const payload = { ...settings, storageType: 'indexeddb' as const };
        settingsStore.put({ key: 'app_settings', value: payload });

        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(payload));
          }
        } catch {
          // ignore localStorage quota error
        }
      }

      transaction.oncomplete = () => {
        resolve({
          importedEvents: eCount,
          importedProjects: pCount,
          importedPricing: prCount,
          importedExperiments: expCount,
          importedBatches: bCount,
        });
      };

      transaction.onerror = () => {
        if (isQuotaExceededError(transaction.error)) {
          reject(
            new Error(
              'Storage quota exceeded during backup restore. Operation was rolled back cleanly to preserve existing data.'
            )
          );
        } else {
          reject(transaction.error || new Error('Failed to restore backup due to database transaction error.'));
        }
      };
    });
  }
}

/**
 * Storage Manager Singleton
 * Automatically routes to IndexedDB in browser, or MemoryStorageAdapter when IndexedDB is unavailable.
 */
class StorageManager {
  private adapter: IStorageAdapter;

  constructor() {
    if (typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined') {
      this.adapter = new IndexedDbStorageAdapter();
    } else {
      this.adapter = new MemoryStorageAdapter();
    }
  }

  getAdapter(): IStorageAdapter {
    return this.adapter;
  }

  setAdapter(adapter: IStorageAdapter) {
    this.adapter = adapter;
  }
}

export const storageManager = new StorageManager();

// -------------------------------------------------------------
// Top-Level Canonical Storage API (Used across all components)
// -------------------------------------------------------------

export async function getStorageHealth(): Promise<StorageHealth> {
  return storageManager.getAdapter().getHealth();
}

export async function getAllEvents(): Promise<UsageEvent[]> {
  return storageManager.getAdapter().getAllEvents();
}

export async function saveEvents(events: UsageEvent[]): Promise<void> {
  return storageManager.getAdapter().saveEvents(events);
}

export async function saveImportBatch(batch: ImportBatchRecord, events: UsageEvent[]): Promise<void> {
  return storageManager.getAdapter().saveImportBatch(batch, events);
}

export async function deleteEvent(id: string): Promise<void> {
  return storageManager.getAdapter().deleteEvent(id);
}

export async function deleteBatch(batchId: string): Promise<{ deletedEventsCount: number }> {
  return storageManager.getAdapter().deleteBatch(batchId);
}

export async function clearAllEvents(): Promise<void> {
  return storageManager.getAdapter().clearAllEvents();
}

export async function removeSampleEvents(): Promise<void> {
  return storageManager.getAdapter().removeSampleEvents();
}

export async function resetSampleData(
  sampleEvents: UsageEvent[] = generateSampleEvents(),
  sampleProjects: ProjectBudget[] = SAMPLE_PROJECTS,
  defaultRates: PricingRate[] = DEFAULT_PRICING_CATALOG
): Promise<void> {
  return storageManager.getAdapter().resetSampleData(sampleEvents, sampleProjects, defaultRates);
}

export async function getAllBatches(): Promise<ImportBatchRecord[]> {
  return storageManager.getAdapter().getAllBatches();
}

export async function saveBatchRecord(batch: ImportBatchRecord): Promise<void> {
  return storageManager.getAdapter().saveBatchRecord(batch);
}

export async function getAllProjects(): Promise<ProjectBudget[]> {
  return storageManager.getAdapter().getAllProjects();
}

export async function saveProject(project: ProjectBudget): Promise<void> {
  return storageManager.getAdapter().saveProject(project);
}

export async function deleteProject(id: string): Promise<void> {
  return storageManager.getAdapter().deleteProject(id);
}

export async function getAllPricingRates(): Promise<PricingRate[]> {
  return storageManager.getAdapter().getAllPricingRates();
}

export async function savePricingRate(rate: PricingRate): Promise<void> {
  return storageManager.getAdapter().savePricingRate(rate);
}

export async function deletePricingRate(id: string): Promise<void> {
  return storageManager.getAdapter().deletePricingRate(id);
}

export async function getAllExperiments(): Promise<Experiment[]> {
  return storageManager.getAdapter().getAllExperiments();
}

export async function saveExperiment(experiment: Experiment): Promise<void> {
  return storageManager.getAdapter().saveExperiment(experiment);
}

export async function deleteExperiment(id: string): Promise<void> {
  return storageManager.getAdapter().deleteExperiment(id);
}

export async function getSettings(): Promise<AppSettings> {
  return storageManager.getAdapter().getSettings();
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return storageManager.getAdapter().saveSettings(settings);
}

export async function wipeAllData(): Promise<void> {
  return storageManager.getAdapter().wipeAllData();
}

export async function exportAllToJson(): Promise<string> {
  return storageManager.getAdapter().exportAllToJson();
}

export async function importBackupJson(jsonString: string): Promise<{
  importedEvents: number;
  importedProjects: number;
  importedPricing: number;
  importedExperiments: number;
  importedBatches: number;
}> {
  return storageManager.getAdapter().importBackupJson(jsonString);
}

/**
 * Cold-boot initializer.
 * Ensures baseline pricing rate cards are initialized so rate calculation works.
 * Does NOT inject sample data into a user's real workspace.
 */
export async function initStorageBaseline(): Promise<void> {
  const existingRates = await getAllPricingRates();
  if (existingRates.length === 0) {
    for (const rate of DEFAULT_PRICING_CATALOG) {
      await savePricingRate(rate);
    }
  }
}

/**
 * Loads or reloads the complete fictional demo dataset.
 * Idempotently purges existing sample records first to prevent duplicate records or double-counting.
 * Real user records (imported, manual, sync) are left strictly untouched.
 */
export async function loadDemoData(): Promise<{ eventsLoaded: number; projectsLoaded: number }> {
  await removeSampleEvents();

  const sampleEvents = generateSampleEvents();
  const sampleProjects = SAMPLE_PROJECTS;
  const defaultRates = DEFAULT_PRICING_CATALOG;

  const sampleBatch: ImportBatchRecord = {
    id: `sample_batch_${Date.now()}`,
    fileName: 'fictional-developer-sample.json',
    fileType: 'json',
    fileSize: 15420,
    importedAt: new Date().toISOString(),
    validCount: sampleEvents.length,
    duplicateCount: 0,
    rejectedCount: 0,
    totalTokens: sampleEvents.reduce((s, e) => s + (e.inputTokens + e.outputTokens), 0),
    totalCostUsd: sampleEvents.reduce((s, e) => s + (e.reportedCost || e.estimatedCost || 0), 0),
    isSample: true,
  };

  await saveImportBatch(sampleBatch, sampleEvents);

  for (const proj of sampleProjects) {
    await saveProject(proj);
  }
  for (const rate of defaultRates) {
    await savePricingRate(rate);
  }

  // Seed initial A/B experiment
  const initialExperiment: Experiment = {
    id: 'exp_pr_review_caching_v1',
    name: 'PR Review Bot: Claude 3.5 Sonnet Prompt Caching A/B',
    taskCategory: 'pr_review',
    baselineModel: 'claude-3-5-sonnet (uncached)',
    experimentalModel: 'claude-3-5-sonnet (with 90% prompt caching)',
    baselineConfig: 'Full AST context re-sent on every PR commit (92k in, 480 out)',
    experimentalConfig: 'System prompt and repo symbols marked with anthropic-beta cache_control',
    baselineRuns: [
      { tokensIn: 92400, tokensOut: 480, costUsd: 0.2844, latencyMs: 5120, success: true, qualityScore: 92 },
      { tokensIn: 93600, tokensOut: 510, costUsd: 0.2884, latencyMs: 5310, success: true, qualityScore: 90 },
      { tokensIn: 91800, tokensOut: 460, costUsd: 0.2823, latencyMs: 4980, success: true, qualityScore: 91 },
    ],
    experimentalRuns: [
      { tokensIn: 92400, tokensOut: 480, costUsd: 0.0349, latencyMs: 1420, success: true, qualityScore: 92 },
      { tokensIn: 93600, tokensOut: 510, costUsd: 0.0357, latencyMs: 1390, success: true, qualityScore: 91 },
      { tokensIn: 91800, tokensOut: 460, costUsd: 0.0346, latencyMs: 1450, success: true, qualityScore: 93 },
    ],
    notes: 'Testing Anthropic prompt cache read discount. Quality maintained while reducing cost by ~87% and latency by ~72%.',
    createdAt: new Date().toISOString(),
  };
  await saveExperiment(initialExperiment);

  return { eventsLoaded: sampleEvents.length, projectsLoaded: sampleProjects.length };
}

/**
 * Initializes a clean empty workspace: removes demo data and ensures baseline rates.
 */
export async function startFreshWorkspace(): Promise<void> {
  await removeSampleEvents();
  await initStorageBaseline();
}

/**
 * Backward-compatible initializer for tests.
 */
export async function initStorageWithSampleIfEmpty(): Promise<boolean> {
  const existingEvents = await getAllEvents();
  if (existingEvents.length === 0) {
    await loadDemoData();
    return true;
  }
  return false;
}
