# Bazaar X Demo Script

Target runtime: 1 to 3 minutes.

## Opening

"Bazaar X is a self-governing autonomous agent economy on X Layer testnet. It is not a dashboard demo or a paper concept. It is an explorable onchain town where agents open shops, list services, pay each other onchain, fund a treasury, and vote on covenant rule changes that affect the next transaction."

## Walkthrough

1. Open the app and show the Bazaar X town.
2. Walk through the core districts: Canal Gate, Market Row, Supply Coil Lane, Node Pilot Yard, Treasury Vault, and Covenant Hall.
3. Click into Market Row and show that the rail can claim a stall and create the first shop.
4. Show Bazaar Forge posting the supplier order, then call out that the route now swaps native OKB through a live Uniswap V2 pool before the supplier settlement.
5. Open the proof drawer and show the two linked tx hashes: the swap proof first, then the Bazaar settlement proof.
6. Call out the automatic tax deduction and treasury update.
7. Open the governance district and show the reusable policy functions: `enforcePolicy`, `checkBalanceRules`, `applyTax`, `proposeChange`, `vote`, and `executeChange`.
8. Trigger a governance proposal to change tax or reserve rules.
9. Show agents voting, then execute the rule update.
10. Run the next payment and explain that the new policy now changes settlement behavior.

## What to say about X Layer

"We chose X Layer because the hackathon rewards live onchain execution, not mock logic. Bazaar X uses X Layer for real testnet settlements, treasury flows, and governance state, while OnchainOS gives us wallet-aware tooling and a supported gateway path when configured."

## What to say about the special prizes

"This project is built to compete for the public X Layer Arena specials: most active agent and most popular. The system is designed to maximize legitimate transaction count through an earn-pay-tax-reinvest-govern loop while staying easy to understand in one pass."

## Proof points to show on screen

- Contract address: `0xb0acab0deab3941be2aab4ca3969c2a5c3e710b2`
- Live run size: `19` recorded tx hashes
- Supplier-route swap tx: `0xe651d2ab919c63290a878907ccd77ba97f2679274957ee593d001662839553da`
- Supplier settlement tx: `0x620f37727331e1f9c5c4d5b5bced96dab0d70bff78a4d8cb333a5143f8661a67`
- Governance execution tx: `0xdd112e2760c7ab67996551182511ef26e541ba079a271572809f0ab0fd7770b6`
- Treasury reinvestment tx: `0x4cd3955c2fba64bf3f049218ee920f64394802961a4c636c2c3200f50e716d42`

## Closing

"Bazaar X turns agents into economic actors. Covenant Skill makes the policy engine reusable as a runtime extension for any other agent economy. This is the piece that can extend beyond the hackathon."
