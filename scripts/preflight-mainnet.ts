import {
  ARTIFACT_DIR,
  AUTONOMOUS_EXECUTOR_PREFERENCE,
  DEPLOYMENT_ARTIFACT_PATH,
  EXECUTION_MODE,
  RUNTIME_ARTIFACT_PATH,
  UNISWAP_DEPLOYMENT_ARTIFACT_PATH,
  X402_DEV_MOCK_MODE,
  X402_TOKEN_ARTIFACT_PATH,
} from "../lib/server/config";
import { toPrettyJson } from "../lib/server/json";
import { sanitizeWalletManifest } from "../lib/server/public";
import { readArtifact } from "../lib/server/artifacts";
import { loadDeploymentArtifact } from "../lib/onchain/contract";
import { collectOnchainOsSnapshot } from "../lib/onchain/onchain-os";
import { ensureWalletManifest, getFundingSnapshot, loadLiveRuntime } from "../lib/onchain/runtime";
import { loadUniswapDeploymentArtifact } from "../lib/onchain/uniswap";
import { isXLayerMainnetChain, xLayerNetworkLabel } from "../lib/xlayer";

function buildBlockers(input: {
  chainId: number;
  artifactDir: string;
  readyForDeploy: boolean;
  requiredDeployerBalanceOkb: string;
  deployerAddress: string;
  treasuryBalanceWei: string;
  execution?: {
    requestedExecutor: string;
    actualExecutor: string;
    requestedMode: string;
    resolvedMode: string;
    walletLoggedIn: boolean;
    walletReady: boolean;
  };
}) {
  const blockers: string[] = [];

  if (!isXLayerMainnetChain(input.chainId)) {
    blockers.push("Manifest is not pointed at X Layer mainnet (chain 196).");
  }

  if (input.artifactDir === ".bazaarx/runtime") {
    blockers.push(
      "BAZAAR_X_ARTIFACT_DIR still points at the canonical testnet artifact path. Use a separate mainnet directory before any live run.",
    );
  }

  if (!input.readyForDeploy) {
    blockers.push(
      `Deployer ${input.deployerAddress} does not currently meet the minimum balance target of ${input.requiredDeployerBalanceOkb} OKB.`,
    );
  }

  if (input.treasuryBalanceWei === "0") {
    blockers.push("Treasury wallet is empty, so treasury-funded bootstrap steps will fail on mainnet.");
  }

  if (input.execution?.requestedExecutor === "agentic-wallet" && input.execution.actualExecutor !== "agentic-wallet") {
    blockers.push(
      "Runtime metadata does not currently prove agentic-wallet execution. Do not claim Agentic Wallet until a live artifact records actualExecutor=agentic-wallet.",
    );
  }

  if (input.execution?.requestedMode === "onchainos-gateway" && input.execution.resolvedMode !== "onchainos-gateway") {
    blockers.push(
      "OnchainOS gateway mode was requested but is not currently active on this machine.",
    );
  }

  if (input.execution?.requestedExecutor === "agentic-wallet" && !input.execution.walletLoggedIn) {
    blockers.push("OnchainOS wallet login is not active for this run.");
  }

  if (input.execution?.requestedExecutor === "agentic-wallet" && !input.execution.walletReady) {
    blockers.push(
      "OnchainOS wallet readiness is not complete for agentic-wallet claims on the active chain.",
    );
  }

  if (X402_DEV_MOCK_MODE) {
    blockers.push("BAZAAR_X_X402_DEV_MOCK_MODE is enabled. Disable it before any real mainnet proof.");
  }

  return blockers;
}

async function main() {
  const manifest = await ensureWalletManifest();
  const [funding, onchainOs, deployment, runtime, uniswapDeployment, x402TokenArtifact] =
    await Promise.all([
      getFundingSnapshot(manifest),
      collectOnchainOsSnapshot(manifest.chainId).catch(() => null),
      loadDeploymentArtifact().catch(() => null),
      loadLiveRuntime().catch(() => null),
      loadUniswapDeploymentArtifact().catch(() => null),
      readArtifact<unknown>(X402_TOKEN_ARTIFACT_PATH).catch(() => null),
    ]);

  const execution = onchainOs?.execution;
  const blockers = buildBlockers({
    chainId: manifest.chainId,
    artifactDir: ARTIFACT_DIR,
    readyForDeploy: funding.readyForDeploy,
    requiredDeployerBalanceOkb: funding.requiredDeployerBalanceOkb,
    deployerAddress: manifest.deployer.address,
    treasuryBalanceWei: funding.treasury.balanceWei,
    execution,
  });

  const warnings: string[] = [];
  if (!deployment) {
    warnings.push(`No deployment artifact exists yet at ${DEPLOYMENT_ARTIFACT_PATH}.`);
  }
  if (!runtime) {
    warnings.push(`No runtime artifact exists yet at ${RUNTIME_ARTIFACT_PATH}.`);
  }
  if (!uniswapDeployment) {
    warnings.push(`No Uniswap deployment artifact exists yet at ${UNISWAP_DEPLOYMENT_ARTIFACT_PATH}.`);
  }
  if (!x402TokenArtifact) {
    warnings.push(`No x402 token artifact exists yet at ${X402_TOKEN_ARTIFACT_PATH}.`);
  }

  const manifestWalletMainnetReady =
    isXLayerMainnetChain(manifest.chainId) &&
    ARTIFACT_DIR !== ".bazaarx/runtime" &&
    funding.readyForDeploy &&
    funding.treasury.balanceWei !== "0" &&
    !X402_DEV_MOCK_MODE;

  console.log(
    toPrettyJson({
      preflight: {
        network: xLayerNetworkLabel(manifest.chainId),
        chainId: manifest.chainId,
        artifactDir: ARTIFACT_DIR,
        requestedMode: EXECUTION_MODE,
        executorPreference: AUTONOMOUS_EXECUTOR_PREFERENCE,
        manifestWalletMainnetReady,
        agenticWalletClaimReady: execution?.actualExecutor === "agentic-wallet",
        gatewayClaimReady: execution?.resolvedMode === "onchainos-gateway",
      },
      manifest: sanitizeWalletManifest(manifest),
      funding,
      onchainOs: onchainOs ?? null,
      artifacts: {
        deployment: deployment
          ? {
              path: DEPLOYMENT_ARTIFACT_PATH,
              contractAddress: deployment.contractAddress,
              deployTxHash: deployment.deployTxHash,
            }
          : null,
        runtime: runtime
          ? {
              path: RUNTIME_ARTIFACT_PATH,
              status: runtime.status,
              txHashCount: runtime.txHashes.length,
            }
          : null,
        uniswap: uniswapDeployment
          ? {
              path: UNISWAP_DEPLOYMENT_ARTIFACT_PATH,
              pairAddress: uniswapDeployment.pairAddress,
            }
          : null,
        x402: x402TokenArtifact
          ? {
              path: X402_TOKEN_ARTIFACT_PATH,
              available: true,
            }
          : null,
      },
      blockers,
      warnings,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
