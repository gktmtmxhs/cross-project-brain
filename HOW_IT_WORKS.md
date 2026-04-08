# HOW IT WORKS

## What This Framework Actually Combines

This framework is not a new model and not a standalone memory engine. It is an integration layer around:

1. **NeuronFS**
   - filesystem-native rule memory and hook target
2. **thin agent shims**
   - `AGENTS.md` and `CLAUDE.md` as small execution protocols
3. **autonomous lesson logging**
   - role-aware logging scripts and inbox processing
4. **finish guards**
   - prevent clean task completion when reusable lessons were skipped
5. **runtime brain rebuilds**
   - merge team, project, and global layers into live context
6. **selective injection**
   - prioritize the most relevant role-aware context instead of dumping large prompt blobs

## Core Concepts

- `AGENTS.md`
  - thin execution protocol for Codex-like agents
- `CLAUDE.md`
  - thin execution protocol for Claude Code-like agents
- `Team Brain`
  - reviewed baseline rules shared by the team
- `Project Operator Brain`
  - lessons that belong to the current repo
- `Cross-Project Brain`
  - lessons that should be reusable in other repos
- `Runtime Brain`
  - the merged live brain that agents actually read
- `skill`
  - execution playbook
- `role/topic/surface/env`
  - storage taxonomy for lessons
- `audience/language`
  - language policy for human-facing memory bodies and generated docs

## Recommended Default Policy

- keep path slugs in English
- keep shared/open-source lessons in English by default
- keep personal or hiring-oriented artifacts in the user's preferred language
- review team rules before promoting them
- allow project/global lessons to grow automatically
- generate career docs on demand, not after every task
- prefer stable files over dated files for career outputs

## Suggested Repo Layout

```text
brains/
  team-brain/brain_v4
  project-operators/<operator-id>/brain_v4
  global-operators/<operator-id>/brain_v4

.agent/cross-project-brain/<project-id>/
  runtime-brain/brain_v4
```
