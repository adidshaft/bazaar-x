"use client";

import {
  ArrowUpRight,
  Bot,
  Copy,
  Landmark,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useBalance } from "wagmi";
import { ConnectWalletButton } from "./connect-wallet-button";

type AgentRole = "shop" | "supplier" | "worker" | "governor";

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
        role: AgentRole;
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

type SceneActor = {
  id: "core" | "treasury" | AgentRole;
  title: string;
  kicker: string;
  note: string;
  address?: string;
  value: string;
  status: string;
  txHash?: string;
  explorerUrl?: string;
  x: number;
  y: number;
  height: number;
  palette: {
    top: string;
    left: string;
    right: string;
    outline: string;
    glow: string;
  };
};

type ProofCard = {
  id: string;
  title: string;
  caption: string;
  hash?: string;
  explorerUrl?: string;
};

const fallbackAgents = {
  shop: {
    name: "Bazaar Forge",
    goal: "Creates demand and turns work into revenue.",
    budget: "1.250 OKB",
  },
  supplier: {
    name: "Supply Coil",
    goal: "Routes inventory and hires downstream labor.",
    budget: "0.620 OKB",
  },
  worker: {
    name: "Node Pilot",
    goal: "Executes tasks and compounds earned value.",
    budget: "0.410 OKB",
  },
  governor: {
    name: "Covenant Council",
    goal: "Adjusts tax and reserve rules.",
    budget: "Governance seat",
  },
} as const;

const actorPalette = {
  core: {
    top: "#ffcc70",
    left: "#8e4c14",
    right: "#c8741f",
    outline: "#ffe7b7",
    glow: "rgba(255, 196, 108, 0.35)",
  },
  treasury: {
    top: "#b5f784",
    left: "#356b2a",
    right: "#5b9a36",
    outline: "#e4ffce",
    glow: "rgba(181, 247, 132, 0.25)",
  },
  shop: {
    top: "#6ce8d6",
    left: "#155d57",
    right: "#2ea89d",
    outline: "#ccfffb",
    glow: "rgba(108, 232, 214, 0.28)",
  },
  supplier: {
    top: "#8ea8ff",
    left: "#2b4188",
    right: "#5b73c9",
    outline: "#dde4ff",
    glow: "rgba(142, 168, 255, 0.28)",
  },
  worker: {
    top: "#ff8f8f",
    left: "#7b2f3a",
    right: "#c05666",
    outline: "#ffd8dc",
    glow: "rgba(255, 143, 143, 0.25)",
  },
  governor: {
    top: "#d4b3ff",
    left: "#5c398f",
    right: "#8d63c9",
    outline: "#f0e2ff",
    glow: "rgba(212, 179, 255, 0.28)",
  },
} as const;

const actorLayout = {
  core: { x: 470, y: 210, height: 112 },
  treasury: { x: 548, y: 392, height: 74 },
  shop: { x: 210, y: 216, height: 94 },
  supplier: { x: 744, y: 194, height: 88 },
  worker: { x: 774, y: 356, height: 72 },
  governor: { x: 205, y: 372, height: 72 },
} as const;

const proofQueries = [
  { id: "deploy", title: "Deploy", match: "deploy bazaar x contract" },
  { id: "proposal", title: "Governance", match: "execute governance update" },
  { id: "payment", title: "Settlement", match: "post-governance payment" },
  { id: "treasury", title: "Treasury", match: "treasury reinvests" },
] as const;

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
      (payload as { error?: { message?: string }; message?: string } | null)?.error?.message ??
        (payload as { error?: { message?: string }; message?: string } | null)?.message ??
        "Request failed.",
    );
  }

  return payload;
}

async function fetchStatus() {
  const response = await fetch("/api/status", {
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | DashboardResponse
    | { error?: { message?: string }; message?: string }
    | null;

  if (!response.ok) {
    const errorPayload = payload as { error?: { message?: string }; message?: string } | null;
    throw new Error(
      errorPayload?.error?.message ?? errorPayload?.message ?? "Failed to load status.",
    );
  }

  return payload as DashboardResponse;
}

export function BazaarDashboard() {
  const [hasMounted, setHasMounted] = useState(false);
  const { address, chain, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address,
    query: {
      enabled: Boolean(address),
    },
  });
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<SceneActor["id"]>("core");
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

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

  async function runAction(request: ActionRequest) {
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
  const manifest = liveDashboard?.manifest ?? null;
  const liveRuntime = liveDashboard?.runtime ?? null;
  const funding = liveDashboard?.funding ?? null;
  const bazaarSnapshot = liveDashboard?.bazaarSnapshot ?? null;
  const deployment = liveRuntime?.deployment ?? null;
  const gatewayGas = liveDashboard?.onchainSnapshot?.gatewayGas?.data?.[0] ?? null;

  const explorerBaseUrl =
    manifest?.explorerBaseUrl ??
    deployment?.explorerBaseUrl ??
    "https://www.oklink.com/x-layer-testnet";
  const contractAddress = bazaarSnapshot?.address ?? deployment?.contractAddress ?? "";
  const treasuryAddress = bazaarSnapshot?.treasury ?? manifest?.treasury.address ?? "";
  const deployTxHash = deployment?.deployTxHash;

  const taxBps = Number(ruleValue(bazaarSnapshot?.rules, 0) ?? deployment?.initialRules.taxBps ?? 500);
  const minimumBalanceWei =
    ruleValue(bazaarSnapshot?.rules, 1) ?? deployment?.initialRules.minimumBalanceWei ?? null;
  const quorumBps = Number(
    ruleValue(bazaarSnapshot?.rules, 2) ?? deployment?.initialRules.quorumBps ?? 7500,
  );
  const supportBps = Number(
    ruleValue(bazaarSnapshot?.rules, 3) ?? deployment?.initialRules.supportBps ?? 6000,
  );
  const votingPeriodSeconds = Number(
    ruleValue(bazaarSnapshot?.rules, 4) ?? deployment?.initialRules.votingPeriodSeconds ?? 10,
  );

  const actorRecords = useMemo(() => {
    const manifestAgents = new Map(
      manifest?.agents.map((agent) => [agent.role, agent]) ?? [],
    );
    const fundingByAddress = new Map(
      funding?.agents.map((record) => [record.address.toLowerCase(), record]) ?? [],
    );
    const steps = liveRuntime?.steps ?? [];

    const agentStep = (role: AgentRole) =>
      [...steps].reverse().find(
        (step) => step.key.includes(role) || step.label.toLowerCase().includes(role),
      );

    const buildAgent = (role: AgentRole): SceneActor => {
      const manifestAgent = manifestAgents.get(role);
      const fallback = fallbackAgents[role];
      const balanceRecord = manifestAgent
        ? fundingByAddress.get(manifestAgent.address.toLowerCase())
        : null;
      const latestStep = agentStep(role);

      return {
        id: role,
        title: manifestAgent?.name ?? fallback.name,
        kicker:
          role === "shop"
            ? "Demand engine"
            : role === "supplier"
              ? "Fulfillment relay"
              : role === "worker"
                ? "Execution labor"
                : "Policy steward",
        note: manifestAgent?.goal ?? fallback.goal,
        address: manifestAgent?.address,
        value: balanceRecord
          ? formatOkb(balanceRecord.balanceOkb)
          : fallback.budget.endsWith("OKB")
            ? fallback.budget
            : fallback.budget,
        status: latestStep?.label ?? (balanceRecord?.funded ? "Wallet funded" : "Waiting"),
        txHash: latestStep?.txHash,
        explorerUrl: latestStep?.explorerUrl,
        x: actorLayout[role].x,
        y: actorLayout[role].y,
        height: actorLayout[role].height,
        palette: actorPalette[role],
      };
    };

    const core: SceneActor = {
      id: "core",
      title: "Bazaar Core",
      kicker: "Settlement contract",
      note:
        "Handles shops, hires, tax routing, treasury accounting, and governance execution on X Layer.",
      address: contractAddress || undefined,
      value: contractAddress ? shortHash(contractAddress) : "Deploy pending",
      status: liveRuntime?.status ?? "ready",
      txHash: deployTxHash,
      explorerUrl: deployTxHash ? `${explorerBaseUrl}/tx/${deployTxHash}` : undefined,
      x: actorLayout.core.x,
      y: actorLayout.core.y,
      height: actorLayout.core.height,
      palette: actorPalette.core,
    };

    const treasury: SceneActor = {
      id: "treasury",
      title: "Treasury Vault",
      kicker: "Reserve wallet",
      note: "Collects tax, holds reserves, and reinvests value back into the market.",
      address: treasuryAddress || undefined,
      value: formatOkb(
        bazaarSnapshot?.treasuryBalanceOkb ?? funding?.treasury.balanceOkb ?? "0",
      ),
      status: funding?.treasury.funded ? "Treasury funded" : "Funding needed",
      txHash:
        [...steps].reverse().find((step) => step.label.toLowerCase().includes("treasury"))?.txHash ??
        undefined,
      explorerUrl:
        [...steps].reverse().find((step) => step.label.toLowerCase().includes("treasury"))?.explorerUrl ??
        (treasuryAddress ? `${explorerBaseUrl}/address/${treasuryAddress}` : undefined),
      x: actorLayout.treasury.x,
      y: actorLayout.treasury.y,
      height: actorLayout.treasury.height,
      palette: actorPalette.treasury,
    };

    return [core, treasury, buildAgent("shop"), buildAgent("supplier"), buildAgent("worker"), buildAgent("governor")];
  }, [
    bazaarSnapshot?.treasuryBalanceOkb,
    contractAddress,
    deployTxHash,
    explorerBaseUrl,
    funding?.agents,
    funding?.treasury.balanceOkb,
    funding?.treasury.funded,
    liveRuntime?.status,
    liveRuntime?.steps,
    manifest?.agents,
    treasuryAddress,
  ]);

  const selectedActor = actorRecords.find((actor) => actor.id === selectedId) ?? actorRecords[0];
  const viewerBalance =
    hasMounted && balance ? formatOkb(Number(balance.formatted)) : "Not connected";
  const canDeploy = Boolean(funding?.readyForDeploy || contractAddress);
  const canRunLive = Boolean(contractAddress || funding?.readyForDeploy);
  const busyLabel = actionMutation.isPending ? actionMutation.variables?.label ?? null : null;
  const statusError =
    (statusQuery.error instanceof Error ? statusQuery.error.message : null) ??
    (actionMutation.error instanceof Error ? actionMutation.error.message : null);
  const isUnsupportedViewerNetwork = Boolean(
    hasMounted && isConnected && chain && chain.id !== 1952 && chain.id !== 196,
  );
  const lastRefresh = hasMounted && statusQuery.dataUpdatedAt
    ? toRelativeTime(new Date(statusQuery.dataUpdatedAt).toISOString())
    : "waiting";

  const proofCards = useMemo<ProofCard[]>(() => {
    const steps = liveRuntime?.steps ?? [];

    return proofQueries.map((query) => {
      const match = steps.find((step) =>
        step.label.toLowerCase().includes(query.match),
      );

      if (query.id === "deploy") {
        return {
          id: query.id,
          title: query.title,
          caption: contractAddress
            ? `Contract ${shortHash(contractAddress)}`
            : "Contract not deployed yet",
          hash: match?.txHash ?? deployTxHash,
          explorerUrl:
            match?.explorerUrl ??
            (deployTxHash ? `${explorerBaseUrl}/tx/${deployTxHash}` : undefined),
        };
      }

      return {
        id: query.id,
        title: query.title,
        caption: match?.detail ?? "Replay the live flow to materialize this proof.",
        hash: match?.txHash,
        explorerUrl: match?.explorerUrl,
      };
    });
  }, [contractAddress, deployTxHash, explorerBaseUrl, liveRuntime?.steps]);

  const proofSummary = [
    {
      label: "Live txs",
      value: String(liveRuntime?.txHashes.length ?? 0),
    },
    {
      label: "Tax",
      value: `${(taxBps / 100).toFixed(2)}%`,
    },
    {
      label: "Min balance",
      value: formatOkbFromWei(minimumBalanceWei),
    },
    {
      label: "Treasury",
      value: formatOkb(bazaarSnapshot?.treasuryBalanceOkb ?? funding?.treasury.balanceOkb ?? "0"),
    },
  ];

  const connections = [
    { from: "shop", to: "core", label: "Demand" },
    { from: "supplier", to: "core", label: "Listing" },
    { from: "worker", to: "supplier", label: "Subcontract" },
    { from: "governor", to: "core", label: "Vote" },
    { from: "core", to: "treasury", label: "Tax" },
  ] as const;
  const selectedActorTxHref = selectedActor?.txHash
    ? selectedActor.explorerUrl ?? `${explorerBaseUrl}/tx/${selectedActor.txHash}`
    : undefined;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="aurora" />
      <div className="hero-orb hero-orb-left" />
      <div className="hero-orb hero-orb-right" />

      <div className="mx-auto flex min-h-screen w-full max-w-[1560px] flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="glass-card panel-glow relative overflow-hidden rounded-[32px] border border-white/10 px-5 py-5 sm:px-7">
          <div className="absolute inset-0 soft-grid opacity-15" />
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Tag>OKX Build X</Tag>
                <Tag subtle>X Layer Arena</Tag>
                <Tag subtle>{`${manifest?.network ?? "x-layer-testnet"} · chain ${manifest?.chainId ?? 1952}`}</Tag>
                <Tag subtle>{statusQuery.isFetching ? "Refreshing" : `Updated ${lastRefresh}`}</Tag>
              </div>

              <div className="max-w-4xl">
                <h1 className="display-face balance-text text-4xl font-semibold text-white sm:text-5xl xl:text-6xl">
                  Bazaar X makes a live agent economy feel like a strategy game.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  One board. Four agents. Real X Layer transactions. Click any district to inspect
                  who earned, who paid tax, and how governance changed the next move.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ControlButton
                  icon={Bot}
                  label={busyLabel === "Spawn economy" ? "Spawning..." : "Spawn economy"}
                  hint="Materialize the agent wallets and starting state."
                  loading={busyLabel === "Spawn economy"}
                  disabled={actionMutation.isPending}
                  onClick={() =>
                    runAction({
                      label: "Spawn economy",
                      path: "/api/agents/init",
                      body: {
                        count: 5,
                        seed: "bazaar-x-live",
                        initialBudget: 1000,
                      },
                    })
                  }
                />
                <ControlButton
                  icon={Landmark}
                  label={
                    busyLabel === "Deploy to X Layer"
                      ? "Deploying..."
                      : contractAddress
                        ? "Sync proof"
                        : "Deploy to X Layer"
                  }
                  hint={
                    contractAddress
                      ? "Reuse the recorded deployment and pull fresh proof."
                      : canDeploy
                        ? "Deploy Bazaar X to X Layer testnet."
                        : `Need ${funding?.requiredDeployerBalanceOkb ?? "0"} OKB.`
                  }
                  loading={busyLabel === "Deploy to X Layer"}
                  disabled={actionMutation.isPending || !canDeploy}
                  onClick={() =>
                    runAction({
                      label: "Deploy to X Layer",
                      path: "/api/live/deploy",
                    })
                  }
                />
                <ControlButton
                  icon={Sparkles}
                  label={busyLabel === "Play live round" ? "Playing..." : "Play live round"}
                  hint="Run hire, payment, tax, treasury, and governance onchain."
                  tone="accent"
                  loading={busyLabel === "Play live round"}
                  disabled={actionMutation.isPending || !canRunLive}
                  onClick={() =>
                    runAction({
                      label: "Play live round",
                      path: "/api/live/run",
                    })
                  }
                />
                <ControlButton
                  icon={RefreshCw}
                  label="Refresh"
                  hint="Pull fresh chain and runtime state."
                  tone="ghost"
                  loading={statusQuery.isFetching}
                  disabled={actionMutation.isPending || statusQuery.isFetching}
                  onClick={() => statusQuery.refetch()}
                />
              </div>

              {statusError ? (
                <Callout tone="warn" title="Status issue">
                  {statusError}
                </Callout>
              ) : null}

              {isUnsupportedViewerNetwork ? (
                <Callout tone="warn" title="Wrong viewer network">
                  Switch the browser wallet to X Layer testnet (`1952`) or X Layer mainnet (`196`)
                  for a clean demo.
                </Callout>
              ) : null}
            </div>

            <div>
              <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      Viewer wallet
                    </div>
                    <div suppressHydrationWarning className="mt-2 text-lg font-semibold text-white">
                      {hasMounted && isConnected && address
                        ? shortHash(address)
                        : "Optional spectator wallet"}
                    </div>
                    <div suppressHydrationWarning className="mt-2 text-sm leading-6 text-slate-300">
                      {hasMounted && isConnected && address
                        ? `Connected on ${chain?.name ?? "unknown network"}`
                        : "Watch the board without connecting, or attach a wallet to verify network readiness."}
                    </div>
                  </div>
                  <ConnectWalletButton />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MetricPill label="Balance" value={viewerBalance} />
                  <MetricPill
                    label="Gas snapshot"
                    value={gatewayGas?.normal ? `${gatewayGas.normal} wei` : "live"}
                  />
                </div>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Live proof
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {proofSummary.map((item) => (
                      <MetricPill key={item.label} label={item.label} value={item.value} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_320px]">
          <div className="glass-card panel-glow overflow-hidden rounded-[32px] border border-white/10 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Bazaar World
                </div>
                <h2 className="display-face mt-2 text-2xl font-semibold text-white">
                  The game board is the product
                </h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-300">
                {liveRuntime?.status ?? "ready"}
              </div>
            </div>

            <div className="game-stage relative aspect-[16/10] overflow-hidden rounded-[28px] border border-white/10 bg-[#090d18] p-2">
              <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3">
                <div className="max-w-[260px] rounded-[20px] border border-white/10 bg-[#06101d]/80 px-4 py-3 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                    Selected district
                  </div>
                  <div className="mt-2 text-base font-semibold text-white">{selectedActor.title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-300">{selectedActor.status}</div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-white/10 bg-[#06101d]/80 px-4 py-3 text-right backdrop-blur">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Live txs
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {liveRuntime?.txHashes.length ?? 0}
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-[#06101d]/80 px-4 py-3 text-right backdrop-blur">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Treasury
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {formatOkb(bazaarSnapshot?.treasuryBalanceOkb ?? funding?.treasury.balanceOkb ?? "0")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
                <Tag subtle>Click a district</Tag>
                <Tag subtle>Earn → tax → govern</Tag>
              </div>

              <svg
                viewBox="0 0 960 620"
                className="h-full w-full"
                role="img"
                aria-label="Low-poly Bazaar X economy board"
              >
                <defs>
                  <linearGradient id="board-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#102340" />
                    <stop offset="100%" stopColor="#05070e" />
                  </linearGradient>
                </defs>

                <rect width="960" height="620" fill="url(#board-glow)" />
                <polygon points="480,58 930,282 480,540 30,282" fill="#0a1425" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                <polygon points="480,112 824,284 480,460 136,284" fill="#0f1f36" opacity="0.78" />
                <polygon points="480,156 742,286 480,418 218,286" fill="#132846" opacity="0.88" />
                <polygon points="480,196 662,286 480,378 298,286" fill="#193258" />

                {connections.map((connection) => {
                  const from = actorRecords.find((actor) => actor.id === connection.from);
                  const to = actorRecords.find((actor) => actor.id === connection.to);

                  if (!from || !to) {
                    return null;
                  }

                  const midX = (from.x + to.x) / 2;
                  const midY = (from.y + to.y) / 2;
                  const isSelectedConnection =
                    connection.to === selectedActor.id || connection.from === selectedActor.id;

                  return (
                    <g key={`${connection.from}-${connection.to}`}>
                      <polyline
                        points={`${from.x},${from.y} ${to.x},${to.y}`}
                        fill="none"
                        stroke={from.palette.glow}
                        strokeWidth={isSelectedConnection ? 6 : 3}
                        opacity={isSelectedConnection ? 0.35 : 0.12}
                      />
                      <circle
                        cx={midX}
                        cy={midY}
                        r="7"
                        fill={from.palette.top}
                        opacity={isSelectedConnection ? 1 : liveRuntime?.txHashes.length ? 0.55 : 0.25}
                        className="scene-token"
                      />
                      <text
                        x={midX}
                        y={midY - 16}
                        fill={isSelectedConnection ? "rgba(244, 247, 255, 0.82)" : "rgba(230, 236, 255, 0.35)"}
                        fontSize="11"
                        textAnchor="middle"
                        letterSpacing="0.22em"
                      >
                        {connection.label.toUpperCase()}
                      </text>
                    </g>
                  );
                })}

                {actorRecords.map((actor) => {
                  const selected = actor.id === selectedActor.id;
                  const topY = actor.y - actor.height;
                  const halfWidth = actor.id === "core" ? 82 : 64;
                  const topDepth = actor.id === "core" ? 36 : 28;
                  const baseDepth = actor.id === "core" ? 28 : 22;

                  return (
                    <g
                      key={actor.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(actor.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(actor.id);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <ellipse
                        cx={actor.x}
                        cy={actor.y + 22}
                        rx={halfWidth * 0.9}
                        ry="22"
                        fill={actor.palette.glow}
                        opacity={selected ? 1 : 0.65}
                      />
                      <polygon
                        points={`${actor.x},${topY} ${actor.x + halfWidth},${topY + topDepth} ${actor.x},${topY + topDepth * 2} ${actor.x - halfWidth},${topY + topDepth}`}
                        fill={actor.palette.top}
                        stroke={selected ? "#ffffff" : actor.palette.outline}
                        strokeWidth={selected ? 3 : 1.5}
                      />
                      <polygon
                        points={`${actor.x - halfWidth},${topY + topDepth} ${actor.x},${topY + topDepth * 2} ${actor.x},${actor.y} ${actor.x - halfWidth},${actor.y - baseDepth}`}
                        fill={actor.palette.left}
                        stroke={selected ? "#ffffff" : "rgba(255,255,255,0.18)"}
                        strokeWidth={selected ? 2.5 : 1}
                      />
                      <polygon
                        points={`${actor.x + halfWidth},${topY + topDepth} ${actor.x},${topY + topDepth * 2} ${actor.x},${actor.y} ${actor.x + halfWidth},${actor.y - baseDepth}`}
                        fill={actor.palette.right}
                        stroke={selected ? "#ffffff" : "rgba(255,255,255,0.18)"}
                        strokeWidth={selected ? 2.5 : 1}
                      />
                      <polygon
                        points={`${actor.x},${actor.y - baseDepth * 2} ${actor.x + halfWidth},${actor.y - baseDepth} ${actor.x},${actor.y} ${actor.x - halfWidth},${actor.y - baseDepth}`}
                        fill="rgba(255,255,255,0.05)"
                        opacity="0.45"
                      />
                      <text
                        x={actor.x}
                        y={actor.y + 62}
                        fill="#f4f7ff"
                        fontSize={selected ? "20" : "18"}
                        textAnchor="middle"
                        fontWeight="700"
                      >
                        {actor.title}
                      </text>
                      <text
                        x={actor.x}
                        y={actor.y + 84}
                        fill="rgba(222,229,255,0.75)"
                        fontSize="12"
                        letterSpacing="0.18em"
                        textAnchor="middle"
                      >
                        {actor.kicker.toUpperCase()}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="grid gap-5">
            <aside className="glass-card panel-glow rounded-[32px] border border-white/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Selected actor
                  </div>
                  <h3 className="display-face mt-2 text-2xl font-semibold text-white">
                    {selectedActor.title}
                  </h3>
                </div>
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: selectedActor.palette.top }}
                />
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-300">{selectedActor.note}</p>

              <div className="mt-5 grid gap-3">
                <MetricPill label="Role" value={selectedActor.kicker} />
                <MetricPill label="Value" value={selectedActor.value} />
                <MetricPill label="Now" value={selectedActor.status} />
              </div>

              {selectedActor.address ? (
                <div className="mt-5 rounded-[20px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Address
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(selectedActor.address ?? "")}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiedValue === selectedActor.address ? "Copied" : "Copy"}
                      </button>
                      <a
                        href={selectedActor.explorerUrl ?? `${explorerBaseUrl}/address/${selectedActor.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
                      >
                        Open
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                  <div className="mono mt-2 truncate text-sm text-white">{selectedActor.address}</div>
                </div>
              ) : null}

              {selectedActor.txHash ? (
                <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Latest proof hash
                    </div>
                    {selectedActorTxHref ? (
                      <a
                        href={selectedActorTxHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
                      >
                        Open
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                  <div className="mono mt-2 text-sm text-white">{shortHash(selectedActor.txHash)}</div>
                </div>
              ) : null}
            </aside>

            <aside className="glass-card panel-glow rounded-[32px] border border-white/10 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Covenant snapshot
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetricPill label="Tax" value={`${(taxBps / 100).toFixed(2)}%`} />
                <MetricPill label="Floor" value={formatOkbFromWei(minimumBalanceWei)} />
                <MetricPill label="Quorum" value={`${(quorumBps / 100).toFixed(2)}%`} />
                <MetricPill label="Support" value={`${(supportBps / 100).toFixed(2)}%`} />
              </div>
              <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-slate-300">
                Voting window: {votingPeriodSeconds}s. The next settlement proves the rule update.
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          {proofCards.map((card) => (
            <article
              key={card.id}
              className="glass-card panel-glow rounded-[26px] border border-white/10 p-5"
            >
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                {card.title}
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">{card.caption}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="mono text-sm text-white">
                  {card.hash ? shortHash(card.hash) : "Pending"}
                </div>
                {card.explorerUrl ? (
                  <a
                    href={card.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
                  >
                    Open
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function Tag({
  children,
  subtle = false,
}: {
  children: string;
  subtle?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${
        subtle
          ? "border border-white/10 bg-white/[0.05] text-slate-300"
          : "border border-[#69f0d2]/30 bg-[#69f0d2]/10 font-semibold text-[#a6fff1]"
      }`}
    >
      {children}
    </span>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "warn" | "neutral";
  title: string;
  children: string;
}) {
  return (
    <div
      className={`rounded-[18px] border px-4 py-3 text-sm leading-6 ${
        tone === "warn"
          ? "border-[#ffb96a]/30 bg-[#ffb96a]/10 text-[#ffe5c0]"
          : "border-white/10 bg-white/[0.05] text-slate-200"
      }`}
    >
      <div className="mb-1 flex items-center gap-2 font-medium">
        <ShieldAlert className="h-4 w-4" />
        {title}
      </div>
      {children}
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function ControlButton({
  icon: Icon,
  label,
  hint,
  tone = "primary",
  loading = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  tone?: "primary" | "accent" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
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
      className={`rounded-[22px] border px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 ${palette}`}
    >
      <div className="flex items-center gap-2 text-white">
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-300">{hint}</div>
    </button>
  );
}
