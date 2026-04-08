"use client";

import {
  ArrowUpRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Gamepad2,
  Landmark,
  LoaderCircle,
  LocateFixed,
  Map as MapIcon,
  RefreshCw,
  Wallet,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Matter from "matter-js";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRef } from "react";
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
type UtilityTab = "legend" | "map" | "controls";
type Direction = "up" | "down" | "left" | "right";

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

type ObstacleKind = "hedge" | "crate" | "rock" | "barrier";

type VillageObstacle = {
  id: string;
  kind: ObstacleKind;
  x: number;
  y: number;
  width: number;
  height: number;
  blocking?: boolean;
};

const districtFrame = {
  square: { x: 50, y: 58, width: 18, height: 12, approachX: 50, approachY: 63 },
  core: { x: 50, y: 27, width: 15, height: 17, approachX: 50, approachY: 40 },
  shop: { x: 13, y: 58, width: 17, height: 15, approachX: 22, approachY: 67 },
  supplier: { x: 87, y: 42, width: 17, height: 14, approachX: 77, approachY: 51 },
  worker: { x: 80, y: 81, width: 15, height: 13, approachX: 71, approachY: 78 },
  treasury: { x: 61, y: 89, width: 16, height: 13, approachX: 58, approachY: 78 },
  governor: { x: 16, y: 85, width: 15, height: 15, approachX: 25, approachY: 78 },
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

export function BazaarDashboard({ initialScene = null }: { initialScene?: string | null }) {
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<DistrictId>("square");
  const [controlMode, setControlMode] = useState<ControlMode>("auto");
  const [activePanel, setActivePanel] = useState<DockPanel | null>(null);
  const [bootReady, setBootReady] = useState(false);
  const [hasEnteredGame, setHasEnteredGame] = useState(false);
  const [showSystemPanel, setShowSystemPanel] = useState(false);
  const [utilityTab, setUtilityTab] = useState<UtilityTab>("legend");
  const [playerPosition, setPlayerPosition] = useState({ x: 49, y: 62 });
  const [autoRouteIndex, setAutoRouteIndex] = useState(0);
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [worldTick, setWorldTick] = useState(0);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [manualTarget, setManualTarget] = useState<{ x: number; y: number } | null>(null);
  const forcedScene = initialScene;
  const engineRef = useRef<Matter.Engine | null>(null);
  const playerBodyRef = useRef<Matter.Body | null>(null);
  const controlModeRef = useRef<ControlMode>("auto");
  const activeDirectionRef = useRef<Direction | null>(null);
  const manualTargetRef = useRef<{ x: number; y: number } | null>(null);
  const autoRouteIndexRef = useRef(0);
  const districtPointsRef = useRef<Map<DistrictId, { x: number; y: number }>>(new Map());
  const selectedIdRef = useRef<DistrictId>("square");

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
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setUtilityTab("controls");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBootReady(true);
    }, 900);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isConnected && forcedScene !== "game" && forcedScene !== "stats") {
      setHasEnteredGame(false);
    }
  }, [forcedScene, isConnected]);

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
  const sceneForcesBoot = forcedScene === "boot";
  const sceneForcesOnboarding = forcedScene === "onboarding";
  const sceneForcesGame = forcedScene === "game" || forcedScene === "stats";
  const previewMode = sceneForcesGame && !isConnected;

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

  useEffect(() => {
    controlModeRef.current = controlMode;
  }, [controlMode]);

  useEffect(() => {
    activeDirectionRef.current = activeDirection;
  }, [activeDirection]);

  useEffect(() => {
    autoRouteIndexRef.current = autoRouteIndex;
  }, [autoRouteIndex]);

  useEffect(() => {
    districtPointsRef.current = districtPoints;
  }, [districtPoints]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  function syncPlayerPosition(nextPosition: { x: number; y: number }) {
    setPlayerPosition(nextPosition);
    setManualTarget(null);
    manualTargetRef.current = null;

    if (playerBodyRef.current) {
      Matter.Body.setPosition(playerBodyRef.current, nextPosition);
      Matter.Body.setVelocity(playerBodyRef.current, { x: 0, y: 0 });
    }
  }

  function focusDistrict(district: District) {
    setActivePanel("focus");
    setControlMode("manual");
    setSelectedId(district.id);
    syncPlayerPosition({ x: district.approachX, y: district.approachY });
  }

  function engageAutoControl() {
    setActiveDirection(null);
    setControlMode("auto");
    setManualTarget(null);
    manualTargetRef.current = null;
    setAutoRouteIndex(nearestRouteIndex(courierRoute, districtPoints, playerPosition));
  }

  function engageManualControl() {
    setControlMode("manual");
  }

  function beginDirectionalMove(direction: Direction) {
    if (controlMode !== "manual") {
      engageManualControl();
    }
    setManualTarget(null);
    manualTargetRef.current = null;
    setActiveDirection(direction);
  }

  function endDirectionalMove() {
    setActiveDirection(null);
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
    { id: "inn", title: "Inn", x: 8, y: 24, width: 13, height: 11, roof: "#d26f55", wall: "#7e402f" },
    { id: "archive", title: "Archive", x: 31, y: 14, width: 11, height: 8, roof: "#96a8d8", wall: "#4b587a" },
    { id: "watch", title: "Watch", x: 92, y: 18, width: 9, height: 12, roof: "#c7cedd", wall: "#586071" },
    { id: "orchard", title: "Orchard", x: 10, y: 92, width: 11, height: 9, roof: "#7dbf59", wall: "#476537" },
    { id: "dock", title: "Dock", x: 91, y: 90, width: 12, height: 9, roof: "#8fb4cc", wall: "#4a5e68" },
    { id: "gate", title: "Gate", x: 49, y: 6, width: 12, height: 6, roof: "#d2bd7f", wall: "#69552a" },
    { id: "mill", title: "Mill", x: 72, y: 17, width: 10, height: 9, roof: "#ceb472", wall: "#6f5f31" },
    { id: "workyard", title: "Workyard", x: 86, y: 69, width: 11, height: 8, roof: "#d98562", wall: "#875137" },
    { id: "hamlet", title: "Hamlet", x: 22, y: 95, width: 12, height: 8, roof: "#d7aa69", wall: "#7b5732" },
  ];

  const villageProps: VillageProp[] = [
    { id: "tree-1", kind: "tree", x: 7, y: 49, scale: 1.15 },
    { id: "tree-2", kind: "tree", x: 18, y: 35, scale: 0.95 },
    { id: "tree-3", kind: "tree", x: 29, y: 91, scale: 1.05 },
    { id: "tree-4", kind: "tree", x: 64, y: 9, scale: 0.9 },
    { id: "tree-5", kind: "tree", x: 84, y: 71, scale: 1.1 },
    { id: "tree-6", kind: "tree", x: 92, y: 56, scale: 0.92 },
    { id: "field-1", kind: "field", x: 74, y: 11, scale: 1.1 },
    { id: "field-2", kind: "field", x: 10, y: 72, scale: 1.05 },
    { id: "field-3", kind: "field", x: 84, y: 12, scale: 0.95 },
    { id: "camp-1", kind: "camp", x: 69, y: 29, scale: 0.95 },
    { id: "camp-2", kind: "camp", x: 32, y: 76, scale: 0.9 },
    { id: "camp-3", kind: "camp", x: 18, y: 78, scale: 0.88 },
    { id: "cart-1", kind: "cart", x: 57, y: 58, scale: 0.9 },
    { id: "cart-2", kind: "cart", x: 18, y: 47, scale: 0.72 },
    { id: "cart-3", kind: "cart", x: 84, y: 76, scale: 0.82 },
    { id: "cart-4", kind: "cart", x: 58, y: 74, scale: 0.8 },
    { id: "lamp-1", kind: "lamp", x: 44, y: 53, scale: 1 },
    { id: "lamp-2", kind: "lamp", x: 54, y: 43, scale: 1 },
    { id: "lamp-3", kind: "lamp", x: 72, y: 65, scale: 1 },
    { id: "lamp-4", kind: "lamp", x: 28, y: 65, scale: 1 },
    { id: "lamp-5", kind: "lamp", x: 49, y: 76, scale: 1 },
  ];

  const villageObstacles: VillageObstacle[] = [
    { id: "hedge-west", kind: "hedge", x: 31, y: 53, width: 7, height: 21 },
    { id: "hedge-east", kind: "hedge", x: 67, y: 52, width: 7, height: 18 },
    { id: "crate-yard", kind: "crate", x: 82, y: 58, width: 8, height: 6 },
    { id: "stone-ring", kind: "rock", x: 37, y: 83, width: 7, height: 6 },
    { id: "south-barrier", kind: "barrier", x: 50, y: 82, width: 16, height: 4 },
    { id: "north-barrier", kind: "barrier", x: 50, y: 17, width: 18, height: 4 },
    { id: "bridge-guard-left", kind: "crate", x: 42, y: 37, width: 5, height: 5 },
    { id: "bridge-guard-right", kind: "crate", x: 59, y: 37, width: 5, height: 5 },
    { id: "south-hedge", kind: "hedge", x: 33, y: 86, width: 11, height: 10 },
    { id: "east-rock", kind: "rock", x: 90, y: 78, width: 8, height: 7 },
    { id: "market-crates", kind: "crate", x: 38, y: 70, width: 9, height: 5 },
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
      if (key === "arrowup" || key === "w") {
        beginDirectionalMove("up");
      }
      if (key === "arrowdown" || key === "s") {
        beginDirectionalMove("down");
      }
      if (key === "arrowleft" || key === "a") {
        beginDirectionalMove("left");
      }
      if (key === "arrowright" || key === "d") {
        beginDirectionalMove("right");
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
        endDirectionalMove();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [controlMode, hasMounted, nearbyDistrict]);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0 },
    });

    const boundaries = [
      Matter.Bodies.rectangle(50, 13, 100, 10, { isStatic: true }),
      Matter.Bodies.rectangle(50, 95, 100, 10, { isStatic: true }),
      Matter.Bodies.rectangle(4, 54, 8, 100, { isStatic: true }),
      Matter.Bodies.rectangle(96, 54, 8, 100, { isStatic: true }),
    ];

    const obstacleBodies = villageObstacles.map((obstacle) =>
      Matter.Bodies.rectangle(obstacle.x, obstacle.y, obstacle.width, obstacle.height, {
        isStatic: true,
        restitution: 0,
        friction: 0.3,
      }),
    );

    const player = Matter.Bodies.circle(playerPosition.x, playerPosition.y, 1.6, {
      frictionAir: 0.18,
      restitution: 0,
      friction: 0.001,
      inertia: Infinity,
      slop: 0.06,
    });

    Matter.Composite.add(engine.world, [...boundaries, ...obstacleBodies, player]);

    engineRef.current = engine;
    playerBodyRef.current = player;

    let frame = 0;
    let lastTime = typeof performance !== "undefined" ? performance.now() : Date.now();

    const tick = (time: number) => {
      const now = time ?? Date.now();
      const delta = Math.min(1000 / 24, now - lastTime || 1000 / 60);
      lastTime = now;

      const playerBody = playerBodyRef.current;
      if (playerBody) {
        if (controlModeRef.current === "manual") {
          const direction = activeDirectionRef.current;
          const desiredVelocity = { x: 0, y: 0 };

          if (direction === "up") {
            desiredVelocity.y = -1.05;
          }
          if (direction === "down") {
            desiredVelocity.y = 1.05;
          }
          if (direction === "left") {
            desiredVelocity.x = -1.05;
          }
          if (direction === "right") {
            desiredVelocity.x = 1.05;
          }

          if (direction) {
            Matter.Body.setVelocity(playerBody, desiredVelocity);
          } else if (manualTargetRef.current) {
            const dx = manualTargetRef.current.x - playerBody.position.x;
            const dy = manualTargetRef.current.y - playerBody.position.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 1.2) {
              manualTargetRef.current = null;
              setManualTarget(null);
              Matter.Body.setVelocity(playerBody, { x: 0, y: 0 });
            } else {
              const speed = 0.96;
              Matter.Body.setVelocity(playerBody, {
                x: (dx / dist) * speed,
                y: (dy / dist) * speed,
              });
            }
          } else {
            Matter.Body.setVelocity(playerBody, {
              x: playerBody.velocity.x * 0.72,
              y: playerBody.velocity.y * 0.72,
            });
          }
        } else {
          const nextRouteIndex = autoRouteIndexRef.current % courierRoute.length;
          const targetId = courierRoute[nextRouteIndex];
          const target = districtPointsRef.current.get(targetId);

          if (target) {
            const dx = target.x - playerBody.position.x;
            const dy = target.y - playerBody.position.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 1.8) {
              if (selectedIdRef.current !== targetId) {
                setSelectedId(targetId);
              }
              setAutoRouteIndex((index) => (index + 1) % courierRoute.length);
            } else {
              const speed = 0.92;
              Matter.Body.setVelocity(playerBody, {
                x: (dx / dist) * speed,
                y: (dy / dist) * speed,
              });
            }
          }
        }
      }

      Matter.Engine.update(engine, delta);

      if (playerBodyRef.current) {
        const nextPosition = {
          x: clamp(playerBodyRef.current.position.x, 8, 92),
          y: clamp(playerBodyRef.current.position.y, 18, 90),
        };
        setPlayerPosition((current) =>
          Math.abs(current.x - nextPosition.x) < 0.04 && Math.abs(current.y - nextPosition.y) < 0.04
            ? current
            : nextPosition,
        );
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
      engineRef.current = null;
      playerBodyRef.current = null;
    };
  }, [hasMounted]);

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

  const viewerBalance = previewMode
    ? "Preview mode"
    : hasMounted && balance
      ? formatOkb(Number(balance.formatted))
      : "Not connected";
  const viewerIdentity =
    hasMounted && isConnected && address ? shortHash(address) : previewMode ? "Spectator" : "Not connected";
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
  const objectiveDistrictId: DistrictId =
    questFocus?.id === "deploy"
      ? "core"
      : questFocus?.id === "play"
        ? "worker"
        : questFocus?.id === "govern"
          ? "governor"
          : "square";
  const objectiveDistrict = districtLookup.get(objectiveDistrictId) ?? selectedDistrict;
  const showBootSplash = sceneForcesBoot || !hasMounted || !bootReady || statusQuery.isLoading;
  const canPlayGame = sceneForcesGame || isConnected;
  const onboardingVisible =
    !showBootSplash && ((sceneForcesOnboarding && !hasEnteredGame) || (!sceneForcesGame && !hasEnteredGame));
  const activeWorkers = npcPositions.filter((agent) => agent.id !== "courier").length;
  const visibleActivityAgents = npcPositions.filter((agent) => agent.id !== "courier").slice(0, 3);
  const questCompletedCount = questSteps.filter((step) => step.status === "done").length;
  const questProgress = Math.round((questCompletedCount / Math.max(1, questSteps.length)) * 100);
  const treasuryOkbValue = Number(bazaarSnapshot?.treasuryBalanceOkb ?? funding?.treasury.balanceOkb ?? "0");
  const treasuryMomentum = Math.max(8, Math.min(100, Math.round((treasuryOkbValue / 0.3) * 100)));
  const taxMomentum = Math.max(10, Math.min(100, Math.round((taxBps / 800) * 100)));
  const statsModalOpen = forcedScene === "stats" || showSystemPanel;
  const skillsSummary = installedSkills.length
    ? installedSkills.map((skill) => skill.name).join(", ")
    : "No world skills loaded.";
  const primaryQuestAction =
    !manifest?.agents.length
        ? {
          label: "Spawn economy",
          hint: "Create the town roster and wallet state.",
          icon: Bot,
          disabled: actionMutation.isPending || onboardingVisible || !isConnected,
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
            disabled: actionMutation.isPending || !canDeploy || onboardingVisible || !isConnected,
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
            disabled: actionMutation.isPending || !canRunLive || onboardingVisible || !isConnected,
            loading: busyLabel === "Play live round",
            onClick: () =>
              runAction({
                label: "Play live round",
                path: "/api/live/run",
              }),
          };

  const legendItems = [
    { label: "You", copy: "Wallet-controlled courier.", color: "#f3c44f", accent: "courier" as const },
    { label: "Merchant", copy: "Opens shops and starts demand.", color: "#72f0d3", accent: "shop" as const },
    { label: "Supplier", copy: "Routes services through the east lane.", color: "#86a7ff", accent: "supplier" as const },
    { label: "Worker", copy: "Completes paid tasks.", color: "#ff9a8b", accent: "worker" as const },
    { label: "Governor", copy: "Updates economy rules.", color: "#d4b5ff", accent: "governor" as const },
  ];
  const cameraShiftX = (playerPosition.x - 50) * -0.18;
  const cameraShiftY = (playerPosition.y - 56) * -0.14;
  const liveAlert = statusError
    ? statusError
    : isUnsupportedViewerNetwork
      ? "Switch the connected wallet to X Layer testnet (1952) or mainnet (196)."
      : previewMode
        ? "Spectator preview is active. Connect a wallet when you want to run live X Layer actions."
      : onboardingVisible
        ? "Connect your wallet and hit Play Game to enter the village."
        : "Walk the town, inspect districts, and open the dock only when you need detail.";
  const quickSummaries = [
    {
      label: "Objective",
      value: objectiveDistrict.title,
      caption: questFocus?.caption ?? "Follow the economy loop through the village.",
    },
    {
      label: "Player",
      value: controlMode === "auto" ? "Auto courier" : "Manual courier",
      caption: nearbyDistrict ? `Near ${nearbyDistrict.title}` : "Roaming the village roads.",
    },
    {
      label: "Settlement",
      value: contractAddress ? "Contract live" : "Awaiting deploy",
      caption: contractAddress ? shortHash(contractAddress) : "Deploy Bazaar X to wake the town.",
    },
    {
      label: "Active agents",
      value: String(activeWorkers),
      caption: "NPC workers, suppliers, and governors moving through the live town.",
    },
  ];

  function handleWorldPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (onboardingVisible) {
      return;
    }

    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    const nextPosition = {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 8, 92),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * 100, 18, 90),
    };

    engageManualControl();
    setManualTarget(nextPosition);
    manualTargetRef.current = nextPosition;
  }

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-[#f5f1e7] text-[#15120f]">
      <div className="pixel-plaza absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_40%,rgba(0,0,0,0.06))]" />

      <div className="absolute inset-0 overflow-hidden" onPointerDown={handleWorldPointerDown}>
        <div
          className="absolute inset-[-5%] transition-transform duration-500"
          style={{ transform: `translate(${cameraShiftX}%, ${cameraShiftY}%) scale(1.08)` }}
        >
          <div className="pixel-cloud absolute left-[10%] top-[6%] h-10 w-24 opacity-75" />
          <div className="pixel-cloud pixel-cloud-delayed absolute right-[18%] top-[12%] h-8 w-20 opacity-60" />
          <div className="pixel-cloud absolute left-[66%] top-[18%] h-6 w-16 opacity-55" />
          <div className="absolute left-[24%] top-[0%] h-[9%] w-[52%] border-b-[6px] border-[#171411] bg-[repeating-linear-gradient(90deg,#a2845f_0,#a2845f_18px,#d4bc8e_18px,#d4bc8e_28px)]" />
          <div className="pixel-water absolute left-[28%] top-[4%] h-[54%] w-[24%] border-[6px] border-[#f3ebfb] shadow-[0_0_0_4px_#8f8a97]" style={{ clipPath: "polygon(32% 0%,100% 0%,100% 100%,0 100%,0 26%)" }} />
          <div className="pixel-water absolute right-[-1%] top-[8%] h-[48%] w-[19%] border-[6px] border-[#f3ebfb] shadow-[0_0_0_4px_#8f8a97]" />
          <div className="absolute left-[43%] top-[34%] h-[7%] w-[17%] border-[4px] border-[#171411] bg-[repeating-linear-gradient(90deg,#7f5a37_0,#7f5a37_12px,#b18258_12px,#b18258_20px)]" />
          <div className="absolute left-[54%] top-[55%] h-[8%] w-[17%] border-[4px] border-[#171411] bg-[#2f8d39]" />
          <div className="absolute left-[70%] top-[39%] h-[20%] w-[4%] border-[4px] border-[#171411] bg-[#2f8d39]" />
          <div className="absolute right-[3%] top-[48%] h-[11%] w-[11%] border-[4px] border-[#171411] bg-[#2f8d39]" />
          <div className="absolute left-[10%] top-[8%] h-[16%] w-[9%] border-[4px] border-[#171411] bg-[#3b9d46]" />
          <div className="absolute left-[6%] bottom-[14%] h-[11%] w-[13%] border-[4px] border-[#171411] bg-[#62b946]" />
          <div className="absolute bottom-[10%] right-[8%] h-[16%] w-[14%] rounded-full border-[6px] border-[#171411] bg-[radial-gradient(circle,#d5e7ff_0%,#89c2ff_45%,#3f7bc0_100%)] opacity-85" />
          <div className="absolute left-[41%] top-[56%] h-[10%] w-[18%] border-[4px] border-[#171411] bg-[linear-gradient(180deg,#d6945f_0%,#c37346_50%,#8d4424_50%,#8d4424_100%)]" />
          <div className="absolute left-[46%] top-[59%] h-[8%] w-[7%] border-[4px] border-[#171411] bg-[#f3dd88]" />
          <div className="absolute bottom-[10%] left-[-2%] h-[20%] w-[15%] bg-[linear-gradient(180deg,#6a4c36_0%,#6a4c36_55%,#523828_55%,#523828_100%)]" />
          <div className="absolute bottom-[0%] left-0 right-0 h-[12%] bg-[linear-gradient(180deg,#674b38_0%,#674b38_48%,#4e3527_48%,#4e3527_100%)]" />
          <div className="absolute left-[15%] top-[60%] h-[4%] w-[68%] border-y-[4px] border-[#171411] bg-[#b8a692]" />
          <div className="absolute left-[46%] top-[18%] h-[58%] w-[6%] border-x-[4px] border-[#171411] bg-[#b8a692]" />
          <div className="absolute left-[18%] top-[72%] h-[4%] w-[66%] border-y-[4px] border-[#171411] bg-[#b8a692]" />

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

          {villageObstacles.map((obstacle) => (
            <ObstacleProp key={obstacle.id} obstacle={obstacle} />
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
                zIndex: Math.round(30 + spot.y),
              }}
            >
              <LandmarkSprite spot={spot} />
            </div>
          ))}

        {districts.map((district) => {
          const nearby = nearbyDistrict?.id === district.id;
          const objective = objectiveDistrict.id === district.id;

          return (
            <div
              key={`${district.id}-pad`}
              className="pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${district.approachX}%`,
                top: `${district.approachY}%`,
                zIndex: Math.round(40 + district.approachY),
              }}
            >
              <div
                className={`h-8 w-8 border-[3px] border-dashed ${nearby ? "scale-125" : objective ? "scale-110" : "scale-100"}`}
                style={{
                  borderColor: objective ? "#fff6c6" : district.palette.trim,
                  backgroundColor: objective ? "rgba(255, 244, 181, 0.18)" : `${district.palette.glow}`,
                  boxShadow: nearby ? "0 0 0 6px rgba(255,255,255,0.16)" : undefined,
                }}
              />
            </div>
          );
        })}

        <div
          className="pointer-events-none absolute z-[7] -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
          style={{
            left: `${playerPosition.x}%`,
            top: `${playerPosition.y}%`,
            zIndex: Math.round(90 + playerPosition.y),
          }}
        >
          <AvatarSprite role="courier" color="#f3c44f" size="lg" state={controlMode === "auto" ? "auto" : "idle"} />
          <div className="arcade-face absolute left-1/2 top-[-26px] -translate-x-1/2 whitespace-nowrap rounded-[4px] bg-[rgba(241,111,81,0.9)] px-[4px] py-[2px] text-[0.46rem] text-white shadow-lg border border-[#1a1510]">
            {controlMode === "auto" ? "AUTO" : "YOU"}
          </div>
          <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#fff7c2] bg-[radial-gradient(circle,rgba(255,241,162,0.28),transparent_72%)]" />
        </div>

        {manualTarget ? (
          <div
            className="pointer-events-none absolute z-[6] -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${manualTarget.x}%`,
              top: `${manualTarget.y}%`,
            }}
          >
            <div className="quest-beacon relative flex flex-col items-center">
              <div className="h-2 w-2 border-2 border-[#1a1510] bg-[#f16f51] rotate-45 transform mt-1" />
              <div className="h-3 w-0.5 bg-[#1a1510]" />
              <div className="h-3 w-6 border-2 border-[#1a1510] bg-[#f16f51] rounded-[50%] opacity-40 blur-[2px] absolute -bottom-1" />
            </div>
          </div>
        ) : null}

        {npcPositions
          .filter((agent) => agent.id !== "courier")
          .map((agent) => (
            <div
              key={agent.id}
              className="pointer-events-none absolute z-[6] -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
              style={{
                left: `${agent.position.x}%`,
                top: `${agent.position.y}%`,
                zIndex: Math.round(80 + agent.position.y),
              }}
            >
              <AvatarSprite role={agent.id} color={agent.color} size="lg" />
              <div className="arcade-face absolute left-1/2 top-[-20px] -translate-x-1/2 whitespace-nowrap rounded-[4px] bg-[rgba(26,21,16,0.85)] px-[4px] py-[2px] text-[0.42rem] tracking-wider text-white backdrop-blur-[2px] border border-[rgba(255,255,255,0.15)] shadow-lg transition-transform hover:scale-110">
                {agent.role}
              </div>
            </div>
          ))}

        {districts.map((district) => {
          const selected = selectedDistrict.id === district.id;
          const nearby = nearbyDistrict?.id === district.id;
          const objective = objectiveDistrict.id === district.id;

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
                zIndex: Math.round(100 + district.y),
              }}
            >
              <div
                className="absolute inset-x-[12%] bottom-[-12%] h-[22%] blur-[6px]"
                style={{ backgroundColor: district.palette.glow }}
              />
              {nearby ? (
                <div className="quest-beacon absolute inset-[3%] border-[4px] border-[#fff8d4] opacity-90" />
              ) : null}
              {objective ? (
                <div className="quest-beacon absolute left-1/2 top-[-34%] -translate-x-1/2">
                  <span className="arcade-face bg-[#f16f51] px-2 py-1 text-[0.38rem] text-white shadow-[0_4px_0_rgba(23,20,17,0.9)]">
                    quest
                  </span>
                </div>
              ) : null}
              <DistrictSprite district={district} selected={selected} objective={objective} />
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
      </div>

      <div className="absolute left-4 top-4 z-30 flex w-[min(280px,calc(100vw-2rem))] flex-col gap-3">
        <div className="pixel-window px-4 py-3 text-[#1a1714]">
          <div className="flex items-start justify-between gap-2">
            <div className="arcade-face text-[0.85rem] leading-[1.2]">Bazaar X</div>
            <div className="arcade-face border-2 border-[#2f251c] bg-[#2f251c] px-1.5 py-0.5 text-[0.32rem] text-white">
              {controlMode === "auto" ? "auto" : "manual"}
            </div>
          </div>
          <div className="mt-2 text-xs leading-5 text-[#4d4338]">
            {questFocus?.caption ?? "Walk the village and trigger the onchain loop."}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => (nearbyDistrict ? focusDistrict(nearbyDistrict) : setActivePanel("quests"))}
              className="pixel-button flex-1 bg-[#f16f51] px-2 py-1.5 text-white"
            >
              <span className="arcade-face text-[0.42rem]">{nearbyDistrict ? "Inspect" : "Quest"}</span>
            </button>
            <button
              type="button"
              onClick={() => (controlMode === "auto" ? engageManualControl() : engageAutoControl())}
              className="pixel-button flex-1 bg-[#eae0d2] px-2 py-1.5 text-[#1a1510]"
            >
              <span className="arcade-face text-[0.42rem]">{controlMode === "auto" ? "Manual" : "Auto"}</span>
            </button>
          </div>
        </div>

        {!onboardingVisible ? (
          <UtilityBoard
            className="pixel-window-dark px-4 py-4 text-[#f8f2e9]"
            activeTab={utilityTab}
            onTabChange={setUtilityTab}
            legend={
              <LegendBoard
                items={legendItems}
                objectiveLabel={objectiveDistrict.title}
                nearbyLabel={nearbyDistrict?.title ?? null}
              />
            }
            map={
              <MiniMap
                className="w-full px-0 py-0 shadow-none"
                districts={districts}
                objectiveDistrictId={objectiveDistrict.id}
                selectedDistrictId={selectedDistrict.id}
                playerPosition={playerPosition}
                npcPositions={npcPositions}
                onSelectDistrict={(district) => focusDistrict(district)}
              />
            }
            controls={
              <ControlPad
                className="w-full px-0 py-0 shadow-none"
                controlMode={controlMode}
                nearbyDistrictTitle={nearbyDistrict?.title ?? null}
                onAuto={engageAutoControl}
                onInteract={() => (nearbyDistrict ? focusDistrict(nearbyDistrict) : setActivePanel("focus"))}
                onDirectionStart={beginDirectionalMove}
                onDirectionStop={endDirectionalMove}
              />
            }
          />
        ) : null}
      </div>

      <div className="absolute right-3 top-3 z-30 flex items-start gap-2 sm:right-4 sm:top-4">
        <div className="flex items-start gap-2">
          {statsModalOpen ? (
            <div className="pixel-window w-[min(320px,calc(100vw-1rem))] px-4 py-4 text-[#1a1714]">
              <div className="flex items-center justify-between gap-3">
                <div className="arcade-face text-[0.5rem]">Town Stats</div>
                <button
                  type="button"
                  onClick={() => setShowSystemPanel(false)}
                  className="inline-flex h-8 w-8 items-center justify-center border-4 border-[#171411] bg-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-3">
                <SummaryBar label="Quest chain" value={`${questProgress}%`} progress={questProgress} tone="amber" />
                <SummaryBar label="Treasury energy" value={formatOkb(treasuryOkbValue)} progress={treasuryMomentum} tone="mint" />
                <SummaryBar label="Tax pressure" value={`${(taxBps / 100).toFixed(2)}%`} progress={taxMomentum} tone="blue" />
              </div>
              <div className={`mt-4 border-4 px-3 py-3 text-sm leading-6 ${statusError || isUnsupportedViewerNetwork ? "border-[#7d221b] bg-[#f6d9d1] text-[#5d1b16]" : "border-[#171411] bg-white/70 text-[#4d4338]"}`}>
                {liveAlert}
              </div>
              <div className="mt-4 grid gap-2">
                {quickSummaries.map((summary) => (
                  <QuickSummaryRow key={summary.label} label={summary.label} value={summary.value} caption={summary.caption} />
                ))}
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
        </div>

        <div className="flex items-start gap-2">
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setShowSystemPanel((current) => !current)}
              className={`pixel-button inline-flex items-center gap-2 px-3 py-2 ${statusError || isUnsupportedViewerNetwork ? "bg-[#f06c50] text-white" : "bg-[#ffffff] text-[#171411]"}`}
            >
              <span className="arcade-face text-[0.48rem]">{statsModalOpen ? "Hide stats" : "Stats"}</span>
              {statsModalOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
            ) : previewMode ? (
              <button
                type="button"
                onClick={() => setActivePanel((current) => (current === "wallet" ? null : "wallet"))}
                className="pixel-button inline-flex items-center gap-2 bg-[#fff5d8] px-3 py-2 text-[#171411]"
              >
                <span className="arcade-face text-[0.48rem]">Preview</span>
                <span className="text-xs font-medium">Spectator</span>
              </button>
            ) : (
              <ConnectWalletButton variant="pixel" />
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-[98px] left-1/2 z-30 w-[min(780px,calc(100vw-1rem))] -translate-x-1/2 px-2">
        {activePanel === "focus" ? (
          <div className="pointer-events-auto max-h-[min(48svh,430px)] overflow-y-auto pixel-window-dark px-4 py-4 text-[#f8f2e9]">
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
          <div className="pointer-events-auto max-h-[min(52svh,460px)] overflow-y-auto pixel-window-dark px-4 py-4 text-[#f8f2e9]">
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
                  disabled={actionMutation.isPending || onboardingVisible || !isConnected}
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
                  disabled={actionMutation.isPending || !canDeploy || onboardingVisible || !isConnected}
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
                  disabled={actionMutation.isPending || !canRunLive || onboardingVisible || !isConnected}
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
          <div className="pointer-events-auto max-h-[min(44svh,420px)] overflow-y-auto pixel-window-dark px-4 py-4 text-[#f8f2e9]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="arcade-face text-[0.5rem] text-[#f4d594]">Wallet + Controls</div>
                <div className="mt-2 text-sm leading-6 text-[#d4cabd]">
                  Wallet connection is the only login. Use the minimap and control pad for touch play, or switch between auto patrol and manual anytime.
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
              <MiniStat label="Viewer" value={viewerIdentity} />
              <MiniStat label="Wallet" value={viewerBalance} />
              <MiniStat label="Gas" value={gatewayGas?.normal ? `${gatewayGas.normal} wei` : "Live"} />
              <MiniStat label="Nearby" value={nearbyDistrict?.title ?? "Open road"} />
            </div>
            <div className="mt-4">
              {previewMode ? (
                <div className="border-4 border-[#171411] bg-[#f8f2e9] px-3 py-3 text-sm leading-6 text-[#4d4338]">
                  Spectator mode keeps the HUD clean for screenshots and judge walkthroughs. Connect a wallet anytime to turn this into a live session.
                </div>
              ) : (
                <ConnectWalletButton variant="pixel" fullWidth />
              )}
            </div>
            <div className="mt-4 border-4 border-[#171411] bg-[#131923] px-3 py-3 text-sm leading-6 text-[#d4cabd]">
              Move with arrow keys or WASD. Press space when you are near a district to inspect it instantly.
            </div>
          </div>
        ) : null}

        {activePanel === "live" ? (
          <div className="pointer-events-auto max-h-[min(44svh,420px)] overflow-y-auto pixel-window-dark px-4 py-4 text-[#f8f2e9]">
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
        <div className="pixel-window-dark grid grid-cols-2 gap-2 px-2 py-2 text-[#f8f2e9] sm:flex sm:items-center sm:justify-between">
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

      {onboardingVisible ? (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[rgba(14,12,10,0.5)] backdrop-blur-md">
          <div className="flex flex-col items-center justify-center fade-in">
            <div className="arcade-face text-[0.8rem] text-[#f4d594] tracking-widest mb-3 drop-shadow-md">OKX Build X Hackathon</div>
            <h1 className="arcade-face text-[clamp(2.5rem,7vw,5rem)] text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)] mb-10 tracking-wider">Bazaar<span className="text-[#f16f51]">X</span></h1>
            
            <div className="pixel-window-dark w-[min(480px,calc(100vw-2rem))] p-8 text-center shadow-[0_24px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(244,213,148,0.05),transparent_60%)] pointer-events-none" />
              <p className="text-[0.95rem] text-[#d4cabd] mb-8 leading-relaxed relative z-10">
                Connect your wallet to enter the living village. Once inside, you can watch the agent economy run on X Layer or trigger live actions manually.
              </p>
              
              <div className="flex flex-col items-center gap-4 relative z-10">
                <ConnectWalletButton variant="pixel" fullWidth />
                <button
                  type="button"
                  disabled={!canPlayGame}
                  onClick={() => setHasEnteredGame(true)}
                  className="pixel-button arcade-face flex w-full items-center justify-center gap-2 bg-[#f4d594] px-4 py-4 text-[0.65rem] text-[#2f251c] disabled:cursor-not-allowed disabled:bg-[#4f4339] disabled:text-[#8d8272] transition-colors hover:bg-white"
                >
                  <Sparkles className="h-5 w-5" />
                  Enter Village
                </button>
              </div>

              {canPlayGame ? (
                <div className="mt-8 border-t-2 border-[rgba(255,255,255,0.05)] pt-5 relative z-10">
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#a3d07e] uppercase tracking-widest">
                     <div className="h-2 w-2 rounded-full bg-[#a3d07e] animate-pulse" />
                     Ready to enter
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showBootSplash ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#f5f1e7]">
          <div className="pixel-window w-[min(520px,calc(100vw-1rem))] px-5 py-5 text-[#171411]">
            <div className="arcade-face text-[0.5rem] text-[#6b6256]">Loading village</div>
            <div className="arcade-face mt-4 text-[clamp(1rem,2vw,1.35rem)] leading-[1.8]">Bazaar X is waking up.</div>
            <div className="mt-4 h-5 border-4 border-[#171411] bg-white p-1">
              <div
                className="h-full bg-[linear-gradient(90deg,#171411_0%,#f16f51_24%,#ffb35b_70%,#72f0d3_100%)] transition-all duration-500"
                style={{ width: `${bootReady ? 100 : Math.min(88, 12 + worldTick * 6)}%` }}
              />
            </div>
            <div className="mt-4 text-sm leading-6 text-[#4d4338]">
              Loading the town layout, live onchain status, and agent routes.
            </div>
          </div>
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
        zIndex: Math.round(20 + prop.y),
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

function AvatarSprite({
  role,
  color,
  size = "md",
  state = "idle",
}: {
  role: VillageAgent["id"];
  color: string;
  size?: "md" | "lg";
  state?: "idle" | "auto";
}) {
  const large = size === "lg";
  const shellClass = large ? "h-12 w-12" : "h-9 w-9";
  const shadowClass = large ? "h-4 w-7" : "h-3 w-5";

  return (
    <div className={`avatar-bob relative ${shellClass} ${state === "auto" ? "opacity-95" : ""}`}>
      <div className={`absolute left-1/2 top-full -translate-x-1/2 bg-black/20 blur-[4px] ${shadowClass}`} />
      <div className="absolute left-1/2 top-[14%] h-[24%] w-[26%] -translate-x-1/2 border-[3px] border-[#171411] bg-[#f2caa0]" />
      <div
        className="absolute left-1/2 top-[30%] h-[38%] w-[46%] -translate-x-1/2 border-[3px] border-[#171411]"
        style={{ backgroundColor: color }}
      />
      <div className="absolute left-[30%] bottom-[4%] h-[24%] w-[10%] bg-[#f2caa0]" />
      <div className="absolute right-[30%] bottom-[4%] h-[24%] w-[10%] bg-[#f2caa0]" />
      <div className="absolute left-[27%] top-[6%] h-[16%] w-[46%] border-[3px] border-[#171411] bg-[#1a2a33]" />

      {role === "shop" ? (
        <>
          <div className="absolute left-[18%] top-[2%] h-[8%] w-[64%] border-[3px] border-[#171411] bg-[#2f695f]" />
          <div className="absolute right-[10%] top-[45%] h-[16%] w-[14%] border-[2px] border-[#171411] bg-[#fff1bf]" />
        </>
      ) : null}

      {role === "supplier" ? (
        <>
          <div className="absolute left-[8%] top-[42%] h-[18%] w-[16%] border-[2px] border-[#171411] bg-[#b98854]" />
          <div className="absolute left-[20%] top-[38%] h-[4%] w-[28%] rotate-[24deg] border-[2px] border-[#171411] bg-[#3d4d8c]" />
        </>
      ) : null}

      {role === "worker" ? (
        <>
          <div className="absolute left-[20%] top-[4%] h-[7%] w-[58%] border-[3px] border-[#171411] bg-[#ffe29b]" />
          <div className="absolute right-[8%] top-[36%] h-[18%] w-[5%] bg-[#704b33]" />
          <div className="absolute right-[4%] top-[32%] h-[7%] w-[16%] border-[2px] border-[#171411] bg-[#c5ccd8]" />
        </>
      ) : null}

      {role === "governor" ? (
        <>
          <div className="absolute left-[16%] top-[20%] h-[12%] w-[70%] border-[3px] border-[#171411] bg-[#f2e2ff]" />
          <div className="absolute left-[18%] top-[42%] h-[24%] w-[12%] bg-[#8e63b6]" />
          <div className="absolute right-[18%] top-[42%] h-[24%] w-[12%] bg-[#8e63b6]" />
        </>
      ) : null}

      {role === "courier" ? (
        <>
          <div className="absolute left-[8%] top-[38%] h-[20%] w-[18%] border-[2px] border-[#171411] bg-[#d9833f]" />
          <div className="absolute right-[18%] top-[22%] h-[24%] w-[8%] rotate-[22deg] bg-[#fff4b3]" />
        </>
      ) : null}
    </div>
  );
}

function LandmarkSprite({ spot }: { spot: ScenerySpot }) {
  if (spot.id === "dock") {
    return (
      <div className="absolute inset-0">
        <div className="absolute inset-x-[6%] bottom-[6%] top-[48%] border-[4px] border-[#171411] bg-[#5a402f]" />
        <div className="absolute left-[12%] top-[18%] h-[24%] w-[34%] border-[4px] border-[#171411] bg-[#8fb4cc]" />
        <div className="absolute left-[56%] top-[16%] h-[50%] w-[6%] bg-[#6a4b2f]" />
        <div className="absolute left-[58%] top-[18%] h-[8%] w-[20%] bg-[#d9e6ef]" />
      </div>
    );
  }

  if (spot.id === "watch") {
    return (
      <div className="absolute inset-0">
        <div className="absolute inset-x-[26%] bottom-[8%] top-[18%] border-[4px] border-[#171411] bg-[#6c7588]" />
        <div className="absolute inset-x-[18%] top-[8%] h-[18%] border-[4px] border-[#171411] bg-[#c7cedd]" />
        <div className="absolute left-[40%] top-[40%] h-[10%] w-[20%] bg-[#243140]" />
        <div className="absolute left-[40%] top-[58%] h-[10%] w-[20%] bg-[#243140]" />
      </div>
    );
  }

  if (spot.id === "mill") {
    return (
      <div className="absolute inset-0">
        <div className="absolute inset-x-[18%] bottom-[8%] top-[28%] border-[4px] border-[#171411] bg-[#ceb472]" />
        <div className="absolute inset-x-[8%] top-[10%] h-[22%] border-[4px] border-[#171411] bg-[#8b693b]" />
        <div className="absolute right-[6%] top-[36%] h-[34%] w-[28%] rounded-full border-[4px] border-[#171411] bg-[#e7dcc0]" />
        <div className="absolute right-[19%] top-[40%] h-[26%] w-[2px] bg-[#171411]" />
        <div className="absolute right-[10%] top-[52%] h-[2px] w-[20%] bg-[#171411]" />
      </div>
    );
  }

  if (spot.id === "orchard") {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-[12%] bottom-[8%] h-[24%] w-[22%] border-[3px] border-[#171411] bg-[#593c26]" />
        <div className="absolute left-[6%] top-[22%] h-[38%] w-[34%] border-[4px] border-[#171411] bg-[#6abf68]" />
        <div className="absolute left-[38%] bottom-[8%] h-[24%] w-[22%] border-[3px] border-[#171411] bg-[#593c26]" />
        <div className="absolute left-[32%] top-[18%] h-[40%] w-[34%] border-[4px] border-[#171411] bg-[#58a95c]" />
        <div className="absolute right-[8%] bottom-[10%] top-[42%] border-[4px] border-[#171411] bg-[#7b5732]" />
      </div>
    );
  }

  if (spot.id === "gate") {
    return (
      <div className="absolute inset-0">
        <div className="absolute inset-x-[8%] bottom-[10%] top-[34%] border-[4px] border-[#171411] bg-[#69552a]" />
        <div className="absolute left-[12%] top-[16%] h-[28%] w-[18%] border-[4px] border-[#171411] bg-[#d2bd7f]" />
        <div className="absolute right-[12%] top-[16%] h-[28%] w-[18%] border-[4px] border-[#171411] bg-[#d2bd7f]" />
        <div className="absolute left-[36%] top-[6%] h-[26%] w-[28%] border-[4px] border-[#171411] bg-[#c88b55]" />
      </div>
    );
  }

  if (spot.id === "workyard") {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-[8%] top-[16%] h-[26%] w-[30%] border-[4px] border-[#171411] bg-[#d98562]" />
        <div className="absolute right-[8%] top-[20%] h-[24%] w-[28%] border-[4px] border-[#171411] bg-[#e2b46a]" />
        <div className="absolute inset-x-[12%] bottom-[10%] top-[48%] border-[4px] border-[#171411] bg-[#875137]" />
        <div className="absolute left-[18%] bottom-[6%] h-[14%] w-[16%] border-[3px] border-[#171411] bg-[#af7a4f]" />
        <div className="absolute right-[18%] bottom-[6%] h-[14%] w-[16%] border-[3px] border-[#171411] bg-[#af7a4f]" />
      </div>
    );
  }

  if (spot.id === "hamlet") {
    return (
      <div className="absolute inset-0">
        <div className="absolute left-[6%] bottom-[12%] top-[36%] w-[40%] border-[4px] border-[#171411] bg-[#7b5732]" />
        <div className="absolute left-[2%] top-[18%] h-[24%] w-[48%] border-[4px] border-[#171411] bg-[#d7aa69]" />
        <div className="absolute right-[6%] bottom-[12%] top-[40%] w-[34%] border-[4px] border-[#171411] bg-[#8d6641]" />
        <div className="absolute right-[4%] top-[24%] h-[20%] w-[38%] border-[4px] border-[#171411] bg-[#c89056]" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-x-[16%] top-[10%] h-[28%] border-[4px] border-[#171411]"
        style={{ backgroundColor: spot.roof }}
      />
      <div
        className="absolute inset-x-[8%] bottom-[8%] top-[32%] border-[4px] border-[#171411]"
        style={{ backgroundColor: spot.wall }}
      />
      <div className="absolute left-[24%] top-[48%] h-[10%] w-[12%] bg-[#f7f2e9]" />
      <div className="absolute right-[24%] top-[48%] h-[10%] w-[12%] bg-[#f7f2e9]" />
    </div>
  );
}

function UtilityBoard({
  activeTab,
  onTabChange,
  legend,
  map,
  controls,
  className,
}: {
  activeTab: UtilityTab;
  onTabChange: (tab: UtilityTab) => void;
  legend: ReactNode;
  map: ReactNode;
  controls: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <UtilityTabButton label="Legend" active={activeTab === "legend"} onClick={() => onTabChange("legend")} />
        <UtilityTabButton label="Map" active={activeTab === "map"} onClick={() => onTabChange("map")} />
        <UtilityTabButton label="Controls" active={activeTab === "controls"} onClick={() => onTabChange("controls")} />
      </div>
      <div className="mt-4 max-h-[46svh] overflow-y-auto pr-1">
        {activeTab === "legend" ? legend : null}
        {activeTab === "map" ? map : null}
        {activeTab === "controls" ? controls : null}
      </div>
    </div>
  );
}

function UtilityTabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pixel-button px-3 py-2 ${active ? "bg-[#f16f51] text-white" : "bg-[#f8f2e9] text-[#171411]"}`}
    >
      <span className="arcade-face text-[0.38rem]">{label}</span>
    </button>
  );
}

function LegendBoard({
  items,
  objectiveLabel,
  nearbyLabel,
}: {
  items: Array<{ label: string; copy: string; color: string; accent: VillageAgent["id"] }>;
  objectiveLabel: string;
  nearbyLabel: string | null;
}) {
  return (
    <div className="grid gap-3">
      <div className="border-4 border-[#171411] bg-[#131923] px-3 py-3">
        <div className="arcade-face text-[0.42rem] text-[#f4d594]">Legend Board</div>
        <div className="mt-2 text-sm leading-6 text-[#d4cabd]">
          Read the town at a glance. Character colors match the moving agents on the map.
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <LegendListRow key={item.label} label={item.label} copy={item.copy} role={item.accent} color={item.color} />
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="border-4 border-[#171411] bg-[#131923] px-3 py-3 text-sm leading-6 text-[#d4cabd]">
          <div className="arcade-face text-[0.36rem] text-[#f8f2e9]">Quest pad</div>
          Light squares on the road show where you can inspect districts.
        </div>
        <div className="border-4 border-[#171411] bg-[#131923] px-3 py-3 text-sm leading-6 text-[#d4cabd]">
          <div className="arcade-face text-[0.36rem] text-[#f8f2e9]">Movement</div>
          {nearbyLabel ? `You are within inspect range of ${nearbyLabel}.` : `Click the ground or head toward ${objectiveLabel}.`}
        </div>
      </div>
    </div>
  );
}

function LegendListRow({
  label,
  copy,
  role,
  color,
}: {
  label: string;
  copy: string;
  role: VillageAgent["id"];
  color: string;
}) {
  return (
    <div className="border-4 border-[#171411] bg-[#131923] px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 shrink-0">
          <AvatarSprite role={role} color={color} />
        </div>
        <div className="min-w-0">
          <div className="arcade-face text-[0.36rem] text-[#f8f2e9]">{label}</div>
          <div className="mt-1 text-sm leading-5 text-[#d4cabd]">{copy}</div>
        </div>
      </div>
    </div>
  );
}

function DistrictSprite({
  district,
  selected,
  objective,
}: {
  district: District;
  selected: boolean;
  objective: boolean;
}) {
  const glowStyle =
    selected || objective
      ? {
          boxShadow: `0 0 0 4px rgba(255,255,255,0.35), 0 8px 18px ${district.palette.glow}`,
        }
      : undefined;

  if (district.id === "square") {
    return (
      <>
        <div className="absolute inset-x-[16%] top-[18%] h-[18%] border-[4px] border-[#171411] bg-[#f8df8c]" style={glowStyle} />
        <div className="absolute inset-x-[10%] bottom-[12%] top-[32%] border-[4px] border-[#171411] bg-[#735823]" />
        <div className="absolute left-[18%] top-[44%] h-[18%] w-[18%] border-[3px] border-[#171411] bg-[#f06c50]" />
        <div className="absolute right-[18%] top-[44%] h-[18%] w-[18%] border-[3px] border-[#171411] bg-[#72f0d3]" />
        <div className="absolute left-1/2 top-[42%] h-[24%] w-[24%] -translate-x-1/2 rounded-full border-[4px] border-[#171411] bg-[#f7f2e9]" />
      </>
    );
  }

  if (district.id === "core") {
    return (
      <>
        <div className="absolute inset-x-[16%] top-[10%] h-[18%] border-[4px] border-[#171411] bg-[#ffb35b]" style={glowStyle} />
        <div className="absolute inset-x-[12%] bottom-[10%] top-[24%] border-[4px] border-[#171411] bg-[#8c431d]" />
        <div className="absolute inset-x-[24%] top-[32%] h-[18%] border-[4px] border-[#171411] bg-[#ad5b2d]" />
        <div className="absolute left-[42%] top-[52%] h-[22%] w-[16%] border-[3px] border-[#171411] bg-[#1d1b18]" />
      </>
    );
  }

  if (district.id === "shop") {
    return (
      <>
        <div className="absolute inset-x-[14%] top-[16%] h-[16%] border-[4px] border-[#171411] bg-[#72f0d3]" style={glowStyle} />
        <div className="absolute inset-x-[10%] bottom-[12%] top-[30%] border-[4px] border-[#171411] bg-[#1d685c]" />
        <div className="absolute inset-x-[12%] top-[36%] h-[12%] bg-[repeating-linear-gradient(90deg,#fff8d7_0,#fff8d7_16px,#f06c50_16px,#f06c50_32px)]" />
        <div className="absolute left-[24%] top-[54%] h-[16%] w-[14%] bg-[#f7f2e9]" />
        <div className="absolute right-[24%] top-[54%] h-[16%] w-[14%] bg-[#f7f2e9]" />
      </>
    );
  }

  if (district.id === "supplier") {
    return (
      <>
        <div className="absolute inset-x-[16%] top-[16%] h-[18%] border-[4px] border-[#171411] bg-[#86a7ff]" style={glowStyle} />
        <div className="absolute inset-x-[8%] bottom-[12%] top-[32%] border-[4px] border-[#171411] bg-[#2b458e]" />
        <div className="absolute left-[18%] top-[50%] h-[14%] w-[18%] border-[3px] border-[#171411] bg-[#b8c6f3]" />
        <div className="absolute right-[18%] top-[50%] h-[14%] w-[18%] border-[3px] border-[#171411] bg-[#b8c6f3]" />
        <div className="absolute left-[40%] top-[20%] h-[10%] w-[20%] border-[3px] border-[#171411] bg-[#dfe6ff]" />
      </>
    );
  }

  if (district.id === "worker") {
    return (
      <>
        <div className="absolute inset-x-[14%] top-[18%] h-[16%] border-[4px] border-[#171411] bg-[#ff9a8b]" style={glowStyle} />
        <div className="absolute inset-x-[10%] bottom-[12%] top-[34%] border-[4px] border-[#171411] bg-[#863743]" />
        <div className="absolute left-[20%] top-[46%] h-[22%] w-[14%] bg-[#ffc49b]" />
        <div className="absolute left-[18%] top-[42%] h-[8%] w-[22%] border-[3px] border-[#171411] bg-[#ffe29b]" />
        <div className="absolute right-[18%] top-[42%] h-[8%] w-[12%] border-[3px] border-[#171411] bg-[#c5ccd8]" />
        <div className="absolute right-[22%] top-[50%] h-[18%] w-[4%] bg-[#704b33]" />
      </>
    );
  }

  if (district.id === "treasury") {
    return (
      <>
        <div className="absolute inset-x-[16%] top-[18%] h-[14%] border-[4px] border-[#171411] bg-[#b7f47e]" style={glowStyle} />
        <div className="absolute inset-x-[12%] bottom-[12%] top-[30%] border-[4px] border-[#171411] bg-[#3d6f2d]" />
        <div className="absolute left-1/2 top-[46%] h-[24%] w-[24%] -translate-x-1/2 border-[4px] border-[#171411] bg-[#d7e3ab]" />
        <div className="absolute left-1/2 top-[54%] h-[8%] w-[8%] -translate-x-1/2 rounded-full border-[3px] border-[#171411] bg-[#c8a44f]" />
      </>
    );
  }

  return (
    <>
      <div className="absolute inset-x-[16%] top-[16%] h-[16%] border-[4px] border-[#171411]" style={{ backgroundColor: district.palette.roof, ...glowStyle }} />
      <div className="absolute inset-x-[10%] bottom-[12%] top-[32%] border-[4px] border-[#171411]" style={{ backgroundColor: district.palette.wall }} />
      <div className="absolute left-[24%] top-[50%] h-[14%] w-[14%] bg-[#f7f2e9]" />
      <div className="absolute right-[24%] top-[50%] h-[14%] w-[14%] bg-[#f7f2e9]" />
    </>
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
      className={`pixel-button flex w-full min-w-[92px] items-center justify-center gap-2 px-3 py-2 sm:w-auto ${
        active ? "bg-[#f16f51] text-white" : "bg-[#f8f2e9] text-[#171411]"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="arcade-face text-[0.44rem]">{label}</span>
    </button>
  );
}

function MiniMap({
  className,
  districts,
  objectiveDistrictId,
  selectedDistrictId,
  playerPosition,
  npcPositions,
  onSelectDistrict,
}: {
  className?: string;
  districts: District[];
  objectiveDistrictId: DistrictId;
  selectedDistrictId: DistrictId;
  playerPosition: { x: number; y: number };
  npcPositions: Array<VillageAgent & { position: { x: number; y: number } }>;
  onSelectDistrict: (district: District) => void;
}) {
  return (
    <div className={`pointer-events-auto pixel-window-dark w-[148px] px-3 py-3 text-[#f8f2e9] ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="arcade-face text-[0.42rem] text-[#f4d594]">Map</div>
        <div className="arcade-face text-[0.34rem] text-[#d4cabd]">live</div>
      </div>
      <div className="pixel-minimap mt-3 relative h-[104px] overflow-hidden border-4 border-[#171411] bg-[#111722]">
        {districts.map((district) => {
          const isSelected = selectedDistrictId === district.id;
          const isObjective = objectiveDistrictId === district.id;

          return (
            <button
              key={district.id}
              type="button"
              onClick={() => onSelectDistrict(district)}
              className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 border-2 border-[#171411] ${
                isSelected ? "scale-125" : ""
              } ${isObjective ? "quest-beacon" : ""}`}
              style={{
                left: `${district.approachX}%`,
                top: `${district.approachY}%`,
                backgroundColor: district.palette.roof,
              }}
              aria-label={`Open ${district.title}`}
            />
          );
        })}
        {npcPositions
          .filter((agent) => agent.id !== "courier")
          .map((agent) => (
            <div
              key={agent.id}
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-none border-2 border-[#171411]"
              style={{
                left: `${agent.position.x}%`,
                top: `${agent.position.y}%`,
                backgroundColor: agent.color,
              }}
            />
          ))}
        <div
          className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 border-2 border-[#171411] bg-[#f3c44f]"
          style={{
            left: `${playerPosition.x}%`,
            top: `${playerPosition.y}%`,
          }}
        />
      </div>
      <div className="mt-3 text-[11px] leading-5 text-[#d4cabd]">
        Yellow is you. Red beacon marks the next story stop.
      </div>
    </div>
  );
}

function ControlPad({
  className,
  controlMode,
  nearbyDistrictTitle,
  onAuto,
  onInteract,
  onDirectionStart,
  onDirectionStop,
}: {
  className?: string;
  controlMode: ControlMode;
  nearbyDistrictTitle: string | null;
  onAuto: () => void;
  onInteract: () => void;
  onDirectionStart: (direction: Direction) => void;
  onDirectionStop: () => void;
}) {
  return (
    <div className={`pointer-events-auto pixel-window-dark w-[148px] px-3 py-3 text-[#f8f2e9] ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="arcade-face text-[0.42rem] text-[#f4d594]">Controls</div>
        <Gamepad2 className="h-4 w-4 text-[#d4cabd]" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <span />
        <DirectionButton
          label="up"
          icon={<ChevronUp className="h-4 w-4" />}
          onPress={() => onDirectionStart("up")}
          onRelease={onDirectionStop}
        />
        <button
          type="button"
          onClick={onAuto}
          className="pixel-button inline-flex items-center justify-center bg-[#f8f2e9] px-2 py-2 text-[#171411]"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
        <DirectionButton
          label="left"
          icon={<ChevronLeft className="h-4 w-4" />}
          onPress={() => onDirectionStart("left")}
          onRelease={onDirectionStop}
        />
        <button
          type="button"
          onClick={onInteract}
          className={`pixel-button px-2 py-2 ${
            nearbyDistrictTitle ? "bg-[#f16f51] text-white" : "bg-[#f8f2e9] text-[#171411]"
          }`}
        >
          <span className="arcade-face text-[0.36rem]">{nearbyDistrictTitle ? "Use" : controlMode}</span>
        </button>
        <DirectionButton
          label="right"
          icon={<ChevronRight className="h-4 w-4" />}
          onPress={() => onDirectionStart("right")}
          onRelease={onDirectionStop}
        />
        <span />
        <DirectionButton
          label="down"
          icon={<ChevronDown className="h-4 w-4" />}
          onPress={() => onDirectionStart("down")}
          onRelease={onDirectionStop}
        />
        <span />
      </div>
      <div className="mt-3 text-[11px] leading-5 text-[#d4cabd]">
        Hold directions or click the map to move. {nearbyDistrictTitle ? `Inspect ${nearbyDistrictTitle} from the center button.` : "Use center to keep manual mode close at hand."}
      </div>
    </div>
  );
}

function DirectionButton({
  label,
  icon,
  onPress,
  onRelease,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  onRelease: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      onTouchStart={(event) => {
        event.preventDefault();
        onPress();
      }}
      onTouchEnd={onRelease}
      onTouchCancel={onRelease}
      className="pixel-button inline-flex items-center justify-center bg-[#f8f2e9] px-2 py-2 text-[#171411] touch-manipulation"
    >
      {icon}
    </button>
  );
}

function SummaryBar({
  label,
  value,
  progress,
  tone = "blue",
}: {
  label: string;
  value: string;
  progress: number;
  tone?: "blue" | "mint" | "amber";
}) {
  const toneClass =
    tone === "mint"
      ? "from-[#72f0d3] to-[#1d685c]"
      : tone === "amber"
        ? "from-[#ffb35b] to-[#8c431d]"
        : "from-[#86a7ff] to-[#2b458e]";

  return (
    <div className="border-4 border-[#171411] bg-white/70 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="arcade-face text-[0.4rem] text-[#171411]">{label}</div>
        <div className="text-xs font-medium text-[#4d4338]">{value}</div>
      </div>
      <div className="mt-3 h-4 border-2 border-[#171411] bg-[#e7e0d4] p-[2px]">
        <div className={`h-full bg-gradient-to-r ${toneClass}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
      </div>
    </div>
  );
}

function QuickSummaryRow({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="border-4 border-[#171411] bg-[#f8f2e9] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="arcade-face text-[0.38rem] text-[#6b6256]">{label}</div>
        <div className="arcade-face text-[0.38rem] text-[#171411]">{value}</div>
      </div>
      <div className="mt-2 text-sm leading-6 text-[#4d4338]">{caption}</div>
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

function ObstacleProp({ obstacle }: { obstacle: VillageObstacle }) {
  return (
    <div
      className="pointer-events-none absolute z-[5] -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${obstacle.x}%`,
        top: `${obstacle.y}%`,
        width: `${obstacle.width}%`,
        height: `${obstacle.height}%`,
      }}
    >
      {obstacle.kind === "hedge" ? (
        <div className="absolute inset-0 border-[4px] border-[#171411] bg-[repeating-linear-gradient(90deg,#3d8f45_0,#3d8f45_12px,#57b35f_12px,#57b35f_24px)]" />
      ) : null}

      {obstacle.kind === "crate" ? (
        <>
          <div className="absolute left-[6%] top-[10%] h-[72%] w-[38%] border-[4px] border-[#171411] bg-[#9a6a40]" />
          <div className="absolute right-[6%] top-[10%] h-[72%] w-[38%] border-[4px] border-[#171411] bg-[#b17b4c]" />
        </>
      ) : null}

      {obstacle.kind === "rock" ? (
        <div className="absolute inset-[8%] border-[4px] border-[#171411] bg-[#8b909d]" style={{ clipPath: "polygon(15% 30%,35% 8%,72% 10%,92% 38%,84% 82%,32% 94%,8% 64%)" }} />
      ) : null}

      {obstacle.kind === "barrier" ? (
        <>
          <div className="absolute inset-0 border-[4px] border-[#171411] bg-[#7b5435]" />
          <div className="absolute inset-y-[14%] left-[12%] w-[16%] bg-[#e8c26d]" />
          <div className="absolute inset-y-[14%] left-[42%] w-[16%] bg-[#e8c26d]" />
          <div className="absolute inset-y-[14%] right-[12%] w-[16%] bg-[#e8c26d]" />
        </>
      ) : null}
    </div>
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


function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-4 border-[#171411] bg-[#f8f2e9] p-3 text-[#171411]">
      <div className="arcade-face text-[0.42rem]">{label}</div>
      <div className="mt-2 text-sm font-medium break-words">{value}</div>
    </div>
  );
}
