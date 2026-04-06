#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"
source "$script_dir/cpb-neuronfs-prebuilt.sh"

repo_root="${CPB_REPO_ROOT:-$(cpb_repo_root)}"
project_id="${CPB_PROJECT_ID:-$(cpb_project_id "$repo_root")}"
install_dir_default="$repo_root/.tools/neuronfs"
install_dir="${NEURONFS_INSTALL_DIR:-$install_dir_default}"
repo_url="${NEURONFS_REPO_URL:-https://github.com/rhino-acoustic/NeuronFS.git}"
repo_branch="${NEURONFS_REPO_BRANCH:-main}"
repo_ref="${NEURONFS_REPO_REF:-970e0cd}"
allow_hook_only="${NEURONFS_ALLOW_HOOK_ONLY:-0}"
prefer_prebuilt="${NEURONFS_PREFER_PREBUILT:-1}"
prebuilt_version="${NEURONFS_PREBUILT_VERSION:-$repo_ref}"
prebuilt_base_url="${NEURONFS_PREBUILT_BASE_URL:-}"
prebuilt_url="${NEURONFS_PREBUILT_URL:-}"
require_prebuilt_checksum="${NEURONFS_PREBUILT_REQUIRE_CHECKSUM:-1}"
prebuilt_checksum_url="${NEURONFS_PREBUILT_CHECKSUM_URL:-}"
usage_script="${CPB_INSTALL_USAGE_SCRIPT:-scripts/cpb-install-neuronfs.sh}"
patch_script="${CPB_INSTALL_PATCH_SCRIPT:-$repo_root/scripts/cpb-patch-neuronfs-hook.mjs}"
rebuild_script_hint="${CPB_INSTALL_REBUILD_SCRIPT_HINT:-scripts/cpb-rebuild-runtime-brain.sh}"
rebuild_args_hint="${CPB_INSTALL_REBUILD_ARGS_HINT:---init-global --init-project --init-device}"
runtime_brain_hint="${CPB_INSTALL_RUNTIME_BRAIN_HINT:-${CPB_RUNTIME_BRAIN:-$repo_root/.agent/cross-project-brain/$project_id/runtime-brain/brain_v4}}"

usage() {
  cat <<EOF
Usage: bash $usage_script

Environment overrides:
  NEURONFS_INSTALL_DIR       default: $install_dir_default
  NEURONFS_REPO_URL          default: $repo_url
  NEURONFS_REPO_BRANCH       default: $repo_branch
  NEURONFS_REPO_REF          default: $repo_ref
  NEURONFS_ALLOW_HOOK_ONLY   default: $allow_hook_only
  NEURONFS_PREFER_PREBUILT   default: $prefer_prebuilt
  NEURONFS_PREBUILT_VERSION  default: $prebuilt_version
  NEURONFS_PREBUILT_BASE_URL default: release URL for $prebuilt_version
  NEURONFS_PREBUILT_URL      explicit asset URL override
  NEURONFS_PREBUILT_REQUIRE_CHECKSUM default: $require_prebuilt_checksum
  NEURONFS_PREBUILT_CHECKSUM_URL     explicit checksum URL override
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

download_archive() {
  local url="$1"
  local dest="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$dest"
    return 0
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO "$dest" "$url"
    return 0
  fi

  return 1
}

compute_sha256() {
  local file_path="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_path" | awk '{print $1}'
    return 0
  fi

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file_path" | awk '{print $1}'
    return 0
  fi

  return 1
}

read_expected_sha256() {
  local checksum_path="$1"
  awk 'match($0, /[0-9a-fA-F]{64}/) { print substr($0, RSTART, RLENGTH); exit }' "$checksum_path"
}

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
prebuilt_note=""
prebuilt_checksum_note=""
binary_name="neuronfs"
binary_path="$install_dir/$binary_name"

install_prebuilt_binary() {
  local goos goarch asset_name archive_url checksum_url checksum_name tmpdir archive_path checksum_path extracted_path expected_sha actual_sha

  if [[ "$prefer_prebuilt" != "1" ]]; then
    return 1
  fi

  if ! goos="$(cpdb_detect_prebuilt_goos)"; then
    build_error="prebuilt CLI unavailable: unsupported operating system for this installer host"
    return 1
  fi

  if ! goarch="$(cpdb_detect_prebuilt_goarch)"; then
    build_error="prebuilt CLI unavailable: unsupported CPU architecture for this installer host"
    return 1
  fi

  binary_name="$(cpdb_neuronfs_binary_name "$goos")"
  asset_name="$(cpdb_neuronfs_prebuilt_asset_name "$prebuilt_version" "$goos" "$goarch")"

  if [[ -n "$prebuilt_url" ]]; then
    archive_url="$prebuilt_url"
  else
    archive_url="$(cpdb_neuronfs_prebuilt_download_url "$prebuilt_version" "$goos" "$goarch" "$prebuilt_base_url")"
  fi

  if [[ -n "$prebuilt_checksum_url" ]]; then
    checksum_url="$prebuilt_checksum_url"
  else
    checksum_url="$(cpdb_neuronfs_prebuilt_checksum_url "$prebuilt_version" "$goos" "$goarch" "$prebuilt_base_url")"
  fi

  tmpdir="$(mktemp -d)"
  archive_path="$tmpdir/$asset_name"
  checksum_name="$(cpdb_neuronfs_prebuilt_checksum_name "$prebuilt_version" "$goos" "$goarch")"
  checksum_path="$tmpdir/$checksum_name"
  extracted_path="$tmpdir/$binary_name"

  if ! download_archive "$archive_url" "$archive_path"; then
    build_error="prebuilt CLI download failed from $archive_url"
    rm -rf "$tmpdir"
    return 1
  fi

  if [[ "$require_prebuilt_checksum" == "1" ]]; then
    if ! download_archive "$checksum_url" "$checksum_path"; then
      build_error="prebuilt CLI checksum download failed from $checksum_url"
      rm -rf "$tmpdir"
      return 1
    fi

    expected_sha="$(read_expected_sha256 "$checksum_path")"
    if [[ -z "$expected_sha" ]]; then
      build_error="prebuilt CLI checksum file did not contain a SHA-256 digest"
      rm -rf "$tmpdir"
      return 1
    fi

    if ! actual_sha="$(compute_sha256 "$archive_path")"; then
      build_error="no SHA-256 tool is available to verify the prebuilt CLI archive"
      rm -rf "$tmpdir"
      return 1
    fi

    if [[ "$expected_sha" != "$actual_sha" ]]; then
      build_error="prebuilt CLI checksum mismatch for $archive_url"
      rm -rf "$tmpdir"
      return 1
    fi

    prebuilt_checksum_note="$checksum_url"
  fi

  if ! tar -xzf "$archive_path" -C "$tmpdir"; then
    build_error="prebuilt CLI archive could not be extracted from $archive_url"
    rm -rf "$tmpdir"
    return 1
  fi

  if [[ ! -f "$extracted_path" ]]; then
    build_error="prebuilt CLI archive did not contain $binary_name"
    rm -rf "$tmpdir"
    return 1
  fi

  install -m 0755 "$extracted_path" "$install_dir/$binary_name"
  binary_path="$install_dir/$binary_name"
  build_status="cli prebuilt ok"
  prebuilt_note="$archive_url"
  rm -rf "$tmpdir"
  return 0
}

if ! install_prebuilt_binary; then
  binary_name="neuronfs"
  binary_path="$install_dir/$binary_name"

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
  elif [[ -n "$build_error" ]]; then
    build_status="cli prebuilt unavailable"
  else
    build_status="cli build skipped"
    build_error="go is not installed"
  fi
fi

hook_file="$install_dir/runtime/v4-hook.cjs"
if [[ -f "$hook_file" ]]; then
  env -u NODE_OPTIONS node "$patch_script" "$hook_file"
else
  echo "NeuronFS install failed: hook file not found at $hook_file" >&2
  exit 1
fi

if [[ ! -x "$binary_path" ]]; then
  if [[ "$allow_hook_only" == "1" ]]; then
    build_status="$build_status; hook-only mode allowed"
  else
    echo "NeuronFS install failed: runtime hook was patched, but no usable CLI binary is available." >&2
    if [[ -n "$build_error" ]]; then
      echo "Reason: $build_error" >&2
    fi
    echo "Install Go, publish/provide a prebuilt NeuronFS CLI, and rerun bash $usage_script, or set NEURONFS_ALLOW_HOOK_ONLY=1 for a hook-only install." >&2
    exit 2
  fi
fi

cat <<EOF
NeuronFS installed.

Install dir: $install_dir
Main head:   $main_head
Repo ref:    $resolved_ref
Build:       $build_status
EOF

if [[ -n "$prebuilt_note" ]]; then
  printf 'Prebuilt:    %s\n' "$prebuilt_note"
fi

if [[ -n "$prebuilt_checksum_note" ]]; then
  printf 'Checksum:    verified via %s\n' "$prebuilt_checksum_note"
fi

cat <<EOF

Expected paths:
  Hook:   $install_dir/runtime/v4-hook.cjs
  Binary: $binary_path

Next steps:
  1. bash $rebuild_script_hint $rebuild_args_hint
  2. export NEURONFS_BRAIN="$runtime_brain_hint"
  3. export NODE_OPTIONS="--require $install_dir/runtime/v4-hook.cjs"
EOF
