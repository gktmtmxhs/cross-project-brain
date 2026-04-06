#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to scaffold an initial design system." >&2
  exit 1
fi

exec env -u NODE_OPTIONS node "$script_dir/cpb-scaffold-design-system.mjs" "$@"
