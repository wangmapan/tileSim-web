import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { directoryInventory } from "./release-traceability.mjs";

const snapshotExcludedNames = new Set([".pytest_cache", "__pycache__"]);
const sha256Pattern = /^[0-9a-f]{64}$/;
const revisionPattern = /^[0-9a-f]{40}$/;
const schemaRevisionPattern = /^sha256:[0-9a-f]{64}$/;

function assertIdentity(identity) {
  if (!revisionPattern.test(identity.webSourceRevision ?? "")) {
    throw new Error("webSourceRevision must be a full lowercase Git revision");
  }
  for (const field of ["webSourceStateDigest", "webBuildDigest"]) {
    if (!sha256Pattern.test(identity[field] ?? "")) {
      throw new Error(`${field} must be a lowercase SHA-256 digest`);
    }
  }
  if (!schemaRevisionPattern.test(identity.schemaSetRevision ?? "")) {
    throw new Error("schemaSetRevision must use the sha256:<digest> form");
  }
}

function releaseDigestFor(manifest) {
  const payload = JSON.stringify({
    bridge: manifest.bridge,
    schema_set_revision: manifest.schema_set_revision,
    static: manifest.static,
    web_build_digest: manifest.web_build_digest,
    web_source_revision: manifest.web_source_revision,
    web_source_state_digest: manifest.web_source_state_digest,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function releaseIdFor(identity) {
  return [
    identity.webSourceRevision.slice(0, 12),
    identity.webSourceStateDigest.slice(0, 16),
    identity.webBuildDigest.slice(0, 16),
  ].join("-");
}

function assertChildPath(parent, child) {
  const relative = path.relative(parent, child);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`release path must be a child of the configured releases root: ${child}`);
  }
}

async function inventoriesFor(root) {
  const [bridge, staticFiles] = await Promise.all([
    directoryInventory(path.join(root, "bridge"), snapshotExcludedNames),
    directoryInventory(path.join(root, "dist"), new Set()),
  ]);
  return { bridge, staticFiles };
}

function inventoryRecord(inventory) {
  return {
    digest: inventory.digest,
    file_count: inventory.fileCount,
    total_bytes: inventory.totalBytes,
  };
}

export async function verifyReleaseSnapshot(releaseRoot) {
  const absoluteRoot = path.resolve(releaseRoot);
  const manifest = JSON.parse(await readFile(path.join(absoluteRoot, "release.json"), "utf8"));
  const { bridge, staticFiles } = await inventoriesFor(absoluteRoot);
  const expectedBridge = inventoryRecord(bridge);
  const expectedStatic = inventoryRecord(staticFiles);
  if (JSON.stringify(manifest.bridge) !== JSON.stringify(expectedBridge)) {
    throw new Error("immutable release Bridge inventory does not match release.json");
  }
  if (JSON.stringify(manifest.static) !== JSON.stringify(expectedStatic)) {
    throw new Error("immutable release static inventory does not match release.json");
  }
  if (manifest.release_digest !== releaseDigestFor(manifest)) {
    throw new Error("immutable release digest does not match release.json");
  }
  return { ...manifest, release_root_windows: absoluteRoot };
}

export async function createReleaseSnapshot({ sourceRoot, releasesRoot, identity }) {
  assertIdentity(identity);
  const absoluteSource = path.resolve(sourceRoot);
  const absoluteReleases = path.resolve(releasesRoot);
  await mkdir(absoluteReleases, { recursive: true });
  const releaseId = releaseIdFor(identity);
  const releaseRoot = path.join(absoluteReleases, releaseId);
  assertChildPath(absoluteReleases, releaseRoot);

  try {
    const existing = await verifyReleaseSnapshot(releaseRoot);
    if (
      existing.web_source_revision !== identity.webSourceRevision ||
      existing.web_source_state_digest !== identity.webSourceStateDigest ||
      existing.web_build_digest !== identity.webBuildDigest ||
      existing.schema_set_revision !== identity.schemaSetRevision
    ) {
      throw new Error("an immutable release ID already exists with different identity");
    }
    return existing;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const stagingRoot = path.join(absoluteReleases, `.staging-${releaseId}-${process.pid}-${Date.now().toString(36)}`);
  assertChildPath(absoluteReleases, stagingRoot);
  try {
    const sourceBefore = await inventoriesFor(absoluteSource);
    await mkdir(stagingRoot);
    await Promise.all([
      cp(path.join(absoluteSource, "bridge"), path.join(stagingRoot, "bridge"), {
        recursive: true,
        filter(source) {
          return !snapshotExcludedNames.has(path.basename(source));
        },
      }),
      cp(path.join(absoluteSource, "dist"), path.join(stagingRoot, "dist"), { recursive: true }),
    ]);
    const [sourceAfter, snapshot] = await Promise.all([inventoriesFor(absoluteSource), inventoriesFor(stagingRoot)]);
    if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter)) {
      throw new Error("TileSim Web release bytes changed while the immutable snapshot was created");
    }
    if (JSON.stringify(sourceBefore) !== JSON.stringify(snapshot)) {
      throw new Error("immutable release snapshot does not match its source bytes");
    }

    const manifest = {
      identity: "tilesim.web.release_snapshot.v1",
      release_id: releaseId,
      web_source_revision: identity.webSourceRevision,
      web_source_state_digest: identity.webSourceStateDigest,
      web_build_digest: identity.webBuildDigest,
      schema_set_revision: identity.schemaSetRevision,
      bridge: inventoryRecord(snapshot.bridge),
      static: inventoryRecord(snapshot.staticFiles),
    };
    manifest.release_digest = releaseDigestFor(manifest);
    await writeFile(path.join(stagingRoot, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await rename(stagingRoot, releaseRoot);
    return verifyReleaseSnapshot(releaseRoot);
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true });
    if (error?.code === "EEXIST") return verifyReleaseSnapshot(releaseRoot);
    throw error;
  }
}

export async function writeJsonAtomically(targetPath, value) {
  const absoluteTarget = path.resolve(targetPath);
  await mkdir(path.dirname(absoluteTarget), { recursive: true });
  const temporary = `${absoluteTarget}.${process.pid}.${Date.now().toString(36)}.tmp`;
  const text = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`;
  try {
    await writeFile(temporary, text, "utf8");
    await rename(temporary, absoluteTarget);
  } finally {
    await rm(temporary, { force: true });
  }
}

function parseArguments(values) {
  const parsed = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      parsed._.push(value);
      continue;
    }
    const name = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`missing value for --${name}`);
    parsed[name] = next;
    index += 1;
  }
  return parsed;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const arguments_ = parseArguments(process.argv.slice(2));
  const command = arguments_._[0];
  let result;
  if (command === "create") {
    result = await createReleaseSnapshot({
      sourceRoot: arguments_["source-root"],
      releasesRoot: arguments_["releases-root"],
      identity: {
        webSourceRevision: arguments_["web-source-revision"],
        webSourceStateDigest: arguments_["web-source-state-digest"],
        webBuildDigest: arguments_["web-build-digest"],
        schemaSetRevision: arguments_["schema-set-revision"],
      },
    });
  } else if (command === "verify") {
    result = await verifyReleaseSnapshot(arguments_["release-root"]);
  } else {
    throw new Error("Usage: release-snapshot.mjs <create|verify> [options]");
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
