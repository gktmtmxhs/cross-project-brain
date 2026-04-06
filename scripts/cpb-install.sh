#!/usr/bin/env bash
set -euo pipefail

target_repo="$PWD"
force=0
setup_shell=1
install_neuronfs=1
auto_install_go=1
start_autogrowth=1
personal_repo=""
shared_repo=0
shared_repo_explicit=0
project_type=""
project_summary=""
non_interactive=0
starter_skill_import=0
starter_skills_explicit=0
starter_skill_preset=""
starter_skill_registry=""
temp_framework_root=""
detected_project_type=""
detected_project_stack=""
detected_project_signals=""
project_profile_type=""
project_profile_summary=""
project_profile_detection_mode="auto"
initial_repo_empty=0

usage() {
  cat <<EOF
Usage: bash scripts/cpb-install.sh [--target <path>] [--personal-repo <path>] [--shared-repo] [--project-type <type>] [--project-summary <text>] [--with-starter-skills] [--starter-skill-preset <name>] [--starter-skill-registry <path>] [--non-interactive] [--force] [--no-shell] [--no-neuronfs] [--no-autogrowth] [--skip-go-install]

Examples:
  bash /path/to/cross-project-brain/scripts/cpb-install.sh --personal-repo "$HOME/.cpb-personal" --shared-repo
  bash /path/to/cross-project-brain/scripts/cpb-install.sh --target /path/to/repo --project-type fullstack-app --project-summary "Subscription SaaS for guitar learners"
  bash /path/to/cross-project-brain/scripts/cpb-install.sh --target /path/to/repo --with-starter-skills --starter-skill-preset web
  bash /path/to/cross-project-brain/scripts/cpb-install.sh --target /path/to/repo
  bash /path/to/cross-project-brain/scripts/cpb-install.sh --personal-repo ~/workspace/cpb-personal --shared-repo
  tmpdir="\$(mktemp -d)" && git clone --depth 1 https://github.com/<owner>/cross-project-brain.git "\$tmpdir" && bash "\$tmpdir/scripts/cpb-install.sh" --personal-repo "$HOME/.cpb-personal" --shared-repo && rm -rf "\$tmpdir"

Advanced stdin/bootstrap mode:
  Set CPB_FRAMEWORK_REPO_URL when running this script without a checked-out framework repo beside it.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      target_repo="$2"
      shift 2
      ;;
    --personal-repo)
      personal_repo="$2"
      shift 2
      ;;
    --shared-repo)
      shared_repo=1
      shared_repo_explicit=1
      shift
      ;;
    --project-type)
      project_type="$2"
      shift 2
      ;;
    --project-summary)
      project_summary="$2"
      shift 2
      ;;
    --non-interactive)
      non_interactive=1
      shift
      ;;
    --with-starter-skills)
      starter_skill_import=1
      starter_skills_explicit=1
      shift
      ;;
    --starter-skill-preset)
      starter_skill_import=1
      starter_skills_explicit=1
      starter_skill_preset="$2"
      shift 2
      ;;
    --starter-skill-registry)
      starter_skill_registry="$2"
      shift 2
      ;;
    --force)
      force=1
      shift
      ;;
    --no-shell)
      setup_shell=0
      shift
      ;;
    --no-neuronfs)
      install_neuronfs=0
      shift
      ;;
    --skip-go-install)
      auto_install_go=0
      shift
      ;;
    --no-autogrowth)
      start_autogrowth=0
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

cleanup() {
  if [[ -n "$temp_framework_root" && -d "$temp_framework_root" ]]; then
    rm -rf "$temp_framework_root"
  fi
}
trap cleanup EXIT

resolve_framework_root() {
  local script_dir local_root
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local_root="$(cd "$script_dir/.." && pwd)"

  if [[ -d "$local_root/templates" && -d "$local_root/scripts" && -f "$local_root/README.md" ]]; then
    printf '%s\n' "$local_root"
    return 0
  fi

  local repo_url="${CPB_FRAMEWORK_REPO_URL:-}"
  local repo_ref="${CPB_FRAMEWORK_REPO_REF:-main}"
  if [[ -z "$repo_url" ]]; then
    echo "Could not resolve the framework root automatically." >&2
    echo "Run from a checked-out framework repo or set CPB_FRAMEWORK_REPO_URL." >&2
    exit 1
  fi

  temp_framework_root="$(mktemp -d)"
  git clone --depth 1 --branch "$repo_ref" "$repo_url" "$temp_framework_root/framework" >/dev/null 2>&1
  printf '%s\n' "$temp_framework_root/framework"
}

framework_root="$(resolve_framework_root)"
mkdir -p "$target_repo"
target_repo="$(cd "$target_repo" && pwd)"

copy_file() {
  local source="$1"
  local dest="$2"
  local dest_dir
  dest_dir="$(dirname "$dest")"
  mkdir -p "$dest_dir"

  if [[ -e "$dest" && "$force" -ne 1 ]]; then
    return 0
  fi

  cp "$source" "$dest"
  case "$dest" in
    *.sh|*.bash)
      chmod +x "$dest"
      ;;
  esac
}

expand_path() {
  local value="$1"

  if [[ "$value" == "~" ]]; then
    value="$HOME"
  elif [[ "$value" == ~/* ]]; then
    value="$HOME/${value#~/}"
  fi

  if [[ "$value" != /* ]]; then
    value="$PWD/$value"
  fi

  printf '%s\n' "$value"
}

can_prompt_tty() {
  [[ "$non_interactive" -ne 1 && -t 0 && -t 1 ]]
}

prompt_with_default() {
  local prompt="$1"
  local default_value="${2:-}"
  local response=""

  if [[ -n "$default_value" ]]; then
    printf '%s [%s]: ' "$prompt" "$default_value" >&2
  else
    printf '%s: ' "$prompt" >&2
  fi

  IFS= read -r response || true
  if [[ -z "$response" ]]; then
    response="$default_value"
  fi
  printf '%s\n' "$response"
}

prompt_yes_no() {
  local prompt="$1"
  local default_answer="${2:-n}"
  local default_render="y/N"
  local response=""

  if [[ "$default_answer" == "y" ]]; then
    default_render="Y/n"
  fi

  printf '%s [%s]: ' "$prompt" "$default_render" >&2
  IFS= read -r response || true
  response="${response:-$default_answer}"
  case "$response" in
    y|Y|yes|YES)
      return 0
      ;;
  esac
  return 1
}

sanitize_project_type() {
  local raw="${1:-unknown}"
  raw="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  raw="$(printf '%s' "$raw" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"
  if [[ -z "$raw" ]]; then
    raw="unknown"
  fi
  printf '%s\n' "$raw"
}

default_starter_skill_preset() {
  case "${1:-unknown}" in
    web-app)
      printf 'web\n'
      ;;
    fullstack-app)
      printf 'fullstack\n'
      ;;
    api-service)
      printf 'backend\n'
      ;;
    *)
      printf 'minimal\n'
      ;;
  esac
}

json_escape() {
  printf '%s' "${1:-}" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

repo_is_effectively_empty() {
  local repo_path="$1"

  if find "$repo_path" -mindepth 1 -maxdepth 2 \
    ! -path "$repo_path/.git" \
    ! -path "$repo_path/.git/*" \
    -print -quit | grep -q .; then
    return 1
  fi

  return 0
}

append_csv_unique() {
  local current="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    printf '%s\n' "$current"
    return 0
  fi
  case ",$current," in
    *,"$value",*)
      printf '%s\n' "$current"
      ;;
    *)
      if [[ -n "$current" ]]; then
        printf '%s,%s\n' "$current" "$value"
      else
        printf '%s\n' "$value"
      fi
      ;;
  esac
}

detect_project_profile() {
  local repo_path="$1"
  local package_json="$repo_path/package.json"
  local pyproject="$repo_path/pyproject.toml"
  local requirements_txt="$repo_path/requirements.txt"
  local cargo_toml="$repo_path/Cargo.toml"
  local type_candidates=""
  local stack_csv=""
  local signal_csv=""

  if [[ -f "$package_json" ]]; then
    signal_csv="$(append_csv_unique "$signal_csv" "package.json")"
    stack_csv="$(append_csv_unique "$stack_csv" "nodejs")"
    if [[ -f "$repo_path/tsconfig.json" ]] || grep -qi '"typescript"' "$package_json"; then
      stack_csv="$(append_csv_unique "$stack_csv" "typescript")"
    fi
    if [[ -f "$repo_path/next.config.js" || -f "$repo_path/next.config.mjs" || -f "$repo_path/next.config.ts" ]]; then
      signal_csv="$(append_csv_unique "$signal_csv" "next.config")"
      stack_csv="$(append_csv_unique "$stack_csv" "react")"
      stack_csv="$(append_csv_unique "$stack_csv" "nextjs")"
      type_candidates="$(append_csv_unique "$type_candidates" "web-app")"
    elif [[ -f "$repo_path/vite.config.js" || -f "$repo_path/vite.config.ts" || -f "$repo_path/vite.config.mjs" ]]; then
      signal_csv="$(append_csv_unique "$signal_csv" "vite.config")"
      stack_csv="$(append_csv_unique "$stack_csv" "vite")"
      if grep -qi '"react"' "$package_json"; then
        stack_csv="$(append_csv_unique "$stack_csv" "react")"
      fi
      type_candidates="$(append_csv_unique "$type_candidates" "web-app")"
    elif grep -Eqi '"(express|fastify|koa|nestjs|nest)"' "$package_json"; then
      stack_csv="$(append_csv_unique "$stack_csv" "node-service")"
      type_candidates="$(append_csv_unique "$type_candidates" "api-service")"
    fi
  fi

  if [[ -f "$repo_path/pom.xml" || -f "$repo_path/build.gradle" || -f "$repo_path/build.gradle.kts" || -f "$repo_path/gradlew" ]]; then
    signal_csv="$(append_csv_unique "$signal_csv" "java-build")"
    stack_csv="$(append_csv_unique "$stack_csv" "java")"
    if [[ -f "$repo_path/pom.xml" ]] && grep -Eqi 'spring-boot|org\.springframework' "$repo_path/pom.xml"; then
      stack_csv="$(append_csv_unique "$stack_csv" "spring")"
    fi
    if [[ -f "$repo_path/build.gradle" ]] && grep -Eqi 'spring-boot|org\.springframework' "$repo_path/build.gradle"; then
      stack_csv="$(append_csv_unique "$stack_csv" "spring")"
    fi
    type_candidates="$(append_csv_unique "$type_candidates" "api-service")"
  fi

  if [[ -f "$repo_path/go.mod" ]]; then
    signal_csv="$(append_csv_unique "$signal_csv" "go.mod")"
    stack_csv="$(append_csv_unique "$stack_csv" "go")"
    type_candidates="$(append_csv_unique "$type_candidates" "api-service")"
  fi

  if [[ -f "$pyproject" || -f "$requirements_txt" ]]; then
    signal_csv="$(append_csv_unique "$signal_csv" "python")"
    stack_csv="$(append_csv_unique "$stack_csv" "python")"
    if [[ -f "$pyproject" ]] && grep -Eqi 'fastapi|django|flask' "$pyproject"; then
      type_candidates="$(append_csv_unique "$type_candidates" "api-service")"
    elif [[ -f "$requirements_txt" ]] && grep -Eqi 'fastapi|django|flask' "$requirements_txt"; then
      type_candidates="$(append_csv_unique "$type_candidates" "api-service")"
    fi
  fi

  if [[ -f "$cargo_toml" ]]; then
    signal_csv="$(append_csv_unique "$signal_csv" "Cargo.toml")"
    stack_csv="$(append_csv_unique "$stack_csv" "rust")"
    if [[ -f "$repo_path/src/main.rs" || -f "$repo_path/main.rs" ]]; then
      type_candidates="$(append_csv_unique "$type_candidates" "cli")"
    else
      type_candidates="$(append_csv_unique "$type_candidates" "library")"
    fi
  fi

  if [[ -f "$repo_path/Dockerfile" ]]; then
    signal_csv="$(append_csv_unique "$signal_csv" "Dockerfile")"
    stack_csv="$(append_csv_unique "$stack_csv" "docker")"
  fi

  if [[ -d "$repo_path/apps" && -d "$repo_path/packages" ]]; then
    signal_csv="$(append_csv_unique "$signal_csv" "monorepo-layout")"
    stack_csv="$(append_csv_unique "$stack_csv" "monorepo")"
  fi

  if [[ "$type_candidates" == *"web-app"* && "$type_candidates" == *"api-service"* ]]; then
    detected_project_type="fullstack-app"
  elif [[ "$type_candidates" == *"web-app"* ]]; then
    detected_project_type="web-app"
  elif [[ "$type_candidates" == *"api-service"* ]]; then
    detected_project_type="api-service"
  elif [[ "$type_candidates" == *"cli"* ]]; then
    detected_project_type="cli"
  elif [[ "$type_candidates" == *"library"* ]]; then
    detected_project_type="library"
  elif [[ "$initial_repo_empty" -eq 1 ]]; then
    detected_project_type="greenfield"
  else
    detected_project_type="unknown"
  fi

  detected_project_stack="$stack_csv"
  detected_project_signals="$signal_csv"
}

write_project_profile_scaffold() {
  local generated_at="$1"
  local profile_json="$target_repo/config/cpdb/project-profile.json"
  local profile_doc="$target_repo/docs/cpb/PROJECT_PROFILE.md"
  local profile_brain="$target_repo/brains/team-brain/brain_v4/prefrontal/01_project-profile.md"
  local shared_render="false"
  local summary_render="$project_profile_summary"
  local stack_render="${detected_project_stack:-unknown}"
  local signals_render="${detected_project_signals:-none}"
  local json_stack=""
  local json_signals=""
  local item=""

  if [[ "$shared_repo" -eq 1 ]]; then
    shared_render="true"
  fi

  if [[ -z "$summary_render" ]]; then
    if [[ "$project_profile_type" == "greenfield" ]]; then
      summary_render="TODO: describe what this new project is meant to build and who it is for."
    else
      summary_render="TODO: replace this guessed scaffold summary with a project-specific description."
    fi
  fi

  if [[ -n "$detected_project_stack" ]]; then
    IFS=',' read -r -a stack_items <<< "$detected_project_stack"
    for item in "${stack_items[@]}"; do
      [[ -z "$item" ]] && continue
      if [[ -n "$json_stack" ]]; then
        json_stack+=", "
      fi
      json_stack+="\"$(json_escape "$item")\""
    done
  fi
  if [[ -z "$json_stack" ]]; then
    json_stack="\"unknown\""
  fi

  if [[ -n "$detected_project_signals" ]]; then
    IFS=',' read -r -a signal_items <<< "$detected_project_signals"
    for item in "${signal_items[@]}"; do
      [[ -z "$item" ]] && continue
      if [[ -n "$json_signals" ]]; then
        json_signals+=", "
      fi
      json_signals+="\"$(json_escape "$item")\""
    done
  fi

  if [[ ! -e "$profile_json" || "$force" -eq 1 ]]; then
    mkdir -p "$(dirname "$profile_json")"
    cat >"$profile_json" <<EOF
{
  "projectName": "$(json_escape "$(basename "$target_repo")")",
  "projectType": "$(json_escape "$project_profile_type")",
  "projectSummary": "$(json_escape "$summary_render")",
  "sharedRepo": $shared_render,
  "detectionMode": "$(json_escape "$project_profile_detection_mode")",
  "detectedSignals": [${json_signals}],
  "stack": [${json_stack}],
  "generatedAt": "$(json_escape "$generated_at")"
}
EOF
  fi

  if [[ ! -e "$profile_doc" || "$force" -eq 1 ]]; then
    mkdir -p "$(dirname "$profile_doc")"
    cat >"$profile_doc" <<EOF
# Project Profile

- Name: $(basename "$target_repo")
- Type: $project_profile_type
- Shared Repo: $shared_render
- Detection Mode: $project_profile_detection_mode
- Stack: $stack_render
- Signals: $signals_render
- Summary: $summary_render
- Generated At (UTC): $generated_at

## Next Curation Steps

- Replace any guessed fields with project-specific context after the first real task.
- Promote only stable shared rules into \`brains/team-brain/brain_v4\`.
- Keep private multi-device lessons in your personal repo when you do not want them committed into the project repo.
- Copy and edit \`config/cpdb/skill-role-map.example.json\` if you need project-specific skill-to-role mapping.
EOF
  fi

  if [[ ! -e "$profile_brain" || "$force" -eq 1 ]]; then
    mkdir -p "$(dirname "$profile_brain")"
    cat >"$profile_brain" <<EOF
# Project Profile

- This file is the initial CPB scaffold for repo-level context.
- Project: $(basename "$target_repo")
- Type: $project_profile_type
- Shared Repo: $shared_render
- Detection Mode: $project_profile_detection_mode
- Stack: $stack_render
- Signals: $signals_render
- Summary: $summary_render
- Generated At (UTC): $generated_at

## How To Use This

- Keep this file short and factual.
- Replace guessed context after the first meaningful implementation pass.
- Move durable shared rules into adjacent team-brain files as they become stable.
EOF
  fi
}

if repo_is_effectively_empty "$target_repo"; then
  initial_repo_empty=1
fi

detect_project_profile "$target_repo"
project_profile_type="$(sanitize_project_type "${project_type:-$detected_project_type}")"
project_profile_summary="$project_summary"

if [[ -n "$project_type" ]]; then
  project_profile_detection_mode="explicit"
fi

if can_prompt_tty; then
  if [[ -z "$project_type" ]]; then
    project_profile_type="$(sanitize_project_type "$(prompt_with_default "Project type" "$project_profile_type")")"
    if [[ "$project_profile_type" != "$detected_project_type" ]]; then
      project_profile_detection_mode="prompted"
    elif [[ "$project_profile_type" != "unknown" ]]; then
      project_profile_detection_mode="auto-confirmed"
    fi
  fi

  if [[ -z "$project_summary" ]]; then
    project_profile_summary="$(prompt_with_default "Short project summary (optional)" "$project_profile_summary")"
    if [[ -n "$project_profile_summary" ]]; then
      project_profile_detection_mode="prompted"
    fi
  fi

  if [[ "$shared_repo_explicit" -eq 0 ]]; then
    if prompt_yes_no "Is this a shared/team repo?" "n"; then
      shared_repo=1
    fi
  fi

  if [[ "$starter_skills_explicit" -eq 0 ]]; then
    suggested_starter_preset="$(default_starter_skill_preset "$project_profile_type")"
    if prompt_yes_no "Import curated starter skills (${suggested_starter_preset} preset)?" "n"; then
      starter_skill_import=1
    fi
  fi
fi

if [[ -z "$project_profile_summary" && "$initial_repo_empty" -eq 1 ]]; then
  project_profile_summary="TODO: define the initial product, users, and technical direction for this new repo."
fi

if [[ -z "$starter_skill_preset" ]]; then
  starter_skill_preset="$(default_starter_skill_preset "$project_profile_type")"
fi

write_hook() {
  local hook_name="$1"
  local hook_path="$target_repo/.githooks/$hook_name"
  mkdir -p "$(dirname "$hook_path")"
  if [[ "$hook_name" == "pre-push" ]]; then
    cat >"$hook_path" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
bash "$repo_root/scripts/cpb-sync-personal-repo.sh" || true
EOF
    chmod +x "$hook_path"
    return 0
  fi
  cat >"$hook_path" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
bash "$repo_root/scripts/cpb-refresh-after-git.sh"
EOF
  chmod +x "$hook_path"
}

ensure_brain_layout() {
  local brain_root="$1"
  mkdir -p \
    "$brain_root/brainstem" \
    "$brain_root/limbic" \
    "$brain_root/hippocampus" \
    "$brain_root/sensors" \
    "$brain_root/cortex" \
    "$brain_root/ego" \
    "$brain_root/prefrontal"
}

mkdir -p "$target_repo/bin" "$target_repo/scripts" "$target_repo/.githooks" "$target_repo/brains"

copy_file "$framework_root/bin/cpb" "$target_repo/bin/cpb"
copy_file "$framework_root/templates/cpb.env.example" "$target_repo/config/cpdb/cpb.env.example"

for source_path in "$framework_root"/scripts/cpb-* "$framework_root/scripts/project-brain-autoenv.bash" "$framework_root/scripts/setup-cpb-profile.sh"; do
  script_name="$(basename "$source_path")"
  copy_file "$framework_root/scripts/$script_name" "$target_repo/scripts/$script_name"
done

copy_file "$framework_root/templates/AGENTS.md" "$target_repo/AGENTS.md"
copy_file "$framework_root/templates/CLAUDE.md" "$target_repo/CLAUDE.md"

if [[ -f "$framework_root/templates/docs/career/README.md" ]]; then
  copy_file "$framework_root/templates/docs/career/README.md" "$target_repo/docs/career/README.md"
fi

if [[ -f "$framework_root/templates/brains/team-brain/brain_v4/README.md" ]]; then
  copy_file \
    "$framework_root/templates/brains/team-brain/brain_v4/README.md" \
    "$target_repo/brains/team-brain/brain_v4/README.md"
fi

copy_file \
  "$framework_root/templates/config/skill-role-map.example.json" \
  "$target_repo/config/cpdb/skill-role-map.example.json"

if [[ -n "$starter_skill_registry" ]]; then
  starter_skill_registry="$(expand_path "$starter_skill_registry")"
  copy_file "$starter_skill_registry" "$target_repo/config/cpdb/starter-skill-registry.json"
else
  copy_file "$framework_root/templates/config/starter-skill-registry.json" "$target_repo/config/cpdb/starter-skill-registry.json"
fi

ensure_brain_layout "$target_repo/brains/team-brain/brain_v4"
write_project_profile_scaffold "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

write_hook "post-merge"
write_hook "post-checkout"
write_hook "post-rewrite"
write_hook "pre-push"

if [[ -d "$target_repo/.git" ]]; then
  bash "$target_repo/scripts/cpb-setup-git-hooks.sh" \
    --repo-root "$target_repo" \
    --hooks-dir "$target_repo/.githooks" \
    --post-refresh-script "scripts/cpb-refresh-after-git.sh" \
    --pre-push-script "scripts/cpb-sync-personal-repo.sh"
fi

if [[ -n "$personal_repo" ]]; then
  personal_repo="$(expand_path "$personal_repo")"
  # shellcheck disable=SC1091
  source "$target_repo/scripts/cpb-paths.sh"
  operator_id="$(cpdb_detect_operator_id "$target_repo")"
  project_id="${CPB_PROJECT_ID:-$(basename "$target_repo")}"

  export CPB_PERSONAL_REPO="$personal_repo"
  export CPB_GLOBAL_BRAIN="$personal_repo/brains/global-operators/$operator_id/brain_v4"
  mkdir -p "$CPB_GLOBAL_BRAIN"

  if [[ "$shared_repo" -eq 1 ]]; then
    export CPB_PROJECT_BRAIN="$target_repo/.agent/cross-project-brain/$project_id/project-brain/brain_v4"
    mkdir -p "$CPB_PROJECT_BRAIN"
  fi
fi

if [[ "$install_neuronfs" -eq 1 ]]; then
  run_neuronfs_install() {
    CPB_REPO_ROOT="$target_repo" \
    CPB_NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
    NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
    bash "$target_repo/scripts/cpb-install-neuronfs.sh"
  }

  set +e
  run_neuronfs_install
  neuronfs_install_rc=$?
  set -e

  if [[ "$neuronfs_install_rc" -eq 2 ]]; then
    if ! command -v go >/dev/null 2>&1 && [[ "$auto_install_go" -eq 1 ]]; then
      if bash "$target_repo/scripts/cpb-install-go.sh"; then
        set +e
        run_neuronfs_install
        neuronfs_install_rc=$?
        set -e
      else
        printf 'Automatic Go install did not complete; continuing with degraded NeuronFS hook-only mode.\n'
      fi
    fi

    if [[ "$neuronfs_install_rc" -eq 2 ]]; then
      if command -v go >/dev/null 2>&1; then
        echo "NeuronFS CLI is still unavailable even though Go is installed." >&2
        exit 1
      fi

      if [[ "$auto_install_go" -eq 1 ]]; then
        printf 'Go is still not available and no prebuilt NeuronFS CLI was found; continuing with degraded NeuronFS hook-only mode (autogrowth disabled).\n'
      else
        printf 'Go auto-install was skipped and no prebuilt NeuronFS CLI was found; continuing with degraded NeuronFS hook-only mode (autogrowth disabled).\n'
      fi

      CPB_REPO_ROOT="$target_repo" \
      CPB_NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
      NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
      NEURONFS_ALLOW_HOOK_ONLY=1 \
      bash "$target_repo/scripts/cpb-install-neuronfs.sh"
    elif [[ "$neuronfs_install_rc" -ne 0 ]]; then
      exit "$neuronfs_install_rc"
    fi
  elif [[ "$neuronfs_install_rc" -ne 0 ]]; then
    exit "$neuronfs_install_rc"
  fi
fi

CPB_REPO_ROOT="$target_repo" \
CPB_NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
bash "$target_repo/scripts/cpb-rebuild-runtime-brain.sh" --init-global --init-project --init-device

if [[ "$setup_shell" -eq 1 ]]; then
  bash "$target_repo/scripts/cpb-setup-shell.sh" --repo-root "$target_repo"
fi

if [[ -n "$personal_repo" ]]; then
  personal_setup_args=("$personal_repo" "--repo-root" "$target_repo")
  if [[ "$shared_repo" -eq 1 ]]; then
    personal_setup_args+=("--shared-repo")
  fi
  bash "$target_repo/scripts/cpb-setup-personal-repo.sh" "${personal_setup_args[@]}"
fi

if [[ "$start_autogrowth" -eq 1 && -x "$target_repo/.tools/neuronfs/neuronfs" ]]; then
  CPB_REPO_ROOT="$target_repo" \
  CPB_NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
  NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
  bash "$target_repo/scripts/cpb-autogrowth.sh" start || true
fi

if [[ "$starter_skill_import" -eq 1 ]]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "node is required to import starter skills during install." >&2
    exit 1
  fi

  bash "$target_repo/scripts/cpb-import-starter-skills.sh" \
    --repo-root "$target_repo" \
    --preset "$starter_skill_preset"
fi

if command -v node >/dev/null 2>&1; then
  CPB_REPO_ROOT="$target_repo" \
  CPB_NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
  NEURONFS_INSTALL_DIR="$target_repo/.tools/neuronfs" \
  env -u NODE_OPTIONS node "$target_repo/scripts/cpb-finish-check.mjs" --init-baseline || true
fi

cat <<EOF
CPB bootstrap complete.

Target repo: $target_repo

Installed:
  - bin/cpb
  - scripts/cpb-*
  - AGENTS.md
  - CLAUDE.md
  - config/cpdb/cpb.env.example
  - config/cpdb/project-profile.json
  - config/cpdb/starter-skill-registry.json
  - docs/cpb/PROJECT_PROFILE.md
  - brains/team-brain/brain_v4
  - .githooks/*
EOF

if [[ -n "$personal_repo" ]]; then
  cat <<EOF

Personal repo wiring:
  - personal repo root: $personal_repo
  - shared/team repo mode: $shared_repo
  - project git pull -> personal repo pull + runtime rebuild
  - project git push -> personal repo commit/pull/push attempt
EOF
fi

cat <<EOF

Next steps:
  1. Open a new shell or run: source ~/.bashrc
  2. Run: cpb status
  3. Review docs/cpb/PROJECT_PROFILE.md and correct any guessed project context
  4. If you imported starter skills, review docs/cpb/THIRD_PARTY_NOTICES.md and .codex/skills/
  5. Open the repo and let your coding agent read AGENTS.md / CLAUDE.md
  6. Start working normally
EOF

if [[ -n "$personal_repo" ]]; then
  cat <<EOF
  7. Use normal git pull / git push in this project repo
     - pull will try to refresh your personal repo first
     - push will try to sync your personal repo before the project push
EOF
fi
