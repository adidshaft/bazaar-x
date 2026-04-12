---
name: bazaar-village-deployer
description: Design, validate, and implement new Bazaar X villages and economy variants from user-provided village rules, policy targets, service loops, map/theme specs, and deployment goals. Use when Codex needs to add a new village, adapt the Bazaar X economy for a new settlement, turn a loose village brief into a structured spec, enforce Bazaar-wide invariants before deployment, or wire village changes across world data, economy skills, onchain deployment, and runtime artifacts.
---

# Bazaar Village Deployer

## Overview

Turn a village brief into a validated Bazaar X implementation plan before editing runtime code. Start from the spec template, run the validator, then touch only the repo surfaces required by the requested village scope.

## Workflow

1. Capture the request in `assets/village-spec.template.json`. Fill obvious defaults first. Only ask follow-up questions when a missing field changes invariant enforcement, map scope, or deployment behavior.
2. Run the validator:

```bash
python3 .agents/skills/bazaar-village-deployer/scripts/validate_village_spec.py /absolute/path/to/spec.json
```

3. Read `references/global-village-invariants.md` every time. Read `references/repo-touchpoints.md` when deciding which files to modify.
4. Pick the narrowest implementation track:
   - Economy-only variant: keep current maps and world IDs; prefer a new `WorldEconomySkill` or policy/default changes over rewriting the whole village.
   - Village-flavor refresh: reuse current map topology and live flow, but update dialogue, world copy, services, policy defaults, or agent flavor.
   - New explorable village: widen map and district types, add map assets, update manifests, and audit scene routing.
   - Parallel live villages: namespace artifacts and runtime paths first. The repo defaults to singleton `latest.json` artifacts.
5. Preserve Bazaar-wide invariants:
   - Keep the core loop `earn -> pay -> tax -> treasury -> vote -> rule update -> next payment`.
   - Keep one treasury and the core economic role quartet `shop`, `supplier`, `worker`, `governor` unless you are intentionally rewriting deployment/runtime code that hardcodes those roles.
   - Keep live-compatible tax settings at `<= 2000` bps even though the offchain covenant engine permits `2500`; the Solidity contract is stricter.
6. Verify the surfaces you touched:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm maps:compile` if any tiled or compiled map changed
   - `pnpm live:status` or `pnpm live:deploy` only when the user explicitly wants a runtime/deployment check and env is configured

## Decision Rules

- Prefer configuration and data changes over contract changes when the request is only a new village theme, service mix, or policy preset.
- Prefer adding a new world-economy module beside Covenant when the new village introduces new rule logic, not just new numeric thresholds.
- Treat `contracts/src/CovenantSkill.sol` as the live source of truth for deployable rule bounds.
- Treat `lib/onchain/runtime.ts`, `lib/onchain/flow.ts`, `lib/onchain/game-actions.ts`, and `lib/server/economy.ts` as hardcoded runtime surfaces that must be updated before supporting extra economic roles or multiple treasuries.
- Treat `game/core/live-types.ts`, `game/data/world.ts`, and `game/maps/manifest.ts` as closed-world schema files. A new map or district is a code change, not just content.

## Inputs And Outputs

Start from the user brief and produce, in order:

1. A normalized village spec JSON.
2. A short invariant report listing hard blockers, warnings, and defaults assumed.
3. A file touchpoint plan grouped by economy, world, and deployment surfaces.
4. The implementation and verification steps or code changes.

## Repo-Specific Guidance

- Use the extension pattern from `docs/skills.md` and `lib/economy/skills.ts` when the village needs new economy behavior. Register a new `WorldEconomySkill` instead of silently overloading Covenant unless the user explicitly wants a Covenant-wide rule change.
- If the request mentions only a new economy loop for the existing town, stay out of the Phaser map pipeline.
- If the request mentions a brand-new village map, inspect both `game/maps/tiled/` and `game/maps/compiled/`, then rerun `pnpm maps:compile`.
- If the request mentions a second live village or parallel deployments, audit `lib/server/config.ts` first because artifact paths default to shared `latest.json` files.

## Resources

- `references/global-village-invariants.md`: hard limits and architectural assumptions derived from the repo
- `references/repo-touchpoints.md`: which files usually change for each village scope
- `assets/village-spec.template.json`: starting shape for a village brief
- `scripts/validate_village_spec.py`: deterministic validator for village specs before implementation
