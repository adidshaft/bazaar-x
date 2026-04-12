import type { QuestActionId } from "@/game/core/live-types";

export type ActionControlMode = "manual" | "agent";
export type ActionExecutionKind = "player-wallet" | "x402-agent" | "system";
export type ManualActionSupport = "wallet" | "recoverable" | "agent_required";

type ActionControlPolicy = {
  manualSupport: ManualActionSupport;
  manualSummary: string;
  agentSummary: string;
  agentPaymentOkb?: string;
};

export const ACTION_CONTROL_POLICY: Record<QuestActionId, ActionControlPolicy> = {
  "initialize-town": {
    manualSupport: "recoverable",
    manualSummary: "This syncs village state locally and does not need a signed transaction.",
    agentSummary: "Autonomous agents are not needed for the bootstrap sync.",
  },
  "deploy-bazaar": {
    manualSupport: "recoverable",
    manualSummary:
      "The shared BazaarX contract is already live on X Layer testnet. Deploying a new personal village is handled separately.",
    agentSummary: "Replay the shared live deployment proof through the district agents.",
    agentPaymentOkb: "0.024",
  },
  "open-shop": {
    manualSupport: "wallet",
    manualSummary: "Your wallet signs the shop creation directly on X Layer.",
    agentSummary: "Let the market steward agent open the district on your behalf.",
    agentPaymentOkb: "0.006",
  },
  "open-depot": {
    manualSupport: "wallet",
    manualSummary: "Your wallet creates the depot and lists the supplier service in supplier-credit tokens.",
    agentSummary: "Delegate the supplier lane setup to an autonomous village agent.",
    agentPaymentOkb: "0.010",
  },
  "open-guild": {
    manualSupport: "wallet",
    manualSummary: "Your wallet creates the guild and lists the worker service directly.",
    agentSummary: "Delegate the guild bootstrap to an autonomous village agent.",
    agentPaymentOkb: "0.010",
  },
  "hire-worker": {
    manualSupport: "wallet",
    manualSummary: "Your wallet can hire a worker service directly from the live contract.",
    agentSummary: "Pay x402 to let the supplier agent route the worker hire for you.",
    agentPaymentOkb: "0.007",
  },
  "hire-supplier": {
    manualSupport: "agent_required",
    manualSummary:
      "This live supplier route runs through the agent rail in Phase 2 so the Uniswap pool swap, approval, and Bazaar settlement stay in sync.",
    agentSummary:
      "Authorize the shop agent through the x402 challenge, then let it run the live Uniswap-backed supplier settlement for you.",
    agentPaymentOkb: "0.008",
  },
  "propose-rule-change": {
    manualSupport: "wallet",
    manualSummary: "Your wallet can submit the rule proposal directly onchain.",
    agentSummary: "Let the governor agent author and submit the proposal through x402.",
    agentPaymentOkb: "0.009",
  },
  "vote-rule-change": {
    manualSupport: "agent_required",
    manualSummary:
      "The shared village quorum needs multiple registered district agents, so the full vote step stays agent-run here.",
    agentSummary: "Pay x402 to let the village voting agents satisfy quorum on the shared contract.",
    agentPaymentOkb: "0.005",
  },
  "execute-rule-change": {
    manualSupport: "agent_required",
    manualSummary:
      "Executing the shared governance update depends on the autonomous vote set reaching quorum first.",
    agentSummary: "Pay x402 to let the governor agent finalize the rule update once quorum is met.",
    agentPaymentOkb: "0.006",
  },
  "replay-worker-payment": {
    manualSupport: "wallet",
    manualSummary: "Your wallet can replay the post-governance worker payment directly.",
    agentSummary: "Pay x402 to let the supplier agent repeat the worker payment for you.",
    agentPaymentOkb: "0.007",
  },
  "treasury-reinvest": {
    manualSupport: "agent_required",
    manualSummary:
      "The shared treasury uses a dedicated wallet, so reinvestment remains a treasury-agent action unless you deploy a personal village.",
    agentSummary: "Pay x402 to let the treasury agent dispatch the reinvestment transfer.",
    agentPaymentOkb: "0.004",
  },
};

export function getActionControlPolicy(actionId: QuestActionId) {
  return ACTION_CONTROL_POLICY[actionId];
}
