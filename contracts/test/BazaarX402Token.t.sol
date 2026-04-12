// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BazaarX402Token} from "../src/BazaarX402Token.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);

    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);

    function warp(uint256 newTimestamp) external;
}

contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 a, uint256 b, string memory message) internal pure {
        require(a == b, message);
    }

    function assertEq(address a, address b, string memory message) internal pure {
        require(a == b, message);
    }

    function assertTrue(bool condition, string memory message) internal pure {
        require(condition, message);
    }
}

contract BazaarX402TokenTest is TestBase {
    BazaarX402Token internal token;

    uint256 internal constant PAYER_PRIVATE_KEY = 0xA11CE;
    address internal payer;
    address internal payee = address(0xBEEF);

    function setUp() public {
        payer = vm.addr(PAYER_PRIVATE_KEY);
        token = new BazaarX402Token("Bazaar Delegation Credit", "BXC", 6, address(this));
        token.mint(payer, 1_000_000_000);
    }

    function testTransferWithAuthorizationSettlesAndPreventsReplay() public {
        uint256 value = 250_000;
        uint256 validAfter = block.timestamp - 1;
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("first-payment");

        bytes32 digest = _digestFor(payer, payee, value, validAfter, validBefore, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PAYER_PRIVATE_KEY, digest);

        bool ok = token.transferWithAuthorization(
            payer,
            payee,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );

        assertTrue(ok, "authorization transfer should succeed");
        assertEq(token.balanceOf(payer), 999_750_000, "payer balance mismatch");
        assertEq(token.balanceOf(payee), value, "payee balance mismatch");
        assertTrue(token.authorizationState(payer, nonce), "nonce should be consumed");

        (bool replayOk,) = address(token).call(
            abi.encodeWithSelector(
                token.transferWithAuthorization.selector,
                payer,
                payee,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            )
        );

        assertTrue(!replayOk, "replay should fail");
    }

    function testTransferWithAuthorizationRejectsExpiredAuth() public {
        uint256 value = 100_000;
        uint256 validAfter = block.timestamp > 10 ? block.timestamp - 10 : 0;
        uint256 validBefore = block.timestamp + 5;
        bytes32 nonce = keccak256("expired-payment");

        bytes32 digest = _digestFor(payer, payee, value, validAfter, validBefore, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PAYER_PRIVATE_KEY, digest);

        vm.warp(validBefore + 1);

        (bool ok,) = address(token).call(
            abi.encodeWithSelector(
                token.transferWithAuthorization.selector,
                payer,
                payee,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            )
        );

        assertTrue(!ok, "expired authorization should fail");
    }

    function _digestFor(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                token.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
    }
}
