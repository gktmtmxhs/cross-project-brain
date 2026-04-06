#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"
source "$script_dir/cpb-setup-lib.sh"

repo_root="${CPB_REPO_ROOT:-$(cpb_repo_root)}"
operator_arg="${1:-}"
bashrc="${CPB_SETUP_OPERATOR_BASHRC:-$HOME/.bashrc}"
env_name="${CPB_SETUP_OPERATOR_ENV_NAME:-CPB_OPERATOR}"
label="${CPB_SETUP_OPERATOR_LABEL:-CPB}"
marker_start="${CPB_SETUP_OPERATOR_MARKER_START:-# CPB operator id}"
marker_end="${CPB_SETUP_OPERATOR_MARKER_END:-# End CPB operator id}"
autoenv_start="${CPB_SETUP_OPERATOR_INSERT_BEFORE_MARKER:-# CPB auto-env}"
tracked_project_operators_root="${CPB_TRACKED_PROJECT_OPERATORS_ROOT:-$(cpb_tracked_project_operators_root_default "$repo_root")}"
global_root="${CPB_SETUP_OPERATOR_GLOBAL_ROOT:-$repo_root/brains/global-operators}"
usage_script="${CPB_SETUP_OPERATOR_USAGE_SCRIPT:-scripts/cpb-setup-operator.sh}"

usage() {
  cat <<EOF
Usage: bash $usage_script [github-username]

Without an explicit operator id, the script uses:
  1. CPB_OPERATOR
  2. git config github.user
  3. git user.email local-part
  4. git user.name
  5. \$USER

Recommended value: your GitHub username.

It writes the resolved id to ~/.bashrc so desktop and laptop can share the same
project operator overlay when the same value is configured on both machines.
EOF
}

if [[ "$operator_arg" == "-h" || "$operator_arg" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -n "$operator_arg" ]]; then
  operator_id="$(cpb_sanitize_operator_id "$operator_arg")"
else
  operator_id="$(cpb_detect_operator_id "$repo_root" "${CPB_OPERATOR:-}")"
fi

if [[ -n "${CPB_PERSONAL_REPO:-}" ]]; then
  global_brain_path="${CPB_PERSONAL_REPO}/brains/global-operators/$operator_id/brain_v4"
else
  global_brain_path="$global_root/$operator_id/brain_v4"
fi

tracked_project_brain_path="$(cpb_tracked_project_brain_path "$tracked_project_operators_root" "$operator_id")"

block_contents="$(cat <<EOF
$marker_start
export $env_name="$operator_id"
$marker_end
EOF
)"

cpb_upsert_file_block "$bashrc" "$marker_start" "$marker_end" "$block_contents" "$autoenv_start"

cat <<EOF
$label operator id pinned.

Repo:        $repo_root
Operator id: $operator_id
Bash rc:     $bashrc

Recommended: use the same GitHub username on every machine to keep the same tracked project operator overlay:
  $tracked_project_brain_path

This same operator id also names the default Cross-Project Developer Brain path:
  $global_brain_path
EOF
