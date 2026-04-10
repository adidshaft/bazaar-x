import type { ProofArtifact } from "@/game/core/live-types";

type ProofRealityOverlayProps = {
  proof: ProofArtifact;
  onClose: () => void;
};

export function ProofRealityOverlay({ proof, onClose }: ProofRealityOverlayProps) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-[75] flex items-center justify-center bg-[rgba(4,10,18,0.74)] px-4 backdrop-blur-md">
      <div className="w-full max-w-[760px] rounded-[28px] border border-[rgba(125,230,255,0.18)] bg-[linear-gradient(180deg,rgba(5,12,18,0.98),rgba(8,16,24,0.98))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.48)] sm:p-7">
        <div className="flex flex-col gap-4 border-b border-[rgba(125,230,255,0.14)] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="arcade-face text-[0.34rem] tracking-[0.2em] text-[#7de6ff]">
              Reality Pulse
            </div>
            <h2 className="mt-3 font-[var(--font-display)] text-[2rem] leading-none text-white">
              {proof.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#a4c0d1]">
              Verified proof manifested as a Veritas Scroll. The world reacted, and this ledger line is
              now anchored to the chain.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="pixel-button self-start bg-[#eef5fb] px-4 py-2 text-[#101822]"
          >
            <span className="arcade-face text-[0.38rem]">Close Overlay</span>
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <section className="rounded-[22px] border border-[rgba(125,230,255,0.16)] bg-[rgba(255,255,255,0.03)] p-5">
            <div className="arcade-face text-[0.34rem] tracking-[0.2em] text-[#7de6ff]">
              Statement
            </div>
            <p className="mt-3 text-base leading-8 text-[#f1fbff]">{proof.statement}</p>
          </section>

          <section className="rounded-[22px] border border-[rgba(125,230,255,0.16)] bg-[rgba(255,255,255,0.03)] p-5">
            <div className="arcade-face text-[0.34rem] tracking-[0.2em] text-[#7de6ff]">
              Ledger Notes
            </div>
            <p className="mt-3 text-sm leading-7 text-[#a4c0d1]">{proof.body}</p>
            <div className="mt-4 grid gap-2 text-sm text-[#d2e7f2]">
              <div><strong>District:</strong> {proof.districtId}</div>
              <div><strong>Label:</strong> {proof.label}</div>
            </div>
          </section>

          {proof.explorerUrl ? (
            <a
              href={proof.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="pixel-button inline-flex w-full items-center justify-center bg-[linear-gradient(135deg,#7de6ff,#d6f7ff)] px-4 py-3 text-[#0a131a]"
            >
              <span className="arcade-face text-[0.38rem]">Open Explorer Link</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
