// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract WrappedNative {
    string public constant name = "Wrapped OKB";
    string public constant symbol = "WOKB";
    uint8 public constant decimals = 18;

    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Deposit(address indexed owner, uint256 value);
    event Withdrawal(address indexed owner, uint256 value);

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    receive() external payable {
        deposit();
    }

    function totalSupply() external view returns (uint256) {
        return address(this).balance;
    }

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;

        emit Deposit(msg.sender, msg.value);
        emit Transfer(address(0), msg.sender, msg.value);
    }

    function withdraw(uint256 value) external {
        require(balanceOf[msg.sender] >= value, "INSUFFICIENT_BALANCE");

        unchecked {
            balanceOf[msg.sender] -= value;
        }

        emit Transfer(msg.sender, address(0), value);
        emit Withdrawal(msg.sender, value);

        (bool success, ) = msg.sender.call{ value: value }("");
        require(success, "WITHDRAW_FAILED");
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        return transferFrom(msg.sender, to, value);
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        if (from != msg.sender) {
            uint256 allowed = allowance[from][msg.sender];
            require(allowed >= value, "INSUFFICIENT_ALLOWANCE");

            if (allowed != type(uint256).max) {
                unchecked {
                    allowance[from][msg.sender] = allowed - value;
                }
            }
        }

        require(balanceOf[from] >= value, "INSUFFICIENT_BALANCE");

        unchecked {
            balanceOf[from] -= value;
            balanceOf[to] += value;
        }

        emit Transfer(from, to, value);
        return true;
    }
}
