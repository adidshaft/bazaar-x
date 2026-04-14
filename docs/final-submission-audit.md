# Final Submission Audit

Date checked: `April 14, 2026`

This audit compares the current repo against the official Build X review surface, the canonical testnet runtime artifact in `.bazaarx/runtime/live/latest.json`, and the separate mainnet proof run in `.bazaarx/mainnet/live/latest.json`.

## Official Review Surface

- `X Layer Arena` is for full-stack agentic apps
- `Skills Arena` is for reusable agent skills
- AI judges review `code` and `onchain data`
- Human judges review `creativity` and `practicality`
- X Layer Arena requires at least one deployed component on X Layer
- Demo videos are optional but recommended at `1 to 3 minutes`

## Canonical Truth Sources

- [README.md](/Users/amanpandey/projects/bazaar-x/README.md)
- [SCRIPT.md](/Users/amanpandey/projects/bazaar-x/SCRIPT.md)
- [docs/tx-evidence.md](/Users/amanpandey/projects/bazaar-x/docs/tx-evidence.md)
- [covenant-skill/README.md](/Users/amanpandey/projects/bazaar-x/covenant-skill/README.md)
- `.bazaarx/runtime/live/latest.json`
- `.bazaarx/mainnet/live/latest.json`

## Runtime Truth Snapshot

- Network: `X Layer testnet`
- Chain ID: `1952`
- Contract: `0xb0acab0deab3941be2aab4ca3969c2a5c3e710b2`
- Treasury: `0xA90447Cb62B91467e45CC37e8B6020Dfd744f648`
- Canonical replay timestamp: `2026-04-12T12:47:26.761Z`
- Canonical evidence size: `21` total tx hashes
- Requested executor: `agentic-wallet`
- Recorded actual executor: `manifest-wallet`
- Requested mode: `viem`
- Recorded mode: `viem`
- `supportsGatewayBroadcast`: `false`
- `supportsAgenticWallet`: `false`
- `usesOnchainOsGateway`: `false`
- x402 path: `local/self-hosted facilitator on X Layer testnet`
- Covenant Skill packaging: `installable from packed artifact today`, `public npm publish still pending`

## Mainnet Promotion Status

Status: `Separate mainnet proof run completed`

What is now ready:

- Mainnet RPC/config wiring exists for chain `196`
- Mainnet-safe preflight is available via `pnpm live:preflight`
- `pnpm live:status` now redacts private keys from the printed manifest
- The deploy path no longer depends on the testnet faucet when you point it at mainnet
- Onchain payment and Uniswap error messages can now follow the active X Layer network instead of hardcoding `testnet`
- Mainnet contract deployment is now recorded:
  - Contract: `0x6a5a4a2e6f9111c584d80877f13e90aba9730ea9`
  - Deploy tx: `0x535e1304b71b1c1720cd3461baaf94d4a9ad82c168c09ea6f7d61e3a4dc3d1d9`
- Separate mainnet replay artifact is now completed:
  - Runtime artifact: `.bazaarx/mainnet/live/latest.json`
  - Status: `completed`
  - Proof size: `35` tx hashes
  - Mainnet supplier-route swap: `0x5313308aace777232b0d21ea16a4460cbe92cfb2a16477200f8f79a23e5fdf40`
  - Mainnet governance execution: `0x8655a712232bdd4544dbc5e02fa11f3ae4b2a87ed8ebde8439ab28d987f3407d`
  - Mainnet post-governance payment: `0x1091afa7b2d48b57ea86ac45fcc67d5d28e5766e44263a9948c9ea9276c41e64`
  - Mainnet treasury reinvestment: `0x332bc0c04f2f8046b4b4b269ec4a1de0267d19836ee42c78e4a2a58e5ba572ea`
- Agentic Wallet login now exists on this machine:
  - Account: `Account 1`
  - X Layer address: `0x79c0229105b741727b3f12027d249174cc6a7b9b`

What still does not become claimable automatically:

- The current runtime does not prove `actualExecutor: agentic-wallet`
- The current runtime does not prove `resolvedMode: onchainos-gateway`
- x402 is still a local/self-hosted facilitator path until a different live proof is captured
- The public walkthrough video is still the cleaner testnet recording, not a mainnet-recorded demo

## Submission Readiness

### X Layer Arena

Status: `Ready once external links are supplied`

Covered:

- Real X Layer testnet contract deployment
- Real supplier swap, settlement, governance, treasury, and paid delegation receipts
- Explorable game shell that keeps proof secondary to the world
- Honest runtime reporting for requested versus actual autonomous execution
- Submission-safe README, script, checklist, and final form copy

Still requires the submitter:

- Public X post URL
- Final team/contact fields in the Google Form
- Final click-through submission itself

### Skills Arena

Status: `Ready once external links are supplied`

Covered:

- Installable package under `@bazaar-x/covenant-skill`
- Stable typed entrypoints and usage examples
- Passing clean-room install proof from packed tarball
- Clear boundary between reusable skill package and Bazaar X app shell
- Submission-specific copy in [docs/skills-arena-submission.md](/Users/amanpandey/projects/bazaar-x/docs/skills-arena-submission.md)

Still requires the submitter:

- Public X post URL if you want a separate skill post
- Final team/contact fields in the Google Form if requested
- Final click-through submission itself

## Risk Cleanup Completed

- [NEW_SCRIPT.md](/Users/amanpandey/projects/bazaar-x/NEW_SCRIPT.md) is now explicitly quarantined as speculative and not submission-safe.
- [docs/demo-script.md](/Users/amanpandey/projects/bazaar-x/docs/demo-script.md) now points to [SCRIPT.md](/Users/amanpandey/projects/bazaar-x/SCRIPT.md) as the only canonical demo narrative.
- [docs/x-post.md](/Users/amanpandey/projects/bazaar-x/docs/x-post.md) now points to [docs/x-post-final.md](/Users/amanpandey/projects/bazaar-x/docs/x-post-final.md) as the only canonical social copy.
- Special-prize language was removed from the submission-facing README and demo references.

## Human Judge Read

Current strengths:

- The product looks like a world, not a dashboard.
- The loop is easy to understand in one pass.
- The proof drawer and Ops panel make the receipts readable without drowning the screen.
- The repo now gives judges one clear place to find the final answers and proof.

Remaining presentation risk:

- The startup and onboarding screenshots were refreshed from the current production build, but deeper `Quests`, `Proof`, and `Ops` captures still want a connected-wallet session if you want the whole gallery fully current.
- A rushed demo can still bury the world under too much drawer time.
- The strongest honest story is still `testnet-recorded demo + separate mainnet proof run`, so do not blur those two proof sets together in the form copy.

## Verification

Rerun on `April 14, 2026` after the final doc pass:

- `pnpm typecheck` - passed
- `pnpm lint` - passed
- `pnpm build` - passed
- `pnpm --dir covenant-skill test` - passed
- `pnpm --dir covenant-skill smoke:install` - passed
- `pnpm --dir covenant-skill example` - passed

Screenshot refresh:

- `docs/screenshots/loading.png` refreshed from the current production build
- `docs/screenshots/onboarding.png` refreshed from the current production build

No contract files changed, so `pnpm contracts:test` was not rerun.
