export type DialogueSet = {
  pre: string[];
  post: string[];
};

export const dialogueSets: Record<string, DialogueSet> = {
  keeper: {
    pre: [
      "Your wallet is the key. The village turns connection into citizenship.",
      "The village only makes sense when it wakes in order, so start at the keep.",
      "The keep is the first stop in the canonical economy loop.",
    ],
    post: [
      "Citizenship is set and the roster is awake.",
      "Go to Market Row and open the first shop so the village can feel demand.",
    ],
  },
  shopkeeper: {
    pre: [
      "A shop is the village's demand signal, not just a storefront.",
      "Open it and the rest of the economy can justify supply, labor, and tax.",
      "Use the board and the market row wakes on the current testnet path.",
    ],
    post: [
      "Market Row is awake.",
      "Supplier Lane can now read a real order instead of a rumor.",
    ],
  },
  supplier: {
    pre: [
      "I only move routes when a shop exists to pull against them.",
      "That keeps the village honest: demand first, fulfillment second.",
      "Bring me the order and I will stage the labor.",
    ],
    post: [
      "The route is live.",
      "Now the worker yard can show how payment and tax flow through the village.",
    ],
  },
  worker: {
    pre: [
      "Labor only matters when the payment is visible.",
      "After governance changes, replay the same work and compare the tax result.",
    ],
    post: [
      "The labor route is hot.",
      "That replay is the proof that rule changes alter the economy.",
    ],
  },
  treasurer: {
    pre: [
      "The vault trusts receipts, not stories.",
      "Bring me a confirmed tax notice and I will read the reserve board.",
    ],
    post: [
      "The reserve is live.",
      "Reinvestment closes the loop and sends value back into the village.",
    ],
  },
  governor: {
    pre: [
      "A vote matters only if the next payment behaves differently.",
      "Propose it, vote it, then execute it before replaying the route.",
    ],
    post: [
      "The new rule is in place.",
      "Replaying the payment will show whether the village really changed.",
    ],
  },
};
