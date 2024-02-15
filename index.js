const express = require('express');
const bodyParser = require('body-parser');
const { PlayFabAdmin, PlayFabServer, PlayFab } = require('playfab-sdk');
const { Web3 } = require('web3'); // Corrected the destructuring for Web3
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

const { distributeDailyRewards, getTokenBalance, makeSimpleTransfer, sendEther } = require('./web3Functions');


require('dotenv').config(); // This loads the environment variables from the .env file

// Azure Key Vault setup
const keyVaultName = process.env.KEY_VAULT_NAME; // Set this in your environment variables
const keyVaultUrl = `https://${keyVaultName}.vault.azure.net/`;

// Using DefaultAzureCredential assumes the environment is already set up for authentication (e.g., via Azure Managed Identity)
const credential = new DefaultAzureCredential();
const secretClient = new SecretClient(keyVaultUrl, credential);


// Initialize PlayFab configuration
PlayFab.settings.titleId = process.env.PLAYFAB_TITLE_ID;
PlayFab.settings.developerSecretKey = process.env.PLAYFAB_SECRET_KEY;

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Initialize web3 with a provider
const web3 = new Web3('https://ethereum-goerli.publicnode.com');



function setUserReadOnlyData(playFabId, dataKey, dataValue) {
    return new Promise((resolve, reject) => {
        const updateDataRequest = {
            PlayFabId: playFabId,
            Data: {
                [dataKey]: dataValue
            },
            Permission: "Private"
        };

        PlayFabAdmin.UpdateUserReadOnlyData(updateDataRequest, (error, result) => {
            if (error) {
                console.error(`Got an error updating ${dataKey}:`, error);
                reject(error);
            } else {
                console.log(`Updated ${dataKey} successfully:`, result);
                resolve(result);
            }
        });
    });
}

function getUserReadOnlyData(playFabId, dataKey) {
    return new Promise((resolve, reject) => {
        const getDataRequest = {
            PlayFabId: playFabId,
            Keys: [dataKey]
        };

        PlayFabAdmin.GetUserReadOnlyData(getDataRequest, (error, result) => {
            if (error) {
                console.error(`Got an error getting ${dataKey}:`, error);
                reject(error);
            } else {
                console.log(`Got ${dataKey} from Playfab:`, result);
                const dataValue = result.data.Data[dataKey] ? result.data.Data[dataKey].Value : null;
                console.log(`${dataKey} for user ${playFabId}: ${dataValue}`);
                resolve(dataValue);
            }
        });
    });
}

function updateUserWalletAddress(id, walletAddress) {
    return setUserReadOnlyData(id, "WalletAddress", walletAddress);
}

function getUserWalletAddress(id) {
    return getUserReadOnlyData(id, "WalletAddress");
}

function getUserTokenBalance(id) {
    return getUserReadOnlyData(id, "TokenBalance");
}



async function storePrivateKeyInVault(userId, privateKey) {
    await secretClient.setSecret(`PrivateKey-${userId}`, privateKey);
    console.log(`Private key stored in Key Vault for user ${userId}`);
}

async function retrievePrivateKeyFromVault(userId) {
    try {
        const secretBundle = await secretClient.getSecret(`PrivateKey-${userId}`);
        console.log(`Retrieved private key for user ${userId} from Key Vault`);
        return secretBundle.value;
    } catch (e) {
        console.error(`Failed to retrieve private key for user ${userId} from Key Vault`, e);
        return null;
    }
}

//a function that first gets the list list of users that have a wallet address using PlayFabServer.GetTitleData and checks if the user is already in the list and if not -  adds a user to the list of users that have a wallet address using PlayFabServer.SetTitleData

// Function to get title data
async function getTitleData(keys) {
    return new Promise((resolve, reject) => {
        PlayFabAdmin.GetTitleData({ Keys: keys }, (error, result) => {
            if (error) {
                console.error("Error getting title data:", error);
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}

// Function to check if a user exists in the users list
function userExists(usersWithWallets, userId) {
    return usersWithWallets.some(user => user.userId === userId);
}

// Function to generate a random performance score
function generatePerformanceScore() {
    // Ideally, replace this with a real calculation/measurement of performance
    return Math.floor(Math.random() * 100) + 1;
}

// Function to update title data with new user information
async function updateTitleData(key, value) {
    return new Promise((resolve, reject) => {
        PlayFabAdmin.SetTitleData({
            Key: key,
            Value: JSON.stringify(value)
        }, (error, result) => {
            if (error) {
                console.error("Error setting title data:", error);
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}

// Function to update the token balance for a single user
async function updateUserBalance(user) {
    const balance = await getTokenBalance(user.walletAddress);
    // Convert balance from Wei (or the token's smallest unit) to a human-readable format if necessary
    const readableBalance = web3.utils.fromWei(balance, 'ether');
    await setUserReadOnlyData(user.userId, "TokenBalance", readableBalance);
    console.log(`Updated Token Balance for user ${user.userId}: ${readableBalance}`);
}

// Function to update token balances for multiple users using the reusable function
async function updateTokenBalancesInPlayFab(usersWithWallets) {
    for (const user of usersWithWallets) {
        await updateUserBalance(user);
    }
}



// Main function to add wallet address and performance score to title data
async function addWalletAddressAndPerformanceScoreToTitleData(userId, walletAddress) {
    try {
        const getTitleDataResponse = await getTitleData(["UsersWithWallets"]);

        let usersWithWallets = getTitleDataResponse.data.Data["UsersWithWallets"] ? JSON.parse(getTitleDataResponse.data.Data["UsersWithWallets"]) : [];

        if (!userExists(usersWithWallets, userId)) {
            const performanceScore = generatePerformanceScore();
            usersWithWallets.push({ userId, walletAddress, performanceScore });
            console.log(`Adding user ${userId} with wallet address ${walletAddress} and performance score ${performanceScore} to the list.`);
            await updateTitleData("UsersWithWallets", usersWithWallets);
            console.log(`Successfully added user ${userId} with performance score to the list of users with wallets in title data.`);
        } else {
            console.log(`User ${userId} is already in the list. No action taken.`);
        }

        console.log("List of users with wallets and performance scores: ", usersWithWallets);

        // Extract recipients and performanceScores from usersWithWallets
        const recipients = usersWithWallets.map(user => user.walletAddress);
        const performanceScores = usersWithWallets.map(user => user.performanceScore);

        // use these arrays distributeDailyRewards function
        await distributeDailyRewards(recipients, performanceScores);

        await updateTokenBalancesInPlayFab(usersWithWallets);


    } catch (error) {
        console.error("An error occurred:", error);
    }
}


// Function to check ETH balance
async function checkAndSendEthIfNeeded(walletAddress, userId) {
    const balance = await web3.eth.getBalance(walletAddress);
    console.log(`ETH Balance for user ${userId}: ${balance}`);

    if (BigInt(balance) < BigInt("100000000000000")) { // 0.0001 Ether in Wei
        console.log("Balance is less than 0.0001 Ether, sending ether");
        await sendEther(walletAddress, '0.0001');
        console.log(`Ether sent to wallet with address ${walletAddress}`);
    }
}




app.post('/authenticate', async (req, res) => {
    const sessionTicket = req.body.sessionTicket;

    if (!sessionTicket) {
        return res.status(400).send({ message: 'Session ticket is required' });
    }

    const request = {
        SessionTicket: sessionTicket,
    };

    PlayFabServer.AuthenticateSessionTicket(request, async (error, result) => {
        if (error) {
            console.error("Got an error: ", error);
            res.status(500).send({ message: "Authentication failed", error });
        } else {
            console.log("\x1b[36m%s\x1b[0m", "Got a result: ", result);

            const userId = result.data.UserInfo.PlayFabId;
            try {
                const walletAddress = await getUserWalletAddress(userId);
                if (!walletAddress) {
                    // Wallet does not exist, create a new one and update PlayFab
                    const newAccount = web3.eth.accounts.create();
                    await updateUserWalletAddress(userId, newAccount.address);
                    // Store only the private key in a secure location
                    await storePrivateKeyInVault(userId, newAccount.privateKey);
                    console.log(`Wallet created and stored for user ${userId}`);
                    await updateUserBalance({ userId, walletAddress: newAccount.address});
                    res.send({ message: `Authentication successful, Wallet address for the user: ${newAccount.address}` });
                    
                    //HARDCODED
                    //await addWalletAddressAndPerformanceScoreToTitleData(userId, newAccount.address);
                } else {
                    //update user balance
                    await updateUserBalance({ userId, walletAddress });
                    res.send({ message: `Authentication successful, Wallet address for the user: ${walletAddress}` });
                    
                    //HARDCODED
                    //addWalletAddressAndPerformanceScoreToTitleData(userId, walletAddress);
                }
            } catch (e) {
                console.error("An error occurred during wallet management: ", e);
                res.status(500).send({ message: "Failed to manage wallet" });
            }
        }
    });
});

app.post('/transferToken', async (req, res) => {
    const { recipientUserId, sessionTicket, amount } = req.body;

    if (!sessionTicket || !recipientUserId || !amount) {
        return res.status(400).send({ message: 'Session ticket, recipient user ID, and amount are required' });
    }

    // Authenticate the session ticket
    PlayFabServer.AuthenticateSessionTicket({ SessionTicket: sessionTicket }, async (error, authResult) => {
        if (error) {
            console.error("Authentication failed:", error);
            return res.status(500).send({ message: "Authentication failed", error });
        }

        const senderUserId = authResult.data.UserInfo.PlayFabId;

        try {
            // Get sender's wallet address and token balance
            const senderWalletAddress = await getUserWalletAddress(senderUserId);
            const senderPrivateKey = await retrievePrivateKeyFromVault(senderUserId);
            const senderTokenBalance = await getUserTokenBalance(senderUserId); // Assuming this returns the balance in a readable format
            // OR check balance with getTokenBalance 
            //const senderTokenBalance = await getTokenBalance(senderWalletAddress);



            if (!senderWalletAddress || !senderPrivateKey) {
                return res.status(404).send({ message: "Sender's wallet address or private key not found" });
            }
            

            // Convert token balance to a number and compare with the amount to be transferred
            const balance = parseFloat(senderTokenBalance);
            if (isNaN(balance) || balance < amount) {
                return res.status(400).send({ message: "Insufficient token balance" });
            }

            // Get recipient's wallet address
            const recipientWalletAddress = await getUserWalletAddress(recipientUserId);
            if (!recipientWalletAddress) {
                return res.status(404).send({ message: "Recipient's wallet address not found" });
            }

            //check the balance and send Ether if needed
            await checkAndSendEthIfNeeded(senderWalletAddress, senderUserId);


            // Perform the transfer
            await makeSimpleTransfer(recipientWalletAddress, amount, senderPrivateKey);
            //update user balance
            await updateUserBalance({ userId: senderUserId, walletAddress: senderWalletAddress });

            res.send({ message: "Token transfer successful" });
        } catch (e) {
            console.error("Token transfer error:", e);
            res.status(500).send({ message: "Failed to transfer tokens", error: e.toString() });
        }
    });
});


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
