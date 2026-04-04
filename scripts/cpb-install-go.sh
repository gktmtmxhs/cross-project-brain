#!/usr/bin/env bash
set -euo pipefail

mode="install"
manager_override="${CPB_GO_INSTALL_MANAGER:-}"
skip_update="${CPB_GO_INSTALL_SKIP_UPDATE:-0}"

usage() {
  cat <<EOF
Usage: bash scripts/cpb-install-go.sh [--check|--print-plan] [--manager <name>] [--skip-update]

Modes:
  --check        exit 0 when go is already available in PATH, 1 otherwise
  --print-plan   print the detected package manager and planned install commands

Options:
  --manager <name>  force one of: apt-get, brew, dnf, yum, pacman, apk, zypper
  --skip-update     skip the package index refresh step for package managers that use one
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)
      mode="check"
      shift
      ;;
    --print-plan)
      mode="print-plan"
      shift
      ;;
    --manager)
      manager_override="$2"
      shift 2
      ;;
    --skip-update)
      skip_update=1
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

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

run_maybe_privileged() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
    return 0
  fi

  if have_cmd sudo; then
    sudo "$@"
    return 0
  fi

  echo "This Go install step needs root privileges for $1, but sudo is not available." >&2
  return 1
}

detect_manager() {
  if [[ -n "$manager_override" ]]; then
    printf '%s\n' "$manager_override"
    return 0
  fi

  for candidate in apt-get brew dnf yum pacman apk zypper; do
    if have_cmd "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

print_plan() {
  local manager="$1"
  printf 'manager: %s\n' "$manager"
  printf 'commands:\n'
  case "$manager" in
    apt-get)
      if [[ "$skip_update" -ne 1 ]]; then
        printf '  apt-get update\n'
      fi
      printf '  apt-get install -y golang-go\n'
      ;;
    brew)
      printf '  brew install go\n'
      ;;
    dnf)
      printf '  dnf install -y golang\n'
      ;;
    yum)
      printf '  yum install -y golang\n'
      ;;
    pacman)
      if [[ "$skip_update" -ne 1 ]]; then
        printf '  pacman -Sy --noconfirm go\n'
      else
        printf '  pacman -S --noconfirm go\n'
      fi
      ;;
    apk)
      if [[ "$skip_update" -ne 1 ]]; then
        printf '  apk update\n'
      fi
      printf '  apk add go\n'
      ;;
    zypper)
      if [[ "$skip_update" -ne 1 ]]; then
        printf '  zypper refresh\n'
      fi
      printf '  zypper --non-interactive install go\n'
      ;;
    *)
      echo "Unsupported Go install manager: $manager" >&2
      return 1
      ;;
  esac
}

install_go() {
  local manager="$1"

  case "$manager" in
    apt-get)
      if [[ "$skip_update" -ne 1 ]]; then
        run_maybe_privileged apt-get update
      fi
      run_maybe_privileged apt-get install -y golang-go
      ;;
    brew)
      brew install go
      ;;
    dnf)
      run_maybe_privileged dnf install -y golang
      ;;
    yum)
      run_maybe_privileged yum install -y golang
      ;;
    pacman)
      if [[ "$skip_update" -ne 1 ]]; then
        run_maybe_privileged pacman -Sy --noconfirm go
      else
        run_maybe_privileged pacman -S --noconfirm go
      fi
      ;;
    apk)
      if [[ "$skip_update" -ne 1 ]]; then
        run_maybe_privileged apk update
      fi
      run_maybe_privileged apk add go
      ;;
    zypper)
      if [[ "$skip_update" -ne 1 ]]; then
        run_maybe_privileged zypper refresh
      fi
      run_maybe_privileged zypper --non-interactive install go
      ;;
    *)
      echo "Unsupported Go install manager: $manager" >&2
      return 1
      ;;
  esac
}

if [[ "$mode" == "check" ]]; then
  if have_cmd go; then
    printf 'go available: %s\n' "$(go version)"
    exit 0
  fi
  printf 'go not available\n' >&2
  exit 1
fi

if have_cmd go; then
  printf 'Go already available: %s\n' "$(go version)"
  exit 0
fi

manager="$(detect_manager || true)"
if [[ -z "$manager" ]]; then
  echo "Could not find a supported package manager to install Go automatically." >&2
  echo "Install Go manually, or provide a prebuilt NeuronFS CLI to enable full CPB autogrowth." >&2
  exit 1
fi

if [[ "$mode" == "print-plan" ]]; then
  print_plan "$manager"
  exit 0
fi

printf 'Go is not installed. Attempting automatic install via %s.\n' "$manager"
install_go "$manager"

if ! have_cmd go; then
  echo "Automatic Go install finished, but 'go' is still not available in PATH." >&2
  exit 1
fi

printf 'Go installed successfully: %s\n' "$(go version)"
