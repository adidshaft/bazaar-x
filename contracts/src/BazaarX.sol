// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CovenantSkill} from "./CovenantSkill.sol";
import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {IBazaarPaymentHook} from "./interfaces/IBazaarPaymentHook.sol";

contract BazaarX {
    using CovenantSkill for CovenantSkill.PolicyRules;

    error NotRegistered();
    error Unauthorized();
    error InvalidInput();
    error InactiveShop();
    error InactiveService();
    error BadPaymentAmount();
    error MinimumBalanceViolation();
    error PaymentAssetMismatch();
    error ProposalNotReady();
    error VotingClosed();
    error AlreadyVoted();
    error Reentrancy();
    error HookFailed();
    error InvalidHookResponse();
    error TreasuryTransferFailed();
    error ProviderTransferFailed();

    uint8 private constant ROLE_SHOP = 1;
    uint8 private constant ROLE_SUPPLIER = 2;
    uint8 private constant ROLE_WORKER = 4;
    uint8 private constant ROLE_GOVERNOR = 8;
    uint8 private constant ROLE_BUYER = 16;

    struct AgentProfile {
        bool registered;
        string handle;
        uint64 joinedAt;
        uint256 totalEarned;
        uint256 totalSpent;
        uint256 shopsCreated;
        uint256 servicesCreated;
        uint256 jobsCompleted;
        uint256 votesCast;
        uint8 roles;
    }

    struct Shop {
        address owner;
        string name;
        string metadataURI;
        bool active;
        uint256 serviceCount;
    }

    struct Service {
        uint256 shopId;
        address provider;
        string title;
        string metadataURI;
        uint256 price;
        address paymentToken;
        address hookTarget;
        bool hookRequired;
        bool active;
    }

    struct Proposal {
        address proposer;
        uint64 createdAt;
        uint64 votingEndsAt;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
        string memo;
        CovenantSkill.PolicyPatch patch;
        bytes32 digest;
    }

    CovenantSkill.PolicyRules private _rules;
    address public treasury;

    uint256 public registeredAgentCount = 0;
    uint256 public nextShopId = 1;
    uint256 public nextServiceId = 1;
    uint256 public nextProposalId = 1;
    uint256 public nextJobId = 1;

    mapping(address => AgentProfile) private _agents;
    mapping(uint256 => Shop) private _shops;
    mapping(uint256 => Service) private _services;
    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    mapping(address => uint256) public treasuryAccruedNative;
    mapping(address => uint256) public treasuryAccruedToken;

    bool private _locked;

    event AgentRegistered(address indexed agent, string handle);
    event AgentHandleUpdated(address indexed agent, string handle);
    event AgentRoleUpdated(address indexed agent, uint8 roles);
    event ShopCreated(
        uint256 indexed shopId,
        address indexed owner,
        string name,
        string metadataURI
    );
    event ServiceListed(
        uint256 indexed serviceId,
        uint256 indexed shopId,
        address indexed provider,
        string title,
        uint256 price,
        address paymentToken,
        address hookTarget,
        bool hookRequired
    );
    event ServiceHired(
        uint256 indexed jobId,
        uint256 indexed serviceId,
        address indexed hirer,
        address provider,
        address paymentToken,
        uint256 grossAmount,
        uint256 taxAmount,
        uint256 netAmount,
        address hookTarget,
        bool hookSuccess,
        bytes32 hookDataHash
    );
    event PolicyGuardTriggered(
        address indexed account,
        address indexed token,
        uint256 balanceAfter,
        uint256 minimumBalance
    );
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        bytes32 digest,
        uint64 votingEndsAt,
        string memo
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 yesVotes,
        uint256 noVotes
    );
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event RuleUpdated(
        uint256 indexed proposalId,
        uint16 taxBps,
        uint256 minimumBalance,
        uint16 quorumBps,
        uint16 supportBps,
        uint64 votingPeriod,
        address treasury
    );
    event TreasuryCredited(address indexed token, uint256 amount, address indexed payer);

    modifier onlyRegistered() {
        if (!_agents[msg.sender].registered) revert NotRegistered();
        _;
    }

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    constructor(address treasury_, CovenantSkill.PolicyRules memory initialRules) {
        if (treasury_ == address(0)) revert InvalidInput();
        CovenantSkill.validate(initialRules);
        treasury = treasury_;
        _rules = initialRules;
    }

    receive() external payable {}

    function registerAgent(string calldata handle) external returns (bool) {
        _touchAgent(msg.sender);
        if (bytes(handle).length != 0) {
            _agents[msg.sender].handle = handle;
            emit AgentHandleUpdated(msg.sender, handle);
        }
        return true;
    }

    function createShop(string calldata name, string calldata metadataURI)
        external
        onlyRegistered
        returns (uint256 shopId)
    {
        if (bytes(name).length == 0) revert InvalidInput();
        shopId = nextShopId++;
        _shops[shopId] = Shop({
            owner: msg.sender,
            name: name,
            metadataURI: metadataURI,
            active: true,
            serviceCount: 0
        });

        _agents[msg.sender].shopsCreated += 1;
        _agents[msg.sender].roles |= ROLE_SHOP;

        emit AgentRoleUpdated(msg.sender, _agents[msg.sender].roles);
        emit ShopCreated(shopId, msg.sender, name, metadataURI);
    }

    function listService(
        uint256 shopId,
        string calldata title,
        string calldata metadataURI,
        uint256 price,
        address paymentToken,
        address hookTarget,
        bool hookRequired
    ) external onlyRegistered returns (uint256 serviceId) {
        Shop storage shop = _shops[shopId];
        if (shop.owner != msg.sender || !shop.active) revert Unauthorized();
        if (bytes(title).length == 0 || price == 0) revert InvalidInput();

        serviceId = nextServiceId++;
        _services[serviceId] = Service({
            shopId: shopId,
            provider: msg.sender,
            title: title,
            metadataURI: metadataURI,
            price: price,
            paymentToken: paymentToken,
            hookTarget: hookTarget,
            hookRequired: hookRequired,
            active: true
        });

        shop.serviceCount += 1;
        _agents[msg.sender].servicesCreated += 1;
        _agents[msg.sender].roles |= ROLE_SUPPLIER;

        emit AgentRoleUpdated(msg.sender, _agents[msg.sender].roles);
        emit ServiceListed(
            serviceId,
            shopId,
            msg.sender,
            title,
            price,
            paymentToken,
            hookTarget,
            hookRequired
        );
    }

    function hireService(uint256 serviceId, bytes calldata hookData)
        external
        payable
        onlyRegistered
        nonReentrant
        returns (uint256 jobId)
    {
        Service storage service = _services[serviceId];
        if (!service.active) revert InactiveService();

        _agents[msg.sender].roles |= ROLE_BUYER;
        _agents[service.provider].roles |= ROLE_WORKER;
        _agents[msg.sender].totalSpent += service.price;
        _agents[service.provider].totalEarned += service.price;
        _agents[service.provider].jobsCompleted += 1;

        uint256 grossAmount = service.price;
        (uint256 taxAmount, uint256 netAmount) = CovenantSkill.applyTax(grossAmount, _rules.taxBps);

        if (service.paymentToken == address(0)) {
            if (msg.value != grossAmount) revert BadPaymentAmount();
            // `msg.sender.balance` already reflects the value sent with this call.
            uint256 balanceAfter = msg.sender.balance;
            if (!CovenantSkill.checkBalanceRules(balanceAfter, _rules.minimumBalance)) {
                revert MinimumBalanceViolation();
            }
            emit PolicyGuardTriggered(msg.sender, address(0), balanceAfter, _rules.minimumBalance);

            _settleNative(service.provider, taxAmount, netAmount);
            treasuryAccruedNative[address(0)] += taxAmount;
            emit TreasuryCredited(address(0), taxAmount, msg.sender);
        } else {
            if (msg.value != 0) revert PaymentAssetMismatch();
            uint256 balanceAfter = IERC20Minimal(service.paymentToken).balanceOf(msg.sender) - grossAmount;
            if (!CovenantSkill.checkBalanceRules(balanceAfter, _rules.minimumBalance)) {
                revert MinimumBalanceViolation();
            }
            emit PolicyGuardTriggered(
                msg.sender,
                service.paymentToken,
                balanceAfter,
                _rules.minimumBalance
            );

            _settleToken(service.paymentToken, msg.sender, service.provider, taxAmount, netAmount);
            treasuryAccruedToken[service.paymentToken] += taxAmount;
            emit TreasuryCredited(service.paymentToken, taxAmount, msg.sender);
        }

        bool hookSuccess = _invokeHook(service, msg.sender, grossAmount, taxAmount, netAmount, hookData);

        jobId = nextJobId++;
        emit ServiceHired(
            jobId,
            serviceId,
            msg.sender,
            service.provider,
            service.paymentToken,
            grossAmount,
            taxAmount,
            netAmount,
            service.hookTarget,
            hookSuccess,
            keccak256(hookData)
        );
    }

    function proposeRuleChange(CovenantSkill.PolicyPatch calldata patch, string calldata memo)
        external
        onlyRegistered
        returns (uint256 proposalId)
    {
        proposalId = nextProposalId++;
        uint64 votingEndsAt = uint64(block.timestamp + _rules.votingPeriod);
        bytes32 digest = CovenantSkill.proposalDigest(proposalId, msg.sender, patch, memo);

        _proposals[proposalId] = Proposal({
            proposer: msg.sender,
            createdAt: uint64(block.timestamp),
            votingEndsAt: votingEndsAt,
            yesVotes: 0,
            noVotes: 0,
            executed: false,
            memo: memo,
            patch: patch,
            digest: digest
        });

        _agents[msg.sender].roles |= ROLE_GOVERNOR;
        emit AgentRoleUpdated(msg.sender, _agents[msg.sender].roles);
        emit ProposalCreated(proposalId, msg.sender, digest, votingEndsAt, memo);
    }

    function vote(uint256 proposalId, bool support) external onlyRegistered {
        Proposal storage proposal = _proposals[proposalId];
        if (proposal.proposer == address(0)) revert InvalidInput();
        if (block.timestamp >= proposal.votingEndsAt) revert VotingClosed();
        if (_hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        _hasVoted[proposalId][msg.sender] = true;
        _agents[msg.sender].votesCast += 1;
        _agents[msg.sender].roles |= ROLE_GOVERNOR;

        if (support) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit AgentRoleUpdated(msg.sender, _agents[msg.sender].roles);
        emit VoteCast(proposalId, msg.sender, support, proposal.yesVotes, proposal.noVotes);
    }

    function executeChange(uint256 proposalId) external onlyRegistered returns (bool passed) {
        Proposal storage proposal = _proposals[proposalId];
        if (proposal.proposer == address(0)) revert InvalidInput();
        if (proposal.executed) revert ProposalNotReady();
        if (block.timestamp < proposal.votingEndsAt) revert ProposalNotReady();

        passed = CovenantSkill.canExecute(
            proposal.yesVotes,
            proposal.noVotes,
            registeredAgentCount,
            _rules.quorumBps,
            _rules.supportBps
        );
        if (!passed) revert ProposalNotReady();

        (CovenantSkill.PolicyRules memory nextRules, address nextTreasury) =
            CovenantSkill.applyPatch(_rules, proposal.patch, treasury);
        address oldTreasury = treasury;
        _rules = nextRules;
        treasury = nextTreasury;
        proposal.executed = true;

        if (oldTreasury != treasury) {
            emit TreasuryUpdated(oldTreasury, treasury);
        }
        emit RuleUpdated(
            proposalId,
            _rules.taxBps,
            _rules.minimumBalance,
            _rules.quorumBps,
            _rules.supportBps,
            _rules.votingPeriod,
            treasury
        );
    }

    function getRules()
        external
        view
        returns (
            uint16 taxBps,
            uint256 minimumBalance,
            uint16 quorumBps,
            uint16 supportBps,
            uint64 votingPeriod
        )
    {
        return (
            _rules.taxBps,
            _rules.minimumBalance,
            _rules.quorumBps,
            _rules.supportBps,
            _rules.votingPeriod
        );
    }

    function getAgent(address account)
        external
        view
        returns (
            bool registered,
            string memory handle,
            uint64 joinedAt,
            uint256 totalEarned,
            uint256 totalSpent,
            uint256 shopsCreated,
            uint256 servicesCreated,
            uint256 jobsCompleted,
            uint256 votesCast,
            uint8 roles
        )
    {
        AgentProfile storage a = _agents[account];
        return (
            a.registered,
            a.handle,
            a.joinedAt,
            a.totalEarned,
            a.totalSpent,
            a.shopsCreated,
            a.servicesCreated,
            a.jobsCompleted,
            a.votesCast,
            a.roles
        );
    }

    function getShop(uint256 shopId)
        external
        view
        returns (address owner, string memory name, string memory metadataURI, bool active, uint256 serviceCount)
    {
        Shop storage shop = _shops[shopId];
        return (shop.owner, shop.name, shop.metadataURI, shop.active, shop.serviceCount);
    }

    function getService(uint256 serviceId)
        external
        view
        returns (
            uint256 shopId,
            address provider,
            string memory title,
            string memory metadataURI,
            uint256 price,
            address paymentToken,
            address hookTarget,
            bool hookRequired,
            bool active
        )
    {
        Service storage service = _services[serviceId];
        return (
            service.shopId,
            service.provider,
            service.title,
            service.metadataURI,
            service.price,
            service.paymentToken,
            service.hookTarget,
            service.hookRequired,
            service.active
        );
    }

    function getProposal(uint256 proposalId)
        external
        view
        returns (
            address proposer,
            uint64 createdAt,
            uint64 votingEndsAt,
            uint256 yesVotes,
            uint256 noVotes,
            bool executed,
            string memory memo,
            CovenantSkill.PolicyPatch memory patch,
            bytes32 digest
        )
    {
        Proposal storage proposal = _proposals[proposalId];
        return (
            proposal.proposer,
            proposal.createdAt,
            proposal.votingEndsAt,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.executed,
            proposal.memo,
            proposal.patch,
            proposal.digest
        );
    }

    function _touchAgent(address account) internal {
        AgentProfile storage agent = _agents[account];
        if (!agent.registered) {
            agent.registered = true;
            agent.joinedAt = uint64(block.timestamp);
            registeredAgentCount += 1;
            emit AgentRegistered(account, agent.handle);
        }
    }

    function _settleNative(address provider, uint256 taxAmount, uint256 netAmount) internal {
        (bool treasuryOk, ) = payable(treasury).call{value: taxAmount}("");
        if (!treasuryOk) revert TreasuryTransferFailed();

        (bool providerOk, ) = payable(provider).call{value: netAmount}("");
        if (!providerOk) revert ProviderTransferFailed();
    }

    function _settleToken(
        address token,
        address payer,
        address provider,
        uint256 taxAmount,
        uint256 netAmount
    ) internal {
        _safeTransferFrom(token, payer, treasury, taxAmount);
        _safeTransferFrom(token, payer, provider, netAmount);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20Minimal.transferFrom.selector, from, to, amount)
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TreasuryTransferFailed();
        }
    }

    function _invokeHook(
        Service storage service,
        address payer,
        uint256 grossAmount,
        uint256 taxAmount,
        uint256 netAmount,
        bytes calldata hookData
    ) internal returns (bool hookSuccess) {
        if (service.hookTarget == address(0)) {
            return false;
        }

        bytes4 expected = IBazaarPaymentHook.onBazaarPayment.selector;
        try
            IBazaarPaymentHook(service.hookTarget).onBazaarPayment(
                payer,
                service.provider,
                service.paymentToken,
                grossAmount,
                taxAmount,
                netAmount,
                hookData
            )
        returns (bytes4 magic) {
            hookSuccess = magic == expected;
            if (!hookSuccess && service.hookRequired) revert InvalidHookResponse();
        } catch {
            if (service.hookRequired) revert HookFailed();
            hookSuccess = false;
        }
    }
}
