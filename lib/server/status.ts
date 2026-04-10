import type { BazaarSnapshot } from "@/game/core/live-types";
import { readArtifact } from "./artifacts";
import type { AgentSnapshot, EconomySnapshot, GovernanceSnapshot } from "./agents";
import { aiSkillCatalog } from "@/lib/skills/ai-skills";
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
import { readLiveMonitorSnapshot } from "./live-monitor";
import { sanitizeManifestPayload } from "./public";
import { explorerTxUrl } from "../xlayer";

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
  const liveMonitor = await readLiveMonitorSnapshot(
    liveDashboard.bazaarSnapshot as BazaarSnapshot | null,
    liveDashboard.runtime,
  );
  const monitor = {
    ...liveMonitor.monitor,
    villageHealth: liveMonitor.monitor.villageHealth,
    hudOpacity: liveMonitor.monitor.hudOpacity,
    hudGlow: liveMonitor.monitor.hudGlow,
    pulseMs: liveMonitor.monitor.pulseMs,
  };
  const fallbackLatestTxHash =
    liveMonitor.gateway.latestTxHash ?? liveDashboard.runtime?.txHashes.at(-1);
  const gateway = fallbackLatestTxHash
    ? {
        ...liveMonitor.gateway,
        latestTxHash: fallbackLatestTxHash,
        latestExplorerUrl:
          liveMonitor.gateway.latestExplorerUrl ??
          explorerTxUrl(fallbackLatestTxHash, liveDashboard.manifest.explorerBaseUrl),
      }
    : liveMonitor.gateway;

  return {
    runtime,
    onchain,
    skills: installedWorldEconomySkills,
    aiSkills: aiSkillCatalog,
    economics: liveMonitor.economics,
    governance: liveMonitor.governance,
    gateway,
    monitor,
    hud: {
      opacity: monitor.hudOpacity,
      glow: monitor.hudGlow,
      pulseMs: monitor.pulseMs,
      label: monitor.healthLabel,
    },
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
