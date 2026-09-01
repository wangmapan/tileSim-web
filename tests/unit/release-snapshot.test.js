import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createReleaseSnapshot, verifyReleaseSnapshot, writeJsonAtomically } from "../../scripts/release-snapshot.mjs";

const temporaryDirectories = [];
const identityA = {
  webSourceRevision: "a".repeat(40),
  webSourceStateDigest: "b".repeat(64),
  webBuildDigest: "c".repeat(64),
  schemaSetRevision: `sha256:${"d".repeat(64)}`,
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixtureRoot(label, bridgeBytes = `bridge-${label}`, staticBytes = `static-${label}`) {
  const root = await mkdtemp(path.join(tmpdir(), `tilesim-release-${label}-`));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "bridge", "contracts"), { recursive: true });
  await mkdir(path.join(root, "dist"), { recursive: true });
  await writeFile(path.join(root, "bridge", "server.py"), bridgeBytes, "utf8");
  await writeFile(path.join(root, "bridge", "contracts", "openapi.json"), JSON.stringify({ release: label }), "utf8");
  await writeFile(path.join(root, "dist", "index.html"), staticBytes, "utf8");
  return root;
}

describe("immutable Web release snapshots", () => {
  it("copies and verifies exact Bridge and static bytes without mutable state", async () => {
    const source = await fixtureRoot("a");
    const releases = path.join(source, "runtime", "releases");
    const snapshot = await createReleaseSnapshot({ sourceRoot: source, releasesRoot: releases, identity: identityA });

    expect(snapshot.identity).toBe("tilesim.web.release_snapshot.v1");
    expect(snapshot.bridge.file_count).toBe(2);
    expect(snapshot.static.file_count).toBe(1);
    expect(await readFile(path.join(snapshot.release_root_windows, "bridge", "server.py"), "utf8")).toBe("bridge-a");
    expect(await readFile(path.join(snapshot.release_root_windows, "dist", "index.html"), "utf8")).toBe("static-a");
    await expect(verifyReleaseSnapshot(snapshot.release_root_windows)).resolves.toMatchObject({
      release_digest: snapshot.release_digest,
      schema_set_revision: identityA.schemaSetRevision,
    });
  });

  it("fails closed when immutable release bytes are changed", async () => {
    const source = await fixtureRoot("tamper");
    const snapshot = await createReleaseSnapshot({
      sourceRoot: source,
      releasesRoot: path.join(source, "runtime", "releases"),
      identity: identityA,
    });
    await writeFile(path.join(snapshot.release_root_windows, "bridge", "server.py"), "tampered", "utf8");
    await expect(verifyReleaseSnapshot(snapshot.release_root_windows)).rejects.toThrow("Bridge inventory");
  });

  it("restores the previous manifest and exact release bytes after a post-manifest failure", async () => {
    const sourceA = await fixtureRoot("rollback-a");
    const sourceB = await fixtureRoot("rollback-b");
    const runtime = await mkdtemp(path.join(tmpdir(), "tilesim-release-runtime-"));
    temporaryDirectories.push(runtime);
    const releases = path.join(runtime, "releases");
    const snapshotA = await createReleaseSnapshot({ sourceRoot: sourceA, releasesRoot: releases, identity: identityA });
    const identityB = {
      ...identityA,
      webSourceRevision: "e".repeat(40),
      webSourceStateDigest: "f".repeat(64),
      webBuildDigest: "1".repeat(64),
      schemaSetRevision: `sha256:${"2".repeat(64)}`,
    };
    const snapshotB = await createReleaseSnapshot({ sourceRoot: sourceB, releasesRoot: releases, identity: identityB });
    const activeManifest = path.join(runtime, "backend-current.json");
    const releaseA = {
      web_release_root_windows: snapshotA.release_root_windows,
      web_release_digest: snapshotA.release_digest,
      schema_set_revision: snapshotA.schema_set_revision,
    };
    await writeJsonAtomically(activeManifest, releaseA);
    const previousManifest = await readFile(activeManifest, "utf8");

    await writeJsonAtomically(activeManifest, {
      web_release_root_windows: snapshotB.release_root_windows,
      web_release_digest: snapshotB.release_digest,
      schema_set_revision: snapshotB.schema_set_revision,
    });
    await writeJsonAtomically(activeManifest, previousManifest);

    const restored = JSON.parse(await readFile(activeManifest, "utf8"));
    expect(restored).toEqual(releaseA);
    const restoredSnapshot = await verifyReleaseSnapshot(restored.web_release_root_windows);
    expect(restoredSnapshot.release_digest).toBe(snapshotA.release_digest);
    expect(await readFile(path.join(restoredSnapshot.release_root_windows, "bridge", "server.py"), "utf8")).toBe(
      "bridge-rollback-a",
    );
    expect(await readFile(path.join(restoredSnapshot.release_root_windows, "dist", "index.html"), "utf8")).toBe(
      "static-rollback-a",
    );
    await expect(verifyReleaseSnapshot(snapshotB.release_root_windows)).resolves.toMatchObject({
      release_digest: snapshotB.release_digest,
    });
  });
});
