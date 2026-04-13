import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function makeGitRepo(prefix) {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const init = spawnSync("git", ["init", "-b", "main"], { cwd: repoPath, encoding: "utf8" });
  if (init.status !== 0) {
    spawnSync("git", ["init"], { cwd: repoPath, encoding: "utf8" });
    spawnSync("git", ["checkout", "-b", "main"], { cwd: repoPath, encoding: "utf8" });
  }
  spawnSync("git", ["config", "user.email", "cpb-test@example.com"], { cwd: repoPath, encoding: "utf8" });
  spawnSync("git", ["config", "user.name", "cpb-test"], { cwd: repoPath, encoding: "utf8" });
  spawnSync("git", ["config", "github.user", "cpb-test"], { cwd: repoPath, encoding: "utf8" });
  return repoPath;
}

function copyFrameworkFixture() {
  const frameworkRepo = makeGitRepo("cpb-framework-fixture-");
  fs.cpSync(repoRoot, frameworkRepo, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}.git`),
  });
  spawnSync("git", ["add", "."], { cwd: frameworkRepo, encoding: "utf8" });
  spawnSync("git", ["commit", "-m", "initial framework"], { cwd: frameworkRepo, encoding: "utf8" });
  const initialSha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: frameworkRepo, encoding: "utf8" }).stdout.trim();
  return { frameworkRepo, initialSha };
}

function makeTargetRepo(prefix) {
  return makeGitRepo(prefix);
}

function runInstall(frameworkRepo, targetRepo, homeDir, extraArgs = []) {
  const result = spawnSync(
    "bash",
    [
      path.join(frameworkRepo, "scripts", "cpb-install.sh"),
      "--target",
      targetRepo,
      "--no-neuronfs",
      "--no-autogrowth",
      "--force",
      "--no-shell",
      ...extraArgs,
    ],
    {
      cwd: frameworkRepo,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: homeDir,
        NODE_OPTIONS: "",
        CPB_FRAMEWORK_REPO_URL: frameworkRepo,
        CPB_FRAMEWORK_REPO_REF: "main",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("cpb install writes framework lock metadata", () => {
  const targetRepo = makeTargetRepo("cpb-framework-lock-target-");
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-framework-lock-home-"));

  const result = spawnSync(
    "bash",
    [
      path.join(repoRoot, "scripts", "cpb-install.sh"),
      "--target",
      targetRepo,
      "--no-neuronfs",
      "--no-autogrowth",
      "--force",
      "--no-shell",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: homeDir,
        NODE_OPTIONS: "",
      },
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const lockPath = path.join(targetRepo, "config", "cpdb", "framework.lock.json");
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  assert.equal(lock.version, 1);
  assert.match(lock.frameworkRepoUrl, /cross-project-brain|github\.com/u);
  assert.equal(lock.updateRef.length > 0, true);
  assert.equal(lock.installedCommit.length, 40);
  assert.equal(lock.installOptions.setupShell, false);
  assert.equal(lock.installOptions.installNeuronfs, false);
  assert.equal(lock.installOptions.startAutogrowth, false);
});

test("cpb update checker warns and upgrade-framework refreshes installed files", () => {
  const { frameworkRepo, initialSha } = copyFrameworkFixture();
  const targetRepo = makeTargetRepo("cpb-framework-upgrade-target-");
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-framework-upgrade-home-"));

  runInstall(frameworkRepo, targetRepo, homeDir);

  const oldShimPath = path.join(homeDir, ".local", "bin", "codex");
  fs.mkdirSync(path.dirname(oldShimPath), { recursive: true });
  fs.writeFileSync(
    oldShimPath,
    `#!/usr/bin/env bash\nexec "${targetRepo}/scripts/cpb-agent-wrapper.sh" "codex" "$@"\n`,
    "utf8",
  );
  fs.chmodSync(oldShimPath, 0o755);

  const upgradedMarker = "# upgraded framework fixture\n";
  fs.appendFileSync(path.join(frameworkRepo, "bin", "cpb"), upgradedMarker, "utf8");
  spawnSync("git", ["add", "bin/cpb"], { cwd: frameworkRepo, encoding: "utf8" });
  spawnSync("git", ["commit", "-m", "upgrade framework"], { cwd: frameworkRepo, encoding: "utf8" });
  const updatedSha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: frameworkRepo, encoding: "utf8" }).stdout.trim();

  const checkResult = spawnSync(
    "node",
    [path.join(targetRepo, "scripts", "cpb-check-updates.mjs"), "--repo-root", targetRepo, "--force"],
    {
      cwd: targetRepo,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: homeDir,
        CPB_UPDATE_CHECK_TTL_SECONDS: "0",
        CPB_UPDATE_NOTICE_INTERVAL_SECONDS: "0",
      },
    },
  );
  assert.equal(checkResult.status, 0, checkResult.stderr || checkResult.stdout);
  assert.match(checkResult.stderr, new RegExp(initialSha.slice(0, 7), "u"));
  assert.match(checkResult.stderr, new RegExp(updatedSha.slice(0, 7), "u"));
  assert.match(checkResult.stderr, /upgrade-framework/u);

  const upgradeResult = spawnSync(
    "bash",
    [path.join(targetRepo, "scripts", "cpb-upgrade-framework.sh"), "--repo-root", targetRepo],
    {
      cwd: targetRepo,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: homeDir,
        NODE_OPTIONS: "",
      },
    },
  );
  assert.equal(upgradeResult.status, 0, upgradeResult.stderr || upgradeResult.stdout);

  const lockPath = path.join(targetRepo, "config", "cpdb", "framework.lock.json");
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  assert.equal(lock.installedCommit, updatedSha);

  const installedBin = fs.readFileSync(path.join(targetRepo, "bin", "cpb"), "utf8");
  assert.match(installedBin, /upgraded framework fixture/u);

  const refreshedShim = fs.readFileSync(oldShimPath, "utf8");
  assert.match(refreshedShim, /cpb-global-agent-wrapper\.sh/u);
});
