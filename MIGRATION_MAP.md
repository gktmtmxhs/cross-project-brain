# MIGRATION MAP

Map product-specific names to generic open-source names before publishing.

## Env Vars

- `MUINONE_NEURONFS_REPO_ROOT` -> `CPB_REPO_ROOT`
- `MUINONE_NEURONFS_OPERATOR` -> `CPB_OPERATOR`
- `MUINONE_NEURONFS_OPERATOR_ID` -> `CPB_OPERATOR_ID`
- `MUINONE_NEURONFS_AGENT_ROOT` -> `CPB_AGENT_ROOT`
- `MUINONE_NEURONFS_GLOBAL_BRAIN` -> `CPB_GLOBAL_BRAIN`
- `MUINONE_NEURONFS_TEAM_BRAIN` -> `CPB_TEAM_BRAIN`
- `MUINONE_NEURONFS_PROJECT_BRAIN` -> `CPB_PROJECT_BRAIN`
- `MUINONE_NEURONFS_USER_BRAIN` -> `CPB_PROJECT_BRAIN`
- `MUINONE_NEURONFS_DEVICE_BRAIN` -> `CPB_DEVICE_BRAIN`
- `MUINONE_NEURONFS_RUNTIME_BRAIN` -> `CPB_RUNTIME_BRAIN`
- `MUINONE_NEURONFS_SHARED_LANGUAGE` -> `CPB_SHARED_LANGUAGE`
- `MUINONE_NEURONFS_PERSONAL_LANGUAGE` -> `CPB_PERSONAL_LANGUAGE`
- `MUINONE_NEURONFS_HIRING_LANGUAGE` -> `CPB_HIRING_LANGUAGE`

## Paths

- `.agent/neuronfs/Muinone` -> `.agent/cross-project-brain/<project-id>`
- `tools/neuronfs-pilot/team-brain` -> `brains/team-brain`
- `tools/neuronfs-pilot/operators` -> `brains/project-operators`
- `tools/neuronfs-pilot/global-operators` -> `brains/global-operators`

## Script Names

- `muinone-neuronfs-autoenv.bash` -> `project-brain-autoenv.bash`
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

