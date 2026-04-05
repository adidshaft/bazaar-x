import { AgentDecisionContext, EconomyAction } from '../lib/economy/types';
import { canSpend, isProposalActive, planServiceKind, planServiceTitle, serviceIdFor } from './deterministic';

export function decideWorkerActions(context: AgentDecisionContext): EconomyAction[] {
  const actions: EconomyAction[] = [];
  const shop = context.agent.shopId ? context.state.shops[context.agent.shopId] : null;
  const serviceId = serviceIdFor(context.agent.id, 'labor');

  if (shop && !context.state.services[serviceId]) {
    actions.push({
      type: 'list_service',
      agentId: context.agent.id,
      shopId: shop.id,
      serviceId,
      title: planServiceTitle('worker'),
      kind: planServiceKind('worker'),
      price: 120,
      capacity: 2,
    });
  }

  if (context.tick >= 2 && isProposalActive(context) && canSpend(context, 0)) {
    const proposal = Object.values(context.state.covenant.proposals).find((entry) => entry.status === 'active');
    if (proposal) {
      actions.push({
        type: 'vote',
        agentId: context.agent.id,
        proposalId: proposal.id,
        choice: 'for',
      });
    }
  }

  return actions;
}
