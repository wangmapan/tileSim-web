import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const catalog = JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/report-bundles.json"), "utf8"));
const audit = JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/field-audit.json"), "utf8"));

export function fixtureCatalog() {
  return structuredClone(catalog);
}

export function fixtureCase(id) {
  const value = catalog.cases.find((item) => item.id === id);
  if (!value) throw new Error(`Unknown fixture case: ${id}`);
  return structuredClone(value);
}

export function fieldAudit() {
  return structuredClone(audit);
}

export function jsonPointer(value, pointer) {
  if (pointer === "") return value;
  return pointer
    .split("/")
    .slice(1)
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((current, part) => current?.[part], value);
}
