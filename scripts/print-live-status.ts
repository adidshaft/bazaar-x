import { getLiveDashboardStatus } from "../lib/onchain/flow";
import { toPrettyJson } from "../lib/server/json";

async function main() {
  const status = await getLiveDashboardStatus();
  console.log(toPrettyJson(status));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
