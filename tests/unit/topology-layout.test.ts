import { describe, expect, it } from "vitest";
import { layoutTopology } from "../../src/features/run-experiment/topology-layout";
import { topologyNodeCategory, topologyNodeLabel } from "../../src/features/run-experiment/topology-node-types";

describe("topology node vocabulary", () => {
  it("exposes common physical roles without changing the open contract", () => {
    expect(topologyNodeCategory("Switch")).toBe("network");
    expect(topologyNodeLabel("Router")).toBe("路由器");
    expect(topologyNodeCategory("vendor-specific-accelerator")).toBe("unknown");
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
