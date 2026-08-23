// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { BatchRecord } from "../src/domain/batch";
import type { PopupState, RuntimeRequest, RuntimeResponse } from "../src/shared/types";

const popupState: PopupState = {
  tabId: 12,
  windowId: 4,
  private: false,
  hostname: "page.test",
  settings: {
    keyConfigured: true,
    keyValidated: true,
    onboardingComplete: true,
    globalPaused: false,
    excludedHosts: [],
    includeNsfw: false,
    notificationsEnabled: false,
  },
  candidates: [{
    url: "https://files.test/item",
    hosterId: 7,
    hosterName: "Files",
    hostname: "files.test",
  }],
  verified: true,
  truncated: false,
};

const readyBatch: BatchRecord = {
  id: "quick-batch",
  private: false,
  createdAt: 1,
  updatedAt: 2,
  observationEndsAt: 86_400_001,
  notificationState: "none",
  items: [{
    id: "quick-batch:1",
    hosterId: 7,
    hosterName: "Files",
    state: "ready_to_generate",
    sourceDisplay: "files.test/item",
    sourceHash: "hash",
    webdownloadId: "web-1",
    files: [{ id: "file-1", name: "item.bin", size: 10 }],
    updatedAt: 2,
  }],
};

describe("popup actions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.body.replaceChildren();
  });

  test("keeps the four primary actions in an icon toolbar", async () => {
    document.body.innerHTML = '<main id="app" class="panel"></main>';
    const sendMessage = vi.fn(async (request: RuntimeRequest): Promise<RuntimeResponse> => {
      if (request.type === "GET_POPUP_STATE") return { ok: true, popupState };
      return { ok: true };
    });
    vi.stubGlobal("browser", {
      runtime: { sendMessage, openOptionsPage: vi.fn(async () => undefined), getURL: vi.fn((path: string) => path) },
      tabs: { query: vi.fn(async () => [{ id: 12 }]), create: vi.fn(async () => ({})) },
    });

    await import("../src/popup/index");
    await vi.waitFor(() => expect(document.querySelector(".popup-action-bar")).not.toBeNull());

    for (const label of ["Select all links", "Unselect all links", "Create batch", "Settings"]) {
      const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      expect(button?.title).toBe(label);
      expect(button?.querySelector("svg")).not.toBeNull();
    }
  });

  test("keeps a one-link batch in the popup and renders its generated link", async () => {
    document.body.innerHTML = '<main id="app" class="panel"></main>';
    const createTab = vi.fn(async () => ({}));
    const sendMessage = vi.fn(async (request: RuntimeRequest): Promise<RuntimeResponse> => {
      if (request.type === "GET_POPUP_STATE") return { ok: true, popupState };
      if (request.type === "CREATE_BATCH") return { ok: true, batchId: readyBatch.id, batch: readyBatch };
      if (request.type === "GENERATE_LINK") return { ok: true, generatedUrl: "https://cdn.test/item.bin" };
      return { ok: true };
    });
    vi.stubGlobal("browser", {
      runtime: { sendMessage, openOptionsPage: vi.fn(async () => undefined), getURL: vi.fn((path: string) => path) },
      tabs: { query: vi.fn(async () => [{ id: 12 }]), create: createTab },
    });

    await import("../src/popup/index");
    await vi.waitFor(() => expect(document.querySelector<HTMLInputElement>('.candidate input[type="checkbox"]')).not.toBeNull());
    document.querySelector<HTMLInputElement>('.candidate input[type="checkbox"]')!.click();
    document.querySelector<HTMLButtonElement>('button[aria-label="Create batch"]')!.click();

    await vi.waitFor(() => expect(document.querySelector<HTMLAnchorElement>(".quick-download-link")?.href).toBe("https://cdn.test/item.bin"));
    const ready = document.querySelector<HTMLElement>(".quick-download-ready");
    const filename = ready?.querySelector<HTMLElement>(".quick-filename");
    const link = ready?.querySelector<HTMLAnchorElement>(".quick-download-link");
    expect(filename?.textContent).toBe("item.bin");
    expect(filename?.nextElementSibling).toBe(link);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "CREATE_BATCH",
      openBatchTab: false,
      sourceTabId: 12,
    }));
    expect(createTab).not.toHaveBeenCalled();
  });

  test("renders the quick filename at 12px", async () => {
    const css = await readFile(resolve("src/static/styles.css"), "utf8");

    expect(css).toMatch(/\.quick-filename\s*\{[^}]*font-size:\s*12px;/s);
  });
});
