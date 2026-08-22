import { describe, expect, test, vi } from "vitest";

import { TorBoxClient, TorBoxError } from "../src/torbox/client";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...init.headers },
    ...init,
  });
}

describe("TorBox Web Download client", () => {
  test("calls fetch without binding it to the TorBox client", async () => {
    const receivers: unknown[] = [];
    const strictFetch = function (this: unknown): Promise<Response> {
      receivers.push(this);

      if (this !== undefined) {
        throw new TypeError(
          "'fetch' called on an object that does not implement interface Window.",
        );
      }

      return Promise.resolve(jsonResponse({
        success: true,
        error: null,
        detail: "Hosters retrieved.",
        data: [],
      }));
    };

    const client = new TorBoxClient("secret", strictFetch);

    await expect(client.getHosters()).resolves.toEqual([]);
    expect(receivers).toEqual([undefined]);
  });

  test("creates one Web Download with an encoded source and password", async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      success: true,
      error: null,
      detail: "created",
      data: { webdownload_id: 42 },
    }));
    const client = new TorBoxClient("secret", fetcher);

    await expect(client.createWebDownload("https://files.test/a?x=1", "open sesame")).resolves.toEqual({
      webdownloadId: "42",
    });

    const [url, init] = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit | undefined];
    expect(url).toBe("https://api.torbox.app/v1/api/webdl/createwebdownload");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer secret");
    expect(init?.body).toBe("link=https%3A%2F%2Ffiles.test%2Fa%3Fx%3D1&password=open+sesame");
  });

  test("requests one WebDL file URL without using the torrent endpoint", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ success: true, error: null, detail: "ok", data: "https://cdn.test/file" }));
    const client = new TorBoxClient("a key", fetcher);

    await expect(client.requestDownloadLink("web-7", "file-9")).resolves.toBe("https://cdn.test/file");

    const [requestedInput] = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit | undefined];
    const requested = new URL(String(requestedInput));
    expect(requested.pathname).toBe("/v1/api/webdl/requestdl");
    expect(requested.searchParams.get("web_id")).toBe("web-7");
    expect(requested.searchParams.get("file_id")).toBe("file-9");
    expect(requested.searchParams.get("torrent_id")).toBeNull();
    expect(requested.searchParams.get("redirect")).toBe("false");
  });

  test("does not treat Retry-After as throttling while quota remains", async () => {
    const fetcher = vi.fn(async () => jsonResponse(
      { success: false, error: "BAD_TOKEN", detail: "Invalid token", data: null },
      { status: 401, headers: { "Retry-After": "300", "X-RateLimit-Remaining": "58" } },
    ));
    const client = new TorBoxClient("bad", fetcher);

    const error = await client.getHosters().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TorBoxError);
    expect((error as TorBoxError).rateLimited).toBe(false);
    expect((error as TorBoxError).detail).toBe("Invalid token");
  });

  test("does not invent a zero quota when rate headers are absent", async () => {
    const fetcher = vi.fn(async () => jsonResponse(
      { success: false, error: "SERVER_ERROR", detail: "Try later", data: null },
      { status: 503 },
    ));
    const client = new TorBoxClient("key", fetcher);

    const error = await client.getHosters().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TorBoxError);
    expect((error as TorBoxError).rateLimited).toBe(false);
    expect((error as TorBoxError).retryAfterSeconds).toBeNull();
  });
});
