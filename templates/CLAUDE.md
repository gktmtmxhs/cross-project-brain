# CLAUDE.md

This repository uses the Cross-Project Brain harness.

## Cross-Project Brain Protocol

- Runtime rules come from `$CPB_RUNTIME_BRAIN`.
- Project-only lessons go to `brains/project-operators/<github-username>/brain_v4`. `CPB_OPERATOR` is usually your GitHub username.
- Cross-project lessons go to `$CPB_GLOBAL_BRAIN`. Use `--scope global`.
- Keep the same `CPB_OPERATOR` on every machine if you want shared operator capability. In practice, use your GitHub username.
- Log only durable lessons with short problem, root cause, fix, and evidence.
- Do not create hiring/career documents automatically. Generate them only when the user explicitly asks. By default, write drafts under `$CPB_CAREER_DOCS_ROOT/<role>/<language>/...`; if that env var is unset, fall back to `docs/career/operators/<github-username>/<role>/<language>/...`. Use `docs/career/shared/<language>/...` only for explicit shared/published versions.
- If you changed `docs/career/shared/<language>/...`, finish with `node scripts/cpb-finish-check.mjs --allow-shared-career-publish \"user explicitly requested shared publish\"` instead of a plain finish-check.
- Career/hiring docs are for external readers first. Rewrite project-internal feature names, variable names, table names, and infra nicknames into general technical language. Mention internal names only when they are truly needed, and then only once in parentheses or in an evidence section.
- Prefer role-aware logging: `node scripts/cpb-log-learning.mjs --skill <skill-name> [--surface <surface>] [--env <env>] --topic <topic> --lesson <lesson> --summary "..." --problem "..." --root-cause "..." --fix "..." --evidence "..." [--scope global]`.
- Keep lesson path slugs in English. Use `--audience` / `--language` for memory body language: shared/open-source lessons default to English, personal or hiring artifacts default to the user's preferred language.
- Before finishing after repo changes, run `node scripts/cpb-finish-check.mjs`.
- If no lesson is warranted, use `node scripts/cpb-finish-check.mjs --allow-no-lesson "reason"`.
