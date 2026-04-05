// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBazaarPaymentHook {
    function onBazaarPayment(
        address payer,
        address provider,
        address token,
        uint256 grossAmount,
        uint256 taxAmount,
        uint256 netAmount,
        bytes calldata data
    ) external returns (bytes4);
}
