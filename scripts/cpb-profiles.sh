#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"
source "$script_dir/cpb-setup-lib.sh"

cpb_print_profiles() {
  cat <<EOF
team-local:
  - current repo is shared with a team
  - global lessons sync through your private CPB repo
  - project lessons stay local on this machine

team-personal:
  - current repo is shared with a team
  - global and project lessons sync through your private CPB repo
  - team repo stays clean

solo-tracked:
  - current repo is your own repo
  - project lessons are committed with the project itself
  - global lessons still sync through your private CPB repo

solo-personal:
  - current repo is your own repo
  - project and global lessons sync through your private CPB repo
  - useful when you want the same project learning on multiple machines without mixing it into the repo history
EOF
}

cpb_resolve_operator() {
  local repo_root="$1"
  local provided="${2:-}"
  local detected=""

  if [[ -n "$provided" ]]; then
    cpb_sanitize_operator_id "$provided"
    return 0
  fi

  if command -v gh >/dev/null 2>&1; then
    detected="$(gh api user --jq .login 2>/dev/null || true)"
  fi

  if [[ -z "$detected" ]]; then
    detected="$(cpb_detect_operator_id "$repo_root")"
  fi

  cpb_sanitize_operator_id "$detected"
}

cpb_apply_profile_settings() {
  local profile="$1"
  CPB_PROFILE_SHARED_REPO=0
  CPB_PROFILE_PROJECT_BRAIN_MODE=""

  case "$profile" in
    team-local)
      CPB_PROFILE_SHARED_REPO=1
      CPB_PROFILE_PROJECT_BRAIN_MODE="local"
      ;;
    team-personal)
      CPB_PROFILE_SHARED_REPO=1
      CPB_PROFILE_PROJECT_BRAIN_MODE="personal"
      ;;
    solo-tracked)
      CPB_PROFILE_PROJECT_BRAIN_MODE="tracked"
      ;;
    solo-personal)
      CPB_PROFILE_PROJECT_BRAIN_MODE="personal"
      ;;
    *)
      return 1
      ;;
  esac
}

cpb_normalize_personal_repo_path() {
  local personal_repo="$1"
  local repo_dir
  repo_dir="$(cd "$(dirname "$personal_repo")" 2>/dev/null && pwd)"
  printf '%s/%s\n' "$repo_dir" "$(basename "$personal_repo")"
}

cpb_project_brain_for_mode() {
  local mode="$1"
  local tracked_path="$2"
  local local_path="$3"
  local personal_path="$4"

  case "$mode" in
    tracked)
      printf '%s\n' "$tracked_path"
      ;;
    local)
      printf '%s\n' "$local_path"
      ;;
    personal)
      printf '%s\n' "$personal_path"
      ;;
    *)
      return 1
      ;;
  esac
}
