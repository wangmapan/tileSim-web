import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { compile, compileFromFile } from "json-schema-to-typescript";
import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import { format, resolveConfig } from "prettier";

const root = process.cwd();
const openapiPath = resolve(root, "bridge/contracts/openapi.json");
const schemaPath = resolve(root, "bridge/contracts/schemas/bridge-api.schema.json");
const createRunSchemaPath = resolve(root, "bridge/contracts/schemas/create-run-request.schema.json");
const experimentDescriptorSchemaPath = resolve(root, "bridge/contracts/schemas/experiment-descriptor.schema.json");
const designSpaceCandidatesSchemaPath = resolve(root, "bridge/contracts/schemas/design-space-candidates.schema.json");
const schemaDirectory = dirname(schemaPath);
const typesOutputPath = resolve(root, "src/contracts/generated/bridge-contracts.ts");
const clientOutputPath = resolve(root, "src/contracts/generated/bridge-client.ts");
const createRunSchemaOutputPath = resolve(root, "src/contracts/generated/create-run-schema.ts");
const experimentValidatorsOutputPath = resolve(root, "src/contracts/generated/experiment-validators.js");
const evidenceAgentValidatorsOutputPath = resolve(root, "src/contracts/generated/evidence-agent-validators.js");
const openapi = JSON.parse(await readFile(openapiPath, "utf8"));
const createRunSchema = JSON.parse(await readFile(createRunSchemaPath, "utf8"));
const experimentDescriptorSchema = JSON.parse(await readFile(experimentDescriptorSchemaPath, "utf8"));
const designSpaceCandidatesSchema = JSON.parse(await readFile(designSpaceCandidatesSchemaPath, "utf8"));
const prettierConfig = (await resolveConfig(clientOutputPath)) ?? {};
const compileOptions = {
  bannerComment: "",
  cwd: schemaDirectory,
  additionalProperties: true,
  style: { singleQuote: false, semi: true, tabWidth: 2, trailingComma: "all" },
};

const coreTypes = await compileFromFile(schemaPath, compileOptions);
const inlineTypeNames = [
  "HealthResponse",
  "CatalogResponse",
  "CapabilitiesResponse",
  "TemplateResponse",
  "RenameRunRequest",
  "RenameRunResponse",
  "Week7EvidenceMapResponse",
  "Week7CalibrationResponse",
  "Week7OrchestrationResponse",
  "EvidenceAgentDescriptorResponse",
];
const inlineTypes = [];
function schemaForStandaloneCompile(value) {
  if (Array.isArray(value)) return value.map(schemaForStandaloneCompile);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === "$ref" && typeof child === "string"
        ? child.replace(/^\.\/schemas\//, "")
        : schemaForStandaloneCompile(child),
    ]),
  );
}
for (const name of inlineTypeNames) {
  inlineTypes.push(
    await compile(
      { ...schemaForStandaloneCompile(openapi.components.schemas[name]), title: name },
      name,
      compileOptions,
    ),
  );
}
const typesBanner = "// Generated from bridge/contracts OpenAPI and JSON Schema. Do not edit by hand.\n\n";
const createRunResponse = "export type CreateRunResponse = ApiRun & { idempotent_replay: boolean };\n";
const nextTypes = await format(`${typesBanner}${coreTypes}\n${inlineTypes.join("\n")}\n${createRunResponse}`, {
  ...prettierConfig,
  filepath: typesOutputPath,
});

function identifier(value) {
  const joined = value.replace(/[-_]+(.)/g, (_, character) => character.toUpperCase());
  return joined.charAt(0).toLowerCase() + joined.slice(1);
}

function resolveParameter(parameter) {
  if (!parameter.$ref) return parameter;
  const name = parameter.$ref.split("/").at(-1);
  return openapi.components.parameters[name];
}

const operations = [];
for (const [path, pathItem] of Object.entries(openapi.paths)) {
  for (const method of ["get", "post"]) {
    const operation = pathItem[method];
    if (!operation) continue;
    const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].map(resolveParameter);
    operations.push({ path, method, operation, parameters });
  }
}

function pathExpression(path, parameters) {
  const pathParameters = parameters.filter((parameter) => parameter.in === "path");
  if (!pathParameters.length) return JSON.stringify(path);
  let expression = `\`${path}`;
  for (const parameter of pathParameters) {
    expression = expression.replace(`{${parameter.name}}`, `\${encodeURIComponent(${identifier(parameter.name)})}`);
  }
  return `${expression}\``;
}

const pathMembers = operations.map(({ path, operation, parameters }) => {
  const args = parameters
    .filter((parameter) => parameter.in === "path")
    .map((parameter) => `${identifier(parameter.name)}: string`)
    .join(", ");
  return `  ${operation.operationId}: (${args}) => ${pathExpression(path, parameters)},`;
});

const clientMethods = operations
  .filter(({ operation }) => operation["x-client-response-type"])
  .map(({ method, operation, parameters }) => {
    const pathParameters = parameters.filter((parameter) => parameter.in === "path");
    const headerParameters = parameters.filter((parameter) => parameter.in === "header");
    const args = pathParameters.map((parameter) => `${identifier(parameter.name)}: string`);
    const requestType = operation["x-client-request-type"];
    if (requestType) args.push(`body: ${requestType}`);
    for (const parameter of headerParameters) {
      const optional = parameter.required ? "" : "?";
      args.push(`${identifier(parameter.name)}${optional}: string`);
    }
    const pathArgs = pathParameters.map((parameter) => identifier(parameter.name)).join(", ");
    const initParts = method === "get" ? [] : [`method: ${JSON.stringify(method.toUpperCase())}`];
    if (requestType) {
      const headers = ['"Content-Type": "application/json"'];
      for (const parameter of headerParameters) {
        headers.push(`${JSON.stringify(parameter.name)}: ${identifier(parameter.name)}`);
      }
      initParts.push(`headers: { ${headers.join(", ")} }`);
      initParts.push("body: JSON.stringify(body)");
    }
    return `
  ${operation.operationId}(${args.join(", ")}): Promise<${operation["x-client-response-type"]}> {
    return this.transport.request<${operation["x-client-response-type"]}>(bridgePaths.${operation.operationId}(${pathArgs}), { ${initParts.join(", ")} });
  }`;
  });

const importedTypes = [
  ...new Set(
    operations
      .flatMap(({ operation }) => [operation["x-client-request-type"], operation["x-client-response-type"]])
      .filter(Boolean)
      .filter((name) => name !== "unknown"),
  ),
].sort();
const clientSource = `// Generated from bridge/contracts/openapi.json. Do not edit by hand.

import type { ${importedTypes.join(", ")} } from "./bridge-contracts";

export interface BridgeApiTransport {
  request<T>(path: string, options?: RequestInit): Promise<T>;
}

export const bridgePaths = {
${pathMembers.join("\n")}
} as const;

export class GeneratedBridgeClient {
  constructor(private readonly transport: BridgeApiTransport) {}
${clientMethods.join("\n")}
}
`;
const nextClient = await format(clientSource, { ...prettierConfig, filepath: clientOutputPath });
const createRunSchemaSource = `// Generated from the F8 Bridge JSON Schemas. Do not edit by hand.

export const createRunRequestSchema = ${JSON.stringify(createRunSchema, null, 2)} as const;
export const experimentDescriptorSchema = ${JSON.stringify(experimentDescriptorSchema, null, 2)} as const;
export const designSpaceCandidatesSchema = ${JSON.stringify(designSpaceCandidatesSchema, null, 2)} as const;
`;
const nextCreateRunSchema = await format(createRunSchemaSource, {
  ...prettierConfig,
  filepath: createRunSchemaOutputPath,
});

const f8SchemaNames = [
  "create-run-request.schema.json",
  "run-overrides.schema.json",
  "custom-run-inputs.schema.json",
  "runtime-trace-input.schema.json",
  "topology-request-input.schema.json",
  "design-space-candidates.schema.json",
  "experiment-descriptor.schema.json",
];
const f8Schemas = await Promise.all(
  f8SchemaNames.map(async (name) => JSON.parse(await readFile(resolve(schemaDirectory, name), "utf8"))),
);
const ajv = new Ajv2020({ allErrors: true, strict: false, code: { source: true, esm: true } });
for (const schema of f8Schemas) ajv.addSchema(schema);
const validatorIds = {
  createRunRequest: createRunSchema.$id,
  experimentDescriptor: experimentDescriptorSchema.$id,
  designSpaceCandidates: designSpaceCandidatesSchema.$id,
};
for (const schemaId of Object.values(validatorIds)) {
  if (!ajv.getSchema(schemaId)) throw new Error(`Unable to compile F8 schema: ${schemaId}`);
}
const experimentValidatorBanner = "// Generated Ajv standalone F8 validators. Do not edit by hand.\n";
const experimentValidatorSource = standaloneCode(ajv, validatorIds).replace(
  /const (\w+) = require\(("[^"]+")\)\.default;/g,
  "import $1 from $2;",
);
const nextExperimentValidators = await format(`${experimentValidatorBanner}${experimentValidatorSource}`, {
  ...prettierConfig,
  filepath: experimentValidatorsOutputPath,
});

const f9SchemaNames = [
  "f6b-common.schema.json",
  "evidence-agent-citation.schema.json",
  "evidence-agent-descriptor.schema.json",
  "evidence-agent-request.schema.json",
  "evidence-agent-response.schema.json",
];
const f9Schemas = await Promise.all(
  f9SchemaNames.map(async (name) => JSON.parse(await readFile(resolve(schemaDirectory, name), "utf8"))),
);
const evidenceAgentAjv = new Ajv2020({ allErrors: true, strict: false, code: { source: true, esm: true } });
for (const schema of f9Schemas) evidenceAgentAjv.addSchema(schema);
const evidenceAgentValidatorIds = {
  evidenceAgentDescriptor: f9Schemas[2].$id,
  evidenceAgentResponse: f9Schemas[4].$id,
  evidenceAgentCitation: f9Schemas[1].$id,
};
for (const schemaId of Object.values(evidenceAgentValidatorIds)) {
  if (!evidenceAgentAjv.getSchema(schemaId)) throw new Error(`Unable to compile F9 schema: ${schemaId}`);
}
const evidenceAgentValidatorBanner = "// Generated Ajv standalone F9 validators. Do not edit by hand.\n";
const evidenceAgentValidatorSource = standaloneCode(evidenceAgentAjv, evidenceAgentValidatorIds).replace(
  /const (\w+) = require\(("[^"]+")\)\.default;/g,
  "import $1 from $2;",
);
const nextEvidenceAgentValidators = await format(`${evidenceAgentValidatorBanner}${evidenceAgentValidatorSource}`, {
  ...prettierConfig,
  filepath: evidenceAgentValidatorsOutputPath,
});

if (process.argv.includes("--check")) {
  let currentTypes = "";
  let currentClient = "";
  let currentCreateRunSchema = "";
  let currentExperimentValidators = "";
  let currentEvidenceAgentValidators = "";
  try {
    currentTypes = await readFile(typesOutputPath, "utf8");
    currentClient = await readFile(clientOutputPath, "utf8");
    currentCreateRunSchema = await readFile(createRunSchemaOutputPath, "utf8");
    currentExperimentValidators = await readFile(experimentValidatorsOutputPath, "utf8");
    currentEvidenceAgentValidators = await readFile(evidenceAgentValidatorsOutputPath, "utf8");
  } catch {
    // Missing output is reported as drift below.
  }
  if (
    currentTypes !== nextTypes ||
    currentClient !== nextClient ||
    currentCreateRunSchema !== nextCreateRunSchema ||
    currentExperimentValidators !== nextExperimentValidators ||
    currentEvidenceAgentValidators !== nextEvidenceAgentValidators
  ) {
    process.stderr.write("Generated Bridge client is stale. Run pnpm contracts:generate.\n");
    process.exitCode = 1;
  }
} else {
  await mkdir(dirname(typesOutputPath), { recursive: true });
  await writeFile(typesOutputPath, nextTypes, "utf8");
  await writeFile(clientOutputPath, nextClient, "utf8");
  await writeFile(createRunSchemaOutputPath, nextCreateRunSchema, "utf8");
  await writeFile(experimentValidatorsOutputPath, nextExperimentValidators, "utf8");
  await writeFile(evidenceAgentValidatorsOutputPath, nextEvidenceAgentValidators, "utf8");
  process.stdout.write(`Generated ${typesOutputPath}\n`);
  process.stdout.write(`Generated ${clientOutputPath}\n`);
  process.stdout.write(`Generated ${createRunSchemaOutputPath}\n`);
  process.stdout.write(`Generated ${experimentValidatorsOutputPath}\n`);
  process.stdout.write(`Generated ${evidenceAgentValidatorsOutputPath}\n`);
}
