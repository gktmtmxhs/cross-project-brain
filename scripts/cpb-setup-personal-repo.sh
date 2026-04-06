#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"
source "$script_dir/cpb-setup-lib.sh"

repo_root=""
personal_repo=""
shared_repo=0
project_brain_in_personal_repo=0
project_brain_mode_override=""
personal_repo_name="${CPB_PERSONAL_REPO_NAME:-cpb-personal}"
personal_repo_create_mode="${CPB_CREATE_PERSONAL_REMOTE:-ask}"
personal_repo_remote_found=0
personal_repo_remote_created=0
personal_repo_origin_url=""
personal_repo_bootstrap_mode="unknown"
usage_script="${CPB_SETUP_PERSONAL_REPO_USAGE_SCRIPT:-scripts/cpb-setup-personal-repo.sh}"
label="${CPB_SETUP_PERSONAL_REPO_LABEL:-CPB}"
personal_repo_env_name="${CPB_SETUP_PERSONAL_REPO_PERSONAL_REPO_ENV_NAME:-CPB_PERSONAL_REPO}"
global_brain_env_name="${CPB_SETUP_PERSONAL_REPO_GLOBAL_BRAIN_ENV_NAME:-CPB_GLOBAL_BRAIN}"
career_docs_root_env_name="${CPB_SETUP_PERSONAL_REPO_CAREER_DOCS_ROOT_ENV_NAME:-CPB_CAREER_DOCS_ROOT}"
project_brain_env_name="${CPB_SETUP_PERSONAL_REPO_PROJECT_BRAIN_ENV_NAME:-CPB_PROJECT_BRAIN}"
auto_pull_env_name="${CPB_SETUP_PERSONAL_REPO_AUTO_PULL_ENV_NAME:-CPB_AUTO_PULL_PERSONAL}"
auto_push_env_name="${CPB_SETUP_PERSONAL_REPO_AUTO_PUSH_ENV_NAME:-CPB_AUTO_PUSH_PERSONAL}"

usage() {
  cat <<EOF
Usage: bash $usage_script <personal-repo-path> [--shared-repo] [--repo-root <path>]
       bash $usage_script <personal-repo-path> [--project-brain-mode <tracked|local|personal>] [--repo-root <path>]

Examples:
  bash $usage_script ~/workspace/cpb-personal
  bash $usage_script ~/workspace/cpb-personal --shared-repo
  bash $usage_script ~/workspace/cpb-personal --project-brain-mode personal

What it pins:
  - $personal_repo_env_name
  - $global_brain_env_name
  - $career_docs_root_env_name

Project brain modes:
  - tracked   store project lessons in brains/project-operators/<operator>/... inside this repo
  - local     store project lessons under .agent/... on this machine only
  - personal  store project lessons in your private CPB repo for multi-device sync

Default behavior:
  - --shared-repo             -> project brain defaults to local
  - without --shared-repo     -> project brain defaults to tracked

Backward-compatible alias:
  --project-brain-in-personal-repo == --project-brain-mode personal

Recommended GitHub private repo:
  <github-username>/cpb-personal

Creation mode:
  - ask   (default: ask before creating the GitHub private repo)
  - never (only explain what to create)
  - always (create automatically when missing)

Environment override:
  CPB_CREATE_PERSONAL_REMOTE=ask|never|always
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root)
      repo_root="$(cd "$2" && pwd)"
      shift 2
      ;;
    --shared-repo)
      shared_repo=1
      shift
      ;;
    --project-brain-mode)
      project_brain_mode_override="$2"
      shift 2
      ;;
    --project-brain-in-personal-repo)
      project_brain_in_personal_repo=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -n "$personal_repo" ]]; then
        echo "Unexpected argument: $1" >&2
        usage >&2
        exit 1
      fi
      personal_repo="$1"
      shift
      ;;
  esac
done

if [[ -z "$personal_repo" ]]; then
  usage >&2
  exit 1
fi

if [[ -z "$repo_root" ]]; then
  repo_root="$(cpb_repo_root)"
fi

personal_repo="$(cpb_expand_path "$personal_repo")"
operator_id="$(cpb_detect_operator_id "$repo_root" "${CPB_OPERATOR:-}")"
project_id="${CPB_PROJECT_ID:-$(cpb_project_id "$repo_root")}"
tracked_project_brain_root="${CPB_TRACKED_PROJECT_OPERATORS_ROOT:-$(cpb_tracked_project_operators_root_default "$repo_root")}"
global_brain="$personal_repo/brains/global-operators/$operator_id/brain_v4"
career_docs_root="$personal_repo/docs/career/operators/$operator_id"
local_project_brain="${CPB_SETUP_PERSONAL_REPO_LOCAL_PROJECT_BRAIN:-$repo_root/.agent/cross-project-brain/$project_id/project-brain/brain_v4}"
tracked_project_brain="$(cpb_tracked_project_brain_path "$tracked_project_brain_root" "$operator_id")"
tracked_project_brain_seed_source="$(cpb_resolve_tracked_project_brain_source "$tracked_project_brain_root" "$operator_id")"
personal_project_brain="$(cpb_personal_project_brain_path "$personal_repo" "$project_id" "$operator_id")"
project_brain_path=""
project_brain_mode="default"

cpb_check_personal_remote_guidance "$operator_id" "$personal_repo" "$personal_repo_name" "$personal_repo_create_mode"
personal_repo_remote_found="$CPB_PERSONAL_REPO_REMOTE_FOUND"
personal_repo_remote_created="$CPB_PERSONAL_REPO_REMOTE_CREATED"
personal_repo_origin_url="$CPB_PERSONAL_REPO_ORIGIN_URL"
personal_repo_bootstrap_mode="$CPB_PERSONAL_REPO_BOOTSTRAP_MODE"
cpb_sync_personal_repo_checkout "$personal_repo" "$personal_repo_origin_url"
mkdir -p "$global_brain" "$career_docs_root"

if [[ -z "$project_brain_mode_override" ]]; then
  if [[ "$project_brain_in_personal_repo" -eq 1 ]]; then
    project_brain_mode_override="personal"
  elif [[ "$shared_repo" -eq 1 ]]; then
    project_brain_mode_override="local"
  else
    project_brain_mode_override="tracked"
  fi
fi

case "$project_brain_mode_override" in
  tracked)
    mkdir -p "$tracked_project_brain"
    project_brain_path="$tracked_project_brain"
    project_brain_mode="tracked"
    ;;
  local)
    mkdir -p "$local_project_brain"
    cpb_seed_project_brain_if_empty "$local_project_brain" "$local_project_brain" "$tracked_project_brain_seed_source"
    project_brain_path="$local_project_brain"
    project_brain_mode="local"
    ;;
  personal)
    mkdir -p "$personal_project_brain"
    cpb_seed_project_brain_if_empty "$personal_project_brain" "$local_project_brain" "$tracked_project_brain_seed_source"
    project_brain_path="$personal_project_brain"
    project_brain_mode="personal"
    ;;
  *)
    echo "Unsupported project brain mode: $project_brain_mode_override" >&2
    usage >&2
    exit 1
    ;;
esac

if [[ "$shared_repo" -eq 1 && "$project_brain_mode" == "tracked" ]]; then
  echo "Warning: tracked project brain mode in a shared/team repo will commit project-specific lessons into this repo." >&2
fi

bashrc="${CPB_SETUP_PERSONAL_REPO_BASHRC:-$HOME/.bashrc}"
marker_start="${CPB_SETUP_PERSONAL_REPO_MARKER_START:-# Cross-Project Brain personal repo}"
marker_end="${CPB_SETUP_PERSONAL_REPO_MARKER_END:-# End Cross-Project Brain personal repo}"
insert_before_marker="${CPB_SETUP_PERSONAL_REPO_INSERT_BEFORE_MARKER:-# Cross-Project Brain auto-env}"
insert_before_fallback="${CPB_SETUP_PERSONAL_REPO_INSERT_BEFORE_FALLBACK_MARKER:-}"
personal_repo_escaped="$(cpb_shell_escape "$personal_repo")"
global_brain_escaped="$(cpb_shell_escape "$global_brain")"
career_docs_root_escaped="$(cpb_shell_escape "$career_docs_root")"
selected_insert_before="$insert_before_marker"

if [[ -n "$insert_before_fallback" ]] && [[ -f "$bashrc" ]]; then
  if [[ -z "$selected_insert_before" ]] || ! grep -Fxq "$selected_insert_before" "$bashrc"; then
    if grep -Fxq "$insert_before_fallback" "$bashrc"; then
      selected_insert_before="$insert_before_fallback"
    fi
  fi
fi

block_contents="$(cat <<EOF
$marker_start
export $personal_repo_env_name=${personal_repo_escaped}
export $global_brain_env_name=${global_brain_escaped}
export $career_docs_root_env_name=${career_docs_root_escaped}
export $auto_pull_env_name=1
export $auto_push_env_name=1
EOF
)"

if [[ -n "$project_brain_path" ]]; then
  project_brain_path_escaped="$(cpb_shell_escape "$project_brain_path")"
  block_contents+="
export $project_brain_env_name=${project_brain_path_escaped}"
fi

block_contents+="
$marker_end"

cpb_upsert_file_block "$bashrc" "$marker_start" "$marker_end" "$block_contents" "$selected_insert_before"

cat <<EOF
$label personal repo pinned.

Repo:              $repo_root
Operator:          $operator_id
Personal repo:     $personal_repo
Bootstrap mode:    $personal_repo_bootstrap_mode
Global brain:      $global_brain
Career docs root:  $career_docs_root
Bash rc:           $bashrc
EOF

if [[ "$project_brain_mode" == "personal" ]]; then
  if [[ "$shared_repo" -eq 1 ]]; then
    cat <<EOF
Project brain:     $personal_project_brain

Shared/team repo mode is enabled.
The project brain is stored in your personal repo so project-specific lessons sync across your own machines without landing in the team repo.
EOF
  else
    cat <<EOF
Project brain:     $personal_project_brain

Personal multi-device mode is enabled.
The project brain is stored in your personal repo so project-specific lessons sync across your own machines.
EOF
  fi
elif [[ "$project_brain_mode" == "tracked" ]]; then
  cat <<EOF
Project brain:     $tracked_project_brain

Tracked project mode is enabled.
Project-specific lessons stay in the current repo and follow the project git remote.
EOF
elif [[ "$project_brain_mode" == "local" ]]; then
  if [[ "$shared_repo" -eq 1 ]]; then
    cat <<EOF
Project brain:     $local_project_brain

Shared/team repo mode is enabled.
The project brain will stay local-only under .agent/ on this machine.
EOF
  else
    cat <<EOF
Project brain:     $local_project_brain

Local-only project mode is enabled.
The project brain will stay under .agent/ on this machine.
EOF
  fi
fi

cat <<EOF

Open a new shell or run:
  source ~/.bashrc

After that, keep using normal git in the project repo:
  - git pull -> tries to pull your personal repo first, then rebuilds runtime brain
  - git push -> tries to commit/pull/push your personal repo before the project push

If the personal repo origin exists but upstream is still missing, CPB will publish the first sync push automatically.
EOF
