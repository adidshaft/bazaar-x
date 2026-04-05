import {
  applyAction,
  applyMilestone,
  createPolicyTransaction,
} from './ledger';
import {
  AgentDecisionContext,
  EconomyAction,
  EconomyState,
  SimulationConfig,
  SimulationResult,
  SimulationSummary,
} from './types';
import {
  decideGovernorActions,
  decideShopActions,
  decideSupplierActions,
  decideWorkerActions,
} from '../../agents';
import { stableHash } from './hash';

const plannerOrder: Array<'shop' | 'supplier' | 'worker' | 'governor'> = [
  'shop',
  'supplier',
  'worker',
  'governor',
];

const decideActionsForRole = (context: AgentDecisionContext): EconomyAction[] => {
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
};

const applyActions = (state: EconomyState, actions: EconomyAction[]): EconomyState =>
  actions.reduce((nextState, action) => applyAction(nextState, action), state);

const summarize = (state: EconomyState): SimulationSummary => {
  const paymentTransactions = state.transactions.filter((tx) => tx.kind === 'payment_settled').length;
  const proposal = Object.values(state.covenant.proposals).at(-1) ?? null;

  return {
    totalTransactions: state.transactions.length,
    paymentTransactions,
    taxCollected: state.covenant.collectedTax,
    treasuryBalance: state.covenant.treasuryBalance,
    milestones: [...state.milestones],
    finalTaxBps: state.covenant.policy.taxBps,
    proposalStatus: proposal?.status ?? null,
  };
};

export const stepEconomy = (state: EconomyState): EconomyState => {
  let nextState = state;

  for (const role of plannerOrder) {
    const agent = Object.values(nextState.agents).find((entry) => entry.role === role && entry.active);
    if (!agent) {
      continue;
    }

    const actions = decideActionsForRole({
      state: nextState,
      agent,
      tick: nextState.tick,
    });

    nextState = applyActions(nextState, actions);
  }

  return {
    ...nextState,
    tick: nextState.tick + 1,
  };
};

export function runBazaarSimulation(state: EconomyState, config: SimulationConfig): SimulationResult {
  let nextState = {
    ...state,
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
  };

  const timeline: SimulationResult['timeline'] = [];

  for (let index = 0; index < config.ticks; index += 1) {
    const beforeTxCount = nextState.transactions.length;
    const beforeEventCount = nextState.events.length;
    nextState = stepEconomy(nextState);
    timeline.push({
      tick: nextState.tick - 1,
      transactionHashes: nextState.transactions.slice(beforeTxCount).map((tx) => tx.hash),
      events: nextState.events.slice(beforeEventCount).map((event) => `${event.type}:${event.message}`),
    });

    if (nextState.milestones.includes('post-change-payment')) {
      break;
    }
  }

  return {
    state: nextState,
    summary: summarize(nextState),
    timeline,
  };
}

export const markMilestone = (state: EconomyState, milestone: string) => applyMilestone(state, milestone);

export const createPostChangeReceiptMemo = (tick: number) =>
  `post-change-payout-${stableHash(`tick:${tick}`).slice(2, 8)}`;

export const createPolicyTransactionForMemo = (
  fromId: string,
  toId: string,
  amount: number,
  memo: string,
  tick: number,
) => createPolicyTransaction(`${fromId}-${toId}-${tick}`, fromId, toId, amount, memo, tick);
