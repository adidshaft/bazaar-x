# Final X Post Drafts

Use these thread drafts instead of the older single-post notes.

Important truth rule:

- The public demo is still the `X Layer testnet` walkthrough.
- Bazaar X now also has a separate completed `X Layer mainnet` proof run.
- Do not claim `actualExecutor: agentic-wallet`.
- Do not claim `onchainos-gateway` execution.
- Do not describe the x402 path as hosted/default facilitator support on X Layer testnet.

## Bazaar X Main Thread

Recommended attachment order:

1. Demo clip thumbnail or strongest village screenshot
2. One `Proof` surface screenshot
3. One explorer screenshot or cropped tx proof image

### Post 1

Bazaar X is our `X Layer Arena` entry for `#BuildX` with `@XLayerOfficial`.

It turns an onchain agent economy into an explorable pixel village where agents open shops, hire suppliers, auto-tax into treasury, vote on covenant changes, and replay the next settlement under the new rule.

Thread below.

### Post 2

What makes it different is the shape of the product.

This is not a contract dashboard with a few receipts glued on top.

It is a playable world with separate `Quests`, `Proof`, and `Ops` surfaces, so human judges can understand the loop fast while AI judges can still inspect the code and tx evidence.

### Post 3

The core loop is real:

`earn -> pay -> tax -> treasury -> vote -> rule update -> next payment`

The public demo shows the canonical X Layer testnet replay, including:
- Uniswap-backed supplier route
- supplier settlement
- governance execution
- treasury reinvestment
- x402-paid delegation proof

### Post 4

Bazaar X is now also live on `X Layer mainnet` with a separate completed proof run.

Mainnet contract:
`0x6a5a4a2e6f9111c584d80877f13e90aba9730ea9`

That run includes deploy, supplier route, settlement, governance execution, post-governance payment, and treasury reinvestment. The README now links the important txs directly.

### Post 5

We also kept the autonomy story honest.

The runtime records requested executor vs actual executor.

In the canonical replay, `agentic-wallet` was requested, but the recorded autonomous executor is still `manifest-wallet` fallback. The app shows that directly in `Ops` instead of overstating what happened.

### Post 6

We are also submitting `Covenant Skill` separately for `Skills Arena`.

That package extracts Bazaar X policy, tax, treasury, and governance logic into a reusable TypeScript skill that another project can install without importing the app shell.

### Post 7

Links:

Live app: https://bazaar-x-ten.vercel.app
Repo: https://github.com/adidshaft/bazaar-x
Demo: https://drive.google.com/file/d/1oVJtDceddJ6odSeMovJNVJATwuvjNSZ7/view?usp=sharing

`#BuildX` `@XLayerOfficial`

## Bazaar X Shorter Thread

Use this if you want fewer posts.

### Post 1

Bazaar X is our `X Layer Arena` entry for `#BuildX`.

It is an explorable pixel village on X Layer where agents open shops, route supplier work, auto-tax into treasury, vote on covenant changes, and replay the next settlement under the new rule.

### Post 2

The public demo is the clean canonical X Layer testnet replay with real receipts for:
- supplier route swap
- settlement
- governance execution
- treasury reinvestment
- x402-paid delegation

### Post 3

Bazaar X now also has a separate completed `X Layer mainnet` proof run at:
`0x6a5a4a2e6f9111c584d80877f13e90aba9730ea9`

We kept the runtime story honest too: requested `agentic-wallet`, recorded `manifest-wallet` fallback.

### Post 4

Live app: https://bazaar-x-ten.vercel.app
Repo: https://github.com/adidshaft/bazaar-x
Demo: https://drive.google.com/file/d/1oVJtDceddJ6odSeMovJNVJATwuvjNSZ7/view?usp=sharing

Also submitting `Covenant Skill` separately for `Skills Arena`.

`#BuildX` `@XLayerOfficial`

## Bazaar X Single Starter Post

Use this as the opener if you want to freestyle the replies yourself.

Bazaar X is our `X Layer Arena` entry for `#BuildX`: an explorable pixel village on X Layer where agents earn, pay, tax, govern, and settle with real receipts. The public demo is a clean testnet replay, and the product now also has a separate completed mainnet proof run. Repo, app, and demo in thread. `@XLayerOfficial`

## Covenant Skill Thread

Recommended if you want a separate `Skills Arena` post.

### Post 1

Covenant Skill is our `Skills Arena` entry for `#BuildX`.

It extracts Bazaar X policy, tax, treasury, and governance logic into an installable TypeScript package that another project can use without importing the Bazaar X app shell.

### Post 2

The package exposes reusable primitives like:

`createDefaultPolicy`
`applyTax`
`checkBalanceRules`
`enforcePolicy`
`proposeChange`
`vote`
`executeChange`

### Post 3

It is not just source code sitting in the repo.

It builds to typed output, installs into a clean-room consumer from a packed tarball, and ships with usage examples and test coverage.

### Post 4

Repo: https://github.com/adidshaft/bazaar-x
Package docs: https://github.com/adidshaft/bazaar-x/tree/main/covenant-skill
Shared demo: https://drive.google.com/file/d/1oVJtDceddJ6odSeMovJNVJATwuvjNSZ7/view?usp=sharing

`#BuildX` `@XLayerOfficial`

## Posting Notes

- Lead with the strongest village visual, not a code screenshot.
- If you can, make `Post 1` a clip or image tweet.
- Keep the Bazaar X thread focused on the app. Mention Covenant Skill only once near the end.
- If you post both threads, post Bazaar X first, then Covenant Skill.
- After publishing, paste the Bazaar X thread URL into [docs/final-form-answers.md](/Users/amanpandey/projects/bazaar-x/docs/final-form-answers.md).
