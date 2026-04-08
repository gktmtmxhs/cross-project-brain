#!/usr/bin/env bash
set -euo pipefail

repo_root="${CPB_REPO_ROOT:-}"
personal_repo_name="${CPB_PERSONAL_REPO_NAME:-cpb-personal}"
warning_count=0
ok_count=0
info_count=0

usage() {
  cat <<EOF
Usage: bash scripts/cpb-doctor.sh [--repo-root <path>]

Shows the current CPB wiring:
  - operator identity
  - GitHub CLI auth state
  - personal repo sync readiness
  - git hook status
  - brain paths and storage modes
  - NeuronFS install status
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root)
      repo_root="$2"
      shift 2
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

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/cpb-paths.sh"
source "$script_dir/cpb-setup-lib.sh"

if [[ -z "$repo_root" ]]; then
  repo_root="$(cpb_repo_root)"
fi

cpb_export_paths "$repo_root"

is_tty=0
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  is_tty=1
fi

style() {
  local code="$1"
  if [[ "$is_tty" -eq 1 ]]; then
    printf '\033[%sm' "$code"
  fi
}

reset_style="$(style 0)"
bold_style="$(style 1)"
dim_style="$(style 2)"
blue_style="$(style 34)"
green_style="$(style 32)"
yellow_style="$(style 33)"

line() {
  printf '%s\n' "${1:-}"
}

heading() {
  printf '\n%s%s%s\n' "$bold_style" "$1" "$reset_style"
}

summary_line() {
  printf '  %-16s %s\n' "$1" "$2"
}

print_row() {
  local level="$1"
  local label="$2"
  local value="$3"
  printf '  [%s] %-24s %s\n' "$(status_tag "$level")" "$label" "$value"
}

status_tag() {
  local level="$1"
  case "$level" in
    ok)
      printf '%s%s%s' "$green_style" "OK" "$reset_style"
      ;;
    warn)
      printf '%s%s%s' "$yellow_style" "WARN" "$reset_style"
      ;;
    *)
      printf '%s%s%s' "$blue_style" "INFO" "$reset_style"
      ;;
  esac
}

report() {
  local level="$1"
  local label="$2"
  local value="$3"

  case "$level" in
    ok)
      ok_count=$((ok_count + 1))
      ;;
    warn)
      warning_count=$((warning_count + 1))
      ;;
    *)
      info_count=$((info_count + 1))
      ;;
  esac

  print_row "$level" "$label" "$value"
}

info() {
  report info "$1" "$2"
}

ok() {
  report ok "$1" "$2"
}

warn() {
  report warn "$1" "$2"
}

cpb_path_scope() {
  local candidate="$1"

  if [[ -n "${CPB_PERSONAL_REPO:-}" && "$candidate" == "${CPB_PERSONAL_REPO}"* ]]; then
    printf 'personal repo'
    return 0
  fi

  if [[ -n "${CPB_AGENT_ROOT:-}" && "$candidate" == "${CPB_AGENT_ROOT}"* ]]; then
    printf 'local-only'
    return 0
  fi

  if [[ "$candidate" == "${CPB_REPO_ROOT}"* ]]; then
    printf 'project repo'
    return 0
  fi

  printf 'custom'
}

report_dir() {
  local label="$1"
  local candidate="$2"
  local scope
  scope="$(cpb_path_scope "$candidate")"

  if [[ -d "$candidate" ]]; then
    ok "$label" "$candidate ($scope)"
  else
    warn "$label" "$candidate ($scope, missing)"
  fi
}

cpb_project_brain_mode() {
  local candidate="$1"

  if [[ -n "${CPB_AGENT_ROOT:-}" && "$candidate" == "${CPB_AGENT_ROOT}"* ]]; then
    printf 'local-only'
    return 0
  fi

  if [[ "$candidate" == "${CPB_REPO_ROOT}"* ]]; then
    printf 'tracked in project repo'
    return 0
  fi

  if [[ -n "${CPB_PERSONAL_REPO:-}" && "$candidate" == "${CPB_PERSONAL_REPO}"* ]]; then
    printf 'stored in personal repo'
    return 0
  fi

  printf 'custom'
}

cpb_personal_repo_bootstrap_state() {
  local repo_path="$1"
  local origin_url="$2"
  local current_branch=""

  if [[ ! -d "$repo_path/.git" ]]; then
    printf 'not initialized'
    return 0
  fi

  if [[ -z "$origin_url" ]]; then
    printf 'local repo only; remote sync is not wired yet'
    return 0
  fi

  if git -C "$repo_path" rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    printf 'ready'
    return 0
  fi

  current_branch="$(git -C "$repo_path" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  if [[ -n "$current_branch" ]] && git -C "$repo_path" show-ref --verify --quiet "refs/remotes/origin/$current_branch"; then
    printf 'origin found; upstream is missing but CPB can repair it on the next sync push'
    return 0
  fi

  printf 'first-user bootstrap pending first sync push'
}

gh_summary="not installed"
gh_summary_level="info"
gh_login=""
if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    gh_login="$(gh api user --jq .login 2>/dev/null || true)"
    if [[ -n "$gh_login" ]]; then
      gh_summary="authenticated as $gh_login"
    else
      gh_summary="authenticated"
    fi
    gh_summary_level="ok"
  else
    gh_summary="installed but not authenticated"
    gh_summary_level="warn"
  fi
fi

personal_sync_summary="not configured"
personal_sync_level="warn"
personal_bootstrap_summary="not configured"
origin_url=""
upstream_ref=""
if [[ -n "${CPB_PERSONAL_REPO:-}" ]]; then
  if [[ -d "$CPB_PERSONAL_REPO/.git" ]]; then
    origin_url="$(git -C "$CPB_PERSONAL_REPO" remote get-url origin 2>/dev/null || true)"
    personal_bootstrap_summary="$(cpb_personal_repo_bootstrap_state "$CPB_PERSONAL_REPO" "$origin_url")"
    if git -C "$CPB_PERSONAL_REPO" rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
      upstream_ref="$(git -C "$CPB_PERSONAL_REPO" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
      personal_sync_summary="ready"
      personal_sync_level="ok"
    elif [[ -n "$origin_url" ]]; then
      personal_sync_summary="$personal_bootstrap_summary"
      personal_sync_level="warn"
    else
      personal_sync_summary="origin missing"
      personal_sync_level="warn"
    fi
  else
    personal_sync_summary="git repo missing"
    personal_sync_level="warn"
  fi
fi

expected_hooks_path="$CPB_REPO_ROOT/.githooks"
configured_hooks_path="$(git -C "$CPB_REPO_ROOT" config core.hooksPath 2>/dev/null || true)"
hooks_ready=1
if [[ -z "$configured_hooks_path" || "$configured_hooks_path" != "$expected_hooks_path" ]]; then
  hooks_ready=0
fi
for hook_name in post-merge post-checkout post-rewrite pre-push; do
  if [[ ! -x "$expected_hooks_path/$hook_name" ]]; then
    hooks_ready=0
  fi
done

hooks_summary="ready"
hooks_summary_level="ok"
if [[ "$hooks_ready" -ne 1 ]]; then
  hooks_summary="check hook wiring"
  hooks_summary_level="warn"
fi

neuronfs_summary="missing"
neuronfs_summary_level="warn"
if [[ -d "$NEURONFS_INSTALL_DIR" ]]; then
  if [[ -f "$NEURONFS_INSTALL_DIR/neuronfs" ]]; then
    neuronfs_summary="cli installed"
    neuronfs_summary_level="ok"
  else
    neuronfs_summary="degraded: hook-only mode"
    neuronfs_summary_level="warn"
  fi
fi

refresh_log="${CPB_AGENT_ROOT:-$CPB_REPO_ROOT/.agent/cross-project-brain/$(basename "$CPB_REPO_ROOT")}/logs/git-hook-refresh.log"
last_refresh_summary="no refresh log yet"
last_refresh_level="info"
last_log_line=""
if [[ -f "$refresh_log" ]]; then
  last_log_line="$(tail -n 1 "$refresh_log" 2>/dev/null || true)"
  if [[ -n "$last_log_line" ]]; then
    last_refresh_summary="$last_log_line"
    last_refresh_level="ok"
  else
    last_refresh_summary="$refresh_log"
    last_refresh_level="ok"
  fi
fi

project_mode_summary="$(cpb_project_brain_mode "${CPB_PROJECT_BRAIN:-}")"
overall_snapshot="ready"
overall_snapshot_level="ok"
if [[ "$personal_sync_level" == "warn" || "$hooks_summary_level" == "warn" || "$neuronfs_summary_level" == "warn" ]]; then
  overall_snapshot="attention needed"
  overall_snapshot_level="warn"
fi

line "${bold_style}CPB Status${reset_style}"
line "${dim_style}Repo health snapshot for $(basename "$CPB_REPO_ROOT")${reset_style}"

heading "Snapshot"
summary_line "Repo" "$CPB_REPO_ROOT"
summary_line "Operator" "$CPB_OPERATOR_ID"
summary_line "GitHub CLI" "[$(status_tag "$gh_summary_level")] $gh_summary"
summary_line "Project Brain" "$project_mode_summary"
summary_line "Personal Sync" "[$(status_tag "$personal_sync_level")] $personal_sync_summary"
summary_line "Hooks" "[$(status_tag "$hooks_summary_level")] $hooks_summary"
summary_line "NeuronFS" "[$(status_tag "$neuronfs_summary_level")] $neuronfs_summary"
summary_line "Last Refresh" "[$(status_tag "$last_refresh_level")] $last_refresh_summary"
summary_line "Overall" "[$(status_tag "$overall_snapshot_level")] $overall_snapshot"

heading "Identity"
info "repo root" "$CPB_REPO_ROOT"
info "operator (GitHub username)" "$CPB_OPERATOR_ID"
info "recommended personal repo" "${CPB_OPERATOR_ID}/${personal_repo_name}"

heading "GitHub CLI"
if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    if [[ -n "$gh_login" ]]; then
      ok "gh auth" "authenticated as $gh_login"
    else
      ok "gh auth" "authenticated"
    fi
  else
    warn "gh auth" "gh is installed but not authenticated; run 'gh auth login' if you want automatic personal repo setup"
  fi
else
  info "gh auth" "gh is not installed; automatic personal repo checks are unavailable"
fi

heading "Brain paths"
report_dir "team brain" "${CPB_TEAM_BRAIN:-}"
report_dir "global brain" "${CPB_GLOBAL_BRAIN:-}"
report_dir "project brain" "${CPB_PROJECT_BRAIN:-}"
info "project brain mode" "$(cpb_project_brain_mode "${CPB_PROJECT_BRAIN:-}")"
report_dir "runtime brain" "${CPB_RUNTIME_BRAIN:-}"
report_dir "career docs root" "${CPB_CAREER_DOCS_ROOT:-}"

heading "Personal sync"
if [[ -z "${CPB_PERSONAL_REPO:-}" ]]; then
  warn "personal repo" "not configured; set CPB_PERSONAL_REPO if you want desktop/laptop sync for global brain and career docs"
else
  info "personal repo path" "$CPB_PERSONAL_REPO"
  if [[ -d "$CPB_PERSONAL_REPO/.git" ]]; then
    ok "personal repo git" "initialized"
  else
    warn "personal repo git" "missing .git; initialize or clone your personal private repo here"
  fi

  if [[ -d "$CPB_PERSONAL_REPO/.git" ]]; then
    if [[ -n "$origin_url" ]]; then
      ok "personal repo origin" "$origin_url"
    else
      warn "personal repo origin" "missing; connect this repo to ${CPB_OPERATOR_ID}/${personal_repo_name}"
    fi

    info "personal repo bootstrap" "$personal_bootstrap_summary"

    if git -C "$CPB_PERSONAL_REPO" rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
      ok "personal repo upstream" "${upstream_ref:-configured}"
    else
      warn "personal repo upstream" "missing; CPB will set it on the next successful personal sync push when origin is reachable"
    fi
  fi
fi

if [[ "${CPB_AUTO_PULL_PERSONAL:-1}" == "0" ]]; then
  warn "personal repo auto-pull" "disabled by CPB_AUTO_PULL_PERSONAL=0"
else
  ok "personal repo auto-pull" "enabled on project git pull"
fi

if [[ "${CPB_AUTO_PUSH_PERSONAL:-1}" == "0" ]]; then
  warn "personal repo auto-push" "disabled by CPB_AUTO_PUSH_PERSONAL=0"
else
  ok "personal repo auto-push" "enabled on project git push"
fi

heading "Git hooks"
if [[ -z "$configured_hooks_path" ]]; then
  warn "hooks path" "git core.hooksPath is not set; run bash scripts/cpb-setup-git-hooks.sh --repo-root . --hooks-dir .githooks --post-refresh-script scripts/cpb-refresh-after-git.sh --pre-push-script scripts/cpb-sync-personal-repo.sh"
elif [[ "$configured_hooks_path" == "$expected_hooks_path" ]]; then
  ok "hooks path" "$configured_hooks_path"
else
  warn "hooks path" "$configured_hooks_path (expected $expected_hooks_path)"
fi

for hook_name in post-merge post-checkout post-rewrite pre-push; do
  hook_path="$expected_hooks_path/$hook_name"
  if [[ -x "$hook_path" ]]; then
    ok "hook $hook_name" "installed"
  else
    warn "hook $hook_name" "missing or not executable"
  fi
done

heading "NeuronFS"
if [[ -d "$NEURONFS_INSTALL_DIR" ]]; then
  ok "install dir" "$NEURONFS_INSTALL_DIR"
else
  warn "install dir" "$NEURONFS_INSTALL_DIR (missing)"
fi

if [[ -f "$NEURONFS_INSTALL_DIR/neuronfs" ]]; then
  ok "neuronfs cli" "$NEURONFS_INSTALL_DIR/neuronfs"
elif [[ -d "$NEURONFS_INSTALL_DIR" ]]; then
  warn "neuronfs cli" "$NEURONFS_INSTALL_DIR/neuronfs (missing; hook-only mode is active, so CPB autogrowth is disabled until Go or a prebuilt NeuronFS CLI is installed)"
else
  warn "neuronfs cli" "$NEURONFS_INSTALL_DIR/neuronfs (missing)"
fi

heading "Recent activity"
if [[ -f "$refresh_log" ]]; then
  if [[ -n "$last_log_line" ]]; then
    ok "last refresh log" "$last_log_line"
  else
    ok "last refresh log" "$refresh_log"
  fi
else
  info "last refresh log" "no git-hook refresh log yet"
fi

heading "Summary"
reported_ok_count="$ok_count"
reported_info_count="$info_count"
reported_warning_count="$warning_count"
if [[ "$warning_count" -eq 0 ]]; then
  print_row ok "overall" "ready"
else
  print_row warn "overall" "$warning_count warning(s); review the items above"
fi
print_row info "counts" "$reported_ok_count ok / $reported_info_count info / $reported_warning_count warn"
