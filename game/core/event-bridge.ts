import type { Hex } from "viem";
import type { DistrictId, LiveDashboardStatus, MapId, ProofArtifact, QuestActionId } from "./live-types";

type BridgePayloads = {
  "district:selected": {
    districtId: DistrictId;
    interactionId: string;
    mapId: MapId;
  };
  "npc:interact": {
    npcId: string;
    interactionId: string;
    mapId: MapId;
  };
  "quest:started": {
    questId: string;
    stepId: string;
  };
  "governance:open": {
    mapId: MapId;
  };
  "tx:submitted": {
    actionId: QuestActionId;
    label: string;
    txHash?: Hex;
  };
  "tx:confirmed": {
    actionId: QuestActionId;
    stepKey: string;
    txHash?: Hex;
  };
  "player:teleport": {
    mapId?: MapId;
    spawnId?: string;
    x?: number;
    y?: number;
  };
  "quest:highlight": {
    targetId: string | null;
    mapId?: MapId;
  };
  "economy:sync": {
    status: LiveDashboardStatus | null;
  };
  "scene:enter": {
    mapId: MapId;
    spawnId?: string;
  };
  "ui:viewport-changed": {
    briefOpen: boolean;
    drawerOpen: boolean;
    leftWidth: number;
    rightWidth: number;
  };
  "toast:show": {
    id: string;
    title: string;
    body?: string;
    tone?: "tax" | "success" | "proof" | "skill";
    durationMs?: number;
  };
  "economy:tax-collected": {
    id: string;
    amountOkb: string;
    txHash?: Hex;
    explorerUrl?: string;
  };
  "camera:flash": {
    duration: number;
    red?: number;
    green?: number;
    blue?: number;
  };
  "camera:focus-mode": {
    active: boolean;
  };
  "skill:altar-open": {
    mapId: MapId;
  };
  "skill:altar-close": {
    mapId: MapId;
  };
  "skill:activated": {
    skillId: string | null;
  };
  "skill:unlock-success": {
    skillId: string;
  };
  "skill:delegate-trade": {
    skillId: string;
    agentNpcId: string;
    delegatedAction: string;
  };
  "proof:verified": {
    proof: ProofArtifact;
  };
  "proof:scroll-picked": {
    proof: ProofArtifact;
  };
};

type BridgeEventName = keyof BridgePayloads;
type Listener<TEvent extends BridgeEventName> = (payload: BridgePayloads[TEvent]) => void;

class TypedEventBridge {
  private listeners = new Map<BridgeEventName, Set<Listener<BridgeEventName>>>();

  emit<TEvent extends BridgeEventName>(event: TEvent, payload: BridgePayloads[TEvent]) {
    const listeners = this.listeners.get(event);
    listeners?.forEach((listener) => {
      (listener as Listener<TEvent>)(payload);
    });
  }

  on<TEvent extends BridgeEventName>(event: TEvent, listener: Listener<TEvent>) {
    const listeners = this.listeners.get(event) ?? new Set<Listener<BridgeEventName>>();
    listeners.add(listener as Listener<BridgeEventName>);
    this.listeners.set(event, listeners);

    return () => {
      const next = this.listeners.get(event);
      next?.delete(listener as Listener<BridgeEventName>);
      if (next?.size === 0) {
        this.listeners.delete(event);
      }
    };
  }
}

export const bazaarEventBridge = new TypedEventBridge();
