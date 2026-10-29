import os
import sys
import unittest
import json
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))
from providers import agent_intent  # noqa: E402


class AgentIntentProviderTests(unittest.TestCase):
    def test_legacy_assistant_intent_is_not_published_as_an_active_contract(self):
        metadata = json.loads(
            (Path(__file__).parent / "contracts" / "openapi.json").read_text(encoding="utf-8")
        )["x-tilesim-contract"]

        self.assertNotIn("assistant_intent", metadata)
        legacy = metadata["legacy_contracts"]["assistant_intent"]
        self.assertEqual(legacy["status"], "legacy_compatibility")
        self.assertFalse(legacy["routable"])
        self.assertEqual(legacy["replacement"], "agent_intent")
        self.assertIn("tilesim.assistant_intent.request.v1", legacy["schema_identities"])
        self.assertIn("tilesim.assistant_intent.response.v1", legacy["schema_identities"])

    def request(self):
        return {
            "schema_identity": agent_intent.REQUEST_SCHEMA_IDENTITY,
            "contract_revision": agent_intent.CONTRACT_REVISION,
            "session_id": "session-1",
            "user_goal": "Explain this page",
            "current_page": {"page_id": "overview", "route_name": "overview", "context_revision": "ctx-1", "capability_ids": ["overview"]},
            "page_catalog": [{"page_id": "overview", "route_name": "overview", "capability_ids": ["overview"], "supports_run": True}],
            "run_id": None,
            "run_context_revision": None,
            "backend_identity": {"backend_id": "local"},
            "schema_set_revision": "sha256:" + "0" * 64,
            "input_snapshot_digest": None,
        }

    def test_invalid_provider_json_fails_closed(self):
        old = dict(os.environ)
        os.environ.update({"TILESIM_ASSISTANT_BASE_URL": "http://127.0.0.1:1/v1", "TILESIM_ASSISTANT_API_KEY": "secret", "TILESIM_ASSISTANT_MODEL": "model"})
        try:
            with self.assertRaises(agent_intent.ProviderStructuredOutputError):
                agent_intent.classify(self.request(), self.request()["schema_set_revision"], transport=lambda *_: {"choices": [{"message": {"role": "assistant", "content": "not-json"}}]})
        finally:
            os.environ.clear(); os.environ.update(old)

    def test_valid_intent_is_bound_to_the_published_page_context(self):
        old = dict(os.environ)
        os.environ.update({"TILESIM_ASSISTANT_BASE_URL": "http://127.0.0.1:1/v1", "TILESIM_ASSISTANT_API_KEY": "configured", "TILESIM_ASSISTANT_MODEL": "model"})
        response = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "{\"intent\":\"explain\",\"candidate_pages\":[],\"required_capabilities\":[],\"risk_level\":\"low\",\"requires_user_confirmation\":false,\"suggested_steps\":[{\"kind\":\"observe\",\"description\":\"读取当前页面\",\"page_id\":\"overview\"}],\"clarification_questions\":[]}",
                    }
                }
            ]
        }
        try:
            result = agent_intent.classify(
                self.request(),
                self.request()["schema_set_revision"],
                transport=lambda *_: response,
            )
        finally:
            os.environ.clear(); os.environ.update(old)
        self.assertEqual(result["intent"], "explain")
        self.assertEqual(result["current_page_id"], "overview")
        self.assertEqual(result["session_id"], "session-1")

    def test_current_page_must_belong_to_the_published_catalog(self):
        request = self.request()
        request["current_page"] = {**request["current_page"], "page_id": "metrics", "route_name": "metrics"}
        with self.assertRaises(agent_intent.ProviderStructuredOutputError):
            agent_intent.classify(request, request["schema_set_revision"], transport=lambda *_: self.fail("model must not be called"))

    def test_page_catalog_cannot_forge_run_binding_or_capabilities(self):
        for mutation in (
            {"supports_run": False},
            {"capability_ids": []},
            {"capability_ids": ["overview", "run_bound"]},
        ):
            with self.subTest(mutation=mutation):
                request = self.request()
                request["page_catalog"] = [{**request["page_catalog"][0], **mutation}]
                with self.assertRaises(agent_intent.ProviderStructuredOutputError):
                    agent_intent.classify(
                        request,
                        request["schema_set_revision"],
                        transport=lambda *_: self.fail("forged catalog must not call the model"),
                    )

    def test_identity_fields_fail_closed_before_model_call(self):
        mutations = (
            {"session_id": ""},
            {"run_id": "run-1"},
            {"run_context_revision": "ctx-1"},
            {"backend_identity": []},
            {"schema_set_revision": "sha256:not-a-digest"},
            {"input_snapshot_digest": "sha256:not-a-digest"},
        )
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                request = self.request()
                request.update(mutation)
                with self.assertRaises(agent_intent.ProviderStructuredOutputError):
                    agent_intent.classify(
                        request,
                        self.request()["schema_set_revision"],
                        transport=lambda *_: self.fail("invalid request must not call the model"),
                    )

    def test_expected_backend_identity_is_bound_before_model_call(self):
        request = self.request()
        with self.assertRaises(agent_intent.ProviderStructuredOutputError):
            agent_intent.classify(
                request,
                request["schema_set_revision"],
                expected_backend_identity={"backend_id": "different"},
                transport=lambda *_: self.fail("stale backend must not call the model"),
            )

    def test_repeated_candidate_page_is_rejected(self):
        old = dict(os.environ)
        os.environ.update({"TILESIM_ASSISTANT_BASE_URL": "http://127.0.0.1:1/v1", "TILESIM_ASSISTANT_API_KEY": "configured", "TILESIM_ASSISTANT_MODEL": "model"})
        response = {
            "choices": [{"message": {"role": "assistant", "content": json.dumps({
                "intent": "navigation",
                "candidate_pages": [
                    {"page_id": "overview", "route_name": "overview", "required_capabilities": ["overview"], "reason": "查看概览"},
                    {"page_id": "overview", "route_name": "overview", "required_capabilities": ["overview"], "reason": "重复查看概览"},
                ],
                "required_capabilities": ["overview"],
                "risk_level": "low",
                "requires_user_confirmation": True,
                "suggested_steps": [{"kind": "observe", "description": "读取当前页面", "page_id": "overview"}],
                "clarification_questions": [],
            }, ensure_ascii=False)}}]
        }
        try:
            with self.assertRaises(agent_intent.ProviderStructuredOutputError):
                agent_intent.classify(self.request(), self.request()["schema_set_revision"], transport=lambda *_: response)
        finally:
            os.environ.clear(); os.environ.update(old)


if __name__ == "__main__":
    unittest.main()
