import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scriptPath = path.join(repoRoot, "scripts", "cpb-publish-neuronfs-release.sh");

test("cpb publish-neuronfs-release prints a deterministic dry-run plan", () => {
  const result = spawnSync(
    "/bin/bash",
    [
      scriptPath,
      "--version",
      "970e0cd",
      "--platform",
      "linux/amd64",
      "--platform",
      "darwin/arm64",
      "--out-dir",
      "/tmp/cpb-prebuilt-assets",
      "--dry-run",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[dry-run\] build prebuilt asset for linux\/amd64/u);
  assert.match(result.stdout, /\[dry-run\] build prebuilt asset for darwin\/arm64/u);
  assert.match(result.stdout, /\[dry-run\] push tag neuronfs-970e0cd/u);
  assert.match(result.stdout, /\[dry-run\] ensure release neuronfs-970e0cd exists/u);
  assert.match(result.stdout, /\[dry-run\] upload release assets from \/tmp\/cpb-prebuilt-assets/u);
});
