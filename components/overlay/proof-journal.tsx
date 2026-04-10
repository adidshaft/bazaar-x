import type { ProofArtifact } from "@/game/core/live-types";

type QuestRailItem = {
  id: string;
  title: string;
  objectiveText: string;
  state: string;
};

type ProofJournalProps = {
  open: boolean;
  onToggle: () => void;
  proofs: ProofArtifact[];
  rail: QuestRailItem[];
};

export function ProofJournal({ open, onToggle, proofs, rail }: ProofJournalProps) {
  return (
    <div
      className={`pointer-events-auto absolute right-3 top-[11.5rem] z-30 w-[min(26rem,calc(100vw-1.5rem))] transition duration-200 md:right-5 ${
        open ? "translate-x-0 opacity-100" : "translate-x-[110%] opacity-0 md:translate-x-0 md:opacity-100"
      }`}
    >
      <div className="overlay-card max-h-[calc(100vh-13rem)] overflow-y-auto p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="overlay-kicker">Quest Rail</div>
            <h3 className="overlay-title mt-1 text-lg text-[#fff3d3]">Proof Journal</h3>
          </div>
          <button type="button" onClick={onToggle} className="hud-chip md:hidden">
            {open ? "Hide" : "Show"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {rail.map((step) => (
            <div key={step.id} className="journal-step">
              <div className="flex items-center justify-between gap-3">
                <strong>{step.title}</strong>
                <span className={`quest-pill quest-pill-${step.state}`}>{step.state}</span>
              </div>
              <p>{step.objectiveText}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-white/10 pt-4">
          <div className="overlay-kicker">Live Receipts</div>
          <div className="mt-3 space-y-2">
            {proofs.length ? (
              proofs.map((proof) => (
                <a
                  key={proof.id}
                  href={proof.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="proof-card"
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong>{proof.title}</strong>
                    <span>{proof.kind}</span>
                  </div>
                  <p>{proof.body}</p>
                  <span>{proof.label}</span>
                </a>
              ))
            ) : (
              <div className="journal-step">
                <strong>No receipts yet</strong>
                <p>Walk to the keeper, open the forge, and the journal will start filling with real proof.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

