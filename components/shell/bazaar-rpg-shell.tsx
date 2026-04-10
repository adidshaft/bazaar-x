"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useBalance, useSwitchChain } from "wagmi";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { PhaserGameClient } from "./phaser-game-client";
import { GameHud } from "@/components/overlay/game-hud";
import { InteractionSheet } from "@/components/overlay/interaction-sheet";
import { ProofJournal } from "@/components/overlay/proof-journal";
import { STATUS_QUERY_KEY } from "@/game/config/constants";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import { bazaarGameStore, useBazaarGameStore } from "@/game/core/store";
import type { QuestActionId } from "@/game/core/live-types";
import { buildingDefinitions } from "@/game/data/world";
import { dialogueEntries } from "@/game/data/dialogue";
import { npcDefinitions } from "@/game/data/npcs";
import { createDefaultPlayerPersistence, resolveWalletIdentity } from "@/game/systems/player-service";
import { deriveQuestRail, getActiveQuestStep } from "@/game/systems/quest-service";
import { buildProofArtifacts } from "@/game/systems/proof-service";
import { loadPersistedPlayerState, savePersistedPlayerState } from "@/game/systems/persistence-service";
import { executeQuestAction, fetchDashboardStatus } from "@/game/systems/transaction-service";
import { deriveWorldState } from "@/game/systems/world-state-service";

function shortAddress(address?: string) {
  if (!address) {
    return "Not connected";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function humanize(id: string) {
  return id.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

type InteractionSelection = {
  interactionId: string;
  npcId?: string;
};

export function BazaarRpgShell({ initialScene }: { initialScene?: string | null }) {
  const queryClient = useQueryClient();
  const [journalOpen, setJournalOpen] = useState(initialScene === "stats");
  const [selection, setSelection] = useState<InteractionSelection | null>(null);

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

  const settings = useBazaarGameStore((state) => state.settings);
  const proofs = useBazaarGameStore((state) => state.proofs);
  const currentMapId = useBazaarGameStore((state) => state.currentMapId);
  const pendingAction = useBazaarGameStore((state) => state.pendingAction);
  const liveStatus = useBazaarGameStore((state) => state.liveStatus);

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
    },
  });

  useEffect(() => {
    bazaarGameStore.getState().setWallet(walletIdentity);
  }, [walletIdentity]);

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
    if (!walletIdentity.connected || !walletIdentity.validNetwork) {
      return;
    }

    savePersistedPlayerState(walletIdentity, {
      currentMapId,
      lastSpawnId: undefined,
      revealedProofIds: proofs.map((proof) => proof.id),
      unlockedLocations: ["village-exterior", "forge-interior", "depot-interior", "treasury-interior", "council-interior"],
      activeQuestStepId: bazaarGameStore.getState().objectiveTargetId ?? undefined,
      muted: settings.muted,
      lowEffects: settings.lowEffects,
    });
  }, [currentMapId, proofs, settings, walletIdentity]);

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

  const interactionView = useMemo(() => {
    if (!selection) {
      return null;
    }

    const npc = selection.npcId ? npcDefinitions.find((entry) => entry.id === selection.npcId) : null;
    const building = buildingDefinitions.find((entry) => entry.id === selection.interactionId);
    const lines = npc ? dialogueEntries[npc.dialogueId]?.[0]?.lines ?? [] : building ? [building.description] : [];
    const isObjective = activeQuest?.targetId === selection.interactionId;

    return {
      title: npc?.name ?? building?.name ?? humanize(selection.interactionId),
      subtitle: npc?.economyRole ?? building?.description ?? "Village interaction",
      lines:
        lines.length > 0
          ? lines
          : ["This corner of Bazaar X reacts to the next live economy step."],
      actionLabel: isObjective && activeQuest?.actionId ? activeQuest.title : undefined,
      actionId: isObjective ? activeQuest?.actionId : undefined,
      objectiveLabel: isObjective ? "Objective Interaction" : "Inspect",
    };
  }, [activeQuest, selection]);

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
    }
  }

  const addressLabel = shortAddress(address);
  const balanceLabel = balance ? `${Number(balance.formatted).toFixed(4)} ${balance.symbol}` : "Syncing";
  const chainLabel = chain?.name ?? "X Layer";
  const runtimeLabel = liveStatus?.liveDashboard.runtime?.status ?? "ready";
  const taxLabel = `${((liveStatus?.liveDashboard.bazaarSnapshot?.rules?.[0] as number | undefined) ?? 500) / 100}%`;
  const treasuryLabel = `${Number(liveStatus?.liveDashboard.bazaarSnapshot?.treasuryBalanceOkb ?? 0).toFixed(3)} OKB`;

  const gateCopy = !walletIdentity.connected
    ? "Connect your wallet to enter Bazaar X. Wallet connection remains the only login."
    : !walletIdentity.validNetwork
      ? "Switch to X Layer testnet or mainnet to run live economy actions."
      : null;

  return (
    <main className="game-shell">
      <div className="game-canvas-wrap">
        <PhaserGameClient />
      </div>

      <GameHud
        addressLabel={addressLabel}
        balanceLabel={balanceLabel}
        chainLabel={chainLabel}
        objectiveTitle={activeQuest?.title ?? "Wake Bazaar X"}
        objectiveCopy={activeQuest?.objectiveText ?? "Enter the village and follow the active quest marker."}
        runtimeLabel={runtimeLabel}
        taxLabel={taxLabel}
        treasuryLabel={treasuryLabel}
        pendingLabel={pendingAction ? `${pendingAction.label} · ${pendingAction.status}` : null}
        muted={settings.muted}
        lowEffects={settings.lowEffects}
        onToggleJournal={() => setJournalOpen((current) => !current)}
        onToggleMute={() =>
          bazaarGameStore.getState().setSettings({ muted: !bazaarGameStore.getState().settings.muted })
        }
        onToggleLowEffects={() =>
          bazaarGameStore.getState().setSettings({
            lowEffects: !bazaarGameStore.getState().settings.lowEffects,
          })
        }
      />

      <ProofJournal open={journalOpen} onToggle={() => setJournalOpen((current) => !current)} proofs={proofs} rail={rail} />

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
              ? "Connect your wallet to continue."
              : !walletIdentity.validNetwork
                ? "Switch to an X Layer network before committing the action."
                : null
          }
          onAction={
            interactionView.actionId ? () => handleQuestAction(interactionView.actionId as QuestActionId) : undefined
          }
          onClose={() => setSelection(null)}
        />
      ) : null}

      {gateCopy ? (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-[rgba(12,10,8,0.54)] p-4 backdrop-blur-sm">
          <div className="overlay-card max-w-xl p-6 text-center">
            <div className="overlay-kicker">Bazaar X</div>
            <h2 className="overlay-title mt-2 text-3xl text-[#fff3d3]">Autonomous Agent Economy on X Layer</h2>
            <p className="mt-4 text-base leading-7 text-[#decfa9]">{gateCopy}</p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3">
              {!walletIdentity.connected ? <ConnectWalletButton variant="pixel" /> : null}
              {walletIdentity.connected && !walletIdentity.validNetwork ? (
                <button
                  type="button"
                  disabled={isSwitching}
                  onClick={() => switchChain({ chainId: 1952 })}
                  className="action-button"
                >
                  {isSwitching ? "Switching..." : "Switch To X Layer Testnet"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
