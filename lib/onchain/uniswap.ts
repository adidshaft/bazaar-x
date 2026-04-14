import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  encodeFunctionData,
  formatEther,
  getAddress,
  parseEther,
  parseEventLogs,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import UniswapV2FactoryArtifactJson from "@uniswap/v2-core/build/UniswapV2Factory.json";
import UniswapV2PairArtifactJson from "@uniswap/v2-core/build/UniswapV2Pair.json";
import TestTokenArtifactJson from "@uniswap/v2-periphery/build/ERC20.json";
import Weth9ArtifactJson from "@uniswap/v2-periphery/build/WETH9.json";
import type { PreparedGameActionStep } from "@/game/core/live-types";
import {
  UNISWAP_DEPLOYMENT_ARTIFACT_PATH,
  UNISWAP_INITIAL_LP_OKB,
  UNISWAP_INITIAL_LP_TOKEN,
  UNISWAP_SLIPPAGE_BPS,
  UNISWAP_SUPPLIER_SERVICE_PRICE_TOKEN,
  UNISWAP_SUPPLIER_SWAP_INPUT_OKB,
  UNISWAP_WRAPPED_NATIVE_ADDRESS,
} from "../server/config";
import { readArtifact, writeArtifactSnapshot } from "../server/artifacts";
import { createXLayerPublicClient, xLayerNetworkLabel } from "../xlayer";
import { executeContractDeployment, executeRawTransaction } from "./executor";
import { ensureWalletManifest } from "./runtime";
import type { UniswapDeploymentArtifact, WalletManifest } from "./types";

const TEST_TOKEN_SUPPLY = parseEther("100000");
const SUPPLIER_ROUTE_STEP_KEY = "supplier-route-swap";
const SUPPLIER_ROUTE_LABEL = "Swap OKB for supplier credit";
const SUPPLIER_SETTLEMENT_SYMBOL = "TT";
const WRAPPED_NATIVE_ARTIFACT_PATH = resolve(
  process.cwd(),
  "contracts/out/WrappedNative.sol/WrappedNative.json",
);

const UniswapV2FactoryArtifact = UniswapV2FactoryArtifactJson as {
  abi: Abi;
  bytecode: Hex;
};
const UniswapV2PairArtifact = UniswapV2PairArtifactJson as {
  abi: Abi;
};
const TestTokenArtifact = TestTokenArtifactJson as {
  abi: Abi;
  bytecode: Hex;
};
const Weth9Artifact = Weth9ArtifactJson as {
  abi: Abi;
};
type WrappedNativeArtifact = {
  abi: Abi;
  bytecode: {
    object: Hex;
  };
};

export const SUPPLIER_SWAP_INPUT_WEI = parseEther(UNISWAP_SUPPLIER_SWAP_INPUT_OKB);
export const SUPPLIER_SERVICE_PRICE_TOKEN_WEI = parseEther(
  UNISWAP_SUPPLIER_SERVICE_PRICE_TOKEN,
);
export const SUPPLIER_SETTLEMENT_TOKEN_SYMBOL = SUPPLIER_SETTLEMENT_SYMBOL;
export const SUPPLIER_ROUTE_RECORD_STEP_KEY = SUPPLIER_ROUTE_STEP_KEY;

type SupplierSwapQuote = {
  amountInWei: bigint;
  amountInOkb: string;
  amountOutWei: bigint;
  amountOutToken: string;
  amount0OutWei: bigint;
  amount1OutWei: bigint;
  minOutWei: bigint;
  minOutToken: string;
  servicePriceWei: bigint;
  servicePriceToken: string;
  slippageBps: number;
  pairAddress: Address;
  wethAddress: Address;
  settlementTokenAddress: Address;
  settlementTokenSymbol: string;
};

type SupplierSwapReceipt = {
  amountOutWei: bigint;
  amountOutToken: string;
  pairAddress: Address;
};

function now() {
  return new Date().toISOString();
}

function formatToken(value: bigint) {
  return formatEther(value);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForContractCode(input: {
  publicClient: ReturnType<typeof createXLayerPublicClient>;
  address: Address;
  label: string;
  attempts?: number;
  delayMs?: number;
}) {
  const attempts = input.attempts ?? 8;
  const delayMs = input.delayMs ?? 1_250;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = await input.publicClient.getCode({ address: input.address });
    if (code && code !== "0x") {
      return code;
    }

    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }

  throw new Error(`${input.label} ${input.address} deployed without code.`);
}

async function waitForFactoryPairAddress(input: {
  publicClient: ReturnType<typeof createXLayerPublicClient>;
  factoryAddress: Address;
  tokenA: Address;
  tokenB: Address;
  attempts?: number;
  delayMs?: number;
}) {
  const attempts = input.attempts ?? 8;
  const delayMs = input.delayMs ?? 1_250;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const pairAddress = (await input.publicClient.readContract({
      address: input.factoryAddress,
      abi: UniswapV2FactoryArtifact.abi,
      functionName: "getPair",
      args: [input.tokenA, input.tokenB],
    })) as Address;

    if (pairAddress && !/^0x0{40}$/i.test(pairAddress)) {
      return pairAddress;
    }

    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }

  return null;
}

async function waitForPairReserves(input: {
  publicClient: ReturnType<typeof createXLayerPublicClient>;
  pairAddress: Address;
  attempts?: number;
  delayMs?: number;
}) {
  const attempts = input.attempts ?? 8;
  const delayMs = input.delayMs ?? 1_250;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const reserves = (await input.publicClient.readContract({
      address: input.pairAddress,
      abi: UniswapV2PairArtifact.abi,
      functionName: "getReserves",
    })) as [bigint, bigint, number];

    if (reserves[0] > 0n && reserves[1] > 0n) {
      return reserves;
    }

    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }

  return null;
}

function ensureWrappedNativeArtifact() {
  if (!existsSync(WRAPPED_NATIVE_ARTIFACT_PATH)) {
    execFileSync("forge", ["build", "--root", "contracts"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
  }

  return JSON.parse(readFileSync(WRAPPED_NATIVE_ARTIFACT_PATH, "utf8")) as WrappedNativeArtifact;
}

async function resolveWrappedNativeDeployment(
  manifest: WalletManifest,
  publicClient: ReturnType<typeof createXLayerPublicClient>,
) {
  if (UNISWAP_WRAPPED_NATIVE_ADDRESS) {
    const configuredAddress = getAddress(UNISWAP_WRAPPED_NATIVE_ADDRESS);
    const configuredCode = await publicClient.getCode({ address: configuredAddress });

    if (configuredCode && configuredCode !== "0x") {
      return {
        address: configuredAddress,
        txHash: null,
      };
    }
  }

  const artifact = ensureWrappedNativeArtifact();
  const deploymentTx = await executeContractDeployment({
    manifest,
    privateKey: manifest.deployer.privateKey,
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [],
  });
  const wrappedNativeAddress = deploymentTx.receipt.contractAddress;

  if (!wrappedNativeAddress) {
    throw new Error("Failed to deploy the wrapped-native token for the Uniswap supplier route.");
  }

  if (deploymentTx.receipt.status !== "success") {
    throw new Error(
      `The wrapped-native deployment reverted on ${xLayerNetworkLabel(manifest.chainId)}.`,
    );
  }
  await waitForContractCode({
    publicClient,
    address: wrappedNativeAddress,
    label: "The wrapped-native contract",
  });

  return {
    address: wrappedNativeAddress,
    txHash: deploymentTx.txHash,
  };
}

function pairUsesSettlementTokenAsToken0(artifact: UniswapDeploymentArtifact) {
  return artifact.settlementTokenAddress.toLowerCase() < artifact.wethAddress.toLowerCase();
}

function resolveQuoteReserves(
  artifact: UniswapDeploymentArtifact,
  reserve0: bigint,
  reserve1: bigint,
) {
  if (pairUsesSettlementTokenAsToken0(artifact)) {
    return {
      reserveInWei: reserve1,
      reserveOutWei: reserve0,
      amount0OutWei: (amountOutWei: bigint) => amountOutWei,
      amount1OutWei: () => 0n,
    };
  }

  return {
    reserveInWei: reserve0,
    reserveOutWei: reserve1,
    amount0OutWei: () => 0n,
    amount1OutWei: (amountOutWei: bigint) => amountOutWei,
  };
}

function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint) {
  if (amountIn <= 0n) {
    throw new Error("The Uniswap supplier route requires a positive input amount.");
  }

  if (reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error("The Uniswap supplier pool does not have active liquidity yet.");
  }

  const amountInWithFee = amountIn * 997n;
  return (amountInWithFee * reserveOut) / (reserveIn * 1000n + amountInWithFee);
}

export function computeSupplierTaxOkbEquivalent(
  taxAmountWei: bigint,
  amountInWei: bigint = SUPPLIER_SWAP_INPUT_WEI,
  servicePriceWei: bigint = SUPPLIER_SERVICE_PRICE_TOKEN_WEI,
) {
  if (taxAmountWei <= 0n || servicePriceWei <= 0n) {
    return "0";
  }

  return formatEther((taxAmountWei * amountInWei) / servicePriceWei);
}

async function executeAbiWrite(input: {
  manifest: WalletManifest;
  privateKey: Hex;
  to: Address;
  abi: Abi;
  functionName: string;
  args: unknown[];
  value?: bigint;
}) {
  const data = encodeFunctionData({
    abi: input.abi,
    functionName: input.functionName,
    args: input.args,
  } as never);

  return executeRawTransaction({
    manifest: input.manifest,
    privateKey: input.privateKey,
    to: input.to,
    data,
    value: input.value,
  });
}

export async function loadUniswapDeploymentArtifact() {
  return readArtifact<UniswapDeploymentArtifact>(UNISWAP_DEPLOYMENT_ARTIFACT_PATH);
}

export async function ensureUniswapDeployment(manifestInput?: WalletManifest) {
  const existing = await loadUniswapDeploymentArtifact();
  if (existing) {
    return existing;
  }

  const manifest = manifestInput ?? (await ensureWalletManifest());
  const publicClient = createXLayerPublicClient(
    manifest.chainId,
    manifest.rpcUrl,
    manifest.explorerBaseUrl,
  );
  const wrappedNative = await resolveWrappedNativeDeployment(manifest, publicClient);
  const wethAddress = wrappedNative.address;

  const settlementTokenTx = await executeContractDeployment({
    manifest,
    privateKey: manifest.treasury.privateKey,
    abi: TestTokenArtifact.abi,
    bytecode: TestTokenArtifact.bytecode,
    args: [TEST_TOKEN_SUPPLY],
  });
  const settlementTokenAddress = settlementTokenTx.receipt.contractAddress;
  if (!settlementTokenAddress) {
    throw new Error("Failed to deploy the supplier settlement token.");
  }
  if (settlementTokenTx.receipt.status !== "success") {
    throw new Error(
      `The supplier settlement token deployment reverted on ${xLayerNetworkLabel(manifest.chainId)}.`,
    );
  }
  await waitForContractCode({
    publicClient,
    address: settlementTokenAddress,
    label: "The supplier settlement token",
  });

  const factoryTx = await executeContractDeployment({
    manifest,
    privateKey: manifest.deployer.privateKey,
    abi: UniswapV2FactoryArtifact.abi,
    bytecode: UniswapV2FactoryArtifact.bytecode,
    args: [manifest.deployer.address],
  });
  const factoryAddress = factoryTx.receipt.contractAddress;
  if (!factoryAddress) {
    throw new Error("Failed to deploy the Uniswap factory.");
  }
  if (factoryTx.receipt.status !== "success") {
    throw new Error(
      `The Uniswap factory deployment reverted on ${xLayerNetworkLabel(manifest.chainId)}.`,
    );
  }
  await waitForContractCode({
    publicClient,
    address: factoryAddress,
    label: "The Uniswap factory",
  });

  const createPairTx = await executeAbiWrite({
    manifest,
    privateKey: manifest.deployer.privateKey,
    to: factoryAddress,
    abi: UniswapV2FactoryArtifact.abi,
    functionName: "createPair",
    args: [settlementTokenAddress, wethAddress],
  });
  if (createPairTx.receipt.status !== "success") {
    throw new Error("The Uniswap factory rejected the supplier pair creation transaction.");
  }
  const pairCreatedEvents = parseEventLogs({
    abi: UniswapV2FactoryArtifact.abi,
    logs: createPairTx.receipt.logs as never,
    eventName: "PairCreated",
    strict: false,
  }) as Array<{
    args?: {
      pair?: Address;
    };
  }>;
  const emittedPairAddress = pairCreatedEvents[0]?.args?.pair;
  const factoryPairAddress = emittedPairAddress
    ? null
    : await waitForFactoryPairAddress({
        publicClient,
        factoryAddress,
        tokenA: settlementTokenAddress,
        tokenB: wethAddress,
      });
  const pairAddress = emittedPairAddress ?? factoryPairAddress;

  if (!pairAddress || /^0x0{40}$/i.test(pairAddress)) {
    throw new Error("The Uniswap pool pair was not created successfully.");
  }

  await waitForContractCode({
    publicClient,
    address: pairAddress,
    label: "The Uniswap pair",
  });

  const lpTokenWei = parseEther(UNISWAP_INITIAL_LP_TOKEN);
  const lpOkbWei = parseEther(UNISWAP_INITIAL_LP_OKB);

  const seedWrapTx = await executeAbiWrite({
    manifest,
    privateKey: manifest.treasury.privateKey,
    to: wethAddress,
    abi: Weth9Artifact.abi,
    functionName: "deposit",
    args: [],
    value: lpOkbWei,
  });
  if (seedWrapTx.receipt.status !== "success") {
    throw new Error("Treasury wrap transaction failed while seeding the Uniswap supplier pool.");
  }

  const seedTokenTransferTx = await executeAbiWrite({
    manifest,
    privateKey: manifest.treasury.privateKey,
    to: settlementTokenAddress,
    abi: TestTokenArtifact.abi,
    functionName: "transfer",
    args: [pairAddress, lpTokenWei],
  });
  if (seedTokenTransferTx.receipt.status !== "success") {
    throw new Error("Treasury token transfer failed while seeding the Uniswap supplier pool.");
  }

  const seedWethTransferTx = await executeAbiWrite({
    manifest,
    privateKey: manifest.treasury.privateKey,
    to: wethAddress,
    abi: Weth9Artifact.abi,
    functionName: "transfer",
    args: [pairAddress, lpOkbWei],
  });
  if (seedWethTransferTx.receipt.status !== "success") {
    throw new Error("Treasury wrapped OKB transfer failed while seeding the Uniswap supplier pool.");
  }

  const seedMintTx = await executeAbiWrite({
    manifest,
    privateKey: manifest.treasury.privateKey,
    to: pairAddress,
    abi: UniswapV2PairArtifact.abi,
    functionName: "mint",
    args: [manifest.treasury.address],
  });
  if (seedMintTx.receipt.status !== "success") {
    throw new Error("The Uniswap pair rejected the initial liquidity mint.");
  }

  const reserves = await waitForPairReserves({
    publicClient,
    pairAddress,
  });
  const [reserve0, reserve1] = reserves ?? [0n, 0n, 0];

  if (reserve0 <= 0n || reserve1 <= 0n) {
    throw new Error("The Uniswap supplier pool seeded without active reserves.");
  }

  const artifact: UniswapDeploymentArtifact = {
    chainId: manifest.chainId,
    rpcUrl: manifest.rpcUrl,
    explorerBaseUrl: manifest.explorerBaseUrl,
    factoryAddress,
    wethAddress,
    settlementTokenAddress,
    settlementTokenSymbol: SUPPLIER_SETTLEMENT_SYMBOL,
    settlementTokenDecimals: 18,
    pairAddress,
    liquidityProvider: manifest.treasury.address,
    seedLiquidityOkb: UNISWAP_INITIAL_LP_OKB,
    seedLiquidityToken: UNISWAP_INITIAL_LP_TOKEN,
    supplierSwapInputOkb: UNISWAP_SUPPLIER_SWAP_INPUT_OKB,
    supplierServicePriceToken: UNISWAP_SUPPLIER_SERVICE_PRICE_TOKEN,
    slippageBps: UNISWAP_SLIPPAGE_BPS,
    deploymentTxHashes: {
      weth: wrappedNative.txHash,
      settlementToken: settlementTokenTx.txHash,
      factory: factoryTx.txHash,
      pairCreate: createPairTx.txHash,
      seedWrap: seedWrapTx.txHash,
      seedTokenTransfer: seedTokenTransferTx.txHash,
      seedWethTransfer: seedWethTransferTx.txHash,
      seedMint: seedMintTx.txHash,
    },
    deployedAt: now(),
  };

  await writeArtifactSnapshot(UNISWAP_DEPLOYMENT_ARTIFACT_PATH, artifact);
  return artifact;
}

export async function quoteSupplierSettlement(manifestInput?: WalletManifest) {
  const manifest = manifestInput ?? (await ensureWalletManifest());
  const artifact = await ensureUniswapDeployment(manifest);
  const publicClient = createXLayerPublicClient(
    manifest.chainId,
    manifest.rpcUrl,
    manifest.explorerBaseUrl,
  );
  const [reserve0, reserve1] = (await publicClient.readContract({
    address: artifact.pairAddress,
    abi: UniswapV2PairArtifact.abi,
    functionName: "getReserves",
  })) as [bigint, bigint, number];
  const reserveView = resolveQuoteReserves(artifact, reserve0, reserve1);
  const amountOutWei = getAmountOut(
    SUPPLIER_SWAP_INPUT_WEI,
    reserveView.reserveInWei,
    reserveView.reserveOutWei,
  );
  const minOutWei =
    (amountOutWei * BigInt(Math.max(0, 10_000 - artifact.slippageBps))) / 10_000n;

  if (minOutWei < SUPPLIER_SERVICE_PRICE_TOKEN_WEI) {
    throw new Error(
      `The current Uniswap quote only guarantees ${formatToken(minOutWei)} ${artifact.settlementTokenSymbol}. ` +
        `Reset the pool or re-seed liquidity before running the supplier route again.`,
    );
  }

  return {
    amountInWei: SUPPLIER_SWAP_INPUT_WEI,
    amountInOkb: UNISWAP_SUPPLIER_SWAP_INPUT_OKB,
    amountOutWei,
    amountOutToken: formatToken(amountOutWei),
    amount0OutWei: reserveView.amount0OutWei(amountOutWei),
    amount1OutWei: reserveView.amount1OutWei(amountOutWei),
    minOutWei,
    minOutToken: formatToken(minOutWei),
    servicePriceWei: SUPPLIER_SERVICE_PRICE_TOKEN_WEI,
    servicePriceToken: UNISWAP_SUPPLIER_SERVICE_PRICE_TOKEN,
    slippageBps: artifact.slippageBps,
    pairAddress: artifact.pairAddress,
    wethAddress: artifact.wethAddress,
    settlementTokenAddress: artifact.settlementTokenAddress,
    settlementTokenSymbol: artifact.settlementTokenSymbol,
  } satisfies SupplierSwapQuote;
}

export function buildSupplierWrapPreparedStep(quote: SupplierSwapQuote): PreparedGameActionStep {
  return {
    label: "Wrap OKB into WOKB",
    to: quote.wethAddress,
    data: encodeFunctionData({
      abi: Weth9Artifact.abi,
      functionName: "deposit",
      args: [],
    }),
    value: quote.amountInWei.toString(),
  };
}

export function buildSupplierPairTransferPreparedStep(
  quote: SupplierSwapQuote,
): PreparedGameActionStep {
  return {
    label: "Send WOKB into the supplier pool",
    to: quote.wethAddress,
    data: encodeFunctionData({
      abi: Weth9Artifact.abi,
      functionName: "transfer",
      args: [quote.pairAddress, quote.amountInWei],
    }),
    value: "0",
  };
}

export function buildSupplierSwapPreparedStep(
  quote: SupplierSwapQuote,
  recipient: Address,
): PreparedGameActionStep {
  return {
    label: SUPPLIER_ROUTE_LABEL,
    to: quote.pairAddress,
    data: encodeFunctionData({
      abi: UniswapV2PairArtifact.abi,
      functionName: "swap",
      args: [quote.amount0OutWei, quote.amount1OutWei, recipient, "0x"],
    }),
    value: "0",
    recordStepKey: SUPPLIER_ROUTE_STEP_KEY,
  };
}

export async function buildSupplierApprovalPreparedStep(spender: Address) {
  const artifact = await ensureUniswapDeployment();
  return {
    label: "Approve supplier credit for settlement",
    to: artifact.settlementTokenAddress,
    data: encodeFunctionData({
      abi: TestTokenArtifact.abi,
      functionName: "approve",
      args: [spender, SUPPLIER_SERVICE_PRICE_TOKEN_WEI],
    }),
    value: "0",
  } satisfies PreparedGameActionStep;
}

export async function executeSupplierSettlementSwap(input: {
  manifest: WalletManifest;
  privateKey: Hex;
  recipient: Address;
}) {
  const artifact = await ensureUniswapDeployment(input.manifest);
  const quote = await quoteSupplierSettlement(input.manifest);

  const wrapTx = await executeAbiWrite({
    manifest: input.manifest,
    privateKey: input.privateKey,
    to: artifact.wethAddress,
    abi: Weth9Artifact.abi,
    functionName: "deposit",
    args: [],
    value: quote.amountInWei,
  });

  const transferTx = await executeAbiWrite({
    manifest: input.manifest,
    privateKey: input.privateKey,
    to: artifact.wethAddress,
    abi: Weth9Artifact.abi,
    functionName: "transfer",
    args: [artifact.pairAddress, quote.amountInWei],
  });

  const swapTx = await executeAbiWrite({
    manifest: input.manifest,
    privateKey: input.privateKey,
    to: artifact.pairAddress,
    abi: UniswapV2PairArtifact.abi,
    functionName: "swap",
    args: [quote.amount0OutWei, quote.amount1OutWei, input.recipient, "0x"],
  });

  const parsed = parseSupplierSwapReceipt(swapTx.receipt, input.recipient, artifact);

  return {
    ...swapTx,
    artifact,
    quote,
    parsed,
    wrapTxHash: wrapTx.txHash,
    transferTxHash: transferTx.txHash,
  };
}

export async function executeSupplierSettlementApproval(input: {
  manifest: WalletManifest;
  privateKey: Hex;
  spender: Address;
}) {
  const artifact = await ensureUniswapDeployment(input.manifest);
  return executeAbiWrite({
    manifest: input.manifest,
    privateKey: input.privateKey,
    to: artifact.settlementTokenAddress,
    abi: TestTokenArtifact.abi,
    functionName: "approve",
    args: [input.spender, SUPPLIER_SERVICE_PRICE_TOKEN_WEI],
  });
}

export function parseSupplierSwapReceipt(
  receipt: { logs: readonly unknown[] },
  recipient: Address,
  artifact: UniswapDeploymentArtifact,
): SupplierSwapReceipt {
  const transfers = parseEventLogs({
    abi: TestTokenArtifact.abi,
    logs: receipt.logs as never,
    eventName: "Transfer",
    strict: false,
  }) as Array<{
    address?: Address;
    args?: {
      from?: Address;
      to?: Address;
      value?: bigint;
    };
  }>;
  const outputTransfer = [...transfers].reverse().find(
    (entry) =>
      entry.address?.toLowerCase() === artifact.settlementTokenAddress.toLowerCase() &&
      entry.args?.to?.toLowerCase() === recipient.toLowerCase(),
  );
  const amountOutWei = outputTransfer?.args?.value ?? 0n;

  const swaps = parseEventLogs({
    abi: UniswapV2PairArtifact.abi,
    logs: receipt.logs as never,
    eventName: "Swap",
    strict: false,
  }) as Array<{ address?: Address }>;
  const pairAddress =
    swaps.find((entry) => entry.address?.toLowerCase() === artifact.pairAddress.toLowerCase())
      ?.address ?? artifact.pairAddress;

  if (amountOutWei <= 0n) {
    throw new Error("The Uniswap swap did not emit a supplier credit transfer to the recipient.");
  }

  return {
    amountOutWei,
    amountOutToken: formatToken(amountOutWei),
    pairAddress,
  };
}

export function buildSupplierSwapMeta(input: {
  artifact: UniswapDeploymentArtifact;
  quote: SupplierSwapQuote;
  parsed: SupplierSwapReceipt;
  wrapTxHash?: Hex;
  transferTxHash?: Hex;
}) {
  const meta: Record<string, string | number | boolean | null> = {
    proofKind: "swap",
    routeProtocol: "Uniswap V2",
    routeQuoteId: `${input.artifact.pairAddress}:${input.quote.amountInOkb}:${input.quote.minOutToken}`,
    tokenIn: "OKB",
    tokenOut: input.artifact.settlementTokenSymbol,
    tokenInAddress: input.artifact.wethAddress,
    tokenOutAddress: input.artifact.settlementTokenAddress,
    poolAddress: input.parsed.pairAddress,
    quoteAmountOkb: input.quote.amountInOkb,
    amountOutToken: input.parsed.amountOutToken,
    minOutToken: input.quote.minOutToken,
    slippageBps: input.quote.slippageBps,
    settlementState: "settled",
    okbEquivalent: input.quote.amountInOkb,
  };

  if (input.wrapTxHash) {
    meta.wrapTxHash = input.wrapTxHash;
  }

  if (input.transferTxHash) {
    meta.poolTransferTxHash = input.transferTxHash;
  }

  return meta;
}

export function buildSupplierSwapDetail(input: {
  quote: SupplierSwapQuote;
  parsed: SupplierSwapReceipt;
}) {
  return (
    `Swapped ${input.quote.amountInOkb} OKB for ${input.parsed.amountOutToken} ` +
    `${input.quote.settlementTokenSymbol} through the Uniswap pool before supplier settlement.`
  );
}
