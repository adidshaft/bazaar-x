import { formatEther, parseEther, type Hex } from "viem";
import {
  NativePaymentToken,
  deployBazaarContract,
  getBazaarAbi,
  loadDeploymentArtifact,
  parseFirstEvent,
  readBazaarSnapshot,
} from "./contract";
import { executeContractWrite, executeNativeTransfer } from "./executor";
import { ensureAddressFunding } from "./faucet";
import { collectOnchainOsSnapshot } from "./onchain-os";
import {
  ensureWalletManifest,
  getFundingSnapshot,
  loadLiveRuntime,
  saveLiveRuntime,
} from "./runtime";
import type {
  AgentWallet,
  DeploymentArtifact,
  ExecutionResolution,
  LiveRuntimeArtifact,
  OnchainOsSnapshot,
  StepRecord,
  WalletManifest,
} from "./types";
import { explorerTxUrl, xLayerNetworkLabel } from "../xlayer";
import {
  computeSupplierTaxOkbEquivalent,
  SUPPLIER_ROUTE_RECORD_STEP_KEY,
  SUPPLIER_SERVICE_PRICE_TOKEN_WEI,
  SUPPLIER_SETTLEMENT_TOKEN_SYMBOL,
  buildSupplierSwapDetail,
  buildSupplierSwapMeta,
  ensureUniswapDeployment,
  executeSupplierSettlementApproval,
  executeSupplierSettlementSwap,
} from "./uniswap";

const WORKER_SERVICE_PRICE = parseEther("0.02");
const TREASURY_REINVEST_GRANT = parseEther("0.002");

type StepResult = {
  txHash?: Hex;
  detail?: string;
  meta?: Record<string, string | number | boolean | null>;
  executionMode?: "viem" | "onchainos-gateway";
  execution?: ExecutionResolution;
  gatewayOrderId?: string;
  simulated?: boolean;
  simulationGasUsed?: string;
};

function now() {
  return new Date().toISOString();
}

function withExecutionMeta(result: StepResult) {
  const meta = {
    ...(result.meta ?? {}),
  } as Record<string, string | number | boolean | null>;

  if (result.execution) {
    meta.requestedMode = result.execution.requestedMode;
    meta.resolvedMode = result.execution.resolvedMode;
    meta.requestedExecutor = result.execution.requestedExecutor;
    meta.actualExecutor = result.execution.actualExecutor;
    meta.supportsGatewayBroadcast = result.execution.supportsGatewayBroadcast;
    meta.supportsAgenticWallet = result.execution.supportsAgenticWallet;
    meta.walletLoggedIn = result.execution.walletLoggedIn;
    meta.walletReady = result.execution.walletReady;

    if (result.execution.chainAlias) {
      meta.chainAlias = result.execution.chainAlias;
    }

    if (result.execution.walletAccountId) {
      meta.walletAccountId = result.execution.walletAccountId;
    }

    if (result.execution.walletAccountName) {
      meta.walletAccountName = result.execution.walletAccountName;
    }

    if (result.execution.note) {
      meta.executionNote = result.execution.note;
    }

    if (result.execution.fallbackReason) {
      meta.fallbackReason = result.execution.fallbackReason;
    }
  }

  if (result.executionMode) {
    meta.executionMode = result.executionMode;
  }

  if (result.gatewayOrderId) {
    meta.gatewayOrderId = result.gatewayOrderId;
  }

  if (typeof result.simulated === "boolean") {
    meta.simulated = result.simulated;
  }

  if (result.simulationGasUsed) {
    meta.simulationGasUsed = result.simulationGasUsed;
  }

  return Object.keys(meta).length ? meta : undefined;
}

function buildExecutionSnapshot(snapshot?: OnchainOsSnapshot | null) {
  const resolved = snapshot?.execution;
  if (!resolved) {
    return undefined;
  }

  return {
    ...resolved,
    simulateBeforeBroadcast: resolved.resolvedMode === "onchainos-gateway",
    usesOnchainOsGateway: resolved.resolvedMode === "onchainos-gateway",
    usesAgenticWallet: resolved.actualExecutor === "agentic-wallet",
  };
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
    execution: existing?.execution,
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

function recordDeployStep(runtime: LiveRuntimeArtifact, deployment: DeploymentArtifact) {
  const alreadyRecorded = runtime.steps.some((step) => step.key === "deploy" && step.status === "success");
  if (alreadyRecorded) {
    return;
  }

  runtime.steps.push({
    key: "deploy",
    label: "Deploy Bazaar X contract",
    status: "success",
    startedAt: deployment.deployedAt,
    completedAt: deployment.deployedAt,
    txHash: deployment.deployTxHash,
    explorerUrl: explorerTxUrl(deployment.deployTxHash, deployment.explorerBaseUrl),
    detail: `Deployed Bazaar X to ${deployment.contractAddress}.`,
    meta: withExecutionMeta({
      executionMode: deployment.executionMode,
      gatewayOrderId: deployment.gatewayOrderId,
      simulated: false,
    }),
  });
  runtime.txHashes.push(deployment.deployTxHash);
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
    step.meta = withExecutionMeta(result);

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
  return executeNativeTransfer({
    manifest,
    privateKey,
    to,
    value,
  });
}

async function writeBazaarContract(
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
  privateKey: Hex,
  functionName: string,
  args: unknown[],
  value?: bigint,
) {
  return executeContractWrite({
    manifest,
    deployment,
    privateKey,
    abi: getBazaarAbi(),
    functionName,
    args,
    value,
  });
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
        const fundingTx = await sendNative(
          manifest,
          manifest.deployer.privateKey,
          agent.address,
          delta,
        );

        return {
          txHash: fundingTx.txHash,
          detail: `Transferred ${formatEther(delta)} OKB from deployer to ${agent.name}.`,
          executionMode: fundingTx.executionMode,
          execution: fundingTx.execution,
          gatewayOrderId: fundingTx.gatewayOrderId,
          simulated: fundingTx.simulated,
          simulationGasUsed: fundingTx.simulationGasUsed,
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
    collectOnchainOsSnapshot(manifest.chainId),
  ]);

  const runtime = createRuntimeBase(existingRuntime);
  runtime.funding = funding;
  runtime.onchainOs = onchainOs;
  runtime.execution = buildExecutionSnapshot(onchainOs);

  if (funding.readyForDeploy) {
    runtime.status = "ready";
  } else {
    runtime.status = "idle";
    runtime.error =
      `Fund deployer ${manifest.deployer.address} with at least ${funding.requiredDeployerBalanceOkb} OKB ` +
      `on ${xLayerNetworkLabel(manifest.chainId)}.`;
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
  const existingRuntime = await loadLiveRuntime();
  const existingDeployment = existingRuntime?.deployment ?? (await loadDeploymentArtifact());
  if (existingDeployment) {
    const runtime = createRuntimeBase(existingRuntime);
    runtime.deployment = existingDeployment;
    runtime.funding = await getFundingSnapshot(manifest);
    runtime.onchainOs = await collectOnchainOsSnapshot(manifest.chainId);
    runtime.execution = buildExecutionSnapshot(runtime.onchainOs);
    runtime.status = "ready";
    runtime.runId = runtime.runId ?? `run_${Date.now()}`;
    recordDeployStep(runtime, existingDeployment);
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
  const runtime = createRuntimeBase(existingRuntime);
  runtime.deployment = deployment;
  runtime.funding = funding;
  runtime.onchainOs = await collectOnchainOsSnapshot(manifest.chainId);
  runtime.execution = buildExecutionSnapshot(runtime.onchainOs);
  runtime.status = "ready";
  runtime.runId = runtime.runId ?? `run_${Date.now()}`;
  recordDeployStep(runtime, deployment);

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
  runtime.execution = buildExecutionSnapshot(runtime.onchainOs);
  await persist(runtime);

  const funding = await getFundingSnapshot(manifest);
  runtime.funding = funding;
  runtime.onchainOs = await collectOnchainOsSnapshot(manifest.chainId);
  runtime.execution = buildExecutionSnapshot(runtime.onchainOs);

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
        const registrationTx = await writeBazaarContract(
          manifest,
          deployment,
          agent.privateKey,
          "registerAgent",
          [agent.handle],
        );

        return {
          txHash: registrationTx.txHash,
          detail: `Registered ${agent.handle} on Bazaar X.`,
          executionMode: registrationTx.executionMode,
          execution: registrationTx.execution,
          gatewayOrderId: registrationTx.gatewayOrderId,
          simulated: registrationTx.simulated,
          simulationGasUsed: registrationTx.simulationGasUsed,
        };
      },
    );
  }

  await runStep(runtime, deployment, "shop-create", "Create shop", async () => {
    const shopCreateTx = await writeBazaarContract(
      manifest,
      deployment,
      shop.privateKey,
      "createShop",
      ["Bazaar X Market", "ipfs://bazaar-x/shop"],
    );
    const event = parseFirstEvent(shopCreateTx.receipt, "ShopCreated");
    const shopId = Number(event?.args?.shopId ?? 0n);
    runtime.shopIds = {
      ...(runtime.shopIds ?? {}),
      shop: shopId,
    };

    return {
      txHash: shopCreateTx.txHash,
      detail: `Created primary shop #${shopId}.`,
      meta: { shopId },
      executionMode: shopCreateTx.executionMode,
      execution: shopCreateTx.execution,
      gatewayOrderId: shopCreateTx.gatewayOrderId,
      simulated: shopCreateTx.simulated,
      simulationGasUsed: shopCreateTx.simulationGasUsed,
    };
  });

  await runStep(runtime, deployment, "supplier-shop", "Create supplier shop", async () => {
    const supplierShopTx = await writeBazaarContract(
      manifest,
      deployment,
      supplier.privateKey,
      "createShop",
      ["Supply Coil Depot", "ipfs://bazaar-x/supplier-shop"],
    );
    const event = parseFirstEvent(supplierShopTx.receipt, "ShopCreated");
    const shopId = Number(event?.args?.shopId ?? 0n);
    runtime.shopIds = {
      ...(runtime.shopIds ?? {}),
      supplier: shopId,
    };
    return {
      txHash: supplierShopTx.txHash,
      detail: `Created supplier shop #${shopId}.`,
      meta: { shopId },
      executionMode: supplierShopTx.executionMode,
      execution: supplierShopTx.execution,
      gatewayOrderId: supplierShopTx.gatewayOrderId,
      simulated: supplierShopTx.simulated,
      simulationGasUsed: supplierShopTx.simulationGasUsed,
    };
  });

  await runStep(runtime, deployment, "worker-shop", "Create worker shop", async () => {
    const workerShopTx = await writeBazaarContract(
      manifest,
      deployment,
      worker.privateKey,
      "createShop",
      ["Node Pilot Labor", "ipfs://bazaar-x/worker-shop"],
    );
    const event = parseFirstEvent(workerShopTx.receipt, "ShopCreated");
    const shopId = Number(event?.args?.shopId ?? 0n);
    runtime.shopIds = {
      ...(runtime.shopIds ?? {}),
      worker: shopId,
    };
    return {
      txHash: workerShopTx.txHash,
      detail: `Created worker shop #${shopId}.`,
      meta: { shopId },
      executionMode: workerShopTx.executionMode,
      execution: workerShopTx.execution,
      gatewayOrderId: workerShopTx.gatewayOrderId,
      simulated: workerShopTx.simulated,
      simulationGasUsed: workerShopTx.simulationGasUsed,
    };
  });

  await runStep(runtime, deployment, "supplier-service", "List supplier service", async () => {
    const uniswap = await ensureUniswapDeployment(manifest);
    const supplierShopId = runtime.shopIds?.supplier;
    if (!supplierShopId) {
      throw new Error("Supplier shop not initialized.");
    }

    const supplierServiceTx = await writeBazaarContract(
      manifest,
      deployment,
      supplier.privateKey,
      "listService",
      [
        BigInt(supplierShopId),
        "Inventory and routing service",
        "ipfs://bazaar-x/service/supplier",
        SUPPLIER_SERVICE_PRICE_TOKEN_WEI,
        uniswap.settlementTokenAddress,
        NativePaymentToken,
        false,
      ],
    );

    const event = parseFirstEvent(supplierServiceTx.receipt, "ServiceListed");
    const serviceId = Number(event?.args?.serviceId ?? 0n);
    runtime.serviceIds = {
      ...(runtime.serviceIds ?? {}),
      supplier: serviceId,
    };

    return {
      txHash: supplierServiceTx.txHash,
      detail: `Listed supplier service #${serviceId}.`,
      meta: {
        serviceId,
        priceLabel: `${formatEther(SUPPLIER_SERVICE_PRICE_TOKEN_WEI)} ${SUPPLIER_SETTLEMENT_TOKEN_SYMBOL}`,
        paymentTokenSymbol: SUPPLIER_SETTLEMENT_TOKEN_SYMBOL,
        paymentTokenAddress: uniswap.settlementTokenAddress,
      },
      executionMode: supplierServiceTx.executionMode,
      execution: supplierServiceTx.execution,
      gatewayOrderId: supplierServiceTx.gatewayOrderId,
      simulated: supplierServiceTx.simulated,
      simulationGasUsed: supplierServiceTx.simulationGasUsed,
    };
  });

  await runStep(runtime, deployment, "worker-service", "List worker service", async () => {
    const workerShopId = runtime.shopIds?.worker;
    if (!workerShopId) {
      throw new Error("Worker shop not initialized.");
    }

    const workerServiceTx = await writeBazaarContract(
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

    const event = parseFirstEvent(workerServiceTx.receipt, "ServiceListed");
    const serviceId = Number(event?.args?.serviceId ?? 0n);
    runtime.serviceIds = {
      ...(runtime.serviceIds ?? {}),
      worker: serviceId,
    };

    return {
      txHash: workerServiceTx.txHash,
      detail: `Listed worker service #${serviceId}.`,
      meta: { serviceId, priceOkb: formatEther(WORKER_SERVICE_PRICE) },
      executionMode: workerServiceTx.executionMode,
      execution: workerServiceTx.execution,
      gatewayOrderId: workerServiceTx.gatewayOrderId,
      simulated: workerServiceTx.simulated,
      simulationGasUsed: workerServiceTx.simulationGasUsed,
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

      const supplierHireTx = await writeBazaarContract(
        manifest,
        deployment,
        supplier.privateKey,
        "hireService",
        [BigInt(workerServiceId), "0x"],
        WORKER_SERVICE_PRICE,
      );

      const event = parseFirstEvent(supplierHireTx.receipt, "ServiceHired");
      runtime.firstTaxWei = (event?.args?.taxAmount ?? 0n).toString();

      return {
        txHash: supplierHireTx.txHash,
        detail: `Supplier paid ${formatEther(WORKER_SERVICE_PRICE)} OKB to hire the worker.`,
        meta: {
          taxOkb: formatEther((event?.args?.taxAmount ?? 0n) as bigint),
          jobId: Number(event?.args?.jobId ?? 0n),
        },
        executionMode: supplierHireTx.executionMode,
        execution: supplierHireTx.execution,
        gatewayOrderId: supplierHireTx.gatewayOrderId,
        simulated: supplierHireTx.simulated,
        simulationGasUsed: supplierHireTx.simulationGasUsed,
      };
    },
  );

  await runStep(
    runtime,
    deployment,
    SUPPLIER_ROUTE_RECORD_STEP_KEY,
    "Swap OKB for supplier credit",
    async () => {
      const swap = await executeSupplierSettlementSwap({
        manifest,
        privateKey: shop.privateKey,
        recipient: shop.address,
      });

      return {
        txHash: swap.txHash,
        detail: buildSupplierSwapDetail({
          quote: swap.quote,
          parsed: swap.parsed,
        }),
        meta: buildSupplierSwapMeta({
          artifact: swap.artifact,
          quote: swap.quote,
          parsed: swap.parsed,
          wrapTxHash: swap.wrapTxHash,
          transferTxHash: swap.transferTxHash,
        }),
        executionMode: swap.executionMode,
        execution: swap.execution,
        gatewayOrderId: swap.gatewayOrderId,
        simulated: swap.simulated,
        simulationGasUsed: swap.simulationGasUsed,
      };
    },
  );

  await executeSupplierSettlementApproval({
    manifest,
    privateKey: shop.privateKey,
    spender: deployment.contractAddress,
  });

  await runStep(runtime, deployment, "shop-hires-supplier", "Shop hires supplier", async () => {
    const supplierServiceId = runtime.serviceIds?.supplier;
    if (!supplierServiceId) {
      throw new Error("Supplier service not initialized.");
    }

    const shopHireTx = await writeBazaarContract(
      manifest,
      deployment,
      shop.privateKey,
      "hireService",
      [BigInt(supplierServiceId), "0x"],
    );

    const event = parseFirstEvent(shopHireTx.receipt, "ServiceHired");
    const taxAmount = (event?.args?.taxAmount ?? 0n) as bigint;

    return {
      txHash: shopHireTx.txHash,
      detail:
        `Shop settled ${formatEther(SUPPLIER_SERVICE_PRICE_TOKEN_WEI)} ${SUPPLIER_SETTLEMENT_TOKEN_SYMBOL} ` +
        "to the supplier after the Uniswap route.",
      meta: {
        paymentTokenSymbol: SUPPLIER_SETTLEMENT_TOKEN_SYMBOL,
        paymentTokenAddress: event?.args?.paymentToken as string,
        grossAmountLabel: `${formatEther(SUPPLIER_SERVICE_PRICE_TOKEN_WEI)} ${SUPPLIER_SETTLEMENT_TOKEN_SYMBOL}`,
        taxLabel: `Tax ${formatEther(taxAmount)} ${SUPPLIER_SETTLEMENT_TOKEN_SYMBOL}`,
        taxTokenAmount: formatEther(taxAmount),
        taxOkbEquivalent: computeSupplierTaxOkbEquivalent(taxAmount),
        jobId: Number(event?.args?.jobId ?? 0n),
      },
      executionMode: shopHireTx.executionMode,
      execution: shopHireTx.execution,
      gatewayOrderId: shopHireTx.gatewayOrderId,
      simulated: shopHireTx.simulated,
      simulationGasUsed: shopHireTx.simulationGasUsed,
    };
  });

  await runStep(runtime, deployment, "proposal", "Propose tax update", async () => {
    const proposalTx = await writeBazaarContract(
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

    const event = parseFirstEvent(proposalTx.receipt, "ProposalCreated");
    const proposalId = Number(event?.args?.proposalId ?? 0n);
    runtime.proposalId = proposalId;

    return {
      txHash: proposalTx.txHash,
      detail: `Created proposal #${proposalId} to raise tax from 5% to 8%.`,
      meta: { proposalId },
      executionMode: proposalTx.executionMode,
      execution: proposalTx.execution,
      gatewayOrderId: proposalTx.gatewayOrderId,
      simulated: proposalTx.simulated,
      simulationGasUsed: proposalTx.simulationGasUsed,
    };
  });

  for (const agent of [shop, supplier, worker]) {
    await runStep(runtime, deployment, `vote-${agent.role}`, `${agent.name} votes`, async () => {
      if (!runtime.proposalId) {
        throw new Error("Proposal not initialized.");
      }

      const voteTx = await writeBazaarContract(
        manifest,
        deployment,
        agent.privateKey,
        "vote",
        [BigInt(runtime.proposalId), true],
      );

      return {
        txHash: voteTx.txHash,
        detail: `${agent.name} voted in favor of the covenant update.`,
        meta: { proposalId: runtime.proposalId },
        executionMode: voteTx.executionMode,
        execution: voteTx.execution,
        gatewayOrderId: voteTx.gatewayOrderId,
        simulated: voteTx.simulated,
        simulationGasUsed: voteTx.simulationGasUsed,
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

    const executeTx = await writeBazaarContract(
      manifest,
      deployment,
      governor.privateKey,
      "executeChange",
      [BigInt(runtime.proposalId)],
    );

    return {
      txHash: executeTx.txHash,
      detail: `Executed proposal #${runtime.proposalId}. New tax is now 8%.`,
      meta: { proposalId: runtime.proposalId, nextTaxBps: 800 },
      executionMode: executeTx.executionMode,
      execution: executeTx.execution,
      gatewayOrderId: executeTx.gatewayOrderId,
      simulated: executeTx.simulated,
      simulationGasUsed: executeTx.simulationGasUsed,
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

      const postGovernanceTx = await writeBazaarContract(
        manifest,
        deployment,
        supplier.privateKey,
        "hireService",
        [BigInt(workerServiceId), "0x"],
        WORKER_SERVICE_PRICE,
      );

      const event = parseFirstEvent(postGovernanceTx.receipt, "ServiceHired");
      runtime.secondTaxWei = (event?.args?.taxAmount ?? 0n).toString();

      return {
        txHash: postGovernanceTx.txHash,
        detail: `Repeated the worker payment after the governance update.`,
        meta: {
          taxOkb: formatEther((event?.args?.taxAmount ?? 0n) as bigint),
          jobId: Number(event?.args?.jobId ?? 0n),
        },
        executionMode: postGovernanceTx.executionMode,
        execution: postGovernanceTx.execution,
        gatewayOrderId: postGovernanceTx.gatewayOrderId,
        simulated: postGovernanceTx.simulated,
        simulationGasUsed: postGovernanceTx.simulationGasUsed,
      };
    },
  );

  await runStep(runtime, deployment, "treasury-reinvests", "Treasury reinvests", async () => {
    const treasuryTx = await sendNative(
      manifest,
      manifest.treasury.privateKey,
      shop.address,
      TREASURY_REINVEST_GRANT,
    );

    return {
      txHash: treasuryTx.txHash,
      detail: `Treasury reinvested ${formatEther(TREASURY_REINVEST_GRANT)} OKB back into the shop wallet.`,
      executionMode: treasuryTx.executionMode,
      execution: treasuryTx.execution,
      gatewayOrderId: treasuryTx.gatewayOrderId,
      simulated: treasuryTx.simulated,
      simulationGasUsed: treasuryTx.simulationGasUsed,
    };
  });

  runtime.funding = await getFundingSnapshot(manifest);
  runtime.onchainOs = await collectOnchainOsSnapshot(manifest.chainId);
  runtime.execution = buildExecutionSnapshot(runtime.onchainOs);
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
    collectOnchainOsSnapshot(manifest.chainId),
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
