const DEFAULT_ROLE_KEYWORDS = {
  frontend: [
    "frontend",
    "react",
    "tailwind",
    "vite",
    "component",
    "responsive",
    "render",
    "rendering",
    "state",
    "query",
    "css",
    "ui bug",
  ],
  backend: [
    "backend",
    "api",
    "endpoint",
    "callback",
    "webhook",
    "spring",
    "jpa",
    "database",
    " db ",
    "migration",
    "redis",
    "entitlement",
    "transaction",
  ],
  design: [
    "design",
    "redesign",
    "ux",
    "hierarchy",
    "cta",
    "typography",
    "visual",
    "color",
    "spacing",
    "design system",
    "layout",
  ],
  security: [
    "security",
    "auth",
    "authorization",
    "credential",
    "secret",
    "csrf",
    "xss",
    "hardening",
    "encrypt",
    "masking",
  ],
  testing: [
    "test",
    "tests",
    "qa",
    "smoke",
    "e2e",
    "regression",
    "verification",
    "verify",
    "assert",
    "contract test",
  ],
  platform: [
    "deploy",
    "deployment",
    "release",
    "ci",
    "cd",
    "workflow",
    "observability",
    "monitoring",
    "incident",
    "production",
    "docker",
    "k8s",
    "kubernetes",
    "infra",
    "ops",
  ],
  content: [
    "copy",
    "faq",
    "messaging",
    "docs",
    "documentation",
    "announcement",
    "onboarding text",
    "error copy",
  ],
  growth: [
    "growth",
    "conversion",
    "activation",
    "retention",
    "pricing",
    "seo",
    "social",
    "funnel",
    "landing",
  ],
  education: [
    "coaching",
    "curriculum",
    "practice",
    "piano",
    "guitar",
    "vocal",
    "drums",
    "harmony",
    "ear training",
  ],
  general: [
    "debug",
    "analysis",
    "workflow",
    "git",
    "recovery",
    "problem solving",
  ],
};

const DEFAULT_SURFACE_KEYWORDS = {
  web: ["web", "browser", "site", "landing", "page"],
  mobile: ["mobile", "app", "ios app", "android app", "native"],
  desktop: ["desktop", "electron", "mac app", "windows app"],
  admin: ["admin", "dashboard", "backoffice"],
  api: ["api", "endpoint", "server", "backend"],
  batch: ["batch", "worker", "job", "cron"],
};

const DEFAULT_ENV_KEYWORDS = {
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

const KNOWN_SURFACES = new Set(Object.keys(DEFAULT_SURFACE_KEYWORDS));
const KNOWN_ENVS = new Set(Object.keys(DEFAULT_ENV_KEYWORDS));
const REGION_LABELS = {
  brainstem: "P0",
  limbic: "P1",
  hippocampus: "P2",
  sensors: "P3",
  cortex: "P4",
  ego: "P5",
  prefrontal: "P6",
};

function parseJsonValue(raw, fallback) {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeStringMap(raw, fallback) {
  const parsed = parseJsonValue(raw, fallback);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fallback;
  }

  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([key, value]) => typeof key === "string" && typeof value === "string")
      .map(([key, value]) => [key, value]),
  );
}

function normalizeKeywordMap(raw, fallback) {
  const parsed = parseJsonValue(raw, fallback);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fallback;
  }

  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([key, value]) => typeof key === "string" && Array.isArray(value))
      .map(([key, value]) => [key, value.filter((item) => typeof item === "string")]),
  );
}

function escapeRegex(source) {
  return String(source).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePathHints(raw) {
  const parsed = parseJsonValue(raw, []);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const role = typeof entry.role === "string" ? entry.role : "";
      const pattern = typeof entry.pattern === "string" ? entry.pattern : "";
      if (!role || !pattern) {
        return null;
      }

      if (entry.mode === "regex") {
        try {
          const regex = new RegExp(pattern, typeof entry.flags === "string" ? entry.flags : "u");
          return {
            role,
            test(text) {
              return regex.test(text);
            },
          };
        } catch {
          return null;
        }
      }

      const needle = pattern.toLowerCase();
      if (!needle) {
        return null;
      }

      return {
        role,
        test(text) {
          return text.includes(needle);
        },
      };
    })
    .filter(Boolean);
}

const ROLE_KEYWORDS = normalizeKeywordMap(process.env.CPB_SELECTIVE_INJECTION_ROLE_KEYWORDS_JSON || "", DEFAULT_ROLE_KEYWORDS);
const SKILL_ROLE_MAP = normalizeStringMap(
  process.env.CPB_SELECTIVE_INJECTION_SKILL_ROLE_MAP_JSON || process.env.CPB_SKILL_ROLE_MAP_JSON || "",
  {},
);
const SURFACE_KEYWORDS = normalizeKeywordMap(process.env.CPB_SELECTIVE_INJECTION_SURFACE_KEYWORDS_JSON || "", DEFAULT_SURFACE_KEYWORDS);
const ENV_KEYWORDS = normalizeKeywordMap(process.env.CPB_SELECTIVE_INJECTION_ENV_KEYWORDS_JSON || "", DEFAULT_ENV_KEYWORDS);
const PATH_HINTS = parsePathHints(process.env.CPB_SELECTIVE_INJECTION_PATH_HINTS_JSON || "");

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^0-9a-z_\u3131-\u318e\uac00-\ud7af\u4e00-\u9fff]+/u)
    .filter(Boolean);
}

function collectStrings(value, out = [], depth = 0) {
  if (depth > 8 || value == null) {
    return out;
  }

  if (typeof value === "string") {
    out.push(value);
    return out;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    out.push(String(value));
    return out;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out, depth + 1);
    }
    return out;
  }

  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (typeof key === "string") {
        out.push(key);
      }
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
  const meta = {
    region,
    role: "",
    surface: "",
    env: "",
    topic: "",
    lesson: "",
  };

  if (region !== "cortex") {
    return meta;
  }

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

  for (const hint of PATH_HINTS) {
    if (hint.test(joined)) {
      roleScores.set(hint.role, (roleScores.get(hint.role) || 0) + 30);
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
    rawText: joined.trim(),
  };
}

function topicMatchScore(topic, tokens) {
  if (!topic) {
    return 0;
  }

  const topicTokens = tokenize(topic.replace(/_/g, " "));
  if (topicTokens.length === 0) {
    return 0;
  }

  let hits = 0;
  for (const token of topicTokens) {
    if (tokens.has(token)) {
      hits += 1;
    }
  }
  return hits * 15;
}

function lessonMatchScore(lesson, tokens) {
  if (!lesson) {
    return 0;
  }

  const lessonTokens = tokenize(lesson.replace(/_/g, " "));
  let hits = 0;
  for (const token of lessonTokens) {
    if (tokens.has(token)) {
      hits += 1;
    }
  }
  return hits * 3;
}

function scoreCortexNeuron(neuron, taskVector) {
  const meta = parseNeuronPath(neuron.path);
  let score = neuron.counter || 0;

  const primaryRole = taskVector.roles[0] || "";
  const secondaryRole = taskVector.roles[1] || "";

  if (meta.role && meta.role === primaryRole) {
    score += 120;
  } else if (meta.role && meta.role === secondaryRole) {
    score += 80;
  } else if (taskVector.roles.length > 0) {
    score -= 20;
  }

  if (taskVector.surface && meta.surface && meta.surface === taskVector.surface) {
    score += 20;
  }

  if (taskVector.env && meta.env && meta.env === taskVector.env) {
    score += 15;
  }

  score += topicMatchScore(meta.topic, taskVector.tokens);
  score += lessonMatchScore(meta.lesson, taskVector.tokens);

  return {
    ...neuron,
    meta,
    score,
  };
}

function selectTargetedCortexNeurons(cortexNeurons, taskVector, options = {}) {
  const maxRoles = options.maxRoles ?? 2;
  const maxPerRole = options.maxPerRole ?? 2;
  const maxTotal = options.maxTotal ?? 4;
  const scored = cortexNeurons.map((neuron) => scoreCortexNeuron(neuron, taskVector));
  const preferredRoles = taskVector.roles.slice(0, maxRoles);

  const byRole = new Map();
  let total = 0;

  for (const role of preferredRoles) {
    const picked = scored
      .filter((item) => item.meta.role === role)
      .sort((a, b) => b.score - a.score || b.counter - a.counter || a.path.localeCompare(b.path))
      .slice(0, maxPerRole);

    if (picked.length > 0) {
      byRole.set(role, picked);
      total += picked.length;
    }
  }

  if (total === 0) {
    return [];
  }

  const flat = [];
  for (const role of preferredRoles) {
    const items = byRole.get(role) || [];
    for (const item of items) {
      if (flat.length >= maxTotal) {
        break;
      }
      flat.push(item);
    }
  }

  const grouped = new Map();
  for (const item of flat) {
    if (!grouped.has(item.meta.role)) {
      grouped.set(item.meta.role, []);
    }
    grouped.get(item.meta.role).push(item);
  }

  return [...grouped.entries()].map(([role, items]) => ({ role, items }));
}

function buildFallbackLines(scanResult, maxPerRegion) {
  const lines = ["[NeuronFS Live Context]"];
  for (const [region, label] of Object.entries(REGION_LABELS)) {
    const neurons = (scanResult[region] || [])
      .slice()
      .sort((a, b) => b.counter - a.counter)
      .slice(0, maxPerRegion);

    if (neurons.length === 0) {
      continue;
    }

    const items = neurons.map((neuron) => formatNeuronPathForLine(neuron.path, region));
    lines.push(`[${label}] ${items.join(" | ")}`);
  }
  return lines;
}

function buildLiveContext(scanResult, payload, options = {}) {
  const maxPerRegion = options.maxPerRegion ?? 4;
  const maxRoles = options.maxRoles ?? 2;
  const maxPerRole = options.maxPerRole ?? 2;
  const maxTotal = options.maxTotal ?? 4;
  const taskVector = inferTaskVector(payload);
  const lines = ["[NeuronFS Live Context]"];

  for (const region of ["brainstem", "limbic", "hippocampus", "sensors", "ego", "prefrontal"]) {
    const neurons = (scanResult[region] || [])
      .slice()
      .sort((a, b) => b.counter - a.counter)
      .slice(0, maxPerRegion);

    if (neurons.length === 0) {
      continue;
    }

    const items = neurons.map((neuron) => formatNeuronPathForLine(neuron.path, region));
    lines.push(`[${REGION_LABELS[region]}] ${items.join(" | ")}`);
  }

  const cortexNeurons = (scanResult.cortex || []).slice();
  const groups = selectTargetedCortexNeurons(cortexNeurons, taskVector, {
    maxRoles,
    maxPerRole,
    maxTotal,
  });

  if (groups.length > 0) {
    for (const group of groups) {
      const items = group.items.map((item) => formatNeuronPathForLine(item.path, "cortex").replace(`${group.role} > `, ""));
      lines.push(`[${REGION_LABELS.cortex}:${group.role}] ${items.join(" | ")}`);
    }
    return {
      rules: lines.join("\n"),
      taskVector,
      mode: "targeted",
      groups,
    };
  }

  const fallback = buildFallbackLines(scanResult, maxPerRegion);
  return {
    rules: fallback.join("\n"),
    taskVector,
    mode: "fallback",
    groups: [],
  };
}

module.exports = {
  buildLiveContext,
  inferTaskVector,
  parseNeuronPath,
  selectTargetedCortexNeurons,
  tokenize,
};
