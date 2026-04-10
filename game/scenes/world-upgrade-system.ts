import * as Phaser from "phaser";
import type { WorldReactionState } from "@/game/core/live-types";
import { TILE_SIZE } from "@/game/config/constants";
import { BaseWorldScene } from "./base-world-scene";

const lanternAnchors = ["settlement-keep", "forge-door", "depot-door", "treasury-door", "council-door"];

function setLayerFromSnapshot(
  layer: Phaser.Tilemaps.TilemapLayer | undefined,
  snapshot: number[][],
) {
  if (!layer) {
    return;
  }

  snapshot.forEach((row, y) => {
    row.forEach((index, x) => {
      layer.putTileAt(index <= 0 ? -1 : index, x, y);
    });
  });
}

function cloneLayer(layer: Phaser.Tilemaps.TilemapLayer | undefined) {
  if (!layer) {
    return [];
  }

  return layer.layer.data.map((row) => row.map((tile) => tile.index));
}

function buildWaterSegments(tiles: Phaser.Tilemaps.Tile[]) {
  const grouped = new Map<number, number[]>();

  tiles.forEach((tile) => {
    const row = grouped.get(tile.y) ?? [];
    row.push(tile.x);
    grouped.set(tile.y, row);
  });

  return [...grouped.entries()].flatMap(([tileY, tileXs]) => {
    const sortedXs = [...tileXs].sort((left, right) => left - right);
    const segments: Array<{ tileY: number; startX: number; endX: number }> = [];

    sortedXs.forEach((tileX) => {
      const previous = segments.at(-1);
      if (!previous || tileX > previous.endX + 1) {
        segments.push({ tileY, startX: tileX, endX: tileX });
        return;
      }

      previous.endX = tileX;
    });

    return segments;
  });
}

export class WorldUpgradeSystem {
  private currentTier = -1;
  private readonly groundLayer: Phaser.Tilemaps.TilemapLayer | undefined;
  private readonly detailsLayer: Phaser.Tilemaps.TilemapLayer | undefined;
  private readonly baseGround: number[][];
  private readonly baseDetails: number[][];
  private readonly lanterns: Array<{
    sprite: Phaser.GameObjects.Image;
    glow?: Phaser.FX.Glow;
  }> = [];
  private readonly waterShimmer: Phaser.GameObjects.Rectangle[] = [];

  constructor(private readonly scene: BaseWorldScene) {
    this.groundLayer = this.scene.getRenderLayer("ground");
    this.detailsLayer = this.scene.getRenderLayer("details");
    this.baseGround = cloneLayer(this.groundLayer);
    this.baseDetails = cloneLayer(this.detailsLayer);
    this.createLanterns();
    this.createWaterShimmer();
  }

  apply(world: WorldReactionState) {
    if (this.currentTier !== world.worldTier) {
      this.restoreBase();

      if (world.worldTier >= 1) {
        this.applyGrowingTier();
      }

      if (world.worldTier >= 2) {
        this.applySovereignTier();
      }

      this.currentTier = world.worldTier;
    }

    const lanternAlpha = world.worldTier >= 1 ? 0.26 + world.lanternGlow * 0.22 : 0;
    this.lanterns.forEach((entry) => {
      entry.sprite.setVisible(world.worldTier >= 1);
      entry.sprite.setAlpha(lanternAlpha);
      if (entry.glow) {
        entry.glow.outerStrength = 1.4 + world.lanternGlow * 2.4;
      }
    });

    this.waterShimmer.forEach((segment) => {
      segment.setVisible(world.worldTier >= 2);
      segment.setAlpha(world.worldTier >= 2 ? 0.08 + Math.min(0.1, world.gdpScore / 220) : 0);
    });
  }

  private restoreBase() {
    setLayerFromSnapshot(this.groundLayer, this.baseGround);
    setLayerFromSnapshot(this.detailsLayer, this.baseDetails);

    this.scene.getBuildingSpriteLookup().forEach((sprites) => {
      sprites.forEach((sprite) => {
        const baseTexture = sprite.getData("baseTexture");
        if (typeof baseTexture === "string") {
          sprite.setTexture(baseTexture);
        }
        sprite.clearTint();
      });
    });
  }

  private applyGrowingTier() {
    const mapWidth = this.scene.getTilemap()?.width ?? 0;
    const mapHeight = this.scene.getTilemap()?.height ?? 0;
    this.groundLayer?.replaceByIndex(1, 5, 0, 0, mapWidth, mapHeight);
    this.groundLayer?.replaceByIndex(2, 5, 0, 0, mapWidth, mapHeight);
    this.groundLayer?.replaceByIndex(3, 4, 0, 0, mapWidth, mapHeight);
  }

  private applySovereignTier() {
    const mapWidth = this.scene.getTilemap()?.width ?? 0;
    const mapHeight = this.scene.getTilemap()?.height ?? 0;
    this.detailsLayer?.replaceByIndex(2, 19, 0, 0, mapWidth, mapHeight);

    this.scene.getBuildingSpriteLookup().forEach((sprites) => {
      sprites.forEach((sprite) => {
        const sovereignTexture = `${sprite.texture.key}-sovereign`;
        if (this.scene.textures.exists(sovereignTexture)) {
          sprite.setTexture(sovereignTexture);
          return;
        }

        sprite.setTint(0xd6c27f, 0xd6c27f, 0x7b8796, 0x7b8796);
      });
    });
  }

  private createLanterns() {
    lanternAnchors.forEach((anchorId, index) => {
      const interactable = this.scene.getWorldInteractables().find((entry) => entry.id === anchorId);
      if (!interactable) {
        return;
      }

      const x = interactable.center.x + (index % 2 === 0 ? 34 : -34);
      const y = interactable.center.y - 46;
      const sprite = this.scene.add.image(x, y, "prop-lamp");
      sprite.setVisible(false);
      sprite.setAlpha(0);
      sprite.setScale(0.8);
      sprite.setDepth(y + 8);

      const glow = sprite.postFX?.addGlow(0xffd37c, 2.1, 0.2, false, 0.14, 10);
      this.scene.tweens.add({
        targets: sprite,
        y: y - 4,
        yoyo: true,
        repeat: -1,
        duration: 920 + index * 80,
        ease: "Sine.easeInOut",
      });

      this.lanterns.push({ sprite, glow });
    });
  }

  private createWaterShimmer() {
    buildWaterSegments(this.scene.getWaterTiles()).forEach((segment, index) => {
      const width = (segment.endX - segment.startX + 1) * TILE_SIZE;
      const x = segment.startX * TILE_SIZE + width / 2;
      const y = segment.tileY * TILE_SIZE + TILE_SIZE / 2;
      const shimmer = this.scene.add.rectangle(x, y, width, TILE_SIZE, 0x8cf5ff, 0);
      shimmer.setBlendMode(Phaser.BlendModes.ADD);
      shimmer.setDepth(y + 1);
      shimmer.setVisible(false);
      shimmer.postFX?.addShine(0.8, 0.28, 4, false);

      this.scene.tweens.add({
        targets: shimmer,
        alpha: { from: 0.04, to: 0.14 },
        yoyo: true,
        repeat: -1,
        duration: 1260 + index * 40,
        ease: "Sine.easeInOut",
      });

      this.waterShimmer.push(shimmer);
    });
  }
}
