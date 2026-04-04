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
3. create baseline `brains/` directories
4. create `.githooks/` and point git to them
5. install NeuronFS under `.tools/neuronfs`
6. patch the NeuronFS hook for CPB selective injection
7. rebuild the first runtime brain
8. wire shell auto-env into `~/.bashrc`
9. start the local autogrowth worker when possible
10. initialize the first finish-check baseline

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
- where `team/global/project/device/runtime` brains currently live
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
   - `device-brain`
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

brains/
  team-brain/brain_v4/
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
  device-brain/brain_v4/
  runtime-brain/brain_v4/
  logs/
  state/

.tools/neuronfs/
```

## Important Flags

The bootstrap script should support these flags:

- `--target <path>`
  - install into a different repo instead of the current working directory
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
- `CPB_DEVICE_BRAIN`
- `CPB_RUNTIME_BRAIN`
- `CPB_CAREER_DOCS_ROOT`
- `CPB_SHARED_LANGUAGE`
- `CPB_PERSONAL_LANGUAGE`
- `CPB_HIRING_LANGUAGE`

## Notes

- The installer first tries to download a matching prebuilt `neuronfs` release asset for the current OS/arch.
- If no matching prebuilt is available and `go` is available, the installer builds the standalone `neuronfs` CLI locally.
- If `go` is missing, the public installer tries to install it automatically through a supported package manager (`apt-get`, `brew`, `dnf`, `yum`, `pacman`, `apk`, or `zypper`).
- If neither a prebuilt asset nor a usable local Go toolchain is available, the public installer falls back to degraded hook-only mode.
- Hook-only mode still supports context injection, runtime rebuilds, personal repo sync, and `cpb status/apply`.
- Full CPB autogrowth requires the standalone `neuronfs` binary. That now means either a published prebuilt NeuronFS CLI or a usable local Go toolchain.
- Prebuilt release assets are generated with `bash scripts/cpb-build-neuronfs-prebuilt.sh --goos <goos> --goarch <goarch>` and published under the tag `neuronfs-<neuronfs-ref>`.
- The public install flow should stay usable even if the consumer repo uses its own skill system, as long as `skill -> role` mapping is provided.
