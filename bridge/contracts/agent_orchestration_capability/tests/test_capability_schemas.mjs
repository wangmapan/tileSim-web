import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const schemaRoot = join(root, "..", "schemas");
const requireWeb = createRequire("D:/tileSim-web/package.json");
const Ajv2020 = requireWeb("ajv/dist/2020").default;
const schemas = readdirSync(schemaRoot)
  .filter((name) => name.endsWith(".schema.json"))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(schemaRoot, name), "utf8")));
assert.equal(schemas.length, 9);
assert.ok(schemas.every((schema) => schema["x-tilesim-contract-status"] === "published"));
function canonical(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(",")}}`;
}
const digest = (value) => `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
const ajv = new Ajv2020({ allErrors: true, strict: false });
for (const schema of schemas) ajv.addSchema(schema);
const catalog = JSON.parse(readFileSync(join(root, "..", "catalog-content.json"), "utf8"));
const validateCatalog = ajv.getSchema(
  "https://tilesim.local/contracts/agent-orchestration-capability/v1/capability-catalog.schema.json",
);
assert.ok(validateCatalog(catalog), JSON.stringify(validateCatalog.errors));
const bad = structuredClone(catalog);
bad.not_exposed_capabilities = bad.not_exposed_capabilities.slice(0, 1);
assert.equal(validateCatalog(bad), false);
const snapshot = {
  schema_identity: "tilesim.bridge.agent_orchestration_capability_snapshot.v1",
  publication_status: "published",
  snapshot_id: "tilesim.agent-orchestration.capability-snapshot",
  canonicalization_identity: "tilesim.bridge.canonical_json.v1",
  catalog,
  release_binding: {
    web_source_identity: "tilesim.web.git",
    web_source_revision: "a".repeat(40),
    web_build_revision: "b".repeat(40),
    backend_identity: "tilesim.backend.git",
    backend_revision: "c".repeat(40),
    schema_set_revision: `sha256:${"1".repeat(64)}`,
    experiment_descriptor_identity: "tilesim.bridge.experiment_descriptor.v1",
    experiment_descriptor_revision: `sha256:${"2".repeat(64)}`,
    create_run_identity: "tilesim.bridge.create_run_request.v1",
    catalog_revision: catalog.catalog_revision,
    contract_package_revision: catalog.contract_package_revision,
    nested_design_space_identities: ["tilesim.design_space.s6_candidates.v1", "tilesim.design_space.s6_candidates.v2"],
    default_nested_design_space_identity: "tilesim.design_space.s6_candidates.v1",
  },
  drift_policy: {
    release_binding_mismatch: "fail_closed",
    catalog_revision_mismatch: "fail_closed",
    unknown_identity_or_status: "fail_closed",
  },
};
snapshot.snapshot_revision = digest(snapshot);
snapshot.snapshot_digest = snapshot.snapshot_revision;
const validateSnapshot = ajv.getSchema(
  "https://tilesim.local/contracts/agent-orchestration-capability/v1/capability-snapshot.schema.json",
);
assert.ok(validateSnapshot(snapshot), JSON.stringify(validateSnapshot.errors));
console.log(`Formal capability schemas passed: ${schemas.length} schemas, catalog validates.`);
