# `@bazaar-x/covenant-skill`

Typed tax, treasury, policy, and governance primitives for autonomous world-economy systems.

The package ships as ESM with generated `.d.ts` files and stable entrypoints for:

- `@bazaar-x/covenant-skill`
- `@bazaar-x/covenant-skill/engine`
- `@bazaar-x/covenant-skill/registry`
- `@bazaar-x/covenant-skill/skill`
- `@bazaar-x/covenant-skill/types`

## Install

Registry publishing is still pending, but the package is installable today from a packed artifact:

```bash
cd covenant-skill
pnpm pack

cd /path/to/another-project
pnpm add /absolute/path/to/bazaar-x/covenant-skill/bazaar-x-covenant-skill-0.1.0.tgz
```

Once published, the package name will stay:

```bash
pnpm add @bazaar-x/covenant-skill
```

## Usage

```ts
import {
  applyTax,
  checkBalanceRules,
  createCovenantSkill,
  createDefaultPolicy,
  createWorldEconomySkillRegistry,
  enforcePolicy,
  executeChange,
  proposeChange,
  vote,
  type CovenantState,
} from '@bazaar-x/covenant-skill';

const skill = createCovenantSkill();
const registry = createWorldEconomySkillRegistry([skill]);
const policy = createDefaultPolicy();

let state: CovenantState = {
  policy,
  treasuryBalance: 500,
  collectedTax: 0,
  proposals: {},
};

state = proposeChange(state, {
  id: 'lower-tax',
  proposerId: 'guild-1',
  title: 'Lower the tax rate',
  description: 'Reduce the marketplace tax to 4%.',
  patch: { kind: 'taxBps', value: 400 },
  createdAtTick: 10,
});

state = vote(state, 'lower-tax', 'guild-1', 'for');
state = vote(state, 'lower-tax', 'guild-2', 'for');

const result = executeChange(state, 'lower-tax', 11);
const quote = applyTax(200, result.state.policy);
const balanceCheck = checkBalanceRules(
  { balance: 1_000, reserved: 0, minBalance: 25 },
  200,
  result.state.policy,
);
const decision = enforcePolicy(
  {
    id: 'tx-1',
    fromId: 'merchant',
    toId: 'supplier',
    amount: 200,
    memo: 'grain shipment',
    tick: 12,
  },
  {
    treasuryBalance: result.state.treasuryBalance,
    sender: { balance: 1_000, reserved: 0, minBalance: 25 },
  },
  result.state.policy,
);

console.log(registry.get('covenant-skill').name, result.changed, quote, balanceCheck, decision.allowed);
```

## Development

```bash
pnpm typecheck
pnpm test
pnpm example
pnpm smoke:install
pnpm pack:dry-run
```

## Build Artifact

`pnpm build` writes the publishable package contents to `dist/`, including JavaScript, declaration files, declaration maps, and source maps.
