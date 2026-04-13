#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

function usage() {
  process.stdout.write(`Usage: node scripts/cpb-upgrade-framework.mjs [options]

Options:
  --repo-root <path>        consumer repo root (default: current working directory)
  --framework-repo <url>    override framework repository URL/path
  --ref <ref>               override framework update ref
  --dry-run                 print the resolved upgrade plan without applying it
  -h, --help                show this help
`);
}

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    frameworkRepoUrl: "",
    updateRef: "",
    dryRun: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case "--repo-root":
        options.repoRoot = argv[index + 1] ?? "";
        index += 1;
        break;
      case "--framework-repo":
        options.frameworkRepoUrl = argv[index + 1] ?? "";
        index += 1;
        break;
      case "--ref":
        options.updateRef = argv[index + 1] ?? "";
        index += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${value}`);
    }
  }

  return options;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: options.stdio || "pipe",
    cwd: options.cwd,
    env: options.env,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${cmd} ${args.join(" ")} failed`).trim());
  }
  return result;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isTruthy(value) {
  return value === true;
}

function refreshManagedWrappers(repoRoot) {
  const homeDir = process.env.HOME;
  if (!homeDir) {
    return;
  }

  const binDir = process.env.CPB_SETUP_AGENT_WRAPPERS_BIN_DIR || path.join(homeDir, ".local", "bin");
  const signatures = ["cpb-agent-wrapper.sh", "cpb-global-agent-wrapper.sh", "neuronfs-agent-wrapper.sh"];
  let shouldRefresh = false;

  for (const agentName of ["codex", "claude"]) {
    const shimPath = path.join(binDir, agentName);
    if (!fs.existsSync(shimPath)) {
      continue;
    }
    const shimContent = fs.readFileSync(shimPath, "utf8");
    if (signatures.some((signature) => shimContent.includes(signature))) {
      shouldRefresh = true;
      break;
    }
  }

  if (!shouldRefresh) {
    return;
  }

  const setupScript = path.join(repoRoot, "scripts", "cpb-setup-agent-wrappers.sh");
  if (!fs.existsSync(setupScript)) {
    return;
  }

  try {
    run("bash", [setupScript], {
      cwd: repoRoot,
      stdio: "pipe",
      env: {
        ...process.env,
        NODE_OPTIONS: "",
      },
    });
    process.stdout.write(`Refreshed managed agent wrappers in ${binDir}\n`);
  } catch (error) {
    process.stderr.write(`Warning: failed to refresh managed agent wrappers: ${error.message}\n`);
  }
}

let options;
try {
  options = parseArgs(process.argv);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  usage();
  process.exit(1);
}

if (options.help) {
  usage();
  process.exit(0);
}

const repoRoot = path.resolve(options.repoRoot || process.cwd());
const lockPath = path.join(repoRoot, "config", "cpdb", "framework.lock.json");
if (!fs.existsSync(lockPath)) {
  process.stderr.write(`Missing framework lock: ${lockPath}\n`);
  process.exit(1);
}

const lock = loadJson(lockPath);
const frameworkRepoUrl = options.frameworkRepoUrl || String(lock.frameworkRepoUrl || "");
const updateRef = options.updateRef || String(lock.updateRef || "");
if (!frameworkRepoUrl || !updateRef) {
  process.stderr.write("frameworkRepoUrl/updateRef are missing from framework.lock.json\n");
  process.exit(1);
}

const installOptions = lock.installOptions || {};
const installArgs = ["--target", repoRoot, "--force", "--non-interactive"];
if (isTruthy(installOptions.sharedRepo)) {
  installArgs.push("--shared-repo");
}
if (String(installOptions.personalRepo || "")) {
  installArgs.push("--personal-repo", String(installOptions.personalRepo));
}
if (String(installOptions.projectType || "")) {
  installArgs.push("--project-type", String(installOptions.projectType));
}
if (String(installOptions.projectSummary || "")) {
  installArgs.push("--project-summary", String(installOptions.projectSummary));
}
if (isTruthy(installOptions.starterSkillImport)) {
  installArgs.push("--with-starter-skills");
}
if (String(installOptions.starterSkillPreset || "")) {
  installArgs.push("--starter-skill-preset", String(installOptions.starterSkillPreset));
}
if (isTruthy(installOptions.designSystemScaffold)) {
  installArgs.push("--scaffold-design-system");
}
if (!isTruthy(installOptions.setupShell)) {
  installArgs.push("--no-shell");
}
if (!isTruthy(installOptions.installNeuronfs)) {
  installArgs.push("--no-neuronfs");
}
if (!isTruthy(installOptions.startAutogrowth)) {
  installArgs.push("--no-autogrowth");
}
if (!isTruthy(installOptions.autoInstallGo)) {
  installArgs.push("--skip-go-install");
}

if (options.dryRun) {
  process.stdout.write(`Framework repo: ${frameworkRepoUrl}\n`);
  process.stdout.write(`Ref: ${updateRef}\n`);
  process.stdout.write(`Install args: ${installArgs.join(" ")}\n`);
  process.exit(0);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-upgrade-framework-"));
const frameworkCheckout = path.join(tempRoot, "framework");

try {
  run("git", ["clone", frameworkRepoUrl, frameworkCheckout], { stdio: "pipe" });

  const fetchResult = spawnSync("git", ["fetch", "--depth", "1", "origin", updateRef], {
    cwd: frameworkCheckout,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (fetchResult.status === 0) {
    run("git", ["checkout", "--detach", "FETCH_HEAD"], { cwd: frameworkCheckout });
  } else {
    run("git", ["checkout", "--detach", updateRef], { cwd: frameworkCheckout });
  }

  run("bash", [path.join(frameworkCheckout, "scripts", "cpb-install.sh"), ...installArgs], {
    cwd: frameworkCheckout,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: "",
      CPB_FRAMEWORK_REPO_URL: frameworkRepoUrl,
      CPB_FRAMEWORK_REPO_REF: updateRef,
    },
  });

  refreshManagedWrappers(repoRoot);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
