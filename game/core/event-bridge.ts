import type { Hex } from "viem";
import type { DistrictId, LiveDashboardStatus, MapId, QuestActionId } from "./live-types";

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

