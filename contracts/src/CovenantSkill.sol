// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library CovenantSkill {
    error TaxBpsTooHigh();
    error InvalidRuleSet();

    struct PolicyRules {
        uint16 taxBps;
        uint256 minimumBalance;
        uint16 quorumBps;
        uint16 supportBps;
        uint64 votingPeriod;
    }

    struct PolicyPatch {
        bool setTaxBps;
        uint16 taxBps;
        bool setMinimumBalance;
        uint256 minimumBalance;
        bool setQuorumBps;
        uint16 quorumBps;
        bool setSupportBps;
        uint16 supportBps;
        bool setVotingPeriod;
        uint64 votingPeriod;
        bool setTreasury;
        address treasury;
    }

    struct PaymentFrame {
        address payer;
        address recipient;
        address token;
        uint256 amount;
        uint256 payerBalanceBefore;
        uint256 payerBalanceAfter;
    }

    function validate(PolicyRules memory rules) internal pure {
        if (rules.taxBps > 2_000) revert TaxBpsTooHigh();
        if (rules.quorumBps == 0 || rules.quorumBps > 10_000) revert InvalidRuleSet();
        if (rules.supportBps == 0 || rules.supportBps > 10_000) revert InvalidRuleSet();
        if (rules.supportBps < 5_001) revert InvalidRuleSet();
        if (rules.votingPeriod == 0) revert InvalidRuleSet();
    }

    function applyTax(uint256 amount, uint16 taxBps)
        internal
        pure
        returns (uint256 taxAmount, uint256 netAmount)
    {
        if (taxBps > 10_000) revert TaxBpsTooHigh();
        taxAmount = (amount * taxBps) / 10_000;
        netAmount = amount - taxAmount;
    }

    function checkBalanceRules(uint256 balanceAfter, uint256 minimumBalance)
        internal
        pure
        returns (bool)
    {
        return balanceAfter >= minimumBalance;
    }

    function enforcePolicy(PaymentFrame memory frame, PolicyRules memory rules)
        internal
        pure
        returns (uint256 taxAmount, uint256 netAmount, bool allowed)
    {
        if (frame.amount == 0) {
            return (0, 0, false);
        }

        (taxAmount, netAmount) = applyTax(frame.amount, rules.taxBps);
        allowed = checkBalanceRules(frame.payerBalanceAfter, rules.minimumBalance);
    }

    function proposalDigest(
        uint256 proposalId,
        address proposer,
        PolicyPatch memory patch,
        string memory memo
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(proposalId, proposer, patch, keccak256(bytes(memo))));
    }

    function voteDigest(uint256 proposalId, address voter, bool support)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(proposalId, voter, support));
    }

    function executionDigest(
        uint256 proposalId,
        PolicyPatch memory patch,
        uint256 yesVotes,
        uint256 noVotes
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(proposalId, patch, yesVotes, noVotes));
    }

    function canExecute(
        uint256 yesVotes,
        uint256 noVotes,
        uint256 totalAgents,
        uint16 quorumBps,
        uint16 supportBps
    ) internal pure returns (bool) {
        uint256 totalVotes = yesVotes + noVotes;
        if (totalVotes == 0 || totalAgents == 0) {
            return false;
        }

        uint256 participationBps = (totalVotes * 10_000) / totalAgents;
        if (participationBps < quorumBps) {
            return false;
        }

        uint256 supportBpsActual = (yesVotes * 10_000) / totalVotes;
        return supportBpsActual >= supportBps;
    }

    function applyPatch(
        PolicyRules memory currentRules,
        PolicyPatch memory patch,
        address currentTreasury
    ) internal pure returns (PolicyRules memory nextRules, address nextTreasury) {
        nextRules = currentRules;
        nextTreasury = currentTreasury;

        if (patch.setTaxBps) {
            nextRules.taxBps = patch.taxBps;
        }
        if (patch.setMinimumBalance) {
            nextRules.minimumBalance = patch.minimumBalance;
        }
        if (patch.setQuorumBps) {
            nextRules.quorumBps = patch.quorumBps;
        }
        if (patch.setSupportBps) {
            nextRules.supportBps = patch.supportBps;
        }
        if (patch.setVotingPeriod) {
            nextRules.votingPeriod = patch.votingPeriod;
        }
        if (patch.setTreasury) {
            nextTreasury = patch.treasury;
        }

        validate(nextRules);
        if (nextTreasury == address(0)) revert InvalidRuleSet();
    }
}
