#!/usr/bin/env bash

cpdb_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$script_dir/.." && pwd
}

cpdb_sanitize_operator_id() {
  local raw="${1:-operator}"
  raw="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  raw="$(printf '%s' "$raw" | sed -E 's/[^a-z0-9._-]+/_/g; s/^_+//; s/_+$//; s/_+/_/g')"
  if [[ -z "$raw" ]]; then
    raw="operator"
  fi
  printf '%s' "$raw"
}

cpdb_normalize_identity_source() {
  local raw="${1:-}"
  if [[ "$raw" == *"@"* ]]; then
    raw="${raw%%@*}"
  fi
  cpdb_sanitize_operator_id "$raw"
}

cpdb_detect_operator_id() {
  local repo_root="$1"
  local raw="${CPB_OPERATOR:-}"

  if [[ -z "$raw" ]]; then
    raw="$(git -C "$repo_root" config github.user 2>/dev/null || true)"
  fi
  if [[ -z "$raw" ]]; then
    raw="$(git -C "$repo_root" config user.email 2>/dev/null || true)"
  fi
  if [[ -z "$raw" ]]; then
    raw="$(git -C "$repo_root" config user.name 2>/dev/null || true)"
  fi
  if [[ -z "$raw" ]]; then
    raw="${USER:-operator}"
  fi

  cpdb_normalize_identity_source "$raw"
}

cpdb_export_paths() {
  local repo_root="${1:-$(cpdb_repo_root)}"
  local project_id="${CPB_PROJECT_ID:-$(basename "$repo_root")}"
  local operator_id
  operator_id="$(cpdb_detect_operator_id "$repo_root")"
  local agent_root="$repo_root/.agent/cross-project-brain/$project_id"
  local personal_repo="${CPB_PERSONAL_REPO:-}"
  local global_brain_default="$repo_root/brains/global-operators/$operator_id/brain_v4"
  local career_docs_root_default="$repo_root/docs/career/operators/$operator_id"

  if [[ -n "$personal_repo" ]]; then
    global_brain_default="$personal_repo/brains/global-operators/$operator_id/brain_v4"
    career_docs_root_default="$personal_repo/docs/career/operators/$operator_id"
  fi

  export CPB_REPO_ROOT="$repo_root"
  export CPB_PROJECT_ID="$project_id"
  export CPB_OPERATOR="${CPB_OPERATOR:-$operator_id}"
  export CPB_OPERATOR_ID="$operator_id"
  export CPB_PERSONAL_REPO="$personal_repo"
  export CPB_AGENT_ROOT="${CPB_AGENT_ROOT:-$agent_root}"
  export CPB_GLOBAL_BRAIN="${CPB_GLOBAL_BRAIN:-$global_brain_default}"
  export CPB_TEAM_BRAIN="${CPB_TEAM_BRAIN:-$repo_root/brains/team-brain/brain_v4}"
  export CPB_PROJECT_BRAIN="${CPB_PROJECT_BRAIN:-$repo_root/brains/project-operators/$operator_id/brain_v4}"
  export CPB_DEVICE_BRAIN="${CPB_DEVICE_BRAIN:-$agent_root/device-brain/brain_v4}"
  export CPB_RUNTIME_BRAIN="${CPB_RUNTIME_BRAIN:-$agent_root/runtime-brain/brain_v4}"
  export CPB_CAREER_DOCS_ROOT="${CPB_CAREER_DOCS_ROOT:-$career_docs_root_default}"
  export CPB_NEURONFS_INSTALL_DIR="${CPB_NEURONFS_INSTALL_DIR:-${NEURONFS_INSTALL_DIR:-$repo_root/.tools/neuronfs}}"
  export NEURONFS_INSTALL_DIR="$CPB_NEURONFS_INSTALL_DIR"
}
