# Bazaar X Demo Script

Recommended runtime: 2:00 to 2:45

This version matches the current product as of April 12, 2026: wallet-first onboarding, explorable pixel village, quest rail, proof drawer, Ops tab, x402-paid delegation flow, and the latest canonical X Layer testnet replay.

## Hackathon Fit

- Official Build X season: `April 1, 2026 23:59 UTC` to `April 15, 2026 23:59 UTC`
- `X Layer Arena` is for a `full-stack agentic app`
- `Skills Arena` is for a `reusable agent skill`
- Demo videos are `optional but beneficial`, with an official recommended runtime of `1 to 3 minutes`
- AI judges review `code and onchain data`
- Human judges review `creativity and practicality`

Because Covenant Skill is being submitted separately, this video should stay focused on `Bazaar X as the X Layer Arena product`. Mention the skill only as the reusable policy layer behind the economy.

## Winning Emphasis

Prioritize the story in this order:

1. Bazaar X is a real onchain world on X Layer testnet, not a mock simulation.
2. The game shell makes the economy instantly understandable.
3. The proof drawer and Ops tab make the tx evidence legible.
4. The separate skill exists, but it is supporting infrastructure here.

## Recording Goal

Show five things clearly:

1. Wallet is the only login.
2. The quest rail maps directly to real onchain actions.
3. The proof panel shows live receipts for swap, settlement, governance, treasury, and paid delegation.
4. The Ops panel honestly reports the autonomous path, wallet readiness, and x402 credit.
5. Governance changes the rules and the next settlement obeys the new covenant.

## Pre-Recording Checklist

1. Run `pnpm dev`.
2. Open the app fullscreen on desktop.
3. Keep browser zoom at `100%`.
4. Connect a wallet on `X Layer Testnet`.
5. Wait until the boot sequence completes and the onboarding card says the world is ready.
6. Make sure the right-hand drawer opens cleanly on `Quests`, `Proof`, and `Ops`.
7. If possible, preload one explorer tab for the strongest tx proof hold.

## Current Proof To Mention

- Network: `X Layer testnet`
- Chain ID: `1952`
- Contract: `0xb0acab0deab3941be2aab4ca3969c2a5c3e710b2`
- Treasury: `0xA90447Cb62B91467e45CC37e8B6020Dfd744f648`
- Canonical runtime artifact: `.bazaarx/runtime/live/latest.json`
- Current canonical replay timestamp: `April 12, 2026`
- Canonical runtime size: `21` total tx hashes (`20` post-deploy flow txs + `1` deployment tx)
- Requested autonomous executor: `agentic-wallet`
- Current recorded actual executor: `manifest-wallet`
- Current transport in the canonical replay: `standard broadcast`
- Supplier-route Uniswap swap proof: `0xe651d2ab919c63290a878907ccd77ba97f2679274957ee593d001662839553da`
- Supplier settlement proof: `0x620f37727331e1f9c5c4d5b5bced96dab0d70bff78a4d8cb333a5143f8661a67`
- Governance proposal: `0xdc85edb356b8d58c2efa1a4ff2f34c76228f9bb309f017926d8f6fa4f88fa8c0`
- Governance execution: `0xdd112e2760c7ab67996551182511ef26e541ba079a271572809f0ab0fd7770b6`
- Post-governance payment: `0xd8cf0e10056a449d04f8d8be4eba3c32dc4e29478c9c11175ee04bab8c5314e5`
- Treasury reinvestment: `0x4cd3955c2fba64bf3f049218ee920f64394802961a4c636c2c3200f50e716d42`
- x402 skill unlock payment: `0x8b9b3d3f52f4042e1ac9b99a2da36a388eacb087d49a8d2c4f7f8325bbeb27f6`
- x402 paid autonomous action settlement: `0xb2cb7b122bee56f6635b69f27da0097c147eb4185cabb8354ee98dc83b7a230a`
- Current live rules after governance: `8.00%` tax, `0.0015 OKB` minimum balance, `75%` quorum, `60%` support, `10s` voting window

## Shot List

### Shot 1: Boot and promise

Time: `0:00 - 0:12`

Actions:

1. Start recording on the boot/loading sequence.
2. Let the startup steps finish.
3. Hold one second on the onboarding card.

Voiceover:

"Bazaar X is our X Layer Arena submission. It turns a live X Layer testnet economy into an explorable pixel world, so judges see a real agent market immediately instead of a dashboard."

### Shot 2: Wallet-first onboarding

Time: `0:12 - 0:28`

Actions:

1. Show the onboarding card with wallet status and network requirement.
2. Click `Connect wallet` if needed.
3. If needed, click `Switch To X Layer Testnet`.
4. Click `Enter Village`.

Voiceover:

"Wallet is citizenship here. Wallet-led steps sign directly on X Layer testnet, paid delegations use x402, and the game tells you exactly whether autonomous execution used the requested OnchainOS path or the fallback that actually ran."

### Shot 3: The world and quest rail

Time: `0:28 - 0:48`

Actions:

1. Let the village breathe for two to three seconds.
2. Move slightly through the map.
3. Point to the top objective chip and bottom HUD rail.
4. Open `Village Brief` on the left if it helps frame progress.

Voiceover:

"The loop is simple and legible. Citizens claim stalls, route supply and labor, collect tax into treasury, vote on policy, and replay the same wage under the new rule. The quest rail makes that full onchain loop easy to follow in one pass."

### Shot 4: Quests tab

Time: `0:48 - 1:06`

Actions:

1. Open the right drawer on `Quests`.
2. Scroll through the golden path steps.
3. Pause on wallet-led steps and delegated steps.

Voiceover:

"Every major quest step maps to a real action. Some are wallet-led, some are delegated, and the UI labels which surface is being used so the demo never blurs simulation with settlement."

### Shot 5: Proof tab

Time: `1:06 - 1:30`

Actions:

1. Switch to `Proof`.
2. Pause on the most important cards.
3. Highlight the Uniswap swap proof first.
4. Highlight the supplier settlement proof next.
5. If useful, mention governance, treasury, and paid delegation receipts in the same list.

Voiceover:

"This is the evidence layer. The supplier route now swaps native OKB through a live Uniswap V2 pool before settlement, and the proof drawer keeps those receipts separated: swap proof, settlement proof, governance proof, treasury proof, and paid delegation proof."

### Shot 6: Ops tab and autonomous truth

Time: `1:30 - 1:56`

Actions:

1. Switch to `Ops`.
2. Pause on `Status`, `Updated`, and routing metrics.
3. Toggle between `Wallet-led` and `Delegated Agent` control mode.
4. Pause on `Autonomous Path`.
5. Pause on `Delegation Credit`.

Voiceover:

"Ops is where the product stays honest. It shows runtime health, control mode, delegation credit, and the exact autonomous path. In the current canonical replay, Agentic Wallet was requested, but the recorded execution on this chain still used the manifest-wallet fallback with standard broadcast. That honesty matters because this is real infrastructure, not theater."

### Shot 7: Governance changed the economy

Time: `1:56 - 2:18`

Actions:

1. Stay in `Ops` or return briefly to `Proof`.
2. Call out the governance proposal, votes, and execution.
3. Mention the rule change from `5%` to `8%` tax.
4. Show or reference the post-governance payment proof.

Voiceover:

"Governance is not decorative. The governor proposes a rule update, agents vote, the change executes onchain, and the next payment reflects the new covenant. In this replay, tax moves from five percent to eight percent, and the post-governance settlement proves the rule is live."

### Shot 8: Close on the full loop

Time: `2:18 - 2:36`

Actions:

1. Close the drawer.
2. Let the world run for two or three seconds.
3. End on a stable fullscreen frame with the town visible.

Voiceover:

"Bazaar X is a self-governing agent economy on X Layer. Agents transact, supplier routes pass through a live swap, taxes feed treasury, governance updates policy, and paid delegations settle with separate receipts. Covenant Skill is the reusable policy engine underneath, but Bazaar X itself is the product: an explorable onchain economy."

## Full Voiceover

"Bazaar X is our X Layer Arena submission. It turns a live X Layer testnet economy into an explorable pixel world, so judges see a real agent market immediately instead of a dashboard.

Wallet is citizenship here. Wallet-led steps sign directly on X Layer testnet, paid delegations use x402, and the game tells you exactly whether autonomous execution used the requested OnchainOS path or the fallback that actually ran.

The loop is simple and legible. Citizens claim stalls, route supply and labor, collect tax into treasury, vote on policy, and replay the same wage under the new rule. The quest rail makes that full onchain loop easy to follow in one pass.

Every major quest step maps to a real action. Some are wallet-led, some are delegated, and the UI labels which surface is being used so the demo never blurs simulation with settlement.

This is the evidence layer. The supplier route now swaps native OKB through a live Uniswap V2 pool before settlement, and the proof drawer keeps those receipts separated: swap proof, settlement proof, governance proof, treasury proof, and paid delegation proof.

Ops is where the product stays honest. It shows runtime health, control mode, delegation credit, and the exact autonomous path. In the current canonical replay, Agentic Wallet was requested, but the recorded execution on this chain still used the manifest-wallet fallback with standard broadcast. That honesty matters because this is real infrastructure, not theater.

Governance is not decorative. The governor proposes a rule update, agents vote, the change executes onchain, and the next payment reflects the new covenant. In this replay, tax moves from five percent to eight percent, and the post-governance settlement proves the rule is live.

Bazaar X is a self-governing agent economy on X Layer. Agents transact, supplier routes pass through a live swap, taxes feed treasury, governance updates policy, and paid delegations settle with separate receipts. Covenant Skill is the reusable policy engine underneath, but Bazaar X itself is the product: an explorable onchain economy."

## Optional Short Cut

If you want a shorter social or backup cut, keep:

1. Onboarding and Enter Village
2. World reveal
3. Quests tab
4. Proof tab
5. Ops tab
6. Closing world shot

That version should land around `60 to 75 seconds`.

## Demo Metadata

Title:

`Bazaar X | Explorable Agent Economy on X Layer Testnet`

Description:

`Bazaar X is our X Layer Arena submission: an explorable pixel village backed by real X Layer testnet settlements, treasury flows, governance updates, a live Uniswap supplier route, and x402-paid delegations. The canonical replay in this repo records 21 tx hashes in .bazaarx/runtime/live/latest.json. Current runtime truth: Agentic Wallet was requested, but the recorded autonomous executor on chain 1952 is manifest-wallet fallback rather than gateway/API execution. Repo: https://github.com/adidshaft/bazaar-x`

Upload copy:

`Explorable pixel village. Real X Layer testnet receipts. Honest runtime metadata. Bazaar X turns an agent economy into something judges can actually walk through.`

## Delivery Notes

- Keep the cursor calm and deliberate.
- Pause for one second after each drawer opens.
- Let the world breathe between panels so it still feels like a game.
- When you mention tx proof, hold the proof card long enough for the hash prefix to register.
- If you open one explorer link, use the Uniswap swap or governance execution proof.
- Keep the final frame on the world itself, not a drawer.
- Mention Covenant Skill only once, near the close.
- Do not claim `Most active agent` from OnchainOS execution unless the recorded runtime metadata actually shows `agentic-wallet` or `onchainos-gateway`.
