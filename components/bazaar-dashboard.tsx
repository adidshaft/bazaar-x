"use client";

import { BazaarRpgShell } from "@/components/shell/bazaar-rpg-shell";

export function BazaarDashboard({ initialScene = null }: { initialScene?: string | null }) {
  return <BazaarRpgShell initialScene={initialScene} />;
}

