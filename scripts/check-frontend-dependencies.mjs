import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";

const root = resolve(process.cwd(), "src");
const sourceExtensions = new Set([".js", ".mjs", ".ts", ".vue"]);
const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory)) {
    const path = resolve(directory, entry);
    const details = await stat(path);
    if (details.isDirectory()) await collect(path);
    else if (sourceExtensions.has(extname(path))) files.push(path);
  }
}

await collect(root);
const fileSet = new Set(files);
const graph = new Map(files.map((file) => [file, []]));
const violations = [];
const importPattern = /(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g;

function display(path) {
  return relative(process.cwd(), path).split(sep).join("/");
}

function resolveImport(importer, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(importer), specifier);
  const candidates = extname(base)
    ? [base]
    : [...sourceExtensions]
        .map((extension) => `${base}${extension}`)
        .concat([...sourceExtensions].map((extension) => resolve(base, `index${extension}`)));
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

function area(path) {
  return relative(root, path).split(sep)[0];
}

function sourcePath(path) {
  return relative(root, path).split(sep).join("/");
}

function featureName(path) {
  const parts = relative(resolve(root, "features"), path).split(sep);
  return parts[0] && parts[0] !== ".." ? parts[0] : null;
}

function isFeaturePublicEntry(path) {
  const feature = featureName(path);
  if (!feature) return false;
  return (
    dirname(path) === resolve(root, "features", feature) && /^index\.(js|mjs|ts|vue)$/.test(path.split(sep).at(-1))
  );
}

function isApiImplementation(path) {
  const value = sourcePath(path);
  return value === "lib/api.ts" || value.startsWith("lib/api/");
}

function isTestSource(path) {
  return /\.(test|spec)\.[^.]+$/.test(path);
}

const allowedTargets = {
  contracts: new Set(["contracts"]),
  adapters: new Set(["adapters", "contracts", "entities"]),
  entities: new Set(["contracts", "entities"]),
};

const forbiddenTargets = {
  features: new Set(["app", "views", "store", "stores"]),
  lib: new Set(["app", "components", "features", "store", "stores", "views"]),
  store: new Set(["app", "views"]),
  stores: new Set(["app", "components", "features", "store", "views"]),
};

for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const match of content.matchAll(importPattern)) {
    const target = resolveImport(file, match[1]);
    if (!target) continue;
    graph.get(file).push(target);
    if (isTestSource(file)) continue;
    const allowed = allowedTargets[area(file)];
    if (allowed && !allowed.has(area(target))) {
      violations.push(`${display(file)} must not import ${display(target)}`);
    }
    const forbidden = forbiddenTargets[area(file)];
    if (forbidden?.has(area(target))) {
      violations.push(`${display(file)} must not import higher-level ${display(target)}`);
    }
    if (area(file) === "views" && isApiImplementation(target)) {
      violations.push(`${display(file)} must access Bridge APIs through a feature public entry`);
    }
    if (area(target) === "features" && featureName(file) !== featureName(target) && !isFeaturePublicEntry(target)) {
      violations.push(`${display(file)} must import ${featureName(target)} through its public index`);
    }
    if (sourcePath(file).startsWith("components/ui/")) {
      const targetPath = sourcePath(target);
      if (
        area(target) === "store" ||
        area(target) === "stores" ||
        isApiImplementation(target) ||
        targetPath.startsWith("features/")
      ) {
        violations.push(`${display(file)} UI primitives must not depend on state, API, or features`);
      }
    }
  }
}

const visiting = new Set();
const visited = new Set();
const stack = [];

function visit(file) {
  if (visiting.has(file)) {
    const start = stack.indexOf(file);
    violations.push(`dependency cycle: ${stack.slice(start).concat(file).map(display).join(" -> ")}`);
    return;
  }
  if (visited.has(file)) return;
  visiting.add(file);
  stack.push(file);
  for (const target of graph.get(file)) visit(target);
  stack.pop();
  visiting.delete(file);
  visited.add(file);
}

for (const file of files) visit(file);

if (violations.length) {
  process.stderr.write(`${[...new Set(violations)].join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Frontend dependency boundaries passed for ${files.length} source files.\n`);
}
