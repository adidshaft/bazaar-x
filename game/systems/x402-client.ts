import { createWalletStorageKey } from "@/game/systems/persistence-service";
import type {
  WalletIdentity,
  X402PaymentKind,
  X402PaymentPayload,
  X402PaymentReceipt,
  X402PaymentRequiredEnvelope,
} from "@/game/core/live-types";

type SigningWalletClient = {
  signTypedData: (input: {
    account?: `0x${string}`;
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: `0x${string}`;
    };
    types: {
      TransferWithAuthorization: ReadonlyArray<{ name: string; type: string }>;
    };
    primaryType: "TransferWithAuthorization";
    message: {
      from: `0x${string}`;
      to: `0x${string}`;
      value: bigint;
      validAfter: bigint;
      validBefore: bigint;
      nonce: `0x${string}`;
    };
  }) => Promise<`0x${string}`>;
  account?: {
    address?: `0x${string}`;
  } | null;
};

type PersistedPaymentSession = {
  sessionId: string;
  kind: X402PaymentKind;
  resourceId: string;
  updatedAt: string;
};

type X402ErrorResponse = {
  ok: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  paymentRequired?: X402PaymentRequiredEnvelope;
};

export type X402ClientPhase =
  | { phase: "payment-required"; paymentRequired: X402PaymentRequiredEnvelope }
  | { phase: "signing"; paymentRequired: X402PaymentRequiredEnvelope }
  | { phase: "settling"; paymentRequired: X402PaymentRequiredEnvelope }
  | { phase: "recovered"; paymentReceipt: X402PaymentReceipt };

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

function parseJson<T>(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function encodeBase64Json(value: unknown) {
  const json = JSON.stringify(value);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return globalThis.btoa(binary);
}

function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
}

function paymentStorageKey(wallet: WalletIdentity) {
  const walletKey = createWalletStorageKey(wallet);
  return walletKey ? `${walletKey}:x402-sessions` : null;
}

function loadPaymentSessions(wallet: WalletIdentity) {
  const key = paymentStorageKey(wallet);
  if (!key || typeof window === "undefined") {
    return {} as Record<string, PersistedPaymentSession>;
  }

  return parseJson<Record<string, PersistedPaymentSession>>(window.localStorage.getItem(key)) ?? {};
}

function savePaymentSession(
  wallet: WalletIdentity,
  session: PersistedPaymentSession,
) {
  const key = paymentStorageKey(wallet);
  if (!key || typeof window === "undefined") {
    return;
  }

  const sessions = loadPaymentSessions(wallet);
  sessions[`${session.kind}:${session.resourceId}`] = session;
  window.localStorage.setItem(key, JSON.stringify(sessions));
}

function clearPaymentSession(
  wallet: WalletIdentity,
  kind: X402PaymentKind,
  resourceId: string,
) {
  const key = paymentStorageKey(wallet);
  if (!key || typeof window === "undefined") {
    return;
  }

  const sessions = loadPaymentSessions(wallet);
  delete sessions[`${kind}:${resourceId}`];
  window.localStorage.setItem(key, JSON.stringify(sessions));
}

function getPersistedPaymentSession(
  wallet: WalletIdentity,
  kind: X402PaymentKind,
  resourceId: string,
) {
  return loadPaymentSessions(wallet)[`${kind}:${resourceId}`] ?? null;
}

function describeX402InvalidReason(reason?: string, cause?: string) {
  switch (reason) {
    case "insufficient_balance":
      return "Insufficient Credit. Claim the citizen stipend or top up BXC, then try again.";
    case "authorization_expired":
      return "Authorization Expired. Start the payment again and sign a fresh x402 authorization.";
    case "authorization_replayed":
    case "authorization_already_settled":
      return "Authorization Already Used. Retry to mint a fresh payment session.";
    case "authorization_not_yet_valid":
      return "Authorization Not Yet Valid. Wait a moment, then retry.";
    case "invalid_signature":
      return "Signature Invalid. Sign again with the same connected wallet.";
    case "invalid_payee":
    case "invalid_amount":
    case "requirements_mismatch":
    case "invalid_header_encoding":
      return "Payment Payload Mismatch. Restart the delegation from the beginning.";
    case "settlement_reverted":
      return cause
        ? `Settlement Reverted. ${cause}`
        : "Settlement Reverted. Retry the delegation or refresh your credit.";
    default:
      return null;
  }
}

function isUserRejectedError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const normalized = message.toLowerCase();
  return (
    normalized.includes("user rejected") ||
    normalized.includes("user denied") ||
    normalized.includes("request rejected") ||
    normalized.includes("rejected the request")
  );
}

function extractError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const details =
    (payload as { error?: { details?: { invalidReason?: string; cause?: string } } }).error?.details;
  const detailedMessage = describeX402InvalidReason(details?.invalidReason, details?.cause);
  if (detailedMessage) {
    return detailedMessage;
  }

  const maybeMessage =
    (payload as { error?: { message?: string }; message?: string }).error?.message ??
    (payload as { message?: string }).message;

  return maybeMessage ?? fallback;
}

async function parseResponseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

async function signPaymentPayload(input: {
  payerAddress: `0x${string}`;
  walletClient: SigningWalletClient;
  paymentRequired: X402PaymentRequiredEnvelope;
}) {
  const accepted = input.paymentRequired.requirements.accepts[0];
  if (!accepted) {
    throw new Error("The x402 resource did not return an accepted payment option.");
  }

  const chainId = Number(accepted.network.split(":")[1] ?? 0);
  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(now - 30);
  const validBefore = BigInt(now + (accepted.maxTimeoutSeconds ?? 300));
  const authorization = {
    from: input.payerAddress,
    to: accepted.payTo,
    value: BigInt(accepted.amount),
    validAfter,
    validBefore,
    nonce: randomNonce(),
  };

  const signature = await input.walletClient.signTypedData({
    account: input.walletClient.account?.address ?? input.payerAddress,
    domain: {
      name: "Bazaar Delegation Credit",
      version: "1",
      chainId,
      verifyingContract: accepted.asset,
    },
    types: transferWithAuthorizationTypes,
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });

  return {
    x402Version: 2,
    resource: input.paymentRequired.requirements.resource,
    accepted,
    payload: {
      signature,
      authorization: {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value.toString(),
        validAfter: authorization.validAfter.toString(),
        validBefore: authorization.validBefore.toString(),
        nonce: authorization.nonce,
      },
    },
  } satisfies X402PaymentPayload;
}

export async function postWithX402Retry<TBody extends Record<string, unknown>>(input: {
  url: string;
  body: TBody;
  wallet: WalletIdentity;
  payerAddress: `0x${string}`;
  walletClient: SigningWalletClient;
  kind: X402PaymentKind;
  resourceId: string;
  onPhaseChange?: (phase: X402ClientPhase) => void;
}) {
  const persistedSession = getPersistedPaymentSession(input.wallet, input.kind, input.resourceId);
  const bodyWithSession = persistedSession?.sessionId
    ? {
        ...input.body,
        paymentSessionId: persistedSession.sessionId,
      }
    : input.body;

  const firstResponse = await fetch(input.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(bodyWithSession),
    cache: "no-store",
  });

  if (firstResponse.status !== 402) {
    if (firstResponse.ok) {
      clearPaymentSession(input.wallet, input.kind, input.resourceId);
    }
    return firstResponse;
  }

  const challengePayload = await parseResponseJson<X402ErrorResponse>(firstResponse);
  const paymentRequired = challengePayload?.paymentRequired;
  if (!paymentRequired) {
    throw new Error("The server required x402 payment but did not return requirements.");
  }

  savePaymentSession(input.wallet, {
    sessionId: paymentRequired.sessionId,
    kind: input.kind,
    resourceId: input.resourceId,
    updatedAt: new Date().toISOString(),
  });
  input.onPhaseChange?.({ phase: "payment-required", paymentRequired });

  let signedPayload: Awaited<ReturnType<typeof signPaymentPayload>>;
  try {
    signedPayload = await signPaymentPayload({
      payerAddress: input.payerAddress,
      walletClient: input.walletClient,
      paymentRequired,
    });
  } catch (error) {
    if (isUserRejectedError(error)) {
      throw new Error("Signature Rejected. The x402 payment was not authorized.", { cause: error });
    }
    throw error;
  }
  input.onPhaseChange?.({ phase: "signing", paymentRequired });

  const encodedPayload = encodeBase64Json(signedPayload);
  input.onPhaseChange?.({ phase: "settling", paymentRequired });

  const secondResponse = await fetch(input.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "PAYMENT-SIGNATURE": encodedPayload,
      "X-PAYMENT": encodedPayload,
    },
    body: JSON.stringify({
      ...input.body,
      paymentSessionId: paymentRequired.sessionId,
    }),
    cache: "no-store",
  });

  if (secondResponse.ok) {
    clearPaymentSession(input.wallet, input.kind, input.resourceId);
    return secondResponse;
  }

  const failurePayload = await parseResponseJson<X402ErrorResponse>(secondResponse);
  throw new Error(extractError(failurePayload, "x402 settlement failed."));
}

type X402StatusResponse = {
  ok: true;
  status: {
    network: string;
    tokenAddress: `0x${string}`;
    symbol: string;
    decimals: number;
    balance: string;
    balanceLabel: string;
    payTo: `0x${string}`;
    canClaimStipend: boolean;
    stipendAmountLabel: string;
    lastClaim: {
      amountLabel: string;
      txHash: `0x${string}`;
      claimedAt: string;
      explorerUrl: string;
    } | null;
  };
};

export async function fetchX402Status(address: `0x${string}`) {
  const response = await fetch(`/api/x402/status?address=${address}`, {
    cache: "no-store",
  });
  const payload = await parseResponseJson<X402StatusResponse>(response);
  if (!response.ok || !payload) {
    throw new Error(extractError(payload, "Failed to load x402 status."));
  }

  return payload.status;
}

type X402StipendResponse = {
  ok: true;
  stipend: {
    amountLabel: string;
    txHash: `0x${string}`;
    explorerUrl: string;
  };
};

export async function claimX402StipendRequest(address: `0x${string}`) {
  const response = await fetch("/api/x402/stipend", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ address }),
    cache: "no-store",
  });
  const payload = await parseResponseJson<X402StipendResponse>(response);
  if (!response.ok || !payload) {
    throw new Error(extractError(payload, "Failed to claim delegation credit."));
  }

  return payload.stipend;
}

export function clearPersistedPaymentSessions(wallet: WalletIdentity) {
  const key = paymentStorageKey(wallet);
  if (!key || typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}
