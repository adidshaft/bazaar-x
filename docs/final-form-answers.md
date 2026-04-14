# Final Form Answers

Use this as the copy-paste packet for the final Build X submission forms.

Important truth rule:

- The canonical proof in this repo is the X Layer testnet replay recorded on `April 12, 2026`.
- Bazaar X now also has a separate X Layer mainnet proof run, but the public video remains `testnet-recorded` unless you explicitly link a different recording.
- Bazaar X now also has a separate X Layer mainnet deployment and completed replay:
  - Contract: `0x6a5a4a2e6f9111c584d80877f13e90aba9730ea9`
  - Deploy tx: `0x535e1304b71b1c1720cd3461baaf94d4a9ad82c168c09ea6f7d61e3a4dc3d1d9`
  - Mainnet proof artifact: `.bazaarx/mainnet/live/latest.json`
  - Mainnet replay size: `35` tx hashes

## Bazaar X / X Layer Arena

### One-Line Description

`Bazaar X - An explorable pixel-RPG agent economy on X Layer with real settlements, treasury flows, governance updates, paid delegations, and a completed mainnet proof run.`

### Short Description

`Bazaar X turns a live X Layer economy into a playable village. The public demo uses the clean X Layer testnet replay, while the repo also includes a separate completed X Layer mainnet proof run. Citizens claim stalls, supplier routes pass through a real Uniswap-backed swap, taxes feed treasury, governance updates the covenant, and the next settlement obeys the new rule. The game shell stays readable for human judges while the repo and proof drawer stay legible for AI judges.`

### Project Highlights

- `Full-stack agentic app`: wallet-first onboarding, explorable Phaser world, Next.js shell, and live X Layer proof across a clean public testnet demo plus a separate completed mainnet proof run.
- `Real economy loop`: earn, pay, tax, treasury, vote, rule update, next payment.
- `Real receipts`: live Uniswap supplier-route swap, supplier settlement, governance execution, treasury reinvestment, and x402-paid delegation proof.
- `Mainnet presence`: deployed contract and completed replay on X Layer mainnet with the key txs linked in the README.
- `Truthful autonomy`: the app records requested executor versus actual executor and surfaces fallback behavior in the Ops panel.
- `Reusable depth`: Covenant Skill powers the policy layer and is packaged separately for Skills Arena.

### Why X Layer

`X Layer is the execution layer for the whole product: contract deployment, wallet-led transactions, treasury flows, governance state, the canonical testnet replay, and the separate completed mainnet proof run all live on X Layer. That makes the project technically replayable for AI judges and immediately practical for human judges.`

### Mainnet Deployment Note

`The demo video and canonical 21-tx replay in this repo were recorded on X Layer testnet on April 12, 2026. Bazaar X now also has a separate completed X Layer mainnet proof run at contract 0x6a5a4a2e6f9111c584d80877f13e90aba9730ea9, deployed in tx 0x535e1304b71b1c1720cd3461baaf94d4a9ad82c168c09ea6f7d61e3a4dc3d1d9, with the full mainnet replay preserved in .bazaarx/mainnet/live/latest.json. Unless explicitly linked otherwise, the recorded demo and canonical tx evidence in this submission remain the testnet artifact.`

### Exact OnchainOS Wording

`Bazaar X integrates OKX OnchainOS as a gateway-capable and Agentic Wallet-aware execution option and records requested versus actual autonomous execution in runtime metadata. In the canonical X Layer testnet replay included with this submission, Agentic Wallet was requested, but the installed OnchainOS CLI does not expose chain 1952 for Agentic Wallet execution, so the recorded autonomous path honestly falls back to manifest-wallet standard broadcast. In the separate completed X Layer mainnet proof run on chain 196, Agentic Wallet readiness is visible, but the shared village still executes role-specific autonomous steps from manifest wallets in the current build. We therefore claim OnchainOS readiness, runtime introspection, and truthful fallback reporting, not gateway/API execution that did not occur.`

### Agentic Wallet Note

`The Agentic Wallet address in this submission is the registered OKX Agentic Wallet identity for the project and it has real onchain funding on X Layer mainnet. It should be submitted as the project's Agentic Wallet address, but it should not be described as the executor of the current testnet or mainnet proof runs, because the recorded runtime artifacts still show actualExecutor: manifest-wallet.`

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
- Separate mainnet proof artifact: `.bazaarx/mainnet/live/latest.json`
- Mainnet replay size: `35` total tx hashes
- Mainnet supplier-route swap: `0x5313308aace777232b0d21ea16a4460cbe92cfb2a16477200f8f79a23e5fdf40`
- Mainnet governance execution: `0x8655a712232bdd4544dbc5e02fa11f3ae4b2a87ed8ebde8439ab28d987f3407d`
- Mainnet post-governance payment: `0x1091afa7b2d48b57ea86ac45fcc67d5d28e5766e44263a9948c9ea9276c41e64`
- Mainnet treasury reinvestment: `0x332bc0c04f2f8046b4b4b269ec4a1de0267d19836ee42c78e4a2a58e5ba572ea`

### Paste-Ready Form Block

- `Project Name & One-Line Description`
  - `Bazaar X - An explorable pixel-RPG agent economy on X Layer with real settlements, treasury flows, governance updates, paid delegations, and a completed mainnet proof run.`
- `Project Highlights`
  - `Bazaar X is a full-stack agentic app on X Layer. The public demo uses the clean X Layer testnet replay, and the repo also includes a separate completed X Layer mainnet proof run. It turns a live economy into an explorable pixel village where wallet-led actions, a Uniswap-backed supplier route, treasury flows, governance updates, and x402-paid delegations all produce separate verifiable receipts. The product is designed so human judges can understand the loop by moving through the world, while AI judges can verify both the code and the linked onchain evidence.`
- `Your Track`
  - `X Layer Arena`
- `OnchainOS Usage`
  - `Bazaar X integrates OKX OnchainOS as a gateway-capable and Agentic Wallet-aware execution option and records requested versus actual autonomous execution in runtime metadata. In the canonical X Layer testnet replay included with this submission, Agentic Wallet was requested, but the installed OnchainOS CLI does not expose chain 1952 for Agentic Wallet execution, so the recorded autonomous path honestly falls back to manifest-wallet standard broadcast. In the separate completed X Layer mainnet proof run on chain 196, Agentic Wallet readiness is visible, but the shared village still executes role-specific autonomous steps from manifest wallets in the current build. We therefore claim OnchainOS readiness, runtime introspection, and truthful fallback reporting, not gateway/API execution that did not occur.`
- `GitHub Repository Link`
  - `https://github.com/adidshaft/bazaar-x`
- `Agentic Wallet Address`
  - `0x79c0229105b741727b3f12027d249174cc6a7b9b`
  - `Use this as the registered Agentic Wallet identity, not as a claim that the current proof runs executed through Agentic Wallet.`
- `Separate Mainnet Proof Run`
  - `Bazaar X also has a separate completed X Layer mainnet proof run at contract 0x6a5a4a2e6f9111c584d80877f13e90aba9730ea9, deployed in tx 0x535e1304b71b1c1720cd3461baaf94d4a9ad82c168c09ea6f7d61e3a4dc3d1d9, with the replay preserved in .bazaarx/mainnet/live/latest.json. The public demo and canonical walkthrough remain testnet-recorded unless explicitly linked otherwise.`
- `Live App URL`
  - `https://bazaar-x-ten.vercel.app`
- `Demo Video Link`
  - `https://drive.google.com/file/d/1oVJtDceddJ6odSeMovJNVJATwuvjNSZ7/view?usp=sharing`
- `X Post Link`
  - https://x.com/Bazaar_X_/status/2044041065859305908?s=20

### Fields You Still Need To Fill

- `Email`: adidshaft@gmail.com
- `Team Members & Contact Information`: adidshaft@gmail.com
- `Live App URL`: `https://bazaar-x-ten.vercel.app`
- `X Post Link`: https://x.com/Bazaar_X_/status/2044041065859305908?s=20

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
  - `https://drive.google.com/file/d/1oVJtDceddJ6odSeMovJNVJATwuvjNSZ7/view?usp=sharing`
- `X Post Link`
  - https://x.com/Bazaar_X_/status/2044042787948257552?s=20

### Fields You Still Need To Fill

- `Email`: adidshaft@gmail.com
- `Team Members & Contact Information`: adidshaft@gmail.com
- `Demo Video Link`: `https://drive.google.com/file/d/1oVJtDceddJ6odSeMovJNVJATwuvjNSZ7/view?usp=sharing`
- `X Post Link`: https://x.com/Bazaar_X_/status/2044042787948257552?s=20
