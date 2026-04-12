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
        "OnchainOS verifies each identity before the first action clears.",
        "Head to the forge — open demand, and the Uniswap pool wakes up.",
      ],
    },
  ],
  shopkeeper: [
    {
      id: "shop-open",
      speaker: "Forge Master",
      lines: [
        "Opening this shop sends a demand signal to the Uniswap X Layer pool.",
        "One shop starts the whole economy — supply, labor, and tax flow next.",
        "Submit 0.001 OKB through the contract dais and watch Market Row light up.",
      ],
    },
  ],
  supplier: [
    {
      id: "supplier-route",
      speaker: "Supply Coil",
      lines: [
        "OnchainOS confirms the route is live before I dispatch any worker.",
        "No oracle reading, no payment — the village doesn't trust blind routes.",
        "List the service, then I'll swap through Uniswap to pay the worker.",
      ],
    },
  ],
  worker: [
    {
      id: "worker-proof",
      speaker: "Node Pilot",
      lines: [
        "Labor means nothing until it settles onchain.",
        "The hire-service call went through Uniswap X Layer — I can prove it.",
        "Check the Proof panel. The swap receipt is your labor confirmation.",
      ],
    },
  ],
  treasurer: [
    {
      id: "treasury-proof",
      speaker: "Reserve Steward",
      lines: [
        "The OnchainOS oracle fed the treasury balance — every glow you see is verified.",
        "Tax is not a hidden number. When payment confirms, this vault brightens.",
        "Approve the reinvestment notice and the oracle will log the final state.",
      ],
    },
  ],
  governor: [
    {
      id: "governor-proof",
      speaker: "Council Steward",
      lines: [
        "A rule change is only real when the next payment behaves differently.",
        "OnchainOS governance oracle tracks each proposal, vote, and execution.",
        "Propose, vote, execute — then replay the labor route to prove the tax changed.",
      ],
    },
  ],
};
