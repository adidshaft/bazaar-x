import { createHash, randomUUID } from "node:crypto";
import {
  ARTIFACT_DIR,
  AGENTS_ARTIFACT_PATH,
  ECONOMY_ARTIFACT_PATH,
  GOVERNANCE_ARTIFACT_PATH,
} from "./config";
import { readArtifact, writeArtifactSnapshot } from "./artifacts";
import {
  CovenantPolicy,
  CovenantProposal,
  CovenantTransaction,
  executeChange,
  proposeChange,
  vote as castCovenantVote,
} from "./covenant";
import { jsonClone } from "./json";

export type AgentRole = "shop" | "supplier" | "worker" | "governor" | "treasury";

export type BazaarAgent = {
  id: string;
  role: AgentRole;
  name: string;
  walletLabel: string;
  budget: number;
  goals: string[];
};

export type EconomySnapshot = {
  round: number;
  treasury: number;
  policy: CovenantPolicy;
  transactions: CovenantTransaction[];
  totals: {
    earned: number;
    paid: number;
    taxed: number;
  };
};

export type GovernanceSnapshot = {
  policy: CovenantPolicy;
  proposals: CovenantProposal[];
  votes: Array<ReturnType<typeof castCovenantVote>>;
};

export type AgentSnapshot = {
  agents: BazaarAgent[];
  economy: EconomySnapshot;
  governance: GovernanceSnapshot;
  artifact: {
    dir: string;
    agents: string;
    economy: string;
    governance: string;
  };
};

function deterministicId(seed: string, index: number, role: AgentRole) {
  const hash = createHash("sha256").update(`${seed}:${index}:${role}`).digest("hex");
  return `agent_${role}_${hash.slice(0, 10)}`;
}

function deterministicName(role: AgentRole, index: number) {
  const presets: Record<AgentRole, string[]> = {
    shop: ["Market House", "Bazaar Forge", "Signal Shop"],
    supplier: ["Supply Loop", "Cargo Node", "Inventory Grid"],
    worker: ["Pulse Worker", "Task Runner", "Flow Operator"],
    governor: ["Covenant Council", "Policy Ledger", "Steward Node"],
    treasury: ["Treasury Vault", "Reserve Chest", "Protocol Safe"],
  };
  return presets[role][index % presets[role].length];
}

function basePolicy(overrides?: Partial<CovenantPolicy>): CovenantPolicy {
  return {
    taxBps: overrides?.taxBps ?? 250,
    minimumBalance: overrides?.minimumBalance ?? 100,
    quorumBps: overrides?.quorumBps ?? 5_000,
    executionDelayRounds: overrides?.executionDelayRounds ?? 1,
  };
}

export function initializeAgents({
  count,
  seed,
  initialBudget,
}: {
  count: number;
  seed: string;
  initialBudget: number;
}) {
  if (!Number.isFinite(count) || count < 3) {
    throw new Error("Agent count must be at least 3.");
  }

  const roles: AgentRole[] = ["shop", "supplier", "worker", "governor", "treasury"];
  const agents: BazaarAgent[] = Array.from({ length: count }).map((_, index) => {
    const role = roles[index % roles.length];
    return {
      id: deterministicId(seed, index, role),
      role,
      name: deterministicName(role, index),
      walletLabel: `${role.toUpperCase()}-${index + 1}`,
      budget: initialBudget,
      goals: [
        role === "shop" ? "Grow demand" : "Complete profitable work",
        role === "governor" ? "Protect treasury health" : "Stay solvent",
      ],
    };
  });

  const policy = basePolicy();
  const economy: EconomySnapshot = {
    round: 0,
    treasury: 0,
    policy,
    transactions: [],
    totals: { earned: 0, paid: 0, taxed: 0 },
  };

  const governance: GovernanceSnapshot = {
    policy,
    proposals: [],
    votes: [],
  };

  return {
    agents,
    economy,
    governance,
    artifact: {
      dir: ARTIFACT_DIR,
      agents: AGENTS_ARTIFACT_PATH,
      economy: ECONOMY_ARTIFACT_PATH,
      governance: GOVERNANCE_ARTIFACT_PATH,
    },
  } satisfies AgentSnapshot;
}

export async function persistAgentsSnapshot(snapshot: AgentSnapshot) {
  await writeArtifactSnapshot(snapshot.artifact.agents, snapshot);
  await writeArtifactSnapshot(snapshot.artifact.economy, snapshot.economy);
  await writeArtifactSnapshot(snapshot.artifact.governance, snapshot.governance);
  return snapshot;
}

export async function persistEconomySnapshot(snapshot: EconomySnapshot) {
  await writeArtifactSnapshot(ECONOMY_ARTIFACT_PATH, snapshot);
  return snapshot;
}

export async function persistGovernanceSnapshot(snapshot: GovernanceSnapshot) {
  await writeArtifactSnapshot(GOVERNANCE_ARTIFACT_PATH, snapshot);
  return snapshot;
}

export async function loadLatestAgentsSnapshot(): Promise<AgentSnapshot | null> {
  const snapshot = await readArtifact<AgentSnapshot>(AGENTS_ARTIFACT_PATH);
  if (!snapshot) {
    return null;
  }
  return snapshot;
}

export function createProposalDraft({
  proposerId,
  title,
  description,
  policyPatch,
}: {
  proposerId: string;
  title: string;
  description: string;
  policyPatch: Partial<CovenantPolicy>;
}) {
  return proposeChange({
    id: `proposal_${randomUUID()}`,
    proposerId,
    title,
    description,
    policyPatch,
  });
}

export function castVote({
  governance,
  proposalId,
  voterId,
  support,
  weight,
}: {
  governance: GovernanceSnapshot;
  proposalId: string;
  voterId: string;
  support: boolean;
  weight?: number;
}) {
  const proposal = governance.proposals.find((entry) => entry.id === proposalId);
  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found.`);
  }

  const voteWeight = weight ?? 1;
  const vote = castCovenantVote(proposal, support, voteWeight, voterId);
  governance.votes.push(vote);
  return vote;
}

export function executeProposal({
  governance,
  proposalId,
}: {
  governance: GovernanceSnapshot;
  proposalId: string;
}) {
  const proposal = governance.proposals.find((entry) => entry.id === proposalId);
  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found.`);
  }

  if (proposal.voteTally.yes <= proposal.voteTally.no) {
    proposal.status = "failed";
    return {
      ok: false,
      reason: "Proposal did not pass.",
      proposal,
    };
  }

  governance.policy = executeChange(proposal, governance.policy);
  return {
    ok: true,
    proposal,
    policy: governance.policy,
  };
}

export function loadAgentByRole(snapshot: AgentSnapshot, role: AgentRole) {
  return snapshot.agents.find((agent) => agent.role === role) ?? null;
}

export function cloneSnapshot(snapshot: AgentSnapshot) {
  return jsonClone(snapshot);
}
