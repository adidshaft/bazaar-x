import { initializeBazaarLiveState, runBazaarLiveFlow } from "../lib/onchain/flow";
import { toPrettyJson } from "../lib/server/json";

async function main() {
  await initializeBazaarLiveState();
  const runtime = await runBazaarLiveFlow();
  console.log(toPrettyJson(runtime));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
