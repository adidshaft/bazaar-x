export type CovenantPolicy = {
  taxBps: number;
  minimumBalance: number;
  quorumBps: number;
  executionDelayRounds: number;
};

export type CovenantTransaction = {
  id: string;
  from: string;
  to: string;
  amount: number;
  type: "transfer" | "payment" | "treasury" | "governance";
  memo?: string;
};

export type CovenantState = {
  policy: CovenantPolicy;
  treasury: number;
  balances: Record<string, number>;
  proposals: CovenantProposal[];
  votes: CovenantVote[];
};

export type CovenantProposal = {
  id: string;
  title: string;
  description: string;
  proposerId: string;
  policyPatch: Partial<CovenantPolicy>;
  status: "draft" | "active" | "passed" | "failed" | "executed";
  createdAt: string;
  voteTally: {
    yes: number;
    no: number;
    total: number;
  };
  execution?: {
    executedAt: string;
    appliedPolicy: CovenantPolicy;
  };
};

export type CovenantVote = {
  id: string;
  proposalId: string;
  voterId: string;
  support: boolean;
  weight: number;
  createdAt: string;
};

export type EnforcementResult = {
  allowed: boolean;
  taxAmount: number;
  treasuryDelta: number;
  reason?: string;
};

export function applyTax(amount: number, taxBps: number) {
  return Math.max(0, Math.floor((amount * taxBps) / 10_000));
}

export function checkBalanceRules(balance: number, minimumBalance: number) {
  return balance >= minimumBalance;
}

export function enforcePolicy(
  tx: CovenantTransaction,
  state: CovenantState,
  nextBalance: number
): EnforcementResult {
  if (tx.amount <= 0) {
    return { allowed: false, taxAmount: 0, treasuryDelta: 0, reason: "Amount must be positive." };
  }

  if (!checkBalanceRules(nextBalance, state.policy.minimumBalance)) {
    return {
      allowed: false,
      taxAmount: 0,
      treasuryDelta: 0,
      reason: "Minimum balance rule would be violated.",
    };
  }

  const taxAmount = applyTax(tx.amount, state.policy.taxBps);
  return {
    allowed: true,
    taxAmount,
    treasuryDelta: taxAmount,
  };
}

export function proposeChange(
  proposal: Omit<CovenantProposal, "status" | "voteTally" | "createdAt"> & {
    createdAt?: string;
  }
): CovenantProposal {
  return {
    ...proposal,
    status: "draft",
    createdAt: proposal.createdAt ?? new Date().toISOString(),
    voteTally: { yes: 0, no: 0, total: 0 },
  };
}

export function vote(
  proposal: CovenantProposal,
  support: boolean,
  weight: number,
  voterId: string
) {
  const nextVote: CovenantVote = {
    id: `${proposal.id}:${voterId}:${Date.now()}`,
    proposalId: proposal.id,
    voterId,
    support,
    weight,
    createdAt: new Date().toISOString(),
  };

  proposal.status = "active";
  proposal.voteTally.total += weight;
  if (support) {
    proposal.voteTally.yes += weight;
  } else {
    proposal.voteTally.no += weight;
  }

  return nextVote;
}

export function executeChange(
  proposal: CovenantProposal,
  policy: CovenantPolicy
): CovenantPolicy {
  proposal.status = "executed";
  const appliedPolicy = {
    taxBps: proposal.policyPatch.taxBps ?? policy.taxBps,
    minimumBalance: proposal.policyPatch.minimumBalance ?? policy.minimumBalance,
    quorumBps: proposal.policyPatch.quorumBps ?? policy.quorumBps,
    executionDelayRounds:
      proposal.policyPatch.executionDelayRounds ?? policy.executionDelayRounds,
  };

  proposal.execution = {
    executedAt: new Date().toISOString(),
    appliedPolicy,
  };

  return appliedPolicy;
}
