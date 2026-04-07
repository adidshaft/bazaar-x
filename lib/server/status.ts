import { readArtifact } from "./artifacts";
import type { AgentSnapshot, EconomySnapshot, GovernanceSnapshot } from "./agents";
import {
  AGENTS_ARTIFACT_PATH,
  DEPLOYMENT_ARTIFACT_PATH,
  ECONOMY_ARTIFACT_PATH,
  GOVERNANCE_ARTIFACT_PATH,
  RUNTIME_ARTIFACT_PATH,
  WALLETS_ARTIFACT_PATH,
} from "./config";
import { getLiveDashboardStatus } from "../onchain/flow";
import { installedWorldEconomySkills } from "../economy/skills";
import { readContractSnapshot } from "./onchain";
import { sanitizeManifestPayload } from "./public";

export async function getRuntimeStatus() {
  const [agents, economy, governance] = await Promise.all([
    readArtifact<AgentSnapshot>(AGENTS_ARTIFACT_PATH),
    readArtifact<EconomySnapshot>(ECONOMY_ARTIFACT_PATH),
    readArtifact<GovernanceSnapshot>(GOVERNANCE_ARTIFACT_PATH),
  ]);

  return {
    artifactAvailable: Boolean(agents || economy || governance),
    agentCount: agents?.agents?.length ?? 0,
    round: economy?.round ?? 0,
    treasury: economy?.treasury ?? 0,
  };
}

export async function getLiveStatus() {
  const [runtime, onchain, liveDashboard] = await Promise.all([
    getRuntimeStatus(),
    readContractSnapshot(),
    getLiveDashboardStatus(),
  ]);

  return {
    runtime,
    onchain,
    skills: installedWorldEconomySkills,
    liveDashboard: sanitizeManifestPayload(liveDashboard),
    sources: {
      artifacts: {
        agents: AGENTS_ARTIFACT_PATH,
        economy: ECONOMY_ARTIFACT_PATH,
        governance: GOVERNANCE_ARTIFACT_PATH,
        live: RUNTIME_ARTIFACT_PATH,
        wallets: WALLETS_ARTIFACT_PATH,
        deployment: DEPLOYMENT_ARTIFACT_PATH,
      },
      hasOnchain: Boolean(onchain),
    },
  };
}
