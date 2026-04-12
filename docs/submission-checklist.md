# Bazaar X Submission Checklist

Use this as the final gate before submitting the Google Form.

## Form Fields

- [ ] `Email`
- [ ] `Project Name & One-Line Description`
  - Use: `Bazaar X - A self-governing autonomous agent economy on X Layer`
- [ ] `Project Highlights`
  - Include real X Layer testnet execution, Covenant Skill, agent-to-agent payments, tax routing, governance updates, and why it is stronger than a normal agent demo.
- [ ] `Your Track`
  - Use: `X Layer Arena`
- [ ] `Team Members & Contact Information`
  - List every contributor with email or Telegram handle.
- [ ] `Agentic Wallet Address`
  - Paste the wallet that actually sent or received X Layer transactions.
- [ ] `GitHub Repository Link`
  - Confirm the repo is public.
- [ ] `OnchainOS Usage`
  - Mention the exact modules used:
  - `agentic-wallet` only if you actually logged in and used it
  - `gateway` only if the run actually used simulate/broadcast/order tracking through Onchain OS
  - `payment` only if x402 payment flows are included
  - `security` if tx preflight checks were used
  - Be precise about network:
  - Current public proof in this repo is X Layer testnet
  - Current `onchainos` CLI exposes `xlayer` as mainnet chain `196` by default
  - Do not claim gateway-broadcasted testnet txs unless your CLI build supports that alias and the runtime metadata proves it
  - Do not claim hosted/default x402 facilitator support for X Layer testnet unless you actually used it
  - Current paid delegation proof uses a local/self-hosted x402-aligned facilitator on X Layer testnet
- [ ] `Demo Video Link`
  - Use a public Loom or YouTube link.
- [ ] `X (Twitter) Post Link`
  - Post must tag `@XLayerOfficial` and include `#BuildX`.

## Build X Requirements

- [ ] At least one part of the project is deployed on X Layer.
- [ ] The demo shows real transactions, not only simulation.
- [ ] The repo clearly explains the architecture and why X Layer matters.
- [ ] The submission includes a 1 to 3 minute demo video, even if optional.
- [ ] The project is positioned for both main judging and a special prize.

## Bazaar X Evidence To Gather

- [ ] Live app URL
- [x] Deployed contract address: `0xb0acab0deab3941be2aab4ca3969c2a5c3e710b2`
- [x] Real X Layer tx hash for Uniswap-backed supplier swap: `0xe651d2ab919c63290a878907ccd77ba97f2679274957ee593d001662839553da`
- [x] Real X Layer tx hash for supplier settlement after swap: `0x620f37727331e1f9c5c4d5b5bced96dab0d70bff78a4d8cb333a5143f8661a67`
- [x] Real X Layer tx hash for governance execution: `0xdd112e2760c7ab67996551182511ef26e541ba079a271572809f0ab0fd7770b6`
- [x] Treasury movement tx hash: `0x4cd3955c2fba64bf3f049218ee920f64394802961a4c636c2c3200f50e716d42`
- [x] Covenant Skill policy update proof: proposal `0xdc85edb356b8d58c2efa1a4ff2f34c76228f9bb309f017926d8f6fa4f88fa8c0` + execution `0xdd112e2760c7ab67996551182511ef26e541ba079a271572809f0ab0fd7770b6`
- [x] x402 skill unlock settlement tx: `0x8b9b3d3f52f4042e1ac9b99a2da36a388eacb087d49a8d2c4f7f8325bbeb27f6`
- [x] x402 paid autonomous action settlement tx: `0xb2cb7b122bee56f6635b69f27da0097c147eb4185cabb8354ee98dc83b7a230a`
- [ ] Final README with architecture, setup, and demo walkthrough
- [ ] Public X post URL

## Recommended Final Submission Order

1. Verify the app loads publicly.
2. Verify the contract and wallet address are correct.
3. Verify the demo video plays end to end.
4. Verify the X post is live.
5. Submit the form with all links checked twice.
