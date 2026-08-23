import { describe, expect, test } from "vitest";

import {
  applyWebDownload,
  createBatch,
  findUniqueReconciliation,
  markCreateSucceeded,
  sourceMd5,
  timeoutBatch,
} from "../src/domain/batch";

describe("Web Download batch state", () => {
  test("removes raw source credentials and password after a known create result", () => {
    const batch = createBatch({
      id: "batch-1",
      createdAt: 1_000,
      private: false,
      selections: [{
        url: "http://alice:secret@files.test/path/item?q=token",
        hosterId: 7,
        hosterName: "Files",
        password: "hoster password",
      }],
    });

    const updated = markCreateSucceeded(batch, "batch-1:1", "web-9", 2_000);

    expect(updated.items[0]).toEqual(expect.objectContaining({
      state: "processing",
      sourceDisplay: "files.test/path/item",
      webdownloadId: "web-9",
    }));
    expect(updated.items[0]).not.toHaveProperty("rawSource");
    expect(updated.items[0]).not.toHaveProperty("password");
  });

  test("deletes unresolved passwords when the 24-hour window ends", () => {
    const batch = createBatch({
      id: "batch-2",
      createdAt: 0,
      private: false,
      selections: [{ url: "https://files.test/a", hosterId: 7, hosterName: "Files", password: "secret" }],
    });

    const updated = timeoutBatch(batch, 86_400_000);

    expect(updated.items[0]?.state).toBe("timed_out");
    expect(updated.items[0]).not.toHaveProperty("password");
  });

  test("submits a Mega source with its file handle and decryption key intact", () => {
    const source = "https://mega.co.nz/#!fileHandle!decryptionKey";
    const batch = createBatch({
      id: "batch-mega",
      createdAt: 1_000,
      private: false,
      selections: [{ url: source, hosterId: 9, hosterName: "Mega" }],
    });

    expect(batch.items[0]?.rawSource).toBe(source);
    expect(batch.items[0]?.sourceHash).toBe(sourceMd5(source));
  });

  test("uses TorBox's short file name instead of repeating its full path", () => {
    const created = createBatch({
      id: "batch-file-name",
      createdAt: 1_000,
      private: false,
      selections: [{ url: "https://files.test/item", hosterId: 7, hosterName: "Files" }],
    });
    const processing = markCreateSucceeded(created, "batch-file-name:1", "web-1", 2_000);

    const ready = applyWebDownload(processing, {
      id: "web-1",
      name: "Download",
      files: [{
        id: "file-1",
        name: "Path.of.Idle.Old.Gods.Rising.Build.zip/Path.of.Idle.Old.Gods.Rising.Build.zip",
        shortName: "Path.of.Idle.Old.Gods.Rising.Build.zip",
        size: 10,
      }],
    }, 3_000);

    expect(ready.items[0]?.files[0]?.name).toBe("Path.of.Idle.Old.Gods.Rising.Build.zip");
  });

  test("reconciles only one hash match inside the creation window", () => {
    const records = [
      { id: "old", name: "old", hash: "299b0d22237399973f1adc5178aac0a7", createdAt: "2026-08-22T10:00:00Z", files: [] },
      { id: "new", name: "new", hash: "299b0d22237399973f1adc5178aac0a7", createdAt: "2026-08-22T12:00:02Z", files: [] },
    ];

    expect(findUniqueReconciliation(
      "https://files.test/a",
      Date.parse("2026-08-22T12:00:00Z"),
      records,
      30_000,
    )?.id).toBe("new");
    expect(findUniqueReconciliation(
      "https://files.test/a",
      Date.parse("2026-08-22T11:00:00Z"),
      records,
      7_200_000,
    )).toBeNull();
  });
});
