# World Economy Skills

Bazaar X treats economy logic as a pluggable skill system so the same runtime can power more than one game or market.

## Package Status

Real today:
- `covenant-skill/` builds to a publishable `dist/` artifact with ESM entrypoints and generated `.d.ts` files.
- A clean-room consumer can install the packed tarball without importing Bazaar X internals.
- The stable package entrypoints are `@bazaar-x/covenant-skill`, `@bazaar-x/covenant-skill/engine`, `@bazaar-x/covenant-skill/registry`, `@bazaar-x/covenant-skill/skill`, and `@bazaar-x/covenant-skill/types`.

Still pending:
- Registry publishing is not live yet.

Install from a local packed artifact today:

```bash
cd covenant-skill
pnpm pack

cd /path/to/another-project
pnpm add /absolute/path/to/bazaar-x/covenant-skill/bazaar-x-covenant-skill-0.1.0.tgz
```

Future registry install:

```bash
pnpm add @bazaar-x/covenant-skill
```

## Why It Exists

The town UI is Bazaar X specific.

The economy logic should not be.

`Covenant Skill` is the first runtime-installed module, but the registry is designed so other games can register additional rule packs without rewriting settlement, agent orchestration, or the HUD.

## Core Files

- `covenant-skill/registry.ts`
  - Generic registry for registerable world-economy skills
- `covenant-skill/skill.ts`
  - Turns Covenant into a named reusable skill module
- `lib/economy/skills.ts`
  - Installs Bazaar X's default skill catalog
- `lib/economy/ledger.ts`
  - Calls skill methods through the installed catalog instead of importing Covenant engine functions directly

## Current Installed Skill

`covenant-skill`

Methods:
- `createDefaultPolicy()`
- `applyTax()`
- `checkBalanceRules()`
- `enforcePolicy()`
- `proposeChange()`
- `vote()`
- `executeChange()`

This is the policy, treasury, and governance brain for Bazaar X.

## Extension Pattern

Another world economy can register extra skills beside Covenant.

External consumers can build on the same registry surface today from the packed artifact, and later from the published package:

```ts
import { createWorldEconomySkillRegistry, createCovenantSkill } from "@bazaar-x/covenant-skill";
import type { WorldEconomySkill } from "@bazaar-x/covenant-skill";

const weatherSkill: WorldEconomySkill = {
  id: "weather-skill",
  name: "Weather Skill",
  description: "Applies storm taxes and shipping delays to a coastal economy.",
  version: "0.1.0",
  tags: ["weather", "shipping", "events"],
  methods: {
    applyStormModifier(state) {
      return state;
    },
  },
};

const registry = createWorldEconomySkillRegistry([createCovenantSkill(), weatherSkill]);
```

Because the registry rejects duplicate IDs, extensions fail loudly instead of silently replacing a live rule system.

## What This Enables

- Reuse the same economy runtime in multiple games
- Keep skill metadata visible in the UI
- Swap or combine rule modules per world
- Keep policy logic independently testable
- Pitch Covenant Skill as a reusable runtime extension, not just an internal helper
