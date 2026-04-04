#!/usr/bin/env bash
set -euo pipefail

repo_root="${CPB_REPO_ROOT:-}"
personal_repo_name="${CPB_PERSONAL_REPO_NAME:-cpb-personal}"
warning_count=0

usage() {
  cat <<EOF
Usage: bash scripts/cpb-doctor.sh [--repo-root <path>]

Shows the current Cross-Project Brain wiring:
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
# shellcheck disable=SC1091
source "$script_dir/cpb-paths.sh"

if [[ -z "$repo_root" ]]; then
  repo_root="$(cpdb_repo_root)"
fi

cpdb_export_paths "$repo_root"

line() {
  printf '%s\n' "${1:-}"
}

info() {
  printf '  [info] %s: %s\n' "$1" "$2"
}

ok() {
  printf '  [ok] %s: %s\n' "$1" "$2"
}

warn() {
  warning_count=$((warning_count + 1))
  printf '  [warn] %s: %s\n' "$1" "$2"
}

path_scope() {
  local candidate="$1"

  if [[ -n "${CPB_PERSONAL_REPO:-}" && "$candidate" == "${CPB_PERSONAL_REPO}"* ]]; then
    printf 'personal repo'
    return 0
  fi

  if [[ "$candidate" == "${CPB_AGENT_ROOT}"* ]]; then
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
  scope="$(path_scope "$candidate")"

  if [[ -d "$candidate" ]]; then
    ok "$label" "$candidate ($scope)"
  else
    warn "$label" "$candidate ($scope, missing)"
  fi
}

report_file() {
  local label="$1"
  local candidate="$2"

  if [[ -f "$candidate" ]]; then
    ok "$label" "$candidate"
  else
    warn "$label" "$candidate (missing)"
  fi
}

project_brain_mode() {
  local candidate="$1"

  if [[ "$candidate" == "${CPB_AGENT_ROOT}"* ]]; then
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

personal_repo_bootstrap_state() {
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

line "Cross-Project Brain doctor"
line

line "Identity"
info "repo root" "$CPB_REPO_ROOT"
info "project id" "$CPB_PROJECT_ID"
info "operator (GitHub username)" "$CPB_OPERATOR_ID"
info "recommended personal repo" "${CPB_OPERATOR_ID}/${personal_repo_name}"

line
line "GitHub CLI"
if command -v gh >/dev/null 2>&1; then
  if gh auth status >/dev/null 2>&1; then
    gh_login="$(gh api user --jq .login 2>/dev/null || true)"
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

line
line "Brain paths"
report_dir "team brain" "$CPB_TEAM_BRAIN"
report_dir "global brain" "$CPB_GLOBAL_BRAIN"
report_dir "project brain" "$CPB_PROJECT_BRAIN"
info "project brain mode" "$(project_brain_mode "$CPB_PROJECT_BRAIN")"
report_dir "device brain" "$CPB_DEVICE_BRAIN"
report_dir "runtime brain" "$CPB_RUNTIME_BRAIN"
report_dir "career docs root" "$CPB_CAREER_DOCS_ROOT"

line
line "Personal sync"
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
    origin_url="$(git -C "$CPB_PERSONAL_REPO" remote get-url origin 2>/dev/null || true)"
    if [[ -n "$origin_url" ]]; then
      ok "personal repo origin" "$origin_url"
    else
      warn "personal repo origin" "missing; connect this repo to ${CPB_OPERATOR_ID}/${personal_repo_name}"
    fi

    info "personal repo bootstrap" "$(personal_repo_bootstrap_state "$CPB_PERSONAL_REPO" "$origin_url")"

    if git -C "$CPB_PERSONAL_REPO" rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
      upstream_ref="$(git -C "$CPB_PERSONAL_REPO" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
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

line
line "Git hooks"
expected_hooks_path="$CPB_REPO_ROOT/.githooks"
configured_hooks_path="$(git -C "$CPB_REPO_ROOT" config core.hooksPath 2>/dev/null || true)"

if [[ -z "$configured_hooks_path" ]]; then
  warn "hooks path" "git core.hooksPath is not set; run bash scripts/cpb-setup-git-hooks.sh"
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

line
line "NeuronFS"
if [[ -d "$CPB_NEURONFS_INSTALL_DIR" ]]; then
  ok "install dir" "$CPB_NEURONFS_INSTALL_DIR"
else
  warn "install dir" "$CPB_NEURONFS_INSTALL_DIR (missing)"
fi

report_file "neuronfs cli" "$CPB_NEURONFS_INSTALL_DIR/neuronfs"

line
line "Recent activity"
refresh_log="$CPB_AGENT_ROOT/logs/git-hook-refresh.log"
if [[ -f "$refresh_log" ]]; then
  last_log_line="$(tail -n 1 "$refresh_log" 2>/dev/null || true)"
  if [[ -n "$last_log_line" ]]; then
    ok "last refresh log" "$last_log_line"
  else
    ok "last refresh log" "$refresh_log"
  fi
else
  info "last refresh log" "no git-hook refresh log yet"
fi

line
line "Summary"
if [[ "$warning_count" -eq 0 ]]; then
  ok "overall" "ready"
else
  warn "overall" "$warning_count warning(s); review the items above"
fi

if [[ -z "${CPB_PERSONAL_REPO:-}" ]]; then
  line
  line "Suggested next step"
  line "  cpb profiles"
  line "  cpb apply team-local"
fi
