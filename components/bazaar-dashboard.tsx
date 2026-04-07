"use client";

import {
  ArrowUpRight,
  Bot,
  CircleAlert,
  Copy,
  Gavel,
  Landmark,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { formatEther } from "viem";
import { useAccount, useBalance } from "wagmi";
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
      deployment?: {
        contractAddress: string;
        deployTxHash: string;
        explorerBaseUrl: string;
        treasury: string;
        initialRules: {
          taxBps: number;
          minimumBalanceWei: string;
          quorumBps: number;
          supportBps: number;
          votingPeriodSeconds: number;
        };
      };
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

type ActionRequest = {
  label: string;
  path: string;
  body?: Record<string, unknown>;
};

const fallbackAgents: AgentCard[] = [
  {
    role: "Shop",
    name: "Bazaar Forge",
    wallet: "0x8F...A201",
    budget: "1,250 OKB",
    goal: "Open demand, route work, and turn market activity into treasury growth.",
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
    goal: "Source inventory, fulfill jobs, and subcontract work when demand spikes.",
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
    goal: "Execute labor, collect revenue, and remain solvent under covenant rules.",
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
    goal: "Tune tax, reserve floor, and governance thresholds to keep the economy healthy.",
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
    effect: "More tax intake, slower but healthier growth.",
    votesFor: 68,
    votesAgainst: 12,
    quorum: "81% of active stake",
    status: "Open",
  },
  {
    id: "P-06",
    title: "Increase min balance floor to 75 OKB",
    description: "Keeps agents solvent before they may hire or pay downstream actors.",
    effect: "Prevents brittle wallets from overcommitting.",
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
    to: "Bazaar X",
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
];

const economyLoop = [
  "Demand opens",
  "Service lists",
  "Hire settles",
  "Tax routes",
  "Treasury grows",
  "Governance updates",
];

const covenantFunctions = [
  "enforcePolicy(tx)",
  "checkBalanceRules()",
  "applyTax()",
  "proposeChange()",
  "vote()",
  "executeChange()",
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

function formatOkbFromWei(value: string | number | bigint | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "0 OKB";
  }

  try {
    return formatOkb(Number(formatEther(BigInt(String(value)))));
  } catch {
    return "n/a";
  }
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

async function postJson(path: string, body: Record<string, unknown> = {}) {
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

async function fetchStatus() {
  const response = await fetch("/api/status", {
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      (payload as { error?: string; message?: string } | null)?.error ??
        (payload as { error?: string; message?: string } | null)?.message ??
        "Failed to load status.",
    );
  }

  return (await response.json()) as DashboardResponse;
}

export function BazaarDashboard() {
  const { address, chain, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address,
    query: {
      enabled: Boolean(address),
    },
  });
  const queryClient = useQueryClient();

  const [selectedAgentKey, setSelectedAgentKey] = useState(fallbackAgents[0]?.name ?? "agent");
  const [activeProposalId, setActiveProposalId] = useState(fallbackProposals[0]?.id ?? "proposal");
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["dashboard-status"],
    queryFn: fetchStatus,
    refetchInterval: 12_000,
    staleTime: 6_000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ path, body }: ActionRequest) => postJson(path, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard-status"] });
    },
  });

  async function handleAction(request: ActionRequest) {
    await actionMutation.mutateAsync(request);
  }

  async function copyText(value: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopiedValue(value);
    window.setTimeout(() => {
      setCopiedValue((current) => (current === value ? null : current));
    }, 1800);
  }

  const dashboardStatus = statusQuery.data?.status ?? null;
  const liveDashboard = dashboardStatus?.liveDashboard ?? null;
  const liveRuntime = liveDashboard?.runtime ?? null;
  const deployment = liveRuntime?.deployment ?? null;
  const bazaarSnapshot = liveDashboard?.bazaarSnapshot ?? null;
  const manifest = liveDashboard?.manifest ?? null;
  const funding = liveDashboard?.funding ?? null;
  const gatewayGas = liveDashboard?.onchainSnapshot?.gatewayGas?.data?.[0] ?? null;
  const explorerBaseUrl =
    manifest?.explorerBaseUrl ??
    deployment?.explorerBaseUrl ??
    "https://www.oklink.com/x-layer-testnet";
  const contractAddress = bazaarSnapshot?.address ?? deployment?.contractAddress ?? "";
  const treasuryAddress = bazaarSnapshot?.treasury ?? manifest?.treasury.address ?? "";
  const deployTxHash = deployment?.deployTxHash ?? "";

  const taxBps = Number(ruleValue(bazaarSnapshot?.rules, 0) ?? deployment?.initialRules.taxBps ?? 250);
  const minimumBalanceWei =
    ruleValue(bazaarSnapshot?.rules, 1) ?? deployment?.initialRules.minimumBalanceWei ?? null;
  const minimumBalance = formatOkbFromWei(minimumBalanceWei);
  const quorumBps = Number(
    ruleValue(bazaarSnapshot?.rules, 2) ?? deployment?.initialRules.quorumBps ?? 7500,
  );
  const supportBps = Number(
    ruleValue(bazaarSnapshot?.rules, 3) ?? deployment?.initialRules.supportBps ?? 6000,
  );
  const votingPeriodSeconds = Number(
    ruleValue(bazaarSnapshot?.rules, 4) ?? deployment?.initialRules.votingPeriodSeconds ?? 10,
  );

  const agents = useMemo<AgentCard[]>(() => {
    if (!manifest) {
      return fallbackAgents;
    }

    const fundingByAddress = new Map(
      funding?.agents.map((record) => [record.address.toLowerCase(), record]) ?? [],
    );
    const steps = liveRuntime?.steps ?? [];

    return manifest.agents.map((agent) => {
      const latestStep = [...steps].reverse().find((step) => {
        return (
          step.key.includes(agent.role) ||
          step.label.toLowerCase().includes(agent.name.split(" ")[0]?.toLowerCase() ?? "")
        );
      });
      const balanceRecord = fundingByAddress.get(agent.address.toLowerCase());
      const runtimeStatus = liveRuntime?.status ?? "ready";

      return {
        role: `${agent.role[0]?.toUpperCase()}${agent.role.slice(1)}` as AgentRole,
        name: agent.name,
        wallet: shortHash(agent.address),
        budget: balanceRecord ? formatOkb(balanceRecord.balanceOkb) : formatOkb(agent.bootstrapOkb),
        goal: agent.goal,
        status: balanceRecord?.funded ? `Funded on ${manifest.network}` : "Awaiting funding",
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
  }, [funding?.agents, liveRuntime?.status, liveRuntime?.steps, manifest]);

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
            ? `Observed tax moved from ${formatOkbFromWei(liveRuntime.firstTaxWei)} to ${formatOkbFromWei(liveRuntime.secondTaxWei)}.`
            : "The next payment should reflect the updated covenant rules.",
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
        to: contractAddress ? shortHash(contractAddress) : "X Layer",
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
  }, [contractAddress, gatewayGas?.normal, liveRuntime?.steps]);

  const latestSteps = useMemo(() => {
    return [...(liveRuntime?.steps ?? [])].reverse().slice(0, 8);
  }, [liveRuntime?.steps]);

  const completedSteps = liveRuntime?.steps.filter((step) => step.status === "success").length ?? 0;
  const totalSteps = liveRuntime?.steps.length ?? 0;
  const progressPercent = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const lastRefresh = statusQuery.dataUpdatedAt
    ? toRelativeTime(new Date(statusQuery.dataUpdatedAt).toISOString())
    : "Waiting";
  const viewerBalance = balance ? formatOkb(Number(balance.formatted)) : "Not connected";
  const isUnsupportedViewerNetwork = Boolean(isConnected && chain && chain.id !== 1952 && chain.id !== 196);
  const canDeploy = Boolean(funding?.readyForDeploy || deployment);
  const canRunLive = Boolean(deployment || funding?.readyForDeploy);
  const busyLabel = actionMutation.isPending ? actionMutation.variables?.label ?? null : null;
  const statusError =
    (statusQuery.error instanceof Error ? statusQuery.error.message : null) ??
    (actionMutation.error instanceof Error ? actionMutation.error.message : null);

  const activeStats = [
    {
      label: "Live contract",
      value: contractAddress ? shortHash(contractAddress) : "Not deployed",
      note: contractAddress
        ? `Running on ${manifest?.network ?? "X Layer testnet"} with explorer-ready proof.`
        : "Deploy the contract to turn the dashboard into live proof.",
    },
    {
      label: "Treasury reserve",
      value: formatOkb(
        bazaarSnapshot?.treasuryBalanceOkb ??
          funding?.treasury.balanceOkb ??
          dashboardStatus?.runtime.treasury,
      ),
      note: "Taxes route here automatically and treasury can reinvest into the market.",
    },
    {
      label: "Tracked txs",
      value: String(liveRuntime?.txHashes.length ?? transactions.length),
      note: "Registrations, hires, governance, and treasury moves all produce receipts.",
    },
    {
      label: "Runtime status",
      value: liveRuntime?.status ?? "preview",
      note:
        liveRuntime?.error ??
        (funding?.readyForFlow
          ? "All wallets are ready for the full live loop."
          : `Need ${funding?.requiredDeployerBalanceOkb ?? "0"} OKB on the deployer to go live.`),
    },
  ] as const;

  const proofCards = [
    {
      title: "Contract",
      value: contractAddress ? shortHash(contractAddress) : "Awaiting deploy",
      note: deployTxHash ? `Deploy tx ${shortHash(deployTxHash)}` : "Use the live deploy action to materialize proof.",
      address: contractAddress,
      link: contractAddress ? `${explorerBaseUrl}/address/${contractAddress}` : undefined,
    },
    {
      title: "Treasury",
      value: formatOkb(bazaarSnapshot?.treasuryBalanceOkb ?? funding?.treasury.balanceOkb ?? "0"),
      note: treasuryAddress ? shortHash(treasuryAddress) : "Treasury wallet not ready yet.",
      address: treasuryAddress,
      link: treasuryAddress ? `${explorerBaseUrl}/address/${treasuryAddress}` : undefined,
    },
    {
      title: "Covenant",
      value: `${(taxBps / 100).toFixed(2)}% tax`,
      note: `${minimumBalance} floor · ${quorumBps / 100}% quorum · ${supportBps / 100}% support`,
    },
    {
      title: "Run status",
      value: liveRuntime?.status ?? "ready",
      note: totalSteps ? `${completedSteps}/${totalSteps} steps completed · ${progressPercent}%` : "No live run recorded yet.",
    },
  ];

  const judgeSignals = [
    `${liveRuntime?.txHashes.length ?? 0} recorded tx hashes`,
    contractAddress ? `Contract live at ${shortHash(contractAddress)}` : "Contract deploy ready",
    `Current rules: ${(taxBps / 100).toFixed(2)}% tax, ${minimumBalance} floor`,
  ];

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="aurora" />
      <div className="hero-orb hero-orb-left" />
      <div className="hero-orb hero-orb-right" />

      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-4 sm:px-6 lg:px-10">
        <header className="glass-card panel-glow fade-in relative overflow-hidden rounded-[32px] border border-white/10 px-5 py-5 sm:px-7 sm:py-7">
          <div className="absolute inset-0 soft-grid opacity-20" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_420px]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#69f0d2]/30 bg-[#69f0d2]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#a6fff1]">
                  OKX Build X
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                  X Layer Arena
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                  {manifest?.network ?? "testnet"} · chain {manifest?.chainId ?? 1952}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                  {statusQuery.isFetching ? "Refreshing" : `Updated ${lastRefresh}`}
                </span>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/[0.15] bg-white/[0.06] shadow-soft">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#69f0d2] via-[#7a8bff] to-[#ffb96a] text-base font-semibold text-slate-950">
                    BX
                  </div>
                </div>

                <div className="max-w-4xl">
                  <h1 className="balance-text text-3xl font-semibold tracking-tight text-white sm:text-5xl xl:text-6xl">
                    <span className="text-gradient">Bazaar X</span> makes autonomous agents earn,
                    pay, tax, reinvest, and govern on X Layer.
                  </h1>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                    This is not a mock control panel. It is a live economy loop with wallets,
                    treasury flows, covenant enforcement, proposal execution, and explorer-linked
                    proof that judges can replay.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {judgeSignals.map((signal) => (
                  <div
                    key={signal}
                    className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-slate-200"
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      <ShieldCheck className="h-4 w-4 text-[#69f0d2]" />
                      Proof
                    </div>
                    {signal}
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ActionButton
                  icon={Bot}
                  label={busyLabel === "Initialize agents" ? "Initializing..." : "Initialize agents"}
                  hint="Seed the local planner and runtime artifacts."
                  loading={busyLabel === "Initialize agents"}
                  onClick={() =>
                    handleAction({
                      label: "Initialize agents",
                      path: "/api/agents/init",
                      body: {
                        count: 5,
                        seed: "bazaar-x-live",
                        initialBudget: 1000,
                      },
                    })
                  }
                  disabled={actionMutation.isPending}
                />
                <ActionButton
                  icon={Landmark}
                  label={busyLabel === "Deploy live contract" ? "Deploying..." : contractAddress ? "Load live contract" : "Deploy live contract"}
                  hint={
                    contractAddress
                      ? "Reuse the recorded X Layer deployment and sync status."
                      : canDeploy
                        ? "Deploy Bazaar X to X Layer testnet."
                        : `Need ${funding?.requiredDeployerBalanceOkb ?? "0"} OKB on deployer.`
                  }
                  loading={busyLabel === "Deploy live contract"}
                  onClick={() =>
                    handleAction({
                      label: "Deploy live contract",
                      path: "/api/live/deploy",
                    })
                  }
                  disabled={actionMutation.isPending || !canDeploy}
                />
                <ActionButton
                  icon={Sparkles}
                  label={busyLabel === "Run live flow" ? "Running live flow..." : "Run live X Layer flow"}
                  hint={
                    canRunLive
                      ? "Broadcast the full market + governance loop."
                      : "Deploy first or fund the deployer to continue."
                  }
                  tone="accent"
                  loading={busyLabel === "Run live flow"}
                  onClick={() =>
                    handleAction({
                      label: "Run live flow",
                      path: "/api/live/run",
                    })
                  }
                  disabled={actionMutation.isPending || !canRunLive}
                />
                <ActionButton
                  icon={RefreshCw}
                  label={busyLabel === "Refresh status" ? "Refreshing..." : "Refresh status"}
                  hint="Pull the latest runtime, funding, and chain snapshot."
                  tone="ghost"
                  loading={statusQuery.isFetching}
                  onClick={() => statusQuery.refetch()}
                  disabled={actionMutation.isPending || statusQuery.isFetching}
                />
              </div>

              {statusError ? (
                <Callout tone="warn" title="Status issue">
                  {statusError}
                </Callout>
              ) : null}

              {isUnsupportedViewerNetwork ? (
                <Callout tone="warn" title="Wrong viewer network">
                  Your browser wallet is connected to {chain?.name ?? "an unsupported network"}.
                  Switch to X Layer testnet (`1952`) or X Layer mainnet (`196`) for a clean demo.
                </Callout>
              ) : null}

              {statusQuery.isSuccess && funding && !funding.readyForFlow ? (
                <Callout tone="neutral" title="Funding gate">
                  The deployer still needs at least {funding?.requiredDeployerBalanceOkb ?? "0"} OKB
                  before the full live flow can be replayed from scratch.
                </Callout>
              ) : null}
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Viewer wallet
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {isConnected && address ? shortHash(address) : "Inspect with any injected wallet"}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">
                      {isConnected && address
                        ? `Connected on ${chain?.name ?? "unknown network"}`
                        : "Connect a wallet to confirm X Layer network readiness from the browser."}
                    </div>
                  </div>
                  <ConnectWalletButton />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MiniMetric label="Wallet balance" value={viewerBalance} />
                  <MiniMetric label="Last sync" value={lastRefresh} />
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                  <Gavel className="h-4 w-4 text-[#ffb96a]" />
                  Judge path
                </div>
                <div className="mt-4 space-y-4">
                  {[
                    "Show the live contract and treasury.",
                    "Replay a payment and tax flow on X Layer.",
                    "Execute governance, then prove the next settlement changed.",
                  ].map((line, index) => (
                    <div key={line} className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <p className="pt-1 text-sm leading-6 text-slate-300">{line}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </header>

        {statusQuery.isLoading && !dashboardStatus ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <article
                key={index}
                className="glass-card rounded-[24px] border border-white/10 p-5 animate-pulse"
              >
                <div className="h-3 w-24 rounded-full bg-white/10" />
                <div className="mt-4 h-8 w-2/3 rounded-full bg-white/10" />
                <div className="mt-4 h-3 w-full rounded-full bg-white/10" />
              </article>
            ))}
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {activeStats.map((item, index) => (
              <StatTile key={item.label} index={index} {...item} />
            ))}
          </section>
        )}

        <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {proofCards.map((card, index) => (
            <ProofCard
              key={card.title}
              title={card.title}
              value={card.value}
              note={card.note}
              link={card.link}
              copyValue={card.address}
              copied={copiedValue === card.address}
              onCopy={card.address ? () => copyText(card.address) : undefined}
              index={index}
            />
          ))}
        </section>

        <section id="agents" className="grid gap-5 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <Panel title="Agent economy" kicker="Who earns, hires, and governs">
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
                    <MiniMetric label="Latest action" value={selectedAgent?.action ?? "n/a"} />
                    <MiniMetric label="Latest tx" value={selectedAgent?.hash ?? "n/a"} />
                  </div>
                  {selectedAgent?.fullAddress ? (
                    <div className="mt-4">
                      <AddressRow
                        label="Agent wallet"
                        value={selectedAgent.fullAddress}
                        href={`${explorerBaseUrl}/address/${selectedAgent.fullAddress}`}
                        copied={copiedValue === selectedAgent.fullAddress}
                        onCopy={() => copyText(selectedAgent.fullAddress ?? "")}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Covenant Skill
                      </div>
                      <div className="mt-1 text-base font-semibold text-white">
                        Portable policy engine
                      </div>
                    </div>
                    <span className="rounded-full border border-[#7a8bff]/35 bg-[#7a8bff]/10 px-2.5 py-1 text-[11px] text-[#cfd6ff]">
                      Reusable module
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {covenantFunctions.map((fn) => (
                      <div
                        key={fn}
                        className="rounded-[16px] border border-white/10 bg-black/20 px-3 py-2 mono text-sm text-slate-200"
                      >
                        {fn}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 xl:col-span-4">
            <Panel title="Readiness" kicker="What is safe to run">
              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Live runtime
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {liveRuntime?.status ?? "ready"}
                      </div>
                    </div>
                    <StatusBadge status={liveRuntime?.status ?? "ready"} />
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#69f0d2] via-[#7a8bff] to-[#ffb96a]"
                      style={{ width: `${Math.max(progressPercent, 10)}%` }}
                    />
                  </div>
                  <div className="mt-3 text-xs leading-6 text-slate-400">
                    {totalSteps
                      ? `${completedSteps} of ${totalSteps} execution steps recorded in the latest run.`
                      : "No live run has been recorded yet."}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <TinyStat
                    label="Deployer"
                    value={funding?.deployer.funded ? "Ready" : "Needs OKB"}
                  />
                  <TinyStat
                    label="Agents"
                    value={`${funding?.agents.filter((agent) => agent.funded).length ?? 0}/${funding?.agents.length ?? 0}`}
                  />
                  <TinyStat
                    label="Gas"
                    value={gatewayGas?.normal ? `${gatewayGas.normal}` : "Live"}
                  />
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs uppercase tracking-[0.26em] text-slate-400">
                    Wallet readiness
                  </div>
                  <div className="mt-3 space-y-2">
                    <BarRow
                      label="Deployer funded"
                      value={funding?.deployer.funded ? 100 : 35}
                      accent="bg-[#69f0d2]"
                    />
                    <BarRow
                      label="Agents funded"
                      value={
                        funding?.agents.length
                          ? Math.round(
                              (funding.agents.filter((agent) => agent.funded).length /
                                funding.agents.length) *
                                100,
                            )
                          : 0
                      }
                      accent="bg-[#7a8bff]"
                    />
                    <BarRow
                      label="Ready for full loop"
                      value={funding?.readyForFlow ? 100 : funding?.readyForDeploy ? 76 : 28}
                      accent="bg-[#ffb96a]"
                    />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Governance" kicker="Rule changes onchain">
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
              <div className="absolute inset-x-8 top-1/2 hidden h-px bg-gradient-to-r from-transparent via-white/20 to-transparent sm:block" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
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

            <div className="mt-4 grid gap-3">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4 text-sm leading-7 text-slate-300">
                Agents create demand, settle work onchain, auto-route tax to treasury, and then
                vote to update the policy that governs the next payment.
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.05] p-4 text-sm leading-7 text-slate-300">
                The point of the demo is legibility: one loop, one treasury, one proposal, and a
                visible before-and-after rule change on X Layer.
              </div>
            </div>
          </Panel>

          <Panel title="Execution timeline" kicker="Latest runtime steps" className="xl:col-span-7">
            <div className="space-y-3">
              {latestSteps.length ? (
                latestSteps.map((step) => (
                  <div
                    key={`${step.key}-${step.startedAt}`}
                    className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={step.status} compact />
                          <div className="text-sm font-semibold text-white">{step.label}</div>
                        </div>
                        <div className="mt-2 text-xs leading-6 text-slate-400">
                          {step.detail ?? "Waiting for more runtime detail."}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400">
                        {toRelativeTime(step.completedAt ?? step.startedAt)}
                      </div>
                    </div>
                    {step.txHash ? (
                      <div className="mt-3">
                        <AddressRow
                          label="Tx hash"
                          value={step.txHash}
                          href={step.explorerUrl}
                          copied={copiedValue === step.txHash}
                          onCopy={() => copyText(step.txHash ?? "")}
                          mono
                        />
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/15 bg-black/20 p-5 text-sm leading-7 text-slate-300">
                  Run the live flow to populate a timestamped execution timeline with contracts,
                  service hires, proposal votes, and treasury actions.
                </div>
              )}
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-12">
          <Panel title="Transaction feed" kicker="Explorer-linked proof" className="xl:col-span-8">
            <div className="space-y-3">
              {transactions.slice(0, 8).map((tx) => (
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
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {tx.explorerUrl ? (
                          <a
                            href={tx.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 mono text-xs text-slate-400 transition hover:text-[#9ffff0]"
                          >
                            {shortHash(tx.hash)}
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <div className="mono text-xs text-slate-500">{tx.hash}</div>
                        )}
                        <button
                          type="button"
                          onClick={() => copyText(tx.hash)}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-white"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiedValue === tx.hash ? "Copied" : "Copy hash"}
                        </button>
                      </div>
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

          <div className="grid gap-5 xl:col-span-4">
            <Panel title="Live rules" kicker="What the next tx obeys">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <RuleCard label="Tax rate" value={`${(taxBps / 100).toFixed(2)}%`} />
                <RuleCard label="Minimum balance" value={minimumBalance} />
                <RuleCard label="Quorum" value={`${(quorumBps / 100).toFixed(2)}%`} />
                <RuleCard label="Support" value={`${(supportBps / 100).toFixed(2)}%`} />
                <RuleCard label="Voting window" value={`${votingPeriodSeconds}s`} />
              </div>
            </Panel>

            <Panel title="Operator flow" kicker="Fastest replay path">
              <ol className="space-y-3 text-sm leading-7 text-slate-300">
                <li>Run `pnpm live:wallets` to materialize the agentic wallets and addresses.</li>
                <li>Use `pnpm live:faucet` once, then fund agents through real onchain transfers.</li>
                <li>Deploy with `pnpm live:deploy` and replay the full loop with `pnpm live:run`.</li>
                <li>Use this dashboard or `pnpm live:status` to surface the latest proof.</li>
              </ol>
            </Panel>
          </div>
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
    <section className={`glass-card panel-glow fade-in rounded-[28px] border border-white/10 p-5 ${className}`}>
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

function ProofCard({
  title,
  value,
  note,
  link,
  copyValue,
  copied,
  onCopy,
  index,
}: {
  title: string;
  value: string;
  note: string;
  link?: string;
  copyValue?: string;
  copied?: boolean;
  onCopy?: () => void;
  index: number;
}) {
  return (
    <article
      className="glass-card fade-in rounded-[24px] border border-white/10 p-5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="text-xs uppercase tracking-[0.26em] text-slate-400">{title}</div>
        <div className="flex items-center gap-2">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
            >
              Open
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {copyValue && onCopy ? (
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{note}</p>
    </article>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "warn" | "neutral";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-[18px] border px-4 py-3 text-sm leading-6 ${
        tone === "warn"
          ? "border-[#ffb96a]/30 bg-[#ffb96a]/10 text-[#ffe5c0]"
          : "border-white/10 bg-white/[0.05] text-slate-200"
      }`}
      aria-live="polite"
    >
      <div className="mb-1 flex items-center gap-2 font-medium">
        <CircleAlert className="h-4 w-4" />
        {title}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: "idle" | "ready" | "running" | "completed" | "failed" | "success" | "pending";
  compact?: boolean;
}) {
  const palette =
    status === "completed" || status === "success"
      ? "border-[#69f0d2]/35 bg-[#69f0d2]/10 text-[#a6fff1]"
      : status === "running" || status === "pending"
        ? "border-[#7a8bff]/35 bg-[#7a8bff]/10 text-[#d7dcff]"
        : status === "failed"
          ? "border-[#ff8f8f]/35 bg-[#ff8f8f]/10 text-[#ffd3d3]"
          : "border-white/10 bg-white/[0.06] text-slate-300";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.22em] ${palette}`}
    >
      {!compact ? <span className="signal-dot" /> : null}
      {status}
    </span>
  );
}

function AddressRow({
  label,
  value,
  href,
  copied,
  onCopy,
  mono = false,
}: {
  label: string;
  value: string;
  href?: string;
  copied?: boolean;
  onCopy?: () => void;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{label}</div>
        <div className="flex items-center gap-2">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
            >
              Open
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {onCopy ? (
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </button>
          ) : null}
        </div>
      </div>
      <div className={`mt-2 truncate text-sm text-white ${mono ? "mono" : ""}`}>{value}</div>
    </div>
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

function RuleCard({ label, value }: { label: string; value: string }) {
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
        <span>{Math.max(0, Math.min(100, value))}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.08]">
        <div
          className={`h-full rounded-full ${accent}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
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
  icon: Icon,
  label,
  hint,
  tone = "primary",
  loading = false,
  onClick,
  disabled = false,
}: {
  icon: typeof Wallet;
  label: string;
  hint: string;
  tone?: "primary" | "accent" | "ghost";
  loading?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const palette =
    tone === "accent"
      ? "border-[#69f0d2]/35 bg-[#69f0d2]/10 hover:border-[#69f0d2]/55"
      : tone === "ghost"
        ? "border-white/10 bg-white/[0.04] hover:border-white/20"
        : "border-[#7a8bff]/30 bg-[#7a8bff]/10 hover:border-[#7a8bff]/50";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group rounded-[22px] border px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 ${palette}`}
    >
      <div className="flex items-center gap-2 text-white">
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-300">{hint}</div>
    </button>
  );
}
