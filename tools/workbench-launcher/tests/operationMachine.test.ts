import { describe, expect, it } from "vitest";
import { appendBoundedLog, initialOperationState, isOperationActive, reduceOperation } from "../src/operationMachine";

describe("launcher operation state machine", () => {
  it("covers every active and terminal state category", () => {
    expect(isOperationActive("checking_environment")).toBe(true);
    expect(isOperationActive("publishing_release")).toBe(true);
    expect(isOperationActive("succeeded")).toBe(false);
    expect(isOperationActive("failed")).toBe(false);
    expect(isOperationActive("blocked")).toBe(false);
  });

  it("ignores stale sequences", () => {
    const current = {
      ...initialOperationState(),
      operationId: "new",
      sequence: 8,
      phase: "building_web" as const,
    };
    const next = reduceOperation(current, {
      operationId: "new",
      sequence: 7,
      phase: "fetching",
      message: "stale",
      elapsedMs: 10,
    });
    expect(next).toBe(current);
  });

  it("ignores events from another operation", () => {
    const current = { ...initialOperationState(), operationId: "current", sequence: 2 };
    const next = reduceOperation(current, {
      operationId: "old",
      sequence: 99,
      phase: "succeeded",
      message: "old result",
      elapsedMs: 99,
    });
    expect(next).toBe(current);
  });

  it("keeps only the bounded log tail and trims long lines", () => {
    let lines: string[] = [];
    for (let index = 0; index < 430; index += 1) lines = appendBoundedLog(lines, `line-${index}`);
    lines = appendBoundedLog(lines, `prefix-${"x".repeat(5000)}`);
    expect(lines).toHaveLength(400);
    expect(lines.at(-1)?.length).toBe(4000);
    expect(lines.join("\n")).not.toContain("line-0");
  });
});
