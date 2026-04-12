# Global Village Invariants

## Table of Contents

- Economy loop invariant
- Runtime role invariant
- Policy and governance limits
- Onchain deployment limits
- World and map assumptions
- Artifact and deployment assumptions
- Extension preference

## Economy Loop Invariant

Bazaar X is organized around one readable loop:

`earn -> pay -> tax -> treasury -> vote -> rule update -> next payment`

Keep that loop legible even when the village theme, service types, or map dressing change.

Source anchors:

- `README.md`
- `docs/skills.md`
- `lib/server/economy.ts`
- `lib/economy/ledger.ts`

## Runtime Role Invariant

The live and simulated flows both assume a core role quartet:

- `shop`
- `supplier`
- `worker`
- `governor`

Important repo facts:

- `lib/onchain/runtime.ts` generates exactly those four agent wallets plus system wallets for deployer and treasury.
- `lib/onchain/flow.ts` and `lib/onchain/game-actions.ts` look agents up by exact role.
- `lib/server/economy.ts` also picks role-specific actors by exact role name.
- `game/core/live-types.ts` defines `AgentRole` as the same four-role union.

Implication:

- Extra economy roles are not just content. They require runtime, type, and deployment changes.
- Multiple treasury actors are unsupported by default.

## Policy And Governance Limits

The offchain Covenant engine exposes these defaults in `covenant-skill/engine.ts`:

- `taxBps: 500`
- `minAgentBalance: 25`
- `proposalApprovalBps: 6000`
- `proposalQuorum: 2`
- `executionDelayTicks: 1`
- `minTreasuryBalance: 0`
- `taxCapBps: 2500`

The engine also enforces:

- sender balance cannot go negative after reserved funds are considered
- sender must stay above both wallet `minBalance` and policy `minAgentBalance`
- governance quorum must be at least `1`
- governance approval threshold stays within `0..10000`

Implication:

- A village spec may tune policy values, but it cannot bypass these guardrails without code changes.

## Onchain Deployment Limits

The Solidity contract is stricter than the offchain engine.

Source anchors:

- `contracts/src/CovenantSkill.sol`
- `lib/onchain/contract.ts`

Live deploy constraints:

- `taxBps <= 2000`
- `quorumBps` must be `1..10000`
- `supportBps` must be `5001..10000`
- `votingPeriod > 0`
- treasury address cannot be zero

Important nuance:

- Offchain Covenant allows `taxCapBps` up to `2500`.
- Onchain Covenant rejects rule sets above `2000`.
- To keep simulation and deployment parity, treat `2000` as the practical global max for village tax.

## World And Map Assumptions

The current world model is closed over one village footprint.

Source anchors:

- `game/core/live-types.ts`
- `game/data/world.ts`
- `game/maps/manifest.ts`

Current hardcoded unions:

- District IDs: `village-gate`, `market-row`, `supplier-lane`, `worker-yard`, `treasury-vault`, `council-hall`
- Map IDs: `village-exterior`, `forge-interior`, `depot-interior`, `treasury-interior`, `council-interior`

Implication:

- A new village with new district or map IDs requires TypeScript type edits plus manifest changes.
- Reusing the current village footprint is far cheaper than adding a second explorable map set.

## Artifact And Deployment Assumptions

The repo defaults to singleton artifact paths under `.bazaarx/runtime`.

Source anchors:

- `lib/server/config.ts`
- `.bazaarx/runtime/*/latest.json`

Default shared artifacts include:

- `wallets/latest.json`
- `deployments/latest.json`
- `live/latest.json`
- `agents/latest.json`
- `economy/latest.json`
- `governance/latest.json`

Implication:

- Parallel villages need namespaced artifact env vars before running live deploys side by side.
- Without namespacing, a second village run overwrites the first village's local runtime state.

## Extension Preference

When a new village needs custom rule logic:

- prefer a new `WorldEconomySkill` registered through `lib/economy/skills.ts`
- keep Covenant as the common governance/policy baseline unless the user explicitly wants a Bazaar-wide behavior change

When a new village only needs different copy, policy presets, services, or NPC flavor:

- prefer data/config changes over new contract logic
