import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { compile } from "json-schema-to-typescript";
import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone/index.js";
import { format, resolveConfig } from "prettier";

const root = process.cwd();
const schemaPath = resolve(root, "src/contracts/schemas/report-identities.compat.schema.json");
const outputPath = resolve(root, "src/contracts/generated/report-identities.ts");
const validatorOutputPath = resolve(root, "src/contracts/generated/report-validators.js");
const prettierConfig = (await resolveConfig(outputPath)) ?? {};
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const banner =
  "// Generated from the frontend compatibility schema. Do not edit by hand.\n" +
  "// This file is not a canonical TileSim backend contract.\n\n";
const generated = await compile(schema, schema.title, {
  bannerComment: "",
  additionalProperties: true,
  style: { singleQuote: false, semi: true, tabWidth: 2, trailingComma: "all" },
});
const next = await format(`${banner}${generated}`, {
  ...prettierConfig,
  filepath: outputPath,
});
const schemaDefinitionByKind = {
  run: "run",
  metrics: "metrics",
  validation: "validation",
  tail: "tail",
  designSpace: "designSpace",
  executionEnvelope: "executionEnvelope",
};
const ajv = new Ajv({ allErrors: true, strict: false, code: { source: true, esm: true } });
const validatorIds = {};
for (const [exportName, definitionName] of Object.entries(schemaDefinitionByKind)) {
  const id = `tilesim.web.compat.validator.${exportName}.v1`;
  ajv.addSchema({ ...schema.$defs[definitionName], $defs: schema.$defs, $id: id }, id);
  validatorIds[exportName] = id;
}
const validatorBanner =
  "// Generated Ajv standalone validators. Do not edit by hand.\n" +
  "// The source schema is frontend compatibility material, not a canonical backend contract.\n";
const nextValidators = await format(`${validatorBanner}${standaloneCode(ajv, validatorIds)}`, {
  ...prettierConfig,
  filepath: validatorOutputPath,
});

if (process.argv.includes("--check")) {
  let current = "";
  let currentValidators = "";
  try {
    current = await readFile(outputPath, "utf8");
    currentValidators = await readFile(validatorOutputPath, "utf8");
  } catch {
    // Missing output is reported as drift below.
  }
  if (current !== next || currentValidators !== nextValidators) {
    process.stderr.write("Generated contract types are stale. Run pnpm contracts:generate.\n");
    process.exitCode = 1;
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, next, "utf8");
  await writeFile(validatorOutputPath, nextValidators, "utf8");
  process.stdout.write(`Generated ${outputPath}\n`);
  process.stdout.write(`Generated ${validatorOutputPath}\n`);
}
