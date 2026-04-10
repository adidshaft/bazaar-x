import type { AISkillDefinition } from "@/game/core/live-types";

type SkillGrimoireProps = {
  skills: AISkillDefinition[];
  unlockedSkillIds: string[];
  activeSkillId: string | null;
  unlockPendingSkillId: string | null;
  delegatePendingSkillId: string | null;
  onUnlock: (skillId: string) => void;
  onSlot: (skillId: string) => void;
  onDelegateTrade: (skillId: string) => void;
  onClose: () => void;
};

function formatPercent(value: number) {
  return `${Math.round((value - 1) * 100)}%`;
}

export function SkillGrimoire({
  skills,
  unlockedSkillIds,
  activeSkillId,
  unlockPendingSkillId,
  delegatePendingSkillId,
  onUnlock,
  onSlot,
  onDelegateTrade,
  onClose,
}: SkillGrimoireProps) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-[70] overflow-y-auto bg-[rgba(4,8,14,0.76)] px-4 py-5 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[1040px] rounded-[28px] border border-[rgba(125,230,255,0.18)] bg-[linear-gradient(180deg,rgba(8,16,24,0.97),rgba(5,10,18,0.98))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-7">
        <div className="mb-5 flex flex-col gap-4 border-b border-[rgba(125,230,255,0.12)] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="arcade-face text-[0.36rem] tracking-[0.22em] text-[#7de6ff]">
              Council Chamber
            </div>
            <h2 className="mt-3 font-[var(--font-display)] text-[2rem] leading-none text-white sm:text-[2.8rem]">
              AI Skill Grimoire
            </h2>
            <p className="mt-3 max-w-[44rem] text-sm leading-7 text-[#9db6c7] sm:text-base">
              Slot one sovereign skill to reshape your aura, unlock new economic protocols, and route
              agentic actions through the council altar without cluttering the playfield.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="pixel-button self-start bg-[#ecf5fb] px-4 py-2 text-[#101822]"
          >
            <span className="arcade-face text-[0.38rem]">Return To Hall</span>
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="grid gap-4">
            {skills.map((skill) => {
              const unlocked = unlockedSkillIds.includes(skill.skill_id);
              const active = activeSkillId === skill.skill_id;

              return (
                <article
                  key={skill.skill_id}
                  className={`rounded-[24px] border p-4 ${
                    active
                      ? "border-[rgba(125,230,255,0.38)] bg-[rgba(125,230,255,0.08)]"
                      : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="arcade-face text-[0.34rem] tracking-[0.2em] text-[#7de6ff]">
                        {skill.visual_metadata.rarity}
                      </div>
                      <h3 className="mt-2 font-[var(--font-display)] text-[1.55rem] leading-none text-white">
                        {skill.identity.name}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-[#a7bfd0]">
                        {skill.identity.description}
                      </p>
                    </div>

                    <div className="grid min-w-[12rem] gap-2 text-sm text-[#cde2ee]">
                      <div>
                        <span className="text-[#84abc0]">Aura</span>
                        <div>{skill.visual_metadata.sprite_aura}</div>
                      </div>
                      <div>
                        <span className="text-[#84abc0]">Protocol</span>
                        <div>{skill.execution.protocol}</div>
                      </div>
                      <div>
                        <span className="text-[#84abc0]">Delegation</span>
                        <div>{skill.execution.delegation_protocol ?? "local"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[18px] border border-[rgba(125,230,255,0.12)] bg-[rgba(5,10,16,0.42)] px-4 py-3">
                      <div className="arcade-face text-[0.32rem] tracking-[0.18em] text-[#7de6ff]">
                        Efficiency
                      </div>
                      <div className="mt-2 text-lg text-white">
                        {formatPercent(skill.interop_stats.efficiency_bonus)}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-[rgba(125,230,255,0.12)] bg-[rgba(5,10,16,0.42)] px-4 py-3">
                      <div className="arcade-face text-[0.32rem] tracking-[0.18em] text-[#7de6ff]">
                        Gas Trim
                      </div>
                      <div className="mt-2 text-lg text-white">
                        {skill.interop_stats.gas_reduction_bps} bps
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-[rgba(125,230,255,0.12)] bg-[rgba(5,10,16,0.42)] px-4 py-3">
                      <div className="arcade-face text-[0.32rem] tracking-[0.18em] text-[#7de6ff]">
                        Unlock
                      </div>
                      <div className="mt-2 text-lg text-white">
                        {skill.execution.unlock_price_okb ?? "0.000"} OKB
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {skill.interop_stats.compatible_tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[rgba(125,230,255,0.15)] px-3 py-1 text-[0.72rem] text-[#cbe5f2]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {unlocked ? (
                      <button
                        type="button"
                        onClick={() => onSlot(skill.skill_id)}
                        className={`pixel-button px-4 py-3 ${
                          active
                            ? "bg-[linear-gradient(135deg,#7de6ff,#8ff0d5)] text-[#0a131a]"
                            : "bg-[rgba(255,255,255,0.06)] text-[#f1fbff]"
                        }`}
                      >
                        <span className="arcade-face text-[0.38rem]">
                          {active ? "Active In Aura" : "Slot Skill"}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUnlock(skill.skill_id)}
                        disabled={unlockPendingSkillId === skill.skill_id}
                        className="pixel-button bg-[linear-gradient(135deg,#9de6ff,#d4f8ff)] px-4 py-3 text-[#08111a]"
                      >
                        <span className="arcade-face text-[0.38rem]">
                          {unlockPendingSkillId === skill.skill_id
                            ? "Processing X402"
                            : "Unlock Skill"}
                        </span>
                      </button>
                    )}

                    {unlocked && skill.execution.delegated_action === "Trade" ? (
                      <button
                        type="button"
                        onClick={() => onDelegateTrade(skill.skill_id)}
                        disabled={delegatePendingSkillId === skill.skill_id}
                        className="pixel-button bg-[rgba(255,255,255,0.06)] px-4 py-3 text-[#f1fbff]"
                      >
                        <span className="arcade-face text-[0.38rem]">
                          {delegatePendingSkillId === skill.skill_id
                            ? "Routing Trade"
                            : "Delegate Trade"}
                        </span>
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="grid gap-4">
            <section className="rounded-[24px] border border-[rgba(125,230,255,0.14)] bg-[rgba(255,255,255,0.03)] p-5">
              <div className="arcade-face text-[0.34rem] tracking-[0.2em] text-[#7de6ff]">
                Active Slot
              </div>
              <div className="mt-3 text-[1.5rem] leading-none text-white">
                {skills.find((skill) => skill.skill_id === activeSkillId)?.identity.name ?? "No skill slotted"}
              </div>
              <p className="mt-3 text-sm leading-7 text-[#9db6c7]">
                The active slot updates the player aura in Phaser immediately and unlocks any agentic
                delegation protocol bound to that skill.
              </p>
            </section>

            <section className="rounded-[24px] border border-[rgba(125,230,255,0.14)] bg-[rgba(255,255,255,0.03)] p-5">
              <div className="arcade-face text-[0.34rem] tracking-[0.2em] text-[#7de6ff]">
                Protocol Stack
              </div>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-[#d6e9f3]">
                <div className="rounded-[18px] border border-[rgba(255,255,255,0.08)] px-4 py-3">
                  `okx-agentic-wallet` routes the trade intent to the matching agent NPC when the
                  Logistics skill is active.
                </div>
                <div className="rounded-[18px] border border-[rgba(255,255,255,0.08)] px-4 py-3">
                  `okx-x402-payment` handles unlocks and feeds the success flash back into the live
                  scene.
                </div>
                <div className="rounded-[18px] border border-[rgba(255,255,255,0.08)] px-4 py-3">
                  Aura metadata stays interoperable with the skill JSON so React and Phaser share one
                  visual contract.
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
