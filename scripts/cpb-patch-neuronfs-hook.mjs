#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const usageScript = process.env.CPB_HOOK_PATCH_USAGE_SCRIPT || "scripts/cpb-patch-neuronfs-hook.mjs";
const helperScriptPath = process.env.CPB_HOOK_SELECTIVE_INJECTION_SCRIPT || "scripts/cpb-selective-injection.cjs";
const repoRootEnvName = process.env.CPB_HOOK_REPO_ROOT_ENV_NAME || "CPB_REPO_ROOT";

export function runCli(argv = process.argv.slice(2)) {
  const targetFile = argv[0];

  if (!targetFile) {
    process.stderr.write(`Usage: node ${usageScript} <path-to-v4-hook.cjs>\n`);
    process.exit(1);
  }

  let source = fs.readFileSync(targetFile, "utf8");

  function replaceOnce(name, searchValue, replaceValue, alreadyNeedle = "") {
    if (alreadyNeedle && source.includes(alreadyNeedle)) {
      return;
    }

    if (typeof searchValue === "string") {
      if (!source.includes(searchValue)) {
        throw new Error(`hook patch marker missing: ${name}`);
      }
      source = source.replace(searchValue, replaceValue);
      return;
    }

    if (!searchValue.test(source)) {
      throw new Error(`hook patch marker missing: ${name}`);
    }
    source = source.replace(searchValue, replaceValue);
  }

  const helperRequireBlock =
    "const path = require('path');\n" +
    `const REPO_ROOT = process.env.${repoRootEnvName} || path.resolve(__dirname, '..', '..', '..');\n` +
    "let selectiveInjection = null;\n" +
    "try {\n" +
    `    selectiveInjection = require(path.join(REPO_ROOT, ${JSON.stringify(helperScriptPath)}));\n` +
    "} catch (_) {}\n";

  replaceOnce(
    "selective injection helper require",
    /const path = require\('path'\);\r?\n(?:const REPO_ROOT = [^\n]+\r?\nlet selectiveInjection = null;\r?\ntry \{\r?\n\s+selectiveInjection = require\(path\.join\(REPO_ROOT, ['"][^'"]+['"]\)\);\r?\n\} catch \(_\) \{\}\r?\n)?/u,
    helperRequireBlock,
  );

  replaceOnce(
    "path separators",
    ".replace(/\\\\/g, '>')",
    ".replace(/[\\\\/]/g, '>')",
    ".replace(/[\\\\/]/g, '>')",
  );

  replaceOnce(
    "max per region constant",
    /const CACHE_TTL_MS = 30000;   \/\/ re-scan brain every 30 seconds\r?\n/,
    "const CACHE_TTL_MS = 30000;   // re-scan brain every 30 seconds\nconst MAX_PER_REGION = 4;     // cap injected rules per region\n",
    "const MAX_PER_REGION = 4;     // cap injected rules per region",
  );

  const brainScannerBlock = `// ─── Brain Scanner ───
// Reads the filesystem tree and builds a compact rule string.
// Only promoted neurons (counter >= threshold) are included.
// Output follows Path=Sentence format, ordered by Subsumption priority (P0→P6).
let cachedBrainScan = null;
let cachedRules = '';
let cacheTime = 0;

function scanBrain() {
    const result = {};
    REGIONS.forEach(r => result[r] = []);

    function walk(dir, depth) {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            if (e.name.startsWith('_') || e.name.startsWith('.')) continue;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (depth < 6) walk(full, depth + 1);
            } else if (e.name.endsWith('.neuron')) {
                const counter = parseInt(e.name, 10);
                if (isNaN(counter) || counter < PROMOTE_THRESHOLD) continue;
                const rel = path.dirname(full).replace(BRAIN_PATH + path.sep, '').replace(/[\\\\/]/g, '>');
                const region = rel.split('>')[0];
                if (result[region]) {
                    result[region].push({ path: rel, counter });
                }
            }
        }
    }
    walk(BRAIN_PATH, 0);

    return result;
}

function buildFallbackRules(scanResult) {
    const labels = {
        brainstem: 'P0', limbic: 'P1', hippocampus: 'P2',
        sensors: 'P3', cortex: 'P4', ego: 'P5', prefrontal: 'P6'
    };
    const lines = ['[NeuronFS Live Context]'];
    for (const r of REGIONS) {
        const neurons = (scanResult[r] || []).sort((a, b) => b.counter - a.counter).slice(0, MAX_PER_REGION);
        if (neurons.length === 0) continue;
        const items = neurons.map(n => {
            const sentence = n.path.replace(r + '>', '').replace(/>/g, ' > ').replace(/_/g, ' ');
            return sentence;
        });
        lines.push(\`[\${labels[r]}] \${items.join(' | ')}\`);
    }
    return lines.join('\\n');
}

function getBrainScan() {
    const now = Date.now();
    if (now - cacheTime < CACHE_TTL_MS && cachedBrainScan) return cachedBrainScan;
    try {
        cachedBrainScan = scanBrain();
        cachedRules = buildFallbackRules(cachedBrainScan);
        cacheTime = now;
    } catch {}
    return cachedBrainScan;
}

function getRulesForPayload(payload) {
    const scanResult = getBrainScan();
    if (!scanResult) return cachedRules;
    if (selectiveInjection && typeof selectiveInjection.buildLiveContext === 'function') {
        try {
            return selectiveInjection.buildLiveContext(scanResult, payload, {
                maxPerRegion: MAX_PER_REGION,
                maxRoles: 2,
                maxPerRole: 2,
                maxTotal: MAX_PER_REGION
            }).rules;
        } catch {}
    }
    return cachedRules;
}

getBrainScan();
`;

  replaceOnce(
    "brain scanner block",
    /\/\/ ─── Brain Scanner ───[\s\S]*?getRules\(\);\r?\n/u,
    `${brainScannerBlock}\n`,
    "function getRulesForPayload(payload) {",
  );

  replaceOnce(
    "payload-aware injection",
    /function inject\(bodyStr\) \{\r?\n\s+const rules = getRules\(\);\r?\n\s+if \(!rules\) return null;\r?\n\r?\n\s+try \{\r?\n\s+const j = JSON\.parse\(bodyStr\);\r?\n/u,
    "function inject(bodyStr) {\n    try {\n        const j = JSON.parse(bodyStr);\n        const rules = getRulesForPayload(j);\n        if (!rules) return null;\n",
    "const rules = getRulesForPayload(j);",
  );

  if (source.includes("[Growth Protocol]")) {
    replaceOnce(
      "remove growth protocol block",
      /[ \t]*\/\/ Self-growth protocol — tells the AI HOW to record corrections\r?\n[ \t]*const inboxPath = path\.join\(BRAIN_PATH, '_inbox', 'corrections\.jsonl'\);\r?\n[ \t]*lines\.push\(''\);\r?\n[ \t]*lines\.push\('\[Growth Protocol\]'\);\r?\n[ \t]*lines\.push\(`When user corrects a mistake, immediately append to \$\{inboxPath\}:`\);\r?\n[ \t]*lines\.push\('\{"type":"correction","path":"cortex\/\[category\]\/\[rule_name\]","text":"reason","counter_add":1\}'\);\r?\n[ \t]*lines\.push\('When user praises, append: \{"type":"correction","path":"\[existing_neuron_path\]","text":"praise","counter_add":1\}'\);\r?\n[ \t]*lines\.push\('Same mistake 3x → create bomb\.neuron in that neuron folder\.'\);/u,
      "",
    );
  }

  fs.writeFileSync(targetFile, source, "utf8");
  process.stdout.write(`Patched NeuronFS hook: ${path.resolve(targetFile)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  runCli();
}
