"use client";

import { formatEther } from "viem";
import { useAccount, useBalance } from "wagmi";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ConnectWalletButton } from "./connect-wallet-button";

type AgentRole = "Shop" | "Supplier" | "Worker" | "Governor";

type AgentCard = {
  role: AgentRole;
  name: string;
  wallet: string;
  budget: string;
  goal: string;
  status: string;
  trust: number;
  action: string;
  hash: string;
  badge: string;
  fullAddress?: string;
};

type ProposalCard = {
  id: string;
  title: string;
  description: string;
  effect: string;
  votesFor: number;
  votesAgainst: number;
  quorum: string;
  status: "Open" | "Passed" | "Queued";
};

type TransactionCard = {
  hash: string;
  label: string;
  from: string;
  to: string;
  amount: string;
  fee: string;
  block: string;
  time: string;
  status: "Confirmed" | "Queued";
  explorerUrl?: string;
  detail?: string;
};

type LiveDashboardStatus = {
  runtime: {
    artifactAvailable: boolean;
    agentCount: number;
    round: number;
    treasury: number;
  };
  onchain: {
    address: string;
    chainId: number;
    calls: Record<string, unknown>;
  } | null;
  liveDashboard: {
    manifest: {
      network: string;
      chainId: number;
      rpcUrl: string;
      explorerBaseUrl: string;
      deployer: { address: string };
      treasury: { address: string };
      agents: Array<{
        role: "shop" | "supplier" | "worker" | "governor";
        name: string;
        handle: string;
        goal: string;
        bootstrapOkb: string;
        address: string;
      }>;
    };
    runtime: {
      status: "idle" | "ready" | "running" | "completed" | "failed";
      txHashes: string[];
      steps: Array<{
        key: string;
        label: string;
        status: "pending" | "success" | "failed";
        startedAt: string;
        completedAt?: string;
        txHash?: string;
        explorerUrl?: string;
        detail?: string;
        meta?: Record<string, string | number | boolean | null>;
      }>;
      proposalId?: number;
      firstTaxWei?: string;
      secondTaxWei?: string;
      error?: string;
    } | null;
    funding: {
      readyForDeploy: boolean;
      readyForFlow: boolean;
      deployer: { address: string; balanceOkb: string; funded: boolean };
      treasury: { address: string; balanceOkb: string; funded: boolean };
      agents: Array<{ address: string; balanceOkb: string; funded: boolean }>;
      requiredDeployerBalanceOkb: string;
    };
    onchainSnapshot: {
      collectedAt?: string;
      gatewayGas?: { data?: Array<{ normal?: string; min?: string; max?: string }> };
      error?: string;
    } | null;
    bazaarSnapshot: {
      address: string;
      treasury: string;
      treasuryBalanceOkb: string;
      rules?: readonly unknown[];
      registeredAgentCount: number;
      nextShopId: number;
      nextServiceId: number;
      nextProposalId: number;
    } | null;
  };
  sources: {
    artifacts: Record<string, string>;
    hasOnchain: boolean;
  };
};

type DashboardResponse = {
  ok: true;
  status: LiveDashboardStatus;
};

const fallbackAgents: AgentCard[] = [
  {
    role: "Shop",
    name: "Bazaar Forge",
    wallet: "0x8F...A201",
    budget: "1,250 OKB",
    goal: "Open marketplace listings and route inbound work",
    status: "Selling service bundles",
    trust: 92,
    action: "Listed 3 service tiers on X Layer",
    hash: "0x91b6...f2c1",
    badge: "Primary liquidity source",
  },
  {
    role: "Supplier",
    name: "Supply Coil",
    wallet: "0x2C...E09D",
    budget: "620 OKB",
    goal: "Fulfill jobs and source inventory",
    status: "Fulfilling worker request",
    trust: 88,
    action: "Accepted hire from Bazaar Forge",
    hash: "0x12de...a8f0",
    badge: "Fastest fulfillment",
  },
  {
    role: "Worker",
    name: "Node Pilot",
    wallet: "0x7B...1141",
    budget: "410 OKB",
    goal: "Execute tasks, earn, and compound",
    status: "Processing a paid task",
    trust: 84,
    action: "Completed policy-safe execution",
    hash: "0x43aa...7ce8",
    badge: "Most active agent",
  },
  {
    role: "Governor",
    name: "Covenant Council",
    wallet: "0xC0...FEB9",
    budget: "Treasury controlled",
    goal: "Tune tax, reserve floor, and spending rules",
    status: "Voting on next rule update",
    trust: 97,
    action: "Queued proposal after quorum crossed",
    hash: "0x9f02...3bc4",
    badge: "Protocol steward",
  },
];

const fallbackProposals: ProposalCard[] = [
  {
    id: "P-07",
    title: "Raise treasury tax from 2.5% to 3.25%",
    description: "Higher loop friction funds governance, audits, and emergency reserves.",
    effect: "More tax intake, slower but healthier growth",
    votesFor: 68,
    votesAgainst: 12,
    quorum: "81% of active stake",
    status: "Open",
  },
  {
    id: "P-06",
    title: "Increase min balance floor to 75 OKB",
    description: "Keeps agents solvent before they may hire or pay downstream actors.",
    effect: "Prevents brittle wallets from overcommitting",
    votesFor: 71,
    votesAgainst: 9,
    quorum: "Passed threshold",
    status: "Passed",
  },
];

const fallbackTransactions: TransactionCard[] = [
  {
    hash: "0x7a4d1e...d291",
    label: "Shop creation",
    from: "Bazaar Forge",
    to: "Covenant Council",
    amount: "12 OKB",
    fee: "0.0004 OKB",
    block: "19,442,813",
    time: "12s ago",
    status: "Confirmed",
  },
  {
    hash: "0xc5f019...87fe",
    label: "Worker hire payment",
    from: "Bazaar Forge",
    to: "Node Pilot",
    amount: "48 OKB",
    fee: "0.0004 OKB",
    block: "19,442,811",
    time: "1m ago",
    status: "Confirmed",
  },
  {
    hash: "0x93aa71...ae2c",
    label: "Tax routed to treasury",
    from: "Node Pilot",
    to: "Treasury",
    amount: "1.2 OKB",
    fee: "0.0004 OKB",
    block: "19,442,810",
    time: "2m ago",
    status: "Confirmed",
  },
  {
    hash: "0x1fd88c...3419",
    label: "Governance vote",
    from: "Supply Coil",
    to: "Covenant Council",
    amount: "0 OKB",
    fee: "0.0003 OKB",
    block: "queued",
    time: "now",
    status: "Queued",
  },
];

const economyLoop = ["Earn", "Pay", "Tax", "Treasury", "Vote", "Update"];

const covenantRules = [
  "Minimum balance enforcement before any new hire",
  "Automatic tax deduction on every agent-to-agent payment",
  "Proposal + voting with threshold-based execution",
  "Rule updates that take effect on the next settlement cycle",
];

function shortHash(value: string) {
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatOkb(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "0 OKB";
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return `${value} OKB`;
  }

  return `${numeric.toFixed(numeric >= 1 ? 3 : 5).replace(/\.?0+$/, "")} OKB`;
}

function toRelativeTime(timestamp?: string) {
  if (!timestamp) {
    return "now";
  }

  const diff = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(diff)) {
    return "now";
  }

  const seconds = Math.max(1, Math.floor(diff / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function ruleValue(rules: unknown, index: number) {
  if (Array.isArray(rules) && rules.length > index) {
    return rules[index];
  }
  return null;
}

function statusTrust(status: string) {
  switch (status) {
    case "completed":
      return 97;
    case "running":
      return 88;
    case "ready":
      return 82;
    case "failed":
      return 42;
    default:
      return 70;
  }
}

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (payload as { error?: string; message?: string } | null)?.error ??
        (payload as { error?: string; message?: string } | null)?.message ??
        "Request failed.",
    );
  }

  return payload;
}

export function BazaarDashboard() {
  const { address, chain, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address,
    query: {
      enabled: Boolean(address),
    },
  });

  const [selectedAgentKey, setSelectedAgentKey] = useState(fallbackAgents[0]?.name ?? "agent");
  const [activeProposalId, setActiveProposalId] = useState(fallbackProposals[0]?.id ?? "proposal");
  const [dashboardStatus, setDashboardStatus] = useState<LiveDashboardStatus | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  async function refreshStatus() {
    const response = (await fetch("/api/status", {
      cache: "no-store",
    }).then((res) => res.json())) as DashboardResponse;

    setDashboardStatus(response.status);
    setLastRefresh(new Date().toISOString());
  }

  async function runAction(label: string, runner: () => Promise<unknown>) {
    setBusyLabel(label);
    setError(null);

    try {
      await runner();
      await refreshStatus();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setBusyLabel(null);
    }
  }

  useEffect(() => {
    refreshStatus().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load status.");
    });

    const intervalId = window.setInterval(() => {
      refreshStatus().catch(() => {
        return;
      });
    }, 12000);

    return () => window.clearInterval(intervalId);
  }, []);

  const liveDashboard = dashboardStatus?.liveDashboard ?? null;
  const liveRuntime = liveDashboard?.runtime ?? null;
  const bazaarSnapshot = liveDashboard?.bazaarSnapshot ?? null;
  const funding = liveDashboard?.funding ?? null;
  const gatewayGas = liveDashboard?.onchainSnapshot?.gatewayGas?.data?.[0] ?? null;

  const taxBps = Number(ruleValue(bazaarSnapshot?.rules, 0) ?? 250);
  const minimumBalanceWei = ruleValue(bazaarSnapshot?.rules, 1);
  const minimumBalance =
    typeof minimumBalanceWei === "bigint"
      ? formatOkb(Number(formatEther(minimumBalanceWei)))
      : minimumBalanceWei
        ? formatOkb(Number(formatEther(BigInt(String(minimumBalanceWei)))))
        : "0.002 OKB";

  const agents = useMemo<AgentCard[]>(() => {
    if (!liveDashboard?.manifest) {
      return fallbackAgents;
    }

    const fundingByAddress = new Map(
      liveDashboard.funding.agents.map((record) => [record.address.toLowerCase(), record]),
    );
    const steps = liveRuntime?.steps ?? [];

    return liveDashboard.manifest.agents.map((agent) => {
      const latestStep = [...steps]
        .reverse()
        .find((step) => step.key.includes(agent.role) || step.label.toLowerCase().includes(agent.name.split(" ")[0]?.toLowerCase() ?? ""));
      const balanceRecord = fundingByAddress.get(agent.address.toLowerCase());
      const runtimeStatus = liveRuntime?.status ?? "ready";

      return {
        role: `${agent.role[0]?.toUpperCase()}${agent.role.slice(1)}` as AgentRole,
        name: agent.name,
        wallet: shortHash(agent.address),
        budget: balanceRecord ? formatOkb(balanceRecord.balanceOkb) : formatOkb(agent.bootstrapOkb),
        goal: agent.goal,
        status: balanceRecord?.funded ? `Funded on ${liveDashboard.manifest.network}` : "Awaiting funding",
        trust: statusTrust(runtimeStatus),
        action: latestStep?.label ?? "Ready for live flow",
        hash: latestStep?.txHash ? shortHash(latestStep.txHash) : "pending",
        badge:
          agent.role === "worker"
            ? "Most active agent"
            : agent.role === "governor"
              ? "Protocol steward"
              : agent.role === "supplier"
                ? "Fastest fulfillment"
                : "Primary liquidity source",
        fullAddress: agent.address,
      };
    });
  }, [liveDashboard, liveRuntime]);

  const selectedAgent = agents.find((agent) => agent.name === selectedAgentKey) ?? agents[0];

  const proposals = useMemo<ProposalCard[]>(() => {
    if (!liveRuntime?.proposalId) {
      return fallbackProposals;
    }

    const executed = liveRuntime.status === "completed";
    return [
      {
        id: `P-${liveRuntime.proposalId}`,
        title: `Raise covenant tax to ${(taxBps / 100).toFixed(2)}%`,
        description:
          "The governor proposed a higher treasury take-rate after the first productive loop completed onchain.",
        effect:
          liveRuntime.secondTaxWei && liveRuntime.firstTaxWei
            ? `Observed tax moved from ${formatOkb(Number(formatEther(BigInt(liveRuntime.firstTaxWei))))} to ${formatOkb(Number(formatEther(BigInt(liveRuntime.secondTaxWei))))}.`
            : "Next payment should reflect the updated covenant rules.",
        votesFor: executed ? 100 : 75,
        votesAgainst: executed ? 0 : 25,
        quorum: executed ? "Executed onchain" : "Awaiting execution window",
        status: executed ? "Passed" : "Open",
      },
    ];
  }, [liveRuntime, taxBps]);

  const activeProposal = proposals.find((proposal) => proposal.id === activeProposalId) ?? proposals[0];

  const transactions = useMemo<TransactionCard[]>(() => {
    if (!liveRuntime?.steps?.length) {
      return fallbackTransactions;
    }

    return [...liveRuntime.steps]
      .filter((step) => step.txHash)
      .reverse()
      .map((step) => ({
        hash: step.txHash ?? step.key,
        label: step.label,
        from: step.meta?.shopId ? "Bazaar X" : step.key.split("-")[0] ?? "Agent",
        to: bazaarSnapshot?.address ? shortHash(bazaarSnapshot.address) : "X Layer",
        amount:
          typeof step.meta?.priceOkb === "string"
            ? `${step.meta.priceOkb} OKB`
            : typeof step.meta?.taxOkb === "string"
              ? `${step.meta.taxOkb} OKB`
              : "Onchain action",
        fee: gatewayGas?.normal ? `${gatewayGas.normal} wei` : "Live gas",
        block: step.status === "success" ? "confirmed" : "pending",
        time: toRelativeTime(step.completedAt ?? step.startedAt),
        status: step.status === "success" ? "Confirmed" : "Queued",
        explorerUrl: step.explorerUrl,
        detail: step.detail,
      }));
  }, [bazaarSnapshot?.address, gatewayGas?.normal, liveRuntime?.steps]);

  const activeStats = useMemo(
    () => [
      {
        label: "Active agents",
        value: String(liveDashboard?.manifest?.agents.length ?? dashboardStatus?.runtime.agentCount ?? 4),
        note: "Each with a wallet, budget, and role on X Layer.",
      },
      {
        label: "Treasury balance",
        value: formatOkb(
          bazaarSnapshot?.treasuryBalanceOkb ??
            funding?.treasury.balanceOkb ??
            dashboardStatus?.runtime.treasury,
        ),
        note: "Taxes route here automatically and can be reinvested.",
      },
      {
        label: "Transactions tracked",
        value: String(liveRuntime?.txHashes.length ?? transactions.length),
        note: "Funding, market actions, governance, and treasury flows.",
      },
      {
        label: "Runtime mode",
        value: liveRuntime?.status ?? "preview",
        note:
          liveRuntime?.error ??
          (funding?.readyForFlow
            ? "Ready for full live flow."
            : `Need ${funding?.requiredDeployerBalanceOkb ?? "0"} OKB on deployer.`),
      },
    ],
    [bazaarSnapshot?.treasuryBalanceOkb, dashboardStatus?.runtime.agentCount, dashboardStatus?.runtime.treasury, funding?.readyForFlow, funding?.requiredDeployerBalanceOkb, funding?.treasury.balanceOkb, liveDashboard?.manifest?.agents.length, liveRuntime?.error, liveRuntime?.status, liveRuntime?.txHashes.length, transactions.length],
  );

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="aurora" />

      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-4 sm:px-6 lg:px-10">
        <header className="glass-card fade-in relative overflow-hidden rounded-[28px] border border-white/10 px-5 py-5 sm:px-7">
          <div className="absolute inset-0 soft-grid opacity-25" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.15] bg-white/[0.05] shadow-soft">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#69f0d2] to-[#7a8bff] text-sm font-semibold text-slate-950">
                  BX
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#69f0d2]/30 bg-[#69f0d2]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9ffff0]">
                    {liveRuntime?.status === "completed" ? "Live flow complete" : "X Layer ready"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                    {liveDashboard?.manifest?.network ?? "testnet"} mode
                  </span>
                  {dashboardStatus?.sources.hasOnchain ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                      Contract tracked
                    </span>
                  ) : null}
                </div>
                <div className="max-w-3xl">
                  <h1 className="balance-text text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                    <span className="text-gradient">Bazaar X</span> turns agent workflows into a
                    self-governing onchain economy.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                    A market of wallets, roles, taxes, governance, and real X Layer execution.
                    Every hire, payment, and rule update moves value through the Covenant Skill
                    and surfaces through the live runtime artifacts.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 lg:max-w-[460px]">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Viewer wallet
                    </div>
                    <div className="mt-1 text-sm text-slate-200">
                      {isConnected && address
                        ? `${shortHash(address)} on ${chain?.name ?? "unknown network"}`
                        : "Connect an injected wallet to inspect network readiness."}
                    </div>
                  </div>
                  <ConnectWalletButton />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <MiniMetric
                    label="Wallet balance"
                    value={balance ? formatOkb(Number(balance.formatted)) : "Not connected"}
                  />
                  <MiniMetric
                    label="Last refresh"
                    value={lastRefresh ? toRelativeTime(lastRefresh) : "Loading"}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <ActionButton
                  label={busyLabel === "Initializing agents" ? "Initializing..." : "Initialize agents"}
                  hint="Seed local runtime artifacts"
                  onClick={() =>
                    runAction("Initializing agents", () =>
                      postJson("/api/agents/init", {
                        count: 5,
                        seed: "bazaar-x-live",
                        initialBudget: 1000,
                      }),
                    )
                  }
                />
                <ActionButton
                  label={busyLabel === "Running economy loop" ? "Running..." : "Run local loop"}
                  hint="Advance the offchain planner"
                  secondary
                  onClick={() =>
                    runAction("Running economy loop", () =>
                      postJson("/api/economy/simulate", {
                        rounds: 4,
                        seed: "bazaar-x-live",
                        taxBps: 325,
                      }),
                    )
                  }
                />
                <ActionButton
                  label={busyLabel === "Refreshing status" ? "Refreshing..." : "Refresh status"}
                  hint="Pull latest live artifact"
                  secondary
                  onClick={() => runAction("Refreshing status", refreshStatus)}
                />
              </div>

              {error ? (
                <div className="rounded-[18px] border border-[#ffb96a]/30 bg-[#ffb96a]/10 px-4 py-3 text-sm text-[#ffe5c0]">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {activeStats.map((item, index) => (
            <StatTile key={item.label} index={index} {...item} />
          ))}
        </section>

        <section id="agents" className="grid gap-5 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <Panel title="Agent network" kicker="Who does the work">
              <div className="grid gap-4 md:grid-cols-2">
                {agents.map((agent) => (
                  <button
                    type="button"
                    key={agent.fullAddress ?? agent.name}
                    className={`group rounded-[24px] border p-4 text-left transition duration-200 hover:-translate-y-0.5 ${
                      selectedAgent?.name === agent.name
                        ? "border-[#69f0d2]/40 bg-[#69f0d2]/10"
                        : "border-white/10 bg-white/[0.04] hover:border-white/20"
                    }`}
                    onClick={() => setSelectedAgentKey(agent.name)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                          {agent.role}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white">{agent.name}</div>
                      </div>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-300">
                        {agent.trust}% trust
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{agent.goal}</p>
                    <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                      {agent.badge}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400">
                      <span className="mono">{agent.wallet}</span>
                      <span>{agent.status}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-4 rounded-[28px] border border-white/10 bg-black/20 p-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <div className="text-xs uppercase tracking-[0.26em] text-slate-400">
                    Selected agent
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-semibold text-white">{selectedAgent?.name}</h3>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                      {selectedAgent?.role}
                    </span>
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                    {selectedAgent?.goal}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <MiniMetric label="Budget" value={selectedAgent?.budget ?? "n/a"} />
                    <MiniMetric label="Action" value={selectedAgent?.action ?? "n/a"} />
                    <MiniMetric label="Latest tx" value={selectedAgent?.hash ?? "n/a"} />
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Covenant Skill
                      </div>
                      <div className="mt-1 text-base font-semibold text-white">
                        Reusable policy engine
                      </div>
                    </div>
                    <span className="rounded-full border border-[#7a8bff]/35 bg-[#7a8bff]/10 px-2.5 py-1 text-[11px] text-[#cfd6ff]">
                      enforcePolicy(tx)
                    </span>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {covenantRules.map((rule) => (
                      <li key={rule} className="flex items-start gap-3 text-sm text-slate-300">
                        <span className="mt-2 h-2 w-2 rounded-full bg-[#69f0d2]" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 xl:col-span-4">
            <Panel title="Treasury" kicker="Health of the loop">
              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Balance floor</span>
                    <span className="mono text-sm text-white">{minimumBalance}</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full w-[76%] rounded-full bg-gradient-to-r from-[#69f0d2] via-[#7a8bff] to-[#ffb96a]" />
                  </div>
                  <div className="mt-3 text-xs leading-6 text-slate-400">
                    Minimum balance enforcement prevents underfunded agents from overcommitting.
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <TinyStat label="Tax" value={`${(taxBps / 100).toFixed(2)}%`} />
                  <TinyStat
                    label="Inflow"
                    value={
                      liveRuntime?.secondTaxWei
                        ? formatOkb(Number(formatEther(BigInt(liveRuntime.secondTaxWei))))
                        : "Live"
                    }
                  />
                  <TinyStat
                    label="Reserve"
                    value={formatOkb(
                      bazaarSnapshot?.treasuryBalanceOkb ?? funding?.treasury.balanceOkb ?? "0",
                    )}
                  />
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs uppercase tracking-[0.26em] text-slate-400">
                    Treasury posture
                  </div>
                  <div className="mt-3 space-y-2">
                    <BarRow
                      label="Incoming taxes"
                      value={liveRuntime?.secondTaxWei ? 84 : 62}
                      accent="bg-[#69f0d2]"
                    />
                    <BarRow
                      label="Agent payouts"
                      value={liveRuntime?.txHashes.length ? 67 : 52}
                      accent="bg-[#7a8bff]"
                    />
                    <BarRow
                      label="Reserved safety"
                      value={funding?.readyForFlow ? 91 : 44}
                      accent="bg-[#ffb96a]"
                    />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Governance" kicker="Rule updates">
              <div
                className={`rounded-[24px] border p-4 transition ${
                  activeProposal?.status === "Open"
                    ? "border-[#ffb96a]/30 bg-[#ffb96a]/10"
                    : "border-[#69f0d2]/30 bg-[#69f0d2]/10"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      {activeProposal?.id}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {activeProposal?.title}
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-300">
                    {activeProposal?.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {activeProposal?.description}
                </p>
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                  {activeProposal?.effect}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                  <span>For: {activeProposal?.votesFor}%</span>
                  <span>Against: {activeProposal?.votesAgainst}%</span>
                  <span>{activeProposal?.quorum}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {proposals.map((proposal) => (
                  <button
                    type="button"
                    key={proposal.id}
                    className={`rounded-[20px] border px-4 py-3 text-left transition ${
                      activeProposal?.id === proposal.id
                        ? "border-white/25 bg-white/[0.08]"
                        : "border-white/10 bg-white/[0.04] hover:border-white/20"
                    }`}
                    onClick={() => setActiveProposalId(proposal.id)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-white">{proposal.title}</span>
                      <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                        {proposal.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        </section>

        <section id="transactions" className="grid gap-5 xl:grid-cols-12">
          <Panel title="Economy loop" kicker="Earn to govern" className="xl:col-span-5">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/20 p-5">
              <div className="absolute inset-x-8 top-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {economyLoop.map((step, index) => (
                  <div key={step} className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.06] text-sm font-semibold text-white">
                      0{index + 1}
                    </div>
                    <span className="text-xs uppercase tracking-[0.22em] text-slate-400">{step}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <p className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4 text-sm leading-7 text-slate-300">
                Agents earn from work, pay one another, tax routes automatically, and treasury
                reserves compound back into new work and governance.
              </p>
              <p className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4 text-sm leading-7 text-slate-300">
                The next payment uses updated rules after quorum passes, so policy changes are
                visible in the very next transaction on X Layer.
              </p>
            </div>
          </Panel>

          <Panel title="Transaction feed" kicker="Live artifact + chain output" className="xl:col-span-7">
            <div className="space-y-3">
              {transactions.map((tx) => (
                <article
                  key={`${tx.hash}-${tx.label}`}
                  className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/20"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#69f0d2]/[0.12] px-2.5 py-1 text-[11px] uppercase tracking-[0.22em] text-[#9ffff0]">
                          {tx.label}
                        </span>
                        <span className="text-xs text-slate-400">{tx.time}</span>
                      </div>
                      <div className="mt-2 truncate text-sm text-slate-200">
                        {tx.from} → {tx.to}
                      </div>
                      {tx.explorerUrl ? (
                        <a
                          href={tx.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block truncate mono text-xs text-slate-500 transition hover:text-[#9ffff0]"
                        >
                          {tx.hash}
                        </a>
                      ) : (
                        <div className="mt-1 mono truncate text-xs text-slate-500">{tx.hash}</div>
                      )}
                      {tx.detail ? (
                        <div className="mt-2 text-xs leading-6 text-slate-400">{tx.detail}</div>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:min-w-[420px]">
                      <FeedStat label="Amount" value={tx.amount} />
                      <FeedStat label="Fee" value={tx.fee} />
                      <FeedStat label="Block" value={tx.block} />
                      <FeedStat label="Status" value={tx.status} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Covenant Skill" kicker="Reusable policy engine">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "enforcePolicy(tx)",
                "checkBalanceRules()",
                "applyTax()",
                "proposeChange()",
                "vote()",
                "executeChange()",
              ].map((fn) => (
                <div
                  key={fn}
                  className="rounded-[20px] border border-white/10 bg-white/[0.05] px-4 py-3 mono text-sm text-slate-200"
                >
                  {fn}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Operator flow" kicker="How to push it live">
            <ol className="space-y-3 text-sm leading-7 text-slate-300">
              <li>Run `pnpm live:wallets` to materialize agent wallets and viewer addresses.</li>
              <li>Use `pnpm live:faucet` to see funding targets and the official faucet path.</li>
              <li>Deploy with `pnpm live:deploy`, then execute the full loop with `pnpm live:run`.</li>
              <li>Refresh this dashboard or run `pnpm live:status` to load the newest runtime artifact.</li>
            </ol>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({
  title,
  kicker,
  className = "",
  children,
}: {
  title: string;
  kicker: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`glass-card fade-in rounded-[28px] border border-white/10 p-5 ${className}`}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">{kicker}</div>
          <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function StatTile({
  label,
  value,
  note,
  index,
}: {
  label: string;
  value: string;
  note: string;
  index: number;
}) {
  return (
    <article
      className="glass-card fade-in rounded-[24px] border border-white/10 p-5"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="text-xs uppercase tracking-[0.26em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{note}</p>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm leading-6 text-white">{value}</div>
    </div>
  );
}

function TinyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 text-base font-semibold text-white">{value}</div>
    </div>
  );
}

function BarRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function FeedStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 truncate text-sm text-white">{value}</div>
    </div>
  );
}

function ActionButton({
  label,
  hint,
  secondary = false,
  onClick,
}: {
  label: string;
  hint: string;
  secondary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-[22px] border px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 ${
        secondary
          ? "border-white/10 bg-white/[0.04] hover:border-white/20"
          : "border-[#69f0d2]/35 bg-[#69f0d2]/10 hover:border-[#69f0d2]/50"
      }`}
    >
      <div className="text-sm font-semibold text-white">{label}</div>
      <div className="mt-1 text-xs leading-5 text-slate-300">{hint}</div>
    </button>
  );
}
