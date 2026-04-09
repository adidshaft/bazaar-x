import * as Phaser from "phaser";
import type { CompiledMapObject } from "@/game/core/map-types";
import type { DistrictId, MapId } from "@/game/core/live-types";

export type WorldInteractable = {
  id: string;
  name: string;
  center: Phaser.Math.Vector2;
  radius: number;
  districtId: DistrictId | null;
  npcId?: string;
  label?: string;
  targetMapId?: MapId;
  spawnId?: string;
};

export function createWorldInteractable(object: CompiledMapObject) {
  const center = new Phaser.Math.Vector2(object.x + object.width / 2, object.y + object.height / 2);
  return {
    id: object.name,
    name: object.name,
    center,
    radius: Math.max(36, object.width * 0.8),
    districtId: (typeof object.properties.districtId === "string"
      ? object.properties.districtId
      : null) as DistrictId | null,
    npcId: typeof object.properties.npcId === "string" ? object.properties.npcId : undefined,
    label: typeof object.properties.label === "string" ? object.properties.label : undefined,
    targetMapId:
      typeof object.properties.targetMapId === "string"
        ? (object.properties.targetMapId as MapId)
        : undefined,
    spawnId: typeof object.properties.spawnId === "string" ? object.properties.spawnId : undefined,
  } satisfies WorldInteractable;
}
