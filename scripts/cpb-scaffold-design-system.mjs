#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const defaultRepoRoot = path.resolve(scriptDir, "..");

const presetCatalog = {
  "product-ui": {
    label: "Product UI",
    narrative:
      "Build a calm but confident application surface. The UI should feel precise, warm, and trustworthy rather than hyper-minimal or overly playful.",
    keywords: ["clear", "confident", "warm", "structured"],
    density: "balanced",
    contrast: "balanced",
    componentPriorities: ["navigation", "forms", "buttons", "cards", "empty states"],
    color: {
      primary: "#0F766E",
      accent: "#F59E0B",
      canvas: "#FCFCF9",
      surface: "#FFFFFF",
      surfaceAlt: "#F2F5F3",
      textStrong: "#102027",
      textMuted: "#52606D",
      border: "#D7E1DD",
      info: "#2563EB",
      success: "#15803D",
      warning: "#B45309",
      danger: "#B42318",
    },
    typography: {
      headingFamily: "Space Grotesk",
      bodyFamily: "IBM Plex Sans",
      monoFamily: "IBM Plex Mono",
      scalePx: { xs: 12, sm: 14, base: 16, lg: 18, xl: 24, "2xl": 32, "3xl": 40, "4xl": 56 },
    },
    spacing: { baseUnitPx: 4, scalePx: [4, 8, 12, 16, 24, 32, 48, 64, 96] },
    radius: { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },
    motion: {
      level: "medium",
      durationMs: { fast: 120, base: 180, slow: 280 },
      guidance: "Use staggered reveals and section transitions only when they improve hierarchy or orientation.",
    },
    layout: { maxContentWidthPx: 1200, gridColumns: 12, readingWidthCh: 70 },
  },
  console: {
    label: "Operational Console",
    narrative:
      "Prefer dense clarity over decorative polish. The interface should help operators scan quickly, compare states, and spot exceptions with minimal motion.",
    keywords: ["operational", "direct", "legible", "compact"],
    density: "compact",
    contrast: "strong",
    componentPriorities: ["tables", "filters", "alerts", "side navigation", "audit views"],
    color: {
      primary: "#0F172A",
      accent: "#0891B2",
      canvas: "#F6F8FB",
      surface: "#FFFFFF",
      surfaceAlt: "#EEF2F7",
      textStrong: "#111827",
      textMuted: "#4B5563",
      border: "#D6DEE8",
      info: "#0369A1",
      success: "#15803D",
      warning: "#B45309",
      danger: "#B42318",
    },
    typography: {
      headingFamily: "IBM Plex Sans",
      bodyFamily: "IBM Plex Sans",
      monoFamily: "IBM Plex Mono",
      scalePx: { xs: 12, sm: 13, base: 15, lg: 18, xl: 22, "2xl": 28, "3xl": 36, "4xl": 48 },
    },
    spacing: { baseUnitPx: 4, scalePx: [4, 8, 12, 16, 20, 24, 32, 40, 56] },
    radius: { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 },
    motion: {
      level: "low",
      durationMs: { fast: 100, base: 140, slow: 220 },
      guidance: "Default to instant feedback. Reserve animation for layout continuity or critical state changes.",
    },
    layout: { maxContentWidthPx: 1440, gridColumns: 12, readingWidthCh: 78 },
  },
  editorial: {
    label: "Editorial System",
    narrative:
      "Use a more expressive type voice and generous spacing. This preset suits content-forward products where reading rhythm and visual tone matter more than dashboard density.",
    keywords: ["expressive", "editorial", "spacious", "human"],
    density: "relaxed",
    contrast: "balanced",
    componentPriorities: ["feature blocks", "article layouts", "hero sections", "callouts", "media cards"],
    color: {
      primary: "#9A3412",
      accent: "#0F766E",
      canvas: "#FCF7F0",
      surface: "#FFFDF8",
      surfaceAlt: "#F5EDE1",
      textStrong: "#2A211B",
      textMuted: "#6B5A4A",
      border: "#E7D9C6",
      info: "#2563EB",
      success: "#15803D",
      warning: "#B45309",
      danger: "#B42318",
    },
    typography: {
      headingFamily: "Fraunces",
      bodyFamily: "Source Sans 3",
      monoFamily: "IBM Plex Mono",
      scalePx: { xs: 12, sm: 14, base: 18, lg: 20, xl: 28, "2xl": 36, "3xl": 48, "4xl": 64 },
    },
    spacing: { baseUnitPx: 4, scalePx: [4, 8, 12, 16, 24, 32, 48, 72, 96] },
    radius: { sm: 8, md: 14, lg: 18, xl: 28, pill: 999 },
    motion: {
      level: "low",
      durationMs: { fast: 120, base: 180, slow: 260 },
      guidance: "Keep motion subtle. Prioritize scroll rhythm, image transitions, and reading comfort over ornamental animation.",
    },
    layout: { maxContentWidthPx: 1180, gridColumns: 12, readingWidthCh: 74 },
  },
  "concept-starter": {
    label: "Concept Starter",
    narrative:
      "Use this as a first-pass design system for greenfield work. It provides enough structure for rapid prototyping while leaving room for a later brand pass.",
    keywords: ["exploratory", "clear", "adaptable", "early-stage"],
    density: "balanced",
    contrast: "balanced",
    componentPriorities: ["hero sections", "navigation", "forms", "feature cards", "trust elements"],
    color: {
      primary: "#155EEF",
      accent: "#CA8A04",
      canvas: "#F7F8FC",
      surface: "#FFFFFF",
      surfaceAlt: "#EEF2FF",
      textStrong: "#172033",
      textMuted: "#55607A",
      border: "#D8DFF5",
      info: "#2563EB",
      success: "#15803D",
      warning: "#B45309",
      danger: "#B42318",
    },
    typography: {
      headingFamily: "Space Grotesk",
      bodyFamily: "IBM Plex Sans",
      monoFamily: "IBM Plex Mono",
      scalePx: { xs: 12, sm: 14, base: 16, lg: 18, xl: 24, "2xl": 32, "3xl": 42, "4xl": 56 },
    },
    spacing: { baseUnitPx: 4, scalePx: [4, 8, 12, 16, 24, 32, 48, 64, 88] },
    radius: { sm: 8, md: 14, lg: 22, xl: 32, pill: 999 },
    motion: {
      level: "medium",
      durationMs: { fast: 120, base: 180, slow: 280 },
      guidance: "Keep prototypes lively enough to communicate hierarchy, but avoid locking in elaborate motion too early.",
    },
    layout: { maxContentWidthPx: 1240, gridColumns: 12, readingWidthCh: 72 },
  },
};

function usage() {
  process.stdout.write(`Usage: node scripts/cpb-scaffold-design-system.mjs [options]

Options:
  --repo-root <path>         target repo root (default: script parent repo)
  --style <preset>           one of: ${Object.keys(presetCatalog).join(", ")}
  --primary <hex>            override the preset primary color
  --motion <level>           one of: low, medium, high
  --force                    overwrite previously generated files
  -h, --help                 show this help

Examples:
  node scripts/cpb-scaffold-design-system.mjs
  node scripts/cpb-scaffold-design-system.mjs --style product-ui --primary "#0F766E"
`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value, force) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  return writeTextFile(filePath, content, force);
}

function writeTextFile(filePath, content, force) {
  if (fs.existsSync(filePath) && !force) {
    return "kept";
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  return fs.existsSync(filePath) ? "written" : "kept";
}

function sanitizePreset(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function normalizeHexColor(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    fail(`Invalid hex color: ${value}`);
  }
  const bare = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  return `#${bare.toUpperCase()}`;
}

function humanizeProjectType(value) {
  const raw = String(value || "unknown").trim();
  if (!raw) {
    return "Unknown";
  }
  return raw
    .split("-")
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

function inferPreset(projectType, stack) {
  const stackSet = new Set(Array.isArray(stack) ? stack : []);
  if (projectType === "web-app" || projectType === "fullstack-app") {
    return "product-ui";
  }
  if (projectType === "api-service" || projectType === "cli") {
    return "console";
  }
  if (projectType === "library") {
    return "editorial";
  }
  if (projectType === "greenfield") {
    return "concept-starter";
  }
  if (stackSet.has("react") || stackSet.has("nextjs") || stackSet.has("vite")) {
    return "product-ui";
  }
  if (stackSet.has("spring") || stackSet.has("go") || stackSet.has("python")) {
    return "console";
  }
  return "concept-starter";
}

function inferMotion(presetName, override) {
  if (override) {
    if (!["low", "medium", "high"].includes(override)) {
      fail(`Unsupported motion level: ${override}`);
    }
    return override;
  }
  return presetCatalog[presetName].motion.level;
}

function starterSkillStatus(repoRoot) {
  const designSystem = path.join(repoRoot, ".codex", "skills", "design-system", "SKILL.md");
  const uiUxAlias = path.join(repoRoot, ".codex", "skills", "ui-ux-pro-max", "SKILL.md");
  return {
    designSystem: fs.existsSync(designSystem),
    uiUxAlias: fs.existsSync(uiUxAlias),
  };
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function buildDesignSystemConfig({ repoRoot, profile, presetName, primaryColor, motionLevel, starterSkills, generatedAt }) {
  const preset = presetCatalog[presetName];
  const projectName = profile.projectName || path.basename(repoRoot);
  const projectType = profile.projectType || "unknown";
  const stack = Array.isArray(profile.stack) && profile.stack.length > 0 ? unique(profile.stack) : ["unknown"];
  const detectedSignals =
    Array.isArray(profile.detectedSignals) && profile.detectedSignals.length > 0 ? unique(profile.detectedSignals) : [];

  return {
    version: 1,
    generatedAt,
    project: {
      name: projectName,
      type: projectType,
      typeLabel: humanizeProjectType(projectType),
      summary: profile.projectSummary || "",
      sharedRepo: Boolean(profile.sharedRepo),
      detectionMode: profile.detectionMode || "unknown",
      stack,
      detectedSignals,
    },
    starterSkills: {
      designSystem: starterSkills.designSystem,
      uiUxProMax: starterSkills.uiUxAlias,
    },
    preset: presetName,
    presetLabel: preset.label,
    direction: {
      narrative: preset.narrative,
      keywords: preset.keywords,
      density: preset.density,
      contrast: preset.contrast,
      componentPriorities: preset.componentPriorities,
    },
    foundations: {
      color: {
        ...preset.color,
        primary: primaryColor || preset.color.primary,
      },
      typography: preset.typography,
      spacing: preset.spacing,
      radius: preset.radius,
      motion: {
        ...preset.motion,
        level: motionLevel,
      },
      layout: preset.layout,
    },
    adoptionPlan: [
      "Keep this scaffold as the source of truth for shared visual rules before component-level polish begins.",
      "Mirror final token names into app code after the first production-facing UI pass, not before.",
      "Use DESIGN.md for the fast working contract, docs/arch/design-system.md for deeper rationale, and config/cpdb/design-system.json for machine-readable consumption.",
      starterSkills.designSystem || starterSkills.uiUxAlias
        ? "Pair this scaffold with the imported design starter skill when asking coding agents for UI changes."
        : "Import a curated design starter skill later if you want stronger UI-specific prompting support.",
    ],
  };
}

function renderDesignContractDoc(config) {
  const { project, starterSkills, presetLabel, preset, direction, foundations } = config;
  const starterSkillLine =
    starterSkills.designSystem || starterSkills.uiUxProMax
      ? "Yes. Prefer the imported design skill, then adapt it to this repo's local rules."
      : "No. This scaffold is still useful, but importing the design starter skill can improve UI prompting later.";

  return `# ${project.name} Design Contract

- Generated At (UTC): ${config.generatedAt}
- Owner: Frontend / Design
- Project: ${project.name}
- Project Type: ${project.type}
- Shared Repo: ${project.sharedRepo}
- Project Summary: ${project.summary || "TODO: replace this placeholder with a product-specific summary."}
- Preset: ${preset} (${presetLabel})
- Starter Design Skill Available: ${starterSkillLine}

## Purpose

- \`DESIGN.md\` is the fast design contract for humans and agents working in this repo.
- Use this file as the default entrypoint for current project-level UI decisions, defaults, and change workflow.
- Keep exact token values in \`config/cpdb/design-system.json\`, not here.
- Keep deeper rationale, rollout notes, and exceptions in \`docs/arch/design-system.md\`.

## Document Roles

- \`DESIGN.md\`: current design-system rules, defaults, and reusable-vs-local boundaries.
- \`docs/arch/design-system.md\`: rationale, rollout notes, detailed token tables, and exceptions.
- \`config/cpdb/design-system.json\`: machine-readable scaffold source for tools and future codegen.
- If the documents drift after real UI code exists, update code first, then \`config/cpdb/design-system.json\`, then \`DESIGN.md\`, then \`docs/arch/design-system.md\`.

## Source Of Truth

Use this order when making UI decisions:

1. Shared tokens, primitives, and shells in product code once they exist
2. \`config/cpdb/design-system.json\`
3. \`DESIGN.md\`
4. \`docs/arch/design-system.md\`

## Design Direction

${direction.narrative}

- Keywords: ${direction.keywords.join(", ")}
- Density: ${direction.density}
- Contrast: ${direction.contrast}
- Initial Component Priorities: ${direction.componentPriorities.join(", ")}

## Core Global Defaults

- Prefer shared tokens and semantic names before introducing one-off raw values.
- Typography defaults: heading ${foundations.typography.headingFamily}, body ${foundations.typography.bodyFamily}, mono ${foundations.typography.monoFamily}.
- Layout defaults: max content width ${foundations.layout.maxContentWidthPx}px, ${foundations.layout.gridColumns}-column grid, reading width ${foundations.layout.readingWidthCh}ch.
- Shape defaults: radius scale sm ${foundations.radius.sm}px, md ${foundations.radius.md}px, lg ${foundations.radius.lg}px, xl ${foundations.radius.xl}px.
- Motion defaults: ${foundations.motion.level} motion with durations ${foundations.motion.durationMs.fast}/${foundations.motion.durationMs.base}/${foundations.motion.durationMs.slow}ms.
- Promote repeated shells and component patterns into shared primitives before copying them into more than one feature.
- Keep exploratory branded exceptions local until they prove stable enough to become reusable rules.

## Working Rules

1. Decide whether a UI change is one-off or a reusable design rule.
2. If reusable, update the code source of truth first once tokens or shared primitives exist.
3. Keep \`config/cpdb/design-system.json\` aligned with stable shared decisions.
4. Document the current working contract in \`DESIGN.md\`.
5. Extend \`docs/arch/design-system.md\` only when the change needs rationale, migration notes, or exceptions worth preserving.

## Current Next Step

- Replace placeholder product or brand language after the first real design review.
- Promote only stable reusable rules into this file.
- Keep the full token table and adoption rationale in \`docs/arch/design-system.md\`.
`;
}

function renderArchitectureDesignSystemDoc(config) {
  const { project, presetLabel, preset, foundations, direction } = config;
  const scaleRows = Object.entries(foundations.typography.scalePx)
    .map(([token, value]) => `| ${token} | ${value}px |`)
    .join("\n");
  const spacingScale = foundations.spacing.scalePx.map((value) => `\`${value}px\``).join(", ");

  return `# Design System Architecture

- Generated At (UTC): ${config.generatedAt}
- Project: ${project.name}
- Preset: ${preset} (${presetLabel})
- Purpose: deeper rationale, token reference, and rollout notes behind \`DESIGN.md\`

## Why This Exists

- Keep \`DESIGN.md\` short enough to act as the default human or agent contract.
- Keep this file for the detailed reasoning, token tables, and migration notes that would otherwise make \`DESIGN.md\` noisy.
- Use \`config/cpdb/design-system.json\` as the machine-readable source when codegen or tooling needs exact values.

## Design Direction

${direction.narrative}

- Keywords: ${direction.keywords.join(", ")}
- Density: ${direction.density}
- Contrast: ${direction.contrast}
- Initial Component Priorities: ${direction.componentPriorities.join(", ")}

## Color Tokens

| Token | Value |
| --- | --- |
| primary | ${foundations.color.primary} |
| accent | ${foundations.color.accent} |
| canvas | ${foundations.color.canvas} |
| surface | ${foundations.color.surface} |
| surfaceAlt | ${foundations.color.surfaceAlt} |
| textStrong | ${foundations.color.textStrong} |
| textMuted | ${foundations.color.textMuted} |
| border | ${foundations.color.border} |
| info | ${foundations.color.info} |
| success | ${foundations.color.success} |
| warning | ${foundations.color.warning} |
| danger | ${foundations.color.danger} |

## Typography Scale

| Token | Size |
| --- | --- |
${scaleRows}

- Heading Family: ${foundations.typography.headingFamily}
- Body Family: ${foundations.typography.bodyFamily}
- Mono Family: ${foundations.typography.monoFamily}

## Spacing, Radius, Layout, and Motion

- Base Unit: ${foundations.spacing.baseUnitPx}px
- Spacing Scale: ${spacingScale}
- Radius: sm ${foundations.radius.sm}px, md ${foundations.radius.md}px, lg ${foundations.radius.lg}px, xl ${foundations.radius.xl}px, pill ${foundations.radius.pill}px
- Grid Columns: ${foundations.layout.gridColumns}
- Max Content Width: ${foundations.layout.maxContentWidthPx}px
- Reading Width: ${foundations.layout.readingWidthCh}ch
- Motion Level: ${foundations.motion.level}
- Motion Durations: fast ${foundations.motion.durationMs.fast}ms, base ${foundations.motion.durationMs.base}ms, slow ${foundations.motion.durationMs.slow}ms
- Motion Guidance: ${foundations.motion.guidance}

## Adoption Plan

${config.adoptionPlan.map((item) => `- ${item}`).join("\n")}

## Review Checklist

- Ensure new pages use shared tokens before introducing one-off values.
- Keep component density aligned with the chosen design direction: ${direction.density}.
- Validate contrast and hierarchy in real screenshots before promoting component rules into shared docs.
- Sync this file only when the decision needs deeper rationale than \`DESIGN.md\` should carry.
`;
}

function renderBrainSeed(config) {
  return `# Design System Seed

- Generated by \`cpb scaffold-design-system\`
- Preset: ${config.preset} (${config.presetLabel})
- Project Type: ${config.project.type}
- Keywords: ${config.direction.keywords.join(", ")}
- Primary Color: ${config.foundations.color.primary}
- Accent Color: ${config.foundations.color.accent}
- Typography: ${config.foundations.typography.headingFamily} / ${config.foundations.typography.bodyFamily}
- Motion Level: ${config.foundations.motion.level}

## How To Use This

- Treat this file as a quick pointer for agent context, not the full design source of truth.
- Start with \`DESIGN.md\` for the current working contract.
- Use \`docs/arch/design-system.md\` for deeper rationale and detailed foundation tables.
- Promote only stable visual rules here after they survive actual product work.
`;
}

function parseArgs(argv) {
  const parsed = {
    repoRoot: defaultRepoRoot,
    style: "",
    primary: "",
    motion: "",
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case "--repo-root":
        parsed.repoRoot = path.resolve(argv[index + 1]);
        index += 1;
        break;
      case "--style":
        parsed.style = sanitizePreset(argv[index + 1]);
        index += 1;
        break;
      case "--primary":
        parsed.primary = normalizeHexColor(argv[index + 1]);
        index += 1;
        break;
      case "--motion":
        parsed.motion = String(argv[index + 1] || "").trim().toLowerCase();
        index += 1;
        break;
      case "--force":
        parsed.force = true;
        break;
      case "-h":
      case "--help":
        usage();
        process.exit(0);
        break;
      default:
        fail(`Unknown argument: ${value}`);
    }
  }

  return parsed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.repoRoot) || !fs.statSync(args.repoRoot).isDirectory()) {
    fail(`Repo root does not exist: ${args.repoRoot}`);
  }

  const profilePath = path.join(args.repoRoot, "config", "cpdb", "project-profile.json");
  const profile = readJsonIfExists(profilePath) || {
    projectName: path.basename(args.repoRoot),
    projectType: "unknown",
    projectSummary: "",
    sharedRepo: false,
    detectionMode: "missing",
    stack: [],
    detectedSignals: [],
  };

  const presetName = args.style || inferPreset(profile.projectType, profile.stack);
  if (!presetCatalog[presetName]) {
    fail(`Unsupported style preset: ${presetName}`);
  }

  const starterSkills = starterSkillStatus(args.repoRoot);
  const generatedAt = new Date().toISOString();
  const config = buildDesignSystemConfig({
    repoRoot: args.repoRoot,
    profile,
    presetName,
    primaryColor: args.primary,
    motionLevel: inferMotion(presetName, args.motion),
    starterSkills,
    generatedAt,
  });

  const results = {};
  results["config/cpdb/design-system.json"] = writeJson(
    path.join(args.repoRoot, "config", "cpdb", "design-system.json"),
    config,
    args.force,
  );
  results["DESIGN.md"] = writeTextFile(
    path.join(args.repoRoot, "DESIGN.md"),
    renderDesignContractDoc(config),
    args.force,
  );
  results["docs/arch/design-system.md"] = writeTextFile(
    path.join(args.repoRoot, "docs", "arch", "design-system.md"),
    renderArchitectureDesignSystemDoc(config),
    args.force,
  );
  results["brains/team-brain/brain_v4/cortex/02_design-system.md"] = writeTextFile(
    path.join(args.repoRoot, "brains", "team-brain", "brain_v4", "cortex", "02_design-system.md"),
    renderBrainSeed(config),
    args.force,
  );

  process.stdout.write("Design-system scaffold complete.\n\n");
  process.stdout.write(`Repo: ${args.repoRoot}\n`);
  process.stdout.write(`Preset: ${config.preset} (${config.presetLabel})\n`);
  process.stdout.write(`Primary: ${config.foundations.color.primary}\n`);
  process.stdout.write(`Motion: ${config.foundations.motion.level}\n\n`);
  process.stdout.write("Files:\n");
  for (const [file, status] of Object.entries(results)) {
    process.stdout.write(`  - ${file} (${status})\n`);
  }
}

main();
