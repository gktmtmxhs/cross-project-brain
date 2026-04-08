#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
source "$script_dir/cpb-paths.sh"
source "$script_dir/cpb-profiles.sh"
command_alias="${CPB_PROFILE_COMMAND_ALIAS:-cpb}"
doctor_script="${CPB_PROFILE_DOCTOR_SCRIPT:-$script_dir/cpb-doctor.sh}"
setup_operator_script="${CPB_PROFILE_SETUP_OPERATOR_SCRIPT:-$script_dir/cpb-setup-operator.sh}"
setup_personal_repo_script="${CPB_PROFILE_SETUP_PERSONAL_REPO_SCRIPT:-$script_dir/cpb-setup-personal-repo.sh}"
setup_git_hooks_script="${CPB_PROFILE_SETUP_GIT_HOOKS_SCRIPT:-$script_dir/cpb-setup-git-hooks.sh}"
setup_shell_script="${CPB_PROFILE_SETUP_SHELL_SCRIPT:-$script_dir/cpb-setup-shell.sh}"
install_script="${CPB_PROFILE_INSTALL_SCRIPT:-$script_dir/cpb-install-neuronfs.sh}"
install_go_script="${CPB_PROFILE_INSTALL_GO_SCRIPT:-$script_dir/cpb-install-go.sh}"
rebuild_script="${CPB_PROFILE_REBUILD_SCRIPT:-$script_dir/cpb-rebuild-runtime-brain.sh}"

usage() {
  cat <<EOF
Usage:
  $command_alias [--repo-root <path>] profiles
  $command_alias [--repo-root <path>] status
  $command_alias [--repo-root <path>] apply <profile> [options]

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
  $command_alias profiles
  $command_alias status
  $command_alias apply team-local
  $command_alias apply team-personal --personal-repo "\$HOME/.cpb-personal"
EOF
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
    bash "$doctor_script" --repo-root "$repo_root"
    return 0
  fi

  bash -ic "cd '$repo_root' && bash '$doctor_script' --repo-root '$repo_root'"
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
    cpb_print_profiles
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

if ! cpb_apply_profile_settings "$profile"; then
  echo "Unsupported profile: $profile" >&2
  cpb_print_profiles >&2
  exit 1
fi

shared_repo="$CPB_PROFILE_SHARED_REPO"
project_brain_mode="$CPB_PROFILE_PROJECT_BRAIN_MODE"

operator="$(cpb_resolve_operator "$repo_root" "$operator")"
personal_repo="$(cpb_normalize_personal_repo_path "$personal_repo")"
project_id="${CPB_PROJECT_ID:-$(cpb_project_id "$repo_root")}"
tracked_project_brain_root="${CPB_PROFILE_TRACKED_PROJECT_OPERATORS_ROOT:-${CPB_TRACKED_PROJECT_OPERATORS_ROOT:-$(cpb_tracked_project_operators_root_default "$repo_root")}}"
tracked_project_brain="$(cpb_tracked_project_brain_path "$tracked_project_brain_root" "$operator")"
local_project_brain="${CPB_PROFILE_LOCAL_PROJECT_BRAIN:-$repo_root/.agent/cross-project-brain/$project_id/project-brain/brain_v4}"
personal_project_brain="$(cpb_personal_project_brain_path "$personal_repo" "$project_id" "$operator")"
project_brain_path="$(cpb_project_brain_for_mode "$project_brain_mode" "$tracked_project_brain" "$local_project_brain" "$personal_project_brain")"
hooks_dir="${CPB_PROFILE_HOOKS_DIR:-$repo_root/.githooks}"
post_refresh_script="${CPB_PROFILE_POST_REFRESH_SCRIPT:-scripts/cpb-refresh-after-git.sh}"
pre_push_script="${CPB_PROFILE_PRE_PUSH_SCRIPT:-scripts/cpb-sync-personal-repo.sh}"
rebuild_args_string="${CPB_PROFILE_REBUILD_ARGS:---init-global --init-project}"
read -r -a rebuild_args <<< "$rebuild_args_string"

printf 'Applying CPB profile.\n'
printf '  Repo:          %s\n' "$repo_root"
printf '  Profile:       %s\n' "$profile"
printf '  Operator:      %s\n' "$operator"
printf '  Personal repo: %s\n' "$personal_repo"
printf '  Project brain: %s\n' "$project_brain_path"

CPB_REPO_ROOT="$repo_root" \
CPB_OPERATOR="$operator" \
bash "$setup_operator_script" "$operator"

personal_repo_args=("$personal_repo" "--repo-root" "$repo_root" "--project-brain-mode" "$project_brain_mode")
if [[ "$shared_repo" -eq 1 ]]; then
  personal_repo_args+=("--shared-repo")
fi

if [[ -n "$create_remote_mode" ]]; then
  CPB_REPO_ROOT="$repo_root" \
  CPB_OPERATOR="$operator" \
  CPB_CREATE_PERSONAL_REMOTE="$create_remote_mode" \
  bash "$setup_personal_repo_script" "${personal_repo_args[@]}"
else
  CPB_REPO_ROOT="$repo_root" \
  CPB_OPERATOR="$operator" \
  bash "$setup_personal_repo_script" "${personal_repo_args[@]}"
fi

bash "$setup_git_hooks_script" \
  --repo-root "$repo_root" \
  --hooks-dir "$hooks_dir" \
  --post-refresh-script "$post_refresh_script" \
  --pre-push-script "$pre_push_script"

CPB_REPO_ROOT="$repo_root" \
bash "$setup_shell_script"

if [[ "$skip_install" -eq 0 ]]; then
  run_neuronfs_install() {
    CPB_REPO_ROOT="$repo_root" \
    CPB_OPERATOR="$operator" \
    CPB_PERSONAL_REPO="$personal_repo" \
    CPB_PROJECT_BRAIN="$project_brain_path" \
    bash "$install_script"
  }

  set +e
  run_neuronfs_install
  neuronfs_install_rc=$?
  set -e

  if [[ "$neuronfs_install_rc" -eq 2 ]]; then
    if ! command -v go >/dev/null 2>&1 && [[ "$auto_install_go" -eq 1 ]]; then
      if bash "$install_go_script"; then
        set +e
        run_neuronfs_install
        neuronfs_install_rc=$?
        set -e
      else
        printf 'Automatic Go install did not complete; continuing with degraded NeuronFS hook-only mode.\n'
      fi
    fi

    if [[ "$neuronfs_install_rc" -eq 2 ]]; then
      if command -v go >/dev/null 2>&1; then
        echo "NeuronFS CLI is still unavailable even though Go is installed." >&2
        exit 1
      fi

      if [[ "$auto_install_go" -eq 1 ]]; then
        printf 'Go is still not available and no prebuilt NeuronFS CLI was found; installing NeuronFS in degraded hook-only mode (autogrowth disabled).\n'
      else
        printf 'Go auto-install was skipped and no prebuilt NeuronFS CLI was found; installing NeuronFS in degraded hook-only mode (autogrowth disabled).\n'
      fi

      CPB_REPO_ROOT="$repo_root" \
      CPB_OPERATOR="$operator" \
      CPB_PERSONAL_REPO="$personal_repo" \
      CPB_PROJECT_BRAIN="$project_brain_path" \
      NEURONFS_ALLOW_HOOK_ONLY=1 \
      bash "$install_script"
    elif [[ "$neuronfs_install_rc" -ne 0 ]]; then
      exit "$neuronfs_install_rc"
    fi
  elif [[ "$neuronfs_install_rc" -ne 0 ]]; then
    exit "$neuronfs_install_rc"
  fi
fi

if [[ "$skip_rebuild" -eq 0 ]]; then
  CPB_REPO_ROOT="$repo_root" \
  CPB_OPERATOR="$operator" \
  CPB_PERSONAL_REPO="$personal_repo" \
  CPB_PROJECT_BRAIN="$project_brain_path" \
  bash "$rebuild_script" "${rebuild_args[@]}"
fi

printf '\nProfile apply complete. Current status:\n\n'
run_status "$operator" "$personal_repo" "$project_brain_path"
