import { randomUUID, createHash } from "node:crypto";
import {
  BazaarAgent,
  EconomySnapshot,
  GovernanceSnapshot,
} from "./agents";
import { applyTax, enforcePolicy, CovenantTransaction } from "./covenant";

function seedNumber(seed: string) {
  return Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
}

function pick<T>(items: T[], seed: string, offset: number) {
  const index = (seedNumber(seed) + offset) % items.length;
  return items[index];
}

export function runEconomySimulation({
  agents,
  governance,
  economy,
  rounds,
  taxBps,
  seed,
}: {
  agents: BazaarAgent[];
  governance: GovernanceSnapshot;
  economy: EconomySnapshot;
  rounds: number;
  taxBps: number;
  seed: string;
}) {
  const nextAgents = agents.map((agent) => ({ ...agent }));
  const nextEconomy: EconomySnapshot = {
    ...economy,
    round: economy.round,
    policy: {
      ...economy.policy,
      taxBps,
    },
    transactions: [...economy.transactions],
    totals: { ...economy.totals },
  };

  const shop = nextAgents.find((agent) => agent.role === "shop") ?? nextAgents[0];
  const supplier = nextAgents.find((agent) => agent.role === "supplier") ?? nextAgents[1];
  const worker = nextAgents.find((agent) => agent.role === "worker") ?? nextAgents[2];
  const governor = nextAgents.find((agent) => agent.role === "governor") ?? nextAgents[3];
  const treasury = nextAgents.find((agent) => agent.role === "treasury");

  if (!shop || !supplier || !worker || !governor) {
    throw new Error("Simulation requires at least one shop, supplier, worker, and governor agent.");
  }

  const generatedTransactions: CovenantTransaction[] = [];

  for (let i = 0; i < rounds; i += 1) {
    const serviceValue = 100 + (seedNumber(`${seed}:${i}`) % 200);
    const hirePayment = Math.max(25, Math.floor(serviceValue * 0.6));
    const tax = applyTax(hirePayment, taxBps);

    const paymentTx: CovenantTransaction = {
      id: `tx_${randomUUID()}`,
      from: shop.id,
      to: worker.id,
      amount: hirePayment,
      type: "payment",
      memo: `Round ${nextEconomy.round + 1} service hire`,
    };

    const balanceAfterPayment = shop.budget - hirePayment;
    const enforcement = enforcePolicy(
      paymentTx,
      {
        balances: Object.fromEntries(nextAgents.map((agent) => [agent.id, agent.budget])),
        policy: nextEconomy.policy,
        treasury: nextEconomy.treasury,
        proposals: governance.proposals,
        votes: governance.votes,
      },
      balanceAfterPayment
    );

    if (!enforcement.allowed) {
      continue;
    }

    shop.budget -= hirePayment;
    worker.budget += hirePayment - tax;
    supplier.budget += Math.floor(hirePayment * 0.1);
    nextEconomy.treasury += tax;
    if (treasury) {
      treasury.budget += tax;
    }

    generatedTransactions.push(paymentTx);
    generatedTransactions.push({
      id: `tx_${randomUUID()}`,
      from: worker.id,
      to: treasury?.id ?? "treasury_vault",
      amount: tax,
      type: "treasury",
      memo: "Covenant tax routed to treasury",
    });

    nextEconomy.totals.earned += serviceValue;
    nextEconomy.totals.paid += hirePayment;
    nextEconomy.totals.taxed += tax;
    nextEconomy.round += 1;
  }

  const proposalTrigger = pick(nextAgents, seed, nextEconomy.round);
  if (proposalTrigger.role !== "governor") {
    governance.proposals.push({
      id: `proposal_${randomUUID()}`,
      title: "Adaptive treasury policy",
      description: "Raise tax slightly when treasury reserves are below target.",
      proposerId: governor.id,
      policyPatch: {
        taxBps: Math.min(500, nextEconomy.policy.taxBps + 25),
      },
      status: "active",
      createdAt: new Date().toISOString(),
      voteTally: { yes: 2, no: 0, total: 2 },
    });
  }

  return {
    agents: nextAgents,
    economy: {
      ...nextEconomy,
      transactions: [...nextEconomy.transactions, ...generatedTransactions],
    },
    governance,
    summary: {
      roundsRequested: rounds,
      roundsExecuted: nextEconomy.round,
      treasury: nextEconomy.treasury,
      taxBps,
    },
  };
}
