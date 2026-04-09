import * as Phaser from "phaser";
import { bazaarGameStore } from "@/game/core/store";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    bazaarGameStore.getState().setScene("boot");
    this.scene.start("PreloadScene");
  }
}
