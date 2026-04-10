type InteractionSheetProps = {
  title: string;
  subtitle: string;
  lines: string[];
  objectiveLabel?: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionPending?: boolean;
  disabledReason?: string | null;
  onAction?: () => void;
  onClose: () => void;
};

export function InteractionSheet({
  title,
  subtitle,
  lines,
  objectiveLabel,
  actionLabel,
  actionDisabled,
  actionPending,
  disabledReason,
  onAction,
  onClose,
}: InteractionSheetProps) {
  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-40 w-[min(48rem,calc(100vw-1.5rem))] -translate-x-1/2 md:bottom-5">
      <div className="overlay-card p-4 md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="overlay-kicker">{objectiveLabel ?? "Village Interaction"}</div>
            <h2 className="overlay-title mt-1 text-lg text-[#fff3d3] md:text-xl">{title}</h2>
            <p className="mt-1 text-sm text-[#d5c5a1]">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="hud-chip">
            Close
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {lines.map((line) => (
            <p key={line} className="dialogue-line">
              {line}
            </p>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm leading-6 text-[#c9b88f]">
            {disabledReason ?? "Quest actions here submit real Bazaar X transactions to X Layer."}
          </div>

          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              disabled={actionDisabled || actionPending}
              className="action-button"
            >
              {actionPending ? "Submitting..." : actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

