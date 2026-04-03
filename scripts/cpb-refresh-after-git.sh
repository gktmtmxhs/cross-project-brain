#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$script_dir/cpb-paths.sh"
cpdb_export_paths

repo_root="$CPB_REPO_ROOT"
log_dir="$CPB_AGENT_ROOT/logs"
log_file="$log_dir/git-hook-refresh.log"

mkdir -p "$log_dir"

log() {
  printf '[%s] %s\n' "$(date -Iseconds)" "$1" >>"$log_file"
}

run_refresh() {
  if [ -n "${CPB_PERSONAL_REPO:-}" ] && [ "${CPB_AUTO_PULL_PERSONAL:-1}" != "0" ] && [ -d "${CPB_PERSONAL_REPO}/.git" ]; then
    if git -C "$CPB_PERSONAL_REPO" pull --ff-only >>"$log_file" 2>&1; then
      log "personal repo pull completed"
    else
      log "personal repo pull skipped or failed"
    fi
  fi

  if ! bash "$repo_root/scripts/cpb-rebuild-runtime-brain.sh" >>"$log_file" 2>&1; then
    log "runtime rebuild failed"
    return 1
  fi

  if [ -x "$repo_root/.tools/neuronfs/neuronfs" ] && [ -f "$repo_root/scripts/cpb-autogrowth.sh" ]; then
    bash "$repo_root/scripts/cpb-autogrowth.sh" start >>"$log_file" 2>&1 || true
  fi

  if command -v node >/dev/null 2>&1 && [ -f "$repo_root/scripts/cpb-finish-check.mjs" ]; then
    node "$repo_root/scripts/cpb-finish-check.mjs" --init-baseline >>"$log_file" 2>&1 || true
  fi

  log "runtime refresh completed"
}

run_refresh
