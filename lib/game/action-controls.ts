import type { QuestActionId } from "@/game/core/live-types";

export type ActionControlMode = "manual" | "agent";
export type ActionExecutionKind = "player-wallet" | "paid-agent" | "system";
export type ManualActionSupport = "wallet" | "recoverable" | "agent_required";

type ActionControlPolicy = {
  manualSupport: ManualActionSupport;
  manualSummary: string;
  agentSummary: string;
  agentPaymentOkb?: string;
  agentPaymentAssetSymbol?: string;
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
    agentSummary:
      "Settle the delegation receipt, then let the district agents replay the shared live deployment proof. Ops keeps the execution path honest.",
    agentPaymentOkb: "0.024",
    agentPaymentAssetSymbol: "BXC",
  },
  "open-shop": {
    manualSupport: "wallet",
    manualSummary: "Your wallet signs the shop creation directly on X Layer.",
    agentSummary:
      "Settle the delegation receipt so the market steward can open the district on your behalf while Ops reports the actual autonomous path.",
    agentPaymentOkb: "0.006",
    agentPaymentAssetSymbol: "BXC",
  },
  "open-depot": {
    manualSupport: "wallet",
    manualSummary: "Your wallet creates the depot and lists the supplier service in supplier-credit tokens.",
    agentSummary:
      "Settle the delegation receipt so the supplier lane agent can publish the depot setup for you while Ops labels the real executor.",
    agentPaymentOkb: "0.010",
    agentPaymentAssetSymbol: "BXC",
  },
  "open-guild": {
    manualSupport: "wallet",
    manualSummary: "Your wallet creates the guild and lists the worker service directly.",
    agentSummary:
      "Settle the delegation receipt so the guild agent can bootstrap worker labor for you while the runtime reports the real executor.",
    agentPaymentOkb: "0.010",
    agentPaymentAssetSymbol: "BXC",
  },
  "hire-worker": {
    manualSupport: "wallet",
    manualSummary: "Your wallet can hire a worker service directly from the live contract.",
    agentSummary:
      "Pay the x402 delegation so the supplier agent can route the worker hire for you. Ops will say whether that run used OnchainOS or the manifest fallback.",
    agentPaymentOkb: "0.007",
    agentPaymentAssetSymbol: "BXC",
  },
  "hire-supplier": {
    manualSupport: "agent_required",
    manualSummary:
      "This live supplier route runs through the agent rail in Phase 2 so the Uniswap pool swap, approval, and Bazaar settlement stay in sync.",
    agentSummary:
      "Authorize the paid x402 delegation, then let the shop agent run the live Uniswap-backed supplier settlement while the runtime reports the actual executor.",
    agentPaymentOkb: "0.008",
    agentPaymentAssetSymbol: "BXC",
  },
  "propose-rule-change": {
    manualSupport: "wallet",
    manualSummary: "Your wallet can submit the rule proposal directly onchain.",
    agentSummary:
      "Settle the paid x402 delegation so the governor agent can author and submit the proposal with the execution path labeled in Ops.",
    agentPaymentOkb: "0.009",
    agentPaymentAssetSymbol: "BXC",
  },
  "vote-rule-change": {
    manualSupport: "agent_required",
    manualSummary:
      "The shared village quorum needs multiple registered district agents, so the full vote step stays agent-run here.",
    agentSummary:
      "Pay the x402 delegation so the village voting agents can satisfy quorum on the shared contract while the runtime reports the actual autonomous executor.",
    agentPaymentOkb: "0.005",
    agentPaymentAssetSymbol: "BXC",
  },
  "execute-rule-change": {
    manualSupport: "agent_required",
    manualSummary:
      "Executing the shared governance update depends on the autonomous vote set reaching quorum first.",
    agentSummary:
      "Pay the x402 delegation so the governor agent can finalize the rule update once quorum is met. Ops keeps the execution mode truthful.",
    agentPaymentOkb: "0.006",
    agentPaymentAssetSymbol: "BXC",
  },
  "replay-worker-payment": {
    manualSupport: "wallet",
    manualSummary: "Your wallet can replay the post-governance worker payment directly.",
    agentSummary:
      "Pay the x402 delegation so the supplier agent can repeat the worker payment for you while the runtime labels the actual autonomous path.",
    agentPaymentOkb: "0.007",
    agentPaymentAssetSymbol: "BXC",
  },
  "treasury-reinvest": {
    manualSupport: "agent_required",
    manualSummary:
      "The shared treasury uses a dedicated wallet, so reinvestment remains a treasury-agent action unless you deploy a personal village.",
    agentSummary:
      "Pay the x402 delegation so the treasury agent can dispatch the reinvestment transfer while Ops reports the real execution path.",
    agentPaymentOkb: "0.004",
    agentPaymentAssetSymbol: "BXC",
  },
};

export function getActionControlPolicy(actionId: QuestActionId) {
  return ACTION_CONTROL_POLICY[actionId];
}
