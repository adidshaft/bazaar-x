"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  Landmark,
  LocateFixed,
  MapPinned,
  PanelLeftClose,
  PanelLeftOpen,
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
import { ProofRealityOverlay } from "@/components/overlay/proof-reality-overlay";
import { SkillGrimoire } from "@/components/overlay/skill-grimoire";
import { STATUS_QUERY_KEY } from "@/game/config/constants";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import type { DistrictId, MapId, ProofArtifact, QuestActionId, WalletIdentity } from "@/game/core/live-types";
import { bazaarGameStore, useBazaarGameStore } from "@/game/core/store";
import { dialogueEntries } from "@/game/data/dialogue";
import { npcDefinitions } from "@/game/data/npcs";
import { goldenPathQuest } from "@/game/data/quests";
import { buildingDefinitions, districtDefinitions } from "@/game/data/world";
import {
  createDefaultPlayerPersistence,
  resolveDefaultPlayerName,
  resolveWalletIdentity,
} from "@/game/systems/player-service";
import { deriveQuestRail, getActiveQuestStep } from "@/game/systems/quest-service";
import { loadPersistedPlayerState, savePersistedPlayerState } from "@/game/systems/persistence-service";
import { ProofListener } from "@/game/systems/proof-service";
import {
  delegateTradeSkill,
  executeQuestAction,
  fetchDashboardStatus,
  unlockSkill,
} from "@/game/systems/transaction-service";
import { bazaarAudioSystem } from "@/game/systems/audio-system";
import { deriveWorldState, EconomicMonitor } from "@/game/systems/world-state-service";
import { aiSkillCatalog, defaultUnlockedSkillIds } from "@/lib/skills/ai-skills";
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
  "village-exterior": "Bazaar Village",
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
    x: 800,
    y: 352,
    spawnId: "gate-spawn",
  },
  "settlement-keep": {
    mapId: "village-exterior",
    x: 960,
    y: 304,
    spawnId: "gate-spawn",
  },
  "forge-door": {
    mapId: "village-exterior",
    x: 384,
    y: 560,
    spawnId: "forge-return",
  },
  "depot-door": {
    mapId: "village-exterior",
    x: 1536,
    y: 560,
    spawnId: "depot-return",
  },
  "guild-yard": {
    mapId: "village-exterior",
    x: 1536,
    y: 1040,
    spawnId: "depot-return",
  },
  "treasury-door": {
    mapId: "village-exterior",
    x: 384,
    y: 1136,
    spawnId: "treasury-return",
  },
  "council-door": {
    mapId: "village-exterior",
    x: 992,
    y: 1136,
    spawnId: "council-return",
  },
  "forge-board": {
    mapId: "forge-interior",
    x: 416,
    y: 224,
    spawnId: "forge-entry",
  },
  "supplier-desk": {
    mapId: "depot-interior",
    x: 416,
    y: 224,
    spawnId: "depot-entry",
  },
  "treasury-board": {
    mapId: "treasury-interior",
    x: 416,
    y: 224,
    spawnId: "treasury-entry",
  },
  "governor-dais": {
    mapId: "council-interior",
    x: 416,
    y: 224,
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

const npcLookup = new Map(npcDefinitions.map((npc) => [npc.id, npc] as const));
const hydrationFallbackWalletIdentity: WalletIdentity = {
  connected: false,
  validNetwork: false,
};

function shortAddress(address?: string) {
  if (!address) {
    return "Not connected";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function humanize(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTimeLabel(input?: string | number, ready = true) {
  if (!ready || !input) {
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
  if (initialScene === "live") {
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
    return "Treasury live";
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

function clampPlayerName(name: string, fallback: string) {
  const cleaned = name.replace(/\s+/g, " ").trim().slice(0, 24);
  return cleaned || fallback;
}

type ShellCardProps = {
  kicker: string;
  title: string;
  children: React.ReactNode;
  accent?: "cyan" | "warm" | "green" | "violet";
};

function ShellCard({ kicker, title, children, accent = "cyan" }: ShellCardProps) {
  return (
    <section className={`shell-card shell-card-${accent}`}>
      <div className="shell-card-kicker">{kicker}</div>
      <h3 className="shell-card-title">{title}</h3>
      <div className="shell-card-body">{children}</div>
    </section>
  );
}

export function BazaarRpgShell({ initialScene }: { initialScene?: string | null }) {
  const queryClient = useQueryClient();
  const economicMonitorRef = useRef(new EconomicMonitor());
  const proofListenerRef = useRef(new ProofListener());
  const [selection, setSelection] = useState<InteractionSelection | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(initialScene));
  const [drawerTab, setDrawerTab] = useState<DrawerTab>(resolveInitialDrawerTab(initialScene));
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [hasEnteredVillage, setHasEnteredVillage] = useState(Boolean(initialScene));
  const [playerNameDraft, setPlayerNameDraft] = useState("");
  const [skillHudMapId, setSkillHudMapId] = useState<MapId | null>(null);
  const [proofOverlay, setProofOverlay] = useState<ProofArtifact | null>(null);
  const [unlockPendingSkillId, setUnlockPendingSkillId] = useState<string | null>(null);
  const [delegatePendingSkillId, setDelegatePendingSkillId] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [phaserReady, setPhaserReady] = useState(false);
  const [stageLoadError, setStageLoadError] = useState<string | null>(null);

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
  const displayWalletIdentity = useMemo(
    () => (hasMounted ? walletIdentity : hydrationFallbackWalletIdentity),
    [hasMounted, walletIdentity],
  );
  const displayAddress = hasMounted ? address : undefined;
  const displayChainName = hasMounted ? chain?.name : undefined;
  const displayBalance = hasMounted ? balance : undefined;

  const sceneId = useBazaarGameStore((state) => state.sceneId);
  const currentMapId = useBazaarGameStore((state) => state.currentMapId);
  const objectiveTargetId = useBazaarGameStore((state) => state.objectiveTargetId);
  const pendingAction = useBazaarGameStore((state) => state.pendingAction);
  const liveStatus = useBazaarGameStore((state) => state.liveStatus);
  const proofs = useBazaarGameStore((state) => state.proofs);
  const settings = useBazaarGameStore((state) => state.settings);
  const world = useBazaarGameStore((state) => state.world);
  const hydrated = useBazaarGameStore((state) => state.hydrated);
  const selectedDistrictId = useBazaarGameStore((state) => state.selectedDistrictId);
  const playerName = useBazaarGameStore((state) => state.playerName);
  const skillCatalog = useBazaarGameStore((state) => state.skillCatalog);
  const unlockedSkillIds = useBazaarGameStore((state) => state.unlockedSkillIds);
  const activeSkillId = useBazaarGameStore((state) => state.activeSkillId);
  const laborRouting = useBazaarGameStore((state) => state.laborRouting);

  const statusQuery = useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: fetchDashboardStatus,
    staleTime: 4_000,
    refetchInterval: hasMounted && walletIdentity.connected ? 8_000 : false,
    enabled: hasMounted && walletIdentity.connected,
  });

  const actionMutation = useMutation({
    mutationFn: async (actionId: QuestActionId) => executeQuestAction(actionId),
    onSuccess: (payload) => {
      queryClient.setQueryData(STATUS_QUERY_KEY, payload.status);
      setDrawerOpen(true);
      setDrawerTab(payload.stepKey ? "proof" : "live");
    },
  });

  const sessionKey = useMemo(
    () => `bazaar-x:entered:${address ?? "guest"}:${chain?.id ?? "none"}`,
    [address, chain?.id],
  );

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const unlockAudio = () => {
      bazaarAudioSystem.unlock();
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const sessionValue = window.sessionStorage.getItem(sessionKey) === "1";
    setHasEnteredVillage(Boolean(initialScene) || sessionValue);
  }, [initialScene, sessionKey]);

  useEffect(() => {
    bazaarGameStore.getState().setWallet(walletIdentity);
  }, [walletIdentity]);

  useEffect(() => {
    bazaarGameStore.getState().setSkillCatalog(aiSkillCatalog);
    if (bazaarGameStore.getState().unlockedSkillIds.length === 0) {
      bazaarGameStore.getState().setSkillLoadout({
        unlockedSkillIds: [...defaultUnlockedSkillIds],
        activeSkillId: defaultUnlockedSkillIds[0] ?? null,
      });
    }
  }, []);

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

    if (!playerName || playerName === "Agent Echo") {
      bazaarGameStore
        .getState()
        .setPlayerName(resolveDefaultPlayerName(walletIdentity.address));
    }
  }, [playerName, walletIdentity]);

  useEffect(() => {
    setPlayerNameDraft(playerName);
  }, [playerName]);

  useEffect(() => {
    if (!hydrated || !walletIdentity.connected || !walletIdentity.validNetwork) {
      return;
    }

    savePersistedPlayerState(walletIdentity, {
      currentMapId,
      lastSpawnId: undefined,
      playerName,
      revealedProofIds: proofs.map((proof) => proof.id),
      unlockedLocations: [
        "village-exterior",
        "forge-interior",
        "depot-interior",
        "treasury-interior",
        "council-interior",
      ],
      activeQuestStepId: objectiveTargetId ?? undefined,
      unlockedSkillIds,
      activeSkillId,
      muted: settings.muted,
      lowEffects: settings.lowEffects,
      laborRouting,
    });
  }, [
    activeSkillId,
    currentMapId,
    laborRouting,
    objectiveTargetId,
    playerName,
    proofs,
    settings,
    unlockedSkillIds,
    walletIdentity,
  ]);

  useEffect(() => {
    const status = statusQuery.data ?? null;
    const proofSnapshot = proofListenerRef.current.consume(status);
    const worldState = deriveWorldState(status);

    bazaarGameStore.getState().setLiveStatus(status);
    bazaarGameStore.getState().setWorldState(worldState);
    bazaarGameStore.getState().pushProofs(proofSnapshot.proofs);
    bazaarGameStore.getState().setSkillCatalog(status?.aiSkills ?? aiSkillCatalog);
    bazaarEventBridge.emit("economy:sync", { status });

    const taxCollection = economicMonitorRef.current.detectTaxCollection(status);
    if (taxCollection) {
      bazaarEventBridge.emit("economy:tax-collected", taxCollection);
      bazaarEventBridge.emit("toast:show", {
        id: `tax:${taxCollection.id}`,
        title: "Tax Collected",
        body: `${taxCollection.amountOkb} OKB moved into treasury.`,
        tone: "tax",
      });
    }

    proofSnapshot.freshProofs.forEach((proof) => {
      bazaarEventBridge.emit("proof:verified", { proof });
    });
  }, [statusQuery.data]);

  useEffect(() => {
    bazaarAudioSystem.setMuted(settings.muted);
  }, [settings.muted]);

  useEffect(() => {
    bazaarAudioSystem.setEconomyTone(world.gdpScore, world.worldTier);
  }, [world.gdpScore, world.worldTier]);

  useEffect(() => {
    const isStacked = typeof window !== "undefined" && window.innerWidth <= 1180;
    bazaarEventBridge.emit("ui:viewport-changed", {
      briefOpen,
      drawerOpen,
      leftWidth: isStacked ? 0 : briefOpen ? 296 : 60,
      rightWidth: isStacked ? 0 : drawerOpen ? 324 : 60,
    });
  }, [briefOpen, drawerOpen]);

  const rail = useMemo(
    () => deriveQuestRail(liveStatus, displayWalletIdentity),
    [displayWalletIdentity, liveStatus],
  );
  const deferredRail = useDeferredValue(rail);
  const deferredProofs = useDeferredValue(proofs);

  const activeQuest = useMemo(
    () => getActiveQuestStep(liveStatus, displayWalletIdentity),
    [displayWalletIdentity, liveStatus],
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
    const offSkillAltar = bazaarEventBridge.on("skill:altar-open", ({ mapId }) => {
      startTransition(() => {
        setSkillHudMapId(mapId);
      });
    });
    const offProofPicked = bazaarEventBridge.on("proof:scroll-picked", ({ proof }) => {
      startTransition(() => {
        setProofOverlay(proof);
        setDrawerOpen(true);
        setDrawerTab("proof");
      });
    });

    return () => {
      offNpc();
      offDistrict();
      offSkillAltar();
      offProofPicked();
    };
  }, []);

  const currentDistrict = useMemo(() => {
    if (selectedDistrictId) {
      return districtDefinitions.find((district) => district.id === selectedDistrictId) ?? null;
    }

    const building = buildingDefinitions.find((candidate) => candidate.portalMapId === currentMapId);
    return districtDefinitions.find((district) => district.id === building?.districtId) ?? null;
  }, [currentMapId, selectedDistrictId]);

  const districtRoster = useMemo(() => {
    if (!currentDistrict) {
      return [];
    }

    return currentDistrict.npcRoster
      .map((npcId) => npcLookup.get(npcId))
      .filter((npc): npc is NonNullable<typeof npc> => Boolean(npc));
  }, [currentDistrict]);

  const interactionView = useMemo(() => {
    if (!selection) {
      return null;
    }

    const npc = selection.npcId ? npcDefinitions.find((entry) => entry.id === selection.npcId) : null;
    const building = buildingDefinitions.find((entry) => entry.id === selection.interactionId);
    const isObjective = activeQuest?.targetId === selection.interactionId;

    const baseLines = npc
      ? dialogueEntries[npc.dialogueId]?.[0]?.lines ?? []
      : building
        ? [building.description]
        : [];
    const objectiveLines = isObjective
      ? [activeQuest?.requiredInteraction, activeQuest?.worldStateChange, activeQuest?.rewardOutput].filter(
          (value): value is string => Boolean(value),
        )
      : [];
    const lines = [...baseLines, ...objectiveLines].slice(0, 4);

    return {
      title: npc?.name ?? building?.name ?? humanize(selection.interactionId),
      subtitle:
        npc?.economyRole ??
        building?.description ??
        "Village interaction",
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

  const addressLabel = shortAddress(displayAddress);
  const balanceLabel = displayWalletIdentity.connected
    ? displayBalance
      ? `${Number(displayBalance.formatted).toFixed(4)} ${displayBalance.symbol}`
      : "Syncing"
    : "Not connected";
  const chainLabel = displayChainName ?? "Wallet offline";
  const isStatusSyncing = hasMounted && statusQuery.isFetching;
  const runtimeLabel = isStatusSyncing
    ? "syncing"
    : liveStatus?.liveDashboard.runtime?.status ?? "ready";
  const taxLabel = `${(
    ((liveStatus?.liveDashboard.bazaarSnapshot?.rules?.[0] as number | undefined) ?? 500) / 100
  ).toFixed(2)}%`;
  const treasuryLabel = `${Number(
    liveStatus?.liveDashboard.bazaarSnapshot?.treasuryBalanceOkb ?? 0,
  ).toFixed(3)} OKB`;
  const worldPhase = resolveWorldPhase(world);

  const liveError =
    (statusQuery.error instanceof Error ? statusQuery.error.message : null) ??
    (actionMutation.error instanceof Error ? actionMutation.error.message : null) ??
    pendingAction?.errorMessage ??
    null;

  const worldAlert = liveError
    ? liveError
    : !displayWalletIdentity.connected
      ? "Connect a wallet to wake the village. Wallet remains the only login."
      : !displayWalletIdentity.validNetwork
        ? "Switch onto X Layer before trying live economy actions."
        : activeQuest
          ? `${activeQuest.objectiveText} The district will visibly react when the proof lands.`
          : "Walk the brighter roads, inspect a landmark, and keep the quest rail moving.";

  const lastUpdatedLabel = formatTimeLabel(
    liveStatus?.liveDashboard.runtime?.lastUpdatedAt ?? statusQuery.dataUpdatedAt,
    hasMounted,
  );
  const recentSteps = useMemo(
    () => [...(liveStatus?.liveDashboard.runtime?.steps ?? [])].slice(-4).reverse(),
    [liveStatus],
  );
  const latestProof = deferredProofs[0] ?? null;
  const stageLabel = currentDistrict?.name ?? mapLabels[currentMapId];
  const startupVisible = !hasMounted || !phaserReady || sceneId === "boot" || sceneId === "preload";
  const startupKicker = stageLoadError
    ? "Startup fault"
    : !hasMounted
      ? "Render sync"
      : !phaserReady
        ? "Engine boot"
        : sceneId === "preload"
          ? "Asset preload"
          : "Village gate";
  const startupTitle = stageLoadError
    ? "Bazaar X could not finish booting"
    : !hasMounted
      ? "Stabilizing the first render"
      : !phaserReady
        ? "Starting the Phaser runtime"
        : sceneId === "preload"
          ? "Loading districts, sprites, and route data"
          : "Opening the village gates";
  const startupCopy = stageLoadError
    ? stageLoadError
    : !hasMounted
      ? "Holding the first paint steady so the server and browser agree before the village wakes."
      : !phaserReady
        ? "Mounting the playfield, wiring scene transitions, and preparing the live shell."
        : sceneId === "preload"
          ? "Streaming the map manifest, generated textures, and economy systems into the playfield."
          : "Final route checks are running before control hands back to the village shell.";
  const startupProgress = stageLoadError
    ? 100
    : !hasMounted
      ? 18
      : !phaserReady
        ? 42
        : sceneId === "boot"
          ? 58
          : sceneId === "preload"
            ? 84
            : 100;
  const startupStatusLabel = stageLoadError
    ? "Boot failed"
    : !hasMounted
      ? "Syncing first frame"
      : !phaserReady
        ? "Starting renderer"
        : sceneId === "boot"
          ? "Preparing scene graph"
          : sceneId === "preload"
            ? "Loading maps and sprites"
            : "Village ready";

  const focusActive = focusModeEnabled;
  const onboardingVisible =
    !hydrated || !displayWalletIdentity.connected || !displayWalletIdentity.validNetwork || !hasEnteredVillage;
  const canEnterVillage = hydrated && displayWalletIdentity.connected && displayWalletIdentity.validNetwork;
  const activeLaborCount = useMemo(
    () => Object.values(laborRouting.npcStates).filter((snapshot) => snapshot.status === "walking").length,
    [laborRouting.npcStates],
  );

  useEffect(() => {
    bazaarEventBridge.emit("camera:focus-mode", {
      active: focusActive,
    });
  }, [focusActive]);

  async function handleQuestAction(actionId: QuestActionId) {
    bazaarAudioSystem.play("ui-confirm");
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

  function toggleBrief() {
    bazaarAudioSystem.play("ui-confirm");
    setFocusModeEnabled(false);
    setBriefOpen((current) => !current);
  }

  function toggleDrawer(tab: DrawerTab = drawerTab) {
    bazaarAudioSystem.play("ui-confirm");
    setFocusModeEnabled(false);
    setDrawerOpen((current) => (tab === drawerTab ? !current : true));
    setDrawerTab(tab);
  }

  function openDrawer(tab: DrawerTab) {
    bazaarAudioSystem.play("ui-confirm");
    setFocusModeEnabled(false);
    setDrawerOpen(true);
    setDrawerTab(tab);
  }

  function toggleFocusMode() {
    bazaarAudioSystem.play("ui-confirm");
    if (focusActive) {
      setFocusModeEnabled(false);
      setBriefOpen(true);
      setDrawerOpen(true);
      return;
    }

    setFocusModeEnabled(true);
    setBriefOpen(false);
    setDrawerOpen(false);
  }

  function toggleMuted() {
    bazaarGameStore.getState().setSettings({
      muted: !bazaarGameStore.getState().settings.muted,
    });
    bazaarAudioSystem.play("ui-confirm");
  }

  function toggleLowEffects() {
    bazaarGameStore.getState().setSettings({
      lowEffects: !bazaarGameStore.getState().settings.lowEffects,
    });
    bazaarAudioSystem.play("ui-confirm");
  }

  function handleGuideToTarget(targetId: string) {
    const target = interactionNavigation[targetId];
    if (!target) {
      return;
    }

    bazaarAudioSystem.play("ui-confirm");
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
  }

  function handleGuideToDistrict(districtId: DistrictId) {
    const targetId = districtInteractionMap[districtId];
    if (!targetId) {
      return;
    }
    handleGuideToTarget(targetId);
  }

  function handleEnterInterior(mapId: MapId) {
    bazaarAudioSystem.play("door-open");
    bazaarEventBridge.emit("scene:enter", {
      mapId,
      spawnId: interiorEntrySpawns[mapId],
    });
  }

  function handleEnterVillage() {
    const fallbackName = resolveDefaultPlayerName(walletIdentity.address);
    bazaarGameStore.getState().setPlayerName(clampPlayerName(playerNameDraft, fallbackName));
    bazaarAudioSystem.play("ui-confirm");
    setHasEnteredVillage(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(sessionKey, "1");
    }
  }

  function handleSavePlayerName() {
    const fallbackName = resolveDefaultPlayerName(walletIdentity.address);
    bazaarGameStore.getState().setPlayerName(clampPlayerName(playerNameDraft, fallbackName));
    bazaarAudioSystem.play("ui-confirm");
  }

  function handleCloseSkillHud() {
    if (!skillHudMapId) {
      return;
    }

    bazaarAudioSystem.play("ui-confirm");
    bazaarEventBridge.emit("skill:altar-close", {
      mapId: skillHudMapId,
    });
    setSkillHudMapId(null);
  }

  async function handleUnlockSkill(skillId: string) {
    setUnlockPendingSkillId(skillId);

    try {
      const receipt = await unlockSkill(skillId);
      const nextUnlocked = Array.from(new Set([...unlockedSkillIds, skillId]));
      bazaarGameStore.getState().setSkillLoadout({
        unlockedSkillIds: nextUnlocked,
        activeSkillId: activeSkillId ?? skillId,
      });
      if (!activeSkillId) {
        bazaarEventBridge.emit("skill:activated", {
          skillId,
        });
      }
      bazaarEventBridge.emit("camera:flash", {
        duration: 500,
        red: 168,
        green: 244,
        blue: 255,
      });
      bazaarEventBridge.emit("skill:unlock-success", {
        skillId,
      });
      bazaarEventBridge.emit("toast:show", {
        id: `skill:unlock:${skillId}`,
        title: "Skill Unlocked",
        body: `${receipt.amountOkb} OKB settled through ${receipt.protocol}.`,
        tone: "success",
      });
      bazaarAudioSystem.play("success-chime");
    } catch (error) {
      bazaarEventBridge.emit("toast:show", {
        id: `skill:unlock:error:${skillId}`,
        title: "Unlock Failed",
        body: error instanceof Error ? error.message : "Unable to unlock the skill.",
        tone: "skill",
      });
    } finally {
      setUnlockPendingSkillId(null);
    }
  }

  function handleSlotSkill(skillId: string) {
    bazaarAudioSystem.play("ui-confirm");
    bazaarGameStore.getState().setSkillLoadout({
      activeSkillId: skillId,
    });
    bazaarEventBridge.emit("skill:activated", {
      skillId,
    });
    bazaarEventBridge.emit("toast:show", {
      id: `skill:slot:${skillId}`,
      title: "Aura Rebound",
      body: `${skillCatalog.find((skill) => skill.skill_id === skillId)?.identity.name ?? "Skill"} is now active.`,
      tone: "skill",
    });
  }

  async function handleDelegateTrade(skillId: string) {
    setDelegatePendingSkillId(skillId);

    try {
      const payload = await delegateTradeSkill(skillId);
      bazaarEventBridge.emit("skill:delegate-trade", payload);
      bazaarEventBridge.emit("toast:show", {
        id: `skill:delegate:${skillId}`,
        title: "Trade Delegated",
        body: `${payload.delegatedAction} routed through ${payload.protocol} to ${humanize(payload.agentNpcId)}.`,
        tone: "skill",
      });
      setDrawerOpen(true);
      setDrawerTab("live");
    } catch (error) {
      bazaarEventBridge.emit("toast:show", {
        id: `skill:delegate:error:${skillId}`,
        title: "Delegation Failed",
        body: error instanceof Error ? error.message : "Unable to route the delegated trade.",
        tone: "skill",
      });
    } finally {
      setDelegatePendingSkillId(null);
    }
  }

  const sidebarStyle = useMemo(
    () => ({
      ["--left-width" as string]: briefOpen ? "18.5rem" : "3.75rem",
      ["--right-width" as string]: drawerOpen ? "20.25rem" : "3.75rem",
      ["--hud-village-health" as string]: String(liveStatus?.monitor?.villageHealth ?? 0.72),
      ["--hud-village-opacity" as string]: String(liveStatus?.hud?.opacity ?? liveStatus?.monitor?.hudOpacity ?? 0.94),
      ["--hud-village-glow" as string]: String(liveStatus?.hud?.glow ?? liveStatus?.monitor?.hudGlow ?? 0.18),
      ["--hud-village-pulse-ms" as string]: `${liveStatus?.hud?.pulseMs ?? liveStatus?.monitor?.pulseMs ?? 6400}ms`,
    }),
    [
      briefOpen,
      drawerOpen,
      liveStatus?.hud?.glow,
      liveStatus?.hud?.opacity,
      liveStatus?.hud?.pulseMs,
      liveStatus?.monitor?.hudGlow,
      liveStatus?.monitor?.hudOpacity,
      liveStatus?.monitor?.pulseMs,
      liveStatus?.monitor?.villageHealth,
    ],
  );

  return (
    <main className="game-shell game-shell-detailed">
      <div className="shell-grid" style={sidebarStyle}>
        <aside className={`shell-sidebar shell-sidebar-left ${briefOpen ? "is-open" : "is-closed"}`}>
          <div className="shell-sidebar-rail">
            <button type="button" onClick={toggleBrief} className="shell-rail-button" aria-label="Toggle brief sidebar">
              {briefOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            {!briefOpen ? (
              <>
                <button type="button" onClick={() => setBriefOpen(true)} className="shell-rail-button">
                  <BookOpen className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => handleGuideToQuest()} className="shell-rail-button">
                  <LocateFixed className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => openDrawer("live")} className="shell-rail-button">
                  <Landmark className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>

          {briefOpen ? (
            <div className="shell-scroll">
              <div className="shell-sidebar-header">
                <div>
                  <div className="shell-kicker">Village Brief</div>
                  <h1 className="shell-hero-title">{activeQuest?.title ?? "Wake Bazaar X"}</h1>
                </div>
                <button type="button" onClick={() => openDrawer("quests")} className="shell-primary-chip">
                  <BookOpen className="h-4 w-4" />
                  <span>Quest Rail</span>
                </button>
              </div>

              <p className="shell-copy">
                {activeQuest?.objectiveText ??
                  "Enter the village, route the next live action, and watch the settlement react to the proof."}
              </p>

              <div className="shell-badge-row">
                <span className="shell-phase-badge">{worldPhase}</span>
                <span className="shell-phase-badge shell-phase-badge-muted">{playerName}</span>
              </div>

              <div className="shell-grid-two">
                <ShellCard kicker="Current District" title={currentDistrict?.name ?? stageLabel}>
                  <p className="shell-mini-copy">{currentDistrict?.subtitle ?? mapLabels[currentMapId]}</p>
                  <p className="shell-mini-copy shell-muted-copy">
                    {currentDistrict?.theme ?? "Cold stone, lanterns, and clean route lines define the current area."}
                  </p>
                </ShellCard>

                <ShellCard kicker="Campaign" title={`${questProgress}%`}>
                  <div className="shell-progress-meta">
                    <span>{completedSteps}/{goldenPathQuest.steps.length} steps</span>
                  </div>
                  <div className="shell-progress-bar">
                    <div className="shell-progress-fill" style={{ width: `${questProgress}%` }} />
                  </div>
                  <p className="shell-mini-copy shell-muted-copy">
                    Runtime {runtimeLabel} • Treasury {treasuryLabel}
                  </p>
                </ShellCard>
              </div>

              <ShellCard kicker="Current Roster" title={districtRoster.length ? "Humans + Agents" : "Syncing"} accent="violet">
                <div className="shell-roster-list">
                  {districtRoster.length ? (
                    districtRoster.map((npc) => (
                      <div key={npc.id} className="shell-roster-row">
                        <span>{npc.name}</span>
                        <span className={`shell-entity-pill shell-entity-pill-${npc.entityType}`}>
                          {npc.entityType}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="shell-roster-row shell-muted-copy">Waiting for district roster.</div>
                  )}
                </div>
              </ShellCard>

              <ShellCard kicker="Live Town Feed" title="World Response" accent="green">
                <p className="shell-mini-copy">{worldAlert}</p>
                <div className="shell-feed-list">
                  {recentSteps.length ? (
                    recentSteps.map((step) => (
                      <div key={`${step.key}:${step.startedAt}`} className="shell-feed-row">
                        <span>{step.label}</span>
                        <span>{step.status}</span>
                      </div>
                    ))
                  ) : (
                    <div className="shell-feed-row shell-muted-copy">No live chain activity yet.</div>
                  )}
                </div>
              </ShellCard>

              <div className="shell-action-stack">
                <button type="button" onClick={() => handleGuideToQuest()} className="shell-action-button shell-action-button-primary">
                  <LocateFixed className="h-4 w-4" />
                  <span>Guide Me There</span>
                </button>
                <button type="button" onClick={() => openDrawer("live")} className="shell-action-button">
                  <Landmark className="h-4 w-4" />
                  <span>Open Tracker</span>
                </button>
                <button type="button" onClick={() => openDrawer("proof")} className="shell-action-button">
                  <ScrollText className="h-4 w-4" />
                  <span>Recent Proof</span>
                </button>
              </div>

              {latestProof ? (
                <ShellCard kicker="Latest Proof" title={latestProof.title} accent="warm">
                  <p className="shell-mini-copy">{latestProof.body}</p>
                  <div className="shell-proof-meta">
                    <span>{latestProof.label}</span>
                    <span>{formatTimeLabel(latestProof.createdAt, hasMounted)}</span>
                  </div>
                </ShellCard>
              ) : null}
            </div>
          ) : null}
        </aside>

        <section className="shell-stage-column">
          <header className="shell-stage-topbar">
            <div className="shell-stage-status">
              <div className="shell-stage-pill">
                <MapPinned className="h-4 w-4" />
                <span>{stageLabel}</span>
              </div>
              <div className="shell-stage-pill">
                <Compass className="h-4 w-4" />
                <span>GDP {world.gdpScore.toFixed(1)}</span>
              </div>
              <div className="shell-stage-pill">
                <Radio className="h-4 w-4" />
                <span>{deferredProofs.length} {deferredProofs.length === 1 ? "proof" : "proofs"}</span>
              </div>
            </div>
            <div className="shell-stage-actions">
              <button type="button" onClick={() => openDrawer("quests")} className="shell-stage-pill shell-stage-pill-action">
                <BookOpen className="h-4 w-4" />
                <span>Quests</span>
              </button>
              <button type="button" onClick={toggleFocusMode} className={`shell-stage-pill shell-stage-pill-action ${focusActive ? "is-active" : ""}`}>
                {focusActive ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                <span>{focusActive ? "Open UI" : "Focus"}</span>
              </button>
            </div>
          </header>

          <div className={`shell-control-hints ${focusActive ? "is-hidden" : ""}`}>
            <span>Move with WASD or click. Press E near doors and villagers.</span>
          </div>

          <div 
            className="shell-stage-wrap" 
            onClick={() => {
              if (drawerOpen) setDrawerOpen(false);
            }}
          >
            <div className={`game-stage world-vignette shell-stage-surface relative overflow-hidden rounded-none ${focusActive ? "is-focus" : ""}`}>
              <PhaserGameClient
                onReady={() => {
                  setStageLoadError(null);
                  setPhaserReady(true);
                }}
                onError={(error) => {
                  setPhaserReady(false);
                  setStageLoadError(error.message);
                }}
              />
            </div>
          </div>
        </section>

        <aside className={`shell-sidebar shell-sidebar-right ${drawerOpen ? "is-open" : "is-closed"}`}>
          <div className="shell-sidebar-rail shell-sidebar-rail-right">
            <button type="button" onClick={() => toggleDrawer("quests")} className="shell-rail-button" aria-label="Toggle drawer">
              {drawerOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            {!drawerOpen ? (
              <>
                <button type="button" onClick={() => openDrawer("proof")} className="shell-rail-button">
                  <ScrollText className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => openDrawer("wallet")} className="shell-rail-button">
                  <Wallet className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => openDrawer("live")} className="shell-rail-button">
                  <Landmark className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>

          <div className="shell-scroll">
            <div className="shell-sidebar-header shell-sidebar-header-right">
              <div>
                <div className="shell-kicker">Control Rail</div>
                <h2 className="shell-sidebar-title">Bazaar X Drawer</h2>
              </div>
              <button type="button" onClick={() => setDrawerOpen((current) => !current)} className="shell-primary-chip shell-primary-chip-muted">
                {drawerOpen ? "Collapse" : "Open"}
              </button>
            </div>

            <div className="shell-summary-grid">
              <div className="shell-summary-card">
                <span>Wallet</span>
                <strong>{addressLabel}</strong>
              </div>
              <div className="shell-summary-card">
                <span>Network</span>
                <strong>{chainLabel}</strong>
              </div>
              <div className="shell-summary-card">
                <span>Balance</span>
                <strong>{balanceLabel}</strong>
              </div>
              <div className="shell-summary-card">
                <span>Treasury</span>
                <strong>{treasuryLabel}</strong>
              </div>
            </div>

            <div className="shell-tabs">
              {drawerTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => openDrawer(tab.id)}
                  className={`shell-tab ${drawerTab === tab.id ? "is-active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <ShellCard kicker="Active Objective" title={activeQuest?.title ?? "Wake Bazaar X"} accent="cyan">
              <p className="shell-mini-copy">{activeQuest?.objectiveText ?? "Follow the next highlighted landmark."}</p>
              <button type="button" onClick={() => handleGuideToQuest()} className="shell-inline-link">
                <Compass className="h-4 w-4" />
                <span>Guide to target</span>
              </button>
            </ShellCard>

            {drawerTab === "quests" ? (
              <div className="shell-section-stack">
                {deferredRail.map((step) => (
                  <article key={step.id} className={`shell-quest-card shell-quest-card-${step.state}`}>
                    <div className="shell-quest-head">
                      <div>
                        <div className="shell-kicker">{humanize(step.state)}</div>
                        <h3 className="shell-quest-title">{step.title}</h3>
                      </div>
                      <button type="button" onClick={() => handleGuideToQuest(step.id)} className="shell-inline-link">
                        <LocateFixed className="h-4 w-4" />
                        <span>Guide</span>
                      </button>
                    </div>
                    <p className="shell-mini-copy">{step.objectiveText}</p>
                    <div className="shell-detail-list">
                      <div><strong>Interaction:</strong> {step.requiredInteraction}</div>
                      <div><strong>World change:</strong> {step.worldStateChange}</div>
                      <div><strong>Proof:</strong> {step.rewardOutput}</div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {drawerTab === "proof" ? (
              <div className="shell-section-stack">
                {deferredProofs.length ? (
                  deferredProofs.map((proof) => (
                    <article key={proof.id} className="shell-proof-card">
                      <div className="shell-proof-head">
                        <div>
                          <div className="shell-kicker">{proof.kind}</div>
                          <h3 className="shell-quest-title">{proof.title}</h3>
                        </div>
                        {proof.explorerUrl ? (
                          <a href={proof.explorerUrl} target="_blank" rel="noreferrer" className="shell-inline-link">
                            <ArrowUpRight className="h-4 w-4" />
                            <span>Explorer</span>
                          </a>
                        ) : null}
                      </div>
                      <p className="shell-mini-copy">{proof.body}</p>
                      <div className="shell-detail-list">
                        <div><strong>Label:</strong> {proof.label}</div>
                        <div><strong>District:</strong> {humanize(proof.districtId)}</div>
                        <div><strong>Time:</strong> {formatTimeLabel(proof.createdAt, hasMounted)}</div>
                      </div>
                    </article>
                  ))
                ) : (
                  <ShellCard kicker="No Proof Yet" title="Ledger Empty" accent="warm">
                    <p className="shell-mini-copy">
                      Wake the roster, open the forge, and the ledger will start filling with live X Layer proof.
                    </p>
                  </ShellCard>
                )}
              </div>
            ) : null}

            {drawerTab === "districts" ? (
              <div className="shell-section-stack">
                {districtDefinitions.map((district) => {
                  const linkedInterior = district.linkedInteriors[0];
                  return (
                    <article key={district.id} className="shell-proof-card">
                      <div className="shell-proof-head">
                        <div>
                          <div className="shell-kicker">{district.subtitle}</div>
                          <h3 className="shell-quest-title">{district.name}</h3>
                        </div>
                        <MapPinned className="h-4 w-4 text-[#7df0ff]" />
                      </div>
                      <p className="shell-mini-copy">{district.theme}</p>
                      <div className="shell-detail-list">
                        <div><strong>Roster:</strong> {district.npcRoster.map((npcId) => npcLookup.get(npcId)?.name ?? humanize(npcId)).join(" • ")}</div>
                        <div><strong>Landmarks:</strong> {district.landmarkSet.join(" • ")}</div>
                      </div>
                      <div className="shell-inline-actions">
                        <button type="button" onClick={() => handleGuideToDistrict(district.id)} className="shell-inline-link">
                          <LocateFixed className="h-4 w-4" />
                          <span>Guide</span>
                        </button>
                        {linkedInterior ? (
                          <button type="button" onClick={() => handleEnterInterior(linkedInterior)} className="shell-inline-link">
                            <ChevronRight className="h-4 w-4" />
                            <span>Enter {mapLabels[linkedInterior]}</span>
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {drawerTab === "live" ? (
              <div className="shell-section-stack">
                <div className="shell-terminal-grid">
                  <div className="shell-terminal-card"><span>Status</span><strong>{runtimeLabel}</strong></div>
                  <div className="shell-terminal-card"><span>Updated</span><strong>{lastUpdatedLabel}</strong></div>
                  <div className="shell-terminal-card"><span>GDP Tier</span><strong>L{world.worldTier}</strong></div>
                  <div className="shell-terminal-card"><span>Block</span><strong>{world.blockHeight || "Syncing"}</strong></div>
                  <div className="shell-terminal-card"><span>Tax</span><strong>{taxLabel}</strong></div>
                  <div className="shell-terminal-card"><span>Treasury</span><strong>{treasuryLabel}</strong></div>
                  <div className="shell-terminal-card"><span>Village</span><strong>{liveStatus?.monitor?.healthLabel ?? "steady"}</strong></div>
                  <div className="shell-terminal-card"><span>Routing</span><strong>{activeLaborCount}</strong></div>
                </div>

                <ShellCard kicker="Runtime Note" title="World Tracker" accent="green">
                  <p className="shell-mini-copy">
                    {liveError ?? (pendingAction ? `${pendingAction.label} is ${pendingAction.status}.` : "The tracker stays live while X Layer settles the current economy loop.")}
                  </p>
                </ShellCard>

                {liveStatus?.monitor ? (
                  <ShellCard kicker="Monitor" title={`${Math.round(liveStatus.monitor.villageHealth * 100)}% Village Health`} accent="violet">
                    <p className="shell-mini-copy">{liveStatus.monitor.note}</p>
                    <div className="shell-detail-list">
                      <div><strong>Dispatcher heartbeat:</strong> {liveStatus.monitor.dispatcherHeartbeatMs}ms</div>
                      <div><strong>RPC throttle:</strong> {liveStatus.monitor.rpcThrottleMs}ms cache window</div>
                      <div><strong>Last fetch:</strong> {liveStatus.monitor.lastFetchMs}ms</div>
                    </div>
                  </ShellCard>
                ) : null}

                {recentSteps.length ? (
                  recentSteps.map((step) => (
                    <article key={`${step.key}:${step.startedAt}`} className="shell-terminal-entry">
                      <div className="shell-proof-head">
                        <div>
                          <div className="shell-kicker">{step.status}</div>
                          <h3 className="shell-quest-title">{step.label}</h3>
                        </div>
                        {step.explorerUrl ? (
                          <a href={step.explorerUrl} target="_blank" rel="noreferrer" className="shell-inline-link">
                            <ArrowUpRight className="h-4 w-4" />
                            <span>Explorer</span>
                          </a>
                        ) : null}
                      </div>
                      <p className="shell-mini-copy">{step.detail ?? "Runtime step synced from the live execution loop."}</p>
                    </article>
                  ))
                ) : (
                  <ShellCard kicker="No Live Steps" title="Awaiting activity" accent="green">
                    <p className="shell-mini-copy">The first confirmed transaction will appear here with its proof summary.</p>
                  </ShellCard>
                )}
              </div>
            ) : null}

            {drawerTab === "wallet" ? (
              <div className="shell-section-stack">
                <ShellCard kicker="Your Agent" title={playerName} accent="violet">
                  <p className="shell-mini-copy">
                    Name your agent without creating any separate account. The callsign stays tied to the connected wallet.
                  </p>
                  <div className="shell-name-editor">
                    <input
                      value={playerNameDraft}
                      onChange={(event) => setPlayerNameDraft(event.target.value)}
                      placeholder={resolveDefaultPlayerName(displayWalletIdentity.address)}
                      className="shell-name-input"
                      maxLength={24}
                    />
                    <button type="button" onClick={handleSavePlayerName} className="shell-inline-link">
                      <Sparkles className="h-4 w-4" />
                      <span>Save</span>
                    </button>
                  </div>
                </ShellCard>

                <ShellCard kicker="Wallet Only Login" title={addressLabel} accent="warm">
                  <p className="shell-mini-copy">
                    Player progression, proof recovery, and unlocked locations are all keyed to the connected X Layer wallet.
                  </p>
                </ShellCard>

                <ConnectWalletButton variant="pixel" fullWidth />

                {displayWalletIdentity.connected && !displayWalletIdentity.validNetwork ? (
                  <button
                    type="button"
                    disabled={isSwitching}
                    onClick={() => switchChain?.({ chainId: defaultXLayerChain.id })}
                    className="shell-action-button shell-action-button-primary"
                  >
                    <Wallet className="h-4 w-4" />
                    <span>{isSwitching ? "Switching..." : "Switch To X Layer"}</span>
                  </button>
                ) : null}

                <div className="shell-inline-actions">
                  <button type="button" onClick={() => void statusQuery.refetch()} disabled={isStatusSyncing} className="shell-inline-link">
                    <RefreshCw className="h-4 w-4" />
                    <span>{isStatusSyncing ? "Refreshing..." : "Refresh State"}</span>
                  </button>
                  <button type="button" onClick={toggleMuted} className="shell-inline-link">
                    {settings.muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    <span>{settings.muted ? "Unmute" : "Mute"}</span>
                  </button>
                  <button type="button" onClick={toggleLowEffects} className="shell-inline-link">
                    <Sparkles className="h-4 w-4" />
                    <span>{settings.lowEffects ? "Full FX" : "Low FX"}</span>
                  </button>
                  <button type="button" onClick={toggleFocusMode} className="shell-inline-link">
                    {focusActive ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                    <span>{focusActive ? "Open UI" : "Focus Mode"}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {interactionView ? (
        <InteractionSheet
          title={interactionView.title}
          subtitle={interactionView.subtitle}
          lines={interactionView.lines}
          objectiveLabel={interactionView.objectiveLabel}
          actionLabel={interactionView.actionLabel}
          actionDisabled={
            Boolean(!interactionView.actionId || actionMutation.isPending || !displayWalletIdentity.validNetwork)
          }
          actionPending={actionMutation.isPending}
          disabledReason={
            !displayWalletIdentity.connected
              ? "Connect your wallet before committing the next live quest action."
              : !displayWalletIdentity.validNetwork
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

      {skillHudMapId ? (
        <SkillGrimoire
          skills={skillCatalog.length ? skillCatalog : aiSkillCatalog}
          unlockedSkillIds={unlockedSkillIds}
          activeSkillId={activeSkillId}
          unlockPendingSkillId={unlockPendingSkillId}
          delegatePendingSkillId={delegatePendingSkillId}
          onUnlock={handleUnlockSkill}
          onSlot={handleSlotSkill}
          onDelegateTrade={handleDelegateTrade}
          onClose={handleCloseSkillHud}
        />
      ) : null}

      {proofOverlay ? (
        <ProofRealityOverlay
          proof={proofOverlay}
          onClose={() => setProofOverlay(null)}
        />
      ) : null}

      {startupVisible ? (
        <div className="shell-startup-overlay">
          <div className="pixel-window-dark shell-startup-panel fade-in">
            <div className="shell-startup-header">
              <div>
                <div className="shell-kicker">{startupKicker}</div>
                <h2 className="shell-startup-title">
                  Bazaar<span>X</span>
                </h2>
              </div>
              <div className="shell-startup-chip">{startupProgress}%</div>
            </div>

            <div className="shell-startup-console">
              <div className="shell-startup-row">
                <span>status</span>
                <strong>{startupStatusLabel}</strong>
              </div>
              <div className="shell-startup-row">
                <span>scene</span>
                <strong>{sceneId}</strong>
              </div>
              <div className="shell-startup-row">
                <span>wallet gate</span>
                <strong>{displayWalletIdentity.connected ? "linked" : "awaiting wallet"}</strong>
              </div>
            </div>

            <p className="shell-copy shell-startup-copy">{startupTitle}</p>
            <p className="shell-mini-copy shell-muted-copy">{startupCopy}</p>

            <div className="shell-startup-meter" aria-hidden="true">
              <div className="shell-startup-meter-fill" style={{ width: `${startupProgress}%` }} />
            </div>

            <div className="shell-startup-grid">
              <div className={`shell-startup-step ${hasMounted ? "is-done" : "is-active"}`}>
                <span>1</span>
                <strong>Lock render</strong>
                <small>SSR handoff</small>
              </div>
              <div className={`shell-startup-step ${phaserReady ? "is-done" : hasMounted ? "is-active" : ""}`}>
                <span>2</span>
                <strong>Boot engine</strong>
                <small>canvas online</small>
              </div>
              <div className={`shell-startup-step ${sceneId === "overworld" || sceneId === "interior" ? "is-done" : phaserReady ? "is-active" : ""}`}>
                <span>3</span>
                <strong>Open village</strong>
                <small>map ready</small>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {onboardingVisible ? (
        <div className="absolute inset-0 z-50 overflow-y-auto bg-[rgba(8,10,14,0.74)] px-3 backdrop-blur-md">
          <div className="fade-in flex min-h-full w-full items-start justify-center py-4 sm:items-center sm:py-6">
            <div className="shell-onboarding max-h-[calc(100svh-2rem)] w-full max-w-[900px] overflow-y-auto rounded-[28px] p-6 sm:max-h-[calc(100svh-3rem)] sm:p-8">
              <div className="shell-kicker">X Layer World Economy</div>
              <h2 className="shell-onboarding-title">
                Bazaar<span>X</span>
              </h2>
              <p className="shell-copy shell-onboarding-copy">
                Connect your wallet, validate X Layer, choose an agent callsign, then enter a larger living village where work, tax, treasury, and governance all settle onchain.
              </p>

              <div className="shell-onboarding-grid">
                <ShellCard kicker={displayWalletIdentity.connected ? "Wallet linked" : "Step 1"} title={displayWalletIdentity.connected ? addressLabel : "Connect wallet"}>
                  <p className="shell-mini-copy">
                    {displayWalletIdentity.connected
                      ? "Your game identity is keyed directly to the connected wallet."
                      : "Bazaar X does not use email or separate auth. A wallet is the only login."}
                  </p>
                </ShellCard>
                <ShellCard kicker={displayWalletIdentity.validNetwork ? "X Layer ready" : "Step 2"} title={displayWalletIdentity.validNetwork ? chainLabel : "Validate network"} accent="warm">
                  <p className="shell-mini-copy">
                    {displayWalletIdentity.validNetwork
                      ? "The village is synced to a live X Layer network and ready for real contract calls."
                      : "Switch to X Layer so the game can trigger live economy actions."}
                  </p>
                </ShellCard>
                <ShellCard kicker="Step 3" title="Name your agent" accent="violet">
                  <div className="shell-name-editor">
                    <input
                      value={playerNameDraft}
                      onChange={(event) => setPlayerNameDraft(event.target.value)}
                      placeholder={resolveDefaultPlayerName(displayWalletIdentity.address)}
                      className="shell-name-input"
                      maxLength={24}
                    />
                  </div>
                  <p className="shell-mini-copy shell-muted-copy">
                    This stays cosmetic and wallet-linked. No extra account is created.
                  </p>
                </ShellCard>
              </div>

              <div className="shell-onboarding-actions">
                {!displayWalletIdentity.connected ? <ConnectWalletButton variant="pixel" fullWidth /> : null}

                {displayWalletIdentity.connected && !displayWalletIdentity.validNetwork ? (
                  <button
                    type="button"
                    disabled={isSwitching}
                    onClick={() => switchChain?.({ chainId: defaultXLayerChain.id })}
                    className="shell-action-button shell-action-button-primary"
                  >
                    <Wallet className="h-4 w-4" />
                    <span>{isSwitching ? "Switching..." : "Switch To X Layer"}</span>
                  </button>
                ) : null}

                {canEnterVillage ? (
                  <button
                    type="button"
                    onClick={handleEnterVillage}
                    className="shell-action-button shell-action-button-primary"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Play Game</span>
                  </button>
                ) : null}
              </div>

              <div className="shell-onboarding-grid shell-onboarding-grid-secondary">
                <ShellCard kicker="Controls" title="Move + inspect" accent="green">
                  <p className="shell-mini-copy">
                    Move through the village, walk into labelled portals to enter interiors, and inspect NPCs or buildings when the prompt lights up.
                  </p>
                </ShellCard>
                <ShellCard kicker="Cleaner Layout" title="Sidebars stay off the stage" accent="cyan">
                  <p className="shell-mini-copy">
                    Briefing, proof, tracker, and wallet tools now live beside the playfield so the character never hides behind the UI.
                  </p>
                </ShellCard>
              </div>

              <div className="shell-onboarding-footer">
                <div className={`shell-ready-indicator ${canEnterVillage ? "is-ready" : ""}`} />
                <span>
                  {canEnterVillage
                    ? "Ready to enter"
                    : "Wallet connection and X Layer validation required"}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
