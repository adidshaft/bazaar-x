import * as Phaser from "phaser";
import { CAMERA_LERP, TILE_SIZE } from "@/game/config/constants";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import { bazaarGameStore } from "@/game/core/store";
import type { CompiledMapObject } from "@/game/core/map-types";
import type {
  DistrictId,
  MapId,
  ProofArtifact,
  QuestActionId,
  SceneId,
  WorldReactionState,
} from "@/game/core/live-types";
import { getCompiledMap } from "@/game/maps/manifest";
import { npcDefinitions } from "@/game/data/npcs";
import { goldenPathQuest } from "@/game/data/quests";
import { buildingDefinitions } from "@/game/data/world";
import { createWorldInteractable, type WorldInteractable } from "@/game/entities/interactable";
import { NpcActor } from "@/game/entities/npc";
import { PlayerCharacter } from "@/game/entities/player";
import { bazaarAudioSystem } from "@/game/systems/audio-system";

type ScenePayload = {
  mapId?: MapId;
  spawnId?: string;
};

type BuildingSpriteConfig = {
  texture: string;
  yOffset: number;
};

type LabelEntry = {
  id: string;
  target: Phaser.Math.Vector2;
  container: Phaser.GameObjects.Container;
  text: Phaser.GameObjects.Text;
};

type GlowEntry = {
  sprite: Phaser.GameObjects.Image;
  group: "lamp" | "treasury" | "governance";
};

const buildingSpriteMap: Record<string, BuildingSpriteConfig> = {
  "settlement-keep": { texture: "building-keep", yOffset: 82 },
  "forge-door": { texture: "building-forge", yOffset: 82 },
  "depot-door": { texture: "building-depot", yOffset: 82 },
  "guild-yard": { texture: "building-guild", yOffset: 68 },
  "treasury-door": { texture: "building-treasury", yOffset: 82 },
  "council-door": { texture: "building-council", yOffset: 82 },
};

const interiorDecorMap: Partial<Record<MapId, string>> = {
  "forge-interior": "interior-forge",
  "depot-interior": "interior-depot",
  "treasury-interior": "interior-treasury",
  "council-interior": "interior-council",
};

const fallbackSpawns: Record<MapId, Record<string, { x: number; y: number }>> = {
  "village-exterior": {
    "gate-spawn": { x: 6.5 * TILE_SIZE, y: 19.5 * TILE_SIZE },
    "forge-return": { x: 12 * TILE_SIZE, y: 19 * TILE_SIZE },
    "depot-return": { x: 48 * TILE_SIZE, y: 19 * TILE_SIZE },
    "treasury-return": { x: 12 * TILE_SIZE, y: 34 * TILE_SIZE },
    "council-return": { x: 31 * TILE_SIZE, y: 34 * TILE_SIZE },
  },
  "forge-interior": {
    "forge-entry": { x: 13 * TILE_SIZE, y: 14.5 * TILE_SIZE },
  },
  "depot-interior": {
    "depot-entry": { x: 13 * TILE_SIZE, y: 14.5 * TILE_SIZE },
  },
  "treasury-interior": {
    "treasury-entry": { x: 13 * TILE_SIZE, y: 14.5 * TILE_SIZE },
  },
  "council-interior": {
    "council-entry": { x: 13 * TILE_SIZE, y: 14.5 * TILE_SIZE },
  },
};

const propTextureMap: Record<string, string> = {
  pine: "prop-pine",
  lamp: "prop-lamp",
  crate: "prop-crate",
  banner: "prop-banner",
  reed: "prop-reed",
  signpost: "prop-signpost",
  stall: "prop-stall",
  statue: "prop-statue",
};

const questActionTargetMap = new Map(
  goldenPathQuest.steps
    .filter((step): step is (typeof goldenPathQuest.steps)[number] & { actionId: QuestActionId } => Boolean(step.actionId))
    .map((step) => [step.actionId, { targetId: step.targetId, mapId: step.targetMapId }] as const),
);

export abstract class BaseWorldScene extends Phaser.Scene {
  protected mapId!: MapId;
  protected spawnId?: string;
  protected tilemap?: Phaser.Tilemaps.Tilemap;
  protected collisionLayer?: Phaser.Tilemaps.TilemapLayer;
  protected renderLayerLookup = new Map<string, Phaser.Tilemaps.TilemapLayer>();
  protected buildingSpriteLookup = new Map<string, Phaser.GameObjects.Image[]>();
  protected waterTiles: Phaser.Tilemaps.Tile[] = [];
  protected npcActorLookup = new Map<string, NpcActor>();
  protected player!: PlayerCharacter;
  protected interactables: WorldInteractable[] = [];
  protected npcs: NpcActor[] = [];
  protected activeInteractable: WorldInteractable | null = null;
  protected objectiveMarker?: Phaser.GameObjects.Image;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;
  private activeUnsubscribers: Array<() => void> = [];
  private lastWaterPulse = 0;
  private lastDustAt = 0;
  private labelEntries: LabelEntry[] = [];
  private glowEntries: GlowEntry[] = [];
  private playerRing?: Phaser.GameObjects.Image;
  private playerNameLabel?: Phaser.GameObjects.Text;
  private playerAuraGlow?: Phaser.FX.Glow;
  private activeAuraSkillId: string | null = null;
  private proofPickup?: {
    proof: ProofArtifact;
    sprite: Phaser.GameObjects.Image;
    ring: Phaser.GameObjects.Image;
  };

  protected abstract resolveDefaultMapId(): MapId;
  protected abstract resolveSceneId(): SceneId;
  protected abstract resolveSceneCard(mapId: MapId): { title: string; subtitle: string };
  protected augmentInteractables() {}
  protected afterWorldCreate() {}
  protected afterWorldUpdate(time: number, delta: number) {
    void time;
    void delta;
  }
  protected onWorldStateApplied(world: WorldReactionState) {
    void world;
  }

  public getTilemap() {
    return this.tilemap;
  }

  public getRenderLayer(name: string) {
    return this.renderLayerLookup.get(name);
  }

  public getBuildingSpriteLookup() {
    return this.buildingSpriteLookup;
  }

  public getWaterTiles() {
    return this.waterTiles;
  }

  public getWorldInteractables() {
    return this.interactables;
  }

  public getPlayerCharacter() {
    return this.player;
  }

  init(data: ScenePayload) {
    this.mapId = data.mapId ?? this.resolveDefaultMapId();
    this.spawnId = data.spawnId;
  }

  create() {
    bazaarGameStore.getState().setScene(this.resolveSceneId(), this.mapId);
    bazaarAudioSystem.startAmbient();

    const compiledMap = getCompiledMap(this.mapId);
    const tilemap = this.make.tilemap({ key: this.mapId });
    this.tilemap = tilemap;
    const tilesetName = compiledMap.tilesets[0]?.name ?? "bazaar-outdoor";
    const tileset = tilemap.addTilesetImage(
      tilesetName,
      tilesetName,
      compiledMap.tilewidth,
      compiledMap.tileheight,
    );
    if (!tileset) {
      throw new Error(`Unable to attach tileset ${tilesetName} to ${this.mapId}.`);
    }

    compiledMap.bazaarx.renderLayers.forEach((layerName, index) => {
      const layer = tilemap.createLayer(layerName, tileset, 0, 0);
      layer?.setDepth(index);
      if (layer) {
        this.renderLayerLookup.set(layerName, layer);
      }
    });

    const collisionLayer = tilemap.createLayer(compiledMap.bazaarx.collisionLayer, tileset, 0, 0);
    if (collisionLayer) {
      collisionLayer.setVisible(false);
      collisionLayer.setCollisionByExclusion([-1, 0]);
    }
    this.collisionLayer = collisionLayer ?? undefined;

    const mapWidthPixels = compiledMap.width * compiledMap.tilewidth;
    const mapHeightPixels = compiledMap.height * compiledMap.tileheight;
    this.physics.world.setBounds(0, 0, mapWidthPixels, mapHeightPixels);
    this.cameras.main.setBounds(0, 0, mapWidthPixels, mapHeightPixels);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor(0x0f151b);

    this.createAmbientProps(compiledMap.bazaarx.objectLayers.ambientProps ?? []);
    this.decorateWorld(compiledMap.bazaarx.objectLayers.interactables ?? []);
    this.createInteriorDecor(mapWidthPixels);

    const spawn = this.resolveSpawn(this.mapId, this.spawnId);
    this.player = new PlayerCharacter(this, spawn.x, spawn.y);
    if (collisionLayer) {
      this.physics.add.collider(this.player.sprite, collisionLayer);
    }

    this.playerRing = this.add.image(spawn.x, spawn.y + 8, "fx-agent-ring");
    this.playerRing.setBlendMode(Phaser.BlendModes.ADD);
    this.playerRing.setAlpha(0.36);
    this.playerRing.setDepth(spawn.y - 2);

    this.playerNameLabel = this.add.text(spawn.x, spawn.y - 32, "", {
      color: "#dffcff",
      fontFamily: "\"Press Start 2P\", monospace",
      fontSize: "8px",
      stroke: "#11141a",
      strokeThickness: 4,
      align: "center",
    }).setOrigin(0.5, 1);
    this.playerNameLabel.setDepth(spawn.y + 200);

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
    this.augmentInteractables();

    this.createNameplates();
    this.createNpcs(compiledMap.bazaarx.objectLayers);
    this.createObjectiveMarker();
    this.captureWaterTiles(tilemap);
    this.setupInput();
    this.setupBridgeListeners();
    this.applyWorldState(bazaarGameStore.getState().world);
    this.applyPlayerAura();
    this.afterWorldCreate();

    const card = this.resolveSceneCard(this.mapId);
    const cutscene = this.scene.get("CutsceneScene");
    cutscene.events.emit("show-title", card);
  }

  update(time: number, delta: number) {
    const movement = this.resolveMovementIntent();
    const nextState = this.player.update(movement);
    bazaarGameStore.getState().setPlayerState(nextState);

    this.npcs.forEach((npc) => {
      npc.update(delta / 1000);
    });

    if (nextState.moving) {
      this.emitMovementFeedback(time);
    }

    this.updatePlayerDecor();
    this.refreshActiveInteractable();
    this.updateObjectiveMarker();
    this.updateNameplates();
    this.pulseWater(time);
    this.checkProofPickup();
    this.afterWorldUpdate(time, delta);
  }

  shutdown() {
    this.activeUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.activeUnsubscribers = [];
  }

  protected resolveSpawn(mapId: MapId, spawnId?: string) {
    const fallback =
      fallbackSpawns[mapId][spawnId ?? "gate-spawn"] ?? Object.values(fallbackSpawns[mapId])[0];
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
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.input.once("pointerdown", () => bazaarAudioSystem.unlock());
    this.input.keyboard?.once("keydown", () => bazaarAudioSystem.unlock());

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
      bazaarEventBridge.on("tx:submitted", ({ actionId }) => {
        if (actionId === "propose-rule-change" || actionId === "vote-rule-change") {
          bazaarAudioSystem.play("governance-vote");
        } else {
          bazaarAudioSystem.play("ui-confirm");
        }
      }),
      bazaarEventBridge.on("tx:confirmed", ({ actionId }) => {
        this.handleConfirmedAction(actionId);
      }),
      bazaarEventBridge.on("ui:viewport-changed", (payload) => {
        this.handleViewportChanged(payload);
      }),
      bazaarEventBridge.on("camera:flash", ({ duration, red = 255, green = 255, blue = 255 }) => {
        this.cameras.main.flash(duration, red, green, blue, false);
      }),
      bazaarEventBridge.on("proof:verified", ({ proof }) => {
        this.realityPulse();
        this.spawnProofPickup(proof);
      }),
      bazaarEventBridge.on("skill:altar-close", ({ mapId }) => {
        if (mapId === this.mapId && this.scene.isPaused()) {
          this.scene.resume();
        }
      }),
      bazaarEventBridge.on("skill:activated", () => {
        this.applyPlayerAura();
      }),
    );
  }

  private handleConfirmedAction(actionId: QuestActionId) {
    const cue =
      actionId === "execute-rule-change"
        ? "rule-update"
        : actionId === "hire-worker" || actionId === "hire-supplier" || actionId === "treasury-reinvest"
          ? "coin-transfer"
          : actionId === "vote-rule-change" || actionId === "propose-rule-change"
            ? "governance-vote"
            : "tax-collect";
    bazaarAudioSystem.play(cue);

    const target = questActionTargetMap.get(actionId);
    if (!target || target.mapId !== this.mapId) {
      return;
    }

    const interactable = this.interactables.find((entry) => entry.id === target.targetId);
    if (!interactable) {
      return;
    }

    this.emitRewardBurst(interactable.center.x, interactable.center.y - 18);
  }

  private emitRewardBurst(x: number, y: number) {
    const lowEffects = bazaarGameStore.getState().settings.lowEffects;
    const particles = this.add.particles(x, y, "fx-coin", {
      speed: { min: 24, max: 72 },
      lifespan: lowEffects ? 420 : 640,
      quantity: lowEffects ? 3 : 6,
      scale: { start: lowEffects ? 0.28 : 0.36, end: 0 },
      alpha: { start: lowEffects ? 0.7 : 0.9, end: 0 },
      gravityY: 120,
      blendMode: Phaser.BlendModes.ADD,
    });
    particles.setDepth(y + 120);
    this.time.delayedCall(lowEffects ? 460 : 700, () => particles.destroy());
  }

  private emitMovementFeedback(time: number) {
    const lowEffects = bazaarGameStore.getState().settings.lowEffects;
    if (time - this.lastDustAt < (lowEffects ? 260 : 185)) {
      return;
    }

    this.lastDustAt = time;
    bazaarAudioSystem.play("footstep");

    if (lowEffects) {
      return;
    }

    const particles = this.add.particles(this.player.sprite.x, this.player.sprite.y + 10, "fx-dust", {
      speed: { min: 8, max: 28 },
      lifespan: 320,
      quantity: 2,
      scale: { start: 0.28, end: 0 },
      alpha: { start: 0.35, end: 0 },
      blendMode: Phaser.BlendModes.NORMAL,
    });
    particles.setDepth(this.player.sprite.y - 4);
    this.time.delayedCall(360, () => particles.destroy());
  }

  private updatePlayerDecor() {
    const playerName = bazaarGameStore.getState().playerName;
    this.playerRing?.setPosition(this.player.sprite.x, this.player.sprite.y + 8);
    this.playerRing?.setDepth(this.player.sprite.y - 2);
    this.playerNameLabel?.setText(playerName);
    this.playerNameLabel?.setPosition(this.player.sprite.x, this.player.sprite.y - 34);
    this.playerNameLabel?.setDepth(this.player.sprite.y + 200);
    this.applyPlayerAura();
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

    bazaarAudioSystem.play("ui-confirm");

    if (this.activeInteractable.id === "skill-altar") {
      this.scene.pause();
      bazaarEventBridge.emit("skill:altar-open", {
        mapId: this.mapId,
      });
      return;
    }

    if (this.activeInteractable.targetMapId) {
      bazaarAudioSystem.play("door-open");
      this.scene.start(
        this.activeInteractable.targetMapId === "village-exterior" ? "OverworldScene" : "InteriorScene",
        {
          mapId: this.activeInteractable.targetMapId,
          spawnId: this.activeInteractable.spawnId,
        },
      );
      return;
    }

    const districtId =
      this.activeInteractable.districtId ?? this.districtFromInteraction(this.activeInteractable.id);
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
    const lowEffects = bazaarGameStore.getState().settings.lowEffects;
    if (time - this.lastWaterPulse < (lowEffects ? 720 : 420)) {
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
    this.objectiveMarker.setPosition(target.center.x, target.center.y - 64);
  }

  private createNpcs(objectLayers: Record<string, CompiledMapObject[]>) {
    const spawnLookup = new Map(
      (objectLayers.npcSpawns ?? []).map((entry) => [String(entry.properties.npcId), entry] as const),
    );
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
        this.npcActorLookup.set(npc.id, actor);

        const ring = this.add.image(spawn.x, spawn.y + 8, npc.entityType === "agent" ? "fx-agent-ring" : "fx-human-ring");
        ring.setBlendMode(Phaser.BlendModes.ADD);
        ring.setAlpha(npc.entityType === "agent" ? 0.28 : 0.18);
        ring.setDepth(spawn.y - 2);
        this.tweens.add({
          targets: ring,
          alpha: npc.entityType === "agent" ? 0.34 : 0.24,
          yoyo: true,
          repeat: -1,
          duration: 900 + this.npcs.length * 90,
        });

        this.tweens.add({
          targets: actor.sprite,
          scaleY: npc.entityType === "agent" ? 0.97 : 0.99,
          scaleX: npc.entityType === "agent" ? 1.02 : 1.01,
          yoyo: true,
          repeat: -1,
          duration: 880 + this.npcs.length * 60,
          ease: "Sine.easeInOut",
        });
      });
  }

  private createNameplates() {
    this.interactables.forEach((interactable) => {
      if (!interactable.label) {
        return;
      }

      const width = Math.max(88, interactable.label.length * 8 + 18);
      const background = this.add
        .rectangle(0, 0, width, 18, 0x131821, 0.9)
        .setStrokeStyle(2, 0x85d8ff, 0.35);
      const text = this.add.text(0, 0, interactable.label.toUpperCase(), {
        color: "#edf8ff",
        fontFamily: "\"Press Start 2P\", monospace",
        fontSize: "7px",
      }).setOrigin(0.5);
      const container = this.add.container(interactable.center.x, interactable.center.y - 48, [background, text]);
      container.setDepth(interactable.center.y + 80);
      container.setAlpha(0.7);

      this.labelEntries.push({
        id: interactable.id,
        target: interactable.center.clone(),
        container,
        text,
      });

      this.tweens.add({
        targets: container,
        y: container.y - 4,
        yoyo: true,
        repeat: -1,
        duration: 1150,
        ease: "Sine.easeInOut",
      });
    });
  }

  private updateNameplates() {
    const objectiveTargetId = bazaarGameStore.getState().objectiveTargetId;
    const focusedInteractionId = bazaarGameStore.getState().focusedInteractionId;

    this.labelEntries.forEach((entry) => {
      const isFocused = entry.id === focusedInteractionId;
      const isObjective = entry.id === objectiveTargetId;
      entry.container.setAlpha(isFocused ? 1 : isObjective ? 0.92 : 0.62);
      entry.container.setScale(isFocused ? 1.04 : isObjective ? 1.02 : 1);
      entry.text.setColor(isFocused || isObjective ? "#ffffff" : "#d6e9f2");
    });
  }

  private createAmbientProps(objects: CompiledMapObject[]) {
    objects.forEach((object) => {
      const kind = typeof object.properties.kind === "string" ? object.properties.kind : "";
      const texture = propTextureMap[kind];
      if (!texture) {
        return;
      }

      const scale =
        typeof object.properties.scale === "number" ? Number(object.properties.scale) / 10 : 1;
      const sprite = this.add.image(object.x, object.y, texture);
      sprite.setScale(scale);
      sprite.setDepth(object.y);

      if (kind === "lamp") {
        const glow = this.add.image(object.x, object.y - 8, "fx-glow");
        glow.setBlendMode(Phaser.BlendModes.ADD);
        glow.setAlpha(0.32);
        glow.setDepth(object.y - 2);
        this.glowEntries.push({ sprite: glow, group: this.mapId === "treasury-interior" ? "treasury" : "lamp" });
      }

      if (kind === "lamp") {
        this.tweens.add({
          targets: sprite,
          scaleY: 1.04,
          yoyo: true,
          repeat: -1,
          duration: 960,
          ease: "Sine.easeInOut",
        });
      }

      if (kind === "banner" || kind === "reed") {
        this.tweens.add({
          targets: sprite,
          angle: 2,
          yoyo: true,
          repeat: -1,
          duration: 760,
          ease: "Sine.easeInOut",
        });
      }

      if (kind === "crate" || kind === "stall" || kind === "statue") {
        this.tweens.add({
          targets: sprite,
          y: sprite.y - 2,
          yoyo: true,
          repeat: -1,
          duration: 1200,
          ease: "Sine.easeInOut",
        });
      }

      if (this.mapId === "council-interior" && (kind === "banner" || kind === "statue")) {
        const glow = this.add.image(object.x, object.y - 10, "fx-glow");
        glow.setBlendMode(Phaser.BlendModes.ADD);
        glow.setAlpha(0.22);
        glow.setScale(0.85);
        glow.setDepth(object.y - 1);
        this.glowEntries.push({ sprite: glow, group: "governance" });
      }
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

      const sprite = this.add.image(
        object.x + object.width / 2,
        object.y - config.yOffset,
        config.texture,
      );
      sprite.setData("baseTexture", config.texture);
      sprite.setDepth(object.y - 20);
      const sprites = this.buildingSpriteLookup.get(object.name) ?? [];
      sprites.push(sprite);
      this.buildingSpriteLookup.set(object.name, sprites);
    });
  }

  private createInteriorDecor(mapWidthPixels: number) {
    const texture = interiorDecorMap[this.mapId];
    if (!texture) {
      return;
    }

    const image = this.add.image(mapWidthPixels / 2, 118, texture);
    image.setDepth(26);
  }

  protected applyWorldState(world: WorldReactionState) {
    this.glowEntries.forEach((entry) => {
      if (entry.group === "treasury") {
        entry.sprite.setAlpha(0.18 + world.treasuryGlow * 0.32);
      } else if (entry.group === "governance") {
        entry.sprite.setAlpha(0.18 + (world.governancePassed ? 0.3 : 0.08));
      } else {
        entry.sprite.setAlpha(0.12 + world.lanternGlow * 0.26);
      }
    });
    this.onWorldStateApplied(world);
  }

  public realityPulse() {
    const overlay = this.add
      .rectangle(
        this.cameras.main.midPoint.x,
        this.cameras.main.midPoint.y,
        this.cameras.main.width,
        this.cameras.main.height,
        0xf4fbff,
        0.18,
      )
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(3900);

    this.cameras.main.shake(200, 0.0045);

    const tintableChildren = this.children.list.filter(
      (child): child is Phaser.GameObjects.GameObject & {
        setTintFill: (color: number) => unknown;
        clearTint: () => unknown;
      } => "setTintFill" in child && "clearTint" in child,
    );

    tintableChildren.forEach((child) => {
      child.setTintFill(0xf0fbff);
    });

    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 200,
      ease: "Sine.easeOut",
      onComplete: () => overlay.destroy(),
    });

    this.time.delayedCall(200, () => {
      tintableChildren.forEach((child) => child.clearTint());
    });
  }

  private applyPlayerAura() {
    const { activeSkillId, skillCatalog } = bazaarGameStore.getState();
    if (activeSkillId === this.activeAuraSkillId) {
      return;
    }

    if (this.playerAuraGlow) {
      this.player.sprite.postFX?.remove(this.playerAuraGlow);
      this.playerAuraGlow = undefined;
    }

    this.activeAuraSkillId = activeSkillId;

    if (!activeSkillId) {
      this.playerRing?.clearTint();
      return;
    }

    const skill = skillCatalog.find((entry) => entry.skill_id === activeSkillId);
    const color = Phaser.Display.Color.HexStringToColor(
      skill?.visual_metadata.glow_color ?? "#7de6ff",
    ).color;

    this.playerAuraGlow =
      this.player.sprite.postFX?.addGlow(color, 2.2, 0.35, false, 0.15, 10) ?? undefined;
    this.playerRing?.setTint(color);
  }

  private spawnProofPickup(proof: ProofArtifact) {
    this.proofPickup?.sprite.destroy();
    this.proofPickup?.ring.destroy();

    const sprite = this.add.image(this.player.sprite.x, this.player.sprite.y + 6, "fx-veritas-scroll");
    sprite.setDepth(this.player.sprite.y + 32);
    const ring = this.add.image(this.player.sprite.x, this.player.sprite.y + 8, "fx-glow");
    ring.setDepth(this.player.sprite.y + 28);
    ring.setScale(0.5);
    ring.setAlpha(0.28);
    ring.setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: [sprite, ring],
      y: "-=10",
      yoyo: true,
      repeat: -1,
      duration: 840,
      ease: "Sine.easeInOut",
    });

    this.proofPickup = {
      proof,
      sprite,
      ring,
    };
  }

  private checkProofPickup() {
    if (!this.proofPickup) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.player.sprite.x,
      this.player.sprite.y,
      this.proofPickup.sprite.x,
      this.proofPickup.sprite.y,
    );
    if (distance > 26) {
      return;
    }

    const collectedProof = this.proofPickup.proof;
    this.proofPickup.sprite.destroy();
    this.proofPickup.ring.destroy();
    this.proofPickup = undefined;

    bazaarAudioSystem.play("ui-confirm");
    bazaarEventBridge.emit("proof:scroll-picked", {
      proof: collectedProof,
    });
  }

  private handleViewportChanged(payload: {
    briefOpen: boolean;
    drawerOpen: boolean;
    leftWidth: number;
    rightWidth: number;
  }) {
    if (!this.player?.sprite?.active) {
      return;
    }

    const widthDelta = payload.rightWidth - payload.leftWidth;
    const worldOffset = Phaser.Math.Clamp(widthDelta * 0.11, -112, 112);

    this.cameras.main.setFollowOffset(-worldOffset, 0);
    this.cameras.main.pan(
      this.player.sprite.x + worldOffset,
      this.player.sprite.y,
      220,
      "Sine.easeOut",
      false,
    );
  }
}
