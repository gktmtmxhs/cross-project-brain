#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { agentRoot, operatorId, projectBrain, repoRoot } from "./cpb-paths.mjs";

const REGION_NAMES = ["brainstem", "limbic", "hippocampus", "sensors", "cortex", "ego", "prefrontal"];
const DEFAULT_MIN_COUNTER = 5;
const DEFAULT_STALE_DAYS = 21;
const DEFAULT_MAX_MEMORIES = 3;
const defaultArchiveRoot = path.join(agentRoot, "prune-archive", "operators", operatorId);
const auditLogPath = path.join(agentRoot, "logs", "operator-brain-prune.jsonl");
const usageScript = process.env.CPB_PRUNE_USAGE_SCRIPT || "scripts/cpb-prune-operator-brain.mjs";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseCounter(fileName) {
  const match = /^(\d+)\.neuron$/u.exec(fileName);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function parseDopamine(fileName) {
  const match = /^dopamine(\d+)\.neuron$/u.exec(fileName);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function isNeuronFile(fileName) {
  return fileName.endsWith(".neuron");
}

function listNeuronDirectories(brainRoot) {
  const dirs = [];

  for (const regionName of REGION_NAMES) {
    const regionPath = path.join(brainRoot, regionName);
    if (!fs.existsSync(regionPath) || !fs.statSync(regionPath).isDirectory()) {
      continue;
    }

    const walk = (dirPath) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const neuronFiles = entries.filter((entry) => entry.isFile() && isNeuronFile(entry.name));
      if (neuronFiles.length > 0) {
        dirs.push(dirPath);
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        if (entry.name.startsWith(".") || entry.name.startsWith("_")) {
          continue;
        }
        walk(path.join(dirPath, entry.name));
      }
    };

    walk(regionPath);
  }

  return dirs.sort();
}

export function scanOperatorBrain(brainRoot, { now = new Date() } = {}) {
  const nowMs = now.getTime();
  const neurons = [];

  if (!fs.existsSync(brainRoot)) {
    return neurons;
  }

  for (const dirPath of listNeuronDirectories(brainRoot)) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let counter = 0;
    let dopamine = 0;
    let hasBomb = false;
    let isDormant = false;
    let newestModMs = 0;
    const memoryFiles = [];

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const fullPath = path.join(dirPath, entry.name);
      const stat = fs.statSync(fullPath);
      newestModMs = Math.max(newestModMs, stat.mtimeMs);

      if (/^memory\d+\.neuron$/u.test(entry.name)) {
        memoryFiles.push({
          name: entry.name,
          fullPath,
          mtimeMs: stat.mtimeMs,
        });
        continue;
      }

      if (entry.name === "bomb.neuron") {
        hasBomb = true;
        continue;
      }

      if (entry.name.endsWith(".dormant")) {
        isDormant = true;
        continue;
      }

      counter = Math.max(counter, parseCounter(entry.name));
      dopamine += parseDopamine(entry.name);
    }

    const relativePath = path.relative(brainRoot, dirPath).replaceAll("\\", "/");
    const ageDays = newestModMs > 0 ? Math.floor((nowMs - newestModMs) / (24 * 60 * 60 * 1000)) : 0;

    neurons.push({
      relativePath,
      fullPath: dirPath,
      counter,
      dopamine,
      hasBomb,
      isDormant,
      newestModMs,
      ageDays,
      memoryFiles: memoryFiles.sort((a, b) => b.mtimeMs - a.mtimeMs),
    });
  }

  return neurons;
}

export function planOperatorBrainPrune(neurons, {
  minCounter = DEFAULT_MIN_COUNTER,
  staleDays = DEFAULT_STALE_DAYS,
  maxMemories = DEFAULT_MAX_MEMORIES,
} = {}) {
  const dormantCandidates = [];
  const memoryArchiveCandidates = [];

  for (const neuron of neurons) {
    if (!neuron.isDormant && !neuron.hasBomb && neuron.counter < minCounter && neuron.ageDays >= staleDays) {
      dormantCandidates.push({
        relativePath: neuron.relativePath,
        fullPath: neuron.fullPath,
        counter: neuron.counter,
        ageDays: neuron.ageDays,
      });
    }

    if (neuron.memoryFiles.length > maxMemories) {
      const archiveFiles = neuron.memoryFiles
        .slice(maxMemories)
        .sort((a, b) => a.mtimeMs - b.mtimeMs)
        .map((file) => ({
          ...file,
          relativePath: neuron.relativePath,
        }));
      memoryArchiveCandidates.push(...archiveFiles);
    }
  }

  return {
    dormantCandidates,
    memoryArchiveCandidates,
  };
}

function appendAudit(logPath, event, detail) {
  ensureDir(path.dirname(logPath));
  fs.appendFileSync(
    logPath,
    `${JSON.stringify({ ts: new Date().toISOString(), event, ...detail })}\n`,
    "utf8",
  );
}

function moveFile(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  try {
    fs.renameSync(sourcePath, targetPath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EXDEV") {
      fs.copyFileSync(sourcePath, targetPath);
      fs.unlinkSync(sourcePath);
      return;
    }
    throw error;
  }
}

export function applyOperatorBrainPrune(plan, {
  archiveRoot = defaultArchiveRoot,
  rebuild = true,
  minCounter = DEFAULT_MIN_COUNTER,
  staleDays = DEFAULT_STALE_DAYS,
  auditPath = auditLogPath,
} = {}) {
  let changes = 0;

  for (const candidate of plan.dormantCandidates) {
    const dormantFile = path.join(candidate.fullPath, "decay.dormant");
    if (fs.existsSync(dormantFile)) {
      continue;
    }
    fs.writeFileSync(
      dormantFile,
      [
        `Decayed: ${new Date().toISOString()}`,
        "Reason: weak_operator_rule",
        `Counter: ${candidate.counter}`,
        `AgeDays: ${candidate.ageDays}`,
        `Threshold: counter < ${minCounter}, age >= ${staleDays}`,
      ].join("\n") + "\n",
      "utf8",
    );
    changes += 1;
    appendAudit(auditPath, "operator_brain_dormant", {
      path: candidate.relativePath,
      counter: candidate.counter,
      ageDays: candidate.ageDays,
    });
  }

  for (const file of plan.memoryArchiveCandidates) {
    const targetPath = path.join(archiveRoot, file.relativePath, file.name);
    moveFile(file.fullPath, targetPath);
    changes += 1;
    appendAudit(auditPath, "operator_brain_memory_archived", {
      path: file.relativePath,
      file: file.name,
      archivePath: targetPath,
    });
  }

  if (changes > 0 && rebuild) {
    const rebuildScript = process.env.CPB_REBUILD_RUNTIME_SCRIPT || path.join(repoRoot, "scripts", "cpb-rebuild-runtime-brain.sh");
    const result = spawnSync("bash", [rebuildScript], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      const stderr = (result.stderr || "").trim();
      const stdout = (result.stdout || "").trim();
      const details = stderr || stdout || `exit ${result.status}`;
      throw new Error(`runtime rebuild failed after prune: ${details}`);
    }
  }

  return { changes };
}

function parseArgs(argv) {
  const options = {
    apply: false,
    json: false,
    rebuild: true,
    minCounter: DEFAULT_MIN_COUNTER,
    staleDays: DEFAULT_STALE_DAYS,
    maxMemories: DEFAULT_MAX_MEMORIES,
    brainRoot: projectBrain,
    archiveRoot: defaultArchiveRoot,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--apply":
        options.apply = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--no-rebuild":
        options.rebuild = false;
        break;
      case "--min-counter":
        options.minCounter = Number.parseInt(next, 10);
        i += 1;
        break;
      case "--stale-days":
        options.staleDays = Number.parseInt(next, 10);
        i += 1;
        break;
      case "--max-memories":
        options.maxMemories = Number.parseInt(next, 10);
        i += 1;
        break;
      case "--brain":
        options.brainRoot = path.resolve(next);
        i += 1;
        break;
      case "--archive-root":
        options.archiveRoot = path.resolve(next);
        i += 1;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function usage() {
  process.stdout.write(
    `Usage: node ${usageScript} [--apply] [--json] [--min-counter <n>] [--stale-days <n>] [--max-memories <n>] [--brain <path>] [--archive-root <path>] [--no-rebuild]\n`,
  );
}

function formatTextReport({ brainRoot, archiveRoot, options, neurons, plan, appliedChanges = 0 }) {
  const lines = [
    "CPB operator prune report",
    `brain: ${brainRoot}`,
    `archive: ${archiveRoot}`,
    `policy: dormant if counter < ${options.minCounter} and age >= ${options.staleDays} days`,
    `policy: keep latest ${options.maxMemories} memory*.neuron files per neuron`,
    `neurons scanned: ${neurons.length}`,
    `dormant candidates: ${plan.dormantCandidates.length}`,
    `memory archive candidates: ${plan.memoryArchiveCandidates.length}`,
  ];

  if (options.apply) {
    lines.push(`applied changes: ${appliedChanges}`);
  }

  if (plan.dormantCandidates.length > 0) {
    lines.push("", "Dormant candidates:");
    for (const candidate of plan.dormantCandidates.slice(0, 20)) {
      lines.push(`- ${candidate.relativePath} (counter=${candidate.counter}, age=${candidate.ageDays}d)`);
    }
  }

  if (plan.memoryArchiveCandidates.length > 0) {
    lines.push("", "Memory archive candidates:");
    for (const item of plan.memoryArchiveCandidates.slice(0, 20)) {
      lines.push(`- ${item.relativePath}/${item.name}`);
    }
  }

  if (plan.dormantCandidates.length === 0 && plan.memoryArchiveCandidates.length === 0) {
    lines.push("", "No prune actions needed.");
  }

  return `${lines.join("\n")}\n`;
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    usage();
    process.exit(1);
  }

  if (options.help) {
    usage();
    process.exit(0);
  }

  const neurons = scanOperatorBrain(options.brainRoot);
  const plan = planOperatorBrainPrune(neurons, options);
  let appliedChanges = 0;

  if (options.apply) {
    const result = applyOperatorBrainPrune(plan, options);
    appliedChanges = result.changes;
  }

  const report = {
    brainRoot: options.brainRoot,
    archiveRoot: options.archiveRoot,
    operatorId,
    options: {
      minCounter: options.minCounter,
      staleDays: options.staleDays,
      maxMemories: options.maxMemories,
      apply: options.apply,
      rebuild: options.rebuild,
    },
    totals: {
      neuronsScanned: neurons.length,
      dormantCandidates: plan.dormantCandidates.length,
      memoryArchiveCandidates: plan.memoryArchiveCandidates.length,
      appliedChanges,
    },
    plan,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  process.stdout.write(formatTextReport({
    brainRoot: options.brainRoot,
    archiveRoot: options.archiveRoot,
    options,
    neurons,
    plan,
    appliedChanges,
  }));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
