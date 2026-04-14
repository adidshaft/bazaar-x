# Bazaar X Submission Checklist

Use this as the final gate before submitting the Google Form for both arenas.

## Canonical Submission Files

- [Final form answers](/Users/amanpandey/projects/bazaar-x/docs/final-form-answers.md)
- [Bazaar X demo script](/Users/amanpandey/projects/bazaar-x/SCRIPT.md)
- [Covenant Skill submission packet](/Users/amanpandey/projects/bazaar-x/docs/skills-arena-submission.md)
- [Mainnet launch checklist](/Users/amanpandey/projects/bazaar-x/docs/mainnet-launch-checklist.md)
- [X post drafts](/Users/amanpandey/projects/bazaar-x/docs/x-post-final.md)
- [X Layer tx evidence](/Users/amanpandey/projects/bazaar-x/docs/tx-evidence.md)
- [Final audit](/Users/amanpandey/projects/bazaar-x/docs/final-submission-audit.md)

## Official Review Surface

Per the official Build X page:

- AI judges review `code` and `onchain data`
- Human judges review `creativity` and `practicality`
- `X Layer Arena` is for `full-stack agentic apps`
- `Skills Arena` is for `reusable agent skills`
- X Layer Arena requires that at least one part of the project is deployed on X Layer
- Demo videos are optional but explicitly recommended at `1 to 3 minutes`

That means the final package has to do two jobs:

1. Be technically truthful and easy for AI judges to verify
2. Feel visually memorable and practical for human judges in one pass

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
  - Current recorded actual executor is `manifest-wallet`; only say `agentic-wallet` if a specific runtime artifact proves it
- [ ] `Demo Video Link`
  - Use a public Loom or YouTube link.
- [ ] `X (Twitter) Post Link`
  - Post must tag `@XLayerOfficial` and include `#BuildX`.

## Arena Plan

- [ ] Submit `Bazaar X` as `X Layer Arena`
- [ ] Submit `Covenant Skill` as `Skills Arena`
- [ ] Keep the app pitch and skill pitch separate
  - `Bazaar X` pitch: explorable autonomous market on X Layer
  - `Covenant Skill` pitch: reusable policy, treasury, and governance package
- [ ] Reuse the same repo only if each submission clearly points judges to the relevant docs and proof
- [ ] Make sure each arena has its own one-line description, highlights, and demo framing

## Build X Requirements

- [ ] At least one part of the project is deployed on X Layer.
- [ ] The demo shows real transactions, not only simulation.
- [ ] The repo clearly explains the architecture and why X Layer matters.
- [ ] The submission includes a 1 to 3 minute demo video, even if optional.
- [ ] The project has a clear technical proof story and a clear human-judge story.

## X Layer Arena Readiness

- [x] Explorable app exists and is clearly more than a contract demo
- [x] Real X Layer testnet contract deployment exists
- [x] Real market settlement exists
- [x] Real governance proposal, voting, and execution exists
- [x] Real treasury movement exists
- [x] Real Uniswap-backed supplier route exists
- [x] OnchainOS support is integrated and labeled truthfully
- [x] Demo script focuses on the app, not the skill
- [ ] Public live app URL is ready and stable
- [ ] Final public demo video link is uploaded
- [ ] Final X post is live

## Skills Arena Readiness

- [x] Reusable package exists as `@bazaar-x/covenant-skill`
- [x] Package builds to typed publishable output under `covenant-skill/dist`
- [x] Root and subpath entrypoints test cleanly
- [x] Clean-room install proof passes from packed tarball
- [x] Package README explains install and usage
- [x] Skill methods are clearly reusable outside Bazaar X
- [ ] Final Skills Arena one-line description is written
- [ ] Final skill-specific highlights are written
- [ ] Decide whether to submit the same video, a short skill-focused clip, or no video for Skills Arena
- [ ] If using the shared repo, make sure the form answer links directly to skill docs and `covenant-skill/README.md`

## Bazaar X Evidence To Gather

- [ ] Live app URL
- [x] Canonical evidence sheet points to the current rehearsal artifact: `21` total tx hashes in `.bazaarx/runtime/live/latest.json` (`20` post-deploy flow txs + `1` deployment tx)
- [x] Deployed contract address: `0xb0acab0deab3941be2aab4ca3969c2a5c3e710b2`
- [x] Real X Layer tx hash for Uniswap-backed supplier swap: `0xe651d2ab919c63290a878907ccd77ba97f2679274957ee593d001662839553da`
- [x] Real X Layer tx hash for supplier settlement proof: `0x620f37727331e1f9c5c4d5b5bced96dab0d70bff78a4d8cb333a5143f8661a67`
- [x] Real X Layer tx hash for governance execution: `0xdd112e2760c7ab67996551182511ef26e541ba079a271572809f0ab0fd7770b6`
- [x] Treasury movement tx hash: `0x4cd3955c2fba64bf3f049218ee920f64394802961a4c636c2c3200f50e716d42`
- [x] Covenant Skill policy update proof: proposal `0xdc85edb356b8d58c2efa1a4ff2f34c76228f9bb309f017926d8f6fa4f88fa8c0` + execution `0xdd112e2760c7ab67996551182511ef26e541ba079a271572809f0ab0fd7770b6`
- [x] x402 skill unlock settlement tx: `0x8b9b3d3f52f4042e1ac9b99a2da36a388eacb087d49a8d2c4f7f8325bbeb27f6`
- [x] x402 paid autonomous action settlement tx: `0xb2cb7b122bee56f6635b69f27da0097c147eb4185cabb8354ee98dc83b7a230a`
- [x] Final README with architecture, setup, and demo walkthrough
- [x] Covenant Skill installability proof: `pnpm --dir covenant-skill smoke:install`
- [ ] Public X post URL

## Human Judge Polish

- [ ] Replace any stale screenshots that do not reflect the current `Quests`, `Proof`, and `Ops` surfaces
- [ ] Record the demo in fullscreen with calm cursor movement
- [ ] Lead the demo with the visual village first, proof second
- [ ] Keep copy tight and vivid: `playable`, `explorable`, `self-governing`, `real receipts`
- [ ] End on the moving town, not on a drawer or code screen
- [ ] Avoid any unsupported platform claims like "anyone can deploy their own city" unless you can show the actual product path in the code and UI
- [ ] Keep the skill mention short in the app video so the main product stays visually legible

## Current Risks To Avoid

- [x] Do not claim `Most active agent` from OnchainOS execution unless runtime metadata actually shows `Onchain OS API` execution
- [x] Do not describe the current public X Layer testnet proof as `agentic-wallet` execution
- [x] Do not describe the current public testnet proof as `onchainos-gateway` broadcast unless the replay metadata proves it
- [x] Do not describe the x402 path as hosted/default facilitator support on X Layer testnet
- [x] Do not let speculative files or scripts become submission truth if the product does not implement them
- [x] Do not let the separate skill overshadow the main X Layer Arena story

## Truth Matrix

- [x] Proven on X Layer testnet: wallet-led market actions, governance, treasury, Uniswap supplier route, x402-aligned paid delegations, packaged Covenant Skill smoke install
- [x] Conditional on supported chains: OnchainOS gateway broadcast and Agentic Wallet execution
- [x] Local/self-hosted today: x402 facilitator on X Layer testnet
- [x] Mainnet-final only: any mainnet settlement proof or mainnet demo claim

## Recommended Final Submission Order

1. Verify the app loads publicly.
2. Verify the contract and wallet address are correct.
3. Verify the demo video plays end to end.
4. Verify the X post is live.
5. Submit the form with all links checked twice.

## Still Requires Personal Input

- [ ] Public live app URL
- [ ] Public demo video URL
- [ ] Public X post URL for Bazaar X
- [ ] Public X post URL for Covenant Skill if you post separately
- [ ] Final team roster and contact handles
- [ ] Wallet address you want to paste into the form
- [ ] Mainnet deployment decision before submit:
  - leave the submission fully testnet-backed
  - or add a separate mainnet deployment and update wording with [docs/mainnet-launch-checklist.md](/Users/amanpandey/projects/bazaar-x/docs/mainnet-launch-checklist.md)
  - if choosing mainnet, run `pnpm live:preflight` first and only claim the execution path that the resulting runtime artifact proves
