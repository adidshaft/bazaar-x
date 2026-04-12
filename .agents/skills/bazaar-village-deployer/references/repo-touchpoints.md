# Repo Touchpoints

Use this as a routing guide after the village spec validates.

## Economy-Only Variant

Edit these first when the request is a new village economy without a brand-new map:

- `docs/skills.md`
- `covenant-skill/registry.ts`
- `covenant-skill/skill.ts`
- `covenant-skill/engine.ts`
- `lib/economy/skills.ts`
- `lib/economy/ledger.ts`
- `lib/economy/types.ts`
- `lib/server/economy.ts`

Use this track when the user wants new pricing, taxes, order logic, treasury rules, or governance behavior.

## Village Flavor Refresh On Existing Map

Edit these when the live town stays structurally the same but the village theme changes:

- `game/data/world.ts`
- `game/data/npcs.ts`
- `game/data/dialogue.ts`
- `game/data/quests.ts`
- UI overlays under `components/overlay/`

Use this track when the user wants a new charter, district copy, role flavor, quest text, or service descriptions.

## New Explorable Village Or District Layout

Edit these when the request introduces new map IDs, district IDs, or new interiors:

- `game/core/live-types.ts`
- `game/data/world.ts`
- `game/maps/manifest.ts`
- `game/maps/tiled/*.json`
- `game/maps/compiled/*.json`
- `scripts/generate-rpg-maps.ts`
- `scripts/compile-tiled-maps.ts`

Verify with:

- `pnpm maps:compile`
- `pnpm typecheck`

## Live Deployment Or Onchain Profile Changes

Edit these when the request changes wallet setup, initial rules, deployment behavior, or multi-village runtime behavior:

- `lib/onchain/runtime.ts`
- `lib/onchain/contract.ts`
- `lib/onchain/flow.ts`
- `lib/onchain/game-actions.ts`
- `lib/onchain/types.ts`
- `lib/server/config.ts`
- `scripts/deploy-bazaar.ts`
- `scripts/run-bazaar-flow.ts`

Use this track when the user wants a new treasury profile, different bootstrap funding, a different live rule preset, or parallel village deployments.

## API Or UI Surfaces

Edit these when the village spec needs new user-facing controls or backend entry points:

- `app/api/economy/simulate/route.ts`
- `app/api/live/deploy/route.ts`
- `app/api/live/status/route.ts`
- `components/bazaar-dashboard.tsx`
- `components/shell/bazaar-rpg-shell.tsx`

Use this track when the user wants to create, preview, or deploy villages through the app instead of by editing files and scripts directly.
