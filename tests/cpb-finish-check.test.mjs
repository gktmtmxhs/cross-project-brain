import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scriptPath = path.join(repoRoot, "scripts", "cpb-finish-check.mjs");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || `${command} failed`);
}

function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-finish-check-"));
  run("git", ["init"], root);
  run("git", ["config", "user.email", "cpb-test@example.com"], root);
  run("git", ["config", "user.name", "cpb-test"], root);
  fs.writeFileSync(path.join(root, "README.md"), "# temp\n", "utf8");
  run("git", ["add", "README.md"], root);
  run("git", ["commit", "-m", "init"], root);
  return root;
}

function runFinishCheck(repo, args = []) {
  return spawnSync("node", [scriptPath, ...args], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      CPB_REPO_ROOT: repo,
      CPB_AGENT_ROOT: path.join(repo, ".agent", "cross-project-brain", "tmp-project"),
    },
  });
}

test("cpb finish check blocks shared career changes without explicit publish approval", () => {
  const repo = makeTempRepo();

  const reset = runFinishCheck(repo, ["--reset-baseline"]);
  assert.equal(reset.status, 0, reset.stderr || reset.stdout);

  const sharedPath = path.join(repo, "docs", "career", "shared", "ko");
  fs.mkdirSync(sharedPath, { recursive: true });
  fs.writeFileSync(path.join(sharedPath, "project-overview.md"), "# shared draft\n", "utf8");

  const blocked = runFinishCheck(repo);
  assert.equal(blocked.status, 3);
  assert.match(blocked.stderr, /shared career docs changed without explicit publish approval/u);
});

test("cpb finish check allows shared career changes when explicit publish approval is provided", () => {
  const repo = makeTempRepo();

  const reset = runFinishCheck(repo, ["--reset-baseline"]);
  assert.equal(reset.status, 0, reset.stderr || reset.stdout);

  const sharedPath = path.join(repo, "docs", "career", "shared", "ko");
  fs.mkdirSync(sharedPath, { recursive: true });
  fs.writeFileSync(path.join(sharedPath, "project-overview.md"), "# shared draft\n", "utf8");

  const allowed = runFinishCheck(repo, [
    "--allow-shared-career-publish",
    "user explicitly requested shared publish",
  ]);
  assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);
  assert.match(allowed.stdout, /shared career publish acknowledged/u);
});
