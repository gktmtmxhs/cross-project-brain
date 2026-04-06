#!/usr/bin/env bash
set -uo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"

repo_root="${CPB_REPO_ROOT:-$(cpb_repo_root)}"
agent_name="${1:-}"
wrapper_path="${CPB_WRAPPER_PATH:-${MUINONE_NEURONFS_WRAPPER_PATH:-}}"
usage_script="${CPB_AGENT_WRAPPER_USAGE_SCRIPT:-scripts/cpb-agent-wrapper.sh}"

if [[ -z "$agent_name" ]]; then
  echo "Usage: bash $usage_script <codex|claude> [args...]" >&2
  exit 1
fi

shift || true

is_inside_repo() {
  case "$PWD" in
    "$repo_root"|"$repo_root"/*) return 0 ;;
    *) return 1 ;;
  esac
}

resolve_real_agent() {
  local override=""
  case "$agent_name" in
    codex)
      override="${CPB_CODEX_REAL:-${MUINONE_NEURONFS_CODEX_REAL:-}}"
      ;;
    claude)
      override="${CPB_CLAUDE_REAL:-${MUINONE_NEURONFS_CLAUDE_REAL:-}}"
      ;;
  esac

  if [[ -n "$override" && -x "$override" ]]; then
    printf '%s\n' "$override"
    return 0
  fi

  local candidate
  while IFS= read -r candidate; do
    [[ -z "$candidate" ]] && continue
    if [[ -n "$wrapper_path" ]] && [[ "$(readlink -f "$candidate")" == "$(readlink -f "$wrapper_path")" ]]; then
      continue
    fi
    printf '%s\n' "$candidate"
    return 0
  done < <(type -aP "$agent_name" 2>/dev/null | awk '!seen[$0]++')

  return 1
}

should_guard_exit() {
  if [[ "${CPB_SKIP_EXIT_GUARD:-${MUINONE_NEURONFS_SKIP_EXIT_GUARD:-0}}" == "1" ]]; then
    return 1
  fi

  if ! is_inside_repo; then
    return 1
  fi

  if [[ $# -gt 0 ]]; then
    case "$1" in
      -h|--help|--version|version|login|logout|completion|mcp|mcp-server|app-server|sandbox|debug|features)
        return 1
        ;;
    esac
  fi

  return 0
}

run_finish_guard() {
  if ! command -v node >/dev/null 2>&1; then
    return 0
  fi

  local finish_script="${CPB_FINISH_CHECK_SCRIPT:-$repo_root/scripts/cpb-finish-check.mjs}"
  if [[ ! -f "$finish_script" ]]; then
    return 0
  fi

  node "$finish_script"
}

real_agent="$(resolve_real_agent || true)"
if [[ -z "$real_agent" ]]; then
  echo "Could not resolve real $agent_name binary for CPB wrapper." >&2
  exit 1
fi

guard_enabled=0
if should_guard_exit "$@"; then
  guard_enabled=1
fi

"$real_agent" "$@"
agent_status=$?

if [[ $guard_enabled -eq 1 && $agent_status -eq 0 ]]; then
  run_finish_guard
  guard_status=$?
  if [[ $guard_status -ne 0 ]]; then
    echo "CPB exit guard blocked clean ${agent_name} exit." >&2
    echo "Record a durable lesson or acknowledge no lesson, then rerun the agent." >&2
    exit 97
  fi
fi

exit $agent_status
