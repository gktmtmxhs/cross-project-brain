import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scriptPath = path.join(repoRoot, "scripts", "cpb-sync-personal-repo.sh");

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

test("cpb personal sync commits and pushes dirty personal repo state to its upstream", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-sync-personal-"));
  const bareRemote = path.join(root, "personal-remote.git");
  const personalRepo = path.join(root, "personal-repo");

  run("git", ["init", "--bare", bareRemote], root);

  fs.mkdirSync(personalRepo, { recursive: true });
  run("git", ["init"], personalRepo);
  run("git", ["config", "user.email", "cpb-personal@example.com"], personalRepo);
  run("git", ["config", "user.name", "cpb-personal"], personalRepo);
  fs.writeFileSync(path.join(personalRepo, "README.md"), "# personal\n", "utf8");
  run("git", ["add", "README.md"], personalRepo);
  run("git", ["commit", "-m", "init"], personalRepo);
  run("git", ["branch", "-M", "main"], personalRepo);
  run("git", ["remote", "add", "origin", bareRemote], personalRepo);
  run("git", ["push", "-u", "origin", "main"], personalRepo);

  fs.writeFileSync(path.join(personalRepo, "notes.md"), "sync me\n", "utf8");

  const sync = spawnSync("bash", [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CPB_PERSONAL_REPO: personalRepo,
      CPB_AUTO_PUSH_PERSONAL: "1",
    },
  });

  assert.equal(sync.status, 0, sync.stderr || sync.stdout);
  assert.equal(run("git", ["status", "--porcelain"], personalRepo).stdout.trim(), "");

  const localHead = run("git", ["rev-parse", "HEAD"], personalRepo).stdout.trim();
  const remoteHead = run("git", ["--git-dir", bareRemote, "rev-parse", "refs/heads/main"], root).stdout.trim();
  assert.equal(localHead, remoteHead);

  const latestSubject = run("git", ["log", "-1", "--pretty=%s"], personalRepo).stdout.trim();
  assert.match(latestSubject, /^CPB sync:/u);
});

test("cpb personal sync bootstraps upstream on the first push when origin exists", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-sync-bootstrap-"));
  const bareRemote = path.join(root, "personal-remote.git");
  const personalRepo = path.join(root, "personal-repo");

  run("git", ["init", "--bare", bareRemote], root);

  fs.mkdirSync(personalRepo, { recursive: true });
  run("git", ["init"], personalRepo);
  run("git", ["config", "user.email", "cpb-personal@example.com"], personalRepo);
  run("git", ["config", "user.name", "cpb-personal"], personalRepo);
  fs.writeFileSync(path.join(personalRepo, "README.md"), "# personal\n", "utf8");
  run("git", ["add", "README.md"], personalRepo);
  run("git", ["commit", "-m", "init"], personalRepo);
  run("git", ["branch", "-M", "main"], personalRepo);
  run("git", ["remote", "add", "origin", bareRemote], personalRepo);

  fs.writeFileSync(path.join(personalRepo, "notes.md"), "first sync\n", "utf8");

  const sync = spawnSync("bash", [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CPB_PERSONAL_REPO: personalRepo,
      CPB_AUTO_PUSH_PERSONAL: "1",
    },
  });

  assert.equal(sync.status, 0, sync.stderr || sync.stdout);
  assert.equal(run("git", ["status", "--porcelain"], personalRepo).stdout.trim(), "");

  const upstream = run("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], personalRepo).stdout.trim();
  assert.equal(upstream, "origin/main");

  const localHead = run("git", ["rev-parse", "HEAD"], personalRepo).stdout.trim();
  const remoteHead = run("git", ["--git-dir", bareRemote, "rev-parse", "refs/heads/main"], root).stdout.trim();
  assert.equal(localHead, remoteHead);

  const latestSubject = run("git", ["log", "-1", "--pretty=%s"], personalRepo).stdout.trim();
  assert.match(latestSubject, /^CPB sync:/u);
});
