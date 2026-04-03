# THIRD PARTY NOTICES

This framework core interoperates with third-party open-source projects and was shaped by a product-local adapter that used adapted specialist skills.

This file is not a replacement for your own repository `LICENSE`.

## 1. NeuronFS

- Project: `rhino-acoustic/NeuronFS`
- Upstream: <https://github.com/rhino-acoustic/NeuronFS>
- Observed license: MIT
- Evidence:
  - local installed copy: `.tools/neuronfs/LICENSE`
  - upstream GitHub shows `MIT license`

Role in this framework:

- runtime brain storage model
- hook integration target
- CLI used by autogrowth and rebuild flows
- conceptual basis for filesystem-native rule memory

Redistribution note:

- if you ship code derived from or copied from NeuronFS, keep the MIT notice
- if you only interoperate with a user-installed NeuronFS binary, keep attribution in docs and notices

## 2. agency-agents

- Project: `msitarzewski/agency-agents`
- Upstream: <https://github.com/msitarzewski/agency-agents>
- Observed license: MIT
- Evidence:
  - upstream GitHub shows `MIT license`

Role in this framework:

- source inspiration and pattern base for role-specialized skill design
- current local adapter was validated with adapted specialist skills based on that library

Examples of adapter-side skill lineage:

- Frontend Developer
- Backend Architect
- API Tester
- Security Engineer
- Reality Checker
- Content Creator
- Growth Hacker
- SEO Specialist
- Social Media Strategist

Redistribution note:

- do not blindly ship product-local adapted skills in the public framework core
- if you redistribute skill text derived from agency-agents, keep attribution and the MIT notice
- generic alias names alone are not the same as redistributing the original skill body

## 3. UI UX Pro Max

- Project: `nextlevelbuilder/ui-ux-pro-max-skill`
- Upstream: <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill>
- Observed license: MIT
- Evidence:
  - public GitHub repository and package listings identify it as MIT
  - the local skill name and content structure strongly match that public project

Role in this framework:

- third-party UI/UX design skill used in the current adapter
- source of design-system generation and searchable UI guidance patterns

Redistribution note:

- if you redistribute the skill body, data files, or scripts derived from `ui-ux-pro-max-skill`, keep attribution and the MIT notice
- if you only mention it as an integration target or optional dependency, keep attribution in docs and notices

## 4. Local Skills Added On Top

The current local adapter also added non-upstream skills such as:

- `project-explainer`

These are local additions and should be reviewed separately before any public release.

## 5. Practical Publication Rule

Before publishing a public repo:

1. add your own repo `LICENSE`
2. keep third-party notices for any redistributed upstream-derived content
3. remove real operator/global brain contents
4. remove product-specific skills and private adapters unless you are sure you can publish them
5. separate framework core from product adapter
