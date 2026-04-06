#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { runtimeBrain } from "./cpb-paths.mjs";
import {
  buildRolePath,
  normalizeCareerTrack,
  normalizeEnv,
  normalizeRole,
  normalizeSurface,
  resolveRoleFromSkill,
  sanitizeSegment,
} from "./cpb-role-taxonomy.mjs";

const inboxPath = path.join(runtimeBrain, "_inbox", "corrections.jsonl");
const currentFilePath = fileURLToPath(import.meta.url);
const usageScript = process.env.CPB_LOG_LEARNING_USAGE_SCRIPT || "scripts/cpb-log-learning.mjs";

function usage() {
  process.stderr.write(
    `Usage: node ${usageScript} (--path <neuron-path> | [--role <role> | --skill <skill-name>] [--surface <surface>] [--env <env>] [--topic <topic>] [--career-track <track>] [--lesson <lesson-name>]) --summary <text> [--scope <project|global|device>] [--audience <shared|personal|hiring>] [--language <lang>] [--encountered-at <date>] [--resolved-at <date>] [--problem <text>] [--root-cause <text>] [--fix <text>] [--context <text>] [--evidence <text>]... [--counter-add <n>] [--source <name>]\n`,
  );
}

export function parseArgs(argv) {
  const result = {
    type: "learning",
    source: "agent",
    scope: "project",
    counter_add: 1,
    evidence: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "--path":
        result.path = next;
        i += 1;
        break;
      case "--summary":
        result.summary = next;
        i += 1;
        break;
      case "--scope":
        result.scope = next;
        i += 1;
        break;
      case "--audience":
        result.audience = next;
        i += 1;
        break;
      case "--language":
        result.language = next;
        i += 1;
        break;
      case "--role":
        result.role = next;
        i += 1;
        break;
      case "--skill":
        result.skill = next;
        i += 1;
        break;
      case "--topic":
        result.topic = next;
        i += 1;
        break;
      case "--surface":
        result.surface = next;
        i += 1;
        break;
      case "--env":
        result.env = next;
        i += 1;
        break;
      case "--lesson":
        result.lesson = next;
        i += 1;
        break;
      case "--career-track":
        result.career_track = next;
        i += 1;
        break;
      case "--problem":
        result.problem = next;
        i += 1;
        break;
      case "--encountered-at":
        result.encountered_at = next;
        i += 1;
        break;
      case "--resolved-at":
        result.resolved_at = next;
        i += 1;
        break;
      case "--root-cause":
        result.root_cause = next;
        i += 1;
        break;
      case "--fix":
        result.fix = next;
        i += 1;
        break;
      case "--context":
        result.context = next;
        i += 1;
        break;
      case "--evidence":
        result.evidence.push(next);
        i += 1;
        break;
      case "--source":
        result.source = next;
        i += 1;
        break;
      case "--counter-add":
        result.counter_add = Number.parseInt(next, 10);
        i += 1;
        break;
      case "-h":
      case "--help":
        usage();
        process.exit(0);
      default:
        process.stderr.write(`Unknown argument: ${arg}\n`);
        usage();
        process.exit(1);
    }
  }

  return result;
}

export function normalizePath(neuronPath) {
  return String(neuronPath).replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

export function normalizeScope(scope) {
  const value = String(scope || "project").trim().toLowerCase();
  if (value === "global") {
    return "global";
  }
  if (value === "device") {
    return "device";
  }
  return "project";
}

export function normalizeAudience(audience) {
  const value = String(audience || "").trim().toLowerCase();
  if (value === "personal" || value === "private" || value === "self") {
    return "personal";
  }
  if (value === "hiring" || value === "interview" || value === "career" || value === "job") {
    return "hiring";
  }
  return "shared";
}

export function inferAudience(entry) {
  if (entry.audience) {
    return normalizeAudience(entry.audience);
  }

  const topic = sanitizeSegment(entry.topic, "");
  const lesson = sanitizeSegment(entry.lesson, "");
  const pathHint = normalizePath(entry.path || "");
  const hiringKeywords = new Set(["interview", "star", "resume", "case_study", "portfolio"]);

  if (
    hiringKeywords.has(topic) ||
    hiringKeywords.has(lesson) ||
    /\/(interview|star|resume|case_study|portfolio)(\/|$)/u.test(pathHint)
  ) {
    return "hiring";
  }

  return "shared";
}

export function inferCareerTrack(entry) {
  if (entry.career_track) {
    return normalizeCareerTrack(entry.career_track);
  }

  const audience = normalizeAudience(entry.audience);
  if (audience !== "hiring") {
    return "";
  }

  if (entry.role && String(entry.role).trim() !== "") {
    return "";
  }

  const inferredRole = normalizeRole(resolveRoleFromSkill(entry.skill) || "general");
  if (inferredRole === "general" || inferredRole === "content") {
    return "";
  }

  return normalizeCareerTrack(inferredRole);
}

export function normalizeLanguage(language, audience) {
  const value = String(language || "").trim().toLowerCase();
  if (value) {
    return value;
  }

  const normalizedAudience = normalizeAudience(audience);
  if (normalizedAudience === "shared") {
    return String(process.env.CPB_SHARED_LANGUAGE || process.env.MUINONE_NEURONFS_SHARED_LANGUAGE || "en").trim().toLowerCase();
  }
  if (normalizedAudience === "hiring") {
    return String(process.env.CPB_HIRING_LANGUAGE || process.env.MUINONE_NEURONFS_HIRING_LANGUAGE || "ko").trim().toLowerCase();
  }
  return String(process.env.CPB_PERSONAL_LANGUAGE || process.env.MUINONE_NEURONFS_PERSONAL_LANGUAGE || "ko").trim().toLowerCase();
}

export function normalizeOptionalDateValue(value) {
  if (value == null) {
    return "";
  }
  return String(value).trim();
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

export function resolveRecordedTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || process.env.TZ || "local";
}

export function formatLocalIsoTimestamp(date = new Date()) {
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

export function resolveLearningPath(entry) {
  if (typeof entry.path === "string" && entry.path.trim() !== "") {
    return normalizePath(entry.path.trim());
  }
  return buildRolePath({
    role: entry.role,
    skill: entry.skill,
    surface: entry.surface,
    env: entry.env,
    topic: entry.topic,
    careerTrack: entry.career_track,
    lesson: entry.lesson,
    fallbackLesson: typeof entry.summary === "string" ? sanitizeSegment(entry.summary, "lesson") : "lesson",
  });
}

export function normalizeEntry(entry) {
  const now = new Date();
  const normalized = {
    ...entry,
    ts: now.toISOString(),
    scope: normalizeScope(entry.scope),
  };

  if (typeof normalized.summary !== "string" || normalized.summary.trim() === "") {
    throw new Error("--summary is required");
  }

  const hasPathHints =
    (typeof normalized.path === "string" && normalized.path.trim() !== "") ||
    (typeof normalized.role === "string" && normalized.role.trim() !== "") ||
    (typeof normalized.skill === "string" && normalized.skill.trim() !== "") ||
    (typeof normalized.lesson === "string" && normalized.lesson.trim() !== "");

  if (!hasPathHints) {
    throw new Error("one of --path, --role, --skill, or --lesson is required");
  }

  normalized.role = normalizeRole(normalized.role || resolveRoleFromSkill(normalized.skill) || "general");
  normalized.audience = inferAudience(entry);
  normalized.language = normalizeLanguage(normalized.language, normalized.audience);
  normalized.career_track = inferCareerTrack({
    role: entry.role,
    skill: entry.skill,
    audience: normalized.audience,
    career_track: entry.career_track,
  });
  normalized.recorded_at_utc = normalized.ts;
  normalized.recorded_at = formatLocalIsoTimestamp(now);
  normalized.recorded_timezone = resolveRecordedTimezone();
  normalized.encountered_at = normalizeOptionalDateValue(entry.encountered_at);
  normalized.resolved_at = normalizeOptionalDateValue(entry.resolved_at);
  normalized.path = resolveLearningPath(normalized);
  if (normalized.surface) {
    normalized.surface = normalizeSurface(normalized.surface);
  }
  if (normalized.env) {
    normalized.env = normalizeEnv(normalized.env);
  }
  if (normalized.topic) {
    normalized.topic = sanitizeSegment(normalized.topic, "patterns");
  }
  if (normalized.lesson) {
    normalized.lesson = sanitizeSegment(normalized.lesson, "lesson");
  }
  if (!normalized.career_track) {
    delete normalized.career_track;
  }
  if (!normalized.encountered_at) {
    delete normalized.encountered_at;
  }
  if (!normalized.resolved_at) {
    delete normalized.resolved_at;
  }

  if (!Number.isInteger(normalized.counter_add) || normalized.counter_add <= 0) {
    normalized.counter_add = 1;
  }

  if (!Array.isArray(normalized.evidence) || normalized.evidence.length === 0) {
    delete normalized.evidence;
  }

  return normalized;
}

export function queueLearning(rawEntry, targetInboxPath = inboxPath) {
  const entry = normalizeEntry(rawEntry);
  fs.mkdirSync(path.dirname(targetInboxPath), { recursive: true });
  fs.appendFileSync(targetInboxPath, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

export function runCli(argv = process.argv.slice(2)) {
  try {
    const entry = queueLearning(parseArgs(argv));
    process.stdout.write(`queued learning [${entry.scope}/${entry.role}] -> ${entry.path}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    usage();
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  runCli();
}
