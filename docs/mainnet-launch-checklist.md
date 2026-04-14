# Mainnet Launch Checklist

Use this runbook only if you decide to deploy Bazaar X on X Layer mainnet before submission.

## Core Rule

Do not blur `testnet-recorded proof` and `mainnet deployment`.

The current canonical demo and tx evidence in this repo are recorded on `X Layer testnet` and must stay labeled that way unless you also create a new canonical mainnet evidence set.

## Before Any Mainnet Move

- Freeze the current testnet submission packet:
  - [README.md](/Users/amanpandey/projects/bazaar-x/README.md)
  - [SCRIPT.md](/Users/amanpandey/projects/bazaar-x/SCRIPT.md)
  - [docs/tx-evidence.md](/Users/amanpandey/projects/bazaar-x/docs/tx-evidence.md)
  - [docs/final-form-answers.md](/Users/amanpandey/projects/bazaar-x/docs/final-form-answers.md)
- Keep the existing testnet tx hashes unchanged in the docs.
- Decide whether the public live app will default to testnet or mainnet.
- Decide whether the demo video remains the current testnet recording or gets re-recorded.

## Mainnet Proof Requirements

Only claim mainnet execution after all of these are true:

- A mainnet contract is deployed and its address is recorded.
- The live app points to that deployment correctly.
- At least one real mainnet flow is executed and captured with explorer links.
- If claiming Agentic Wallet or OnchainOS gateway execution, runtime metadata proves it.
- If claiming x402 on mainnet, the actual facilitator path is documented truthfully.

## Exact Truth-Preserving Wording

If the demo stays testnet but the app deploys on mainnet later, use this wording:

`The demo video and canonical 21-tx replay in this repo were recorded on X Layer testnet on April 12, 2026. A separate mainnet deployment was added later for live access, but the submission's recorded tx evidence remains the testnet artifact unless otherwise linked explicitly.`

If mainnet also proves Agentic Wallet or gateway execution, use this wording only after runtime proof exists:

`Bazaar X includes a mainnet deployment on X Layer. The original demo in this repo is still testnet-recorded, but the runtime metadata for the mainnet deployment separately confirms the execution path used there.`

## Not Allowed

- Do not swap mainnet links into the existing testnet evidence list without relabeling the section.
- Do not say the demo was recorded on mainnet if it was not.
- Do not claim `agentic-wallet` on mainnet unless the runtime artifact records `actualExecutor: agentic-wallet`.
- Do not claim `onchainos-gateway` on mainnet unless the runtime artifact records gateway usage.
- Do not describe x402 as hosted/default support unless that is the path you actually used.

## Update Sequence If Mainnet Ships

1. Add a separate mainnet evidence section or file.
2. Update the live app URL in [docs/final-form-answers.md](/Users/amanpandey/projects/bazaar-x/docs/final-form-answers.md).
3. Add a clear note to [README.md](/Users/amanpandey/projects/bazaar-x/README.md) explaining that the demo artifact is still testnet unless re-recorded.
4. Update [docs/submission-checklist.md](/Users/amanpandey/projects/bazaar-x/docs/submission-checklist.md) with the mainnet decision.
5. If you re-record the demo, update [SCRIPT.md](/Users/amanpandey/projects/bazaar-x/SCRIPT.md) and the demo metadata.
6. Refresh the X post draft so it does not mix testnet hashes and mainnet claims.

## Go / No-Go

Stay testnet-only if:

- You do not have time to capture clean mainnet evidence.
- The demo already tells a complete story with the testnet replay.
- Mainnet would force rushed or ambiguous wording.

Ship a separate mainnet deployment only if:

- It materially helps live judging access.
- The proof and copy can stay clearly separated.
- You can still keep every claim in the README and form answers fully literal.
