import type { LocationQuery, RouteLocationRaw } from "vue-router";

export interface ArtifactEvidenceTarget {
  runId: string;
  artifactId: string;
  sha256: string;
  pointer: string;
}

export interface ArtifactPointerSource {
  artifactId: string;
  pointer: string;
}

const artifactAliases: Record<string, string> = {
  run: "run-result",
  metrics: "metrics",
  validation: "validation",
  tail: "tail-cause-chain",
  "tail-cause-chain": "tail-cause-chain",
  "execution-envelope": "execution-envelope",
  "design-space": "design-space",
  "input-runtime-trace": "input-runtime-trace",
  "input-topology": "input-topology",
  "week8-run-evidence": "week8-run-evidence",
};

const sha256Pattern = /^[a-f0-9]{64}$/i;
const runIdPattern = /^run-[\w-]+$/;

function singleQueryValue(value: LocationQuery[string]): string | null {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return typeof value === "string" ? value : null;
}

export function parseArtifactPointerSource(sourcePath: string): ArtifactPointerSource | null {
  const trimmed = sourcePath.trim();
  if (!trimmed || /[{}*[\]]/.test(trimmed) || trimmed.includes(" + ")) return null;
  const prefixed = trimmed.match(/^([a-z-]+):(\/.*)$/);
  if (prefixed) {
    const artifactId = artifactAliases[prefixed[1]];
    return artifactId ? { artifactId, pointer: prefixed[2] } : null;
  }
  const bundled = trimmed.match(/^\/([a-z_-]+)(\/.*)?$/);
  if (!bundled) return null;
  const artifactId = artifactAliases[bundled[1].replaceAll("_", "-")];
  if (!artifactId) return null;
  return { artifactId, pointer: bundled[2] || "" };
}

export function artifactEvidenceRoute(target: ArtifactEvidenceTarget): RouteLocationRaw {
  return {
    name: "execution",
    query: {
      run: target.runId,
      evidence_artifact: target.artifactId,
      evidence_sha: target.sha256.toLowerCase(),
      evidence_pointer: target.pointer,
    },
  };
}

export function parseArtifactEvidenceQuery(query: LocationQuery): ArtifactEvidenceTarget | null {
  const runId = singleQueryValue(query.run);
  const artifactId = singleQueryValue(query.evidence_artifact);
  const sha256 = singleQueryValue(query.evidence_sha);
  const pointer = singleQueryValue(query.evidence_pointer);
  if (
    !runId ||
    !runIdPattern.test(runId) ||
    !artifactId ||
    !Object.values(artifactAliases).includes(artifactId) ||
    !sha256 ||
    !sha256Pattern.test(sha256) ||
    pointer === null ||
    (pointer !== "" && !pointer.startsWith("/"))
  ) {
    return null;
  }
  return { runId, artifactId, sha256: sha256.toLowerCase(), pointer };
}
