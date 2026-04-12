# World Economy Skills

Bazaar X treats economy logic as a pluggable skill system so the same runtime can power more than one game or market.

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

Another world economy can register extra skills beside Covenant:

```ts
import { createBazaarSkillRegistry } from "../lib/economy/skills";
import type { WorldEconomySkill } from "../covenant-skill";

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

const registry = createBazaarSkillRegistry([weatherSkill]);
```

Because the registry rejects duplicate IDs, extensions fail loudly instead of silently replacing a live rule system.

## What This Enables

- Reuse the same economy runtime in multiple games
- Keep skill metadata visible in the UI
- Swap or combine rule modules per world
- Keep policy logic independently testable
- Pitch Covenant Skill as a reusable runtime extension, not just an internal helper
