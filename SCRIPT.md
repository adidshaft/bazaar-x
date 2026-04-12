# Bazaar X Demo Script

Recommended runtime: 2:00 to 2:45

This version matches the current fullscreen pixel-village build: boot screen, wallet onboarding, explorable town, floating agent whispers, and the collapsible right-hand drawer for deep proof.

## Hackathon Fit

- Official Build X season: `April 1, 2026 23:59 UTC` to `April 15, 2026 23:59 UTC`
- `X Layer Arena` is for a `full-stack agentic app`
- `Skills Arena` is for a `reusable agent skill`
- Demo videos are `optional but beneficial`, with an official recommended runtime of `1 to 3 minutes`
- AI judges review `code and onchain data`
- Human judges review `creativity and practicality`

Because Covenant Skill is being submitted separately, this video should stay focused on `Bazaar X as the X Layer Arena product`. Mention the skill only as the policy engine behind the app, not as the center of the pitch.

## Winning Emphasis

Prioritize the story in this order:

1. This is a complete onchain app on X Layer.
2. The world is creative, but still practical and easy to understand.
3. Real tx proof exists for payment, governance, and treasury movement.
4. The separate skill exists, but it is supporting infrastructure here.

## Recording Goal

Show four things clearly:

1. Bazaar X feels like a game, not a dashboard.
2. The world represents a real autonomous agent economy on X Layer.
3. The drawer reveals live onchain proof only when needed.
4. Governance changes the rules and the economy obeys them.

## Pre-Recording Checklist

1. Run `pnpm dev`.
2. Open the app fullscreen on desktop.
3. Keep browser zoom at `100%`.
4. Connect a wallet on X Layer testnet if you want the best take.
5. Make sure the village finishes loading and the drawer can open cleanly.
6. If the town feels too busy, wait 3 to 5 seconds before starting so the agents settle into readable motion.

## Core Proof To Mention

- Contract: `0xb0acab0deab3941be2aab4ca3969c2a5c3e710b2`
- Treasury: `0xA90447Cb62B91467e45CC37e8B6020Dfd744f648`
- Canonical runtime artifact: `21` total tx hashes in `.bazaarx/runtime/live/latest.json` (`20` post-deploy flow txs + `1` deployment tx)
- Requested autonomous executor: `agentic-wallet`
- Current recorded actual executor: `manifest-wallet`
- Uniswap supplier-route swap proof: `0xe651d2ab919c63290a878907ccd77ba97f2679274957ee593d001662839553da`
- Supplier settlement proof: `0x620f37727331e1f9c5c4d5b5bced96dab0d70bff78a4d8cb333a5143f8661a67`
- Governance execution: `0xdd112e2760c7ab67996551182511ef26e541ba079a271572809f0ab0fd7770b6`
- Post-governance payment: `0xd8cf0e10056a449d04f8d8be4eba3c32dc4e29478c9c11175ee04bab8c5314e5`
- Treasury reinvestment: `0x4cd3955c2fba64bf3f049218ee920f64394802961a4c636c2c3200f50e716d42`
- x402 paid agent settlement: `0xb2cb7b122bee56f6635b69f27da0097c147eb4185cabb8354ee98dc83b7a230a`
- Current live rules: `8.00%` tax, `0.0015 OKB` minimum balance, `75%` quorum, `60%` support, `10s` voting window

## Shot List

### Shot 1: Boot and world reveal

Time: `0:00 - 0:12`

Actions:

1. Start recording on the loading screen.
2. Let the progress bar finish.
3. Hold for a beat as the village appears.

Voiceover:

"Bazaar X is our X Layer Arena submission. It turns a live X Layer economy into a playable village, so the product feels creative immediately without hiding the real onchain system underneath."

### Shot 2: Wallet onboarding

Time: `0:12 - 0:28`

Actions:

1. Show the onboarding overlay.
2. Click `Connect Wallet` if you want a live connected take.
3. Click `Enter Village`.

Voiceover:

"Wallet connection is the only login. Once connected on X Layer testnet, you enter the world directly and watch the economy run through agents, not menu forms."

### Shot 3: The living village

Time: `0:28 - 0:52`

Actions:

1. Keep the full map visible.
2. Let the player and NPCs move for a few seconds.
3. Move slightly with click-to-move or WASD.
4. Pause near one district.

Voiceover:

"Every character in the town has a role. The merchant creates demand, the supplier routes work, the worker executes paid contracts, and the governor changes the rules. Their status whispers stay in-world so you can follow the loop without opening panels."

### Shot 4: Minimal HUD and game controls

Time: `0:52 - 1:08`

Actions:

1. Point to `Village Brief` in the top-left.
2. Point to the wallet chip in the top-right.
3. Point to the icon rail.
4. Click the world once to show how the drawer closes.

Voiceover:

"The interface stays light. The world stays visible, and deeper information only slides in when needed. Tapping back into the town collapses the drawer and returns focus to play."

### Shot 5: Inspect a district

Time: `1:08 - 1:26`

Actions:

1. Walk near a district.
2. Click the floating `[ i ]` marker or the district itself.
3. Let the `Inspect` drawer open.
4. Highlight the district summary and proof card.

Voiceover:

"Each district represents a piece of the economy. Inspection reveals the local role, the latest economic state, and the attached proof, whether that is an address or a real transaction."

### Shot 6: Quest Rail

Time: `1:26 - 1:46`

Actions:

1. Open `Quests` from the icon rail.
2. Hover or pause on `Spawn economy`, `Deploy to X Layer`, and `Play live round`.
3. Scroll slightly to the quest cards.

Voiceover:

"The whole market loop is organized as a playable quest rail: spawn the economy, deploy the system, run the live round, and then prove governance changed the rules."

### Shot 7: Legend and stats

Time: `1:46 - 2:03`

Actions:

1. Open `Legend`.
2. Show the role cards and minimap.
3. Open `Stats`.
4. Pause on campaign progress, treasury TVL, and tax rate.

Voiceover:

"The legend teaches the world quickly, while the systems panel explains what is happening under the hood: progress, treasury growth, tax level, and the current rule state that governs the next payment."

### Shot 8: Live tracker and proof

Time: `2:03 - 2:28`

Actions:

1. Open `Tracker`.
2. Pause on status, treasury, and tax.
3. Show `Node Activity Streams`.
4. If useful, click an explorer link from a proof card in `Inspect` or mention the known tx hashes on screen.

Voiceover:

"This is the live proof layer. The tracker reads the X Layer state directly, shows runtime status, treasury value, tax configuration, and recent agent activity. On this rehearsal run, Agentic Wallet was requested, but the recorded execution on this chain still used the manifest-wallet fallback. The important point is that the village is backed by real onchain execution, not mocked events."

### Shot 9: Close on the loop

Time: `2:28 - 2:42`

Actions:

1. Close the drawer by clicking the world.
2. Let the village run for two or three seconds.
3. End on a stable fullscreen frame with agents moving.

Voiceover:

"Bazaar X is a self-governing agent economy on X Layer. Agents transact, taxes route into treasury, governance updates policy, and the next payment obeys the new covenant. It is an explorable onchain economy, not just a static dApp."

## Full Voiceover

"Bazaar X is our X Layer Arena submission. It turns a live X Layer economy into a playable village, so the product feels creative immediately without hiding the real onchain system underneath.

Wallet connection is the only login. Once connected on X Layer testnet, you enter the world directly and watch the economy run through agents, not menu forms.

Every character in the town has a role. The merchant creates demand, the supplier routes work, the worker executes paid contracts, and the governor changes the rules. Their status whispers stay in-world so you can follow the loop without opening panels.

The interface stays light. The world stays visible, and deeper information only slides in when needed. Tapping back into the town collapses the drawer and returns focus to play.

Each district represents a piece of the economy. Inspection reveals the local role, the latest economic state, and the attached proof, whether that is an address or a real transaction.

The whole market loop is organized as a playable quest rail: spawn the economy, deploy the system, run the live round, and then prove governance changed the rules.

The legend teaches the world quickly, while the systems panel explains what is happening under the hood: progress, treasury growth, tax level, and the current rule state that governs the next payment.

This is the live proof layer. The tracker reads the X Layer state directly, shows runtime status, treasury value, tax configuration, and recent agent activity. On this rehearsal run, Agentic Wallet was requested, but the recorded execution on this chain still used the manifest-wallet fallback. The important point is that the village is backed by real onchain execution, not mocked events.

Bazaar X is a self-governing agent economy on X Layer. Agents transact, taxes route into treasury, governance updates policy, and the next payment obeys the new covenant. It is an explorable onchain economy, not just a static dApp."

## Optional Alternate Take

If you want a shorter social cut, keep:

1. Boot and onboarding
2. Living village shot
3. Inspect drawer
4. Tracker drawer
5. Closing world shot

That version should land around `60 to 75 seconds`.

## Delivery Notes

- Keep the cursor calm and intentional.
- Let the movement breathe. Do not rush between drawer sections.
- Pause for one second after each drawer opens.
- If you open an explorer link, hold it for two to three seconds before returning.
- Keep the final shot on the world itself, not a panel.
- Keep the separate skill mention short. This video should feel unmistakably like an `X Layer Arena` app demo.
- Do not explicitly claim `Most active agent` unless you can truthfully back it with `Onchain OS API` transaction execution in the submission materials, because the official special-prize wording is specific.
