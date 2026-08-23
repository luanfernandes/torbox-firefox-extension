import {
  applyWebDownload,
  batchIsReady,
  batchNeedsAttention,
  createBatch,
  findUniqueReconciliation,
  markCancelled,
  markCreateFailed,
  markCreateSucceeded,
  markCreateUnknown,
  markCreating,
  markQueued,
  sourceMd5,
  timeoutBatch,
  type BatchRecord,
} from "../domain/batch";
import { buildMatcher, findCandidate, normalizeSourceUrl } from "../domain/catalog";
import type { CandidateLink } from "../domain/catalog";
import type {
  AppSettings,
  CandidateSummary,
  CatalogRecord,
  PopupState,
  RuntimeRequest,
  RuntimeResponse,
  ScannerConfig,
} from "../shared/types";
import { TorBoxClient, TorBoxError, type WebDownloadRecord } from "../torbox/client";
import {
  deleteBatch,
  deleteQuickBatch,
  deleteQuickBatchReferences,
  deleteSummary,
  getBatch,
  getCatalog,
  getQuickBatchId,
  getSettings,
  getSummary,
  listBatches,
  publicSettings,
  saveBatch,
  saveCatalog,
  saveQuickBatch,
  saveSettings,
  saveSummary,
} from "./storage";

const CATALOG_ALARM = "catalog-refresh";
const BATCH_ALARM = "batch-observation";
const CATALOG_TTL = 86_400_000;
const HISTORY_TTL = 7 * 86_400_000;
const CANDIDATE_CAP = 100;
const LIST_PAGE_SIZE = 1_000;
const processingBatches = new Set<string>();
let createQueue: Promise<void> = Promise.resolve();
let listCache: { token: string; fetchedAt: number; records: WebDownloadRecord[] } | null = null;
let listRequest: { token: string; promise: Promise<WebDownloadRecord[]> } | null = null;

function ok(value: Omit<Extract<RuntimeResponse, { ok: true }>, "ok"> = {}): RuntimeResponse {
  return { ok: true, ...value };
}

function fail(error: string, duplicateSources?: string[]): RuntimeResponse {
  return duplicateSources ? { ok: false, error, duplicateSources } : { ok: false, error };
}

function safeDetail(error: unknown, ...secrets: Array<string | undefined>): string {
  const original = error instanceof TorBoxError ? error.detail : error instanceof Error ? error.message : "Unknown error";
  let result = original
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/([?&]token=)[^&\s]+/gi, "$1[redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL redacted]");
  for (const secret of secrets) if (secret) result = result.replaceAll(secret, "[redacted]");
  return result.slice(0, 500);
}

function catalogIsFresh(catalog: CatalogRecord | null): boolean {
  return Boolean(catalog?.verified && Date.now() - catalog.fetchedAt < CATALOG_TTL);
}

function activeEntries(catalog: CatalogRecord, settings: AppSettings) {
  return catalog.entries.filter((entry) =>
    entry.type === "hoster" && entry.status && (settings.includeNsfw || !entry.nsfw),
  );
}

async function broadcastConfigChanged(): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map(async (tab) => {
    if (tab.id === undefined) return;
    try {
      await browser.tabs.sendMessage(tab.id, { type: "CATALOG_CHANGED" } satisfies RuntimeRequest);
    } catch {
      // Protected and unloaded tabs have no scanner.
    }
  }));
}

async function refreshCatalog(token: string, requireSuccess: boolean): Promise<CatalogRecord | null> {
  const previous = await getCatalog();
  try {
    const entries = await new TorBoxClient(token).getHosters();
    const catalog: CatalogRecord = {
      entries,
      fetchedAt: Date.now(),
      version: (previous?.version ?? 0) + 1,
      verified: true,
    };
    await saveCatalog(catalog);
    await broadcastConfigChanged();
    return catalog;
  } catch (error) {
    if (previous) {
      const cached = { ...previous, version: previous.version + 1, verified: false };
      await saveCatalog(cached);
      await broadcastConfigChanged();
    }
    if (requireSuccess) throw error;
    return previous ? { ...previous, verified: false } : null;
  }
}

async function scannerConfig(sender: browser.runtime.MessageSender): Promise<RuntimeResponse> {
  const settings = await getSettings();
  const sourceUrl = sender.url ? normalizeSourceUrl(sender.url) : null;
  if (!settings.apiKey || !settings.keyValidated || !settings.onboardingComplete) {
    return ok({ scannerConfig: { enabled: false, reason: "setup", entries: [], catalogVersion: 0, verified: false, candidateCap: CANDIDATE_CAP } });
  }
  if (settings.globalPaused) {
    return ok({ scannerConfig: { enabled: false, reason: "paused", entries: [], catalogVersion: 0, verified: false, candidateCap: CANDIDATE_CAP } });
  }
  if (sourceUrl && settings.excludedHosts.includes(sourceUrl.hostname.toLowerCase())) {
    return ok({ scannerConfig: { enabled: false, reason: "excluded", entries: [], catalogVersion: 0, verified: false, candidateCap: CANDIDATE_CAP } });
  }

  let catalog = await getCatalog();
  if (!catalog || Date.now() - catalog.fetchedAt >= CATALOG_TTL) {
    catalog = await refreshCatalog(settings.apiKey, false);
  }
  if (!catalog) {
    return ok({ scannerConfig: { enabled: false, reason: "catalog", entries: [], catalogVersion: 0, verified: false, candidateCap: CANDIDATE_CAP } });
  }

  const config: ScannerConfig = {
    enabled: true,
    entries: activeEntries(catalog, settings),
    catalogVersion: catalog.version,
    verified: catalogIsFresh(catalog),
    candidateCap: CANDIDATE_CAP,
  };
  return ok({ scannerConfig: config });
}

async function publishSummary(request: Extract<RuntimeRequest, { type: "PUBLISH_SUMMARY" }>, sender: browser.runtime.MessageSender): Promise<RuntimeResponse> {
  if (sender.frameId !== 0 || sender.tab?.id === undefined || !sender.url) return fail("Invalid scanner sender");
  const source = normalizeSourceUrl(sender.url);
  if (!source || source.hostname !== request.hostname || request.candidateCount < 0 || request.candidateCount > CANDIDATE_CAP) {
    return fail("Invalid scanner summary");
  }
  const summary: CandidateSummary = {
    tabId: sender.tab.id,
    scannerId: request.scannerId.slice(0, 100),
    hostname: request.hostname,
    candidateCount: request.candidateCount,
    hosterCounts: request.hosterCounts,
    catalogVersion: request.catalogVersion,
    truncated: request.truncated,
    verified: request.verified,
    private: Boolean(sender.tab.incognito),
    scannedAt: Date.now(),
  };
  await saveSummary(summary);
  await browser.action.setBadgeText({ tabId: sender.tab.id, text: request.candidateCount > 0 ? String(Math.min(999, request.candidateCount)) : "" });
  await browser.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: request.verified ? "#2563eb" : "#9a6700" });
  return ok();
}

async function popupState(tabId: number): Promise<RuntimeResponse> {
  const [tab, settings, catalog, summary, quickBatchId] = await Promise.all([
    browser.tabs.get(tabId),
    getSettings(),
    getCatalog(),
    getSummary(tabId),
    getQuickBatchId(tabId),
  ]);
  const pageUrl = tab.url ? normalizeSourceUrl(tab.url) : null;
  let candidates: CandidateLink[] = [];
  let truncated = summary?.truncated ?? false;
  if (pageUrl && summary) {
    try {
      const response = await browser.tabs.sendMessage(tabId, { type: "GET_CANDIDATES" } satisfies RuntimeRequest) as {
        scannerId?: string;
        candidates?: unknown;
        truncated?: boolean;
      };
      if (response?.scannerId === summary.scannerId && Array.isArray(response.candidates) && catalog) {
        const matcher = buildMatcher(activeEntries(catalog, settings), { includeNsfw: true });
        candidates = response.candidates.flatMap((candidate) => {
          if (typeof candidate !== "object" || candidate === null || !("url" in candidate) || typeof candidate.url !== "string") return [];
          const validated = findCandidate(candidate.url, matcher);
          return validated ? [validated] : [];
        }).slice(0, CANDIDATE_CAP);
        truncated = Boolean(response.truncated);
      }
    } catch {
      candidates = [];
    }
  }
  const state: PopupState = {
    tabId,
    private: Boolean(tab.incognito),
    hostname: pageUrl?.hostname ?? "",
    settings: publicSettings(settings),
    candidates,
    verified: catalogIsFresh(catalog),
    truncated,
  };
  if (tab.windowId !== undefined) state.windowId = tab.windowId;
  if (catalog) state.catalogFetchedAt = catalog.fetchedAt;
  if (quickBatchId) {
    const quickBatch = await getBatch(quickBatchId);
    if (quickBatch) state.quickBatch = quickBatch;
    else await deleteQuickBatch(tabId);
  }
  return ok({ popupState: state });
}

async function updateSettings(change: (settings: AppSettings) => AppSettings): Promise<RuntimeResponse> {
  const settings = change(await getSettings());
  await saveSettings(settings);
  await broadcastConfigChanged();
  return ok({ settings: publicSettings(settings) });
}

async function saveApiKey(apiKey: string): Promise<RuntimeResponse> {
  const token = apiKey.trim();
  if (!token) return fail("Enter a TorBox API key");
  try {
    const entries = await new TorBoxClient(token).getHosters();
    const previous = await getCatalog();
    await saveCatalog({ entries, fetchedAt: Date.now(), version: (previous?.version ?? 0) + 1, verified: true });
    const settings: AppSettings = {
      ...await getSettings(),
      apiKey: token,
      keyValidated: true,
      onboardingComplete: true,
    };
    await saveSettings(settings);
    await broadcastConfigChanged();
    return ok({ settings: publicSettings(settings) });
  } catch (error) {
    return fail(safeDetail(error, token));
  }
}

async function allWebDownloads(client: TorBoxClient): Promise<WebDownloadRecord[]> {
  const records: WebDownloadRecord[] = [];
  const seen = new Set<string>();
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const page = await client.listWebDownloads({ offset, limit: LIST_PAGE_SIZE });
    let newItems = 0;
    for (const item of page) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        records.push(item);
        newItems += 1;
      }
    }
    if (page.length < LIST_PAGE_SIZE || newItems === 0) break;
  }
  return records;
}

async function sharedWebDownloads(token: string): Promise<WebDownloadRecord[]> {
  if (listCache?.token === token && Date.now() - listCache.fetchedAt < 4_500) return listCache.records;
  if (listRequest?.token === token) return listRequest.promise;
  const promise = allWebDownloads(new TorBoxClient(token)).then((records) => {
    listCache = { token, fetchedAt: Date.now(), records };
    return records;
  }).finally(() => {
    if (listRequest?.promise === promise) listRequest = null;
  });
  listRequest = { token, promise };
  return promise;
}

async function notifyBatch(batch: BatchRecord): Promise<BatchRecord> {
  if (batch.private || batch.notificationState !== "none") return batch;
  const settings = await getSettings();
  if (!settings.notificationsEnabled || !await browser.permissions.contains({ permissions: ["notifications"] })) return batch;
  const ready = batchIsReady(batch);
  const attention = batchNeedsAttention(batch) || Boolean(batch.attentionReason);
  if (!ready && !attention) return batch;
  await browser.notifications.create(`batch:${batch.id}`, {
    type: "basic",
    iconUrl: browser.runtime.getURL("icons/torbox-96.svg"),
    title: ready ? "TorBox batch ready" : "TorBox batch needs attention",
    message: ready ? "Open the batch to choose files and generate links." : batch.attentionReason ?? "Open the batch to review its status.",
  });
  return { ...batch, notificationState: ready ? "ready" : "attention" };
}

async function observeBatch(batchId: string): Promise<void> {
  let batch = await getBatch(batchId);
  if (!batch) return;
  if (Date.now() >= batch.observationEndsAt) {
    batch = timeoutBatch(batch, Date.now());
    batch.attentionReason = "Automatic observation ended after 24 hours.";
    batch = await notifyBatch(batch);
    await saveBatch(batch);
    return;
  }
  const settings = await getSettings();
  if (!settings.apiKey || !settings.keyValidated) return;
  try {
    const records = await sharedWebDownloads(settings.apiKey);
    const ownedIds = new Set(batch.items.map((item) => item.webdownloadId).filter((id): id is string => Boolean(id)));
    for (const record of records) {
      if (ownedIds.has(record.id)) batch = applyWebDownload(batch, record, Date.now());
    }
    delete batch.attentionReason;
    batch = await notifyBatch(batch);
    await saveBatch(batch);
  } catch (error) {
    batch.attentionReason = safeDetail(error, settings.apiKey);
    batch = await notifyBatch(batch);
    await saveBatch(batch);
  }
}

async function observeAllBatches(): Promise<void> {
  const batches = [...await listBatches(false), ...await listBatches(true)];
  const settings = await getSettings();
  if (!settings.apiKey || !settings.keyValidated) return;
  let records: WebDownloadRecord[];
  try {
    records = await sharedWebDownloads(settings.apiKey);
  } catch (error) {
    for (let batch of batches) {
      batch.attentionReason = safeDetail(error, settings.apiKey);
      batch = await notifyBatch(batch);
      await saveBatch(batch);
    }
    return;
  }
  for (let batch of batches) {
    if (Date.now() >= batch.observationEndsAt) {
      batch = timeoutBatch(batch, Date.now());
      batch.attentionReason = "Automatic observation ended after 24 hours.";
    } else {
      const ownedIds = new Set(batch.items.map((item) => item.webdownloadId).filter((id): id is string => Boolean(id)));
      for (const record of records) if (ownedIds.has(record.id)) batch = applyWebDownload(batch, record, Date.now());
      delete batch.attentionReason;
    }
    batch = await notifyBatch(batch);
    await saveBatch(batch);
  }
  await cleanupHistory();
}

function enqueueBatch(batchId: string): void {
  createQueue = createQueue.then(() => processBatch(batchId)).catch(() => undefined);
}

async function processBatch(batchId: string): Promise<void> {
  if (processingBatches.has(batchId)) return;
  processingBatches.add(batchId);
  try {
    let batch = await getBatch(batchId);
    if (!batch || Date.now() >= batch.observationEndsAt) return;
    const settings = await getSettings();
    if (!settings.apiKey || !settings.keyValidated) {
      batch.attentionReason = "A valid TorBox API key is required.";
      await saveBatch(await notifyBatch(batch));
      return;
    }
    let catalog: CatalogRecord;
    try {
      const refreshed = await refreshCatalog(settings.apiKey, true);
      if (!refreshed) throw new Error("TorBox returned no Hoster catalog");
      catalog = refreshed;
    } catch (error) {
      batch.attentionReason = safeDetail(error, settings.apiKey);
      await saveBatch(await notifyBatch(batch));
      return;
    }
    const matcher = buildMatcher(activeEntries(catalog, settings), { includeNsfw: true });
    const client = new TorBoxClient(settings.apiKey);

    for (;;) {
      batch = await getBatch(batchId);
      if (!batch) return;
      const item = batch.items.find((candidate) => candidate.state === "queued");
      if (!item) break;
      if (!item.rawSource || !findCandidate(item.rawSource, matcher)) {
        batch = markCreateFailed(batch, item.id, "The Hoster is not currently available.", Date.now());
        await saveBatch(batch);
        continue;
      }
      batch = markCreating(batch, item.id, Date.now());
      await saveBatch(batch);
      try {
        const result = await client.createWebDownload(item.rawSource, item.password);
        batch = markCreateSucceeded(batch, item.id, result.webdownloadId, Date.now());
        delete batch.attentionReason;
        await saveBatch(batch);
      } catch (error) {
        batch = await getBatch(batchId) ?? batch;
        if (error instanceof TorBoxError) {
          if (error.rateLimited) {
            batch = markQueued(batch, item.id, Date.now());
            batch.pausedUntil = error.retryAfterSeconds ? Date.now() + error.retryAfterSeconds * 1_000 : Date.now() + 60_000;
            batch.attentionReason = "TorBox paused the create queue because its rate limit was reached.";
            await saveBatch(await notifyBatch(batch));
            break;
          }
          batch = markCreateFailed(batch, item.id, safeDetail(error, settings.apiKey, item.rawSource, item.password), Date.now());
          if (error.status === 401 || error.status === 403) {
            batch.attentionReason = "The TorBox API key is no longer valid.";
            await saveBatch(await notifyBatch(batch));
            break;
          }
          await saveBatch(batch);
          continue;
        }

        batch = markCreateUnknown(batch, item.id, "The create response was lost. Checking TorBox before retrying.", Date.now());
        await saveBatch(batch);
        try {
          const records = await allWebDownloads(client);
          const match = findUniqueReconciliation(item.rawSource, item.createStartedAt ?? Date.now(), records);
          if (match) {
            batch = markCreateSucceeded(batch, item.id, match.id, Date.now());
          } else {
            batch.attentionReason = "TorBox may have accepted one source, but the extension could not prove which item it created.";
          }
        } catch {
          batch.attentionReason = "TorBox may have accepted one source. Reconciliation also failed.";
        }
        await saveBatch(await notifyBatch(batch));
        break;
      }
    }
    await observeBatch(batchId);
    await scheduleBatchAlarm();
  } finally {
    processingBatches.delete(batchId);
  }
}

async function scheduleBatchAlarm(): Promise<void> {
  const active = [...await listBatches(false), ...await listBatches(true)].some((batch) =>
    Date.now() < batch.observationEndsAt && batch.items.some((item) => ["queued", "creating", "processing"].includes(item.state)),
  );
  if (active) await browser.alarms.create(BATCH_ALARM, { delayInMinutes: 1 });
  else await browser.alarms.clear(BATCH_ALARM);
}

async function cleanupHistory(): Promise<void> {
  const batches = await listBatches(false);
  for (const batch of batches) {
    const terminal = batch.items.every((item) => ["ready_to_generate", "failed", "cancelled", "timed_out"].includes(item.state));
    if (terminal && Date.now() - batch.updatedAt >= HISTORY_TTL) await deleteBatch(batch.id);
  }
}

async function createNewBatch(request: Extract<RuntimeRequest, { type: "CREATE_BATCH" }>): Promise<RuntimeResponse> {
  const settings = await getSettings();
  if (!settings.apiKey || !settings.keyValidated) return fail("Save a valid TorBox API key first.");
  if (request.selections.length < 1 || request.selections.length > 60) return fail("Select between 1 and 60 links.");
  const quickMode = request.openBatchTab === false;
  if (quickMode && (request.selections.length !== 1 || request.sourceTabId === undefined)) {
    return fail("Quick download requires one source and its page tab.");
  }
  if (quickMode) {
    try {
      const sourceTab = await browser.tabs.get(request.sourceTabId!);
      if (Boolean(sourceTab.incognito) !== request.private) return fail("The source tab privacy context changed.");
    } catch {
      return fail("The source tab is no longer available.");
    }
  }

  let catalog: CatalogRecord;
  try {
    const refreshed = await refreshCatalog(settings.apiKey, true);
    if (!refreshed) throw new Error("TorBox returned no Hoster catalog");
    catalog = refreshed;
  } catch (error) {
    return fail(safeDetail(error, settings.apiKey));
  }
  const matcher = buildMatcher(activeEntries(catalog, settings), { includeNsfw: true });
  let validated;
  try {
    validated = request.selections.map((selection) => {
      const candidate = findCandidate(selection.url, matcher);
      if (!candidate || candidate.hosterId !== selection.hosterId) throw new Error("A selected Hoster is not currently available.");
      return { ...selection, url: candidate.url, hosterName: candidate.hosterName };
    });
  } catch (error) {
    return fail(safeDetail(error, settings.apiKey));
  }

  const recent = await listBatches(request.private);
  const recentHashes = new Set(recent.filter((batch) => Date.now() - batch.createdAt < HISTORY_TTL).flatMap((batch) => batch.items.map((item) => item.sourceHash)));
  const duplicates = validated.filter((selection) => recentHashes.has(sourceMd5(selection.url))).map((selection) => selection.url);
  if (duplicates.length > 0 && !request.allowDuplicates) {
    return fail("One or more links already exist in a recent batch.", duplicates);
  }

  const batch = createBatch({ id: crypto.randomUUID(), createdAt: Date.now(), private: request.private, selections: validated });
  await saveBatch(batch);
  if (quickMode) {
    await saveQuickBatch(request.sourceTabId!, batch.id);
  } else {
    const tabOptions = request.windowId === undefined
      ? { url: browser.runtime.getURL(`batch.html#${encodeURIComponent(batch.id)}`) }
      : { url: browser.runtime.getURL(`batch.html#${encodeURIComponent(batch.id)}`), windowId: request.windowId };
    await browser.tabs.create(tabOptions);
  }
  enqueueBatch(batch.id);
  return ok({ batchId: batch.id, batch });
}

async function canAccessPrivateBatch(
  batch: BatchRecord,
  sender: browser.runtime.MessageSender,
  sourceTabId?: number,
): Promise<boolean> {
  if (!batch.private || sender.tab?.incognito) return true;
  if (sourceTabId === undefined || await getQuickBatchId(sourceTabId) !== batch.id) return false;
  try {
    return Boolean((await browser.tabs.get(sourceTabId)).incognito);
  } catch {
    return false;
  }
}

async function batchResponse(
  batchId: string,
  sender: browser.runtime.MessageSender,
  sourceTabId?: number,
): Promise<RuntimeResponse> {
  const batch = await getBatch(batchId);
  if (!batch) return fail("Batch not found.");
  if (!await canAccessPrivateBatch(batch, sender, sourceTabId)) return fail("Private batches are available only in private windows.");
  return ok({ batch });
}

async function handleMessage(message: RuntimeRequest, sender: browser.runtime.MessageSender): Promise<RuntimeResponse> {
  switch (message.type) {
    case "GET_SCANNER_CONFIG": return scannerConfig(sender);
    case "PUBLISH_SUMMARY": return publishSummary(message, sender);
    case "GET_POPUP_STATE": return popupState(message.tabId);
    case "GET_SETTINGS": return ok({ settings: publicSettings(await getSettings()) });
    case "SAVE_API_KEY": return saveApiKey(message.apiKey);
    case "CLEAR_API_KEY": return updateSettings((settings) => {
      const { apiKey: _apiKey, ...rest } = settings;
      return { ...rest, keyValidated: false, onboardingComplete: false };
    });
    case "SET_GLOBAL_PAUSED": return updateSettings((settings) => ({ ...settings, globalPaused: message.paused }));
    case "SET_HOST_EXCLUDED": return updateSettings((settings) => ({
      ...settings,
      excludedHosts: message.excluded
        ? [...new Set([...settings.excludedHosts, message.hostname.toLowerCase()])]
        : settings.excludedHosts.filter((hostname) => hostname !== message.hostname.toLowerCase()),
    }));
    case "SET_NSFW": return updateSettings((settings) => ({ ...settings, includeNsfw: message.enabled }));
    case "SET_NOTIFICATIONS": return updateSettings((settings) => ({ ...settings, notificationsEnabled: message.enabled }));
    case "CREATE_BATCH": return createNewBatch(message);
    case "GET_BATCH": return batchResponse(message.batchId, sender);
    case "REFRESH_BATCH": await observeBatch(message.batchId); return batchResponse(message.batchId, sender, message.sourceTabId);
    case "RESUME_BATCH": {
      const batch = await getBatch(message.batchId);
      if (!batch) return fail("Batch not found.");
      batch.observationEndsAt = Date.now() + 86_400_000;
      delete batch.attentionReason;
      delete batch.pausedUntil;
      await saveBatch(batch);
      enqueueBatch(batch.id);
      return ok({ batch });
    }
    case "CANCEL_ITEM": {
      const batch = await getBatch(message.batchId);
      if (!batch) return fail("Batch not found.");
      const item = batch.items.find((candidate) => candidate.id === message.itemId);
      if (!item || item.state !== "queued") return fail("Only queued items can be cancelled.");
      const updated = markCancelled(batch, item.id, Date.now());
      await saveBatch(updated);
      return ok({ batch: updated });
    }
    case "RETRY_UNKNOWN": {
      const batch = await getBatch(message.batchId);
      if (!batch) return fail("Batch not found.");
      const item = batch.items.find((candidate) => candidate.id === message.itemId);
      if (!item || item.state !== "create_unknown") return fail("Only an unknown create outcome can be retried.");
      const updated = markQueued(batch, item.id, Date.now());
      delete updated.attentionReason;
      await saveBatch(updated);
      enqueueBatch(updated.id);
      return ok({ batch: updated });
    }
    case "DISMISS_BATCH":
      await deleteBatch(message.batchId);
      await deleteQuickBatchReferences(message.batchId);
      return ok();
    case "GENERATE_LINK": {
      const batch = await getBatch(message.batchId);
      if (!batch) return fail("Batch not found.");
      if (!await canAccessPrivateBatch(batch, sender, message.sourceTabId)) return fail("Private batch access denied.");
      const item = batch.items.find((candidate) => candidate.id === message.itemId && candidate.state === "ready_to_generate");
      if (!item?.webdownloadId || !item.files.some((file) => file.id === message.fileId)) return fail("File is not ready for link generation.");
      const settings = await getSettings();
      if (!settings.apiKey) return fail("A TorBox API key is required.");
      try {
        const generatedUrl = await new TorBoxClient(settings.apiKey).requestDownloadLink(item.webdownloadId, message.fileId);
        return ok({ generatedUrl });
      } catch (error) {
        return fail(safeDetail(error, settings.apiKey));
      }
    }
    default: return fail("Unknown extension command.");
  }
}

browser.runtime.onMessage.addListener((message: RuntimeRequest, sender) => handleMessage(message, sender));

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CATALOG_ALARM) {
    void Promise.all([
      getSettings().then((settings) => settings.apiKey ? refreshCatalog(settings.apiKey, false) : null),
      cleanupHistory(),
    ]);
  }
  if (alarm.name === BATCH_ALARM) void observeAllBatches().then(scheduleBatchAlarm);
});

browser.tabs.onRemoved.addListener((tabId) => {
  void deleteSummary(tabId);
  void deleteQuickBatch(tabId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  void deleteSummary(tabId);
  void browser.action.setBadgeText({ tabId, text: "" });
});

browser.notifications?.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith("batch:")) return;
  const targetBatchId = notificationId.slice("batch:".length);
  void browser.tabs.create({ url: browser.runtime.getURL(`batch.html#${encodeURIComponent(targetBatchId)}`) });
});

browser.permissions.onRemoved.addListener((removed) => {
  const permissions = removed.permissions as string[] | undefined;
  if (!permissions?.includes("notifications")) return;
  void updateSettings((settings) => ({ ...settings, notificationsEnabled: false }));
});

browser.runtime.onInstalled.addListener((details) => {
  void browser.alarms.create(CATALOG_ALARM, { periodInMinutes: 1_440 });
  if (details.reason === "install") void browser.runtime.openOptionsPage();
});

void (async () => {
  await browser.alarms.create(CATALOG_ALARM, { periodInMinutes: 1_440 });
  await cleanupHistory();
  const settings = await getSettings();
  if (settings.apiKey && settings.keyValidated) {
    const catalog = await getCatalog();
    if (!catalog || Date.now() - catalog.fetchedAt >= CATALOG_TTL) await refreshCatalog(settings.apiKey, false);
    for (const batch of [...await listBatches(false), ...await listBatches(true)]) {
      if (Date.now() < batch.observationEndsAt) enqueueBatch(batch.id);
    }
  }
  await scheduleBatchAlarm();
})();
