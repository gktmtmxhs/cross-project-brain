import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scriptPath = path.join(repoRoot, "scripts", "cpb-install.sh");

function runInstall(targetRepo, homeDir, extraArgs = []) {
  const result = spawnSync(
    "bash",
    [scriptPath, "--target", targetRepo, "--no-neuronfs", "--no-autogrowth", "--force", "--no-shell", ...extraArgs],
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
  return result;
}

function makeGitRepo(prefix) {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  spawnSync("git", ["init"], { cwd: repoPath, encoding: "utf8" });
  spawnSync("git", ["config", "user.email", "cpb-test@example.com"], { cwd: repoPath, encoding: "utf8" });
  spawnSync("git", ["config", "user.name", "cpb-test"], { cwd: repoPath, encoding: "utf8" });
  spawnSync("git", ["config", "github.user", "cpb-test"], { cwd: repoPath, encoding: "utf8" });
  return repoPath;
}

test("cpb install writes explicit project profile scaffolds", () => {
  const targetRepo = makeGitRepo("cpb-install-explicit-");
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-install-home-"));
  fs.writeFileSync(path.join(targetRepo, "README.md"), "# billing\n", "utf8");

  runInstall(targetRepo, homeDir, [
    "--project-type",
    "api-service",
    "--project-summary",
    "Webhook callback service for entitlement sync",
    "--shared-repo",
  ]);

  const profileJson = JSON.parse(
    fs.readFileSync(path.join(targetRepo, "config", "cpdb", "project-profile.json"), "utf8"),
  );
  assert.equal(profileJson.projectType, "api-service");
  assert.equal(profileJson.projectSummary, "Webhook callback service for entitlement sync");
  assert.equal(profileJson.sharedRepo, true);
  assert.equal(profileJson.detectionMode, "explicit");

  const profileDoc = fs.readFileSync(path.join(targetRepo, "docs", "cpb", "PROJECT_PROFILE.md"), "utf8");
  assert.match(profileDoc, /Type: api-service/u);
  assert.match(profileDoc, /Webhook callback service for entitlement sync/u);

  const brainProfile = fs.readFileSync(
    path.join(targetRepo, "brains", "team-brain", "brain_v4", "prefrontal", "01_project-profile.md"),
    "utf8",
  );
  assert.match(brainProfile, /Project: .*cpb-install-explicit-/u);
  assert.match(brainProfile, /Shared Repo: true/u);
});

test("cpb install auto-detects a frontend web app and writes a guessed scaffold", () => {
  const targetRepo = makeGitRepo("cpb-install-detect-");
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-install-home-"));

  fs.writeFileSync(
    path.join(targetRepo, "package.json"),
    JSON.stringify({
      name: "demo-web",
      private: true,
      dependencies: {
        react: "^19.0.0",
      },
      devDependencies: {
        typescript: "^5.0.0",
        vite: "^6.0.0",
      },
    }),
    "utf8",
  );
  fs.writeFileSync(path.join(targetRepo, "vite.config.ts"), "export default {};\n", "utf8");
  fs.writeFileSync(path.join(targetRepo, "tsconfig.json"), "{\n  \"compilerOptions\": {}\n}\n", "utf8");

  runInstall(targetRepo, homeDir);

  const profileJson = JSON.parse(
    fs.readFileSync(path.join(targetRepo, "config", "cpdb", "project-profile.json"), "utf8"),
  );

  assert.equal(profileJson.projectType, "web-app");
  assert.equal(profileJson.detectionMode, "auto");
  assert.match(profileJson.projectSummary, /TODO:/u);
  assert.ok(profileJson.stack.includes("nodejs"));
  assert.ok(profileJson.stack.includes("typescript"));
  assert.ok(profileJson.stack.includes("vite"));
  assert.ok(profileJson.stack.includes("react"));
  assert.ok(profileJson.detectedSignals.includes("package.json"));
  assert.ok(profileJson.detectedSignals.includes("vite.config"));
});
