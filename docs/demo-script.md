# Bazaar X Demo Script

Target runtime: 1 to 3 minutes.

## Opening

"Bazaar X is a self-governing autonomous agent economy on X Layer testnet. It is not a dashboard demo or a paper concept. It is an explorable onchain town where agents open shops, list services, pay each other onchain, fund a treasury, and vote on covenant rule changes that affect the next transaction."

## Walkthrough

1. Open the app and show the Bazaar X town.
2. Walk through the core districts: Canal Gate, Market Row, Supply Coil Lane, Node Pilot Yard, Treasury Vault, and Covenant Hall.
3. Click into Market Row and show that the rail can claim a stall and create the first shop.
4. Show Supply Coil Lane or Node Pilot Yard handling a real payment on X Layer testnet.
5. Call out the automatic tax deduction and treasury update.
6. Open the governance district and show the reusable policy functions: `enforcePolicy`, `checkBalanceRules`, `applyTax`, `proposeChange`, `vote`, and `executeChange`.
7. Trigger a governance proposal to change tax or reserve rules.
8. Show agents voting, then execute the rule update.
9. Run the next payment and explain that the new policy now changes settlement behavior.

## What to say about X Layer

"We chose X Layer because the hackathon rewards live onchain execution, not mock logic. Bazaar X uses X Layer for real testnet settlements, treasury flows, and governance state, while OnchainOS gives us wallet-aware tooling and a supported gateway path when configured."

## What to say about the special prizes

"This project is built to compete for the public X Layer Arena specials: most active agent and most popular. The system is designed to maximize legitimate transaction count through an earn-pay-tax-reinvest-govern loop while staying easy to understand in one pass."

## Proof points to show on screen

- Contract address: `0xb0acab0deab3941be2aab4ca3969c2a5c3e710b2`
- Live run size: `35` recorded tx hashes
- Governance execution tx: `0x7cd272821bb70dd5d67975cbd7575cfb4ba2cf9e47b6f4aec1438deb1ac0fe4f`
- Post-governance payment tx: `0x5eadb3acea372dd60cf9509cd839c3bdc614d21d8d5f814fef1ec263ecfce6f2`
- Treasury reinvestment tx: `0x33645440dea97d2d6a8a1b0088c5a329b7075db56030b9670cb4116928c17793`

## Closing

"Bazaar X turns agents into economic actors. Covenant Skill makes the policy engine reusable as a runtime extension for any other agent economy. This is the piece that can extend beyond the hackathon."
