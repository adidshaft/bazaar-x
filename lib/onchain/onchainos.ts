import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { OnchainOsSnapshot } from "./types";

function onchainosPath() {
  return resolve(process.env.HOME ?? "", ".local/bin/onchainos");
}

function runOnchainos(args: string[]) {
  const binary = onchainosPath();
  if (!existsSync(binary)) {
    throw new Error("onchainos CLI not installed.");
  }

  const raw = execFileSync(binary, args, {
    encoding: "utf8",
    env: process.env,
  }).trim();

  return raw ? JSON.parse(raw) : null;
}

export async function collectOnchainOsSnapshot(): Promise<OnchainOsSnapshot> {
  try {
    return {
      collectedAt: new Date().toISOString(),
      gatewayChains: runOnchainos(["gateway", "chains"]),
      gatewayGas: runOnchainos(["gateway", "gas", "--chain", "xlayer"]),
    };
  } catch (error) {
    return {
      collectedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Failed to collect Onchain OS data.",
    };
  }
}
