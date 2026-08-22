import type { HosterCatalogEntry } from "../domain/catalog";

const API_ROOT = "https://api.torbox.app/v1/api/webdl";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface Envelope<T> {
  success: boolean;
  error: string | null;
  detail: string;
  data: T;
}

export interface WebDownloadFile {
  id: string;
  name: string;
  shortName?: string;
  mimetype?: string;
  size: number;
}

export interface WebDownloadRecord {
  id: string;
  hash?: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  downloadFinished?: boolean;
  downloadPresent?: boolean;
  downloadState?: string;
  error?: string | null;
  files: WebDownloadFile[];
}

export class TorBoxError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly detail: string;
  readonly rateLimited: boolean;
  readonly retryAfterSeconds: number | null;

  constructor(response: Response, detail: string, code: string | null) {
    super(detail || `TorBox request failed with HTTP ${response.status}`);
    this.name = "TorBoxError";
    this.status = response.status;
    this.code = code;
    this.detail = detail;
    const remainingHeader = response.headers.get("X-RateLimit-Remaining");
    const remaining = remainingHeader === null ? null : Number(remainingHeader);
    this.rateLimited = response.status === 429 || remaining !== null && Number.isFinite(remaining) && remaining === 0;
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfter = retryAfterHeader === null ? null : Number(retryAfterHeader);
    this.retryAfterSeconds = this.rateLimited && retryAfter !== null && Number.isFinite(retryAfter) ? retryAfter : null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, field: string): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  throw new Error(`TorBox response has an invalid ${field}`);
}

function parseEnvelope(value: unknown): Envelope<unknown> {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    throw new Error("TorBox returned an invalid response envelope");
  }
  return {
    success: value.success,
    error: typeof value.error === "string" ? value.error : null,
    detail: typeof value.detail === "string" ? value.detail : "",
    data: value.data,
  };
}

function parseHoster(value: unknown): HosterCatalogEntry {
  if (!isRecord(value) || typeof value.id !== "number" || typeof value.name !== "string") {
    throw new Error("TorBox returned an invalid Hoster entry");
  }
  if (!Array.isArray(value.domains) || !value.domains.every((domain) => typeof domain === "string")) {
    throw new Error("TorBox returned invalid Hoster domains");
  }
  if (typeof value.status !== "boolean" || typeof value.type !== "string" || typeof value.nsfw !== "boolean") {
    throw new Error("TorBox returned an incomplete Hoster entry");
  }

  const entry: HosterCatalogEntry = {
    id: value.id,
    name: value.name,
    domains: value.domains,
    status: value.status,
    type: value.type,
    nsfw: value.nsfw,
  };
  if (typeof value.note === "string" || value.note === null) entry.note = value.note;
  if (typeof value.regex === "string") entry.regex = value.regex;
  for (const field of [
    "daily_link_limit",
    "daily_link_used",
    "daily_bandwidth_limit",
    "daily_bandwidth_used",
    "per_link_size_limit",
  ] as const) {
    if (typeof value[field] === "number") entry[field] = value[field];
  }
  return entry;
}

function parseFile(value: unknown): WebDownloadFile {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.size !== "number") {
    throw new Error("TorBox returned an invalid Web Download file");
  }
  const file: WebDownloadFile = {
    id: asString(value.id, "file ID"),
    name: value.name,
    size: value.size,
  };
  if (typeof value.short_name === "string") file.shortName = value.short_name;
  if (typeof value.shortName === "string") file.shortName = value.shortName;
  if (typeof value.mimetype === "string") file.mimetype = value.mimetype;
  return file;
}

function parseWebDownload(value: unknown): WebDownloadRecord {
  if (!isRecord(value) || typeof value.name !== "string") {
    throw new Error("TorBox returned an invalid Web Download item");
  }
  const item: WebDownloadRecord = {
    id: asString(value.id, "Web Download ID"),
    name: value.name,
    files: Array.isArray(value.files) ? value.files.map(parseFile) : [],
  };
  if (typeof value.hash === "string") item.hash = value.hash;
  if (typeof value.created_at === "string") item.createdAt = value.created_at;
  if (typeof value.createdAt === "string") item.createdAt = value.createdAt;
  if (typeof value.updated_at === "string") item.updatedAt = value.updated_at;
  if (typeof value.updatedAt === "string") item.updatedAt = value.updatedAt;
  if (typeof value.download_finished === "boolean") item.downloadFinished = value.download_finished;
  if (typeof value.downloadFinished === "boolean") item.downloadFinished = value.downloadFinished;
  if (typeof value.download_present === "boolean") item.downloadPresent = value.download_present;
  if (typeof value.downloadPresent === "boolean") item.downloadPresent = value.downloadPresent;
  if (typeof value.download_state === "string") item.downloadState = value.download_state;
  if (typeof value.downloadState === "string") item.downloadState = value.downloadState;
  if (typeof value.error === "string" || value.error === null) item.error = value.error;
  return item;
}

export class TorBoxClient {
  private readonly fetcher: Fetcher;

  constructor(
    private readonly token: string,
    fetcher: Fetcher = (input, init) => globalThis.fetch(input, init),
  ) {
    this.fetcher = (input, init) => fetcher(input, init);
  }

  private async request(path: string, init: RequestInit = {}): Promise<{ response: Response; envelope: Envelope<unknown> }> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    const response = await this.fetcher(`${API_ROOT}${path}`, { ...init, headers });
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new TorBoxError(response, "TorBox returned malformed JSON", null);
    }
    const envelope = parseEnvelope(value);
    if (!response.ok || !envelope.success) {
      throw new TorBoxError(response, envelope.detail, envelope.error);
    }
    return { response, envelope };
  }

  async getHosters(): Promise<HosterCatalogEntry[]> {
    const { envelope } = await this.request("/hosters");
    if (!Array.isArray(envelope.data)) {
      throw new Error("TorBox returned invalid Hoster data");
    }
    return envelope.data.map(parseHoster);
  }

  async createWebDownload(link: string, password?: string): Promise<{ webdownloadId: string }> {
    const body = new URLSearchParams({ link });
    if (password) body.set("password", password);
    const { envelope } = await this.request("/createwebdownload", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: body.toString(),
    });
    if (!isRecord(envelope.data)) {
      throw new Error("TorBox create response has no data object");
    }
    return { webdownloadId: asString(envelope.data.webdownload_id, "Web Download ID") };
  }

  async listWebDownloads(options: { id?: string; offset?: number; limit?: number } = {}): Promise<WebDownloadRecord[]> {
    const query = new URLSearchParams();
    if (options.id) query.set("id", options.id);
    if (options.offset !== undefined) query.set("offset", String(options.offset));
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    const suffix = query.size > 0 ? `?${query}` : "";
    const { envelope } = await this.request(`/mylist${suffix}`);
    const values = Array.isArray(envelope.data) ? envelope.data : [envelope.data];
    return values.filter((value) => value !== null && value !== undefined).map(parseWebDownload);
  }

  async requestDownloadLink(webId: string, fileId: string): Promise<string> {
    const url = new URL(`${API_ROOT}/requestdl`);
    url.searchParams.set("token", this.token);
    url.searchParams.set("web_id", webId);
    url.searchParams.set("file_id", fileId);
    url.searchParams.set("redirect", "false");
    url.searchParams.set("append_name", "true");

    const response = await this.fetcher(url);
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new TorBoxError(response, "TorBox returned malformed JSON", null);
    }
    const envelope = parseEnvelope(value);
    if (!response.ok || !envelope.success) {
      throw new TorBoxError(response, envelope.detail, envelope.error);
    }
    const result = typeof envelope.data === "string"
      ? envelope.data
      : isRecord(envelope.data) && typeof envelope.data.url === "string"
        ? envelope.data.url
        : null;
    if (!result) {
      throw new Error("TorBox returned no generated link");
    }
    const generated = new URL(result);
    if (generated.protocol !== "https:") {
      throw new Error("TorBox returned a non-HTTPS generated link");
    }
    return generated.href;
  }
}
