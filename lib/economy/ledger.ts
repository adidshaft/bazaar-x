import type { GovernanceProposal, PolicyTransaction } from '../../covenant-skill/types';
import { deriveId, stableHash } from './hash';
import { covenantWorldSkill, installedWorldEconomySkills } from './skills';
import {
  AgentRecord,
  EconomyAction,
  EconomyState,
  ServiceRecord,
  ShopRecord,
  SimulationEvent,
  TransactionRecord,
  WorkOrderRecord,
  WalletRecord,
} from './types';

const snapshotPolicy = (state: EconomyState) => ({
  taxBps: state.covenant.policy.taxBps,
  minAgentBalance: state.covenant.policy.minAgentBalance,
  proposalApprovalBps: state.covenant.policy.proposalApprovalBps,
  proposalQuorum: state.covenant.policy.proposalQuorum,
  executionDelayTicks: state.covenant.policy.executionDelayTicks,
});

const recordEvent = (
  state: EconomyState,
  type: string,
  message: string,
  actorId?: string,
  data?: Record<string, string | number | boolean | null>,
): EconomyState => ({
  ...state,
  events: [
    ...state.events,
    {
      id: deriveId('evt', type, state.tick, state.events.length),
      tick: state.tick,
      actorId,
      type,
      message,
      data,
    } satisfies SimulationEvent,
  ],
});

const recordTransaction = (
  state: EconomyState,
  tx: Omit<TransactionRecord, 'hash'> & { hash?: string },
): EconomyState => ({
  ...state,
  transactions: [
    ...state.transactions,
    {
      ...tx,
      hash: tx.hash ?? stableHash(`${tx.kind}:${tx.id}:${tx.tick}:${tx.actorId}:${tx.amount}:${tx.taxAmount}`),
    } satisfies TransactionRecord,
  ],
});

const getWallet = (state: EconomyState, walletId: string): WalletRecord | null => state.wallets[walletId] ?? null;

const updateWallet = (
  state: EconomyState,
  walletId: string,
  updater: (wallet: WalletRecord) => WalletRecord,
): EconomyState => {
  const wallet = getWallet(state, walletId);
  if (!wallet) {
    return state;
  }

  return {
    ...state,
    wallets: {
      ...state.wallets,
      [walletId]: updater(wallet),
    },
  };
};

const updateAgent = (
  state: EconomyState,
  agentId: string,
  updater: (agent: AgentRecord) => AgentRecord,
): EconomyState => {
  const agent = state.agents[agentId];
  if (!agent) {
    return state;
  }

  return {
    ...state,
    agents: {
      ...state.agents,
      [agentId]: updater(agent),
    },
  };
};

const reserveBudget = (wallet: WalletRecord, amount: number): WalletRecord => ({
  ...wallet,
  reserved: wallet.reserved + amount,
});

const releaseBudget = (wallet: WalletRecord, amount: number): WalletRecord => ({
  ...wallet,
  reserved: Math.max(0, wallet.reserved - amount),
});

const applySettlement = (
  state: EconomyState,
  order: WorkOrderRecord,
  policyTx: PolicyTransaction,
) => {
  const payerAgent = state.agents[order.payerAgentId];
  const payeeAgent = state.agents[order.payeeAgentId];
  const payerWallet = getWallet(state, payerAgent.walletId);
  const payeeWallet = getWallet(state, payeeAgent.walletId);

  if (!payerWallet || !payeeWallet) {
    return {
      state,
      transaction: null,
      settled: false,
      reason: 'Wallet missing.',
    };
  }

  const decision = covenantWorldSkill.methods.enforcePolicy(
    policyTx,
    {
      treasuryBalance: state.covenant.treasuryBalance,
      sender: {
        balance: payerWallet.balance,
        reserved: payerWallet.reserved,
        minBalance: payerWallet.minBalance,
      },
      receiver: {
        balance: payeeWallet.balance,
        reserved: payeeWallet.reserved,
        minBalance: payeeWallet.minBalance,
      },
    },
    state.covenant.policy,
  );

  if (!decision.allowed) {
    const nextState = updateWallet(state, payerWallet.id, (wallet) => releaseBudget(wallet, order.reservedAmount));
    return {
      state: recordEvent(
        applyMilestone(
          {
            ...nextState,
            orders: {
              ...nextState.orders,
              [order.id]: {
                ...order,
                state: 'cancelled' as const,
              } as WorkOrderRecord,
            },
          },
          'payment-rejected',
        ),
        'payment-rejected',
        `Payment for order ${order.id} was rejected: ${decision.reason ?? 'policy block'}`,
        order.payerAgentId,
        { orderId: order.id, reason: decision.reason ?? 'policy block' },
      ),
      transaction: null,
      settled: false,
      reason: decision.reason,
    };
  }

  const txId = deriveId('tx', order.id, state.tick, state.transactions.length);
  const updatedState = updateWallet(
    updateWallet(state, payerWallet.id, (wallet) => ({
      ...wallet,
      balance: wallet.balance - decision.tax.gross,
      reserved: Math.max(0, wallet.reserved - order.reservedAmount),
    })),
    payeeWallet.id,
    (wallet) => ({
      ...wallet,
      balance: wallet.balance + decision.tax.net,
    }),
  );

  const treasuryAfter = {
    ...updatedState,
    covenant: {
      ...updatedState.covenant,
      treasuryBalance: updatedState.covenant.treasuryBalance + decision.tax.taxAmount,
      collectedTax: updatedState.covenant.collectedTax + decision.tax.taxAmount,
    },
  };

  const paymentTx: TransactionRecord = {
    id: txId,
    hash: stableHash(`${txId}:${order.payerAgentId}:${order.payeeAgentId}:${decision.tax.gross}:${decision.tax.taxAmount}:${state.tick}`),
    kind: 'payment_settled',
    tick: state.tick,
    actorId: order.payerAgentId,
    counterpartyId: order.payeeAgentId,
    amount: decision.tax.gross,
    taxAmount: decision.tax.taxAmount,
    netAmount: decision.tax.net,
    memo: order.memo,
    status: 'confirmed',
    relatedId: order.id,
    policySnapshot: snapshotPolicy(state),
    metadata: {
      orderId: order.id,
    },
  };

  const nextOrders: Record<string, WorkOrderRecord> = {
    ...treasuryAfter.orders,
    [order.id]: {
      ...order,
      state: 'settled' as const,
      settledAtTick: state.tick,
      txId,
    } as WorkOrderRecord,
  };

  return {
    state: recordTransaction(
      recordEvent(
        applyMilestone(
          {
            ...treasuryAfter,
            orders: nextOrders,
          },
          order.memo.includes('Post-governance bonus') ? 'post-change-payment' : 'payment-settled',
        ),
        'payment-settled',
        `Settled order ${order.id} from ${order.payerAgentId} to ${order.payeeAgentId}.`,
        order.payerAgentId,
        { orderId: order.id, txId },
      ),
      paymentTx,
    ),
    transaction: paymentTx,
    settled: true,
    reason: null,
  };
};

export function applyAction(state: EconomyState, action: EconomyAction): EconomyState {
  switch (action.type) {
    case 'open_shop': {
      const agent = state.agents[action.agentId];
      if (!agent) {
        return state;
      }

      if (agent.shopId && state.shops[agent.shopId]) {
        return state;
      }

      const shop: ShopRecord = {
        id: deriveId('shop', action.agentId),
        ownerAgentId: action.agentId,
        title: action.title,
        active: true,
        serviceIds: [],
        createdAtTick: state.tick,
      };

      const nextState = updateAgent(state, action.agentId, (record) => ({
        ...record,
        shopId: shop.id,
      }));

      return recordTransaction(
        recordEvent(
          applyMilestone(
            {
              ...nextState,
              shops: {
                ...nextState.shops,
                [shop.id]: shop,
              },
            },
            'shop-opened',
          ),
          'shop-opened',
          `${action.title} opened with shop id ${shop.id}.`,
          action.agentId,
          { shopId: shop.id },
        ),
        {
          id: deriveId('tx', 'open-shop', action.agentId, state.tick, state.transactions.length),
          kind: 'open_shop',
          tick: state.tick,
          actorId: action.agentId,
          amount: 0,
          taxAmount: 0,
          netAmount: 0,
          memo: action.title,
          status: 'confirmed',
          policySnapshot: snapshotPolicy(state),
          relatedId: shop.id,
        },
      );
    }
    case 'list_service': {
      const shop = state.shops[action.shopId];
      const agent = state.agents[action.agentId];
      if (!shop || !agent) {
        return state;
      }

      const service: ServiceRecord = {
        id: action.serviceId,
        providerAgentId: action.agentId,
        shopId: action.shopId,
        kind: action.kind,
        title: action.title,
        price: action.price,
        capacity: action.capacity,
        active: true,
        createdAtTick: state.tick,
      };

      return recordTransaction(
        recordEvent(
          applyMilestone(
            {
              ...state,
              shops: {
                ...state.shops,
                [shop.id]: {
                  ...shop,
                  serviceIds: shop.serviceIds.includes(service.id)
                    ? shop.serviceIds
                    : [...shop.serviceIds, service.id],
                },
              },
              services: {
                ...state.services,
                [service.id]: service,
              },
            },
            'service-listed',
          ),
          'service-listed',
          `${agent.name} listed ${service.title} at ${service.price}.`,
          action.agentId,
          { serviceId: service.id, price: service.price, kind: service.kind },
        ),
        {
          id: deriveId('tx', 'service', action.serviceId, state.tick, state.transactions.length),
          kind: 'list_service',
          tick: state.tick,
          actorId: action.agentId,
          amount: 0,
          taxAmount: 0,
          netAmount: 0,
          memo: action.title,
          status: 'confirmed',
          policySnapshot: snapshotPolicy(state),
          relatedId: service.id,
        },
      );
    }
    case 'create_order': {
      const payerAgent = state.agents[action.payerAgentId];
      const payeeAgent = state.agents[action.payeeAgentId];
      const payerWallet = payerAgent ? getWallet(state, payerAgent.walletId) : null;
      const payeeWallet = payeeAgent ? getWallet(state, payeeAgent.walletId) : null;

      if (!payerWallet || !payeeWallet) {
        return state;
      }

      const spendable = payerWallet.balance - payerWallet.reserved;
      if (spendable - action.amount < payerWallet.minBalance || spendable - action.amount < state.covenant.policy.minAgentBalance) {
        return recordEvent(
          state,
          'order-blocked',
          `Order ${action.orderId} could not reserve ${action.amount}.`,
          action.agentId,
          { orderId: action.orderId, amount: action.amount },
        );
      }

      const order: WorkOrderRecord = {
        id: action.orderId,
        payerAgentId: action.payerAgentId,
        payeeAgentId: action.payeeAgentId,
        serviceId: action.serviceId,
        amount: action.amount,
        memo: action.memo,
        reservedAmount: action.amount,
        state: 'reserved',
        createdAtTick: state.tick,
      };

      return recordTransaction(
        recordEvent(
          applyMilestone(
            {
              ...updateWallet(state, payerWallet.id, (wallet) => reserveBudget(wallet, action.amount)),
              orders: {
                ...state.orders,
                [order.id]: order,
              },
            },
            'order-reserved',
          ),
          'order-created',
          `${action.agentId} reserved ${action.amount} for ${action.memo}.`,
          action.agentId,
          { orderId: order.id, amount: order.amount, serviceId: order.serviceId },
        ),
        {
          id: deriveId('tx', 'order', action.orderId, state.tick, state.transactions.length),
          kind: 'order_created',
          tick: state.tick,
          actorId: action.agentId,
          counterpartyId: action.payeeAgentId,
          amount: action.amount,
          taxAmount: 0,
          netAmount: 0,
          memo: action.memo,
          status: 'confirmed',
          relatedId: order.id,
          policySnapshot: snapshotPolicy(state),
        },
      );
    }
    case 'settle_order': {
      const order = state.orders[action.orderId];
      if (!order || order.state !== 'reserved') {
        return state;
      }

      const result = applySettlement(state, order, {
        id: order.id,
        fromId: order.payerAgentId,
        toId: order.payeeAgentId,
        amount: order.amount,
        memo: order.memo,
        tick: state.tick,
      });

      return result.state;
    }
    case 'propose_change': {
      const nextCovenant = covenantWorldSkill.methods.proposeChange(state.covenant, {
        id: action.proposalId,
        proposerId: action.agentId,
        title: action.title,
        description: action.description,
        patch: action.patch,
        createdAtTick: state.tick,
      });

      const nextState = {
        ...state,
        covenant: nextCovenant,
      };

      return recordTransaction(
        recordEvent(
          applyMilestone(nextState, 'proposal-created'),
          'proposal-created',
          `${action.agentId} proposed "${action.title}".`,
          action.agentId,
          { proposalId: action.proposalId },
        ),
        {
          id: deriveId('tx', 'proposal', action.proposalId, state.tick, state.transactions.length),
          kind: 'proposal_created',
          tick: state.tick,
          actorId: action.agentId,
          amount: 0,
          taxAmount: 0,
          netAmount: 0,
          memo: action.title,
          status: 'confirmed',
          relatedId: action.proposalId,
          policySnapshot: snapshotPolicy(state),
        },
      );
    }
    case 'vote': {
      const nextCovenant = covenantWorldSkill.methods.vote(state.covenant, action.proposalId, action.agentId, action.choice);
      const nextState = {
        ...state,
        covenant: nextCovenant,
      };

      return recordTransaction(
        recordEvent(
          applyMilestone(nextState, 'vote-cast'),
          'vote-cast',
          `${action.agentId} voted ${action.choice} on ${action.proposalId}.`,
          action.agentId,
          { proposalId: action.proposalId, choice: action.choice },
        ),
        {
          id: deriveId('tx', 'vote', action.proposalId, action.agentId, state.tick, state.transactions.length),
          kind: 'vote_cast',
          tick: state.tick,
          actorId: action.agentId,
          amount: 0,
          taxAmount: 0,
          netAmount: 0,
          memo: `${action.choice}:${action.proposalId}`,
          status: 'confirmed',
          relatedId: action.proposalId,
          policySnapshot: snapshotPolicy(state),
        },
      );
    }
    case 'execute_change': {
      const result = covenantWorldSkill.methods.executeChange(state.covenant, action.proposalId, state.tick);
      const nextState = {
        ...state,
        covenant: result.state,
      };

      const proposal = result.proposal as GovernanceProposal;

      return recordTransaction(
        recordEvent(
          applyMilestone(nextState, result.changed ? 'covenant-updated' : 'proposal-execution-failed'),
          'proposal-executed',
          result.changed
            ? `${action.proposalId} executed and updated covenant rules.`
            : `${action.proposalId} did not execute: ${result.reason ?? 'unknown reason'}.`,
          action.agentId,
          { proposalId: action.proposalId, changed: result.changed, reason: result.reason ?? null },
        ),
        {
          id: deriveId('tx', 'execute', action.proposalId, state.tick, state.transactions.length),
          kind: 'proposal_executed',
          tick: state.tick,
          actorId: action.agentId,
          amount: 0,
          taxAmount: 0,
          netAmount: 0,
          memo: proposal.title,
          status: result.changed ? 'confirmed' : 'rejected',
          relatedId: action.proposalId,
          policySnapshot: snapshotPolicy(state),
          metadata: {
            changed: result.changed,
          },
        },
      );
    }
    default:
      return state;
  }
};

export const createInitialEconomyState = (input: {
  chainId: number;
  rpcUrl: string;
  agents: Record<string, AgentRecord>;
  wallets: Record<string, WalletRecord>;
}): EconomyState => ({
  tick: 0,
  chainId: input.chainId,
  rpcUrl: input.rpcUrl,
  wallets: input.wallets,
  agents: input.agents,
  shops: {},
  services: {},
  orders: {},
  transactions: [],
  events: [],
  covenant: {
    policy: covenantWorldSkill.methods.createDefaultPolicy(),
    treasuryBalance: 0,
    collectedTax: 0,
    proposals: {},
  },
  milestones: installedWorldEconomySkills.map((skill) => `skill:${skill.id}`),
});

export const applyMilestone = (state: EconomyState, milestone: string): EconomyState => {
  if (state.milestones.includes(milestone)) {
    return state;
  }

  return {
    ...state,
    milestones: [...state.milestones, milestone],
  };
};

export const createPolicyTransaction = (
  id: string,
  fromId: string,
  toId: string,
  amount: number,
  memo: string,
  tick: number,
): PolicyTransaction => ({
  id,
  fromId,
  toId,
  amount,
  memo,
  tick,
});
