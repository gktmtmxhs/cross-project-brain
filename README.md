# Cross-Project Brain

[한국어 README](./README.ko.md)

Cross-Project Brain is a framework for Codex and Claude Code that reduces repeated token waste, records reusable lessons agents learn while working, and helps users reuse those results for project understanding, problem-solving traceability, and interview preparation.

This repo is a reusable **framework core draft** that can be installed into other repositories.

## When This Is Especially Useful

### 1. When you want lessons from one project to carry into the next one

This is the core value of the framework.

- Durable lessons that are not tied to one repo can be stored in `global-operators/<github-username>`.
- When the same person starts a new project with the same GitHub username as `CPB_OPERATOR`, those lessons can be reused immediately.
- That means the next project does not start from zero.
- You carry forward problem-solving patterns and working judgment, not just code snippets.

In short:

- `project brain` = lessons that only make sense in this repo
- `global brain` = lessons you want to carry into future repos

### 2. When you want coding agents to improve over time

This framework is designed to reuse structured lessons instead of forcing agents to reread large top-level docs every task.

- Keep baseline rules thin.
- Log only durable, reusable lessons.
- Start the next task with an updated runtime brain.
- Generate career docs only on demand, not on every task.

### 3. When one person switches between desktop and laptop

This framework also helps when the same person works across multiple machines.

- If both machines use the same GitHub username as `CPB_OPERATOR`, `project-operators/<github-username>` and `global-operators/<github-username>` can move through git.
- In practice, the simplest stable value is usually your GitHub username.
- A lesson learned on the laptop can be pushed, pulled on the desktop, and reused there.
- Machine-specific quirks stay in `.agent/.../device-brain/brain_v4`, so they do not pollute shared or cross-project memory.
- Git hooks rebuild the runtime brain after pull, so the updated memory is available right away.

Typical personal usage:

1. Use the same `CPB_OPERATOR` on desktop and laptop. In practice this is usually your GitHub username.
2. Commit, push, and pull tracked brain changes the same way you move code.
3. Keep machine-only issues in `device-brain`.

### 4. When a team shares one project

Team usage can work well, but only if shared and personal memory are kept separate.

- Keep only reviewed, stable rules in `team-brain`.
- Let each contributor keep their own memory in `project-operators/<github-username>` and `global-operators/<github-username>`.
- Keep machine-only quirks in `device-brain`.
- Promote personal lessons into team rules only through review.

## Recommended Real-World Operating Model

The safest long-term setup usually splits CPB into three layers:

1. current project repo
   - code
   - `brains/team-brain`
   - only intentionally shared docs
2. your personal private GitHub repo
   - `global brain`
   - personal career docs
3. local machine state
   - `device brain`
   - `runtime brain`
   - optionally a local-only project brain

This gives you:

- cross-project learning that follows you
- desktop/laptop sync for the same person
- fewer collisions and less personal spillover in team repos

Typical settings:

- `CPB_OPERATOR`
  - your GitHub username
- your personal private GitHub repo name
  - usually `<github-username>/cpb-personal`
- `CPB_PERSONAL_REPO`
  - the root of your private GitHub repo checkout
- `CPB_GLOBAL_BRAIN`
  - a path inside your private GitHub repo checkout, such as `brains/global-operators/<github-username>/brain_v4`
- `CPB_PROJECT_BRAIN`
  - repo-tracked is fine for solo repos
  - for shared/team repos, prefer either a local-only path under `.agent/...` or a project-specific path inside your personal private repo when you want your own multi-device sync without polluting the team repo
- `CPB_CAREER_DOCS_ROOT`
  - `docs/career/operators/<github-username>` inside your private GitHub repo checkout

### What Lives Where

| Layer | What belongs there | How it syncs | Visible to teammates |
| --- | --- | --- | --- |
| Current project repo | code, `AGENTS.md`, `CLAUDE.md`, `scripts/cpb-*`, `.githooks`, `team-brain`, shared published docs | normal project `commit/push/pull` | yes |
| Your personal private GitHub repo | `global brain`, personal career docs, personal CPB assets, optionally a personal `project brain` overlay | private repo `commit/push/pull` | no, if kept private |
| Local-only state | `device brain`, `runtime brain`, optionally a local-only `project brain` | no git sync | no |

In short:

- the project repo shares the **CPB skeleton and shared rules**
- the personal private repo keeps **your reusable memory and study docs**
- the local-only area keeps **machine-specific and runtime-only state**

Important:

- in solo repos, a repo-tracked `project brain` is usually fine
- in shared/team repos, a local-only `project brain` is usually safer
- if one person wants project-specific learning to follow them across desktop/laptop without landing in the team repo, a personal-private-repo `project brain` is also a valid mode
- that separation is what lets CPB help one person across projects without polluting a team repo

## Quick Install

The intended install flow is **one command from the root of the repo you want to enable**.

For published remote installation:

```bash
tmpdir="$(mktemp -d)" && git clone --depth 1 https://github.com/<owner>/cross-project-brain.git "$tmpdir" && bash "$tmpdir/scripts/cpb-install.sh" --personal-repo "$HOME/.cpb-personal" --shared-repo && rm -rf "$tmpdir"
```

If you already have a local checkout of the framework:

```bash
bash /path/to/cross-project-brain/scripts/cpb-install.sh --personal-repo "$HOME/.cpb-personal" --shared-repo
```

The installer is designed to set up, in one pass:

- public helper scripts
- `AGENTS.md` and `CLAUDE.md`
- baseline `brains/` layout
- `.githooks/`
- shell auto-env
- NeuronFS install and hook patch
- first runtime brain rebuild

The installer now prefers a prebuilt `neuronfs` release asset for the current OS/arch. If a matching prebuilt asset is not available, it then tries to install `go` automatically through a supported package manager (`apt-get`, `brew`, `dnf`, `yum`, `pacman`, `apk`, or `zypper`) and builds the CLI locally. If both paths are unavailable, the installer still completes in degraded hook-only mode. That keeps context injection, sync, and runtime rebuilds working, but full CPB autogrowth still requires the standalone `neuronfs` CLI binary.

When a prebuilt asset is used, the installer also downloads the matching `.sha256` file and verifies the archive before extracting it. If the checksum file is missing or invalid, CPB falls back to the local Go build path instead of trusting the archive blindly.

Prebuilt release assets use this naming scheme:

```text
neuronfs-<neuronfs-ref>-<goos>-<goarch>.tar.gz
```

If you are publishing a CPB release, generate them with:

```bash
bash scripts/cpb-build-neuronfs-prebuilt.sh --goos linux --goarch amd64
```

To publish the whole release matrix under the right tag in one pass:

```bash
bash scripts/cpb-publish-neuronfs-release.sh
```

If you pass `--personal-repo`, the installer also assumes a recommended GitHub private repo name of `<github-username>/cpb-personal` and:

- checks whether that repo exists when `gh` auth is available
- tries to connect the local personal repo `origin` automatically when the repo already exists
- explains the repo name and purpose first, then asks before running `gh repo create ... --private` when it is missing
- in non-interactive mode or without `gh` auth, prints guidance instead of creating anything

If you pass `--personal-repo ... --shared-repo` in that one-line install, the private-repo wiring is done immediately.

## How Sync Works

This is the core day-to-day behavior:

1. You work in the current project repo as usual.
2. When you run `git push` in the project repo, CPB first tries to sync your personal private brain repo.
3. When you run `git pull` in the project repo, CPB first tries to pull your personal private brain repo.
4. After that pull-side refresh, CPB rebuilds the runtime brain so the updated learning is available immediately.

In other words:

- your **project repo** is still the repo you touch every day
- your **personal private brain repo** is the sync hub for your reusable learning
- git hooks glue the two together so desktop/laptop sync happens during normal project `git pull` / `git push`

The hooks are wired like this:

- `pre-push`
  - tries to `commit/pull/push` your personal private repo first
  - then continues the current project push
- `post-merge`, `post-checkout`, `post-rewrite`
  - try to pull your personal private repo first
  - then rebuild the runtime brain

When the install finishes, the first check should usually be:

```bash
bash scripts/cpb-doctor.sh
```

After that, the intended day-to-day flow is still just normal git usage in the current project repo:

- `git pull`
  - tries to pull your personal private repo first
  - then rebuilds the runtime brain
- `git push`
  - tries to commit/pull/push your personal private repo first
  - then continues with the current project push

In practice, that means after initial setup you usually just keep using normal `git pull` / `git push` in the project repo.

For real desktop/laptop sync, your personal private repo still needs a git remote upstream.

## Profile-Based Setup Wrapper

The public CPB core still ships the low-level building blocks:

- `cpb-install.sh`
- `cpb-setup-personal-repo.sh`
- `cpb-setup-git-hooks.sh`
- `cpb-setup-shell.sh`
- `cpb-doctor.sh`

It now also ships one generic profile wrapper:

- `setup-cpb-profile.sh`

That wrapper covers the common real-world deployment shapes:

- shared team repo + local-only project brain
- shared team repo + personal multi-device project brain
- solo repo + tracked project brain
- solo repo + personal multi-device project brain

Built-in profiles:

- `team-local`
- `team-personal`
- `solo-tracked`
- `solo-personal`

After `bash scripts/cpb-setup-shell.sh` and `source ~/.bashrc`, the preferred interface is:

```bash
cpb profiles
cpb status
cpb apply team-local
cpb apply team-personal
```

Fallback commands still work:

```bash
bash scripts/setup-cpb-profile.sh status
```

Consumer repos can still add a thin alias on top if they want shorter product-specific commands, but the public CPB core now exposes `cpb ...` directly once shell setup is installed.

## What Gets Created After Install

After installation, a consumer repo usually gets this structure.

### Checked-in files

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
- if you used `--personal-repo`, `global-operators/<github-username>` usually lives in your personal private repo instead.
- if you used `--shared-repo`, `project-operators/<github-username>` is usually redirected into local `.agent/...` state instead.

What they do:

- `AGENTS.md`, `CLAUDE.md`
  - thin instructions that tell agents how to use the brain
- `brains/team-brain/brain_v4`
  - stable team rules reviewed by humans
- `brains/project-operators/<github-username>/brain_v4`
  - project-specific lessons that should travel with the repo
- `brains/global-operators/<github-username>/brain_v4`
  - cross-project lessons that you want to reuse elsewhere
- `.githooks/*`
  - refresh runtime brain after pull, rebase, or branch switch
  - `pre-push` also tries to sync your personal private repo first
- `scripts/*`
  - public helper scripts for install, rebuild, logging, finish-check, and autogrowth
  - including `cpb-setup-personal-repo.sh` for private-repo wiring
  - `cpb-doctor.sh` shows whether the current wiring is actually ready

### Local-only files

These are machine-local or local tool-install outputs.

```text
.agent/cross-project-brain/<project-id>/
  device-brain/brain_v4/
  runtime-brain/brain_v4/

.tools/neuronfs/
```

What they do:

- `device-brain/brain_v4`
  - lessons that only matter on this machine
- `runtime-brain/brain_v4`
  - the merged live brain that agents actually read during work
- `.tools/neuronfs`
  - local NeuronFS CLI and the patched runtime hook

### User-facing learning docs

These docs are not generated on every task. The agent creates them only when the user asks for them, using stored lessons and current project context.

```text
docs/career/operators/<github-username>/<role>/<language>/
  interview-answers.md
  star-examples.md
  portfolio-projects.md
  resume-lines.md

docs/career/shared/<language>/
  project-overview.md
  architecture-decisions.md
  problem-solving-index.md
```

These are typically used for:

- project understanding
  - `project-overview.md`
  - `architecture-decisions.md`
- problem-solving study notes
  - `problem-solving-index.md`
- interview and career preparation
  - `interview-answers.md`
  - `star-examples.md`
  - `portfolio-projects.md`
  - `resume-lines.md`

Typical requests look like:

- `summarize frontend interview prep docs`
- `write backend resume lines in English`
- `create a project overview doc`
- `explain architecture decisions in Korean`

When asked, the agent usually:

1. reads the relevant role lessons and current project docs
2. chooses the right document kind for the request
3. chooses the requested language path
4. updates the stable file under `operators/<github-username>/...` if it already exists, or creates it if it does not
5. promotes into `shared/...` only when the user explicitly asks for a shared version

The default `operators/<github-username>/...` path exists to reduce collisions when multiple people generate career docs inside the same repository.
If `shared/...` changes, finish-check should also include explicit shared-publish approval.

If you do not want personal study docs mixed into a team repo:

- set `CPB_CAREER_DOCS_ROOT` to a path inside your personal private GitHub repo checkout
- keep generated drafts there
- only publish into the current repo when you explicitly want a shared version

These are meant to be user-facing explanation and study docs, not background runtime memory.

Important writing rule:

- Career docs should not blindly copy project-internal feature names, variable names, table names, or infra nicknames.
- They should explain the problem in general technical language first.
- If an internal label matters for traceability, mention it only once in parentheses or in the evidence section.

## How Those Files Are Used During Work

The normal workflow is:

1. The user gives a normal task.
2. The agent reads `AGENTS.md` or `CLAUDE.md`.
3. Shell auto-env points the agent to `runtime-brain/brain_v4`.
4. The agent solves the task.
5. If a reusable lesson appears, it gets logged into:
   - project brain
   - global brain
   - or device brain
6. The runtime brain is rebuilt.
7. The next task starts with the updated brain.

In short:

- checked-in brains hold long-lived shared knowledge
- local brains hold machine-specific or merged runtime state
- career docs are generated only on demand

## How Career Docs Are Organized

Career docs are split by these dimensions, but by default they are written into operator-scoped draft paths:

- `role`
  - `frontend`, `backend`, `design`, `platform`, `security`, `testing`, `shared`
- `language`
  - usually `ko` or `en`
- `document kind`
  - `interview-answers.md`
  - `star-examples.md`
  - `portfolio-projects.md`
  - `resume-lines.md`

Examples:

- `docs/career/operators/<github-username>/frontend/ko/interview-answers.md`
- `docs/career/operators/<github-username>/backend/en/resume-lines.md`
- `docs/career/operators/<github-username>/platform/ko/star-examples.md`
- `docs/career/shared/ko/project-overview.md`

Default file strategy:

- do not create a new dated file for every task
- keep one stable file per role/language/document kind
- add or update sections inside that file
- only promote very large cases into `cases/<slug>.md`
- keep draft docs operator-scoped by default to reduce team overwrite risk

### How language is chosen

Career docs are generated on demand.

- if the user explicitly asks for Korean, write by default into `docs/career/operators/<github-username>/<role>/ko/...`
- if the user explicitly asks for English, write by default into `docs/career/operators/<github-username>/<role>/en/...`
- if the user does not specify a language, use the user's preferred language

Only write into `docs/career/shared/<language>/...` when the user explicitly asks to publish or promote a shared version.
In that case, run finish-check with `--allow-shared-career-publish`.

The important split is:

- lesson paths stay English
- the human-facing career document body uses the requested language

## Where To Go Next

Use this file as the main usage README. Use the docs below only when you need more detail.

- [INSTALLATION.md](./INSTALLATION.md)
  - detailed install behavior, flags, and what the bootstrap script changes
- [HOW_IT_WORKS.md](./HOW_IT_WORKS.md)
  - framework mechanics, core concepts, and default operating rules
- [PUBLIC_CORE_BOUNDARY.md](./PUBLIC_CORE_BOUNDARY.md)
  - what belongs in the public core and what must stay out
- [ADAPTER_LINEAGE.md](./ADAPTER_LINEAGE.md)
  - which upstream skill patterns shaped the current adapter
- [FILESET.md](./FILESET.md)
  - what should be included or excluded when splitting this into a public repo
- [MIGRATION_MAP.md](./MIGRATION_MAP.md)
  - how project-specific names, paths, and prefixes should be renamed into generic ones
- [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
  - upstream lineage and attribution obligations for NeuronFS, agency-agents, and ui-ux-pro-max-skill
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
  - pre-release checklist before publishing the framework

Templates and runnable assets live here:

- [`templates/`](./templates/)
  - starter `AGENTS.md`, `CLAUDE.md`, env examples, and config examples
- [`scripts/`](./scripts/)
  - generic framework helper scripts
- [`tests/`](./tests/)
  - tests for the public core scripts

Quick map:

- install details -> `INSTALLATION.md`
- framework mechanics -> `HOW_IT_WORKS.md`
- public-core boundary -> `PUBLIC_CORE_BOUNDARY.md`
- adapter lineage -> `ADAPTER_LINEAGE.md`
- usage -> `README.md` / `README.ko.md`
- what to copy -> `FILESET.md`
- how to rename -> `MIGRATION_MAP.md`
- how to attribute -> `THIRD_PARTY_NOTICES.md`
- how to ship -> `RELEASE_CHECKLIST.md`
