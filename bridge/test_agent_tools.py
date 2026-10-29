"""Closed tool-catalog and argument-gateway regressions."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from agent_harness import tools
from agent_harness.store import DurableHarnessStore


class AgentToolSchemaTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.store = DurableHarnessStore(Path(self.temp.name) / "harness.sqlite3")
        self.operation, _ = self.store.create_operation(
            idempotency_key="tool-test",
            request_payload={"tool": "test"},
            schema_set_revision="sha256:test",
            backend_identity={"build_revision": "test"},
            principal="local-user",
        )

    def tearDown(self) -> None:
        self.store.close()
        self.temp.cleanup()

    def test_catalog_schema_matches_published_gateway_schema(self) -> None:
        entries = tools.catalog(schema_set_revision="sha256:test", backend_identity={})["tools"]
        self.assertEqual({item["tool_name"] for item in entries}, set(tools.TOOL_DEFINITIONS))
        for entry in entries:
            schema = entry["input_schema"]
            self.assertEqual(schema, tools.TOOL_INPUT_SCHEMAS[entry["tool_name"]])
            self.assertFalse(schema["additionalProperties"])
            self.assertEqual(set(schema.get("properties", {})), tools._schema_properties(entry["tool_name"]))

    def test_unknown_argument_is_schema_violation_before_dispatch(self) -> None:
        called = False

        def forbidden(*args, **kwargs):  # noqa: ANN002, ANN003
            nonlocal called
            called = True
            return None

        with self.assertRaises(tools.ToolGatewayError) as raised:
            tools.dispatch(
                store=self.store,
                operation_id=self.operation["operation_id"],
                tool_name="get_run_status",
                payload={"run_id": "run-1", "unexpected": "x"},
                principal="local-user",
                scopes={"agent:read_run"},
                schema_set_revision="sha256:test",
                backend_identity={"build_revision": "test"},
                get_catalog=forbidden,
                get_run=forbidden,
                get_manifest=forbidden,
                get_artifact=forbidden,
            )
        self.assertEqual(raised.exception.code, "schema_violation")
        self.assertFalse(called)
        count = self.store._connection.execute(
            "SELECT COUNT(*) FROM tool_calls WHERE operation_id=?",
            (self.operation["operation_id"],),
        ).fetchone()[0]
        self.assertEqual(count, 0)

    def test_argument_validator_rejects_invalid_pointer(self) -> None:
        with self.assertRaises(tools.ToolGatewayError) as raised:
            tools.validate_tool_arguments(
                "query_verified_metrics",
                {"run_id": "run-1", "json_pointers": ["not-a-pointer"]},
            )
        self.assertEqual(raised.exception.code, "schema_violation")


if __name__ == "__main__":
    unittest.main()
