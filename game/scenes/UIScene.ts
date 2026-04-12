import * as Phaser from "phaser";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import { bazaarGameStore } from "@/game/core/store";
import { explorerTxUrl } from "@/lib/xlayer";

function humanize(id: string | null) {
  return id ? id.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "";
}

export class UIScene extends Phaser.Scene {
  private promptPanel!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private activeToasts: Phaser.GameObjects.Container[] = [];
  private txPill?: {
    actionId: string;
    container: Phaser.GameObjects.Container;
    background: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    link: Phaser.GameObjects.Text;
    fadeCall?: Phaser.Time.TimerEvent;
    status: "pending" | "confirmed" | "failed";
    txHash?: string;
  };
  private unsubscribers: Array<() => void> = [];

  constructor() {
    super("UIScene");
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;
    const panel = this.add.container(width / 2, height - 20);
    panel.setScrollFactor(0);
    panel.setDepth(5000);

    const background = this.add
      .rectangle(0, 0, 300, 24, 0x0f1821, 0.62)
      .setStrokeStyle(1, 0x84ddff, 0.28);
    this.promptText = this.add.text(-140, 0, "", {
      color: "#eef8ff",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "7px",
    });
    this.promptText.setOrigin(0, 0.5);

    panel.add([background, this.promptText]);
    this.promptPanel = panel;

    this.unsubscribers.push(
      bazaarEventBridge.on("toast:show", (payload) => {
        this.showToast(payload);
      }),
      bazaarEventBridge.on("tx:submitted", ({ actionId, label }) => {
        this.showTxPill(actionId, label);
      }),
      bazaarEventBridge.on("tx:confirmed", ({ actionId, txHash }) => {
        this.updateTxPill(actionId, "confirmed", txHash);
      }),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribers.forEach((unsubscribe) => unsubscribe());
      this.unsubscribers = [];
      this.destroyTxPill();
    });
  }

  update() {
    const state = bazaarGameStore.getState();
    const focusedLabel = humanize(state.focusedInteractionId);
    const objectiveLabel = humanize(state.objectiveTargetId);
    const prompt = state.focusedInteractionId
      ? `E inspect ${focusedLabel}`
      : objectiveLabel
        ? `Objective ${objectiveLabel}`
        : "WASD move  E inspect";

    this.promptText.setText(prompt);
    this.promptPanel.setAlpha(state.focusedInteractionId ? 0.92 : 0.46);

    if (
      this.txPill &&
      state.pendingAction?.actionId === this.txPill.actionId &&
      state.pendingAction.status === "failed" &&
      this.txPill.status !== "failed"
    ) {
      this.updateTxPill(this.txPill.actionId, "failed");
    }

    if (this.txPill && !state.pendingAction && this.txPill.status === "pending") {
      this.destroyTxPill();
    }
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

  private showTxPill(actionId: string, label: string) {
    this.destroyTxPill();

    const width = this.scale.width;
    const background = this.add
      .rectangle(0, 0, 340, 28, 0x0c1520, 0.94)
      .setStrokeStyle(2, 0xffd700, 0.55);
    const pillLabel = this.add.text(-150, 0, `Sending: ${label}`, {
      color: "#f8f3cf",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "7px",
    });
    pillLabel.setOrigin(0, 0.5);

    const link = this.add.text(150, 0, "", {
      color: "#7de6ff",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "7px",
    });
    link.setOrigin(1, 0.5);
    link.setVisible(false);

    const container = this.add.container(width / 2, 52, [background, pillLabel, link]);
    container.setScrollFactor(0);
    container.setDepth(5200);
    container.setAlpha(0);
    container.setScale(0.96);

    this.txPill = {
      actionId,
      container,
      background,
      label: pillLabel,
      link,
      status: "pending",
    };

    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: "Sine.easeOut",
    });
  }

  private updateTxPill(actionId: string, status: "confirmed" | "failed", txHash?: string) {
    if (!this.txPill || this.txPill.actionId !== actionId) {
      return;
    }

    this.txPill.fadeCall?.remove(false);
    this.txPill.status = status;
    this.txPill.txHash = txHash;
    this.txPill.background.setStrokeStyle(2, status === "confirmed" ? 0x8ff0d5 : 0xff7474, 0.6);
    this.txPill.label.setColor(status === "confirmed" ? "#dffcf2" : "#ffd8d8");
    this.txPill.label.setText(status === "confirmed" ? "Confirmed" : "Transaction Failed");
    this.txPill.link.setText(txHash ? "View" : "");
    this.txPill.link.setVisible(Boolean(txHash));

    if (txHash) {
      const url = explorerTxUrl(txHash);
      this.txPill.link.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        window.open(url, "_blank", "noopener,noreferrer");
      });
    } else {
      this.txPill.link.disableInteractive();
    }

    this.tweens.add({
      targets: this.txPill.container,
      scale: 1.06,
      yoyo: true,
      duration: 140,
      ease: "Back.easeOut",
    });

    this.txPill.fadeCall = this.time.delayedCall(3_000, () => {
      if (!this.txPill || this.txPill.actionId !== actionId) {
        return;
      }
      this.tweens.add({
        targets: this.txPill.container,
        alpha: 0,
        y: this.txPill.container.y - 8,
        duration: 220,
        ease: "Sine.easeIn",
        onComplete: () => this.destroyTxPill(),
      });
    });
  }

  private destroyTxPill() {
    if (!this.txPill) {
      return;
    }
    this.txPill.fadeCall?.remove(false);
    this.txPill.container.destroy();
    this.txPill = undefined;
  }
}
