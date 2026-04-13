#!/usr/bin/env bash
set -uo pipefail

agent_name="${1:-}"
wrapper_path="${CPB_WRAPPER_PATH:-${MUINONE_NEURONFS_WRAPPER_PATH:-}}"
usage_script="scripts/cpb-global-agent-wrapper.sh"

usage() {
  cat <<EOF
Usage: bash $usage_script <codex|claude> [args...]

Dispatches agent CLI calls to the active CPB-enabled repo wrapper when the
current working directory is inside a CPB repo. Outside CPB repos it passes
through to the real agent binary.
EOF
}

if [[ -z "$agent_name" ]]; then
  usage >&2
  exit 1
fi

shift || true

should_emit_update_notice() {
  if [[ "${CPB_SKIP_UPDATE_CHECK:-0}" == "1" || "${CPB_UPDATE_NOTICE_SHOWN:-0}" == "1" ]]; then
    return 1
  fi
  if [[ -n "${CI:-}" ]] || [[ ! -t 2 ]]; then
    return 1
  fi
  if ! command -v node >/dev/null 2>&1; then
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

maybe_run_update_notice() {
  local repo_root="$1"
  shift || true
  local checker="$repo_root/scripts/cpb-check-updates.mjs"

  if [[ ! -f "$checker" ]]; then
    return 0
  fi
  if ! should_emit_update_notice "$@"; then
    return 0
  fi

  env -u NODE_OPTIONS node "$checker" --repo-root "$repo_root" || true
  export CPB_UPDATE_NOTICE_SHOWN=1
}

resolve_abs_dir() {
  local candidate="$1"
  if [[ -d "$candidate" ]]; then
    (cd "$candidate" && pwd -P)
    return 0
  fi
  return 1
}

find_cpb_repo_root() {
  local candidate="${CPB_ACTIVE_REPO_ROOT:-$PWD}"
  candidate="$(resolve_abs_dir "$candidate" || true)"
  if [[ -z "$candidate" ]]; then
    return 1
  fi

  while true; do
    if [[ -d "$candidate/config/cpdb" ]] && [[ -f "$candidate/scripts/cpb-paths.sh" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
    if [[ "$candidate" == "/" ]]; then
      break
    fi
    candidate="$(dirname "$candidate")"
  done

  return 1
}

resolve_repo_wrapper() {
  local repo_root="$1"

  if [[ -x "$repo_root/scripts/neuronfs-agent-wrapper.sh" ]]; then
    printf '%s\n' "$repo_root/scripts/neuronfs-agent-wrapper.sh"
    return 0
  fi
  if [[ -x "$repo_root/scripts/cpb-agent-wrapper.sh" ]]; then
    printf '%s\n' "$repo_root/scripts/cpb-agent-wrapper.sh"
    return 0
  fi
  if [[ -f "$repo_root/scripts/neuronfs-agent-wrapper.sh" ]]; then
    printf '%s\n' "$repo_root/scripts/neuronfs-agent-wrapper.sh"
    return 0
  fi
  if [[ -f "$repo_root/scripts/cpb-agent-wrapper.sh" ]]; then
    printf '%s\n' "$repo_root/scripts/cpb-agent-wrapper.sh"
    return 0
  fi

  return 1
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

repo_root="$(find_cpb_repo_root || true)"
if [[ -n "$repo_root" ]]; then
  maybe_run_update_notice "$repo_root" "$@"
  repo_wrapper="$(resolve_repo_wrapper "$repo_root" || true)"
  if [[ -n "$repo_wrapper" ]]; then
    exec bash "$repo_wrapper" "$agent_name" "$@"
  fi
fi

real_agent="$(resolve_real_agent || true)"
if [[ -z "$real_agent" ]]; then
  echo "Could not resolve real $agent_name binary for CPB wrapper." >&2
  exit 1
fi

exec "$real_agent" "$@"
