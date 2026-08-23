import { describe, expect, test } from "vitest";

import { buildMatcher, findCandidate } from "../src/domain/catalog";

describe("Hoster catalog matching", () => {
  test("matches a supported subdomain and strips the fragment", () => {
    const matcher = buildMatcher([
      {
        id: 2,
        name: "1Fichier",
        type: "hoster",
        domains: ["1fichier.com"],
        status: true,
        nsfw: false,
      },
    ], { includeNsfw: false });

    expect(findCandidate("https://sub.1fichier.com/file?id=7#preview", matcher)).toEqual({
      url: "https://sub.1fichier.com/file?id=7",
      hosterId: 2,
      hosterName: "1Fichier",
      hostname: "sub.1fichier.com",
    });
  });

  test("preserves the fragment that identifies and decrypts a Mega file", () => {
    const matcher = buildMatcher([
      {
        id: 9,
        name: "Mega",
        type: "hoster",
        domains: ["mega.nz", "mega.io", "mega.co.nz"],
        status: true,
        nsfw: false,
      },
    ], { includeNsfw: false });

    expect(findCandidate(
      "https://mega.co.nz/#!CmZ2GDIS!a7XB7-YT831zM8e5SrCbwBfh_8wF2INWjqrEFRk_rFU",
      matcher,
    )?.url).toBe("https://mega.co.nz/#!CmZ2GDIS!a7XB7-YT831zM8e5SrCbwBfh_8wF2INWjqrEFRk_rFU");
  });

  test("excludes lookalike, unavailable, Stream, and opted-out NSFW entries", () => {
    const matcher = buildMatcher([
      { id: 1, name: "Offline", type: "hoster", domains: ["offline.test"], status: false, nsfw: false },
      { id: 2, name: "Stream", type: "stream", domains: ["stream.test"], status: true, nsfw: false },
      { id: 3, name: "Adult", type: "hoster", domains: ["adult.test"], status: true, nsfw: true },
      { id: 4, name: "Files", type: "hoster", domains: ["files.test"], status: true, nsfw: false },
    ], { includeNsfw: false });

    expect(findCandidate("https://notfiles.test/a", matcher)).toBeNull();
    expect(findCandidate("https://offline.test/a", matcher)).toBeNull();
    expect(findCandidate("https://stream.test/a", matcher)).toBeNull();
    expect(findCandidate("https://adult.test/a", matcher)).toBeNull();
    expect(findCandidate("https://files.test/a", matcher)?.hosterId).toBe(4);
  });

  test("rejects a future regex that no longer describes the same domains", () => {
    const matcher = buildMatcher([
      {
        id: 1,
        name: "Changed contract",
        type: "hoster",
        domains: ["files.test"],
        regex: "^https?://(?:[^./]+\\.)*(other\\.test)(/|$)",
        status: true,
        nsfw: false,
      },
    ], { includeNsfw: false });

    expect(findCandidate("https://files.test/a", matcher)).toBeNull();
  });

  test("normalizes internationalized catalog domains", () => {
    const matcher = buildMatcher([
      {
        id: 8,
        name: "Unicode files",
        type: "hoster",
        domains: ["münchen.test"],
        regex: "^https?://(?:[^./]+\\.)*(münchen\\.test)(/|$)",
        status: true,
        nsfw: false,
      },
    ], { includeNsfw: false });

    expect(findCandidate("https://münchen.test/file", matcher)?.hostname).toBe("xn--mnchen-3ya.test");
  });
});
