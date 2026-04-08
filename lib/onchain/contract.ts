import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatEther,
  parseEventLogs,
  parseEther,
  zeroAddress,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { readArtifact, writeArtifactSnapshot } from "../server/artifacts";
import { DEPLOYMENT_ARTIFACT_PATH } from "../server/config";
import { createXLayerPublicClient, explorerTxUrl } from "../xlayer";
import { executeContractDeployment } from "./executor";
import type { DeploymentArtifact, InitialRules, WalletManifest } from "./types";

const BAZAAR_ARTIFACT_PATH = resolve(
  process.cwd(),
  "contracts/out/BazaarX.sol/BazaarX.json",
);

type BazaarArtifact = {
  abi: Abi;
  bytecode: {
    object: Hex;
  };
};

export function defaultInitialRules(): InitialRules {
  return {
    taxBps: 500,
    minimumBalanceWei: parseEther("0.002").toString(),
    quorumBps: 7500,
    supportBps: 6000,
    votingPeriodSeconds: 10,
  };
}

export function ensureBazaarArtifact() {
  if (!existsSync(BAZAAR_ARTIFACT_PATH)) {
    execFileSync("forge", ["build", "--root", "contracts"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
  }

  const parsed = JSON.parse(readFileSync(BAZAAR_ARTIFACT_PATH, "utf8")) as BazaarArtifact;
  return parsed;
}

export async function loadDeploymentArtifact() {
  return readArtifact<DeploymentArtifact>(DEPLOYMENT_ARTIFACT_PATH);
}

export async function saveDeploymentArtifact(artifact: DeploymentArtifact) {
  await writeArtifactSnapshot(DEPLOYMENT_ARTIFACT_PATH, artifact);
  return artifact;
}

export async function deployBazaarContract(manifest: WalletManifest, rules = defaultInitialRules()) {
  const existing = await loadDeploymentArtifact();
  if (existing) {
    return existing;
  }

  const artifact = ensureBazaarArtifact();
  const deploymentTx = await executeContractDeployment({
    manifest,
    privateKey: manifest.deployer.privateKey,
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [
      manifest.treasury.address,
      {
        taxBps: rules.taxBps,
        minimumBalance: BigInt(rules.minimumBalanceWei),
        quorumBps: rules.quorumBps,
        supportBps: rules.supportBps,
        votingPeriod: BigInt(rules.votingPeriodSeconds),
      },
    ],
  });

  if (!deploymentTx.receipt.contractAddress) {
    throw new Error("Contract deployment completed without a contract address.");
  }

  const deployment: DeploymentArtifact = {
    chainId: manifest.chainId,
    rpcUrl: manifest.rpcUrl,
    explorerBaseUrl: manifest.explorerBaseUrl,
    contractAddress: deploymentTx.receipt.contractAddress,
    deployTxHash: deploymentTx.txHash,
    executionMode: deploymentTx.executionMode,
    gatewayOrderId: deploymentTx.gatewayOrderId,
    treasury: manifest.treasury.address,
    deployedAt: new Date().toISOString(),
    initialRules: rules,
  };

  await saveDeploymentArtifact(deployment);
  return deployment;
}

export function getBazaarAbi() {
  return ensureBazaarArtifact().abi;
}

export async function readBazaarSnapshot(deployment?: DeploymentArtifact | null) {
  const resolvedDeployment = deployment ?? (await loadDeploymentArtifact());
  if (!resolvedDeployment) {
    return null;
  }

  const publicClient = createXLayerPublicClient(
    resolvedDeployment.chainId,
    resolvedDeployment.rpcUrl,
    resolvedDeployment.explorerBaseUrl,
  );
  const abi = getBazaarAbi();

  const [
    rules,
    registeredAgentCount,
    nextShopId,
    nextServiceId,
    nextProposalId,
    treasuryBalance,
  ] = await Promise.all([
    publicClient.readContract({
      address: resolvedDeployment.contractAddress,
      abi,
      functionName: "getRules",
    }),
    publicClient.readContract({
      address: resolvedDeployment.contractAddress,
      abi,
      functionName: "registeredAgentCount",
    }),
    publicClient.readContract({
      address: resolvedDeployment.contractAddress,
      abi,
      functionName: "nextShopId",
    }),
    publicClient.readContract({
      address: resolvedDeployment.contractAddress,
      abi,
      functionName: "nextServiceId",
    }),
    publicClient.readContract({
      address: resolvedDeployment.contractAddress,
      abi,
      functionName: "nextProposalId",
    }),
    publicClient.getBalance({ address: resolvedDeployment.treasury }),
  ]);

  return {
    address: resolvedDeployment.contractAddress,
    explorerUrl: explorerTxUrl(resolvedDeployment.deployTxHash, resolvedDeployment.explorerBaseUrl),
    chainId: resolvedDeployment.chainId,
    treasury: resolvedDeployment.treasury,
    treasuryBalanceWei: treasuryBalance.toString(),
    treasuryBalanceOkb: formatEther(treasuryBalance),
    rules,
    registeredAgentCount: Number(registeredAgentCount),
    nextShopId: Number(nextShopId),
    nextServiceId: Number(nextServiceId),
    nextProposalId: Number(nextProposalId),
  };
}

export function parseFirstEvent<TEventName extends string>(
  receipt: { logs: readonly unknown[] },
  eventName: TEventName,
) {
  const parsed = parseEventLogs({
    abi: getBazaarAbi(),
    logs: receipt.logs as never,
    eventName: eventName as never,
  });

  return (parsed[0] ?? null) as { args?: Record<string, unknown> } | null;
}

export const NativePaymentToken = zeroAddress as Address;
