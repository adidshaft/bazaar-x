import { readBazaarSnapshot } from "../onchain/contract";

export function hasOnchainConfig() {
  return true;
}

export async function readContractSnapshot() {
  try {
    return await readBazaarSnapshot();
  } catch {
    return null;
  }
}
