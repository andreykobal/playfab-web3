//web3Functions.js

const { Web3 } = require('web3');
const fs = require('fs').promises;
require('dotenv').config();

// Provider URL and private key
const providerUrl = "https://eth-goerli.g.alchemy.com/v2/5kJ19pS_d17Gf4Cj8Y7Rcu69MSZRZlYF";
const privateKey = process.env.PRIVATE_KEY;

// Initialize a new instance of Web3
const web3 = new Web3(providerUrl);

// Contract address
const tokenAddress = "0xAEd7983819124dCeF57c82C023f60a511466E31A";

// Read the contract ABI asynchronously and create a contract instance
let tokenContract; // This will hold the contract instance
async function setupContract() {
    try {
        const abiData = await fs.readFile('./abi.json');
        const abi = JSON.parse(abiData);
        tokenContract = new web3.eth.Contract(abi, tokenAddress);
    } catch (error) {
        console.error("Error setting up the contract:", error);
    }
}   

// Call setupContract at the start of your application
setupContract();

async function distributeDailyRewards(recipients, performanceScores) {
    if (!tokenContract) {
        console.error("Contract not set up");
        return;
    }

    const dailyRewardPool = 100;
    const totalPerformanceScore = performanceScores.reduce((acc, score) => acc + score, 0);
    const rewards = performanceScores.map(score => (score / totalPerformanceScore) * dailyRewardPool);
    const amountsInWei = rewards.map(amount => web3.utils.toWei(amount.toString(), "ether"));

    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const data = tokenContract.methods.batchTransfer(recipients, amountsInWei).encodeABI();
    const gasLimit = 3000000;
    const gasPrice = await web3.eth.getGasPrice();
    const txObject = {
        from: account.address,
        to: tokenAddress,
        data: data,
        gas: gasLimit,
        gasPrice: gasPrice
    };

    const signedTx = await web3.eth.accounts.signTransaction(txObject, privateKey);
    await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log("\x1b[33m%s\x1b[0m", "💸 Daily rewards distribution successful! 💸");
    recipients.forEach((recipient, i) => console.log(`Recipient: ${recipient}, Amount: ${rewards[i]}`));
}

async function getTokenBalance(address) {
    if (!tokenContract) {
        console.error("Contract not set up");
        return;
    }
    return await tokenContract.methods.balanceOf(address).call();
}

async function makeSimpleTransfer(recipientAddress, amount, userPrivateKey) {
    if (!tokenContract) {
        console.error("Contract not set up");
        return;
    }

    const amountInWei = web3.utils.toWei(amount.toString(), "ether");
    const account = web3.eth.accounts.privateKeyToAccount(userPrivateKey);

    // Get the current nonce for the account
    const nonce = await web3.eth.getTransactionCount(account.address, "latest");

    const data = tokenContract.methods.transfer(recipientAddress, amountInWei).encodeABI();
    const gasPrice = await web3.eth.getGasPrice();
    // It's better to estimate gas if possible, but for simplicity, we're using a fixed value
    const gasLimit = await tokenContract.methods.transfer(recipientAddress, amountInWei).estimateGas({ from: account.address });

    const txObject = {
        from: account.address,
        to: tokenAddress,
        data: data,
        gas: gasLimit,
        gasPrice: gasPrice,
        nonce: nonce // Set the nonce explicitly
    };

    // Sign and send the transaction
    const signedTx = await web3.eth.accounts.signTransaction(txObject, userPrivateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log(`✅ Transfer successful! TxHash: ${receipt.transactionHash}`);
}

async function sendEther(recipientAddress, amountInEther) {
    if (!web3) {
        console.error("Web3 instance not initialized");
        return;
    }

    const amountInWei = web3.utils.toWei(amountInEther.toString(), "ether");
    const account = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);

    // Get the current nonce for the account
    const nonce = await web3.eth.getTransactionCount(account.address, "latest");

    // Prepare the transaction object
    const txObject = {
        from: account.address,
        to: recipientAddress,
        value: amountInWei,
        gas: '21000', // This is the standard gas limit for a simple ETH transfer
        gasPrice: await web3.eth.getGasPrice(),
        nonce: nonce
    };

    // Sign the transaction with the private key
    const signedTx = await account.signTransaction(txObject);

    // Send the signed transaction to the Ethereum network
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log(`✅ Ether transfer successful! TxHash: ${receipt.transactionHash}`);
}




module.exports = { distributeDailyRewards, getTokenBalance, makeSimpleTransfer, sendEther};