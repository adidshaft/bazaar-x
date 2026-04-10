import type {
  DistrictId,
  LiveDashboardStatus,
  ProofArtifact,
  QuestActionId,
} from "@/game/core/live-types";

const actionDistrictMap: Partial<Record<QuestActionId, DistrictId>> = {
  "deploy-bazaar": "village-gate",
  "open-shop": "market-row",
  "open-depot": "supplier-lane",
  "open-guild": "worker-yard",
  "hire-worker": "worker-yard",
  "hire-supplier": "supplier-lane",
  "propose-rule-change": "council-hall",
  "vote-rule-change": "council-hall",
  "execute-rule-change": "council-hall",
  "replay-worker-payment": "worker-yard",
  "treasury-reinvest": "treasury-vault",
};

function summarizeStep(step: NonNullable<LiveDashboardStatus["liveDashboard"]["runtime"]>["steps"][number]) {
  if (step.label.toLowerCase().includes("proposal") || step.label.toLowerCase().includes("execute")) {
    return "decree";
  }

  if (step.label.toLowerCase().includes("treasury")) {
    return "unlock";
  }

  return "receipt";
}

export function buildProofArtifacts(status: LiveDashboardStatus | null): ProofArtifact[] {
  const runtime = status?.liveDashboard.runtime;
  if (!runtime) {
    return [];
  }

  return runtime.steps
    .filter((step) => step.status === "success")
    .map((step) => {
      const actionId = Object.entries({
        "deploy-bazaar": ["deploy"],
        "open-shop": ["shop-create"],
        "open-depot": ["supplier-shop", "supplier-service"],
        "open-guild": ["worker-shop", "worker-service"],
        "hire-worker": ["supplier-hires-worker"],
        "hire-supplier": ["shop-hires-supplier"],
        "propose-rule-change": ["proposal"],
        "vote-rule-change": ["vote-shop", "vote-supplier", "vote-worker"],
        "execute-rule-change": ["execute"],
        "replay-worker-payment": ["post-governance-hire"],
        "treasury-reinvest": ["treasury-reinvests"],
      }).find(([, keys]) => keys.includes(step.key))?.[0] as QuestActionId | undefined;

      const districtId = actionDistrictMap[actionId ?? "deploy-bazaar"] ?? "village-gate";

      return {
        id: step.txHash ?? `${step.key}:${step.completedAt ?? step.startedAt}`,
        kind: summarizeStep(step) as ProofArtifact["kind"],
        title: step.label,
        body: step.detail ?? "Confirmed on X Layer.",
        label: step.meta?.taxOkb ? `Tax ${step.meta.taxOkb} OKB` : step.txHash ? "Confirmed" : "Recovered",
        districtId,
        actionId,
        stepKey: step.key,
        txHash: step.txHash,
        explorerUrl: step.explorerUrl,
        createdAt: step.completedAt ?? step.startedAt,
      };
    });
}

