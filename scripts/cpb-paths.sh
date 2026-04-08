#!/usr/bin/env bash

cpb_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$script_dir/.." && pwd
}

cpb_project_id() {
  local repo_root="${1:-$(cpb_repo_root)}"
  basename "$repo_root"
}

cpb_sanitize_operator_id() {
  local raw="${1:-operator}"
  raw="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  raw="$(printf '%s' "$raw" | sed -E 's/[^a-z0-9._-]+/_/g; s/^_+//; s/_+$//; s/_+/_/g')"
  if [[ -z "$raw" ]]; then
    raw="operator"
  fi
  printf '%s' "$raw"
}

cpb_normalize_identity_source() {
  local raw="${1:-}"
  if [[ "$raw" == *"@"* ]]; then
    raw="${raw%%@*}"
  fi
  cpb_sanitize_operator_id "$raw"
}

cpb_detect_operator_id() {
  local repo_root="${1:-$(cpb_repo_root)}"
  local raw="${2:-${CPB_OPERATOR:-}}"

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

  cpb_normalize_identity_source "$raw"
}

cpb_tracked_project_operators_root_default() {
  local repo_root="${1:-$(cpb_repo_root)}"
  printf '%s\n' "$repo_root/brains/project-operators"
}

cpb_tracked_project_brain_path() {
  local tracked_operators_root="$1"
  local operator_id="$2"
  printf '%s\n' "$tracked_operators_root/$operator_id/brain_v4"
}

cpb_personal_project_brain_path() {
  local personal_repo="$1"
  local project_id="$2"
  local operator_id="$3"
  printf '%s\n' "$personal_repo/brains/project-operators/$operator_id/$project_id/brain_v4"
}

cpb_dir_has_contents() {
  local candidate="$1"
  [[ -d "$candidate" ]] && [[ -n "$(find "$candidate" -mindepth 1 -print -quit 2>/dev/null)" ]]
}

cpb_resolve_tracked_project_brain_source() {
  local tracked_operators_root="$1"
  local operator_id="$2"
  local preferred_path
  local candidate=""
  local count=0

  preferred_path="$(cpb_tracked_project_brain_path "$tracked_operators_root" "$operator_id")"
  if cpb_dir_has_contents "$preferred_path"; then
    printf '%s\n' "$preferred_path"
    return 0
  fi

  if [[ ! -d "$tracked_operators_root" ]]; then
    return 0
  fi

  while IFS= read -r candidate; do
    if [[ -z "$candidate" ]]; then
      continue
    fi
    count=$((count + 1))
    preferred_path="$candidate"
  done < <(find "$tracked_operators_root" -mindepth 2 -maxdepth 2 -type d -name brain_v4 | sort)

  if [[ "$count" -eq 1 ]] && cpb_dir_has_contents "$preferred_path"; then
    printf '%s\n' "$preferred_path"
  fi
}

cpb_path_is_within() {
  local child_path="$1"
  local parent_path="$2"
  case "$child_path" in
    "$parent_path"|"$parent_path"/*)
      return 0
      ;;
  esac
  return 1
}

cpb_export_paths() {
  local repo_root="${1:-$(cpb_repo_root)}"
  local project_id="${CPB_PROJECT_ID:-$(cpb_project_id "$repo_root")}"
  local operator_id
  operator_id="$(cpb_detect_operator_id "$repo_root" "${CPB_OPERATOR:-}")"
  local personal_repo="${CPB_PERSONAL_REPO:-}"
  local tracked_project_operators_root
  tracked_project_operators_root="${CPB_TRACKED_PROJECT_OPERATORS_ROOT:-$(cpb_tracked_project_operators_root_default "$repo_root")}"
  local agent_root="${CPB_AGENT_ROOT:-$repo_root/.agent/cross-project-brain/$project_id}"
  local global_brain_default="$repo_root/brains/global-operators/$operator_id/brain_v4"
  local career_docs_root_default="$repo_root/docs/career/operators/$operator_id"
  local project_brain_default

  if [[ -n "$personal_repo" ]]; then
    global_brain_default="$personal_repo/brains/global-operators/$operator_id/brain_v4"
    career_docs_root_default="$personal_repo/docs/career/operators/$operator_id"
    project_brain_default="$(cpb_personal_project_brain_path "$personal_repo" "$project_id" "$operator_id")"
  else
    project_brain_default="$(cpb_tracked_project_brain_path "$tracked_project_operators_root" "$operator_id")"
  fi

  export CPB_REPO_ROOT="$repo_root"
  export CPB_PROJECT_ID="$project_id"
  export CPB_OPERATOR="${CPB_OPERATOR:-$operator_id}"
  export CPB_OPERATOR_ID="$operator_id"
  export CPB_PERSONAL_REPO="$personal_repo"
  export CPB_PERSONAL_REPO_NAME="${CPB_PERSONAL_REPO_NAME:-cpb-personal}"
  export CPB_CREATE_PERSONAL_REMOTE="${CPB_CREATE_PERSONAL_REMOTE:-}"
  export CPB_TRACKED_PROJECT_OPERATORS_ROOT="$tracked_project_operators_root"
  export CPB_AGENT_ROOT="$agent_root"
  export CPB_GLOBAL_BRAIN="${CPB_GLOBAL_BRAIN:-$global_brain_default}"
  export CPB_TEAM_BRAIN="${CPB_TEAM_BRAIN:-$repo_root/brains/team-brain/brain_v4}"
  export CPB_PROJECT_BRAIN="${CPB_PROJECT_BRAIN:-$project_brain_default}"
  export CPB_USER_BRAIN="${CPB_USER_BRAIN:-$CPB_PROJECT_BRAIN}"
  export CPB_RUNTIME_BRAIN="${CPB_RUNTIME_BRAIN:-$agent_root/runtime-brain/brain_v4}"
  export CPB_CAREER_DOCS_ROOT="${CPB_CAREER_DOCS_ROOT:-$career_docs_root_default}"
  export CPB_AUTO_PULL_PERSONAL="${CPB_AUTO_PULL_PERSONAL:-1}"
  export CPB_AUTO_PUSH_PERSONAL="${CPB_AUTO_PUSH_PERSONAL:-1}"
  export CPB_SYNC_TRACKED_PROJECT_OVERLAY="${CPB_SYNC_TRACKED_PROJECT_OVERLAY:-1}"
  export CPB_AUTOGROWTH_POLL_MS="${CPB_AUTOGROWTH_POLL_MS:-}"
  export CPB_NEURONFS_INSTALL_DIR="${CPB_NEURONFS_INSTALL_DIR:-${NEURONFS_INSTALL_DIR:-$repo_root/.tools/neuronfs}}"
  export NEURONFS_INSTALL_DIR="$CPB_NEURONFS_INSTALL_DIR"
}

# Backward-compatible aliases for the current public core.
cpdb_repo_root() {
  cpb_repo_root "$@"
}

cpdb_sanitize_operator_id() {
  cpb_sanitize_operator_id "$@"
}

cpdb_normalize_identity_source() {
  cpb_normalize_identity_source "$@"
}

cpdb_detect_operator_id() {
  cpb_detect_operator_id "$@"
}

cpdb_export_paths() {
  cpb_export_paths "$@"
}
