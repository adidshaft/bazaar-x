import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type {
  AISkillDefinition,
  Direction,
  DistrictId,
  GameStoreState,
  LiveDashboardStatus,
  MapId,
  LaborRoutingState,
  PendingAction,
  PersistedPlayerState,
  ProofArtifact,
  SceneId,
  WalletIdentity,
  WorldReactionState,
} from "./live-types";

const defaultWorldState: WorldReactionState = {
  shopOpen: false,
  supplierReady: false,
  workerReady: false,
  treasuryUnlocked: false,
  councilUnlocked: false,
  governancePassed: false,
  worldTier: 0,
  tvlOkb: 0,
  dailyVolumeOkb: 0,
  gdpScore: 0,
  activeProposalCount: 0,
  blockHeight: 0,
  treasuryGlow: 0.2,
  lanternGlow: 0.55,
  taxRateBps: 500,
  treasuryBalanceOkb: 0,
  objectiveTargetId: "keeper-gate",
};

const defaultLaborRoutingState: LaborRoutingState = {
  jobs: [],
  npcStates: {},
  observedStepKeys: [],
};

type BazaarGameStore = GameStoreState & {
  setScene: (sceneId: SceneId, mapId?: MapId) => void;
  setPlayerState: (player: Partial<GameStoreState["player"]>) => void;
  setFocus: (input: {
    interactionId?: string | null;
    npcId?: string | null;
    districtId?: DistrictId | null;
  }) => void;
  setQuestHighlight: (targetId: string | null, mapId?: MapId) => void;
  setLiveStatus: (status: LiveDashboardStatus | null) => void;
  setPendingAction: (action: PendingAction | null) => void;
  pushProofs: (proofs: ProofArtifact[]) => void;
  setPlayerName: (playerName: string) => void;
  setWallet: (wallet: WalletIdentity) => void;
  setWorldState: (world: WorldReactionState) => void;
  setSkillCatalog: (skills: AISkillDefinition[]) => void;
  setSkillLoadout: (input: { unlockedSkillIds?: string[]; activeSkillId?: string | null }) => void;
  setLaborRoutingState: (state: LaborRoutingState) => void;
  hydrateFromPersistence: (state: PersistedPlayerState) => void;
  setSettings: (settings: Partial<GameStoreState["settings"]>) => void;
  markHydrated: () => void;
};

export const bazaarGameStore = createStore<BazaarGameStore>((set) => ({
  sceneId: "boot",
  currentMapId: "village-exterior",
  player: {
    x: 0,
    y: 0,
    direction: "down" as Direction,
    moving: false,
  },
  nearbyInteractionId: null,
  focusedInteractionId: null,
  focusedNpcId: null,
  selectedDistrictId: "village-gate",
  objectiveTargetId: defaultWorldState.objectiveTargetId,
  questHighlightId: defaultWorldState.objectiveTargetId,
  liveStatus: null,
  proofs: [],
  pendingAction: null,
  playerName: "Agent Echo",
  wallet: {
    connected: false,
    validNetwork: false,
  },
  skillCatalog: [],
  unlockedSkillIds: [],
  activeSkillId: null,
  settings: {
    muted: false,
    lowEffects: false,
  },
  laborRouting: defaultLaborRoutingState,
  world: defaultWorldState,
  hydrated: false,
  setScene: (sceneId, mapId) =>
    set((state) => ({
      sceneId,
      currentMapId: mapId ?? state.currentMapId,
    })),
  setPlayerState: (player) =>
    set((state) => ({
      player: {
        ...state.player,
        ...player,
      },
    })),
  setFocus: ({ interactionId, npcId, districtId }) =>
    set(() => ({
      nearbyInteractionId: interactionId ?? null,
      focusedInteractionId: interactionId ?? null,
      focusedNpcId: npcId ?? null,
      selectedDistrictId: districtId ?? null,
    })),
  setQuestHighlight: (targetId, mapId) =>
    set((state) => ({
      questHighlightId: targetId,
      objectiveTargetId: targetId,
      currentMapId: mapId ?? state.currentMapId,
    })),
  setLiveStatus: (liveStatus) => set(() => ({ liveStatus })),
  setPendingAction: (pendingAction) => set(() => ({ pendingAction })),
  pushProofs: (proofs) =>
    set((state) => {
      const proofMap = new Map(state.proofs.map((proof) => [proof.id, proof] as const));
      proofs.forEach((proof) => {
        proofMap.set(proof.id, proof);
      });
      return {
        proofs: Array.from(proofMap.values()).sort((left, right) =>
          left.createdAt < right.createdAt ? 1 : -1,
        ),
      };
    }),
  setPlayerName: (playerName) =>
    set(() => ({
      playerName,
    })),
  setWallet: (wallet) =>
    set((state) => ({
      wallet: {
        ...state.wallet,
        ...wallet,
      },
    })),
  setWorldState: (world) =>
    set(() => ({
      world,
      objectiveTargetId: world.objectiveTargetId,
    })),
  setSkillCatalog: (skillCatalog) => set(() => ({ skillCatalog })),
  setSkillLoadout: ({ unlockedSkillIds, activeSkillId }) =>
    set((state) => ({
      unlockedSkillIds: unlockedSkillIds ?? state.unlockedSkillIds,
      activeSkillId:
        activeSkillId === undefined
          ? state.activeSkillId
          : activeSkillId,
    })),
  setLaborRoutingState: (laborRouting) => set(() => ({ laborRouting })),
  hydrateFromPersistence: (persisted) =>
    set((state) => ({
      currentMapId: persisted.currentMapId,
      objectiveTargetId: persisted.activeQuestStepId ?? state.objectiveTargetId,
      questHighlightId: persisted.activeQuestStepId ?? state.questHighlightId,
      playerName: persisted.playerName ?? state.playerName,
      unlockedSkillIds: persisted.unlockedSkillIds,
      activeSkillId: persisted.activeSkillId ?? state.activeSkillId,
      laborRouting: persisted.laborRouting ?? state.laborRouting,
      settings: {
        muted: persisted.muted,
        lowEffects: persisted.lowEffects,
      },
    })),
  setSettings: (settings) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ...settings,
      },
    })),
  markHydrated: () => set(() => ({ hydrated: true })),
}));

export function useBazaarGameStore<T>(selector: (state: BazaarGameStore) => T) {
  return useStore(bazaarGameStore, selector);
}
