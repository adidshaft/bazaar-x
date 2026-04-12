import type { AISkillDefinition } from "@/game/core/live-types";

export type SkillManifestJsonLd = {
  "@context": Array<string | Record<string, string>>;
  "@type": "SkillManifest";
  version: string;
  skill_id: string;
  identity: AISkillDefinition["identity"];
  execution: AISkillDefinition["execution"];
  visual_metadata: AISkillDefinition["visual_metadata"];
  interop_stats: AISkillDefinition["interop_stats"];
  logic_hash: string;
  permission_scope: string[];
};

export function findSkillById(skillId: string) {
  return aiSkillCatalog.find((skill) => skill.skill_id === skillId) ?? null;
}

function deepSort(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => deepSort(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((accumulator, key) => {
      const next = (value as Record<string, unknown>)[key];
      if (next !== undefined) {
        accumulator[key] = deepSort(next);
      }
      return accumulator;
    }, {});
}

export function stableStringify(value: unknown) {
  return JSON.stringify(deepSort(value));
}

export function buildSkillManifestJsonLd(skill: AISkillDefinition): SkillManifestJsonLd {
  return {
    "@context": [
      "https://schema.org",
      {
        skill: "https://bazaar-x.example/ns/skill#",
        logic_hash: "skill:logicHash",
        permission_scope: "skill:permissionScope",
      },
    ],
    "@type": "SkillManifest",
    version: skill.version,
    skill_id: skill.skill_id,
    identity: skill.identity,
    execution: skill.execution,
    visual_metadata: skill.visual_metadata,
    interop_stats: skill.interop_stats,
    logic_hash: skill.execution.logic_hash,
    permission_scope: skill.execution.permission_scope,
  };
}

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
  {
    version: "2026.1.0",
    skill_id: "onchain-os-oracle-v1",
    identity: {
      name: "OnchainOS Oracle Feed",
      description:
        "Verifies live price feeds and treasury balance proofs through the OnchainOS oracle network before any payment is dispatched.",
      owner_requirement: "EIP-8004 Agent Identity",
    },
    execution: {
      protocol: "OnchainOS",
      target_contract: "0xOnchainOS_Oracle_XLayer_Contract",
      logic_hash: "ipfs://QmBazaarXOnchainOSSkill",
      permission_scope: ["read:price_feed", "read:treasury_state", "call:verify_oracle"],
      delegation_protocol: "okx-agentic-wallet",
      monetization_protocol: "okx-x402-payment",
      delegated_action: "Oracle",
      unlock_price_okb: "0.008",
    },
    visual_metadata: {
      sprite_aura: "gold_glow",
      ui_icon: "icon_oracle_gold.webp",
      rarity: "Epic",
      glow_color: "#ffd700",
    },
    interop_stats: {
      efficiency_bonus: 1.12,
      gas_reduction_bps: 300,
      compatible_tags: ["Oracle", "Price-Feed", "OnchainOS", "Treasury"],
    },
  },
  {
    version: "2026.1.0",
    skill_id: "uniswap-xlayer-amm-v1",
    identity: {
      name: "Uniswap X Layer AMM",
      description:
        "Routes village supply payments through Uniswap V3 pools on X Layer. Every hire-supplier action creates a live swap signal in the AMM.",
      owner_requirement: "EIP-8004 Agent Identity",
    },
    execution: {
      protocol: "Uniswap-V3-XLayer",
      target_contract: "0xUniswap_V3_XLayer_Pool_Address",
      logic_hash: "ipfs://QmBazaarXUniswapXLayerSkill",
      permission_scope: ["read:pool_state", "write:swap_route", "call:execute_swap"],
      delegation_protocol: "okx-agentic-wallet",
      monetization_protocol: "okx-x402-payment",
      delegated_action: "Swap",
      unlock_price_okb: "0.010",
    },
    visual_metadata: {
      sprite_aura: "pink_glow",
      ui_icon: "icon_uniswap_pink.webp",
      rarity: "Legendary",
      glow_color: "#ff007a",
    },
    interop_stats: {
      efficiency_bonus: 1.18,
      gas_reduction_bps: 420,
      compatible_tags: ["DeFi", "AMM", "Uniswap", "X-Layer", "Swap"],
    },
  },
];

export const defaultUnlockedSkillIds = ["bazaar-x-logistics-v1"];
