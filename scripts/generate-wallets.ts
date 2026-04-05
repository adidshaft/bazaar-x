import { ensureWalletManifest, getFundingSnapshot } from "../lib/onchain/runtime";
import { toPrettyJson } from "../lib/server/json";

async function main() {
  const manifest = await ensureWalletManifest();
  const funding = await getFundingSnapshot(manifest);

  console.log(
    toPrettyJson({
      network: manifest.network,
      chainId: manifest.chainId,
      rpcUrl: manifest.rpcUrl,
      explorerBaseUrl: manifest.explorerBaseUrl,
      deployer: manifest.deployer.address,
      treasury: manifest.treasury.address,
      agents: manifest.agents.map((agent) => ({
        role: agent.role,
        name: agent.name,
        handle: agent.handle,
        address: agent.address,
        bootstrapOkb: agent.bootstrapOkb,
      })),
      funding,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
