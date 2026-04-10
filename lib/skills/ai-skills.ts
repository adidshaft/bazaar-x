import type { AISkillDefinition } from "@/game/core/live-types";

export const aiSkillCatalog: AISkillDefinition[] = [
  {
    version: "2026.1.0",
    skill_id: "bazaar-x-logistics-v1",
    identity: {
      name: "Supply Chain Master",
      description:
        "Optimizes labor routing to reduce gas overhead and increase production yields.",
      owner_requirement: "EIP-8004 Agent Identity",
    },
    execution: {
      protocol: "X402",
      target_contract: "0xX_Layer_Skill_Registry_Address",
      logic_hash: "ipfs://QmBazaarXLogisticsSkill",
      permission_scope: ["read:village_state", "write:trade_route", "call:mint_resource"],
      delegation_protocol: "okx-agentic-wallet",
      monetization_protocol: "okx-x402-payment",
      delegated_action: "Trade",
      unlock_price_okb: "0.014",
    },
    visual_metadata: {
      sprite_aura: "cyan_glow",
      ui_icon: "icon_gear_gold.webp",
      rarity: "Legendary",
      glow_color: "#4de6ff",
    },
    interop_stats: {
      efficiency_bonus: 1.15,
      gas_reduction_bps: 500,
      compatible_tags: ["DeFi-Optimizer", "Village-Management", "Labor-Routing"],
    },
  },
  {
    version: "2026.1.0",
    skill_id: "bazaar-x-combat-v1",
    identity: {
      name: "Redline Vanguard",
      description:
        "Converts reactive routing into aggressive defense patterns for volatile trade corridors.",
      owner_requirement: "EIP-8004 Agent Identity",
    },
    execution: {
      protocol: "X402",
      target_contract: "0xX_Layer_Skill_Registry_Address",
      logic_hash: "ipfs://QmBazaarXCombatSkill",
      permission_scope: ["read:village_state", "write:defense_stance", "call:secure_route"],
      delegation_protocol: "okx-agentic-wallet",
      monetization_protocol: "okx-x402-payment",
      delegated_action: "Escort",
      unlock_price_okb: "0.018",
    },
    visual_metadata: {
      sprite_aura: "red_glow",
      ui_icon: "icon_blade_crimson.webp",
      rarity: "Epic",
      glow_color: "#ff6a5c",
    },
    interop_stats: {
      efficiency_bonus: 1.08,
      gas_reduction_bps: 250,
      compatible_tags: ["Combat", "Route-Defense", "Rapid-Response"],
    },
  },
  {
    version: "2026.1.0",
    skill_id: "bazaar-x-governance-v1",
    identity: {
      name: "Covenant Chorus",
      description:
        "Surfaces governance sentiment in real time and stabilizes proposal execution timing.",
      owner_requirement: "EIP-8004 Agent Identity",
    },
    execution: {
      protocol: "X402",
      target_contract: "0xX_Layer_Skill_Registry_Address",
      logic_hash: "ipfs://QmBazaarXGovernanceSkill",
      permission_scope: ["read:governance", "read:block_ledger", "call:vote"],
      delegation_protocol: "okx-agentic-wallet",
      monetization_protocol: "okx-x402-payment",
      delegated_action: "Vote",
      unlock_price_okb: "0.011",
    },
    visual_metadata: {
      sprite_aura: "violet_glow",
      ui_icon: "icon_covenant_violet.webp",
      rarity: "Rare",
      glow_color: "#b79bff",
    },
    interop_stats: {
      efficiency_bonus: 1.04,
      gas_reduction_bps: 150,
      compatible_tags: ["Governance", "Council", "Onchain-Coordination"],
    },
  },
];

export const defaultUnlockedSkillIds = ["bazaar-x-logistics-v1"];
