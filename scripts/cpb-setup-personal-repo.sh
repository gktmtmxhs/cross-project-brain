#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root=""
personal_repo=""
shared_repo=0
personal_repo_name="${CPB_PERSONAL_REPO_NAME:-cpb-personal}"
personal_repo_create_mode="${CPB_CREATE_PERSONAL_REMOTE:-ask}"

usage() {
  cat <<EOF
Usage: bash scripts/cpb-setup-personal-repo.sh <personal-repo-path> [--shared-repo] [--repo-root <path>]

Examples:
  bash scripts/cpb-setup-personal-repo.sh ~/workspace/cpb-personal
  bash scripts/cpb-setup-personal-repo.sh ~/workspace/cpb-personal --shared-repo

What it pins:
  - CPB_PERSONAL_REPO
  - CPB_GLOBAL_BRAIN
  - CPB_CAREER_DOCS_ROOT

With --shared-repo it also pins:
  - CPB_PROJECT_BRAIN to a local-only path under .agent/

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

can_prompt_tty() {
  [[ -r /dev/tty && -w /dev/tty ]]
}

prompt_yes_no() {
  local prompt="$1"
  local reply=""

  if ! can_prompt_tty; then
    return 1
  fi

  printf '%s\n' "$prompt" >/dev/tty
  read -r reply </dev/tty || true
  case "$reply" in
    y|Y|yes|YES)
      return 0
      ;;
  esac
  return 1
}

ensure_gh_auth_guidance() {
  local expected_slug="$1"

  if ! command -v gh >/dev/null 2>&1; then
    cat <<EOF
GitHub CLI check:
  - gh is not installed here
  - install GitHub CLI or create the repo manually if you want desktop/laptop sync

Recommended repo:
  $expected_slug
EOF
    return 1
  fi

  if gh auth status >/dev/null 2>&1; then
    return 0
  fi

  cat <<EOF
GitHub CLI check:
  - gh is installed but not authenticated
  - CPB uses gh to check or create your personal private repo
EOF

  case "$personal_repo_create_mode" in
    always)
      if can_prompt_tty; then
        cat >/dev/tty <<'EOF'

CPB needs GitHub CLI authentication to check or create your personal sync repo.
Starting: gh auth login
EOF
        if gh auth login </dev/tty >/dev/tty 2>/dev/tty && gh auth status >/dev/null 2>&1; then
          cat <<EOF
  - gh login completed
EOF
          return 0
        fi
      fi
      ;;
    ask)
      if prompt_yes_no "
CPB needs GitHub CLI authentication to check or create your personal sync repo.
Run 'gh auth login' now? [y/N]"; then
        if gh auth login </dev/tty >/dev/tty 2>/dev/tty && gh auth status >/dev/null 2>&1; then
          cat <<EOF
  - gh login completed
EOF
          return 0
        fi
      fi
      ;;
  esac

  cat <<EOF
  - run gh auth login first if you want CPB to check or create the repo automatically
EOF
  return 1
}

check_personal_remote_guidance() {
  local operator_id="$1"
  local personal_repo="$2"
  local expected_slug="${operator_id}/${personal_repo_name}"
  local origin_url=""

  origin_url="$(git -C "$personal_repo" remote get-url origin 2>/dev/null || true)"

  cat <<EOF

Recommended personal GitHub private repo:
  $expected_slug
EOF

  if ! command -v node >/dev/null 2>&1; then
    cat <<EOF
GitHub private repo check:
  - skipped automatic lookup because node is not available here
  - if you want desktop/laptop sync, create this private repo first:
    $expected_slug
EOF
  elif ensure_gh_auth_guidance "$expected_slug"; then
    local repo_json
    repo_json="$(gh repo view "$expected_slug" --json nameWithOwner,visibility,sshUrl,url 2>/dev/null || true)"

    if [[ -n "$repo_json" ]]; then
      local visibility ssh_url https_url
      visibility="$(printf '%s' "$repo_json" | node -e 'const data=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(data.visibility || "");')"
      ssh_url="$(printf '%s' "$repo_json" | node -e 'const data=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(data.sshUrl || "");')"
      https_url="$(printf '%s' "$repo_json" | node -e 'const data=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(data.url || "");')"

      cat <<EOF
GitHub private repo check:
  - found: $expected_slug
  - visibility: $visibility
EOF

      if [[ "$visibility" != "PRIVATE" && "$visibility" != "INTERNAL" ]]; then
        cat <<EOF
  - warning: this repo is not private; desktop/laptop sync will still work, but private mode is recommended
EOF
      fi

      if [[ -z "$origin_url" ]]; then
        if [[ -n "$ssh_url" ]]; then
          git -C "$personal_repo" remote add origin "$ssh_url"
          origin_url="$ssh_url"
        elif [[ -n "$https_url" ]]; then
          git -C "$personal_repo" remote add origin "$https_url"
          origin_url="$https_url"
        fi
      fi
    else
      local should_create="no"

      case "$personal_repo_create_mode" in
        always)
          should_create="yes"
          ;;
        ask)
          if [[ -r /dev/tty && -w /dev/tty ]]; then
            cat >/dev/tty <<EOF

CPB can use a personal private GitHub repo for desktop/laptop sync.
Recommended repo:
  $expected_slug

This repo stores your personal global brain and career docs.
It should usually be private.

Create it now? [y/N]
EOF
            local reply
            read -r reply </dev/tty || true
            case "$reply" in
              y|Y|yes|YES)
                should_create="yes"
                ;;
            esac
          fi
          ;;
      esac

      if [[ "$should_create" == "yes" ]]; then
        if gh repo create "$expected_slug" --private >/dev/null 2>&1; then
          repo_json="$(gh repo view "$expected_slug" --json nameWithOwner,visibility,sshUrl,url 2>/dev/null || true)"
          if [[ -n "$repo_json" ]]; then
            local visibility ssh_url https_url
            visibility="$(printf '%s' "$repo_json" | node -e 'const data=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(data.visibility || "");')"
            ssh_url="$(printf '%s' "$repo_json" | node -e 'const data=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(data.sshUrl || "");')"
            https_url="$(printf '%s' "$repo_json" | node -e 'const data=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(data.url || "");')"

            cat <<EOF
GitHub private repo check:
  - created: $expected_slug
  - visibility: $visibility
EOF

            if [[ -z "$origin_url" ]]; then
              if [[ -n "$ssh_url" ]]; then
                git -C "$personal_repo" remote add origin "$ssh_url"
                origin_url="$ssh_url"
              elif [[ -n "$https_url" ]]; then
                git -C "$personal_repo" remote add origin "$https_url"
                origin_url="$https_url"
              fi
            fi
          fi
        else
          cat <<EOF
GitHub private repo check:
  - attempted to create: $expected_slug
  - creation failed; create it manually if you want desktop/laptop sync

Suggested command:
  gh repo create "$expected_slug" --private
EOF
        fi
      else
        cat <<EOF
GitHub private repo check:
  - not found: $expected_slug
  - create it first if you want desktop/laptop sync

Suggested command:
  gh repo create "$expected_slug" --private
EOF
      fi
    fi
  fi

  if [[ -n "$origin_url" ]]; then
    cat <<EOF
Personal repo origin:
  $origin_url
EOF
  else
    cat <<EOF
Personal repo origin:
  - not configured yet
EOF
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root)
      repo_root="$2"
      shift 2
      ;;
    --shared-repo)
      shared_repo=1
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
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

source "$script_dir/cpb-paths.sh"

personal_repo="$(expand_path "$personal_repo")"
operator_id="$(cpdb_detect_operator_id "$repo_root")"
project_id="${CPB_PROJECT_ID:-$(basename "$repo_root")}"
global_brain="$personal_repo/brains/global-operators/$operator_id/brain_v4"
career_docs_root="$personal_repo/docs/career/operators/$operator_id"
local_project_brain="$repo_root/.agent/cross-project-brain/$project_id/project-brain/brain_v4"

mkdir -p "$global_brain" "$career_docs_root"
if [[ ! -d "$personal_repo/.git" ]]; then
  git init -q "$personal_repo"
fi
if [[ "$shared_repo" -eq 1 ]]; then
  mkdir -p "$local_project_brain"
fi

bashrc="$HOME/.bashrc"
marker_start="# Cross-Project Brain personal repo"
marker_end="# End Cross-Project Brain personal repo"
autoenv_start="# Cross-Project Brain auto-env"
temp_file="$(mktemp)"

block_contents="$(cat <<EOF
$marker_start
export CPB_PERSONAL_REPO="$personal_repo"
export CPB_GLOBAL_BRAIN="$global_brain"
export CPB_CAREER_DOCS_ROOT="$career_docs_root"
export CPB_AUTO_PULL_PERSONAL=1
export CPB_AUTO_PUSH_PERSONAL=1
EOF
)"

if [[ "$shared_repo" -eq 1 ]]; then
  block_contents+="
export CPB_PROJECT_BRAIN=\"$local_project_brain\""
fi

block_contents+="
$marker_end"

if [[ -f "$bashrc" ]]; then
  awk -v start="$marker_start" -v end="$marker_end" -v autoenv="$autoenv_start" -v block="$block_contents" '
    $0 == start { skipping=1; next }
    $0 == end { skipping=0; next }
    skipping == 1 { next }
    inserted != 1 && $0 == autoenv {
      print block
      inserted=1
    }
    { print }
    END {
      if (inserted != 1) {
        print block
      }
    }
  ' "$bashrc" >"$temp_file"
else
  printf '%s\n' "$block_contents" >"$temp_file"
fi

mv "$temp_file" "$bashrc"

remote_guidance="$(check_personal_remote_guidance "$operator_id" "$personal_repo")"

cat <<EOF
CPB personal repo pinned.

Repo:              $repo_root
Operator:          $operator_id
Personal repo:     $personal_repo
Global brain:      $global_brain
Career docs root:  $career_docs_root
Bash rc:           $bashrc
EOF

printf '%s\n' "$remote_guidance"

if [[ "$shared_repo" -eq 1 ]]; then
  cat <<EOF
Project brain:     $local_project_brain

Shared/team repo mode is enabled.
The project brain will stay local-only under .agent/ on this machine.
EOF
else
  cat <<EOF

Solo/personal repo mode is enabled.
The project brain keeps its current default unless you override it separately.
EOF
fi

cat <<EOF

Open a new shell or run:
  source ~/.bashrc

After that, keep using normal git in the project repo:
  - git pull -> tries to pull your personal repo first, then rebuilds runtime brain
  - git push -> tries to commit/pull/push your personal repo before the project push

For desktop/laptop sync, add a git remote upstream to the personal repo.
EOF
