import { buildMatcher, type CandidateLink, type CatalogMatcher } from "../domain/catalog";
import type { RuntimeRequest, ScannerConfig } from "../shared/types";
import { DEFAULT_CANDIDATE_CAP, scanDocument } from "./scan-document";

const scannerId = crypto.randomUUID();
let matcher: CatalogMatcher = { domains: [] };
let config: ScannerConfig = {
  enabled: false,
  entries: [],
  catalogVersion: 0,
  verified: false,
  candidateCap: DEFAULT_CANDIDATE_CAP,
};
let candidates: CandidateLink[] = [];
let truncated = false;
let debounceTimer: number | undefined;
let lastScanAt = 0;

async function send(request: RuntimeRequest): Promise<unknown> {
  try {
    return await browser.runtime.sendMessage(request);
  } catch {
    return null;
  }
}

async function publish(): Promise<void> {
  const hosterCounts: Record<string, number> = {};
  for (const candidate of candidates) {
    const key = String(candidate.hosterId);
    hosterCounts[key] = (hosterCounts[key] ?? 0) + 1;
  }
  await send({
    type: "PUBLISH_SUMMARY",
    scannerId,
    hostname: location.hostname,
    candidateCount: candidates.length,
    hosterCounts,
    catalogVersion: config.catalogVersion,
    truncated,
    verified: config.verified,
  });
}

async function scan(): Promise<void> {
  lastScanAt = Date.now();
  if (!config.enabled) {
    candidates = [];
    truncated = false;
    await publish();
    return;
  }
  const result = scanDocument(document, matcher, config.candidateCap);
  candidates = result.candidates;
  truncated = result.truncated;
  await publish();
}

function scheduleScan(): void {
  if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
  const remaining = Math.max(0, 1_000 - (Date.now() - lastScanAt));
  debounceTimer = window.setTimeout(() => void scan(), Math.max(300, remaining));
}

async function loadConfig(): Promise<void> {
  const response = await send({ type: "GET_SCANNER_CONFIG" }) as { ok?: boolean; scannerConfig?: ScannerConfig } | null;
  if (!response?.ok || !response.scannerConfig) {
    config = { enabled: false, entries: [], catalogVersion: 0, verified: false, candidateCap: DEFAULT_CANDIDATE_CAP };
  } else {
    config = response.scannerConfig;
  }
  matcher = buildMatcher(config.entries, { includeNsfw: true });
  await scan();
}

browser.runtime.onMessage.addListener((message: RuntimeRequest) => {
  if (message.type === "GET_CANDIDATES") {
    return Promise.resolve({ scannerId, candidates, truncated });
  }
  if (message.type === "CATALOG_CHANGED") {
    void loadConfig();
  }
  return undefined;
});

const observer = new MutationObserver((mutations) => {
  const linkChanged = mutations.some((mutation) => {
    if (mutation.type === "attributes") return true;
    return [...mutation.addedNodes, ...mutation.removedNodes].some((node) =>
      node instanceof Element && (node.matches("a[href], area[href]") || Boolean(node.querySelector("a[href], area[href]"))),
    );
  });
  if (linkChanged) scheduleScan();
});

observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["href"],
});

void loadConfig();
