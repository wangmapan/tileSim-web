"""F9C fixed-endpoint Provider, validation, redaction, and recovery tests."""

from __future__ import annotations

import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import server
from providers import evidence_agent as provider
from services import evidence_agent as service
from test_server import f9_artifact_and_request


def provider_config(secret: str = "provider-secret-never-log") -> provider.ProviderConfig:
    return provider.ProviderConfig(
        provider_id=provider.SUPPORTED_PROVIDER_ID,
        endpoint="https://provider.example.invalid/v1/evidence",
        api_key=secret,
        model_id="evidence-model",
        model_revision="evidence-model-2026-08-31",
        timeout_ms=100,
        probe_cache_seconds=60,
    )


def capability_response(config: provider.ProviderConfig) -> dict:
    return {
        "protocol": provider.PROVIDER_PROTOCOL,
        "capability": "structured_evidence_analysis",
        "available": True,
        "provider_id": config.provider_id,
        "model_id": config.model_id,
        "model_revision": config.model_revision,
    }


def completed_response(payload: dict) -> dict:
    binding = payload["response_binding"]
    scope = payload["immutable_snapshot"]["snapshot_reference"]["evidence_scope"]
    citation = {
        **payload["verified_records"][0]["citation_identity"],
        "citation_role": "direct_fact",
        "availability": "available",
        "value": {
            "encoding": "decimal_string",
            "numeric_kind": "uint64",
            "decimal": "18446744073709551615",
        },
        "unit": "ps",
    }
    return {
        "schema_version": "tilesim.bridge.evidence_agent_response.v1",
        "schema_set_revision": binding["schema_set_revision"],
        "request_id": binding["request_id"],
        "client_request_id": binding["client_request_id"],
        "run_id": binding["run_id"],
        "input_snapshot_digest": binding["input_snapshot_digest"],
        "completion_state": "completed",
        "provider": binding["provider"],
        "revisions": {
            "prompt_template_revision": server.evidence_agent.PROMPT_TEMPLATE_REVISION,
            "policy_revision": server.evidence_agent.POLICY_REVISION,
        },
        "claims": [
            {
                "claim_id": "claim-live-fact",
                "claim_kind": "numeric_fact",
                "text": "The cited S7 execution-envelope stage reports the exact latency value.",
                "citations": [citation],
                "scope": {
                    "source_mode": scope["source_mode"],
                    "requested_fidelity": scope["requested_fidelity"],
                    "resolved_fidelity": scope["resolved_fidelity"],
                    "execution_mode": scope["execution_mode"],
                    "resource_semantics_relation": "S3_S4_S5_peer",
                    "causal_subsystems": ["S1", "S3", "S4", "S5", "S6"],
                    "attribution_semantics": "not_applicable",
                    "recommendation_semantics": "not_applicable",
                },
                "percentile_subject": scope["percentile_subject"],
            }
        ],
        "refusal": None,
        "partial": False,
        "truncated": False,
        "degradation": {"state": "none", "reason_code": "none"},
        "audit_summary": {
            "operations": ["verified_snapshot_read", "citation_resolution"],
            "tool_invocation_count": 2,
            "hidden_reasoning_returned": False,
        },
        "generated_at": "2026-08-31T00:00:00+00:00",
        "persistence": {
            "mode": "run_local_terminal_metadata_only",
            "retained_until": None,
            "snapshot_payload_retained": False,
            "user_question_retained": False,
        },
        "staleness": {
            "state": "current_at_generation",
            "binding_fields": [
                "run_id",
                "input_snapshot_digest",
                "schema_set_revision",
                "backend_identity",
            ],
        },
    }


class FakeTransport:
    def __init__(self, analyze=None) -> None:
        self.calls: list[dict] = []
        self._analyze = analyze

    def __call__(self, config: provider.ProviderConfig, payload: dict) -> dict:
        self.calls.append(payload)
        if payload["operation"] == "capability_probe":
            return capability_response(config)
        if callable(self._analyze):
            return self._analyze(payload)
        return {"protocol": provider.PROVIDER_PROTOCOL, "response": completed_response(payload)}


class ProviderConfigurationTest(unittest.TestCase):
    def test_requires_complete_tilesim_specific_configuration(self) -> None:
        self.assertIsNone(provider.load_config({"OPENAI_API_KEY": "must-not-be-consumed"}))
        partial = {
            "TILESIM_EVIDENCE_AGENT_PROVIDER": provider.SUPPORTED_PROVIDER_ID,
            "TILESIM_EVIDENCE_AGENT_ENDPOINT": "https://provider.example.invalid/v1/evidence",
        }
        self.assertIsNone(provider.load_config(partial))
        complete = {
            **partial,
            "TILESIM_EVIDENCE_AGENT_API_KEY": "secret",
            "TILESIM_EVIDENCE_AGENT_MODEL": "model",
            "TILESIM_EVIDENCE_AGENT_MODEL_REVISION": "revision",
        }
        config = provider.load_config(complete)
        self.assertIsNotNone(config)
        self.assertNotIn("secret", repr(config))

        newapi = provider.load_config(
            {
                **complete,
                "TILESIM_EVIDENCE_AGENT_PROVIDER": provider.NEWAPI_OPENAI_PROVIDER_ID,
                "TILESIM_EVIDENCE_AGENT_ENDPOINT": "https://newapi.example.invalid",
                "TILESIM_EVIDENCE_AGENT_MODEL": "gpt-exact-snapshot",
                "TILESIM_EVIDENCE_AGENT_MODEL_REVISION": "gpt-exact-snapshot",
            }
        )
        self.assertIsNotNone(newapi)
        self.assertEqual(newapi.provider_id, provider.NEWAPI_OPENAI_PROVIDER_ID)
        self.assertIsNone(
            provider.load_config(
                {
                    **complete,
                    "TILESIM_EVIDENCE_AGENT_PROVIDER": provider.NEWAPI_OPENAI_PROVIDER_ID,
                    "TILESIM_EVIDENCE_AGENT_MODEL": "floating-alias",
                    "TILESIM_EVIDENCE_AGENT_MODEL_REVISION": "different-revision",
                }
            )
        )

    def test_endpoint_is_https_or_loopback_and_has_no_redirectable_components(self) -> None:
        base = {
            "TILESIM_EVIDENCE_AGENT_PROVIDER": provider.SUPPORTED_PROVIDER_ID,
            "TILESIM_EVIDENCE_AGENT_API_KEY": "secret",
            "TILESIM_EVIDENCE_AGENT_MODEL": "model",
            "TILESIM_EVIDENCE_AGENT_MODEL_REVISION": "revision",
        }
        for endpoint in (
            "http://provider.example.invalid/analyze",
            "https://user:pass@provider.example.invalid/analyze",
            "https://provider.example.invalid/analyze?next=https://other.invalid",
        ):
            with self.subTest(endpoint=endpoint), self.assertRaises(provider.ProviderUnavailableError):
                provider.load_config({**base, "TILESIM_EVIDENCE_AGENT_ENDPOINT": endpoint})
        self.assertIsNotNone(
            provider.load_config({**base, "TILESIM_EVIDENCE_AGENT_ENDPOINT": "http://127.0.0.1:8443/analyze"})
        )

    def test_provider_json_parser_rejects_duplicates_floats_and_nonfinite_values(self) -> None:
        for body in (b'{"a":1,"a":2}', b'{"a":0.1}', b'{"a":NaN}', b'[]'):
            with self.subTest(body=body), self.assertRaises(provider.ProviderStructuredOutputError):
                provider._parse_json_bytes(body)

    def test_authenticated_probe_identity_controls_descriptor_availability(self) -> None:
        config = provider_config()
        transport = FakeTransport()
        runtime = provider.ProviderRuntime(config, transport)
        descriptor = server.evidence_agent.build_descriptor(server.SCHEMA_SET_REVISION, runtime.capability())
        self.assertEqual(descriptor["availability"], "available")
        self.assertEqual(descriptor["provider"], config.public_identity)
        self.assertEqual(len(transport.calls), 1)

        wrong = FakeTransport()
        wrong._analyze = None
        wrong.__call__ = lambda *_args: {}  # instance special methods are intentionally ignored
        unavailable = provider.ProviderRuntime(config, lambda _config, _payload: {"available": True})
        descriptor = server.evidence_agent.build_descriptor(
            server.SCHEMA_SET_REVISION, unavailable.capability()
        )
        self.assertEqual(descriptor["availability"], "unavailable")
        self.assertFalse(descriptor["provider"]["configured"])

    def test_http_probe_uses_only_the_fixed_endpoint_and_bearer_secret(self) -> None:
        captured: list[dict] = []

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("Content-Length", "0"))
                captured.append(
                    {
                        "path": self.path,
                        "authorization": self.headers.get("Authorization"),
                        "payload": json.loads(self.rfile.read(length)),
                    }
                )
                body = json.dumps(
                    {
                        "protocol": provider.PROVIDER_PROTOCOL,
                        "capability": "structured_evidence_analysis",
                        "available": True,
                        "provider_id": provider.SUPPORTED_PROVIDER_ID,
                        "model_id": "evidence-model",
                        "model_revision": "evidence-model-2026-08-31",
                    }
                ).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, _format: str, *_args) -> None:
                return

        httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            secret = "probe-secret-never-return"
            config = provider.ProviderConfig(
                provider_id=provider.SUPPORTED_PROVIDER_ID,
                endpoint=f"http://127.0.0.1:{httpd.server_port}/fixed-provider-endpoint",
                api_key=secret,
                model_id="evidence-model",
                model_revision="evidence-model-2026-08-31",
                timeout_ms=1_000,
            )
            capability = provider.ProviderRuntime(config).capability(force=True)
            self.assertTrue(capability.available)
            self.assertEqual(captured[0]["path"], "/fixed-provider-endpoint")
            self.assertEqual(captured[0]["authorization"], f"Bearer {secret}")
            self.assertEqual(captured[0]["payload"]["operation"], "capability_probe")
            self.assertNotIn(secret, repr(capability))
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)

    def test_newapi_adapter_uses_fixed_chat_endpoint_and_exact_authenticated_model(self) -> None:
        captured: list[dict] = []

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("Content-Length", "0"))
                request_payload = json.loads(self.rfile.read(length))
                captured.append(
                    {
                        "path": self.path,
                        "authorization": self.headers.get("Authorization"),
                        "payload": request_payload,
                    }
                )
                content = request_payload["messages"][1]["content"]
                body = json.dumps(
                    {
                        "id": "newapi-probe",
                        "object": "chat.completion",
                        "created": 0,
                        "model": "gpt-exact-snapshot",
                        "choices": [
                            {
                                "index": 0,
                                "message": {"role": "assistant", "content": content},
                                "finish_reason": "stop",
                            }
                        ],
                    }
                ).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, _format: str, *_args) -> None:
                return

        httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            secret = "newapi-secret-never-return"
            config = provider.ProviderConfig(
                provider_id=provider.NEWAPI_OPENAI_PROVIDER_ID,
                endpoint=f"http://127.0.0.1:{httpd.server_port}",
                api_key=secret,
                model_id="gpt-exact-snapshot",
                model_revision="gpt-exact-snapshot",
                timeout_ms=1_000,
            )
            capability = provider.ProviderRuntime(config).capability(force=True)
            self.assertTrue(capability.available)
            self.assertEqual(capability.provider, config.public_identity)
            self.assertEqual(captured[0]["path"], "/v1/chat/completions")
            self.assertEqual(captured[0]["authorization"], f"Bearer {secret}")
            self.assertEqual(captured[0]["payload"]["model"], "gpt-exact-snapshot")
            self.assertEqual(captured[0]["payload"]["response_format"], {"type": "json_object"})
            self.assertNotIn(secret, repr(capability))

            analysis = provider.post_newapi_openai_json(
                config,
                {
                    "operation": "structured_evidence_analysis",
                    "policy": {"system_prompt": provider.SYSTEM_POLICY_PROMPT},
                    "safe_test_value": True,
                },
            )
            self.assertEqual(analysis, {"protocol": provider.PROVIDER_PROTOCOL, "response": {
                "operation": "structured_evidence_analysis",
                "policy": {"system_prompt": provider.SYSTEM_POLICY_PROMPT},
                "safe_test_value": True,
            }})
            self.assertEqual(len(captured), 2)
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)

    def test_newapi_adapter_rejects_outer_model_identity_mismatch(self) -> None:
        config = provider.ProviderConfig(
            provider_id=provider.NEWAPI_OPENAI_PROVIDER_ID,
            endpoint="https://newapi.example.invalid",
            api_key="secret",
            model_id="gpt-exact-snapshot",
            model_revision="gpt-exact-snapshot",
        )
        response = {
            "model": "different-model",
            "choices": [
                {
                    "message": {"role": "assistant", "content": "{}"},
                    "finish_reason": "stop",
                }
            ],
        }
        with self.assertRaises(provider.ProviderStructuredOutputError):
            provider._newapi_structured_content(config, response)


class ProviderExecutionTest(unittest.TestCase):
    def setUp(self) -> None:
        with service._live_terminal_cache_lock:
            service._live_terminal_cache.clear()

    def _fixture(self, root: Path, run_id: str = "run-f9c-provider"):
        root.mkdir(parents=True, exist_ok=True)
        artifact, manifest, request = f9_artifact_and_request(root, run_id)
        documents = server.evidence_agent_artifact_documents(root, manifest)
        server.evidence_agent.validate_request(
            request,
            path_run_id=run_id,
            schema_set_revision=server.SCHEMA_SET_REVISION,
            artifact_manifest=manifest,
            artifact_documents=documents,
            current_backend_identity=server.backend_identity(),
        )
        return artifact, request, documents

    def _execute(self, root: Path, request: dict, documents: dict, runtime: provider.ProviderRuntime):
        return service.terminal_analysis(
            run_dir=root,
            request=request,
            artifact_documents=documents,
            idempotency_key="f9c-provider-key",
            payload_digest=server.evidence_agent.canonical_sha256(request),
            schema_set_revision=server.SCHEMA_SET_REVISION,
            provider_runtime=runtime,
            read_json=server.read_json_file,
            atomic_write_json=server.atomic_write_json,
        )

    def test_provider_input_is_fixed_read_only_and_live_result_is_not_persisted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, request, documents = self._fixture(root)
            transport = FakeTransport()
            runtime = provider.ProviderRuntime(provider_config(), transport)

            status, response, replay = self._execute(root, request, documents, runtime)
            self.assertEqual(status, 200)
            self.assertFalse(replay)
            self.assertEqual(response["completion_state"], "completed")
            analysis_payload = transport.calls[-1]
            self.assertEqual(analysis_payload["operation"], "structured_evidence_analysis")
            self.assertEqual(analysis_payload["policy"]["tools"], [])
            self.assertEqual(len(analysis_payload["verified_records"]), 1)
            serialized_payload = json.dumps(analysis_payload)
            self.assertNotIn(provider_config().endpoint, serialized_payload)
            self.assertNotIn(provider_config().api_key, serialized_payload)
            self.assertEqual(
                analysis_payload["verified_records"][0]["record_value"]["stage_id"], "stage-f9"
            )

            record_path = next((root / "agent-evidence-analyses").glob("*.json"))
            record_text = record_path.read_text(encoding="utf-8")
            self.assertNotIn(request["user_question"]["content"], record_text)
            self.assertNotIn("The cited S7", record_text)
            self.assertNotIn(provider_config().api_key, record_text)
            record = json.loads(record_text)
            self.assertNotIn("bridge_terminal_response", record)
            self.assertEqual(record["terminal_class"], "claims_bearing_terminal")
            self.assertFalse(record["redaction"]["provider_raw_response_retained"])
            self.assertFalse(record["redaction"]["validated_model_claims_retained"])

            second_status, second, second_replay = self._execute(root, request, documents, runtime)
            self.assertEqual(second_status, 200)
            self.assertTrue(second_replay)
            self.assertEqual(second, response)
            self.assertEqual(len(transport.calls), 2)  # one probe and one analysis only

            with service._live_terminal_cache_lock:
                service._live_terminal_cache.clear()
            with self.assertRaises(service.EvidenceAgentTerminalNotRetained):
                self._execute(root, request, documents, runtime)
            self.assertEqual(len(transport.calls), 2)

    def test_claim_free_provider_terminal_drops_output_content_and_is_not_regenerated(self) -> None:
        refusal_detail = "provider-refusal-content-must-not-be-retained"

        def refusal(payload: dict) -> dict:
            response = completed_response(payload)
            response["completion_state"] = "refused"
            response["claims"] = []
            response["refusal"] = {
                "reason_code": "insufficient_evidence",
                "detail": refusal_detail,
                "retryable": False,
            }
            response["degradation"] = {
                "state": "insufficient_evidence",
                "reason_code": "insufficient_evidence",
            }
            return {"protocol": provider.PROVIDER_PROTOCOL, "response": response}

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, request, documents = self._fixture(root, "run-f9c-claim-free-provider")
            transport = FakeTransport(refusal)
            runtime = provider.ProviderRuntime(provider_config(), transport)

            status, response, replay = self._execute(root, request, documents, runtime)
            self.assertEqual(status, 200)
            self.assertFalse(replay)
            self.assertEqual(response["completion_state"], "refused")
            self.assertEqual(response["refusal"]["detail"], refusal_detail)
            self.assertEqual(len(transport.calls), 2)  # one probe and one analysis only

            record_path = next((root / "agent-evidence-analyses").glob("*.json"))
            record_text = record_path.read_text(encoding="utf-8")
            self.assertNotIn(refusal_detail, record_text)
            record = json.loads(record_text)
            self.assertEqual(record["terminal_class"], "claim_free_provider_terminal")
            self.assertIsNone(record["terminal_metadata"]["refusal"])
            self.assertFalse(record["redaction"]["provider_raw_response_retained"])

            second_status, second, second_replay = self._execute(root, request, documents, runtime)
            self.assertEqual(second_status, 200)
            self.assertTrue(second_replay)
            self.assertEqual(second, response)
            self.assertEqual(len(transport.calls), 2)

            with service._live_terminal_cache_lock:
                service._live_terminal_cache.clear()
            with self.assertRaises(service.EvidenceAgentTerminalNotRetained):
                self._execute(root, request, documents, runtime)
            self.assertEqual(len(transport.calls), 2)

    def test_invalid_citation_and_provider_identity_fail_closed_without_raw_answer(self) -> None:
        variants = (
            (
                "invalid-citation",
                lambda payload: _mutate_response(payload, "/claims/0/citations/0/sha256", "0" * 64),
                "citation_not_allowed",
            ),
            (
                "wrong-provider",
                lambda payload: _mutate_response(payload, "/provider/model_revision", "wrong-revision"),
                "stale_schema_revision",
            ),
        )
        for suffix, mutate, expected_reason in variants:
            with self.subTest(suffix=suffix), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                _, request, documents = self._fixture(root, f"run-f9c-{suffix}")
                transport = FakeTransport(
                    lambda payload, mutate=mutate: {
                        "protocol": provider.PROVIDER_PROTOCOL,
                        "response": mutate(payload),
                    }
                )
                status, response, _ = self._execute(
                    root, request, documents, provider.ProviderRuntime(provider_config(), transport)
                )
                self.assertEqual(status, 502)
                self.assertEqual(response["completion_state"], "failed")
                self.assertEqual(response["claims"], [])
                self.assertEqual(response["refusal"]["reason_code"], expected_reason)

    def test_timeout_and_invalid_structured_output_are_contract_terminals(self) -> None:
        cases = (
            (
                "timeout",
                lambda _payload: (_ for _ in ()).throw(provider.ProviderTimeoutError("secret-free")),
                504,
                "timeout",
                "timeout",
            ),
            (
                "unavailable",
                lambda _payload: (_ for _ in ()).throw(provider.ProviderUnavailableError("secret-free")),
                503,
                "provider_unavailable",
                "refused",
            ),
            (
                "invalid",
                lambda _payload: {"protocol": provider.PROVIDER_PROTOCOL, "response": "bad"},
                502,
                "unsupported_schema",
                "failed",
            ),
        )
        for suffix, action, expected_status, expected_reason, expected_completion in cases:
            with self.subTest(suffix=suffix), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                _, request, documents = self._fixture(root, f"run-f9c-{suffix}")
                runtime = provider.ProviderRuntime(
                    provider_config(),
                    FakeTransport(action),
                )
                status, response, _ = self._execute(root, request, documents, runtime)
                self.assertEqual(status, expected_status)
                self.assertEqual(response["completion_state"], expected_completion)
                self.assertEqual(response["refusal"]["reason_code"], expected_reason)
                self.assertEqual(response["claims"], [])
                self.assertEqual(response["provider"], provider_config().public_identity)


def _mutate_response(payload: dict, pointer: str, value: object) -> dict:
    response = completed_response(payload)
    tokens = pointer.lstrip("/").split("/")
    target = response
    for token in tokens[:-1]:
        target = target[int(token)] if isinstance(target, list) else target[token]
    last = tokens[-1]
    if isinstance(target, list):
        target[int(last)] = value
    else:
        target[last] = value
    return response


if __name__ == "__main__":
    unittest.main()
