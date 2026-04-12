import type { ProofArtifact } from "@/game/core/live-types";

type ProofRealityOverlayProps = {
  proof: ProofArtifact;
  onClose: () => void;
};

export function ProofRealityOverlay({ proof, onClose }: ProofRealityOverlayProps) {
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center pb-8 p-4">
      {/* Full screen scrim for tap-to-dismiss */}
      <div className="absolute inset-0 bg-black/50 cursor-pointer" onClick={onClose} />
      
      <div className="border-[4px] border-black bg-[#2b55b3] shadow-[8px_8px_0_rgba(0,0,0,0.5)] w-full max-w-[760px] p-6 sm:p-7 relative z-10 pointer-events-auto">
        <div className="flex flex-col gap-4 border-b-4 border-black pb-4 sm:flex-row sm:items-start sm:justify-between mb-4 bg-blue-900/40 p-2">
          <div>
            <div className="arcade-face text-[0.4rem] tracking-[0.1em] text-[#fbbf24] uppercase">
              Reality Pulse
            </div>
            <div className="mt-3 flex flex-wrap gap-2 arcade-face text-[0.4rem] tracking-[0.1em] uppercase">
              <span className="border-2 border-black bg-black px-2 py-1 text-white">
                {proof.kind}
              </span>
              <span className="border-2 border-black bg-gray-400 px-2 py-1 text-black">
                {proof.districtId}
              </span>
            </div>
            <h2 className="mt-4 font-[var(--font-arcade)] text-xl leading-none text-white uppercase shadow-black drop-shadow-md">
              {proof.title}
            </h2>
            <p className="mt-3 font-[var(--font-pixel)] text-lg leading-7 text-gray-200">
              Verified proof manifested as a Veritas Scroll. The world reacted, and this ledger line is
              now anchored to the chain.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="pixel-button px-4 py-2"
          >
            <span className="arcade-face text-[0.38rem]">Close Overlay</span>
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <section className="border-4 border-black bg-blue-800 p-5">
            <div className="arcade-face text-[0.4rem] tracking-[0.1em] text-[#fbbf24] uppercase">
              Statement
            </div>
            <p className="mt-3 font-[var(--font-pixel)] text-xl leading-8 text-white">{proof.statement}</p>
          </section>

          <section className="border-4 border-black bg-blue-800 p-5">
            <div className="arcade-face text-[0.4rem] tracking-[0.1em] text-[#fbbf24] uppercase">
              Ledger Notes
            </div>
            <p className="mt-3 font-[var(--font-pixel)] text-xl leading-7 text-gray-200">{proof.body}</p>
            <div className="mt-4 grid gap-2 font-[var(--font-pixel)] text-lg text-gray-300">
              <div><strong>District:</strong> {proof.districtId}</div>
              <div><strong>Label:</strong> {proof.label}</div>
            </div>
          </section>

          {proof.explorerUrl ? (
            <a
              href={proof.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="action-button block text-center"
            >
              Open Explorer Link
            </a>
          ) : (
            <div className="border-4 border-black bg-gray-500 px-4 py-3 font-[var(--font-pixel)] text-lg leading-7 text-black">
              The proof is fully anchored, but no explorer link was provided for this record.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
