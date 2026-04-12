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
    shortBio: "Turns wallet connection into citizenship and points players toward the canonical loop.",
    dialogueId: "keeper",
    questHooks: ["meet-keeper", "initialize-town"],
    economyRole: "Citizenship guide and arrival steward.",
  },
  {
    id: "shopkeeper",
    name: "Forge Master",
    spriteId: "npc-shopkeeper",
    entityType: "agent",
    role: "shop",
    mapId: "forge-interior",
    pathId: "shopkeeper-loop",
    shortBio: "Runs the first demand node and turns the opening shop into visible market activity.",
    dialogueId: "shopkeeper",
    questHooks: ["open-shop"],
    economyRole: "Creates demand and starts the market leg.",
  },
  {
    id: "supplier",
    name: "Supply Coil",
    spriteId: "npc-supplier",
    entityType: "agent",
    role: "supplier",
    mapId: "depot-interior",
    pathId: "supplier-loop",
    shortBio: "Turns supply listings into routed supplier credit, handoffs, and downstream labor.",
    dialogueId: "supplier",
    questHooks: ["open-depot", "hire-worker", "hire-supplier"],
    economyRole: "Stages fulfillment, clears the Uniswap route, and hires worker legs.",
  },
  {
    id: "worker",
    name: "Node Pilot",
    spriteId: "npc-worker",
    entityType: "agent",
    role: "worker",
    mapId: "village-exterior",
    pathId: "worker-route",
    shortBio: "Embodies paid labor and the replay check that proves rule changes matter.",
    dialogueId: "worker",
    questHooks: ["open-guild", "replay-worker-payment"],
    economyRole: "Shows wage settlement before and after governance.",
  },
  {
    id: "treasurer",
    name: "Reserve Steward",
    spriteId: "npc-treasurer",
    entityType: "human",
    role: "treasurer",
    mapId: "treasury-interior",
    pathId: "treasurer-loop",
    shortBio: "Reads native and token tax receipts as reserve state and approves reinvestment when the notice is real.",
    dialogueId: "treasurer",
    questHooks: ["treasury-reinvest"],
    economyRole: "Tracks tax, reserve balance, and reinvestment.",
  },
  {
    id: "governor",
    name: "Council Steward",
    spriteId: "npc-governor",
    entityType: "agent",
    role: "governor",
    mapId: "council-interior",
    pathId: "governor-loop",
    shortBio: "Runs proposals, votes, executions, and the replay test for new rules.",
    dialogueId: "governor",
    questHooks: ["propose-rule-change", "vote-rule-change", "execute-rule-change"],
    economyRole: "Changes the tax rule and proves it with a second payment.",
  },
];
