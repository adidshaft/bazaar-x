import type { ProofArtifact } from "@/game/core/live-types";
import { ArrowUpRight } from "lucide-react";

type ProofRealityOverlayProps = {
  proof: ProofArtifact;
  onClose: () => void;
};

function humanize(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function proofToneClass(kind: ProofArtifact["kind"]) {
  if (kind === "payment") {
    return "p-green";
  }

  if (kind === "swap") {
    return "p-purple";
  }

  if (kind === "decree") {
    return "p-gold";
  }

  return "p-ice";
}

export function ProofRealityOverlay({ proof, onClose }: ProofRealityOverlayProps) {
  return (
    <div className="proof-overlay fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="proof-modal">

        {/* Header */}
        <div className="proof-header">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              <span className={`px-pill ${proofToneClass(proof.kind)}`}>{proof.kind}</span>
              <span className="px-pill">{humanize(proof.districtId)}</span>
            </div>
            <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 17, fontWeight: 700, color: "var(--text-white)", lineHeight: 1.1 }}>
              {proof.title}
            </div>
          </div>
          <button type="button" onClick={onClose} className="px-btn ghost" style={{ flexShrink: 0, alignSelf: "flex-start" }} aria-label="Close proof">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="proof-body">
          {/* Statement */}
          <div className="px-card accent-ice">
            <div className="px-kicker k-ice">Statement</div>
            <div className="px-body" style={{ fontSize: 14, marginTop: 4 }}>{proof.statement}</div>
          </div>

          {/* Notes */}
          <div>
            <div className="px-body" style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{proof.body}</div>
            <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
              <span style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, color: "var(--text-muted)", textTransform: "uppercase" }}>
                District: {humanize(proof.districtId)}
              </span>
              <span style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, color: "var(--text-muted)", textTransform: "uppercase" }}>
                {proof.label}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="proof-footer">
          <button type="button" onClick={onClose} className="px-btn ghost">
            Dismiss
          </button>
          {proof.explorerUrl ? (
            <a href={proof.explorerUrl} target="_blank" rel="noreferrer" className="px-btn ice" style={{ textDecoration: "none" }}>
              <ArrowUpRight size={12} />View on Explorer
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
