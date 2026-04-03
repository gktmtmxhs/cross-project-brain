# FILESET

This file defines what should move into the open-source core repo and what should stay in the product repo.

## Include In Open-Source Core

Scripts:

- `scripts/cpb-install.sh`
- `scripts/cpb-install-neuronfs.sh`
- `scripts/cpb-doctor.sh`
- `scripts/cpb-rebuild-runtime-brain.sh`
- `scripts/cpb-refresh-after-git.sh`
- `scripts/cpb-setup-shell.sh`
- `scripts/cpb-setup-git-hooks.sh`
- `scripts/cpb-log-learning.mjs`
- `scripts/cpb-autogrowth.mjs`
- `scripts/cpb-autogrowth.sh`
- `scripts/cpb-finish-check.mjs`
- `scripts/cpb-selective-injection.cjs`
- `scripts/cpb-patch-neuronfs-hook.mjs`
- `scripts/cpb-role-taxonomy.mjs`
- `scripts/cpb-paths.mjs`
- `scripts/cpb-paths.sh`
- `scripts/project-brain-autoenv.bash`

Tests:

- `tests/cpb-doctor.test.mjs`
- `tests/cpb-log-learning.test.mjs`

Docs:

- `README.md`
- `README.ko.md`
- `INSTALLATION.md`
- `HOW_IT_WORKS.md`
- `PUBLIC_CORE_BOUNDARY.md`
- `ADAPTER_LINEAGE.md`
- `THIRD_PARTY_NOTICES.md`
- `RELEASE_CHECKLIST.md`
- `FILESET.md`
- `MIGRATION_MAP.md`

Templates:

- `templates/AGENTS.md`
- `templates/CLAUDE.md`
- `templates/config/skill-role-map.example.json`
- `templates/cpdb.env.example`
- `templates/docs/career/README.md`
- `templates/brains/team-brain/brain_v4/README.md`

## Exclude From Open-Source Core

- product app code
- current project `AGENTS.md` business details
- current project `.codex/skills/muinone-*`
- tracked learned lesson contents under:
  - `tools/neuronfs-pilot/operators/`
  - `tools/neuronfs-pilot/global-operators/`
- `.agent/`
- `.tools/`
- any company-specific docs or policies

## Keep In Product Repo As Adapter Layer

- product-specific `AGENTS.md` wording
- product-specific skill names
- product-specific docs
- product-specific baseline team rules
- product-specific examples
