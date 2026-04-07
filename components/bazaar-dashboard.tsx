"use client";

import {
  ArrowUpRight,
  Bot,
  ChevronDown,
  ChevronUp,
  Copy,
  Landmark,
  LoaderCircle,
  Map as MapIcon,
  RefreshCw,
  Wallet,
  Sparkles,
  X,
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
  skills: Array<{
    id: string;
    name: string;
    description: string;
    version: string;
    tags: string[];
  }>;
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

type ControlMode = "auto" | "manual";
type DockPanel = "focus" | "quests" | "wallet" | "live";

type VillageAgent = {
  id: AgentRole | "courier";
  title: string;
  role: string;
  status: string;
  route: DistrictId[];
  speed: number;
  offset: number;
  color: string;
  accent: string;
};

type ScenerySpot = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  roof: string;
  wall: string;
};

type VillageProp = {
  id: string;
  kind: "tree" | "field" | "camp" | "cart" | "lamp";
  x: number;
  y: number;
  scale?: number;
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

const courierRoute: DistrictId[] = ["square", "shop", "core", "supplier", "worker", "treasury", "governor", "core", "square"];

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

function moveTowardPoint(current: { x: number; y: number }, target: { x: number; y: number }, step: number) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.hypot(dx, dy);

  if (dist <= step || dist === 0) {
    return target;
  }

  return {
    x: current.x + (dx / dist) * step,
    y: current.y + (dy / dist) * step,
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function sampleRoutePoint(
  route: DistrictId[],
  districtPoints: Map<DistrictId, { x: number; y: number }>,
  progress: number,
) {
  if (!route.length) {
    return { x: 50, y: 50 };
  }

  const normalized = progress % route.length;
  const index = Math.floor(normalized);
  const nextIndex = (index + 1) % route.length;
  const t = normalized - index;
  const from = districtPoints.get(route[index]) ?? { x: 50, y: 50 };
  const to = districtPoints.get(route[nextIndex]) ?? from;

  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
  };
}

function nearestRouteIndex(
  route: DistrictId[],
  districtPoints: Map<DistrictId, { x: number; y: number }>,
  position: { x: number; y: number },
) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  route.forEach((districtId, index) => {
    const point = districtPoints.get(districtId);
    if (!point) {
      return;
    }

    const nextDistance = distance(point, position);
    if (nextDistance < bestDistance) {
      bestDistance = nextDistance;
      bestIndex = index;
    }
  });

  return bestIndex;
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
  const [controlMode, setControlMode] = useState<ControlMode>("auto");
  const [activePanel, setActivePanel] = useState<DockPanel | null>(null);
  const [bootReady, setBootReady] = useState(false);
  const [showSystemPanel, setShowSystemPanel] = useState(false);
  const [playerPosition, setPlayerPosition] = useState({ x: 49, y: 62 });
  const [autoRouteIndex, setAutoRouteIndex] = useState(0);
  const [worldTick, setWorldTick] = useState(0);
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBootReady(true);
    }, 900);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setWorldTick((current) => current + 1);
    }, 160);

    return () => window.clearInterval(interval);
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
  const installedSkills = dashboardStatus?.skills ?? [];
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
  const districtLookup = useMemo(
    () => new globalThis.Map(districts.map((district) => [district.id, district] as const)),
    [districts],
  );
  const districtPoints = useMemo(
    () =>
      new globalThis.Map(
        districts.map((district) => [district.id, { x: district.approachX, y: district.approachY }] as const),
      ),
    [districts],
  );
  const nearbyDistrict =
    districts
      .filter((district) => district.id !== "square")
      .find((district) => distance(playerPosition, { x: district.approachX, y: district.approachY }) < 8) ?? null;
  const courierTargetId = courierRoute[autoRouteIndex % courierRoute.length];
  const courierTargetTitle = districtLookup.get(courierTargetId)?.title ?? "route";

  function focusDistrict(district: District) {
    setActivePanel("focus");
    setControlMode("manual");
    setSelectedId(district.id);
    setPlayerPosition({ x: district.approachX, y: district.approachY });
  }

  function engageAutoControl() {
    setControlMode("auto");
    setAutoRouteIndex(nearestRouteIndex(courierRoute, districtPoints, playerPosition));
  }

  function engageManualControl() {
    setControlMode("manual");
  }

  const villageAgents = useMemo<VillageAgent[]>(
    () => [
      {
        id: "courier",
        title: "You",
        role: controlMode === "auto" ? "Auto courier" : "Manual courier",
        status:
          controlMode === "auto"
            ? `Following ${courierTargetTitle}`
            : nearbyDistrict
              ? `Exploring near ${nearbyDistrict.title}`
              : "Roaming the village",
        route: courierRoute,
        speed: 0.09,
        offset: 0,
        color: "#5cf1d1",
        accent: "#d5fff7",
      },
      {
        id: "shop",
        title: manifestAgents.get("shop")?.name ?? "Bazaar Forge",
        role: "Merchant",
        status: shopStep?.detail ?? "Stocking the market square",
        route: ["shop", "square", "core", "shop"],
        speed: 0.06,
        offset: 0.5,
        color: "#72f0d3",
        accent: "#e1fffa",
      },
      {
        id: "supplier",
        title: manifestAgents.get("supplier")?.name ?? "Supply Coil",
        role: "Supplier",
        status: supplierStep?.detail ?? "Running goods through the east lane",
        route: ["supplier", "core", "worker", "supplier"],
        speed: 0.055,
        offset: 1.4,
        color: "#86a7ff",
        accent: "#eff3ff",
      },
      {
        id: "worker",
        title: manifestAgents.get("worker")?.name ?? "Node Pilot",
        role: "Worker",
        status: paymentStep?.detail ?? workerStep?.detail ?? "Executing tasks on the south road",
        route: ["worker", "supplier", "square", "worker"],
        speed: 0.07,
        offset: 2.2,
        color: "#ff9a8b",
        accent: "#ffe6e0",
      },
      {
        id: "governor",
        title: manifestAgents.get("governor")?.name ?? "Covenant Council",
        role: "Governor",
        status: governorStep?.detail ?? "Reviewing rules in the council tower",
        route: ["governor", "core", "treasury", "governor"],
        speed: 0.045,
        offset: 3.1,
        color: "#d4b5ff",
        accent: "#f7ecff",
      },
    ],
    [
      controlMode,
      courierTargetTitle,
      governorStep?.detail,
      manifestAgents,
      nearbyDistrict,
      paymentStep?.detail,
      shopStep?.detail,
      supplierStep?.detail,
      workerStep?.detail,
    ],
  );

  const npcPositions = useMemo(
    () =>
      villageAgents.map((agent) => ({
        ...agent,
        position:
          agent.id === "courier"
            ? playerPosition
            : sampleRoutePoint(agent.route, districtPoints, worldTick * agent.speed + agent.offset),
      })),
    [districtPoints, playerPosition, villageAgents, worldTick],
  );

  const scenerySpots: ScenerySpot[] = [
    { id: "inn", title: "Inn", x: 12, y: 26, width: 12, height: 10, roof: "#d26f55", wall: "#7e402f" },
    { id: "archive", title: "Archive", x: 30, y: 18, width: 10, height: 8, roof: "#96a8d8", wall: "#4b587a" },
    { id: "watch", title: "Watch", x: 88, y: 20, width: 8, height: 12, roof: "#c7cedd", wall: "#586071" },
    { id: "orchard", title: "Orchard", x: 14, y: 82, width: 10, height: 8, roof: "#7dbf59", wall: "#476537" },
    { id: "dock", title: "Dock", x: 88, y: 84, width: 11, height: 8, roof: "#8fb4cc", wall: "#4a5e68" },
    { id: "gate", title: "Gate", x: 49, y: 8, width: 12, height: 6, roof: "#d2bd7f", wall: "#69552a" },
  ];

  const villageProps: VillageProp[] = [
    { id: "tree-1", kind: "tree", x: 9, y: 48, scale: 1.15 },
    { id: "tree-2", kind: "tree", x: 17, y: 36, scale: 0.95 },
    { id: "tree-3", kind: "tree", x: 32, y: 83, scale: 1.05 },
    { id: "tree-4", kind: "tree", x: 63, y: 13, scale: 0.9 },
    { id: "tree-5", kind: "tree", x: 82, y: 66, scale: 1.1 },
    { id: "field-1", kind: "field", x: 74, y: 14, scale: 1.1 },
    { id: "field-2", kind: "field", x: 12, y: 69, scale: 1.05 },
    { id: "camp-1", kind: "camp", x: 68, y: 31, scale: 0.95 },
    { id: "camp-2", kind: "camp", x: 35, y: 67, scale: 0.95 },
    { id: "cart-1", kind: "cart", x: 57, y: 58, scale: 0.9 },
    { id: "lamp-1", kind: "lamp", x: 44, y: 53, scale: 1 },
    { id: "lamp-2", kind: "lamp", x: 54, y: 43, scale: 1 },
  ];

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
          focusDistrict(nearbyDistrict);
        }
        return;
      }

      event.preventDefault();
      if (controlMode !== "manual") {
        engageManualControl();
      }
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
  }, [controlMode, hasMounted, nearbyDistrict]);

  useEffect(() => {
    if (nearbyDistrict) {
      setSelectedId(nearbyDistrict.id);
    }
  }, [nearbyDistrict]);

  useEffect(() => {
    if (controlMode !== "auto") {
      return;
    }

    const targetId = courierRoute[autoRouteIndex % courierRoute.length];
    const target = districtPoints.get(targetId);

    if (!target) {
      return;
    }

    setPlayerPosition((current) => {
      const next = moveTowardPoint(current, target, 1.4);
      if (distance(next, target) < 0.8) {
        setSelectedId(targetId);
        setAutoRouteIndex((index) => (index + 1) % courierRoute.length);
      }
      return next;
    });
  }, [autoRouteIndex, controlMode, districtPoints, worldTick]);

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
  const questFocus =
    questSteps.find((step) => step.status === "ready") ??
    questSteps.find((step) => step.status === "locked") ??
    questSteps[questSteps.length - 1];
  const showBootSplash = !hasMounted || !bootReady || statusQuery.isLoading;
  const walletGateVisible = !showBootSplash && hasMounted && !isConnected;
  const activeWorkers = npcPositions.filter((agent) => agent.id !== "courier").length;
  const visibleActivityAgents = npcPositions.filter((agent) => agent.id !== "courier").slice(0, 3);
  const skillsSummary = installedSkills.length
    ? installedSkills.map((skill) => skill.name).join(", ")
    : "No world skills loaded.";
  const primaryQuestAction =
    !manifest?.agents.length
      ? {
          label: "Spawn economy",
          hint: "Create the town roster and wallet state.",
          icon: Bot,
          disabled: actionMutation.isPending || walletGateVisible,
          loading: busyLabel === "Spawn economy",
          onClick: () =>
            runAction({
              label: "Spawn economy",
              path: "/api/agents/init",
              body: {
                count: 5,
                seed: "bazaar-x-live",
                initialBudget: 1000,
              },
            }),
        }
      : !contractAddress
        ? {
            label: "Deploy to X Layer",
            hint: deployHint,
            icon: Landmark,
            disabled: actionMutation.isPending || !canDeploy || walletGateVisible,
            loading: busyLabel === "Deploy to X Layer",
            onClick: () =>
              runAction({
                label: "Deploy to X Layer",
                path: "/api/live/deploy",
              }),
          }
        : {
            label: "Play live round",
            hint: "Hire, pay, tax, reinvest, and govern onchain.",
            icon: Sparkles,
            disabled: actionMutation.isPending || !canRunLive || walletGateVisible,
            loading: busyLabel === "Play live round",
            onClick: () =>
              runAction({
                label: "Play live round",
                path: "/api/live/run",
              }),
          };
  const liveAlert = statusError
    ? statusError
    : isUnsupportedViewerNetwork
      ? "Switch the connected wallet to X Layer testnet (1952) or mainnet (196)."
      : "Wallet is the only sign-in. Use the dock for compact controls and proofs.";

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-[#f5f1e7] text-[#15120f]">
      <div className="pixel-plaza absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_40%,rgba(0,0,0,0.06))]" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="pixel-water absolute left-[31%] top-[7%] h-[50%] w-[23%] border-[6px] border-[#f3ebfb] shadow-[0_0_0_4px_#8f8a97]" style={{ clipPath: "polygon(32% 0%,100% 0%,100% 100%,0 100%,0 26%)" }} />
        <div className="pixel-water absolute right-[-3%] top-[9%] h-[46%] w-[18%] border-[6px] border-[#f3ebfb] shadow-[0_0_0_4px_#8f8a97]" />
        <div className="absolute left-[55%] top-[52%] h-[8%] w-[14%] border-[4px] border-[#171411] bg-[#2f8d39]" />
        <div className="absolute left-[68%] top-[41%] h-[18%] w-[4%] border-[4px] border-[#171411] bg-[#2f8d39]" />
        <div className="absolute right-[4%] top-[48%] h-[10%] w-[10%] border-[4px] border-[#171411] bg-[#2f8d39]" />
        <div className="absolute left-[12%] top-[8%] h-[14%] w-[8%] border-[4px] border-[#171411] bg-[#3b9d46]" />
        <div className="absolute left-[8%] bottom-[18%] h-[9%] w-[11%] border-[4px] border-[#171411] bg-[#62b946]" />
        <div className="absolute bottom-[10%] right-[8%] h-[16%] w-[14%] rounded-full border-[6px] border-[#171411] bg-[radial-gradient(circle,#d5e7ff_0%,#89c2ff_45%,#3f7bc0_100%)] opacity-85" />
        <div className="absolute bottom-[10%] left-[-2%] h-[20%] w-[15%] bg-[linear-gradient(180deg,#6a4c36_0%,#6a4c36_55%,#523828_55%,#523828_100%)]" />
        <div className="absolute bottom-[0%] left-0 right-0 h-[12%] bg-[linear-gradient(180deg,#674b38_0%,#674b38_48%,#4e3527_48%,#4e3527_100%)]" />

        <svg
          viewBox="0 0 1000 700"
          className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="route-shop" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(114,240,211,0.6)" />
              <stop offset="100%" stopColor="rgba(11,17,32,0.04)" />
            </linearGradient>
            <linearGradient id="route-supplier" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(134,167,255,0.58)" />
              <stop offset="100%" stopColor="rgba(11,17,32,0.05)" />
            </linearGradient>
            <linearGradient id="route-worker" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,154,139,0.56)" />
              <stop offset="100%" stopColor="rgba(11,17,32,0.05)" />
            </linearGradient>
            <linearGradient id="route-governor" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(212,181,255,0.56)" />
              <stop offset="100%" stopColor="rgba(11,17,32,0.05)" />
            </linearGradient>
            <linearGradient id="route-treasury" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(183,244,126,0.56)" />
              <stop offset="100%" stopColor="rgba(11,17,32,0.05)" />
            </linearGradient>
          </defs>
          <path d="M220 400 C 330 360, 420 315, 500 280" fill="none" stroke="url(#route-shop)" strokeWidth="18" strokeLinecap="square" />
          <path d="M780 340 C 680 325, 595 300, 500 280" fill="none" stroke="url(#route-supplier)" strokeWidth="18" strokeLinecap="square" />
          <path d="M730 525 C 710 430, 730 390, 780 340" fill="none" stroke="url(#route-worker)" strokeWidth="18" strokeLinecap="square" />
          <path d="M260 545 C 360 470, 420 390, 500 280" fill="none" stroke="url(#route-governor)" strokeWidth="18" strokeLinecap="square" />
          <path d="M545 560 C 530 490, 517 420, 500 280" fill="none" stroke="url(#route-treasury)" strokeWidth="18" strokeLinecap="square" />
        </svg>

        {villageProps.map((prop) => (
          <WorldProp key={prop.id} prop={prop} />
        ))}

        {scenerySpots.map((spot) => (
          <div
            key={spot.id}
            className="pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              width: `${spot.width}%`,
              height: `${spot.height}%`,
            }}
          >
            <div
              className="absolute inset-x-[16%] top-[10%] h-[28%] border-[4px] border-[#171411]"
              style={{ backgroundColor: spot.roof }}
            />
            <div
              className="absolute inset-x-[8%] bottom-[8%] top-[32%] border-[4px] border-[#171411]"
              style={{ backgroundColor: spot.wall }}
            />
          </div>
        ))}

        <div
          className="pointer-events-none absolute z-[7] -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
          style={{
            left: `${playerPosition.x}%`,
            top: `${playerPosition.y}%`,
          }}
        >
          <div className={`avatar-bob relative h-12 w-12 ${controlMode === "auto" ? "opacity-95" : ""}`}>
            <div className="absolute left-1/2 top-full h-4 w-7 -translate-x-1/2 bg-black/20 blur-[4px]" />
            <div className="absolute inset-x-2 top-0 h-3 border-[3px] border-[#171411] bg-[#1a2a33]" />
            <div className="absolute inset-x-1 top-3 h-6 border-[3px] border-[#171411] bg-[#f3c44f]" />
            <div className="absolute bottom-0 left-2 h-3 w-2 bg-[#f2caa0]" />
            <div className="absolute bottom-0 right-2 h-3 w-2 bg-[#f2caa0]" />
          </div>
          <div className="arcade-face absolute left-1/2 top-[-22px] -translate-x-1/2 whitespace-nowrap text-[0.52rem] text-[#1b1713]">
            {controlMode === "auto" ? "AUTO" : "YOU"}
          </div>
        </div>

        {npcPositions
          .filter((agent) => agent.id !== "courier")
          .map((agent) => (
            <div
              key={agent.id}
              className="pointer-events-none absolute z-[6] -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
              style={{
                left: `${agent.position.x}%`,
                top: `${agent.position.y}%`,
              }}
            >
              <div className="avatar-bob relative h-9 w-9">
                <div className="absolute left-1/2 top-full h-3 w-5 -translate-x-1/2 bg-black/20 blur-[4px]" />
                <div className="absolute inset-x-1 top-0 h-2 border-[2px] border-[#171411] bg-[#1a2a33]" />
                <div
                  className="absolute inset-x-0.5 top-2.5 h-4 border-[2px] border-[#171411]"
                  style={{ backgroundColor: agent.color }}
                />
                <div className="absolute bottom-0 left-1.5 h-2.5 w-1.5 bg-[#f2caa0]" />
                <div className="absolute bottom-0 right-1.5 h-2.5 w-1.5 bg-[#f2caa0]" />
              </div>
              {activePanel === "live" ? (
                <div className="arcade-face absolute left-1/2 top-[-16px] -translate-x-1/2 whitespace-nowrap text-[0.48rem]" style={{ color: "#171411" }}>
                  {agent.role}
                </div>
              ) : null}
            </div>
          ))}

        {districts.map((district) => {
          const selected = selectedDistrict.id === district.id;
          const nearby = nearbyDistrict?.id === district.id;
          const isSquare = district.id === "square";

          return (
            <button
              key={district.id}
              type="button"
              onClick={() => focusDistrict(district)}
              className="absolute z-[8] -translate-x-1/2 -translate-y-1/2 text-left transition hover:scale-[1.02] focus:outline-none"
              style={{
                left: `${district.x}%`,
                top: `${district.y}%`,
                width: `${district.width}%`,
                height: `${district.height}%`,
              }}
            >
              <div
                className="absolute inset-x-[12%] bottom-[-12%] h-[22%] blur-[8px]"
                style={{ backgroundColor: district.palette.glow }}
              />
              <div
                className={`absolute inset-x-[16%] top-[16%] h-[30%] border-[4px] border-[#171411] ${selected ? "scale-[1.02]" : ""}`}
                style={{
                  backgroundColor: district.palette.roof,
                  boxShadow: selected ? `0 0 0 4px rgba(255,255,255,0.35), 0 10px 24px ${district.palette.glow}` : undefined,
                }}
              />
              <div
                className={`absolute inset-x-[10%] bottom-[12%] top-[34%] border-[4px] border-[#171411] ${isSquare ? "bg-[#4e3723]" : ""}`}
                style={{
                  backgroundColor: isSquare ? "#4e3723" : district.palette.wall,
                }}
              />
              <div className="absolute left-1/2 top-[54%] h-[18%] w-[20%] -translate-x-1/2 border-[3px] border-[#171411] bg-[#1d1b18]" />
              <div
                className="absolute left-1/2 top-[-24%] -translate-x-1/2 whitespace-nowrap px-2 py-1"
                style={{
                  opacity: selected || nearby ? 1 : 0,
                }}
              >
                <span className="arcade-face text-[0.46rem]" style={{ color: "#171411" }}>
                  {district.title}
                </span>
              </div>
              {selected || nearby ? (
                <div className="absolute inset-x-0 bottom-[-22%] flex justify-center">
                  <span className="arcade-face bg-[#171411] px-2 py-1 text-[0.44rem] text-[#f7f2e9]">
                    {nearby ? "inspect" : district.kicker}
                  </span>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="absolute inset-x-3 top-3 z-30 flex items-start justify-between gap-3 sm:inset-x-4 sm:top-4">
        <div className="pixel-window w-[min(360px,calc(100vw-1rem))] px-4 py-4 text-[#1a1714]">
          <div className="arcade-face text-[0.48rem] text-[#6b6256]">OKX Build X Hackathon</div>
          <div className="arcade-face mt-3 text-[clamp(0.82rem,1.6vw,1.15rem)] leading-[1.8]">
            Bazaar X Village
          </div>
          <div className="mt-3 text-sm leading-6 text-[#4d4338]">
            {questFocus?.caption ?? "Walk the village and trigger the onchain loop."}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <BriefChip label="Status" value={liveRuntime?.status ?? "ready"} />
            <BriefChip label="Tx" value={String(liveRuntime?.txHashes.length ?? 0)} />
            <BriefChip
              label="Treasury"
              value={formatOkb(bazaarSnapshot?.treasuryBalanceOkb ?? funding?.treasury.balanceOkb ?? "0")}
            />
            <BriefChip label="Tax" value={`${(taxBps / 100).toFixed(2)}%`} />
          </div>
        </div>

        <div className="flex items-start gap-2">
          {showSystemPanel ? (
            <div className="pixel-window w-[min(320px,calc(100vw-1rem))] px-4 py-4 text-[#1a1714]">
              <div className="flex items-center justify-between gap-3">
                <div className="arcade-face text-[0.5rem]">Brief System</div>
                <button
                  type="button"
                  onClick={() => setShowSystemPanel(false)}
                  className="inline-flex h-8 w-8 items-center justify-center border-4 border-[#171411] bg-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm leading-6 text-[#4d4338]">
                <MiniStat label="Workers" value={String(activeWorkers)} />
                <MiniStat label="Skills" value={String(installedSkills.length)} />
              </div>
              <div className={`mt-4 border-4 px-3 py-3 text-sm leading-6 ${statusError || isUnsupportedViewerNetwork ? "border-[#7d221b] bg-[#f6d9d1] text-[#5d1b16]" : "border-[#171411] bg-white/70 text-[#4d4338]"}`}>
                {liveAlert}
              </div>
              <details className="mt-4 border-4 border-[#171411] bg-white/70 px-3 py-3">
                <summary className="arcade-face cursor-pointer text-[0.46rem] text-[#171411]">
                  installed systems
                </summary>
                <div className="mt-3 text-sm leading-6 text-[#4d4338]">{skillsSummary}</div>
                <div className="mt-3 grid gap-2">
                  {installedSkills.map((skill) => (
                    <div key={skill.id} className="border-4 border-[#171411] bg-[#f8f2e9] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="arcade-face text-[0.44rem] text-[#171411]">{skill.name}</div>
                        <div className="text-xs text-[#6b6256]">v{skill.version}</div>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[#4d4338]">{skill.description}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {skill.tags.map((tag) => (
                          <span
                            key={tag}
                            className="arcade-face border-2 border-[#171411] bg-white px-2 py-1 text-[0.38rem] text-[#171411]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ) : null}

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setShowSystemPanel((current) => !current)}
              className={`pixel-button inline-flex items-center gap-2 px-3 py-2 ${statusError || isUnsupportedViewerNetwork ? "bg-[#f06c50] text-white" : "bg-[#ffffff] text-[#171411]"}`}
            >
              <span className="arcade-face text-[0.48rem]">{showSystemPanel ? "Hide brief" : "Brief"}</span>
              {showSystemPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {hasMounted && isConnected && address ? (
              <button
                type="button"
                onClick={() => setActivePanel((current) => (current === "wallet" ? null : "wallet"))}
                className="pixel-button inline-flex items-center gap-2 bg-[#ffffff] px-3 py-2 text-[#171411]"
              >
                <span className="arcade-face text-[0.48rem]">Wallet</span>
                <span className="text-xs font-medium">{shortHash(address)}</span>
              </button>
            ) : (
              <ConnectWalletButton variant="pixel" />
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-[98px] left-1/2 z-30 w-[min(780px,calc(100vw-1rem))] -translate-x-1/2 px-2">
        {activePanel === "focus" ? (
          <div className="pointer-events-auto pixel-window-dark px-4 py-4 text-[#f8f2e9]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="arcade-face text-[0.5rem] text-[#f4d594]">{selectedDistrict.title}</div>
                <div className="mt-2 text-sm leading-6 text-[#d4cabd]">{selectedDistrict.summary}</div>
              </div>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="inline-flex h-8 w-8 items-center justify-center border-4 border-[#171411] bg-[#f8f2e9] text-[#171411]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {selectedDistrict.txHash ? (
              <ProofDock
                className="mt-4"
                label="Latest tx"
                value={selectedDistrict.txHash}
                href={selectedDistrict.explorerUrl ?? `${explorerBaseUrl}/tx/${selectedDistrict.txHash}`}
                copied={copiedValue === selectedDistrict.txHash}
                onCopy={() => copyText(selectedDistrict.txHash ?? "")}
              />
            ) : selectedDistrict.address ? (
              <ProofDock
                className="mt-4"
                label="Address"
                value={selectedDistrict.address}
                href={selectedDistrict.explorerUrl ?? `${explorerBaseUrl}/address/${selectedDistrict.address}`}
                copied={copiedValue === selectedDistrict.address}
                onCopy={() => copyText(selectedDistrict.address ?? "")}
              />
            ) : null}
            <details className="mt-4 border-4 border-[#171411] bg-[#131923] px-3 py-3">
              <summary className="arcade-face cursor-pointer text-[0.48rem] text-[#f8f2e9]">district notes</summary>
              <div className="mt-3 grid gap-2">
                {selectedDistrict.notes.map((note) => (
                  <InfoRow key={note}>{note}</InfoRow>
                ))}
              </div>
            </details>
            {selectedDistrict.address || selectedDistrict.txHash ? (
              <details className="mt-3 border-4 border-[#171411] bg-[#131923] px-3 py-3">
                <summary className="arcade-face cursor-pointer text-[0.48rem] text-[#f8f2e9]">onchain proof</summary>
                {selectedDistrict.address ? (
                  <ProofDock
                    className="mt-3"
                    label="Address"
                    value={selectedDistrict.address}
                    href={selectedDistrict.explorerUrl ?? `${explorerBaseUrl}/address/${selectedDistrict.address}`}
                    copied={copiedValue === selectedDistrict.address}
                    onCopy={() => copyText(selectedDistrict.address ?? "")}
                  />
                ) : null}
                {selectedDistrict.txHash ? (
                  <ProofDock
                    className="mt-3"
                    label="Latest tx"
                    value={selectedDistrict.txHash}
                    href={selectedDistrict.explorerUrl ?? `${explorerBaseUrl}/tx/${selectedDistrict.txHash}`}
                    copied={copiedValue === selectedDistrict.txHash}
                    onCopy={() => copyText(selectedDistrict.txHash ?? "")}
                  />
                ) : null}
              </details>
            ) : null}
          </div>
        ) : null}

        {activePanel === "quests" ? (
          <div className="pointer-events-auto pixel-window-dark px-4 py-4 text-[#f8f2e9]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="arcade-face text-[0.5rem] text-[#f4d594]">Quest Rail</div>
                <div className="mt-2 text-sm leading-6 text-[#d4cabd]">
                  Run only what matters: spawn agents, deploy Bazaar X, play the live round, and prove governance.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="inline-flex h-8 w-8 items-center justify-center border-4 border-[#171411] bg-[#f8f2e9] text-[#171411]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ActionTile
                icon={primaryQuestAction.icon}
                label={primaryQuestAction.loading ? `${primaryQuestAction.label}...` : primaryQuestAction.label}
                hint={primaryQuestAction.hint}
                tone="accent"
                loading={primaryQuestAction.loading}
                disabled={primaryQuestAction.disabled}
                onClick={primaryQuestAction.onClick}
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
            <details className="mt-4 border-4 border-[#171411] bg-[#131923] px-3 py-3">
              <summary className="arcade-face cursor-pointer text-[0.48rem] text-[#f8f2e9]">
                manual controls
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ActionTile
                  icon={Bot}
                  label={busyLabel === "Spawn economy" ? "Spawning..." : "Spawn economy"}
                  hint="Create the town roster and wallet state."
                  loading={busyLabel === "Spawn economy"}
                  disabled={actionMutation.isPending || walletGateVisible}
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
                  disabled={actionMutation.isPending || !canDeploy || walletGateVisible}
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
                  disabled={actionMutation.isPending || !canRunLive || walletGateVisible}
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
            </details>
            <div className="mt-4 grid gap-3">
              {questSteps.map((step) => (
                <QuestCard key={step.id} step={step} compact />
              ))}
            </div>
          </div>
        ) : null}

        {activePanel === "wallet" ? (
          <div className="pointer-events-auto pixel-window-dark px-4 py-4 text-[#f8f2e9]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="arcade-face text-[0.5rem] text-[#f4d594]">Wallet + Controls</div>
                <div className="mt-2 text-sm leading-6 text-[#d4cabd]">
                  Wallet connection is the only login. Switch between auto patrol and manual control anytime.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="inline-flex h-8 w-8 items-center justify-center border-4 border-[#171411] bg-[#f8f2e9] text-[#171411]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={engageAutoControl}
                className={`pixel-button px-3 py-2 ${controlMode === "auto" ? "bg-[#f16f51] text-white" : "bg-[#f8f2e9] text-[#171411]"}`}
              >
                <span className="arcade-face text-[0.48rem]">Auto patrol</span>
              </button>
              <button
                type="button"
                onClick={engageManualControl}
                className={`pixel-button px-3 py-2 ${controlMode === "manual" ? "bg-[#f16f51] text-white" : "bg-[#f8f2e9] text-[#171411]"}`}
              >
                <span className="arcade-face text-[0.48rem]">Manual</span>
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MiniStat label="Viewer" value={hasMounted && isConnected && address ? shortHash(address) : "Not connected"} />
              <MiniStat label="Wallet" value={viewerBalance} />
              <MiniStat label="Gas" value={gatewayGas?.normal ? `${gatewayGas.normal} wei` : "Live"} />
              <MiniStat label="Nearby" value={nearbyDistrict?.title ?? "Open road"} />
            </div>
            <div className="mt-4">
              <ConnectWalletButton variant="pixel" fullWidth />
            </div>
            <div className="mt-4 border-4 border-[#171411] bg-[#131923] px-3 py-3 text-sm leading-6 text-[#d4cabd]">
              Move with arrow keys or WASD. Press space when you are near a district to inspect it instantly.
            </div>
          </div>
        ) : null}

        {activePanel === "live" ? (
          <div className="pointer-events-auto pixel-window-dark px-4 py-4 text-[#f8f2e9]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="arcade-face text-[0.5rem] text-[#f4d594]">Live City</div>
                <div className="mt-2 text-sm leading-6 text-[#d4cabd]">
                  Brief live state only. Open districts when you want specifics.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="inline-flex h-8 w-8 items-center justify-center border-4 border-[#171411] bg-[#f8f2e9] text-[#171411]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MiniStat label="Status" value={liveRuntime?.status ?? "ready"} />
              <MiniStat label="Updated" value={lastRefresh} />
              <MiniStat label="Treasury" value={formatOkb(bazaarSnapshot?.treasuryBalanceOkb ?? funding?.treasury.balanceOkb ?? "0")} />
              <MiniStat label="Tax" value={`${(taxBps / 100).toFixed(2)}%`} />
            </div>
            <details className="mt-4 border-4 border-[#171411] bg-[#131923] px-3 py-3">
              <summary className="arcade-face cursor-pointer text-[0.48rem] text-[#f8f2e9]">city activity</summary>
              <div className="mt-3 grid gap-2">
                {visibleActivityAgents.map((agent) => (
                  <div key={agent.id} className="border-4 border-[#171411] bg-[#0f141d] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="arcade-face text-[0.44rem] text-[#f8f2e9]">{agent.title}</div>
                      <div className="h-3 w-3 border-2 border-[#171411]" style={{ backgroundColor: agent.color }} />
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[#d4cabd]">{agent.status}</div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-4 left-1/2 z-30 w-[min(720px,calc(100vw-1rem))] -translate-x-1/2 px-2">
        <div className="pixel-window-dark flex items-center justify-between gap-2 px-2 py-2 text-[#f8f2e9]">
          <DockButton
            label="Focus"
            icon={MapIcon}
            active={activePanel === "focus"}
            onClick={() => setActivePanel((current) => (current === "focus" ? null : "focus"))}
          />
          <DockButton
            label="Quests"
            icon={Sparkles}
            active={activePanel === "quests"}
            onClick={() => setActivePanel((current) => (current === "quests" ? null : "quests"))}
          />
          <DockButton
            label="Wallet"
            icon={Wallet}
            active={activePanel === "wallet"}
            onClick={() => setActivePanel((current) => (current === "wallet" ? null : "wallet"))}
          />
          <DockButton
            label="Live"
            icon={Landmark}
            active={activePanel === "live"}
            onClick={() => setActivePanel((current) => (current === "live" ? null : "live"))}
          />
        </div>
      </div>

      {walletGateVisible ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <div className="pixel-window w-[min(520px,calc(100vw-1rem))] px-5 py-5 text-[#171411]">
            <div className="arcade-face text-[0.62rem] text-[#6b6256]">Enter Bazaar X</div>
            <div className="arcade-face mt-3 text-[0.9rem] leading-[1.7]">Wallet connection is the only login.</div>
            <div className="mt-4 text-sm leading-6 text-[#4d4338]">
              Connect your wallet to enter the village, steer the courier, and trigger the live X Layer economy loop.
            </div>
            <div className="mt-5">
              <ConnectWalletButton variant="pixel" fullWidth />
            </div>
          </div>
        </div>
      ) : null}

      {showBootSplash ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white">
          <div className="arcade-face text-[clamp(0.8rem,2vw,1.2rem)] text-[#171411]">Loading...</div>
        </div>
      ) : null}
    </main>
  );
}

function WorldProp({ prop }: { prop: VillageProp }) {
  const scale = prop.scale ?? 1;

  return (
    <div
      className="pointer-events-none absolute z-[3] -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${prop.x}%`,
        top: `${prop.y}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    >
      {prop.kind === "tree" ? (
        <div className="relative h-10 w-8">
          <div className="absolute bottom-0 left-1/2 h-3 w-2 -translate-x-1/2 border-2 border-[#171411] bg-[#593c26]" />
          <div className="absolute left-1/2 top-2 h-5 w-5 -translate-x-1/2 border-[3px] border-[#171411] bg-[#468d53]" />
          <div className="absolute left-1/2 top-0 h-5 w-6 -translate-x-1/2 border-[3px] border-[#171411] bg-[#6abf68]" />
        </div>
      ) : null}

      {prop.kind === "field" ? (
        <div className="relative h-8 w-10 border-[3px] border-[#171411] bg-[#8eb34d]">
          <div className="absolute inset-x-1 top-1 h-1 rounded bg-[#dfe284]" />
          <div className="absolute inset-x-1 top-3 h-1 rounded bg-[#c7d16d]" />
          <div className="absolute inset-x-1 top-5 h-1 rounded bg-[#dfe284]" />
        </div>
      ) : null}

      {prop.kind === "camp" ? (
        <div className="relative h-8 w-9">
          <div className="absolute inset-x-1 top-1 h-4 border-[3px] border-[#171411] bg-[#cf7b5a]" />
          <div className="absolute inset-x-0 bottom-0 h-4 border-[3px] border-[#171411] bg-[#6e4832]" />
        </div>
      ) : null}

      {prop.kind === "cart" ? (
        <div className="relative h-7 w-10">
          <div className="absolute inset-x-1 top-1 h-4 border-[3px] border-[#171411] bg-[#9e6a3f]" />
          <div className="absolute bottom-0 left-1 h-2.5 w-2.5 border-2 border-[#171411] bg-[#2a1c14]" />
          <div className="absolute bottom-0 right-1 h-2.5 w-2.5 border-2 border-[#171411] bg-[#2a1c14]" />
        </div>
      ) : null}

      {prop.kind === "lamp" ? (
        <div className="relative h-8 w-5">
          <div className="absolute bottom-0 left-1/2 h-6 w-1 -translate-x-1/2 bg-[#463321]" />
          <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 border-2 border-[#171411] bg-[#ffe29b] shadow-[0_0_20px_rgba(255,226,155,0.55)]" />
        </div>
      ) : null}
    </div>
  );
}

function DockButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pixel-button flex min-w-[92px] items-center justify-center gap-2 px-3 py-2 ${
        active ? "bg-[#f16f51] text-white" : "bg-[#f8f2e9] text-[#171411]"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="arcade-face text-[0.44rem]">{label}</span>
    </button>
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
      className={`pixel-button px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 ${palette}`}
    >
      <div className="flex items-center gap-2 text-white">
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        <span className="arcade-face text-[0.5rem]">{label}</span>
      </div>
      <div className="mt-3 text-sm leading-6 text-slate-100">{hint}</div>
    </button>
  );
}

function QuestCard({
  step,
  compact = false,
}: {
  step: QuestStep;
  compact?: boolean;
}) {
  const palette =
    step.status === "done"
      ? "border-[#69f0d2]/25 bg-[#69f0d2]/10"
      : step.status === "ready"
        ? "border-[#ffb35b]/25 bg-[#ffb35b]/10"
        : "border-white/10 bg-white/[0.04]";

  return (
    <article className={`border-4 border-[#171411] bg-[#111722] ${compact ? "p-3" : "p-4"} ${palette}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="arcade-face text-[0.46rem] text-[#f8f2e9]">{step.label}</div>
        <div className="arcade-face text-[0.4rem] uppercase text-[#d4cabd]">{step.status}</div>
      </div>
      <div className={`text-sm leading-6 text-[#d4cabd] ${compact ? "mt-2" : "mt-3"}`}>{step.caption}</div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="mono text-sm text-white">{step.hash ? shortHash(step.hash) : "Pending"}</div>
        {step.explorerUrl ? (
          <a
            href={step.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#d4cabd] transition hover:text-white"
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
    <div className={`border-4 border-[#171411] bg-[#0f141d] p-4 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="arcade-face text-[0.46rem] text-[#f8f2e9]">{label}</div>
        <div className="flex items-center gap-2">
          {onCopy ? (
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 text-xs text-[#d4cabd] transition hover:text-white"
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
              className="inline-flex items-center gap-1 text-xs text-[#d4cabd] transition hover:text-white"
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

function InfoRow({ children }: { children: string }) {
  return (
    <div className="border-4 border-[#171411] bg-[#0f141d] px-4 py-3 text-sm leading-6 text-[#d4cabd]">
      {children}
    </div>
  );
}

function BriefChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-4 border-[#171411] bg-white/70 px-3 py-2 text-[#171411]">
      <div className="arcade-face text-[0.38rem] text-[#6b6256]">{label}</div>
      <div className="mt-1 text-sm font-medium break-words">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-4 border-[#171411] bg-[#f8f2e9] p-3 text-[#171411]">
      <div className="arcade-face text-[0.42rem]">{label}</div>
      <div className="mt-2 text-sm font-medium break-words">{value}</div>
    </div>
  );
}
