import * as Phaser from "phaser";

export class CutsceneScene extends Phaser.Scene {
  private container!: Phaser.GameObjects.Container;
  private backdrop!: Phaser.GameObjects.Rectangle;
  private badgeText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;

  constructor() {
    super("CutsceneScene");
  }

  create() {
    const width = this.scale.width;
    this.backdrop = this.add.rectangle(width / 2, 72, width, 108, 0x05080d, 0);
    this.backdrop.setScrollFactor(0);
    this.backdrop.setDepth(5980);
    this.backdrop.setBlendMode(Phaser.BlendModes.NORMAL);

    this.container = this.add.container(width / 2, 64);
    this.container.setScrollFactor(0);
    this.container.setDepth(6000);
    this.container.setAlpha(0);

    const glow = this.add.rectangle(0, 0, 438, 88, 0x7de6ff, 0.1).setBlendMode(Phaser.BlendModes.ADD);
    const card = this.add.rectangle(0, 0, 402, 74, 0x101923, 0.88).setStrokeStyle(2, 0x7de6ff, 0.56);
    this.badgeText = this.add.text(0, -18, "", {
      color: "#7de6ff",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "8px",
    }).setOrigin(0.5);
    this.titleText = this.add.text(0, -9, "", {
      color: "#f0fbff",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "14px",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.subtitleText = this.add.text(0, 14, "", {
      color: "#acc4d6",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "10px",
    }).setOrigin(0.5);

    this.container.add([glow, card, this.badgeText, this.titleText, this.subtitleText]);
    this.events.on("show-title", (payload: { title: string; subtitle: string }) => {
      this.showTitle(payload.title, payload.subtitle);
    });
  }

  private showTitle(title: string, subtitle: string) {
    const badge = subtitle.split(",")[0]?.trim().toUpperCase() ?? "DISTRICT";
    this.badgeText.setText(`ARRIVAL · ${badge}`);
    this.titleText.setText(title);
    this.subtitleText.setText(subtitle);
    this.backdrop.setAlpha(0);
    this.container.setAlpha(1);
    this.container.setY(54);
    this.container.setScale(0.96);

    this.tweens.killTweensOf(this.backdrop);
    this.tweens.killTweensOf(this.container);
    this.tweens.add({
      targets: this.backdrop,
      alpha: 0.22,
      duration: 180,
      ease: "Sine.easeOut",
      yoyo: true,
      hold: 420,
    });
    this.tweens.add({
      targets: this.container,
      alpha: 1,
      y: 64,
      scale: 1,
      duration: 220,
      ease: "Sine.easeOut",
    });
    this.tweens.add({
      targets: this.container,
      alpha: 0,
      y: 76,
      delay: 1380,
      duration: 520,
      ease: "Sine.easeOut",
    });
  }
}
