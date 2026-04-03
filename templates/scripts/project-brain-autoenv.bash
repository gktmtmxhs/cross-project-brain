_cpdb_autoenv() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck disable=SC1091
  source "$script_dir/cpb-paths.sh"
  cpdb_export_paths

  local repo_root="$CPB_REPO_ROOT"
  local runtime_brain="$CPB_RUNTIME_BRAIN"
  local hook_path="$repo_root/.tools/neuronfs/runtime/v4-hook.cjs"
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

if [[ ";${PROMPT_COMMAND:-};" != *";_cpdb_autoenv;"* ]]; then
  PROMPT_COMMAND="_cpdb_autoenv${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi

_cpdb_autoenv
