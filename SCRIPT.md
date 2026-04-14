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

## Winning Emphasis & Key Concepts

Prioritize the story in this order, making sure the judges catch these "Aha!" moments:

1. **The Main Product**: Bazaar X is a real onchain world on X Layer testnet, not a mock simulation.
2. **The Auto/AI Factor (x402 Skill)**: Full integration of x402 paid delegation allows AI agents to execute tasks autonomously on the user's behalf.
3. **The Uniswap Action**: Supplier routing actively swaps native OKB via a live Uniswap V2 pool before settling.
4. **Real-time Treasury**: Taxable economic actions automatically route verifiable funds directly to a global onchain treasury.
5. **Governance & Post-Governance**: The Covenant Skill dynamically updates village policy onchain. You can prove this by showing that the *very next* payment (post-governance settlement) automatically obeys the new tax rules.

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
6. Make sure the right-hand drawer opens cleanly on `Rail`, `Proof`, and `Ops`.
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

| Shot & Time | Actions | Voiceover |
| :--- | :--- | :--- |
| **Shot 1: Boot and promise**<br>`0:00 - 0:12` | 1. Start recording on the boot/loading sequence.<br>2. Let the startup steps finish.<br>3. Hold one second on the onboarding card. | "Bazaar X is our X Layer Arena submission. It turns a live X Layer testnet economy into an explorable pixel world, so judges see a real agent market immediately instead of a dashboard." |
| **Shot 2: Wallet-first onboarding**<br>`0:12 - 0:28` | 1. Show the onboarding card with wallet status and network requirement.<br>2. Click `Connect wallet` if needed.<br>3. If needed, click `Switch To X Layer Testnet`.<br>4. Click `Enter Village`. | "Wallet is citizenship here. Wallet-led steps sign directly on X Layer testnet, paid delegations use x402, and the game tells you exactly whether autonomous execution used the requested OnchainOS path or the fallback that actually ran." |
| **Shot 3: The world and quest rail**<br>`0:28 - 0:48` | 1. Let the village breathe for two to three seconds.<br>2. Move slightly through the map.<br>3. Point to the top objective chip and bottom HUD rail.<br>4. Open `Village Brief` on the left if it helps frame progress. | "The loop is simple and legible. Citizens claim stalls, route supply and labor, collect tax into treasury, vote on policy, and replay the same wage under the new rule. The quest rail makes that full onchain loop easy to follow in one pass." |
| **Shot 4: Rail tab**<br>`0:48 - 1:06` | 1. Open the right drawer on `Rail`.<br>2. Scroll through the golden path steps.<br>3. Pause on wallet-led steps and delegated steps. | "Every major quest step maps to a real action. You can play manually step-by-step, or switch to Delegated Agent mode where the AI takes over. We integrated the x402 skill to allow paid delegations, meaning the agents seamlessly execute task loops onchain on your behalf without you repeatedly signing." |
| **Shot 5: Proof tab**<br>`1:06 - 1:30` | 1. Switch to `Proof`.<br>2. Pause on the most important cards.<br>3. Highlight the Uniswap swap proof first.<br>4. Highlight the supplier settlement proof next.<br>5. If useful, mention governance, treasury, and paid delegation receipts in the same list. | "This is the evidence layer. The supplier route actively swaps native OKB through a live Uniswap V2 pool before settlement. We keep every receipt cleanly separated: swap proofs, settlement proofs, treasury feeds showing tax collection, governance updates, and x402 paid delegation proofs." |
| **Shot 6: Ops tab and autonomous truth**<br>`1:30 - 1:56` | 1. Switch to `Ops`.<br>2. Pause on `Status`, `Updated`, and routing metrics.<br>3. Toggle between `Wallet-led` and `Delegated Agent` control mode.<br>4. Pause on `Autonomous Path`.<br>5. Pause on `Delegation Credit`. | "Ops is where the product stays honest. It shows runtime health, control mode, delegation credit, and the exact autonomous path. In the current canonical replay, Agentic Wallet was requested, but the recorded execution on this chain still used the manifest-wallet fallback with standard broadcast. That honesty matters because this is real infrastructure, not theater." |
| **Shot 7: Governance changed the economy**<br>`1:56 - 2:18` | 1. Stay in `Ops` or return briefly to `Proof`.<br>2. Call out the governance proposal, votes, and execution.<br>3. Mention the rule change from `5%` to `8%` tax.<br>4. Show or reference the post-governance payment proof. | "Governance is not decorative. The Covenant Skill powers our policy engine. Agents vote, the change executes onchain, and the the next payment immediately reflects the new covenant. In this replay, the tax successfully moves from five to eight percent, and the specific post-governance settlement proves the updated treasury routing is live." |
| **Shot 8: Close on the full loop**<br>`2:18 - 2:36` | 1. Close the drawer.<br>2. Let the world run for two or three seconds.<br>3. End on a stable fullscreen frame with the town visible. | "Bazaar X is a self-governing agent economy on X Layer. Agents transact, supplier routes pass through a live swap, taxes feed treasury, governance updates policy, and paid delegations settle with separate receipts. Covenant Skill is the reusable policy engine underneath, but Bazaar X itself is the product: an explorable onchain economy." |

## Full Voiceover

"Bazaar X is our X Layer Arena submission. It turns a live X Layer testnet economy into an explorable pixel world, so judges see a real agent market immediately instead of a dashboard.

Wallet is citizenship here. Wallet-led steps sign directly on X Layer testnet, paid delegations use x402, and the game tells you exactly whether autonomous execution used the requested OnchainOS path or the fallback that actually ran.

The loop is simple and legible. Citizens claim stalls, route supply and labor, collect tax into treasury, vote on policy, and replay the same wage under the new rule. The quest rail makes that full onchain loop easy to follow in one pass.

Every major quest step maps to a real action. You can play manually step-by-step, or switch to Delegated Agent mode where the AI takes over. We integrated the x402 skill to allow paid delegations, meaning the agents seamlessly execute task loops onchain on your behalf without you repeatedly signing.

This is the evidence layer. The supplier route actively swaps native OKB through a live Uniswap V2 pool before settlement. We keep every receipt cleanly separated: swap proofs, settlement proofs, treasury feeds showing tax collection, governance updates, and x402 paid delegation proofs.

Ops is where the product stays honest. It shows runtime health, control mode, delegation credit, and the exact autonomous path. In the current canonical replay, Agentic Wallet was requested, but the recorded execution on this chain still used the manifest-wallet fallback with standard broadcast. That honesty matters because this is real infrastructure, not theater.

Governance is not decorative. The Covenant Skill powers our policy engine. Agents vote, the change executes onchain, and the the next payment immediately reflects the new covenant. In this replay, the tax successfully moves from five to eight percent, and the specific post-governance settlement proves the updated treasury routing is live.

Bazaar X is a self-governing agent economy on X Layer. Agents transact, supplier routes pass through a live swap, taxes feed treasury, governance updates policy, and paid delegations settle with separate receipts. Covenant Skill is the reusable policy engine underneath, but Bazaar X itself is the product: an explorable onchain economy."

## Optional Short Cut

If you want a shorter social or backup cut, keep:

1. Onboarding and Enter Village
2. World reveal
3. Rail tab
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
