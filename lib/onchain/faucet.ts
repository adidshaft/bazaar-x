import { formatEther, parseEther } from "viem";
import { createXLayerPublicClient } from "../xlayer";
import { isXLayerTestnetChain, xLayerNetworkLabel } from "../xlayer";
import type { WalletManifest } from "./types";

const faucetUrl = "https://web3.okx.com/priapi/v1/ob/faucet/token/applyWithVerificationCode";
const okbConfigId = 1;
const treasuryMinimum = parseEther("0.01");
const deployerMinimum = parseEther("0.195");

async function claim(address: `0x${string}`, devId: string) {
  const response = await fetch(faucetUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      configId: okbConfigId,
      targetAddress: address,
      lotNumber: "",
      captchaOutput: "",
      passToken: "",
      genTime: "",
      scene: "",
      devId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Faucet request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as {
    code: number;
    msg?: string;
    error_message?: string;
  };

  if (payload.code !== 0) {
    throw new Error(payload.error_message || payload.msg || "Unknown faucet error.");
  }
}

async function waitForBalance(
  manifest: WalletManifest,
  address: `0x${string}`,
  minimumBalance: bigint,
  timeoutMs = 60_000,
) {
  const client = createXLayerPublicClient(
    manifest.chainId,
    manifest.rpcUrl,
    manifest.explorerBaseUrl,
  );
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const balance = await client.getBalance({ address });
    if (balance >= minimumBalance) {
      return balance;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(
    `Timed out waiting for faucet funds on ${address}; expected at least ${formatEther(minimumBalance)} OKB.`,
  );
}

export async function ensureAddressFunding(
  manifest: WalletManifest,
  address: `0x${string}`,
  minimumBalance: bigint,
  devId: string,
) {
  const client = createXLayerPublicClient(
    manifest.chainId,
    manifest.rpcUrl,
    manifest.explorerBaseUrl,
  );

  const currentBalance = await client.getBalance({ address });
  if (currentBalance >= minimumBalance) {
    return {
      address,
      balance: currentBalance.toString(),
      funded: true,
    };
  }

  if (!isXLayerTestnetChain(manifest.chainId)) {
    throw new Error(
      `Automatic faucet funding is only available on X Layer testnet. Fund ${address} manually on ${xLayerNetworkLabel(manifest.chainId)} until it holds at least ${formatEther(minimumBalance)} OKB.`,
    );
  }

  await claim(address, devId);
  const fundedBalance = await waitForBalance(manifest, address, minimumBalance);

  return {
    address,
    balance: fundedBalance.toString(),
    funded: true,
  };
}

export async function ensureCoreWalletFunding(manifest: WalletManifest) {
  await ensureAddressFunding(
    manifest,
    manifest.deployer.address,
    deployerMinimum,
    "bazaar-x-deployer",
  );
  await ensureAddressFunding(
    manifest,
    manifest.treasury.address,
    treasuryMinimum,
    "bazaar-x-treasury",
  );

  return {
    deployer: manifest.deployer.address,
    treasury: manifest.treasury.address,
  };
}
