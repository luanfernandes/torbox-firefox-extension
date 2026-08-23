import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import type { WebDownloadFile, WebDownloadRecord } from "../torbox/client";
import { normalizeCandidateSourceUrl } from "./catalog";

export type BatchItemState =
  | "queued"
  | "creating"
  | "create_unknown"
  | "processing"
  | "ready_to_generate"
  | "failed"
  | "cancelled"
  | "timed_out";

export interface BatchSelection {
  url: string;
  hosterId: number;
  hosterName: string;
  password?: string;
}

export interface BatchFile {
  id: string;
  name: string;
  size: number;
  mimetype?: string;
}

export interface BatchItem {
  id: string;
  hosterId: number;
  hosterName: string;
  state: BatchItemState;
  rawSource?: string;
  sourceDisplay?: string;
  sourceHash: string;
  password?: string;
  webdownloadId?: string;
  torboxName?: string;
  files: BatchFile[];
  error?: string;
  createStartedAt?: number;
  updatedAt: number;
}

export interface BatchRecord {
  id: string;
  private: boolean;
  createdAt: number;
  updatedAt: number;
  observationEndsAt: number;
  items: BatchItem[];
  notificationState: "none" | "ready" | "attention";
  attentionReason?: string;
  pausedUntil?: number;
}

export interface CreateBatchInput {
  id: string;
  createdAt: number;
  private: boolean;
  selections: readonly BatchSelection[];
}

function redactedSource(source: string): string {
  const url = normalizeCandidateSourceUrl(source);
  if (!url) return "Invalid source";
  return `${url.hostname}${url.pathname}`;
}

function replaceItem(batch: BatchRecord, itemId: string, update: (item: BatchItem) => BatchItem, now: number): BatchRecord {
  return {
    ...batch,
    updatedAt: now,
    items: batch.items.map((item) => item.id === itemId ? update(item) : item),
  };
}

export function createBatch(input: CreateBatchInput): BatchRecord {
  if (input.selections.length < 1 || input.selections.length > 60) {
    throw new Error("A batch must contain between 1 and 60 sources");
  }

  const seen = new Set<string>();
  const items = input.selections.map((selection, index): BatchItem => {
    const normalized = normalizeCandidateSourceUrl(selection.url);
    if (!normalized) throw new Error("A batch source must be HTTP or HTTPS");
    const rawSource = normalized.href;
    if (seen.has(rawSource)) throw new Error("A batch cannot contain duplicate sources");
    seen.add(rawSource);
    const item: BatchItem = {
      id: `${input.id}:${index + 1}`,
      hosterId: selection.hosterId,
      hosterName: selection.hosterName,
      state: "queued",
      rawSource,
      sourceHash: sourceMd5(rawSource),
      files: [],
      updatedAt: input.createdAt,
    };
    if (selection.password) item.password = selection.password;
    return item;
  });

  return {
    id: input.id,
    private: input.private,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    observationEndsAt: input.createdAt + 86_400_000,
    items,
    notificationState: "none",
  };
}

export function markCreating(batch: BatchRecord, itemId: string, now: number): BatchRecord {
  return replaceItem(batch, itemId, (item) => ({
    ...item,
    state: "creating",
    createStartedAt: now,
    updatedAt: now,
  }), now);
}

export function markQueued(batch: BatchRecord, itemId: string, now: number): BatchRecord {
  return replaceItem(batch, itemId, (item) => ({
    ...item,
    state: "queued",
    updatedAt: now,
  }), now);
}

export function markCreateSucceeded(
  batch: BatchRecord,
  itemId: string,
  webdownloadId: string,
  now: number,
): BatchRecord {
  return replaceItem(batch, itemId, (item) => {
    const { password: _password, rawSource, ...rest } = item;
    return {
      ...rest,
      state: "processing",
      sourceDisplay: rawSource ? redactedSource(rawSource) : item.sourceDisplay ?? "Unknown source",
      webdownloadId,
      updatedAt: now,
    };
  }, now);
}

export function markCreateFailed(batch: BatchRecord, itemId: string, error: string, now: number): BatchRecord {
  return replaceItem(batch, itemId, (item) => {
    const { password: _password, rawSource, ...rest } = item;
    return {
      ...rest,
      state: "failed",
      sourceDisplay: rawSource ? redactedSource(rawSource) : item.sourceDisplay ?? "Unknown source",
      error,
      updatedAt: now,
    };
  }, now);
}

export function markCreateUnknown(batch: BatchRecord, itemId: string, error: string, now: number): BatchRecord {
  return replaceItem(batch, itemId, (item) => ({
    ...item,
    state: "create_unknown",
    error,
    updatedAt: now,
  }), now);
}

export function markCancelled(batch: BatchRecord, itemId: string, now: number): BatchRecord {
  return replaceItem(batch, itemId, (item) => {
    const { password: _password, rawSource, ...rest } = item;
    return {
      ...rest,
      state: "cancelled",
      sourceDisplay: rawSource ? redactedSource(rawSource) : item.sourceDisplay ?? "Unknown source",
      updatedAt: now,
    };
  }, now);
}

export function timeoutBatch(batch: BatchRecord, now: number): BatchRecord {
  const timedStates = new Set<BatchItemState>(["queued", "creating", "create_unknown", "processing"]);
  return {
    ...batch,
    updatedAt: now,
    items: batch.items.map((item) => {
      const { password: _password, rawSource, ...rest } = item;
      return {
        ...rest,
        state: timedStates.has(item.state) ? "timed_out" : item.state,
        sourceDisplay: rawSource ? redactedSource(rawSource) : item.sourceDisplay,
        updatedAt: timedStates.has(item.state) ? now : item.updatedAt,
      } as BatchItem;
    }),
  };
}

function toBatchFile(file: WebDownloadFile): BatchFile {
  const result: BatchFile = { id: file.id, name: file.shortName?.trim() || file.name, size: file.size };
  if (file.mimetype) result.mimetype = file.mimetype;
  return result;
}

export function applyWebDownload(batch: BatchRecord, record: WebDownloadRecord, now: number): BatchRecord {
  const item = batch.items.find((candidate) => candidate.webdownloadId === record.id);
  if (!item) return batch;
  if (record.error) return markCreateFailed(batch, item.id, record.error, now);
  return replaceItem(batch, item.id, (current) => ({
    ...current,
    torboxName: record.name,
    files: record.files.map(toBatchFile),
    state: record.files.length > 0 && record.downloadPresent !== false
      ? "ready_to_generate"
      : "processing",
    updatedAt: now,
  }), now);
}

export function sourceMd5(source: string): string {
  return bytesToHex(md5(new TextEncoder().encode(source)));
}

export function findUniqueReconciliation(
  source: string,
  createStartedAt: number,
  records: readonly WebDownloadRecord[],
  windowMilliseconds = 300_000,
): WebDownloadRecord | null {
  const hash = sourceMd5(source);
  const matches = records.filter((record) => {
    if (record.hash?.toLowerCase() !== hash) return false;
    const createdAt = record.createdAt ? Date.parse(record.createdAt) : Number.NaN;
    return Number.isFinite(createdAt) && Math.abs(createdAt - createStartedAt) <= windowMilliseconds;
  });
  return matches.length === 1 ? matches[0] ?? null : null;
}

export function batchNeedsAttention(batch: BatchRecord): boolean {
  return batch.items.some((item) => ["failed", "create_unknown", "timed_out"].includes(item.state));
}

export function batchIsReady(batch: BatchRecord): boolean {
  return batch.items.some((item) => item.state === "ready_to_generate")
    && batch.items.every((item) => ["ready_to_generate", "failed", "cancelled", "timed_out"].includes(item.state));
}
