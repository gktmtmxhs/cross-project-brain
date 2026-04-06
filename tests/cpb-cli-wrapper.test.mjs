import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cliPath = path.join(repoRoot, "bin", "cpb");

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
