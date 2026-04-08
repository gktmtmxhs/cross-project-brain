#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"

repo_root="${CPB_REPO_ROOT:-$(cpb_repo_root)}"
cpb_export_paths "$repo_root"
global_brain_default="${CPB_GLOBAL_BRAIN:-}"
team_brain_default="${CPB_TEAM_BRAIN:-}"
project_brain_default="${CPB_PROJECT_BRAIN:-}"
runtime_brain_default="${CPB_RUNTIME_BRAIN:-}"
neuronfs_install_default="${NEURONFS_INSTALL_DIR:-$repo_root/.tools/neuronfs}"
operator_id="${CPB_OPERATOR_ID:-$(cpb_detect_operator_id "$repo_root" "${CPB_OPERATOR:-}")}"
runtime_state_backup=""

global_brain="${CPB_GLOBAL_BRAIN:-$global_brain_default}"
team_brain="${CPB_TEAM_BRAIN:-${NEURONFS_TEAM_BRAIN:-$team_brain_default}}"
project_brain="${CPB_PROJECT_BRAIN:-$project_brain_default}"
runtime_brain="${CPB_RUNTIME_BRAIN:-${NEURONFS_RUNTIME_BRAIN:-$runtime_brain_default}}"
neuronfs_install_dir="${NEURONFS_INSTALL_DIR:-$neuronfs_install_default}"
init_global=false
init_project=false

usage() {
  cat <<EOF
Usage: bash scripts/cpb-rebuild-runtime-brain.sh [--init-global] [--init-project]

Options:
  --init-global      Create a minimal Cross-Project Developer Brain if it does not exist
  --init-project     Create a minimal project brain if it does not exist
  --init-user        Backward-compatible alias of --init-project
  --init-personal    Backward-compatible alias of --init-project
  --init-device      Accepted for backward compatibility but ignored (device brain has been removed)

Environment overrides:
  CPB_GLOBAL_BRAIN
  CPB_TEAM_BRAIN
  CPB_PROJECT_BRAIN
  CPB_RUNTIME_BRAIN
  NEURONFS_INSTALL_DIR
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --init-global)
      init_global=true
      shift
      ;;
    --init-project|--init-user|--init-personal)
      init_project=true
      shift
      ;;
    --init-device)
      # Accepted for backward compatibility but ignored.
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
  if [[ -n "$runtime_state_backup" && -d "$runtime_state_backup" ]]; then
    rm -rf "$runtime_state_backup"
  fi
}
trap cleanup EXIT

sync_brain_tree() {
  local source_dir="$1"
  local target_dir="$2"
  rsync -a \
    --exclude "_agents" \
    --exclude "_inbox" \
    --exclude ".neuronfs" \
    "$source_dir"/ "$target_dir"/
}

if [[ ! -d "$team_brain" ]]; then
  echo "Team brain not found: $team_brain" >&2
  exit 1
fi

if [[ "$init_global" == true && ! -d "$global_brain" ]]; then
  mkdir -p "$global_brain"
fi

if [[ "$init_project" == true && ! -d "$project_brain" ]]; then
  mkdir -p "$project_brain"
fi

if [[ -d "$runtime_brain/_agents" || -d "$runtime_brain/_inbox" ]]; then
  runtime_state_backup="$(mktemp -d)"
  [[ -d "$runtime_brain/_agents" ]] && cp -a "$runtime_brain/_agents" "$runtime_state_backup"/
  [[ -d "$runtime_brain/_inbox" ]] && cp -a "$runtime_brain/_inbox" "$runtime_state_backup"/
fi

rm -rf "$runtime_brain"
mkdir -p "$runtime_brain"

if [[ -d "$global_brain" ]]; then
  sync_brain_tree "$global_brain" "$runtime_brain"
fi

sync_brain_tree "$team_brain" "$runtime_brain"

if [[ -d "$project_brain" ]]; then
  sync_brain_tree "$project_brain" "$runtime_brain"
fi

if [[ -n "$runtime_state_backup" && -d "$runtime_state_backup" ]]; then
  cp -a "$runtime_state_backup"/. "$runtime_brain"/
fi

mkdir -p \
  "$runtime_brain/_agents/global_inbox" \
  "$runtime_brain/_inbox"

hook_path="$neuronfs_install_dir/runtime/v4-hook.cjs"
binary_path="$neuronfs_install_dir/neuronfs"

if [[ -f "$hook_path" ]]; then
  node_options_line="  export NODE_OPTIONS=\"--require $hook_path\""
else
  node_options_line="  export NODE_OPTIONS=\"--require /path/to/NeuronFS/runtime/v4-hook.cjs\""
fi

if [[ -x "$binary_path" ]]; then
  binary_note="  - NeuronFS binary detected at $binary_path"
else
  binary_note="  - NeuronFS binary not found yet; run bash scripts/install-neuronfs.sh if you want the CLI"
fi

cat <<EOF
CPB runtime brain rebuilt.

Global brain:   $global_brain
Team brain:     $team_brain
Project brain:  $project_brain
Runtime brain:  $runtime_brain
NeuronFS tool:  $neuronfs_install_dir
Operator id:    $operator_id

Suggested exports:
  export NEURONFS_BRAIN="$runtime_brain"
${node_options_line}

Notes:
  - Global developer lessons should live in the global brain when they should help other repos too
  - Team baseline should stay in the team brain
  - Project-specific auto-growth should target \$CPB_PROJECT_BRAIN
  - Re-run this script after global, team, or project brain updates that you want reflected in runtime
${binary_note}
EOF
