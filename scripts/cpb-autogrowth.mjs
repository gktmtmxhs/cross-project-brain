#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { agentRoot, deviceBrain, globalBrain, projectBrain, repoRoot, runtimeBrain } from "./cpb-paths.mjs";

const runtimeInboxDir = path.join(runtimeBrain, "_inbox");
const runtimeCorrectionsPath = path.join(runtimeInboxDir, "corrections.jsonl");
const processingPath = `${runtimeCorrectionsPath}.processing`;
const neuronfsBinary = path.join(repoRoot, ".tools", "neuronfs", "neuronfs");
const rebuildScript = path.join(repoRoot, "scripts", "cpb-rebuild-runtime-brain.sh");
const autogrowthLogPath = path.join(agentRoot, "logs", "cpb-autogrowth-corrections.jsonl");
const pollMs = Number.parseInt(process.env.CPB_AUTOGROWTH_POLL_MS ?? "2000", 10);
const onceMode = process.argv.includes("--once");

let keepRunning = true;

process.on("SIGINT", () => { keepRunning = false; });
process.on("SIGTERM", () => { keepRunning = false; });

function log(message) {
  process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureLayout() {
  ensureDir(path.join(agentRoot, "logs"));
  ensureDir(path.join(runtimeBrain, "_agents", "global_inbox"));
  ensureDir(runtimeInboxDir);
  ensureDir(globalBrain);
  ensureDir(projectBrain);
  ensureDir(deviceBrain);
}

function sanitizeText(text) {
  const normalized = String(text ?? "correction")
    .replace(/\s+/g, "_")
    .replace(/[^0-9A-Za-z_\-\u3131-\u318E\uAC00-\uD7AF\u4E00-\u9FFF]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (normalized || "correction").slice(0, 60);
}

function normalizePath(neuronPath) {
  return String(neuronPath).replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function resolveNeuronPath(entry) {
  if (typeof entry.path === "string" && entry.path.trim() !== "") {
    return normalizePath(entry.path.trim());
  }
  return `hippocampus/_inbox_pending/${sanitizeText(entry.text)}`;
}

function isInvalidPath(neuronPath) {
  return (
    neuronPath.includes("..") ||
    neuronPath.includes("\\") ||
    neuronPath.includes("$") ||
    neuronPath.includes("&") ||
    neuronPath.includes("|") ||
    neuronPath.includes(">")
  );
}

function normalizeScope(scope) {
  const value = String(scope || "project").trim().toLowerCase();
  if (value === "global") return "global";
  if (value === "device") return "device";
  return "project";
}

function resolveTargetBrain(scope) {
  const normalizedScope = normalizeScope(scope);
  if (normalizedScope === "global") return globalBrain;
  if (normalizedScope === "device") return deviceBrain;
  return projectBrain;
}

function runNeuronfs(targetBrain, args) {
  const result = spawnSync(neuronfsBinary, [targetBrain, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    const details = stderr || stdout || `exit ${result.status}`;
    throw new Error(`neuronfs ${args.join(" ")} failed: ${details}`);
  }

  return result.stdout?.trim() ?? "";
}

function parseResolvedPath(output, requestedPath) {
  const requested = normalizePath(requestedPath);
  const normalizedOutput = String(output ?? "").replaceAll("\\", "/");

  const mergeMatch = normalizedOutput.match(/\[MERGE\].*?≈ '([^']+)'/u);
  if (mergeMatch?.[1]) return normalizePath(mergeMatch[1]);

  const fireMatch = normalizedOutput.match(/\[FIRE\].*? ([A-Za-z0-9_\/-]+) →/u);
  if (fireMatch?.[1]) return normalizePath(fireMatch[1]);

  const growMatch = normalizedOutput.match(/\[GROW\].*? ([A-Za-z0-9_\/-]+) →/u);
  if (growMatch?.[1]) return normalizePath(growMatch[1]);

  return requested;
}

function getNextMemoryIndex(neuronDir) {
  let max = 0;
  for (const entry of fs.readdirSync(neuronDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const match = /^memory(\d+)\.neuron$/u.exec(entry.name);
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (value > max) max = value;
  }
  return max + 1;
}

function normalizeEvidence(entry) {
  const items = [];
  for (const field of ["evidence", "files", "tests", "commands"]) {
    const value = entry[field];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim() !== "") items.push(item.trim());
      }
      continue;
    }
    if (typeof value === "string" && value.trim() !== "") items.push(value.trim());
  }
  return [...new Set(items)];
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function resolveRecordedTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || process.env.TZ || "local";
}

function formatLocalIsoTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  const seconds = padDatePart(date.getSeconds());
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = padDatePart(Math.floor(absoluteOffsetMinutes / 60));
  const offsetRemainderMinutes = padDatePart(absoluteOffsetMinutes % 60);
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRemainderMinutes}`;
}

function writeLearningMemory(targetBrain, neuronPath, entry) {
  const hasLearningContext =
    typeof entry.summary === "string" ||
    typeof entry.problem === "string" ||
    typeof entry.root_cause === "string" ||
    typeof entry.fix === "string" ||
    typeof entry.context === "string" ||
    Array.isArray(entry.evidence) ||
    Array.isArray(entry.files) ||
    Array.isArray(entry.tests);

  if (!hasLearningContext) return;

  const neuronDir = path.join(targetBrain, ...normalizePath(neuronPath).split("/"));
  ensureDir(neuronDir);
  const memoryIndex = getNextMemoryIndex(neuronDir);
  const memoryPath = path.join(neuronDir, `memory${memoryIndex}.neuron`);
  const timestampUtc = typeof entry.recorded_at_utc === "string" && entry.recorded_at_utc.trim() !== ""
    ? entry.recorded_at_utc.trim()
    : typeof entry.ts === "string" && entry.ts.trim() !== ""
      ? entry.ts.trim()
      : new Date().toISOString();
  const parsedUtcDate = Number.isNaN(Date.parse(timestampUtc)) ? new Date() : new Date(timestampUtc);
  const timestampLocal = typeof entry.recorded_at === "string" && entry.recorded_at.trim() !== ""
    ? entry.recorded_at.trim()
    : formatLocalIsoTimestamp(parsedUtcDate);
  const recordedTimezone = typeof entry.recorded_timezone === "string" && entry.recorded_timezone.trim() !== ""
    ? entry.recorded_timezone.trim()
    : resolveRecordedTimezone();
  const evidence = normalizeEvidence(entry);

  const lines = [`${timestampLocal} | LEARNING | ${normalizePath(neuronPath)}`];
  lines.push(`recorded_at: ${timestampLocal}`);
  lines.push(`recorded_at_utc: ${timestampUtc}`);
  lines.push(`recorded_timezone: ${recordedTimezone}`);
  if (typeof entry.summary === "string" && entry.summary.trim() !== "") lines.push(`summary: ${entry.summary.trim()}`);
  if (typeof entry.scope === "string" && entry.scope.trim() !== "") lines.push(`scope: ${entry.scope.trim()}`);
  if (typeof entry.audience === "string" && entry.audience.trim() !== "") lines.push(`audience: ${entry.audience.trim()}`);
  if (typeof entry.language === "string" && entry.language.trim() !== "") lines.push(`language: ${entry.language.trim()}`);
  if (typeof entry.role === "string" && entry.role.trim() !== "") lines.push(`role: ${entry.role.trim()}`);
  if (typeof entry.career_track === "string" && entry.career_track.trim() !== "") lines.push(`career_track: ${entry.career_track.trim()}`);
  if (typeof entry.surface === "string" && entry.surface.trim() !== "") lines.push(`surface: ${entry.surface.trim()}`);
  if (typeof entry.env === "string" && entry.env.trim() !== "") lines.push(`env: ${entry.env.trim()}`);
  if (typeof entry.skill === "string" && entry.skill.trim() !== "") lines.push(`skill: ${entry.skill.trim()}`);
  if (typeof entry.problem === "string" && entry.problem.trim() !== "") lines.push(`problem: ${entry.problem.trim()}`);
  if (typeof entry.encountered_at === "string" && entry.encountered_at.trim() !== "") lines.push(`encountered_at: ${entry.encountered_at.trim()}`);
  if (typeof entry.resolved_at === "string" && entry.resolved_at.trim() !== "") lines.push(`resolved_at: ${entry.resolved_at.trim()}`);
  if (typeof entry.root_cause === "string" && entry.root_cause.trim() !== "") lines.push(`root_cause: ${entry.root_cause.trim()}`);
  if (typeof entry.fix === "string" && entry.fix.trim() !== "") lines.push(`fix: ${entry.fix.trim()}`);
  if (typeof entry.context === "string" && entry.context.trim() !== "") lines.push(`context: ${entry.context.trim()}`);
  if (evidence.length > 0) {
    lines.push("evidence:");
    for (const item of evidence) lines.push(`- ${item}`);
  }
  if (typeof entry.source === "string" && entry.source.trim() !== "") lines.push(`source: ${entry.source.trim()}`);

  fs.writeFileSync(memoryPath, `${lines.join("\n")}\n`, "utf8");
}

function appendAutogrowthLog(line) {
  fs.appendFileSync(autogrowthLogPath, `${line}\n`, "utf8");
}

function applyEntry(entry, rawLine) {
  const scope = normalizeScope(entry.scope);
  const targetBrain = resolveTargetBrain(scope);
  let neuronPath = resolveNeuronPath(entry);

  if (isInvalidPath(neuronPath)) {
    log(`blocked suspicious path: ${neuronPath}`);
    return false;
  }

  appendAutogrowthLog(rawLine);

  const counterAdd = Number.isInteger(entry.counter_add) && entry.counter_add > 0 ? entry.counter_add : 1;
  for (let i = 0; i < counterAdd; i += 1) {
    const output = runNeuronfs(targetBrain, ["--fire", neuronPath]);
    neuronPath = parseResolvedPath(output, neuronPath);
  }
  writeLearningMemory(targetBrain, neuronPath, entry);
  log(`${scope} fire x${counterAdd} -> ${neuronPath}`);
  return true;
}

function rebuildRuntime() {
  const result = spawnSync("bash", [rebuildScript], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    const details = stderr || stdout || `exit ${result.status}`;
    throw new Error(`runtime rebuild failed: ${details}`);
  }

  log("runtime rebuilt from updated global/project/device brain");
}

function acquireProcessingFile() {
  if (fs.existsSync(processingPath)) return processingPath;
  if (!fs.existsSync(runtimeCorrectionsPath)) return "";
  const stat = fs.statSync(runtimeCorrectionsPath);
  if (stat.size === 0) return "";
  fs.renameSync(runtimeCorrectionsPath, processingPath);
  return processingPath;
}

function syncCorrectionsOnce() {
  ensureLayout();
  if (!fs.existsSync(neuronfsBinary)) {
    throw new Error(`NeuronFS binary not found: ${neuronfsBinary}`);
  }

  const sourcePath = acquireProcessingFile();
  if (!sourcePath) return false;

  const raw = fs.readFileSync(sourcePath, "utf8");
  const lines = raw.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  fs.rmSync(sourcePath, { force: true });
  if (lines.length === 0) return false;

  let processed = 0;
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (applyEntry(entry, line)) processed += 1;
    } catch {
      log(`skipped invalid correction line: ${line}`);
    }
  }

  if (processed > 0) {
    rebuildRuntime();
    log(`processed ${processed} correction entries`);
    return true;
  }

  return false;
}

async function main() {
  ensureLayout();
  if (onceMode) {
    syncCorrectionsOnce();
    return;
  }

  log(`cpdb autogrowth watching ${runtimeCorrectionsPath}`);
  while (keepRunning) {
    try {
      syncCorrectionsOnce();
    } catch (error) {
      log(error instanceof Error ? error.message : String(error));
    }
    await new Promise((resolve) => {
      setTimeout(resolve, Number.isFinite(pollMs) && pollMs > 0 ? pollMs : 2000);
    });
  }
  log("cpdb autogrowth stopped");
}

await main();
