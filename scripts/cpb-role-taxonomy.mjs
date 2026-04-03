#!/usr/bin/env node

export const roleDefaults = {
  general: "patterns",
  frontend: "implementation",
  backend: "contracts",
  design: "systems",
  security: "hardening",
  testing: "verification",
  platform: "operations",
  content: "messaging",
  growth: "conversion",
  education: "coaching",
};

const surfaceAliases = {
  web: "web",
  browser: "web",
  mobile: "mobile",
  app: "mobile",
  native: "mobile",
  desktop: "desktop",
  admin: "admin",
  dashboard: "admin",
  api: "api",
  server: "api",
  batch: "batch",
  worker: "batch",
};

const envAliases = {
  browser: "browser",
  chrome: "browser",
  safari: "browser",
  firefox: "browser",
  edge: "browser",
  ios: "ios",
  android: "android",
  linux: "linux",
  ubuntu: "linux",
  debian: "linux",
  windows: "windows",
  win: "windows",
  powershell: "windows",
  macos: "macos",
  mac: "macos",
  osx: "macos",
  server: "server",
  docker: "docker",
  k8s: "k8s",
  kubernetes: "k8s",
};

export const skillRoleMap = {
  "agents-orchestrator": "general",
  "frontend-developer": "frontend",
  "backend-architect": "backend",
  "api-tester": "testing",
  "ui-ux-pro-max": "design",
  "security-engineer": "security",
  "reality-checker": "platform",
  "content-creator": "content",
  "growth-hacker": "growth",
  "behavioral-nudge-engine": "growth",
  "seo-specialist": "growth",
  "social-media-strategist": "growth",
  "practical-music-educator": "education",
};

const roleAliases = {
  general: "general",
  core: "general",
  frontend: "frontend",
  front: "frontend",
  ui: "frontend",
  backend: "backend",
  back: "backend",
  api: "backend",
  design: "design",
  ux: "design",
  uiux: "design",
  security: "security",
  sec: "security",
  testing: "testing",
  test: "testing",
  qa: "testing",
  platform: "platform",
  ops: "platform",
  infra: "platform",
  observability: "platform",
  operation: "platform",
  operations: "platform",
  release: "platform",
  deploy: "platform",
  deployment: "platform",
  cicd: "platform",
  "ci_cd": "platform",
  content: "content",
  copy: "content",
  growth: "growth",
  seo: "growth",
  social: "growth",
  education: "education",
  coach: "education",
};

export function sanitizeSegment(raw, fallback = "lesson") {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^0-9a-z_\-\u3131-\u318e\uac00-\ud7af\u4e00-\u9fff]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (value || fallback).slice(0, 60);
}

export function normalizeRole(rawRole, fallback = "general") {
  const key = sanitizeSegment(rawRole, fallback);
  return roleAliases[key] || fallback;
}

export function resolveRoleFromSkill(skillName) {
  const key = sanitizeSegment(skillName, "");
  return skillRoleMap[key] || null;
}

export function normalizeSurface(rawSurface) {
  if (rawSurface == null || String(rawSurface).trim() === "") {
    return "";
  }
  const key = sanitizeSegment(rawSurface, "");
  return surfaceAliases[key] || key;
}

export function normalizeEnv(rawEnv) {
  if (rawEnv == null || String(rawEnv).trim() === "") {
    return "";
  }
  const key = sanitizeSegment(rawEnv, "");
  return envAliases[key] || key;
}

export function defaultTopicForRole(roleName) {
  return roleDefaults[normalizeRole(roleName)] || roleDefaults.general;
}

export function buildRolePath({ role, skill, surface, env, topic, lesson, fallbackLesson }) {
  const resolvedRole = normalizeRole(role || resolveRoleFromSkill(skill) || "general");
  const resolvedSurface = normalizeSurface(surface);
  const resolvedEnv = normalizeEnv(env);
  const resolvedTopic = sanitizeSegment(topic, defaultTopicForRole(resolvedRole));
  const resolvedLesson = sanitizeSegment(lesson || fallbackLesson, "lesson");
  const segments = ["cortex", resolvedRole];
  if (resolvedSurface) {
    segments.push(resolvedSurface);
  }
  if (resolvedEnv) {
    segments.push(resolvedEnv);
  }
  segments.push(resolvedTopic, resolvedLesson);
  return segments.join("/");
}
