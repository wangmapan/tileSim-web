// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import {
  AGENT_SESSION_MAX_BYTES,
  AGENT_SESSION_MAX_COUNT,
  AGENT_SESSION_RETENTION_DAYS,
  useAgentSessionsStore,
} from "../../src/stores/agent-sessions";

describe("agent session persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActivePinia(createPinia());
  });

  it("creates independent sessions and restores the selected one from local storage", () => {
    const first = useAgentSessionsStore();
    const firstId = first.activeSessionId;
    first.blocks = [{ block_type: "user_message", block_id: "user:1", text: "分析这次运行" }];
    first.messages = [{ role: "user", content: "分析这次运行" }];
    first.titleFromFirstInstruction("分析这次运行");
    const secondId = first.createSession();
    first.blocks = [{ block_type: "user_message", block_id: "user:2", text: "创建实验" }];
    first.messages = [{ role: "user", content: "创建实验" }];
    first.titleFromFirstInstruction("创建实验");
    first.selectSession(firstId);

    expect(first.activeSessionId).toBe(firstId);
    expect(first.blocks).toHaveLength(1);
    expect(first.blocks[0]).toMatchObject({ text: "分析这次运行" });
    expect(first.summaries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstId, title: "分析这次运行", message_count: 1 }),
        expect.objectContaining({ id: secondId, title: "创建实验", message_count: 1 }),
      ]),
    );

    setActivePinia(createPinia());
    const restored = useAgentSessionsStore();
    expect(restored.activeSessionId).toBe(firstId);
    expect(restored.blocks[0]).toMatchObject({ text: "分析这次运行" });
    expect(restored.summaries()).toHaveLength(2);
  });

  it("keeps one usable session after deleting the last session", () => {
    const store = useAgentSessionsStore();
    const onlyId = store.activeSessionId;

    expect(store.deleteSession(onlyId)).toBe(true);
    expect(store.sessions).toHaveLength(1);
    expect(store.activeSessionId).not.toBe(onlyId);
    expect(store.blocks).toEqual([]);
  });

  it("does not restore a permanently streaming block after a hard reload", () => {
    const store = useAgentSessionsStore();
    store.blocks = [
      {
        block_type: "assistant_message",
        block_id: "assistant:streaming",
        text: "已经收到的正文",
        streaming: true,
        model_id: "test-model",
        error: "",
      },
    ];
    store.persist();

    setActivePinia(createPinia());
    const restored = useAgentSessionsStore();
    expect(restored.blocks[0]).toMatchObject({
      streaming: false,
      text: "已经收到的正文",
      error: "上次回答在页面关闭前未完成，可以重新提问。",
    });
  });

  it("exposes bounded local retention and removes expired sessions on restore", () => {
    const store = useAgentSessionsStore();
    const id = store.activeSessionId;
    store.messages = [{ role: "user", content: `api_key=secret-value ${"x".repeat(9000)}` }];
    store.persist();
    const raw = JSON.parse(window.localStorage.getItem("tilesim-web.agent-sessions.v1") || "{}");
    expect(raw.sessions[0].messages[0].content.length).toBeLessThanOrEqual(2000);
    expect(raw.sessions[0].messages[0].content).not.toContain("secret-value");
    expect(raw.sessions[0].expires_at).toBeTruthy();
    expect(store.retentionNotice).toContain(`${AGENT_SESSION_RETENTION_DAYS} 天`);
    expect(AGENT_SESSION_MAX_COUNT).toBeGreaterThan(1);
    expect(AGENT_SESSION_MAX_BYTES).toBeGreaterThan(0);

    raw.sessions[0].expires_at = new Date(Date.now() - 1).toISOString();
    window.localStorage.setItem("tilesim-web.agent-sessions.v1", JSON.stringify(raw));
    setActivePinia(createPinia());
    const restored = useAgentSessionsStore();
    expect(restored.activeSessionId).not.toBe(id);
    expect(restored.blocks).toEqual([]);
    expect(window.localStorage.getItem("tilesim-web.agent-sessions.v1")).toBeNull();
  });

  it("clears all locally cached sessions while leaving an empty usable session", () => {
    const store = useAgentSessionsStore();
    store.messages = [{ role: "user", content: "不要长期保留" }];
    store.persist();
    store.createSession("第二个");
    store.clearAllSessions();
    expect(store.sessions).toHaveLength(1);
    expect(store.messages).toEqual([]);
    expect(store.blocks).toEqual([]);
    expect(store.summaries()[0].message_count).toBe(0);
  });

  it("bounds session count and serialized cache size", () => {
    const store = useAgentSessionsStore();
    const message = { role: "user" as const, content: "可见消息".repeat(500) };
    for (let index = 0; index < 12; index += 1) {
      store.messages = Array.from({ length: 24 }, () => message);
      store.createSession(`session-${index}`);
    }
    store.persist();
    const serialized = window.localStorage.getItem("tilesim-web.agent-sessions.v1") || "";
    expect(store.sessions.length).toBeLessThanOrEqual(AGENT_SESSION_MAX_COUNT);
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(AGENT_SESSION_MAX_BYTES);
  });

  it("also bounds a single oversized session instead of exempting the active record", () => {
    const store = useAgentSessionsStore();
    store.messages = Array.from({ length: 24 }, () => ({ role: "user" as const, content: "消息".repeat(1_000) }));
    store.blocks = Array.from({ length: 80 }, (_, index) => ({
      block_type: "assistant_message" as const,
      block_id: `assistant:${index}`,
      text: "回答".repeat(1_000),
      streaming: false,
      model_id: "model",
      error: "",
    }));
    store.persist();

    const serialized = window.localStorage.getItem("tilesim-web.agent-sessions.v1") || "";
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(AGENT_SESSION_MAX_BYTES);
    expect(store.blocks).toHaveLength(80);
    expect(store.messages).toHaveLength(24);
  });
});
