import { afterEach, describe, expect, test, vi } from "vitest";

function eventTarget() {
  return { addListener: vi.fn() };
}

describe("background coordinator startup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test("starts when the optional notifications permission is not granted", async () => {
    const runtimeMessages = eventTarget();
    const storageArea = {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => undefined),
    };
    vi.stubGlobal("browser", {
      action: {
        setBadgeBackgroundColor: vi.fn(async () => undefined),
        setBadgeText: vi.fn(async () => undefined),
      },
      alarms: {
        clear: vi.fn(async () => true),
        create: vi.fn(async () => undefined),
        onAlarm: eventTarget(),
      },
      permissions: {
        contains: vi.fn(async () => false),
        onRemoved: eventTarget(),
      },
      runtime: {
        getURL: vi.fn((path: string) => `moz-extension://test/${path}`),
        onInstalled: eventTarget(),
        onMessage: runtimeMessages,
        openOptionsPage: vi.fn(async () => undefined),
      },
      storage: {
        local: storageArea,
        session: storageArea,
      },
      tabs: {
        create: vi.fn(async () => ({})),
        onRemoved: eventTarget(),
        onUpdated: eventTarget(),
      },
    });

    await expect(import("../src/background/index")).resolves.toBeDefined();
    expect(runtimeMessages.addListener).toHaveBeenCalledOnce();
  });
});
