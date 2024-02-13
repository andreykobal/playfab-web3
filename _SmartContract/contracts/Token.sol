//SPDX-License-Identifier: UNLICENSED

// Solidity files have to start with this pragma.
// It will be used by the Solidity compiler to validate its version.
pragma solidity ^0.8.9;

// We import this library to be able to use console.log
import "hardhat/console.sol";


// This is the main building block for smart contracts.
contract Token {
    // Some string type variables to identify the token.
    string public name = "AILAND Testnet Token";
    string public symbol = "AILANDT";

    // The number of decimals for your token.
    uint8 public decimals = 18;

    // The fixed amount of tokens stored in an unsigned integer type variable.
    uint256 public totalSupply = 1000000000000000000000000;

    // An address type variable is used to store ethereum accounts.
    address public owner;

    // A mapping is a key/value map. Here we store each account balance.
    mapping(address => uint256) balances;

    // The Transfer event helps off-chain applications understand
    // what happens within your contract.
    event Transfer(address indexed _from, address indexed _to, uint256 _value);

    /**
     * Contract initialization.
     */
    constructor() {
        // The totalSupply is assigned to the transaction sender, which is the
        // account that is deploying the contract.
        balances[msg.sender] = totalSupply;
        owner = msg.sender;
    }

    /**
     * A function to transfer tokens.
     *
     * The `external` modifier makes a function *only* callable from outside
     * the contract.
     */
    function transfer(address to, uint256 amount) external {
        // Check if the transaction sender has enough tokens.
        // If `require`'s first argument evaluates to `false` then the
        // transaction will revert.
        require(balances[msg.sender] >= amount, "Not enough tokens");

        // Transfer the amount.
        balances[msg.sender] -= amount;
        balances[to] += amount;

        // Notify off-chain applications of the transfer.
        emit Transfer(msg.sender, to, amount);
    }

    /**
     * Function to transfer tokens to multiple recipients.
     */
    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
        require(recipients.length == amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            // Ensure the sender has enough tokens for each transfer.
            require(balances[msg.sender] >= amounts[i], "Not enough tokens");

            // Transfer the amount to the recipient.
            balances[msg.sender] -= amounts[i];
            balances[recipients[i]] += amounts[i];

            // Notify off-chain applications of each transfer.
            emit Transfer(msg.sender, recipients[i], amounts[i]);
        }
    }

    /**
     * Read only function to retrieve the token balance of a given account.
     *
     * The `view` modifier indicates that it doesn't modify the contract's
     * state, which allows us to call it without executing a transaction.
     */
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
}
