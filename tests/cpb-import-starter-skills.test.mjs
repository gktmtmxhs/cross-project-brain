import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const importerPath = path.join(repoRoot, "scripts", "cpb-import-starter-skills.mjs");
const roleTaxonomyUrl = pathToFileURL(path.join(repoRoot, "scripts", "cpb-role-taxonomy.mjs")).href;

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function makeCommittedRepo(prefix, files) {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  spawnSync("git", ["init"], { cwd: repoPath, encoding: "utf8" });
  spawnSync("git", ["config", "user.email", "cpb-test@example.com"], { cwd: repoPath, encoding: "utf8" });
  spawnSync("git", ["config", "user.name", "cpb-test"], { cwd: repoPath, encoding: "utf8" });

  for (const [relativePath, content] of Object.entries(files)) {
    writeFile(path.join(repoPath, relativePath), content);
  }

  spawnSync("git", ["add", "."], { cwd: repoPath, encoding: "utf8" });
  spawnSync("git", ["commit", "-m", "fixture"], { cwd: repoPath, encoding: "utf8" });
  const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoPath, encoding: "utf8" }).stdout.trim();
  return { repoPath, sha };
}

function runImporter(targetRepo, registryPath, extraArgs = []) {
  const result = spawnSync(
    "node",
    [importerPath, "--repo-root", targetRepo, "--registry", registryPath, ...extraArgs],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_OPTIONS: "",
        CPB_REPO_ROOT: targetRepo,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

test("starter skill importer vendors a markdown skill and writes lock + notices", () => {
  const upstream = makeCommittedRepo("cpb-import-agency-", {
    LICENSE: "MIT fixture\n",
    "engineering/engineering-frontend-developer.md": "# Frontend Developer\n\nUse semantic HTML.\n",
  });
  const targetRepo = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-import-target-"));
  writeFile(path.join(targetRepo, "config", "cpdb", "skill-role-map.example.json"), "{\n  \"reality-checker\": \"platform\"\n}\n");

  const registryPath = path.join(targetRepo, "registry.json");
  writeFile(
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
  );

  runImporter(targetRepo, registryPath, ["--preset", "minimal"]);

  const vendoredSkill = fs.readFileSync(
    path.join(targetRepo, ".codex", "vendor-skills", "frontend-developer", "SKILL.md"),
    "utf8",
  );
  assert.match(vendoredSkill, /Frontend Developer/u);

  const wrapper = fs.readFileSync(path.join(targetRepo, ".codex", "skills", "frontend-developer", "SKILL.md"), "utf8");
  assert.match(wrapper, /managed by CPB starter-skill import/u);
  assert.match(wrapper, /Vendored Instructions/u);

  const roleMap = JSON.parse(fs.readFileSync(path.join(targetRepo, "config", "cpdb", "skill-role-map.json"), "utf8"));
  assert.equal(roleMap["frontend-developer"], "frontend");
  assert.equal(roleMap["reality-checker"], "platform");

  const lockData = JSON.parse(fs.readFileSync(path.join(targetRepo, "config", "cpdb", "skills.lock.json"), "utf8"));
  assert.equal(lockData.skills.length, 1);
  assert.equal(lockData.skills[0].skill, "frontend-developer");
  assert.equal(lockData.skills[0].repo, upstream.repoPath);

  const notice = fs.readFileSync(path.join(targetRepo, "docs", "cpb", "THIRD_PARTY_NOTICES.md"), "utf8");
  assert.match(notice, /CPB Starter Skill Notices/u);
  assert.match(notice, /engineering\/engineering-frontend-developer\.md/u);
});

test("starter skill importer supports aliases and directory imports", async () => {
  const upstream = makeCommittedRepo("cpb-import-design-", {
    LICENSE: "MIT fixture\n",
    ".claude/skills/design-system/SKILL.md": "# Design System\n\nUse token discipline.\n",
    ".claude/skills/design-system/references/component-specs.md": "# Component Specs\n",
  });
  const targetRepo = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-import-target-"));
  writeFile(path.join(targetRepo, "config", "cpdb", "skill-role-map.example.json"), "{}\n");

  const registryPath = path.join(targetRepo, "registry.json");
  writeFile(
    registryPath,
    `${JSON.stringify(
      {
        version: 1,
        presets: {
          web: ["design-system"],
        },
        skills: {
          "design-system": {
            repo: upstream.repoPath,
            ref: upstream.sha,
            license: "MIT",
            role: "design",
            aliases: ["ui-ux-pro-max"],
            imports: [
              {
                source: ".claude/skills/design-system",
                target: ".",
              },
            ],
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  runImporter(targetRepo, registryPath, ["--skill", "design-system"]);

  const vendoredSkillPath = path.join(targetRepo, ".codex", "vendor-skills", "design-system", "SKILL.md");
  const vendoredReferencePath = path.join(
    targetRepo,
    ".codex",
    "vendor-skills",
    "design-system",
    "references",
    "component-specs.md",
  );
  assert.ok(fs.existsSync(vendoredSkillPath));
  assert.ok(fs.existsSync(vendoredReferencePath));

  const aliasWrapperPath = path.join(targetRepo, ".codex", "skills", "ui-ux-pro-max", "SKILL.md");
  assert.ok(fs.existsSync(aliasWrapperPath));

  const roleMap = JSON.parse(fs.readFileSync(path.join(targetRepo, "config", "cpdb", "skill-role-map.json"), "utf8"));
  assert.equal(roleMap["design-system"], "design");
  assert.equal(roleMap["ui-ux-pro-max"], "design");

  const previousRepoRoot = process.env.CPB_REPO_ROOT;
  process.env.CPB_REPO_ROOT = targetRepo;
  const { resolveRoleFromSkill } = await import(`${roleTaxonomyUrl}?case=${Date.now()}`);
  assert.equal(resolveRoleFromSkill("ui-ux-pro-max"), "design");
  if (previousRepoRoot == null) {
    delete process.env.CPB_REPO_ROOT;
  } else {
    process.env.CPB_REPO_ROOT = previousRepoRoot;
  }
});
