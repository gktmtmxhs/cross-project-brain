#!/usr/bin/env bash
set -euo pipefail

repo_root=""
hooks_dir=""
post_refresh_script=""
pre_push_script=""
label="CPB"

usage() {
  cat <<EOF
Usage: bash scripts/cpb-setup-git-hooks.sh --repo-root <path> --hooks-dir <path> --post-refresh-script <repo-relative-path> --pre-push-script <repo-relative-path> [--label <text>]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-root)
      repo_root="$2"
      shift 2
      ;;
    --hooks-dir)
      hooks_dir="$2"
      shift 2
      ;;
    --post-refresh-script)
      post_refresh_script="$2"
      shift 2
      ;;
    --pre-push-script)
      pre_push_script="$2"
      shift 2
      ;;
    --label)
      label="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unexpected argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$repo_root" || -z "$hooks_dir" || -z "$post_refresh_script" || -z "$pre_push_script" ]]; then
  usage >&2
  exit 1
fi

write_hook() {
  local hook_name="$1"
  local hook_path="$hooks_dir/$hook_name"

  mkdir -p "$hooks_dir"

  if [[ "$hook_name" == "pre-push" ]]; then
    cat >"$hook_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail

repo_root="\$(git rev-parse --show-toplevel)"
bash "\$repo_root/$pre_push_script" || true
EOF
    chmod +x "$hook_path"
    return 0
  fi

  cat >"$hook_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail

repo_root="\$(git rev-parse --show-toplevel)"
bash "\$repo_root/$post_refresh_script" || true
EOF
  chmod +x "$hook_path"
}

write_hook "post-merge"
write_hook "post-checkout"
write_hook "post-rewrite"
write_hook "pre-push"

git -C "$repo_root" config core.hooksPath "$hooks_dir"

cat <<EOF
$label git hooks pinned.

Repo:       $repo_root
Hooks path: $hooks_dir

Installed hooks:
  - post-merge
  - post-checkout
  - post-rewrite
  - pre-push

Post-* hooks run: $post_refresh_script
Pre-push runs:    $pre_push_script
EOF
