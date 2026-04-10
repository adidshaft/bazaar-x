import * as Phaser from "phaser";

export class CutsceneScene extends Phaser.Scene {
  private container!: Phaser.GameObjects.Container;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;

  constructor() {
    super("CutsceneScene");
  }

  create() {
    const width = this.scale.width;
    this.container = this.add.container(width / 2, 56);
    this.container.setScrollFactor(0);
    this.container.setDepth(6000);
    this.container.setAlpha(0);

    const card = this.add.rectangle(0, 0, 380, 60, 0x101923, 0.8).setStrokeStyle(2, 0x7de6ff, 0.7);
    this.titleText = this.add.text(0, -9, "", {
      color: "#f0fbff",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "15px",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.subtitleText = this.add.text(0, 10, "", {
      color: "#acc4d6",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "11px",
    }).setOrigin(0.5);

    this.container.add([card, this.titleText, this.subtitleText]);
    this.events.on("show-title", (payload: { title: string; subtitle: string }) => {
      this.showTitle(payload.title, payload.subtitle);
    });
  }

  private showTitle(title: string, subtitle: string) {
    this.titleText.setText(title);
    this.subtitleText.setText(subtitle);
    this.container.setAlpha(1);

    this.tweens.killTweensOf(this.container);
    this.tweens.add({
      targets: this.container,
      alpha: 0,
      delay: 1500,
      duration: 900,
      ease: "Sine.easeOut",
    });
  }
}
