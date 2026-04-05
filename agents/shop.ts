import { AgentDecisionContext, EconomyAction } from '../lib/economy/types';
import { canSpend, hasShop, orderIdFor, planServiceKind, planServiceTitle, serviceIdFor } from './deterministic';

const workerServiceId = (context: AgentDecisionContext) => serviceIdFor(context.state.agents.worker_agent.id, 'labor');
const supplierServiceId = (context: AgentDecisionContext) => serviceIdFor(context.state.agents.supplier_agent.id, 'supply');

export function decideShopActions(context: AgentDecisionContext): EconomyAction[] {
  const actions: EconomyAction[] = [];
  const shop = context.agent.shopId ? context.state.shops[context.agent.shopId] : null;

  if (!hasShop(context)) {
    actions.push({
      type: 'open_shop',
      agentId: context.agent.id,
      title: 'Bazaar X',
    });
  }

  const shopId = shop?.id ?? context.agent.shopId ?? '';
  const shopServiceId = serviceIdFor(context.agent.id, 'operations');

  if (shop && !context.state.services[shopServiceId]) {
    actions.push({
      type: 'list_service',
      agentId: context.agent.id,
      shopId,
      serviceId: shopServiceId,
      title: planServiceTitle('shop'),
      kind: planServiceKind('shop'),
      price: 140,
      capacity: 1,
    });
  }

  if (context.tick === 1 && canSpend(context, 210) && shop) {
    actions.push({
      type: 'create_order',
      agentId: context.agent.id,
      orderId: orderIdFor(context.agent.id, context.state.agents.worker_agent.id, 'hire'),
      payerAgentId: context.agent.id,
      payeeAgentId: context.state.agents.worker_agent.id,
      serviceId: workerServiceId(context),
      amount: 120,
      memo: 'Worker hire for fulfillment and ops',
    });
    actions.push({
      type: 'create_order',
      agentId: context.agent.id,
      orderId: orderIdFor(context.agent.id, context.state.agents.supplier_agent.id, 'supply'),
      payerAgentId: context.agent.id,
      payeeAgentId: context.state.agents.supplier_agent.id,
      serviceId: supplierServiceId(context),
      amount: 90,
      memo: 'Supplier purchase for inventory flow',
    });
  }

  if (context.tick === 2) {
    const workerOrder = context.state.orders[orderIdFor(context.agent.id, context.state.agents.worker_agent.id, 'hire')];
    const supplierOrder = context.state.orders[orderIdFor(context.agent.id, context.state.agents.supplier_agent.id, 'supply')];

    if (workerOrder?.state === 'reserved') {
      actions.push({
        type: 'settle_order',
        agentId: context.agent.id,
        orderId: workerOrder.id,
      });
    }

    if (supplierOrder?.state === 'reserved') {
      actions.push({
        type: 'settle_order',
        agentId: context.agent.id,
        orderId: supplierOrder.id,
      });
    }
  }

  if (context.tick === 4 && context.state.covenant.policy.taxBps >= 800 && canSpend(context, 70)) {
    const bonusOrderId = orderIdFor(context.agent.id, context.state.agents.worker_agent.id, 'bonus');
    if (!context.state.orders[bonusOrderId]) {
      actions.push({
        type: 'create_order',
        agentId: context.agent.id,
        orderId: bonusOrderId,
        payerAgentId: context.agent.id,
        payeeAgentId: context.state.agents.worker_agent.id,
        serviceId: workerServiceId(context),
        amount: 70,
        memo: 'Post-governance bonus payment',
      });
    }
  }

  if (context.tick === 5) {
    const bonusOrderId = orderIdFor(context.agent.id, context.state.agents.worker_agent.id, 'bonus');
    if (context.state.orders[bonusOrderId]?.state === 'reserved') {
      actions.push({
        type: 'settle_order',
        agentId: context.agent.id,
        orderId: bonusOrderId,
      });
    }
  }

  return actions;
}
