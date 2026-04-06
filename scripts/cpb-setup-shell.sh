#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"
source "$script_dir/cpb-setup-lib.sh"

repo_root="${CPB_REPO_ROOT:-$(cpb_repo_root)}"
bashrc="${CPB_SETUP_SHELL_BASHRC:-$HOME/.bashrc}"
marker_start="${CPB_SETUP_SHELL_MARKER_START:-# CPB auto-env}"
marker_end="${CPB_SETUP_SHELL_MARKER_END:-# End CPB auto-env}"
autoenv_script="${CPB_SETUP_SHELL_AUTOENV_SCRIPT:-$repo_root/scripts/project-brain-autoenv.bash}"
bin_dir="${CPB_SETUP_SHELL_BIN_DIR:-$repo_root/bin}"
completion_script="${CPB_SETUP_SHELL_COMPLETION_SCRIPT:-$repo_root/scripts/cpb-completion.bash}"
label="${CPB_SETUP_SHELL_LABEL:-CPB}"
usage_script="${CPB_SETUP_SHELL_USAGE_SCRIPT:-scripts/cpb-setup-shell.sh}"

usage() {
  cat <<EOF
Usage: bash $usage_script

Pins a shell auto-env block into ~/.bashrc so the project brain runtime is
loaded automatically when you enter this repo.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

repo_root_escaped="$(cpb_shell_escape "$repo_root")"
bin_dir_escaped="$(cpb_shell_escape "$bin_dir")"
autoenv_script_escaped="$(cpb_shell_escape "$autoenv_script")"
completion_script_escaped="$(cpb_shell_escape "$completion_script")"

block_contents="$(cat <<EOF
$marker_start
if [ -f ${autoenv_script_escaped} ]; then
  . ${autoenv_script_escaped}
fi
if [ -d ${bin_dir_escaped} ]; then
  case ":\$PATH:" in
    *:${bin_dir_escaped}:*) ;;
    *) export PATH=${bin_dir_escaped}:\$PATH ;;
  esac
fi
if [ -f ${completion_script_escaped} ]; then
  . ${completion_script_escaped}
fi
$marker_end
EOF
)"

cpb_upsert_file_block "$bashrc" "$marker_start" "$marker_end" "$block_contents"

cat <<EOF
$label shell auto-env pinned.

Repo:    $repo_root
Bash rc: $bashrc

Open a new shell or run:
  source ~/.bashrc

After that you can use:
  cpb status
  cpb apply team-personal
  cpb <TAB>
EOF
