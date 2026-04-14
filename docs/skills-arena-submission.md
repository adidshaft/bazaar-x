# Covenant Skill Submission Packet

This file is the repo-specific handoff for the Skills Arena submission.

## One-Line Description

`Covenant Skill - An installable TypeScript skill package for agent economies, with reusable policy, tax, treasury, and governance primitives.`

## What It Is

`Covenant Skill` takes the policy layer out of Bazaar X and ships it as a reusable package. Another project can install it today from a packed artifact, import stable typed entrypoints, and call the same core economy methods without depending on Bazaar X scenes, UI, contracts, or server code.

## What Is Real Today

- Package name: `@bazaar-x/covenant-skill`
- Build output: `covenant-skill/dist`
- Stable entrypoints:
  - `@bazaar-x/covenant-skill`
  - `@bazaar-x/covenant-skill/engine`
  - `@bazaar-x/covenant-skill/registry`
  - `@bazaar-x/covenant-skill/skill`
  - `@bazaar-x/covenant-skill/types`
- Required methods:
  - `createDefaultPolicy`
  - `applyTax`
  - `checkBalanceRules`
  - `enforcePolicy`
  - `proposeChange`
  - `vote`
  - `executeChange`
- Example consumer:
  - [covenant-skill/examples/basic-usage.mjs](/Users/amanpandey/projects/bazaar-x/covenant-skill/examples/basic-usage.mjs)
- Clean-room install proof:
  - `pnpm --dir covenant-skill smoke:install`

## What Is Not Claimed Yet

- Public npm registry publish
- Hosted registry install
- A separate standalone hosted product around the package

## Why It Fits Skills Arena

- It is a reusable agent skill, not just an internal helper.
- The API boundary is small, typed, and documented.
- The package is installable outside Bazaar X today.
- The clean-room smoke test proves another project can consume it.

## Judge-Facing Highlights

- `Portable policy engine`: reuses the same tax, treasury, and governance primitives in any agent economy.
- `Typed install surface`: package exports are explicit and stable.
- `Clean-room proof`: a separate sample consumer installs and runs the package without Bazaar X internals.
- `Practical reuse`: the exact same skill powers Bazaar X's live economy loop.

## Best Links To Share

- Package README: [covenant-skill/README.md](/Users/amanpandey/projects/bazaar-x/covenant-skill/README.md)
- Package manifest: [covenant-skill/package.json](/Users/amanpandey/projects/bazaar-x/covenant-skill/package.json)
- Example consumer: [covenant-skill/examples/basic-usage.mjs](/Users/amanpandey/projects/bazaar-x/covenant-skill/examples/basic-usage.mjs)
- Smoke install proof: [covenant-skill/scripts/smoke-install.mjs](/Users/amanpandey/projects/bazaar-x/covenant-skill/scripts/smoke-install.mjs)
- Test suite: [covenant-skill/test/covenant-skill.test.mjs](/Users/amanpandey/projects/bazaar-x/covenant-skill/test/covenant-skill.test.mjs)

## Recommended Form Copy

`Covenant Skill is our Skills Arena submission: an installable TypeScript package for agent economies. It extracts the policy, tax, treasury, and governance logic from Bazaar X into a typed reusable artifact that another project can install today from a packed tarball, exercise in a clean-room consumer, and extend through a registry surface without importing Bazaar X internals.`

## Recommended Demo Choice

- Best option: reuse the Bazaar X demo and describe Covenant Skill as the reusable policy engine under the hood.
- Better if time allows: cut a 30 to 45 second package clip that shows the install command, example consumer, and passing smoke install.
- Safe fallback: no separate skill video if the form truly keeps video optional, as long as the repo links point directly to the package docs and proof.
