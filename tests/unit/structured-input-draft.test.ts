// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  readExperimentInputDraft,
  saveExperimentInputDraft,
} from "../../src/features/run-experiment/input-draft-session";

describe("schema-bound structured input drafts", () => {
  beforeEach(() => sessionStorage.clear());

  it("does not read a draft under a different schema revision", () => {
    saveExperimentInputDraft("schema-a", {
      mode: "controls",
      runtimeJson: '{"trace":"a"}',
      topologyJson: '{"topology":"a"}',
    });

    expect(readExperimentInputDraft("schema-a")).toEqual({
      mode: "controls",
      runtimeJson: '{"trace":"a"}',
      topologyJson: '{"topology":"a"}',
    });
    expect(readExperimentInputDraft("schema-b")).toBeNull();
  });

  it("rejects malformed and oversized session values without throwing", () => {
    sessionStorage.setItem("tilesim.experiment.input-draft.v2", "not-json");
    expect(() => readExperimentInputDraft("schema-a")).not.toThrow();
    expect(readExperimentInputDraft("schema-a")).toBeNull();

    sessionStorage.setItem(
      "tilesim.experiment.input-draft.v2",
      JSON.stringify({ revision: "schema-a", mode: "controls", runtimeJson: "x".repeat(2_200_001), topologyJson: "" }),
    );
    expect(readExperimentInputDraft("schema-a")).toBeNull();
  });

  it("uses the structured editor as the v2 default while accepting old save callers", () => {
    saveExperimentInputDraft("schema-a", {
      mode: "json",
      runtimeJson: "{}",
      topologyJson: "{}",
    });
    expect(readExperimentInputDraft("schema-a")?.mode).toBe("json");
  });
});
