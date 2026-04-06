#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"
source "$script_dir/cpb-setup-lib.sh"

repo_root="${CPB_REPO_ROOT:-$(cpb_repo_root)}"
operator_id="${CPB_OPERATOR_ID:-$(cpb_detect_operator_id "$repo_root" "${CPB_OPERATOR:-}")}"
usage_script="${CPB_SETUP_GLOBAL_BRAIN_USAGE_SCRIPT:-scripts/cpb-setup-global-brain.sh}"
global_brain_env_name="${CPB_SETUP_GLOBAL_BRAIN_ENV_NAME:-CPB_GLOBAL_BRAIN}"
default_global_brain="${CPB_SETUP_GLOBAL_BRAIN_DEFAULT:-$repo_root/brains/global-operators/$operator_id/brain_v4}"
raw_path="${1:-${!global_brain_env_name:-$default_global_brain}}"
marker_start="${CPB_SETUP_GLOBAL_BRAIN_MARKER_START:-# CPB global brain}"
marker_end="${CPB_SETUP_GLOBAL_BRAIN_MARKER_END:-# End CPB global brain}"
insert_before_marker="${CPB_SETUP_GLOBAL_BRAIN_INSERT_BEFORE_MARKER:-}"
insert_before_fallback="${CPB_SETUP_GLOBAL_BRAIN_INSERT_BEFORE_FALLBACK_MARKER:-}"
path_guidance="${CPB_SETUP_GLOBAL_BRAIN_PATH_GUIDANCE:-$repo_root/brains/global-operators/$operator_id/brain_v4}"

usage() {
  cat <<EOF
Usage: bash $usage_script [absolute-or-relative-path]

Without an explicit path, the script uses:
  \$$global_brain_env_name
  or
  $default_global_brain

Recommended cross-project path:
  $path_guidance
EOF
}

if [[ "$raw_path" == "-h" || "$raw_path" == "--help" ]]; then
  usage
  exit 0
fi

global_brain="$(cpb_expand_path "$raw_path")"
mkdir -p "$global_brain"

bashrc="$HOME/.bashrc"
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
export $global_brain_env_name="$global_brain"
$marker_end
EOF
)"

cpb_upsert_file_block "$bashrc" "$marker_start" "$marker_end" "$block_contents" "$selected_insert_before"

cat <<EOF
CPB global brain pinned.

Repo:         $repo_root
Operator id:  $operator_id
Global brain: $global_brain
Bash rc:      $bashrc

Open a new shell or run:
  source ~/.bashrc
EOF
