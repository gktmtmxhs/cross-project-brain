#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$script_dir/cpb-neuronfs-prebuilt.sh"

repo_root="$(cd "$script_dir/.." && pwd)"
repo_slug="${CPB_RELEASE_REPO:-gktmtmxhs/cross-project-brain}"
repo_ref="${NEURONFS_REPO_REF:-970e0cd}"
version="${NEURONFS_PREBUILT_VERSION:-$repo_ref}"
tag="$(cpdb_neuronfs_prebuilt_default_tag "$version")"
target_commit="${CPB_RELEASE_TARGET_COMMIT:-$(git -C "$repo_root" rev-parse HEAD)}"
output_dir_default="$repo_root/dist/neuronfs-prebuilt/$tag"
output_dir="${NEURONFS_PREBUILT_OUT_DIR:-$output_dir_default}"
draft=0
dry_run=0
notes_file=""
platforms=()

usage() {
  cat <<EOF
Usage: bash scripts/cpb-publish-neuronfs-release.sh [options]

Options:
  --platform <goos/goarch>   repeatable; default common matrix
  --version <version>        default: $version
  --tag <tag>                default: $tag
  --target-commit <sha>      default: $target_commit
  --out-dir <path>           default: $output_dir_default
  --repo <owner/name>        default: $repo_slug
  --notes-file <path>        optional release body
  --draft                    create a draft release
  --dry-run                  print the actions without executing them

Examples:
  bash scripts/cpb-publish-neuronfs-release.sh
  bash scripts/cpb-publish-neuronfs-release.sh --platform linux/amd64 --platform darwin/arm64 --dry-run
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      platforms+=("$2")
      shift 2
      ;;
    --version)
      version="$2"
      tag="$(cpdb_neuronfs_prebuilt_default_tag "$version")"
      shift 2
      ;;
    --tag)
      tag="$2"
      shift 2
      ;;
    --target-commit)
      target_commit="$2"
      shift 2
      ;;
    --out-dir)
      output_dir="$2"
      shift 2
      ;;
    --repo)
      repo_slug="$2"
      shift 2
      ;;
    --notes-file)
      notes_file="$2"
      shift 2
      ;;
    --draft)
      draft=1
      shift
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ${#platforms[@]} -eq 0 ]]; then
  platforms=(
    "linux/amd64"
    "linux/arm64"
    "darwin/amd64"
    "darwin/arm64"
    "windows/amd64"
    "windows/arm64"
  )
fi

release_body_default=$'Prebuilt NeuronFS CLI assets for CPB full-mode installation.\n\nAssets:\n- linux amd64/arm64\n- darwin amd64/arm64\n- windows amd64/arm64\n- sha256 checksums for each archive'

if [[ -n "$notes_file" ]]; then
  release_body="$(cat "$notes_file")"
else
  release_body="$release_body_default"
fi

run_or_print() {
  local description="$1"
  shift

  if [[ "$dry_run" -eq 1 ]]; then
    printf '[dry-run] %s\n' "$description"
    printf '  %q' "$@"
    printf '\n'
    return 0
  fi

  "$@"
}

mkdir -p "$output_dir"

for platform in "${platforms[@]}"; do
  goos="${platform%%/*}"
  goarch="${platform##*/}"
  run_or_print \
    "build prebuilt asset for $goos/$goarch" \
    bash "$script_dir/cpb-build-neuronfs-prebuilt.sh" --goos "$goos" --goarch "$goarch" --version "$version" --out-dir "$output_dir"
done

run_or_print \
  "push tag $tag -> $target_commit" \
  git -C "$repo_root" push origin "$target_commit:refs/tags/$tag"

if [[ "$dry_run" -eq 1 ]]; then
  printf '[dry-run] ensure release %s exists in %s\n' "$tag" "$repo_slug"
else
  if ! gh release view "$tag" --repo "$repo_slug" >/dev/null 2>&1; then
    create_args=(release create "$tag" --repo "$repo_slug" --title "NeuronFS $version prebuilt CLI" --notes "$release_body")
    if [[ "$draft" -eq 1 ]]; then
      create_args+=(--draft)
    fi
    gh "${create_args[@]}"
  fi
fi

upload_glob=("$output_dir"/*)
run_or_print \
  "upload release assets from $output_dir" \
  gh release upload "$tag" "${upload_glob[@]}" --repo "$repo_slug" --clobber

printf 'NeuronFS release publish complete.\n'
printf '  Repo:   %s\n' "$repo_slug"
printf '  Tag:    %s\n' "$tag"
printf '  Commit: %s\n' "$target_commit"
printf '  Assets: %s\n' "$output_dir"
