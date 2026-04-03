#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$script_dir/cpb-paths.sh"
cpdb_export_paths

repo_root="$CPB_REPO_ROOT"
global_brain="${CPB_GLOBAL_BRAIN}"
team_brain="${CPB_TEAM_BRAIN}"
project_brain="${CPB_PROJECT_BRAIN}"
device_brain="${CPB_DEVICE_BRAIN}"
runtime_brain="${CPB_RUNTIME_BRAIN}"
neuronfs_install_dir="${NEURONFS_INSTALL_DIR}"
runtime_state_backup=""
init_global=false
init_project=false
init_device=false

usage() {
  cat <<EOF
Usage: bash scripts/cpb-rebuild-runtime-brain.sh [--init-global] [--init-project] [--init-device]

Options:
  --init-global     Create a minimal cross-project brain if it does not exist
  --init-project    Create a minimal tracked project brain if it does not exist
  --init-user       Backward-compatible alias of --init-project
  --init-personal   Backward-compatible alias of --init-project
  --init-device     Create a minimal local device brain if it does not exist
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
      init_device=true
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

sync_brain_tree() {
  local source_dir="$1"
  local target_dir="$2"
  rsync -a \
    --exclude "_agents" \
    --exclude "_inbox" \
    --exclude ".neuronfs" \
    "$source_dir"/ "$target_dir"/
}

if [[ "$init_global" == true && ! -d "$global_brain" ]]; then
  ensure_brain_layout "$global_brain"
fi

if [[ ! -d "$team_brain" ]]; then
  echo "Team brain not found: $team_brain" >&2
  echo "Create it first or rerun the installer." >&2
  exit 1
fi

if [[ "$init_project" == true && ! -d "$project_brain" ]]; then
  ensure_brain_layout "$project_brain"
fi

if [[ "$init_device" == true && ! -d "$device_brain" ]]; then
  ensure_brain_layout "$device_brain"
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

if [[ -d "$device_brain" ]]; then
  sync_brain_tree "$device_brain" "$runtime_brain"
fi

if [[ -n "$runtime_state_backup" && -d "$runtime_state_backup" ]]; then
  cp -a "$runtime_state_backup"/. "$runtime_brain"/
fi

mkdir -p \
  "$runtime_brain/_agents/global_inbox" \
  "$runtime_brain/_inbox" \
  "$device_brain/_inbox" \
  "$device_brain/_agents/global_inbox"

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
  binary_note="  - NeuronFS binary not found yet; run bash scripts/cpb-install-neuronfs.sh if you want the CLI"
fi

cat <<EOF
CPB runtime brain rebuilt.

Repo root:      $repo_root
Global brain:   $global_brain
Team brain:     $team_brain
Project brain:  $project_brain
Device brain:   $device_brain
Runtime brain:  $runtime_brain
Operator id:    $CPB_OPERATOR_ID
NeuronFS tool:  $neuronfs_install_dir

Suggested exports:
  export NEURONFS_BRAIN="$runtime_brain"
${node_options_line}

Notes:
  - Global developer lessons should live in the global brain when they should help other repos too
  - Team baseline stays in git under brains/team-brain/brain_v4
  - Project-specific auto-growth should target the tracked project brain, not the tracked team brain
  - Device-only quirks belong in the local device brain
  - Re-run this script after global, team, project, or device brain updates that you want reflected in runtime
${binary_note}
EOF
