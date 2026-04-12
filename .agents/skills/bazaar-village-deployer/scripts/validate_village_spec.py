#!/usr/bin/env python3
import argparse
import json
import re
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

CORE_ROLES = ("shop", "supplier", "worker", "governor")
ALLOWED_ROLES = set(CORE_ROLES)
ALLOWED_SERVICE_KINDS = {"labor", "supply", "operations"}
ALLOWED_MAPS_MODE = {"reuse-current", "add-new"}
ALLOWED_SKILL_STRATEGIES = {"reuse-covenant", "new-world-skill"}
CANONICAL_LOOP = {
    "earn",
    "pay",
    "tax",
    "treasury",
    "vote",
    "rule-update",
    "next-payment",
}
HYPHENATED_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
WHOLE_NUMBER = re.compile(r"^(0|[1-9][0-9]*)$")


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def is_positive_decimal(raw):
    if not isinstance(raw, str):
        return False
    try:
        return Decimal(raw) > 0
    except (InvalidOperation, ValueError):
        return False


def require_dict(parent, key, errors):
    value = parent.get(key)
    if not isinstance(value, dict):
        errors.append(f'"{key}" must be an object.')
        return {}
    return value


def require_list(parent, key, errors):
    value = parent.get(key)
    if not isinstance(value, list):
        errors.append(f'"{key}" must be an array.')
        return []
    return value


def require_string(parent, key, errors):
    value = parent.get(key)
    if not isinstance(value, str) or not value.strip():
        errors.append(f'"{key}" must be a non-empty string.')
        return ""
    return value.strip()


def require_int(parent, key, errors):
    value = parent.get(key)
    if not isinstance(value, int):
        errors.append(f'"{key}" must be an integer.')
        return 0
    return value


def validate_village(root, errors, warnings):
    village = require_dict(root, "village", errors)
    village_id = require_string(village, "id", errors)
    if village_id and not HYPHENATED_ID.fullmatch(village_id):
        errors.append('"village.id" must be lower-case hyphen-case.')

    require_string(village, "name", errors)
    require_string(village, "theme", errors)
    require_string(village, "charter", errors)

    maps_mode = require_string(village, "maps_mode", errors)
    if maps_mode and maps_mode not in ALLOWED_MAPS_MODE:
        errors.append('"village.maps_mode" must be "reuse-current" or "add-new".')
    elif maps_mode == "add-new":
        warnings.append(
            "New map mode selected: update game/core/live-types.ts, game/data/world.ts, "
            "game/maps/manifest.ts, and compiled/tiled map assets."
        )


def validate_economy(root, errors, warnings):
    economy = require_dict(root, "economy", errors)
    strategy = require_string(economy, "skill_strategy", errors)
    if strategy and strategy not in ALLOWED_SKILL_STRATEGIES:
        errors.append('"economy.skill_strategy" must be "reuse-covenant" or "new-world-skill".')

    loop = require_list(economy, "loop", errors)
    missing_steps = sorted(CANONICAL_LOOP.difference(loop))
    if missing_steps:
        errors.append(
            '"economy.loop" must include the Bazaar loop steps: '
            + ", ".join(missing_steps)
            + "."
        )

    require_string(economy, "primary_good", errors)

    services = require_list(economy, "services", errors)
    if not services:
        errors.append('"economy.services" must contain at least one service.')

    seen_service_ids = set()
    for index, service in enumerate(services):
        if not isinstance(service, dict):
            errors.append(f'"economy.services[{index}]" must be an object.')
            continue

        service_id = require_string(service, "id", errors)
        if service_id:
            if not HYPHENATED_ID.fullmatch(service_id):
                errors.append(f'"economy.services[{index}].id" must be lower-case hyphen-case.')
            if service_id in seen_service_ids:
                errors.append(f'Duplicate service id "{service_id}".')
            seen_service_ids.add(service_id)

        require_string(service, "title", errors)
        provider_role = require_string(service, "provider_role", errors)
        buyer_role = require_string(service, "buyer_role", errors)
        if provider_role and provider_role not in ALLOWED_ROLES:
            errors.append(f'"economy.services[{index}].provider_role" must be one of {", ".join(CORE_ROLES)}.')
        if buyer_role and buyer_role not in ALLOWED_ROLES:
            errors.append(f'"economy.services[{index}].buyer_role" must be one of {", ".join(CORE_ROLES)}.')

        kind = require_string(service, "kind", errors)
        if kind and kind not in ALLOWED_SERVICE_KINDS:
            errors.append(
                f'"economy.services[{index}].kind" must be one of {", ".join(sorted(ALLOWED_SERVICE_KINDS))}.'
            )

        price_okb = require_string(service, "price_okb", errors)
        if price_okb and not is_positive_decimal(price_okb):
            errors.append(f'"economy.services[{index}].price_okb" must be a positive decimal string.')

    if strategy == "new-world-skill":
        warnings.append(
            "New world skill requested: inspect docs/skills.md and register the module in lib/economy/skills.ts."
        )


def validate_agents(root, errors):
    agents = require_list(root, "agents", errors)
    if len(agents) != len(CORE_ROLES):
        errors.append('"agents" must contain exactly the four core roles used by the current runtime.')

    roles = []
    for index, agent in enumerate(agents):
        if not isinstance(agent, dict):
            errors.append(f'"agents[{index}]" must be an object.')
            continue

        role = require_string(agent, "role", errors)
        if role and role not in ALLOWED_ROLES:
            errors.append(f'"agents[{index}].role" must be one of {", ".join(CORE_ROLES)}.')
        roles.append(role)

        require_string(agent, "name", errors)
        require_string(agent, "goal", errors)

        bootstrap_okb = require_string(agent, "bootstrap_okb", errors)
        if bootstrap_okb and not is_positive_decimal(bootstrap_okb):
            errors.append(f'"agents[{index}].bootstrap_okb" must be a positive decimal string.')

    for role in CORE_ROLES:
        count = roles.count(role)
        if count != 1:
            errors.append(f'Expected exactly one "{role}" agent, found {count}.')


def validate_policy(root, errors, warnings):
    policy = require_dict(root, "policy", errors)

    tax_bps = require_int(policy, "tax_bps", errors)
    min_agent_balance = require_int(policy, "min_agent_balance", errors)
    proposal_approval_bps = require_int(policy, "proposal_approval_bps", errors)
    proposal_quorum = require_int(policy, "proposal_quorum", errors)
    execution_delay_ticks = require_int(policy, "execution_delay_ticks", errors)
    min_treasury_balance = require_int(policy, "min_treasury_balance", errors)
    tax_cap_bps = require_int(policy, "tax_cap_bps", errors)

    if min_agent_balance < 0:
        errors.append('"policy.min_agent_balance" must be >= 0.')
    if proposal_approval_bps < 0 or proposal_approval_bps > 10_000:
        errors.append('"policy.proposal_approval_bps" must be between 0 and 10000.')
    if proposal_quorum < 1:
        errors.append('"policy.proposal_quorum" must be >= 1.')
    if execution_delay_ticks < 0:
        errors.append('"policy.execution_delay_ticks" must be >= 0.')
    if min_treasury_balance < 0:
        errors.append('"policy.min_treasury_balance" must be >= 0.')
    if tax_cap_bps < 0 or tax_cap_bps > 2500:
        errors.append('"policy.tax_cap_bps" must be between 0 and 2500.')
    if tax_bps < 0:
        errors.append('"policy.tax_bps" must be >= 0.')
    if tax_bps > tax_cap_bps:
        errors.append('"policy.tax_bps" cannot exceed "policy.tax_cap_bps".')
    if tax_bps > 2000:
        warnings.append(
            "Policy tax exceeds 2000 bps. Offchain Covenant allows this, but contracts/src/CovenantSkill.sol rejects it."
        )
    if tax_cap_bps > 2000:
        warnings.append(
            "policy.tax_cap_bps is above the live contract limit. Keep tax ceilings at or below 2000 for sim/live parity."
        )


def validate_onchain(root, errors, warnings):
    onchain = require_dict(root, "onchain", errors)
    deploy = onchain.get("deploy")
    if not isinstance(deploy, bool):
        errors.append('"onchain.deploy" must be a boolean.')
        deploy = False

    initial_rules = require_dict(onchain, "initial_rules", errors)
    tax_bps = require_int(initial_rules, "tax_bps", errors)
    minimum_balance_wei = require_string(initial_rules, "minimum_balance_wei", errors)
    quorum_bps = require_int(initial_rules, "quorum_bps", errors)
    support_bps = require_int(initial_rules, "support_bps", errors)
    voting_period_seconds = require_int(initial_rules, "voting_period_seconds", errors)

    if tax_bps < 0 or tax_bps > 2000:
        errors.append('"onchain.initial_rules.tax_bps" must be between 0 and 2000.')
    if minimum_balance_wei and not WHOLE_NUMBER.fullmatch(minimum_balance_wei):
        errors.append('"onchain.initial_rules.minimum_balance_wei" must be a whole-number string in wei.')
    if quorum_bps < 1 or quorum_bps > 10_000:
        errors.append('"onchain.initial_rules.quorum_bps" must be between 1 and 10000.')
    if support_bps < 5001 or support_bps > 10_000:
        errors.append('"onchain.initial_rules.support_bps" must be between 5001 and 10000.')
    if voting_period_seconds <= 0:
        errors.append('"onchain.initial_rules.voting_period_seconds" must be > 0.')

    policy = root.get("policy", {})
    if isinstance(policy, dict):
        policy_tax = policy.get("tax_bps")
        if isinstance(policy_tax, int) and policy_tax != tax_bps:
            warnings.append(
                "policy.tax_bps and onchain.initial_rules.tax_bps differ. Align them if the village should simulate and deploy the same tax rate."
            )

    if deploy:
        warnings.append(
            "Live deploy requested: current runtime writes to shared .bazaarx/runtime/*/latest.json paths unless artifact env vars are namespaced."
        )


def main():
    parser = argparse.ArgumentParser(description="Validate a Bazaar X village specification JSON file.")
    parser.add_argument("spec", help="Path to the village spec JSON file.")
    args = parser.parse_args()

    path = Path(args.spec).expanduser().resolve()
    if not path.exists():
        print(f"[ERROR] Spec file not found: {path}")
        return 1

    try:
        payload = load_json(path)
    except json.JSONDecodeError as exc:
        print(f"[ERROR] Invalid JSON: {exc}")
        return 1

    if not isinstance(payload, dict):
        print("[ERROR] Root payload must be a JSON object.")
        return 1

    errors = []
    warnings = []

    validate_village(payload, errors, warnings)
    validate_economy(payload, errors, warnings)
    validate_agents(payload, errors)
    validate_policy(payload, errors, warnings)
    validate_onchain(payload, errors, warnings)

    if errors:
        print("Village spec validation failed.")
        for message in errors:
            print(f"- ERROR: {message}")
        if warnings:
            for message in warnings:
                print(f"- WARN: {message}")
        return 1

    print("Village spec validation passed.")
    for message in warnings:
        print(f"- WARN: {message}")

    print("- NEXT: Read references/global-village-invariants.md before editing code.")
    print("- NEXT: Use references/repo-touchpoints.md to pick the narrowest file-change surface.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
