#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function gitConfig(repoRoot, key) {
  const result = spawnSync("git", ["config", key], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
}

function sanitizeOperatorId(raw) {
  const sanitized = String(raw || "operator")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return sanitized || "operator";
}

function normalizeIdentitySource(raw) {
  const value = String(raw || "");
  const withoutEmailDomain = value.includes("@") ? value.split("@")[0] : value;
  return sanitizeOperatorId(withoutEmailDomain);
}

export const repoRoot = process.env.CPB_REPO_ROOT || path.resolve(scriptDir, "..", "..", "..");
export const projectId = String(process.env.CPB_PROJECT_ID || path.basename(repoRoot) || "project");

const operatorRaw =
  process.env.CPB_OPERATOR ||
  gitConfig(repoRoot, "github.user") ||
  gitConfig(repoRoot, "user.email") ||
  gitConfig(repoRoot, "user.name") ||
  process.env.USER ||
  "operator";

export const operatorId = normalizeIdentitySource(operatorRaw);
export const personalRepo = process.env.CPB_PERSONAL_REPO || "";
export const agentRoot =
  process.env.CPB_AGENT_ROOT ||
  path.join(repoRoot, ".agent", "cross-project-brain", projectId);
export const globalBrain =
  process.env.CPB_GLOBAL_BRAIN ||
  (personalRepo
    ? path.join(personalRepo, "brains", "global-operators", operatorId, "brain_v4")
    : path.join(repoRoot, "brains", "global-operators", operatorId, "brain_v4"));
export const teamBrain =
  process.env.CPB_TEAM_BRAIN ||
  path.join(repoRoot, "brains", "team-brain", "brain_v4");
export const projectBrain =
  process.env.CPB_PROJECT_BRAIN ||
  path.join(repoRoot, "brains", "project-operators", operatorId, "brain_v4");
export const runtimeBrain =
  process.env.CPB_RUNTIME_BRAIN ||
  path.join(agentRoot, "runtime-brain", "brain_v4");
export const careerDocsRoot =
  process.env.CPB_CAREER_DOCS_ROOT ||
  (personalRepo
    ? path.join(personalRepo, "docs", "career", "operators", operatorId)
    : path.join(repoRoot, "docs", "career", "operators", operatorId));
export const neuronfsInstallDir =
  process.env.CPB_NEURONFS_INSTALL_DIR ||
  path.join(repoRoot, ".tools", "neuronfs");
