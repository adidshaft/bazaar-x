import * as Phaser from "phaser";
import type { MapId } from "@/game/core/live-types";
import { BaseWorldScene } from "./base-world-scene";
import { CouncilHeroSystem } from "./council-hero-system";

const titleMap: Record<MapId, { title: string; subtitle: string }> = {
  "village-exterior": {
    title: "Bazaar X Village",
    subtitle: "Citizenship, shops, labor, tax, and rule replay",
  },
  "forge-interior": {
    title: "Bazaar Forge",
    subtitle: "Open the first shop and wake demand",
  },
  "depot-interior": {
    title: "Supply Coil Depot",
    subtitle: "List routes and dispatch fulfillment",
  },
  "treasury-interior": {
    title: "Treasury Vault",
    subtitle: "Read tax receipts, reserves, and reinvestment",
  },
  "council-interior": {
    title: "Covenant Hall",
    subtitle: "Propose, vote, execute, and replay the rule",
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
      label: "Covenant Altar",
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
