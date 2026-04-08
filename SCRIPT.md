# Bazaar X Demo Video Script

Recommended runtime: 2:15 to 3:00

This script is optimized for a clean judge-facing recording of the current dashboard state. It uses the existing completed X Layer run so you do not have to risk a failed take by waiting on fresh transactions.

## Recording Goal

Show three things clearly:

1. Bazaar X is a live autonomous agent economy on X Layer.
2. Real transactions happened onchain across hiring, tax, governance, and treasury reinvestment.
3. Governance changed the rules, and the next payment obeyed the updated covenant.

## Pre-Recording Checklist

1. Run `pnpm dev`.
2. Open the app full-screen on desktop.
3. Make sure the header shows `testnet` and `chain 1952`.
4. Make sure the dashboard is loaded and `Runtime status` is `completed`.
5. Make sure `Tracked txs` shows `35`.
6. Optional: connect a wallet on X Layer testnet if you want the viewer wallet box to look active.

## Proof Points To Call Out

- Contract: `0xb0acab0deab3941be2aab4ca3969c2a5c3e710b2`
- Treasury: `0xA90447Cb62B91467e45CC37e8B6020Dfd744f648`
- Recorded run: `35` tx hashes
- Governance execution: `0x7cd272821bb70dd5d67975cbd7575cfb4ba2cf9e47b6f4aec1438deb1ac0fe4f`
- Post-governance payment: `0x5eadb3acea372dd60cf9509cd839c3bdc614d21d8d5f814fef1ec263ecfce6f2`
- Treasury reinvestment: `0x33645440dea97d2d6a8a1b0088c5a329b7075db56030b9670cb4116928c17793`
- Current live rules: `8.00%` tax, `0.0015 OKB` minimum balance, `75%` quorum, `60%` support, `10s` voting window

## Click-By-Click Script

### Shot 1: Hero and positioning

Time: `0:00 - 0:15`

Clicks:

1. Start on the top of the homepage.
2. Keep the hero, proof chips, and top stat cards in frame.
3. Do not scroll yet.

Transcript:

"This is Bazaar X, a self-governing autonomous agent economy built on X Layer. The core loop is simple: agents earn, pay, tax, reinvest, and then govern the policy that affects the next transaction."

### Shot 2: Refresh and establish live proof

Time: `0:15 - 0:30`

Clicks:

1. Click `Refresh status`.
2. Move the cursor across `Live contract`, `Treasury reserve`, `Tracked txs`, and `Runtime status`.

Transcript:

"What matters here is that this is not a mock dashboard. The app is loading a real recorded X Layer run, with a live contract, a treasury balance, 35 tracked transactions, and a completed runtime."

### Shot 3: Contract, treasury, and covenant proof cards

Time: `0:30 - 0:45`

Clicks:

1. Move the cursor over the `Contract` proof card.
2. Move to the `Treasury` proof card.
3. Move to the `Covenant` proof card.
4. Move to the `Run status` proof card.

Transcript:

"The contract is live on X Layer testnet, the treasury is funded from real tax flow, and the covenant rules are visible in the same interface. Judges can verify all of this from the dashboard and the linked explorer receipts."

### Shot 4: Agent economy

Time: `0:45 - 1:10`

Clicks:

1. Scroll to `Agent economy`.
2. Click `Bazaar Forge`.
3. Click `Supply Coil`.
4. Click `Node Pilot`.
5. Click `Covenant Council`.
6. Pause on the selected agent panel.

Transcript:

"These are the four economic actors. Bazaar Forge opens demand, Supply Coil fulfills and routes work, Node Pilot performs paid labor, and Covenant Council steers governance. Each agent has a wallet, a role, and a latest onchain action tied back to the economy loop."

### Shot 5: Covenant Skill

Time: `1:10 - 1:22`

Clicks:

1. Keep the `Selected agent` panel visible.
2. Move the cursor to the `Covenant Skill` module.
3. Slowly pass over the listed functions.

Transcript:

"The reusable piece is Covenant Skill. It enforces policy, checks balance rules, applies tax, creates proposals, records votes, and executes rule changes. That makes the policy engine portable beyond this single demo."

### Shot 6: Governance panel

Time: `1:22 - 1:40`

Clicks:

1. Move to the `Governance` panel.
2. Click the active proposal card.
3. Hold the cursor over the proposal title and status.

Transcript:

"Governance is not decorative here. Proposal two raises the covenant tax to 8 percent, and the voting flow is completed onchain. This is how the economy changes its own rules instead of relying on hardcoded admin updates."

### Shot 7: Execution timeline

Time: `1:40 - 2:05`

Clicks:

1. Scroll to `Execution timeline`.
2. Pause on `Propose tax update`.
3. Pause on `Execute governance update`.
4. Pause on `Post-governance payment`.
5. Pause on `Treasury reinvests`.
6. Click the tx hash for `Execute governance update` to open the explorer in a new tab.
7. Show the explorer briefly, then return to the dashboard.

Transcript:

"The timeline makes the proof legible. You can see the proposal, the votes, the execution, the next payment after governance, and then treasury reinvestment. The governance execution transaction is onchain, and the explorer link makes that immediately verifiable."

### Shot 8: Transaction feed and live rules

Time: `2:05 - 2:30`

Clicks:

1. In `Transaction feed`, point to the items for governance execution, post-governance payment, and treasury reinvestment if visible.
2. Move to `Live rules`.
3. Hold on `Tax rate`, `Minimum balance`, and `Voting window`.

Transcript:

"The current live rules now show an 8 percent tax, a 0.0015 OKB minimum balance, 75 percent quorum, 60 percent support, and a 10 second voting window. The important part is that the market loop and the governance layer are connected, and the next transaction obeys the updated rules."

### Shot 9: Close

Time: `2:30 - 2:45`

Clicks:

1. Scroll just enough to keep `Transaction feed` and `Live rules` visible together, or return to the upper proof cards if that looks cleaner in your recording.
2. End on a stable frame.

Transcript:

"Bazaar X is a live agent economy on X Layer, not just a static dApp. Agents transact, treasury grows through tax, governance executes onchain, and covenant rules shape the next payment. That is the full loop."

## Full Voiceover Transcript

Use this if you want one continuous read instead of per-shot lines:

"This is Bazaar X, a self-governing autonomous agent economy built on X Layer. The core loop is simple: agents earn, pay, tax, reinvest, and then govern the policy that affects the next transaction.

What matters here is that this is not a mock dashboard. The app is loading a real recorded X Layer run, with a live contract, a treasury balance, 35 tracked transactions, and a completed runtime.

The contract is live on X Layer testnet, the treasury is funded from real tax flow, and the covenant rules are visible in the same interface. Judges can verify all of this from the dashboard and the linked explorer receipts.

These are the four economic actors. Bazaar Forge opens demand, Supply Coil fulfills and routes work, Node Pilot performs paid labor, and Covenant Council steers governance. Each agent has a wallet, a role, and a latest onchain action tied back to the economy loop.

The reusable piece is Covenant Skill. It enforces policy, checks balance rules, applies tax, creates proposals, records votes, and executes rule changes. That makes the policy engine portable beyond this single demo.

Governance is not decorative here. Proposal two raises the covenant tax to 8 percent, and the voting flow is completed onchain. This is how the economy changes its own rules instead of relying on hardcoded admin updates.

The timeline makes the proof legible. You can see the proposal, the votes, the execution, the next payment after governance, and then treasury reinvestment. The governance execution transaction is onchain, and the explorer link makes that immediately verifiable.

The current live rules now show an 8 percent tax, a 0.0015 OKB minimum balance, 75 percent quorum, 60 percent support, and a 10 second voting window. The important part is that the market loop and the governance layer are connected, and the next transaction obeys the updated rules.

Bazaar X is a live agent economy on X Layer, not just a static dApp. Agents transact, treasury grows through tax, governance executes onchain, and covenant rules shape the next payment. That is the full loop." 

## Optional Live Replay Take

Use this only if you want a second, more dynamic recording and the environment is funded and stable.

### Live replay clicks

1. Click `Initialize agents`.
2. Click `Load live contract` if it is available. If the contract is not already loaded, click `Deploy live contract`.
3. Click `Run live X Layer flow`.
4. Keep the camera on `Execution timeline` as steps appear.
5. Call out these steps as they land:
   - `Supplier hires worker`
   - `Shop hires supplier`
   - `Propose tax update`
   - `Execute governance update`
   - `Post-governance payment`
   - `Treasury reinvests`

### Live replay short transcript

"Now I am replaying the full market and governance loop live. The app is registering agents, listing services, settling hires onchain, proposing a covenant update, executing it, and then showing the post-governance payment and treasury reinvestment in one flow."

## Delivery Notes

- Speak a little slower than feels natural.
- Keep the cursor steady. Do not wave it around.
- Pause for one second after each major click.
- If the explorer tab loads slowly, stay calm and let the proof page sit for two to three seconds.
- If you only have time for a 90-second cut, keep Shots 1, 2, 4, 7, 8, and 9.
