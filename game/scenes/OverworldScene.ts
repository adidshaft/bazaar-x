import * as Phaser from "phaser";
import type { MapId, WorldReactionState } from "@/game/core/live-types";
import { TILE_SIZE } from "@/game/config/constants";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import { bazaarGameStore } from "@/game/core/store";
import { npcDefinitions } from "@/game/data/npcs";
import type { NpcActor } from "@/game/entities/npc";
import { loadPersistedPlayerState, savePersistedPlayerState } from "@/game/systems/persistence-service";
import { findGridPath } from "@/game/systems/a-star-grid";
import { LaborDispatcher } from "@/game/systems/labor-dispatcher";
import { BaseWorldScene } from "./base-world-scene";
import { WorldUpgradeSystem } from "./world-upgrade-system";

export class OverworldScene extends BaseWorldScene {
  private upgradeSystem?: WorldUpgradeSystem;
  private laborDispatcher?: LaborDispatcher;
  private valueFlowParticlePool?: Phaser.GameObjects.Group;
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
      subtitle: "Citizenship, shops, labor, tax, and rule replay",
    };
  }

  protected afterWorldCreate() {
    if (this.mapId !== "village-exterior") {
      return;
    }

    this.upgradeSystem = new WorldUpgradeSystem(this);
    this.upgradeSystem.apply(bazaarGameStore.getState().world);
    this.createValueFlowParticlePool();
    this.buildWalkGrid();
    this.laborDispatcher = new LaborDispatcher({
      mapId: () => this.mapId,
      getWalkGrid: () => this.walkGrid,
      getNpcActors: () => this.npcs,
      getNpcActor: (npcId) => this.npcActorLookup.get(npcId),
      getInteractableCenter: (buildingId) => this.getWorldInteractables().find((entry) => entry.id === buildingId)?.center.clone() ?? null,
      getTreasuryCenter: () => this.getWorldInteractables().find((entry) => entry.id === "treasury-door")?.center.clone() ?? null,
      onValueFlow: ({ from, to, job }) => {
        this.animateValueFlow(from, to, job.kind === "value-flow" ? 40 : 24, job.kind === "value-flow" ? 0xffd36f : 0x9fe8ff);
      },
      persist: (state) => this.persistLaborRouting(state),
    });

    const persisted = loadPersistedPlayerState(bazaarGameStore.getState().wallet);
    if (persisted?.laborRouting) {
      bazaarGameStore.getState().setLaborRoutingState(persisted.laborRouting);
      this.laborDispatcher.restore(persisted.laborRouting);
    } else {
      this.laborDispatcher.restore(bazaarGameStore.getState().laborRouting);
    }
    this.laborDispatcher.consumeStatus(bazaarGameStore.getState().liveStatus);

    const offTax = bazaarEventBridge.on("economy:tax-collected", () => {
      this.animateTaxFlow();
    });
    const offSync = bazaarEventBridge.on("economy:sync", ({ status }) => {
      this.laborDispatcher?.consumeStatus(status);
    });
    const offTx = bazaarEventBridge.on("tx:confirmed", ({ actionId, stepKey, txHash }) => {
      this.laborDispatcher?.noteConfirmedAction(actionId, stepKey, txHash);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offTax();
      offSync();
      offTx();
    });
  }

  protected onWorldStateApplied(world: WorldReactionState) {
    this.upgradeSystem?.apply(world);
  }

  protected afterWorldUpdate(time: number, delta: number) {
    this.laborDispatcher?.update(time, delta);
  }

  private createValueFlowParticlePool() {
    this.valueFlowParticlePool = this.add.group({
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
      this.valueFlowParticlePool.add(coin);
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
    const source = this.resolveFlowSourceActor();
    const treasury = this.getWorldInteractables().find((entry) => entry.id === "treasury-door");
    const sourcePoint =
      source?.getPosition() ??
      this.getWorldInteractables().find((entry) => entry.id === "supplier-desk")?.center ??
      this.getWorldInteractables().find((entry) => entry.id === "worker-bench")?.center ??
      this.getWorldInteractables().find((entry) => entry.id === "forge-door")?.center ??
      null;

    if (!this.valueFlowParticlePool || this.walkGrid.length === 0 || !sourcePoint || !treasury) {
      return;
    }

    this.animateValueFlow(sourcePoint, treasury.center, 50, 0xffd36f);
  }

  private animateValueFlow(
    source: Phaser.Math.Vector2,
    target: Phaser.Math.Vector2,
    count: number,
    tint: number,
  ) {
    if (!this.valueFlowParticlePool || this.walkGrid.length === 0) {
      return;
    }

    const pathPoints = findGridPath(
      this.walkGrid,
      {
        x: Math.floor(source.x / TILE_SIZE),
        y: Math.floor(source.y / TILE_SIZE),
      },
      {
        x: Math.floor(target.x / TILE_SIZE),
        y: Math.floor(target.y / TILE_SIZE),
      },
    ).map((point) => new Phaser.Math.Vector2(point.x * TILE_SIZE + TILE_SIZE / 2, point.y * TILE_SIZE + TILE_SIZE / 2));

    const path = new Phaser.Curves.Path(pathPoints[0]?.x ?? source.x, pathPoints[0]?.y ?? source.y);
    pathPoints.slice(1).forEach((point) => {
      path.lineTo(point.x, point.y);
    });

    for (let index = 0; index < count; index += 1) {
      const coin = this.valueFlowParticlePool.getFirstDead(false) as Phaser.GameObjects.Image | null;
      if (!coin) {
        break;
      }

      coin.setVisible(true);
      coin.setActive(true);
      coin.setScale(0.18 + Math.random() * 0.08);
      coin.setAlpha(0.92);
      coin.setTint(tint);

      const progress = { value: 0 };
      this.tweens.add({
        targets: progress,
        value: 1,
        duration: 900 + Math.random() * 260,
        delay: index * 16,
        ease: "Sine.easeInOut",
        onStart: () => {
          coin.setPosition(source.x, source.y - 10);
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

  private resolveFlowSourceActor() {
    const treasury = this.getWorldInteractables().find((entry) => entry.id === "treasury-door");
    if (!treasury) {
      return null;
    }

    return [...this.npcs]
      .map((actor) => {
        const definition = npcDefinitions.find((entry) => entry.id === actor.id);
        return definition ? { actor, definition } : null;
      })
      .filter((entry): entry is { actor: NpcActor; definition: (typeof npcDefinitions)[number] } => {
        if (!entry) {
          return false;
        }

        return ["guide", "worker", "supplier", "shop", "governor"].includes(entry.definition.role);
      })
      .map((entry) => ({
        actor: entry.actor,
        distance: Phaser.Math.Distance.BetweenPoints(entry.actor.getPosition(), treasury.center),
      }))
      .sort((left, right) => left.distance - right.distance)[0]?.actor ?? null;
  }

  private persistLaborRouting(state: import("@/game/core/live-types").LaborRoutingState) {
    const wallet = bazaarGameStore.getState().wallet;
    if (!wallet.address || !wallet.chainId) {
      return;
    }

    const existing = loadPersistedPlayerState(wallet);
    const baseState =
      existing ?? {
        currentMapId: this.mapId,
        lastSpawnId: "gate-spawn",
        playerName: bazaarGameStore.getState().playerName,
        revealedProofIds: [],
        unlockedLocations: [this.mapId],
        activeQuestStepId: bazaarGameStore.getState().questHighlightId ?? undefined,
        unlockedSkillIds: bazaarGameStore.getState().unlockedSkillIds,
        activeSkillId: bazaarGameStore.getState().activeSkillId,
        muted: bazaarGameStore.getState().settings.muted,
        lowEffects: bazaarGameStore.getState().settings.lowEffects,
        laborRouting: state,
      };

    savePersistedPlayerState(wallet, {
      ...baseState,
      laborRouting: state,
    });
  }
}
