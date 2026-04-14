import {
  encodeFunctionData,
  formatEther,
  parseEther,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import type {
  GameActionResponse,
  PreparedGameActionResponse,
  PreparedGameActionStep,
  QuestActionId,
} from "@/game/core/live-types";
import { getActionControlPolicy } from "@/lib/game/action-controls";
import { getLiveDashboardStatus, deployLiveBazaar } from "./flow";
import {
  getBazaarAbi,
  loadDeploymentArtifact,
  parseFirstEvent,
} from "./contract";
import { collectOnchainOsSnapshot } from "./onchain-os";
import {
  ensureWalletManifest,
  getFundingSnapshot,
  loadLiveRuntime,
  saveLiveRuntime,
} from "./runtime";
import type {
  DeploymentArtifact,
  LiveRuntimeArtifact,
  StepRecord,
} from "./types";
import { createXLayerPublicClient, explorerTxUrl } from "../xlayer";
import {
  computeSupplierTaxOkbEquivalent,
  SUPPLIER_ROUTE_RECORD_STEP_KEY,
  SUPPLIER_SERVICE_PRICE_TOKEN_WEI,
  SUPPLIER_SETTLEMENT_TOKEN_SYMBOL,
  buildSupplierApprovalPreparedStep,
  buildSupplierPairTransferPreparedStep,
  buildSupplierSwapPreparedStep,
  buildSupplierWrapPreparedStep,
  ensureUniswapDeployment,
  parseSupplierSwapReceipt,
  quoteSupplierSettlement,
} from "./uniswap";

const WORKER_SERVICE_PRICE = parseEther("0.02");
const SUPPLIER_SERVICE_PRICE = parseEther("0.03");

type ManualRecordInput = {
  stepKey: string;
  txHash: Hex;
};

const ACTION_FINAL_STEP_KEY: Record<QuestActionId, string> = {
  "initialize-town": "deploy",
  "deploy-bazaar": "deploy",
  "open-shop": "shop-create",
  "open-depot": "supplier-service",
  "open-guild": "worker-service",
  "hire-worker": "supplier-hires-worker",
  "hire-supplier": "shop-hires-supplier",
  "propose-rule-change": "proposal",
  "vote-rule-change": "vote-worker",
  "execute-rule-change": "execute",
  "replay-worker-payment": "post-governance-hire",
  "treasury-reinvest": "treasury-reinvests",
};

function now() {
  return new Date().toISOString();
}

function createRuntimeBase(existing?: LiveRuntimeArtifact | null): LiveRuntimeArtifact {
  return {
    status: existing?.status ?? "ready",
    lastUpdatedAt: now(),
    txHashes: existing?.txHashes ?? [],
    steps: existing?.steps ?? [],
    deployment: existing?.deployment,
    funding: existing?.funding,
    onchainOs: existing?.onchainOs,
    execution: existing?.execution,
    runId: existing?.runId ?? `run_${Date.now()}`,
    proposalId: existing?.proposalId,
    shopIds: existing?.shopIds,
    serviceIds: existing?.serviceIds,
    firstTaxWei: existing?.firstTaxWei,
    secondTaxWei: existing?.secondTaxWei,
    error: existing?.error,
  };
}

function latestSuccessfulStep(runtime: LiveRuntimeArtifact | null | undefined, key: string) {
  const matches = (runtime?.steps ?? []).filter(
    (step) => step.key === key && step.status === "success",
  );
  return matches.at(-1) ?? null;
}

function hasSuccessfulTx(runtime: LiveRuntimeArtifact | null | undefined, txHash: Hex) {
  return (runtime?.steps ?? []).some(
    (step) => step.status === "success" && step.txHash?.toLowerCase() === txHash.toLowerCase(),
  );
}

function readNumericMeta(step: StepRecord | null, key: string) {
  const value = step?.meta?.[key];
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

function makeRegistrationHandle(playerAddress: Address) {
  return `player-${playerAddress.slice(2, 8).toLowerCase()}`;
}

async function ensureRuntimeContext() {
  await deployLiveBazaar();
  const manifest = await ensureWalletManifest();
  const [deployment, runtime, funding, onchainOs] = await Promise.all([
    loadDeploymentArtifact(),
    loadLiveRuntime(),
    getFundingSnapshot(manifest),
    collectOnchainOsSnapshot(manifest.chainId),
  ]);

  if (!deployment) {
    throw new Error("No BazaarX deployment artifact is available.");
  }

  const nextRuntime = createRuntimeBase(runtime);
  nextRuntime.deployment = deployment;
  nextRuntime.funding = funding;
  nextRuntime.onchainOs = onchainOs;
  nextRuntime.status = "ready";
  nextRuntime.error = undefined;

  return {
    deployment,
    runtime: nextRuntime,
  };
}

async function isRegisteredPlayer(deployment: DeploymentArtifact, playerAddress: Address) {
  const publicClient = createXLayerPublicClient(
    deployment.chainId,
    deployment.rpcUrl,
    deployment.explorerBaseUrl,
  );
  const agent = await publicClient.readContract({
    address: deployment.contractAddress,
    abi: getBazaarAbi(),
    functionName: "getAgent",
    args: [playerAddress],
  });

  return Boolean(Array.isArray(agent) ? agent[0] : false);
}

async function assertShopOwner(
  deployment: DeploymentArtifact,
  shopId: number,
  playerAddress: Address,
) {
  const publicClient = createXLayerPublicClient(
    deployment.chainId,
    deployment.rpcUrl,
    deployment.explorerBaseUrl,
  );
  const shop = await publicClient.readContract({
    address: deployment.contractAddress,
    abi: getBazaarAbi(),
    functionName: "getShop",
    args: [BigInt(shopId)],
  });

  const owner = Array.isArray(shop) ? (shop[0] as Address) : undefined;
  return owner?.toLowerCase() === playerAddress.toLowerCase();
}

function buildContractStep(
  deployment: DeploymentArtifact,
  input: {
    label: string;
    functionName: string;
    args: unknown[];
    value?: bigint;
    recordStepKey?: string;
  },
): PreparedGameActionStep {
  return {
    label: input.label,
    to: deployment.contractAddress,
    data: encodeFunctionData({
      abi: getBazaarAbi(),
      functionName: input.functionName,
      args: input.args,
    }),
    value: (input.value ?? 0n).toString(),
    recordStepKey: input.recordStepKey,
  };
}

function recoveredManualResponse(
  actionId: QuestActionId,
  message: string,
  runtime: LiveRuntimeArtifact,
): Omit<PreparedGameActionResponse, "status"> {
  const finalStep = latestSuccessfulStep(runtime, ACTION_FINAL_STEP_KEY[actionId]);
  return {
    ok: true,
    actionId,
    controlMode: "manual",
    executionKind: "system",
    planState: "recovered",
    message,
    stepKey: finalStep?.key,
    txHash: finalStep?.txHash,
    steps: [],
  };
}

function manualUnsupportedResponse(
  actionId: QuestActionId,
  message: string,
): Omit<PreparedGameActionResponse, "status"> {
  return {
    ok: true,
    actionId,
    controlMode: "manual",
    executionKind: "system",
    planState: "agent_required",
    message,
    steps: [],
  };
}

function preparedManualResponse(
  actionId: QuestActionId,
  message: string,
  steps: PreparedGameActionStep[],
): Omit<PreparedGameActionResponse, "status"> {
  return {
    ok: true,
    actionId,
    controlMode: "manual",
    executionKind: "player-wallet",
    planState: "prepared",
    message,
    steps,
  };
}

function maybeRegistrationStep(
  deployment: DeploymentArtifact,
  playerAddress: Address,
  registered: boolean,
) {
  if (registered) {
    return [];
  }

  return [
    buildContractStep(deployment, {
      label: "Register your wallet",
      functionName: "registerAgent",
      args: [makeRegistrationHandle(playerAddress)],
    }),
  ];
}

export async function prepareManualGameAction(
  actionId: QuestActionId,
  playerAddress: Address,
): Promise<Omit<PreparedGameActionResponse, "status">> {
  const policy = getActionControlPolicy(actionId);
  const { deployment, runtime } = await ensureRuntimeContext();
  const finalStepKey = ACTION_FINAL_STEP_KEY[actionId];
  const finalStep = latestSuccessfulStep(runtime, finalStepKey);

  if (actionId === "initialize-town") {
    return recoveredManualResponse(actionId, policy.manualSummary, runtime);
  }

  if (finalStep) {
    return recoveredManualResponse(actionId, policy.manualSummary, runtime);
  }

  if (policy.manualSupport === "agent_required") {
    return manualUnsupportedResponse(actionId, policy.manualSummary);
  }

  if (actionId === "deploy-bazaar") {
    return recoveredManualResponse(actionId, policy.manualSummary, runtime);
  }

  const registered = await isRegisteredPlayer(deployment, playerAddress);
  const registrationSteps = maybeRegistrationStep(deployment, playerAddress, registered);

  if (actionId === "open-shop") {
    return preparedManualResponse(actionId, policy.manualSummary, [
      ...registrationSteps,
      buildContractStep(deployment, {
        label: "Create your market",
        functionName: "createShop",
        args: ["Bazaar X Market", "ipfs://bazaar-x/shop"],
        recordStepKey: "shop-create",
      }),
    ]);
  }

  if (actionId === "open-depot") {
    const uniswap = await ensureUniswapDeployment();
    const shopStep = latestSuccessfulStep(runtime, "supplier-shop");
    if (!shopStep) {
      return preparedManualResponse(actionId, policy.manualSummary, [
        ...registrationSteps,
        buildContractStep(deployment, {
          label: "Create your supplier depot",
          functionName: "createShop",
          args: ["Supply Coil Depot", "ipfs://bazaar-x/supplier-shop"],
          recordStepKey: "supplier-shop",
        }),
      ]);
    }

    const supplierShopId =
      runtime.shopIds?.supplier ?? readNumericMeta(shopStep, "shopId");
    if (!supplierShopId) {
      throw new Error("Supplier shop metadata is missing. Reset the run and try again.");
    }

    if (!(await assertShopOwner(deployment, supplierShopId, playerAddress))) {
      return manualUnsupportedResponse(
        actionId,
        "The current supplier depot belongs to an autonomous district wallet. Reset the run or switch to agent mode.",
      );
    }

    return preparedManualResponse(actionId, policy.manualSummary, [
      ...registrationSteps,
      buildContractStep(deployment, {
        label: "List your supplier service",
        functionName: "listService",
        args: [
          BigInt(supplierShopId),
          "Inventory and routing service",
          "ipfs://bazaar-x/service/supplier",
          SUPPLIER_SERVICE_PRICE_TOKEN_WEI,
          uniswap.settlementTokenAddress,
          "0x0000000000000000000000000000000000000000",
          false,
        ],
        recordStepKey: "supplier-service",
      }),
    ]);
  }

  if (actionId === "open-guild") {
    const shopStep = latestSuccessfulStep(runtime, "worker-shop");
    if (!shopStep) {
      return preparedManualResponse(actionId, policy.manualSummary, [
        ...registrationSteps,
        buildContractStep(deployment, {
          label: "Create your worker guild",
          functionName: "createShop",
          args: ["Node Pilot Labor", "ipfs://bazaar-x/worker-shop"],
          recordStepKey: "worker-shop",
        }),
      ]);
    }

    const workerShopId =
      runtime.shopIds?.worker ?? readNumericMeta(shopStep, "shopId");
    if (!workerShopId) {
      throw new Error("Worker guild metadata is missing. Reset the run and try again.");
    }

    if (!(await assertShopOwner(deployment, workerShopId, playerAddress))) {
      return manualUnsupportedResponse(
        actionId,
        "The current worker guild belongs to an autonomous district wallet. Reset the run or switch to agent mode.",
      );
    }

    return preparedManualResponse(actionId, policy.manualSummary, [
      ...registrationSteps,
      buildContractStep(deployment, {
        label: "List your worker service",
        functionName: "listService",
        args: [
          BigInt(workerShopId),
          "Autonomous fulfillment labor",
          "ipfs://bazaar-x/service/worker",
          WORKER_SERVICE_PRICE,
          "0x0000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000",
          false,
        ],
        recordStepKey: "worker-service",
      }),
    ]);
  }

  if (actionId === "hire-worker") {
    const workerServiceId =
      runtime.serviceIds?.worker ??
      readNumericMeta(latestSuccessfulStep(runtime, "worker-service"), "serviceId");
    if (!workerServiceId) {
      throw new Error("Open the worker guild first so the service can be hired manually.");
    }

    return preparedManualResponse(actionId, policy.manualSummary, [
      ...registrationSteps,
      buildContractStep(deployment, {
        label: "Hire the worker service",
        functionName: "hireService",
        args: [BigInt(workerServiceId), "0x"],
        value: WORKER_SERVICE_PRICE,
        recordStepKey: "supplier-hires-worker",
      }),
    ]);
  }

  if (actionId === "hire-supplier") {
    const supplierServiceId =
      runtime.serviceIds?.supplier ??
      readNumericMeta(latestSuccessfulStep(runtime, "supplier-service"), "serviceId");
    if (!supplierServiceId) {
      throw new Error("Open the supplier depot first so the service can be hired manually.");
    }

    const quote = await quoteSupplierSettlement();
    const approvalStep = await buildSupplierApprovalPreparedStep(deployment.contractAddress);

    return preparedManualResponse(actionId, policy.manualSummary, [
      ...registrationSteps,
      buildSupplierWrapPreparedStep(quote),
      buildSupplierPairTransferPreparedStep(quote),
      buildSupplierSwapPreparedStep(quote, playerAddress),
      approvalStep,
      buildContractStep(deployment, {
        label: "Hire the supplier service",
        functionName: "hireService",
        args: [BigInt(supplierServiceId), "0x"],
        recordStepKey: "shop-hires-supplier",
      }),
    ]);
  }

  if (actionId === "propose-rule-change") {
    return preparedManualResponse(actionId, policy.manualSummary, [
      ...registrationSteps,
      buildContractStep(deployment, {
        label: "Propose the covenant update",
        functionName: "proposeRuleChange",
        args: [
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
        recordStepKey: "proposal",
      }),
    ]);
  }

  if (actionId === "replay-worker-payment") {
    const workerServiceId =
      runtime.serviceIds?.worker ??
      readNumericMeta(latestSuccessfulStep(runtime, "worker-service"), "serviceId");
    if (!workerServiceId) {
      throw new Error("Open the worker guild first so the post-governance payment can replay.");
    }

    return preparedManualResponse(actionId, policy.manualSummary, [
      ...registrationSteps,
      buildContractStep(deployment, {
        label: "Replay the worker payment",
        functionName: "hireService",
        args: [BigInt(workerServiceId), "0x"],
        value: WORKER_SERVICE_PRICE,
        recordStepKey: "post-governance-hire",
      }),
    ]);
  }

  return manualUnsupportedResponse(
    actionId,
    "This action is not yet available through the wallet-led flow.",
  );
}

async function buildRecordedStep(
  runtime: LiveRuntimeArtifact,
  deployment: DeploymentArtifact,
  stepKey: string,
  txHash: Hex,
  playerAddress: Address,
  receipt: { logs: readonly unknown[] },
) {
  const recordedAt = now();
  const meta: Record<string, string | number | boolean | null> = {
    controlMode: "manual",
    executionKind: "player-wallet",
    playerAddress,
  };

  let label = stepKey;
  let detail = "Confirmed on X Layer.";

  if (stepKey === "shop-create" || stepKey === "supplier-shop" || stepKey === "worker-shop") {
    const event = parseFirstEvent(receipt, "ShopCreated");
    const shopId = Number(event?.args?.shopId ?? 0n);
    meta.shopId = shopId;
    label =
      stepKey === "shop-create"
        ? "Create shop"
        : stepKey === "supplier-shop"
          ? "Create supplier shop"
          : "Create worker shop";
    detail =
      stepKey === "shop-create"
        ? `Created primary shop #${shopId}.`
        : stepKey === "supplier-shop"
          ? `Created supplier shop #${shopId}.`
          : `Created worker shop #${shopId}.`;

    runtime.shopIds = {
      ...(runtime.shopIds ?? {}),
      ...(stepKey === "shop-create"
        ? { shop: shopId }
        : stepKey === "supplier-shop"
          ? { supplier: shopId }
          : { worker: shopId }),
    };
  } else if (stepKey === "supplier-service" || stepKey === "worker-service") {
    const event = parseFirstEvent(receipt, "ServiceListed");
    const serviceId = Number(event?.args?.serviceId ?? 0n);
    const paymentToken = ((event?.args?.paymentToken ?? zeroAddress) as Address).toLowerCase();
    meta.serviceId = serviceId;
    if (stepKey === "supplier-service" && paymentToken !== zeroAddress) {
      meta.priceLabel = `${formatEther(SUPPLIER_SERVICE_PRICE_TOKEN_WEI)} ${SUPPLIER_SETTLEMENT_TOKEN_SYMBOL}`;
      meta.paymentTokenSymbol = SUPPLIER_SETTLEMENT_TOKEN_SYMBOL;
      meta.paymentTokenAddress = event?.args?.paymentToken as Address;
    } else {
      meta.priceOkb =
        stepKey === "supplier-service"
          ? formatEther(SUPPLIER_SERVICE_PRICE)
          : formatEther(WORKER_SERVICE_PRICE);
    }
    label = stepKey === "supplier-service" ? "List supplier service" : "List worker service";
    detail =
      stepKey === "supplier-service"
        ? `Listed supplier service #${serviceId}.`
        : `Listed worker service #${serviceId}.`;

    runtime.serviceIds = {
      ...(runtime.serviceIds ?? {}),
      ...(stepKey === "supplier-service"
        ? { supplier: serviceId }
        : { worker: serviceId }),
    };
  } else if (
    stepKey === "supplier-hires-worker" ||
    stepKey === "shop-hires-supplier" ||
    stepKey === "post-governance-hire"
  ) {
    const event = parseFirstEvent(receipt, "ServiceHired");
    const taxAmount = (event?.args?.taxAmount ?? 0n) as bigint;
    const paymentToken = (event?.args?.paymentToken ?? zeroAddress) as Address;
    meta.jobId = Number(event?.args?.jobId ?? 0n);
    label =
      stepKey === "supplier-hires-worker"
        ? "Supplier hires worker"
        : stepKey === "shop-hires-supplier"
          ? "Shop hires supplier"
          : "Post-governance payment";

    if (stepKey === "shop-hires-supplier" && paymentToken.toLowerCase() !== zeroAddress) {
      meta.taxLabel = `Tax ${formatEther(taxAmount)} ${SUPPLIER_SETTLEMENT_TOKEN_SYMBOL}`;
      meta.taxTokenAmount = formatEther(taxAmount);
      meta.taxOkbEquivalent = computeSupplierTaxOkbEquivalent(taxAmount);
      meta.paymentTokenSymbol = SUPPLIER_SETTLEMENT_TOKEN_SYMBOL;
      meta.paymentTokenAddress = paymentToken;
      meta.grossAmountLabel = `${formatEther(SUPPLIER_SERVICE_PRICE_TOKEN_WEI)} ${SUPPLIER_SETTLEMENT_TOKEN_SYMBOL}`;
      detail =
        `Shop settled ${formatEther(SUPPLIER_SERVICE_PRICE_TOKEN_WEI)} ${SUPPLIER_SETTLEMENT_TOKEN_SYMBOL} ` +
        "to the supplier after the Uniswap route.";
    } else {
      meta.taxOkb = formatEther(taxAmount);
      detail =
        stepKey === "supplier-hires-worker"
          ? `Supplier paid ${formatEther(WORKER_SERVICE_PRICE)} OKB to hire the worker.`
          : stepKey === "shop-hires-supplier"
            ? `Shop paid ${formatEther(SUPPLIER_SERVICE_PRICE)} OKB to the supplier.`
            : "Repeated the worker payment after the governance update.";
    }

    if (stepKey === "supplier-hires-worker") {
      runtime.firstTaxWei = taxAmount.toString();
    }
    if (stepKey === "post-governance-hire") {
      runtime.secondTaxWei = taxAmount.toString();
    }
  } else if (stepKey === SUPPLIER_ROUTE_RECORD_STEP_KEY) {
    const uniswap = await ensureUniswapDeployment();
    const parsed = parseSupplierSwapReceipt(receipt, playerAddress, uniswap);
    meta.proofKind = "swap";
    meta.routeProtocol = "Uniswap V2";
    meta.tokenIn = "OKB";
    meta.tokenOut = SUPPLIER_SETTLEMENT_TOKEN_SYMBOL;
    meta.tokenInAddress = uniswap.wethAddress;
    meta.tokenOutAddress = uniswap.settlementTokenAddress;
    meta.poolAddress = parsed.pairAddress;
    meta.quoteAmountOkb = uniswap.supplierSwapInputOkb;
    meta.amountOutToken = parsed.amountOutToken;
    meta.minOutToken = uniswap.supplierServicePriceToken;
    meta.slippageBps = uniswap.slippageBps;
    meta.settlementState = "settled";
    meta.okbEquivalent = uniswap.supplierSwapInputOkb;
    label = "Swap OKB for supplier credit";
    detail =
      `Swapped ${uniswap.supplierSwapInputOkb} OKB for ${parsed.amountOutToken} ` +
      `${SUPPLIER_SETTLEMENT_TOKEN_SYMBOL} through the Uniswap pool before supplier settlement.`;
  } else if (stepKey === "proposal") {
    const event = parseFirstEvent(receipt, "ProposalCreated");
    const proposalId = Number(event?.args?.proposalId ?? 0n);
    meta.proposalId = proposalId;
    label = "Propose tax update";
    detail = `Created proposal #${proposalId} to raise tax from 5% to 8%.`;
    runtime.proposalId = proposalId;
  } else if (stepKey === "vote-shop" || stepKey === "vote-supplier" || stepKey === "vote-worker") {
    label =
      stepKey === "vote-shop"
        ? "Bazaar Forge votes"
        : stepKey === "vote-supplier"
          ? "Supply Coil votes"
          : "Node Pilot votes";
    detail = "Your wallet cast a governance vote on X Layer.";
    meta.proposalId = runtime.proposalId ?? null;
  } else if (stepKey === "execute") {
    label = "Execute governance update";
    detail = `Executed proposal #${runtime.proposalId ?? 0}. New tax is now 8%.`;
    meta.proposalId = runtime.proposalId ?? null;
    meta.nextTaxBps = 800;
  } else if (stepKey === "deploy") {
    label = "Deploy Bazaar X contract";
    detail = `Deployed Bazaar X to ${deployment.contractAddress}.`;
  }

  return {
    key: stepKey,
    label,
    status: "success" as const,
    startedAt: recordedAt,
    completedAt: recordedAt,
    txHash,
    explorerUrl: explorerTxUrl(txHash, deployment.explorerBaseUrl),
    detail,
    meta,
  };
}

export async function recordManualGameAction(
  actionId: QuestActionId,
  playerAddress: Address,
  records: ManualRecordInput[],
): Promise<Omit<GameActionResponse, "status">> {
  if (!records.length) {
    throw new Error("No confirmed manual transactions were supplied.");
  }

  const { deployment, runtime } = await ensureRuntimeContext();
  const publicClient = createXLayerPublicClient(
    deployment.chainId,
    deployment.rpcUrl,
    deployment.explorerBaseUrl,
  );

  let recovered = true;
  let latestStepKey: string | undefined;
  let latestTxHash: Hex | undefined;

  for (const record of records) {
    latestStepKey = record.stepKey;
    latestTxHash = record.txHash;

    if (hasSuccessfulTx(runtime, record.txHash)) {
      continue;
    }

    const receipt = await publicClient.getTransactionReceipt({
      hash: record.txHash,
    });

    if (receipt.status !== "success") {
      throw new Error(`Transaction ${record.txHash} did not succeed on X Layer.`);
    }

    if ((receipt.from as Address).toLowerCase() !== playerAddress.toLowerCase()) {
      throw new Error("The confirmed transaction was not signed by the connected wallet.");
    }

    if (record.stepKey === SUPPLIER_ROUTE_RECORD_STEP_KEY) {
      const uniswap = await ensureUniswapDeployment();
      if (!receipt.to || receipt.to.toLowerCase() !== uniswap.pairAddress.toLowerCase()) {
        throw new Error("The confirmed transaction did not target the active Uniswap pair.");
      }
    } else if (!receipt.to || receipt.to.toLowerCase() !== deployment.contractAddress.toLowerCase()) {
      throw new Error("The confirmed transaction did not target the active BazaarX contract.");
    }

    runtime.steps = runtime.steps.filter(
      (step) => !(step.key === record.stepKey && step.status === "failed"),
    );
    runtime.steps.push(
      await buildRecordedStep(runtime, deployment, record.stepKey, record.txHash, playerAddress, receipt),
    );

    if (!runtime.txHashes.includes(record.txHash)) {
      runtime.txHashes.push(record.txHash);
    }

    recovered = false;
  }

  runtime.status = "ready";
  runtime.error = undefined;
  runtime.lastUpdatedAt = now();
  await saveLiveRuntime(runtime);

  return {
    ok: true,
    actionId,
    txState: recovered ? "recovered" : "confirmed",
    controlMode: "manual",
    executionKind: "player-wallet",
    recovered,
    stepKey: latestStepKey,
    txHash: latestTxHash,
    message: recovered
      ? "This manual step was already recorded in the village runtime."
      : "Manual wallet action confirmed on X Layer.",
  };
}

export async function loadManualActionStatus() {
  return getLiveDashboardStatus();
}
