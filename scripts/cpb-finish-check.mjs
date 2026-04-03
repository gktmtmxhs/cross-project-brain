#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { agentRoot, deviceBrain, globalBrain, projectBrain, repoRoot } from "./cpb-paths.mjs";

const stateDir = path.join(agentRoot, "state");
const logsDir = path.join(agentRoot, "logs");
const baselinePath = path.join(stateDir, "finish-check-baseline.json");
const auditLogPath = path.join(logsDir, "finish-check.jsonl");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function logAudit(event, detail = {}) {
  ensureDir(logsDir);
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...detail,
  });
  fs.appendFileSync(auditLogPath, `${line}\n`, "utf8");
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || `git ${args.join(" ")} failed`).trim();
    throw new Error(message);
  }
  return result.stdout;
}

function shouldIgnoreRelPath(relPath) {
  if (!relPath) {
    return true;
  }

  if (relPath.startsWith(".agent/") || relPath.startsWith(".tools/")) {
    return true;
  }

  if (relPath === ".cpdb" || relPath.startsWith(".cpdb/") || relPath.includes("/.cpdb/")) {
    return true;
  }

  if (
    relPath.startsWith("brains/project-operators/") &&
    (relPath.includes("/_inbox") || relPath.includes("/_agents"))
  ) {
    return true;
  }

  return false;
}

function isSharedCareerRelPath(relPath) {
  return relPath === "docs/career/shared" || relPath.startsWith("docs/career/shared/");
}

function parseStatusLines() {
  const output = runGit(["status", "--short", "--untracked-files=normal"]);
  const lines = output.split(/\r?\n/u).filter(Boolean);
  const items = [];

  for (const line of lines) {
    const status = line.slice(0, 2);
    let relPath = line.slice(3).trim();
    if (relPath.includes(" -> ")) {
      relPath = relPath.split(" -> ").at(-1)?.trim() ?? relPath;
    }
    if (shouldIgnoreRelPath(relPath)) {
      continue;
    }
    items.push({ status, relPath });
  }

  return items;
}

function listFilesRecursively(relPath) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) {
    return [relPath];
  }

  const stat = fs.statSync(absPath);
  if (!stat.isDirectory()) {
    return [relPath];
  }

  const files = [];
  const walk = (currentAbs, currentRel) => {
    const entries = fs.readdirSync(currentAbs, { withFileTypes: true });
    if (entries.length === 0) {
      files.push(currentRel);
      return;
    }
    for (const entry of entries) {
      const nextAbs = path.join(currentAbs, entry.name);
      const nextRel = path.join(currentRel, entry.name).replaceAll("\\", "/");
      if (entry.isDirectory()) {
        walk(nextAbs, nextRel);
      } else {
        files.push(nextRel);
      }
    }
  };

  walk(absPath, relPath);
  return files;
}

function fileSignature(relPath, status) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) {
    return `${status}:__missing__`;
  }

  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    const entries = listFilesRecursively(relPath);
    const hash = crypto.createHash("sha256");
    hash.update(`${status}:dir:${relPath}`);
    for (const item of entries.sort()) {
      hash.update(item);
      const itemAbs = path.join(repoRoot, item);
      if (fs.existsSync(itemAbs) && fs.statSync(itemAbs).isFile()) {
        hash.update(fs.readFileSync(itemAbs));
      }
    }
    return hash.digest("hex");
  }

  const hash = crypto.createHash("sha256");
  hash.update(`${status}:file:${relPath}`);
  hash.update(fs.readFileSync(absPath));
  return hash.digest("hex");
}

function currentWorktreeState() {
  const items = parseStatusLines();
  const expanded = new Map();

  for (const item of items) {
    for (const relPath of listFilesRecursively(item.relPath)) {
      if (shouldIgnoreRelPath(relPath)) {
        continue;
      }
      expanded.set(relPath, fileSignature(relPath, item.status));
    }
  }

  return Object.fromEntries([...expanded.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function writeBaseline(reason, state) {
  ensureDir(stateDir);
  const payload = {
    updatedAt: new Date().toISOString(),
    reason,
    state,
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

function loadBaseline() {
  if (!fs.existsSync(baselinePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(baselinePath, "utf8"));
}

function diffSinceBaseline(baselineState, currentState) {
  const changed = [];
  const allPaths = new Set([...Object.keys(baselineState), ...Object.keys(currentState)]);
  for (const relPath of [...allPaths].sort()) {
    if ((baselineState[relPath] ?? null) !== (currentState[relPath] ?? null)) {
      changed.push(relPath);
    }
  }
  return changed;
}

function collectRecentMemoryFiles(brainRoot, label, sinceIso) {
  const sinceMs = Date.parse(sinceIso);
  if (!Number.isFinite(sinceMs) || !fs.existsSync(brainRoot)) {
    return [];
  }

  const matches = [];
  const walk = (dirPath) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(nextPath);
        continue;
      }
      if (!/^memory\d+\.neuron$/u.test(entry.name)) {
        continue;
      }
      const stat = fs.statSync(nextPath);
      if (stat.mtimeMs > sinceMs) {
        matches.push(`${label}:${path.relative(brainRoot, nextPath).replaceAll("\\", "/")}`);
      }
    }
  };

  walk(brainRoot);
  return matches.sort();
}

function usage() {
  process.stderr.write(
    "Usage: node scripts/cpb-finish-check.mjs [--init-baseline] [--reset-baseline] [--allow-no-lesson <reason>] [--allow-shared-career-publish <reason>]\n",
  );
}

const args = process.argv.slice(2);
const initBaseline = args.includes("--init-baseline");
const resetBaseline = args.includes("--reset-baseline");
const allowIndex = args.indexOf("--allow-no-lesson");
const allowReason = allowIndex >= 0 ? args[allowIndex + 1] : "";
const allowSharedIndex = args.indexOf("--allow-shared-career-publish");
const allowSharedReason = allowSharedIndex >= 0 ? args[allowSharedIndex + 1] : "";

if (allowIndex >= 0 && !allowReason) {
  process.stderr.write("--allow-no-lesson requires a reason\n");
  usage();
  process.exit(1);
}

if (allowSharedIndex >= 0 && !allowSharedReason) {
  process.stderr.write("--allow-shared-career-publish requires a reason\n");
  usage();
  process.exit(1);
}

if (args.includes("-h") || args.includes("--help")) {
  usage();
  process.exit(0);
}

const currentState = currentWorktreeState();

if (initBaseline) {
  if (!fs.existsSync(baselinePath)) {
    writeBaseline("auto-init", currentState);
    logAudit("baseline_init", { mode: "auto-init", paths: Object.keys(currentState).length });
    process.stdout.write("CPB finish check baseline initialized.\n");
  }
  process.exit(0);
}

if (resetBaseline) {
  writeBaseline("manual-reset", currentState);
  logAudit("baseline_reset", { paths: Object.keys(currentState).length });
  process.stdout.write("CPB finish check baseline reset.\n");
  process.exit(0);
}

let baseline = loadBaseline();
if (!baseline) {
  baseline = writeBaseline("implicit-init", currentState);
  logAudit("baseline_init", { mode: "implicit-init", paths: Object.keys(currentState).length });
  process.stdout.write("CPB finish check baseline initialized. Run the command again near task end.\n");
  process.exit(0);
}

const changedPaths = diffSinceBaseline(baseline.state ?? {}, currentState);
if (changedPaths.length === 0) {
  process.stdout.write("CPB finish check: no unreviewed repo changes since last checkpoint.\n");
  process.exit(0);
}

const sharedCareerPaths = changedPaths.filter(isSharedCareerRelPath);
const nonSharedPaths = changedPaths.filter((relPath) => !isSharedCareerRelPath(relPath));

if (sharedCareerPaths.length > 0 && !allowSharedReason) {
  process.stderr.write("CPB finish check blocked: shared career docs changed without explicit publish approval.\n");
  for (const relPath of sharedCareerPaths) {
    process.stderr.write(`- ${relPath}\n`);
  }
  process.stderr.write("\nShared career docs are publish targets, not default draft targets.\n");
  process.stderr.write("If the user explicitly requested a shared/published version, rerun with:\n");
  process.stderr.write("  node scripts/cpb-finish-check.mjs --allow-shared-career-publish \"user explicitly requested shared publish\"\n");
  process.exit(3);
}

const memoryFiles = [
  ...collectRecentMemoryFiles(globalBrain, "global", baseline.updatedAt),
  ...collectRecentMemoryFiles(projectBrain, "project", baseline.updatedAt),
  ...collectRecentMemoryFiles(deviceBrain, "device", baseline.updatedAt),
];
if (memoryFiles.length > 0) {
  writeBaseline("lesson-recorded", currentState);
  logAudit("finish_check_pass", {
    mode: "lesson-recorded",
    changedPaths,
    memoryFiles,
    sharedCareerPublish: allowSharedReason ? { approved: true, reason: allowSharedReason } : null,
  });
  process.stdout.write("CPB finish check: recent durable lesson found. Baseline advanced.\n");
  for (const item of memoryFiles) {
    process.stdout.write(`- ${item}\n`);
  }
  process.exit(0);
}

if (sharedCareerPaths.length > 0 && nonSharedPaths.length === 0 && allowSharedReason) {
  writeBaseline("allow-shared-career-publish", currentState);
  logAudit("finish_check_ack_shared_publish", {
    changedPaths,
    sharedCareerPaths,
    reason: allowSharedReason,
  });
  process.stdout.write(`CPB finish check: shared career publish acknowledged. Reason: ${allowSharedReason}\n`);
  process.exit(0);
}

if (allowReason) {
  writeBaseline("allow-no-lesson", currentState);
  logAudit("finish_check_ack", {
    changedPaths,
    reason: allowReason,
    sharedCareerPublish: allowSharedReason ? { approved: true, reason: allowSharedReason } : null,
  });
  process.stdout.write(`CPB finish check: acknowledged with no lesson. Reason: ${allowReason}\n`);
  process.exit(0);
}

process.stderr.write("CPB finish check warning: repo changes detected since last checkpoint, but no new durable lesson was recorded.\n");
for (const relPath of changedPaths) {
  process.stderr.write(`- ${relPath}\n`);
}
process.stderr.write("\nIf this task produced a reusable lesson, queue one with:\n");
process.stderr.write("  node scripts/cpb-log-learning.mjs --skill <skill-name> [--surface <surface>] [--env <env>] --topic <topic> --lesson <lesson_name> --summary \"...\" --problem \"...\" --root-cause \"...\" --fix \"...\" --evidence \"...\"\n");
process.stderr.write("  Or use --role <general|frontend|backend|design|security|testing|platform|content|growth|education>.\n");
process.stderr.write("  Add --scope global if the lesson should help in other repos too.\n");
process.stderr.write("  Add --scope device if the lesson is only for this machine or local environment.\n");
if (sharedCareerPaths.length > 0) {
  process.stderr.write("  Shared career doc changes were detected. Add --allow-shared-career-publish if the user explicitly requested publish.\n");
}
process.stderr.write("If no lesson is warranted, acknowledge it with:\n");
process.stderr.write("  node scripts/cpb-finish-check.mjs --allow-no-lesson \"reason\"\n");
process.exit(2);
