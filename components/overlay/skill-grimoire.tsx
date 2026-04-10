import { useState } from "react";
import type { AISkillDefinition } from "@/game/core/live-types";
import { bazaarEventBridge } from "@/game/core/event-bridge";
import { transactionService } from "@/game/systems/transaction-service";

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
  const [commandDrafts, setCommandDrafts] = useState<Record<string, string>>({});
  const [exportPendingSkillId, setExportPendingSkillId] = useState<string | null>(null);
  const [commandPendingSkillId, setCommandPendingSkillId] = useState<string | null>(null);
  const [exportedSkillId, setExportedSkillId] = useState<string | null>(null);

  async function handleExport(skill: AISkillDefinition) {
    setExportPendingSkillId(skill.skill_id);

    try {
      const payload = await transactionService.exportSkillManifest(skill.skill_id);
      const blob = new Blob([JSON.stringify(payload.manifestJsonLd, null, 2)], {
        type: "application/ld+json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${skill.skill_id}.jsonld`;
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportedSkillId(skill.skill_id);
      bazaarEventBridge.emit("toast:show", {
        id: `skill:export:${skill.skill_id}`,
        title: "Sovereign Export Complete",
        body: `${skill.identity.name} manifest signed and downloaded as JSON-LD.`,
        tone: "success",
      });
    } catch (error) {
      bazaarEventBridge.emit("toast:show", {
        id: `skill:export:error:${skill.skill_id}`,
        title: "Export Failed",
        body: error instanceof Error ? error.message : "Unable to export the skill manifest.",
        tone: "skill",
      });
    } finally {
      setExportPendingSkillId(null);
    }
  }

  async function handleDelegateCommand(skill: AISkillDefinition) {
    const command = commandDrafts[skill.skill_id]?.trim();
    if (!command) {
      onDelegateTrade(skill.skill_id);
      return;
    }

    setCommandPendingSkillId(skill.skill_id);

    try {
      const payload = await transactionService.delegateTradeSkill(skill.skill_id, command);
      bazaarEventBridge.emit("toast:show", {
        id: `skill:delegate:command:${skill.skill_id}`,
        title: "Agentic Command Routed",
        body: `"${command}" routed through ${payload.protocol} to ${payload.agentNpcId}.`,
        tone: "success",
      });
      setCommandDrafts((current) => ({ ...current, [skill.skill_id]: "" }));
    } catch (error) {
      bazaarEventBridge.emit("toast:show", {
        id: `skill:delegate:command:error:${skill.skill_id}`,
        title: "Command Routing Failed",
        body: error instanceof Error ? error.message : "Unable to route the natural-language command.",
        tone: "skill",
      });
    } finally {
      setCommandPendingSkillId(null);
    }
  }

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
                      <div className="flex flex-1 flex-col gap-2 sm:min-w-[18rem]">
                        <input
                          value={commandDrafts[skill.skill_id] ?? ""}
                          onChange={(event) =>
                            setCommandDrafts((current) => ({
                              ...current,
                              [skill.skill_id]: event.target.value,
                            }))
                          }
                          placeholder="Natural-language command, e.g. keep inventory above 50"
                          className="rounded-[16px] border border-[rgba(125,230,255,0.16)] bg-[rgba(3,8,14,0.48)] px-4 py-3 text-sm text-[#f1fbff] outline-none placeholder:text-[#6f8aa0]"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleDelegateCommand(skill)}
                            disabled={
                              delegatePendingSkillId === skill.skill_id ||
                              commandPendingSkillId === skill.skill_id
                            }
                            className="pixel-button bg-[rgba(255,255,255,0.06)] px-4 py-3 text-[#f1fbff]"
                          >
                            <span className="arcade-face text-[0.38rem]">
                              {commandPendingSkillId === skill.skill_id
                                ? "Routing Command"
                                : commandDrafts[skill.skill_id]?.trim()
                                  ? "Route Command"
                                  : delegatePendingSkillId === skill.skill_id
                                    ? "Routing Trade"
                                    : "Delegate Trade"}
                            </span>
                          </button>
                          {exportedSkillId === skill.skill_id ? (
                            <span className="self-center text-[0.72rem] text-[#9de6ff]">
                              JSON-LD exported
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleExport(skill)}
                      disabled={exportPendingSkillId === skill.skill_id}
                      className="pixel-button bg-[linear-gradient(135deg,#7de6ff,#d6f7ff)] px-4 py-3 text-[#08111a]"
                    >
                      <span className="arcade-face text-[0.38rem]">
                        {exportPendingSkillId === skill.skill_id
                          ? "Signing JSON-LD"
                          : "Export to X Layer"}
                      </span>
                    </button>
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
