// @vitest-environment jsdom

import { describe, expect, test } from "vitest";

import { buildMatcher } from "../src/domain/catalog";
import { scanDocument } from "../src/scanner/scan-document";

describe("automatic page discovery", () => {
  test("returns distinct real destinations and reports truncation", () => {
    document.head.innerHTML = '<base href="https://page.test/folder/">';
    document.body.innerHTML = `
      <a href="https://files.test/a#one">first</a>
      <a href="https://files.test/a#two">duplicate after fragment removal</a>
      <area href="https://files.test/b">
      <a href="/not-supported">ignored</a>
      <button data-url="https://files.test/button">ignored button</button>
    `;
    const matcher = buildMatcher([
      { id: 1, name: "Files", type: "hoster", domains: ["files.test"], status: true, nsfw: false },
    ], { includeNsfw: false });

    const result = scanDocument(document, matcher, 1);

    expect(result.candidates).toEqual([{
      url: "https://files.test/a",
      hosterId: 1,
      hosterName: "Files",
      hostname: "files.test",
    }]);
    expect(result.truncated).toBe(true);
  });

  test("keeps distinct Mega files whose identities are in their fragments", () => {
    document.body.innerHTML = `
      <a href="https://mega.nz/file/handle#first-key">first</a>
      <a href="https://mega.nz/file/handle#second-key">second</a>
    `;
    const matcher = buildMatcher([
      { id: 9, name: "Mega", type: "hoster", domains: ["mega.nz"], status: true, nsfw: false },
    ], { includeNsfw: false });

    expect(scanDocument(document, matcher).candidates.map((candidate) => candidate.url)).toEqual([
      "https://mega.nz/file/handle#first-key",
      "https://mega.nz/file/handle#second-key",
    ]);
  });
});
