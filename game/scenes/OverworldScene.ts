import * as Phaser from "phaser";
import type { MapId, WorldReactionState } from "@/game/core/live-types";
import { TILE_SIZE } from "@/game/config/constants";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import { bazaarGameStore } from "@/game/core/store";
import { findGridPath } from "@/game/systems/a-star-grid";
import { BaseWorldScene } from "./base-world-scene";
import { WorldUpgradeSystem } from "./world-upgrade-system";

export class OverworldScene extends BaseWorldScene {
  private upgradeSystem?: WorldUpgradeSystem;
  private taxParticlePool?: Phaser.GameObjects.Group;
  private walkGrid: boolean[][] = [];

  constructor() {
    super("OverworldScene");
  }

  protected resolveDefaultMapId(): MapId {
    return "village-exterior";
  }

  protected resolveSceneId() {
    return "overworld" as const;
  }

  protected resolveSceneCard() {
    return {
      title: "Bazaar X Village",
      subtitle: "Late-afternoon X Layer economy",
    };
  }

  protected afterWorldCreate() {
    if (this.mapId !== "village-exterior") {
      return;
    }

    this.upgradeSystem = new WorldUpgradeSystem(this);
    this.upgradeSystem.apply(bazaarGameStore.getState().world);
    this.createTaxParticlePool();
    this.buildWalkGrid();

    const offTax = bazaarEventBridge.on("economy:tax-collected", () => {
      this.animateTaxFlow();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offTax();
    });
  }

  protected onWorldStateApplied(world: WorldReactionState) {
    this.upgradeSystem?.apply(world);
  }

  private createTaxParticlePool() {
    this.taxParticlePool = this.add.group({
      maxSize: 60,
      runChildUpdate: false,
    });

    for (let index = 0; index < 60; index += 1) {
      const coin = this.add.image(-100, -100, "fx-coin");
      coin.setVisible(false);
      coin.setActive(false);
      coin.setScale(0.22);
      coin.setAlpha(0);
      coin.setBlendMode(Phaser.BlendModes.ADD);
      this.taxParticlePool.add(coin);
    }
  }

  private buildWalkGrid() {
    const tilemap = this.getTilemap();
    const collisionLayer = this.collisionLayer;
    if (!tilemap) {
      return;
    }

    this.walkGrid = Array.from({ length: tilemap.height }, (_, y) =>
      Array.from({ length: tilemap.width }, (_, x) => {
        const tile = collisionLayer?.getTileAt(x, y);
        return !(tile && tile.index > 0);
      }),
    );
  }

  private animateTaxFlow() {
    if (!this.taxParticlePool || this.walkGrid.length === 0) {
      return;
    }

    const source = this.getWorldInteractables().find((entry) => entry.id === "forge-door");
    const treasury = this.getWorldInteractables().find((entry) => entry.id === "treasury-door");
    if (!source || !treasury) {
      return;
    }

    const pathPoints = findGridPath(
      this.walkGrid,
      {
        x: Math.floor(source.center.x / TILE_SIZE),
        y: Math.floor(source.center.y / TILE_SIZE),
      },
      {
        x: Math.floor(treasury.center.x / TILE_SIZE),
        y: Math.floor(treasury.center.y / TILE_SIZE),
      },
    ).map((point) => new Phaser.Math.Vector2(point.x * TILE_SIZE + TILE_SIZE / 2, point.y * TILE_SIZE + TILE_SIZE / 2));

    const path = new Phaser.Curves.Path(pathPoints[0]?.x ?? source.center.x, pathPoints[0]?.y ?? source.center.y);
    pathPoints.slice(1).forEach((point) => {
      path.lineTo(point.x, point.y);
    });

    for (let index = 0; index < 50; index += 1) {
      const coin = this.taxParticlePool.getFirstDead(false) as Phaser.GameObjects.Image | null;
      if (!coin) {
        break;
      }

      coin.setVisible(true);
      coin.setActive(true);
      coin.setScale(0.18 + Math.random() * 0.08);
      coin.setAlpha(0.92);

      const progress = { value: 0 };
      this.tweens.add({
        targets: progress,
        value: 1,
        duration: 900 + Math.random() * 260,
        delay: index * 16,
        ease: "Sine.easeInOut",
        onStart: () => {
          coin.setPosition(source.center.x, source.center.y - 10);
        },
        onUpdate: () => {
          const point = path.getPoint(progress.value);
          if (!point) {
            return;
          }

          coin.setPosition(point.x, point.y - 10);
          coin.setDepth(point.y + 120);
          coin.setAlpha(progress.value > 0.86 ? 1 - (progress.value - 0.86) / 0.14 : 0.92);
        },
        onComplete: () => {
          coin.setVisible(false);
          coin.setActive(false);
          coin.setPosition(-100, -100);
        },
      });
    }
  }
}
