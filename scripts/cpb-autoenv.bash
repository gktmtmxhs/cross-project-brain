cpb_autoenv_tick() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck disable=SC1091
  source "$script_dir/cpb-paths.sh"

  local repo_root="${CPB_REPO_ROOT:-$(cpb_repo_root)}"
  local project_id="${CPB_PROJECT_ID:-$(cpb_project_id "$repo_root")}"
  local agent_root="${CPB_AGENT_ROOT:-$repo_root/.agent/cross-project-brain/$project_id}"
  local runtime_brain="${CPB_RUNTIME_BRAIN:-$agent_root/runtime-brain/brain_v4}"
  local hook_path="${CPB_HOOK_PATH:-$repo_root/.tools/neuronfs/runtime/v4-hook.cjs}"
  local neuronfs_binary="${CPB_NEURONFS_BINARY:-${NEURONFS_INSTALL_DIR:-$repo_root/.tools/neuronfs}/neuronfs}"
  local autogrowth_manager="${CPB_AUTOGROWTH_MANAGER_SCRIPT:-$repo_root/scripts/cpb-autogrowth.sh}"
  local finish_check_script="${CPB_FINISH_CHECK_SCRIPT:-$repo_root/scripts/cpb-finish-check.mjs}"
  local inside_repo=0

  case "$PWD" in
    "$repo_root"|"$repo_root"/*)
      inside_repo=1
      ;;
  esac

  if [ "$inside_repo" -eq 1 ] && [ -d "$runtime_brain" ] && [ -f "$hook_path" ]; then
    if [ "${CPB_AUTOENV:-}" != "1" ]; then
      if [ -n "${NODE_OPTIONS+x}" ]; then
        export CPB_NODE_OPTIONS_ORIG="$NODE_OPTIONS"
      else
        export CPB_NODE_OPTIONS_ORIG="__CPB_UNSET__"
      fi

      export NEURONFS_BRAIN="$runtime_brain"
      if [ -n "${NODE_OPTIONS:-}" ]; then
        export NODE_OPTIONS="--require $hook_path $NODE_OPTIONS"
      else
        export NODE_OPTIONS="--require $hook_path"
      fi
      export CPB_AUTOENV=1
    fi

    if [ -x "$neuronfs_binary" ] && [ -f "$autogrowth_manager" ]; then
      bash "$autogrowth_manager" start >/dev/null 2>&1 || true
    fi
    if command -v node >/dev/null 2>&1 && [ -f "$finish_check_script" ]; then
      node "$finish_check_script" --init-baseline >/dev/null 2>&1 || true
    fi
    return 0
  fi

  if [ "${CPB_AUTOENV:-}" = "1" ]; then
    if [ "${CPB_NODE_OPTIONS_ORIG:-__CPB_UNSET__}" = "__CPB_UNSET__" ]; then
      unset NODE_OPTIONS
    else
      export NODE_OPTIONS="$CPB_NODE_OPTIONS_ORIG"
    fi
    unset CPB_NODE_OPTIONS_ORIG

    if [ "${NEURONFS_BRAIN:-}" = "$runtime_brain" ]; then
      unset NEURONFS_BRAIN
    fi
    unset CPB_AUTOENV
  fi
}
