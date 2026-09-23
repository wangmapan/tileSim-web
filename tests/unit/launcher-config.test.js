import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const windowsOnly = process.platform === "win32" ? describe : describe.skip;
const temporaryDirectories = [];
const fakeGateways = [];
const scriptsRoot = resolve("scripts");
const configureScript = join(scriptsRoot, "configure-evidence-agent.ps1");
const startScript = join(scriptsRoot, "start-evidence-agent.ps1");

const powershellArguments = (script, args) => [
  "-NoLogo",
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  script,
  ...args,
];

function runPowerShell(script, args, input) {
  return spawnSync("powershell.exe", powershellArguments(script, args), {
    cwd: resolve("."),
    encoding: "utf8",
    input,
  });
}

/**
 * Same call, without blocking the event loop.
 *
 * A synchronous child would freeze the very process that is serving `startFakeGateway`,
 * so the gateway could never answer and every request would look like a timeout. Any
 * test that talks to a fake service started here has to use this variant.
 */
function runPowerShellAsync(script, args, input) {
  return new Promise((settle) => {
    const child = spawn("powershell.exe", powershellArguments(script, args), {
      cwd: resolve("."),
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      settle({ status: 1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (code) => {
      settle({ status: code ?? 1, stdout, stderr });
    });
    if (input !== undefined) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

function parseLastJsonLine(output) {
  const line = output
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1);
  return JSON.parse(line);
}

/**
 * Stand in for an OpenAI-compatible gateway. The model catalogue is read over real
 * HTTP so the PowerShell path under test is exercised end to end, including the
 * Bearer header it has to build from the DPAPI-protected key.
 */
function startFakeGateway(respond) {
  return new Promise((ready) => {
    const server = createServer(respond);
    fakeGateways.push(server);
    server.listen(0, "127.0.0.1", () => {
      ready(`http://127.0.0.1:${server.address().port}/v1`);
    });
  });
}

afterEach(async () => {
  await Promise.all(
    fakeGateways.splice(0).map(
      (server) =>
        new Promise((closed) => {
          server.closeAllConnections?.();
          server.close(closed);
        }),
    ),
  );
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

windowsOnly("desktop launcher model catalogue", () => {
  it("offers the model identities the service reports", async () => {
    const directory = mkdtempSync(join(tmpdir(), "tilesim-launcher-"));
    temporaryDirectories.push(directory);
    const configPath = join(directory, "evidence-agent.local.json");
    const gatewayKey = "launcher-model-list-secret";
    const seen = [];
    const baseUrl = await startFakeGateway((request, response) => {
      seen.push(`${request.method} ${request.url} auth=${JSON.stringify(request.headers.authorization ?? null)}`);
      if (request.url !== "/v1/models" || request.headers.authorization !== `Bearer ${gatewayKey}`) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: "unauthorized" } }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ object: "list", data: [{ id: "fake-model-a" }, { id: "fake-model-b" }] }));
    });

    const saved = await runPowerShellAsync(
      configureScript,
      [
        "-Action",
        "Set",
        "-ConfigPath",
        configPath,
        "-BaseUrl",
        baseUrl,
        "-Model",
        "fake-model-a",
        "-TimeoutMs",
        "30000",
        "-ApiKeyFromStdin",
      ],
      `${gatewayKey}\n`,
    );
    expect(saved.status, saved.stdout + saved.stderr).toBe(0);

    // Nothing on stdin: the catalogue request has to reuse the saved DPAPI key, which
    // is what makes the dropdown work without retyping the key every time.
    const listed = await runPowerShellAsync(configureScript, [
      "-Action",
      "ListModels",
      "-ConfigPath",
      configPath,
      "-KeepExistingKey",
    ]);
    expect(listed.status, listed.stdout + listed.stderr).toBe(0);
    expect(parseLastJsonLine(listed.stdout), `gateway saw: ${seen.join(" | ")}`).toMatchObject({
      schema_version: "tilesim.evidence_agent_model_list.v1",
      ok: true,
      count: 2,
      models: ["fake-model-a", "fake-model-b"],
      error: "",
    });
  }, 120_000);

  it("reports a rejected catalogue request without failing the launcher", async () => {
    const directory = mkdtempSync(join(tmpdir(), "tilesim-launcher-"));
    temporaryDirectories.push(directory);
    const configPath = join(directory, "evidence-agent.local.json");
    const baseUrl = await startFakeGateway((_request, response) => {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "unauthorized" } }));
    });

    const listed = await runPowerShellAsync(
      configureScript,
      ["-Action", "ListModels", "-ConfigPath", configPath, "-BaseUrl", baseUrl, "-ApiKeyFromStdin"],
      "definitely-not-the-key\n",
    );
    // A read-only catalogue failure is an in-body verdict, not a crashed script, so the
    // launcher can show the reason and leave the form usable.
    expect(listed.status, listed.stdout + listed.stderr).toBe(0);
    const payload = parseLastJsonLine(listed.stdout);
    expect(payload.ok).toBe(false);
    expect(payload.count).toBe(0);
    expect(payload.error).toBeTruthy();
  }, 120_000);
});
