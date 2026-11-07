import { describe, expect, it } from "vitest";
import { layoutTopology } from "../../src/features/run-experiment/topology-layout";
import {
  topologyNodeCategory,
  topologyNodeLabel,
  topologyNodeTypesFromCapabilities,
  isTopologyParticipant,
} from "../../src/features/run-experiment/topology-node-types";
import { decideTopologyConnection, topologySuperNodes } from "../../src/features/run-experiment/topology-supernodes";

describe("topology node vocabulary", () => {
  it("builds addable presets only from the backend capability payload", () => {
    expect(
      topologyNodeTypesFromCapabilities({
        topology_node_types: [
          { device_type: "GPU", role: "compute", id_prefix: "gpu", participant: true },
          { device_type: "Switch", role: "network", id_prefix: "sw", participant: false },
        ],
      }).map((entry) => entry.value),
    ).toEqual(["GPU", "Switch"]);
    expect(topologyNodeTypesFromCapabilities({}).map((entry) => entry.value)).toEqual([]);
    expect(topologyNodeTypesFromCapabilities({ topology_node_types: [{ device_type: "Router" }] })).toEqual([]);
    expect(topologyNodeCategory("Switch")).toBe("network");
    expect(topologyNodeLabel("Router")).toBe("路由器");
    expect(topologyNodeCategory("vendor-specific-accelerator")).toBe("unknown");
  });

  it("fails closed for participant classification when the backend publishes no vocabulary", () => {
    expect(isTopologyParticipant("GPU", [])).toBe(false);
    expect(isTopologyParticipant("GPU")).toBe(true);
  });
});

describe("layoutTopology", () => {
  it("places switches above adapters and endpoints deterministically", () => {
    const devices = [
      { device_id: "gpu1", device_type: "GPU" },
      { device_id: "sw0", device_type: "Switch" },
      { device_id: "gpu0", device_type: "GPU" },
      { device_id: "nic0", device_type: "NIC" },
    ];
    const links = [
      { src_device: "gpu0", dst_device: "nic0", domain_id: "so0" },
      { src_device: "nic0", dst_device: "sw0", domain_id: "so0" },
      { src_device: "sw0", dst_device: "gpu1", domain_id: "so0" },
    ];
    const first = layoutTopology(devices, links);
    const second = layoutTopology([...devices].reverse(), [...links].reverse());
    expect(first).toEqual(second);
    expect(first.sw0.y).toBeLessThan(first.nic0.y);
    expect(first.nic0.y).toBeLessThan(first.gpu0.y);
    expect(first.gpu0.x).not.toBe(first.gpu1.x);
  });

  it("packs large endpoint layers into rows without overlapping card centers", () => {
    const devices = Array.from({ length: 10 }, (_, index) => ({ device_id: `gpu${index}`, device_type: "GPU" }));
    const links = devices.slice(1).map((device) => ({
      src_device: "sw0",
      dst_device: device.device_id,
      domain_id: "so0",
    }));
    const allDevices = [{ device_id: "sw0", device_type: "Switch" }, ...devices];
    const positions = layoutTopology(allDevices, links);
    const endpointRows = new Set(devices.map((device) => positions[device.device_id].y));
    expect(endpointRows.size).toBeGreaterThan(1);
    expect(Object.values(positions).every(({ x, y }) => x >= 68 && x <= 692 && y >= 0)).toBe(true);
  });

  it("uses a peer grid and a separate parking row for unconnected devices", () => {
    const devices = [
      { device_id: "gpu0", device_type: "GPU" },
      { device_id: "gpu1", device_type: "GPU" },
      { device_id: "gpu2", device_type: "GPU" },
      { device_id: "gpu3", device_type: "GPU" },
      { device_id: "host0", device_type: "CPU" },
    ];
    const links = [
      { src_device: "gpu0", dst_device: "gpu1", domain_id: "su0" },
      { src_device: "gpu0", dst_device: "gpu2", domain_id: "so0" },
      { src_device: "gpu1", dst_device: "gpu3", domain_id: "so0" },
    ];
    const positions = layoutTopology(devices, links);
    expect(positions.gpu0.y).toBe(positions.gpu1.y);
    expect(positions.gpu2.y).toBe(positions.gpu3.y);
    expect(positions.gpu0.y).toBeLessThan(positions.gpu2.y);
    expect(positions.host0.y).toBeGreaterThan(positions.gpu2.y);
    expect(positions.host0.x).toBe(380);
  });
});

describe("topology super-node semantics", () => {
  const devices = [
    { device_id: "gpu0", device_type: "GPU" },
    { device_id: "gpu1", device_type: "GPU" },
    { device_id: "gpu2", device_type: "GPU" },
    { device_id: "sw0", device_type: "Switch" },
  ];
  const domains = [
    { domain_id: "su0", domain_type: "scale_up" as const, member_devices: ["gpu0", "gpu1"], module_binding: "sue" },
    { domain_id: "su1", domain_type: "scale_up" as const, member_devices: ["gpu2"], module_binding: "sue" },
    {
      domain_id: "so0",
      domain_type: "scale_out" as const,
      member_devices: ["gpu0", "gpu1", "gpu2"],
      module_binding: "ue",
    },
  ];

  it("derives visual groups from scale_up domains only", () => {
    expect(
      topologySuperNodes(devices, domains).map((node) => [node.id, node.devices.map((item) => item.device_id)]),
    ).toEqual([["__default__", ["gpu0", "gpu1", "gpu2"]]]);
  });

  it("keeps a legacy overlapping card in the first declared super node only", () => {
    const overlap = [
      { domain_id: "su0", domain_type: "scale_up" as const, member_devices: ["gpu0", "gpu1"], module_binding: "sue" },
      { domain_id: "su1", domain_type: "scale_up" as const, member_devices: ["gpu1", "gpu2"], module_binding: "sue" },
    ];
    expect(
      topologySuperNodes(devices, overlap).map((node) => [node.id, node.devices.map((item) => item.device_id)]),
    ).toEqual([["__default__", ["gpu0", "gpu1", "gpu2"]]]);
  });

  it("splits one scale_up binding into physical super nodes by group_id", () => {
    const grouped = devices.slice(0, 3).map((device, index) => ({
      ...device,
      group_id: index < 2 ? "node0" : "node1",
    }));
    const [first, second] = topologySuperNodes(grouped, [
      {
        domain_id: "su0",
        domain_type: "scale_up" as const,
        member_devices: ["gpu0", "gpu1", "gpu2"],
        module_binding: "sue",
      },
    ]);
    expect(first).toMatchObject({ id: "group::node0", label: "node0" });
    expect(first.devices.map((device) => device.device_id)).toEqual(["gpu0", "gpu1"]);
    expect(second).toMatchObject({ id: "group::node1", label: "node1" });
    expect(second.devices.map((device) => device.device_id)).toEqual(["gpu2"]);
  });

  it("resolves only backend-valid group connections", () => {
    expect(decideTopologyConnection("gpu0", "gpu1", devices, domains)).toMatchObject({
      allowed: true,
      kind: "scale_up",
    });
    expect(decideTopologyConnection("gpu0", "gpu2", devices, domains)).toMatchObject({ allowed: false });
    expect(decideTopologyConnection("gpu0", "sw0", devices, domains)).toEqual({
      allowed: false,
      reason: "请先把设备加入计算节点组，再连接节点组之间的跨机网络。",
    });
  });
});
