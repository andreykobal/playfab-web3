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


// Function to fetch user data using PlayFabAdmin.GetUserData
function getAdminUserData(playFabId, dataKey) {
    return new Promise((resolve, reject) => {
        PlayFabAdmin.GetUserData({
            PlayFabId: playFabId,
            Keys: [dataKey]
        }, (error, result) => {
            if (error) {
                console.error(`Got an error getting ${dataKey}:`, error);
                reject(error);
            } else {
                console.log(`Got ${dataKey} from PlayFab:`, result);
                // Extracting and returning the value for the specific key
                const dataValue = result.data.Data[dataKey] ? result.data.Data[dataKey].Value : null;
                resolve(dataValue);
            }
        });
    });
}

// Function to specifically fetch the PerformancePoints for a user
function getPerformancePointsAdmin(playFabId) {
    return getAdminUserData(playFabId, "PerformancePoints")
        .then(performancePoints => {
            console.log(`Performance Points for user ${playFabId}: ${performancePoints}`);
            return performancePoints; // This will be the resolved value of the promise
        })
        .catch(error => {
            console.error(`Error fetching Performance Points for user ${playFabId}:`, error);
            throw error; // Re-throw the error to be handled by the caller
        });
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



// Updated function to add wallet address and performance score to title data
async function addWalletAddressAndPerformanceScoreToTitleData(userId, walletAddress) {
    try {
        const getTitleDataResponse = await getTitleData(["UsersWithWallets"]);
        let usersWithWallets = getTitleDataResponse.data.Data["UsersWithWallets"] ? JSON.parse(getTitleDataResponse.data.Data["UsersWithWallets"]) : [];
        let userFound = usersWithWallets.find(user => user.userId === userId);

        // Fetch performance points using getPerformancePointsAdmin
        const performancePoints = await getPerformancePointsAdmin(userId);

        if (userFound) {
            // User exists, update their performance score
            console.log(`User ${userId} found. Updating performance points.`);
            userFound.performanceScore = parseInt(performancePoints, 10) || generatePerformanceScore(); // Use fetched performance points or generate
        } else {
            // User does not exist, add them with wallet address and fetched performance points
            console.log(`Adding user ${userId} with wallet address ${walletAddress} and performance points.`);
            usersWithWallets.push({
                userId,
                walletAddress,
                performanceScore: parseInt(performancePoints, 10) || generatePerformanceScore() // Use fetched performance points or generate
            });
        }

        // Update the title data with the new or updated list of users
        await updateTitleData("UsersWithWallets", usersWithWallets);
        console.log(`Successfully updated title data for users with wallets.`);

        // Proceed with distributing daily rewards and updating token balances in PlayFab
        const recipients = usersWithWallets.map(user => user.walletAddress);
        const performanceScores = usersWithWallets.map(user => user.performanceScore);
        await distributeDailyRewards(recipients, performanceScores);
        await updateTokenBalancesInPlayFab(usersWithWallets);

    } catch (error) {
        console.error("An error occurred while adding wallet address and performance score to title data:", error);
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

// Function to authenticate session ticket
async function authenticateSessionTicket(sessionTicket) {
    return new Promise((resolve, reject) => {
        PlayFabServer.AuthenticateSessionTicket({ SessionTicket: sessionTicket }, (error, result) => {
            if (error) {
                console.error("Authentication failed:", error);
                reject(error);
            } else {
                resolve(result.data.UserInfo.PlayFabId);
            }
        });
    });
}

// Function to handle wallet management and response
async function manageWalletAndRespond(userId, res) {
    try {
        let walletAddress = await getUserWalletAddress(userId);
        if (!walletAddress) {
            // Wallet does not exist, create a new one and update PlayFab
            const newAccount = web3.eth.accounts.create();
            await updateUserWalletAddress(userId, newAccount.address);
            // Store only the private key in a secure location
            await storePrivateKeyInVault(userId, newAccount.privateKey);
            console.log(`Wallet created and stored for user ${userId}`);
            await updateUserBalance({ userId, walletAddress: newAccount.address });
            walletAddress = newAccount.address; // Update for response
        } else {
            // Update user balance
            await updateUserBalance({ userId, walletAddress });
        }
        res.send({ message: `Authentication successful, Wallet address for the user: ${walletAddress}` });
    } catch (e) {
        console.error("An error occurred during wallet management: ", e);
        res.status(500).send({ message: "Failed to manage wallet" });
    }
}




// Refactor the '/authenticate' endpoint
app.post('/authenticate', async (req, res) => {
    const sessionTicket = req.body.sessionTicket;
    if (!sessionTicket) {
        return res.status(400).send({ message: 'Session ticket is required' });
    }

    try {
        const userId = await authenticateSessionTicket(sessionTicket);
        await manageWalletAndRespond(userId, res);
    } catch (error) {
        res.status(500).send({ message: "Authentication failed", error });
    }
});

// New endpoint: /distributedailyrewards
app.post('/distributedailyrewards', async (req, res) => {
    const { sessionTicket } = req.body;

    // Check if sessionTicket was provided in the request
    if (!sessionTicket) {
        return res.status(400).send({ message: 'Session ticket is required' });
    }

    try {
        // Authenticate the session ticket to get the user's PlayFabId
        const userId = await authenticateSessionTicket(sessionTicket);

        // Assume getUserWalletAddress is a function that retrieves the user's wallet address
        // If not existing, it should be implemented based on your application's logic
        const walletAddress = await getUserWalletAddress(userId);

        // Invoke the function to add wallet address and performance score to title data
        // This function will handle checking if the user exists, updating or adding performance score,
        // and distributing daily rewards and updating token balances
        await addWalletAddressAndPerformanceScoreToTitleData(userId, walletAddress);

        // Send a success response
        res.send({ message: "Daily rewards distributed successfully." });
    } catch (error) {
        console.error("An error occurred during daily rewards distribution:", error);
        res.status(500).send({ message: "Failed to distribute daily rewards", error: error.toString() });
    }
});



app.post('/transferToken', async (req, res) => {
    const { recipientUserId, sessionTicket, amount } = req.body;

    if (!sessionTicket || !recipientUserId || !amount) {
        return res.status(400).send({ message: 'Session ticket, recipient user ID, and amount are required' });
    }

    try {

        const senderUserId = await authenticateSessionTicket(sessionTicket);

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


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
