type InteractionSheetProps = {
  title: string;
  subtitle: string;
  lines: string[];
  objectiveLabel?: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionPending?: boolean;
  actionNode?: React.ReactNode;
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
  actionNode,
  disabledReason,
  onAction,
  onClose,
}: InteractionSheetProps) {
  return (
    <div className="interaction-sheet">
      {/* Tap-to-dismiss scrim */}
      <div className="interaction-scrim" onClick={onClose} />

      <div className="interaction-card fade-in">
        {/* Header */}
        <div className="interaction-header">
          <div style={{ minWidth: 0 }}>
            <div className="interaction-sub">{objectiveLabel ?? "Village Interaction"}</div>
            <div className="interaction-title">{title}</div>
            <div className="interaction-footer" style={{ marginTop: 4, textAlign: "left" }}>{subtitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-btn ghost"
            style={{ flexShrink: 0, padding: "4px 8px", fontSize: 7 }}
            aria-label="Close interaction"
          >
            ✕ Close
          </button>
        </div>

        {/* Body: dialogue + action */}
        <div className="interaction-body">
          <div className="interaction-lines">
            {lines.slice(0, 2).map((line, idx) => (
              <div key={idx} className="interaction-line">{line}</div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
            {actionNode ? (
              actionNode
            ) : actionLabel && onAction ? (
              <button
                type="button"
                onClick={onAction}
                disabled={actionDisabled || actionPending}
                className="px-btn gold"
                style={{ whiteSpace: "nowrap" }}
              >
                {actionPending ? "Submitting…" : actionLabel}
              </button>
            ) : null}
            {(actionDisabled || actionPending) && disabledReason ? (
              <div
                className="interaction-footer"
                style={{
                  color: "var(--red)",
                  marginTop: 4,
                  textAlign: "right",
                }}
              >
                {disabledReason}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
