// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BazaarX} from "../src/BazaarX.sol";
import {CovenantSkill} from "../src/CovenantSkill.sol";
import {IBazaarPaymentHook} from "../src/interfaces/IBazaarPaymentHook.sol";

interface Vm {
    function deal(address who, uint256 newBalance) external;

    function prank(address who) external;

    function startPrank(address who) external;

    function stopPrank() external;

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

contract MockHook is IBazaarPaymentHook {
    uint256 public callCount;
    address public lastPayer;
    address public lastProvider;
    address public lastToken;
    uint256 public lastGross;
    uint256 public lastTax;
    uint256 public lastNet;
    bytes32 public lastDataHash;

    function onBazaarPayment(
        address payer,
        address provider,
        address token,
        uint256 grossAmount,
        uint256 taxAmount,
        uint256 netAmount,
        bytes calldata data
    ) external returns (bytes4) {
        callCount += 1;
        lastPayer = payer;
        lastProvider = provider;
        lastToken = token;
        lastGross = grossAmount;
        lastTax = taxAmount;
        lastNet = netAmount;
        lastDataHash = keccak256(data);
        return IBazaarPaymentHook.onBazaarPayment.selector;
    }
}

contract BazaarXTest is TestBase {
    BazaarX internal bazaar;
    MockHook internal hook;

    address internal treasury = address(0xA11CE);
    address internal shopAgent = address(0x1001);
    address internal supplierAgent = address(0x1002);
    address internal workerAgent = address(0x1003);
    address internal governorAgent = address(0x1004);
    address internal buyerAgent = address(0x1005);

    function setUp() public {
        CovenantSkill.PolicyRules memory rules = CovenantSkill.PolicyRules({
            taxBps: 500,
            minimumBalance: 0.01 ether,
            quorumBps: 6_000,
            supportBps: 5_001,
            votingPeriod: 120
        });
        bazaar = new BazaarX(treasury, rules);
        hook = new MockHook();

        vm.deal(shopAgent, 10 ether);
        vm.deal(supplierAgent, 10 ether);
        vm.deal(workerAgent, 10 ether);
        vm.deal(governorAgent, 10 ether);
        vm.deal(buyerAgent, 10 ether);

        vm.prank(shopAgent);
        bazaar.registerAgent("Shop Agent");
        vm.prank(supplierAgent);
        bazaar.registerAgent("Supplier Agent");
        vm.prank(workerAgent);
        bazaar.registerAgent("Worker Agent");
        vm.prank(governorAgent);
        bazaar.registerAgent("Governor Agent");
        vm.prank(buyerAgent);
        bazaar.registerAgent("Buyer Agent");
    }

    function testEndToEndNativeHireTaxAndGovernanceUpdate() public {
        vm.prank(shopAgent);
        uint256 shopId = bazaar.createShop("Bazaar Shop", "ipfs://shop");
        assertEq(shopId, 1, "shop id should start at 1");
        (address shopOwner, string memory shopName,,,) = bazaar.getShop(shopId);
        assertEq(shopOwner, shopAgent, "shop owner mismatch");
        assertTrue(bytes(shopName).length != 0, "shop name should exist");

        vm.prank(supplierAgent);
        uint256 supplierShopId = bazaar.createShop("Supplier Shop", "ipfs://supplier-shop");

        vm.prank(supplierAgent);
        uint256 serviceId =
            bazaar.listService(
                supplierShopId,
                "Onchain fulfillment",
                "ipfs://service",
                1 ether,
                address(0),
                address(hook),
                true
            );

        uint256 treasuryBefore = treasury.balance;
        uint256 providerBefore = supplierAgent.balance;

        vm.prank(buyerAgent);
        uint256 jobId = bazaar.hireService{value: 1 ether}(serviceId, bytes("first-job"));

        assertTrue(jobId == 1, "job id should start at 1");
        assertEq(hook.callCount(), 1, "hook should be called once");
        assertEq(hook.lastPayer(), buyerAgent, "hook payer mismatch");
        assertEq(hook.lastProvider(), supplierAgent, "hook provider mismatch");
        assertEq(treasury.balance, treasuryBefore + 0.05 ether, "treasury tax mismatch");
        assertEq(supplierAgent.balance, providerBefore + 0.95 ether, "provider payout mismatch");

        CovenantSkill.PolicyPatch memory patch = CovenantSkill.PolicyPatch({
            setTaxBps: true,
            taxBps: 1_000,
            setMinimumBalance: true,
            minimumBalance: 0.005 ether,
            setQuorumBps: false,
            quorumBps: 0,
            setSupportBps: false,
            supportBps: 0,
            setVotingPeriod: false,
            votingPeriod: 0,
            setTreasury: false,
            treasury: address(0)
        });

        vm.prank(governorAgent);
        uint256 proposalId = bazaar.proposeRuleChange(patch, "Raise the tax for the next cycle");

        vm.prank(shopAgent);
        bazaar.vote(proposalId, true);
        vm.prank(supplierAgent);
        bazaar.vote(proposalId, true);
        vm.prank(workerAgent);
        bazaar.vote(proposalId, true);

        vm.warp(block.timestamp + 121);

        vm.prank(governorAgent);
        bool passed = bazaar.executeChange(proposalId);
        assertTrue(passed, "proposal should pass");

        (uint16 taxBps, uint256 minimumBalance,,,) = bazaar.getRules();
        assertEq(uint256(taxBps), 1_000, "tax update missing");
        assertEq(minimumBalance, 0.005 ether, "minimum balance update missing");

        uint256 treasuryBeforeSecond = treasury.balance;
        uint256 providerBeforeSecond = supplierAgent.balance;

        vm.prank(buyerAgent);
        bazaar.hireService{value: 1 ether}(serviceId, bytes("second-job"));

        assertEq(treasury.balance, treasuryBeforeSecond + 0.1 ether, "updated tax not applied");
        assertEq(providerBeforeSecond + 0.9 ether, supplierAgent.balance, "updated payout mismatch");
    }

    function testNativeHireAllowsTightButValidBalance() public {
        vm.deal(supplierAgent, 0.04 ether);
        vm.deal(workerAgent, 0.02 ether);

        vm.prank(workerAgent);
        uint256 shopId = bazaar.createShop("Worker Shop", "ipfs://worker-shop");

        vm.prank(workerAgent);
        uint256 serviceId =
            bazaar.listService(
                shopId,
                "Tight balance labor",
                "ipfs://tight-service",
                0.02 ether,
                address(0),
                address(0),
                false
            );

        vm.prank(supplierAgent);
        bazaar.hireService{value: 0.02 ether}(serviceId, bytes(""));

        assertEq(treasury.balance, 0.001 ether, "treasury tax should still route");
        assertEq(workerAgent.balance, 0.039 ether, "worker should receive the net payout");
    }
}
