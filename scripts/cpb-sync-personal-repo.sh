#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"

repo_root="${CPB_REPO_ROOT:-$(cpb_repo_root)}"
operator_id="${CPB_OPERATOR_ID:-$(cpb_detect_operator_id "$repo_root")}"
personal_repo="${CPB_PERSONAL_REPO:-}"
tracked_operators_root="${CPB_TRACKED_PROJECT_OPERATORS_ROOT:-$(cpb_tracked_project_operators_root_default "$repo_root")}"

if [[ -z "$personal_repo" || ! -d "$personal_repo/.git" ]]; then
  exit 0
fi

if [[ "${CPB_AUTO_PUSH_PERSONAL:-1}" == "0" ]]; then
  exit 0
fi

sync_tracked_project_overlay_into_personal_repo() {
  local configured_project_brain="${CPB_PROJECT_BRAIN:-}"
  local tracked_source=""
  local personal_project_root="$personal_repo/brains/project-operators"

  if [[ "${CPB_SYNC_TRACKED_PROJECT_OVERLAY:-1}" == "0" ]]; then
    return 0
  fi

  if [[ -z "$configured_project_brain" ]] || ! cpb_path_is_within "$configured_project_brain" "$personal_project_root"; then
    return 0
  fi

  tracked_source="$(cpb_resolve_tracked_project_brain_source "$tracked_operators_root" "$operator_id")"
  if [[ -z "$tracked_source" || ! -d "$tracked_source" ]]; then
    return 0
  fi

  if ! cpb_dir_has_contents "$tracked_source"; then
    return 0
  fi

  if [[ "$tracked_source" == "$configured_project_brain" ]]; then
    return 0
  fi

  # Mirror legacy tracked overlays before the personal repo sync runs.
  mkdir -p "$configured_project_brain"
  rsync -a "$tracked_source"/ "$configured_project_brain"/
}

sync_tracked_project_overlay_into_personal_repo

timestamp="$(date +%Y-%m-%dT%H:%M:%S%z)"

if [[ -n "$(git -C "$personal_repo" status --porcelain)" ]]; then
  git -C "$personal_repo" add -A
  git -C "$personal_repo" commit -m "CPB sync: $timestamp" >/dev/null 2>&1 || true
fi

if git -C "$personal_repo" rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  git -C "$personal_repo" pull --rebase >/dev/null 2>&1 || true
  git -C "$personal_repo" push >/dev/null 2>&1 || true
  exit 0
fi

origin_url="$(git -C "$personal_repo" remote get-url origin 2>/dev/null || true)"
current_branch="$(git -C "$personal_repo" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"

if [[ -n "$origin_url" && -n "$current_branch" ]]; then
  git -C "$personal_repo" fetch origin >/dev/null 2>&1 || true

  if git -C "$personal_repo" show-ref --verify --quiet "refs/remotes/origin/$current_branch"; then
    git -C "$personal_repo" branch --set-upstream-to "origin/$current_branch" "$current_branch" >/dev/null 2>&1 || true
    git -C "$personal_repo" pull --rebase >/dev/null 2>&1 || true
    git -C "$personal_repo" push >/dev/null 2>&1 || true
  else
    git -C "$personal_repo" push -u origin HEAD >/dev/null 2>&1 || true
  fi
fi
