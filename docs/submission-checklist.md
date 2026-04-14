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
- [x] `Project Name & One-Line Description`
  - Use: `Bazaar X - A self-governing autonomous agent economy on X Layer`
- [x] `Project Highlights`
  - Include real X Layer testnet execution, Covenant Skill, agent-to-agent payments, tax routing, governance updates, and why it is stronger than a normal agent demo.
- [x] `Your Track`
  - Use: `X Layer Arena`
- [ ] `Team Members & Contact Information`
  - List every contributor with email or Telegram handle.
- [x] `Agentic Wallet Address`
  - Paste the wallet that actually sent or received X Layer transactions.
- [x] `GitHub Repository Link`
  - Confirm the repo is public.
- [x] `OnchainOS Usage`
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
- [x] `Demo Video Link`
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

- [x] At least one part of the project is deployed on X Layer.
- [x] The demo shows real transactions, not only simulation.
- [x] The repo clearly explains the architecture and why X Layer matters.
- [x] The submission includes a 1 to 3 minute demo video, even if optional.
- [x] The project has a clear technical proof story and a clear human-judge story.

## X Layer Arena Readiness

- [x] Explorable app exists and is clearly more than a contract demo
- [x] Real X Layer testnet contract deployment exists
- [x] Real market settlement exists
- [x] Real governance proposal, voting, and execution exists
- [x] Real treasury movement exists
- [x] Real Uniswap-backed supplier route exists
- [x] OnchainOS support is integrated and labeled truthfully
- [x] Demo script focuses on the app, not the skill
- [x] Public live app URL is ready and stable
- [x] Final public demo video link is uploaded
- [x] Separate X Layer mainnet proof run exists
- [ ] Final X post is live

## Skills Arena Readiness

- [x] Reusable package exists as `@bazaar-x/covenant-skill`
- [x] Package builds to typed publishable output under `covenant-skill/dist`
- [x] Root and subpath entrypoints test cleanly
- [x] Clean-room install proof passes from packed tarball
- [x] Package README explains install and usage
- [x] Skill methods are clearly reusable outside Bazaar X
- [x] Final Skills Arena one-line description is written
- [x] Final skill-specific highlights are written
- [x] Shared Bazaar X demo link is ready to reuse for Skills Arena if needed
- [x] If using the shared repo, the form answer can point directly to skill docs and `covenant-skill/README.md`

## Bazaar X Evidence To Gather

- [x] Live app URL
- [x] Canonical evidence sheet points to the current rehearsal artifact: `21` total tx hashes in `.bazaarx/runtime/live/latest.json` (`20` post-deploy flow txs + `1` deployment tx)
- [x] Deployed contract address: `0xb0acab0deab3941be2aab4ca3969c2a5c3e710b2`
- [x] Real X Layer tx hash for Uniswap-backed supplier swap: `0xe651d2ab919c63290a878907ccd77ba97f2679274957ee593d001662839553da`
- [x] Real X Layer tx hash for supplier settlement proof: `0x620f37727331e1f9c5c4d5b5bced96dab0d70bff78a4d8cb333a5143f8661a67`
- [x] Real X Layer tx hash for governance execution: `0xdd112e2760c7ab67996551182511ef26e541ba079a271572809f0ab0fd7770b6`
- [x] Treasury movement tx hash: `0x4cd3955c2fba64bf3f049218ee920f64394802961a4c636c2c3200f50e716d42`
- [x] Covenant Skill policy update proof: proposal `0xdc85edb356b8d58c2efa1a4ff2f34c76228f9bb309f017926d8f6fa4f88fa8c0` + execution `0xdd112e2760c7ab67996551182511ef26e541ba079a271572809f0ab0fd7770b6`
- [x] x402 skill unlock settlement tx: `0x8b9b3d3f52f4042e1ac9b99a2da36a388eacb087d49a8d2c4f7f8325bbeb27f6`
- [x] x402 paid autonomous action settlement tx: `0xb2cb7b122bee56f6635b69f27da0097c147eb4185cabb8354ee98dc83b7a230a`
- [x] Separate mainnet proof run artifact: `.bazaarx/mainnet/live/latest.json` with `35` tx hashes
- [x] Mainnet contract address: `0x6a5a4a2e6f9111c584d80877f13e90aba9730ea9`
- [x] Mainnet governance execution tx: `0x8655a712232bdd4544dbc5e02fa11f3ae4b2a87ed8ebde8439ab28d987f3407d`
- [x] Mainnet treasury reinvestment tx: `0x332bc0c04f2f8046b4b4b269ec4a1de0267d19836ee42c78e4a2a58e5ba572ea`
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
- [x] Proven on X Layer mainnet: separate completed Bazaar X replay with deploy, supplier route, settlement, governance, post-governance payment, and treasury reinvestment
- [x] Conditional on supported chains: OnchainOS gateway broadcast and true `actualExecutor: agentic-wallet`
- [x] Local/self-hosted today: x402 facilitator on X Layer testnet
- [x] Public demo and canonical walkthrough remain testnet-recorded unless explicitly relinked

## Recommended Final Submission Order

1. Verify the app loads publicly.
2. Verify the contract and wallet address are correct.
3. Verify the demo video plays end to end.
4. Verify the X post is live.
5. Submit the form with all links checked twice.

## Still Requires Personal Input

- [ ] Public X post URL for Bazaar X
- [ ] Public X post URL for Covenant Skill if you post separately
- [ ] Final team roster and contact handles
- [x] Public live app URL:
  - `https://bazaar-x-ten.vercel.app`
- [x] Public demo video URL:
  - `https://drive.google.com/file/d/1oVJtDceddJ6odSeMovJNVJATwuvjNSZ7/view?usp=sharing`
- [x] Mainnet proof note before submit:
  - separate mainnet proof run is added
  - keep the demo and canonical tx evidence labeled as `testnet-recorded`
  - only claim the execution path that the runtime artifact actually proves
- [x] Agentic Wallet address available to paste into the form:
  - `0x79c0229105b741727b3f12027d249174cc6a7b9b`
