#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"

repo_root="${CPB_REPO_ROOT:-$(cpb_repo_root)}"
project_id="${CPB_PROJECT_ID:-$(cpb_project_id "$repo_root")}"
agent_root="${CPB_AGENT_ROOT:-$repo_root/.agent/cross-project-brain/$project_id}"
log_dir="$agent_root/logs"
log_file="$log_dir/git-hook-refresh.log"
neuronfs_install_dir="${NEURONFS_INSTALL_DIR:-$repo_root/.tools/neuronfs}"
neuronfs_binary="$neuronfs_install_dir/neuronfs"
rebuild_script="${CPB_REBUILD_RUNTIME_SCRIPT:-$repo_root/scripts/cpb-rebuild-runtime-brain.sh}"
autogrowth_manager="${CPB_AUTOGROWTH_MANAGER_SCRIPT:-$repo_root/scripts/cpb-autogrowth.sh}"
finish_check_script="${CPB_FINISH_CHECK_SCRIPT:-}"

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

  if ! bash "$rebuild_script" >>"$log_file" 2>&1; then
    log "runtime rebuild failed"
    return 1
  fi

  if [ -x "$neuronfs_binary" ] && [ -f "$autogrowth_manager" ]; then
    bash "$autogrowth_manager" start >>"$log_file" 2>&1 || true
  fi

  if [ -z "$finish_check_script" ] && [ -f "$repo_root/scripts/cpb-finish-check.mjs" ]; then
    finish_check_script="$repo_root/scripts/cpb-finish-check.mjs"
  fi

  if command -v node >/dev/null 2>&1 && [ -n "$finish_check_script" ] && [ -f "$finish_check_script" ]; then
    node "$finish_check_script" --init-baseline >>"$log_file" 2>&1 || true
  fi

  log "runtime refresh completed"
}

run_refresh
