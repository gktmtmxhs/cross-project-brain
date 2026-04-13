#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

function usage() {
  process.stdout.write(`Usage: node scripts/cpb-check-updates.mjs [options]

Options:
  --repo-root <path>   consumer repo root (default: current working directory)
  --force              bypass cache freshness checks
  -h, --help           show this help
`);
}

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    force: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case "--repo-root":
        options.repoRoot = argv[index + 1] ?? "";
        index += 1;
        break;
      case "--force":
        options.force = true;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${value}`);
    }
  }

  return options;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function normalizeCache(cache) {
  if (!cache || typeof cache !== "object") {
    return null;
  }
  return {
    frameworkRepoUrl: String(cache.frameworkRepoUrl || ""),
    updateRef: String(cache.updateRef || ""),
    installedCommit: String(cache.installedCommit || ""),
    latestCommit: String(cache.latestCommit || ""),
    checkedAt: String(cache.checkedAt || ""),
    noticeAt: String(cache.noticeAt || ""),
    hasUpdate: cache.hasUpdate === true,
  };
}

function shortSha(value) {
  return String(value || "").slice(0, 7);
}

function cacheMatches(cache, lock) {
  if (!cache) {
    return false;
  }
  return (
    cache.frameworkRepoUrl === lock.frameworkRepoUrl &&
    cache.updateRef === lock.updateRef &&
    cache.installedCommit === lock.installedCommit
  );
}

function isRecent(timestamp, maxAgeMs) {
  const value = Date.parse(timestamp);
  return Number.isFinite(value) && Date.now() - value < maxAgeMs;
}

function resolveLatestCommit(repoUrl, updateRef) {
  const timeoutMs = Number(process.env.CPB_UPDATE_CHECK_GIT_TIMEOUT_MS || 1500);
  const candidates = [updateRef, `refs/heads/${updateRef}`];

  for (const ref of candidates) {
    const result = spawnSync("git", ["ls-remote", repoUrl, ref], {
      encoding: "utf8",
      timeout: timeoutMs,
    });
    if (result.status !== 0) {
      continue;
    }
    const line = result.stdout
      .split(/\r?\n/u)
      .map((entry) => entry.trim())
      .find(Boolean);
    if (!line) {
      continue;
    }
    const [sha] = line.split(/\s+/u);
    if (/^[0-9a-f]{40}$/u.test(sha || "")) {
      return sha;
    }
  }

  return "";
}

function buildNotice(lock, latestCommit) {
  const source = lock.frameworkReleaseRepo
    ? `https://github.com/${lock.frameworkReleaseRepo}`
    : lock.frameworkRepoUrl;
  return [
    `CPB update available: ${shortSha(lock.installedCommit)} -> ${shortSha(latestCommit)}`,
    "Run: bash bin/cpb upgrade-framework",
    source ? `Source: ${source}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

let options;
try {
  options = parseArgs(process.argv);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  usage();
  process.exit(1);
}

if (options.help) {
  usage();
  process.exit(0);
}

const repoRoot = path.resolve(options.repoRoot || process.cwd());
const lockPath = path.join(repoRoot, "config", "cpdb", "framework.lock.json");
const lock = loadJson(lockPath);
if (!lock) {
  process.exit(0);
}

const frameworkRepoUrl = String(lock.frameworkRepoUrl || "");
const updateRef = String(lock.updateRef || "");
const installedCommit = String(lock.installedCommit || "");
if (!frameworkRepoUrl || !updateRef || !installedCommit) {
  process.exit(0);
}

const projectId = path.basename(repoRoot);
const agentRoot = process.env.CPB_AGENT_ROOT || path.join(repoRoot, ".agent", "cross-project-brain", projectId);
const cachePath = path.join(agentRoot, "state", "framework-update-check.json");
const ttlMs = Number(process.env.CPB_UPDATE_CHECK_TTL_SECONDS || 86400) * 1000;
const noticeIntervalMs = Number(process.env.CPB_UPDATE_NOTICE_INTERVAL_SECONDS || 86400) * 1000;
const existingCache = normalizeCache(loadJson(cachePath));

const effectiveLock = {
  frameworkRepoUrl,
  frameworkReleaseRepo: String(lock.frameworkReleaseRepo || ""),
  updateRef,
  installedCommit,
};

if (!options.force && cacheMatches(existingCache, effectiveLock) && isRecent(existingCache.checkedAt, ttlMs)) {
  if (
    existingCache.hasUpdate &&
    (!existingCache.noticeAt || !isRecent(existingCache.noticeAt, noticeIntervalMs))
  ) {
    process.stderr.write(`${buildNotice(effectiveLock, existingCache.latestCommit)}\n`);
    saveJson(cachePath, {
      ...existingCache,
      noticeAt: new Date().toISOString(),
    });
  }
  process.exit(0);
}

const latestCommit = resolveLatestCommit(frameworkRepoUrl, updateRef);
if (!latestCommit) {
  process.exit(0);
}

const hasUpdate = latestCommit !== installedCommit;
const cachePayload = {
  frameworkRepoUrl,
  updateRef,
  installedCommit,
  latestCommit,
  checkedAt: new Date().toISOString(),
  noticeAt: hasUpdate ? new Date().toISOString() : "",
  hasUpdate,
};
saveJson(cachePath, cachePayload);

if (hasUpdate) {
  process.stderr.write(`${buildNotice(effectiveLock, latestCommit)}\n`);
}
