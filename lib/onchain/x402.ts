import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatUnits,
  parseUnits,
  type Abi,
  type Address,
  type Hex,
  verifyTypedData,
} from "viem";
import type {
  ProofArtifact,
  QuestActionId,
  X402PaymentAuthorization,
  X402PaymentKind,
  X402PaymentPayload,
  X402PaymentReceipt,
  X402PaymentRequiredEnvelope,
  X402PaymentRequirements,
} from "@/game/core/live-types";
import {
  X402_DEV_MOCK_MODE,
  X402_LEDGER_ARTIFACT_PATH,
  X402_PAYMENT_TIMEOUT_SECONDS,
  X402_STIPEND_AMOUNT,
  X402_STIPEND_MIN_BALANCE,
  X402_TOKEN_ARTIFACT_PATH,
  X402_TOKEN_DECIMALS,
  X402_TOKEN_NAME,
  X402_TOKEN_SYMBOL,
} from "../server/config";
import { readArtifact, writeArtifactSnapshot } from "../server/artifacts";
import { ApiError } from "../server/http";
import { saveLiveRuntime, loadLiveRuntime, ensureWalletManifest } from "./runtime";
import { executeContractDeployment, executeContractWrite } from "./executor";
import { createXLayerPublicClient, explorerTxUrl } from "../xlayer";
import { loadDeploymentArtifact } from "./contract";

const X402_TOKEN_ARTIFACT = resolve(
  process.cwd(),
  "contracts/out/BazaarX402Token.sol/BazaarX402Token.json",
);

type X402TokenArtifact = {
  abi: Abi;
  bytecode: {
    object: Hex;
  };
};

type X402TokenDeploymentArtifact = {
  chainId: number;
  rpcUrl: string;
  explorerBaseUrl: string;
  contractAddress: Address;
  deployTxHash: Hex;
  name: string;
  symbol: string;
  decimals: number;
  owner: Address;
  payTo: Address;
  deployedAt: string;
};

type X402PaymentSessionStatus =
  | "payment-required"
  | "verified"
  | "settling"
  | "settled"
  | "fulfilled"
  | "failed";

type X402PaymentSessionRecord = {
  id: string;
  kind: X402PaymentKind;
  resourceId: string;
  createdAt: string;
  updatedAt: string;
  status: X402PaymentSessionStatus;
  requirements: X402PaymentRequirements;
  amountLabel: string;
  assetSymbol: string;
  invalidReason?: string;
  payer?: Address;
  paymentPayloadBase64?: string;
  paymentPayloadHash?: string;
  authorization?: X402PaymentAuthorization;
  receipt?: X402PaymentReceipt;
  fulfilledResponse?: unknown;
};

type X402LedgerArtifact = {
  sessions: Record<string, X402PaymentSessionRecord>;
  nonceIndex: Record<string, string>;
  stipendClaims: Record<string, { amountLabel: string; txHash: Hex; claimedAt: string }>;
  savedAt?: string;
};

type X402TypedAuthorization = {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
};

const transferWithAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function paymentSessionResourceKey(kind: X402PaymentKind, resourceId: string) {
  return `${kind}:${resourceId}`;
}

function paymentNonceIndexKey(input: X402PaymentAuthorization) {
  return `${input.from.toLowerCase()}:${input.nonce.toLowerCase()}`;
}

function actionStepKey(actionId: QuestActionId) {
  return `payment-${actionId}`;
}

function actionHumanLabel(actionId: QuestActionId) {
  return actionId.replace(/-/g, " ");
}

function payloadHash(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function parseBase64Json<T>(raw: string): T | null {
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function parseJsonHeader<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function encodeBase64Json(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function decodePaymentPayloadHeader(rawHeader: string | null) {
  if (!rawHeader) {
    return null;
  }

  return (
    parseBase64Json<X402PaymentPayload>(rawHeader) ??
    parseJsonHeader<X402PaymentPayload>(rawHeader)
  );
}

function stableRequirementEquals(
  left: X402PaymentRequirements["accepts"][number],
  right: X402PaymentRequirements["accepts"][number],
) {
  return (
    left.scheme === right.scheme &&
    left.network === right.network &&
    left.amount === right.amount &&
    left.asset.toLowerCase() === right.asset.toLowerCase() &&
    left.payTo.toLowerCase() === right.payTo.toLowerCase()
  );
}

function asAddress(value: string, message: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new ApiError(message, 400, "INVALID_ADDRESS");
  }
  return value as Address;
}

function coerceAuthorization(input: X402PaymentAuthorization): X402TypedAuthorization {
  return {
    from: asAddress(input.from, "Invalid payer address."),
    to: asAddress(input.to, "Invalid payee address."),
    value: BigInt(input.value),
    validAfter: BigInt(input.validAfter),
    validBefore: BigInt(input.validBefore),
    nonce: input.nonce,
  };
}

function splitSignature(signature: Hex) {
  const raw = signature.slice(2);
  if (raw.length !== 130) {
    throw new ApiError("Invalid x402 signature length.", 402, "INVALID_PAYMENT");
  }

  const r = `0x${raw.slice(0, 64)}` as Hex;
  const s = `0x${raw.slice(64, 128)}` as Hex;
  const v = Number.parseInt(raw.slice(128, 130), 16);

  return { v, r, s };
}

function createLedgerBase(existing?: X402LedgerArtifact | null): X402LedgerArtifact {
  return {
    sessions: existing?.sessions ?? {},
    nonceIndex: existing?.nonceIndex ?? {},
    stipendClaims: existing?.stipendClaims ?? {},
  };
}

async function loadLedger() {
  return createLedgerBase(await readArtifact<X402LedgerArtifact>(X402_LEDGER_ARTIFACT_PATH));
}

async function saveLedger(ledger: X402LedgerArtifact) {
  await writeArtifactSnapshot(X402_LEDGER_ARTIFACT_PATH, ledger);
  return ledger;
}

function ensureTokenArtifact() {
  if (!existsSync(X402_TOKEN_ARTIFACT)) {
    execFileSync("forge", ["build", "--root", "contracts"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
  }

  return JSON.parse(readFileSync(X402_TOKEN_ARTIFACT, "utf8")) as X402TokenArtifact;
}

function getX402TokenAbi() {
  return ensureTokenArtifact().abi;
}

function createTokenPublicClient(token: X402TokenDeploymentArtifact) {
  return createXLayerPublicClient(token.chainId, token.rpcUrl, token.explorerBaseUrl);
}

function isRetryableContractReadError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("returned no data") ||
    message.includes("could not decode result data") ||
    message.includes("execution reverted") ||
    message.includes("contractfunctionexecutionerror")
  );
}

async function waitForX402ContractReadiness(token: X402TokenDeploymentArtifact) {
  const publicClient = createTokenPublicClient(token);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = await publicClient.getCode({
      address: token.contractAddress,
    });

    if (code && code !== "0x") {
      return publicClient;
    }

    await sleep(1_000 * (attempt + 1));
  }

  throw new Error(
    `x402 token contract ${token.contractAddress} is not readable on the configured RPC yet.`,
  );
}

async function readX402ContractWithRetry<T>(input: {
  token: X402TokenDeploymentArtifact;
  functionName: string;
  args: readonly unknown[];
}) {
  const publicClient = await waitForX402ContractReadiness(input.token);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return (await publicClient.readContract({
        address: input.token.contractAddress,
        abi: getX402TokenAbi(),
        functionName: input.functionName,
        args: input.args,
      })) as T;
    } catch (error) {
      if (!isRetryableContractReadError(error) || attempt === 4) {
        throw error;
      }

      await sleep(500 * (attempt + 1));
    }
  }

  throw new Error(`Unable to read ${input.functionName} from the x402 token contract.`);
}

async function loadX402TokenDeployment() {
  return readArtifact<X402TokenDeploymentArtifact>(X402_TOKEN_ARTIFACT_PATH);
}

async function saveX402TokenDeployment(artifact: X402TokenDeploymentArtifact) {
  await writeArtifactSnapshot(X402_TOKEN_ARTIFACT_PATH, artifact);
  return artifact;
}

function tokenWriteTarget(deployment: X402TokenDeploymentArtifact) {
  return {
    chainId: deployment.chainId,
    rpcUrl: deployment.rpcUrl,
    explorerBaseUrl: deployment.explorerBaseUrl,
    contractAddress: deployment.contractAddress,
    deployTxHash: deployment.deployTxHash,
    treasury: deployment.payTo,
    deployedAt: deployment.deployedAt,
    initialRules: {
      taxBps: 0,
      minimumBalanceWei: "0",
      quorumBps: 0,
      supportBps: 0,
      votingPeriodSeconds: 0,
    },
  } as const;
}

export async function ensureX402TokenDeployment() {
  const existing = await loadX402TokenDeployment();
  if (existing) {
    await waitForX402ContractReadiness(existing);
    return existing;
  }

  const manifest = await ensureWalletManifest();
  const artifact = ensureTokenArtifact();
  const deploymentTx = await executeContractDeployment({
    manifest,
    privateKey: manifest.deployer.privateKey,
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [X402_TOKEN_NAME, X402_TOKEN_SYMBOL, X402_TOKEN_DECIMALS, manifest.deployer.address],
  });

  if (!deploymentTx.receipt.contractAddress) {
    throw new Error("x402 token deployment completed without a contract address.");
  }

  const deployment: X402TokenDeploymentArtifact = {
    chainId: manifest.chainId,
    rpcUrl: manifest.rpcUrl,
    explorerBaseUrl: manifest.explorerBaseUrl,
    contractAddress: deploymentTx.receipt.contractAddress,
    deployTxHash: deploymentTx.txHash,
    name: X402_TOKEN_NAME,
    symbol: X402_TOKEN_SYMBOL,
    decimals: X402_TOKEN_DECIMALS,
    owner: manifest.deployer.address,
    payTo: manifest.treasury.address,
    deployedAt: nowIso(),
  };

  await saveX402TokenDeployment(deployment);
  await waitForX402ContractReadiness(deployment);
  return deployment;
}

export async function readX402Balance(address: Address) {
  const token = await ensureX402TokenDeployment();
  const balance = await readX402ContractWithRetry<bigint>({
    token,
    functionName: "balanceOf",
    args: [address],
  });

  return {
    token,
    balance,
    balanceLabel: `${formatUnits(balance, token.decimals)} ${token.symbol}`,
  };
}

export async function claimX402Stipend(address: Address) {
  const manifest = await ensureWalletManifest();
  const token = await ensureX402TokenDeployment();
  const currentBalance = await readX402Balance(address);
  const minimumBalance = parseUnits(X402_STIPEND_MIN_BALANCE, token.decimals);

  if (currentBalance.balance >= minimumBalance) {
    throw new ApiError(
      "This citizen already has enough delegation credit for paid actions.",
      409,
      "STIPEND_NOT_NEEDED",
    );
  }

  const amount = parseUnits(X402_STIPEND_AMOUNT, token.decimals);
  const tx = await executeContractWrite({
    manifest,
    deployment: tokenWriteTarget(token),
    privateKey: manifest.deployer.privateKey,
    abi: getX402TokenAbi(),
    functionName: "mint",
    args: [address, amount],
  });

  const ledger = await loadLedger();
  ledger.stipendClaims[address.toLowerCase()] = {
    amountLabel: `${formatUnits(amount, token.decimals)} ${token.symbol}`,
    txHash: tx.txHash,
    claimedAt: nowIso(),
  };
  await saveLedger(ledger);

  return {
    token,
    amount,
    amountLabel: `${formatUnits(amount, token.decimals)} ${token.symbol}`,
    txHash: tx.txHash,
    explorerUrl: explorerTxUrl(tx.txHash, token.explorerBaseUrl),
  };
}

export async function getX402Status(address: Address) {
  const [balanceSnapshot, ledger] = await Promise.all([
    readX402Balance(address),
    loadLedger(),
  ]);
  const minimumBalance = parseUnits(X402_STIPEND_MIN_BALANCE, balanceSnapshot.token.decimals);
  const claim = ledger.stipendClaims[address.toLowerCase()] ?? null;

  return {
    network: `eip155:${balanceSnapshot.token.chainId}`,
    tokenAddress: balanceSnapshot.token.contractAddress,
    symbol: balanceSnapshot.token.symbol,
    decimals: balanceSnapshot.token.decimals,
    balance: balanceSnapshot.balance.toString(),
    balanceLabel: balanceSnapshot.balanceLabel,
    payTo: balanceSnapshot.token.payTo,
    canClaimStipend: balanceSnapshot.balance < minimumBalance,
    stipendAmountLabel: `${X402_STIPEND_AMOUNT} ${balanceSnapshot.token.symbol}`,
    lastClaim: claim
      ? {
          ...claim,
          explorerUrl: explorerTxUrl(claim.txHash, balanceSnapshot.token.explorerBaseUrl),
        }
      : null,
  };
}

export async function prepareX402PaymentSession(input: {
  kind: X402PaymentKind;
  resourceId: string;
  requestUrl: string;
  description: string;
  amountDisplay: string;
  existingSessionId?: string | null;
}) {
  if (X402_DEV_MOCK_MODE) {
    throw new ApiError(
      "BAZAAR_X_X402_DEV_MOCK_MODE is enabled. Disable it to use the real paid delegation path.",
      500,
      "X402_DEV_MOCK_ENABLED",
    );
  }

  const [manifest, token, ledger] = await Promise.all([
    ensureWalletManifest(),
    ensureX402TokenDeployment(),
    loadLedger(),
  ]);
  const existingSession = input.existingSessionId
    ? ledger.sessions[input.existingSessionId]
    : null;

  if (
    existingSession &&
    existingSession.kind === input.kind &&
    existingSession.resourceId === input.resourceId
  ) {
    return {
      session: existingSession,
      token,
      manifest,
      created: false,
    };
  }

  const amountAtomic = parseUnits(input.amountDisplay, token.decimals).toString();
  const requirements: X402PaymentRequirements = {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: `eip155:${manifest.chainId}`,
        amount: amountAtomic,
        asset: token.contractAddress,
        payTo: token.payTo,
        maxTimeoutSeconds: X402_PAYMENT_TIMEOUT_SECONDS,
        extra: {
          sessionId: existingSession?.id ?? randomUUID(),
          kind: input.kind,
          resourceId: input.resourceId,
          facilitator: "bazaar-local-testnet",
          assetSymbol: token.symbol,
          amountLabel: `${input.amountDisplay} ${token.symbol}`,
        },
      },
    ],
    resource: {
      url: input.requestUrl,
      description: input.description,
      mimeType: "application/json",
    },
    extra: {
      resourceKey: paymentSessionResourceKey(input.kind, input.resourceId),
    },
  };

  const nextSession: X402PaymentSessionRecord = {
    id: requirements.accepts[0].extra?.sessionId as string,
    kind: input.kind,
    resourceId: input.resourceId,
    createdAt: existingSession?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    status: existingSession?.status ?? "payment-required",
    requirements,
    amountLabel: `${input.amountDisplay} ${token.symbol}`,
    assetSymbol: token.symbol,
    payer: existingSession?.payer,
    paymentPayloadBase64: existingSession?.paymentPayloadBase64,
    paymentPayloadHash: existingSession?.paymentPayloadHash,
    authorization: existingSession?.authorization,
    receipt: existingSession?.receipt,
    fulfilledResponse: existingSession?.fulfilledResponse,
    invalidReason: existingSession?.invalidReason,
  };

  ledger.sessions[nextSession.id] = nextSession;
  await saveLedger(ledger);

  return {
    session: nextSession,
    token,
    manifest,
    created: true,
  };
}

export async function getX402Session(sessionId?: string | null) {
  if (!sessionId) {
    return null;
  }

  const ledger = await loadLedger();
  return ledger.sessions[sessionId] ?? null;
}

function buildPaymentReceipt(
  session: X402PaymentSessionRecord,
  txHash: Hex,
  explorerBaseUrl: string,
) {
  const accepted = session.requirements.accepts[0];
  if (!accepted || !session.authorization?.from) {
    throw new ApiError("Payment session is missing authorization data.", 500, "INVALID_SESSION");
  }

  return {
    id: `x402:${session.id}`,
    sessionId: session.id,
    kind: session.kind,
    protocol: "x402-exact-evm",
    facilitator: "bazaar-local-testnet",
    status: "settled",
    network: accepted.network,
    payer: session.authorization.from,
    payTo: accepted.payTo,
    asset: accepted.asset,
    assetSymbol: session.assetSymbol,
    amount: accepted.amount,
    amountLabel: session.amountLabel,
    authorizationNonce: session.authorization.nonce,
    settledAt: nowIso(),
    settlementTxHash: txHash,
    settlementExplorerUrl: explorerTxUrl(txHash, explorerBaseUrl),
    recovered: false,
  } satisfies X402PaymentReceipt;
}

async function readAuthorizationState(token: X402TokenDeploymentArtifact, authorization: X402TypedAuthorization) {
  return readX402ContractWithRetry<boolean>({
    token,
    functionName: "authorizationState",
    args: [authorization.from, authorization.nonce],
  });
}

export async function settleX402PaymentSession(input: {
  sessionId: string;
  paymentHeader: string;
}) {
  const [ledger, manifest, token] = await Promise.all([
    loadLedger(),
    ensureWalletManifest(),
    ensureX402TokenDeployment(),
  ]);
  const session = ledger.sessions[input.sessionId];

  if (!session) {
    throw new ApiError("Unknown x402 payment session.", 404, "PAYMENT_SESSION_NOT_FOUND");
  }

  if (session.receipt) {
    return {
      session,
      receipt: {
        ...session.receipt,
        status: session.fulfilledResponse ? "recovered" : "settled",
        recovered: true,
      } satisfies X402PaymentReceipt,
      recovered: true,
    };
  }

  const failSession = async (
    message: string,
    status: number,
    code: string,
    invalidReason: string,
  ): Promise<never> => {
    session.status = "failed";
    session.updatedAt = nowIso();
    session.invalidReason = invalidReason;
    await saveLedger(ledger);
    throw new ApiError(message, status, code, { invalidReason });
  };

  const payload = decodePaymentPayloadHeader(input.paymentHeader);
  if (!payload) {
    return failSession(
      "The supplied x402 payment payload could not be decoded.",
      402,
      "INVALID_PAYMENT",
      "invalid_header_encoding",
    );
  }

  const accepted = session.requirements.accepts[0];
  if (!accepted || !stableRequirementEquals(payload.accepted, accepted)) {
    return failSession(
      "The supplied x402 payment payload does not match the requested resource.",
      402,
      "INVALID_PAYMENT",
      "requirements_mismatch",
    );
  }

  const authorization = coerceAuthorization(payload.payload.authorization);
  if (authorization.to.toLowerCase() !== accepted.payTo.toLowerCase()) {
    return failSession(
      "The x402 payee does not match the session.",
      402,
      "INVALID_PAYMENT",
      "invalid_payee",
    );
  }

  if (authorization.value.toString() !== accepted.amount) {
    return failSession(
      "The x402 payment amount does not match the session.",
      402,
      "INVALID_PAYMENT",
      "invalid_amount",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(authorization.validAfter) >= now) {
    return failSession(
      "The x402 authorization is not valid yet.",
      402,
      "INVALID_PAYMENT",
      "authorization_not_yet_valid",
    );
  }

  if (Number(authorization.validBefore) <= now) {
    return failSession(
      "The x402 authorization expired before settlement.",
      402,
      "INVALID_PAYMENT",
      "authorization_expired",
    );
  }

  const nonceKey = paymentNonceIndexKey(payload.payload.authorization);
  const nonceOwner = ledger.nonceIndex[nonceKey];
  if (nonceOwner && nonceOwner !== session.id) {
    return failSession(
      "This x402 authorization nonce was already consumed.",
      409,
      "PAYMENT_REPLAY",
      "authorization_replayed",
    );
  }

  const signatureValid = await verifyTypedData({
    address: authorization.from,
    domain: {
      name: token.name,
      version: "1",
      chainId: token.chainId,
      verifyingContract: token.contractAddress,
    },
    types: transferWithAuthorizationTypes,
    primaryType: "TransferWithAuthorization",
    message: authorization,
    signature: payload.payload.signature,
  });

  if (!signatureValid) {
    return failSession(
      "The x402 signature is invalid.",
      402,
      "INVALID_PAYMENT",
      "invalid_signature",
    );
  }

  const onchainReplay = await readAuthorizationState(token, authorization);
  if (onchainReplay) {
    return failSession(
      "This x402 authorization has already settled onchain.",
      409,
      "PAYMENT_REPLAY",
      "authorization_already_settled",
    );
  }

  const payerBalance = await readX402ContractWithRetry<bigint>({
    token,
    functionName: "balanceOf",
    args: [authorization.from],
  });
  if (payerBalance < authorization.value) {
    return failSession(
      "This wallet does not have enough delegation credit for the requested x402 payment.",
      402,
      "INSUFFICIENT_PAYMENT_BALANCE",
      "insufficient_balance",
    );
  }

  const { v, r, s } = splitSignature(payload.payload.signature);

  session.status = "settling";
  session.updatedAt = nowIso();
  session.payer = authorization.from;
  session.authorization = payload.payload.authorization;
  session.paymentPayloadBase64 = input.paymentHeader;
  session.paymentPayloadHash = payloadHash(input.paymentHeader);
  await saveLedger(ledger);

  let tx;
  try {
    tx = await executeContractWrite({
      manifest,
      deployment: tokenWriteTarget(token),
      privateKey: manifest.deployer.privateKey,
      abi: getX402TokenAbi(),
      functionName: "transferWithAuthorization",
      args: [
        authorization.from,
        authorization.to,
        authorization.value,
        authorization.validAfter,
        authorization.validBefore,
        authorization.nonce,
        v,
        r,
        s,
      ],
    });
  } catch (error) {
    session.status = "failed";
    session.updatedAt = nowIso();
    session.invalidReason = "settlement_reverted";
    await saveLedger(ledger);
    throw new ApiError(
      "The x402 payment could not be settled onchain.",
      402,
      "PAYMENT_SETTLEMENT_FAILED",
      {
        invalidReason: "settlement_reverted",
        cause: error instanceof Error ? error.message : "unknown_error",
      },
    );
  }

  const receipt = buildPaymentReceipt(session, tx.txHash, token.explorerBaseUrl);
  session.status = "settled";
  session.updatedAt = nowIso();
  session.receipt = receipt;
  ledger.nonceIndex[nonceKey] = session.id;
  await saveLedger(ledger);

  return {
    session,
    receipt,
    recovered: false,
  };
}

export async function markX402SessionFulfilled(sessionId: string, response: unknown) {
  const ledger = await loadLedger();
  const session = ledger.sessions[sessionId];
  if (!session) {
    return null;
  }

  session.status = "fulfilled";
  session.updatedAt = nowIso();
  session.fulfilledResponse = response;
  if (session.receipt) {
    session.receipt = {
      ...session.receipt,
      status: "fulfilled",
    };
  }
  await saveLedger(ledger);
  return session;
}

export async function buildPaymentRequiredEnvelope(input: {
  kind: X402PaymentKind;
  resourceId: string;
  requestUrl: string;
  description: string;
  amountDisplay: string;
  existingSessionId?: string | null;
}) {
  const { session } = await prepareX402PaymentSession(input);

  const paymentRequired = {
    protocol: "x402-exact-evm",
    header: "PAYMENT-SIGNATURE",
    sessionId: session.id,
    facilitator: "bazaar-local-testnet",
    requirements: session.requirements,
    assetSymbol: session.assetSymbol,
    amountLabel: session.amountLabel,
  } satisfies X402PaymentRequiredEnvelope;

  return {
    session,
    paymentRequired,
    paymentRequiredHeader: encodeBase64Json(session.requirements),
  };
}

export async function recordAgentPaymentStep(input: {
  actionId: QuestActionId;
  receipt: X402PaymentReceipt;
  payerAddress: Address;
}) {
  const [runtimeSnapshot, deployment] = await Promise.all([
    loadLiveRuntime(),
    loadDeploymentArtifact(),
  ]);

  if (!deployment || !input.receipt.settlementTxHash) {
    return null;
  }

  const runtime = runtimeSnapshot ?? {
    status: "ready" as const,
    lastUpdatedAt: nowIso(),
    txHashes: [],
    steps: [],
  };

  const key = actionStepKey(input.actionId);
  const existing = runtime.steps.find((step) => step.key === key && step.status === "success");
  if (existing) {
    return existing;
  }

  const settledAt = input.receipt.settledAt;
  runtime.steps.push({
    key,
    label: "Settle x402 delegation",
    status: "success",
    startedAt: settledAt,
    completedAt: settledAt,
    txHash: input.receipt.settlementTxHash,
    explorerUrl: input.receipt.settlementExplorerUrl,
    detail:
      `Settled ${input.receipt.amountLabel} to the village treasury so the ${actionHumanLabel(input.actionId)} ` +
      "agent could resume the step.",
    meta: {
      proofKind: "payment",
      actionId: input.actionId,
      paymentKind: "agent-action",
      paymentProtocol: input.receipt.protocol,
      facilitator: input.receipt.facilitator,
      payer: input.payerAddress,
      payTo: input.receipt.payTo,
      paymentAsset: input.receipt.asset,
      paymentAssetSymbol: input.receipt.assetSymbol,
      paymentAmount: input.receipt.amount,
      paymentAmountLabel: input.receipt.amountLabel,
      paymentSessionId: input.receipt.sessionId,
      paymentReceiptId: input.receipt.id,
    },
  });

  if (!runtime.txHashes.includes(input.receipt.settlementTxHash)) {
    runtime.txHashes.push(input.receipt.settlementTxHash);
  }

  await saveLiveRuntime(runtime);
  return runtime.steps[runtime.steps.length - 1] ?? null;
}

export function buildSkillPaymentProof(input: {
  skillId: string;
  skillName: string;
  receipt: X402PaymentReceipt;
}): ProofArtifact {
  return {
    id: `${input.receipt.id}:proof`,
    kind: "payment",
    title: `${input.skillName} Delegation Receipt`,
    body:
      `${input.receipt.amountLabel} cleared as a separate paid delegation receipt through the local x402 facilitator ` +
      "on X Layer testnet.",
    statement:
      `${input.skillId} paid delegation receipt settled via x402 exact EVM on X Layer testnet.`,
    label: input.receipt.amountLabel,
    districtId: "council-hall",
    actionId: "open-guild",
    txHash: input.receipt.settlementTxHash,
    explorerUrl: input.receipt.settlementExplorerUrl,
    createdAt: input.receipt.settledAt,
  };
}
