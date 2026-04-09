import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, WORLD_ZOOM } from "@/game/config/constants";
import { bazaarEventBridge } from "./event-bridge";
import { BootScene } from "@/game/scenes/BootScene";
import { PreloadScene } from "@/game/scenes/PreloadScene";
import { OverworldScene } from "@/game/scenes/OverworldScene";
import { InteriorScene } from "@/game/scenes/InteriorScene";
import { UIScene } from "@/game/scenes/UIScene";
import { CutsceneScene } from "@/game/scenes/CutsceneScene";

export function createBazaarPhaserGame(parent: HTMLElement) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#ecd9b8",
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: WORLD_ZOOM,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [
      BootScene,
      PreloadScene,
      OverworldScene,
      InteriorScene,
      UIScene,
      CutsceneScene,
    ],
  });

  const offSceneEnter = bazaarEventBridge.on("scene:enter", ({ mapId, spawnId }) => {
    game.scene.start(mapId === "village-exterior" ? "OverworldScene" : "InteriorScene", {
      mapId,
      spawnId,
    });
  });

  game.events.on(Phaser.Core.Events.DESTROY, () => {
    offSceneEnter();
  });

  return game;
}
