import { ensureCoreWalletFunding } from "../lib/onchain/faucet";
import { ensureWalletManifest, getFundingSnapshot } from "../lib/onchain/runtime";
import { toPrettyJson } from "../lib/server/json";
import { isXLayerTestnetChain, xLayerNetworkLabel } from "../lib/xlayer";

async function main() {
  const manifest = await ensureWalletManifest();
  if (!isXLayerTestnetChain(manifest.chainId)) {
    const funding = await getFundingSnapshot(manifest);
    console.log(
      toPrettyJson({
        network: xLayerNetworkLabel(manifest.chainId),
        deployerAddress: manifest.deployer.address,
        treasuryAddress: manifest.treasury.address,
        funding,
        note: "Automatic faucet funding is only available on X Layer testnet. Fund these wallets manually on mainnet.",
      }),
    );
    return;
  }

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
