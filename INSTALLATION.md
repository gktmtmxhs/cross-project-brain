# INSTALLATION

## Goal

Install the Cross-Project Brain into an existing repository with one command, then keep the repo in a usable state with minimal manual setup.

## Intended Install Style

Run from the root of the repository you want to enable.

Published remote install:

```bash
tmpdir="$(mktemp -d)" && git clone --depth 1 https://github.com/<owner>/cross-project-brain.git "$tmpdir" && bash "$tmpdir/scripts/cpb-install.sh" --personal-repo "$HOME/.cpb-personal" --shared-repo && rm -rf "$tmpdir"
```

Local framework checkout:

```bash
bash /path/to/cross-project-brain/scripts/cpb-install.sh --personal-repo "$HOME/.cpb-personal" --shared-repo
```

Advanced stdin/bootstrap mode:

```bash
CPB_FRAMEWORK_REPO_URL=https://github.com/<owner>/cross-project-brain.git \
bash <(curl -fsSL https://raw.githubusercontent.com/<owner>/cross-project-brain/main/scripts/cpb-install.sh)
```

## What The Installer Does

The bootstrap script is intended to do these steps in order:

1. copy public core scripts into the target repo
2. add thin `AGENTS.md` and `CLAUDE.md` shims
3. detect or ask for a basic project profile
4. create baseline `brains/` directories
5. write initial project profile scaffold files
6. optionally import curated starter skills from pinned upstream repos
7. optionally scaffold an initial design system
8. create `.githooks/` and point git to them
9. install NeuronFS under `.tools/neuronfs`
10. patch the NeuronFS hook for CPB selective injection
11. rebuild the first runtime brain
12. wire shell auto-env into `~/.bashrc`
13. start the local autogrowth worker when possible
14. initialize the first finish-check baseline

The project profile step is intentionally lightweight. It does not try to fully model the product or replace human project curation. Instead, it gives CPB a first-pass scaffold based on common repo signals and any explicit installer inputs you provide.

Auto-detection currently looks at signals such as:

- `package.json`, `tsconfig.json`, `vite.config.*`, `next.config.*`
- `pom.xml`, `build.gradle`, `build.gradle.kts`, `gradlew`
- `go.mod`
- `pyproject.toml`, `requirements.txt`
- `Cargo.toml`
- `Dockerfile`
- `apps/` + `packages/` monorepo layout

If the installer is running in an interactive TTY and you did not provide overrides, it can prompt for:

- project type
- short project summary
- whether the repo should be treated as shared/team-oriented
- whether CPB should scaffold an initial design system for `web-app`, `fullstack-app`, or `greenfield` repos

If the target repo is effectively empty, CPB scaffolds it as `greenfield` and writes TODO placeholders instead of pretending the repo already contains enough context.

Starter-skill import is separate from project profile scaffolding. When enabled, the installer uses a pinned local registry to clone allowlisted upstream skill repos, vendor the selected files into the consumer repo, create managed wrappers under `.codex/skills/`, write a generated `skill-role-map.json`, record the exact import in `skills.lock.json`, and regenerate `docs/cpb/THIRD_PARTY_NOTICES.md`.

Initial design-system scaffolding is also intentionally lightweight. It uses the detected project profile plus a small preset catalog to generate a machine-readable `config/cpdb/design-system.json`, two Markdown review docs, and a short team-brain seed. It is meant to give agents and humans a shared starting point, not to lock the product into a final brand direction.

## After The One-Line Install

If you included `--personal-repo ... --shared-repo`, the usual desktop/laptop + shared-repo setup is already wired:

- `global brain` points at your personal private repo
- personal career docs point at your personal private repo
- `project brain` stays local-only under `.agent/...` for the current shared/team repo

From that point on, the intended daily workflow is:

- use normal `git pull` in the current project repo
  - CPB will try to pull your personal repo first
  - then rebuild the runtime brain
- use normal `git push` in the current project repo
  - CPB will try to commit/pull/push your personal repo first
  - then continue the project push

For real desktop/laptop sync, the personal repo still needs a git remote upstream.

The mental model should stay simple:

- you keep working in the current project repo
- CPB uses your personal private repo as the learning-sync hub
- git hooks make that sync happen during normal project `git pull` / `git push`

Hook behavior:

- `pre-push`
  - personal repo `commit/pull/push`
  - then project push
- `post-merge`, `post-checkout`, `post-rewrite`
  - personal repo `pull`
  - then runtime brain rebuild

If you skipped `--personal-repo` during install, you can still wire it later:

```bash
bash scripts/cpb-setup-personal-repo.sh "$HOME/.cpb-personal" --shared-repo
```

The first verification after install should usually be:

```bash
bash scripts/cpb-doctor.sh
```

It shows:

- which GitHub username CPB resolved as your identity
- whether `gh auth` is ready
- whether your personal private repo is configured and has an upstream
- whether git hooks are pinned
- where `team/global/project/runtime` brains currently live
- whether NeuronFS is installed

## Profile-Based Setup Wrapper

The public CPB core still exposes the low-level primitives directly, and now also ships a generic profile wrapper for common environment shapes.

Supported profiles:

- shared/team repo with local-only `project brain`
- shared/team repo with personal-private-repo `project brain`
- solo repo with tracked `project brain`
- solo repo with personal-private-repo `project brain`

Preferred interface after shell setup:

```bash
cpb profiles
cpb status
cpb apply team-local
cpb apply team-personal
cpb apply solo-tracked
cpb apply solo-personal
```

Fallback commands such as `bash scripts/setup-cpb-profile.sh status` still work. Consumer repos can still add a thinner alias if they want shorter product-specific commands, but the public-core wrapper is enough for first-run setup and state checks on its own.

## Starter Skill Import

The public core keeps starter-skill import opt-in on purpose.

Recommended manual import after install:

```bash
bash scripts/cpb-import-starter-skills.sh --preset web
```

The default registry is copied to:

```text
config/cpdb/starter-skill-registry.json
```

That registry records:

- upstream repo URL
- pinned ref
- allowlisted license
- imported source paths
- local skill names, aliases, and roles

Generated artifacts after import:

```text
.codex/
  skills/
  vendor-skills/

config/
  cpdb/
    skill-role-map.json
    skills.lock.json

docs/
  cpb/
    THIRD_PARTY_NOTICES.md
```

The same command also works inside the public framework repo itself because the CLI falls back to `templates/config/starter-skill-registry.json` when the consumer-specific registry has not been copied into `config/cpdb/` yet.

## Initial Design-System Scaffold

You can opt into an initial design-system scaffold during install:

```bash
bash scripts/cpb-install.sh --scaffold-design-system
```

Or generate it later:

```bash
cpb scaffold-design-system
cpb scaffold-design-system --style product-ui --primary "#0F766E" --force
```

Generated artifacts:

```text
config/
  cpdb/
    design-system.json

docs/
  design-system.md
  ui-specs/
    foundations.md

brains/
  team-brain/
    brain_v4/
      cortex/
        02_design-system.md
```

This scaffold derives from the project profile and a preset catalog:

- `product-ui`
- `console`
- `editorial`
- `concept-starter`

Use the generated JSON as the machine-readable source for tools and future codegen. Use the Markdown files for review, edits, and product/design discussion.

## Recommended Real-World Layout

For real usage, especially when you move between machines or work in team repos, the safest layout is:

1. current project repo
   - code
   - `brains/team-brain`
   - optional shared published docs
2. personal private CPB repo
   - `brains/global-operators/<github-username>`
   - personal career docs
3. local-only agent state
   - `runtime-brain`
   - optional local-only project brain for shared/team repos

In practice, that usually means:

- set `CPB_OPERATOR` to your GitHub username
- use a personal private GitHub repo named `<github-username>/cpb-personal`
- set `CPB_PERSONAL_REPO` to a checked-out path inside your private GitHub repo
- set `CPB_GLOBAL_BRAIN` to a checked-out path inside your personal private GitHub repo
- for shared/team repos, consider setting `CPB_PROJECT_BRAIN` either to a local-only path under `.agent/...` or to a project-specific path inside your personal private repo if you want your own multi-device sync without pushing project-specific lessons into the team repo
- set `CPB_CAREER_DOCS_ROOT` to your personal private GitHub repo if you want versioned career docs without mixing them into the team repo

## Files The Installer Creates In A Consumer Repo

Checked-in:

```text
AGENTS.md
CLAUDE.md

config/
  cpdb/
    cpb.env.example
    project-profile.json
    starter-skill-registry.json
    skill-role-map.example.json
    skill-role-map.json
    skills.lock.json

docs/
  cpb/
    PROJECT_PROFILE.md
    THIRD_PARTY_NOTICES.md

.codex/
  skills/
  vendor-skills/

brains/
  team-brain/brain_v4/
    prefrontal/01_project-profile.md
  project-operators/<github-username>/brain_v4/
  global-operators/<github-username>/brain_v4/

.githooks/
  post-merge
  post-checkout
  post-rewrite
  pre-push

scripts/
  cpb-*.mjs
  cpb-*.sh
  cpb-*.cjs
  project-brain-autoenv.bash
```

Important:

- `team-brain` stays in the current project repo.
- if you use `--personal-repo`, `global-operators/<github-username>` usually lives in your personal private repo instead.
- if you use `--shared-repo`, `project-operators/<github-username>` usually lives in local `.agent/...` state instead.

Local-only:

```text
.agent/cross-project-brain/<project-id>/
  runtime-brain/brain_v4/
  logs/
  state/

.tools/neuronfs/
```

## Important Flags

The bootstrap script should support these flags:

- `--target <path>`
  - install into a different repo instead of the current working directory
- `--personal-repo <path>`
  - wire a personal private CPB repo during install
- `--shared-repo`
  - treat the repo as a shared/team repo during first-run scaffold and personal-brain setup
- `--project-type <type>`
  - force the first project profile type instead of using the detected guess
- `--project-summary <text>`
  - seed the first project summary instead of using a detected or TODO scaffold
- `--with-starter-skills`
  - import a curated starter-skill preset during install
- `--starter-skill-preset <name>`
  - choose the starter-skill preset to import
- `--starter-skill-registry <path>`
  - replace the default pinned starter-skill registry with a local registry file
- `--scaffold-design-system`
  - generate a first-pass design-system scaffold during install
- `--non-interactive`
  - skip installer prompts and keep the generated profile fully scripted
- `--force`
  - overwrite starter files that already exist
- `--no-shell`
  - do not modify `~/.bashrc`
- `--no-neuronfs`
  - skip NeuronFS installation
- `--no-autogrowth`
  - skip autogrowth worker startup

## Personal Repo Naming Convention

The recommended GitHub private repo name is:

- `<github-username>/cpb-personal`

When `--personal-repo` is used:

- the setup step checks for that repo when `gh` auth is available
- if it exists, the local personal repo tries to attach `origin`
- if it does not exist, the script explains the repo purpose and asks before creating it
- in non-interactive mode or without `gh` auth, it only prints guidance

## Generic Env Prefix

Use neutral names in the public version:

- `CPB_REPO_ROOT`
- `CPB_OPERATOR`
- `CPB_PERSONAL_REPO`
- `CPB_AGENT_ROOT`
- `CPB_NEURONFS_INSTALL_DIR`
- `CPB_GLOBAL_BRAIN`
- `CPB_TEAM_BRAIN`
- `CPB_PROJECT_BRAIN`
- `CPB_RUNTIME_BRAIN`
- `CPB_CAREER_DOCS_ROOT`
- `CPB_SHARED_LANGUAGE`
- `CPB_PERSONAL_LANGUAGE`
- `CPB_HIRING_LANGUAGE`

## Notes

- The installer first tries to download a matching prebuilt `neuronfs` release asset for the current OS/arch.
- When a prebuilt asset is used, the installer verifies it against the matching `.sha256` release asset before extracting it.
- If no matching prebuilt is available and `go` is available, the installer builds the standalone `neuronfs` CLI locally.
- If `go` is missing, the public installer tries to install it automatically through a supported package manager (`apt-get`, `brew`, `dnf`, `yum`, `pacman`, `apk`, or `zypper`).
- If neither a prebuilt asset nor a usable local Go toolchain is available, the public installer falls back to degraded hook-only mode.
- Hook-only mode still supports context injection, runtime rebuilds, personal repo sync, and `cpb status/apply`.
- Full CPB autogrowth requires the standalone `neuronfs` binary. That now means either a published prebuilt NeuronFS CLI or a usable local Go toolchain.
- Prebuilt release assets are generated with `bash scripts/cpb-build-neuronfs-prebuilt.sh --goos <goos> --goarch <goarch>` and published under the tag `neuronfs-<neuronfs-ref>`.
- The full tagged release can be published with `bash scripts/cpb-publish-neuronfs-release.sh`.
- The public install flow should stay usable even if the consumer repo uses its own skill system, as long as `skill -> role` mapping is provided.
