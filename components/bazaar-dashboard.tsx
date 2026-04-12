"use client";

import dynamic from "next/dynamic";

const BazaarRpgShell = dynamic(
  () => import("@/components/shell/bazaar-rpg-shell").then((module) => module.BazaarRpgShell),
  {
    ssr: false,
    loading: () => (
      <main className="game-shell game-shell-detailed">
        <div className="shell-grid">
          <section className="shell-stage-column">
            <div className="game-stage shell-stage-surface" />
          </section>
        </div>
      </main>
    ),
  },
);

export function BazaarDashboard({ initialScene = null }: { initialScene?: string | null }) {
  return <BazaarRpgShell initialScene={initialScene} />;
}
