# RELEASE CHECKLIST

Use this before publishing the framework core.

## Legal / Ownership

- choose and add a top-level LICENSE for the framework core repo
- review the copyright holder string in `LICENSE`
- confirm you have the right to publish the framework code
- confirm product-specific docs and lessons are excluded
- include third-party notices for NeuronFS and any redistributed skill source
- include third-party notices for `ui-ux-pro-max-skill` if the skill body, data, or scripts are bundled

## Naming / Neutrality

- remove product names from framework-facing docs
- replace product-specific skill names with generic aliases
- move product-specific adapters to a separate private or example layer

## Data Hygiene

- remove real operator brain contents
- remove global brain lesson history
- remove `.agent/`
- remove `.tools/`
- remove any secrets or machine-specific paths

## Packaging

- rename env vars to a generic prefix
- rename path roots to generic locations
- keep a product adapter migration map
- provide an example brain layout

## Docs

- public README
- public README in Korean if you want bilingual distribution
- quickstart
- architecture
- taxonomy
- execution workflow
- packaging guide
- third-party notices

## Tests

- logger tests pass
- device scope tests pass
- prune tests pass
- selective injection tests pass
- install/hook patch flow documented

## Final Review

- no product names remain in public docs
- no real lesson history ships
- no product-specific skills ship
- install steps work in a clean repo

## Monorepo Extraction

- from the product repo, verify the subtree is ready:
  - `bash scripts/export-cpb-core.sh status`
- if you need a working-tree snapshot of uncommitted CPB changes:
  - `bash scripts/export-cpb-core.sh snapshot --target /tmp/cpb-core-working`
- before using a history-preserving subtree split, commit the CPB core changes first
- then create a split branch:
  - `bash scripts/export-cpb-core.sh subtree-branch --branch cpb-core-export`
- push that branch to the new public or private CPB repo as `main`
- after the new repo is live, replace product-repo embedded core ownership with consumer-wrapper ownership
