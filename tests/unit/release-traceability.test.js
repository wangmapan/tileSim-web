import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { directoryDigest } from "../../scripts/release-traceability.mjs";
import { directoryInventory } from "../../scripts/release-traceability.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixtureDirectory() {
  const root = await mkdtemp(path.join(tmpdir(), "tilesim-release-trace-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src", "a.txt"), "alpha", "utf8");
  await writeFile(path.join(root, "b.txt"), "beta", "utf8");
  return root;
}

describe("release traceability digest", () => {
  it("is deterministic and changes with file paths or bytes", async () => {
    const root = await fixtureDirectory();
    const first = await directoryDigest(root, new Set());
    const second = await directoryDigest(root, new Set());
    expect(second).toBe(first);
    await writeFile(path.join(root, "src", "a.txt"), "changed", "utf8");
    expect(await directoryDigest(root, new Set())).not.toBe(first);
  });

  it("excludes release-irrelevant directories by name", async () => {
    const root = await fixtureDirectory();
    const before = await directoryDigest(root);
    await mkdir(path.join(root, "dist"));
    await writeFile(path.join(root, "dist", "bundle.js"), "generated", "utf8");
    expect(await directoryDigest(root)).toBe(before);
  });

  it("reports the exact release file count and payload byte count", async () => {
    const root = await fixtureDirectory();
    const inventory = await directoryInventory(root, new Set());
    expect(inventory).toEqual({
      digest: await directoryDigest(root, new Set()),
      fileCount: 2,
      totalBytes: Buffer.byteLength("alpha") + Buffer.byteLength("beta"),
    });
  });
});
