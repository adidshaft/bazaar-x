import type { AgentRole, MapId } from "@/game/core/live-types";

export type NpcDefinition = {
  id: string;
  name: string;
  spriteId: string;
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
    role: "shop",
    mapId: "forge-interior",
    pathId: "forge-loop",
    shortBio: "Owns the first demand node and opens the route into the supplier district.",
    dialogueId: "shopkeeper",
    questHooks: ["open-shop"],
    economyRole: "Creates live demand with createShop.",
  },
  {
    id: "supplier",
    name: "Supply Coil",
    spriteId: "npc-supplier",
    role: "supplier",
    mapId: "depot-interior",
    pathId: "depot-loop",
    shortBio: "Turns supply listings into routed work and pays for downstream labor.",
    dialogueId: "supplier",
    questHooks: ["open-depot", "hire-worker", "hire-supplier"],
    economyRole: "Lists services and hires worker routes.",
  },
  {
    id: "worker",
    name: "Node Pilot",
    spriteId: "npc-worker",
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
    role: "treasurer",
    mapId: "treasury-interior",
    pathId: "treasury-loop",
    shortBio: "Reads treasury deltas as village light, unlocks notices, and returns grants.",
    dialogueId: "treasurer",
    questHooks: ["treasury-proof", "treasury-reinvest"],
    economyRole: "Displays treasury impact and reinvestment receipts.",
  },
  {
    id: "governor",
    name: "Council Steward",
    spriteId: "npc-governor",
    role: "governor",
    mapId: "council-interior",
    pathId: "council-loop",
    shortBio: "Manages proposals, votes, and executed rule changes.",
    dialogueId: "governor",
    questHooks: ["propose-rule-change", "vote-rule-change", "execute-rule-change"],
    economyRole: "Runs live governance actions.",
  },
];

