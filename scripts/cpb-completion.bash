#!/usr/bin/env bash

_cpb_complete() {
  local cur prev cmd cmd_index
  local subcommands="profiles list status doctor apply import-starter-skills scaffold-design-system help"
  local profiles="team-local team-personal solo-tracked solo-personal"
  local create_modes="ask never always"
  local motion_levels="low medium high"
  local design_styles="product-ui console editorial concept-starter"
  local global_options="--repo-root -h --help"
  local apply_options="--operator --personal-repo --create-remote --skip-install --skip-rebuild -h --help"
  local starter_skill_options="--preset --skill --registry --list-presets --list-skills -h --help"
  local design_system_options="--style --primary --motion --force -h --help"

  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]:-}"
  prev="${COMP_WORDS[COMP_CWORD-1]:-}"
  cmd=""
  cmd_index=0

  case "$prev" in
    --repo-root|--personal-repo|--registry)
      COMPREPLY=($(compgen -d -- "$cur"))
      if [[ ${#COMPREPLY[@]} -eq 0 ]]; then
        COMPREPLY=($(compgen -f -- "$cur"))
      fi
      return 0
      ;;
    --create-remote)
      COMPREPLY=($(compgen -W "$create_modes" -- "$cur"))
      return 0
      ;;
    --motion)
      COMPREPLY=($(compgen -W "$motion_levels" -- "$cur"))
      return 0
      ;;
    --style)
      COMPREPLY=($(compgen -W "$design_styles" -- "$cur"))
      return 0
      ;;
  esac

  local i word
  for ((i = 1; i < ${#COMP_WORDS[@]}; i++)); do
    word="${COMP_WORDS[i]}"
    case "$word" in
      --repo-root)
        ((i++))
        ;;
      -*)
        ;;
      *)
        cmd="$word"
        cmd_index=$i
        break
        ;;
    esac
  done

  if [[ -n "$cmd" ]] && (( cmd_index == COMP_CWORD )); then
    cmd=""
  fi

  if [[ -z "$cmd" ]]; then
    COMPREPLY=($(compgen -W "$subcommands $global_options" -- "$cur"))
    return 0
  fi

  case "$cmd" in
    apply)
      if (( COMP_CWORD == cmd_index + 1 )); then
        COMPREPLY=($(compgen -W "$profiles" -- "$cur"))
        return 0
      fi

      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "$apply_options" -- "$cur"))
      else
        COMPREPLY=($(compgen -W "$profiles" -- "$cur"))
      fi
      return 0
      ;;
    profiles|list|status|doctor|help)
      COMPREPLY=($(compgen -W "$global_options" -- "$cur"))
      return 0
      ;;
    import-starter-skills)
      COMPREPLY=($(compgen -W "$starter_skill_options $global_options" -- "$cur"))
      return 0
      ;;
    scaffold-design-system)
      COMPREPLY=($(compgen -W "$design_system_options $global_options" -- "$cur"))
      return 0
      ;;
  esac
}

complete -o bashdefault -o default -F _cpb_complete cpb
