import type { Hex } from "viem";

export type AgentRole = "shop" | "supplier" | "worker" | "governor";
export type CharacterType = "agent" | "human";
export type DistrictId =
  | "village-gate"
  | "market-row"
  | "supplier-lane"
  | "worker-yard"
  | "treasury-vault"
  | "council-hall";

export type MapId =
  | "village-exterior"
  | "forge-interior"
  | "depot-interior"
  | "treasury-interior"
  | "council-interior";

export type SceneId = "boot" | "preload" | "overworld" | "interior" | "ui" | "cutscene";

export type QuestActionId =
  | "initialize-town"
  | "deploy-bazaar"
  | "open-shop"
  | "open-depot"
  | "open-guild"
  | "hire-worker"
  | "hire-supplier"
  | "propose-rule-change"
  | "vote-rule-change"
  | "execute-rule-change"
  | "replay-worker-payment"
  | "treasury-reinvest";

export type QuestState = "locked" | "available" | "active" | "complete";
export type TxState = "idle" | "pending" | "submitted" | "confirmed" | "failed" | "recovered";
export type Direction = "up" | "down" | "left" | "right";
export type WorldTier = 0 | 1 | 2;

export type AISkillDefinition = {
  version: string;
  skill_id: string;
  identity: {
    name: string;
    description: string;
    owner_requirement: string;
  };
  execution: {
    protocol: string;
    target_contract: string;
    logic_hash: string;
    permission_scope: string[];
    delegation_protocol?: string;
    monetization_protocol?: string;
    delegated_action?: string;
    unlock_price_okb?: string;
  };
  visual_metadata: {
    sprite_aura: string;
    ui_icon: string;
    rarity: string;
    glow_color?: string;
  };
  interop_stats: {
    efficiency_bonus: number;
    gas_reduction_bps: number;
    compatible_tags: string[];
  };
};

export type BazaarEconomicState = {
  tvlOkb: number;
  dailyVolumeOkb: number;
  dailyTransactionCount: number;
  treasuryInflowOkb: number;
  gdpScore: number;
  worldTier: WorldTier;
  sampledAt?: string;
  latestTreasuryTxHash?: Hex;
  latestTreasuryExplorerUrl?: string;
  latestTaxAmountOkb?: string;
};

export type BazaarGovernanceState = {
  activeProposalCount: number;
  activeProposalIds: number[];
  latestProposalId: number;
  ayeVotes: number;
  nayVotes: number;
};

export type BazaarGatewayState = {
  blockHeight: number;
  latestTxHash?: Hex;
  latestExplorerUrl?: string;
  syncedAt?: string;
};

export type LiveStepRecord = {
  key: string;
  label: string;
  status: "pending" | "success" | "failed";
  startedAt: string;
  completedAt?: string;
  txHash?: Hex;
  explorerUrl?: string;
  detail?: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type BazaarAgentManifest = {
  id?: string;
  role: AgentRole;
  name: string;
  handle?: string;
  goal: string;
  bootstrapOkb: string;
  address: `0x${string}`;
};

export type SanitizedWalletManifest = {
  network: string;
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string;
  createdAt?: string;
  savedAt?: string;
  deployer: { label?: string; address: `0x${string}` };
  treasury: { label?: string; address: `0x${string}` };
  agents: BazaarAgentManifest[];
};

export type FundingStatus = {
  readyForDeploy: boolean;
  readyForFlow: boolean;
  deployer: { address: `0x${string}`; balanceOkb: string; funded: boolean };
  treasury: { address: `0x${string}`; balanceOkb: string; funded: boolean };
  agents: Array<{ address: `0x${string}`; balanceOkb: string; funded: boolean }>;
  requiredDeployerBalanceOkb: string;
};

export type BazaarSnapshot = {
  address: `0x${string}`;
  explorerUrl?: string;
  chainId: number;
  treasury: `0x${string}`;
  treasuryBalanceWei: string;
  treasuryBalanceOkb: string;
  rules?: readonly unknown[];
  registeredAgentCount: number;
  nextShopId: number;
  nextServiceId: number;
  nextProposalId: number;
};

export type LiveRuntimeStatus = {
  status: "idle" | "ready" | "running" | "completed" | "failed";
  lastUpdatedAt?: string;
  txHashes: Hex[];
  steps: LiveStepRecord[];
  proposalId?: number;
  firstTaxWei?: string;
  secondTaxWei?: string;
  error?: string;
  deployment?: {
    contractAddress: `0x${string}`;
    deployTxHash: Hex;
    explorerBaseUrl: string;
    treasury: `0x${string}`;
    initialRules: {
      taxBps: number;
      minimumBalanceWei: string;
      quorumBps: number;
      supportBps: number;
      votingPeriodSeconds: number;
    };
  };
} | null;

export type LiveDashboardStatus = {
  runtime: {
    artifactAvailable: boolean;
    agentCount: number;
    round: number;
    treasury: number;
  };
  skills: Array<{
    id: string;
    name: string;
    description: string;
    version: string;
    tags: string[];
  }>;
  aiSkills: AISkillDefinition[];
  economics: BazaarEconomicState;
  governance: BazaarGovernanceState;
  gateway: BazaarGatewayState;
  onchain: {
    address: string;
    chainId: number;
    explorerUrl?: string;
    treasury?: string;
    treasuryBalanceWei?: string;
    treasuryBalanceOkb?: string;
    rules?: readonly unknown[];
    registeredAgentCount?: number;
    nextShopId?: number;
    nextServiceId?: number;
    nextProposalId?: number;
  } | null;
  liveDashboard: {
    manifest: SanitizedWalletManifest;
    runtime: LiveRuntimeStatus;
    funding: FundingStatus;
    onchainSnapshot: {
      collectedAt?: string;
      gatewayGas?: { data?: Array<{ normal?: string; min?: string; max?: string }> };
      walletStatus?: { data?: { loggedIn?: boolean } };
      execution?: {
        requestedMode?: string;
        resolvedMode?: "viem" | "onchainos-gateway";
        note?: string;
      };
      error?: string;
    } | null;
    bazaarSnapshot: BazaarSnapshot | null;
  };
  sources: {
    artifacts: Record<string, string>;
    hasOnchain: boolean;
  };
};

export type DashboardResponse = {
  ok: true;
  status: LiveDashboardStatus;
};

export type GameActionResponse = {
  ok: true;
  actionId: QuestActionId;
  txState: Exclude<TxState, "idle">;
  recovered: boolean;
  stepKey?: string;
  txHash?: Hex;
  errorMessage?: string;
  status: LiveDashboardStatus;
};

export type ProofArtifact = {
  id: string;
  kind: "receipt" | "journal" | "unlock" | "decree";
  title: string;
  body: string;
  statement: string;
  label: string;
  districtId: DistrictId;
  actionId?: QuestActionId;
  stepKey?: string;
  txHash?: Hex;
  explorerUrl?: string;
  createdAt: string;
};

export type PendingAction = {
  actionId: QuestActionId;
  label: string;
  status: TxState;
  startedAt: number;
  errorMessage?: string;
  txHash?: Hex;
  stepKey?: string;
};

export type WalletIdentity = {
  connected: boolean;
  validNetwork: boolean;
  address?: `0x${string}`;
  chainId?: number;
};

export type WorldReactionState = {
  shopOpen: boolean;
  supplierReady: boolean;
  workerReady: boolean;
  treasuryUnlocked: boolean;
  councilUnlocked: boolean;
  governancePassed: boolean;
  worldTier: WorldTier;
  tvlOkb: number;
  dailyVolumeOkb: number;
  gdpScore: number;
  activeProposalCount: number;
  blockHeight: number;
  latestTxHash?: Hex;
  treasuryGlow: number;
  lanternGlow: number;
  taxRateBps: number;
  treasuryBalanceOkb: number;
  objectiveTargetId: string | null;
};

export type PersistedPlayerState = {
  currentMapId: MapId;
  lastSpawnId?: string;
  playerName?: string;
  revealedProofIds: string[];
  unlockedLocations: string[];
  activeQuestStepId?: string;
  unlockedSkillIds: string[];
  activeSkillId?: string | null;
  muted: boolean;
  lowEffects: boolean;
};

export type GameStoreState = {
  sceneId: SceneId;
  currentMapId: MapId;
  player: {
    x: number;
    y: number;
    direction: Direction;
    moving: boolean;
  };
  nearbyInteractionId: string | null;
  focusedInteractionId: string | null;
  focusedNpcId: string | null;
  selectedDistrictId: DistrictId | null;
  objectiveTargetId: string | null;
  questHighlightId: string | null;
  liveStatus: LiveDashboardStatus | null;
  proofs: ProofArtifact[];
  pendingAction: PendingAction | null;
  playerName: string;
  wallet: WalletIdentity;
  skillCatalog: AISkillDefinition[];
  unlockedSkillIds: string[];
  activeSkillId: string | null;
  settings: {
    muted: boolean;
    lowEffects: boolean;
  };
  world: WorldReactionState;
  hydrated: boolean;
};
