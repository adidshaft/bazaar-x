import { AgentDecisionContext, EconomyAction } from '../lib/economy/types';
import {
  canSpend,
  isProposalActive,
  planServiceKind,
  planServiceTitle,
  serviceIdFor,
} from './deterministic';

export function decideSupplierActions(context: AgentDecisionContext): EconomyAction[] {
  const actions: EconomyAction[] = [];
  const shop = context.agent.shopId ? context.state.shops[context.agent.shopId] : null;
  const serviceId = serviceIdFor(context.agent.id, 'supply');

  if (shop && !context.state.services[serviceId]) {
    actions.push({
      type: 'list_service',
      agentId: context.agent.id,
      shopId: shop.id,
      serviceId,
      title: planServiceTitle('supplier'),
      kind: planServiceKind('supplier'),
      price: 90,
      capacity: 3,
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
