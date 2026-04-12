import * as Phaser from "phaser";
import type { MapId } from "@/game/core/live-types";
import { BaseWorldScene } from "./base-world-scene";
import { CouncilHeroSystem } from "./council-hero-system";

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
  private councilHeroSystem?: CouncilHeroSystem;

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

  protected augmentInteractables() {
    if (this.mapId !== "council-interior") {
      return;
    }

    this.interactables.push({
      id: "skill-altar",
      name: "skill-altar",
      center: new Phaser.Math.Vector2(288, 270),
      radius: 48,
      districtId: "council-hall",
      label: "Skill Altar",
    });
  }

  protected afterWorldCreate() {
    if (this.mapId !== "council-interior") {
      return;
    }

    this.councilHeroSystem = new CouncilHeroSystem(this);
  }

  protected afterWorldUpdate(time: number, delta: number) {
    this.councilHeroSystem?.update(time, delta);
  }

  protected onWorldStateApplied(world: import("@/game/core/live-types").WorldReactionState) {
    this.councilHeroSystem?.apply(world);
  }
}
