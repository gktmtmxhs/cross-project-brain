import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scriptPath = path.join(repoRoot, "scripts", "cpb-scaffold-design-system.sh");

function makeRepo(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runScaffold(repoPath, extraArgs = []) {
  const result = spawnSync("bash", [scriptPath, "--repo-root", repoPath, ...extraArgs], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_OPTIONS: "",
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

test("cpb scaffold-design-system creates docs, config, and brain seed from a project profile", () => {
  const repoPath = makeRepo("cpb-design-system-");
  fs.mkdirSync(path.join(repoPath, "config", "cpdb"), { recursive: true });
  fs.mkdirSync(path.join(repoPath, ".codex", "skills", "design-system"), { recursive: true });

  fs.writeFileSync(
    path.join(repoPath, "config", "cpdb", "project-profile.json"),
    `${JSON.stringify(
      {
        projectName: "Practice Studio",
        projectType: "web-app",
        projectSummary: "Practice planning and progress tracking app",
        sharedRepo: true,
        detectionMode: "explicit",
        stack: ["nodejs", "typescript", "vite", "react"],
        detectedSignals: ["package.json", "vite.config"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  fs.writeFileSync(path.join(repoPath, ".codex", "skills", "design-system", "SKILL.md"), "# Design System\n", "utf8");

  runScaffold(repoPath);

  const config = JSON.parse(fs.readFileSync(path.join(repoPath, "config", "cpdb", "design-system.json"), "utf8"));
  assert.equal(config.preset, "product-ui");
  assert.equal(config.starterSkills.designSystem, true);
  assert.equal(config.project.name, "Practice Studio");
  assert.equal(config.foundations.color.primary, "#0F766E");

  const designDoc = fs.readFileSync(path.join(repoPath, "docs", "design-system.md"), "utf8");
  assert.match(designDoc, /Practice planning and progress tracking app/u);
  assert.match(designDoc, /Starter Design Skill Available: Yes/u);

  const foundationsDoc = fs.readFileSync(path.join(repoPath, "docs", "ui-specs", "foundations.md"), "utf8");
  assert.match(foundationsDoc, /\| primary \| #0F766E \|/u);

  const brainSeed = fs.readFileSync(
    path.join(repoPath, "brains", "team-brain", "brain_v4", "cortex", "02_design-system.md"),
    "utf8",
  );
  assert.match(brainSeed, /Preset: product-ui/u);
});

test("cpb scaffold-design-system respects explicit style and token overrides", () => {
  const repoPath = makeRepo("cpb-design-system-override-");
  fs.mkdirSync(path.join(repoPath, "config", "cpdb"), { recursive: true });
  fs.writeFileSync(
    path.join(repoPath, "config", "cpdb", "project-profile.json"),
    `${JSON.stringify(
      {
        projectName: "Ops API",
        projectType: "api-service",
        projectSummary: "Internal billing callback service",
        sharedRepo: false,
        detectionMode: "explicit",
        stack: ["java", "spring"],
        detectedSignals: ["pom.xml"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  runScaffold(repoPath, ["--style", "editorial", "--primary", "#9a3412", "--motion", "high"]);

  const config = JSON.parse(fs.readFileSync(path.join(repoPath, "config", "cpdb", "design-system.json"), "utf8"));
  assert.equal(config.preset, "editorial");
  assert.equal(config.foundations.color.primary, "#9A3412");
  assert.equal(config.foundations.motion.level, "high");
});
