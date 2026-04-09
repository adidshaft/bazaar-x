import * as Phaser from "phaser";
import { CAMERA_LERP, TILE_SIZE } from "@/game/config/constants";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import { bazaarGameStore } from "@/game/core/store";
import type { CompiledMapObject } from "@/game/core/map-types";
import type { DistrictId, MapId, SceneId, WorldReactionState } from "@/game/core/live-types";
import { getCompiledMap } from "@/game/maps/manifest";
import { buildingDefinitions } from "@/game/data/world";
import { npcDefinitions } from "@/game/data/npcs";
import { PlayerCharacter } from "@/game/entities/player";
import { NpcActor } from "@/game/entities/npc";
import { createWorldInteractable, type WorldInteractable } from "@/game/entities/interactable";

type ScenePayload = {
  mapId?: MapId;
  spawnId?: string;
};

type BuildingSpriteConfig = {
  texture: string;
  yOffset: number;
};

const buildingSpriteMap: Record<string, BuildingSpriteConfig> = {
  "settlement-keep": { texture: "building-keep", yOffset: 74 },
  "forge-door": { texture: "building-forge", yOffset: 74 },
  "depot-door": { texture: "building-depot", yOffset: 74 },
  "guild-yard": { texture: "building-guild", yOffset: 58 },
  "treasury-door": { texture: "building-treasury", yOffset: 74 },
  "council-door": { texture: "building-council", yOffset: 74 },
};

const interiorDecorMap: Partial<Record<MapId, string>> = {
  "forge-interior": "interior-forge",
  "depot-interior": "interior-depot",
  "treasury-interior": "interior-treasury",
  "council-interior": "interior-council",
};

const fallbackSpawns: Record<MapId, Record<string, { x: number; y: number }>> = {
  "village-exterior": {
    "gate-spawn": { x: 9.5 * TILE_SIZE, y: 13 * TILE_SIZE },
    "forge-return": { x: 7 * TILE_SIZE, y: 11 * TILE_SIZE },
    "depot-return": { x: 23 * TILE_SIZE, y: 11 * TILE_SIZE },
    "treasury-return": { x: 6 * TILE_SIZE, y: 19 * TILE_SIZE },
    "council-return": { x: 15 * TILE_SIZE, y: 19 * TILE_SIZE },
  },
  "forge-interior": {
    "forge-entry": { x: 9 * TILE_SIZE, y: 11.5 * TILE_SIZE },
  },
  "depot-interior": {
    "depot-entry": { x: 9 * TILE_SIZE, y: 11.5 * TILE_SIZE },
  },
  "treasury-interior": {
    "treasury-entry": { x: 9 * TILE_SIZE, y: 11.5 * TILE_SIZE },
  },
  "council-interior": {
    "council-entry": { x: 9 * TILE_SIZE, y: 11.5 * TILE_SIZE },
  },
};

export abstract class BaseWorldScene extends Phaser.Scene {
  protected mapId!: MapId;
  protected spawnId?: string;
  protected player!: PlayerCharacter;
  protected interactables: WorldInteractable[] = [];
  protected npcs: NpcActor[] = [];
  protected activeInteractable: WorldInteractable | null = null;
  protected objectiveMarker?: Phaser.GameObjects.Image;
  protected ambientGlows: Phaser.GameObjects.Image[] = [];

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private activeUnsubscribers: Array<() => void> = [];
  private waterTiles: Phaser.Tilemaps.Tile[] = [];
  private lastWaterPulse = 0;

  protected abstract resolveDefaultMapId(): MapId;
  protected abstract resolveSceneId(): SceneId;
  protected abstract resolveSceneCard(mapId: MapId): { title: string; subtitle: string };

  init(data: ScenePayload) {
    this.mapId = data.mapId ?? this.resolveDefaultMapId();
    this.spawnId = data.spawnId;
  }

  create() {
    bazaarGameStore.getState().setScene(this.resolveSceneId(), this.mapId);

    const compiledMap = getCompiledMap(this.mapId);
    const tilemap = this.make.tilemap({ key: this.mapId });
    const tilesetName = compiledMap.tilesets[0]?.name ?? "bazaar-outdoor";
    const tileset = tilemap.addTilesetImage(tilesetName, tilesetName, compiledMap.tilewidth, compiledMap.tileheight);
    if (!tileset) {
      throw new Error(`Unable to attach tileset ${tilesetName} to ${this.mapId}.`);
    }

    compiledMap.bazaarx.renderLayers.forEach((layerName, index) => {
      tilemap.createLayer(layerName, tileset, 0, 0)?.setDepth(index);
    });

    const collisionLayer = tilemap.createLayer(compiledMap.bazaarx.collisionLayer, tileset, 0, 0);
    if (collisionLayer) {
      collisionLayer.setVisible(false);
      collisionLayer.setCollisionByExclusion([-1, 0]);
    }

    const mapWidthPixels = compiledMap.width * compiledMap.tilewidth;
    const mapHeightPixels = compiledMap.height * compiledMap.tileheight;
    this.physics.world.setBounds(0, 0, mapWidthPixels, mapHeightPixels);
    this.cameras.main.setBounds(0, 0, mapWidthPixels, mapHeightPixels);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor(0xf2e5ce);

    this.decorateWorld(compiledMap.bazaarx.objectLayers.interactables ?? []);
    this.createInteriorDecor(mapWidthPixels);

    const spawn = this.resolveSpawn(this.mapId, this.spawnId);
    this.player = new PlayerCharacter(this, spawn.x, spawn.y);
    if (collisionLayer) {
      this.physics.add.collider(this.player.sprite, collisionLayer);
    }

    this.cameras.main.startFollow(this.player.sprite, true, CAMERA_LERP, CAMERA_LERP);

    const portalLookup = new Map(
      (compiledMap.bazaarx.objectLayers.portals ?? []).map((portal) => [portal.name, portal] as const),
    );
    this.interactables = (compiledMap.bazaarx.objectLayers.interactables ?? []).map((object) => {
      const portalId =
        typeof object.properties.portalId === "string" ? object.properties.portalId : undefined;
      const interactable = createWorldInteractable(object);
      const portal = portalId ? portalLookup.get(portalId) : undefined;

      if (portal) {
        interactable.targetMapId =
          typeof portal.properties.targetMapId === "string"
            ? (portal.properties.targetMapId as MapId)
            : undefined;
        interactable.spawnId =
          typeof portal.properties.spawnId === "string" ? portal.properties.spawnId : undefined;
      }

      return interactable;
    });
    this.createNpcs(compiledMap.bazaarx.objectLayers);
    this.createObjectiveMarker();
    this.captureWaterTiles(tilemap);
    this.setupInput();
    this.setupBridgeListeners();
    this.applyWorldState(bazaarGameStore.getState().world);

    const card = this.resolveSceneCard(this.mapId);
    const cutscene = this.scene.get("CutsceneScene");
    cutscene.events.emit("show-title", card);
  }

  update(_time: number, delta: number) {
    const movement = this.resolveMovementIntent();
    const nextState = this.player.update(movement);
    bazaarGameStore.getState().setPlayerState(nextState);

    this.npcs.forEach((npc) => {
      npc.update(delta / 1000);
    });

    this.refreshActiveInteractable();
    this.updateObjectiveMarker();
    this.pulseWater(_time);
  }

  shutdown() {
    this.activeUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.activeUnsubscribers = [];
  }

  protected resolveSpawn(mapId: MapId, spawnId?: string) {
    const fallback = fallbackSpawns[mapId][spawnId ?? "gate-spawn"] ?? Object.values(fallbackSpawns[mapId])[0];
    return fallback ?? { x: 8 * TILE_SIZE, y: 8 * TILE_SIZE };
  }

  private resolveMovementIntent() {
    const left = Boolean(this.cursors?.left.isDown || this.wasd?.A.isDown);
    const right = Boolean(this.cursors?.right.isDown || this.wasd?.D.isDown);
    const up = Boolean(this.cursors?.up.isDown || this.wasd?.W.isDown);
    const down = Boolean(this.cursors?.down.isDown || this.wasd?.S.isDown);

    const dx = Number(right) - Number(left);
    const dy = Number(down) - Number(up);
    return { dx, dy };
  }

  private setupInput() {
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.interactKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.player.setPointerTarget(pointer.worldX, pointer.worldY);
    });

    this.input.keyboard?.on("keydown-E", () => this.handleInteraction());
    this.input.keyboard?.on("keydown-SPACE", () => this.handleInteraction());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
  }

  private setupBridgeListeners() {
    this.activeUnsubscribers.push(
      bazaarEventBridge.on("quest:highlight", ({ targetId, mapId }) => {
        if (!mapId || mapId === this.mapId) {
          bazaarGameStore.getState().setQuestHighlight(targetId, mapId);
        }
      }),
      bazaarEventBridge.on("economy:sync", ({ status }) => {
        const world = bazaarGameStore.getState().world;
        if (status) {
          this.applyWorldState(world);
        }
      }),
      bazaarEventBridge.on("player:teleport", ({ mapId, spawnId, x, y }) => {
        if (mapId && mapId !== this.mapId) {
          return;
        }

        if (typeof x === "number" && typeof y === "number") {
          this.player.teleport(x, y);
          return;
        }

        const spawn = this.resolveSpawn(this.mapId, spawnId);
        this.player.teleport(spawn.x, spawn.y);
      }),
    );
  }

  private refreshActiveInteractable() {
    const playerPosition = this.player.getPosition();
    const next = this.interactables.reduce<WorldInteractable | null>((closest, interactable) => {
      const distance = Phaser.Math.Distance.BetweenPoints(playerPosition, interactable.center);
      if (distance > interactable.radius) {
        return closest;
      }

      if (!closest) {
        return interactable;
      }

      const currentDistance = Phaser.Math.Distance.BetweenPoints(playerPosition, closest.center);
      return distance < currentDistance ? interactable : closest;
    }, null);

    if (next?.id === this.activeInteractable?.id) {
      return;
    }

    this.activeInteractable = next;
    bazaarGameStore.getState().setFocus({
      interactionId: next?.id ?? null,
      npcId: next?.npcId ?? null,
      districtId: next?.districtId ?? this.districtFromInteraction(next?.id),
    });
  }

  private districtFromInteraction(interactionId?: string | null) {
    const building = buildingDefinitions.find((entry) => entry.id === interactionId);
    return (building?.districtId ?? null) as DistrictId | null;
  }

  private handleInteraction() {
    if (!this.activeInteractable) {
      return;
    }

    if (this.activeInteractable.targetMapId) {
      this.scene.start(
        this.activeInteractable.targetMapId === "village-exterior" ? "OverworldScene" : "InteriorScene",
        {
          mapId: this.activeInteractable.targetMapId,
          spawnId: this.activeInteractable.spawnId,
        },
      );
      return;
    }

    const districtId = this.activeInteractable.districtId ?? this.districtFromInteraction(this.activeInteractable.id);
    if (districtId) {
      bazaarEventBridge.emit("district:selected", {
        districtId,
        interactionId: this.activeInteractable.id,
        mapId: this.mapId,
      });
    }

    if (this.activeInteractable.npcId) {
      bazaarEventBridge.emit("npc:interact", {
        npcId: this.activeInteractable.npcId,
        interactionId: this.activeInteractable.id,
        mapId: this.mapId,
      });
    }

    if (this.activeInteractable.id === "governor-dais") {
      bazaarEventBridge.emit("governance:open", {
        mapId: this.mapId,
      });
    }
  }

  private captureWaterTiles(tilemap: Phaser.Tilemaps.Tilemap) {
    const groundLayer = tilemap.getLayer("ground")?.tilemapLayer;
    if (!groundLayer) {
      return;
    }

    groundLayer.forEachTile((tile) => {
      if (tile.index === 6 || tile.index === 7) {
        this.waterTiles.push(tile);
      }
    });
  }

  private pulseWater(time: number) {
    if (time - this.lastWaterPulse < 550) {
      return;
    }

    this.lastWaterPulse = time;
    this.waterTiles.forEach((tile) => {
      tile.index = tile.index === 6 ? 7 : 6;
    });
  }

  private createObjectiveMarker() {
    this.objectiveMarker = this.add.image(0, 0, "fx-quest-marker");
    this.objectiveMarker.setDepth(2000);
    this.objectiveMarker.setVisible(false);
    this.tweens.add({
      targets: this.objectiveMarker,
      y: "-=8",
      yoyo: true,
      repeat: -1,
      duration: 650,
    });
  }

  private updateObjectiveMarker() {
    const targetId = bazaarGameStore.getState().objectiveTargetId;
    if (!targetId || !this.objectiveMarker) {
      this.objectiveMarker?.setVisible(false);
      return;
    }

    const target = this.interactables.find((entry) => entry.id === targetId);
    if (!target) {
      this.objectiveMarker.setVisible(false);
      return;
    }

    this.objectiveMarker.setVisible(true);
    this.objectiveMarker.setPosition(target.center.x, target.center.y - 58);
  }

  private createNpcs(objectLayers: Record<string, CompiledMapObject[]>) {
    const spawnLookup = new Map((objectLayers.npcSpawns ?? []).map((entry) => [String(entry.properties.npcId), entry] as const));
    const pathLookup = new Map<string, Phaser.Math.Vector2[]>();

    (objectLayers.patrolNodes ?? []).forEach((node) => {
      const pathId = String(node.properties.pathId ?? "");
      const points = pathLookup.get(pathId) ?? [];
      points.push(new Phaser.Math.Vector2(node.x, node.y));
      pathLookup.set(pathId, points);
    });

    npcDefinitions
      .filter((npc) => npc.mapId === this.mapId)
      .forEach((npc) => {
        const spawn = spawnLookup.get(npc.id);
        if (!spawn) {
          return;
        }

        const path = npc.pathId ? pathLookup.get(npc.pathId) ?? [] : [];
        const actor = new NpcActor(
          this,
          npc.id,
          npc.spriteId,
          new Phaser.Math.Vector2(spawn.x, spawn.y),
          path,
        );
        this.npcs.push(actor);
      });
  }

  private decorateWorld(interactables: CompiledMapObject[]) {
    if (this.mapId !== "village-exterior") {
      return;
    }

    interactables.forEach((object) => {
      const config = buildingSpriteMap[object.name];
      if (!config) {
        return;
      }

      const sprite = this.add.image(object.x + object.width / 2, object.y - config.yOffset, config.texture);
      sprite.setDepth(object.y - 20);
    });

    [
      [11.5 * TILE_SIZE, 7 * TILE_SIZE],
      [23 * TILE_SIZE, 7.5 * TILE_SIZE],
      [6 * TILE_SIZE, 18 * TILE_SIZE],
      [15 * TILE_SIZE, 18 * TILE_SIZE],
    ].forEach(([x, y]) => {
      const glow = this.add.image(x, y, "fx-glow");
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setAlpha(0.45);
      glow.setDepth(y - 16);
      this.ambientGlows.push(glow);
    });
  }

  private createInteriorDecor(mapWidthPixels: number) {
    const texture = interiorDecorMap[this.mapId];
    if (!texture) {
      return;
    }

    const image = this.add.image(mapWidthPixels / 2, 112, texture);
    image.setDepth(26);
  }

  protected applyWorldState(world: WorldReactionState) {
    this.ambientGlows.forEach((glow, index) => {
      glow.setAlpha(index >= 2 ? world.treasuryGlow : world.lanternGlow);
    });
  }
}
