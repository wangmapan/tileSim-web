import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const docsRoot = resolve(repositoryRoot, "docs");

function collectMarkdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (path === resolve(docsRoot, "archive")) {
        files.push(resolve(path, "README.md"));
      } else {
        files.push(...collectMarkdownFiles(path));
      }
    } else if (extname(entry.name).toLowerCase() === ".md") {
      files.push(path);
    }
  }
  return files;
}

function contentOutsideFences(source) {
  let fenced = false;
  return source
    .split(/\r?\n/u)
    .map((line) => {
      if (/^\s*```/u.test(line)) {
        fenced = !fenced;
        return "";
      }
      return fenced ? "" : line;
    })
    .join("\n");
}

const markdownFiles = [resolve(repositoryRoot, "README.md"), ...collectMarkdownFiles(docsRoot)];
const failures = [];

for (const file of markdownFiles) {
  const source = contentOutsideFences(readFileSync(file, "utf8"));
  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    target = target.replace(/\s+["'][^"']*["']$/u, "");
    if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/iu.test(target)) {
      continue;
    }

    const path = decodeURIComponent(target.split("#", 1)[0]);
    if (path && !existsSync(resolve(dirname(file), path))) {
      failures.push(`${file.slice(repositoryRoot.length + 1)} -> ${target}`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`Broken active documentation links:\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`Checked ${markdownFiles.length} active Markdown files.\n`);
