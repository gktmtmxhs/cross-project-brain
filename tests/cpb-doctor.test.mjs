import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scriptPath = path.join(repoRoot, "scripts", "cpb-doctor.sh");

function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || `${command} failed`);
  return result;
}

function makeTempRepo(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  run("git", ["init"], root);
  run("git", ["config", "user.email", "cpb-test@example.com"], root);
  run("git", ["config", "user.name", "cpb-test"], root);
  run("git", ["config", "github.user", "cpb-test"], root);
  fs.writeFileSync(path.join(root, "README.md"), "# temp\n", "utf8");
  run("git", ["add", "README.md"], root);
  run("git", ["commit", "-m", "init"], root);
  return root;
}

function writeExecutable(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
  fs.chmodSync(filePath, 0o755);
}

test("cpb doctor reports a ready desktop and laptop sync setup", () => {
  const projectRepo = makeTempRepo("cpb-doctor-ready-");
  const projectId = path.basename(projectRepo);
  const personalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-doctor-personal-"));
  const personalRemote = path.join(os.tmpdir(), `cpb-doctor-personal-remote-${Date.now()}.git`);
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-doctor-fake-gh-"));
  const agentRoot = path.join(projectRepo, ".agent", "cross-project-brain", projectId);
  const localProjectBrain = path.join(agentRoot, "project-brain", "brain_v4");

  run("git", ["init", "--bare", personalRemote], projectRepo);

  run("git", ["init"], personalRoot);
  run("git", ["config", "user.email", "cpb-personal@example.com"], personalRoot);
  run("git", ["config", "user.name", "cpb-personal"], personalRoot);
  fs.writeFileSync(path.join(personalRoot, "README.md"), "# personal\n", "utf8");
  run("git", ["add", "README.md"], personalRoot);
  run("git", ["commit", "-m", "init"], personalRoot);
  run("git", ["branch", "-M", "main"], personalRoot);
  run("git", ["remote", "add", "origin", personalRemote], personalRoot);
  run("git", ["push", "-u", "origin", "main"], personalRoot);

  fs.mkdirSync(path.join(projectRepo, "brains", "team-brain", "brain_v4"), { recursive: true });
  fs.mkdirSync(path.join(personalRoot, "brains", "global-operators", "cpb-test", "brain_v4"), {
    recursive: true,
  });
  fs.mkdirSync(localProjectBrain, { recursive: true });
  fs.mkdirSync(path.join(agentRoot, "device-brain", "brain_v4"), { recursive: true });
  fs.mkdirSync(path.join(agentRoot, "runtime-brain", "brain_v4"), { recursive: true });
  fs.mkdirSync(path.join(personalRoot, "docs", "career", "operators", "cpb-test"), { recursive: true });

  const hooksDir = path.join(projectRepo, ".githooks");
  for (const hookName of ["post-merge", "post-checkout", "post-rewrite", "pre-push"]) {
    writeExecutable(path.join(hooksDir, hookName), "#!/usr/bin/env bash\nexit 0\n");
  }
  run("git", ["config", "core.hooksPath", hooksDir], projectRepo);

  writeExecutable(path.join(projectRepo, ".tools", "neuronfs", "neuronfs"), "#!/usr/bin/env bash\nexit 0\n");
  fs.mkdirSync(path.join(agentRoot, "logs"), { recursive: true });
  fs.writeFileSync(
    path.join(agentRoot, "logs", "git-hook-refresh.log"),
    "[2026-04-03T12:00:00+09:00] runtime refresh completed\n",
    "utf8",
  );

  writeExecutable(
    path.join(fakeBin, "gh"),
    [
      "#!/usr/bin/env bash",
      'if [[ "$1" == "auth" && "$2" == "status" ]]; then exit 0; fi',
      'if [[ "$1" == "api" && "$2" == "user" ]]; then printf "cpb-gh\\n"; exit 0; fi',
      "exit 1",
      "",
    ].join("\n"),
  );

  const result = spawnSync("bash", [scriptPath], {
    cwd: projectRepo,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      CPB_REPO_ROOT: projectRepo,
      CPB_PERSONAL_REPO: personalRoot,
      CPB_PROJECT_BRAIN: localProjectBrain,
      CPB_AGENT_ROOT: agentRoot,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Cross-Project Brain doctor/u);
  assert.match(result.stdout, /\[ok\] gh auth: authenticated as cpb-gh/u);
  assert.match(result.stdout, /\[ok\] personal repo upstream: origin\/main/u);
  assert.match(result.stdout, /\[info\] project brain mode: local-only/u);
  assert.match(result.stdout, /\[ok\] overall: ready/u);
});

test("cpb doctor reports warnings when personal sync and hooks are not configured", () => {
  const projectRepo = makeTempRepo("cpb-doctor-warn-");

  const result = spawnSync("bash", [scriptPath], {
    cwd: projectRepo,
    encoding: "utf8",
    env: {
      ...process.env,
      CPB_REPO_ROOT: projectRepo,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[warn\] personal repo:/u);
  assert.match(result.stdout, /\[warn\] hooks path:/u);
  assert.match(result.stdout, /\[warn\] overall:/u);
});
