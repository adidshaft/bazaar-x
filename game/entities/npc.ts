import * as Phaser from "phaser";

export class NpcActor {
  readonly id: string;
  readonly sprite: Phaser.GameObjects.Sprite;
  private path: Phaser.Math.Vector2[];
  private pathIndex = 0;
  private speed: number;
  private direction: "down" | "up" | "left" | "right" = "down";

  constructor(scene: Phaser.Scene, id: string, texturePrefix: string, start: Phaser.Math.Vector2, path: Phaser.Math.Vector2[]) {
    this.id = id;
    this.path = path.length ? path : [start];
    this.speed = 28;
    this.sprite = scene.add.sprite(start.x, start.y, `${texturePrefix}-down-idle-0`);
    this.sprite.setOrigin(0.5, 0.78);
    this.sprite.setDepth(start.y);
    this.sprite.setName(texturePrefix);
  }

  getPosition() {
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  update(deltaSeconds: number) {
    if (this.path.length < 2) {
      return;
    }

    const target = this.path[this.pathIndex]!;
    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, target.x, target.y);

    if (distance <= 3) {
      this.pathIndex = (this.pathIndex + 1) % this.path.length;
      this.sprite.setTexture(`${this.sprite.name}-${this.direction}-idle-0`);
      return;
    }

    const step = (this.speed * deltaSeconds) / distance;
    this.sprite.x = Phaser.Math.Linear(this.sprite.x, target.x, step);
    this.sprite.y = Phaser.Math.Linear(this.sprite.y, target.y, step);
    this.direction = Math.abs(target.x - this.sprite.x) > Math.abs(target.y - this.sprite.y)
      ? target.x >= this.sprite.x
        ? "right"
        : "left"
      : target.y >= this.sprite.y
        ? "down"
        : "up";
    this.sprite.anims.play(`${this.sprite.name}:walk:${this.direction}`, true);
    this.sprite.setDepth(this.sprite.y);
  }
}
