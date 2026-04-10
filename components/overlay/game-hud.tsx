type GameHudProps = {
  addressLabel: string;
  balanceLabel: string;
  chainLabel: string;
  objectiveTitle: string;
  objectiveCopy: string;
  runtimeLabel: string;
  taxLabel: string;
  treasuryLabel: string;
  pendingLabel?: string | null;
  muted: boolean;
  lowEffects: boolean;
  onToggleJournal: () => void;
  onToggleMute: () => void;
  onToggleLowEffects: () => void;
};

export function GameHud({
  addressLabel,
  balanceLabel,
  chainLabel,
  objectiveTitle,
  objectiveCopy,
  runtimeLabel,
  taxLabel,
  treasuryLabel,
  pendingLabel,
  muted,
  lowEffects,
  onToggleJournal,
  onToggleMute,
  onToggleLowEffects,
}: GameHudProps) {
  return (
    <>
      <div className="pointer-events-auto absolute left-3 top-3 z-30 w-[min(32rem,calc(100vw-1.5rem))] md:left-5 md:top-5">
        <div className="overlay-card space-y-3 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="overlay-kicker">Current Objective</div>
              <h1 className="overlay-title mt-1 text-xl text-[#fff3d3] md:text-2xl">{objectiveTitle}</h1>
              <p className="mt-2 max-w-[34rem] text-sm leading-6 text-[#e4d6b4]">{objectiveCopy}</p>
            </div>
            <button type="button" onClick={onToggleJournal} className="hud-chip">
              Journal
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="hud-stat">
              <span>Wallet</span>
              <strong>{addressLabel}</strong>
            </div>
            <div className="hud-stat">
              <span>Balance</span>
              <strong>{balanceLabel}</strong>
            </div>
            <div className="hud-stat">
              <span>Network</span>
              <strong>{chainLabel}</strong>
            </div>
            <div className="hud-stat">
              <span>Runtime</span>
              <strong>{runtimeLabel}</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <div className="hud-chip justify-between">
              <span>Tax</span>
              <strong>{taxLabel}</strong>
            </div>
            <div className="hud-chip justify-between">
              <span>Treasury</span>
              <strong>{treasuryLabel}</strong>
            </div>
            <div className="hud-chip justify-between">
              <span>Action</span>
              <strong>{pendingLabel ?? "Idle"}</strong>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onToggleMute} className="hud-chip">
              {muted ? "Unmute" : "Mute"}
            </button>
            <button type="button" onClick={onToggleLowEffects} className="hud-chip">
              {lowEffects ? "Full FX" : "Low FX"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

