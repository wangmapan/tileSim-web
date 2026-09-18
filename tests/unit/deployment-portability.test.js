import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const windowsOnly = process.platform === "win32" ? describe : describe.skip;
const portableFiles = [
  ...readdirSync(resolve("scripts"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:ps1|psm1)$/u.test(entry.name))
    .map((entry) => `scripts/${entry.name}`),
  "tools/launcher/build-launcher.ps1",
  "tools/launcher/tilesim_launcher.py",
];

windowsOnly("deployment portability", () => {
  it("keeps deployment sources free of machine-specific user paths", () => {
    for (const file of portableFiles) {
      const source = readFileSync(resolve(file), "utf8");
      expect(source, file).not.toMatch(/C:\\Users\\mapanwang|D:\\tileSim(?:-web|-backend|-team)?|\/home\/mapanwang/u);
    }
  });

  it("parses every PowerShell deployment entry point", () => {
    for (const file of portableFiles.filter((item) => item.endsWith(".ps1") || item.endsWith(".psm1"))) {
      const result = spawnSync(
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `$errors=$null; [System.Management.Automation.Language.Parser]::ParseFile('${resolve(file).replaceAll("'", "''")}', [ref]$null, [ref]$errors) | Out-Null; if ($errors.Count) { $errors | ForEach-Object { Write-Error $_ }; exit 1 }`,
        ],
        { encoding: "utf8" },
      );
      expect(result.status, `${file}\n${result.stdout}\n${result.stderr}`).toBe(0);
    }
  });

  it("preserves repository line endings in backend deployment worktrees", () => {
    const source = readFileSync(resolve("scripts/update-backend.ps1"), "utf8");
    const checkoutCommands = source.match(/core\.autocrlf=false/g) ?? [];

    expect(checkoutCommands).toHaveLength(3);
    expect(source).toMatch(/core\.autocrlf=false[^\r\n]+worktree[^\r\n]+add/);
    expect(source).toMatch(/core\.autocrlf=false[^\r\n]+switch[^\r\n]+targetRevision/);
    expect(source).toMatch(/core\.autocrlf=false[^\r\n]+switch[^\r\n]+previousManifest\.source_revision/);
  });

  it("derives repository defaults from the Web checkout", () => {
    const modulePath = resolve("scripts/deployment-common.psm1").replaceAll("'", "''");
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Import-Module '${modulePath}' -Force; $web='D:\\work\\tileSim-web'; [ordered]@{ repository=Resolve-TileSimBackendRepositoryRoot $web; deployment=Resolve-TileSimBackendDeploymentRoot $web } | ConvertTo-Json -Compress`,
      ],
      { encoding: "utf8" },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toEqual({
      repository: "D:\\work\\tileSim",
      deployment: "D:\\work\\tileSim-backend",
    });
  });

  it("isolates WSL build caches by deployment source path", () => {
    const modulePath = resolve("scripts/deployment-common.psm1").replaceAll("'", "''");
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Import-Module '${modulePath}' -Force; @(
          (Get-TileSimPathIdentity 'D:\\workspace\\tileSim-backend'),
          (Get-TileSimPathIdentity 'd:\\WORKSPACE\\tileSim-backend\\'),
          (Get-TileSimPathIdentity 'E:\\workspace\\tileSim-backend')
        ) | ConvertTo-Json -Compress`,
      ],
      { encoding: "utf8" },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const identities = JSON.parse(result.stdout.trim());
    expect(identities[0]).toMatch(/^[0-9a-f]{12}$/u);
    expect(identities[0]).toBe(identities[1]);
    expect(identities[0]).not.toBe(identities[2]);
  });

  it("accepts an explicit launcher-provided Node runtime without relying on PATH", () => {
    const modulePath = resolve("scripts/deployment-common.psm1").replaceAll("'", "''");
    const powershell = join(
      process.env.SystemRoot ?? "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const result = spawnSync(
      powershell,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Import-Module '${modulePath}' -Force; Resolve-TileSimNode`,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: join(process.env.SystemRoot ?? "C:\\Windows", "System32"),
          TILESIM_NODE: process.execPath,
        },
      },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.trim().toLowerCase()).toBe(process.execPath.toLowerCase());
  });

  it("fails before deployment when a catalog evidence revision is unavailable", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "tilesim-deployment-evidence-"));
    const backendRoot = join(fixtureRoot, "backend");
    const catalogPath = join(fixtureRoot, "catalog.json");
    try {
      expect(spawnSync("git", ["init", "--quiet", backendRoot]).status).toBe(0);
      writeFileSync(
        catalogPath,
        JSON.stringify({ parameter_descriptors: [{ execution_evidence: [{ revision: "f".repeat(40) }] }] }),
        "utf8",
      );
      const modulePath = resolve("scripts/deployment-common.psm1").replaceAll("'", "''");
      const result = spawnSync(
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Import-Module '${modulePath}' -Force; Assert-TileSimBackendEvidenceRevisions -BackendRepositoryRoot '${backendRoot.replaceAll("'", "''")}' -CatalogPath '${catalogPath.replaceAll("'", "''")}' -GitCommand (Get-Command git).Source`,
        ],
        { encoding: "utf8" },
      );
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("cannot resolve published execution-evidence revision");
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
