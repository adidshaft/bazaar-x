import type { CovenantState, GovernancePatch, VoteChoice } from '../../covenant-skill/types';

export type AgentRole = 'shop' | 'supplier' | 'worker' | 'governor' | 'treasury';

export type EconomyTxKind =
  | 'open_shop'
  | 'list_service'
  | 'order_created'
  | 'payment_settled'
  | 'proposal_created'
  | 'vote_cast'
  | 'proposal_executed';

export type TransactionStatus = 'confirmed' | 'rejected';

export interface WalletRecord {
  id: string;
  address: string;
  balance: number;
  reserved: number;
  minBalance: number;
  budgetCap: number;
  label: string;
}

export interface AgentRecord {
  id: string;
  role: AgentRole;
  name: string;
  walletId: string;
  objective: string;
  targetReserve: number;
  active: boolean;
  shopId?: string;
}

export interface ShopRecord {
  id: string;
  ownerAgentId: string;
  title: string;
  active: boolean;
  serviceIds: string[];
  createdAtTick: number;
}

export interface ServiceRecord {
  id: string;
  providerAgentId: string;
  shopId: string;
  kind: 'labor' | 'supply' | 'operations';
  title: string;
  price: number;
  capacity: number;
  active: boolean;
  createdAtTick: number;
}

export interface WorkOrderRecord {
  id: string;
  payerAgentId: string;
  payeeAgentId: string;
  serviceId: string;
  amount: number;
  memo: string;
  reservedAmount: number;
  state: 'reserved' | 'settled' | 'cancelled';
  createdAtTick: number;
  settledAtTick?: number;
  txId?: string;
}

export interface PolicySnapshot {
  taxBps: number;
  minAgentBalance: number;
  proposalApprovalBps: number;
  proposalQuorum: number;
  executionDelayTicks: number;
}

export interface TransactionRecord {
  id: string;
  hash: string;
  kind: EconomyTxKind;
  tick: number;
  actorId: string;
  counterpartyId?: string;
  amount: number;
  taxAmount: number;
  netAmount: number;
  memo: string;
  status: TransactionStatus;
  relatedId?: string;
  policySnapshot: PolicySnapshot;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface SimulationEvent {
  id: string;
  tick: number;
  actorId?: string;
  type: string;
  message: string;
  data?: Record<string, string | number | boolean | null>;
}

export interface AgentDecisionContext {
  state: EconomyState;
  agent: AgentRecord;
  tick: number;
}

export type EconomyAction =
  | {
      type: 'open_shop';
      agentId: string;
      title: string;
    }
  | {
      type: 'list_service';
      agentId: string;
      shopId: string;
      serviceId: string;
      title: string;
      kind: 'labor' | 'supply' | 'operations';
      price: number;
      capacity: number;
    }
  | {
      type: 'create_order';
      agentId: string;
      orderId: string;
      payerAgentId: string;
      payeeAgentId: string;
      serviceId: string;
      amount: number;
      memo: string;
    }
  | {
      type: 'settle_order';
      agentId: string;
      orderId: string;
    }
  | {
      type: 'propose_change';
      agentId: string;
      proposalId: string;
      title: string;
      description: string;
      patch: GovernancePatch;
    }
  | {
      type: 'vote';
      agentId: string;
      proposalId: string;
      choice: VoteChoice;
    }
  | {
      type: 'execute_change';
      agentId: string;
      proposalId: string;
    };

export interface EconomyState {
  tick: number;
  chainId: number;
  rpcUrl: string;
  wallets: Record<string, WalletRecord>;
  agents: Record<string, AgentRecord>;
  shops: Record<string, ShopRecord>;
  services: Record<string, ServiceRecord>;
  orders: Record<string, WorkOrderRecord>;
  transactions: TransactionRecord[];
  events: SimulationEvent[];
  covenant: CovenantState;
  milestones: string[];
}

export interface SimulationConfig {
  ticks: number;
  chainId: number;
  rpcUrl: string;
}

export interface SimulationSummary {
  totalTransactions: number;
  paymentTransactions: number;
  taxCollected: number;
  treasuryBalance: number;
  milestones: string[];
  finalTaxBps: number;
  proposalStatus: string | null;
}

export interface SimulationResult {
  state: EconomyState;
  summary: SimulationSummary;
  timeline: Array<{
    tick: number;
    transactionHashes: string[];
    events: string[];
  }>;
}
