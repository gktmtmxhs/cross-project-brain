import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const completionPath = path.join(repoRoot, "scripts", "cpb-completion.bash");

function runBash(script) {
  const result = spawnSync("bash", ["-lc", script], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test("cpb completion registers a completion spec", () => {
  const output = runBash(`source "${completionPath}" && complete -p cpb`);
  assert.match(output, /_cpb_complete/u);
});

test("cpb completion suggests top-level and apply profile commands", () => {
  const topLevel = runBash(`source "${completionPath}" && COMP_WORDS=(cpb st) && COMP_CWORD=1 && COMPREPLY=() && _cpb_complete && printf '%s\\n' "\${COMPREPLY[@]}"`);
  assert.match(topLevel, /\bstatus\b/u);

  const applyProfiles = runBash(`source "${completionPath}" && COMP_WORDS=(cpb apply te) && COMP_CWORD=2 && COMPREPLY=() && _cpb_complete && printf '%s\\n' "\${COMPREPLY[@]}"`);
  assert.match(applyProfiles, /\bteam-local\b/u);
  assert.match(applyProfiles, /\bteam-personal\b/u);
});
