# ADAPTER LINEAGE

## Current Skill Lineage

The framework core is skill-system-agnostic, but the current adapter that shaped it was tested with:

- adapted role-specialist skills derived from [`msitarzewski/agency-agents`](https://github.com/msitarzewski/agency-agents)
  - Frontend Developer
  - Backend Architect
  - API Tester
  - Security Engineer
  - Reality Checker
  - Content Creator
  - Growth Hacker
  - SEO Specialist
  - Social Media Strategist
- a third-party UI skill:
  - [`nextlevelbuilder/ui-ux-pro-max-skill`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- local skills added on top of that pattern:
  - `project-explainer`

## Important Boundary

- the public core should not ship product-specific adapted skill bodies by default
- the framework only needs a `skill -> role` mapping contract
- consumer repos can plug in their own skill system

## Licensing

For attribution and redistribution requirements, see:

- [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
- [LICENSE](./LICENSE)
