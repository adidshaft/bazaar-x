/* global console */

import {
  createCovenantSkill,
  createDefaultPolicy,
  executeChange,
  proposeChange,
  vote,
} from '../dist/index.js';

let state = {
  policy: createDefaultPolicy(),
  treasuryBalance: 750,
  collectedTax: 0,
  proposals: {},
};

state = proposeChange(state, {
  id: 'tax-adjustment',
  proposerId: 'merchant-guild',
  title: 'Adjust transaction tax',
  description: 'Trim the transaction tax slightly to improve market velocity.',
  patch: { kind: 'taxBps', value: 450 },
  createdAtTick: 40,
});

state = vote(state, 'tax-adjustment', 'merchant-guild', 'for');
state = vote(state, 'tax-adjustment', 'treasury-council', 'for');

const result = executeChange(state, 'tax-adjustment', 41);
const skill = createCovenantSkill();

console.log(
  JSON.stringify(
    {
      changed: result.changed,
      policy: result.state.policy,
      sampleTax: skill.methods.applyTax(200, result.state.policy),
    },
    null,
    2,
  ),
);
