export const sfxCueDefinitions = [
  { id: "footstep", label: "Footstep", useCase: "player movement" },
  { id: "ui-confirm", label: "UI confirm", useCase: "accepting dialogue or quest actions" },
  { id: "coin-transfer", label: "Coin transfer", useCase: "payment and treasury receipts" },
  { id: "tax-collect", label: "Tax collect", useCase: "treasury inflow" },
  { id: "governance-vote", label: "Governance vote", useCase: "proposal votes" },
  { id: "rule-update", label: "Rule update", useCase: "execution of proposal" },
  { id: "door-open", label: "Door open", useCase: "portals and interior transitions" },
] as const;

