import { describe, expect, it } from "vitest";
import { isUnsupportedExecutionRequest } from "../../src/features/agent-intent-compiler";

describe("unsupported execution intent", () => {
  it.each(["创建运行", "启动运行", "执行实验", "create a run", "start the run", "run it"])(
    "recognizes explicit execution request: %s",
    (instruction) => {
      expect(isUnsupportedExecutionRequest(instruction)).toBe(true);
    },
  );

  it.each(["配置一个低延迟实验草案", "解释当前页面", "分析这次运行结果", "运行时延迟设为 10 us"])(
    "does not classify a non-execution request as execution: %s",
    (instruction) => {
      expect(isUnsupportedExecutionRequest(instruction)).toBe(false);
    },
  );
});
