import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function requiredString(value, pointer) {
  if (typeof value !== "string" || !value) throw new Error(`missing release identity at ${pointer}`);
  return value;
}

function artifactIdentity(entry, index) {
  const pointer = `/artifacts/${index}`;
  const bytes = entry.bytes;
  if (!((typeof bytes === "number" && Number.isSafeInteger(bytes) && bytes >= 0) || /^\d+$/.test(bytes ?? ""))) {
    throw new Error(`invalid lossless artifact byte count at ${pointer}/bytes`);
  }
  const sha256 = requiredString(entry.sha256, `${pointer}/sha256`);
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`invalid artifact SHA-256 at ${pointer}/sha256`);
  return {
    artifact_id: requiredString(entry.artifact_id, `${pointer}/artifact_id`),
    schema_identity: requiredString(entry.schema_identity, `${pointer}/schema_identity`),
    bytes: typeof bytes === "number" ? String(bytes) : bytes,
    sha256,
  };
}

export function buildReleaseIdentityMatrix(deployment, artifactManifest, evidenceAgent) {
  const matrix = {
    identity: "tilesim.web.release_identity_matrix.v1",
    tilesim: {
      source_revision: requiredString(deployment.source_revision, "/deployment/source_revision"),
      build_revision: requiredString(deployment.build_revision, "/deployment/build_revision"),
      source_state_digest: requiredString(deployment.source_state_digest, "/deployment/source_state_digest"),
      build_state_digest: requiredString(deployment.build_state_digest, "/deployment/build_state_digest"),
    },
    web: {
      source_revision: requiredString(deployment.web_source_revision, "/deployment/web_source_revision"),
      source_state_digest: requiredString(deployment.web_source_state_digest, "/deployment/web_source_state_digest"),
      build_digest: requiredString(deployment.web_build_digest, "/deployment/web_build_digest"),
      release_identity: requiredString(deployment.web_release_identity, "/deployment/web_release_identity"),
      release_digest: requiredString(deployment.web_release_digest, "/deployment/web_release_digest"),
      bridge_digest: requiredString(deployment.web_bridge_digest, "/deployment/web_bridge_digest"),
      static_digest: requiredString(deployment.web_static_digest, "/deployment/web_static_digest"),
    },
    schema_set_revision: requiredString(deployment.schema_set_revision, "/deployment/schema_set_revision"),
  };
  if (artifactManifest) {
    matrix.run = {
      run_id: requiredString(artifactManifest.run_id, "/artifact_manifest/run_id"),
      artifact_manifest_schema_identity: requiredString(
        artifactManifest.schema_version,
        "/artifact_manifest/schema_version",
      ),
      artifacts: (artifactManifest.artifacts ?? []).map(artifactIdentity),
    };
  }
  if (evidenceAgent) {
    if (evidenceAgent.authenticated_probe_match !== true) {
      throw new Error("Evidence Agent identity may only be recorded after an exact authenticated probe match");
    }
    matrix.evidence_agent = {
      protocol_identity: requiredString(evidenceAgent.protocol_identity, "/evidence_agent/protocol_identity"),
      provider_identity: requiredString(evidenceAgent.provider_identity, "/evidence_agent/provider_identity"),
      model_identity: requiredString(evidenceAgent.model_identity, "/evidence_agent/model_identity"),
      provider_revision: requiredString(evidenceAgent.provider_revision, "/evidence_agent/provider_revision"),
      prompt_revision: requiredString(evidenceAgent.prompt_revision, "/evidence_agent/prompt_revision"),
      policy_revision: requiredString(evidenceAgent.policy_revision, "/evidence_agent/policy_revision"),
      authenticated_probe_match: true,
    };
  }
  return matrix;
}

function parseArguments(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index];
    const value = values[index + 1];
    if (!name?.startsWith("--") || !value) throw new Error("release identity arguments must be --name value pairs");
    parsed[name.slice(2)] = value;
  }
  return parsed;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (!arguments_.deployment) {
    throw new Error(
      "Usage: release-identity.mjs --deployment <manifest> [--artifacts <manifest>] [--evidence-agent <identity>] [--output <path>]",
    );
  }
  const deployment = JSON.parse(await readFile(arguments_.deployment, "utf8"));
  const artifacts = arguments_.artifacts ? JSON.parse(await readFile(arguments_.artifacts, "utf8")) : undefined;
  const evidenceAgent = arguments_["evidence-agent"]
    ? JSON.parse(await readFile(arguments_["evidence-agent"], "utf8"))
    : undefined;
  const result = buildReleaseIdentityMatrix(deployment, artifacts, evidenceAgent);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (arguments_.output) await writeFile(arguments_.output, output, "utf8");
  else process.stdout.write(output);
}
