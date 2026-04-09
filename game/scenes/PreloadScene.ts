import * as Phaser from "phaser";
import { ensureGeneratedTileTextures } from "@/game/assets/tilesets/generated-tiles";
import {
  ensureGeneratedSpriteTextures,
  registerGeneratedAnimations,
} from "@/game/assets/sprites/generated-sprites";
import { compiledMapManifest } from "@/game/maps/manifest";
import { bazaarGameStore } from "@/game/core/store";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
    Object.values(compiledMapManifest).forEach((map) => {
      this.load.tilemapTiledJSON(map.bazaarx.mapId, map as object);
    });
  }

  create() {
    ensureGeneratedTileTextures(this);
    ensureGeneratedSpriteTextures(this);
    registerGeneratedAnimations(this);

    bazaarGameStore.getState().setScene("preload");
    this.scene.launch("UIScene");
    this.scene.launch("CutsceneScene");

    const currentMapId = bazaarGameStore.getState().currentMapId;
    if (currentMapId === "village-exterior") {
      this.scene.start("OverworldScene", { mapId: currentMapId, spawnId: "gate-spawn" });
    } else {
      this.scene.start("InteriorScene", { mapId: currentMapId });
    }
  }
}
