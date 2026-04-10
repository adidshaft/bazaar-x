import type { DistrictId, MapId } from "@/game/core/live-types";

export type DistrictDefinition = {
  id: DistrictId;
  name: string;
  subtitle: string;
  theme: string;
  landmarkSet: string[];
  interactPoints: string[];
  npcRoster: string[];
  music: string;
  linkedInteriors: MapId[];
};

export type BuildingDefinition = {
  id: string;
  districtId: DistrictId;
  name: string;
  mapId: MapId;
  portalMapId?: MapId;
  landmark: string;
  description: string;
  roleAccent: string;
};

export const districtDefinitions: DistrictDefinition[] = [
  {
    id: "village-gate",
    name: "Canal Gate",
    subtitle: "Arrival road",
    theme: "blue stone, banner shade, canal mist",
    landmarkSet: ["keeper hall", "bridge lamps", "market sign"],
    interactPoints: ["keeper-gate", "settlement-keep"],
    npcRoster: ["keeper"],
    music: "bazaar-exploration",
    linkedInteriors: [],
  },
  {
    id: "market-row",
    name: "Bazaar Forge",
    subtitle: "Demand district",
    theme: "slate roofs, iron trim, forge light",
    landmarkSet: ["forge front", "service board", "coin awning"],
    interactPoints: ["forge-door", "forge-board"],
    npcRoster: ["shopkeeper"],
    music: "bazaar-exploration",
    linkedInteriors: ["forge-interior"],
  },
  {
    id: "supplier-lane",
    name: "Supply Coil Depot",
    subtitle: "Fulfillment district",
    theme: "canal edge, hoists, stacked cargo",
    landmarkSet: ["depot shutters", "cargo crane", "route banner"],
    interactPoints: ["depot-door", "supplier-desk"],
    npcRoster: ["supplier"],
    music: "bazaar-exploration",
    linkedInteriors: ["depot-interior"],
  },
  {
    id: "worker-yard",
    name: "Node Pilot Yard",
    subtitle: "Labor district",
    theme: "cool planks, ledger posts, workshop sparks",
    landmarkSet: ["yard gate", "guild sign", "tool rack"],
    interactPoints: ["guild-yard", "worker-bench"],
    npcRoster: ["worker"],
    music: "bazaar-exploration",
    linkedInteriors: [],
  },
  {
    id: "treasury-vault",
    name: "Treasury Vault",
    subtitle: "Reserve district",
    theme: "ribbed stone, vault glow, secure arches",
    landmarkSet: ["vault arch", "treasury notice", "reserve lantern"],
    interactPoints: ["treasury-door", "treasury-board"],
    npcRoster: ["treasurer"],
    music: "bazaar-interior",
    linkedInteriors: ["treasury-interior"],
  },
  {
    id: "council-hall",
    name: "Covenant Hall",
    subtitle: "Governance district",
    theme: "slate columns, stained glass, decree glow",
    landmarkSet: ["council stair", "rule bell", "vote standard"],
    interactPoints: ["council-door", "governor-dais"],
    npcRoster: ["governor"],
    music: "bazaar-interior",
    linkedInteriors: ["council-interior"],
  },
];

export const buildingDefinitions: BuildingDefinition[] = [
  {
    id: "settlement-keep",
    districtId: "village-gate",
    name: "Settlement Keep",
    mapId: "village-exterior",
    landmark: "keeper hall",
    description: "The contract gate, treasury route, and village charter all start here.",
    roleAccent: "#7de6ff",
  },
  {
    id: "forge-door",
    districtId: "market-row",
    name: "Bazaar Forge",
    mapId: "village-exterior",
    portalMapId: "forge-interior",
    landmark: "forge front",
    description: "Open the first shop, light demand, and post live services from here.",
    roleAccent: "#ff9a78",
  },
  {
    id: "depot-door",
    districtId: "supplier-lane",
    name: "Supply Coil Depot",
    mapId: "village-exterior",
    portalMapId: "depot-interior",
    landmark: "cargo depot",
    description: "List routes, stage supply work, and dispatch the next hire.",
    roleAccent: "#8db8ff",
  },
  {
    id: "treasury-door",
    districtId: "treasury-vault",
    name: "Treasury Vault",
    mapId: "village-exterior",
    portalMapId: "treasury-interior",
    landmark: "vault arch",
    description: "Watch tax receipts land, brighten the vault, and reveal reserve proof.",
    roleAccent: "#8ff0d5",
  },
  {
    id: "council-door",
    districtId: "council-hall",
    name: "Covenant Hall",
    mapId: "village-exterior",
    portalMapId: "council-interior",
    landmark: "council stair",
    description: "Propose, vote, and execute rule changes that alter the next payment.",
    roleAccent: "#d7b8ff",
  },
];
