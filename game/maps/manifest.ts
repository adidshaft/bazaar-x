import villageExterior from "@/game/maps/compiled/village-exterior.json";
import forgeInterior from "@/game/maps/compiled/forge-interior.json";
import depotInterior from "@/game/maps/compiled/depot-interior.json";
import treasuryInterior from "@/game/maps/compiled/treasury-interior.json";
import councilInterior from "@/game/maps/compiled/council-interior.json";
import type { MapId } from "@/game/core/live-types";
import type { CompiledMapJson } from "@/game/core/map-types";

export const compiledMapManifest: Record<MapId, CompiledMapJson> = {
  "village-exterior": villageExterior as unknown as CompiledMapJson,
  "forge-interior": forgeInterior as unknown as CompiledMapJson,
  "depot-interior": depotInterior as unknown as CompiledMapJson,
  "treasury-interior": treasuryInterior as unknown as CompiledMapJson,
  "council-interior": councilInterior as unknown as CompiledMapJson,
};

export function getCompiledMap(mapId: MapId) {
  return compiledMapManifest[mapId];
}
