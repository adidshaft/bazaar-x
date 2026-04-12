/* global console, process */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, '..');
const packDir = mkdtempSync(join(tmpdir(), 'covenant-skill-pack-'));
const consumerDir = mkdtempSync(join(tmpdir(), 'covenant-skill-consumer-'));

const run = (command, args, cwd) =>
  execFileSync(command, args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf8',
  });

const cleanup = () => {
  if (process.env.KEEP_COVENANT_SKILL_SMOKE === '1') {
    console.log(`Kept smoke-install temp dirs:\n- ${packDir}\n- ${consumerDir}`);
    return;
  }

  rmSync(packDir, { recursive: true, force: true });
  rmSync(consumerDir, { recursive: true, force: true });
};

try {
  run('pnpm', ['pack', '--pack-destination', packDir], packageDir);

  const tarballName = readdirSync(packDir).find((entry) => entry.endsWith('.tgz'));
  assert.ok(tarballName, 'Expected pnpm pack to produce a tarball.');

  const tarballPath = resolve(packDir, tarballName);

  writeFileSync(
    join(consumerDir, 'package.json'),
    JSON.stringify(
      {
        name: 'covenant-skill-smoke-consumer',
        private: true,
        type: 'module',
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(consumerDir, 'index.mjs'),
    `import assert from 'node:assert/strict';
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
} from '@bazaar-x/covenant-skill';

const skill = createCovenantSkill();
const registry = createWorldEconomySkillRegistry([skill]);
const policy = createDefaultPolicy();

assert.equal(registry.get('covenant-skill').name, 'Covenant Skill');
assert.deepEqual(applyTax(1000, policy), {
  gross: 1000,
  taxAmount: 50,
  net: 950,
  effectiveBps: 500,
});

assert.deepEqual(
  checkBalanceRules({ balance: 500, reserved: 0, minBalance: 25 }, 100, policy),
  { allowed: true, reason: null, postBalance: 400 },
);

const decision = enforcePolicy(
  { id: 'tx-1', fromId: 'a', toId: 'b', amount: 100, memo: 'smoke', tick: 1 },
  { treasuryBalance: 0, sender: { balance: 1000, reserved: 0, minBalance: 25 } },
  policy,
);
assert.equal(decision.allowed, true);

let state = {
  policy,
  treasuryBalance: 0,
  collectedTax: 0,
  proposals: {},
};

state = proposeChange(state, {
  id: 'p1',
  proposerId: 'gov',
  title: 'Raise tax',
  description: 'smoke',
  patch: { kind: 'taxBps', value: 800 },
  createdAtTick: 0,
});
state = vote(state, 'p1', 'v1', 'for');
state = vote(state, 'p1', 'v2', 'for');

const result = executeChange(state, 'p1', 1);
assert.equal(result.changed, true);
assert.equal(result.state.policy.taxBps, 800);

console.log('clean-room smoke passed');
`,
  );

  run('pnpm', ['add', tarballPath], consumerDir);
  const output = run('node', ['index.mjs'], consumerDir);

  assert.match(output, /clean-room smoke passed/);

  console.log(`Smoke install passed via ${tarballName}`);
} finally {
  cleanup();
}
