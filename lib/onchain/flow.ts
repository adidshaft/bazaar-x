import { formatEther, parseEther, type Hex } from "viem";
import {
  NativePaymentToken,
  deployBazaarContract,
  getBazaarAbi,
  loadDeploymentArtifact,
  parseFirstEvent,
  readBazaarSnapshot,
} from "./contract";
import { ensureAddressFunding } from "./faucet";
import { collectOnchainOsSnapshot } from "./onchainos";
import {
  ensureWalletManifest,
  getFundingSnapshot,
  loadLiveRuntime,
  saveLiveRuntime,
} from "./runtime";
import type { AgentWallet, DeploymentArtifact, LiveRuntimeArtifact, StepRecord, WalletManifest } from "./types";
import { createXLayerPublicClient, createXLayerWallet, explorerTxUrl } from "../xlayer";

const WORKER_SERVICE_PRICE = parseEther("0.02");
const SUPPLIER_SERVICE_PRICE = parseEther("0.03");
const TREASURY_REINVEST_GRANT = parseEther("0.002");

type StepResult = {
  txHash?: Hex;
  detail?: string;
  meta?: Record<string, string | number | boolean | null>;
};

function now() {
  return new Date().toISOString();
}

function createRuntimeBase(existing?: LiveRuntimeArtifact | null): LiveRuntimeArtifact {
  return {
    status: "ready",
    lastUpdatedAt: now(),
    txHashes: existing?.txHashes ?? [],
    steps: existing?.steps ?? [],
    deployment: existing?.deployment,
    funding: existing?.funding,
    onchainOs: existing?.onchainOs,
    runId: existing?.runId,
    proposalId: existing?.proposalId,
    shopIds: existing?.shopIds,
    serviceIds: existing?.serviceIds,
    firstTaxWei: existing?.firstTaxWei,
    secondTaxWei: existing?.secondTaxWei,
    error: existing?.error,
  };
}

async function persist(runtime: LiveRuntimeArtifact) {
  runtime.lastUpdatedAt = now();
  await saveLiveRuntime(runtime);
}

async function runStep(
  runtime: LiveRuntimeArtifact,
  deployment: DeploymentArtifact,
  key: string,
  label: string,
  runner: () => Promise<StepResult>,
) {
  const step: StepRecord = {
    key,
    label,
    status: "pending",
    startedAt: now(),
  };

  runtime.steps.push(step);
  await persist(runtime);

  try {
    const result = await runner();
    step.status = "success";
    step.completedAt = now();
    step.detail = result.detail;
    step.meta = result.meta;

    if (result.txHash) {
      step.txHash = result.txHash;
      step.explorerUrl = explorerTxUrl(result.txHash, deployment.explorerBaseUrl);
      runtime.txHashes.push(result.txHash);
    }

    await persist(runtime);
    return result;
  } catch (error) {
    step.status = "failed";
    step.completedAt = now();
    step.detail = error instanceof Error ? error.message : "Unknown step failure.";
    runtime.status = "failed";
    runtime.error = step.detail;
    await persist(runtime);
    throw error;
  }
}

async function sendNative(
  manifest: WalletManifest,
  privateKey: Hex,
  to: AgentWallet["address"],
  value: bigint,
) {
  const publicClient = createXLayerPublicClient(
    manifest.chainId,
    manifest.rpcUrl,
    manifest.explorerBaseUrl,
  );
  const { account, client } = createXLayerWallet(privateKey, manifest.chainId, manifest.rpcUrl);

  const txHash = await client.sendTransaction({
    account,
    to,
    value,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash, receipt };
}

async function writeBazaarContract(
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
  privateKey: Hex,
  functionName: string,
  args: unknown[],
  value?: bigint,
) {
  const publicClient = createXLayerPublicClient(
    manifest.chainId,
    manifest.rpcUrl,
    manifest.explorerBaseUrl,
  );
  const { account, client } = createXLayerWallet(privateKey, manifest.chainId, manifest.rpcUrl);

  const txHash = await client.writeContract({
    account,
    address: deployment.contractAddress,
    abi: getBazaarAbi(),
    functionName,
    args,
    value,
  } as never);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash, receipt };
}

function agentByRole(manifest: WalletManifest, role: AgentWallet["role"]) {
  const agent = manifest.agents.find((entry) => entry.role === role);
  if (!agent) {
    throw new Error(`Missing ${role} agent.`);
  }
  return agent;
}

async function ensureBootstrapTransfers(
  runtime: LiveRuntimeArtifact,
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
) {
  const funding = await getFundingSnapshot(manifest);

  for (const agent of manifest.agents) {
    const balance = funding.agents.find((entry) => entry.address === agent.address);
    if (!balance) {
      continue;
    }

    const target = parseEther(agent.bootstrapOkb);
    const current = BigInt(balance.balanceWei);
    if (current >= target) {
      continue;
    }

    try {
      await ensureAddressFunding(
        manifest,
        agent.address,
        target,
        `bazaar-x-${agent.role}-${agent.address.toLowerCase()}`,
      );
      continue;
    } catch {
      // Fall back to deployer-funded transfers when faucet claims are unavailable.
    }

    const delta = target - current;
    await runStep(
      runtime,
      deployment,
      `fund-${agent.role}`,
      `Fund ${agent.name}`,
      async () => {
        const { txHash } = await sendNative(
          manifest,
          manifest.deployer.privateKey,
          agent.address,
          delta,
        );

        return {
          txHash,
          detail: `Transferred ${formatEther(delta)} OKB from deployer to ${agent.name}.`,
        };
      },
    );
  }
}

export async function initializeBazaarLiveState() {
  const manifest = await ensureWalletManifest();
  const [funding, existingRuntime, onchainOs] = await Promise.all([
    getFundingSnapshot(manifest),
    loadLiveRuntime(),
    collectOnchainOsSnapshot(),
  ]);

  const runtime = createRuntimeBase(existingRuntime);
  runtime.funding = funding;
  runtime.onchainOs = onchainOs;

  if (funding.readyForDeploy) {
    runtime.status = "ready";
  } else {
    runtime.status = "idle";
    runtime.error = `Fund deployer ${manifest.deployer.address} with at least ${funding.requiredDeployerBalanceOkb} OKB on X Layer testnet.`;
  }

  await persist(runtime);

  return {
    manifest,
    funding,
    onchainOs,
    runtime,
  };
}

export async function deployLiveBazaar() {
  const manifest = await ensureWalletManifest();
  const existingDeployment = await loadDeploymentArtifact();
  if (existingDeployment) {
    const runtime = createRuntimeBase(await loadLiveRuntime());
    runtime.deployment = existingDeployment;
    runtime.funding = await getFundingSnapshot(manifest);
    runtime.onchainOs = await collectOnchainOsSnapshot();
    runtime.status = "ready";
    runtime.runId = runtime.runId ?? `run_${Date.now()}`;
    await persist(runtime);
    return existingDeployment;
  }

  const funding = await getFundingSnapshot(manifest);

  if (!funding.readyForDeploy) {
    throw new Error(
      `Deployer ${manifest.deployer.address} needs at least ${funding.requiredDeployerBalanceOkb} OKB before deployment.`,
    );
  }

  const deployment = await deployBazaarContract(manifest);
  const runtime = createRuntimeBase(await loadLiveRuntime());
  runtime.deployment = deployment;
  runtime.funding = funding;
  runtime.onchainOs = await collectOnchainOsSnapshot();
  runtime.status = "ready";
  runtime.runId = runtime.runId ?? `run_${Date.now()}`;

  const alreadyRecorded = runtime.steps.some((step) => step.key === "deploy");
  if (!alreadyRecorded) {
    runtime.steps.push({
      key: "deploy",
      label: "Deploy Bazaar X contract",
      status: "success",
      startedAt: deployment.deployedAt,
      completedAt: deployment.deployedAt,
      txHash: deployment.deployTxHash,
      explorerUrl: explorerTxUrl(deployment.deployTxHash, deployment.explorerBaseUrl),
      detail: `Deployed Bazaar X to ${deployment.contractAddress}.`,
    });
    runtime.txHashes.push(deployment.deployTxHash);
  }

  await persist(runtime);
  return deployment;
}

export async function runBazaarLiveFlow() {
  const manifest = await ensureWalletManifest();
  const existingRuntime = await loadLiveRuntime();
  const existingDeployment = await loadDeploymentArtifact();
  const runtime = createRuntimeBase(existingRuntime);
  runtime.status = "running";
  runtime.runId = runtime.runId ?? `run_${Date.now()}`;
  runtime.error = undefined;
  await persist(runtime);

  const funding = await getFundingSnapshot(manifest);
  runtime.funding = funding;
  runtime.onchainOs = await collectOnchainOsSnapshot();

  if (!funding.readyForDeploy && !existingDeployment) {
    runtime.status = "failed";
    runtime.error = `Deployer ${manifest.deployer.address} requires at least ${funding.requiredDeployerBalanceOkb} OKB.`;
    await persist(runtime);
    return runtime;
  }

  const deployment = existingDeployment ?? (await deployLiveBazaar());
  runtime.deployment = deployment;

  await ensureBootstrapTransfers(runtime, manifest, deployment);

  const shop = agentByRole(manifest, "shop");
  const supplier = agentByRole(manifest, "supplier");
  const worker = agentByRole(manifest, "worker");
  const governor = agentByRole(manifest, "governor");

  for (const agent of manifest.agents) {
    await runStep(
      runtime,
      deployment,
      `register-${agent.role}`,
      `Register ${agent.name}`,
      async () => {
        const { txHash } = await writeBazaarContract(
          manifest,
          deployment,
          agent.privateKey,
          "registerAgent",
          [agent.handle],
        );

        return {
          txHash,
          detail: `Registered ${agent.handle} on Bazaar X.`,
        };
      },
    );
  }

  await runStep(runtime, deployment, "shop-create", "Create shop", async () => {
    const { txHash, receipt } = await writeBazaarContract(
      manifest,
      deployment,
      shop.privateKey,
      "createShop",
      ["Bazaar X Market", "ipfs://bazaar-x/shop"],
    );
    const event = parseFirstEvent(receipt, "ShopCreated");
    const shopId = Number(event?.args?.shopId ?? 0n);
    runtime.shopIds = {
      ...(runtime.shopIds ?? {}),
      shop: shopId,
    };

    return {
      txHash,
      detail: `Created primary shop #${shopId}.`,
      meta: { shopId },
    };
  });

  await runStep(runtime, deployment, "supplier-shop", "Create supplier shop", async () => {
    const { txHash, receipt } = await writeBazaarContract(
      manifest,
      deployment,
      supplier.privateKey,
      "createShop",
      ["Supply Coil Depot", "ipfs://bazaar-x/supplier-shop"],
    );
    const event = parseFirstEvent(receipt, "ShopCreated");
    const shopId = Number(event?.args?.shopId ?? 0n);
    runtime.shopIds = {
      ...(runtime.shopIds ?? {}),
      supplier: shopId,
    };
    return {
      txHash,
      detail: `Created supplier shop #${shopId}.`,
      meta: { shopId },
    };
  });

  await runStep(runtime, deployment, "worker-shop", "Create worker shop", async () => {
    const { txHash, receipt } = await writeBazaarContract(
      manifest,
      deployment,
      worker.privateKey,
      "createShop",
      ["Node Pilot Labor", "ipfs://bazaar-x/worker-shop"],
    );
    const event = parseFirstEvent(receipt, "ShopCreated");
    const shopId = Number(event?.args?.shopId ?? 0n);
    runtime.shopIds = {
      ...(runtime.shopIds ?? {}),
      worker: shopId,
    };
    return {
      txHash,
      detail: `Created worker shop #${shopId}.`,
      meta: { shopId },
    };
  });

  await runStep(runtime, deployment, "supplier-service", "List supplier service", async () => {
    const supplierShopId = runtime.shopIds?.supplier;
    if (!supplierShopId) {
      throw new Error("Supplier shop not initialized.");
    }

    const { txHash, receipt } = await writeBazaarContract(
      manifest,
      deployment,
      supplier.privateKey,
      "listService",
      [
        BigInt(supplierShopId),
        "Inventory and routing service",
        "ipfs://bazaar-x/service/supplier",
        SUPPLIER_SERVICE_PRICE,
        NativePaymentToken,
        NativePaymentToken,
        false,
      ],
    );

    const event = parseFirstEvent(receipt, "ServiceListed");
    const serviceId = Number(event?.args?.serviceId ?? 0n);
    runtime.serviceIds = {
      ...(runtime.serviceIds ?? {}),
      supplier: serviceId,
    };

    return {
      txHash,
      detail: `Listed supplier service #${serviceId}.`,
      meta: { serviceId, priceOkb: formatEther(SUPPLIER_SERVICE_PRICE) },
    };
  });

  await runStep(runtime, deployment, "worker-service", "List worker service", async () => {
    const workerShopId = runtime.shopIds?.worker;
    if (!workerShopId) {
      throw new Error("Worker shop not initialized.");
    }

    const { txHash, receipt } = await writeBazaarContract(
      manifest,
      deployment,
      worker.privateKey,
      "listService",
      [
        BigInt(workerShopId),
        "Autonomous fulfillment labor",
        "ipfs://bazaar-x/service/worker",
        WORKER_SERVICE_PRICE,
        NativePaymentToken,
        NativePaymentToken,
        false,
      ],
    );

    const event = parseFirstEvent(receipt, "ServiceListed");
    const serviceId = Number(event?.args?.serviceId ?? 0n);
    runtime.serviceIds = {
      ...(runtime.serviceIds ?? {}),
      worker: serviceId,
    };

    return {
      txHash,
      detail: `Listed worker service #${serviceId}.`,
      meta: { serviceId, priceOkb: formatEther(WORKER_SERVICE_PRICE) },
    };
  });

  await runStep(
    runtime,
    deployment,
    "supplier-hires-worker",
    "Supplier hires worker",
    async () => {
      const workerServiceId = runtime.serviceIds?.worker;
      if (!workerServiceId) {
        throw new Error("Worker service not initialized.");
      }

      const { txHash, receipt } = await writeBazaarContract(
        manifest,
        deployment,
        supplier.privateKey,
        "hireService",
        [BigInt(workerServiceId), "0x"],
        WORKER_SERVICE_PRICE,
      );

      const event = parseFirstEvent(receipt, "ServiceHired");
      runtime.firstTaxWei = (event?.args?.taxAmount ?? 0n).toString();

      return {
        txHash,
        detail: `Supplier paid ${formatEther(WORKER_SERVICE_PRICE)} OKB to hire the worker.`,
        meta: {
          taxOkb: formatEther((event?.args?.taxAmount ?? 0n) as bigint),
          jobId: Number(event?.args?.jobId ?? 0n),
        },
      };
    },
  );

  await runStep(runtime, deployment, "shop-hires-supplier", "Shop hires supplier", async () => {
    const supplierServiceId = runtime.serviceIds?.supplier;
    if (!supplierServiceId) {
      throw new Error("Supplier service not initialized.");
    }

    const { txHash, receipt } = await writeBazaarContract(
      manifest,
      deployment,
      shop.privateKey,
      "hireService",
      [BigInt(supplierServiceId), "0x"],
      SUPPLIER_SERVICE_PRICE,
    );

    const event = parseFirstEvent(receipt, "ServiceHired");

    return {
      txHash,
      detail: `Shop paid ${formatEther(SUPPLIER_SERVICE_PRICE)} OKB to the supplier.`,
      meta: {
        taxOkb: formatEther((event?.args?.taxAmount ?? 0n) as bigint),
        jobId: Number(event?.args?.jobId ?? 0n),
      },
    };
  });

  await runStep(runtime, deployment, "proposal", "Propose tax update", async () => {
    const { txHash, receipt } = await writeBazaarContract(
      manifest,
      deployment,
      governor.privateKey,
      "proposeRuleChange",
      [
        {
          setTaxBps: true,
          taxBps: 800,
          setMinimumBalance: true,
          minimumBalance: parseEther("0.0015"),
          setQuorumBps: false,
          quorumBps: 0,
          setSupportBps: false,
          supportBps: 0,
          setVotingPeriod: false,
          votingPeriod: 0,
          setTreasury: false,
          treasury: "0x0000000000000000000000000000000000000000",
        },
        "Raise tax for treasury resilience after the first hiring loop",
      ],
    );

    const event = parseFirstEvent(receipt, "ProposalCreated");
    const proposalId = Number(event?.args?.proposalId ?? 0n);
    runtime.proposalId = proposalId;

    return {
      txHash,
      detail: `Created proposal #${proposalId} to raise tax from 5% to 8%.`,
      meta: { proposalId },
    };
  });

  for (const agent of [shop, supplier, worker]) {
    await runStep(runtime, deployment, `vote-${agent.role}`, `${agent.name} votes`, async () => {
      if (!runtime.proposalId) {
        throw new Error("Proposal not initialized.");
      }

      const { txHash } = await writeBazaarContract(
        manifest,
        deployment,
        agent.privateKey,
        "vote",
        [BigInt(runtime.proposalId), true],
      );

      return {
        txHash,
        detail: `${agent.name} voted in favor of the covenant update.`,
        meta: { proposalId: runtime.proposalId },
      };
    });
  }

  await runStep(runtime, deployment, "wait-voting", "Wait for voting period", async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, deployment.initialRules.votingPeriodSeconds * 1000 + 1500);
    });

    return {
      detail: `Waited ${deployment.initialRules.votingPeriodSeconds} seconds for proposal finalization.`,
    };
  });

  await runStep(runtime, deployment, "execute", "Execute governance update", async () => {
    if (!runtime.proposalId) {
      throw new Error("Proposal not initialized.");
    }

    const { txHash } = await writeBazaarContract(
      manifest,
      deployment,
      governor.privateKey,
      "executeChange",
      [BigInt(runtime.proposalId)],
    );

    return {
      txHash,
      detail: `Executed proposal #${runtime.proposalId}. New tax is now 8%.`,
      meta: { proposalId: runtime.proposalId, nextTaxBps: 800 },
    };
  });

  await runStep(
    runtime,
    deployment,
    "post-governance-hire",
    "Post-governance payment",
    async () => {
      const workerServiceId = runtime.serviceIds?.worker;
      if (!workerServiceId) {
        throw new Error("Worker service not initialized.");
      }

      const { txHash, receipt } = await writeBazaarContract(
        manifest,
        deployment,
        supplier.privateKey,
        "hireService",
        [BigInt(workerServiceId), "0x"],
        WORKER_SERVICE_PRICE,
      );

      const event = parseFirstEvent(receipt, "ServiceHired");
      runtime.secondTaxWei = (event?.args?.taxAmount ?? 0n).toString();

      return {
        txHash,
        detail: `Repeated the worker payment after the governance update.`,
        meta: {
          taxOkb: formatEther((event?.args?.taxAmount ?? 0n) as bigint),
          jobId: Number(event?.args?.jobId ?? 0n),
        },
      };
    },
  );

  await runStep(runtime, deployment, "treasury-reinvests", "Treasury reinvests", async () => {
    const { txHash } = await sendNative(
      manifest,
      manifest.treasury.privateKey,
      shop.address,
      TREASURY_REINVEST_GRANT,
    );

    return {
      txHash,
      detail: `Treasury reinvested ${formatEther(TREASURY_REINVEST_GRANT)} OKB back into the shop wallet.`,
    };
  });

  runtime.funding = await getFundingSnapshot(manifest);
  runtime.onchainOs = await collectOnchainOsSnapshot();
  runtime.status = "completed";
  runtime.error = undefined;
  runtime.deployment = deployment;
  runtime.lastUpdatedAt = now();
  await persist(runtime);

  return runtime;
}

export async function getLiveDashboardStatus() {
  const manifest = await ensureWalletManifest();
  const [runtime, funding, onchainSnapshot, bazaarSnapshot] = await Promise.all([
    loadLiveRuntime(),
    getFundingSnapshot(manifest),
    collectOnchainOsSnapshot(),
    readBazaarSnapshot(),
  ]);

  return {
    manifest,
    runtime: runtime ?? null,
    funding,
    onchainSnapshot,
    bazaarSnapshot,
  };
}
