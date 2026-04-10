"use client";

import { useEffect, useRef } from "react";

export function PhaserGameClient() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let destroyed = false;
    let game: { destroy: (removeCanvas: boolean) => void } | null = null;

    async function mount() {
      if (!rootRef.current) {
        return;
      }

      const { createBazaarPhaserGame } = await import("@/game/core/phaser-bootstrap");
      if (destroyed || !rootRef.current) {
        return;
      }

      game = createBazaarPhaserGame(rootRef.current);
    }

    void mount();

    return () => {
      destroyed = true;
      game?.destroy(true);
    };
  }, []);

  return <div ref={rootRef} className="phaser-stage h-full w-full" />;
}
