# Final Form Answers

Use this as the copy-paste packet for the final Build X submission forms.

Important truth rule:

- The canonical proof in this repo is the X Layer testnet replay recorded on `April 12, 2026`.
- If a mainnet deployment is added later, keep the demo and tx evidence labeled as `testnet-recorded` unless you also record new mainnet proof.

## Bazaar X / X Layer Arena

### One-Line Description

`Bazaar X - An explorable pixel-RPG agent economy on X Layer where real settlements, treasury flows, governance updates, and paid delegations appear as in-world proof.`

### Short Description

`Bazaar X turns a live X Layer testnet economy into a playable village. Citizens claim stalls, supplier routes pass through a real Uniswap-backed swap, taxes feed treasury, governance updates the covenant, and the next settlement obeys the new rule. The game shell stays readable for human judges while the repo and proof drawer stay legible for AI judges.`

### Project Highlights

- `Full-stack agentic app`: wallet-first onboarding, explorable Phaser world, Next.js shell, and live X Layer proof.
- `Real economy loop`: earn, pay, tax, treasury, vote, rule update, next payment.
- `Real receipts`: live Uniswap supplier-route swap, supplier settlement, governance execution, treasury reinvestment, and x402-paid delegation proof.
- `Truthful autonomy`: the app records requested executor versus actual executor and surfaces fallback behavior in the Ops panel.
- `Reusable depth`: Covenant Skill powers the policy layer and is packaged separately for Skills Arena.

### Why X Layer

`X Layer is the execution layer for the whole product: contract deployment, wallet-led transactions, treasury flows, governance state, and the canonical testnet replay all live on X Layer. That makes the demo technically replayable for AI judges and immediately practical for human judges.`

### Exact OnchainOS Wording

`Bazaar X integrates OKX OnchainOS as a gateway-capable execution option and records requested versus actual autonomous execution in runtime metadata. In the canonical X Layer testnet replay included with this submission, Agentic Wallet was requested, but the installed OnchainOS CLI does not expose chain 1952 for Agentic Wallet execution, so the recorded autonomous path honestly falls back to manifest-wallet standard broadcast. We therefore claim OnchainOS readiness, runtime introspection, and truthful fallback reporting for the current public artifact, not gateway/API execution that did not occur.`

### Proof To Cite

- Contract: `0xb0acab0deab3941be2aab4ca3969c2a5c3e710b2`
- Treasury: `0xA90447Cb62B91467e45CC37e8B6020Dfd744f648`
- Canonical runtime artifact: `.bazaarx/runtime/live/latest.json`
- Canonical replay size: `21` total tx hashes
- Supplier-route Uniswap swap: `0xe651d2ab919c63290a878907ccd77ba97f2679274957ee593d001662839553da`
- Supplier settlement: `0x620f37727331e1f9c5c4d5b5bced96dab0d70bff78a4d8cb333a5143f8661a67`
- Governance execution: `0xdd112e2760c7ab67996551182511ef26e541ba079a271572809f0ab0fd7770b6`
- Treasury reinvestment: `0x4cd3955c2fba64bf3f049218ee920f64394802961a4c636c2c3200f50e716d42`
- x402 skill unlock settlement: `0x8b9b3d3f52f4042e1ac9b99a2da36a388eacb087d49a8d2c4f7f8325bbeb27f6`
- x402 paid autonomous action settlement: `0xb2cb7b122bee56f6635b69f27da0097c147eb4185cabb8354ee98dc83b7a230a`

### Paste-Ready Form Block

- `Project Name & One-Line Description`
  - `Bazaar X - An explorable pixel-RPG agent economy on X Layer where real settlements, treasury flows, governance updates, and paid delegations appear as in-world proof.`
- `Project Highlights`
  - `Bazaar X is a full-stack agentic app on X Layer testnet. It turns a live economy into an explorable pixel village where wallet-led actions, a Uniswap-backed supplier route, treasury flows, governance updates, and x402-paid delegations all produce separate verifiable receipts. The product is designed so human judges can understand the loop by moving through the world, while AI judges can verify the code and canonical tx evidence in the repo.`
- `Your Track`
  - `X Layer Arena`
- `OnchainOS Usage`
  - `Bazaar X integrates OKX OnchainOS as a gateway-capable execution option and records requested versus actual autonomous execution in runtime metadata. In the canonical X Layer testnet replay included with this submission, Agentic Wallet was requested, but the installed OnchainOS CLI does not expose chain 1952 for Agentic Wallet execution, so the recorded autonomous path honestly falls back to manifest-wallet standard broadcast. We therefore claim OnchainOS readiness, runtime introspection, and truthful fallback reporting for the current public artifact, not gateway/API execution that did not occur.`
- `GitHub Repository Link`
  - `https://github.com/adidshaft/bazaar-x`
- `Live App URL`
  - `[ADD LIVE APP URL]`
- `Demo Video Link`
  - `[ADD DEMO VIDEO URL]`
- `X Post Link`
  - `[ADD BAZAAR X POST URL]`

### Fields You Still Need To Fill

- `Email`: `[ADD SUBMISSION EMAIL]`
- `Team Members & Contact Information`: `[ADD FINAL TEAM LIST]`
- `Agentic Wallet Address`: `[ADD THE WALLET ADDRESS YOU WANT TO PASTE]`
- `Live App URL`: `[ADD PUBLIC URL]`
- `Demo Video Link`: `[ADD PUBLIC VIDEO URL]`
- `X Post Link`: `[ADD PUBLIC X POST URL]`

## Covenant Skill / Skills Arena

### One-Line Description

`Covenant Skill - An installable TypeScript skill package for agent economies, with reusable policy, tax, treasury, and governance primitives.`

### Short Description

`Covenant Skill packages Bazaar X's economy rules into a reusable artifact that another project can install today without importing Bazaar X internals. It ships typed entrypoints, usage examples, a clean-room install proof, and stable methods for policy creation, tax application, balance checks, governance proposals, voting, and rule execution.`

### Project Highlights

- `Installable today`: packed tarball installs cleanly into a separate sample consumer.
- `Minimal typed surface`: stable root and subpath exports with generated declarations.
- `Portable methods`: `createDefaultPolicy`, `applyTax`, `checkBalanceRules`, `enforcePolicy`, `proposeChange`, `vote`, and `executeChange`.
- `Verified packaging`: test suite plus clean-room smoke install.
- `Repo-independent usage`: examples import only `@bazaar-x/covenant-skill`, not Bazaar X app code.

### Recommended Submission Wording

`Covenant Skill is our Skills Arena entry: an installable TypeScript package for agent economies. It extracts the policy, tax, treasury, and governance logic from Bazaar X into a typed reusable artifact that another project can install today from a packed tarball, exercise in a clean-room consumer, and extend through a registry surface without importing Bazaar X internals.`

### Proof To Cite

- Package: `@bazaar-x/covenant-skill`
- Install docs: [covenant-skill/README.md](/Users/amanpandey/projects/bazaar-x/covenant-skill/README.md)
- Example consumer: [covenant-skill/examples/basic-usage.mjs](/Users/amanpandey/projects/bazaar-x/covenant-skill/examples/basic-usage.mjs)
- Test coverage: [covenant-skill/test/covenant-skill.test.mjs](/Users/amanpandey/projects/bazaar-x/covenant-skill/test/covenant-skill.test.mjs)
- Clean-room install proof: [covenant-skill/scripts/smoke-install.mjs](/Users/amanpandey/projects/bazaar-x/covenant-skill/scripts/smoke-install.mjs)

### Paste-Ready Form Block

- `Project Name & One-Line Description`
  - `Covenant Skill - An installable TypeScript skill package for agent economies, with reusable policy, tax, treasury, and governance primitives.`
- `Project Highlights`
  - `Covenant Skill packages the Bazaar X economy rules into a reusable artifact with typed exports, stable entrypoints, usage examples, and clean-room install proof. Another project can install it today from a packed tarball and call createDefaultPolicy, applyTax, checkBalanceRules, enforcePolicy, proposeChange, vote, and executeChange without importing Bazaar X internals.`
- `Your Track`
  - `Skills Arena`
- `GitHub Repository Link`
  - `https://github.com/adidshaft/bazaar-x`
- `Supporting Docs`
  - `https://github.com/adidshaft/bazaar-x/tree/main/covenant-skill`
- `Demo Video Link`
  - `[ADD SKILL VIDEO URL OR REUSE BAZAAR X DEMO URL]`
- `X Post Link`
  - `[ADD COVENANT SKILL POST URL OR REUSE THE BAZAAR X POST IF ALLOWED]`

### Fields You Still Need To Fill

- `Email`: `[ADD SUBMISSION EMAIL]`
- `Team Members & Contact Information`: `[ADD FINAL TEAM LIST]`
- `Demo Video Link`: `[ADD OR DECIDE TO OMIT IF OPTIONAL]`
- `X Post Link`: `[ADD IF REQUIRED]`
