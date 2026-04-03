#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$script_dir/cpb-paths.sh"
cpdb_export_paths

repo_root="$CPB_REPO_ROOT"
agent_root="$CPB_AGENT_ROOT"
pid_file="$agent_root/autogrowth.pid"
log_dir="$agent_root/logs"
log_file="$log_dir/autogrowth.log"
worker_script="$repo_root/scripts/cpb-autogrowth.mjs"
neuronfs_binary="$repo_root/.tools/neuronfs/neuronfs"

require_runtime_dependencies() {
  if ! command -v node >/dev/null 2>&1; then
    echo "CPB autogrowth requires node in PATH." >&2
    return 1
  fi
  if [[ ! -f "$worker_script" ]]; then
    echo "CPB autogrowth worker not found: $worker_script" >&2
    return 1
  fi
  if [[ ! -x "$neuronfs_binary" ]]; then
    echo "CPB autogrowth requires a built CLI binary: $neuronfs_binary" >&2
    echo "Run: bash scripts/cpb-install-neuronfs.sh" >&2
    return 1
  fi
}

mkdir -p "$log_dir"

is_running() {
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    return 1
  fi

  if kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  rm -f "$pid_file"
  return 1
}

start_worker() {
  require_runtime_dependencies

  if is_running; then
    echo "CPB autogrowth already running (pid $(cat "$pid_file"))."
    return 0
  fi

  nohup setsid bash -lc "exec node \"$worker_script\" >>\"$log_file\" 2>&1 < /dev/null" >/dev/null 2>&1 &
  echo $! >"$pid_file"

  sleep 0.2
  if ! is_running; then
    echo "CPB autogrowth failed to stay running. Check $log_file" >&2
    return 1
  fi

  echo "CPB autogrowth started (pid $(cat "$pid_file"))."
}

stop_worker() {
  if ! is_running; then
    echo "CPB autogrowth is not running."
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"
  kill "$pid" 2>/dev/null || true
  rm -f "$pid_file"
  echo "CPB autogrowth stopped."
}

status_worker() {
  if is_running; then
    echo "CPB autogrowth running (pid $(cat "$pid_file"))."
  else
    echo "CPB autogrowth not running."
  fi
}

run_once() {
  require_runtime_dependencies
  exec node "$worker_script" --once
}

run_foreground() {
  require_runtime_dependencies
  exec node "$worker_script"
}

cmd="${1:-start}"
case "$cmd" in
  start)
    start_worker
    ;;
  stop)
    stop_worker
    ;;
  restart)
    stop_worker
    start_worker
    ;;
  status)
    status_worker
    ;;
  once)
    run_once
    ;;
  run)
    run_foreground
    ;;
  *)
    echo "Usage: bash scripts/cpb-autogrowth.sh [start|stop|restart|status|once|run]" >&2
    exit 1
    ;;
esac
