#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export function gitConfig(repoRoot, key) {
  const result = spawnSync("git", ["config", key], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return "";
  }
  return result.stdout.trim();
}

export function sanitizeOperatorId(raw) {
  const sanitized = String(raw || "operator")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return sanitized || "operator";
}

export function normalizeIdentitySource(raw) {
  const value = String(raw || "");
  const withoutEmailDomain = value.includes("@") ? value.split("@")[0] : value;
  return sanitizeOperatorId(withoutEmailDomain);
}

export function detectOperatorId(repoRoot, preferredRaw = process.env.CPB_OPERATOR || "") {
  const raw =
    preferredRaw ||
    gitConfig(repoRoot, "github.user") ||
    gitConfig(repoRoot, "user.email") ||
    gitConfig(repoRoot, "user.name") ||
    process.env.USER ||
    "operator";

  return normalizeIdentitySource(raw);
}

export function trackedProjectOperatorsRootDefault(repoRoot) {
  return path.join(repoRoot, "brains", "project-operators");
}

export function trackedProjectBrainPath(trackedProjectOperatorsRoot, operatorId) {
  return path.join(trackedProjectOperatorsRoot, operatorId, "brain_v4");
}

export function personalProjectBrainPath(personalRepo, projectId, operatorId) {
  return path.join(personalRepo, "brains", "project-operators", operatorId, projectId, "brain_v4");
}

export function resolveCpbPaths(options = {}) {
  const repoRoot = options.repoRoot || process.env.CPB_REPO_ROOT || path.resolve(options.scriptDir || scriptDir, "..");
  const projectId = options.projectId || process.env.CPB_PROJECT_ID || path.basename(repoRoot);
  const operatorId =
    options.operatorId ||
    process.env.CPB_OPERATOR_ID ||
    detectOperatorId(repoRoot, options.operator || process.env.CPB_OPERATOR || "");
  const personalRepo = options.personalRepo ?? process.env.CPB_PERSONAL_REPO ?? "";
  const trackedProjectOperatorsRoot =
    options.trackedProjectOperatorsRoot ||
    process.env.CPB_TRACKED_PROJECT_OPERATORS_ROOT ||
    trackedProjectOperatorsRootDefault(repoRoot);
  const agentRoot =
    options.agentRoot || process.env.CPB_AGENT_ROOT || path.join(repoRoot, ".agent", "cross-project-brain", projectId);
  const globalBrain =
    options.globalBrain ||
    process.env.CPB_GLOBAL_BRAIN ||
    (personalRepo
      ? path.join(personalRepo, "brains", "global-operators", operatorId, "brain_v4")
      : path.join(repoRoot, "brains", "global-operators", operatorId, "brain_v4"));
  const teamBrain =
    options.teamBrain || process.env.CPB_TEAM_BRAIN || path.join(repoRoot, "brains", "team-brain", "brain_v4");
  const projectBrainDefault = personalRepo
    ? personalProjectBrainPath(personalRepo, projectId, operatorId)
    : trackedProjectBrainPath(trackedProjectOperatorsRoot, operatorId);
  const projectBrain = options.projectBrain || process.env.CPB_PROJECT_BRAIN || projectBrainDefault;
  const deviceBrain =
    options.deviceBrain || process.env.CPB_DEVICE_BRAIN || path.join(agentRoot, "device-brain", "brain_v4");
  const runtimeBrain =
    options.runtimeBrain || process.env.CPB_RUNTIME_BRAIN || path.join(agentRoot, "runtime-brain", "brain_v4");
  const careerDocsRoot =
    options.careerDocsRoot ||
    process.env.CPB_CAREER_DOCS_ROOT ||
    (personalRepo
      ? path.join(personalRepo, "docs", "career", "operators", operatorId)
      : path.join(repoRoot, "docs", "career", "operators", operatorId));
  const neuronfsInstallDir =
    options.neuronfsInstallDir || process.env.NEURONFS_INSTALL_DIR || path.join(repoRoot, ".tools", "neuronfs");

  return {
    repoRoot,
    projectId,
    operatorId,
    personalRepo,
    trackedProjectOperatorsRoot,
    agentRoot,
    globalBrain,
    teamBrain,
    projectBrain,
    userBrain: projectBrain,
    deviceBrain,
    runtimeBrain,
    careerDocsRoot,
    neuronfsInstallDir,
  };
}

const resolvedPaths = resolveCpbPaths({ scriptDir });

export const repoRoot = resolvedPaths.repoRoot;
export const projectId = resolvedPaths.projectId;
export const operatorId = resolvedPaths.operatorId;
export const personalRepo = resolvedPaths.personalRepo;
export const trackedProjectOperatorsRoot = resolvedPaths.trackedProjectOperatorsRoot;
export const agentRoot = resolvedPaths.agentRoot;
export const globalBrain = resolvedPaths.globalBrain;
export const teamBrain = resolvedPaths.teamBrain;
export const projectBrain = resolvedPaths.projectBrain;
export const userBrain = resolvedPaths.userBrain;
export const deviceBrain = resolvedPaths.deviceBrain;
export const runtimeBrain = resolvedPaths.runtimeBrain;
export const careerDocsRoot = resolvedPaths.careerDocsRoot;
export const neuronfsInstallDir = resolvedPaths.neuronfsInstallDir;
