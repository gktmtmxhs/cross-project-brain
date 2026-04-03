#!/usr/bin/env bash
set -euo pipefail

repo_root=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root)
      repo_root="$2"
      shift 2
      ;;
    -h|--help)
      cat <<EOF
Usage: bash scripts/cpb-setup-git-hooks.sh [--repo-root <path>]
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$repo_root" ]]; then
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

hooks_dir="$repo_root/.githooks"
git -C "$repo_root" config core.hooksPath "$hooks_dir"

cat <<EOF
CPB git hooks pinned.

Repo:       $repo_root
Hooks path: $hooks_dir

Installed hooks:
  - post-merge
  - post-checkout
  - post-rewrite
  - pre-push

Behavior:
  - post-merge/post-checkout/post-rewrite refresh runtime brain
  - pre-push also tries to sync your personal CPB repo when configured
EOF
