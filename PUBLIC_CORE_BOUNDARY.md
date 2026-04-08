# PUBLIC CORE BOUNDARY

## What This Repo Is

This public core is meant to be installed into other repositories so they can adopt:

- `Team Brain`
- `Project Operator Brain`
- `Cross-Project Brain`
- `Runtime Brain`

It should contain:

- generic scripts
- generic templates
- generic docs
- generic examples
- tests for the public core scripts

## What This Repo Is Not

This public core should not ship:

- product-specific business logic
- private learned brain contents
- company-specific skills
- real operator lesson history
- internal product adapters that embed proprietary policy

## Practical Boundary Rule

If a file answers one of these questions, it probably belongs in the public core:

- can another team reuse this in a different repo?
- does it describe the framework rather than one product?
- is it safe to publish without exposing private learning history?

If the answer is no, keep it in the product repo or adapter layer.
