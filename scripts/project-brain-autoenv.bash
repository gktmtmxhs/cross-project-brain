_cpb_autoenv() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck disable=SC1091
  source "$script_dir/cpb-autoenv.bash"
  cpb_autoenv_tick
}

if [[ ";${PROMPT_COMMAND:-};" != *";_cpb_autoenv;"* ]]; then
  PROMPT_COMMAND="_cpb_autoenv${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi

_cpb_autoenv
