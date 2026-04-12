import * as Phaser from "phaser";
import type { LaborRoutingJob, LaborRoutingNpcState, MapId } from "@/game/core/live-types";

export class NpcActor {
  readonly id: string;
  readonly sprite: Phaser.GameObjects.Sprite;
  private patrolPath: Phaser.Math.Vector2[];
  private routePath: Phaser.Math.Vector2[];
  private routeIndex = 0;
  private speed: number;
  private direction: "down" | "up" | "left" | "right" = "down";
  private routeMode: "patrol" | "labor" = "patrol";
  private routeStatus: "idle" | "walking" | "working" = "idle";
  private currentJobId?: string;
  private targetBuildingId?: string;
  private laborPool?: LaborRoutingNpcState["pool"];
  private laborMapId?: MapId;
  private laborRole: LaborRoutingNpcState["role"] = "guide";
  private workUntilAt?: number;

  constructor(scene: Phaser.Scene, id: string, texturePrefix: string, start: Phaser.Math.Vector2, path: Phaser.Math.Vector2[]) {
    this.id = id;
    this.patrolPath = (path.length ? path : [start]).map((point) => point.clone());
    this.routePath = this.patrolPath;
    this.speed = 18;
    this.sprite = scene.add.sprite(start.x, start.y, `${texturePrefix}-down-idle-0`);
    this.sprite.setOrigin(0.5, 0.78);
    this.sprite.setDepth(start.y);
    this.sprite.setName(texturePrefix);
  }

  getPosition() {
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  isAvailableForLabor() {
    return this.routeMode !== "labor" && this.routeStatus !== "working";
  }

  getCurrentJobId() {
    return this.currentJobId ?? null;
  }

  getRoutingSnapshot() {
    if (this.routeMode !== "labor" && this.routeStatus !== "working") {
      return null;
    }

    return {
      npcId: this.id,
      role: this.laborRole,
      pool: this.laborPool ?? "depot",
      mapId: this.laborMapId ?? "village-exterior",
      status: this.routeStatus,
      x: this.sprite.x,
      y: this.sprite.y,
      direction: this.direction,
      path: this.routePath.map((point) => ({ x: point.x, y: point.y })),
      pathIndex: this.routeIndex,
      currentJobId: this.currentJobId,
      targetBuildingId: this.targetBuildingId,
      workUntilAt: this.workUntilAt,
      lastUpdatedAt: new Date().toISOString(),
    } satisfies LaborRoutingNpcState;
  }

  assignLaborRoute(
    job: LaborRoutingJob,
    path: Phaser.Math.Vector2[],
    mapId: MapId,
    pool: LaborRoutingNpcState["pool"],
    role: LaborRoutingNpcState["role"],
  ) {
    this.laborMapId = mapId;
    this.laborPool = pool;
    this.laborRole = role;
    this.currentJobId = job.id;
    this.targetBuildingId = job.targetBuildingId;
    this.routeMode = "labor";
    this.routeStatus = "walking";
    this.routePath = path.length ? path.map((point) => point.clone()) : [this.getPosition()];
    this.routeIndex = this.routePath.length > 1 ? 1 : 0;
    this.workUntilAt = undefined;
    if (this.routePath.length < 2) {
      this.beginWork();
      return;
    }

    this.safePlayAnim(`${this.sprite.name}:walk:${this.direction}`);
  }

  restoreLaborRoute(snapshot: LaborRoutingNpcState) {
    this.laborMapId = snapshot.mapId;
    this.laborPool = snapshot.pool;
    this.laborRole = snapshot.role;
    this.currentJobId = snapshot.currentJobId;
    this.targetBuildingId = snapshot.targetBuildingId;
    this.routeMode = snapshot.status === "working" || snapshot.status === "walking" ? "labor" : "patrol";
    this.routeStatus = snapshot.status;
    this.routePath = snapshot.path.length ? snapshot.path.map((point) => new Phaser.Math.Vector2(point.x, point.y)) : [new Phaser.Math.Vector2(snapshot.x, snapshot.y)];
    this.routeIndex = Phaser.Math.Clamp(snapshot.pathIndex, 0, Math.max(this.routePath.length - 1, 0));
    this.workUntilAt = snapshot.workUntilAt;
    this.sprite.setPosition(snapshot.x, snapshot.y);
    this.direction = snapshot.direction;

    if (snapshot.status === "working" && this.workUntilAt && this.workUntilAt <= Date.now()) {
      this.clearLaborRoute();
      return;
    }

    if (snapshot.status === "working") {
      this.safePlayAnim(`${this.sprite.name}:work:${this.direction}`);
      return;
    }

    this.safePlayAnim(`${this.sprite.name}:walk:${this.direction}`);
  }

  clearLaborRoute() {
    this.currentJobId = undefined;
    this.targetBuildingId = undefined;
    this.laborPool = undefined;
    this.laborMapId = undefined;
    this.workUntilAt = undefined;
    this.routeMode = "patrol";
    this.routeStatus = "idle";
    this.routePath = this.patrolPath.map((point) => point.clone());
    this.routeIndex = this.resolveNearestPatrolIndex();
    this.sprite.setTexture(`${this.sprite.name}-${this.direction}-idle-0`);
    this.sprite.setDepth(this.sprite.y);
  }

  update(deltaSeconds: number) {
    const now = Date.now();

    if (this.routeMode === "labor" && this.routeStatus === "working") {
      if (this.workUntilAt && now >= this.workUntilAt) {
        this.clearLaborRoute();
        return;
      }

      this.safePlayAnim(`${this.sprite.name}:work:${this.direction}`);
      return;
    }

    if (this.routePath.length < 2) {
      if (this.routeMode === "labor") {
        this.beginWork();
      }
      return;
    }

    const target = this.routePath[this.routeIndex]!;
    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, target.x, target.y);

    if (distance <= 3) {
      if (this.routeMode === "labor" && this.routeIndex >= this.routePath.length - 1) {
        this.beginWork();
        return;
      }

      if (this.routeIndex >= this.routePath.length - 1) {
        this.routeIndex = 0;
      } else {
        this.routeIndex += 1;
      }

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
    this.safePlayAnim(`${this.sprite.name}:walk:${this.direction}`);
    this.sprite.setDepth(this.sprite.y);
  }

  private beginWork() {
    this.routeStatus = "working";
    this.workUntilAt = Date.now() + 900;
    this.safePlayAnim(`${this.sprite.name}:work:${this.direction}`);
  }

  private safePlayAnim(key: string) {
    if (!this.sprite?.active || !this.sprite.anims) {
      return;
    }
    if (!this.sprite.anims.exists(key)) {
      // Fall back to idle frame rather than crash
      if (this.sprite.anims.currentAnim?.key !== key) {
        this.sprite.stop();
        const tex = `${this.sprite.name}-${this.direction}-idle-0`;
        if (this.sprite.scene?.textures.exists(tex)) {
          this.sprite.setTexture(tex);
        }
      }
      return;
    }
    this.sprite.anims.play(key, true);
  }

  private releaseLaborRoute() {
    this.clearLaborRoute();
  }

  private resolveNearestPatrolIndex() {
    if (this.patrolPath.length === 0) {
      return 0;
    }

    const current = this.getPosition();
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    this.patrolPath.forEach((point, index) => {
      const distance = Phaser.Math.Distance.Between(current.x, current.y, point.x, point.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }
}
