import { createHash } from "node:crypto";
import { readdir, readFile, readlink, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultExcludedNames = new Set([
  ".git",
  ".pytest_cache",
  "__pycache__",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "runtime",
  "runs",
  "test-results",
]);

function lengthBytes(length) {
  const value = Buffer.alloc(8);
  value.writeBigUInt64BE(BigInt(length));
  return value;
}

export async function directoryDigest(root, excludedNames = defaultExcludedNames) {
  const absoluteRoot = path.resolve(root);
  const files = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      if (excludedNames.has(entry.name)) continue;
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(absoluteRoot, absolutePath).split(path.sep).join("/");
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push({ absolutePath, relativePath, symbolicLink: entry.isSymbolicLink() });
      }
    }
  }

  await visit(absoluteRoot);
  const digest = createHash("sha256");
  for (const file of files) {
    const payload = file.symbolicLink
      ? Buffer.from(await readlink(file.absolutePath), "utf8")
      : await readFile(file.absolutePath);
    const metadata = await stat(file.absolutePath);
    digest.update(Buffer.from(file.relativePath, "utf8"));
    digest.update(Buffer.from([0]));
    digest.update(Buffer.from(file.symbolicLink ? "symlink" : metadata.isFile() ? "file" : "other", "utf8"));
    digest.update(Buffer.from([0]));
    digest.update(lengthBytes(payload.byteLength));
    digest.update(payload);
  }
  return digest.digest("hex");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = process.argv[2];
  if (!root) throw new Error("Usage: node scripts/release-traceability.mjs <directory> [excluded-name,...]");
  const excluded = process.argv[3] ? new Set(process.argv[3].split(",").filter(Boolean)) : defaultExcludedNames;
  process.stdout.write(`${await directoryDigest(root, excluded)}\n`);
}
