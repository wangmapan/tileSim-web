import { describe, expect, it } from "vitest";
import { buildReleaseIdentityMatrix } from "../../scripts/release-identity.mjs";

const deployment = {
  source_revision: "a".repeat(40),
  build_revision: "a".repeat(40),
  source_state_digest: "b".repeat(64),
  build_state_digest: "b".repeat(64),
  web_source_revision: "c".repeat(40),
  web_source_state_digest: "d".repeat(64),
  web_build_digest: "e".repeat(64),
  web_release_identity: "tilesim.web.release_snapshot.v1",
  web_release_digest: "f".repeat(64),
  web_bridge_digest: "1".repeat(64),
  web_static_digest: "2".repeat(64),
  schema_set_revision: `sha256:${"3".repeat(64)}`,
};

describe("release identity matrix", () => {
  it("binds TileSim, Web, schema, run and lossless artifact identities", () => {
    const value = buildReleaseIdentityMatrix(deployment, {
      schema_version: "tilesim.bridge.artifact_manifest.v2",
      run_id: "run-release",
      artifacts: [
        {
          artifact_id: "metrics",
          schema_identity: "tilesim.metrics_report.v1",
          bytes: "9007199254740993",
          sha256: "4".repeat(64),
        },
      ],
    });
    expect(value.identity).toBe("tilesim.web.release_identity_matrix.v1");
    expect(value.web.release_digest).toBe(deployment.web_release_digest);
    expect(value.run.artifacts[0].bytes).toBe("9007199254740993");
  });

  it("does not record Provider identity without an exact authenticated probe match", () => {
    expect(() =>
      buildReleaseIdentityMatrix(deployment, undefined, {
        authenticated_probe_match: false,
      }),
    ).toThrow("exact authenticated probe match");
  });

  it("records only explicit Provider identity evidence and never environment fallback", () => {
    const evidenceAgent = {
      authenticated_probe_match: true,
      protocol_identity: "tilesim_json_https_v1",
      provider_identity: "tilesim-provider",
      model_identity: "tilesim-model",
      provider_revision: "provider-v1",
      prompt_revision: "prompt-v2",
      policy_revision: "policy-v2",
    };
    expect(buildReleaseIdentityMatrix(deployment, undefined, evidenceAgent).evidence_agent).toEqual(evidenceAgent);
  });
});
