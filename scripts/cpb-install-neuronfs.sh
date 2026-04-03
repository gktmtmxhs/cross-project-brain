#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$script_dir/cpb-paths.sh"
cpdb_export_paths

repo_root="$CPB_REPO_ROOT"
install_dir_default="$repo_root/.tools/neuronfs"
install_dir="${NEURONFS_INSTALL_DIR:-$install_dir_default}"
repo_url="${NEURONFS_REPO_URL:-https://github.com/rhino-acoustic/NeuronFS.git}"
repo_branch="${NEURONFS_REPO_BRANCH:-main}"
repo_ref="${NEURONFS_REPO_REF:-970e0cd}"
allow_hook_only="${NEURONFS_ALLOW_HOOK_ONLY:-0}"

usage() {
  cat <<EOF
Usage: bash scripts/cpb-install-neuronfs.sh

Environment overrides:
  NEURONFS_INSTALL_DIR      default: $install_dir_default
  NEURONFS_REPO_URL         default: $repo_url
  NEURONFS_REPO_BRANCH      default: $repo_branch
  NEURONFS_REPO_REF         default: $repo_ref
  NEURONFS_ALLOW_HOOK_ONLY  default: $allow_hook_only
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

mkdir -p "$(dirname "$install_dir")"

if [[ ! -d "$install_dir/.git" ]]; then
  git clone --depth 50 --branch "$repo_branch" "$repo_url" "$install_dir"
else
  git -C "$install_dir" fetch --depth 50 origin "$repo_branch"
fi

git -C "$install_dir" checkout -q "$repo_ref"

main_head="$(git -C "$install_dir" rev-parse "origin/$repo_branch")"
resolved_ref="$(git -C "$install_dir" rev-parse HEAD)"
build_status="pending"
build_error=""

if command -v go >/dev/null 2>&1; then
  if (
    cd "$install_dir/runtime"
    go build -o ../neuronfs .
  ); then
    build_status="cli build ok"
  else
    build_status="cli build failed"
    build_error="go build failed in $install_dir/runtime"
  fi
else
  build_status="cli build skipped"
  build_error="go is not installed"
fi

hook_file="$install_dir/runtime/v4-hook.cjs"
if [[ -f "$hook_file" ]]; then
  node "$repo_root/scripts/cpb-patch-neuronfs-hook.mjs" "$hook_file"
else
  echo "NeuronFS install failed: hook file not found at $hook_file" >&2
  exit 1
fi

binary_path="$install_dir/neuronfs"
if [[ ! -x "$binary_path" ]]; then
  if [[ "$allow_hook_only" == "1" ]]; then
    build_status="$build_status; hook-only mode allowed"
  else
    echo "NeuronFS install failed: runtime hook was patched, but no usable CLI binary is available." >&2
    if [[ -n "$build_error" ]]; then
      echo "Reason: $build_error" >&2
    fi
    echo "Install Go and rerun bash scripts/cpb-install-neuronfs.sh, or set NEURONFS_ALLOW_HOOK_ONLY=1 for a hook-only install." >&2
    exit 1
  fi
fi

cat <<EOF
NeuronFS installed for CPB.

Install dir: $install_dir
Main head:   $main_head
Repo ref:    $resolved_ref
Build:       $build_status

Expected paths:
  Hook:   $install_dir/runtime/v4-hook.cjs
  Binary: $binary_path

Next steps:
  1. bash scripts/cpb-rebuild-runtime-brain.sh --init-global --init-project --init-device
  2. source ~/.bashrc
EOF
