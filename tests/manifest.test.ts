import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

describe("Firefox action placement", () => {
  test("installs the action in the navbar so the popup can use its content width", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../src/static/manifest.json", import.meta.url), "utf8"),
    ) as { action?: { default_area?: string } };

    expect(manifest.action?.default_area).toBe("navbar");
  });

  test("uses the approved permanent release identity", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../src/static/manifest.json", import.meta.url), "utf8"),
    ) as {
      name?: string;
      version?: string;
      browser_specific_settings?: { gecko?: { id?: string } };
    };

    expect(manifest.name).toBe("Torbox Web Helper");
    expect(manifest.version).toBe("0.1.1");
    expect(manifest.browser_specific_settings?.gecko?.id).toBe("torbox-web-helper@luanfernandes.github.io");
  });
});
