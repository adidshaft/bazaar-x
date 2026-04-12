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
  if (step.meta?.proofKind === "payment" || step.key.startsWith("payment-")) {
    return "payment";
  }

  if (step.meta?.proofKind === "swap" || step.key === "supplier-route-swap") {
    return "swap";
  }

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
        "open-shop": ["payment-open-shop", "shop-create"],
        "open-depot": ["payment-open-depot", "supplier-shop", "supplier-service"],
        "open-guild": ["payment-open-guild", "worker-shop", "worker-service"],
        "hire-worker": ["payment-hire-worker", "supplier-hires-worker"],
        "hire-supplier": ["payment-hire-supplier", "supplier-route-swap", "shop-hires-supplier"],
        "propose-rule-change": ["payment-propose-rule-change", "proposal"],
        "vote-rule-change": ["payment-vote-rule-change", "vote-shop", "vote-supplier", "vote-worker"],
        "execute-rule-change": ["payment-execute-rule-change", "execute"],
        "replay-worker-payment": ["payment-replay-worker-payment", "post-governance-hire"],
        "treasury-reinvest": ["payment-treasury-reinvest", "treasury-reinvests"],
        "deploy-bazaar": ["deploy"],
      }).find(([, keys]) => keys.includes(step.key))?.[0] as QuestActionId | undefined;

      const districtId =
        step.key === "supplier-route-swap"
          ? "supplier-lane"
          : actionDistrictMap[actionId ?? "deploy-bazaar"] ?? "village-gate";
      const swapLabel =
        typeof step.meta?.amountOutToken === "string" && typeof step.meta?.tokenOut === "string"
          ? `${step.meta.amountOutToken} ${step.meta.tokenOut}`
          : "Swap confirmed";
      const taxLabel =
        typeof step.meta?.taxLabel === "string"
          ? step.meta.taxLabel
          : typeof step.meta?.paymentAmountLabel === "string"
            ? step.meta.paymentAmountLabel
          : typeof step.meta?.taxOkb === "string"
            ? `Tax ${step.meta.taxOkb} OKB`
            : step.txHash
              ? "Confirmed"
              : "Recovered";

      return {
        id: step.txHash ?? `${step.key}:${step.completedAt ?? step.startedAt}`,
        kind: summarizeStep(step) as ProofArtifact["kind"],
        title: step.label,
        body: step.detail ?? "Confirmed on X Layer.",
        statement: `${step.label}: ${step.detail ?? "Confirmed on X Layer."}`,
        label: summarizeStep(step) === "swap" ? swapLabel : taxLabel,
        districtId,
        actionId,
        stepKey: step.key,
        txHash: step.txHash,
        explorerUrl: step.explorerUrl,
        createdAt: step.completedAt ?? step.startedAt,
      };
    });
}

export class ProofListener {
  private seenProofIds = new Set<string>();
  private bootstrapped = false;

  consume(status: LiveDashboardStatus | null) {
    const nextProofs = buildProofArtifacts(status);
    if (!this.bootstrapped) {
      if (!status) {
        return {
          proofs: nextProofs,
          freshProofs: [] as ProofArtifact[],
        };
      }

      nextProofs.forEach((proof) => {
        this.seenProofIds.add(proof.id);
      });
      this.bootstrapped = true;
      return {
        proofs: nextProofs,
        freshProofs: [] as ProofArtifact[],
      };
    }

    const freshProofs = nextProofs.filter((proof) => {
      if (this.seenProofIds.has(proof.id)) {
        return false;
      }

      this.seenProofIds.add(proof.id);
      return Boolean(proof.txHash);
    });

    return {
      proofs: nextProofs,
      freshProofs,
    };
  }
}
