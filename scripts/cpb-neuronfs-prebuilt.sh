#!/usr/bin/env bash

CPB_PREBUILT_RELEASE_REPO_DEFAULT="__CPB_RELEASE_REPO__"

cpdb_prebuilt_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$script_dir/.." && pwd
}

cpdb_parse_github_repo_slug() {
  local raw="${1:-}"

  if [[ -z "$raw" ]]; then
    return 1
  fi

  raw="${raw%.git}"
  case "$raw" in
    git@github.com:*)
      raw="${raw#git@github.com:}"
      ;;
    ssh://git@github.com/*)
      raw="${raw#ssh://git@github.com/}"
      ;;
    https://github.com/*)
      raw="${raw#https://github.com/}"
      ;;
    http://github.com/*)
      raw="${raw#http://github.com/}"
      ;;
    git://github.com/*)
      raw="${raw#git://github.com/}"
      ;;
  esac

  if [[ "$raw" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]]; then
    printf '%s\n' "$raw"
    return 0
  fi

  return 1
}

cpdb_resolve_release_repo_slug() {
  local repo_slug="${CPB_RELEASE_REPO:-}"
  local framework_repo_url="${CPB_FRAMEWORK_REPO_URL:-}"
  local repo_root origin_url=""

  if [[ -n "$repo_slug" ]]; then
    printf '%s\n' "$repo_slug"
    return 0
  fi

  if cpdb_parse_github_repo_slug "$framework_repo_url" >/dev/null 2>&1; then
    cpdb_parse_github_repo_slug "$framework_repo_url"
    return 0
  fi

  if [[ "$CPB_PREBUILT_RELEASE_REPO_DEFAULT" == */* ]]; then
    printf '%s\n' "$CPB_PREBUILT_RELEASE_REPO_DEFAULT"
    return 0
  fi

  repo_root="$(cpdb_prebuilt_repo_root)"
  origin_url="$(git -C "$repo_root" remote get-url origin 2>/dev/null || true)"
  if cpdb_parse_github_repo_slug "$origin_url" >/dev/null 2>&1; then
    cpdb_parse_github_repo_slug "$origin_url"
    return 0
  fi

  return 1
}

cpdb_detect_prebuilt_goos() {
  local uname_s
  uname_s="$(uname -s)"
  case "$uname_s" in
    Linux)
      printf 'linux\n'
      ;;
    Darwin)
      printf 'darwin\n'
      ;;
    MINGW*|MSYS*|CYGWIN*)
      printf 'windows\n'
      ;;
    *)
      return 1
      ;;
  esac
}

cpdb_detect_prebuilt_goarch() {
  local uname_m
  uname_m="$(uname -m)"
  case "$uname_m" in
    x86_64|amd64)
      printf 'amd64\n'
      ;;
    aarch64|arm64)
      printf 'arm64\n'
      ;;
    *)
      return 1
      ;;
  esac
}

cpdb_neuronfs_binary_name() {
  local goos="${1:-}"
  if [[ "$goos" == "windows" ]]; then
    printf 'neuronfs.exe\n'
  else
    printf 'neuronfs\n'
  fi
}

cpdb_neuronfs_prebuilt_asset_name() {
  local version="${1:?version required}"
  local goos="${2:?goos required}"
  local goarch="${3:?goarch required}"
  printf 'neuronfs-%s-%s-%s.tar.gz\n' "$version" "$goos" "$goarch"
}

cpdb_neuronfs_prebuilt_checksum_name() {
  local version="${1:?version required}"
  local goos="${2:?goos required}"
  local goarch="${3:?goarch required}"
  printf '%s.sha256\n' "$(cpdb_neuronfs_prebuilt_asset_name "$version" "$goos" "$goarch")"
}

cpdb_neuronfs_prebuilt_default_tag() {
  local version="${1:?version required}"
  printf 'neuronfs-%s\n' "$version"
}

cpdb_neuronfs_prebuilt_default_base_url() {
  local version="${1:?version required}"
  local tag
  local repo_slug
  tag="$(cpdb_neuronfs_prebuilt_default_tag "$version")"
  if ! repo_slug="$(cpdb_resolve_release_repo_slug)"; then
    echo "Could not resolve the CPB release repo slug. Set CPB_RELEASE_REPO or CPB_FRAMEWORK_REPO_URL." >&2
    return 1
  fi
  printf 'https://github.com/%s/releases/download/%s\n' "$repo_slug" "$tag"
}

cpdb_neuronfs_prebuilt_download_url() {
  local version="${1:?version required}"
  local goos="${2:?goos required}"
  local goarch="${3:?goarch required}"
  local base_url="${4:-}"
  local asset_name

  if [[ -z "$base_url" ]]; then
    base_url="$(cpdb_neuronfs_prebuilt_default_base_url "$version")"
  fi

  asset_name="$(cpdb_neuronfs_prebuilt_asset_name "$version" "$goos" "$goarch")"
  printf '%s/%s\n' "${base_url%/}" "$asset_name"
}

cpdb_neuronfs_prebuilt_checksum_url() {
  local version="${1:?version required}"
  local goos="${2:?goos required}"
  local goarch="${3:?goarch required}"
  local base_url="${4:-}"
  local checksum_name

  if [[ -z "$base_url" ]]; then
    base_url="$(cpdb_neuronfs_prebuilt_default_base_url "$version")"
  fi

  checksum_name="$(cpdb_neuronfs_prebuilt_checksum_name "$version" "$goos" "$goarch")"
  printf '%s/%s\n' "${base_url%/}" "$checksum_name"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail

  command_name="${1:-help}"
  shift || true

  case "$command_name" in
    print-platform)
      goos="$(cpdb_detect_prebuilt_goos)"
      goarch="$(cpdb_detect_prebuilt_goarch)"
      binary_name="$(cpdb_neuronfs_binary_name "$goos")"
      printf 'goos=%s\ngoarch=%s\nbinary=%s\n' "$goos" "$goarch" "$binary_name"
      ;;
    asset-name)
      version="${1:-}"
      goos="${2:-}"
      goarch="${3:-}"
      if [[ -z "$version" || -z "$goos" || -z "$goarch" ]]; then
        echo "Usage: bash scripts/cpb-neuronfs-prebuilt.sh asset-name <version> <goos> <goarch>" >&2
        exit 1
      fi
      cpdb_neuronfs_prebuilt_asset_name "$version" "$goos" "$goarch"
      ;;
    checksum-name)
      version="${1:-}"
      goos="${2:-}"
      goarch="${3:-}"
      if [[ -z "$version" || -z "$goos" || -z "$goarch" ]]; then
        echo "Usage: bash scripts/cpb-neuronfs-prebuilt.sh checksum-name <version> <goos> <goarch>" >&2
        exit 1
      fi
      cpdb_neuronfs_prebuilt_checksum_name "$version" "$goos" "$goarch"
      ;;
    base-url)
      version="${1:-}"
      if [[ -z "$version" ]]; then
        echo "Usage: bash scripts/cpb-neuronfs-prebuilt.sh base-url <version>" >&2
        exit 1
      fi
      cpdb_neuronfs_prebuilt_default_base_url "$version"
      ;;
    download-url)
      version="${1:-}"
      goos="${2:-}"
      goarch="${3:-}"
      base_url="${4:-}"
      if [[ -z "$version" || -z "$goos" || -z "$goarch" ]]; then
        echo "Usage: bash scripts/cpb-neuronfs-prebuilt.sh download-url <version> <goos> <goarch> [base-url]" >&2
        exit 1
      fi
      cpdb_neuronfs_prebuilt_download_url "$version" "$goos" "$goarch" "$base_url"
      ;;
    checksum-url)
      version="${1:-}"
      goos="${2:-}"
      goarch="${3:-}"
      base_url="${4:-}"
      if [[ -z "$version" || -z "$goos" || -z "$goarch" ]]; then
        echo "Usage: bash scripts/cpb-neuronfs-prebuilt.sh checksum-url <version> <goos> <goarch> [base-url]" >&2
        exit 1
      fi
      cpdb_neuronfs_prebuilt_checksum_url "$version" "$goos" "$goarch" "$base_url"
      ;;
    help|-h|--help|"")
      cat <<'EOF'
Usage:
  bash scripts/cpb-neuronfs-prebuilt.sh print-platform
  bash scripts/cpb-neuronfs-prebuilt.sh asset-name <version> <goos> <goarch>
  bash scripts/cpb-neuronfs-prebuilt.sh checksum-name <version> <goos> <goarch>
  bash scripts/cpb-neuronfs-prebuilt.sh base-url <version>
  bash scripts/cpb-neuronfs-prebuilt.sh download-url <version> <goos> <goarch> [base-url]
  bash scripts/cpb-neuronfs-prebuilt.sh checksum-url <version> <goos> <goarch> [base-url]
EOF
      ;;
    *)
      echo "Unknown command: $command_name" >&2
      exit 1
      ;;
  esac
fi
