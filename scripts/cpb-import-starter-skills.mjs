#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const defaultRepoRoot = path.resolve(scriptDir, "..");
const allowedLicenses = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD"]);

function usage() {
  process.stdout.write(`Usage: node scripts/cpb-import-starter-skills.mjs [options]

Options:
  --repo-root <path>         target repo root (default: script parent repo)
  --registry <path>          registry JSON (default: config/cpdb/starter-skill-registry.json, fallback: templates/config/starter-skill-registry.json)
  --preset <name>            import a named starter-skill preset
  --skill <name>             import a single named skill (repeatable)
  --list-presets             print available presets
  --list-skills              print available skills
  -h, --help                 show this help

Examples:
  node scripts/cpb-import-starter-skills.mjs --preset web
  node scripts/cpb-import-starter-skills.mjs --skill frontend-developer --skill api-tester
`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function sanitizeSkillName(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function relativePath(basePath, targetPath) {
  return path.relative(basePath, targetPath).split(path.sep).join("/");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.status !== 0) {
    const errorText = result.stderr || result.stdout || `${command} ${args.join(" ")}`;
    fail(errorText.trim());
  }
  return result;
}

function loadRegistry(registryPath) {
  const registry = readJsonIfExists(registryPath);
  if (!registry) {
    fail(`Starter skill registry not found: ${registryPath}`);
  }
  if (registry.version !== 1) {
    fail(`Unsupported starter skill registry version: ${registry.version}`);
  }
  if (!registry.skills || typeof registry.skills !== "object" || Array.isArray(registry.skills)) {
    fail("Starter skill registry must contain a skills object.");
  }
  if (!registry.presets || typeof registry.presets !== "object" || Array.isArray(registry.presets)) {
    fail("Starter skill registry must contain a presets object.");
  }
  return registry;
}

function resolveRegistryPath(repoRoot, explicitRegistryPath) {
  if (explicitRegistryPath) {
    return explicitRegistryPath;
  }

  const consumerRegistry = path.join(repoRoot, "config", "cpdb", "starter-skill-registry.json");
  if (fs.existsSync(consumerRegistry)) {
    return consumerRegistry;
  }

  return path.join(repoRoot, "templates", "config", "starter-skill-registry.json");
}

function collectSelection(args, registry) {
  const selected = [];
  if (args.preset) {
    const presetSkills = registry.presets[args.preset];
    if (!Array.isArray(presetSkills) || presetSkills.length === 0) {
      fail(`Unknown starter-skill preset: ${args.preset}`);
    }
    selected.push(...presetSkills);
  }
  selected.push(...args.skills);

  const uniqueSkills = [...new Set(selected.map((value) => sanitizeSkillName(value)).filter(Boolean))];
  if (uniqueSkills.length === 0) {
    const defaultPreset = "minimal";
    if (!Array.isArray(registry.presets[defaultPreset])) {
      fail("No starter skills selected and the default preset is unavailable.");
    }
    return {
      presetName: defaultPreset,
      skills: [...registry.presets[defaultPreset]],
    };
  }

  for (const skillName of uniqueSkills) {
    if (!registry.skills[skillName]) {
      fail(`Unknown starter skill: ${skillName}`);
    }
  }

  return {
    presetName: args.preset || "",
    skills: uniqueSkills,
  };
}

function copyPath(sourcePath, targetPath, flattenDirectoryRoot = false) {
  const stats = fs.statSync(sourcePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  if (stats.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    if (flattenDirectoryRoot) {
      for (const entry of fs.readdirSync(sourcePath)) {
        const from = path.join(sourcePath, entry);
        const to = path.join(targetPath, entry);
        fs.cpSync(from, to, { force: true, recursive: true });
      }
      return;
    }

    fs.cpSync(sourcePath, targetPath, { force: true, recursive: true });
    return;
  }

  fs.copyFileSync(sourcePath, targetPath);
}

function sortObject(input) {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}

function buildManagedWrapper({
  skillName,
  canonicalSkill,
  role,
  license,
  repo,
  ref,
  vendorSkillPath,
  noticePath,
}) {
  return `# ${skillName}

This starter skill is managed by CPB starter-skill import.

- Canonical Skill: ${canonicalSkill}
- Role: ${role}
- Upstream Repo: ${repo}
- Upstream Ref: ${ref}
- License: ${license}
- Vendored Instructions: \`${vendorSkillPath}\`
- Notice File: \`${noticePath}\`

Use the vendored skill as the primary instruction source for this skill. Read it first, then apply these local adaptation rules:

- Treat upstream commands, file paths, and release guidance as patterns until they are verified against this repo.
- Prefer this repo's \`AGENTS.md\`, \`CLAUDE.md\`, project profile, and local test commands when they conflict with upstream examples.
- Open vendored references and scripts under the same vendor directory when the upstream skill points to them.
- Keep durable CPB learning role-aware with \`--skill ${canonicalSkill}\`.
`;
}

function groupByUpstream(skillEntries) {
  const grouped = new Map();
  for (const entry of skillEntries) {
    const key = `${entry.repo}@@${entry.ref}`;
    const current = grouped.get(key) || {
      repo: entry.repo,
      ref: entry.ref,
      license: entry.license,
      skills: [],
    };
    current.skills.push(entry);
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((left, right) => left.repo.localeCompare(right.repo));
}

function generateNotice(lockData) {
  const lines = [
    "# CPB Starter Skill Notices",
    "",
    "This file is generated by `scripts/cpb-import-starter-skills.mjs`.",
    "It records third-party starter skills vendored into this repo by CPB.",
    "",
  ];

  const grouped = groupByUpstream(lockData.skills);
  if (grouped.length === 0) {
    lines.push("No starter skills have been imported yet.", "");
    return `${lines.join("\n")}\n`;
  }

  grouped.forEach((group, index) => {
    lines.push(`## ${index + 1}. ${group.repo}`);
    lines.push("");
    lines.push(`- Ref: \`${group.ref}\``);
    lines.push(`- License: ${group.license}`);
    lines.push("- Imported skills:");
    for (const skill of group.skills.sort((left, right) => left.skill.localeCompare(right.skill))) {
      const aliases = Array.isArray(skill.aliases) && skill.aliases.length > 0 ? ` (aliases: ${skill.aliases.join(", ")})` : "";
      lines.push(`  - \`${skill.skill}\`${aliases}`);
    }
    lines.push("- Imported upstream paths:");
    for (const skill of group.skills.sort((left, right) => left.skill.localeCompare(right.skill))) {
      for (const item of skill.sourceItems) {
        lines.push(`  - \`${item.source}\` -> \`${item.target}\``);
      }
    }
    lines.push("");
  });

  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = {
    repoRoot: defaultRepoRoot,
    registry: "",
    preset: "",
    skills: [],
    listPresets: false,
    listSkills: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case "--repo-root":
        parsed.repoRoot = path.resolve(argv[index + 1]);
        index += 1;
        break;
      case "--registry":
        parsed.registry = path.resolve(argv[index + 1]);
        index += 1;
        break;
      case "--preset":
        parsed.preset = sanitizeSkillName(argv[index + 1]);
        index += 1;
        break;
      case "--skill":
        parsed.skills.push(argv[index + 1]);
        index += 1;
        break;
      case "--list-presets":
        parsed.listPresets = true;
        break;
      case "--list-skills":
        parsed.listSkills = true;
        break;
      case "-h":
      case "--help":
        usage();
        process.exit(0);
        break;
      default:
        fail(`Unknown argument: ${value}`);
    }
  }

  return parsed;
}

const args = parseArgs(process.argv.slice(2));
const repoRoot = args.repoRoot;
const registryPath = resolveRegistryPath(repoRoot, args.registry);
const registry = loadRegistry(registryPath);

if (args.listPresets) {
  for (const [presetName, skillNames] of Object.entries(registry.presets).sort(([left], [right]) => left.localeCompare(right))) {
    process.stdout.write(`${presetName}: ${skillNames.join(", ")}\n`);
  }
  process.exit(0);
}

if (args.listSkills) {
  for (const [skillName, entry] of Object.entries(registry.skills).sort(([left], [right]) => left.localeCompare(right))) {
    process.stdout.write(`${skillName}: ${entry.repo} @ ${entry.ref}\n`);
  }
  process.exit(0);
}

const selection = collectSelection(args, registry);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-starter-skills-"));
const cloneCache = new Map();

try {
  fs.mkdirSync(path.join(repoRoot, ".codex", "vendor-skills"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, ".codex", "skills"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, "docs", "cpb"), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, "config", "cpdb"), { recursive: true });

  const existingLock = readJsonIfExists(path.join(repoRoot, "config", "cpdb", "skills.lock.json"));
  const existingBySkill = new Map();
  if (existingLock && Array.isArray(existingLock.skills)) {
    for (const entry of existingLock.skills) {
      if (entry && typeof entry.skill === "string") {
        existingBySkill.set(entry.skill, entry);
      }
    }
  }

  const now = new Date().toISOString();
  const importedSkills = [];
  const importedSkillMap = {};

  function ensureCheckout(repo, ref) {
    const cacheKey = `${repo}@@${ref}`;
    if (cloneCache.has(cacheKey)) {
      return cloneCache.get(cacheKey);
    }

    const targetDir = path.join(tempRoot, `repo-${cloneCache.size}`);
    run("git", ["clone", "--quiet", repo, targetDir], { cwd: tempRoot });
    run("git", ["checkout", "--quiet", ref], { cwd: targetDir });
    cloneCache.set(cacheKey, targetDir);
    return targetDir;
  }

  for (const rawSkillName of selection.skills) {
    const skillName = sanitizeSkillName(rawSkillName);
    const entry = registry.skills[skillName];
    if (!entry) {
      fail(`Starter skill missing in registry: ${skillName}`);
    }
    if (!allowedLicenses.has(entry.license)) {
      fail(`Starter skill ${skillName} uses a non-allowlisted license: ${entry.license}`);
    }

    const checkoutDir = ensureCheckout(entry.repo, entry.ref);
    const vendorRoot = path.join(repoRoot, ".codex", "vendor-skills", skillName);
    fs.rmSync(vendorRoot, { force: true, recursive: true });
    fs.mkdirSync(vendorRoot, { recursive: true });

    const sourceItems = [];
    for (const sourceItem of entry.imports || []) {
      const sourcePath = path.join(checkoutDir, sourceItem.source);
      if (!fs.existsSync(sourcePath)) {
        fail(`Missing upstream path for ${skillName}: ${sourceItem.source}`);
      }

      const isFlattenedDirectory = sourceItem.target === ".";
      const targetPath = isFlattenedDirectory
        ? vendorRoot
        : path.join(vendorRoot, sourceItem.target || path.basename(sourceItem.source));
      copyPath(sourcePath, targetPath, isFlattenedDirectory);

      const stats = fs.statSync(sourcePath);
      if (stats.isDirectory() && isFlattenedDirectory) {
        sourceItems.push({
          source: sourceItem.source,
          target: relativePath(repoRoot, vendorRoot),
        });
      } else {
        sourceItems.push({
          source: sourceItem.source,
          target: relativePath(repoRoot, targetPath),
        });
      }
    }

    const upstreamLicensePath = path.join(checkoutDir, "LICENSE");
    if (fs.existsSync(upstreamLicensePath)) {
      fs.copyFileSync(upstreamLicensePath, path.join(vendorRoot, "LICENSE"));
    }

    const canonicalWrapperDir = path.join(repoRoot, ".codex", "skills", skillName);
    fs.rmSync(canonicalWrapperDir, { force: true, recursive: true });
    fs.mkdirSync(canonicalWrapperDir, { recursive: true });
    const noticeFile = path.join(repoRoot, "docs", "cpb", "THIRD_PARTY_NOTICES.md");
    const canonicalWrapperPath = path.join(canonicalWrapperDir, "SKILL.md");
    const canonicalWrapperBody = buildManagedWrapper({
      skillName,
      canonicalSkill: skillName,
      role: entry.role,
      license: entry.license,
      repo: entry.repo,
      ref: entry.ref,
      vendorSkillPath: relativePath(canonicalWrapperDir, path.join(vendorRoot, "SKILL.md")),
      noticePath: relativePath(canonicalWrapperDir, noticeFile),
    });
    fs.writeFileSync(canonicalWrapperPath, canonicalWrapperBody, "utf8");

    const aliases = Array.isArray(entry.aliases)
      ? [...new Set(entry.aliases.map((alias) => sanitizeSkillName(alias)).filter(Boolean))]
      : [];

    const wrapperPaths = [relativePath(repoRoot, canonicalWrapperPath)];
    for (const alias of aliases) {
      const aliasWrapperDir = path.join(repoRoot, ".codex", "skills", alias);
      fs.rmSync(aliasWrapperDir, { force: true, recursive: true });
      fs.mkdirSync(aliasWrapperDir, { recursive: true });
      const aliasWrapperPath = path.join(aliasWrapperDir, "SKILL.md");
      fs.writeFileSync(
        aliasWrapperPath,
        buildManagedWrapper({
          skillName: alias,
          canonicalSkill: skillName,
          role: entry.role,
          license: entry.license,
          repo: entry.repo,
          ref: entry.ref,
          vendorSkillPath: relativePath(aliasWrapperDir, path.join(vendorRoot, "SKILL.md")),
          noticePath: relativePath(aliasWrapperDir, noticeFile),
        }),
        "utf8",
      );
      wrapperPaths.push(relativePath(repoRoot, aliasWrapperPath));
    }

    importedSkillMap[skillName] = entry.role;
    for (const alias of aliases) {
      importedSkillMap[alias] = entry.role;
    }

    existingBySkill.set(skillName, {
      skill: skillName,
      aliases,
      role: entry.role,
      license: entry.license,
      repo: entry.repo,
      ref: entry.ref,
      preset: selection.presetName,
      importedAt: now,
      sourceItems,
      vendorRoot: relativePath(repoRoot, vendorRoot),
      wrapperPaths,
    });

    importedSkills.push(skillName);
  }

  const roleMapPath = path.join(repoRoot, "config", "cpdb", "skill-role-map.json");
  const roleMapExamplePath = path.join(repoRoot, "config", "cpdb", "skill-role-map.example.json");
  const existingRoleMap = readJsonIfExists(roleMapPath) || readJsonIfExists(roleMapExamplePath) || {};
  const mergedRoleMap = sortObject({ ...existingRoleMap, ...importedSkillMap });
  writeJson(roleMapPath, mergedRoleMap);

  const lockData = {
    version: 1,
    generatedAt: now,
    registryPath: relativePath(repoRoot, registryPath),
    skills: [...existingBySkill.values()].sort((left, right) => left.skill.localeCompare(right.skill)),
  };
  writeJson(path.join(repoRoot, "config", "cpdb", "skills.lock.json"), lockData);
  fs.writeFileSync(path.join(repoRoot, "docs", "cpb", "THIRD_PARTY_NOTICES.md"), generateNotice(lockData), "utf8");

  process.stdout.write(`Imported starter skills: ${importedSkills.join(", ")}\n`);
  process.stdout.write(`Preset: ${selection.presetName || "custom"}\n`);
  process.stdout.write("Generated files:\n");
  process.stdout.write("  - .codex/vendor-skills/*\n");
  process.stdout.write("  - .codex/skills/*/SKILL.md\n");
  process.stdout.write("  - config/cpdb/skill-role-map.json\n");
  process.stdout.write("  - config/cpdb/skills.lock.json\n");
  process.stdout.write("  - docs/cpb/THIRD_PARTY_NOTICES.md\n");
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
