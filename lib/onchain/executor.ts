import {
  encodeDeployData,
  encodeFunctionData,
  type Abi,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createXLayerPublicClient, createXLayerWallet } from "../xlayer";
import type {
  DeploymentArtifact,
  ExecutionMode,
  WalletManifest,
} from "./types";
import {
  assertOnchainOsGatewayChain,
  broadcastGatewayTransaction,
  firstGatewayBroadcastRow,
  firstGatewayOrder,
  firstGatewaySimulationRow,
  gatewayNormalGasPrice,
  getGatewayOrder,
  resolveOnchainOsExecution,
  simulateGatewayTransaction,
} from "./onchainos";

type ExecutionRequest = {
  manifest: WalletManifest;
  privateKey: Hex;
  to?: Address;
  value?: bigint;
  data?: Hex;
  gas?: bigint;
};

export type ExecutedTransaction = {
  txHash: Hex;
  receipt: TransactionReceipt;
  executionMode: ExecutionMode;
  gatewayOrderId?: string;
  simulated?: boolean;
  simulationGasUsed?: string;
};

async function executeViaViem(input: ExecutionRequest): Promise<ExecutedTransaction> {
  const publicClient = createXLayerPublicClient(
    input.manifest.chainId,
    input.manifest.rpcUrl,
    input.manifest.explorerBaseUrl,
  );
  const { account, client } = createXLayerWallet(
    input.privateKey,
    input.manifest.chainId,
    input.manifest.rpcUrl,
  );

  const txHash = await client.sendTransaction({
    account,
    to: input.to,
    value: input.value,
    data: input.data,
    gas: input.gas,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    receipt,
    executionMode: "viem",
  };
}

async function signLocally(input: ExecutionRequest) {
  const account = privateKeyToAccount(input.privateKey);
  const publicClient = createXLayerPublicClient(
    input.manifest.chainId,
    input.manifest.rpcUrl,
    input.manifest.explorerBaseUrl,
  );
  const { client } = createXLayerWallet(
    input.privateKey,
    input.manifest.chainId,
    input.manifest.rpcUrl,
  );
  const chainAlias = assertOnchainOsGatewayChain(input.manifest.chainId);
  const gasPrice = gatewayNormalGasPrice(chainAlias) ?? (await publicClient.getGasPrice());

  const request = await client.prepareTransactionRequest({
    account,
    to: input.to,
    value: input.value,
    data: input.data,
    gas: input.gas,
    gasPrice,
  });
  const serializableRequest = {
    ...(request as Record<string, unknown>),
  };
  delete (serializableRequest as { chain?: unknown }).chain;
  const signedPayload = {
    ...(serializableRequest as Record<string, unknown>),
    chainId: input.manifest.chainId,
  };

  const signedTx = await account.signTransaction(signedPayload as never);

  return {
    account,
    publicClient,
    chainAlias,
    signedTx,
  };
}

async function waitForGatewaySettlement(input: {
  chainAlias: string;
  address: Address;
  orderId: string;
  publicClient: ReturnType<typeof createXLayerPublicClient>;
  txHash: Hex;
}) {
  let lastFailure: string | null = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const orderResponse = getGatewayOrder({
      chainAlias: input.chainAlias,
      address: input.address,
      orderId: input.orderId,
    });
    const order = firstGatewayOrder(orderResponse);

    if (order) {
      const txStatus = order.txStatus ?? order.txstatus ?? "";
      if (txStatus === "2") {
        return {
          receipt: await input.publicClient.waitForTransactionReceipt({ hash: input.txHash }),
          order,
        };
      }

      if (txStatus === "3") {
        lastFailure = order.failReason ?? "Onchain OS gateway order failed.";
        break;
      }
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 2_000);
    });
  }

  if (lastFailure) {
    throw new Error(`Onchain OS gateway broadcast failed: ${lastFailure}`);
  }

  return {
    receipt: await input.publicClient.waitForTransactionReceipt({ hash: input.txHash }),
    order: firstGatewayOrder(
      getGatewayOrder({
        chainAlias: input.chainAlias,
        address: input.address,
        orderId: input.orderId,
      }),
    ),
  };
}

async function executeViaOnchainOsGateway(
  input: ExecutionRequest,
): Promise<ExecutedTransaction> {
  const { account, publicClient, chainAlias, signedTx } = await signLocally(input);

  let simulationGasUsed: string | undefined;
  let simulated = false;
  if (input.to) {
    const simulation = simulateGatewayTransaction({
      chainAlias,
      from: account.address,
      to: input.to,
      amount: input.value,
      data: input.data,
    });
    const row = firstGatewaySimulationRow(simulation);

    if (row?.failReason) {
      throw new Error(`Onchain OS simulation failed: ${row.failReason}`);
    }

    simulated = true;
    simulationGasUsed = row?.gasUsed;
  }

  const broadcast = broadcastGatewayTransaction({
    chainAlias,
    signedTx,
    address: account.address,
  });
  const broadcastRow = firstGatewayBroadcastRow(broadcast);

  if (!broadcastRow?.txHash) {
    throw new Error("Onchain OS gateway broadcast did not return a tx hash.");
  }

  const txHash = broadcastRow.txHash as Hex;
  const orderId = broadcastRow.orderId;

  const { receipt } = orderId
    ? await waitForGatewaySettlement({
        chainAlias,
        address: account.address,
        orderId,
        publicClient,
        txHash,
      })
    : {
        receipt: await publicClient.waitForTransactionReceipt({ hash: txHash }),
      };

  return {
    txHash,
    receipt,
    executionMode: "onchainos-gateway",
    gatewayOrderId: orderId,
    simulated,
    simulationGasUsed,
  };
}

function shouldUseOnchainOsGateway(chainId: number) {
  return resolveOnchainOsExecution(chainId).resolvedMode === "onchainos-gateway";
}

export async function executeRawTransaction(
  input: ExecutionRequest,
): Promise<ExecutedTransaction> {
  if (shouldUseOnchainOsGateway(input.manifest.chainId)) {
    return executeViaOnchainOsGateway(input);
  }

  return executeViaViem(input);
}

export async function executeNativeTransfer(input: {
  manifest: WalletManifest;
  privateKey: Hex;
  to: Address;
  value: bigint;
}) {
  return executeRawTransaction(input);
}

export async function executeContractWrite(input: {
  manifest: WalletManifest;
  deployment: DeploymentArtifact;
  privateKey: Hex;
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
    to: input.deployment.contractAddress,
    value: input.value,
    data,
  });
}

export async function executeContractDeployment(input: {
  manifest: WalletManifest;
  privateKey: Hex;
  abi: Abi;
  bytecode: Hex;
  args: unknown[];
}) {
  const data = encodeDeployData({
    abi: input.abi,
    bytecode: input.bytecode,
    args: input.args,
  });

  return executeRawTransaction({
    manifest: input.manifest,
    privateKey: input.privateKey,
    data,
  });
}
