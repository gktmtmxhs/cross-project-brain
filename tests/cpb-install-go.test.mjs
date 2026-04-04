import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scriptPath = path.join(repoRoot, "scripts", "cpb-install-go.sh");

function writeExecutable(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
  fs.chmodSync(filePath, 0o755);
}

test("cpb install-go check succeeds when go is already available", () => {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-install-go-check-"));
  writeExecutable(
    path.join(fakeBin, "go"),
    "#!/bin/bash\nif [[ \"$1\" == \"version\" ]]; then\n  printf 'go version go9.9.9 test/os\\n'\n  exit 0\nfi\nexit 0\n",
  );

  const result = spawnSync("/bin/bash", [scriptPath, "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: fakeBin,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /go available: go version go9.9.9 test\/os/u);
});

test("cpb install-go prints the apt-get plan when apt-get is available", () => {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-install-go-apt-"));
  writeExecutable(path.join(fakeBin, "apt-get"), "#!/bin/bash\nexit 0\n");

  const result = spawnSync("/bin/bash", [scriptPath, "--print-plan"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: fakeBin,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /manager: apt-get/u);
  assert.match(result.stdout, /apt-get update/u);
  assert.match(result.stdout, /apt-get install -y golang-go/u);
});

test("cpb install-go prints the brew plan when brew is the available manager", () => {
  const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-install-go-brew-"));
  writeExecutable(path.join(fakeBin, "brew"), "#!/bin/bash\nexit 0\n");

  const result = spawnSync("/bin/bash", [scriptPath, "--print-plan"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: fakeBin,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /manager: brew/u);
  assert.match(result.stdout, /brew install go/u);
});
