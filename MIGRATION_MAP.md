# MIGRATION MAP

Map product-specific names to generic open-source names before publishing.

## Env Vars

Replace your legacy product-specific prefix with the CPB prefix.
Examples:

- `LEGACY_NEURONFS_REPO_ROOT` -> `CPB_REPO_ROOT`
- `LEGACY_NEURONFS_OPERATOR` -> `CPB_OPERATOR`
- `LEGACY_NEURONFS_OPERATOR_ID` -> `CPB_OPERATOR_ID`
- `LEGACY_NEURONFS_AGENT_ROOT` -> `CPB_AGENT_ROOT`
- `LEGACY_NEURONFS_GLOBAL_BRAIN` -> `CPB_GLOBAL_BRAIN`
- `LEGACY_NEURONFS_TEAM_BRAIN` -> `CPB_TEAM_BRAIN`
- `LEGACY_NEURONFS_PROJECT_BRAIN` -> `CPB_PROJECT_BRAIN`
- `LEGACY_NEURONFS_USER_BRAIN` -> `CPB_PROJECT_BRAIN`
- `LEGACY_NEURONFS_DEVICE_BRAIN` -> `CPB_DEVICE_BRAIN`
- `LEGACY_NEURONFS_RUNTIME_BRAIN` -> `CPB_RUNTIME_BRAIN`
- `LEGACY_NEURONFS_SHARED_LANGUAGE` -> `CPB_SHARED_LANGUAGE`
- `LEGACY_NEURONFS_PERSONAL_LANGUAGE` -> `CPB_PERSONAL_LANGUAGE`
- `LEGACY_NEURONFS_HIRING_LANGUAGE` -> `CPB_HIRING_LANGUAGE`

## Paths

- `.agent/<legacy-neuronfs>/<project-id>` -> `.agent/cross-project-brain/<project-id>`
- `tools/<legacy-neuronfs>/team-brain` -> `brains/team-brain`
- `tools/<legacy-neuronfs>/operators` -> `brains/project-operators`
- `tools/<legacy-neuronfs>/global-operators` -> `brains/global-operators`

## Script Names

- `<product>-neuronfs-autoenv.bash` -> `project-brain-autoenv.bash`
- `setup-neuronfs-*.sh` -> keep pattern, but remove product name from messaging

## Skill Names In Docs

Use generic aliases in public docs:

- `frontend-developer`
- `backend-architect`
- `security-engineer`
- `api-tester`
- `reality-checker`
- `content-creator`
- `growth-hacker`
- `practical-music-educator`

Keep local implementation links only in adapter docs, not in public framework docs.

## Brain Naming

- `Cross-Project Brain` -> keep
- `Team Brain` -> keep
- `Project Operator Brain` -> keep
- `Device Brain` -> keep
- `Runtime Brain` -> keep
