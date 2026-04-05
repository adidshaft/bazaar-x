import { ensureCoreWalletFunding } from "../lib/onchain/faucet";
import { ensureWalletManifest, getFundingSnapshot } from "../lib/onchain/runtime";
import { toPrettyJson } from "../lib/server/json";

async function main() {
  const manifest = await ensureWalletManifest();
  await ensureCoreWalletFunding(manifest);
  const funding = await getFundingSnapshot(manifest);

  console.log(
    toPrettyJson({
      deployerAddress: manifest.deployer.address,
      treasuryAddress: manifest.treasury.address,
      funding,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
