import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scriptPath = path.join(repoRoot, "scripts", "cpb-setup-personal-repo.sh");

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

function writeFakeGh(binDir) {
  const ghPath = path.join(binDir, "gh");
  fs.writeFileSync(
    ghPath,
    `#!/usr/bin/env bash
set -euo pipefail

if [[ "\${1:-}" == "auth" && "\${2:-}" == "status" ]]; then
  exit 0
fi

if [[ "\${1:-}" == "repo" && "\${2:-}" == "view" ]]; then
  if [[ "\${GH_FAKE_MODE:-existing}" == "existing" || -f "\${GH_FAKE_STATE_FILE:-/nonexistent}" ]]; then
    printf '{"nameWithOwner":"%s","visibility":"PRIVATE","sshUrl":"%s","url":"%s"}' "\${3:-}" "\${GH_FAKE_REMOTE_PATH:-}" "\${GH_FAKE_REMOTE_PATH:-}"
    exit 0
  fi
  exit 1
fi

if [[ "\${1:-}" == "repo" && "\${2:-}" == "create" ]]; then
  git init --bare "\${GH_FAKE_REMOTE_PATH:-}" >/dev/null 2>&1
  if [[ -n "\${GH_FAKE_STATE_FILE:-}" ]]; then
    mkdir -p "$(dirname "\${GH_FAKE_STATE_FILE}")"
    : > "\${GH_FAKE_STATE_FILE}"
  fi
  exit 0
fi

echo "unsupported gh invocation: $*" >&2
exit 1
`,
    { mode: 0o755 },
  );
}

function createProjectRepo(rootDir, operator) {
  const projectRoot = path.join(rootDir, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  run("git", ["init"], projectRoot);
  run("git", ["config", "user.email", `${operator}@example.com`], projectRoot);
  run("git", ["config", "user.name", operator], projectRoot);
  return projectRoot;
}

test("cpb setup clones an existing personal repo for returning users", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-setup-returning-"));
  const homeDir = path.join(root, "home");
  const binDir = path.join(root, "bin");
  const bareRemote = path.join(root, "personal-remote.git");
  const personalRepo = path.join(root, "personal-repo");
  const operator = "returner";

  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });
  writeFakeGh(binDir);
  run("git", ["init", "--bare", bareRemote], root);

  const projectRoot = createProjectRepo(root, operator);

  const setup = spawnSync(
    "bash",
    [scriptPath, personalRepo, "--repo-root", projectRoot, "--project-brain-mode", "personal"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH}`,
        CPB_OPERATOR: operator,
        GH_FAKE_MODE: "existing",
        GH_FAKE_REMOTE_PATH: bareRemote,
      },
    },
  );

  assert.equal(setup.status, 0, setup.stderr || setup.stdout);
  assert.match(setup.stdout, /Bootstrap mode:\s+returning-user/u);
  assert.ok(fs.existsSync(path.join(personalRepo, ".git")));
  assert.equal(run("git", ["remote", "get-url", "origin"], personalRepo).stdout.trim(), bareRemote);
  assert.ok(fs.existsSync(path.join(personalRepo, "brains", "global-operators", operator, "brain_v4")));
  assert.match(
    fs.readFileSync(path.join(homeDir, ".bashrc"), "utf8"),
    new RegExp(`export CPB_PERSONAL_REPO=${personalRepo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  );
});

test("cpb setup creates and connects a personal repo for first-time users", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-setup-first-"));
  const homeDir = path.join(root, "home");
  const binDir = path.join(root, "bin");
  const bareRemote = path.join(root, "personal-remote.git");
  const personalRepo = path.join(root, "personal-repo");
  const stateFile = path.join(root, "gh-state", "created");
  const operator = "firsttimer";

  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });
  writeFakeGh(binDir);

  const projectRoot = createProjectRepo(root, operator);

  const setup = spawnSync(
    "bash",
    [scriptPath, personalRepo, "--repo-root", projectRoot, "--project-brain-mode", "personal"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH}`,
        CPB_OPERATOR: operator,
        CPB_CREATE_PERSONAL_REMOTE: "always",
        GH_FAKE_MODE: "missing",
        GH_FAKE_REMOTE_PATH: bareRemote,
        GH_FAKE_STATE_FILE: stateFile,
      },
    },
  );

  assert.equal(setup.status, 0, setup.stderr || setup.stdout);
  assert.match(setup.stdout, /Bootstrap mode:\s+first-user/u);
  assert.match(setup.stdout, new RegExp(`created: ${operator}/cpb-personal`, "u"));
  assert.ok(fs.existsSync(path.join(personalRepo, ".git")));
  assert.ok(fs.existsSync(bareRemote));
  assert.equal(run("git", ["remote", "get-url", "origin"], personalRepo).stdout.trim(), bareRemote);
});
