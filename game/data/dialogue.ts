export type DialogueEntry = {
  id: string;
  speaker: string;
  lines: string[];
};

export const dialogueEntries: Record<string, DialogueEntry[]> = {
  keeper: [
    {
      id: "keeper-intro",
      speaker: "Village Keeper",
      lines: [
        "Wallet light recognized. This village keys itself to your X Layer address.",
        "Start at the forge. Open demand, then watch the town move real value.",
      ],
    },
  ],
  shopkeeper: [
    {
      id: "shop-open",
      speaker: "Forge Master",
      lines: [
        "One shop starts the whole economy.",
        "Open it here, and the supplier lane wakes up.",
      ],
    },
  ],
  supplier: [
    {
      id: "supplier-route",
      speaker: "Supply Coil",
      lines: [
        "List the route, then I can pay the worker for live fulfillment.",
        "When the payment lands, the treasury siphon will glow.",
      ],
    },
  ],
  worker: [
    {
      id: "worker-proof",
      speaker: "Node Pilot",
      lines: [
        "Labor means nothing until it settles.",
        "Hire the service and watch the village react to the receipt.",
      ],
    },
  ],
  treasurer: [
    {
      id: "treasury-proof",
      speaker: "Treasurer",
      lines: [
        "Tax is not a hidden number here.",
        "When the payment confirms, this vault should brighten in front of you.",
      ],
    },
  ],
  governor: [
    {
      id: "governor-proof",
      speaker: "Council Steward",
      lines: [
        "A rule change is only real when the next payment behaves differently.",
        "Propose, vote, execute, then replay the labor route.",
      ],
    },
  ],
};

