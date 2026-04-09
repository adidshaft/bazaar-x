import type { MapId } from "@/game/core/live-types";
import { BaseWorldScene } from "./base-world-scene";

export class OverworldScene extends BaseWorldScene {
  constructor() {
    super("OverworldScene");
  }

  protected resolveDefaultMapId(): MapId {
    return "village-exterior";
  }

  protected resolveSceneId() {
    return "overworld" as const;
  }

  protected resolveSceneCard() {
    return {
      title: "Bazaar X Village",
      subtitle: "Late-afternoon X Layer economy",
    };
  }
}

