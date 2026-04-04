#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$script_dir/cpb-paths.sh"
cpdb_export_paths

personal_repo="${CPB_PERSONAL_REPO:-}"
if [[ -z "$personal_repo" || ! -d "$personal_repo/.git" ]]; then
  exit 0
fi

if [[ "${CPB_AUTO_PUSH_PERSONAL:-1}" == "0" ]]; then
  exit 0
fi

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
