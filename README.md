# Cross-Project Brain

[한국어 README](./README.ko.md)

Cross-Project Brain is a memory framework for Codex and Claude Code.

Instead of forcing agents to reread long top-level docs every task, it stores durable lessons discovered during real work and makes them reusable in the next task and the next repo.

In one sentence:

- repo-specific context stays in `team` / `project brain`
- reusable cross-project lessons go to `global brain`
- machine-only quirks stay in `device brain`
- agents read the merged `runtime brain`

## What To Know First

- this repo is the reusable framework core that gets installed into other repositories
- `v1.0.0` is the first stable public contract for the framework core
- users keep working in the current project repo; CPB wires personal-repo and local-only state around it
- career docs are generated on demand, not on every task

## What It Solves

- reduces the need to re-explain the same context in the next task and the next repo
- carries lessons across desktop and laptop for the same person
- keeps shared rules and personal memory separate in team repos
- lets agents work from a runtime brain instead of rereading the full README every time

## Repos This Fits Best

- real product or service repos where Codex or Claude Code is used repeatedly
- repos where one person wants to carry problem-solving patterns into the next project
- shared repos that need a clean split between team rules and personal lessons
- setups that want to preserve ordinary `git pull` / `git push` day-to-day flow after install

## Quick Install

Run the install from the root of the repo you want to enable.

Published remote install:

```bash
tmpdir="$(mktemp -d)" && git clone --depth 1 https://github.com/<owner>/cross-project-brain.git "$tmpdir" && bash "$tmpdir/scripts/cpb-install.sh" --personal-repo "$HOME/.cpb-personal" --shared-repo && rm -rf "$tmpdir"
```

If you already have a local framework checkout:

```bash
bash /path/to/cross-project-brain/scripts/cpb-install.sh --personal-repo "$HOME/.cpb-personal" --shared-repo
```

First checks after install:

```bash
bash scripts/cpb-doctor.sh
cpb status
```

After setup, the intended daily flow is still normal `git pull` / `git push` in the current project repo.

For flags, generated files, and full install behavior, see [INSTALLATION.md](./INSTALLATION.md).

## How To Work With CPB

The normal usage pattern is:

1. install CPB in the current repo
2. let the agent read `AGENTS.md` or `CLAUDE.md`
3. give the agent a normal repo task prompt
4. if the task reveals a durable lesson, the agent logs it to the right brain layer
5. finish-check closes the task and the next task starts from the updated runtime brain

In practice, humans usually keep using normal repo workflows and normal prompts. Agents handle the low-level CPB scripts when they are needed.

Useful commands when you do want to inspect or trigger framework behavior directly:

- `cpb status`
- `cpb profiles`
- `cpb apply team-local`
- `cpb scaffold-design-system`
- `cpb import-starter-skills --preset web`
- `bash scripts/cpb-doctor.sh`

## Example Prompts

- `Summarize the current project structure and list the main subsystems.`
- `Implement <feature> and log any durable lesson if we discover one.`
- `Review this PR for regressions, risks, and missing tests. Findings first.`
- `Set this shared repo up so the project brain stays local-only but the global brain syncs through my private repo.`
- `Scaffold an initial design system for this repo and use DESIGN.md as the working contract.`
- `Generate a Korean project overview doc from the stored lessons for hiring use.`

## Core Concepts

- `team-brain`
  - reviewed shared rules for the current repo
- `global brain`
  - reusable lessons you want in future repos
- `project brain`
  - lessons that only make sense in this repo
- `device brain`
  - machine-specific quirks
- `runtime brain`
  - the merged live brain agents actually read

The important boundary is to keep shared rules, personal reusable memory, and machine-only state separate.

## Recommended Operating Model

In practice, the safest long-term shape is three layers:

1. current project repo
   - code
   - `brains/team-brain`
   - intentionally shared docs only
2. personal private GitHub repo
   - `global brain`
   - personal career docs
   - optionally a personal `project brain` overlay
3. local machine state
   - `device brain`
   - `runtime brain`
   - local-only `project brain` for shared repos

Recommended defaults:

- `CPB_OPERATOR`
  - usually your GitHub username
- personal private repo name
  - usually `<github-username>/cpb-personal`
- shared/team repo
  - prefer a local-only or personal-private-repo path for `project brain`
- solo repo
  - repo-tracked `project brain` is usually fine

## Major Features

- project-profile scaffolding
  - `config/cpdb/project-profile.json`
  - `docs/cpb/PROJECT_PROFILE.md`
- starter-skill import
  - pinned local registry
  - generates `skills.lock.json` and `skill-role-map.json`
- design-system scaffold
  - uses `DESIGN.md` as the fast working contract
  - uses `docs/arch/design-system.md` for deeper rationale and token reference
- NeuronFS prebuilt release flow
- finish-check workflow
- profile wrapper
  - `cpb profiles`
  - `cpb apply team-local`
  - `cpb apply team-personal`
- on-demand career docs
  - generated only when requested
  - default drafts stay operator-scoped

## Stability And Compatibility

`v1.0.0` is the first stable public contract for Cross-Project Brain.

Stable in `v1.0.0`:

- the install flow centered on `scripts/cpb-install.sh` and the public `cpb` CLI entrypoints
- the baseline generated repo contract: `AGENTS.md`, `CLAUDE.md`, `config/cpdb/*`, project-profile scaffolds, and `brains/team-brain/brain_v4`
- the memory split between `team`, `global`, `project`, `device`, and `runtime` brains
- the optional design-system scaffold built around `DESIGN.md`, `docs/arch/design-system.md`, and `config/cpdb/design-system.json`
- the starter-skill import lockfile and role-map flow
- the finish-check workflow

May still evolve without being treated as breaking:

- preset catalogs, starter registries, and template wording
- additional helper scripts, install prompts, and profile wrappers
- documentation depth, examples, and release note structure

Breaking changes to the stable surfaces above should ship only in a new major version.

## What The Install Creates

Main checked-in outputs:

- `AGENTS.md`
- `CLAUDE.md`
- `config/cpdb/*`
- `docs/cpb/PROJECT_PROFILE.md`
- `.githooks/*`
- `brains/team-brain/brain_v4`
- `scripts/cpb-*`

Main local-only paths:

- `.agent/cross-project-brain/<project-id>/device-brain/brain_v4`
- `.agent/cross-project-brain/<project-id>/runtime-brain/brain_v4`
- `.tools/neuronfs`

For the full file layout and generated artifacts, see [INSTALLATION.md](./INSTALLATION.md).

## What To Read In This README

If you just want the public overview, read these sections:

1. What It Solves
2. Quick Install
3. Core Concepts
4. Stability And Compatibility

Use the linked docs only when you need operational detail.

## Further Docs

- [INSTALLATION.md](./INSTALLATION.md)
  - install flags, installer behavior, generated files
- [HOW_IT_WORKS.md](./HOW_IT_WORKS.md)
  - framework mechanics, concepts, and default operating rules
- [PUBLIC_CORE_BOUNDARY.md](./PUBLIC_CORE_BOUNDARY.md)
  - what belongs in the public core and what stays out
- [ADAPTER_LINEAGE.md](./ADAPTER_LINEAGE.md)
  - which upstream patterns shaped the current adapter
- [FILESET.md](./FILESET.md)
  - file include/exclude rules when splitting the public repo
- [MIGRATION_MAP.md](./MIGRATION_MAP.md)
  - how project-specific names should be renamed into generic ones
- [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
  - upstream attribution and notice obligations
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
  - release-time checks before publishing

Templates and runnable assets live here:

- [`templates/`](./templates/)
  - `AGENTS.md`, `CLAUDE.md`, env examples, config examples
- [`scripts/`](./scripts/)
  - install, scaffold, logging, finish-check, and autogrowth helpers
- [`tests/`](./tests/)
  - public core script tests
