# Career Docs Workspace

This folder is for user-facing career documents that are generated only on demand.

Core rules:

- This is not the runtime brain.
- Keep technical lessons in the brain during normal work.
- Generate career docs only when the user explicitly asks.
- Write drafts into `$CPB_CAREER_DOCS_ROOT/...` when that env var is set.
- Otherwise write drafts into operator-scoped paths inside the current repo.
- Publish into `docs/career/shared/...` only when the user explicitly asks for a shared version.

Recommended layout:

```text
docs/career/
  operators/
    <github-username>/
      shared/
        ko/
        en/
      frontend/
        ko/
        en/
      backend/
        ko/
        en/
      design/
        ko/
        en/
      platform/
        ko/
        en/
      security/
        ko/
        en/
      testing/
        ko/
        en/
  shared/
    ko/
    en/
```

Use it like this:

- `operators/<github-username>/...`
  - personal draft output inside the current repo
- `operators/<github-username>/shared/...`
  - draft versions of project overview, architecture decisions, and problem-solving index
- `shared/...`
  - promoted shared versions for teammates or external readers

Recommended real-world setup:

- Solo repo
  - repo-local `docs/career/operators/<github-username>/...` is fine
- Shared/team repo
  - set `CPB_CAREER_DOCS_ROOT` to a path inside your personal private CPB repo checkout
  - keep `shared/...` in the team repo only for documents you explicitly publish

Recommended file names:

- `interview-answers.md`
- `star-examples.md`
- `portfolio-projects.md`
- `resume-lines.md`
- `project-overview.md`
- `architecture-decisions.md`
- `problem-solving-index.md`

Writing rule:

- Career docs should translate internal project labels into general technical language.
- Mention internal feature names or infra nicknames only when they are needed for traceability.
