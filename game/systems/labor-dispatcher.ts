import * as Phaser from "phaser";
import type { Hex } from "viem";
import { TILE_SIZE } from "@/game/config/constants";
import { bazaarGameStore } from "@/game/core/store";
import type {
  LaborJobKind,
  LaborJobStatus,
  LaborPoolId,
  LaborRoutingJob,
  LaborRoutingNpcState,
  LaborRoutingState,
  LiveDashboardStatus,
  MapId,
  QuestActionId,
} from "@/game/core/live-types";
import { npcDefinitions } from "@/game/data/npcs";
import type { NpcActor } from "@/game/entities/npc";
import { findGridPath, resolveNearestWalkable } from "@/game/systems/a-star-grid";

type LaborBlueprint = {
  pool: LaborPoolId;
  kind: LaborJobKind;
  targetBuildingId: string;
  targetMapId: MapId;
};

type LaborStep = NonNullable<NonNullable<LiveDashboardStatus["liveDashboard"]["runtime"]>>["steps"][number];

const stepBlueprints: Record<string, LaborBlueprint> = {
  deploy: {
    pool: "council",
    kind: "job-assigned",
    targetBuildingId: "settlement-keep",
    targetMapId: "village-exterior",
  },
  "shop-create": {
    pool: "depot",
    kind: "job-assigned",
    targetBuildingId: "forge-door",
    targetMapId: "village-exterior",
  },
  "supplier-shop": {
    pool: "depot",
    kind: "supply-requested",
    targetBuildingId: "depot-door",
    targetMapId: "village-exterior",
  },
  "supplier-service": {
    pool: "depot",
    kind: "supply-requested",
    targetBuildingId: "depot-door",
    targetMapId: "village-exterior",
  },
  "worker-shop": {
    pool: "depot",
    kind: "job-assigned",
    targetBuildingId: "guild-yard",
    targetMapId: "village-exterior",
  },
  "worker-service": {
    pool: "depot",
    kind: "job-assigned",
    targetBuildingId: "guild-yard",
    targetMapId: "village-exterior",
  },
  "supplier-hires-worker": {
    pool: "depot",
    kind: "value-flow",
    targetBuildingId: "treasury-door",
    targetMapId: "village-exterior",
  },
  "shop-hires-supplier": {
    pool: "depot",
    kind: "value-flow",
    targetBuildingId: "forge-door",
    targetMapId: "village-exterior",
  },
  proposal: {
    pool: "council",
    kind: "job-assigned",
    targetBuildingId: "council-door",
    targetMapId: "village-exterior",
  },
  "vote-shop": {
    pool: "council",
    kind: "job-assigned",
    targetBuildingId: "council-door",
    targetMapId: "village-exterior",
  },
  "vote-supplier": {
    pool: "council",
    kind: "job-assigned",
    targetBuildingId: "council-door",
    targetMapId: "village-exterior",
  },
  "vote-worker": {
    pool: "council",
    kind: "job-assigned",
    targetBuildingId: "council-door",
    targetMapId: "village-exterior",
  },
  execute: {
    pool: "council",
    kind: "job-assigned",
    targetBuildingId: "council-door",
    targetMapId: "village-exterior",
  },
  "post-governance-hire": {
    pool: "depot",
    kind: "value-flow",
    targetBuildingId: "treasury-door",
    targetMapId: "village-exterior",
  },
  "treasury-reinvests": {
    pool: "council",
    kind: "value-flow",
    targetBuildingId: "treasury-door",
    targetMapId: "village-exterior",
  },
};

function createEmptyState(): LaborRoutingState {
  return {
    jobs: [],
    npcStates: {},
    observedStepKeys: [],
  };
}

function buildJobId(stepKey: string, txHash?: Hex) {
  void txHash;
  return stepKey;
}

function findBlueprint(stepKey: string, actionId?: QuestActionId): LaborBlueprint | null {
  if (stepBlueprints[stepKey]) {
    return stepBlueprints[stepKey];
  }

  const actionMap: Partial<Record<QuestActionId, string>> = {
    "deploy-bazaar": "deploy",
    "open-shop": "shop-create",
    "open-depot": "supplier-service",
    "open-guild": "worker-service",
    "hire-worker": "supplier-hires-worker",
    "hire-supplier": "shop-hires-supplier",
    "propose-rule-change": "proposal",
    "vote-rule-change": "vote-worker",
    "execute-rule-change": "execute",
    "replay-worker-payment": "post-governance-hire",
    "treasury-reinvest": "treasury-reinvests",
  };

  const mappedStepKey = actionId ? actionMap[actionId] : undefined;
  return mappedStepKey ? stepBlueprints[mappedStepKey] ?? null : null;
}

function resolveStepKind(step: LaborStep, blueprint: LaborBlueprint): LaborJobStatus {
  if (step.status === "pending") {
    return "queued";
  }

  if (step.status === "success") {
    return blueprint.kind === "value-flow" ? "dispatched" : "queued";
  }

  return "queued";
}

function snapshotFromActors(
  actors: NpcActor[],
  jobs: LaborRoutingJob[],
  observedStepKeys: string[],
): LaborRoutingState {
  const npcStates: Record<string, LaborRoutingNpcState> = {};
  actors.forEach((actor) => {
    const snapshot = actor.getRoutingSnapshot();
    if (!snapshot) {
      return;
    }

    npcStates[snapshot.npcId] = snapshot;
  });

  return {
    jobs: jobs.map((job) => ({
      ...job,
      path: job.path.map((point) => ({ x: point.x, y: point.y })),
    })),
    npcStates,
    observedStepKeys,
    lastSyncedAt: new Date().toISOString(),
  };
}

function resolveActorRole(actorId: string) {
  return npcDefinitions.find((entry) => entry.id === actorId)?.role ?? "worker";
}

function resolveTilePath(grid: boolean[][], start: Phaser.Math.Vector2, target: Phaser.Math.Vector2) {
  const startTile = resolveNearestWalkable(
    grid,
    {
      x: Math.floor(start.x / TILE_SIZE),
      y: Math.floor(start.y / TILE_SIZE),
    },
  );
  const targetTile = resolveNearestWalkable(
    grid,
    {
      x: Math.floor(target.x / TILE_SIZE),
      y: Math.floor(target.y / TILE_SIZE),
    },
  );

  return findGridPath(grid, startTile, targetTile).map(
    (point) => new Phaser.Math.Vector2(point.x * TILE_SIZE + TILE_SIZE / 2, point.y * TILE_SIZE + TILE_SIZE / 2),
  );
}

export type LaborDispatcherOptions = {
  mapId: () => MapId;
  getWalkGrid: () => boolean[][];
  getNpcActors: () => NpcActor[];
  getNpcActor: (npcId: string) => NpcActor | undefined;
  getInteractableCenter: (buildingId: string) => Phaser.Math.Vector2 | null;
  getTreasuryCenter: () => Phaser.Math.Vector2 | null;
  onValueFlow?: (input: { from: Phaser.Math.Vector2; to: Phaser.Math.Vector2; job: LaborRoutingJob; npc: NpcActor }) => void;
  persist: (state: LaborRoutingState) => void;
};

export class LaborDispatcher {
  private readonly jobsById = new Map<string, LaborRoutingJob>();
  private readonly observedStepKeys = new Set<string>();
  private bootstrapped = false;
  private dirty = false;
  private lastPersistAt = 0;

  constructor(private readonly options: LaborDispatcherOptions) {}

  restore(state: LaborRoutingState | null | undefined) {
    this.jobsById.clear();
    this.observedStepKeys.clear();

    const nextState = state ?? createEmptyState();
    nextState.jobs.forEach((job) => {
      this.jobsById.set(job.id, {
        ...job,
        path: job.path.map((point) => ({ x: point.x, y: point.y })),
      });
    });
    nextState.observedStepKeys.forEach((stepKey) => this.observedStepKeys.add(stepKey));

    Object.values(nextState.npcStates).forEach((snapshot) => {
      const actor = this.options.getNpcActor(snapshot.npcId);
      if (!actor) {
        return;
      }

      actor.restoreLaborRoute(snapshot);
    });

    this.syncState(true);
    this.bootstrapped = true;
  }

  consumeStatus(status: LiveDashboardStatus | null) {
    const runtime = status?.liveDashboard.runtime;
    if (!runtime) {
      return;
    }

    runtime.steps.forEach((step) => {
      const blueprint = stepBlueprints[step.key];
      if (!blueprint) {
        return;
      }

      if (step.status === "pending" && !this.jobsById.has(buildJobId(step.key, step.txHash))) {
        this.enqueueStep(step, blueprint);
      }

      if (step.status === "success") {
        this.observedStepKeys.add(step.key);
        this.settleStep(step, blueprint);
      }
    });

    if (!this.bootstrapped) {
      runtime.steps.forEach((step) => {
        if (step.status !== "failed") {
          this.observedStepKeys.add(step.key);
        }
      });
      this.bootstrapped = true;
    }

    this.syncState();
  }

  noteConfirmedAction(actionId: QuestActionId, stepKey?: string, txHash?: Hex) {
    const blueprint = stepKey ? findBlueprint(stepKey, actionId) : findBlueprint("", actionId);
    if (!blueprint) {
      return;
    }

    const resolvedStepKey = stepKey ?? this.resolveStepKeyForAction(actionId);
    if (!resolvedStepKey) {
      return;
    }

    this.observedStepKeys.add(resolvedStepKey);
    this.enqueueJob({
      id: buildJobId(resolvedStepKey, txHash),
      stepKey: resolvedStepKey,
      actionId,
      label: resolvedStepKey.replace(/-/g, " "),
      kind: blueprint.kind,
      pool: blueprint.pool,
      targetBuildingId: blueprint.targetBuildingId,
      targetMapId: blueprint.targetMapId,
      status: "dispatched",
      path: [],
      pathIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      txHash,
    });
  }

  update(time: number, delta: number) {
    void delta;
    this.assignQueuedJobs();

    const activeSnapshots: LaborRoutingNpcState[] = [];
    this.options.getNpcActors().forEach((actor) => {
      if (actor.isAvailableForLabor()) {
        return;
      }

      const snapshot = actor.getRoutingSnapshot();
      if (!snapshot) {
        return;
      }

      activeSnapshots.push(snapshot);

      const job = this.jobsById.get(snapshot.currentJobId ?? "");
      if (!job) {
        return;
      }

      const nextJob = {
        ...job,
        status: snapshot.status === "working" ? "working" : snapshot.status === "walking" ? "walking" : job.status,
        path: snapshot.path,
        pathIndex: snapshot.pathIndex,
        workUntilAt: snapshot.workUntilAt,
        updatedAt: new Date().toISOString(),
      } satisfies LaborRoutingJob;
      this.jobsById.set(job.id, nextJob);
      this.dirty = true;
    });

    this.finalizeReleasedJobs();

    const storedSnapshotIds = Object.keys(bazaarGameStore.getState().laborRouting.npcStates).sort().join(",");
    const activeSnapshotIds = activeSnapshots.map((snapshot) => snapshot.npcId).sort().join(",");
    if (storedSnapshotIds !== activeSnapshotIds) {
      this.dirty = true;
    }

    if (this.dirty && time - this.lastPersistAt > 100) {
      this.syncState(true);
    }
  }

  private enqueueStep(step: LaborStep, blueprint: LaborBlueprint) {
    const jobId = buildJobId(step.key, step.txHash);
    if (this.jobsById.has(jobId)) {
      return;
    }

    this.enqueueJob({
      id: jobId,
      stepKey: step.key,
      actionId: undefined,
      label: step.label,
      kind: blueprint.kind,
      pool: blueprint.pool,
      targetBuildingId: blueprint.targetBuildingId,
      targetMapId: blueprint.targetMapId,
      status: resolveStepKind(step, blueprint),
      path: [],
      pathIndex: 0,
      createdAt: step.startedAt,
      updatedAt: step.completedAt ?? step.startedAt,
      txHash: step.txHash,
      amountOkb: step.meta?.taxOkb ? String(step.meta.taxOkb) : undefined,
    });
  }

  private enqueueJob(job: LaborRoutingJob) {
    const existing = this.jobsById.get(job.id);
    if (existing) {
      this.jobsById.set(job.id, {
        ...existing,
        ...job,
        path: job.path.length ? job.path : existing.path,
        npcId: job.npcId ?? existing.npcId,
      });
    } else {
      this.jobsById.set(job.id, job);
    }

    this.dirty = true;
    this.assignQueuedJobs();
  }

  private assignQueuedJobs() {
    const grid = this.options.getWalkGrid();
    if (grid.length === 0) {
      return;
    }

    const queuedJobs = [...this.jobsById.values()].filter((job) => job.status === "queued" || job.status === "dispatched");
    queuedJobs.forEach((job) => {
      if (job.status === "working" || job.status === "complete") {
        return;
      }

      if (job.npcId) {
        return;
      }

      const actor = this.resolveIdleActor(job.pool, job.targetBuildingId);
      if (!actor) {
        return;
      }

      const targetCenter = this.options.getInteractableCenter(job.targetBuildingId);
      if (!targetCenter) {
        return;
      }

      const path = resolveTilePath(grid, actor.getPosition(), targetCenter);
      if (path.length === 0) {
        return;
      }

      const role = resolveActorRole(actor.id) as LaborRoutingNpcState["role"];
      actor.assignLaborRoute(job, path, this.options.mapId(), job.pool, role);

      const nextJob = {
        ...job,
        npcId: actor.id,
        status: "walking" as const,
        path: path.map((point) => ({ x: point.x, y: point.y })),
        pathIndex: path.length > 1 ? 1 : 0,
        updatedAt: new Date().toISOString(),
      } satisfies LaborRoutingJob;
      this.jobsById.set(job.id, nextJob);
      this.dirty = true;
    });
  }

  private resolveIdleActor(pool: LaborPoolId, targetBuildingId: string) {
    const actors = this.options.getNpcActors();
    const poolRoles = pool === "council" ? new Set(["guide", "governor", "treasurer"]) : new Set(["worker", "supplier", "shop"]);
    const viable = actors
      .filter((actor) => actor.isAvailableForLabor())
      .filter((actor) => poolRoles.has(resolveActorRole(actor.id)))
      .map((actor) => {
        const distance = Phaser.Math.Distance.BetweenPoints(
          actor.getPosition(),
          this.options.getInteractableCenter(targetBuildingId) ?? actor.getPosition(),
        );
        return { actor, distance };
      })
      .sort((left, right) => left.distance - right.distance)[0]?.actor;

    if (viable) {
      return viable;
    }

    return actors
      .filter((actor) => actor.isAvailableForLabor())
      .map((actor) => {
        const distance = Phaser.Math.Distance.BetweenPoints(
          actor.getPosition(),
          this.options.getInteractableCenter(targetBuildingId) ?? actor.getPosition(),
        );
        return { actor, distance };
      })
      .sort((left, right) => left.distance - right.distance)[0]?.actor;
  }

  private resolveStepKeyForAction(actionId: QuestActionId) {
    const actionMap: Partial<Record<QuestActionId, string>> = {
      "deploy-bazaar": "deploy",
      "open-shop": "shop-create",
      "open-depot": "supplier-service",
      "open-guild": "worker-service",
      "hire-worker": "supplier-hires-worker",
      "hire-supplier": "shop-hires-supplier",
      "propose-rule-change": "proposal",
      "vote-rule-change": "vote-worker",
      "execute-rule-change": "execute",
      "replay-worker-payment": "post-governance-hire",
      "treasury-reinvest": "treasury-reinvests",
    };

    return actionMap[actionId] ?? null;
  }

  private settleStep(step: LaborStep, blueprint: LaborBlueprint) {
    const jobId = buildJobId(step.key, step.txHash);
    if (!this.jobsById.has(jobId)) {
      this.enqueueStep(step, blueprint);
    }

    const matchedJobs = [...this.jobsById.values()].filter((job) => job.stepKey === step.key && job.status !== "complete");
    matchedJobs.forEach((job) => {
      this.jobsById.set(job.id, {
        ...job,
        txHash: step.txHash ?? job.txHash,
        amountOkb: step.meta?.taxOkb ? String(step.meta.taxOkb) : job.amountOkb,
        status:
          job.status === "walking" || job.status === "working"
            ? job.status
            : job.npcId
              ? "walking"
              : "queued",
        updatedAt: step.completedAt ?? new Date().toISOString(),
      });
    });

    if (matchedJobs.length > 0) {
      this.dirty = true;
    }
  }

  private finalizeReleasedJobs() {
    const treasury = this.options.getTreasuryCenter();
    const activeJobIds = new Set(
      this.options
        .getNpcActors()
        .map((actor) => actor.getCurrentJobId())
        .filter((jobId): jobId is string => Boolean(jobId)),
    );

    [...this.jobsById.values()]
      .filter((job) => job.npcId && job.status !== "complete")
      .forEach((job) => {
        if (activeJobIds.has(job.id)) {
          return;
        }

        const actor = this.options.getNpcActor(job.npcId ?? "");
        if (treasury && actor && this.options.onValueFlow) {
          this.options.onValueFlow({
            from: actor.getPosition(),
            to: treasury,
            job,
            npc: actor,
          });
        }

        this.jobsById.set(job.id, {
          ...job,
          status: "complete",
          updatedAt: new Date().toISOString(),
        });
        this.dirty = true;
      });
  }

  private syncState(force = false) {
    if (!force && !this.dirty) {
      return;
    }

    const snapshot = snapshotFromActors(this.options.getNpcActors(), [...this.jobsById.values()], [...this.observedStepKeys]);
    bazaarGameStore.getState().setLaborRoutingState(snapshot);

    this.options.persist(snapshot);
    this.lastPersistAt = Date.now();
    this.dirty = false;
  }
}

export function createEmptyLaborRoutingState() {
  return createEmptyState();
}
