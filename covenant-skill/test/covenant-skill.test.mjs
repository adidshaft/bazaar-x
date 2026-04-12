import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyTax,
  createCovenantSkill,
  createDefaultPolicy,
  createWorldEconomySkillRegistry,
  describeWorldEconomySkill,
  executeChange,
  proposeChange,
  vote,
} from '../dist/index.js';

test('root entrypoint exposes a typed covenant skill descriptor and methods', () => {
  const skill = createCovenantSkill();

  assert.equal(skill.id, 'covenant-skill');
  assert.equal(skill.methods.createDefaultPolicy().taxBps, 500);
  assert.deepEqual(describeWorldEconomySkill(skill), {
    id: 'covenant-skill',
    name: 'Covenant Skill',
    description:
      'Reusable tax, policy, treasury, and governance logic for world economies and autonomous game markets.',
    version: '0.1.0',
    tags: ['policy', 'treasury', 'governance', 'world-economy', 'games'],
  });
});

test('registry stores the covenant skill and rejects duplicate ids', () => {
  const skill = createCovenantSkill();
  const registry = createWorldEconomySkillRegistry([skill]);

  assert.equal(registry.has(skill.id), true);
  assert.equal(registry.get(skill.id).name, 'Covenant Skill');
  assert.throws(() => registry.register(skill), /already registered/i);
});

test('policy execution applies a successful governance change after quorum and delay', () => {
  let state = {
    policy: createDefaultPolicy(),
    treasuryBalance: 500,
    collectedTax: 0,
    proposals: {},
  };

  state = proposeChange(state, {
    id: 'raise-floor',
    proposerId: 'agent-1',
    title: 'Raise the agent balance floor',
    description: 'Increase the minimum remaining balance after settlement.',
    patch: { kind: 'minAgentBalance', value: 30 },
    createdAtTick: 12,
  });

  state = vote(state, 'raise-floor', 'agent-1', 'for');
  state = vote(state, 'raise-floor', 'agent-2', 'for');

  const result = executeChange(state, 'raise-floor', 13);

  assert.equal(result.changed, true);
  assert.equal(result.reason, null);
  assert.equal(result.state.policy.minAgentBalance, 30);
  assert.equal(result.proposal.status, 'executed');
});

test('tax application respects the package policy cap', () => {
  const policy = createDefaultPolicy();
  const tax = applyTax(100, { ...policy, taxBps: 8000, taxCapBps: 2500 });

  assert.deepEqual(tax, {
    gross: 100,
    taxAmount: 25,
    net: 75,
    effectiveBps: 2500,
  });
});

test('subpath entrypoints load from the built artifact', async () => {
  const [engineModule, registryModule, skillModule, typesModule] = await Promise.all([
    import('../dist/engine.js'),
    import('../dist/registry.js'),
    import('../dist/skill.js'),
    import('../dist/types.js'),
  ]);

  assert.equal(typeof engineModule.createDefaultPolicy, 'function');
  assert.equal(typeof registryModule.WorldEconomySkillRegistry, 'function');
  assert.equal(typeof skillModule.createCovenantSkill, 'function');
  assert.deepEqual(Object.keys(typesModule), []);
});
