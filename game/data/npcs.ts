import type { AgentRole, CharacterType, MapId } from "@/game/core/live-types";

export type NpcDefinition = {
  id: string;
  name: string;
  spriteId: string;
  entityType: CharacterType;
  role: AgentRole | "guide" | "treasurer";
  mapId: MapId;
  pathId?: string;
  shortBio: string;
  dialogueId: string;
  questHooks: string[];
  economyRole: string;
};

export const npcDefinitions: NpcDefinition[] = [
  {
    id: "keeper",
    name: "Village Keeper",
    spriteId: "npc-keeper",
    entityType: "human",
    role: "guide",
    mapId: "village-exterior",
    pathId: "keeper-route",
    shortBio: "Maintains the contract gate and routes new players toward the first live action.",
    dialogueId: "keeper",
    questHooks: ["arrival", "wallet-validation", "shop-open"],
    economyRole: "Tutorial guide and world-state narrator.",
  },
  {
    id: "shopkeeper",
    name: "Forge Master",
    spriteId: "npc-shopkeeper",
    entityType: "agent",
    role: "shop",
    mapId: "forge-interior",
    pathId: "shopkeeper-loop",
    shortBio: "Owns the first demand node and opens the route into the supplier district.",
    dialogueId: "shopkeeper",
    questHooks: ["open-shop"],
    economyRole: "Creates live demand with createShop.",
  },
  {
    id: "supplier",
    name: "Supply Coil",
    spriteId: "npc-supplier",
    entityType: "agent",
    role: "supplier",
    mapId: "depot-interior",
    pathId: "supplier-loop",
    shortBio: "Turns supply listings into routed work and pays for downstream labor.",
    dialogueId: "supplier",
    questHooks: ["open-depot", "hire-worker", "hire-supplier"],
    economyRole: "Lists services and hires worker routes.",
  },
  {
    id: "worker",
    name: "Node Pilot",
    spriteId: "npc-worker",
    entityType: "agent",
    role: "worker",
    mapId: "village-exterior",
    pathId: "worker-route",
    shortBio: "Embodies fulfilled labor and visible transaction proof.",
    dialogueId: "worker",
    questHooks: ["open-guild", "replay-worker-payment"],
    economyRole: "Receives hireService payments and proves changed outcomes.",
  },
  {
    id: "treasurer",
    name: "Reserve Steward",
    spriteId: "npc-treasurer",
    entityType: "human",
    role: "treasurer",
    mapId: "treasury-interior",
    pathId: "treasurer-loop",
    shortBio: "Reads treasury deltas as village light, unlocks notices, and returns grants.",
    dialogueId: "treasurer",
    questHooks: ["treasury-proof", "treasury-reinvest"],
    economyRole: "Displays treasury impact and reinvestment receipts.",
  },
  {
    id: "governor",
    name: "Council Steward",
    spriteId: "npc-governor",
    entityType: "agent",
    role: "governor",
    mapId: "council-interior",
    pathId: "governor-loop",
    shortBio: "Manages proposals, votes, and executed rule changes.",
    dialogueId: "governor",
    questHooks: ["propose-rule-change", "vote-rule-change", "execute-rule-change"],
    economyRole: "Runs live governance actions.",
  },
];
