"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Compass,
  Landmark,
  LocateFixed,
  MapPinned,
  Radio,
  RefreshCw,
  ScrollText,
  Sparkles,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react";
import { useAccount, useBalance, useSwitchChain } from "wagmi";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { InteractionSheet } from "@/components/overlay/interaction-sheet";
import { STATUS_QUERY_KEY } from "@/game/config/constants";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import type { DistrictId, MapId, QuestActionId } from "@/game/core/live-types";
import { bazaarGameStore, useBazaarGameStore } from "@/game/core/store";
import { dialogueEntries } from "@/game/data/dialogue";
import { npcDefinitions } from "@/game/data/npcs";
import { goldenPathQuest } from "@/game/data/quests";
import { buildingDefinitions, districtDefinitions } from "@/game/data/world";
import {
  createDefaultPlayerPersistence,
  resolveWalletIdentity,
} from "@/game/systems/player-service";
import { deriveQuestRail, getActiveQuestStep } from "@/game/systems/quest-service";
import { loadPersistedPlayerState, savePersistedPlayerState } from "@/game/systems/persistence-service";
import { buildProofArtifacts } from "@/game/systems/proof-service";
import { executeQuestAction, fetchDashboardStatus } from "@/game/systems/transaction-service";
import { deriveWorldState } from "@/game/systems/world-state-service";
import { defaultXLayerChain } from "@/lib/xlayer";
import { PhaserGameClient } from "./phaser-game-client";

type DrawerTab = "quests" | "proof" | "districts" | "live" | "wallet";

type InteractionSelection = {
  interactionId: string;
  npcId?: string;
};

const drawerTabs: Array<{ id: DrawerTab; label: string }> = [
  { id: "quests", label: "Quest Rail" },
  { id: "proof", label: "Proof" },
  { id: "districts", label: "Districts" },
  { id: "live", label: "Tracker" },
  { id: "wallet", label: "Wallet" },
];

const mapLabels: Record<MapId, string> = {
  "village-exterior": "Village Exterior",
  "forge-interior": "Bazaar Forge",
  "depot-interior": "Supply Coil Depot",
  "treasury-interior": "Treasury Vault",
  "council-interior": "Covenant Hall",
};

const interactionNavigation: Record<
  string,
  {
    mapId: MapId;
    x: number;
    y: number;
    spawnId?: string;
  }
> = {
  "keeper-gate": {
    mapId: "village-exterior",
    x: 352,
    y: 224,
    spawnId: "gate-spawn",
  },
  "settlement-keep": {
    mapId: "village-exterior",
    x: 448,
    y: 176,
    spawnId: "gate-spawn",
  },
  "forge-door": {
    mapId: "village-exterior",
    x: 224,
    y: 304,
    spawnId: "forge-return",
  },
  "depot-door": {
    mapId: "village-exterior",
    x: 736,
    y: 304,
    spawnId: "depot-return",
  },
  "guild-yard": {
    mapId: "village-exterior",
    x: 736,
    y: 560,
    spawnId: "depot-return",
  },
  "treasury-door": {
    mapId: "village-exterior",
    x: 192,
    y: 624,
    spawnId: "treasury-return",
  },
  "council-door": {
    mapId: "village-exterior",
    x: 480,
    y: 624,
    spawnId: "council-return",
  },
  "forge-board": {
    mapId: "forge-interior",
    x: 288,
    y: 176,
    spawnId: "forge-entry",
  },
  "supplier-desk": {
    mapId: "depot-interior",
    x: 288,
    y: 176,
    spawnId: "depot-entry",
  },
  "treasury-board": {
    mapId: "treasury-interior",
    x: 288,
    y: 176,
    spawnId: "treasury-entry",
  },
  "governor-dais": {
    mapId: "council-interior",
    x: 288,
    y: 176,
    spawnId: "council-entry",
  },
};

const districtInteractionMap: Record<DistrictId, string> = {
  "village-gate": "settlement-keep",
  "market-row": "forge-door",
  "supplier-lane": "depot-door",
  "worker-yard": "guild-yard",
  "treasury-vault": "treasury-door",
  "council-hall": "council-door",
};

const interiorEntrySpawns: Partial<Record<MapId, string>> = {
  "village-exterior": "gate-spawn",
  "forge-interior": "forge-entry",
  "depot-interior": "depot-entry",
  "treasury-interior": "treasury-entry",
  "council-interior": "council-entry",
};

const npcNameLookup = new Map(npcDefinitions.map((npc) => [npc.id, npc.name] as const));

function shortAddress(address?: string) {
  if (!address) {
    return "Not connected";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function humanize(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTimeLabel(input?: string | number) {
  if (!input) {
    return "Awaiting sync";
  }

  const date = typeof input === "number" ? new Date(input) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "Awaiting sync";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function resolveInitialDrawerTab(initialScene?: string | null): DrawerTab {
  if (initialScene === "wallet") {
    return "wallet";
  }
  if (initialScene === "proof") {
    return "proof";
  }
  if (initialScene === "districts") {
    return "districts";
  }
  if (initialScene === "stats" || initialScene === "live") {
    return "live";
  }
  return "quests";
}

function resolveWorldPhase(input: {
  governancePassed: boolean;
  treasuryUnlocked: boolean;
  workerReady: boolean;
  supplierReady: boolean;
  shopOpen: boolean;
}) {
  if (input.governancePassed) {
    return "Governance amended";
  }
  if (input.treasuryUnlocked) {
    return "Treasury receiving tax";
  }
  if (input.workerReady) {
    return "Labor route primed";
  }
  if (input.supplierReady) {
    return "Supply route opened";
  }
  if (input.shopOpen) {
    return "Demand node lit";
  }
  return "Village waking";
}

export function BazaarRpgShell({ initialScene }: { initialScene?: string | null }) {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<InteractionSelection | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(initialScene));
  const [drawerTab, setDrawerTab] = useState<DrawerTab>(resolveInitialDrawerTab(initialScene));
  const [hasEnteredVillage, setHasEnteredVillage] = useState(Boolean(initialScene));

  const { address, chain, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address,
    query: {
      enabled: Boolean(address),
    },
  });
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const walletIdentity = useMemo(
    () =>
      resolveWalletIdentity({
        address,
        chainId: chain?.id,
        isConnected,
      }),
    [address, chain?.id, isConnected],
  );

  const currentMapId = useBazaarGameStore((state) => state.currentMapId);
  const objectiveTargetId = useBazaarGameStore((state) => state.objectiveTargetId);
  const pendingAction = useBazaarGameStore((state) => state.pendingAction);
  const liveStatus = useBazaarGameStore((state) => state.liveStatus);
  const proofs = useBazaarGameStore((state) => state.proofs);
  const settings = useBazaarGameStore((state) => state.settings);
  const world = useBazaarGameStore((state) => state.world);
  const hydrated = useBazaarGameStore((state) => state.hydrated);
  const selectedDistrictId = useBazaarGameStore((state) => state.selectedDistrictId);

  const statusQuery = useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: fetchDashboardStatus,
    staleTime: 4_000,
    refetchInterval: walletIdentity.connected ? 8_000 : false,
    enabled: walletIdentity.connected,
  });

  const actionMutation = useMutation({
    mutationFn: async (actionId: QuestActionId) => executeQuestAction(actionId),
    onSuccess: (payload) => {
      queryClient.setQueryData(STATUS_QUERY_KEY, payload.status);
      setDrawerOpen(true);
      setDrawerTab(payload.stepKey ? "proof" : "live");
    },
  });

  const enteredSessionKey = useMemo(
    () => `bazaar-x:entered:${address ?? "guest"}:${chain?.id ?? "none"}`,
    [address, chain?.id],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const sessionValue = window.sessionStorage.getItem(enteredSessionKey) === "1";
    setHasEnteredVillage(Boolean(initialScene) || sessionValue);
  }, [enteredSessionKey, initialScene]);

  useEffect(() => {
    bazaarGameStore.getState().setWallet(walletIdentity);
  }, [walletIdentity]);

  useEffect(() => {
    if (!walletIdentity.connected || !walletIdentity.validNetwork) {
      bazaarGameStore.getState().markHydrated();
      return;
    }

    const persisted =
      loadPersistedPlayerState(walletIdentity) ?? createDefaultPlayerPersistence();
    bazaarGameStore.getState().hydrateFromPersistence(persisted);
    bazaarGameStore.getState().markHydrated();
  }, [walletIdentity]);

  useEffect(() => {
    if (!walletIdentity.connected || !walletIdentity.validNetwork) {
      return;
    }

    savePersistedPlayerState(walletIdentity, {
      currentMapId,
      lastSpawnId: undefined,
      revealedProofIds: proofs.map((proof) => proof.id),
      unlockedLocations: [
        "village-exterior",
        "forge-interior",
        "depot-interior",
        "treasury-interior",
        "council-interior",
      ],
      activeQuestStepId: objectiveTargetId ?? undefined,
      muted: settings.muted,
      lowEffects: settings.lowEffects,
    });
  }, [currentMapId, objectiveTargetId, proofs, settings, walletIdentity]);

  useEffect(() => {
    const status = statusQuery.data ?? null;
    bazaarGameStore.getState().setLiveStatus(status);
    bazaarGameStore.getState().setWorldState(deriveWorldState(status));
    bazaarGameStore.getState().pushProofs(buildProofArtifacts(status));
    bazaarEventBridge.emit("economy:sync", { status });
  }, [statusQuery.data]);

  const rail = useMemo(
    () => deriveQuestRail(liveStatus, walletIdentity),
    [liveStatus, walletIdentity],
  );
  const deferredRail = useDeferredValue(rail);
  const deferredProofs = useDeferredValue(proofs);

  const activeQuest = useMemo(
    () => getActiveQuestStep(liveStatus, walletIdentity),
    [liveStatus, walletIdentity],
  );

  useEffect(() => {
    bazaarEventBridge.emit("quest:highlight", {
      targetId: activeQuest?.targetId ?? null,
      mapId: activeQuest?.targetMapId,
    });
  }, [activeQuest]);

  useEffect(() => {
    const offNpc = bazaarEventBridge.on("npc:interact", ({ interactionId, npcId }) => {
      setSelection({ interactionId, npcId });
    });
    const offDistrict = bazaarEventBridge.on("district:selected", ({ interactionId }) => {
      setSelection({ interactionId });
    });

    return () => {
      offNpc();
      offDistrict();
    };
  }, []);

  const currentDistrict = useMemo(() => {
    if (selectedDistrictId) {
      return districtDefinitions.find((district) => district.id === selectedDistrictId) ?? null;
    }

    const building = buildingDefinitions.find(
      (candidate) => candidate.portalMapId === currentMapId,
    );
    return districtDefinitions.find((district) => district.id === building?.districtId) ?? null;
  }, [currentMapId, selectedDistrictId]);

  const districtRoster = useMemo(() => {
    if (!currentDistrict) {
      return "Village route still syncing.";
    }

    return currentDistrict.npcRoster
      .map((npcId) => npcNameLookup.get(npcId) ?? humanize(npcId))
      .join(" • ");
  }, [currentDistrict]);

  const interactionView = useMemo(() => {
    if (!selection) {
      return null;
    }

    const npc = selection.npcId
      ? npcDefinitions.find((entry) => entry.id === selection.npcId)
      : null;
    const building = buildingDefinitions.find((entry) => entry.id === selection.interactionId);
    const isObjective = activeQuest?.targetId === selection.interactionId;

    const baseLines = npc
      ? dialogueEntries[npc.dialogueId]?.[0]?.lines ?? []
      : building
        ? [building.description]
        : [];
    const objectiveLines = isObjective
      ? [
          activeQuest?.requiredInteraction,
          activeQuest?.worldStateChange,
          activeQuest?.rewardOutput,
        ].filter((value): value is string => Boolean(value))
      : [];
    const lines = [...baseLines, ...objectiveLines].slice(0, 4);

    return {
      title: npc?.name ?? building?.name ?? humanize(selection.interactionId),
      subtitle:
        npc?.economyRole ?? building?.description ?? "Village interaction",
      lines:
        lines.length > 0
          ? lines
          : ["This corner of Bazaar X reacts to the next live economy step."],
      actionLabel: isObjective && activeQuest?.actionId ? activeQuest.title : undefined,
      actionId: isObjective ? activeQuest?.actionId : undefined,
      objectiveLabel: isObjective ? "Objective Interaction" : "Inspect",
    };
  }, [activeQuest, selection]);

  const completedSteps = deferredRail.filter((step) => step.state === "complete").length;
  const questProgress = Math.round(
    (completedSteps / Math.max(1, goldenPathQuest.steps.length)) * 100,
  );

  const addressLabel = shortAddress(address);
  const balanceLabel = walletIdentity.connected
    ? balance
      ? `${Number(balance.formatted).toFixed(4)} ${balance.symbol}`
      : "Syncing"
    : "Not connected";
  const chainLabel = chain?.name ?? "Wallet offline";
  const runtimeLabel = statusQuery.isFetching
    ? "syncing"
    : liveStatus?.liveDashboard.runtime?.status ?? "ready";
  const taxLabel = `${(
    ((liveStatus?.liveDashboard.bazaarSnapshot?.rules?.[0] as number | undefined) ?? 500) / 100
  ).toFixed(2)}%`;
  const treasuryLabel = `${Number(
    liveStatus?.liveDashboard.bazaarSnapshot?.treasuryBalanceOkb ?? 0,
  ).toFixed(3)} OKB`;
  const pendingLabel = pendingAction
    ? `${pendingAction.label} · ${pendingAction.status}`
    : "Idle";
  const worldPhase = resolveWorldPhase(world);

  const liveError =
    (statusQuery.error instanceof Error ? statusQuery.error.message : null) ??
    (actionMutation.error instanceof Error ? actionMutation.error.message : null) ??
    pendingAction?.errorMessage ??
    null;

  const worldAlertTone = liveError
    ? "danger"
    : !walletIdentity.connected || !walletIdentity.validNetwork
      ? "warn"
      : "ok";
  const worldAlert = liveError
    ? liveError
    : !walletIdentity.connected
      ? "Connect a wallet to wake the village. Wallet remains the only login."
      : !walletIdentity.validNetwork
        ? "Switch onto X Layer before trying live economy actions."
        : activeQuest
          ? `${activeQuest.objectiveText} The village will visibly react when the proof lands.`
          : "Walk the brighter roads, inspect a landmark, and keep the quest rail moving.";

  const lastUpdatedLabel = formatTimeLabel(
    liveStatus?.liveDashboard.runtime?.lastUpdatedAt ?? statusQuery.dataUpdatedAt,
  );
  const recentSteps = useMemo(
    () => [...(liveStatus?.liveDashboard.runtime?.steps ?? [])].slice(-8).reverse(),
    [liveStatus],
  );

  const onboardingVisible =
    !walletIdentity.connected || !walletIdentity.validNetwork || !hasEnteredVillage;
  const canEnterVillage = walletIdentity.connected && walletIdentity.validNetwork;

  async function handleQuestAction(actionId: QuestActionId) {
    bazaarGameStore.getState().setPendingAction({
      actionId,
      label: humanize(actionId),
      status: "pending",
      startedAt: Date.now(),
    });
    bazaarEventBridge.emit("tx:submitted", {
      actionId,
      label: humanize(actionId),
    });
    setDrawerOpen(true);
    setDrawerTab("live");

    try {
      const payload = await actionMutation.mutateAsync(actionId);
      bazaarGameStore.getState().setPendingAction({
        actionId,
        label: humanize(actionId),
        status: payload.txState,
        startedAt: Date.now(),
        txHash: payload.txHash,
        stepKey: payload.stepKey,
      });
      if (payload.stepKey) {
        bazaarEventBridge.emit("tx:confirmed", {
          actionId,
          stepKey: payload.stepKey,
          txHash: payload.txHash,
        });
      }
    } catch (error) {
      bazaarGameStore.getState().setPendingAction({
        actionId,
        label: humanize(actionId),
        status: "failed",
        startedAt: Date.now(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      setDrawerOpen(true);
      setDrawerTab("live");
    }
  }

  function openDrawer(tab: DrawerTab) {
    setDrawerOpen(true);
    setDrawerTab(tab);
  }

  function handleGuideToTarget(targetId: string) {
    const target = interactionNavigation[targetId];
    if (!target) {
      return;
    }

    bazaarEventBridge.emit("quest:highlight", {
      targetId,
      mapId: target.mapId,
    });
    setSelection(null);

    if (currentMapId !== target.mapId) {
      bazaarEventBridge.emit("scene:enter", {
        mapId: target.mapId,
        spawnId: target.spawnId ?? interiorEntrySpawns[target.mapId],
      });
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          bazaarEventBridge.emit("player:teleport", {
            mapId: target.mapId,
            x: target.x,
            y: target.y,
          });
        }, 120);
      }
      return;
    }

    bazaarEventBridge.emit("player:teleport", {
      mapId: target.mapId,
      x: target.x,
      y: target.y,
    });
  }

  function handleGuideToQuest(stepId?: string) {
    const questStep = deferredRail.find((step) => step.id === stepId) ?? activeQuest;
    if (!questStep) {
      return;
    }
    handleGuideToTarget(questStep.targetId);
    setDrawerOpen(false);
  }

  function handleGuideToDistrict(districtId: DistrictId) {
    const targetId = districtInteractionMap[districtId];
    if (!targetId) {
      return;
    }
    handleGuideToTarget(targetId);
    setDrawerOpen(false);
  }

  function handleEnterInterior(mapId: MapId) {
    bazaarEventBridge.emit("scene:enter", {
      mapId,
      spawnId: interiorEntrySpawns[mapId],
    });
    setDrawerOpen(false);
  }

  function handleEnterVillage() {
    setHasEnteredVillage(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(enteredSessionKey, "1");
    }
  }

  const drawerTitle =
    drawerTab === "quests"
      ? "Quest Rail"
      : drawerTab === "proof"
        ? "Proof Ledger"
        : drawerTab === "districts"
          ? "Village Briefing"
          : drawerTab === "live"
            ? "Live City Tracker"
            : "Wallet + Controls";

  const drawerDescription =
    drawerTab === "quests"
      ? "Guide the next objective, understand what changes in-world, and keep one live task active at all times."
      : drawerTab === "proof"
        ? "Receipts, decree notes, and recovered proof artifacts surfaced directly from X Layer activity."
        : drawerTab === "districts"
          ? "District identity, NPC purpose, and fast routing into the village spaces that matter."
          : drawerTab === "live"
            ? "Runtime activity, treasury motion, and transaction status as the chain responds."
            : "Wallet-only login, network status, accessibility controls, and recovery tools.";

  const onboardingSteps = [
    {
      label: walletIdentity.connected ? "Wallet linked" : "Step 1",
      title: walletIdentity.connected ? addressLabel : "Connect wallet",
      copy: walletIdentity.connected
        ? "Your courier identity is keyed to the connected address."
        : "Bazaar X starts only after a browser wallet signs in.",
    },
    {
      label: walletIdentity.validNetwork ? "X Layer ready" : "Step 2",
      title: walletIdentity.validNetwork ? chainLabel : "Validate network",
      copy: walletIdentity.validNetwork
        ? "The world is synced to a live X Layer network."
        : "Switch to X Layer so real contract calls can settle.",
    },
    {
      label: canEnterVillage ? "Village open" : "Step 3",
      title: canEnterVillage ? "Play game" : "Enter the village",
      copy: canEnterVillage
        ? "Walk into the town and follow the objective marker through the live economy loop."
        : "The Play Game gate unlocks as soon as wallet and network are ready.",
    },
  ];

  return (
    <main className="game-shell">
      <div className="game-canvas-wrap p-2 md:p-4">
        <div className="game-stage world-vignette relative h-full w-full overflow-hidden rounded-[28px] border-4 border-[#1a1510] md:rounded-[36px]">
          <PhaserGameClient />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_20%,transparent_78%,rgba(0,0,0,0.18))]" />

      <section className="pointer-events-auto absolute left-3 top-3 z-30 w-[min(34rem,calc(100vw-1.5rem))] md:left-5 md:top-5">
        <div className="pixel-window-dark panel-glow relative overflow-hidden p-4 text-[#f8f2e9] md:p-5">
          <div className="soft-grid pointer-events-none absolute inset-0 opacity-25" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,213,148,0.16),transparent_48%)]" />

          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="arcade-face text-[0.38rem] tracking-[0.24em] text-[#f4d594]">
                  Village Brief
                </div>
                <h1 className="mt-3 font-[var(--font-display)] text-[clamp(2rem,4vw,3.2rem)] leading-[0.95] text-white">
                  {activeQuest?.title ?? "Wake Bazaar X"}
                </h1>
                <p className="mt-3 max-w-[34rem] text-[0.97rem] leading-7 text-[#d9cdbf]">
                  {activeQuest?.objectiveText ??
                    "Connect your wallet, enter the village, and let the next real economy action reshape the town."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => openDrawer("quests")}
                className="pixel-help-badge flex shrink-0 items-center gap-2 px-3 py-3 text-[#171411]"
              >
                <BookOpen className="h-4 w-4" />
                <span className="arcade-face text-[0.42rem]">Quest Rail</span>
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
              <div className="border-4 border-[#1a1510] bg-[rgba(8,8,8,0.26)] px-4 py-4">
                <div className="arcade-face text-[0.34rem] tracking-[0.2em] text-[#f4d594]">
                  Current District
                </div>
                <div className="mt-2 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-[var(--font-display)] text-[1.35rem] leading-none text-white">
                      {currentDistrict?.name ?? "Sun Gate"}
                    </div>
                    <div className="mt-2 text-sm text-[#e6d8c6]">
                      {currentDistrict?.subtitle ?? "Arrival road"}
                    </div>
                  </div>
                  <div className="rounded-full border border-[#f4d594]/30 bg-[#f4d594]/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#f4d594]">
                    {worldPhase}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#d4cabd]">
                  {currentDistrict?.theme ??
                    "Warm stone, banners, and canal light mark the starting district."}
                </p>
                <div className="mt-3 border-t border-white/10 pt-3 text-[0.8rem] leading-6 text-[#bba98e]">
                  Roster: {districtRoster}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                <div className="border-4 border-[#1a1510] bg-[rgba(255,255,255,0.04)] px-4 py-3">
                  <div className="arcade-face text-[0.34rem] text-[#f4d594]">Campaign</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <strong className="font-[var(--font-display)] text-[1.55rem] text-white">
                      {questProgress}%
                    </strong>
                    <span className="text-xs uppercase tracking-[0.16em] text-[#c8b49a]">
                      {completedSteps}/{goldenPathQuest.steps.length} steps
                    </span>
                  </div>
                  <div className="mt-3 h-3 border-2 border-[#1a1510] bg-[#0e0c0a] p-[2px]">
                    <div
                      className="h-full bg-[linear-gradient(90deg,#f16f51_0%,#f4d594_48%,#72f0d3_100%)]"
                      style={{ width: `${questProgress}%` }}
                    />
                  </div>
                </div>

                <div className="border-4 border-[#1a1510] bg-[rgba(255,255,255,0.04)] px-4 py-3">
                  <div className="arcade-face text-[0.34rem] text-[#f4d594]">Proof + Runtime</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-[10px] border border-white/10 bg-black/10 px-3 py-2">
                      <div className="text-[0.62rem] uppercase tracking-[0.16em] text-[#c8b49a]">
                        Receipts
                      </div>
                      <div className="mt-1 text-white">{deferredProofs.length}</div>
                    </div>
                    <div className="rounded-[10px] border border-white/10 bg-black/10 px-3 py-2">
                      <div className="text-[0.62rem] uppercase tracking-[0.16em] text-[#c8b49a]">
                        Runtime
                      </div>
                      <div className="mt-1 text-white">{runtimeLabel}</div>
                    </div>
                    <div className="rounded-[10px] border border-white/10 bg-black/10 px-3 py-2">
                      <div className="text-[0.62rem] uppercase tracking-[0.16em] text-[#c8b49a]">
                        Tax
                      </div>
                      <div className="mt-1 text-white">{taxLabel}</div>
                    </div>
                    <div className="rounded-[10px] border border-white/10 bg-black/10 px-3 py-2">
                      <div className="text-[0.62rem] uppercase tracking-[0.16em] text-[#c8b49a]">
                        Treasury
                      </div>
                      <div className="mt-1 text-white">{treasuryLabel}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`mt-5 border-4 px-4 py-3 text-sm leading-6 ${
                worldAlertTone === "danger"
                  ? "border-[#7d221b] bg-[#3f1713] text-[#ffd7cf]"
                  : worldAlertTone === "warn"
                    ? "border-[#6e4e18] bg-[#352712] text-[#f5e0ae]"
                    : "border-[#183525] bg-[#112218] text-[#d3ffe3]"
              }`}
            >
              {worldAlert}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleGuideToQuest()}
                className="pixel-button flex items-center gap-2 bg-[#f16f51] px-4 py-3 text-white"
              >
                <LocateFixed className="h-4 w-4" />
                <span className="arcade-face text-[0.46rem]">Guide Me There</span>
              </button>

              <button
                type="button"
                onClick={() => openDrawer("live")}
                className="pixel-button flex items-center gap-2 bg-[#f4d594] px-4 py-3 text-[#2f251c]"
              >
                <Landmark className="h-4 w-4" />
                <span className="arcade-face text-[0.46rem]">Open Tracker</span>
              </button>

              <button
                type="button"
                onClick={() => openDrawer("wallet")}
                className="pixel-button flex items-center gap-2 bg-[#f8f2e9] px-4 py-3 text-[#171411]"
              >
                <Wallet className="h-4 w-4" />
                <span className="arcade-face text-[0.46rem]">Wallet Tools</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="pointer-events-auto absolute right-3 top-3 z-30 flex max-w-[calc(100vw-1.5rem)] flex-wrap justify-end gap-2 md:right-5 md:top-5">
        <div className="pixel-window flex min-w-[8.25rem] flex-col px-3 py-2 text-[#171411]">
          <span className="arcade-face text-[0.32rem] text-[#6b6256]">Wallet</span>
          <strong className="mt-1 text-sm">{addressLabel}</strong>
        </div>
        <div className="pixel-window flex min-w-[8.25rem] flex-col px-3 py-2 text-[#171411]">
          <span className="arcade-face text-[0.32rem] text-[#6b6256]">Network</span>
          <strong className="mt-1 text-sm">{chainLabel}</strong>
        </div>
        <div className="pixel-window flex min-w-[8.25rem] flex-col px-3 py-2 text-[#171411]">
          <span className="arcade-face text-[0.32rem] text-[#6b6256]">Balance</span>
          <strong className="mt-1 text-sm">{balanceLabel}</strong>
        </div>
        <button
          type="button"
          onClick={() => openDrawer("proof")}
          className="pixel-help-badge flex items-center gap-2 px-3 py-2 text-[#171411]"
        >
          <ScrollText className="h-4 w-4" />
          <span className="arcade-face text-[0.38rem]">Proof</span>
        </button>
      </section>

      <section className="pointer-events-auto absolute bottom-3 left-3 right-3 z-20 md:bottom-5 md:left-5 md:right-auto md:w-[min(38rem,calc(100vw-3rem))]">
        <div className="pixel-window px-4 py-3 text-[#171411]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="arcade-face text-[0.32rem] text-[#6b6256]">Live Town Feed</div>
              <div className="mt-1 text-sm leading-6 text-[#4d4338]">
                {pendingAction
                  ? `${pendingAction.label} is ${pendingAction.status}.`
                  : hydrated
                    ? "Use the right-side drawer for proof, districts, and wallet tools without covering the village."
                    : "Recovering your last quest and proof state..."}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openDrawer("proof")}
                className="pixel-button flex items-center gap-2 bg-[#171411] px-3 py-2 text-white"
              >
                <Radio className="h-4 w-4" />
                <span className="arcade-face text-[0.4rem]">Receipts</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  bazaarGameStore.getState().setSettings({
                    muted: !bazaarGameStore.getState().settings.muted,
                  })
                }
                className="pixel-button flex items-center gap-2 bg-[#f8f2e9] px-3 py-2 text-[#171411]"
              >
                {settings.muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span className="arcade-face text-[0.4rem]">
                  {settings.muted ? "Unmute" : "Mute"}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  bazaarGameStore.getState().setSettings({
                    lowEffects: !bazaarGameStore.getState().settings.lowEffects,
                  })
                }
                className="pixel-button flex items-center gap-2 bg-[#f8f2e9] px-3 py-2 text-[#171411]"
              >
                <Sparkles className="h-4 w-4" />
                <span className="arcade-face text-[0.4rem]">
                  {settings.lowEffects ? "Full FX" : "Low FX"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {drawerOpen ? (
        <aside className="pointer-events-auto absolute inset-x-3 bottom-3 z-30 md:inset-x-auto md:bottom-5 md:right-5 md:top-[6.75rem] md:w-[29rem]">
          <div
            className={`flex h-full flex-col overflow-hidden ${
              drawerTab === "live" ? "terminal-panel" : "pixel-window-dark panel-glow"
            }`}
          >
            <div
              className={`border-b-4 px-4 py-4 ${
                drawerTab === "live" ? "border-[#133a21]" : "border-[#1a1510]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div
                    className={`arcade-face text-[0.36rem] tracking-[0.22em] ${
                      drawerTab === "live" ? "terminal-header" : "text-[#f4d594]"
                    }`}
                  >
                    {drawerTitle}
                  </div>
                  <div
                    className={`mt-2 font-[var(--font-display)] text-[1.55rem] leading-none ${
                      drawerTab === "live" ? "text-white" : "text-white"
                    }`}
                  >
                    Bazaar X Drawer
                  </div>
                  <p
                    className={`mt-2 text-sm leading-6 ${
                      drawerTab === "live" ? "text-[#8cffb6]" : "text-[#d4cabd]"
                    }`}
                  >
                    {drawerDescription}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className={`pixel-button h-fit px-3 py-2 ${
                    drawerTab === "live"
                      ? "bg-[#020604] text-[#8cffb6]"
                      : "bg-[#f8f2e9] text-[#171411]"
                  }`}
                >
                  <span className="arcade-face text-[0.38rem]">Close</span>
                </button>
              </div>
            </div>

            <div
              className={`border-b-4 px-4 py-3 ${
                drawerTab === "live" ? "border-[#133a21]" : "border-[#1a1510]"
              }`}
            >
              <div className="flex gap-2 overflow-x-auto pb-1">
                {drawerTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDrawerTab(tab.id)}
                    className={`border-4 px-3 py-2 ${
                      drawerTab === tab.id
                        ? drawerTab === "live"
                          ? "border-[#133a21] bg-[#07130c] text-[#8cffb6]"
                          : "border-[#171411] bg-[#f4d594] text-[#171411]"
                        : drawerTab === "live"
                          ? "border-[#133a21] bg-[#020604] text-[#57d98c]"
                          : "border-[#1a1510] bg-[rgba(255,255,255,0.04)] text-[#d4cabd]"
                    }`}
                  >
                    <span className="arcade-face text-[0.38rem] whitespace-nowrap">
                      {tab.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div
              className={`border-b-4 px-4 py-3 ${
                drawerTab === "live" ? "border-[#133a21]" : "border-[#1a1510]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div
                    className={`arcade-face text-[0.32rem] ${
                      drawerTab === "live" ? "text-[#57d98c]" : "text-[#f4d594]"
                    }`}
                  >
                    Active Objective
                  </div>
                  <div
                    className={`mt-1 text-base font-semibold ${
                      drawerTab === "live" ? "text-white" : "text-[#fff5df]"
                    }`}
                  >
                    {activeQuest?.title ?? "Wake Bazaar X"}
                  </div>
                  <p
                    className={`mt-1 text-sm leading-6 ${
                      drawerTab === "live" ? "text-[#8cffb6]" : "text-[#d4cabd]"
                    }`}
                  >
                    {activeQuest?.objectiveText ??
                      "Follow the brighter roads and let the next proof wake the district."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleGuideToQuest()}
                  className={`pixel-button flex items-center gap-2 px-3 py-2 ${
                    drawerTab === "live"
                      ? "bg-[#07130c] text-[#8cffb6]"
                      : "bg-[#f8f2e9] text-[#171411]"
                  }`}
                >
                  <Compass className="h-4 w-4" />
                  <span className="arcade-face text-[0.36rem]">Guide</span>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {drawerTab === "quests" ? (
                <div className="grid gap-3">
                  {deferredRail.map((step) => (
                    <article
                      key={step.id}
                      className={`border-4 px-4 py-4 ${
                        step.state === "complete"
                          ? "border-[#1f4f32] bg-[#12281c] text-[#dcffe8]"
                          : step.state === "active"
                            ? "border-[#5e4414] bg-[#322411] text-[#ffedbf]"
                            : "border-[#2e2822] bg-[#1b1611] text-[#ccbda5]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="arcade-face text-[0.32rem] uppercase tracking-[0.18em] opacity-80">
                            {humanize(step.state)}
                          </div>
                          <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleGuideToQuest(step.id)}
                          className="pixel-button bg-[#f8f2e9] px-3 py-2 text-[#171411]"
                        >
                          <span className="arcade-face text-[0.34rem]">Guide</span>
                        </button>
                      </div>

                      <p className="mt-3 text-sm leading-6">{step.objectiveText}</p>

                      <div className="mt-4 grid gap-2 text-sm leading-6">
                        <div className="rounded-[10px] border border-white/10 bg-black/10 px-3 py-2">
                          <strong>Interaction:</strong> {step.requiredInteraction}
                        </div>
                        <div className="rounded-[10px] border border-white/10 bg-black/10 px-3 py-2">
                          <strong>World change:</strong> {step.worldStateChange}
                        </div>
                        <div className="rounded-[10px] border border-white/10 bg-black/10 px-3 py-2">
                          <strong>Proof shown:</strong> {step.rewardOutput}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {drawerTab === "proof" ? (
                <div className="grid gap-3">
                  {deferredProofs.length ? (
                    deferredProofs.map((proof) => (
                      <article
                        key={proof.id}
                        className="border-4 border-[#1a1510] bg-[rgba(255,255,255,0.04)] px-4 py-4 text-[#f8f2e9]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="arcade-face text-[0.32rem] text-[#f4d594]">
                              {proof.kind}
                            </div>
                            <h3 className="mt-2 text-base font-semibold text-white">
                              {proof.title}
                            </h3>
                          </div>
                          {proof.explorerUrl ? (
                            <a
                              href={proof.explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="pixel-button flex items-center gap-2 bg-[#f8f2e9] px-3 py-2 text-[#171411]"
                            >
                              <ArrowUpRight className="h-4 w-4" />
                              <span className="arcade-face text-[0.34rem]">View</span>
                            </a>
                          ) : null}
                        </div>

                        <p className="mt-3 text-sm leading-6 text-[#d4cabd]">{proof.body}</p>

                        <div className="mt-4 grid gap-2 text-sm">
                          <div className="rounded-[10px] border border-white/10 bg-black/10 px-3 py-2">
                            <strong>Label:</strong> {proof.label}
                          </div>
                          <div className="rounded-[10px] border border-white/10 bg-black/10 px-3 py-2">
                            <strong>District:</strong> {humanize(proof.districtId)}
                          </div>
                          <div className="rounded-[10px] border border-white/10 bg-black/10 px-3 py-2">
                            <strong>Time:</strong> {formatTimeLabel(proof.createdAt)}
                          </div>
                          {proof.txHash ? (
                            <div className="rounded-[10px] border border-white/10 bg-black/10 px-3 py-2 mono text-[0.78rem] text-[#f4d594]">
                              {proof.txHash}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="border-4 border-[#1a1510] bg-[rgba(255,255,255,0.04)] px-4 py-4 text-sm leading-6 text-[#d4cabd]">
                      Walk to the keeper, wake the roster, and the ledger will fill with live proof artifacts.
                    </div>
                  )}
                </div>
              ) : null}

              {drawerTab === "districts" ? (
                <div className="grid gap-3">
                  {districtDefinitions.map((district) => {
                    const linkedInterior = district.linkedInteriors[0];
                    const roster = district.npcRoster
                      .map((npcId) => npcNameLookup.get(npcId) ?? humanize(npcId))
                      .join(" • ");

                    return (
                      <article
                        key={district.id}
                        className="border-4 border-[#1a1510] bg-[rgba(255,255,255,0.04)] px-4 py-4 text-[#f8f2e9]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="arcade-face text-[0.32rem] text-[#f4d594]">
                              {district.subtitle}
                            </div>
                            <h3 className="mt-2 text-lg font-semibold text-white">
                              {district.name}
                            </h3>
                          </div>
                          <MapPinned className="mt-1 h-4 w-4 text-[#f4d594]" />
                        </div>

                        <p className="mt-3 text-sm leading-6 text-[#d4cabd]">
                          {district.theme}
                        </p>

                        <div className="mt-3 rounded-[10px] border border-white/10 bg-black/10 px-3 py-2 text-sm leading-6 text-[#d4cabd]">
                          <strong>Roster:</strong> {roster}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleGuideToDistrict(district.id)}
                            className="pixel-button bg-[#f4d594] px-3 py-2 text-[#171411]"
                          >
                            <span className="arcade-face text-[0.36rem]">Guide</span>
                          </button>
                          {linkedInterior ? (
                            <button
                              type="button"
                              onClick={() => handleEnterInterior(linkedInterior)}
                              className="pixel-button bg-[#f8f2e9] px-3 py-2 text-[#171411]"
                            >
                              <span className="arcade-face text-[0.36rem]">
                                Enter {mapLabels[linkedInterior]}
                              </span>
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}

              {drawerTab === "live" ? (
                <div className="grid gap-3 text-[#8cffb6]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="border-4 border-[#133a21] bg-[#020604] px-4 py-3">
                      <div className="arcade-face text-[0.32rem] terminal-header">Runtime</div>
                      <div className="mt-2 text-sm uppercase tracking-[0.16em] text-white">
                        {runtimeLabel}
                      </div>
                    </div>
                    <div className="border-4 border-[#133a21] bg-[#020604] px-4 py-3">
                      <div className="arcade-face text-[0.32rem] terminal-header">Updated</div>
                      <div className="mt-2 text-sm uppercase tracking-[0.16em] text-white">
                        {lastUpdatedLabel}
                      </div>
                    </div>
                    <div className="border-4 border-[#133a21] bg-[#020604] px-4 py-3">
                      <div className="arcade-face text-[0.32rem] terminal-header">Treasury</div>
                      <div className="mt-2 text-sm uppercase tracking-[0.16em] text-white">
                        {treasuryLabel}
                      </div>
                    </div>
                    <div className="border-4 border-[#133a21] bg-[#020604] px-4 py-3">
                      <div className="arcade-face text-[0.32rem] terminal-header">Tax</div>
                      <div className="mt-2 text-sm uppercase tracking-[0.16em] text-white">
                        {taxLabel}
                      </div>
                    </div>
                  </div>

                  <div className="border-4 border-[#133a21] bg-[rgba(19,58,33,0.3)] px-4 py-4 text-[0.8rem] leading-6">
                    {liveError ?? `Pending action: ${pendingLabel}. The tracker stays live while X Layer settles.`}
                  </div>

                  <div className="grid gap-3">
                    {recentSteps.length ? (
                      recentSteps.map((step) => (
                        <article
                          key={`${step.key}:${step.startedAt}`}
                          className="border-4 border-[#133a21] bg-[#020604] px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="arcade-face text-[0.32rem] terminal-header">
                                {step.status}
                              </div>
                              <h3 className="mt-2 text-sm uppercase tracking-[0.14em] text-white">
                                {step.label}
                              </h3>
                            </div>
                            {step.explorerUrl ? (
                              <a
                                href={step.explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="pixel-button flex items-center gap-2 bg-[#07130c] px-3 py-2 text-[#8cffb6]"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                                <span className="arcade-face text-[0.34rem]">View</span>
                              </a>
                            ) : null}
                          </div>

                          <p className="mt-3 text-sm leading-6 text-[#8cffb6]">
                            {step.detail ?? "Runtime step is synced from the live flow."}
                          </p>

                          <div className="mt-3 mono text-[0.72rem] text-[#57d98c]">
                            {step.txHash ?? step.key}
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="border-4 border-[#133a21] bg-[#020604] px-4 py-4 text-sm leading-6">
                        No live chain steps yet. The first confirmed action will appear here.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {drawerTab === "wallet" ? (
                <div className="grid gap-3 text-[#f8f2e9]">
                  <div className="border-4 border-[#1a1510] bg-[rgba(255,255,255,0.04)] px-4 py-4 text-sm leading-6 text-[#d4cabd]">
                    Wallet connection is the only login. Player progression, proof recovery, and unlocked locations are keyed to the connected address and X Layer chain.
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="border-4 border-[#1a1510] bg-[rgba(255,255,255,0.04)] px-4 py-3">
                      <div className="arcade-face text-[0.32rem] text-[#f4d594]">Address</div>
                      <div className="mt-2 text-sm text-white">{addressLabel}</div>
                    </div>
                    <div className="border-4 border-[#1a1510] bg-[rgba(255,255,255,0.04)] px-4 py-3">
                      <div className="arcade-face text-[0.32rem] text-[#f4d594]">Network</div>
                      <div className="mt-2 text-sm text-white">{chainLabel}</div>
                    </div>
                    <div className="border-4 border-[#1a1510] bg-[rgba(255,255,255,0.04)] px-4 py-3">
                      <div className="arcade-face text-[0.32rem] text-[#f4d594]">Balance</div>
                      <div className="mt-2 text-sm text-white">{balanceLabel}</div>
                    </div>
                    <div className="border-4 border-[#1a1510] bg-[rgba(255,255,255,0.04)] px-4 py-3">
                      <div className="arcade-face text-[0.32rem] text-[#f4d594]">Current Map</div>
                      <div className="mt-2 text-sm text-white">{mapLabels[currentMapId]}</div>
                    </div>
                  </div>

                  <ConnectWalletButton variant="pixel" fullWidth />

                  {walletIdentity.connected && !walletIdentity.validNetwork ? (
                    <button
                      type="button"
                      disabled={isSwitching}
                      onClick={() => switchChain?.({ chainId: defaultXLayerChain.id })}
                      className="pixel-button bg-[#f16f51] px-4 py-3 text-white"
                    >
                      <span className="arcade-face text-[0.48rem]">
                        {isSwitching ? "Switching..." : "Switch To X Layer"}
                      </span>
                    </button>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void statusQuery.refetch()}
                      disabled={statusQuery.isFetching}
                      className="pixel-button flex items-center justify-center gap-2 bg-[#f8f2e9] px-4 py-3 text-[#171411]"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span className="arcade-face text-[0.42rem]">
                        {statusQuery.isFetching ? "Refreshing..." : "Refresh State"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        bazaarGameStore.getState().setSettings({
                          lowEffects: !bazaarGameStore.getState().settings.lowEffects,
                        })
                      }
                      className="pixel-button bg-[#f8f2e9] px-4 py-3 text-[#171411]"
                    >
                      <span className="arcade-face text-[0.42rem]">
                        {settings.lowEffects ? "Enable Full FX" : "Reduce Effects"}
                      </span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => openDrawer("quests")}
          className="pointer-events-auto absolute bottom-3 right-3 z-30 flex items-center gap-2 px-3 py-3 text-[#171411] md:bottom-auto md:right-5 md:top-[6.75rem] pixel-help-badge"
        >
          <BookOpen className="h-4 w-4" />
          <span className="arcade-face text-[0.4rem]">Open Drawer</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {interactionView ? (
        <InteractionSheet
          title={interactionView.title}
          subtitle={interactionView.subtitle}
          lines={interactionView.lines}
          objectiveLabel={interactionView.objectiveLabel}
          actionLabel={interactionView.actionLabel}
          actionDisabled={
            Boolean(!interactionView.actionId || actionMutation.isPending || !walletIdentity.validNetwork)
          }
          actionPending={actionMutation.isPending}
          disabledReason={
            !walletIdentity.connected
              ? "Connect your wallet before committing the next live quest action."
              : !walletIdentity.validNetwork
                ? "Switch to X Layer before committing the next live quest action."
                : "Quest actions here submit real Bazaar X transactions to X Layer and wait for proof."
          }
          onAction={
            interactionView.actionId
              ? () => handleQuestAction(interactionView.actionId as QuestActionId)
              : undefined
          }
          onClose={() => setSelection(null)}
        />
      ) : null}

      {onboardingVisible ? (
        <div className="absolute inset-0 z-50 overflow-y-auto bg-[rgba(14,12,10,0.56)] px-3 backdrop-blur-md">
          <div className="fade-in flex min-h-full w-full items-start justify-center py-4 sm:items-center sm:py-6">
            <div className="pixel-window-dark panel-glow relative w-full max-w-[860px] overflow-y-auto p-6 text-center shadow-[0_24px_50px_rgba(0,0,0,0.5)] max-h-[calc(100svh-2rem)] sm:p-8 sm:max-h-[calc(100svh-3rem)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(244,213,148,0.07),transparent_60%)]" />
              <div className="relative z-10 arcade-face text-[0.42rem] tracking-[0.24em] text-[#f4d594]">
                X Layer World Economy
              </div>
              <h2 className="relative z-10 mt-4 font-[var(--font-display)] text-[clamp(2.4rem,6vw,4.7rem)] leading-[0.9] text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
                Bazaar<span className="text-[#f16f51]">X</span>
              </h2>
              <p className="relative z-10 mx-auto mt-5 max-w-[680px] text-[1rem] leading-8 text-[#d4cabd]">
                Connect your wallet, validate X Layer, then hit Play Game to enter a living pixel village where work, tax, treasury, and governance all settle onchain.
              </p>

              <div className="relative z-10 mt-7 grid gap-3 text-left md:grid-cols-3">
                {onboardingSteps.map((step) => (
                  <div
                    key={step.label}
                    className="border-4 border-[#1a1510] bg-[rgba(10,10,10,0.28)] px-4 py-4"
                  >
                    <div className="arcade-face text-[0.34rem] text-[#f4d594]">{step.label}</div>
                    <div className="mt-2 arcade-face text-[0.46rem] text-white">{step.title}</div>
                    <div className="mt-2 text-sm leading-6 text-[#d4cabd]">{step.copy}</div>
                  </div>
                ))}
              </div>

              <div className="relative z-10 mt-7 flex flex-col items-center gap-4">
                {!walletIdentity.connected ? <ConnectWalletButton variant="pixel" fullWidth /> : null}

                {walletIdentity.connected && !walletIdentity.validNetwork ? (
                  <button
                    type="button"
                    disabled={isSwitching}
                    onClick={() => switchChain?.({ chainId: defaultXLayerChain.id })}
                    className="pixel-button arcade-face flex w-full items-center justify-center gap-2 bg-[#f16f51] px-4 py-4 text-[0.62rem] text-white transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#4f4339] disabled:text-[#8d8272]"
                  >
                    <Wallet className="h-5 w-5" />
                    {isSwitching ? "Switching..." : "Switch To X Layer"}
                  </button>
                ) : null}

                {canEnterVillage ? (
                  <button
                    type="button"
                    onClick={handleEnterVillage}
                    className="pixel-button arcade-face flex w-full items-center justify-center gap-2 bg-[#f4d594] px-4 py-4 text-[0.65rem] text-[#2f251c] transition-colors hover:bg-white"
                  >
                    <Sparkles className="h-5 w-5" />
                    Play Game
                  </button>
                ) : null}
              </div>

              <div className="relative z-10 mt-7 grid gap-3 text-left md:grid-cols-2">
                <div className="border-4 border-[#1a1510] bg-[rgba(10,10,10,0.2)] px-4 py-4 text-sm leading-6 text-[#d4cabd]">
                  <div className="arcade-face text-[0.36rem] text-white">Controls</div>
                  Move through the village, step onto portals to enter interiors, and inspect NPCs or buildings when the prompt lights up.
                </div>
                <div className="border-4 border-[#1a1510] bg-[rgba(10,10,10,0.2)] px-4 py-4 text-sm leading-6 text-[#d4cabd]">
                  <div className="arcade-face text-[0.36rem] text-white">Need Proof?</div>
                  The drawer keeps quest guidance, receipts, live chain tracking, and wallet tools close without flattening the world.
                </div>
              </div>

              <div className="relative z-10 mt-6 border-t-2 border-[rgba(255,255,255,0.05)] pt-5">
                <div
                  className={`flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest ${
                    canEnterVillage ? "text-[#a3d07e]" : "text-[#c9b8a1]"
                  }`}
                >
                  <div
                    className={`h-2 w-2 rounded-full ${
                      canEnterVillage ? "animate-pulse bg-[#a3d07e]" : "bg-[#8d8272]"
                    }`}
                  />
                  {canEnterVillage
                    ? "Ready to enter"
                    : "Wallet connection and X Layer validation required"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
