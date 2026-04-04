#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$script_dir/cpb-paths.sh"
# shellcheck disable=SC1091
source "$script_dir/cpb-neuronfs-prebuilt.sh"
cpdb_export_paths

repo_root="$CPB_REPO_ROOT"
install_dir_default="$repo_root/.tools/neuronfs"
install_dir="${NEURONFS_INSTALL_DIR:-$install_dir_default}"
repo_url="${NEURONFS_REPO_URL:-https://github.com/rhino-acoustic/NeuronFS.git}"
repo_branch="${NEURONFS_REPO_BRANCH:-main}"
repo_ref="${NEURONFS_REPO_REF:-970e0cd}"
version="${NEURONFS_PREBUILT_VERSION:-$repo_ref}"
goos="${NEURONFS_PREBUILT_GOOS:-}"
goarch="${NEURONFS_PREBUILT_GOARCH:-}"
output_dir_default="$repo_root/dist/neuronfs-prebuilt"
output_dir="${NEURONFS_PREBUILT_OUT_DIR:-$output_dir_default}"

usage() {
  cat <<EOF
Usage: bash scripts/cpb-build-neuronfs-prebuilt.sh [--goos <goos>] [--goarch <goarch>] [--version <version>] [--out-dir <path>]

Environment overrides:
  NEURONFS_INSTALL_DIR       default: $install_dir_default
  NEURONFS_REPO_URL          default: $repo_url
  NEURONFS_REPO_BRANCH       default: $repo_branch
  NEURONFS_REPO_REF          default: $repo_ref
  NEURONFS_PREBUILT_VERSION  default: $version
  NEURONFS_PREBUILT_GOOS     default: detected from this machine
  NEURONFS_PREBUILT_GOARCH   default: detected from this machine
  NEURONFS_PREBUILT_OUT_DIR  default: $output_dir_default
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --goos)
      goos="$2"
      shift 2
      ;;
    --goarch)
      goarch="$2"
      shift 2
      ;;
    --version)
      version="$2"
      shift 2
      ;;
    --out-dir)
      output_dir="$2"
      shift 2
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

if ! command -v go >/dev/null 2>&1; then
  echo "Go is required to build a prebuilt NeuronFS CLI archive." >&2
  exit 1
fi

if [[ -z "$goos" ]]; then
  goos="$(cpdb_detect_prebuilt_goos)"
fi

if [[ -z "$goarch" ]]; then
  goarch="$(cpdb_detect_prebuilt_goarch)"
fi

mkdir -p "$(dirname "$install_dir")" "$output_dir"

if [[ ! -d "$install_dir/.git" ]]; then
  git clone --depth 50 --branch "$repo_branch" "$repo_url" "$install_dir"
else
  git -C "$install_dir" fetch --depth 50 origin "$repo_branch"
fi

git -C "$install_dir" checkout -q "$repo_ref"

binary_name="$(cpdb_neuronfs_binary_name "$goos")"
asset_name="$(cpdb_neuronfs_prebuilt_asset_name "$version" "$goos" "$goarch")"
asset_path="$output_dir/$asset_name"
checksum_path="$asset_path.sha256"

(
  cd "$install_dir/runtime"
  GOOS="$goos" GOARCH="$goarch" CGO_ENABLED=0 go build -o "../$binary_name" .
)

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
cp "$install_dir/$binary_name" "$tmpdir/$binary_name"

if command -v sha256sum >/dev/null 2>&1; then
  tar -C "$tmpdir" -czf "$asset_path" "$binary_name"
  (
    cd "$output_dir"
    sha256sum "$asset_name" >"$checksum_path"
  )
else
  tar -C "$tmpdir" -czf "$asset_path" "$binary_name"
fi

cat <<EOF
NeuronFS prebuilt asset created.

Repo ref:   $(git -C "$install_dir" rev-parse HEAD)
Version:    $version
Platform:   $goos/$goarch
Archive:    $asset_path
Binary:     $install_dir/$binary_name
EOF

if [[ -f "$checksum_path" ]]; then
  printf 'Checksum:   %s\n' "$checksum_path"
fi
