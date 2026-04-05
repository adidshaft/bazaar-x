import { ensureCoreWalletFunding } from "../lib/onchain/faucet";
import { deployLiveBazaar, getLiveDashboardStatus, initializeBazaarLiveState } from "../lib/onchain/flow";
import { ensureWalletManifest } from "../lib/onchain/runtime";
import { toPrettyJson } from "../lib/server/json";

async function main() {
  await initializeBazaarLiveState();
  const manifest = await ensureWalletManifest();
  try {
    await ensureCoreWalletFunding(manifest);
  } catch {
    // Reusing an existing deployment should still succeed even if the faucet is rate-limited.
  }
  await deployLiveBazaar();
  const status = await getLiveDashboardStatus();
  console.log(toPrettyJson(status));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
