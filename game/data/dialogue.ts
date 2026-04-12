export type DialogueSet = {
  pre: string[];
  post: string[];
};

export const dialogueSets: Record<string, DialogueSet> = {
  keeper: {
    pre: [
      "Wallet light recognized. This village keys itself to your X Layer address.",
      "OnchainOS verifies each identity before the first action clears.",
      "Head to the keep and wake the roster before anything else.",
    ],
    post: [
      "The roster is awake. The funded agents are ready to move value.",
      "Head to Bazaar Forge. The first demand signal is waiting on the board.",
    ],
  },
  shopkeeper: {
    pre: [
      "Opening this shop sends a demand signal to the Uniswap X Layer pool.",
      "One shop starts the whole economy: supply, labor, and tax flow.",
      "Submit 0.001 OKB through the contract board and Market Row lights up.",
    ],
    post: [
      "The forge is awake. Supplier Lane is already watching the pool.",
      "Take the next order to Supply Coil and complete the first loop.",
    ],
  },
  supplier: {
    pre: [
      "OnchainOS confirms the route is live before I dispatch any worker.",
      "No oracle reading, no payment. The village does not trust blind routes.",
      "List the service and I will route the next hire.",
    ],
    post: [
      "The service board is live. Labor can move and treasury can glow.",
      "Come back when you are ready to pay the worker or route the supplier swap.",
    ],
  },
  worker: {
    pre: [
      "Labor means nothing until it settles onchain.",
      "Wake the yard and I will make the first payment leg visible.",
    ],
    post: [
      "The route is hot. Every confirmed hire leaves a proof trail.",
      "Replay the labor payment after governance and compare the tax outcome.",
    ],
  },
  treasurer: {
    pre: [
      "The vault is quiet until the first loop pushes tax inside.",
      "Bring me a confirmed treasury notice and I will verify the reserve state.",
    ],
    post: [
      "The OnchainOS oracle has the balance. The reserve notice is ready.",
      "Approve the reinvestment and the village loop will close cleanly.",
    ],
  },
  governor: {
    pre: [
      "A rule change is only real when the next payment behaves differently.",
      "Propose, vote, and execute the decree before replaying the labor route.",
    ],
    post: [
      "The covenant moved the tax. Now prove it with one more payment.",
      "The village only trusts governance when the treasury math changes onchain.",
    ],
  },
};
