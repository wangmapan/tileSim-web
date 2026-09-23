"""Tests for the addressable parameter surface derived from the contract schemas.

The surface exists so that the assistant can address everything the page can
write.  These tests pin the two properties that make that true: every scalar leaf
of the three governing schemas appears, and nothing the page would refuse to
write appears.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from contracts import parameter_surface as surface
from contracts.experiment_descriptor import PARAMETER_DEFINITIONS

SCHEMA_ROOT = Path(__file__).resolve().parent / "contracts" / "schemas"


def read_schema(name: str) -> dict:
    with (SCHEMA_ROOT / name).open(encoding="utf-8") as handle:
        return json.load(handle)


def scalar_leaves(node: dict, prefix: str = "") -> set[str]:
    """Every scalar leaf of an object node, as dotted paths."""

    leaves: set[str] = set()
    for key, child in (node.get("properties") or {}).items():
        if not isinstance(child, dict):
            continue
        if child.get("properties"):
            leaves |= scalar_leaves(child, f"{prefix}{key}.")
            continue
        declared = child.get("type")
        declared = declared if isinstance(declared, list) else [declared]
        if child.get("enum") or {"integer", "number", "boolean", "string"} & set(declared):
            leaves.add(f"{prefix}{key}")
    return leaves


class SurfaceCoverageTest(unittest.TestCase):
    def test_every_published_knob_is_an_address(self) -> None:
        paths = set(surface.address_paths())
        for definition in PARAMETER_DEFINITIONS:
            self.assertIn(definition.request_json_pointer.lstrip("/"), paths)

    def test_a_knob_keeps_the_field_id_that_names_it_on_the_page(self) -> None:
        by_path = {address.path: address for address in surface.SURFACE_ADDRESSES}
        for definition in PARAMETER_DEFINITIONS:
            address = by_path[definition.request_json_pointer.lstrip("/")]
            self.assertEqual(address.target, "control")
            self.assertEqual(address.field_id, definition.field_id)
            self.assertEqual(address.unit, definition.unit)

    def test_every_scalar_leaf_of_the_runtime_trace_document_is_an_address(self) -> None:
        schema = read_schema("runtime-trace-input.schema.json")
        policy = scalar_leaves(schema["properties"]["policy"])
        requests = scalar_leaves(schema["properties"]["requests"]["items"])
        paths = set(surface.address_paths())
        for key in policy:
            self.assertIn(f"runtime_trace/policy/{key}", paths)
        for key in requests:
            self.assertIn(f"runtime_trace/requests[i]/{key}", paths)

    def test_every_scalar_leaf_of_the_four_topology_collections_is_an_address(self) -> None:
        topology = read_schema("topology-request-input.schema.json")["properties"]["topology"]
        paths = set(surface.address_paths())
        for collection in ("devices", "links", "domains"):
            for key in scalar_leaves(topology["properties"][collection]["items"]):
                # A reference key is excluded on purpose, so it is not expected here either.
                if key in surface.REFERENCE_KEYS:
                    self.assertNotIn(f"topology/{collection}[i]/{key}", paths)
                    continue
                self.assertIn(f"topology/{collection}[i]/{key}", paths)
        bindings = topology["properties"]["module_bindings"]["items"]
        for key in scalar_leaves(bindings):
            # A dotted key is a leaf of a nested object, which the loop below covers.
            if "." in key:
                continue
            if key in surface.REFERENCE_KEYS:
                self.assertNotIn(f"topology/module_bindings[i]/{key}", paths)
                continue
            self.assertIn(f"topology/module_bindings[i]/{key}", paths)
        for key in scalar_leaves(bindings["properties"]["override_params"]):
            self.assertIn(f"topology/module_bindings[i]/override_params/{key}", paths)

    def test_the_four_top_level_form_fields_are_addresses(self) -> None:
        paths = set(surface.address_paths())
        for path in ("scenario_id", "fidelity_policy", "gpu_participation_mode", "run_name"):
            self.assertIn(path, paths)

    def test_a_reference_key_is_never_offered(self) -> None:
        # Renaming one is only correct together with every field that points at it, which one scalar
        # assignment cannot do - the page refuses these too.
        keys = {address.key for address in surface.SURFACE_ADDRESSES}
        self.assertFalse(keys & surface.REFERENCE_KEYS)

    def test_a_container_is_never_offered_as_a_scalar(self) -> None:
        paths = set(surface.address_paths())
        self.assertNotIn("topology/domains[i]/member_devices", paths)
        self.assertNotIn("runtime_trace/requests[i]/participants", paths)
        self.assertNotIn("topology/module_bindings[i]/override_params", paths)

    def test_the_topology_workload_block_is_out_of_scope_by_design(self) -> None:
        # The page's structured editors cover the four collections and nothing else, so a path the
        # page does not publish must not be advertised here either.
        paths = set(surface.address_paths())
        self.assertFalse(any(path.startswith("topology/workload") for path in paths))


class CollectionSizeTest(unittest.TestCase):
    """A collection's size is an address, because a count is what a caller states."""

    def test_the_card_count_is_the_size_of_the_device_collection(self) -> None:
        devices = {address.path: address for address in surface.SURFACE_ADDRESSES}["topology/devices"]
        self.assertEqual(devices.kind, "count")
        self.assertEqual(devices.target, "topology")
        self.assertTrue(devices.integer_only)
        self.assertEqual(devices.minimum, 0)
        self.assertEqual(devices.maximum, 1024)

    def test_the_request_count_keeps_the_contract_minimum(self) -> None:
        requests = {address.path: address for address in surface.SURFACE_ADDRESSES}["runtime_trace/requests"]
        self.assertEqual(requests.kind, "count")
        self.assertEqual(requests.minimum, 1)
        self.assertEqual(requests.maximum, 1024)

    def test_a_size_address_is_never_an_element_address(self) -> None:
        for address in surface.SURFACE_ADDRESSES:
            if address.kind == "count":
                self.assertFalse(address.needs_index)
                self.assertEqual(address.path.rsplit("/", 1)[-1], address.key)

    def test_the_catalogue_text_says_a_size_is_a_count(self) -> None:
        text = surface.surface_catalogue_text()
        self.assertIn("集合规模", text)
        self.assertIn("topology/devices（", text)
        self.assertIn("元素个数", text)


class AddressResolutionTest(unittest.TestCase):
    def resolve(self, name: str) -> surface.Resolution:
        return surface.resolve_address(name)

    def test_a_full_address_resolves_to_itself(self) -> None:
        resolution = self.resolve("topology/devices[3]/device_type")
        self.assertIsNone(resolution.reason)
        self.assertEqual(resolution.path, "topology/devices[3]/device_type")
        self.assertEqual(resolution.address.key, "device_type")

    def test_an_index_is_normalised(self) -> None:
        self.assertEqual(self.resolve("topology/devices[03]/device_type").path, "topology/devices[3]/device_type")

    def test_the_document_name_may_be_left_out(self) -> None:
        resolution = self.resolve("devices[1]/device_type")
        self.assertEqual(resolution.path, "topology/devices[1]/device_type")

    def test_a_bare_name_resolves_by_the_page_preference_order(self) -> None:
        # `max_batch_size` is both a knob and a policy key; the knob wins because it travels on the
        # scalar channel that does not move the submission onto `custom_inputs`.
        self.assertEqual(self.resolve("max_batch_size").path, "overrides/runtime/max_batch_size")
        self.assertEqual(self.resolve("kv_page_size_tokens").path, "runtime_trace/policy/kv_page_size_tokens")

    def test_a_bare_name_that_names_an_element_needs_an_index(self) -> None:
        resolution = self.resolve("device_type")
        self.assertIsNone(resolution.address)
        self.assertEqual(resolution.reason, "address_needs_an_index")

    def test_a_placeholder_left_in_place_needs_an_index(self) -> None:
        resolution = self.resolve("topology/devices[i]/device_type")
        self.assertEqual(resolution.reason, "address_needs_an_index")

    def test_an_unknown_address_is_reported_not_guessed(self) -> None:
        self.assertEqual(self.resolve("turbo_mode").reason, "unknown_parameter")
        self.assertEqual(self.resolve("device_count").reason, "unknown_parameter")

    def test_an_empty_address_is_reported(self) -> None:
        self.assertEqual(self.resolve("   ").reason, "address_is_empty")

    def test_quotes_are_tolerated_but_not_kept(self) -> None:
        self.assertEqual(self.resolve("`topology/devices`").path, "topology/devices")


class SurfaceTextTest(unittest.TestCase):
    def test_the_text_groups_the_addresses_it_lists(self) -> None:
        text = surface.surface_catalogue_text()
        for heading in ("快捷控制旋钮", "顶层表单字段", "policy", "requests 元素", "设备元素"):
            self.assertIn(heading, text)

    def test_the_text_explains_the_element_placeholder(self) -> None:
        text = surface.surface_catalogue_text()
        self.assertIn("[i]", text)
        self.assertIn("从 0 开始", text)

    def test_the_text_carries_every_range_and_enum(self) -> None:
        text = surface.surface_catalogue_text()
        self.assertIn("范围 1 ~ 64", text)
        self.assertIn("starvation_aware", text)
        self.assertIn("true / false", text)

    def test_no_address_appears_twice(self) -> None:
        paths = surface.address_paths()
        self.assertEqual(len(paths), len(set(paths)))


if __name__ == "__main__":
    unittest.main()
