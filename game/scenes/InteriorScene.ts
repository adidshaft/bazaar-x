import type { MapId } from "@/game/core/live-types";
import { BaseWorldScene } from "./base-world-scene";

const titleMap: Record<MapId, { title: string; subtitle: string }> = {
  "village-exterior": {
    title: "Bazaar X Village",
    subtitle: "Late-afternoon X Layer economy",
  },
  "forge-interior": {
    title: "Bazaar Forge",
    subtitle: "Create demand and open the first live shop",
  },
  "depot-interior": {
    title: "Supply Coil Depot",
    subtitle: "List routes and dispatch the next hire",
  },
  "treasury-interior": {
    title: "Treasury Vault",
    subtitle: "Read tax proof as light and reserve notices",
  },
  "council-interior": {
    title: "Covenant Hall",
    subtitle: "Propose, vote, and execute live governance",
  },
};

export class InteriorScene extends BaseWorldScene {
  constructor() {
    super("InteriorScene");
  }

  protected resolveDefaultMapId(): MapId {
    return "forge-interior";
  }

  protected resolveSceneId() {
    return "interior" as const;
  }

  protected resolveSceneCard(mapId: MapId) {
    return titleMap[mapId];
  }
}

