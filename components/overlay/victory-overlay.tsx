"use client";

import { ArrowUpRight, RefreshCw } from "lucide-react";
import type { LiveDashboardStatus, ProofArtifact } from "@/game/core/live-types";
import { explorerAddressUrl } from "@/lib/xlayer";

type VictoryOverlayProps = {
  proofs: ProofArtifact[];
  liveStatus: LiveDashboardStatus | null;
  onClose: () => void;
  onReset: () => void;
};

export function VictoryOverlay({ proofs, liveStatus, onClose, onReset }: VictoryOverlayProps) {
  const contractAddress =
    liveStatus?.liveDashboard.runtime?.deployment?.contractAddress ?? liveStatus?.onchain?.address ?? null;
  const explorerBaseUrl =
    liveStatus?.liveDashboard.runtime?.deployment?.explorerBaseUrl ??
    liveStatus?.liveDashboard.manifest.explorerBaseUrl;
  const ledgerUrl = contractAddress ? explorerAddressUrl(contractAddress, explorerBaseUrl) : null;
  const gdp = liveStatus?.economics.gdpScore ?? 0;
  const treasury = Number(
    liveStatus?.liveDashboard.bazaarSnapshot?.treasuryBalanceOkb ??
    liveStatus?.onchain?.treasuryBalanceOkb ??
    0,
  );
  const taxBps = Number(
    liveStatus?.liveDashboard.bazaarSnapshot?.rules?.[0] ??
    liveStatus?.liveDashboard.runtime?.deployment?.initialRules.taxBps ??
    500,
  );
  const txCount = liveStatus?.liveDashboard.runtime?.txHashes.length ?? 0;
  const freshestProof = proofs[0] ?? null;

  function proofToneLabel(proof: ProofArtifact) {
    if (proof.kind === "payment") {
      return "Payment Proof";
    }

    if (proof.kind === "swap") {
      return "Swap Proof";
    }

    if (proof.kind === "receipt") {
      return proof.actionId === "treasury-reinvest" ? "Treasury Proof" : "Settlement Proof";
    }

    if (proof.kind === "decree") {
      return "Governance Proof";
    }

    if (proof.actionId === "treasury-reinvest" || proof.stepKey === "treasury-reinvests") {
      return "Treasury Proof";
    }

    if (proof.kind === "unlock") {
      return "Skill Unlock Proof";
    }

    return proof.kind;
  }

  return (
    <div className="victory-overlay">
      <div className="victory-card fade-in">
        <div className="victory-scanline" />
        <div className="victory-kicker">Village Loop Complete</div>
        <div className="victory-headline">
          The town now reads as a live X Layer testnet economy.
        </div>
        <div className="victory-summary">
          {proofs.length} Proofs Minted · {gdp.toFixed(1)} GDP · {(taxBps / 100).toFixed(2)}% Tax · {treasury.toFixed(3)} OKB Vault · {txCount} TXs
        </div>
        <div className="victory-chip-row">
          <span className="victory-chip">Treasury {treasury.toFixed(3)} OKB</span>
          <span className="victory-chip">Tax {(taxBps / 100).toFixed(2)}%</span>
          <span className="victory-chip">Transactions {txCount}</span>
          {freshestProof ? <span className="victory-chip">Latest {proofToneLabel(freshestProof)}</span> : null}
        </div>

        <div className="victory-proof-grid">
          {proofs.map((proof) => (
            <article key={proof.id} className="victory-proof-card">
              <div>
                <div className="victory-proof-kind">
                  {proofToneLabel(proof)}
                </div>
                <div className="victory-proof-title">{proof.title}</div>
                <div className="victory-proof-body">{proof.body}</div>
                {proof.executionLabel ? (
                  <div className="victory-proof-body">{proof.executionLabel}</div>
                ) : null}
              </div>
              {proof.explorerUrl ? (
                <a href={proof.explorerUrl} target="_blank" rel="noreferrer" className="px-link">
                  <ArrowUpRight size={10} /> OKLink
                </a>
              ) : null}
            </article>
          ))}
        </div>

        <div className="victory-actions">
          <button type="button" className="px-btn ghost" onClick={onClose}>
            Keep Touring
          </button>
          <button type="button" className="px-btn gold" onClick={onReset}>
            <RefreshCw size={12} /> Replay From Scratch
          </button>
          {ledgerUrl ? (
            <a href={ledgerUrl} target="_blank" rel="noreferrer" className="px-btn ghost">
              <ArrowUpRight size={12} /> View Full Ledger
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
