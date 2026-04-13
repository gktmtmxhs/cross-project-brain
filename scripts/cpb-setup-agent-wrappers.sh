#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"

repo_root="${CPB_REPO_ROOT:-$(cpb_repo_root)}"
bin_dir="${CPB_SETUP_AGENT_WRAPPERS_BIN_DIR:-$HOME/.local/bin}"
default_wrapper_runner="$repo_root/scripts/cpb-agent-wrapper.sh"
global_wrapper_runner="$script_dir/cpb-global-agent-wrapper.sh"
wrapper_runner="${CPB_SETUP_AGENT_WRAPPERS_RUNNER:-$default_wrapper_runner}"
wrapper_path_env_name="${CPB_SETUP_AGENT_WRAPPERS_PATH_ENV_NAME:-CPB_WRAPPER_PATH}"
label="${CPB_SETUP_AGENT_WRAPPERS_LABEL:-CPB}"
agents="${CPB_SETUP_AGENT_WRAPPERS_AGENTS:-codex claude}"
usage_script="${CPB_SETUP_AGENT_WRAPPERS_USAGE_SCRIPT:-scripts/cpb-setup-agent-wrappers.sh}"

if [[ -z "${CPB_SETUP_AGENT_WRAPPERS_RUNNER:-}" ]] && [[ -f "$global_wrapper_runner" ]]; then
  wrapper_runner="$global_wrapper_runner"
fi

usage() {
  cat <<EOF
Usage: bash $usage_script

Installs local command shims for agent CLIs so successful sessions inside this
repo run the CPB finish guard before wrapper exit.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

mkdir -p "$bin_dir"

write_wrapper() {
  local agent_name="$1"
  local target_path="$bin_dir/$agent_name"
  cat >"$target_path" <<EOF
#!/usr/bin/env bash
export $wrapper_path_env_name="$target_path"
exec "$wrapper_runner" "$agent_name" "\$@"
EOF
  chmod +x "$target_path"
}

for agent_name in $agents; do
  write_wrapper "$agent_name"
done

cat <<EOF
$label agent wrappers pinned.

Repo:        $repo_root
Wrapper dir: $bin_dir

Wrapped commands:
$(for agent_name in $agents; do printf '  - %s\n' "$agent_name"; done)
Behavior:
  - outside the repo: pass through to the real binary
  - inside the repo: successful agent sessions run the finish guard before wrapper exit
EOF
