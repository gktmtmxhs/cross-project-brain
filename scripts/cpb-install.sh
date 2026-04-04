#!/usr/bin/env bash
set -euo pipefail

target_repo="$PWD"
force=0
setup_shell=1
install_neuronfs=1
start_autogrowth=1
personal_repo=""
shared_repo=0
temp_framework_root=""

usage() {
  cat <<EOF
Usage: bash scripts/cpb-install.sh [--target <path>] [--personal-repo <path>] [--shared-repo] [--force] [--no-shell] [--no-neuronfs] [--no-autogrowth]

Examples:
  bash /path/to/cross-project-brain/scripts/cpb-install.sh --personal-repo "$HOME/.cpb-personal" --shared-repo
  bash /path/to/cross-project-brain/scripts/cpb-install.sh --target /path/to/repo
  bash /path/to/cross-project-brain/scripts/cpb-install.sh --personal-repo ~/workspace/cpb-personal --shared-repo
  tmpdir="$(mktemp -d)" && git clone --depth 1 https://github.com/<owner>/cross-project-brain.git "$tmpdir" && bash "$tmpdir/scripts/cpb-install.sh" --personal-repo "$HOME/.cpb-personal" --shared-repo && rm -rf "$tmpdir"

Advanced stdin/bootstrap mode:
  Set CPB_FRAMEWORK_REPO_URL when running this script without a checked-out framework repo beside it.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      target_repo="$2"
      shift 2
      ;;
    --personal-repo)
      personal_repo="$2"
      shift 2
      ;;
    --shared-repo)
      shared_repo=1
      shift
      ;;
    --force)
      force=1
      shift
      ;;
    --no-shell)
      setup_shell=0
      shift
      ;;
    --no-neuronfs)
      install_neuronfs=0
      shift
      ;;
    --no-autogrowth)
      start_autogrowth=0
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

cleanup() {
  if [[ -n "$temp_framework_root" && -d "$temp_framework_root" ]]; then
    rm -rf "$temp_framework_root"
  fi
}
trap cleanup EXIT

resolve_framework_root() {
  local script_dir local_root
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local_root="$(cd "$script_dir/.." && pwd)"

  if [[ -d "$local_root/templates" && -d "$local_root/scripts" && -f "$local_root/README.md" ]]; then
    printf '%s\n' "$local_root"
    return 0
  fi

  local repo_url="${CPB_FRAMEWORK_REPO_URL:-}"
  local repo_ref="${CPB_FRAMEWORK_REPO_REF:-main}"
  if [[ -z "$repo_url" ]]; then
    echo "Could not resolve the framework root automatically." >&2
    echo "Run from a checked-out framework repo or set CPB_FRAMEWORK_REPO_URL." >&2
    exit 1
  fi

  temp_framework_root="$(mktemp -d)"
  git clone --depth 1 --branch "$repo_ref" "$repo_url" "$temp_framework_root/framework" >/dev/null 2>&1
  printf '%s\n' "$temp_framework_root/framework"
}

framework_root="$(resolve_framework_root)"
mkdir -p "$target_repo"
target_repo="$(cd "$target_repo" && pwd)"

copy_file() {
  local source="$1"
  local dest="$2"
  local dest_dir
  dest_dir="$(dirname "$dest")"
  mkdir -p "$dest_dir"

  if [[ -e "$dest" && "$force" -ne 1 ]]; then
    return 0
  fi

  cp "$source" "$dest"
  case "$dest" in
    *.sh|*.bash)
      chmod +x "$dest"
      ;;
  esac
}

expand_path() {
  local value="$1"

  if [[ "$value" == "~" ]]; then
    value="$HOME"
  elif [[ "$value" == ~/* ]]; then
    value="$HOME/${value#~/}"
  fi

  if [[ "$value" != /* ]]; then
    value="$PWD/$value"
  fi

  printf '%s\n' "$value"
}

write_hook() {
  local hook_name="$1"
  local hook_path="$target_repo/.githooks/$hook_name"
  mkdir -p "$(dirname "$hook_path")"
  if [[ "$hook_name" == "pre-push" ]]; then
    cat >"$hook_path" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
bash "$repo_root/scripts/cpb-sync-personal-repo.sh" || true
EOF
    chmod +x "$hook_path"
    return 0
  fi
  cat >"$hook_path" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
bash "$repo_root/scripts/cpb-refresh-after-git.sh"
EOF
  chmod +x "$hook_path"
}

ensure_brain_layout() {
  local brain_root="$1"
  mkdir -p \
    "$brain_root/brainstem" \
    "$brain_root/limbic" \
    "$brain_root/hippocampus" \
    "$brain_root/sensors" \
    "$brain_root/cortex" \
    "$brain_root/ego" \
    "$brain_root/prefrontal"
}

mkdir -p "$target_repo/scripts" "$target_repo/.githooks" "$target_repo/brains"

for script_name in \
  setup-cpb-profile.sh \
  cpb-install.sh \
  cpb-install-neuronfs.sh \
  cpb-doctor.sh \
  cpb-patch-neuronfs-hook.mjs \
  cpb-selective-injection.cjs \
  cpb-paths.mjs \
  cpb-paths.sh \
  cpb-role-taxonomy.mjs \
  cpb-log-learning.mjs \
  cpb-finish-check.mjs \
  cpb-rebuild-runtime-brain.sh \
  cpb-refresh-after-git.sh \
  cpb-setup-shell.sh \
  cpb-setup-git-hooks.sh \
  cpb-setup-personal-repo.sh \
  cpb-autogrowth.mjs \
  cpb-autogrowth.sh \
  cpb-sync-personal-repo.sh \
  project-brain-autoenv.bash
do
  copy_file "$framework_root/scripts/$script_name" "$target_repo/scripts/$script_name"
done

copy_file "$framework_root/templates/AGENTS.md" "$target_repo/AGENTS.md"
copy_file "$framework_root/templates/CLAUDE.md" "$target_repo/CLAUDE.md"

if [[ -f "$framework_root/templates/docs/career/README.md" ]]; then
  copy_file "$framework_root/templates/docs/career/README.md" "$target_repo/docs/career/README.md"
fi

if [[ -f "$framework_root/templates/brains/team-brain/brain_v4/README.md" ]]; then
  copy_file \
    "$framework_root/templates/brains/team-brain/brain_v4/README.md" \
    "$target_repo/brains/team-brain/brain_v4/README.md"
fi

copy_file \
  "$framework_root/templates/config/skill-role-map.example.json" \
  "$target_repo/config/cpdb/skill-role-map.example.json"

ensure_brain_layout "$target_repo/brains/team-brain/brain_v4"

write_hook "post-merge"
write_hook "post-checkout"
write_hook "post-rewrite"
write_hook "pre-push"

if [[ -d "$target_repo/.git" ]]; then
  bash "$target_repo/scripts/cpb-setup-git-hooks.sh" --repo-root "$target_repo"
fi

if [[ -n "$personal_repo" ]]; then
  personal_repo="$(expand_path "$personal_repo")"
  # shellcheck disable=SC1091
  source "$target_repo/scripts/cpb-paths.sh"
  operator_id="$(cpdb_detect_operator_id "$target_repo")"
  project_id="${CPB_PROJECT_ID:-$(basename "$target_repo")}"

  export CPB_PERSONAL_REPO="$personal_repo"
  export CPB_GLOBAL_BRAIN="$personal_repo/brains/global-operators/$operator_id/brain_v4"
  mkdir -p "$CPB_GLOBAL_BRAIN"

  if [[ "$shared_repo" -eq 1 ]]; then
    export CPB_PROJECT_BRAIN="$target_repo/.agent/cross-project-brain/$project_id/project-brain/brain_v4"
    mkdir -p "$CPB_PROJECT_BRAIN"
  fi
fi

if [[ "$install_neuronfs" -eq 1 ]]; then
  CPB_REPO_ROOT="$target_repo" \
  CPB_NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
  NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
  bash "$target_repo/scripts/cpb-install-neuronfs.sh"
fi

CPB_REPO_ROOT="$target_repo" \
CPB_NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
bash "$target_repo/scripts/cpb-rebuild-runtime-brain.sh" --init-global --init-project --init-device

if [[ "$setup_shell" -eq 1 ]]; then
  bash "$target_repo/scripts/cpb-setup-shell.sh" --repo-root "$target_repo"
fi

if [[ -n "$personal_repo" ]]; then
  personal_setup_args=("$personal_repo" "--repo-root" "$target_repo")
  if [[ "$shared_repo" -eq 1 ]]; then
    personal_setup_args+=("--shared-repo")
  fi
  bash "$target_repo/scripts/cpb-setup-personal-repo.sh" "${personal_setup_args[@]}"
fi

if [[ "$start_autogrowth" -eq 1 && -x "$target_repo/.tools/neuronfs/neuronfs" ]]; then
  CPB_REPO_ROOT="$target_repo" \
  CPB_NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
  NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
  bash "$target_repo/scripts/cpb-autogrowth.sh" start || true
fi

if command -v node >/dev/null 2>&1; then
  CPB_REPO_ROOT="$target_repo" \
  CPB_NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
  NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
  node "$target_repo/scripts/cpb-finish-check.mjs" --init-baseline || true
fi

cat <<EOF
CPB bootstrap complete.

Target repo: $target_repo

Installed:
  - scripts/cpb-*
  - AGENTS.md
  - CLAUDE.md
  - brains/team-brain/brain_v4
  - .githooks/*
EOF

if [[ -n "$personal_repo" ]]; then
  cat <<EOF

Personal repo wiring:
  - personal repo root: $personal_repo
  - shared/team repo mode: $shared_repo
  - project git pull -> personal repo pull + runtime rebuild
  - project git push -> personal repo commit/pull/push attempt
EOF
fi

cat <<EOF

Next steps:
  1. Open a new shell or run: source ~/.bashrc
  2. Run: bash scripts/setup-cpb-profile.sh status
  3. Open the repo and let your coding agent read AGENTS.md / CLAUDE.md
  4. Start working normally
EOF

if [[ -n "$personal_repo" ]]; then
  cat <<EOF
  5. Use normal git pull / git push in this project repo
     - pull will try to refresh your personal repo first
     - push will try to sync your personal repo before the project push
EOF
fi
