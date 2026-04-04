#!/usr/bin/env bash
set -euo pipefail

repo_root=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root)
      repo_root="$2"
      shift 2
      ;;
    -h|--help)
      cat <<EOF
Usage: bash scripts/cpb-setup-shell.sh [--repo-root <path>]
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$repo_root" ]]; then
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

shell_escape() {
  printf '%q' "$1"
}

bashrc="$HOME/.bashrc"
marker_start="# Cross-Project Brain auto-env"
marker_end="# End Cross-Project Brain auto-env"
temp_file="$(mktemp)"
repo_root_escaped="$(shell_escape "$repo_root")"
bin_dir_escaped="$(shell_escape "$repo_root/bin")"

block_contents="$(cat <<EOF
$marker_start
if [ -f ${repo_root_escaped}/scripts/project-brain-autoenv.bash ]; then
  . ${repo_root_escaped}/scripts/project-brain-autoenv.bash
fi
if [ -d ${bin_dir_escaped} ]; then
  case ":\$PATH:" in
    *:${bin_dir_escaped}:*) ;;
    *) export PATH=${bin_dir_escaped}:\$PATH ;;
  esac
fi
$marker_end
EOF
)"

if [[ -f "$bashrc" ]]; then
  awk -v start="$marker_start" -v end="$marker_end" -v block="$block_contents" '
    $0 == start { skipping=1; next }
    $0 == end { skipping=0; next }
    skipping == 1 { next }
    { print }
    END { print block }
  ' "$bashrc" >"$temp_file"
else
  printf '%s\n' "$block_contents" >"$temp_file"
fi

mv "$temp_file" "$bashrc"

cat <<EOF
CPB shell auto-env pinned.

Repo:    $repo_root
Bash rc: $bashrc

Open a new shell or run:
  source ~/.bashrc

After that you can use:
  cpb status
  cpb apply team-personal
EOF
