import * as Phaser from "phaser";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import { bazaarGameStore } from "@/game/core/store";

function humanize(id: string | null) {
  return id ? id.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "";
}

export class UIScene extends Phaser.Scene {
  private promptPanel!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private activeToasts: Phaser.GameObjects.Container[] = [];
  private unsubscribers: Array<() => void> = [];

  constructor() {
    super("UIScene");
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;
    const panel = this.add.container(width / 2, height - 48);
    panel.setScrollFactor(0);
    panel.setDepth(5000);

    const background = this.add.rectangle(0, 0, 420, 60, 0x0f1821, 0.82).setStrokeStyle(2, 0x84ddff, 0.55);
    this.promptText = this.add.text(-188, -10, "", {
      color: "#eef8ff",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "14px",
    });
    this.objectiveText = this.add.text(-188, 10, "", {
      color: "#a9c0cf",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "11px",
    });

    panel.add([background, this.promptText, this.objectiveText]);
    this.promptPanel = panel;

    this.unsubscribers.push(
      bazaarEventBridge.on("toast:show", (payload) => {
        this.showToast(payload);
      }),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribers.forEach((unsubscribe) => unsubscribe());
      this.unsubscribers = [];
    });
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

  private showToast(payload: {
    id: string;
    title: string;
    body?: string;
    tone?: "tax" | "success" | "proof" | "skill";
    durationMs?: number;
  }) {
    const width = this.scale.width;
    const y = 40 + this.activeToasts.length * 58;
    const toneColor =
      payload.tone === "tax"
        ? 0xffc46f
        : payload.tone === "success"
          ? 0x8ff0d5
          : payload.tone === "skill"
            ? 0xb79bff
            : 0x7de6ff;

    const background = this.add
      .rectangle(0, 0, 280, 48, 0x0c1520, 0.88)
      .setStrokeStyle(2, toneColor, 0.55);
    const title = this.add.text(-122, -10, payload.title.toUpperCase(), {
      color: "#eef9ff",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "9px",
    });
    const body = this.add.text(-122, 8, payload.body ?? "", {
      color: "#b8cfde",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "7px",
      wordWrap: { width: 236 },
    });

    const container = this.add.container(width - 168, y, [background, title, body]);
    container.setScrollFactor(0);
    container.setDepth(5200);
    container.setAlpha(0);
    container.setScale(0.96);
    this.activeToasts.push(container);

    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 150,
      ease: "Sine.easeOut",
    });

    this.time.delayedCall(payload.durationMs ?? 2200, () => {
      this.tweens.add({
        targets: container,
        alpha: 0,
        y: container.y - 8,
        duration: 180,
        ease: "Sine.easeIn",
        onComplete: () => {
          container.destroy();
          this.activeToasts = this.activeToasts.filter((entry) => entry !== container);
          this.activeToasts.forEach((entry, index) => {
            entry.setY(40 + index * 58);
          });
        },
      });
    });
  }
}
