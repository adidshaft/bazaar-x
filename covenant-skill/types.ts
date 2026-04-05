export type VoteChoice = 'for' | 'against';

export type ProposalStatus = 'pending' | 'active' | 'passed' | 'rejected' | 'executed';

export type GovernancePatch =
  | { kind: 'taxBps'; value: number }
  | { kind: 'minAgentBalance'; value: number }
  | { kind: 'proposalApprovalBps'; value: number }
  | { kind: 'proposalQuorum'; value: number }
  | { kind: 'executionDelayTicks'; value: number };

export interface PolicyRuleSet {
  taxBps: number;
  minAgentBalance: number;
  proposalApprovalBps: number;
  proposalQuorum: number;
  executionDelayTicks: number;
  minTreasuryBalance: number;
  taxCapBps: number;
}

export interface BalanceSnapshot {
  balance: number;
  reserved: number;
  minBalance: number;
}

export interface PolicyTransaction {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  memo: string;
  tick: number;
}

export interface PolicyContext {
  treasuryBalance: number;
  sender: BalanceSnapshot;
  receiver?: BalanceSnapshot;
}

export interface TaxBreakdown {
  gross: number;
  taxAmount: number;
  net: number;
  effectiveBps: number;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string | null;
  tax: TaxBreakdown;
  postBalance: number;
}

export interface GovernanceProposal {
  id: string;
  proposerId: string;
  title: string;
  description: string;
  patch: GovernancePatch;
  createdAtTick: number;
  voteYes: string[];
  voteNo: string[];
  status: ProposalStatus;
  executedAtTick?: number;
}

export interface CovenantState {
  policy: PolicyRuleSet;
  treasuryBalance: number;
  collectedTax: number;
  proposals: Record<string, GovernanceProposal>;
}

export interface CreateProposalInput {
  id: string;
  proposerId: string;
  title: string;
  description: string;
  patch: GovernancePatch;
  createdAtTick: number;
}

export interface GovernanceResult {
  state: CovenantState;
  proposal: GovernanceProposal;
  changed: boolean;
  reason: string | null;
}
