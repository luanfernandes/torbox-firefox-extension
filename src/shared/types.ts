import type { BatchRecord, BatchSelection } from "../domain/batch";
import type { CandidateLink, HosterCatalogEntry } from "../domain/catalog";

export interface AppSettings {
  apiKey?: string;
  keyValidated: boolean;
  onboardingComplete: boolean;
  globalPaused: boolean;
  excludedHosts: string[];
  includeNsfw: boolean;
  notificationsEnabled: boolean;
}

export interface PublicSettings {
  keyConfigured: boolean;
  keyValidated: boolean;
  onboardingComplete: boolean;
  globalPaused: boolean;
  excludedHosts: string[];
  includeNsfw: boolean;
  notificationsEnabled: boolean;
}

export interface CatalogRecord {
  entries: HosterCatalogEntry[];
  fetchedAt: number;
  version: number;
  verified: boolean;
}

export interface CandidateSummary {
  tabId: number;
  scannerId: string;
  hostname: string;
  candidateCount: number;
  hosterCounts: Record<string, number>;
  catalogVersion: number;
  truncated: boolean;
  verified: boolean;
  private: boolean;
  scannedAt: number;
}

export interface ScannerConfig {
  enabled: boolean;
  reason?: "setup" | "paused" | "excluded" | "catalog";
  entries: HosterCatalogEntry[];
  catalogVersion: number;
  verified: boolean;
  candidateCap: number;
}

export interface PopupState {
  tabId: number;
  windowId?: number;
  private: boolean;
  hostname: string;
  settings: PublicSettings;
  candidates: CandidateLink[];
  verified: boolean;
  truncated: boolean;
  catalogFetchedAt?: number;
  quickBatch?: BatchRecord;
}

export type RuntimeRequest =
  | { type: "GET_SCANNER_CONFIG" }
  | { type: "PUBLISH_SUMMARY"; scannerId: string; hostname: string; candidateCount: number; hosterCounts: Record<string, number>; catalogVersion: number; truncated: boolean; verified: boolean }
  | { type: "SCANNER_CANDIDATES"; scannerId: string; candidates: CandidateLink[]; truncated: boolean }
  | { type: "GET_CANDIDATES" }
  | { type: "CATALOG_CHANGED" }
  | { type: "GET_POPUP_STATE"; tabId: number }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_API_KEY"; apiKey: string }
  | { type: "CLEAR_API_KEY" }
  | { type: "SET_GLOBAL_PAUSED"; paused: boolean }
  | { type: "SET_HOST_EXCLUDED"; hostname: string; excluded: boolean }
  | { type: "SET_NSFW"; enabled: boolean }
  | { type: "SET_NOTIFICATIONS"; enabled: boolean }
  | { type: "CREATE_BATCH"; selections: BatchSelection[]; private: boolean; windowId?: number; allowDuplicates: boolean; openBatchTab?: boolean; sourceTabId?: number }
  | { type: "GET_BATCH"; batchId: string }
  | { type: "REFRESH_BATCH"; batchId: string; sourceTabId?: number }
  | { type: "RESUME_BATCH"; batchId: string }
  | { type: "CANCEL_ITEM"; batchId: string; itemId: string }
  | { type: "RETRY_UNKNOWN"; batchId: string; itemId: string }
  | { type: "DISMISS_BATCH"; batchId: string }
  | { type: "GENERATE_LINK"; batchId: string; itemId: string; fileId: string; sourceTabId?: number };

export type RuntimeResponse =
  | { ok: true; settings?: PublicSettings; scannerConfig?: ScannerConfig; popupState?: PopupState; batch?: BatchRecord; batchId?: string; generatedUrl?: string }
  | { ok: false; error: string; duplicateSources?: string[] };
