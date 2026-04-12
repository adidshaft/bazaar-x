# Bazaar X Judging Strategy

This note turns the official Build X Hackathon rubric into an execution plan for Bazaar X.

## Official Judging Criteria

The official Build X materials do not publish numeric scoring weights.

What they do publish is the review split:
- AI judges inspect `code` and `onchain data`.
- Human judges evaluate `creativity` and `practicality`.
- The submission form requires a public repo, demo link, agentic wallet, OnchainOS usage note, and X post link.

The practical reading is simple:
- The project must work.
- The chain must matter.
- The demo must prove it.
- The UX must make judges instantly understand the loop.

## Special Prize Signals

The public X Layer Arena specials are:
- Most active agent
- Most popular

Bazaar X is shaped to amplify those signals:
- Most active agent: deterministic multi-agent orchestration can generate repeated valid actions without spam.
- Most popular: the product is easy to explain and demo in one loop.

Additional differentiators that strengthen the main judging story:
- A strong economy loop of earn, pay, tax, treasury, vote, and update.
- Clear OnchainOS usage through wallet-aware execution and supported-chain simulation or broadcast when configured.
- A reusable Covenant layer that can extend to paid agent resources.

## Required Deliverables

The Google Form asks for:
- Project name and one-line description
- Project highlights
- Track selection
- Team and contact information
- Agentic wallet address
- Public GitHub repository link
- OnchainOS usage description
- Demo video link
- X post link tagging `@XLayerOfficial` with `#BuildX`

The repo and docs should therefore always include:
- Working code
- Real transaction evidence on X Layer testnet
- Contract address and network info
- A clear README
- A short architecture explanation
- A short demo and social narrative

## What Judges Need To See

The fastest path to a strong score is:
1. Open the app.
2. Show that the agents exist and have wallets.
3. Show a live payment with tax routing.
4. Show treasury accumulation.
5. Show governance.
6. Show that the next transaction changes because the rule changed.
7. Show onchain proof with tx hashes.

If any of those steps is missing, the project reads as a prototype instead of a shipped product.

## X Layer Rationale

Why this project belongs on X Layer:
- It uses X Layer as the settlement plane for the agent economy.
- It treats the chain as product infrastructure, not a decoration.
- It keeps the demo fast because the economy is small, legible, and measurable.
- It gives us a clean reason to show wallet actions, contract deployment, and governance execution.

Chain facts to cite in the README and demo:
- X Layer mainnet chain ID: `196`
- X Layer testnet chain ID: `1952`
- Testnet RPC used during development: `https://testrpc.xlayer.tech/terigon`

## Onchain OS Integration

Use the OKX stack as the proof layer:
- Agentic wallet for real account flows when it is actually logged in and used.
- Gateway for simulation, broadcast, and order tracking on supported chains.
- Payment tooling for x402-compatible gated access if used.
- Wallet-native transfers and contract calls for live execution.

Important honesty rule for submission:

- Bazaar X's recorded public proof is currently on X Layer testnet (`1952`).
- The current `onchainos` CLI exposes `xlayer` as chain `196` by default.
- So if the replay still runs on testnet, the safest claim is: Bazaar X has real X Layer testnet settlement and now supports true Onchain OS gateway execution on supported chains, but the recorded testnet evidence should not be labeled as gateway-broadcasted unless runtime metadata shows it.

The integration story should be explicit in the demo:
- "We did not mock settlement."
- "We can show the transaction hashes."
- Only say "We simulated before broadcast through Onchain OS" when the runtime execution mode actually reports `onchainos-gateway`.

## Bazaar X Architecture

Core modules:
- `BazaarX` contract: shop, service, hire, tax, treasury, governance
- `CovenantSkill`: reusable policy engine
- `agents`: deterministic role-based planners
- `lib/economy`: simulation and ledger logic
- `lib/server`: API layer and artifact-backed live status
- `app`: explorable town and demo surface

The most important product idea is the loop:
- Shop Agent creates demand.
- Supplier Agent offers a service.
- Worker Agent gets hired and paid.
- Tax routes to treasury.
- Governor Agent proposes a rule update.
- Votes execute the update.
- The next transaction reflects the new rule.

## Demo Order

Recommended 1-3 minute demo order:
1. Open with the one-line value proposition.
2. Show the town and agent districts.
3. Trigger the first transaction.
4. Highlight tax and treasury flow.
5. Show governance proposal and voting.
6. Execute the rule change.
7. Show the second transaction proving the new policy is live.
8. End with tx hashes and explorer links.

## Evidence Checklist

Include these artifacts in the submission and README:
- Contract deployment tx hash
- One payment tx hash
- One treasury-related tx hash
- One governance proposal tx hash
- One governance execution tx hash
- Contract address and chain ID
- Explorer links for each critical action

If possible, also include:
- Screenshot of the explorable town
- Short screen recording of the full loop
- A concise note explaining that settlement was live on X Layer testnet and simulation was used only as a safety or preflight step where applicable

## Submission Positioning

The strongest framing is:
- Bazaar X is an autonomous marketplace for agent labor.
- Covenant Skill is the policy layer that keeps the economy solvent.
- X Layer is the settlement layer that makes the whole system real.

That framing is better than a generic "AI agents onchain" pitch because it is concrete, measurable, and easy to judge.
