import { formatEther, parseEther, type Hex } from "viem";
import {
  NativePaymentToken,
  deployBazaarContract,
  getBazaarAbi,
  loadDeploymentArtifact,
  parseFirstEvent,
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
  AgentRole,
  AgentWallet,
  DeploymentArtifact,
  ExecutionResolution,
  LiveRuntimeArtifact,
  StepRecord,
  WalletManifest,
} from "./types";
import { explorerTxUrl } from "../xlayer";
import {
  deployLiveBazaar,
  getLiveDashboardStatus,
  initializeBazaarLiveState,
} from "./flow";
import type {
  ActionExecutionDetail,
  QuestActionId,
} from "@/game/core/live-types";
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

type ActionExecution = {
  recovered: boolean;
  stepKey?: string;
  txHash?: Hex;
  execution?: ActionExecutionDetail;
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

function readMetaBoolean(step: StepRecord | null, key: string) {
  const value = step?.meta?.[key];
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
  }

  return undefined;
}

function readMetaString(step: StepRecord | null, key: string) {
  const value = step?.meta?.[key];
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function buildActionExecutionDetail(
  runtime: LiveRuntimeArtifact,
  stepKey?: string,
  recoveryKind: ActionExecutionDetail["recoveryKind"] = "none",
): ActionExecutionDetail | undefined {
  const currentStep = stepKey ? latestStep(runtime, stepKey) : null;
  const execution = runtime.onchainOs?.execution ?? runtime.execution;

  if (!execution && !currentStep?.meta) {
    return undefined;
  }

  return {
    requestedMode: readMetaString(currentStep, "requestedMode") ?? execution?.requestedMode,
    resolvedMode:
      (readMetaString(currentStep, "executionMode") as ActionExecutionDetail["resolvedMode"]) ??
      (readMetaString(currentStep, "resolvedMode") as ActionExecutionDetail["resolvedMode"]) ??
      execution?.resolvedMode,
    requestedExecutor:
      (readMetaString(currentStep, "requestedExecutor") as ActionExecutionDetail["requestedExecutor"]) ??
      execution?.requestedExecutor,
    actualExecutor:
      (readMetaString(currentStep, "actualExecutor") as ActionExecutionDetail["actualExecutor"]) ??
      execution?.actualExecutor,
    chainAlias: readMetaString(currentStep, "chainAlias") ?? execution?.chainAlias,
    supportsGatewayBroadcast:
      readMetaBoolean(currentStep, "supportsGatewayBroadcast") ??
      execution?.supportsGatewayBroadcast,
    supportsAgenticWallet:
      readMetaBoolean(currentStep, "supportsAgenticWallet") ??
      execution?.supportsAgenticWallet,
    walletLoggedIn: readMetaBoolean(currentStep, "walletLoggedIn") ?? execution?.walletLoggedIn,
    walletReady: readMetaBoolean(currentStep, "walletReady") ?? execution?.walletReady,
    walletAccountId: readMetaString(currentStep, "walletAccountId") ?? execution?.walletAccountId,
    walletAccountName:
      readMetaString(currentStep, "walletAccountName") ?? execution?.walletAccountName,
    note: readMetaString(currentStep, "executionNote") ?? execution?.note,
    fallbackReason: readMetaString(currentStep, "fallbackReason") ?? execution?.fallbackReason,
    gatewayOrderId: readMetaString(currentStep, "gatewayOrderId"),
    simulated: readMetaBoolean(currentStep, "simulated"),
    simulationGasUsed: readMetaString(currentStep, "simulationGasUsed"),
    recoveryKind,
  };
}

function buildRuntimeExecutionSnapshot(snapshot?: LiveRuntimeArtifact["onchainOs"]) {
  const execution = snapshot?.execution;
  if (!execution) {
    return undefined;
  }

  return {
    ...execution,
    simulateBeforeBroadcast: execution.resolvedMode === "onchainos-gateway",
    usesOnchainOsGateway: execution.resolvedMode === "onchainos-gateway",
    usesAgenticWallet: execution.actualExecutor === "agentic-wallet",
  };
}

function createRuntimeBase(existing?: LiveRuntimeArtifact | null): LiveRuntimeArtifact {
  return {
    status: existing?.status ?? "idle",
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

function latestStep(runtime: LiveRuntimeArtifact, key: string) {
  const matches = runtime.steps.filter((step) => step.key === key);
  return matches[matches.length - 1] ?? null;
}

function readStepNumber(step: StepRecord | null, metaKey: string) {
  const value = step?.meta?.[metaKey];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function recoverRuntimeReferences(runtime: LiveRuntimeArtifact) {
  const nextShopIds = { ...(runtime.shopIds ?? {}) };
  const nextServiceIds = { ...(runtime.serviceIds ?? {}) };
  let changed = false;

  const shopMappings = [
    ["shop", "shop-create"],
    ["supplier", "supplier-shop"],
    ["worker", "worker-shop"],
  ] as const;

  shopMappings.forEach(([role, stepKey]) => {
    if (typeof nextShopIds[role] === "number") {
      return;
    }

    const recoveredId = readStepNumber(latestStep(runtime, stepKey), "shopId");
    if (typeof recoveredId === "number") {
      nextShopIds[role] = recoveredId;
      changed = true;
    }
  });

  const serviceMappings = [
    ["supplier", "supplier-service"],
    ["worker", "worker-service"],
  ] as const;

  serviceMappings.forEach(([role, stepKey]) => {
    if (typeof nextServiceIds[role] === "number") {
      return;
    }

    const recoveredId = readStepNumber(latestStep(runtime, stepKey), "serviceId");
    if (typeof recoveredId === "number") {
      nextServiceIds[role] = recoveredId;
      changed = true;
    }
  });

  if (Object.keys(nextShopIds).length) {
    runtime.shopIds = nextShopIds;
  }

  if (Object.keys(nextServiceIds).length) {
    runtime.serviceIds = nextServiceIds;
  }

  if (runtime.proposalId == null) {
    const recoveredProposalId = readStepNumber(latestStep(runtime, "proposal"), "proposalId");
    if (typeof recoveredProposalId === "number") {
      runtime.proposalId = recoveredProposalId;
      changed = true;
    }
  }

  return changed;
}

async function runStep(
  runtime: LiveRuntimeArtifact,
  deployment: DeploymentArtifact,
  key: string,
  label: string,
  runner: () => Promise<StepResult>,
) {
  const existing = latestStep(runtime, key);
  if (existing?.status === "success") {
    return {
      recovered: true,
      step: existing,
    };
  }

  runtime.steps = runtime.steps.filter((step) => !(step.key === key && step.status === "failed"));

  const step: StepRecord = {
    key,
    label,
    status: "pending",
    startedAt: now(),
  };
  runtime.steps.push(step);
  runtime.status = "running";
  runtime.error = undefined;
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
    return {
      recovered: false,
      step,
    };
  } catch (error) {
    step.status = "failed";
    step.completedAt = now();
    step.detail = error instanceof Error ? error.message : "Unknown action failure.";
    runtime.status = "failed";
    runtime.error = step.detail;
    await persist(runtime);
    throw error;
  }
}

function agentByRole(manifest: WalletManifest, role: AgentRole) {
  const agent = manifest.agents.find((entry) => entry.role === role);
  if (!agent) {
    throw new Error(`Missing ${role} agent.`);
  }
  return agent;
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
    const current = parseEther(balance.balanceOkb);
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
      // Fall back to a deployer transfer when faucet top-ups are unavailable.
    }

    const delta = target - current;
    await runStep(runtime, deployment, `fund-${agent.role}`, `Fund ${agent.name}`, async () => {
      const tx = await sendNative(manifest, manifest.deployer.privateKey, agent.address, delta);
      return {
        txHash: tx.txHash,
        detail: `Transferred ${formatEther(delta)} OKB from deployer to ${agent.name}.`,
        executionMode: tx.executionMode,
        execution: tx.execution,
        gatewayOrderId: tx.gatewayOrderId,
        simulated: tx.simulated,
        simulationGasUsed: tx.simulationGasUsed,
      };
    });
  }
}

async function ensureActionContext() {
  const manifest = await ensureWalletManifest();
  const runtime = createRuntimeBase(await loadLiveRuntime());
  runtime.funding = await getFundingSnapshot(manifest);
  runtime.onchainOs = await collectOnchainOsSnapshot(manifest.chainId);
  runtime.execution = buildRuntimeExecutionSnapshot(runtime.onchainOs);
  runtime.error = undefined;
  recoverRuntimeReferences(runtime);
  await persist(runtime);

  return {
    manifest,
    runtime,
  };
}

async function ensureDeploymentContext(manifest: WalletManifest, runtime: LiveRuntimeArtifact) {
  const deployment = runtime.deployment ?? (await loadDeploymentArtifact()) ?? (await deployBazaarContract(manifest));
  runtime.deployment = deployment;
  await persist(runtime);
  return deployment;
}

async function ensureRegistrationSet(
  runtime: LiveRuntimeArtifact,
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
) {
  for (const agent of manifest.agents) {
    await runStep(
      runtime,
      deployment,
      `register-${agent.role}`,
      `Register ${agent.name}`,
      async () => {
        const tx = await writeBazaarContract(
          manifest,
          deployment,
          agent.privateKey,
          "registerAgent",
          [agent.handle],
        );

        return {
          txHash: tx.txHash,
          detail: `Registered ${agent.handle} on Bazaar X.`,
          executionMode: tx.executionMode,
          execution: tx.execution,
          gatewayOrderId: tx.gatewayOrderId,
          simulated: tx.simulated,
          simulationGasUsed: tx.simulationGasUsed,
        };
      },
    );
  }
}

async function executeOpenShop(
  runtime: LiveRuntimeArtifact,
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
) {
  const shop = agentByRole(manifest, "shop");

  const result = await runStep(runtime, deployment, "shop-create", "Create shop", async () => {
    const tx = await writeBazaarContract(
      manifest,
      deployment,
      shop.privateKey,
      "createShop",
      ["Bazaar X Market", "ipfs://bazaar-x/shop"],
    );
    const event = parseFirstEvent(tx.receipt, "ShopCreated");
    const shopId = Number(event?.args?.shopId ?? 0n);
    runtime.shopIds = {
      ...(runtime.shopIds ?? {}),
      shop: shopId,
    };

    return {
      txHash: tx.txHash,
      detail: `Created primary shop #${shopId}.`,
      meta: { shopId },
      executionMode: tx.executionMode,
      execution: tx.execution,
      gatewayOrderId: tx.gatewayOrderId,
      simulated: tx.simulated,
      simulationGasUsed: tx.simulationGasUsed,
    };
  });

  return {
    recovered: result.recovered,
    stepKey: "shop-create",
    txHash: result.step.txHash,
    execution: buildActionExecutionDetail(
      runtime,
      "shop-create",
      result.recovered ? "runtime-replay" : "none",
    ),
  } satisfies ActionExecution;
}

async function executeOpenDepot(
  runtime: LiveRuntimeArtifact,
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
) {
  const uniswap = await ensureUniswapDeployment(manifest);
  const supplier = agentByRole(manifest, "supplier");

  const shopResult = await runStep(
    runtime,
    deployment,
    "supplier-shop",
    "Create supplier shop",
    async () => {
      const tx = await writeBazaarContract(
        manifest,
        deployment,
        supplier.privateKey,
        "createShop",
        ["Supply Coil Depot", "ipfs://bazaar-x/supplier-shop"],
      );
      const event = parseFirstEvent(tx.receipt, "ShopCreated");
      const shopId = Number(event?.args?.shopId ?? 0n);
      runtime.shopIds = {
        ...(runtime.shopIds ?? {}),
        supplier: shopId,
      };

      return {
        txHash: tx.txHash,
        detail: `Created supplier shop #${shopId}.`,
        meta: { shopId },
        executionMode: tx.executionMode,
        execution: tx.execution,
        gatewayOrderId: tx.gatewayOrderId,
        simulated: tx.simulated,
        simulationGasUsed: tx.simulationGasUsed,
      };
    },
  );

  const serviceResult = await runStep(
    runtime,
    deployment,
    "supplier-service",
    "List supplier service",
    async () => {
      const supplierShopId = runtime.shopIds?.supplier;
      if (!supplierShopId) {
        throw new Error("Supplier shop not initialized.");
      }

      const tx = await writeBazaarContract(
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

      const event = parseFirstEvent(tx.receipt, "ServiceListed");
      const serviceId = Number(event?.args?.serviceId ?? 0n);
      runtime.serviceIds = {
        ...(runtime.serviceIds ?? {}),
        supplier: serviceId,
      };

      return {
        txHash: tx.txHash,
        detail: `Listed supplier service #${serviceId}.`,
        meta: {
          serviceId,
          priceLabel: `${formatEther(SUPPLIER_SERVICE_PRICE_TOKEN_WEI)} ${SUPPLIER_SETTLEMENT_TOKEN_SYMBOL}`,
          paymentTokenSymbol: SUPPLIER_SETTLEMENT_TOKEN_SYMBOL,
          paymentTokenAddress: uniswap.settlementTokenAddress,
        },
        executionMode: tx.executionMode,
        execution: tx.execution,
        gatewayOrderId: tx.gatewayOrderId,
        simulated: tx.simulated,
        simulationGasUsed: tx.simulationGasUsed,
      };
    },
  );

  return {
    recovered: shopResult.recovered && serviceResult.recovered,
    stepKey: "supplier-service",
    txHash: serviceResult.step.txHash ?? shopResult.step.txHash,
    execution: buildActionExecutionDetail(
      runtime,
      "supplier-service",
      shopResult.recovered && serviceResult.recovered ? "runtime-replay" : "none",
    ),
  } satisfies ActionExecution;
}

async function executeOpenGuild(
  runtime: LiveRuntimeArtifact,
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
) {
  const worker = agentByRole(manifest, "worker");

  const shopResult = await runStep(runtime, deployment, "worker-shop", "Create worker shop", async () => {
    const tx = await writeBazaarContract(
      manifest,
      deployment,
      worker.privateKey,
      "createShop",
      ["Node Pilot Labor", "ipfs://bazaar-x/worker-shop"],
    );
    const event = parseFirstEvent(tx.receipt, "ShopCreated");
    const shopId = Number(event?.args?.shopId ?? 0n);
    runtime.shopIds = {
      ...(runtime.shopIds ?? {}),
      worker: shopId,
    };

    return {
      txHash: tx.txHash,
      detail: `Created worker shop #${shopId}.`,
      meta: { shopId },
      executionMode: tx.executionMode,
      execution: tx.execution,
      gatewayOrderId: tx.gatewayOrderId,
      simulated: tx.simulated,
      simulationGasUsed: tx.simulationGasUsed,
    };
  });

  const serviceResult = await runStep(
    runtime,
    deployment,
    "worker-service",
    "List worker service",
    async () => {
      const workerShopId = runtime.shopIds?.worker;
      if (!workerShopId) {
        throw new Error("Worker shop not initialized.");
      }

      const tx = await writeBazaarContract(
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

      const event = parseFirstEvent(tx.receipt, "ServiceListed");
      const serviceId = Number(event?.args?.serviceId ?? 0n);
      runtime.serviceIds = {
        ...(runtime.serviceIds ?? {}),
        worker: serviceId,
      };

      return {
        txHash: tx.txHash,
        detail: `Listed worker service #${serviceId}.`,
        meta: { serviceId, priceOkb: formatEther(WORKER_SERVICE_PRICE) },
        executionMode: tx.executionMode,
        execution: tx.execution,
        gatewayOrderId: tx.gatewayOrderId,
        simulated: tx.simulated,
        simulationGasUsed: tx.simulationGasUsed,
      };
    },
  );

  return {
    recovered: shopResult.recovered && serviceResult.recovered,
    stepKey: "worker-service",
    txHash: serviceResult.step.txHash ?? shopResult.step.txHash,
    execution: buildActionExecutionDetail(
      runtime,
      "worker-service",
      shopResult.recovered && serviceResult.recovered ? "runtime-replay" : "none",
    ),
  } satisfies ActionExecution;
}

async function executeHireWorker(
  runtime: LiveRuntimeArtifact,
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
) {
  const supplier = agentByRole(manifest, "supplier");

  const result = await runStep(
    runtime,
    deployment,
    "supplier-hires-worker",
    "Supplier hires worker",
    async () => {
      const workerServiceId = runtime.serviceIds?.worker;
      if (!workerServiceId) {
        throw new Error("Worker service not initialized.");
      }

      const tx = await writeBazaarContract(
        manifest,
        deployment,
        supplier.privateKey,
        "hireService",
        [BigInt(workerServiceId), "0x"],
        WORKER_SERVICE_PRICE,
      );

      const event = parseFirstEvent(tx.receipt, "ServiceHired");
      runtime.firstTaxWei = (event?.args?.taxAmount ?? 0n).toString();

      return {
        txHash: tx.txHash,
        detail: `Supplier paid ${formatEther(WORKER_SERVICE_PRICE)} OKB to hire the worker.`,
        meta: {
          taxOkb: formatEther((event?.args?.taxAmount ?? 0n) as bigint),
          jobId: Number(event?.args?.jobId ?? 0n),
        },
        executionMode: tx.executionMode,
        execution: tx.execution,
        gatewayOrderId: tx.gatewayOrderId,
        simulated: tx.simulated,
        simulationGasUsed: tx.simulationGasUsed,
      };
    },
  );

  return {
    recovered: result.recovered,
    stepKey: "supplier-hires-worker",
    txHash: result.step.txHash,
    execution: buildActionExecutionDetail(
      runtime,
      "supplier-hires-worker",
      result.recovered ? "runtime-replay" : "none",
    ),
  } satisfies ActionExecution;
}

async function executeHireSupplier(
  runtime: LiveRuntimeArtifact,
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
) {
  const shop = agentByRole(manifest, "shop");
  const swapResult = await runStep(
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

  const result = await runStep(runtime, deployment, "shop-hires-supplier", "Shop hires supplier", async () => {
    const supplierServiceId = runtime.serviceIds?.supplier;
    if (!supplierServiceId) {
      throw new Error("Supplier service not initialized.");
    }

    const tx = await writeBazaarContract(
      manifest,
      deployment,
      shop.privateKey,
      "hireService",
      [BigInt(supplierServiceId), "0x"],
    );

    const event = parseFirstEvent(tx.receipt, "ServiceHired");
    const taxAmount = (event?.args?.taxAmount ?? 0n) as bigint;

    return {
      txHash: tx.txHash,
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
      executionMode: tx.executionMode,
      execution: tx.execution,
      gatewayOrderId: tx.gatewayOrderId,
      simulated: tx.simulated,
      simulationGasUsed: tx.simulationGasUsed,
    };
  });

  return {
    recovered: swapResult.recovered && result.recovered,
    stepKey: "shop-hires-supplier",
    txHash: result.step.txHash,
    execution: buildActionExecutionDetail(
      runtime,
      "shop-hires-supplier",
      swapResult.recovered && result.recovered ? "runtime-replay" : "none",
    ),
  } satisfies ActionExecution;
}

async function executeProposal(
  runtime: LiveRuntimeArtifact,
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
) {
  const governor = agentByRole(manifest, "governor");

  const result = await runStep(runtime, deployment, "proposal", "Propose tax update", async () => {
    const tx = await writeBazaarContract(
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

    const event = parseFirstEvent(tx.receipt, "ProposalCreated");
    runtime.proposalId = Number(event?.args?.proposalId ?? 0n);

    return {
      txHash: tx.txHash,
      detail: `Created proposal #${runtime.proposalId} to raise tax from 5% to 8%.`,
      meta: { proposalId: runtime.proposalId },
      executionMode: tx.executionMode,
      execution: tx.execution,
      gatewayOrderId: tx.gatewayOrderId,
      simulated: tx.simulated,
      simulationGasUsed: tx.simulationGasUsed,
    };
  });

  return {
    recovered: result.recovered,
    stepKey: "proposal",
    txHash: result.step.txHash,
    execution: buildActionExecutionDetail(
      runtime,
      "proposal",
      result.recovered ? "runtime-replay" : "none",
    ),
  } satisfies ActionExecution;
}

async function executeVotes(
  runtime: LiveRuntimeArtifact,
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
) {
  if (!runtime.proposalId) {
    throw new Error("Proposal not initialized.");
  }

  let allRecovered = true;
  let txHash: Hex | undefined;

  for (const agent of [agentByRole(manifest, "shop"), agentByRole(manifest, "supplier"), agentByRole(manifest, "worker")]) {
    const result = await runStep(runtime, deployment, `vote-${agent.role}`, `${agent.name} votes`, async () => {
      const tx = await writeBazaarContract(
        manifest,
        deployment,
        agent.privateKey,
        "vote",
        [BigInt(runtime.proposalId ?? 0), true],
      );

      return {
        txHash: tx.txHash,
        detail: `${agent.name} voted in favor of the covenant update.`,
        meta: { proposalId: runtime.proposalId ?? null },
        executionMode: tx.executionMode,
        execution: tx.execution,
        gatewayOrderId: tx.gatewayOrderId,
        simulated: tx.simulated,
        simulationGasUsed: tx.simulationGasUsed,
      };
    });

    allRecovered = allRecovered && result.recovered;
    txHash = result.step.txHash ?? txHash;
  }

  return {
    recovered: allRecovered,
    stepKey: "vote-worker",
    txHash,
    execution: buildActionExecutionDetail(
      runtime,
      "vote-worker",
      allRecovered ? "runtime-replay" : "none",
    ),
  } satisfies ActionExecution;
}

async function executeGovernance(
  runtime: LiveRuntimeArtifact,
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
) {
  const governor = agentByRole(manifest, "governor");

  await runStep(runtime, deployment, "wait-voting", "Wait for voting period", async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, deployment.initialRules.votingPeriodSeconds * 1000 + 1500);
    });

    return {
      detail: `Waited ${deployment.initialRules.votingPeriodSeconds} seconds for proposal finalization.`,
    };
  });

  const result = await runStep(runtime, deployment, "execute", "Execute governance update", async () => {
    if (!runtime.proposalId) {
      throw new Error("Proposal not initialized.");
    }

    const tx = await writeBazaarContract(
      manifest,
      deployment,
      governor.privateKey,
      "executeChange",
      [BigInt(runtime.proposalId)],
    );

    return {
      txHash: tx.txHash,
      detail: `Executed proposal #${runtime.proposalId}. New tax is now 8%.`,
      meta: { proposalId: runtime.proposalId, nextTaxBps: 800 },
      executionMode: tx.executionMode,
      execution: tx.execution,
      gatewayOrderId: tx.gatewayOrderId,
      simulated: tx.simulated,
      simulationGasUsed: tx.simulationGasUsed,
    };
  });

  return {
    recovered: result.recovered,
    stepKey: "execute",
    txHash: result.step.txHash,
    execution: buildActionExecutionDetail(
      runtime,
      "execute",
      result.recovered ? "runtime-replay" : "none",
    ),
  } satisfies ActionExecution;
}

async function executePostGovernanceHire(
  runtime: LiveRuntimeArtifact,
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
) {
  const supplier = agentByRole(manifest, "supplier");

  const result = await runStep(runtime, deployment, "post-governance-hire", "Post-governance payment", async () => {
    const workerServiceId = runtime.serviceIds?.worker;
    if (!workerServiceId) {
      throw new Error("Worker service not initialized.");
    }

    const tx = await writeBazaarContract(
      manifest,
      deployment,
      supplier.privateKey,
      "hireService",
      [BigInt(workerServiceId), "0x"],
      WORKER_SERVICE_PRICE,
    );

    const event = parseFirstEvent(tx.receipt, "ServiceHired");
    runtime.secondTaxWei = (event?.args?.taxAmount ?? 0n).toString();

    return {
      txHash: tx.txHash,
      detail: "Repeated the worker payment after the governance update.",
      meta: {
        taxOkb: formatEther((event?.args?.taxAmount ?? 0n) as bigint),
        jobId: Number(event?.args?.jobId ?? 0n),
      },
      executionMode: tx.executionMode,
      execution: tx.execution,
      gatewayOrderId: tx.gatewayOrderId,
      simulated: tx.simulated,
      simulationGasUsed: tx.simulationGasUsed,
    };
  });

  return {
    recovered: result.recovered,
    stepKey: "post-governance-hire",
    txHash: result.step.txHash,
    execution: buildActionExecutionDetail(
      runtime,
      "post-governance-hire",
      result.recovered ? "runtime-replay" : "none",
    ),
  } satisfies ActionExecution;
}

async function executeTreasuryReinvest(
  runtime: LiveRuntimeArtifact,
  manifest: WalletManifest,
  deployment: DeploymentArtifact,
) {
  const shop = agentByRole(manifest, "shop");

  const result = await runStep(runtime, deployment, "treasury-reinvests", "Treasury reinvests", async () => {
    const tx = await sendNative(
      manifest,
      manifest.treasury.privateKey,
      shop.address,
      TREASURY_REINVEST_GRANT,
    );

    return {
      txHash: tx.txHash,
      detail: `Treasury reinvested ${formatEther(TREASURY_REINVEST_GRANT)} OKB back into the shop wallet.`,
      executionMode: tx.executionMode,
      execution: tx.execution,
      gatewayOrderId: tx.gatewayOrderId,
      simulated: tx.simulated,
      simulationGasUsed: tx.simulationGasUsed,
    };
  });

  return {
    recovered: result.recovered,
    stepKey: "treasury-reinvests",
    txHash: result.step.txHash,
    execution: buildActionExecutionDetail(
      runtime,
      "treasury-reinvests",
      result.recovered ? "runtime-replay" : "none",
    ),
  } satisfies ActionExecution;
}

export async function runGameAction(actionId: QuestActionId) {
  if (actionId === "initialize-town") {
    const initialized = await initializeBazaarLiveState();
    const status = await getLiveDashboardStatus();
    return {
      actionId,
      txState: "recovered" as const,
      recovered: true,
      execution: buildActionExecutionDetail(initialized.runtime, undefined, "runtime-replay"),
      status,
    };
  }

  if (actionId === "deploy-bazaar") {
    const existingRuntime = await loadLiveRuntime();
    const existingDeployment = existingRuntime?.deployment ?? (await loadDeploymentArtifact());
    const deployment = await deployLiveBazaar();
    const runtime = createRuntimeBase(await loadLiveRuntime());
    const status = await getLiveDashboardStatus();
    return {
      actionId,
      txState: existingDeployment ? ("recovered" as const) : ("confirmed" as const),
      recovered: Boolean(existingDeployment),
      txHash: deployment.deployTxHash,
      stepKey: "deploy",
      execution: buildActionExecutionDetail(
        runtime,
        "deploy",
        existingDeployment ? "runtime-replay" : "none",
      ),
      status,
    };
  }

  const { manifest, runtime } = await ensureActionContext();
  const deployment = await ensureDeploymentContext(manifest, runtime);
  await ensureBootstrapTransfers(runtime, manifest, deployment);
  await ensureRegistrationSet(runtime, manifest, deployment);

  const execution =
    actionId === "open-shop"
      ? await executeOpenShop(runtime, manifest, deployment)
      : actionId === "open-depot"
        ? await executeOpenDepot(runtime, manifest, deployment)
        : actionId === "open-guild"
          ? await executeOpenGuild(runtime, manifest, deployment)
          : actionId === "hire-worker"
            ? await executeHireWorker(runtime, manifest, deployment)
            : actionId === "hire-supplier"
              ? await executeHireSupplier(runtime, manifest, deployment)
              : actionId === "propose-rule-change"
                ? await executeProposal(runtime, manifest, deployment)
                : actionId === "vote-rule-change"
                  ? await executeVotes(runtime, manifest, deployment)
                  : actionId === "execute-rule-change"
                    ? await executeGovernance(runtime, manifest, deployment)
                    : actionId === "replay-worker-payment"
                      ? await executePostGovernanceHire(runtime, manifest, deployment)
                      : await executeTreasuryReinvest(runtime, manifest, deployment);

  runtime.status = "ready";
  runtime.funding = await getFundingSnapshot(manifest);
  runtime.onchainOs = await collectOnchainOsSnapshot(manifest.chainId);
  runtime.execution = buildRuntimeExecutionSnapshot(runtime.onchainOs);
  runtime.error = undefined;
  await persist(runtime);
  const status = await getLiveDashboardStatus();

  return {
    actionId,
    txState: execution.recovered ? ("recovered" as const) : ("confirmed" as const),
    recovered: execution.recovered,
    stepKey: execution.stepKey,
    txHash: execution.txHash,
    execution: execution.execution,
    status,
  };
}
