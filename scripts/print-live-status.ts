import { getLiveDashboardStatus } from "../lib/onchain/flow";
import { toPrettyJson } from "../lib/server/json";
import { sanitizeManifestPayload } from "../lib/server/public";

async function main() {
  const status = await getLiveDashboardStatus();
  console.log(toPrettyJson(sanitizeManifestPayload(status)));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
