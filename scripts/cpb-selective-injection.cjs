const ROLE_KEYWORDS = {
  frontend: [
    "frontend", "react", "tailwind", "vite", "component", "responsive", "render",
    "rendering", "state", "query", "css", "ui bug",
  ],
  backend: [
    "backend", "api", "endpoint", "callback", "webhook", "spring", "jpa", "database",
    " db ", "migration", "redis", "entitlement", "transaction",
  ],
  design: [
    "design", "redesign", "ux", "hierarchy", "cta", "typography", "visual",
    "color", "spacing", "design system", "layout",
  ],
  security: [
    "security", "auth", "authorization", "credential", "secret", "csrf", "xss",
    "hardening", "encrypt", "masking",
  ],
  testing: [
    "test", "tests", "qa", "smoke", "e2e", "regression", "verification",
    "verify", "assert", "contract test",
  ],
  platform: [
    "deploy", "deployment", "release", "ci", "cd", "workflow", "observability",
    "monitoring", "incident", "production", "docker", "k8s", "kubernetes",
    "infra", "ops",
  ],
  content: [
    "copy", "faq", "messaging", "docs", "documentation", "announcement",
    "onboarding text", "error copy",
  ],
  growth: [
    "growth", "conversion", "activation", "retention", "pricing", "seo",
    "social", "funnel", "landing",
  ],
  education: [
    "coaching", "curriculum", "practice", "piano", "guitar", "vocal",
    "drums", "harmony", "ear training",
  ],
  general: ["debug", "analysis", "workflow", "git", "recovery", "problem solving"],
};

const SKILL_ROLE_MAP = {
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
  "project-explainer": "content",
};

const SURFACE_KEYWORDS = {
  web: ["web", "browser", "site", "landing", "page"],
  mobile: ["mobile", "app", "ios app", "android app", "native"],
  desktop: ["desktop", "electron", "mac app", "windows app"],
  admin: ["admin", "dashboard", "backoffice"],
  api: ["api", "endpoint", "server", "backend"],
  batch: ["batch", "worker", "job", "cron"],
};

const ENV_KEYWORDS = {
  browser: ["browser", "chrome", "safari", "firefox", "edge"],
  linux: ["linux", "ubuntu", "debian"],
  windows: ["windows", "powershell", "win32"],
  macos: ["macos", "mac", "osx"],
  ios: ["ios"],
  android: ["android"],
  server: ["server"],
  docker: ["docker", "container"],
  k8s: ["k8s", "kubernetes"],
};

const KNOWN_SURFACES = new Set(Object.keys(SURFACE_KEYWORDS));
const KNOWN_ENVS = new Set(Object.keys(ENV_KEYWORDS));
const REGION_LABELS = {
  brainstem: "P0",
  limbic: "P1",
  hippocampus: "P2",
  sensors: "P3",
  cortex: "P4",
  ego: "P5",
  prefrontal: "P6",
};

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^0-9a-z_\u3131-\u318e\uac00-\ud7af\u4e00-\u9fff]+/u)
    .filter(Boolean);
}

function collectStrings(value, out = [], depth = 0) {
  if (depth > 8 || value == null) return out;
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    out.push(String(value));
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
    return out;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      out.push(key);
      collectStrings(nested, out, depth + 1);
    }
  }
  return out;
}

function uniqueSorted(entries) {
  return [...new Set(entries)].sort();
}

function parseNeuronPath(neuronPath) {
  const parts = String(neuronPath || "")
    .split(/[>/]/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const region = parts[0] || "";
  const meta = { region, role: "", surface: "", env: "", topic: "", lesson: "" };
  if (region !== "cortex") return meta;

  let index = 1;
  meta.role = parts[index] || "";
  index += 1;
  if (KNOWN_SURFACES.has(parts[index])) {
    meta.surface = parts[index];
    index += 1;
  }
  if (KNOWN_ENVS.has(parts[index])) {
    meta.env = parts[index];
    index += 1;
  }
  meta.topic = parts[index] || "";
  meta.lesson = parts.slice(index + 1).join("_");
  return meta;
}

function formatNeuronPathForLine(neuronPath, region) {
  return String(neuronPath || "")
    .replace(`${region}>`, "")
    .replace(/>/g, " > ")
    .replace(/_/g, " ");
}

function scoreKeywordMap(text, scoreMap, keywordMap, weight) {
  for (const [key, keywords] of Object.entries(keywordMap)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        scoreMap.set(key, (scoreMap.get(key) || 0) + weight);
      }
    }
  }
}

function inferTaskVector(payload) {
  const strings = collectStrings(payload);
  const joined = ` ${strings.join(" \n ").toLowerCase()} `;
  const tokens = new Set(tokenize(joined));
  const roleScores = new Map();
  const surfaceScores = new Map();
  const envScores = new Map();
  const matchedSkills = [];

  for (const [skill, role] of Object.entries(SKILL_ROLE_MAP)) {
    if (joined.includes(skill)) {
      matchedSkills.push(skill);
      roleScores.set(role, (roleScores.get(role) || 0) + 100);
    }
  }

  scoreKeywordMap(joined, roleScores, ROLE_KEYWORDS, 8);
  scoreKeywordMap(joined, surfaceScores, SURFACE_KEYWORDS, 12);
  scoreKeywordMap(joined, envScores, ENV_KEYWORDS, 12);

  const pathHints = [
    [/(^|\/)(frontend|src\/components|src\/pages)(\/|$)/u, "frontend"],
    [/(^|\/)(backend|api|server)(\/|$)/u, "backend"],
    [/design-system|tokens|typography/u, "design"],
    [/\.(github\/workflows)|githooks|deploy|observability|infra/u, "platform"],
    [/(^|\/)docs(\/|$)/u, "content"],
  ];

  for (const [pattern, role] of pathHints) {
    if (pattern.test(joined)) {
      roleScores.set(role, (roleScores.get(role) || 0) + 30);
    }
  }

  const sortedRoles = [...roleScores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([role]) => role)
    .slice(0, 2);

  const sortedSurfaces = [...surfaceScores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([surface]) => surface)
    .slice(0, 1);

  const sortedEnvs = [...envScores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([env]) => env)
    .slice(0, 1);

  return {
    matchedSkills: uniqueSorted(matchedSkills),
    roles: sortedRoles,
    surface: sortedSurfaces[0] || "",
    env: sortedEnvs[0] || "",
    tokens,
  };
}

function topicMatchScore(topic, tokens) {
  if (!topic) return 0;
  const topicTokens = tokenize(topic.replace(/_/g, " "));
  let hits = 0;
  for (const token of topicTokens) {
    if (tokens.has(token)) hits += 1;
  }
  return hits * 15;
}

function lessonMatchScore(lesson, tokens) {
  if (!lesson) return 0;
  const lessonTokens = tokenize(lesson.replace(/_/g, " "));
  let hits = 0;
  for (const token of lessonTokens) {
    if (tokens.has(token)) hits += 1;
  }
  return hits * 8;
}

function scoreNeuron(neuron, vector) {
  const meta = parseNeuronPath(neuron.path);
  let score = neuron.counter || 0;

  if (meta.region !== "cortex") return score;
  if (vector.roles.includes(meta.role)) score += 70;
  if (vector.surface && meta.surface && vector.surface === meta.surface) score += 25;
  if (vector.env && meta.env && vector.env === meta.env) score += 20;
  score += topicMatchScore(meta.topic, vector.tokens);
  score += lessonMatchScore(meta.lesson, vector.tokens);
  return score;
}

function selectCortexNeurons(scanResult, vector, maxRoles, maxPerRole) {
  const cortexItems = (scanResult.cortex || []).map((neuron) => ({
    ...neuron,
    meta: parseNeuronPath(neuron.path),
    score: scoreNeuron(neuron, vector),
  }));

  const selectedRoles = vector.roles.slice(0, maxRoles);
  if (selectedRoles.length === 0) {
    return cortexItems.sort((a, b) => b.score - a.score).slice(0, maxPerRole);
  }

  const picks = [];
  for (const role of selectedRoles) {
    const perRole = cortexItems
      .filter((item) => item.meta.role === role)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPerRole);
    picks.push(...perRole);
  }

  if (picks.length === 0) {
    return cortexItems.sort((a, b) => b.score - a.score).slice(0, maxPerRole);
  }

  return uniqueSorted(picks.map((item) => item.path))
    .map((pickedPath) => cortexItems.find((item) => item.path === pickedPath))
    .filter(Boolean);
}

function buildRoleHintLine(vector) {
  const parts = [];
  if (vector.roles.length > 0) parts.push(`roles=${vector.roles.join(",")}`);
  if (vector.surface) parts.push(`surface=${vector.surface}`);
  if (vector.env) parts.push(`env=${vector.env}`);
  if (vector.matchedSkills.length > 0) parts.push(`skills=${vector.matchedSkills.join(",")}`);
  if (parts.length === 0) return "";
  return `[Targeted Context] ${parts.join(" | ")}`;
}

function buildLiveContext(scanResult, payload, options = {}) {
  const maxPerRegion = Number.isFinite(options.maxPerRegion) ? options.maxPerRegion : 4;
  const maxRoles = Number.isFinite(options.maxRoles) ? options.maxRoles : 2;
  const maxPerRole = Number.isFinite(options.maxPerRole) ? options.maxPerRole : 2;
  const maxTotal = Number.isFinite(options.maxTotal) ? options.maxTotal : maxPerRegion;
  const vector = inferTaskVector(payload);

  const lines = ["[NeuronFS Live Context]"];
  const hintLine = buildRoleHintLine(vector);
  if (hintLine) lines.push(hintLine);

  for (const [region, label] of Object.entries(REGION_LABELS)) {
    const source = scanResult[region] || [];
    if (source.length === 0) continue;

    let picked;
    if (region === "cortex") {
      picked = selectCortexNeurons(scanResult, vector, maxRoles, maxPerRole)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxTotal);
    } else {
      picked = [...source].sort((a, b) => b.counter - a.counter).slice(0, maxPerRegion);
    }

    if (picked.length === 0) continue;
    const items = picked.map((item) => formatNeuronPathForLine(item.path, region));
    lines.push(`[${label}] ${items.join(" | ")}`);
  }

  return { vector, rules: lines.join("\n") };
}

module.exports = {
  buildLiveContext,
  inferTaskVector,
  parseNeuronPath,
};
