import type { BatchRecord } from "../domain/batch";
import type { AppSettings, CandidateSummary, CatalogRecord, PublicSettings } from "../shared/types";

const SETTINGS_KEY = "settings";
const CATALOG_KEY = "catalog";
const BATCHES_KEY = "batches";
const PRIVATE_BATCHES_KEY = "privateBatches";
const SUMMARIES_KEY = "candidateSummaries";
const QUICK_BATCHES_KEY = "quickBatches";

const DEFAULT_SETTINGS: AppSettings = {
  keyValidated: false,
  onboardingComplete: false,
  globalPaused: false,
  excludedHosts: [],
  includeNsfw: false,
  notificationsEnabled: false,
};

export async function getSettings(): Promise<AppSettings> {
  const stored = (await browser.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY] as Partial<AppSettings> | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    excludedHosts: Array.isArray(stored?.excludedHosts) ? stored.excludedHosts.filter((host) => typeof host === "string") : [],
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}

export function publicSettings(settings: AppSettings): PublicSettings {
  return {
    keyConfigured: Boolean(settings.apiKey),
    keyValidated: settings.keyValidated,
    onboardingComplete: settings.onboardingComplete,
    globalPaused: settings.globalPaused,
    excludedHosts: settings.excludedHosts,
    includeNsfw: settings.includeNsfw,
    notificationsEnabled: settings.notificationsEnabled,
  };
}

export async function getCatalog(): Promise<CatalogRecord | null> {
  return ((await browser.storage.local.get(CATALOG_KEY))[CATALOG_KEY] as CatalogRecord | undefined) ?? null;
}

export async function saveCatalog(catalog: CatalogRecord): Promise<void> {
  await browser.storage.local.set({ [CATALOG_KEY]: catalog });
}

async function readBatchMap(privateBatch: boolean): Promise<Record<string, BatchRecord>> {
  const area = privateBatch ? browser.storage.session : browser.storage.local;
  const key = privateBatch ? PRIVATE_BATCHES_KEY : BATCHES_KEY;
  return ((await area.get(key))[key] as Record<string, BatchRecord> | undefined) ?? {};
}

async function writeBatchMap(privateBatch: boolean, batches: Record<string, BatchRecord>): Promise<void> {
  const area = privateBatch ? browser.storage.session : browser.storage.local;
  const key = privateBatch ? PRIVATE_BATCHES_KEY : BATCHES_KEY;
  await area.set({ [key]: batches });
}

let batchWrite = Promise.resolve();

export async function saveBatch(batch: BatchRecord): Promise<void> {
  batchWrite = batchWrite.then(async () => {
    const batches = await readBatchMap(batch.private);
    batches[batch.id] = batch;
    await writeBatchMap(batch.private, batches);
  });
  await batchWrite;
}

export async function getBatch(batchId: string): Promise<BatchRecord | null> {
  const [ordinary, privateBatches] = await Promise.all([readBatchMap(false), readBatchMap(true)]);
  return ordinary[batchId] ?? privateBatches[batchId] ?? null;
}

export async function listBatches(privateBatch: boolean): Promise<BatchRecord[]> {
  return Object.values(await readBatchMap(privateBatch));
}

export async function deleteBatch(batchId: string): Promise<void> {
  batchWrite = batchWrite.then(async () => {
    for (const privateBatch of [false, true]) {
      const batches = await readBatchMap(privateBatch);
      if (batches[batchId]) {
        delete batches[batchId];
        await writeBatchMap(privateBatch, batches);
      }
    }
  });
  await batchWrite;
}

export async function saveSummary(summary: CandidateSummary): Promise<void> {
  const summaries = await getSummaries();
  summaries[String(summary.tabId)] = summary;
  await browser.storage.session.set({ [SUMMARIES_KEY]: summaries });
}

export async function getSummaries(): Promise<Record<string, CandidateSummary>> {
  return ((await browser.storage.session.get(SUMMARIES_KEY))[SUMMARIES_KEY] as Record<string, CandidateSummary> | undefined) ?? {};
}

export async function getSummary(tabId: number): Promise<CandidateSummary | null> {
  return (await getSummaries())[String(tabId)] ?? null;
}

export async function deleteSummary(tabId: number): Promise<void> {
  const summaries = await getSummaries();
  delete summaries[String(tabId)];
  await browser.storage.session.set({ [SUMMARIES_KEY]: summaries });
}

async function getQuickBatchMap(): Promise<Record<string, string>> {
  return ((await browser.storage.session.get(QUICK_BATCHES_KEY))[QUICK_BATCHES_KEY] as Record<string, string> | undefined) ?? {};
}

export async function getQuickBatchId(tabId: number): Promise<string | null> {
  return (await getQuickBatchMap())[String(tabId)] ?? null;
}

export async function saveQuickBatch(tabId: number, batchId: string): Promise<void> {
  const batches = await getQuickBatchMap();
  batches[String(tabId)] = batchId;
  await browser.storage.session.set({ [QUICK_BATCHES_KEY]: batches });
}

export async function deleteQuickBatch(tabId: number): Promise<void> {
  const batches = await getQuickBatchMap();
  delete batches[String(tabId)];
  await browser.storage.session.set({ [QUICK_BATCHES_KEY]: batches });
}

export async function deleteQuickBatchReferences(batchId: string): Promise<void> {
  const batches = await getQuickBatchMap();
  for (const [tabId, storedBatchId] of Object.entries(batches)) {
    if (storedBatchId === batchId) delete batches[tabId];
  }
  await browser.storage.session.set({ [QUICK_BATCHES_KEY]: batches });
}
