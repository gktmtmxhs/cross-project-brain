#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"

cpb_expand_path() {
  local value="$1"

  if [[ "$value" == "~" ]]; then
    value="$HOME"
  elif [[ "$value" == "~/"* ]]; then
    value="$HOME/${value#"~/"}"
  fi

  if [[ "$value" != /* ]]; then
    value="$PWD/$value"
  fi

  printf '%s\n' "$value"
}

cpb_shell_escape() {
  printf '%q' "$1"
}

cpb_upsert_file_block() {
  local target_file="$1"
  local marker_start="$2"
  local marker_end="$3"
  local block_contents="$4"
  local insert_before_marker="${5:-}"
  local temp_file

  temp_file="$(mktemp)"

  if [[ -f "$target_file" ]]; then
    awk -v start="$marker_start" -v end="$marker_end" -v before="$insert_before_marker" -v block="$block_contents" '
      $0 == start { skipping=1; next }
      $0 == end { skipping=0; next }
      skipping == 1 { next }
      inserted != 1 && before != "" && $0 == before {
        print block
        inserted=1
      }
      { print }
      END {
        if (inserted != 1) {
          print block
        }
      }
    ' "$target_file" >"$temp_file"
  else
    printf '%s\n' "$block_contents" >"$temp_file"
  fi

  mv "$temp_file" "$target_file"
}

cpb_personal_repo_local_state() {
  local target="$1"

  if [[ -d "$target/.git" ]]; then
    printf 'git-repo\n'
    return 0
  fi

  if [[ ! -e "$target" ]]; then
    printf 'missing\n'
    return 0
  fi

  if [[ -d "$target" ]]; then
    if [[ -z "$(find "$target" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
      printf 'empty-dir\n'
    else
      printf 'occupied-dir\n'
    fi
    return 0
  fi

  printf 'occupied-file\n'
}

cpb_can_prompt_tty() {
  [[ -r /dev/tty && -w /dev/tty ]]
}

cpb_prompt_yes_no() {
  local prompt="$1"
  local reply=""

  if ! cpb_can_prompt_tty; then
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

cpb_json_field() {
  local field_name="$1"
  node -e 'const data=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(String(data[process.argv[1]] || ""));' "$field_name"
}

cpb_reset_personal_repo_guidance_state() {
  CPB_PERSONAL_REPO_REMOTE_FOUND=0
  CPB_PERSONAL_REPO_REMOTE_CREATED=0
  CPB_PERSONAL_REPO_ORIGIN_URL=""
  CPB_PERSONAL_REPO_BOOTSTRAP_MODE="unknown"
}

cpb_ensure_gh_auth_guidance() {
  local expected_slug="$1"
  local create_mode="${2:-ask}"

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

  case "$create_mode" in
    always)
      if cpb_can_prompt_tty; then
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
      if cpb_prompt_yes_no "
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

cpb_check_personal_remote_guidance() {
  local operator_id="$1"
  local personal_repo="$2"
  local personal_repo_name="$3"
  local create_mode="${4:-ask}"
  local expected_slug="${operator_id}/${personal_repo_name}"
  local origin_url=""

  cpb_reset_personal_repo_guidance_state
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
  elif cpb_ensure_gh_auth_guidance "$expected_slug" "$create_mode"; then
    local repo_json
    repo_json="$(gh repo view "$expected_slug" --json nameWithOwner,visibility,sshUrl,url 2>/dev/null || true)"

    if [[ -n "$repo_json" ]]; then
      local visibility ssh_url https_url
      visibility="$(printf '%s' "$repo_json" | cpb_json_field visibility)"
      ssh_url="$(printf '%s' "$repo_json" | cpb_json_field sshUrl)"
      https_url="$(printf '%s' "$repo_json" | cpb_json_field url)"

      cat <<EOF
GitHub private repo check:
  - found: $expected_slug
  - visibility: $visibility
EOF
      CPB_PERSONAL_REPO_REMOTE_FOUND=1
      CPB_PERSONAL_REPO_BOOTSTRAP_MODE="returning-user"

      if [[ "$visibility" != "PRIVATE" && "$visibility" != "INTERNAL" ]]; then
        cat <<EOF
  - warning: this repo is not private; desktop/laptop sync will still work, but private mode is recommended
EOF
      fi

      if [[ -z "$origin_url" ]]; then
        if [[ -n "$ssh_url" ]]; then
          origin_url="$ssh_url"
        elif [[ -n "$https_url" ]]; then
          origin_url="$https_url"
        fi
      fi
    else
      local should_create="no"
      CPB_PERSONAL_REPO_BOOTSTRAP_MODE="first-user"

      case "$create_mode" in
        always)
          should_create="yes"
          ;;
        ask)
          if cpb_can_prompt_tty; then
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
            visibility="$(printf '%s' "$repo_json" | cpb_json_field visibility)"
            ssh_url="$(printf '%s' "$repo_json" | cpb_json_field sshUrl)"
            https_url="$(printf '%s' "$repo_json" | cpb_json_field url)"

            cat <<EOF
GitHub private repo check:
  - created: $expected_slug
  - visibility: $visibility
EOF
            CPB_PERSONAL_REPO_REMOTE_FOUND=1
            CPB_PERSONAL_REPO_REMOTE_CREATED=1
            CPB_PERSONAL_REPO_BOOTSTRAP_MODE="first-user"

            if [[ -z "$origin_url" ]]; then
              if [[ -n "$ssh_url" ]]; then
                origin_url="$ssh_url"
              elif [[ -n "$https_url" ]]; then
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

  CPB_PERSONAL_REPO_ORIGIN_URL="$origin_url"

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

cpb_sync_personal_repo_checkout() {
  local personal_repo="$1"
  local origin_url="$2"
  local repo_state
  repo_state="$(cpb_personal_repo_local_state "$personal_repo")"

  case "$repo_state" in
    missing)
      if [[ -n "$origin_url" ]]; then
        git clone "$origin_url" "$personal_repo" >/dev/null 2>&1 || {
          mkdir -p "$personal_repo"
          git init -q "$personal_repo"
        }
      else
        mkdir -p "$personal_repo"
        git init -q "$personal_repo"
      fi
      ;;
    empty-dir)
      if [[ -n "$origin_url" ]]; then
        git clone "$origin_url" "$personal_repo" >/dev/null 2>&1 || git init -q "$personal_repo"
      else
        git init -q "$personal_repo"
      fi
      ;;
    occupied-dir|occupied-file)
      cat <<EOF
Local personal repo path check:
  - path exists but is not a git repo checkout: $personal_repo
  - leaving it untouched; move it away or choose another path if you want automatic clone/sync
EOF
      return 0
      ;;
  esac

  if [[ ! -d "$personal_repo/.git" ]]; then
    return 0
  fi

  if [[ -n "$origin_url" ]]; then
    local current_origin current_branch
    current_origin="$(git -C "$personal_repo" remote get-url origin 2>/dev/null || true)"
    if [[ -z "$current_origin" ]]; then
      git -C "$personal_repo" remote add origin "$origin_url"
    elif [[ "$current_origin" != "$origin_url" ]]; then
      git -C "$personal_repo" remote set-url origin "$origin_url"
    fi

    git -C "$personal_repo" fetch origin >/dev/null 2>&1 || true

    if ! git -C "$personal_repo" rev-parse --verify HEAD >/dev/null 2>&1; then
      if git -C "$personal_repo" show-ref --verify --quiet refs/remotes/origin/main; then
        git -C "$personal_repo" checkout -q -B main --track origin/main >/dev/null 2>&1 || true
      elif git -C "$personal_repo" show-ref --verify --quiet refs/remotes/origin/master; then
        git -C "$personal_repo" checkout -q -B master --track origin/master >/dev/null 2>&1 || true
      fi
      return 0
    fi

    if git -C "$personal_repo" rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
      git -C "$personal_repo" pull --ff-only >/dev/null 2>&1 || true
      return 0
    fi

    current_branch="$(git -C "$personal_repo" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
    if [[ -n "$current_branch" ]] && git -C "$personal_repo" show-ref --verify --quiet "refs/remotes/origin/$current_branch"; then
      git -C "$personal_repo" branch --set-upstream-to "origin/$current_branch" "$current_branch" >/dev/null 2>&1 || true
      git -C "$personal_repo" pull --ff-only >/dev/null 2>&1 || true
    fi
  fi
}

cpb_seed_project_brain_if_empty() {
  local target_dir="$1"
  shift
  local candidate=""

  if cpb_dir_has_contents "$target_dir"; then
    return 0
  fi

  for candidate in "$@"; do
    if [[ -z "$candidate" || "$candidate" == "$target_dir" ]]; then
      continue
    fi
    if cpb_dir_has_contents "$candidate"; then
      rsync -a "$candidate"/ "$target_dir"/
      return 0
    fi
  done
}
