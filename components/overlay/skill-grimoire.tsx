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
  return `+${Math.round((value - 1) * 100)}%`;
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
      const blob    = new Blob([JSON.stringify(payload.manifestJsonLd, null, 2)], { type: "application/ld+json" });
      const url     = URL.createObjectURL(blob);
      const anchor  = document.createElement("a");
      anchor.href   = url; anchor.download = `${skill.skill_id}.jsonld`; anchor.rel = "noreferrer";
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      setExportedSkillId(skill.skill_id);
      bazaarEventBridge.emit("toast:show", { id: `skill:export:${skill.skill_id}`, title: "Manifest Exported", body: `${skill.identity.name} JSON-LD downloaded.`, tone: "success" });
    } catch (error) {
      bazaarEventBridge.emit("toast:show", { id: `skill:export:error:${skill.skill_id}`, title: "Export Failed", body: error instanceof Error ? error.message : "Unable to export.", tone: "skill" });
    } finally { setExportPendingSkillId(null); }
  }

  async function handleDelegateCommand(skill: AISkillDefinition) {
    const command = commandDrafts[skill.skill_id]?.trim();
    if (!command) { onDelegateTrade(skill.skill_id); return; }
    setCommandPendingSkillId(skill.skill_id);
    try {
      const payload = await transactionService.delegateTradeSkill(skill.skill_id, command);
      bazaarEventBridge.emit("toast:show", { id: `skill:delegate:command:${skill.skill_id}`, title: "Command Routed", body: `"${command}" → ${payload.agentNpcId}`, tone: "success" });
      setCommandDrafts((c) => ({ ...c, [skill.skill_id]: "" }));
    } catch (error) {
      bazaarEventBridge.emit("toast:show", { id: `skill:delegate:command:error:${skill.skill_id}`, title: "Routing Failed", body: error instanceof Error ? error.message : "Error.", tone: "skill" });
    } finally { setCommandPendingSkillId(null); }
  }

  const activeSkill = skills.find((s) => s.skill_id === activeSkillId);

  return (
    <div className="grimoire-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="grimoire-panel fade-in">

        {/* Header */}
        <div className="grimoire-header">
          <div>
            <div style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--text-green)", marginBottom: 4 }}>
              Council Chamber
            </div>
            <div className="grimoire-title">AI Skill Grimoire</div>
            <div className="grimoire-desc">
              Slot a sovereign skill to reshape your aura and route agentic actions through the altar.
            </div>
          </div>
          <button type="button" onClick={onClose} className="px-btn ghost" style={{ flexShrink: 0, alignSelf: "flex-start" }}>
            ✕ Return
          </button>
        </div>

        {/* Body: skill list + sidebar */}
        <div className="grimoire-body">

          {/* Skill list */}
          <div className="grimoire-list">
            {skills.map((skill) => {
              const unlocked = unlockedSkillIds.includes(skill.skill_id);
              const active   = activeSkillId === skill.skill_id;

              return (
                <div key={skill.skill_id} className={`grimoire-skill ${active ? "is-active" : ""}`}>
                  {/* Title row */}
                  <div className="grimoire-skill-head">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, letterSpacing: "0.14em", textTransform: "uppercase", color: active ? "var(--text-green)" : "var(--text-muted)", marginBottom: 3 }}>
                        {skill.visual_metadata.rarity}{active ? " · Active" : ""}
                      </div>
                      <div className="grimoire-skill-name">{skill.identity.name}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end", flexShrink: 0 }}>
                      <span style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        {skill.execution.protocol}
                      </span>
                      <span style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        {skill.visual_metadata.sprite_aura}
                      </span>
                    </div>
                  </div>

                  <div className="grimoire-skill-desc">{skill.identity.description}</div>

                  {/* Stats */}
                  <div className="grimoire-stats">
                    <div className="grimoire-stat">
                      <div className="grimoire-stat-label">Efficiency</div>
                      <div className="grimoire-stat-value" style={{ color: "var(--text-green)" }}>{formatPercent(skill.interop_stats.efficiency_bonus)}</div>
                    </div>
                    <div className="grimoire-stat">
                      <div className="grimoire-stat-label">Gas Trim</div>
                      <div className="grimoire-stat-value">{skill.interop_stats.gas_reduction_bps} bps</div>
                    </div>
                    <div className="grimoire-stat">
                      <div className="grimoire-stat-label">Unlock</div>
                      <div className="grimoire-stat-value" style={{ color: "var(--text-gold)" }}>{skill.execution.unlock_price_okb ?? "0.000"} OKB</div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="grimoire-tags">
                    {skill.interop_stats.compatible_tags.map((tag) => (
                      <span key={tag} className="grimoire-tag">{tag}</span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="grimoire-actions">
                    {unlocked ? (
                      <button type="button" onClick={() => onSlot(skill.skill_id)} className={`px-btn ${active ? "primary" : "ghost"}`}>
                        {active ? "✓ Active" : "Slot Skill"}
                      </button>
                    ) : (
                      <button type="button" onClick={() => onUnlock(skill.skill_id)} disabled={unlockPendingSkillId === skill.skill_id} className="px-btn ice">
                        {unlockPendingSkillId === skill.skill_id ? "Processing…" : "Unlock Skill"}
                      </button>
                    )}

                    {unlocked && skill.execution.delegated_action === "Trade" ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center", flex: 1 }}>
                        <input
                          value={commandDrafts[skill.skill_id] ?? ""}
                          onChange={(e) => setCommandDrafts((c) => ({ ...c, [skill.skill_id]: e.target.value }))}
                          placeholder="Natural-language command…"
                          className="grimoire-cmd-input"
                        />
                        <button
                          type="button"
                          onClick={() => handleDelegateCommand(skill)}
                          disabled={delegatePendingSkillId === skill.skill_id || commandPendingSkillId === skill.skill_id}
                          className="px-btn ghost"
                        >
                          {commandPendingSkillId === skill.skill_id ? "Routing…" : commandDrafts[skill.skill_id]?.trim() ? "Route" : "Delegate"}
                        </button>
                      </div>
                    ) : null}

                    <button type="button" onClick={() => handleExport(skill)} disabled={exportPendingSkillId === skill.skill_id} className="px-btn ghost">
                      {exportPendingSkillId === skill.skill_id ? "Signing…" : exportedSkillId === skill.skill_id ? "✓ Exported" : "Export"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar */}
          <div className="grimoire-sidebar">
            <div className="grimoire-sidebar-card">
              <div style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-green)", marginBottom: 4 }}>Active Slot</div>
              <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 15, fontWeight: 700, color: "var(--text-white)", lineHeight: 1.1 }}>
                {activeSkill?.identity.name ?? "No skill slotted"}
              </div>
              {activeSkill ? (
                <div style={{ fontFamily: "var(--font-pixel), monospace", fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>
                  {activeSkill.execution.protocol} · {activeSkill.visual_metadata.sprite_aura}
                </div>
              ) : (
                <div style={{ fontFamily: "var(--font-pixel), monospace", fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Slot a skill to activate its aura and unlock its control surface.
                </div>
              )}
            </div>

            <div className="grimoire-sidebar-card">
              <div style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Protocol Stack</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {["okx-agentic-wallet", "okx-x402-payment", "skill-json-ld"].map((proto) => (
                  <div key={proto} style={{ padding: "5px 7px", background: "var(--bg-raised)", border: "1px solid var(--border-dim)", fontFamily: "var(--font-arcade), monospace", fontSize: 7, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                    {proto}
                  </div>
                ))}
              </div>
            </div>

            <div className="grimoire-sidebar-card">
              <div style={{ fontFamily: "var(--font-arcade), monospace", fontSize: 7, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Stats</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-arcade), monospace", fontSize: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Unlocked</span>
                  <span style={{ color: "var(--text-green)" }}>{unlockedSkillIds.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-arcade), monospace", fontSize: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Available</span>
                  <span style={{ color: "var(--text-primary)" }}>{skills.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
