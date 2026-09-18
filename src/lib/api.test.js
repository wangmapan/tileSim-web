import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { BridgeApiError, bridgeApi } from "./api";
import { createF8ExperimentDescriptor, f8SchemaRevision } from "../../tests/fixtures/experiment-descriptor";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("capability discovery API", () => {
  const experimentManifest = {
    schema_version: "tilesim.bridge.manifest.v1",
    api_version: "tilesim.bridge.api.v1",
    schema_set_revision: f8SchemaRevision,
    error_schema_version: "tilesim.bridge.error.v1",
    artifact_manifest_schema_version: "tilesim.bridge.artifact_manifest.v2",
    known_report_schema_identities: {},
    endpoints: {},
    experiment_descriptor: {
      endpoint: "GET /api/experiment-schema",
      schema_identity: "tilesim.bridge.experiment_descriptor.v1",
      create_run_schema_identity: "tilesim.bridge.create_run_request.v1",
    },
    run_creation: {
      idempotency_header: "Idempotency-Key",
      idempotency_required: true,
      payload_identity: "canonical_json_sha256",
    },
    run_events: {
      endpoint: "GET /api/runs/{run_id}/events",
      media_type: "text/event-stream",
      resume_header: "Last-Event-ID",
      event_ids: { active: "1", terminal: "2" },
    },
  };

  it("binds the experiment descriptor payload and response header to the manifest revision", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(createF8ExperimentDescriptor()), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-TileSim-Schema-Set-Revision": f8SchemaRevision,
          },
        }),
      ),
    );

    await expect(bridgeApi.experimentSchema(experimentManifest)).resolves.toMatchObject({
      schema_set_revision: f8SchemaRevision,
      schema_version: "tilesim.bridge.experiment_descriptor.v1",
    });
  });

  it("fails closed when the experiment descriptor response header has a stale revision", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(createF8ExperimentDescriptor()), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-TileSim-Schema-Set-Revision": `sha256:${"9".repeat(64)}`,
          },
        }),
      ),
    );

    await expect(bridgeApi.experimentSchema(experimentManifest)).rejects.toMatchObject({
      code: "experiment_schema_revision_mismatch",
    });
  });

  it("accepts only the supported bridge API manifest version", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: async () =>
          JSON.stringify({
            schema_version: "tilesim.bridge.manifest.v1",
            api_version: "tilesim.bridge.api.v1",
            schema_set_revision: "sha256:test",
            error_schema_version: "tilesim.bridge.error.v1",
            artifact_manifest_schema_version: "tilesim.bridge.artifact_manifest.v2",
            known_report_schema_identities: {},
            endpoints: {},
            run_creation: {
              idempotency_header: "Idempotency-Key",
              idempotency_required: true,
              payload_identity: "canonical_json_sha256",
            },
            run_events: {
              endpoint: "GET /api/runs/{run_id}/events",
              media_type: "text/event-stream",
              resume_header: "Last-Event-ID",
              event_ids: { active: "1", terminal: "2" },
            },
          }),
      }),
    );

    await expect(bridgeApi.manifest()).resolves.toMatchObject({ api_version: "tilesim.bridge.api.v1" });
  });

  it("fails an unsupported bridge API version closed", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: async () =>
          JSON.stringify({
            schema_version: "tilesim.bridge.manifest.v1",
            api_version: "tilesim.bridge.api.v999",
            schema_set_revision: "sha256:future",
            error_schema_version: "tilesim.bridge.error.v999",
            artifact_manifest_schema_version: "tilesim.bridge.artifact_manifest.v999",
            known_report_schema_identities: {},
            endpoints: {},
          }),
      }),
    );

    await expect(bridgeApi.manifest()).rejects.toMatchObject({ code: "unsupported_api_contract" });
  });

  it("keeps a bridge without the discovery endpoint in legacy read-only compatibility", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: { get: (name) => (name.toLowerCase() === "content-type" ? "text/html" : null) },
        text: async () => "not found",
      }),
    );

    await expect(bridgeApi.manifest()).resolves.toMatchObject({
      api_version: "tilesim.bridge.api.legacy_unversioned",
      legacy_unversioned: true,
    });
  });

  it("uses the fixed same-origin capabilities endpoint on the development surface", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const payload = {
      schema_version: "tilesim.runtime_capabilities.v1",
      default_gpu_participation_mode: "gpu_free",
      cycle_scope: "S6_hotspot_refinement_only",
      dependencies: {},
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json; charset=utf-8" },
      text: async () => JSON.stringify(payload),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(bridgeApi.capabilities()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/capabilities", { cache: "no-store" });
  });

  it("loads an exact JSON artifact for the complete evidence viewer", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const payload = { system_summary: { fabric_record_count: 1164 } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify(payload),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(bridgeApi.getArtifact("run 1", "metrics")).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/runs/run%201/files/metrics", { cache: "no-store" });
  });

  it("rejects an artifact manifest from another schema-set revision", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            schema_version: "tilesim.bridge.artifact_manifest.v2",
            api_version: "tilesim.bridge.api.v1",
            schema_set_revision: "sha256:new",
            run_id: "run-1",
            artifacts: [],
            rejected_artifacts: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(bridgeApi.getArtifactManifest("run-1", "sha256:expected")).rejects.toMatchObject({
      code: "schema_set_revision_mismatch",
    });
  });

  it("accepts formal F7 design-space and topology identities in the fixed artifact allow-list", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const artifacts = [
      ["design-space", "design_space", "design-space.json", "tilesim.design_space_report.v1"],
      ["input-topology", null, "input-topology.json", "tilesim.s6_topology_input.v1"],
    ].map(([artifact_id, report_kind, file_name, schema_identity]) => ({
      artifact_id,
      report_kind,
      file_name,
      media_type: "application/json",
      bytes: 100,
      sha256: "a".repeat(64),
      schema_identity,
      contract_status: "supported",
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            schema_version: "tilesim.bridge.artifact_manifest.v2",
            api_version: "tilesim.bridge.api.v1",
            schema_set_revision: "sha256:f7",
            run_id: "run-1",
            artifacts,
            rejected_artifacts: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(bridgeApi.getArtifactManifest("run-1", "sha256:f7")).resolves.toMatchObject({ artifacts });
  });

  it("enforces run binding for a formal design-space artifact", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const body = JSON.stringify({ schema_version: "tilesim.design_space_report.v1", run_id: "run-other" });
    const entry = {
      artifact_id: "design-space",
      report_kind: "design_space",
      file_name: "design-space.json",
      media_type: "application/json",
      bytes: Buffer.byteLength(body),
      sha256: createHash("sha256").update(body).digest("hex"),
      schema_identity: "tilesim.design_space_report.v1",
      contract_status: "supported",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })),
    );

    await expect(bridgeApi.getVerifiedArtifact("run-1", entry)).rejects.toMatchObject({
      code: "artifact_run_binding_mismatch",
    });
  });

  it("verifies artifact bytes and schema identity before parsing", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const body = JSON.stringify({
      contract_version: "wind_tunnel.run.v1alpha1",
      summary: { run_id: "run-1", request_count: 1 },
    });
    const entry = {
      artifact_id: "run-result",
      report_kind: "run",
      file_name: "run-result.json",
      media_type: "application/json",
      bytes: Buffer.byteLength(body),
      sha256: createHash("sha256").update(body).digest("hex"),
      schema_identity: "wind_tunnel.run.v1alpha1",
      contract_status: "supported",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })),
    );

    await expect(bridgeApi.getVerifiedArtifact("run-1", entry)).resolves.toMatchObject({
      contract_version: "wind_tunnel.run.v1alpha1",
    });
  });

  it("returns hash-verified raw artifact text for Worker indexing without normalizing bytes", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const body = '{\n  "schema_version": "metrics.v1",\n  "start_time_ps": 9007199254740993\n}\n';
    const entry = {
      artifact_id: "metrics",
      report_kind: "metrics",
      file_name: "metrics.json",
      media_type: "application/json",
      bytes: Buffer.byteLength(body),
      sha256: createHash("sha256").update(body).digest("hex"),
      schema_identity: "metrics.v1",
      contract_status: "supported",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })),
    );

    await expect(bridgeApi.getVerifiedArtifactText("run-1", entry)).resolves.toBe(body);
  });

  it("fails a changed artifact closed", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const body = JSON.stringify({ schema_version: "tilesim.metrics_report.v1", run_id: "run-1", summary: {} });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })),
    );

    await expect(
      bridgeApi.getVerifiedArtifact("run-1", {
        artifact_id: "metrics",
        report_kind: "metrics",
        file_name: "metrics.json",
        media_type: "application/json",
        bytes: Buffer.byteLength(body),
        sha256: "0".repeat(64),
        schema_identity: "tilesim.metrics_report.v1",
        contract_status: "supported",
      }),
    ).rejects.toMatchObject({ code: "artifact_hash_mismatch" });
  });

  it("fails an artifact with a different schema identity closed", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const body = JSON.stringify({ schema_version: "metrics.v2", run_id: "run-1", summary: {} });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })),
    );

    await expect(
      bridgeApi.getVerifiedArtifact("run-1", {
        artifact_id: "metrics",
        report_kind: "metrics",
        file_name: "metrics.json",
        media_type: "application/json",
        bytes: Buffer.byteLength(body),
        sha256: createHash("sha256").update(body).digest("hex"),
        schema_identity: "tilesim.metrics_report.v1",
        contract_status: "supported",
      }),
    ).rejects.toMatchObject({ code: "artifact_schema_identity_mismatch" });
  });

  it("fails an artifact with a wrong raw byte count closed before parsing", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const body = JSON.stringify({ schema_version: "tilesim.metrics_report.v1", run_id: "run-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })),
    );

    await expect(
      bridgeApi.getVerifiedArtifact("run-1", {
        artifact_id: "metrics",
        report_kind: "metrics",
        file_name: "metrics.json",
        media_type: "application/json",
        bytes: Buffer.byteLength(body) + 1,
        sha256: createHash("sha256").update(body).digest("hex"),
        schema_identity: "tilesim.metrics_report.v1",
        contract_status: "supported",
      }),
    ).rejects.toMatchObject({ code: "artifact_byte_count_mismatch" });
  });

  it("fails an artifact from another run closed", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const body = JSON.stringify({ schema_version: "tilesim.metrics_report.v1", run_id: "run-other" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })),
    );

    await expect(
      bridgeApi.getVerifiedArtifact("run-1", {
        artifact_id: "metrics",
        report_kind: "metrics",
        file_name: "metrics.json",
        media_type: "application/json",
        bytes: Buffer.byteLength(body),
        sha256: createHash("sha256").update(body).digest("hex"),
        schema_identity: "tilesim.metrics_report.v1",
        contract_status: "supported",
      }),
    ).rejects.toMatchObject({ code: "artifact_run_binding_mismatch" });
  });

  it("preserves integers larger than JavaScript's safe range as decimal strings", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: async () => '{"start_time_ps":9007199254740993,"ratio":0.25}',
      }),
    );

    await expect(bridgeApi.getArtifact("run-1", "execution-envelope")).resolves.toEqual({
      start_time_ps: "9007199254740993",
      ratio: 0.25,
    });
  });

  it("falls back only for a GET transport failure", async () => {
    vi.stubGlobal("window", { location: { port: "8080" } });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("connection refused"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: async () => '{"runs":[]}',
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(bridgeApi.listRuns()).resolves.toEqual({ runs: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not replay a POST on another API root after a transport failure", async () => {
    vi.stubGlobal("window", { location: { port: "8080" } });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("connection lost"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(bridgeApi.createRun({ scenario_id: "s1_des_example" }, "transport-test-key")).rejects.toThrow(
      "connection lost",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("transport-test-key");
  });

  it("keeps structured bridge error metadata and does not retry an HTTP response", async () => {
    vi.stubGlobal("window", { location: { port: "8080" } });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: {
        get: (name) => (name.toLowerCase() === "content-type" ? "application/json" : "request-test"),
      },
      text: async () =>
        JSON.stringify({
          error: { code: "invalid_request", message: "Bad field", field_path: "/scenario_id", retryable: false },
          request_id: "request-test",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const error = await bridgeApi.createRun({ scenario_id: "bad" }, "structured-error-key").catch((reason) => reason);
    expect(error).toBeInstanceOf(BridgeApiError);
    expect(error).toMatchObject({
      message: "Bad field",
      status: 400,
      code: "invalid_request",
      fieldPath: "/scenario_id",
      requestId: "request-test",
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resumes an interrupted SSE stream with Last-Event-ID", async () => {
    vi.stubGlobal("window", { location: { port: "4173" }, setTimeout });
    const streamResponse = (body) =>
      new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(streamResponse('id: 1\nevent: run\ndata: {"run_id":"run-1","status":"running"}\n\n'))
      .mockResolvedValueOnce(streamResponse('id: 2\nevent: run\ndata: {"run_id":"run-1","status":"completed"}\n\n'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(bridgeApi.waitForRun("run-1")).resolves.toMatchObject({ status: "completed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers["Last-Event-ID"]).toBe("1");
  });

  it("falls back to polling after an SSE timeout event", async () => {
    vi.stubGlobal("window", { location: { port: "4173" }, setTimeout });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('event: timeout\ndata: {"run_id":"run-2"}\n\n', {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      )
      .mockResolvedValueOnce(
        new Response('{"run_id":"run-2","status":"completed"}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(bridgeApi.waitForRun("run-2")).resolves.toMatchObject({ status: "completed" });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/runs/run-2");
  });
});
