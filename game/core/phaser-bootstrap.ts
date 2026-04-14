import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@/game/config/constants";
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
    backgroundColor: "#081018",
    pixelArt: true,
    roundPixels: true,
    audio: {
      noAudio: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
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

  let transitionLocked = false;

  function transitionToScene(mapId: "village-exterior" | "forge-interior" | "depot-interior" | "treasury-interior" | "council-interior", spawnId?: string) {
    if (transitionLocked) {
      return;
    }

    transitionLocked = true;
    const sceneKey = mapId === "village-exterior" ? "OverworldScene" : "InteriorScene";
    const activeWorldScene = game.scene
      .getScenes(true)
      .find((scene) => scene.scene.key === "OverworldScene" || scene.scene.key === "InteriorScene");

    const startNextScene = () => {
      if (activeWorldScene) {
        // Use the scene plugin so the current world scene is stopped before the next one starts.
        activeWorldScene.scene.start(sceneKey, { mapId, spawnId });
      } else {
        game.scene.start(sceneKey, { mapId, spawnId });
      }
      transitionLocked = false;
    };

    if (!activeWorldScene) {
      startNextScene();
      return;
    }

    activeWorldScene.cameras.main.fadeOut(180, 7, 10, 16);
    activeWorldScene.time.delayedCall(160, startNextScene);
  }

  const offSceneEnter = bazaarEventBridge.on("scene:enter", ({ mapId, spawnId }) => {
    transitionToScene(mapId, spawnId);
  });

  game.events.on(Phaser.Core.Events.DESTROY, () => {
    offSceneEnter();
  });

  return game;
}
