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

function proofKindLabel(proof: ProofArtifact) {
  if (proof.kind === "payment") {
    return "payment proof";
  }

  if (proof.kind === "swap") {
    return "swap proof";
  }

  if (proof.kind === "receipt") {
    return "settlement proof";
  }

  if (proof.kind === "decree") {
    return "governance proof";
  }

  if (proof.actionId === "treasury-reinvest" || proof.stepKey === "treasury-reinvests") {
    return "treasury proof";
  }

  if (proof.kind === "unlock") {
    return "skill unlock proof";
  }

  return proof.kind;
}

export function ProofRealityOverlay({ proof, onClose }: ProofRealityOverlayProps) {
  return (
    <div className="proof-overlay fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="proof-modal">

        {/* Header */}
        <div className="proof-header">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              <span className={`px-pill ${proofToneClass(proof.kind)}`}>{proofKindLabel(proof)}</span>
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
          <div className="proof-hero">
            <div className="px-kicker k-ice">Proof Verified</div>
            <div className="proof-statement">{proof.statement}</div>
            <div className="proof-hero-copy">{proof.body}</div>
          </div>

          <div className="proof-metadata">
            <span className="proof-meta-pill">District · {humanize(proof.districtId)}</span>
            <span className="proof-meta-pill">{proof.label}</span>
            {proof.executionLabel ? (
              <span className="proof-meta-pill">{proof.executionLabel}</span>
            ) : null}
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
