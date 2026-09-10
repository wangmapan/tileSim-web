import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const windowsOnly = process.platform === "win32" ? describe : describe.skip;
const temporaryDirectories = [];
const scriptsRoot = resolve("scripts");
const configureScript = join(scriptsRoot, "configure-evidence-agent.ps1");
const startScript = join(scriptsRoot, "start-evidence-agent.ps1");

function runPowerShell(script, args, input) {
  return spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, ...args],
    { cwd: resolve("."), encoding: "utf8", input },
  );
}

function parseLastJsonLine(output) {
  const line = output
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1);
  return JSON.parse(line);
}

afterEach(() => {
  while (temporaryDirectories.length) {
    rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

windowsOnly("desktop launcher model settings", () => {
  it("stores the API key with DPAPI and supports safe settings updates", () => {
    const directory = mkdtempSync(join(tmpdir(), "tilesim-launcher-"));
    temporaryDirectories.push(directory);
    const configPath = join(directory, "evidence-agent.local.json");
    const testKey = "launcher-test-secret-never-persist";

    const create = runPowerShell(
      configureScript,
      [
        "-Action",
        "Set",
        "-ConfigPath",
        configPath,
        "-BaseUrl",
        "https://provider.example.invalid/v1",
        "-Model",
        "gpt-launcher-test",
        "-TimeoutMs",
        "60000",
        "-ApiKeyFromStdin",
      ],
      `${testKey}\n`,
    );
    expect(create.status, create.stdout + create.stderr).toBe(0);

    const initialText = readFileSync(configPath, "utf8");
    const initial = JSON.parse(initialText);
    expect(initial.schema_version).toBe("tilesim.evidence_agent_local_config.v1");
    expect(initial.base_url).toBe("https://provider.example.invalid/v1");
    expect(initial.model).toBe("gpt-launcher-test");
    expect(initial.timeout_ms).toBe(60_000);
    expect(initial.api_key_protection).toBe("windows_dpapi_current_user");
    expect(initial.api_key_dpapi).toBeTruthy();
    expect(initialText).not.toContain(testKey);

    const update = runPowerShell(configureScript, [
      "-Action",
      "Set",
      "-ConfigPath",
      configPath,
      "-BaseUrl",
      "https://provider.example.invalid",
      "-Model",
      "gpt-launcher-test",
      "-TimeoutMs",
      "30000",
      "-KeepExistingKey",
    ]);
    expect(update.status, update.stdout + update.stderr).toBe(0);
    const updated = JSON.parse(readFileSync(configPath, "utf8"));
    expect(updated.api_key_dpapi).toBe(initial.api_key_dpapi);
    expect(updated.timeout_ms).toBe(30_000);

    const validate = runPowerShell(startScript, ["-ConfigPath", configPath, "-ValidateConfigOnly"]);
    expect(validate.status, validate.stdout + validate.stderr).toBe(0);
    expect(parseLastJsonLine(validate.stdout)).toMatchObject({
      configured: true,
      provider: "tilesim_newapi_openai_v1",
      model: "gpt-launcher-test",
      api_key_status: "stored_with_windows_dpapi",
    });
  });

  it("rejects non-loopback plaintext HTTP model endpoints", () => {
    const directory = mkdtempSync(join(tmpdir(), "tilesim-launcher-"));
    temporaryDirectories.push(directory);
    const configPath = join(directory, "evidence-agent.local.json");
    const result = runPowerShell(
      configureScript,
      [
        "-ConfigPath",
        configPath,
        "-BaseUrl",
        "http://provider.example.invalid/v1",
        "-Model",
        "gpt-launcher-test",
        "-TimeoutMs",
        "30000",
        "-ApiKeyFromStdin",
      ],
      "not-a-real-key\n",
    );
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("loopback");
  });

  it("can replace an invalid local config when a new key is supplied", () => {
    const directory = mkdtempSync(join(tmpdir(), "tilesim-launcher-"));
    temporaryDirectories.push(directory);
    const configPath = join(directory, "evidence-agent.local.json");
    writeFileSync(configPath, '{"TILESIM_EVIDENCE_AGENT_API_KEY":"legacy-plaintext"}\n');

    const result = runPowerShell(
      configureScript,
      [
        "-ConfigPath",
        configPath,
        "-BaseUrl",
        "https://provider.example.invalid/v1",
        "-Model",
        "gpt-launcher-test",
        "-TimeoutMs",
        "30000",
        "-ApiKeyFromStdin",
      ],
      "replacement-secret\n",
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const text = readFileSync(configPath, "utf8");
    expect(text).not.toContain("legacy-plaintext");
    expect(text).not.toContain("replacement-secret");
    expect(JSON.parse(text).api_key_dpapi).toBeTruthy();
  });
});
