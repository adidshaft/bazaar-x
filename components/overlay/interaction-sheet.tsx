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
    <div className="fixed inset-0 z-50 flex flex-col justify-end pb-8">
      {/* Full screen scrim for tap-to-dismiss */}
      <div className="absolute inset-0 bg-black/40 cursor-pointer" onClick={onClose} />
      
      <div className="relative mx-auto w-[min(46rem,calc(100vw-2rem))] pointer-events-auto">
        <div className="border-[4px] border-black bg-[#2b55b3] shadow-[8px_8px_0_rgba(0,0,0,0.5)] relative overflow-hidden p-4 text-white md:p-5">
          <div className="relative z-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="arcade-face text-[0.4rem] tracking-[0.1em] text-[#fbbf24] uppercase">
                  {objectiveLabel ?? "Village Interaction"}
                </div>
                <h2 className="mt-2 font-[var(--font-arcade)] text-lg leading-tight text-white uppercase">
                  {title}
                </h2>
                <p className="mt-2 max-w-[38rem] font-[var(--font-pixel)] text-lg leading-6 text-gray-200">{subtitle}</p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="pixel-button px-4 py-2"
              >
                <span className="arcade-face text-[0.38rem]">Close</span>
              </button>
            </div>

            <div className="mt-6 grid gap-0 border-4 border-black bg-blue-900/40 p-4">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="px-2 py-1 font-[var(--font-pixel)] text-xl leading-relaxed text-white"
                >
                  * {line}
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="font-[var(--font-pixel)] text-lg text-gray-300 md:max-w-[32rem]">
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
    </div>
  );
}
