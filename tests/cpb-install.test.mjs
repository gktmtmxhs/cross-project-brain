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

function makeCommittedRepo(prefix, files) {
  const repoPath = makeGitRepo(prefix);
  for (const [relativePath, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repoPath, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(repoPath, relativePath), content, "utf8");
  }
  spawnSync("git", ["add", "."], { cwd: repoPath, encoding: "utf8" });
  spawnSync("git", ["commit", "-m", "fixture"], { cwd: repoPath, encoding: "utf8" });
  const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoPath, encoding: "utf8" }).stdout.trim();
  return { repoPath, sha };
}

function parseGitHubRepoSlug(rawUrl) {
  let value = String(rawUrl || "").trim();
  if (!value) {
    return "";
  }

  value = value.replace(/\.git$/u, "");
  value = value
    .replace(/^git@github\.com:/u, "")
    .replace(/^ssh:\/\/git@github\.com\//u, "")
    .replace(/^https?:\/\/github\.com\//u, "")
    .replace(/^git:\/\/github\.com\//u, "");

  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(value) ? value : "";
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

test("cpb install can import starter skills from a custom registry", () => {
  const targetRepo = makeGitRepo("cpb-install-starter-");
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-install-home-"));
  const upstream = makeCommittedRepo("cpb-install-upstream-", {
    LICENSE: "MIT fixture\n",
    "engineering/engineering-frontend-developer.md": "# Frontend Developer\n\nPrefer semantic HTML.\n",
  });
  const registryPath = path.join(homeDir, "starter-skill-registry.json");

  fs.writeFileSync(
    registryPath,
    `${JSON.stringify(
      {
        version: 1,
        presets: {
          minimal: ["frontend-developer"],
        },
        skills: {
          "frontend-developer": {
            repo: upstream.repoPath,
            ref: upstream.sha,
            license: "MIT",
            role: "frontend",
            imports: [
              {
                source: "engineering/engineering-frontend-developer.md",
                target: "SKILL.md",
              },
            ],
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  runInstall(targetRepo, homeDir, [
    "--with-starter-skills",
    "--starter-skill-preset",
    "minimal",
    "--starter-skill-registry",
    registryPath,
  ]);

  const vendoredSkill = fs.readFileSync(
    path.join(targetRepo, ".codex", "vendor-skills", "frontend-developer", "SKILL.md"),
    "utf8",
  );
  assert.match(vendoredSkill, /Frontend Developer/u);

  const roleMap = JSON.parse(fs.readFileSync(path.join(targetRepo, "config", "cpdb", "skill-role-map.json"), "utf8"));
  assert.equal(roleMap["frontend-developer"], "frontend");

  const lockData = JSON.parse(fs.readFileSync(path.join(targetRepo, "config", "cpdb", "skills.lock.json"), "utf8"));
  assert.equal(lockData.skills[0].skill, "frontend-developer");

  const notice = fs.readFileSync(path.join(targetRepo, "docs", "cpb", "THIRD_PARTY_NOTICES.md"), "utf8");
  assert.match(notice, /frontend-developer/u);
});

test("cpb install can scaffold an initial design system", () => {
  const targetRepo = makeGitRepo("cpb-install-design-");
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-install-home-"));

  fs.writeFileSync(
    path.join(targetRepo, "package.json"),
    JSON.stringify({
      name: "designable-web",
      private: true,
      dependencies: {
        react: "^19.0.0",
      },
      devDependencies: {
        vite: "^6.0.0",
      },
    }),
    "utf8",
  );
  fs.writeFileSync(path.join(targetRepo, "vite.config.ts"), "export default {};\n", "utf8");

  runInstall(targetRepo, homeDir, ["--scaffold-design-system"]);

  const designSystem = JSON.parse(fs.readFileSync(path.join(targetRepo, "config", "cpdb", "design-system.json"), "utf8"));
  assert.equal(designSystem.preset, "product-ui");
  assert.equal(designSystem.project.type, "web-app");

  const designDoc = fs.readFileSync(path.join(targetRepo, "docs", "design-system.md"), "utf8");
  assert.match(designDoc, /Product UI/u);

  const designBrain = fs.readFileSync(
    path.join(targetRepo, "brains", "team-brain", "brain_v4", "cortex", "02_design-system.md"),
    "utf8",
  );
  assert.match(designBrain, /Generated by `cpb scaffold-design-system`/u);
});

test("cpb install stamps the framework release repo into the installed prebuilt helper", (t) => {
  const origin = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (origin.status !== 0) {
    t.skip("origin remote is not configured");
    return;
  }

  const repoSlug = parseGitHubRepoSlug(origin.stdout);
  if (!repoSlug) {
    t.skip("origin remote is not a GitHub repo URL");
    return;
  }

  const targetRepo = makeGitRepo("cpb-install-release-repo-");
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-install-home-"));

  runInstall(targetRepo, homeDir);

  const helperResult = spawnSync(
    "/bin/bash",
    [path.join(targetRepo, "scripts", "cpb-neuronfs-prebuilt.sh"), "base-url", "970e0cd"],
    {
      cwd: targetRepo,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_OPTIONS: "",
      },
    },
  );

  assert.equal(helperResult.status, 0, helperResult.stderr || helperResult.stdout);
  assert.equal(
    helperResult.stdout.trim(),
    `https://github.com/${repoSlug}/releases/download/neuronfs-970e0cd`,
  );
});
