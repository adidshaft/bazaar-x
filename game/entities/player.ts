import * as Phaser from "phaser";
import type { Direction } from "@/game/core/live-types";

type MovementIntent = {
  dx: number;
  dy: number;
};

export class PlayerCharacter {
  sprite: Phaser.Physics.Arcade.Sprite;
  private speed = 112;
  private pointerTarget: Phaser.Math.Vector2 | null = null;
  private direction: Direction = "down";

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(x, y, "player-down-idle-0");
    this.sprite.setSize(14, 10);
    this.sprite.setOffset(5, 16);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(y);
  }

  getDirection() {
    return this.direction;
  }

  getPosition() {
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  setPointerTarget(x: number, y: number) {
    this.pointerTarget = new Phaser.Math.Vector2(x, y);
  }

  clearPointerTarget() {
    this.pointerTarget = null;
  }

  teleport(x: number, y: number) {
    this.pointerTarget = null;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | null;
    body?.reset(x, y);
    this.sprite.setPosition(x, y);
    this.sprite.setDepth(y);
  }

  update(intent: MovementIntent) {
    let dx = intent.dx;
    let dy = intent.dy;

    if (dx !== 0 || dy !== 0) {
      this.pointerTarget = null;
    }

    if (dx === 0 && dy === 0 && this.pointerTarget) {
      const distance = Phaser.Math.Distance.Between(
        this.sprite.x,
        this.sprite.y,
        this.pointerTarget.x,
        this.pointerTarget.y,
      );

      if (distance <= 8) {
        this.pointerTarget = null;
      } else {
        dx = (this.pointerTarget.x - this.sprite.x) / distance;
        dy = (this.pointerTarget.y - this.sprite.y) / distance;
      }
    }

    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const vector = new Phaser.Math.Vector2(dx, dy).normalize().scale(this.speed);
      this.sprite.setVelocity(vector.x, vector.y);
      this.direction = Math.abs(vector.x) > Math.abs(vector.y)
        ? vector.x >= 0
          ? "right"
          : "left"
        : vector.y >= 0
          ? "down"
          : "up";

      this.sprite.anims.play(`player:walk:${this.direction}`, true);
    } else {
      this.sprite.setVelocity(0, 0);
      this.sprite.setTexture(`player-${this.direction}-idle-0`);
    }

    this.sprite.setDepth(this.sprite.y);
    return {
      x: this.sprite.x,
      y: this.sprite.y,
      direction: this.direction,
      moving,
    };
  }
}
