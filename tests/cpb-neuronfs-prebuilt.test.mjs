import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const helperPath = path.join(repoRoot, "scripts", "cpb-neuronfs-prebuilt.sh");
const installPath = path.join(repoRoot, "scripts", "cpb-install-neuronfs.sh");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || `${command} failed`);
  return result;
}

function writeExecutable(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
  fs.chmodSync(filePath, 0o755);
}

function createFakeNeuronFsRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-neuronfs-repo-"));

  run("git", ["init", "--initial-branch=main"], { cwd: repoDir });
  run("git", ["config", "user.email", "cpb-test@example.com"], { cwd: repoDir });
  run("git", ["config", "user.name", "cpb-test"], { cwd: repoDir });

  fs.mkdirSync(path.join(repoDir, "runtime"), { recursive: true });
  fs.writeFileSync(
    path.join(repoDir, "runtime", "v4-hook.cjs"),
    [
      "const path = require('path');",
      "const CACHE_TTL_MS = 30000;   // re-scan brain every 30 seconds",
      "const BRAIN_PATH = '/tmp';",
      "const REGIONS = [];",
      "const PROMOTE_THRESHOLD = 1;",
      "const example = path.dirname(full).replace(BRAIN_PATH + path.sep, '').replace(/\\\\/g, '>');",
      "// ─── Brain Scanner ───",
      "function getRules() {",
      "    return '';",
      "}",
      "getRules();",
      "function inject(bodyStr) {",
      "    const rules = getRules();",
      "    if (!rules) return null;",
      "",
      "    try {",
      "    const j = JSON.parse(bodyStr);",
      "        return j;",
      "    } catch (_) {",
      "        return null;",
      "    }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(path.join(repoDir, "runtime", "main.go"), "package main\nfunc main(){}\n", "utf8");

  run("git", ["add", "."], { cwd: repoDir });
  run("git", ["commit", "-m", "init fake neuronfs"], { cwd: repoDir });

  return {
    repoDir,
    ref: run("git", ["rev-parse", "HEAD"], { cwd: repoDir }).stdout.trim(),
  };
}

test("cpb neuronfs prebuilt helper prints deterministic asset and download URLs", () => {
  const assetResult = run("/bin/bash", [
    helperPath,
    "asset-name",
    "970e0cd",
    "linux",
    "amd64",
  ]);
  assert.equal(assetResult.stdout.trim(), "neuronfs-970e0cd-linux-amd64.tar.gz");

  const urlResult = run("/bin/bash", [
    helperPath,
    "download-url",
    "970e0cd",
    "linux",
    "amd64",
    "https://example.invalid/releases/download/neuronfs-970e0cd",
  ]);
  assert.equal(
    urlResult.stdout.trim(),
    "https://example.invalid/releases/download/neuronfs-970e0cd/neuronfs-970e0cd-linux-amd64.tar.gz",
  );

  const checksumResult = run("/bin/bash", [
    helperPath,
    "checksum-url",
    "970e0cd",
    "linux",
    "amd64",
    "https://example.invalid/releases/download/neuronfs-970e0cd",
  ]);
  assert.equal(
    checksumResult.stdout.trim(),
    "https://example.invalid/releases/download/neuronfs-970e0cd/neuronfs-970e0cd-linux-amd64.tar.gz.sha256",
  );
});

test("cpb install-neuronfs downloads a prebuilt CLI when available", () => {
  const fakeRepo = createFakeNeuronFsRepo();
  const assetRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-neuronfs-assets-"));
  const archiveVersion = fakeRepo.ref;
  const assetName = `neuronfs-${archiveVersion}-linux-amd64.tar.gz`;
  const checksumName = `${assetName}.sha256`;
  const assetBinaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-neuronfs-binary-"));
  const installDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-neuronfs-install-"));

  writeExecutable(
    path.join(assetBinaryRoot, "neuronfs"),
    "#!/usr/bin/env bash\nprintf 'neuronfs prebuilt ok\\n'\n",
  );

  run("tar", ["-C", assetBinaryRoot, "-czf", path.join(assetRoot, assetName), "neuronfs"]);
  const archivePath = path.join(assetRoot, assetName);
  const checksum = run("sha256sum", [archivePath]).stdout.trim().split(/\s+/u)[0];
  fs.writeFileSync(path.join(assetRoot, checksumName), `${checksum}  ${assetName}\n`, "utf8");

  const result = spawnSync("/bin/bash", [installPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CPB_REPO_ROOT: repoRoot,
      CPB_NEURONFS_INSTALL_DIR: installDir,
      NEURONFS_INSTALL_DIR: installDir,
      NEURONFS_REPO_URL: fakeRepo.repoDir,
      NEURONFS_REPO_BRANCH: "main",
      NEURONFS_REPO_REF: fakeRepo.ref,
      NEURONFS_PREBUILT_VERSION: archiveVersion,
      NEURONFS_PREBUILT_BASE_URL: `file://${assetRoot}`,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Build:\s+cli prebuilt ok/u);
  assert.match(result.stdout, /Prebuilt:\s+file:\/\//u);
  assert.match(result.stdout, /Checksum:\s+verified via file:\/\//u);
  assert.ok(fs.existsSync(path.join(installDir, "neuronfs")));
});
