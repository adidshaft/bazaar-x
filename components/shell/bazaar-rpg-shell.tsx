"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Compass,
  LocateFixed,
  MapPinned,
  Radio,
  RefreshCw,
  ScrollText,
  Sparkles,
  Volume2,
  VolumeX,
  Wallet,
  X,
  Zap,
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

type DrawerTab = "quests" | "proof" | "districts" | "ops";

type InteractionSelection = {
  interactionId: string;
  npcId?: string;
};

const drawerTabs: Array<{ id: DrawerTab; label: string; icon?: React.ReactNode }> = [
  { id: "quests",    label: "Quests" },
  { id: "proof",     label: "Proof" },
  { id: "districts", label: "Districts" },
  { id: "ops",       label: "Ops" },
];

const mapLabels: Record<MapId, string> = {
  "village-exterior": "Bazaar Village",
  "forge-interior":   "Bazaar Forge",
  "depot-interior":   "Supply Depot",
  "treasury-interior":"Treasury Vault",
  "council-interior": "Covenant Hall",
};

const interactionNavigation: Record<string, { mapId: MapId; x: number; y: number; spawnId?: string }> = {
  "keeper-gate":     { mapId: "village-exterior", x: 800,  y: 352,  spawnId: "gate-spawn"       },
  "settlement-keep": { mapId: "village-exterior", x: 960,  y: 304,  spawnId: "gate-spawn"       },
  "forge-door":      { mapId: "village-exterior", x: 384,  y: 560,  spawnId: "forge-return"     },
  "depot-door":      { mapId: "village-exterior", x: 1536, y: 560,  spawnId: "depot-return"     },
  "guild-yard":      { mapId: "village-exterior", x: 1536, y: 1040, spawnId: "depot-return"     },
  "treasury-door":   { mapId: "village-exterior", x: 384,  y: 1136, spawnId: "treasury-return"  },
  "council-door":    { mapId: "village-exterior", x: 992,  y: 1136, spawnId: "council-return"   },
  "forge-board":     { mapId: "forge-interior",   x: 416,  y: 224,  spawnId: "forge-entry"      },
  "supplier-desk":   { mapId: "depot-interior",   x: 416,  y: 224,  spawnId: "depot-entry"      },
  "treasury-board":  { mapId: "treasury-interior",x: 416,  y: 224,  spawnId: "treasury-entry"   },
  "governor-dais":   { mapId: "council-interior", x: 416,  y: 224,  spawnId: "council-entry"    },
};

const districtInteractionMap: Record<DistrictId, string> = {
  "village-gate":   "settlement-keep",
  "market-row":     "forge-door",
  "supplier-lane":  "depot-door",
  "worker-yard":    "guild-yard",
  "treasury-vault": "treasury-door",
  "council-hall":   "council-door",
};

const interiorEntrySpawns: Partial<Record<MapId, string>> = {
  "village-exterior":  "gate-spawn",
  "forge-interior":    "forge-entry",
  "depot-interior":    "depot-entry",
  "treasury-interior": "treasury-entry",
  "council-interior":  "council-entry",
};

const npcLookup = new Map(npcDefinitions.map((npc) => [npc.id, npc] as const));
const hydrationFallbackWalletIdentity: WalletIdentity = { connected: false, validNetwork: false };

function shortAddress(address?: string) {
  if (!address) return "Offline";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function humanize(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimeLabel(input?: string | number, ready = true) {
  if (!ready || !input) return "—";
  const date = typeof input === "number" ? new Date(input) : new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

function resolveInitialDrawerTab(initialScene?: string | null): DrawerTab {
  if (initialScene === "proof") return "proof";
  if (initialScene === "districts") return "districts";
  if (initialScene === "ops") return "ops";
  return "quests";
}

function clampPlayerName(name: string, fallback: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, 24) || fallback;
}

export function BazaarRpgShell({ initialScene }: { initialScene?: string | null }) {
  const queryClient = useQueryClient();
  const economicMonitorRef = useRef(new EconomicMonitor());
  const proofListenerRef   = useRef(new ProofListener());

  const [selection, setSelection]                   = useState<InteractionSelection | null>(null);
  const [briefOpen, setBriefOpen]                   = useState(false);
  const [drawerOpen, setDrawerOpen]                 = useState(Boolean(initialScene));
  const [drawerTab, setDrawerTab]                   = useState<DrawerTab>(resolveInitialDrawerTab(initialScene));
  const [hasEnteredVillage, setHasEnteredVillage]   = useState(Boolean(initialScene));
  const [playerNameDraft, setPlayerNameDraft]       = useState("");
  const [skillHudMapId, setSkillHudMapId]           = useState<MapId | null>(null);
  const [proofOverlay, setProofOverlay]             = useState<ProofArtifact | null>(null);
  const [unlockPendingSkillId, setUnlockPendingSkillId]   = useState<string | null>(null);
  const [delegatePendingSkillId, setDelegatePendingSkillId] = useState<string | null>(null);
  const [hasMounted, setHasMounted]                 = useState(false);
  const [phaserReady, setPhaserReady]               = useState(false);
  const [stageLoadError, setStageLoadError]         = useState<string | null>(null);

  const { address, chain, isConnected } = useAccount();
  const { data: balance } = useBalance({ address, query: { enabled: Boolean(address) } });
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const walletIdentity = useMemo(
    () => resolveWalletIdentity({ address, chainId: chain?.id, isConnected }),
    [address, chain?.id, isConnected],
  );
  const displayWalletIdentity = useMemo(
    () => (hasMounted ? walletIdentity : hydrationFallbackWalletIdentity),
    [hasMounted, walletIdentity],
  );
  const displayAddress   = hasMounted ? address : undefined;
  const displayChainName = hasMounted ? chain?.name   : undefined;
  const displayBalance   = hasMounted ? balance       : undefined;

  const sceneId          = useBazaarGameStore((s) => s.sceneId);
  const currentMapId     = useBazaarGameStore((s) => s.currentMapId);
  const objectiveTargetId= useBazaarGameStore((s) => s.objectiveTargetId);
  const pendingAction    = useBazaarGameStore((s) => s.pendingAction);
  const liveStatus       = useBazaarGameStore((s) => s.liveStatus);
  const proofs           = useBazaarGameStore((s) => s.proofs);
  const settings         = useBazaarGameStore((s) => s.settings);
  const world            = useBazaarGameStore((s) => s.world);
  const hydrated         = useBazaarGameStore((s) => s.hydrated);
  const selectedDistrictId = useBazaarGameStore((s) => s.selectedDistrictId);
  const playerName       = useBazaarGameStore((s) => s.playerName);
  const skillCatalog     = useBazaarGameStore((s) => s.skillCatalog);
  const unlockedSkillIds = useBazaarGameStore((s) => s.unlockedSkillIds);
  const activeSkillId    = useBazaarGameStore((s) => s.activeSkillId);
  const laborRouting     = useBazaarGameStore((s) => s.laborRouting);

  const statusQuery = useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn:  fetchDashboardStatus,
    staleTime: 4_000,
    refetchInterval: hasMounted && walletIdentity.connected ? 8_000 : false,
    enabled:   hasMounted && walletIdentity.connected,
  });

  const actionMutation = useMutation({
    mutationFn: async (actionId: QuestActionId) => executeQuestAction(actionId),
    onSuccess:  (payload) => {
      queryClient.setQueryData(STATUS_QUERY_KEY, payload.status);
      setDrawerOpen(true);
      setDrawerTab(payload.stepKey ? "proof" : "ops");
    },
  });

  const sessionKey = useMemo(
    () => `bazaar-x:entered:${address ?? "guest"}:${chain?.id ?? "none"}`,
    [address, chain?.id],
  );

  useEffect(() => { setHasMounted(true); }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlockAudio = () => bazaarAudioSystem.unlock();
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown",     unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown",     unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionValue = window.sessionStorage.getItem(sessionKey) === "1";
    setHasEnteredVillage(Boolean(initialScene) || sessionValue);
  }, [initialScene, sessionKey]);

  useEffect(() => { bazaarGameStore.getState().setWallet(walletIdentity); }, [walletIdentity]);

  useEffect(() => {
    bazaarGameStore.getState().setSkillCatalog(aiSkillCatalog);
    if (bazaarGameStore.getState().unlockedSkillIds.length === 0) {
      bazaarGameStore.getState().setSkillLoadout({
        unlockedSkillIds: [...defaultUnlockedSkillIds],
        activeSkillId:    defaultUnlockedSkillIds[0] ?? null,
      });
    }
  }, []);

  useEffect(() => {
    if (!walletIdentity.connected || !walletIdentity.validNetwork) {
      bazaarGameStore.getState().markHydrated();
      return;
    }
    const persisted = loadPersistedPlayerState(walletIdentity) ?? createDefaultPlayerPersistence();
    bazaarGameStore.getState().hydrateFromPersistence(persisted);
    bazaarGameStore.getState().markHydrated();
  }, [walletIdentity]);

  useEffect(() => {
    if (!walletIdentity.connected || !walletIdentity.validNetwork) return;
    if (!playerName || playerName === "Agent Echo") {
      bazaarGameStore.getState().setPlayerName(resolveDefaultPlayerName(walletIdentity.address));
    }
  }, [playerName, walletIdentity]);

  useEffect(() => { setPlayerNameDraft(playerName); }, [playerName]);

  useEffect(() => {
    if (!hydrated || !walletIdentity.connected || !walletIdentity.validNetwork) return;
    savePersistedPlayerState(walletIdentity, {
      currentMapId,
      lastSpawnId:       undefined,
      playerName,
      revealedProofIds:  proofs.map((p) => p.id),
      unlockedLocations: ["village-exterior","forge-interior","depot-interior","treasury-interior","council-interior"],
      activeQuestStepId: objectiveTargetId ?? undefined,
      unlockedSkillIds,
      activeSkillId,
      muted:            settings.muted,
      lowEffects:       settings.lowEffects,
      laborRouting,
    });
  }, [activeSkillId, currentMapId, laborRouting, objectiveTargetId, playerName, proofs, settings, unlockedSkillIds, walletIdentity]);

  useEffect(() => {
    const status        = statusQuery.data ?? null;
    const proofSnapshot = proofListenerRef.current.consume(status);
    const worldState    = deriveWorldState(status);

    bazaarGameStore.getState().setLiveStatus(status);
    bazaarGameStore.getState().setWorldState(worldState);
    bazaarGameStore.getState().pushProofs(proofSnapshot.proofs);
    bazaarGameStore.getState().setSkillCatalog(status?.aiSkills ?? aiSkillCatalog);
    bazaarEventBridge.emit("economy:sync", { status });

    const taxCollection = economicMonitorRef.current.detectTaxCollection(status);
    if (taxCollection) {
      bazaarEventBridge.emit("economy:tax-collected", taxCollection);
      bazaarEventBridge.emit("toast:show", {
        id: `tax:${taxCollection.id}`, title: "Tax Collected",
        body: `${taxCollection.amountOkb} OKB moved into treasury.`, tone: "tax",
      });
    }
    proofSnapshot.freshProofs.forEach((proof) => bazaarEventBridge.emit("proof:verified", { proof }));
  }, [statusQuery.data]);

  useEffect(() => { bazaarAudioSystem.setMuted(settings.muted); }, [settings.muted]);
  useEffect(() => { bazaarAudioSystem.setEconomyTone(world.gdpScore, world.worldTier); }, [world.gdpScore, world.worldTier]);

  useEffect(() => {
    bazaarEventBridge.emit("ui:viewport-changed", {
      briefOpen, drawerOpen,
      leftWidth: briefOpen ? 320 : 0, rightWidth: drawerOpen ? 320 : 0,
    });
  }, [briefOpen, drawerOpen]);

  const rail         = useMemo(() => deriveQuestRail(liveStatus, displayWalletIdentity), [displayWalletIdentity, liveStatus]);
  const deferredRail = useDeferredValue(rail);
  const deferredProofs = useDeferredValue(proofs);

  const activeQuest = useMemo(() => getActiveQuestStep(liveStatus, displayWalletIdentity), [displayWalletIdentity, liveStatus]);

  useEffect(() => {
    bazaarEventBridge.emit("quest:highlight", { targetId: activeQuest?.targetId ?? null, mapId: activeQuest?.targetMapId });
  }, [activeQuest]);

  useEffect(() => {
    const offNpc    = bazaarEventBridge.on("npc:interact",      ({ interactionId, npcId }) => setSelection({ interactionId, npcId }));
    const offDist   = bazaarEventBridge.on("district:selected", ({ interactionId }) => setSelection({ interactionId }));
    const offAltar  = bazaarEventBridge.on("skill:altar-open",  ({ mapId }) => startTransition(() => setSkillHudMapId(mapId)));
    const offProof  = bazaarEventBridge.on("proof:scroll-picked", ({ proof }) => startTransition(() => { setProofOverlay(proof); setDrawerOpen(true); setDrawerTab("proof"); }));
    return () => { offNpc(); offDist(); offAltar(); offProof(); };
  }, []);

  const currentDistrict = useMemo(() => {
    if (selectedDistrictId) return districtDefinitions.find((d) => d.id === selectedDistrictId) ?? null;
    const building = buildingDefinitions.find((b) => b.portalMapId === currentMapId);
    return districtDefinitions.find((d) => d.id === building?.districtId) ?? null;
  }, [currentMapId, selectedDistrictId]);

  const districtRoster = useMemo(() => {
    if (!currentDistrict) return [];
    return currentDistrict.npcRoster.map((id) => npcLookup.get(id)).filter((n): n is NonNullable<typeof n> => Boolean(n));
  }, [currentDistrict]);

  const interactionView = useMemo(() => {
    if (!selection) return null;
    const npc      = selection.npcId ? npcDefinitions.find((e) => e.id === selection.npcId) : null;
    const building = buildingDefinitions.find((e) => e.id === selection.interactionId);
    const isObjective = activeQuest?.targetId === selection.interactionId;

    const baseLines     = npc ? dialogueEntries[npc.dialogueId]?.[0]?.lines ?? [] : building ? [building.description] : [];
    const objectiveLines = isObjective ? [activeQuest?.requiredInteraction, activeQuest?.worldStateChange, activeQuest?.rewardOutput].filter((v): v is string => Boolean(v)) : [];
    const lines = [...baseLines, ...objectiveLines].slice(0, 3);

    return {
      title:         npc?.name ?? building?.name ?? humanize(selection.interactionId),
      subtitle:      npc?.economyRole ?? building?.description ?? "Village interaction",
      lines:         lines.length > 0 ? lines : ["This landmark reacts to the next live economy step."],
      actionLabel:   isObjective && activeQuest?.actionId ? activeQuest.title : undefined,
      actionId:      isObjective ? activeQuest?.actionId : undefined,
      objectiveLabel: isObjective ? "Objective" : "Inspect",
    };
  }, [activeQuest, selection]);

  const completedSteps = deferredRail.filter((s) => s.state === "complete").length;
  const questProgress  = Math.round((completedSteps / Math.max(1, goldenPathQuest.steps.length)) * 100);

  const addressLabel  = shortAddress(displayAddress);
  const balanceLabel  = displayWalletIdentity.connected ? (displayBalance ? `${Number(displayBalance.formatted).toFixed(3)} ${displayBalance.symbol}` : "Syncing") : "—";
  const chainLabel    = displayChainName ?? "—";
  const isStatusSyncing = hasMounted && statusQuery.isFetching;
  const runtimeLabel  = isStatusSyncing ? "syncing…" : (liveStatus?.liveDashboard.runtime?.status ?? "ready");
  const taxLabel      = `${(((liveStatus?.liveDashboard.bazaarSnapshot?.rules?.[0] as number | undefined) ?? 500) / 100).toFixed(2)}%`;
  const treasuryLabel = `${Number(liveStatus?.liveDashboard.bazaarSnapshot?.treasuryBalanceOkb ?? 0).toFixed(3)} OKB`;
  const lastUpdatedLabel = formatTimeLabel(liveStatus?.liveDashboard.runtime?.lastUpdatedAt ?? statusQuery.dataUpdatedAt, hasMounted);

  const recentSteps = useMemo(() => [...(liveStatus?.liveDashboard.runtime?.steps ?? [])].slice(-4).reverse(), [liveStatus]);
  const latestProof = deferredProofs[0] ?? null;
  const stageLabel  = currentDistrict?.name ?? mapLabels[currentMapId];

  const startupVisible  = !hasMounted || !phaserReady || sceneId === "boot" || sceneId === "preload";
  const startupProgress = stageLoadError ? 100 : !hasMounted ? 18 : !phaserReady ? 42 : sceneId === "boot" ? 58 : sceneId === "preload" ? 84 : 100;
  const startupStatusLabel = stageLoadError ? "Boot failed" : !hasMounted ? "Syncing frame" : !phaserReady ? "Starting engine" : sceneId === "boot" ? "Building scene graph" : sceneId === "preload" ? "Loading assets" : "Village ready";

  const onboardingVisible  = !hydrated || !displayWalletIdentity.connected || !displayWalletIdentity.validNetwork || !hasEnteredVillage;
  const canEnterVillage    = hydrated && displayWalletIdentity.connected && displayWalletIdentity.validNetwork;
  const activeLaborCount   = useMemo(() => Object.values(laborRouting.npcStates).filter((s) => s.status === "walking").length, [laborRouting.npcStates]);

  const liveError = (statusQuery.error instanceof Error ? statusQuery.error.message : null)
    ?? (actionMutation.error instanceof Error ? actionMutation.error.message : null)
    ?? pendingAction?.errorMessage ?? null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleQuestAction(actionId: QuestActionId) {
    bazaarAudioSystem.play("ui-confirm");
    bazaarGameStore.getState().setPendingAction({ actionId, label: humanize(actionId), status: "pending", startedAt: Date.now() });
    bazaarEventBridge.emit("tx:submitted", { actionId, label: humanize(actionId) });
    setDrawerOpen(true); setDrawerTab("ops");
    try {
      const payload = await actionMutation.mutateAsync(actionId);
      bazaarGameStore.getState().setPendingAction({ actionId, label: humanize(actionId), status: payload.txState, startedAt: Date.now(), txHash: payload.txHash, stepKey: payload.stepKey });
      if (payload.stepKey) bazaarEventBridge.emit("tx:confirmed", { actionId, stepKey: payload.stepKey, txHash: payload.txHash });
    } catch (error) {
      bazaarGameStore.getState().setPendingAction({ actionId, label: humanize(actionId), status: "failed", startedAt: Date.now(), errorMessage: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  function toggleBrief()  { bazaarAudioSystem.play("ui-confirm"); setBriefOpen((v) => !v); if (drawerOpen) setDrawerOpen(false); }
  function toggleDrawer(tab: DrawerTab = drawerTab) {
    bazaarAudioSystem.play("ui-confirm");
    setDrawerOpen((v) => (tab === drawerTab ? !v : true));
    setDrawerTab(tab);
    if (!drawerOpen && briefOpen) setBriefOpen(false);
  }
  function openDrawer(tab: DrawerTab) {
    bazaarAudioSystem.play("ui-confirm");
    setDrawerOpen(true); setDrawerTab(tab);
    if (briefOpen) setBriefOpen(false);
  }
  function toggleMuted()      { bazaarGameStore.getState().setSettings({ muted: !settings.muted }); bazaarAudioSystem.play("ui-confirm"); }
  function toggleLowEffects() { bazaarGameStore.getState().setSettings({ lowEffects: !settings.lowEffects }); }

  function handleGuideToTarget(targetId: string) {
    const target = interactionNavigation[targetId]; if (!target) return;
    bazaarAudioSystem.play("ui-confirm");
    bazaarEventBridge.emit("quest:highlight", { targetId, mapId: target.mapId });
    setSelection(null);
    if (currentMapId !== target.mapId) {
      // Switch to target scene — the spawn point handles positioning, no extra teleport needed
      bazaarEventBridge.emit("scene:enter", { mapId: target.mapId, spawnId: target.spawnId ?? interiorEntrySpawns[target.mapId] });
      return;
    }
    // Already on the right map — just teleport the player
    bazaarEventBridge.emit("player:teleport", { mapId: target.mapId, x: target.x, y: target.y });
  }

  function handleGuideToQuest(stepId?: string) {
    const questStep = deferredRail.find((s) => s.id === stepId) ?? activeQuest;
    if (questStep) handleGuideToTarget(questStep.targetId);
  }

  function handleGuideToDistrict(districtId: DistrictId) {
    const targetId = districtInteractionMap[districtId];
    if (targetId) handleGuideToTarget(targetId);
  }

  function handleEnterInterior(mapId: MapId) {
    bazaarAudioSystem.play("door-open");
    bazaarEventBridge.emit("scene:enter", { mapId, spawnId: interiorEntrySpawns[mapId] });
  }

  function handleEnterVillage() {
    const fallback = resolveDefaultPlayerName(walletIdentity.address);
    bazaarGameStore.getState().setPlayerName(clampPlayerName(playerNameDraft, fallback));
    bazaarAudioSystem.play("ui-confirm");
    setHasEnteredVillage(true);
    window.sessionStorage.setItem(sessionKey, "1");
  }

  function handleSavePlayerName() {
    const fallback = resolveDefaultPlayerName(walletIdentity.address);
    bazaarGameStore.getState().setPlayerName(clampPlayerName(playerNameDraft, fallback));
    bazaarAudioSystem.play("ui-confirm");
  }

  function handleCloseSkillHud() {
    if (!skillHudMapId) return;
    bazaarAudioSystem.play("ui-confirm");
    bazaarEventBridge.emit("skill:altar-close", { mapId: skillHudMapId });
    setSkillHudMapId(null);
  }

  async function handleUnlockSkill(skillId: string) {
    setUnlockPendingSkillId(skillId);
    try {
      const receipt = await unlockSkill(skillId);
      const nextUnlocked = Array.from(new Set([...unlockedSkillIds, skillId]));
      bazaarGameStore.getState().setSkillLoadout({ unlockedSkillIds: nextUnlocked, activeSkillId: activeSkillId ?? skillId });
      if (!activeSkillId) bazaarEventBridge.emit("skill:activated", { skillId });
      bazaarEventBridge.emit("camera:flash", { duration: 500, red: 0, green: 255, blue: 65 });
      bazaarEventBridge.emit("skill:unlock-success", { skillId });
      bazaarEventBridge.emit("toast:show", { id: `skill:unlock:${skillId}`, title: "Skill Unlocked", body: `${receipt.amountOkb} OKB settled through ${receipt.protocol}.`, tone: "success" });
      bazaarAudioSystem.play("success-chime");
    } catch (error) {
      bazaarEventBridge.emit("toast:show", { id: `skill:unlock:error:${skillId}`, title: "Unlock Failed", body: error instanceof Error ? error.message : "Unable to unlock.", tone: "skill" });
    } finally { setUnlockPendingSkillId(null); }
  }

  function handleSlotSkill(skillId: string) {
    bazaarAudioSystem.play("ui-confirm");
    bazaarGameStore.getState().setSkillLoadout({ activeSkillId: skillId });
    bazaarEventBridge.emit("skill:activated", { skillId });
    bazaarEventBridge.emit("toast:show", { id: `skill:slot:${skillId}`, title: "Skill Slotted", body: `${skillCatalog.find((s) => s.skill_id === skillId)?.identity.name ?? "Skill"} is now active.`, tone: "skill" });
  }

  async function handleDelegateTrade(skillId: string) {
    setDelegatePendingSkillId(skillId);
    try {
      const payload = await delegateTradeSkill(skillId);
      bazaarEventBridge.emit("skill:delegate-trade", payload);
      bazaarEventBridge.emit("toast:show", { id: `skill:delegate:${skillId}`, title: "Trade Delegated", body: `${payload.delegatedAction} routed through ${payload.protocol}.`, tone: "skill" });
      setDrawerOpen(true); setDrawerTab("ops");
    } catch (error) {
      bazaarEventBridge.emit("toast:show", { id: `skill:delegate:error:${skillId}`, title: "Delegation Failed", body: error instanceof Error ? error.message : "Unable to route.", tone: "skill" });
    } finally { setDelegatePendingSkillId(null); }
  }

  // ── Connection status dot ────────────────────────────────────────────────
  const connDot = displayWalletIdentity.connected
    ? displayWalletIdentity.validNetwork ? "is-green" : "is-gold"
    : "is-red";

  return (
    <main className="game-shell">
      {/* ── GAME CANVAS (full screen, always) ──────────────────────────────── */}
      <div className="game-stage">
        <div className="phaser-stage">
          <PhaserGameClient
            onReady={() => { setStageLoadError(null); setPhaserReady(true); }}
            onError={(error) => { setPhaserReady(false); setStageLoadError(error.message); }}
          />
        </div>
      </div>

      {/* ── HUD TOP BAR ─────────────────────────────────────────────────────── */}
      <header className="hud-topbar">
        {/* Brand */}
        <div className="hud-title">BazaarX</div>

        {/* Location */}
        <div className="hud-seg">
          <MapPinned size={10} />
          <span className="hud-seg-value">{stageLabel}</span>
        </div>

        {/* GDP */}
        <div className="hud-seg">
          <span className="hud-seg-label">GDP</span>
          <span className="hud-seg-value is-green">{world.gdpScore.toFixed(1)}</span>
        </div>

        {/* Proofs */}
        <div className="hud-seg">
          <Radio size={10} />
          <span className="hud-seg-value is-ice">{deferredProofs.length}</span>
        </div>

        {/* Active quest objective */}
        {activeQuest ? (
          <div className="hud-seg hud-quest-seg">
            <Zap size={10} style={{ color: "var(--gold)", flexShrink: 0 }} />
            <span className="hud-quest-text">{activeQuest.objectiveText}</span>
          </div>
        ) : null}

        <div className="hud-spacer" />

        {/* Runtime status */}
        <div className="hud-seg">
          <div className={`hud-dot ${isStatusSyncing ? "is-gold" : liveError ? "is-red" : "is-green"}`} />
          <span className="hud-seg-value">{runtimeLabel}</span>
        </div>

        {/* Wallet */}
        <div className="hud-seg">
          <div className={`hud-dot ${connDot}`} />
          <span className="hud-seg-value">{addressLabel}</span>
        </div>

        {/* Player name */}
        <div className="hud-seg">
          <Sparkles size={10} style={{ color: "var(--purple)" }} />
          <span className="hud-seg-value">{playerName}</span>
        </div>

        {/* Panel toggles */}
        <button type="button" className={`hud-btn ${briefOpen ? "is-active" : ""}`} onClick={toggleBrief} aria-label="Brief">
          <BookOpen size={11} />Brief
        </button>
        <button type="button" className={`hud-btn ${drawerOpen ? "is-active" : ""}`} onClick={() => toggleDrawer("quests")} aria-label="Drawer">
          <ScrollText size={11} />Panel
        </button>
      </header>

      {/* ── HUD BOTTOM BAR ──────────────────────────────────────────────────── */}
      <footer className="hud-bottombar">
        <div className="hud-hints">
          <span className="hud-hint"><kbd>WASD</kbd>Move</span>
          <span className="hud-hint"><kbd>E</kbd>Interact</span>
          {latestProof ? (
            <span className="hud-hint" style={{ color: "var(--text-ice)", borderColor: "rgba(0,191,255,0.2)" }}>
              ◆ {latestProof.title}
            </span>
          ) : null}
        </div>

        <div className="hud-bottom-actions">
          {drawerTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`hud-bottom-btn ${drawerOpen && drawerTab === tab.id ? "is-active" : ""}`}
              onClick={() => toggleDrawer(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <button type="button" className="hud-bottom-btn" onClick={() => handleGuideToQuest()}>
            <LocateFixed size={10} />Guide
          </button>
        </div>
      </footer>

      {/* ── LEFT BRIEF PANEL (overlay, slides from left) ────────────────────── */}
      <aside className={`overlay-panel overlay-panel-left ${briefOpen ? "" : "is-closed"}`}>
        <div className="panel-header">
          <div>
            <div className="panel-header-title">Village Brief</div>
          </div>
          <button type="button" className="panel-close-btn" onClick={() => setBriefOpen(false)} aria-label="Close brief">
            <X size={12} />
          </button>
        </div>

        <div className="panel-scroll">
          {/* Status pills */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <span className="px-pill p-green">{world.worldTier ? `Tier ${world.worldTier}` : "Booting"}</span>
            <span className="px-pill p-gold">Quest {questProgress}%</span>
            {activeQuest ? <span className="px-pill p-green">{activeQuest.title}</span> : null}
          </div>

          {/* Progress */}
          <div className="px-card">
            <div className="px-kicker k-gold">Campaign</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span className="px-title" style={{ fontSize: 22 }}>{questProgress}%</span>
              <span style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 8, color: "var(--text-muted)" }}>
                {completedSteps}/{goldenPathQuest.steps.length} steps
              </span>
            </div>
            <div className="px-progress">
              <div className="px-progress-fill" style={{ width: `${questProgress}%` }} />
            </div>
          </div>

          {/* District */}
          <div className="px-card accent-ice">
            <div className="px-kicker k-ice">Location</div>
            <div className="px-title">{currentDistrict?.name ?? stageLabel}</div>
            <div className="px-body" style={{ fontSize: 13 }}>
              {currentDistrict?.subtitle ?? mapLabels[currentMapId]}
            </div>
          </div>

          {/* Roster */}
          {districtRoster.length > 0 ? (
            <div className="px-card accent-purple">
              <div className="px-kicker k-purple">Roster</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                {districtRoster.slice(0, 4).map((npc) => (
                  <div key={npc.id} className="px-roster-row">
                    <span>{npc.name}</span>
                    <span className={`px-entity-tag ${npc.entityType}`}>{npc.entityType}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Live feed */}
          <div className="px-card accent-green">
            <div className="px-kicker k-green">Economy</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
              {recentSteps.slice(0, 3).map((step) => (
                <div key={`${step.key}:${step.startedAt}`} style={{ display: "flex", justifyContent: "space-between", gap: 6, padding: "4px 6px", background: "var(--bg-raised)", border: "1px solid var(--border-dim)" }}>
                  <span className="px-body" style={{ fontSize: 12 }}>{step.label}</span>
                  <span style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, color: "var(--text-green)", flexShrink: 0 }}>{step.status}</span>
                </div>
              ))}
              {recentSteps.length === 0 ? (
                <span className="px-body" style={{ fontSize: 12, color: "var(--text-muted)" }}>No chain activity yet.</span>
              ) : null}
            </div>
          </div>

          {/* Latest proof */}
          {latestProof ? (
            <div className="px-card accent-ice">
              <div className="px-kicker k-ice">Latest Proof</div>
              <div className="px-title" style={{ fontSize: 13 }}>{latestProof.title}</div>
              <div className="px-body" style={{ fontSize: 12, color: "var(--text-muted)" }}>{latestProof.body}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, color: "var(--text-muted)" }}>{latestProof.label}</span>
                <span style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, color: "var(--text-muted)" }}>{formatTimeLabel(latestProof.createdAt, hasMounted)}</span>
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button type="button" className="px-btn primary" onClick={() => handleGuideToQuest()}>
              <LocateFixed size={12} />Guide Me
            </button>
            <button type="button" className="px-btn ghost" onClick={() => openDrawer("proof")}>
              <ScrollText size={12} />Proof
            </button>
            <button type="button" className="px-btn ghost" onClick={() => openDrawer("ops")}>
              <Compass size={12} />Tracker
            </button>
          </div>
        </div>
      </aside>

      {/* ── RIGHT DRAWER PANEL (overlay, slides from right) ────────────────── */}
      <aside className={`overlay-panel overlay-panel-right ${drawerOpen ? "" : "is-closed"}`}>
        {/* Summary stats */}
        <div style={{ padding: "8px 10px", borderBottom: "2px solid var(--border-dim)", flexShrink: 0 }}>
          <div className="px-stat-grid">
            <div className="px-stat">
              <div className="px-stat-label">Wallet</div>
              <div className="px-stat-value">{addressLabel}</div>
            </div>
            <div className="px-stat">
              <div className="px-stat-label">Balance</div>
              <div className="px-stat-value">{balanceLabel}</div>
            </div>
            <div className="px-stat">
              <div className="px-stat-label">Treasury</div>
              <div className="px-stat-value">{treasuryLabel}</div>
            </div>
            <div className="px-stat">
              <div className="px-stat-label">Tax</div>
              <div className="px-stat-value">{taxLabel}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="panel-tabs">
          <div className="panel-tabs-row">
            {drawerTabs.map((tab) => (
              <button key={tab.id} type="button" className={`panel-tab ${drawerTab === tab.id ? "is-active" : ""}`} onClick={() => setDrawerTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Panel header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderBottom: "2px solid var(--border-dim)", flexShrink: 0 }}>
          <span className="panel-header-title">{drawerTab.toUpperCase()}</span>
          <button type="button" className="panel-close-btn" onClick={() => setDrawerOpen(false)} aria-label="Close panel">
            <X size={12} />
          </button>
        </div>

        {/* Active objective strip */}
        {activeQuest ? (
          <div style={{ padding: "6px 10px", background: "rgba(0,255,65,0.05)", borderBottom: "2px solid rgba(0,255,65,0.2)", flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-green)" }}>
              ▸ {activeQuest.title}
            </div>
            <div style={{ fontFamily: "var(--font-pixel), monospace", fontSize: 12, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.3 }}>
              {activeQuest.objectiveText}
            </div>
          </div>
        ) : null}

        <div className="panel-scroll">

          {/* ── QUESTS TAB ─────────────────────────────────────────────────── */}
          {drawerTab === "quests" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {deferredRail.map((step) => (
                <article key={step.id} className={`px-quest state-${step.state}`}>
                  <div className="px-quest-head">
                    <div>
                      <div className="px-quest-state">{step.state}</div>
                      <div className="px-quest-title">{step.title}</div>
                    </div>
                    <button type="button" className="px-link" onClick={() => handleGuideToQuest(step.id)}>
                      <LocateFixed size={10} />Guide
                    </button>
                  </div>
                  <div className="px-quest-desc">{step.objectiveText}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div className="px-detail-row"><strong>Do:</strong>{step.requiredInteraction}</div>
                    <div className="px-detail-row"><strong>Effect:</strong>{step.worldStateChange}</div>
                    <div className="px-detail-row"><strong>Proof:</strong>{step.rewardOutput}</div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {/* ── PROOF TAB ──────────────────────────────────────────────────── */}
          {drawerTab === "proof" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {deferredProofs.length ? (
                deferredProofs.map((proof) => (
                  <article key={proof.id} className="px-quest state-complete">
                    <div className="px-quest-head">
                      <div>
                        <div className="px-quest-state">{proof.kind}</div>
                        <div className="px-quest-title">{proof.title}</div>
                      </div>
                      {proof.explorerUrl ? (
                        <a href={proof.explorerUrl} target="_blank" rel="noreferrer" className="px-link">
                          <ArrowUpRight size={10} />TX
                        </a>
                      ) : null}
                    </div>
                    <div className="px-quest-desc">{proof.body}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
                      <span style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, color: "var(--text-muted)" }}>{humanize(proof.districtId)}</span>
                      <span style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, color: "var(--text-muted)" }}>{formatTimeLabel(proof.createdAt, hasMounted)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="px-card">
                  <div className="px-kicker">No Proof Yet</div>
                  <div className="px-body" style={{ fontSize: 13 }}>Complete a quest action to mint your first proof on X Layer.</div>
                </div>
              )}
            </div>
          ) : null}

          {/* ── DISTRICTS TAB ──────────────────────────────────────────────── */}
          {drawerTab === "districts" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {districtDefinitions.map((district) => {
                const linkedInterior = district.linkedInteriors[0];
                return (
                  <article key={district.id} className="px-quest state-locked">
                    <div className="px-quest-head">
                      <div>
                        <div className="px-quest-state">{district.subtitle}</div>
                        <div className="px-quest-title">{district.name}</div>
                      </div>
                      <button type="button" className="px-link" onClick={() => handleGuideToDistrict(district.id)}>
                        <LocateFixed size={10} />Go
                      </button>
                    </div>
                    <div className="px-quest-desc" style={{ fontSize: 12 }}>
                      {district.npcRoster.map((id) => npcLookup.get(id)?.name ?? humanize(id)).join(" • ")}
                    </div>
                    {linkedInterior ? (
                      <button type="button" className="px-link" style={{ marginTop: 2 }} onClick={() => handleEnterInterior(linkedInterior)}>
                        <ChevronRight size={10} />Enter {mapLabels[linkedInterior]}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}

          {/* ── OPS TAB (merged live + wallet) ─────────────────────────────── */}
          {drawerTab === "ops" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Runtime metrics */}
              <div className="px-stat-grid">
                <div className="px-stat">
                  <div className="px-stat-label">Status</div>
                  <div className="px-stat-value" style={{ color: liveError ? "var(--text-red)" : "var(--text-green)" }}>{runtimeLabel}</div>
                </div>
                <div className="px-stat">
                  <div className="px-stat-label">Updated</div>
                  <div className="px-stat-value">{lastUpdatedLabel}</div>
                </div>
                <div className="px-stat">
                  <div className="px-stat-label">Block</div>
                  <div className="px-stat-value">{world.blockHeight || "—"}</div>
                </div>
                <div className="px-stat">
                  <div className="px-stat-label">Routing</div>
                  <div className="px-stat-value">{activeLaborCount} npcs</div>
                </div>
              </div>

              {/* Error / pending note */}
              {(liveError || pendingAction) ? (
                <div className={`px-card ${liveError ? "accent-red" : "accent-green"}`}>
                  <div className={`px-kicker ${liveError ? "k-red" : "k-green"}`}>{liveError ? "Error" : "Pending"}</div>
                  <div className="px-body" style={{ fontSize: 13 }}>
                    {liveError ?? `${pendingAction?.label} is ${pendingAction?.status}.`}
                  </div>
                </div>
              ) : null}

              {/* Monitor card */}
              {liveStatus?.monitor ? (
                <div className="px-card accent-green">
                  <div className="px-kicker k-green">Village Health</div>
                  <div className="px-title" style={{ fontSize: 16 }}>{Math.round(liveStatus.monitor.villageHealth * 100)}%</div>
                  <div className="px-body" style={{ fontSize: 12 }}>{liveStatus.monitor.note}</div>
                </div>
              ) : null}

              {/* Recent steps */}
              {recentSteps.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {recentSteps.map((step) => (
                    <div key={`${step.key}:${step.startedAt}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 8px", background: "var(--bg-surface)", border: "2px solid var(--border-dim)" }}>
                      <div>
                        <div style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, color: "var(--text-green)", textTransform: "uppercase" }}>{step.status}</div>
                        <div style={{ fontFamily: "var(--font-pixel), monospace", fontSize: 13, color: "var(--text-primary)", marginTop: 1 }}>{step.label}</div>
                      </div>
                      {step.explorerUrl ? (
                        <a href={step.explorerUrl} target="_blank" rel="noreferrer" className="px-link">
                          <ArrowUpRight size={10} />TX
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="px-divider" />

              {/* Wallet section */}
              <div className="px-card accent-purple">
                <div className="px-kicker k-purple">Agent</div>
                <div className="px-title" style={{ fontSize: 14 }}>{playerName}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input
                    value={playerNameDraft}
                    onChange={(e) => setPlayerNameDraft(e.target.value)}
                    placeholder={resolveDefaultPlayerName(displayWalletIdentity.address)}
                    className="px-input"
                    maxLength={24}
                  />
                  <button type="button" className="px-btn gold" onClick={handleSavePlayerName}>
                    Save
                  </button>
                </div>
              </div>

              <ConnectWalletButton variant="pixel" fullWidth />

              {displayWalletIdentity.connected && !displayWalletIdentity.validNetwork ? (
                <button type="button" disabled={isSwitching} onClick={() => switchChain?.({ chainId: defaultXLayerChain.id })} className="px-btn primary" style={{ width: "100%", justifyContent: "center" }}>
                  <Wallet size={12} />{isSwitching ? "Switching…" : "Switch To X Layer"}
                </button>
              ) : null}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button type="button" className="px-btn ghost px-btn-sm" onClick={() => void statusQuery.refetch()} disabled={isStatusSyncing}>
                  <RefreshCw size={10} />{isStatusSyncing ? "Refreshing…" : "Refresh"}
                </button>
                <button type="button" className="px-btn ghost px-btn-sm" onClick={toggleMuted}>
                  {settings.muted ? <Volume2 size={10} /> : <VolumeX size={10} />}
                  {settings.muted ? "Unmute" : "Mute"}
                </button>
                <button type="button" className="px-btn ghost px-btn-sm" onClick={toggleLowEffects}>
                  <Sparkles size={10} />{settings.lowEffects ? "Full FX" : "Low FX"}
                </button>
              </div>
            </div>
          ) : null}

        </div>
      </aside>

      {/* ── INTERACTION SHEET ────────────────────────────────────────────────── */}
      {interactionView ? (
        <InteractionSheet
          title={interactionView.title}
          subtitle={interactionView.subtitle}
          lines={interactionView.lines}
          objectiveLabel={interactionView.objectiveLabel}
          actionLabel={interactionView.actionLabel}
          actionDisabled={Boolean(!interactionView.actionId || actionMutation.isPending || !displayWalletIdentity.validNetwork)}
          actionPending={actionMutation.isPending}
          disabledReason={
            !displayWalletIdentity.connected ? "Connect wallet first."
            : !displayWalletIdentity.validNetwork ? "Switch to X Layer."
            : "Quest actions submit real Bazaar X transactions."
          }
          onAction={interactionView.actionId ? () => handleQuestAction(interactionView.actionId as QuestActionId) : undefined}
          onClose={() => setSelection(null)}
        />
      ) : null}

      {/* ── SKILL GRIMOIRE ───────────────────────────────────────────────────── */}
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

      {/* ── PROOF OVERLAY ───────────────────────────────────────────────────── */}
      {proofOverlay ? (
        <ProofRealityOverlay proof={proofOverlay} onClose={() => setProofOverlay(null)} />
      ) : null}

      {/* ── STARTUP SCREEN ──────────────────────────────────────────────────── */}
      {startupVisible ? (
        <div className="startup-overlay">
          <div className="startup-panel fade-in">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div className="startup-logo">Bazaar<span>X</span></div>
              <div style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 9, color: "var(--text-muted)", padding: "4px 8px", border: "1px solid var(--border-dim)" }}>
                {startupProgress}%
              </div>
            </div>

            <div className="startup-console">
              <div className="startup-console-row"><span>status</span><strong>{startupStatusLabel}</strong></div>
              <div className="startup-console-row"><span>scene</span><strong>{sceneId}</strong></div>
              <div className="startup-console-row"><span>wallet</span><strong>{displayWalletIdentity.connected ? "linked" : "awaiting"}</strong></div>
            </div>

            <div className="startup-meter">
              <div className="startup-meter-fill" style={{ width: `${startupProgress}%` }} />
            </div>

            <div className="startup-steps">
              <div className={`startup-step ${hasMounted ? "is-done" : "is-active"}`}>
                <div className="startup-step-id">01</div>
                <div className="startup-step-label">Render lock</div>
                <div className="startup-step-sub">SSR handoff</div>
              </div>
              <div className={`startup-step ${phaserReady ? "is-done" : hasMounted ? "is-active" : ""}`}>
                <div className="startup-step-id">02</div>
                <div className="startup-step-label">Boot engine</div>
                <div className="startup-step-sub">Canvas online</div>
              </div>
              <div className={`startup-step ${(sceneId === "overworld" || sceneId === "interior") ? "is-done" : phaserReady ? "is-active" : ""}`}>
                <div className="startup-step-id">03</div>
                <div className="startup-step-label">Open village</div>
                <div className="startup-step-sub">Map ready</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── ONBOARDING OVERLAY ──────────────────────────────────────────────── */}
      {onboardingVisible ? (
        <div className="onboarding-overlay">
          <div className="onboarding-panel fade-in">
            <div className="onboarding-top">
              <div className="onboarding-logo-kicker">X Layer World Economy</div>
              <div className="onboarding-logo">Bazaar<span>X</span></div>
              <div className="onboarding-copy">
                Connect your wallet, validate X Layer, name your agent, then enter the living village where economy settles onchain.
              </div>
            </div>

            <div className="onboarding-steps">
              <div className={`onboarding-step ${displayWalletIdentity.connected ? "is-done" : "is-active"}`}>
                <div className="onboarding-step-kicker">{displayWalletIdentity.connected ? "✓ Wallet linked" : "Step 1"}</div>
                <div className="onboarding-step-title">{displayWalletIdentity.connected ? addressLabel : "Connect Wallet"}</div>
                <div className="onboarding-step-desc">{displayWalletIdentity.connected ? "Identity keyed to wallet." : "No email. Wallet is the only login."}</div>
              </div>
              <div className={`onboarding-step ${displayWalletIdentity.validNetwork ? "is-done" : displayWalletIdentity.connected ? "is-active" : ""}`}>
                <div className="onboarding-step-kicker">{displayWalletIdentity.validNetwork ? "✓ X Layer ready" : "Step 2"}</div>
                <div className="onboarding-step-title">{displayWalletIdentity.validNetwork ? chainLabel : "Validate Network"}</div>
                <div className="onboarding-step-desc">{displayWalletIdentity.validNetwork ? "Live economy sync active." : "Switch to X Layer for live actions."}</div>
              </div>
              <div className="onboarding-step">
                <div className="onboarding-step-kicker">Step 3</div>
                <div className="onboarding-step-title">Name Agent</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input
                    value={playerNameDraft}
                    onChange={(e) => setPlayerNameDraft(e.target.value)}
                    placeholder={resolveDefaultPlayerName(displayWalletIdentity.address)}
                    className="px-input"
                    maxLength={24}
                    style={{ fontSize: 9 }}
                  />
                </div>
              </div>
            </div>

            <div className="onboarding-actions">
              {!displayWalletIdentity.connected ? <ConnectWalletButton variant="pixel" fullWidth /> : null}
              {displayWalletIdentity.connected && !displayWalletIdentity.validNetwork ? (
                <button type="button" disabled={isSwitching} onClick={() => switchChain?.({ chainId: defaultXLayerChain.id })} className="px-btn primary" style={{ padding: "10px 20px" }}>
                  <Wallet size={14} />{isSwitching ? "Switching…" : "Switch To X Layer"}
                </button>
              ) : null}
              {canEnterVillage ? (
                <button type="button" onClick={handleEnterVillage} className="px-btn primary" style={{ padding: "10px 24px" }}>
                  <Sparkles size={14} />Enter Village
                </button>
              ) : null}
            </div>

            <div className="onboarding-footer">
              <div className={`onboarding-ready-dot ${canEnterVillage ? "is-ready" : ""}`} />
              <span className="onboarding-ready-label">
                {canEnterVillage ? "Ready — enter the village" : "Wallet + X Layer required"}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
