import {
  BalanceSnapshot,
  CovenantState,
  CreateProposalInput,
  GovernancePatch,
  GovernanceProposal,
  GovernanceResult,
  PolicyContext,
  PolicyDecision,
  PolicyRuleSet,
  PolicyTransaction,
  TaxBreakdown,
  VoteChoice,
} from './types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const copyProposal = (proposal: GovernanceProposal): GovernanceProposal => ({
  ...proposal,
  voteYes: [...proposal.voteYes],
  voteNo: [...proposal.voteNo],
});

export const createDefaultPolicy = (): PolicyRuleSet => ({
  taxBps: 500,
  minAgentBalance: 25,
  proposalApprovalBps: 6000,
  proposalQuorum: 2,
  executionDelayTicks: 1,
  minTreasuryBalance: 0,
  taxCapBps: 2500,
});

export function applyTax(amount: number, policy: PolicyRuleSet): TaxBreakdown {
  const effectiveBps = clamp(policy.taxBps, 0, policy.taxCapBps);
  const taxAmount = Math.floor((amount * effectiveBps) / 10000);
  return {
    gross: amount,
    taxAmount,
    net: amount - taxAmount,
    effectiveBps,
  };
}

export function checkBalanceRules(
  sender: BalanceSnapshot,
  amount: number,
  policy: PolicyRuleSet,
): { allowed: boolean; reason: string | null; postBalance: number } {
  if (amount <= 0) {
    return { allowed: false, reason: 'Amount must be positive.', postBalance: sender.balance };
  }

  if (sender.reserved > sender.balance) {
    return {
      allowed: false,
      reason: 'Reserved balance exceeds wallet balance.',
      postBalance: sender.balance,
    };
  }

  const spendable = sender.balance - sender.reserved;
  const postBalance = spendable - amount;

  if (postBalance < sender.minBalance) {
    return {
      allowed: false,
      reason: `Sender must keep at least ${sender.minBalance} available.`,
      postBalance,
    };
  }

  if (postBalance < policy.minAgentBalance) {
    return {
      allowed: false,
      reason: `Policy requires at least ${policy.minAgentBalance} after settlement.`,
      postBalance,
    };
  }

  return { allowed: true, reason: null, postBalance };
}

export function enforcePolicy(
  tx: PolicyTransaction,
  context: PolicyContext,
  policy: PolicyRuleSet,
): PolicyDecision {
  const balanceCheck = checkBalanceRules(context.sender, tx.amount, policy);
  if (!balanceCheck.allowed) {
    return {
      allowed: false,
      reason: balanceCheck.reason,
      tax: {
        gross: tx.amount,
        taxAmount: 0,
        net: tx.amount,
        effectiveBps: 0,
      },
      postBalance: balanceCheck.postBalance,
    };
  }

  if (context.treasuryBalance < policy.minTreasuryBalance) {
    return {
      allowed: false,
      reason: `Treasury floor requires at least ${policy.minTreasuryBalance}.`,
      tax: {
        gross: tx.amount,
        taxAmount: 0,
        net: tx.amount,
        effectiveBps: 0,
      },
      postBalance: balanceCheck.postBalance,
    };
  }

  const tax = applyTax(tx.amount, policy);
  return {
    allowed: true,
    reason: null,
    tax,
    postBalance: balanceCheck.postBalance,
  };
}

export function proposeChange(
  state: CovenantState,
  input: CreateProposalInput,
): CovenantState {
  if (state.proposals[input.id]) {
    return state;
  }

  const proposal: GovernanceProposal = {
    id: input.id,
    proposerId: input.proposerId,
    title: input.title,
    description: input.description,
    patch: input.patch,
    createdAtTick: input.createdAtTick,
    voteYes: [],
    voteNo: [],
    status: 'active',
  };

  return {
    ...state,
    proposals: {
      ...state.proposals,
      [proposal.id]: proposal,
    },
  };
}

export function vote(
  state: CovenantState,
  proposalId: string,
  voterId: string,
  choice: VoteChoice,
): CovenantState {
  const proposal = state.proposals[proposalId];
  if (!proposal || proposal.status !== 'active') {
    return state;
  }

  const nextProposal = copyProposal(proposal);
  nextProposal.voteYes = nextProposal.voteYes.filter((id) => id !== voterId);
  nextProposal.voteNo = nextProposal.voteNo.filter((id) => id !== voterId);

  if (choice === 'for') {
    nextProposal.voteYes.push(voterId);
  } else {
    nextProposal.voteNo.push(voterId);
  }

  return {
    ...state,
    proposals: {
      ...state.proposals,
      [proposalId]: nextProposal,
    },
  };
}

const applyPatch = (policy: PolicyRuleSet, patch: GovernancePatch): PolicyRuleSet => {
  switch (patch.kind) {
    case 'taxBps':
      return { ...policy, taxBps: clamp(patch.value, 0, policy.taxCapBps) };
    case 'minAgentBalance':
      return { ...policy, minAgentBalance: Math.max(0, patch.value) };
    case 'proposalApprovalBps':
      return { ...policy, proposalApprovalBps: clamp(patch.value, 0, 10000) };
    case 'proposalQuorum':
      return { ...policy, proposalQuorum: Math.max(1, patch.value) };
    case 'executionDelayTicks':
      return { ...policy, executionDelayTicks: Math.max(0, patch.value) };
    default:
      return policy;
  }
};

const proposalOutcome = (
  proposal: GovernanceProposal,
  policy: PolicyRuleSet,
): { passed: boolean; reason: string | null } => {
  const totalVotes = proposal.voteYes.length + proposal.voteNo.length;
  if (totalVotes < policy.proposalQuorum) {
    return { passed: false, reason: `Quorum of ${policy.proposalQuorum} not reached.` };
  }

  if (proposal.voteYes.length === 0) {
    return { passed: false, reason: 'No affirmative votes recorded.' };
  }

  const approvalBps = Math.floor((proposal.voteYes.length * 10000) / totalVotes);
  if (approvalBps < policy.proposalApprovalBps) {
    return { passed: false, reason: 'Approval threshold not reached.' };
  }

  return { passed: true, reason: null };
};

export function executeChange(
  state: CovenantState,
  proposalId: string,
  currentTick: number,
): GovernanceResult {
  const proposal = state.proposals[proposalId];
  if (!proposal) {
    return {
      state,
      proposal: {
        id: proposalId,
        proposerId: 'unknown',
        title: 'Unknown proposal',
        description: '',
        patch: { kind: 'taxBps', value: state.policy.taxBps },
        createdAtTick: currentTick,
        voteYes: [],
        voteNo: [],
        status: 'rejected',
      },
      changed: false,
      reason: 'Proposal not found.',
    };
  }

  const eligibleTick = proposal.createdAtTick + state.policy.executionDelayTicks;
  if (currentTick < eligibleTick) {
    return {
      state,
      proposal,
      changed: false,
      reason: `Execution delay requires tick ${eligibleTick} or later.`,
    };
  }

  const outcome = proposalOutcome(proposal, state.policy);
  const nextProposal: GovernanceProposal = {
    ...proposal,
    voteYes: [...proposal.voteYes],
    voteNo: [...proposal.voteNo],
  };

  if (!outcome.passed) {
    nextProposal.status = 'rejected';
    return {
      state: {
        ...state,
        proposals: {
          ...state.proposals,
          [proposalId]: nextProposal,
        },
      },
      proposal: nextProposal,
      changed: false,
      reason: outcome.reason,
    };
  }

  const nextPolicy = applyPatch(state.policy, proposal.patch);
  nextProposal.status = 'executed';
  nextProposal.executedAtTick = currentTick;

  return {
    state: {
      ...state,
      policy: nextPolicy,
      proposals: {
        ...state.proposals,
        [proposalId]: nextProposal,
      },
    },
    proposal: nextProposal,
    changed: true,
    reason: null,
  };
}
