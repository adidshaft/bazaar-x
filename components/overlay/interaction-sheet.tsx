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
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-40 w-[min(46rem,calc(100vw-1.5rem))] -translate-x-1/2 md:bottom-5">
      <div className="pixel-window-dark panel-glow relative overflow-hidden p-4 text-[#eef7fb] md:p-5">
        <div className="soft-grid pointer-events-none absolute inset-0 opacity-20" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,230,255,0.12),transparent_52%)]" />

        <div className="relative z-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="arcade-face text-[0.34rem] tracking-[0.2em] text-[#7de6ff]">
                {objectiveLabel ?? "Village Interaction"}
              </div>
              <h2 className="mt-2 font-[var(--font-display)] text-[1.5rem] leading-none text-white md:text-[1.85rem]">
                {title}
              </h2>
              <p className="mt-2 max-w-[38rem] text-sm leading-6 text-[#b8cad7]">{subtitle}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="pixel-button bg-[#eef4fa] px-3 py-2 text-[#11161e]"
            >
              <span className="arcade-face text-[0.38rem]">Close</span>
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {lines.map((line) => (
              <div
                key={line}
                className="border-4 border-[#16202a] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm leading-6 text-[#dcecf6]"
              >
                {line}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="border-4 border-[#16202a] bg-[rgba(8,10,14,0.38)] px-4 py-3 text-sm leading-6 text-[#a9bfcd] md:max-w-[32rem]">
              {disabledReason ??
                "Quest actions here submit real Bazaar X transactions to X Layer and wait for onchain proof."}
            </div>

            {actionLabel && onAction ? (
              <button
                type="button"
                onClick={onAction}
                disabled={actionDisabled || actionPending}
                className="action-button w-full md:w-auto"
              >
                {actionPending ? "Submitting..." : actionLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
