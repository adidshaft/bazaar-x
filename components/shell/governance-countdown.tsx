"use client";

import { useEffect, useState } from "react";

type GovernanceCountdownProps = {
  startedAt: number;
  durationMs: number;
};

export function GovernanceCountdown({ startedAt, durationMs }: GovernanceCountdownProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      setRemainingSeconds(Math.max(0, Math.ceil((durationMs - elapsed) / 1000)));
    };

    tick();
    const intervalId = window.setInterval(tick, 500);
    return () => window.clearInterval(intervalId);
  }, [durationMs, startedAt]);

  return <span className="px-stat-value">{remainingSeconds}s remaining</span>;
}
