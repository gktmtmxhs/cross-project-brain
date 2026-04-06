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

const careerTrackAliases = {
  general: "general",
  frontend: "frontend",
  front: "frontend",
  front_end: "frontend",
  web: "frontend",
  backend: "backend",
  back: "backend",
  api: "backend",
  fullstack: "fullstack",
  "full_stack": "fullstack",
  design: "design",
  ux: "design",
  product: "product",
  platform: "platform",
  infra: "platform",
  ops: "platform",
  security: "security",
  sec: "security",
  testing: "testing",
  qa: "testing",
  data: "data",
  ai: "ai",
  ml: "ai",
  mobile: "mobile",
  ios: "mobile",
  android: "mobile",
  content: "content",
  growth: "growth",
  education: "education",
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

function parseSkillRoleMap(raw) {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([key, value]) => typeof key === "string" && typeof value === "string")
        .map(([key, value]) => [sanitizeSegment(key, ""), normalizeRole(value)]),
    );
  } catch {
    return {};
  }
}

export const skillRoleMap = Object.freeze(parseSkillRoleMap(process.env.CPB_SKILL_ROLE_MAP_JSON || ""));

export function resolveRoleFromSkill(skillName, roleMap = skillRoleMap) {
  const key = sanitizeSegment(skillName, "");
  return roleMap[key] || null;
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

export function normalizeCareerTrack(rawCareerTrack) {
  if (rawCareerTrack == null || String(rawCareerTrack).trim() === "") {
    return "";
  }
  const key = sanitizeSegment(rawCareerTrack, "");
  return careerTrackAliases[key] || key;
}

export function defaultTopicForRole(roleName) {
  return roleDefaults[normalizeRole(roleName)] || roleDefaults.general;
}

export function buildRolePath({ role, skill, surface, env, topic, lesson, fallbackLesson, careerTrack }) {
  const resolvedRole = normalizeRole(role || resolveRoleFromSkill(skill) || "general");
  const resolvedSurface = normalizeSurface(surface);
  const resolvedEnv = normalizeEnv(env);
  const resolvedTopic = sanitizeSegment(topic, defaultTopicForRole(resolvedRole));
  const resolvedCareerTrack = normalizeCareerTrack(careerTrack);
  const resolvedLesson = sanitizeSegment(lesson || fallbackLesson, "lesson");
  const segments = ["cortex", resolvedRole];
  if (resolvedSurface) {
    segments.push(resolvedSurface);
  }
  if (resolvedEnv) {
    segments.push(resolvedEnv);
  }
  segments.push(resolvedTopic);
  if (resolvedCareerTrack) {
    segments.push(resolvedCareerTrack);
  }
  segments.push(resolvedLesson);
  return segments.join("/");
}
