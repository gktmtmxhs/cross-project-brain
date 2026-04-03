#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { runtimeBrain } from "./cpb-paths.mjs";
import {
  buildRolePath,
  normalizeEnv,
  normalizeRole,
  normalizeSurface,
  resolveRoleFromSkill,
  sanitizeSegment,
} from "./cpb-role-taxonomy.mjs";

const inboxPath = path.join(runtimeBrain, "_inbox", "corrections.jsonl");
const currentFilePath = fileURLToPath(import.meta.url);

function usage() {
  process.stderr.write(
    "Usage: node scripts/cpb-log-learning.mjs (--path <neuron-path> | [--role <role> | --skill <skill-name>] [--surface <surface>] [--env <env>] [--topic <topic>] [--lesson <lesson-name>]) --summary <text> [--scope <project|global|device>] [--audience <shared|personal|hiring>] [--language <lang>] [--problem <text>] [--root-cause <text>] [--fix <text>] [--context <text>] [--evidence <text>]... [--counter-add <n>] [--source <name>]\n",
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
      case "--problem":
        result.problem = next;
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

export function normalizeLanguage(language, audience) {
  const value = String(language || "").trim().toLowerCase();
  if (value) {
    return value;
  }

  const normalizedAudience = normalizeAudience(audience);
  if (normalizedAudience === "shared") {
    return String(process.env.CPB_SHARED_LANGUAGE || "en").trim().toLowerCase();
  }
  if (normalizedAudience === "hiring") {
    return String(process.env.CPB_HIRING_LANGUAGE || "ko").trim().toLowerCase();
  }
  return String(process.env.CPB_PERSONAL_LANGUAGE || "ko").trim().toLowerCase();
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
    lesson: entry.lesson,
    fallbackLesson: typeof entry.summary === "string" ? sanitizeSegment(entry.summary, "lesson") : "lesson",
  });
}

export function normalizeEntry(entry) {
  const normalized = {
    ...entry,
    ts: new Date().toISOString(),
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

  normalized.path = resolveLearningPath(normalized);
  normalized.role = normalizeRole(normalized.role || resolveRoleFromSkill(normalized.skill) || "general");
  normalized.audience = inferAudience(normalized);
  normalized.language = normalizeLanguage(normalized.language, normalized.audience);
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
    process.stderr.write(`${error.message}\n`);
    usage();
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  runCli();
}
