#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
# shellcheck disable=SC1091
source "$script_dir/cpb-paths.sh"

usage() {
  cat <<EOF
Usage:
  cpb [--repo-root <path>] profiles
  cpb [--repo-root <path>] status
  cpb [--repo-root <path>] apply <profile> [options]

Profiles:
  team-local      team/shared repo, project brain local-only under .agent/
  team-personal   team/shared repo, project brain synced through personal repo
  solo-tracked    solo/personal repo, project brain tracked in current repo
  solo-personal   solo/personal repo, project brain synced through personal repo

Options for apply:
  --operator <github-username>
  --personal-repo <path>         default: \$HOME/.cpb-personal
  --create-remote <ask|never|always>
  --skip-install                 skip NeuronFS runtime install/update
  --skip-go-install              do not auto-install Go before building NeuronFS CLI
  --skip-rebuild                 skip runtime brain rebuild

Examples:
  cpb profiles
  cpb status
  cpb apply team-local
  cpb apply team-personal --personal-repo "\$HOME/.cpb-personal"
EOF
}

print_profiles() {
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

resolve_operator() {
  local provided="${1:-}"
  local detected=""

  if [[ -n "$provided" ]]; then
    printf '%s\n' "$(cpdb_sanitize_operator_id "$provided")"
    return 0
  fi

  if command -v gh >/dev/null 2>&1; then
    detected="$(gh api user --jq .login 2>/dev/null || true)"
  fi

  if [[ -z "$detected" ]]; then
    detected="$(cpdb_detect_operator_id "$repo_root")"
  fi

  printf '%s\n' "$(cpdb_sanitize_operator_id "$detected")"
}

project_brain_for_mode() {
  local mode="$1"
  local operator="$2"
  local personal_repo="$3"
  local project_id
  project_id="${CPB_PROJECT_ID:-$(basename "$repo_root")}"

  case "$mode" in
    tracked)
      printf '%s\n' "$repo_root/brains/project-operators/$operator/brain_v4"
      ;;
    local)
      printf '%s\n' "$repo_root/.agent/cross-project-brain/$project_id/project-brain/brain_v4"
      ;;
    personal)
      printf '%s\n' "$personal_repo/brains/project-operators/$operator/$project_id/brain_v4"
      ;;
    *)
      return 1
      ;;
  esac
}

run_status() {
  local operator="${1:-}"
  local personal_repo="${2:-}"
  local project_brain="${3:-}"

  if [[ -n "$operator" || -n "$personal_repo" || -n "$project_brain" ]]; then
    CPB_REPO_ROOT="$repo_root" \
    CPB_OPERATOR="$operator" \
    CPB_PERSONAL_REPO="$personal_repo" \
    CPB_PROJECT_BRAIN="$project_brain" \
    bash "$script_dir/cpb-doctor.sh" --repo-root "$repo_root"
    return 0
  fi

  bash -ic "cd '$repo_root' && bash '$script_dir/cpb-doctor.sh' --repo-root '$repo_root'"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root)
      repo_root="$(cd "$2" && pwd)"
      shift 2
      ;;
    *)
      break
      ;;
  esac
done

command_name="${1:-}"

case "$command_name" in
  profiles|list)
    print_profiles
    exit 0
    ;;
  status|doctor)
    run_status
    exit 0
    ;;
  apply)
    ;;
  ""|-h|--help|help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown command: $command_name" >&2
    usage >&2
    exit 1
    ;;
esac

profile="${2:-}"
if [[ -z "$profile" ]]; then
  usage >&2
  exit 1
fi
shift 2

operator=""
personal_repo="$HOME/.cpb-personal"
create_remote_mode=""
skip_install=0
auto_install_go=1
skip_rebuild=0
shared_repo=0
project_brain_mode=""

case "$profile" in
  team-local)
    shared_repo=1
    project_brain_mode="local"
    ;;
  team-personal)
    shared_repo=1
    project_brain_mode="personal"
    ;;
  solo-tracked)
    project_brain_mode="tracked"
    ;;
  solo-personal)
    project_brain_mode="personal"
    ;;
  *)
    echo "Unsupported profile: $profile" >&2
    print_profiles >&2
    exit 1
    ;;
esac

while [[ $# -gt 0 ]]; do
  case "$1" in
    --operator)
      operator="$2"
      shift 2
      ;;
    --personal-repo)
      personal_repo="$2"
      shift 2
      ;;
    --create-remote)
      create_remote_mode="$2"
      shift 2
      ;;
    --skip-install)
      skip_install=1
      shift
      ;;
    --skip-go-install)
      auto_install_go=0
      shift
      ;;
    --skip-rebuild)
      skip_rebuild=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unexpected argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

operator="$(resolve_operator "$operator")"
personal_repo="$(expand_path "$personal_repo")"
project_brain_path="$(project_brain_for_mode "$project_brain_mode" "$operator" "$personal_repo")"

printf 'Applying CPB profile.\n'
printf '  Repo:          %s\n' "$repo_root"
printf '  Profile:       %s\n' "$profile"
printf '  Operator:      %s\n' "$operator"
printf '  Personal repo: %s\n' "$personal_repo"
printf '  Project brain: %s\n' "$project_brain_path"

personal_repo_args=("$personal_repo" "--repo-root" "$repo_root" "--project-brain-mode" "$project_brain_mode")
if [[ "$shared_repo" -eq 1 ]]; then
  personal_repo_args+=("--shared-repo")
fi

if [[ -n "$create_remote_mode" ]]; then
  CPB_REPO_ROOT="$repo_root" \
  CPB_OPERATOR="$operator" \
  CPB_CREATE_PERSONAL_REMOTE="$create_remote_mode" \
  bash "$script_dir/cpb-setup-personal-repo.sh" "${personal_repo_args[@]}"
else
  CPB_REPO_ROOT="$repo_root" \
  CPB_OPERATOR="$operator" \
  bash "$script_dir/cpb-setup-personal-repo.sh" "${personal_repo_args[@]}"
fi

bash "$script_dir/cpb-setup-git-hooks.sh" --repo-root "$repo_root"
bash "$script_dir/cpb-setup-shell.sh" --repo-root "$repo_root"

if [[ "$skip_install" -eq 0 ]]; then
  if ! command -v go >/dev/null 2>&1 && [[ "$auto_install_go" -eq 1 ]]; then
    if ! bash "$script_dir/cpb-install-go.sh"; then
      printf 'Automatic Go install did not complete; continuing with degraded NeuronFS hook-only mode.\n'
    fi
  fi

  if command -v go >/dev/null 2>&1; then
    CPB_REPO_ROOT="$repo_root" \
    CPB_OPERATOR="$operator" \
    CPB_PERSONAL_REPO="$personal_repo" \
    CPB_PROJECT_BRAIN="$project_brain_path" \
    bash "$script_dir/cpb-install-neuronfs.sh"
  else
    if [[ "$auto_install_go" -eq 1 ]]; then
      printf 'Go is still not available; installing NeuronFS in degraded hook-only mode (autogrowth disabled).\n'
    else
      printf 'Go auto-install was skipped; installing NeuronFS in degraded hook-only mode (autogrowth disabled).\n'
    fi
    CPB_REPO_ROOT="$repo_root" \
    CPB_OPERATOR="$operator" \
    CPB_PERSONAL_REPO="$personal_repo" \
    CPB_PROJECT_BRAIN="$project_brain_path" \
    NEURONFS_ALLOW_HOOK_ONLY=1 \
    bash "$script_dir/cpb-install-neuronfs.sh"
  fi
fi

if [[ "$skip_rebuild" -eq 0 ]]; then
  CPB_REPO_ROOT="$repo_root" \
  CPB_OPERATOR="$operator" \
  CPB_PERSONAL_REPO="$personal_repo" \
  CPB_PROJECT_BRAIN="$project_brain_path" \
  bash "$script_dir/cpb-rebuild-runtime-brain.sh" --init-global --init-project --init-device
fi

printf '\nProfile apply complete. Current status:\n\n'
run_status "$operator" "$personal_repo" "$project_brain_path"
