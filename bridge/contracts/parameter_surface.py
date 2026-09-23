"""The addressable parameter surface, derived from the contract schemas.

The shipped assistant once understood thirteen ``overrides`` knobs and refused
everything else, which made it answer "this configuration has no such parameter"
for anything the panel could in fact write - the device count, the GPU
participation mode, every ``runtime_trace`` policy key, every per-request field,
every per-device field.  This module is the opposite approach: it enumerates the
whole surface so one instruction can address any of it.

Nothing here is hand-written.  Field names, kinds, enum values and ranges come
from the same contract files the page derives its own editors from:

* ``schemas/run-overrides.schema.json``            - the quick-control knobs
* ``schemas/runtime-trace-input.schema.json``      - ``custom_inputs.runtime_trace``
* ``schemas/topology-request-input.schema.json``   - ``custom_inputs.topology``
* :mod:`contracts.experiment_descriptor`           - knob identity + the three
  top-level enumerations the page offers

Address convention (identical to ``src/features/run-experiment/parameter-catalog.ts``,
which builds the browser-side half of the same surface).  Every address is
**document-relative** and names the document that owns the value, so applying an
edit needs no prefix rewriting:

    overrides/runtime/max_batch_size          the quick-control knob
    scenario_id                               a top-level request field
    runtime_trace/policy/max_active_requests  ``custom_inputs.runtime_trace``
    runtime_trace/requests[0]/tp_degree       its ``requests`` element
    topology/devices[0]/device_type           ``custom_inputs.topology``
    topology/module_bindings[0]/override_params/bandwidth_gbps
    topology/devices                          the **size** of a collection

``[i]`` is the placeholder this module stores; a caller writes a real index.
The size of a collection is an address of its own because a count is a scalar a
user can state ("显卡数量改成 8") while the elements it governs are not.

Two kinds of field are deliberately **not** on the surface, because the page's
own editor refuses them and advertising an address the page rejects is worse
than not offering it at all:

* a **reference key** - renaming one is only correct together with every field
  that references it, which one scalar assignment cannot do.  Kept in step with
  ``applyReferenceRules()`` in ``parameter-catalog.ts``.
* a **container** - an object, or an array of strings.  Both are edited through
  their elements, or through the size address above.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from contracts.experiment_descriptor import (
    GPU_PARTICIPATION_MODES,
    PARAMETER_DEFINITIONS,
    REQUESTED_FIDELITY_OPTIONS,
    SCENARIO_OPTIONS,
)

SCHEMA_ROOT = Path(__file__).resolve().parent / "schemas"

#: The index placeholder this module stores in an element address.
INDEX_PLACEHOLDER = "[i]"

_INDEX_PATTERN = re.compile(r"\[(\d+)\]")
_PLACEHOLDER_PATTERN = re.compile(r"\[i\]")

#: ``device_id`` and friends: renaming one dangles every field that points at it.
REFERENCE_KEYS = frozenset(
    {
        "device_id",
        "domain_id",
        "module_binding",
        "module_name",
        "src_device",
        "dst_device",
    }
)

#: Kinds one scalar assignment can write.  ``stringArray`` and ``object`` cannot.
_SCALAR_KINDS = frozenset({"enum", "boolean", "string", "integer", "number", "count"})

#: Which target wins when one bare key names several addresses.  The knob comes
#: first for the same reason the browser side prefers it: a knob travels on the
#: scalar ``overrides`` channel, so a plan built from it does not move the
#: submission onto ``custom_inputs``.
_TARGET_PREFERENCE = ("control", "form", "runtime_trace", "topology")

_GROUP_TITLES = {
    "knob": "快捷控制旋钮（写进 overrides，提交走标量通道）",
    "form": "顶层表单字段",
    "policy": "运行轨迹文档 runtime_trace 的 policy",
    "request": "运行轨迹文档 runtime_trace 的 requests 元素",
    "device": "拓扑文档 topology 的设备元素",
    "link": "拓扑文档 topology 的连线元素",
    "domain": "拓扑文档 topology 的域元素",
    "module_binding": "拓扑文档 topology 的模块绑定元素",
    "collection": "集合规模（值就是元素个数）",
}

_GROUP_ORDER = ("knob", "form", "policy", "request", "device", "link", "domain", "module_binding", "collection")


@dataclass(frozen=True)
class SurfaceAddress:
    """One writable parameter, as an address a caller can type."""

    path: str
    key: str
    kind: str
    target: str
    group: str
    #: Set for a knob, so the page can write ``parameterValues[field_id]``.
    field_id: str | None = None
    enum_values: tuple[str, ...] = ()
    minimum: float | None = None
    maximum: float | None = None
    integer_only: bool = False
    max_length: int | None = None
    unit: str = "dimensionless"

    @property
    def needs_index(self) -> bool:
        """True when this address names an element rather than a single value."""

        return INDEX_PLACEHOLDER in self.path

    def describe(self) -> str:
        """One line of the catalogue text handed to a model."""

        if self.enum_values:
            constraint = "取值只能是 " + " / ".join(self.enum_values)
        elif self.kind == "boolean":
            constraint = "取值只能是 true / false"
        elif self.kind == "string":
            constraint = "一段文本"
        elif self.minimum is not None and self.maximum is not None:
            constraint = f"范围 {_format_number(self.minimum)} ~ {_format_number(self.maximum)}"
        elif self.minimum is not None:
            constraint = f"不小于 {_format_number(self.minimum)}"
        elif self.maximum is not None:
            constraint = f"不大于 {_format_number(self.maximum)}"
        else:
            constraint = "取值不限"
        if self.integer_only and not self.enum_values:
            constraint += "，必须是整数"
        if self.max_length is not None:
            constraint += f"，最多 {self.max_length} 个字符"
        if self.group == "collection":
            constraint += f"（{self.path} 的值就是元素个数）"
        elif self.unit and self.unit != "dimensionless":
            constraint += f"，单位 {self.unit}"
        return f"- {self.path}（{constraint}）"


def _format_number(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return repr(float(value))


def _read_schema(name: str) -> dict[str, Any]:
    with (SCHEMA_ROOT / name).open(encoding="utf-8") as handle:
        return json.load(handle)


_RUN_OVERRIDES = _read_schema("run-overrides.schema.json")
_RUNTIME_TRACE = _read_schema("runtime-trace-input.schema.json")
_TOPOLOGY_REQUEST = _read_schema("topology-request-input.schema.json")


def _declared_types(node: dict[str, Any]) -> tuple[str, ...]:
    declared = node.get("type")
    if isinstance(declared, list):
        return tuple(str(entry) for entry in declared)
    return (str(declared),) if declared else ()


def _kind_of(node: dict[str, Any]) -> str:
    if node.get("enum"):
        return "enum"
    types = _declared_types(node)
    for candidate in ("integer", "number", "boolean", "string"):
        if candidate in types:
            return candidate
    if "array" in types:
        return "stringArray" if "string" in _declared_types(node.get("items") or {}) else "object"
    if "object" in types:
        return "object"
    return "unknown"


def _enum_values(node: dict[str, Any]) -> tuple[str, ...]:
    return tuple(str(entry) for entry in (node.get("enum") or []) if isinstance(entry, str))


def _address(
    *,
    path: str,
    target: str,
    group: str,
    node: dict[str, Any],
    field_id: str | None = None,
    unit: str = "dimensionless",
) -> SurfaceAddress:
    key = path.rsplit("/", 1)[-1].replace(INDEX_PLACEHOLDER, "")
    minimum = node.get("minimum", node.get("exclusiveMinimum"))
    return SurfaceAddress(
        path=path,
        key=key,
        kind=_kind_of(node),
        target=target,
        group=group,
        field_id=field_id,
        enum_values=_enum_values(node),
        minimum=float(minimum) if isinstance(minimum, (int, float)) else None,
        maximum=float(node["maximum"]) if isinstance(node.get("maximum"), (int, float)) else None,
        integer_only=_kind_of(node) in {"integer", "count"},
        max_length=int(node["maxLength"]) if isinstance(node.get("maxLength"), int) else None,
        unit=unit,
    )


def _size_address(*, path: str, target: str, array_node: dict[str, Any]) -> SurfaceAddress:
    """The size of one collection, as an address of its own.

    A schema that declares no minimum still cannot hold a negative number of
    elements, so the lower bound is 0 rather than "unbounded" - otherwise a
    caller could state a negative card count and be told it was in range.
    """

    minimum = array_node.get("minItems")
    maximum = array_node.get("maxItems")
    return SurfaceAddress(
        path=path,
        key=path.rsplit("/", 1)[-1],
        kind="count",
        target=target,
        group="collection",
        minimum=float(minimum) if isinstance(minimum, int) else 0.0,
        maximum=float(maximum) if isinstance(maximum, int) else None,
        integer_only=True,
    )


def _knob_addresses() -> list[SurfaceAddress]:
    """One address per published knob, keyed by the pointer the page writes."""

    addresses: list[SurfaceAddress] = []
    overrides = _RUN_OVERRIDES.get("properties") or {}
    for definition in PARAMETER_DEFINITIONS:
        section, key = definition.section_and_key
        node = ((overrides.get(section) or {}).get("properties") or {}).get(key)
        if not isinstance(node, dict):
            continue
        addresses.append(
            _address(
                path=definition.request_json_pointer.lstrip("/"),
                target="control",
                group="knob",
                node=node,
                field_id=definition.field_id,
                unit=definition.unit,
            )
        )
    return addresses


def _form_addresses() -> list[SurfaceAddress]:
    """The four top-level request fields the panel's identity card owns."""

    return [
        SurfaceAddress(
            path="scenario_id",
            key="scenario_id",
            kind="enum",
            target="form",
            group="form",
            enum_values=tuple(
                str(option["scenario_id"]) for option in SCENARIO_OPTIONS if option.get("available")
            ),
            max_length=200,
        ),
        SurfaceAddress(
            path="fidelity_policy",
            key="fidelity_policy",
            kind="enum",
            target="form",
            group="form",
            enum_values=tuple(
                str(option["fidelity_policy"])
                for option in REQUESTED_FIDELITY_OPTIONS
                if option.get("available")
            ),
            max_length=200,
        ),
        SurfaceAddress(
            path="gpu_participation_mode",
            key="gpu_participation_mode",
            kind="enum",
            target="form",
            group="form",
            enum_values=tuple(
                str(option["gpu_participation_mode"])
                for option in GPU_PARTICIPATION_MODES
                if option.get("available")
            ),
            max_length=200,
        ),
        SurfaceAddress(
            path="run_name",
            key="run_name",
            kind="string",
            target="form",
            group="form",
            max_length=200,
        ),
    ]


def _runtime_trace_addresses() -> list[SurfaceAddress]:
    addresses: list[SurfaceAddress] = []
    root = _RUNTIME_TRACE.get("properties") or {}

    policy = (root.get("policy") or {}).get("properties") or {}
    for key, node in policy.items():
        if isinstance(node, dict):
            addresses.append(
                _address(path=f"runtime_trace/policy/{key}", target="runtime_trace", group="policy", node=node)
            )

    requests = root.get("requests") or {}
    request_items = (requests.get("items") or {}).get("properties") or {}
    for key, node in request_items.items():
        if isinstance(node, dict):
            addresses.append(
                _address(
                    path=f"runtime_trace/requests{INDEX_PLACEHOLDER}/{key}",
                    target="runtime_trace",
                    group="request",
                    node=node,
                )
            )
    if isinstance(requests, dict) and requests.get("maxItems") is not None:
        addresses.append(_size_address(path="runtime_trace/requests", target="runtime_trace", array_node=requests))
    return addresses


def _topology_addresses() -> list[SurfaceAddress]:
    addresses: list[SurfaceAddress] = []
    topology = (_TOPOLOGY_REQUEST.get("properties") or {}).get("topology") or {}
    topology_properties = topology.get("properties") or {}

    simple_groups = {
        "devices": ("device", "topology/devices"),
        "links": ("link", "topology/links"),
        "domains": ("domain", "topology/domains"),
    }
    for collection, (group, prefix) in simple_groups.items():
        node = topology_properties.get(collection) or {}
        items = (node.get("items") or {}).get("properties") or {}
        for key, child in items.items():
            if isinstance(child, dict):
                addresses.append(
                    _address(
                        path=f"{prefix}{INDEX_PLACEHOLDER}/{key}",
                        target="topology",
                        group=group,
                        node=child,
                    )
                )

    bindings = topology_properties.get("module_bindings") or {}
    binding_items = (bindings.get("items") or {}).get("properties") or {}
    for key, child in binding_items.items():
        if not isinstance(child, dict):
            continue
        addresses.append(
            _address(
                path=f"topology/module_bindings{INDEX_PLACEHOLDER}/{key}",
                target="topology",
                group="module_binding",
                node=child,
            )
        )
    override_params = (binding_items.get("override_params") or {}).get("properties") or {}
    for key, child in override_params.items():
        if isinstance(child, dict):
            addresses.append(
                _address(
                    path=f"topology/module_bindings{INDEX_PLACEHOLDER}/override_params/{key}",
                    target="topology",
                    group="module_binding",
                    node=child,
                )
            )

    devices = topology_properties.get("devices") or {}
    if devices.get("maxItems") is not None:
        addresses.append(_size_address(path="topology/devices", target="topology", array_node=devices))
    return addresses


def _build_surface() -> tuple[SurfaceAddress, ...]:
    candidates = [
        *_knob_addresses(),
        *_form_addresses(),
        *_runtime_trace_addresses(),
        *_topology_addresses(),
    ]
    kept: list[SurfaceAddress] = []
    for candidate in candidates:
        # A reference key and a container are both outside what one scalar
        # assignment can write, so neither is advertised.
        if candidate.kind not in _SCALAR_KINDS:
            continue
        if candidate.key in REFERENCE_KEYS:
            continue
        kept.append(candidate)
    return tuple(kept)


#: Every address the panel can actually write, in the order it is presented.
SURFACE_ADDRESSES: tuple[SurfaceAddress, ...] = _build_surface()

_BY_TEMPLATE: dict[str, SurfaceAddress] = {address.path: address for address in SURFACE_ADDRESSES}

#: The same addresses without their leading document name, which is the form the
#: browser side accepts too (``devices[0]/device_type`` for
#: ``topology/devices[0]/device_type``).  A model that copies an example out of
#: the catalogue text still lands on exactly the same entry.
_BY_SHORT: dict[str, list[SurfaceAddress]] = {}
for _entry in SURFACE_ADDRESSES:
    _short = _entry.path.split("/", 1)[1] if "/" in _entry.path else _entry.path
    _BY_SHORT.setdefault(_short, []).append(_entry)

_BY_KEY: dict[str, list[SurfaceAddress]] = {}
for _entry in SURFACE_ADDRESSES:
    _BY_KEY.setdefault(_entry.key, []).append(_entry)


def surface_addresses() -> tuple[SurfaceAddress, ...]:
    return SURFACE_ADDRESSES


@dataclass(frozen=True)
class Resolution:
    """The address a caller named, or why it could not be used."""

    address: SurfaceAddress | None = None
    path: str = ""
    reason: str | None = None


def _preferred(candidates: list[SurfaceAddress]) -> SurfaceAddress:
    for target in _TARGET_PREFERENCE:
        for candidate in candidates:
            if candidate.target == target:
                return candidate
    return candidates[0]


def resolve_address(name: str) -> Resolution:
    """Resolve one typed address to the surface entry it names.

    Four tiers, weakest last: the address as written, the same address with a
    written-out index (``[0]``, ``[07]``) normalised to its element placeholder,
    the same address without its leading document name, and a bare field name.

    An element address without a concrete index is reported as
    ``address_needs_an_index`` rather than guessed at: ``requests[i]`` names no
    particular request, and picking one for the caller would write a value into
    a row nobody asked about.
    """

    text = name.strip().strip("`\"'").strip()
    if not text:
        return Resolution(reason="address_is_empty")
    collapsed = _PLACEHOLDER_PATTERN.sub(INDEX_PLACEHOLDER, _INDEX_PATTERN.sub(INDEX_PLACEHOLDER, text))
    address = _BY_TEMPLATE.get(collapsed)
    if address is None:
        short = _BY_SHORT.get(collapsed)
        if short:
            address = _preferred(list(short))
    if address is not None:
        if address.needs_index and not _INDEX_PATTERN.search(text):
            return Resolution(reason="address_needs_an_index")
        concrete = _INDEX_PATTERN.sub(lambda match: f"[{int(match.group(1))}]", text)
        # The address is reported in its canonical form, so an accepted short
        # form still reaches the page as the address the page publishes.
        canonical = address.path if not address.needs_index else _concretise(address.path, concrete)
        return Resolution(address=address, path=canonical)

    candidates = _BY_KEY.get(collapsed.rsplit("/", 1)[-1])
    if not candidates:
        return Resolution(reason="unknown_parameter")
    address = _preferred(list(candidates))
    if address.needs_index:
        return Resolution(reason="address_needs_an_index")
    return Resolution(address=address, path=address.path)


def _concretise(template: str, written: str) -> str:
    """Put the index a caller wrote back into the address it addressed."""

    indices = _INDEX_PATTERN.findall(written)
    if not indices:
        return template
    iterator = iter(indices)
    return _PLACEHOLDER_PATTERN.sub(lambda _match: f"[{int(next(iterator))}]", template)


def surface_catalogue_text() -> str:
    """The surface as text for a model, grouped so the reader can navigate it.

    Grouping matters at this size: a flat list of eighty addresses hides the
    fact that ``runtime_trace/requests[i]/*`` repeats, which is exactly the
    shape a caller has to understand to address one request.
    """

    lines: list[str] = []
    for group in _GROUP_ORDER:
        members = [address for address in SURFACE_ADDRESSES if address.group == group]
        if not members:
            continue
        lines.append(f"【{_GROUP_TITLES[group]}】")
        if group in {"request", "device", "link", "domain", "module_binding"}:
            lines.append(f"  （{INDEX_PLACEHOLDER} 是元素下标，从 0 开始；写成实际数字，例如第 1 个写成 [0]）")
        lines.extend(f"  {address.describe()}" for address in members)
    return "\n".join(lines)


def address_paths() -> tuple[str, ...]:
    return tuple(address.path for address in SURFACE_ADDRESSES)
