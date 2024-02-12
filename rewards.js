// Import web3.js
const { Web3 } = require('web3');
const fs = require('fs').promises;
require('dotenv').config(); // This loads the environment variables from the .env file

async function batchTransfer(recipients, amounts) {
    // Provider URL for Goerli
    const providerUrl = "https://eth-goerli.g.alchemy.com/v2/5kJ19pS_d17Gf4Cj8Y7Rcu69MSZRZlYF";
    const privateKey = process.env.PRIVATE_KEY; // Private key of your account

    // Create a new instance of Web3
    const web3 = new Web3(providerUrl);

    // Create a new account using private key
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);

    // Get the contract ABI from abi.json
    const abiFilePath = './abi.json';
    let abi;
    try {
        const abiData = await fs.readFile(abiFilePath);
        abi = JSON.parse(abiData);
    } catch (error) {
        console.error("Error reading or parsing ABI file:", error);
        return;
    }

    // Get the contract address
    const tokenAddress = "0xAEd7983819124dCeF57c82C023f60a511466E31A";

    // Convert ETH amounts to Wei
    const amountsInWei = amounts.map(amount => web3.utils.toWei(amount, "ether"));

    // Create a contract instance
    const tokenContract = new web3.eth.Contract(abi, tokenAddress);

    // Encode the function call
    const data = tokenContract.methods.batchTransfer(recipients, amountsInWei).encodeABI();

    // Set a higher gas limit or gas price
    const gasLimit = 3000000; // Adjust as needed
    const gasPrice = await web3.eth.getGasPrice(); // Get the current gas price
    const txObject = {
        from: account.address,
        to: tokenAddress,
        data: data,
        gas: gasLimit,
        gasPrice: gasPrice // Use the current gas price
    };

    // Sign the transaction
    const signedTx = await web3.eth.accounts.signTransaction(txObject, privateKey);

    // Send the signed transaction
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log("Batch transfer successful");
}

// Example usage:
const recipients = ["0x77df32b40A8fc6B1Fad487ECe1C9B517A96c562D", "0x050731ca68ba2375eb5c843fe547c491ae82d929"];
const amounts = ["100.33", "200.66"]; // Amount of tokens to send to each recipient
batchTransfer(recipients, amounts)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
