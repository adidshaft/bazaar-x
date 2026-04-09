import * as Phaser from "phaser";
import { bazaarGameStore } from "@/game/core/store";

function humanize(id: string | null) {
  return id ? id.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "";
}

export class UIScene extends Phaser.Scene {
  private promptPanel!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;

  constructor() {
    super("UIScene");
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;
    const panel = this.add.container(width / 2, height - 48);
    panel.setScrollFactor(0);
    panel.setDepth(5000);

    const background = this.add.rectangle(0, 0, 420, 60, 0x1d1612, 0.82).setStrokeStyle(2, 0xe8d28d, 0.55);
    this.promptText = this.add.text(-188, -10, "", {
      color: "#f7eed7",
      fontFamily: "monospace",
      fontSize: "14px",
    });
    this.objectiveText = this.add.text(-188, 10, "", {
      color: "#d5c59e",
      fontFamily: "monospace",
      fontSize: "11px",
    });

    panel.add([background, this.promptText, this.objectiveText]);
    this.promptPanel = panel;
  }

  update() {
    const state = bazaarGameStore.getState();
    const prompt = state.focusedInteractionId
      ? `E  ${humanize(state.focusedInteractionId)}`
      : "Walk to a lantern ring to interact";

    this.promptText.setText(prompt);
    this.objectiveText.setText(`Objective: ${humanize(state.objectiveTargetId)}`);
    this.promptPanel.setAlpha(state.settings.lowEffects ? 0.9 : 1);
  }
}
