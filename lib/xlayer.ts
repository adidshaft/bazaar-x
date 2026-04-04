import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const xLayerMainnet = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: {
    name: "OKB",
    symbol: "OKB",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.xlayer.tech"]
    }
  },
  blockExplorers: {
    default: {
      name: "OKLink",
      url: "https://www.oklink.com/x-layer"
    }
  }
});

export const xLayerTestnet = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: {
    name: "OKB",
    symbol: "OKB",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["https://testrpc.xlayer.tech/terigon"]
    }
  },
  blockExplorers: {
    default: {
      name: "OKLink",
      url: "https://www.oklink.com/x-layer-testnet"
    }
  }
});

export const defaultXLayerChain = xLayerTestnet;

export function resolveXLayerChain(chainId?: number) {
  if (chainId === xLayerMainnet.id) {
    return xLayerMainnet;
  }

  return xLayerTestnet;
}

export function resolveXLayerRpcUrl(chainId?: number) {
  return resolveXLayerChain(chainId).rpcUrls.default.http[0]!;
}

export function createXLayerPublicClient(
  chainId: number = defaultXLayerChain.id,
  rpcUrl?: string,
  explorerBaseUrl?: string
) {
  const baseChain = resolveXLayerChain(chainId);
  const transportUrl = rpcUrl ?? resolveXLayerRpcUrl(chainId);
  const blockExplorerUrl = explorerBaseUrl ?? baseChain.blockExplorers?.default.url ?? "";

  return createPublicClient({
    chain: {
      ...baseChain,
      rpcUrls: {
        default: {
          http: [transportUrl]
        }
      },
      blockExplorers: {
        default: {
          name: "OKLink",
          url: blockExplorerUrl
        }
      }
    } as typeof baseChain,
    transport: http(transportUrl)
  });
}

export function createXLayerWallet(
  privateKey: Hex,
  chainId: number = defaultXLayerChain.id,
  rpcUrl?: string
) {
  const baseChain = resolveXLayerChain(chainId);
  const transportUrl = rpcUrl ?? resolveXLayerRpcUrl(chainId);
  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({
    account,
    chain: {
      ...baseChain,
      rpcUrls: {
        default: {
          http: [transportUrl]
        }
      }
    } as typeof baseChain,
    transport: http(transportUrl)
  });

  return {
    account,
    client
  };
}

export function explorerTxUrl(hash: Hex | string, chainOrBaseUrl?: number | string) {
  const base =
    typeof chainOrBaseUrl === "string"
      ? chainOrBaseUrl
      : resolveXLayerChain(chainOrBaseUrl).blockExplorers?.default.url ?? "";
  return `${base}/tx/${hash}`;
}

export function explorerAddressUrl(address: Address | string, chainOrBaseUrl?: number | string) {
  const base =
    typeof chainOrBaseUrl === "string"
      ? chainOrBaseUrl
      : resolveXLayerChain(chainOrBaseUrl).blockExplorers?.default.url ?? "";
  return `${base}/address/${address}`;
}
