"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { bazaarAudioSystem } from "@/game/systems/audio-system";

type PhaserGameClientProps = {
  onReady?: () => void;
  onError?: (error: Error) => void;
};

type SharedPhaserGame = {
  destroy: (removeCanvas: boolean) => void;
  canvas?: HTMLCanvasElement | null;
  scale?: {
    refresh?: () => void;
  };
};

type SharedPhaserHandle = {
  game: SharedPhaserGame;
  destroyTimer: number | null;
};

let sharedGameHandle: SharedPhaserHandle | null = null;
let sharedGamePromise: Promise<SharedPhaserHandle> | null = null;

function cancelScheduledDestroy(handle: SharedPhaserHandle | null) {
  if (!handle || handle.destroyTimer === null || typeof window === "undefined") {
    return;
  }

  window.clearTimeout(handle.destroyTimer);
  handle.destroyTimer = null;
}

function attachExistingCanvas(parent: HTMLElement, game: SharedPhaserGame) {
  const canvas = game.canvas;
  if (canvas && canvas.parentElement !== parent) {
    parent.replaceChildren(canvas);
  }
}

async function getOrCreateGame(parent: HTMLElement) {
  cancelScheduledDestroy(sharedGameHandle);

  if (sharedGameHandle) {
    attachExistingCanvas(parent, sharedGameHandle.game);
    return sharedGameHandle;
  }

  if (!sharedGamePromise) {
    sharedGamePromise = (async () => {
      const { createBazaarPhaserGame } = await import("@/game/core/phaser-bootstrap");
      const game = createBazaarPhaserGame(parent) as SharedPhaserGame;
      const handle = {
        game,
        destroyTimer: null,
      } satisfies SharedPhaserHandle;
      sharedGameHandle = handle;
      sharedGamePromise = null;
      return handle;
    })().catch((error) => {
      sharedGamePromise = null;
      throw error;
    });
  }

  const handle = await sharedGamePromise;
  attachExistingCanvas(parent, handle.game);
  return handle;
}

function scheduleDestroy(handle: SharedPhaserHandle | null) {
  if (!handle || typeof window === "undefined") {
    return;
  }

  cancelScheduledDestroy(handle);
  handle.destroyTimer = window.setTimeout(() => {
    if (sharedGameHandle !== handle) {
      return;
    }

    handle.game.destroy(true);
    bazaarAudioSystem.teardown();
    sharedGameHandle = null;
    sharedGamePromise = null;
  }, 400);
}

export function PhaserGameClient({ onReady, onError }: PhaserGameClientProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const notifyReady = useEffectEvent(() => {
    onReady?.();
  });
  const notifyError = useEffectEvent((error: Error) => {
    onError?.(error);
  });

  useEffect(() => {
    let destroyed = false;
    let handle: SharedPhaserHandle | null = null;

    async function mount() {
      try {
        if (!rootRef.current) {
          return;
        }

        handle = await getOrCreateGame(rootRef.current);
        if (destroyed || !rootRef.current) {
          scheduleDestroy(handle);
          return;
        }
        notifyReady();
      } catch (error) {
        if (destroyed) {
          return;
        }

        notifyError(
          error instanceof Error ? error : new Error("Unable to start the Phaser game client."),
        );
      }
    }

    void mount();

    return () => {
      destroyed = true;
      scheduleDestroy(handle ?? sharedGameHandle);
    };
  }, [notifyError, notifyReady]);

  return <div ref={rootRef} className="phaser-stage h-full w-full" />;
}
