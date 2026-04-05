import { AgentDecisionContext } from '../lib/economy/types';
import { createOrderId, createProposalId, createServiceId } from '../lib/economy/scenario';
import { GovernancePatch, VoteChoice } from '../covenant-skill/types';

export const hasShop = (context: AgentDecisionContext) => Boolean(context.agent.shopId && context.state.shops[context.agent.shopId]);

export const ownWallet = (context: AgentDecisionContext) => context.state.wallets[context.agent.walletId];

export const availableBudget = (context: AgentDecisionContext) => {
  const wallet = ownWallet(context);
  return wallet ? wallet.balance - wallet.reserved : 0;
};

export const canSpend = (context: AgentDecisionContext, amount: number) => {
  const wallet = ownWallet(context);
  if (!wallet) {
    return false;
  }

  const spendable = wallet.balance - wallet.reserved;
  return spendable - amount >= wallet.minBalance && spendable - amount >= context.state.covenant.policy.minAgentBalance;
};

export const serviceIdFor = (agentId: string, suffix: string) => createServiceId(agentId, suffix);

export const orderIdFor = (payerId: string, payeeId: string, suffix: string) => createOrderId(payerId, payeeId, suffix);

export const proposalIdFor = (agentId: string, suffix: string) => createProposalId(agentId, suffix);

export const deterministicVote = (tick: number): VoteChoice => (tick % 2 === 0 ? 'for' : 'for');

export const policyPatchForTick = (tick: number): GovernancePatch => ({
  kind: 'taxBps',
  value: tick >= 1 ? 850 : 650,
});

export const planServiceTitle = (role: 'shop' | 'supplier' | 'worker' | 'governor') => {
  switch (role) {
    case 'shop':
      return 'Bazaar coordination retainer';
    case 'supplier':
      return 'Supply rail and inventory stream';
    case 'worker':
      return 'Labor and fulfillment lane';
    case 'governor':
      return 'Covenant steward service';
    default:
      return 'Bazaar service';
  }
};

export const planServiceKind = (role: 'shop' | 'supplier' | 'worker' | 'governor') => {
  switch (role) {
    case 'shop':
      return 'operations';
    case 'supplier':
      return 'supply';
    case 'worker':
      return 'labor';
    case 'governor':
      return 'operations';
    default:
      return 'operations';
  }
};

export const isProposalActive = (context: AgentDecisionContext) =>
  Object.values(context.state.covenant.proposals).some((proposal) => proposal.status === 'active');

export const proposalByTitle = (context: AgentDecisionContext, title: string) =>
  Object.values(context.state.covenant.proposals).find((proposal) => proposal.title === title) ?? null;
