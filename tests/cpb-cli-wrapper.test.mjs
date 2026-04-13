import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cliPath = path.join(repoRoot, "bin", "cpb");
const globalWrapperPath = path.join(repoRoot, "scripts", "cpb-global-agent-wrapper.sh");

test("cpb executable forwards to the profile wrapper", () => {
  const result = spawnSync("bash", [cliPath, "profiles"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /team-local:/u);
  assert.match(result.stdout, /solo-personal:/u);
});

test("cpb executable dispatches non-profile helper commands", () => {
  const scaffoldHelp = spawnSync("bash", [cliPath, "scaffold-design-system", "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(scaffoldHelp.status, 0, scaffoldHelp.stderr || scaffoldHelp.stdout);
  assert.equal(scaffoldHelp.stderr, "");

  const presetList = spawnSync("bash", [cliPath, "import-starter-skills", "--list-presets"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(presetList.status, 0, presetList.stderr || presetList.stdout);
  assert.equal(presetList.stderr, "");
});

test("global agent wrapper dispatches into the active CPB repo wrapper", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-global-wrapper-"));
  const fakeRepo = path.join(tempRoot, "demo-repo");
  const fakeBin = path.join(tempRoot, "bin");

  fs.mkdirSync(path.join(fakeRepo, "config", "cpdb"), { recursive: true });
  fs.mkdirSync(path.join(fakeRepo, "scripts"), { recursive: true });
  fs.mkdirSync(fakeBin, { recursive: true });

  const fakeRepoWrapper = path.join(fakeRepo, "scripts", "cpb-agent-wrapper.sh");
  fs.writeFileSync(
    fakeRepoWrapper,
    "#!/usr/bin/env bash\nprintf 'repo-wrapper:%s:%s\\n' \"$1\" \"$PWD\"\n",
    "utf8",
  );
  fs.chmodSync(fakeRepoWrapper, 0o755);

  fs.writeFileSync(path.join(fakeRepo, "scripts", "cpb-paths.sh"), "# stub\n", "utf8");

  const fakeShim = path.join(fakeBin, "codex");
  fs.writeFileSync(fakeShim, "#!/usr/bin/env bash\nprintf 'shim\\n'\n", "utf8");
  fs.chmodSync(fakeShim, 0o755);

  const result = spawnSync("bash", [globalWrapperPath, "codex", "--version"], {
    cwd: fakeRepo,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      CPB_WRAPPER_PATH: fakeShim,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^repo-wrapper:codex:/u);
  assert.match(result.stdout, /demo-repo/u);
});

test("global agent wrapper falls back to the real agent outside CPB repos", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-global-wrapper-"));
  const plainDir = path.join(tempRoot, "plain");
  const fakeBin = path.join(tempRoot, "bin");

  fs.mkdirSync(plainDir, { recursive: true });
  fs.mkdirSync(fakeBin, { recursive: true });

  const fakeShim = path.join(fakeBin, "codex");
  const fakeReal = path.join(fakeBin, "codex-real");
  fs.writeFileSync(fakeShim, "#!/usr/bin/env bash\nprintf 'shim\\n'\n", "utf8");
  fs.writeFileSync(fakeReal, "#!/usr/bin/env bash\nprintf 'real-agent:%s\\n' \"$PWD\"\n", "utf8");
  fs.chmodSync(fakeShim, 0o755);
  fs.chmodSync(fakeReal, 0o755);

  const result = spawnSync("bash", [globalWrapperPath, "codex", "--version"], {
    cwd: plainDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      CPB_WRAPPER_PATH: fakeShim,
      CPB_CODEX_REAL: fakeReal,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^real-agent:/u);
  assert.match(result.stdout, /plain/u);
});
