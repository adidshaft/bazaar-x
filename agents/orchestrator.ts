import { AgentDecisionContext, EconomyAction, EconomyState } from '../lib/economy/types';
import { decideGovernorActions } from './governor';
import { decideShopActions } from './shop';
import { decideSupplierActions } from './supplier';
import { decideWorkerActions } from './worker';

const plannerOrder: Array<'shop' | 'supplier' | 'worker' | 'governor'> = [
  'shop',
  'supplier',
  'worker',
  'governor',
];

export function decideActions(context: AgentDecisionContext): EconomyAction[] {
  switch (context.agent.role) {
    case 'shop':
      return decideShopActions(context);
    case 'supplier':
      return decideSupplierActions(context);
    case 'worker':
      return decideWorkerActions(context);
    case 'governor':
      return decideGovernorActions(context);
    default:
      return [];
  }
}

export function buildRoundActions(state: EconomyState): EconomyAction[] {
  const actions: EconomyAction[] = [];

  for (const role of plannerOrder) {
    const agent = Object.values(state.agents).find((entry) => entry.role === role && entry.active);
    if (!agent) {
      continue;
    }

    actions.push(
      ...decideActions({
        state,
        agent,
        tick: state.tick,
      }),
    );
  }

  return actions;
}
