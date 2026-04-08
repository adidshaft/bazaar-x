"use client";

import {
  ArrowUpRight,
  Bot,
  Copy,
  Footprints,
  Landmark,
  LoaderCircle,
  Map as MapIcon,
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
type DistrictId = "square" | "core" | "shop" | "supplier" | "worker" | "treasury" | "governor";

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
    explorerUrl?: string;
    treasury?: string;
    treasuryBalanceWei?: string;
    treasuryBalanceOkb?: string;
    rules?: readonly unknown[];
    registeredAgentCount?: number;
    nextShopId?: number;
    nextServiceId?: number;
    nextProposalId?: number;
  } | null;
  liveDashboard: {
    manifest: {
      network: string;
      chainId: number;
      rpcUrl: string;
      explorerBaseUrl: string;
      createdAt?: string;
      savedAt?: string;
      deployer: { label?: string; address: string };
      treasury: { label?: string; address: string };
      agents: Array<{
        id?: string;
        role: AgentRole;
        name: string;
        handle?: string;
        goal: string;
        bootstrapOkb: string;
        address: string;
      }>;
    };
    runtime: {
      status: "idle" | "ready" | "running" | "completed" | "failed";
      lastUpdatedAt?: string;
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

type RuntimeStep = {
  key: string;
  label: string;
  status: "pending" | "success" | "failed";
  startedAt: string;
  completedAt?: string;
  txHash?: string;
  explorerUrl?: string;
  detail?: string;
  meta?: Record<string, string | number | boolean | null>;
};

type District = {
  id: DistrictId;
  title: string;
  kicker: string;
  flavor: string;
  summary: string;
  value: string;
  notes: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  approachX: number;
  approachY: number;
  address?: string;
  txHash?: string;
  explorerUrl?: string;
  palette: {
    roof: string;
    wall: string;
    trim: string;
    glow: string;
    chip: string;
  };
};

type QuestStep = {
  id: string;
  label: string;
  status: "locked" | "ready" | "done";
  caption: string;
  hash?: string;
  explorerUrl?: string;
};

const districtFrame = {
  square: { x: 49, y: 56, width: 18, height: 12, approachX: 49, approachY: 62 },
  core: { x: 50, y: 33, width: 14, height: 16, approachX: 50, approachY: 44 },
  shop: { x: 21, y: 55, width: 16, height: 14, approachX: 28, approachY: 64 },
  supplier: { x: 79, y: 45, width: 17, height: 13, approachX: 71, approachY: 54 },
  worker: { x: 73, y: 73, width: 14, height: 12, approachX: 66, approachY: 74 },
  treasury: { x: 56, y: 80, width: 16, height: 12, approachX: 55, approachY: 70 },
  governor: { x: 24, y: 76, width: 14, height: 14, approachX: 32, approachY: 71 },
} as const;

const districtPalette = {
  square: {
    roof: "#f8df8c",
    wall: "#735823",
    trim: "#fff1bf",
    glow: "rgba(248, 223, 140, 0.28)",
    chip: "bg-[#f8df8c]/20 text-[#fff2c8] border-[#f8df8c]/35",
  },
  core: {
    roof: "#ffb35b",
    wall: "#8c431d",
    trim: "#ffe0b5",
    glow: "rgba(255, 179, 91, 0.35)",
    chip: "bg-[#ffb35b]/20 text-[#ffe1bf] border-[#ffb35b]/35",
  },
  shop: {
    roof: "#72f0d3",
    wall: "#1d685c",
    trim: "#d9fffa",
    glow: "rgba(114, 240, 211, 0.28)",
    chip: "bg-[#72f0d3]/20 text-[#d7fffa] border-[#72f0d3]/35",
  },
  supplier: {
    roof: "#86a7ff",
    wall: "#2b458e",
    trim: "#dfe6ff",
    glow: "rgba(134, 167, 255, 0.28)",
    chip: "bg-[#86a7ff]/20 text-[#dfe7ff] border-[#86a7ff]/35",
  },
  worker: {
    roof: "#ff9a8b",
    wall: "#863743",
    trim: "#ffd9d3",
    glow: "rgba(255, 154, 139, 0.28)",
    chip: "bg-[#ff9a8b]/20 text-[#ffe0dc] border-[#ff9a8b]/35",
  },
  treasury: {
    roof: "#b7f47e",
    wall: "#3d6f2d",
    trim: "#e9ffce",
    glow: "rgba(183, 244, 126, 0.28)",
    chip: "bg-[#b7f47e]/20 text-[#ecffd7] border-[#b7f47e]/35",
  },
  governor: {
    roof: "#d4b5ff",
    wall: "#65408f",
    trim: "#f3e5ff",
    glow: "rgba(212, 181, 255, 0.28)",
    chip: "bg-[#d4b5ff]/20 text-[#f3e6ff] border-[#d4b5ff]/35",
  },
} as const;

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

function findLatestStep(steps: RuntimeStep[], matches: string[]) {
  return [...steps].reverse().find((step) => {
    const label = step.label.toLowerCase();
    const detail = step.detail?.toLowerCase() ?? "";
    const key = step.key.toLowerCase();
    return matches.some((match) => label.includes(match) || detail.includes(match) || key.includes(match));
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
  const [selectedId, setSelectedId] = useState<DistrictId>("square");
  const [playerPosition, setPlayerPosition] = useState({ x: 49, y: 62 });
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const { address, chain, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address,
    query: {
      enabled: Boolean(address),
    },
  });
  const queryClient = useQueryClient();

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
  const steps = liveRuntime?.steps ?? [];
  const gatewayGas = liveDashboard?.onchainSnapshot?.gatewayGas?.data?.[0] ?? null;

  const explorerBaseUrl =
    manifest?.explorerBaseUrl ??
    deployment?.explorerBaseUrl ??
    "https://www.oklink.com/x-layer-testnet";
  const contractAddress = bazaarSnapshot?.address ?? deployment?.contractAddress ?? "";
  const treasuryAddress = bazaarSnapshot?.treasury ?? manifest?.treasury.address ?? "";

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

  const manifestAgents = useMemo(
    () => new Map(manifest?.agents.map((agent) => [agent.role, agent]) ?? []),
    [manifest?.agents],
  );
  const fundingByAddress = useMemo(
    () => new Map(funding?.agents.map((entry) => [entry.address.toLowerCase(), entry]) ?? []),
    [funding?.agents],
  );

  const shopStep = findLatestStep(steps, ["create shop", "bazaar forge", "register-shop"]);
  const supplierStep = findLatestStep(steps, ["supplier service", "supplier", "subcontract"]);
  const workerStep = findLatestStep(steps, ["worker", "payment"]);
  const treasuryStep = findLatestStep(steps, ["treasury reinvests", "treasury"]);
  const governorStep = findLatestStep(steps, ["execute governance update", "vote", "proposal"]);
  const deployStep = findLatestStep(steps, ["deploy bazaar x contract"]);
  const paymentStep = findLatestStep(steps, ["post-governance payment", "payment"]);

  const districts = useMemo<District[]>(() => {
    const shopAgent = manifestAgents.get("shop");
    const supplierAgent = manifestAgents.get("supplier");
    const workerAgent = manifestAgents.get("worker");
    const governorAgent = manifestAgents.get("governor");

    const shopFunding = shopAgent
      ? fundingByAddress.get(shopAgent.address.toLowerCase())
      : null;
    const supplierFunding = supplierAgent
      ? fundingByAddress.get(supplierAgent.address.toLowerCase())
      : null;
    const workerFunding = workerAgent
      ? fundingByAddress.get(workerAgent.address.toLowerCase())
      : null;
    return [
      {
        id: "square",
        title: "Bazaar Square",
        kicker: "Town hub",
        flavor: "This is where the whole loop becomes obvious at a glance.",
        summary: "Explore the districts, then use the live controls to replay the economy.",
        value: `${liveRuntime?.txHashes.length ?? 0} live txs`,
        notes: [
          `${manifest?.agents.length ?? 0} agents loaded into the world.`,
          `${bazaarSnapshot?.registeredAgentCount ?? 0} agents registered onchain.`,
          `Status: ${liveRuntime?.status ?? "ready"}.`,
        ],
        ...districtFrame.square,
        palette: districtPalette.square,
      },
      {
        id: "core",
        title: "Settlement Keep",
        kicker: "Core contract",
        flavor: "Every shop, payment, tax, and proposal eventually lands here.",
        summary: contractAddress ? "Bazaar X is deployed and listening." : "Deploy the contract to wake the town.",
        value: contractAddress ? shortHash(contractAddress) : "Deploy pending",
        notes: [
          `Chain: ${manifest?.chainId ?? 1952}.`,
          deployStep?.detail ?? "Contract proof appears here after deployment.",
          `Next proposal id: ${bazaarSnapshot?.nextProposalId ?? liveRuntime?.proposalId ?? 0}.`,
        ],
        address: contractAddress || undefined,
        txHash: deployStep?.txHash ?? deployment?.deployTxHash,
        explorerUrl:
          deployStep?.explorerUrl ??
          (deployment?.deployTxHash ? `${explorerBaseUrl}/tx/${deployment.deployTxHash}` : undefined),
        ...districtFrame.core,
        palette: districtPalette.core,
      },
      {
        id: "shop",
        title: shopAgent?.name ?? "Bazaar Forge",
        kicker: "Demand district",
        flavor: "The market opens here, turning attention into paid work.",
        summary: shopAgent?.goal ?? "Creates the first paid demand in the loop.",
        value: shopFunding ? formatOkb(shopFunding.balanceOkb) : formatOkb(shopAgent?.bootstrapOkb ?? "0.045"),
        notes: [
          shopStep?.detail ?? "Create the shop to start the quest line.",
          shopAgent?.handle ? `Handle: ${shopAgent.handle}.` : "Lead merchant of the economy.",
          shopFunding?.funded ? "Wallet funded and ready." : "Wallet waiting for fuel.",
        ],
        address: shopAgent?.address,
        txHash: shopStep?.txHash,
        explorerUrl: shopStep?.explorerUrl ?? (shopAgent?.address ? `${explorerBaseUrl}/address/${shopAgent.address}` : undefined),
        ...districtFrame.shop,
        palette: districtPalette.shop,
      },
      {
        id: "supplier",
        title: supplierAgent?.name ?? "Supply Coil",
        kicker: "Fulfillment lane",
        flavor: "Listings and subcontracting route through this block.",
        summary: supplierAgent?.goal ?? "Supplies services and relays work to labor.",
        value: supplierFunding
          ? formatOkb(supplierFunding.balanceOkb)
          : formatOkb(supplierAgent?.bootstrapOkb ?? "0.04"),
        notes: [
          supplierStep?.detail ?? "Supplier proof appears after service listing or hiring.",
          supplierStep?.meta?.priceOkb ? `Recent priced action: ${supplierStep.meta.priceOkb} OKB.` : "Tracks listing and subcontract pricing.",
          supplierFunding?.funded ? "Wallet funded and connected." : "Wallet waiting for fuel.",
        ],
        address: supplierAgent?.address,
        txHash: supplierStep?.txHash,
        explorerUrl:
          supplierStep?.explorerUrl ??
          (supplierAgent?.address ? `${explorerBaseUrl}/address/${supplierAgent.address}` : undefined),
        ...districtFrame.supplier,
        palette: districtPalette.supplier,
      },
      {
        id: "worker",
        title: workerAgent?.name ?? "Node Pilot",
        kicker: "Labor quarter",
        flavor: "This district is where paid execution turns into visible proof.",
        summary: workerAgent?.goal ?? "Completes work and compounds earned value.",
        value: workerFunding
          ? formatOkb(workerFunding.balanceOkb)
          : formatOkb(workerAgent?.bootstrapOkb ?? "0.015"),
        notes: [
          paymentStep?.detail ?? workerStep?.detail ?? "The next successful payment shows up here.",
          liveRuntime?.secondTaxWei
            ? `Post-rule tax observed: ${formatOkbFromWei(liveRuntime.secondTaxWei)}.`
            : "Watch this district after governance executes.",
          workerFunding?.funded ? "Worker is solvent." : "Worker needs more runway.",
        ],
        address: workerAgent?.address,
        txHash: paymentStep?.txHash ?? workerStep?.txHash,
        explorerUrl:
          paymentStep?.explorerUrl ??
          workerStep?.explorerUrl ??
          (workerAgent?.address ? `${explorerBaseUrl}/address/${workerAgent.address}` : undefined),
        ...districtFrame.worker,
        palette: districtPalette.worker,
      },
      {
        id: "treasury",
        title: "Treasury Vault",
        kicker: "Tax reserve",
        flavor: "Taxes accumulate here before the loop reinvests capital.",
        summary: "The treasury is the scoreboard for a healthy agent economy.",
        value: formatOkb(bazaarSnapshot?.treasuryBalanceOkb ?? funding?.treasury.balanceOkb ?? "0"),
        notes: [
          treasuryStep?.detail ?? "Treasury proof lands here after taxes route or reinvestment happens.",
          `Current reserve floor: ${formatOkbFromWei(minimumBalanceWei)}.`,
          funding?.treasury.funded ? "Vault wallet funded." : "Vault wallet needs fuel.",
        ],
        address: treasuryAddress || undefined,
        txHash: treasuryStep?.txHash,
        explorerUrl:
          treasuryStep?.explorerUrl ??
          (treasuryAddress ? `${explorerBaseUrl}/address/${treasuryAddress}` : undefined),
        ...districtFrame.treasury,
        palette: districtPalette.treasury,
      },
      {
        id: "governor",
        title: governorAgent?.name ?? "Covenant Council",
        kicker: "Policy tower",
        flavor: "Rules change here, and the next payment proves the town obeys them.",
        summary: governorAgent?.goal ?? "Proposes and executes covenant updates.",
        value: `${(taxBps / 100).toFixed(2)}% tax`,
        notes: [
          governorStep?.detail ?? "Governance proof appears after proposal, vote, and execution.",
          `Quorum ${(quorumBps / 100).toFixed(0)}% · Support ${(supportBps / 100).toFixed(0)}%.`,
          `Voting window ${votingPeriodSeconds}s.`,
        ],
        address: governorAgent?.address,
        txHash: governorStep?.txHash,
        explorerUrl:
          governorStep?.explorerUrl ??
          (governorAgent?.address ? `${explorerBaseUrl}/address/${governorAgent.address}` : undefined),
        ...districtFrame.governor,
        palette: districtPalette.governor,
      },
    ];
  }, [
    bazaarSnapshot?.nextProposalId,
    bazaarSnapshot?.registeredAgentCount,
    bazaarSnapshot?.treasuryBalanceOkb,
    contractAddress,
    deployStep?.detail,
    deployStep?.explorerUrl,
    deployStep?.txHash,
    deployment?.deployTxHash,
    explorerBaseUrl,
    funding?.treasury.balanceOkb,
    funding?.treasury.funded,
    fundingByAddress,
    governorStep?.detail,
    governorStep?.explorerUrl,
    governorStep?.txHash,
    liveRuntime?.proposalId,
    liveRuntime?.secondTaxWei,
    liveRuntime?.status,
    liveRuntime?.txHashes.length,
    manifest?.agents.length,
    manifest?.chainId,
    manifestAgents,
    minimumBalanceWei,
    paymentStep?.detail,
    paymentStep?.explorerUrl,
    paymentStep?.txHash,
    quorumBps,
    shopStep?.detail,
    shopStep?.explorerUrl,
    shopStep?.txHash,
    supplierStep?.detail,
    supplierStep?.explorerUrl,
    supplierStep?.meta,
    supplierStep?.txHash,
    supportBps,
    taxBps,
    treasuryAddress,
    treasuryStep?.detail,
    treasuryStep?.explorerUrl,
    treasuryStep?.txHash,
    votingPeriodSeconds,
    workerStep?.detail,
    workerStep?.txHash,
  ]);

  const selectedDistrict = districts.find((district) => district.id === selectedId) ?? districts[0];
  const nearbyDistrict =
    districts
      .filter((district) => district.id !== "square")
      .find((district) => distance(playerPosition, { x: district.approachX, y: district.approachY }) < 8) ?? null;

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " "].includes(key)) {
        return;
      }

      if (key === " ") {
        event.preventDefault();
        if (nearbyDistrict) {
          setSelectedId(nearbyDistrict.id);
          setPlayerPosition({ x: nearbyDistrict.approachX, y: nearbyDistrict.approachY });
        }
        return;
      }

      event.preventDefault();
      setPlayerPosition((current) => {
        const step = 2.8;
        const next = { ...current };
        if (key === "arrowup" || key === "w") {
          next.y -= step;
        }
        if (key === "arrowdown" || key === "s") {
          next.y += step;
        }
        if (key === "arrowleft" || key === "a") {
          next.x -= step;
        }
        if (key === "arrowright" || key === "d") {
          next.x += step;
        }

        return {
          x: clamp(next.x, 8, 92),
          y: clamp(next.y, 18, 90),
        };
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasMounted, nearbyDistrict]);

  useEffect(() => {
    if (nearbyDistrict) {
      setSelectedId(nearbyDistrict.id);
    }
  }, [nearbyDistrict]);

  const questSteps = useMemo<QuestStep[]>(() => {
    const proposalExecutionStep = findLatestStep(steps, ["execute governance update"]);

    return [
      {
        id: "spawn",
        label: "Spawn",
        status: manifest?.agents.length ? "done" : "ready",
        caption: manifest?.agents.length ? "Agent wallets materialized." : "Create the town roster.",
        hash: manifest?.agents.length ? shopStep?.txHash : undefined,
        explorerUrl: shopStep?.explorerUrl,
      },
      {
        id: "deploy",
        label: "Deploy",
        status: contractAddress ? "done" : manifest?.agents.length ? "ready" : "locked",
        caption: contractAddress ? "Settlement Keep is onchain." : "Deploy Bazaar X to wake the town.",
        hash: deployStep?.txHash ?? deployment?.deployTxHash,
        explorerUrl:
          deployStep?.explorerUrl ??
          (deployment?.deployTxHash ? `${explorerBaseUrl}/tx/${deployment.deployTxHash}` : undefined),
      },
      {
        id: "play",
        label: "Play",
        status: paymentStep?.txHash ? "done" : contractAddress ? "ready" : "locked",
        caption: paymentStep?.txHash ? "Hire and payment loop confirmed." : "Run the economy quest.",
        hash: paymentStep?.txHash,
        explorerUrl: paymentStep?.explorerUrl,
      },
      {
        id: "govern",
        label: "Govern",
        status: proposalExecutionStep?.txHash ? "done" : paymentStep?.txHash ? "ready" : "locked",
        caption: proposalExecutionStep?.txHash ? "Rule change executed." : "Prove the next rule update.",
        hash: proposalExecutionStep?.txHash,
        explorerUrl: proposalExecutionStep?.explorerUrl,
      },
    ];
  }, [
    contractAddress,
    deployment?.deployTxHash,
    explorerBaseUrl,
    manifest?.agents.length,
    paymentStep?.explorerUrl,
    paymentStep?.txHash,
    shopStep?.explorerUrl,
    shopStep?.txHash,
    steps,
    deployStep?.explorerUrl,
    deployStep?.txHash,
  ]);

  const viewerBalance = hasMounted && balance ? formatOkb(Number(balance.formatted)) : "Not connected";
  const lastRefresh =
    hasMounted && statusQuery.dataUpdatedAt
      ? toRelativeTime(new Date(statusQuery.dataUpdatedAt).toISOString())
      : "syncing";
  const canDeploy = Boolean(contractAddress || funding?.readyForDeploy);
  const canRunLive = Boolean(contractAddress || liveRuntime?.deployment?.contractAddress);
  const busyLabel = actionMutation.isPending ? actionMutation.variables?.label ?? null : null;
  const deployHint = contractAddress
    ? "Reuse the recorded deployment and pull fresh proof."
    : funding
      ? funding.readyForDeploy
        ? "Deploy Bazaar X to X Layer testnet."
        : `Need ${funding.requiredDeployerBalanceOkb} OKB in the deployer wallet.`
      : "Checking deployer fuel...";
  const statusError =
    (statusQuery.error instanceof Error ? statusQuery.error.message : null) ??
    (actionMutation.error instanceof Error ? actionMutation.error.message : null);
  const isUnsupportedViewerNetwork = Boolean(
    hasMounted && isConnected && chain && chain.id !== 1952 && chain.id !== 196,
  );

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="aurora" />
      <div className="hero-orb hero-orb-left" />
      <div className="hero-orb hero-orb-right" />

      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <section className="glass-card panel-glow relative overflow-hidden rounded-[30px] border border-white/10 px-5 py-5 sm:px-7">
          <div className="absolute inset-0 soft-grid opacity-10" />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Tag>OKX Build X</Tag>
                <Tag subtle>Game Build</Tag>
                <Tag subtle>{`${manifest?.network ?? "x-layer-testnet"} · chain ${manifest?.chainId ?? 1952}`}</Tag>
                <Tag subtle>{statusQuery.isFetching ? "Refreshing" : `Updated ${lastRefresh}`}</Tag>
              </div>
              <h1 className="display-face balance-text text-4xl font-semibold text-white sm:text-5xl xl:text-[4.2rem]">
                Walk the city. Trigger the loop. Watch the economy govern itself.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Bazaar X is now an explorable onchain town. Move through the districts, inspect the
                actors, and replay the full earn-to-tax-to-govern cycle directly on X Layer.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[720px] xl:grid-cols-4">
              <ActionTile
                icon={Bot}
                label={busyLabel === "Spawn economy" ? "Spawning..." : "Spawn economy"}
                hint="Create the town roster and wallet state."
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
              <ActionTile
                icon={Landmark}
                label={
                  busyLabel === "Deploy to X Layer"
                    ? "Deploying..."
                    : contractAddress
                      ? "Sync proof"
                      : "Deploy to X Layer"
                }
                hint={deployHint}
                loading={busyLabel === "Deploy to X Layer"}
                disabled={actionMutation.isPending || !canDeploy}
                onClick={() =>
                  runAction({
                    label: "Deploy to X Layer",
                    path: "/api/live/deploy",
                  })
                }
              />
              <ActionTile
                icon={Sparkles}
                label={busyLabel === "Play live round" ? "Playing..." : "Play live round"}
                hint="Hire, pay, tax, reinvest, and govern onchain."
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
              <ActionTile
                icon={RefreshCw}
                label="Refresh"
                hint="Pull the latest chain and runtime state."
                tone="ghost"
                loading={statusQuery.isFetching}
                disabled={actionMutation.isPending || statusQuery.isFetching}
                onClick={() => statusQuery.refetch()}
              />
            </div>
          </div>
        </section>

        {statusError ? (
          <Callout tone="warn" title="Status issue">
            {statusError}
          </Callout>
        ) : null}

        {isUnsupportedViewerNetwork ? (
          <Callout tone="warn" title="Wrong viewer network">
            Switch the browser wallet to X Layer testnet (`1952`) or X Layer mainnet (`196`) for a
            clean demo.
          </Callout>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="space-y-4">
            <div className="glass-card panel-glow overflow-hidden rounded-[30px] border border-white/10 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="pixel-label text-[0.95rem] text-[#b9c7e8]">Overworld</div>
                  <h2 className="display-face mt-2 text-2xl font-semibold text-white sm:text-3xl">
                    The Bazaar X Town
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <InfoChip label="Tx" value={String(liveRuntime?.txHashes.length ?? 0)} />
                  <InfoChip label="Tax" value={`${(taxBps / 100).toFixed(2)}%`} />
                  <InfoChip
                    label="Treasury"
                    value={formatOkb(bazaarSnapshot?.treasuryBalanceOkb ?? funding?.treasury.balanceOkb ?? "0")}
                  />
                </div>
              </div>

              <div className="game-frame relative aspect-[16/10] overflow-hidden rounded-[26px] border border-white/10 bg-[#08101a]">
                <div className="scanline-overlay pointer-events-none absolute inset-0 z-10" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,216,153,0.14),transparent_30%),linear-gradient(180deg,#17354b_0%,#11273a_23%,#0f3d3b_23%,#0d573f_47%,#1e6943_68%,#275736_100%)]" />
                <div className="absolute left-[6%] top-[8%] h-[24%] w-[20%] rounded-[40px] border border-white/10 bg-[#0f2946]/75 blur-[2px]" />
                <div className="absolute right-[4%] top-[5%] h-[22%] w-[17%] rounded-[999px] border border-white/10 bg-[#153b62]/70 blur-[1px]" />
                <div className="absolute left-[8%] top-[54%] h-[28%] w-[24%] rounded-[34px] bg-[#2b5337]/75" />
                <div className="absolute right-[7%] top-[58%] h-[24%] w-[18%] rounded-[34px] bg-[#2a5032]/75" />
                <div className="absolute left-[14%] top-[42%] h-[9%] w-[72%] -rotate-[7deg] rounded-full bg-[#c6a65a]" />
                <div className="absolute left-[42%] top-[28%] h-[52%] w-[10%] rounded-full bg-[#d7b66d]" />
                <div className="absolute left-[27%] top-[56%] h-[7%] w-[22%] rounded-full bg-[#e6c57d]" />
                <div className="absolute right-[23%] top-[56%] h-[7%] w-[18%] rounded-full bg-[#e6c57d]" />

                <svg
                  viewBox="0 0 1000 700"
                  className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="route-shop" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(114,240,211,0.18)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
                    </linearGradient>
                    <linearGradient id="route-supplier" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(134,167,255,0.18)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
                    </linearGradient>
                    <linearGradient id="route-worker" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,154,139,0.18)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
                    </linearGradient>
                    <linearGradient id="route-governor" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(212,181,255,0.18)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
                    </linearGradient>
                    <linearGradient id="route-treasury" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(183,244,126,0.18)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
                    </linearGradient>
                  </defs>
                  <path d="M220 400 C 330 360, 420 315, 500 280" fill="none" stroke="url(#route-shop)" strokeWidth="16" strokeLinecap="round" />
                  <path d="M780 340 C 680 325, 595 300, 500 280" fill="none" stroke="url(#route-supplier)" strokeWidth="16" strokeLinecap="round" />
                  <path d="M730 525 C 710 430, 730 390, 780 340" fill="none" stroke="url(#route-worker)" strokeWidth="16" strokeLinecap="round" />
                  <path d="M260 545 C 360 470, 420 390, 500 280" fill="none" stroke="url(#route-governor)" strokeWidth="16" strokeLinecap="round" />
                  <path d="M545 560 C 530 490, 517 420, 500 280" fill="none" stroke="url(#route-treasury)" strokeWidth="16" strokeLinecap="round" />
                </svg>

                <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-[18px] border border-white/10 bg-[#06101d]/85 px-4 py-3 backdrop-blur">
                  <div className="pixel-label text-[#b9c7e8]">Objective</div>
                  <div className="mt-2 max-w-[280px] text-sm leading-6 text-slate-200">
                    Roam the districts, then run the live round to prove hire, payment, tax, treasury,
                    and governance onchain.
                  </div>
                </div>

                <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex flex-wrap gap-2">
                  <Tag subtle>Click any district</Tag>
                  <Tag subtle>WASD / Arrows to roam</Tag>
                  <Tag subtle>{nearbyDistrict ? `Press space near ${nearbyDistrict.title}` : "Follow the roads"}</Tag>
                </div>

                <div
                  className="pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
                  style={{
                    left: `${playerPosition.x}%`,
                    top: `${playerPosition.y}%`,
                  }}
                >
                  <div className="avatar-bob relative h-10 w-10">
                    <div className="absolute left-1/2 top-full h-4 w-6 -translate-x-1/2 rounded-full bg-black/25 blur-[3px]" />
                    <div className="absolute inset-x-2 top-1 h-3 rounded-t-[8px] bg-[#0f172a] border border-white/10" />
                    <div className="absolute inset-x-1 top-3 h-5 rounded-[10px] border border-[#89ffe9]/30 bg-[#5cf1d1]" />
                    <div className="absolute bottom-0 left-2 h-3 w-2 rounded-b bg-[#f2caa0]" />
                    <div className="absolute bottom-0 right-2 h-3 w-2 rounded-b bg-[#f2caa0]" />
                  </div>
                </div>

                {districts.map((district) => {
                  const selected = selectedDistrict.id === district.id;
                  const nearby = nearbyDistrict?.id === district.id;
                  const isSquare = district.id === "square";

                  if (isSquare) {
                    return (
                      <button
                        key={district.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(district.id);
                          setPlayerPosition({ x: district.approachX, y: district.approachY });
                        }}
                        className={`absolute z-[6] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border px-5 py-4 text-left transition duration-200 ${
                          selected
                            ? "border-white/30 bg-black/30 shadow-[0_0_40px_rgba(248,223,140,0.18)]"
                            : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/25"
                        }`}
                        style={{
                          left: `${district.x}%`,
                          top: `${district.y}%`,
                          width: `${district.width}%`,
                        }}
                      >
                        <div className="pixel-label text-[1rem] text-[#ffeeb6]">Bazaar Square</div>
                        <div className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-300">
                          {district.value}
                        </div>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={district.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(district.id);
                        setPlayerPosition({ x: district.approachX, y: district.approachY });
                      }}
                      className="absolute z-[6] -translate-x-1/2 -translate-y-1/2 text-left transition duration-200 hover:scale-[1.02] focus:outline-none"
                      style={{
                        left: `${district.x}%`,
                        top: `${district.y}%`,
                        width: `${district.width}%`,
                        height: `${district.height}%`,
                      }}
                    >
                      <div
                        className="absolute inset-x-[12%] bottom-[-10%] h-[26%] rounded-full blur-[10px]"
                        style={{ backgroundColor: district.palette.glow }}
                      />
                      <div
                        className={`absolute inset-x-[16%] top-[16%] h-[30%] rounded-[12px] border ${
                          selected ? "ring-2 ring-white/35" : ""
                        }`}
                        style={{
                          backgroundColor: district.palette.roof,
                          borderColor: selected ? "rgba(255,255,255,0.8)" : district.palette.trim,
                          boxShadow: selected ? `0 0 28px ${district.palette.glow}` : undefined,
                        }}
                      />
                      <div
                        className={`absolute inset-x-[10%] bottom-[12%] top-[34%] rounded-[18px] border ${
                          selected ? "ring-2 ring-white/20" : ""
                        }`}
                        style={{
                          backgroundColor: district.palette.wall,
                          borderColor: "rgba(255,255,255,0.18)",
                        }}
                      />
                      <div
                        className="absolute left-1/2 top-[54%] h-[18%] w-[20%] -translate-x-1/2 rounded-t-[8px] border border-white/10 bg-black/20"
                      />
                      <div
                        className="absolute left-1/2 top-[-24%] -translate-x-1/2 whitespace-nowrap rounded-full border px-3 py-1"
                        style={{
                          backgroundColor: "rgba(5, 11, 23, 0.82)",
                          borderColor: selected ? district.palette.trim : "rgba(255,255,255,0.1)",
                          boxShadow: nearby ? `0 0 16px ${district.palette.glow}` : undefined,
                        }}
                      >
                        <span className="pixel-label text-[0.95rem]" style={{ color: district.palette.trim }}>
                          {district.title}
                        </span>
                      </div>
                      <div className="absolute inset-x-0 bottom-[-24%] flex justify-center">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] ${
                            selected || nearby ? district.palette.chip : "border-white/10 bg-black/30 text-slate-300"
                          }`}
                        >
                          {nearby ? "Inspect" : district.kicker}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {questSteps.map((step) => (
                <QuestCard key={step.id} step={step} />
              ))}
            </div>
          </div>

          <aside className="grid gap-4">
            <section className="glass-card panel-glow rounded-[30px] border border-white/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="pixel-label text-[#b9c7e8]">Field Notes</div>
                  <h3 className="display-face mt-2 text-2xl font-semibold text-white">
                    {selectedDistrict.title}
                  </h3>
                  <div className="mt-2 text-sm uppercase tracking-[0.24em] text-slate-400">
                    {selectedDistrict.kicker}
                  </div>
                </div>
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: selectedDistrict.palette.roof }}
                />
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-300">{selectedDistrict.flavor}</p>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="pixel-label text-[#b9c7e8]">Live readout</div>
                <div className="mt-3 text-xl font-semibold text-white">{selectedDistrict.value}</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{selectedDistrict.summary}</div>
              </div>

              <div className="mt-4 grid gap-3">
                {selectedDistrict.notes.map((note) => (
                  <InfoRow key={note}>{note}</InfoRow>
                ))}
              </div>

              {selectedDistrict.address ? (
                <ProofDock
                  className="mt-4"
                  label="Address"
                  value={selectedDistrict.address}
                  href={selectedDistrict.explorerUrl ?? `${explorerBaseUrl}/address/${selectedDistrict.address}`}
                  copied={copiedValue === selectedDistrict.address}
                  onCopy={() => copyText(selectedDistrict.address ?? "")}
                />
              ) : null}

              {selectedDistrict.txHash ? (
                <ProofDock
                  className="mt-4"
                  label="Latest proof"
                  value={selectedDistrict.txHash}
                  href={selectedDistrict.explorerUrl ?? `${explorerBaseUrl}/tx/${selectedDistrict.txHash}`}
                  copied={copiedValue === selectedDistrict.txHash}
                  onCopy={() => copyText(selectedDistrict.txHash ?? "")}
                />
              ) : null}

              {selectedDistrict.id === "governor" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MiniStat label="Tax" value={`${(taxBps / 100).toFixed(2)}%`} />
                  <MiniStat label="Floor" value={formatOkbFromWei(minimumBalanceWei)} />
                  <MiniStat label="Quorum" value={`${(quorumBps / 100).toFixed(0)}%`} />
                  <MiniStat label="Support" value={`${(supportBps / 100).toFixed(0)}%`} />
                </div>
              ) : null}
            </section>

            <section className="glass-card panel-glow rounded-[30px] border border-white/10 p-5">
              <div className="flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-[#89ffe9]" />
                <div className="pixel-label text-[#b9c7e8]">Player HUD</div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniStat label="Viewer" value={hasMounted && isConnected && address ? shortHash(address) : "Spectator"} />
                <MiniStat label="Wallet" value={viewerBalance} />
                <MiniStat label="Gas" value={gatewayGas?.normal ? `${gatewayGas.normal} wei` : "Live"} />
                <MiniStat label="Nearby" value={nearbyDistrict?.title ?? "Open road"} />
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div suppressHydrationWarning className="text-sm leading-6 text-slate-300">
                  {hasMounted && isConnected && address
                    ? `Connected on ${chain?.name ?? "unknown network"}.`
                    : "No wallet is required to explore the town. Connect only if you want to verify viewer network state."}
                </div>
                <div className="mt-4">
                  <ConnectWalletButton />
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-slate-200">
                  <Footprints className="h-4 w-4 text-[#89ffe9]" />
                  <div className="pixel-label text-[#b9c7e8]">Controls</div>
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-300">
                  Click any district to jump there. On desktop, move with arrow keys or WASD and hit
                  space near a building to inspect it.
                </div>
              </div>
            </section>
          </aside>
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
      className={`rounded-[22px] border px-4 py-3 text-sm leading-6 ${
        tone === "warn"
          ? "border-[#ffb96a]/35 bg-[#ffb96a]/10 text-[#ffe5c0]"
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

function ActionTile({
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
        : "border-[#86a7ff]/30 bg-[#86a7ff]/10 hover:border-[#86a7ff]/50";

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

function QuestCard({ step }: { step: QuestStep }) {
  const palette =
    step.status === "done"
      ? "border-[#69f0d2]/25 bg-[#69f0d2]/10"
      : step.status === "ready"
        ? "border-[#ffb35b]/25 bg-[#ffb35b]/10"
        : "border-white/10 bg-white/[0.04]";

  return (
    <article className={`glass-card panel-glow rounded-[22px] border p-4 ${palette}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="pixel-label text-[#d9e5ff]">{step.label}</div>
        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">{step.status}</div>
      </div>
      <div className="mt-3 text-sm leading-6 text-slate-300">{step.caption}</div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="mono text-sm text-white">{step.hash ? shortHash(step.hash) : "Pending"}</div>
        {step.explorerUrl ? (
          <a
            href={step.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-300 transition hover:text-white"
          >
            Open
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function ProofDock({
  className,
  label,
  value,
  href,
  copied,
  onCopy,
}: {
  className?: string;
  label: string;
  value: string;
  href?: string;
  copied?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className={`rounded-[22px] border border-white/10 bg-black/20 p-4 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="pixel-label text-[#b9c7e8]">{label}</div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>
      <div className="mono mt-3 break-all text-sm text-white">{value}</div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5">
      <span className="pixel-label text-[#b9c7e8]">{label}</span>
      <span className="ml-2 text-sm font-medium text-white">{value}</span>
    </div>
  );
}

function InfoRow({ children }: { children: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-3">
      <div className="pixel-label text-[#b9c7e8]">{label}</div>
      <div className="mt-2 text-sm font-medium text-white">{value}</div>
    </div>
  );
}
